import { supabase } from '../supabaseClient';

export async function syncWorkflowToSupabase(workflow: {
  id: string;
  user_id: string;
  name: string;
  config: any;
}) {
  const { data, error } = await supabase.from('workflows').upsert(
    {
      id: workflow.id,
      user_id: workflow.user_id,
      name: workflow.name,
      config: workflow.config,
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('[SUPABASE] Failed to sync workflow:', error.message);
  } else {
    console.log('[SUPABASE] Synced workflow:', data);
  }
}
