import { supabase } from '../supabaseClient';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  user_id?: string;
  message: string;
  level?: LogLevel;
  context?: string;
  timestamp?: string;
}

export async function logToSupabase(log: LogEntry) {
  const { data, error } = await supabase
    .from('logs')
    .insert([
      {
        user_id: log.user_id || null,
        message: log.message,
        level: log.level || 'info',
        context: log.context || '',
        timestamp: log.timestamp || new Date().toISOString(),
      },
    ]);

  if (error) {
    console.error('[SUPABASE] Log insert failed:', error.message);
  } else {
    console.log('[SUPABASE] Log inserted:', data);
  }
}
