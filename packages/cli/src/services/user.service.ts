// ✅ packages/cli/src/services/user.service.ts

import type { RoleChangeRequestDto } from '@n8n/api-types';
import type { PublicUser } from '@n8n/db';
import { User, UserRepository } from '@n8n/db';
import { Service } from '@n8n/di';
import { getGlobalScopes, type AssignableGlobalRole } from '@n8n/permissions';
import { Logger } from 'n8n-core';
import type { IUserSettings } from 'n8n-workflow';
import { UnexpectedError } from 'n8n-workflow';

import { InternalServerError } from '@/errors/response-errors/internal-server.error';
import { EventService } from '@/events/event.service';
import type { Invitation } from '@/interfaces';
import type { PostHogClient } from '@/posthog';
import type { UserRequest } from '@/requests';
import { UrlService } from '@/services/url.service';
import { UserManagementMailer } from '@/user-management/email';
import { PublicApiKeyService } from './public-api-key.service';
import { SupabaseHelper } from '@/helpers/SupabaseHelper';

@Service()
export class UserService {
  constructor(
    private readonly logger: Logger,
    private readonly userRepository: UserRepository,
    private readonly mailer: UserManagementMailer,
    private readonly urlService: UrlService,
    private readonly eventService: EventService,
    private readonly publicApiKeyService: PublicApiKeyService,
  ) {}

  async update(userId: string, data: Partial<User>) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (user) {
      const updated = await this.userRepository.save({ ...user, ...data }, { transaction: true });
      await SupabaseHelper.insertOrUpdateUser(updated);
    }
  }

  getManager() {
    return this.userRepository.manager;
  }

  async updateSettings(userId: string, newSettings: Partial<IUserSettings>) {
    const user = await this.userRepository.findOneOrFail({ where: { id: userId } });
    if (user.settings) Object.assign(user.settings, newSettings);
    else user.settings = newSettings;
    await this.userRepository.save(user);
  }

  async toPublic(
    user: User,
    options?: {
      withInviteUrl?: boolean;
      inviterId?: string;
      posthog?: PostHogClient;
      withScopes?: boolean;
    },
  ) {
    const { password, updatedAt, authIdentities, mfaRecoveryCodes, mfaSecret, ...rest } = user;
    const ldapIdentity = authIdentities?.find((i) => i.providerType === 'ldap');

    let publicUser: PublicUser = {
      ...rest,
      signInType: ldapIdentity ? 'ldap' : 'email',
      isOwner: user.role === 'global:owner',
    };

    if (options?.withInviteUrl && !options?.inviterId)
      throw new UnexpectedError('Inviter ID is required to generate invite URL');

    if (options?.withInviteUrl && options?.inviterId && publicUser.isPending)
      publicUser = this.addInviteUrl(options.inviterId, publicUser);

    if (options?.posthog)
      publicUser = await this.addFeatureFlags(publicUser, options.posthog);

    if (options?.withScopes)
      publicUser.globalScopes = getGlobalScopes(user);

    return publicUser;
  }

  private addInviteUrl(inviterId: string, invitee: PublicUser) {
    const url = new URL(this.urlService.getInstanceBaseUrl());
    url.pathname = '/signup';
    url.searchParams.set('inviterId', inviterId);
    url.searchParams.set('inviteeId', invitee.id);
    invitee.inviteAcceptUrl = url.toString();
    return invitee;
  }

  private async addFeatureFlags(publicUser: PublicUser, posthog: PostHogClient) {
    const timeoutPromise = new Promise<PublicUser>((resolve) => setTimeout(() => resolve(publicUser), 1500));
    const fetchPromise = (async () => {
      publicUser.featureFlags = await posthog.getFeatureFlags(publicUser);
      return publicUser;
    })();
    return await Promise.race([fetchPromise, timeoutPromise]);
  }

  private async sendEmails(
    owner: User,
    toInviteUsers: Record<string, string>,
    role: AssignableGlobalRole,
  ) {
    const domain = this.urlService.getInstanceBaseUrl();
    return await Promise.all(
      Object.entries(toInviteUsers).map(async ([email, id]) => {
        const inviteAcceptUrl = `${domain}/signup?inviterId=${owner.id}&inviteeId=${id}`;
        const invitedUser: UserRequest.InviteResponse = {
          user: { id, email, inviteAcceptUrl, emailSent: false, role },
          error: '',
        };
        try {
          const result = await this.mailer.invite({ email, inviteAcceptUrl });
          if (result.emailSent) {
            invitedUser.user.emailSent = true;
            delete invitedUser.user.inviteAcceptUrl;
            this.eventService.emit('user-transactional-email-sent', {
              userId: id,
              messageType: 'New user invite',
              publicApi: false,
            });
          }
          this.eventService.emit('user-invited', {
            user: owner,
            targetUserId: Object.values(toInviteUsers),
            publicApi: false,
            emailSent: result.emailSent,
            inviteeRole: role,
          });
        } catch (e) {
          if (e instanceof Error) {
            this.eventService.emit('email-failed', {
              user: owner,
              messageType: 'New user invite',
              publicApi: false,
            });
            this.logger.error('Failed to send email', { userId: owner.id, inviteAcceptUrl, email });
            invitedUser.error = e.message;
          }
        }
        return invitedUser;
      })
    );
  }

  async inviteUsers(owner: User, invitations: Invitation[]) {
    const emails = invitations.map(({ email }) => email);
    const existingUsers = await this.userRepository.findManyByEmail(emails);
    const existingEmails = existingUsers.map((user) => user.email);
    const toCreate = invitations.filter(({ email }) => !existingEmails.includes(email));
    const pending = existingUsers.filter((user) => user.isPending);
    const createdUsers = new Map<string, string>();

    try {
      await this.getManager().transaction(async (trx) => {
        await Promise.all(
          toCreate.map(async ({ email, role }) => {
            const { user: savedUser } = await this.userRepository.createUserWithProject({ email, role }, trx);
            createdUsers.set(email, savedUser.id);
            await SupabaseHelper.insertOrUpdateUser(savedUser);
          })
        );
      });
    } catch (error) {
      this.logger.error('Failed to create user shells', { userShells: createdUsers });
      throw new InternalServerError('An error occurred during user creation', error);
    }

    pending.forEach(({ email, id }) => createdUsers.set(email, id));

    const usersInvited = await this.sendEmails(
      owner,
      Object.fromEntries(createdUsers),
      invitations[0].role,
    );

    return { usersInvited, usersCreated: toCreate.map(({ email }) => email) };
  }

  async changeUserRole(user: User, targetUser: User, newRole: RoleChangeRequestDto) {
    return await this.userRepository.manager.transaction(async (trx) => {
      await trx.update(User, { id: targetUser.id }, { role: newRole.newRoleName });
      const isDowngrade = user.role === 'global:owner' && targetUser.role === 'global:admin' && newRole.newRoleName === 'global:member';
      if (isDowngrade) {
        await this.publicApiKeyService.removeOwnerOnlyScopesFromApiKeys(targetUser, trx);
      }
    });
  }
}
