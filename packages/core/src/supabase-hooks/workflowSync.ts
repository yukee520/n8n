import { supabase } from './supabaseClient';

export async function saveWorkflowToSupabase(userId: string, name: string, data: any) {
  const { error } = await supabase.from('workflows').insert([
    {
      user_id: userId,
      name,
      data,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    throw new Error('❌ Supabase workflow save failed: ' + error.message);
  }
}

export async function getWorkflowsByUser(userId: string) {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('❌ Failed to fetch workflows: ' + error.message);
  }

  return data;
}
