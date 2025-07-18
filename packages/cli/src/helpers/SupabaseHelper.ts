// packages/cli/src/helpers/SupabaseHelper.ts
import { Service } from '@n8n/di';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@n8n/db';

@Service()
export class SupabaseHelper {
	private client: SupabaseClient;

	constructor() {
		const url = process.env.SUPABASE_URL!;
		const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
		this.client = createClient(url, key);
	}

	async insertUser(user: User) {
		const { error } = await this.client.from('users').insert({
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

	async upsertUser(user: User) {
		const { error } = await this.client.from('users').upsert({
			id: user.id,
			email: user.email,
			role: user.role,
			created_at: new Date().toISOString(),
		});

		if (error) {
			console.error('❌ Supabase upsert error:', error.message);
		} else {
			console.log(`✅ Supabase: Upserted user ${user.email}`);
		}
	}
}
