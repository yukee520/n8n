import { Service } from 'typedi';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@n8n/db';

@Service()
export class SupabaseHelper {
	private supabase = createClient(
		process.env.SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);

	async insertUser(user: User) {
		const { error } = await this.supabase.from('users').insert([
			{
				id: user.id,
				email: user.email,
				role: user.role,
				created_at: new Date().toISOString(),
			},
		]);

		if (error) {
			console.error('❌ Supabase insert error:', error.message);
		} else {
			console.log(`✅ Supabase: Inserted user ${user.email}`);
		}
	}

	async upsertUser(user: User) {
		const { error } = await this.supabase.from('users').upsert({
			id: user.id,
			email: user.email,
			role: user.role,
			created_at: new Date().toISOString(),
		});

		if (error) {
			console.error('❌ Supabase upsert error:', error.message);
		}
	}
}
