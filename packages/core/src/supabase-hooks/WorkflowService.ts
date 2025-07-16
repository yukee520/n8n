import { saveWorkflowToSupabase } from './supabase-hooks/workflowSync';

export async function createWorkflowWithSupabase(userId: string, name: string, data: any) {
  return await saveWorkflowToSupabase(userId, name, data);
}
