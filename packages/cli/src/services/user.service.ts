/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
		private readonly supabaseHelper: SupabaseHelper, // ← injected
	) {}

	/* ------------------------------------------------------------------ */
	/* Standard helpers (unchanged except for Supabase sync on .update()) */
	/* ------------------------------------------------------------------ */
	async update(userId: string, data: Partial<User>) {
		const existing = await this.userRepository.findOneBy({ id: userId });
		if (existing) {
			const saved = await this.userRepository.save({ ...existing, ...data }, { transaction: true });
			await this.supabaseHelper.upsertUser(saved); // <‑ sync changes
		}
	}

	getManager() {
		return this.userRepository.manager;
	}

	async updateSettings(userId: string, newSettings: Partial<IUserSettings>) {
		const user = await this.userRepository.findOneOrFail({ where: { id: userId } });
		user.settings ? Object.assign(user.settings, newSettings) : (user.settings = newSettings);
		await this.userRepository.save(user);
	}

	/* ------------- helper to convert User → PublicUser (unchanged) ---- */
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
		const timeout = new Promise<PublicUser>((resolve) => setTimeout(() => resolve(publicUser), 1500));
		const flags  = (async () => {
			publicUser.featureFlags = await posthog.getFeatureFlags(publicUser);
			return publicUser;
		})();
		return await Promise.race([flags, timeout]);
	}

	/* -------------------- email invite helper (unchanged) ------------- */
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
						this.logger.error('Failed to send invite email', { userId: owner.id, email });
						invitedUser.error = e.message;
					}
				}
				return invitedUser;
			}),
		);
	}

	/* -------------------- main invite flow with Supabase -------------- */
	async inviteUsers(owner: User, invitations: Invitation[]) {
		const emails      = invitations.map((i) => i.email);
		const existing    = await this.userRepository.findManyByEmail(emails);
		const existingSet = new Set(existing.map((u) => u.email));

		const toCreate = invitations.filter(({ email }) => !existingSet.has(email));
		const pending  = existing.filter((u) => u.isPending);
		const created  = new Map<string, string>();

		try {
			await this.getManager().transaction(async (trx) => {
				await Promise.all(
					toCreate.map(async ({ email, role }) => {
						const { user: saved } = await this.userRepository.createUserWithProject({ email, role }, trx);
						created.set(email, saved.id);
						await this.supabaseHelper.upsertUser(saved);   // sync new
					}),
				);
			});
		} catch (err) {
			this.logger.error('Failed to create user shells', { err });
			throw new InternalServerError('Error during user creation', err);
		}

		for (const user of pending) {
			created.set(user.email, user.id);
			await this.supabaseHelper.upsertUser(user);             // sync pending
		}

		const usersInvited = await this.sendEmails(owner, Object.fromEntries(created), invitations[0].role);
		return { usersInvited, usersCreated: toCreate.map(({ email }) => email) };
	}

	/* ------------------------- role change (unchanged) --------------- */
	async changeUserRole(user: User, targetUser: User, newRole: RoleChangeRequestDto) {
		return await this.userRepository.manager.transaction(async (trx) => {
			await trx.update(User, { id: targetUser.id }, { role: newRole.newRoleName });
			const downgrade =
				user.role === 'global:owner' &&
				targetUser.role === 'global:admin' &&
				newRole.newRoleName === 'global:member';

			if (downgrade) {
				await this.publicApiKeyService.removeOwnerOnlyScopesFromApiKeys(targetUser, trx);
			}
		});
	}
}
