import { supabase } from '../supabaseClient';

export async function logExecutionToSupabase(execution: {
  id: string;
  user_id: string;
  workflow_id: string;
  status: string;
  output?: any;
}) {
  const { data, error } = await supabase.from('executions').insert([
    {
      id: execution.id,
      user_id: execution.user_id,
      workflow_id: execution.workflow_id,
      status: execution.status,
      output: execution.output || {},
    },
  ]);

  if (error) {
    console.error('[SUPABASE] Failed to log execution:', error.message);
  } else {
    console.log('[SUPABASE] Execution logged:', data);
  }
}
