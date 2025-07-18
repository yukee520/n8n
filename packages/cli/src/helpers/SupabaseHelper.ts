import { createClient } from '@supabase/supabase-js';
import type { User } from '@n8n/db';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class SupabaseHelper {
  static async insertUserToSupabase(user: User) {
    const { error } = await supabase
      .from('users')
      .insert([
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
}
