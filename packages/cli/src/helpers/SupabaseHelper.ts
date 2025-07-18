// packages/cli/src/helpers/SupabaseHelper.ts
import { Service } from 'typedi';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@n8n/db';

@Service()
export class SupabaseHelper {
	private client: SupabaseClient;

	constructor() {
		this.client = createClient(
			process.env.SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!,
		);
	}

	async insertUser(user: User) {
		const { error } = await this.client.from('users').upsert({
			id: user.id,
			email: user.email,
			role: user.role,
			created_at: new Date().toISOString(),
		});
		if (error) {
			console.error('❌ Supabase insert error:', error.message);
		} else {
			console.log(`✅ Supabase: Inserted user ${user.email}`);
		}
	}
}
