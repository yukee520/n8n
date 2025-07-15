import { supabase } from '../supabaseClient';

export async function syncUserToSupabase(user: { id: string; name?: string }) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: user.id,
        full_name: user.name || '',
      },
      { onConflict: 'id' }
    );

  if (error) {
    console.error('[SUPABASE] Failed to sync user:', error.message);
  } else {
    console.log('[SUPABASE] Synced user:', data);
  }
}
