import { Service } from '@n8n/di';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
// NOTE: `import type` is compile‑time only → does NOT load @n8n/db at runtime
import type { User } from '@n8n/db';

/**
 * A tiny wrapper around the Supabase JS client.
 * Because it's decorated with @Service (from @n8n/di),
 * n8n's DI container will create a single shared instance.
 */
@Service()
export class SupabaseHelper {
	private client: SupabaseClient;

	constructor() {
		this.client = createClient(
			process.env.SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!,
		);
	}

	/** Upsert user into Supabase `users` table */
	async upsertUser(user: Pick<User, 'id' | 'email' | 'role'>) {
		const { error } = await this.client
			.from('users')
			.upsert({ ...user, created_at: new Date().toISOString() });

		if (error) {
			console.error('❌ Supabase user upsert error:', error.message);
		} else {
			console.log(`✅ Supabase: synced user ${user.email}`);
		}
	}
}
