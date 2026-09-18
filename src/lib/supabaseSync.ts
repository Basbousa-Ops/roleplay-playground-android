import { supabase } from './supabase';
import { RoleplaySession, StickyPresets, RoleplayGenerationConfig } from '../types';

/**
 * Sanitizes object to plain JSON, removing undefined values
 */
function sanitizeForDb<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Converts a database row from the `sessions` table into a TypeScript RoleplaySession
 */
export function mapRowToSession(row: any): RoleplaySession {
  const createdAtVal =
    typeof row.created_at === 'number'
      ? row.created_at
      : typeof row.createdAt === 'number'
      ? row.createdAt
      : Date.parse(row.created_at || '') || Date.now();

  const updatedAtVal =
    typeof row.updated_at === 'number'
      ? row.updated_at
      : typeof row.updatedAt === 'number'
      ? row.updatedAt
      : Date.parse(row.updated_at || '') || Date.now();

  return {
    id: String(row.id),
    title: row.title || 'Untitled Roleplay',
    createdAt: createdAtVal,
    updatedAt: updatedAtVal,
    character: row.character || {
      id: 'char_default',
      name: 'Character',
      avatar: '',
      scenario: '',
      firstMessage: '',
    },
    userPersona: row.user_persona || row.userPersona || {
      name: 'User',
      bio: '',
      avatar: '',
    },
    systemInstructions: row.system_instructions ?? row.systemInstructions ?? '',
    nodes: row.nodes || {},
    rootNodeId: row.root_node_id || row.rootNodeId || '',
    activeLeafId: row.active_leaf_id || row.activeLeafId || '',
  };
}

/**
 * Converts a RoleplaySession into the PostgreSQL schema for the `sessions` table
 */
export function mapSessionToRow(userId: string, session: RoleplaySession): any {
  return sanitizeForDb({
    id: session.id,
    user_id: userId,
    title: session.title,
    created_at: session.createdAt || Date.now(),
    updated_at: Date.now(),
    root_node_id: session.rootNodeId,
    active_leaf_id: session.activeLeafId,
    character: session.character,
    user_persona: session.userPersona,
    system_instructions: session.systemInstructions || '',
    nodes: session.nodes,
  });
}

/**
 * Saves or updates a single roleplay session (with its complete tree) in Supabase
 */
export async function syncSingleSessionToSupabase(
  userId: string,
  session: RoleplaySession
): Promise<void> {
  const row = mapSessionToRow(userId, session);
  const { error } = await supabase.from('sessions').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Failed to sync session to Supabase:', error);
    throw new Error(`Supabase write error: ${error.message}`);
  }
}

/**
 * Deletes a roleplay session from Supabase
 */
export async function deleteSessionFromSupabase(
  userId: string,
  sessionId: string
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to delete session from Supabase:', error);
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

/**
 * Fetches all saved roleplay sessions for the authenticated user from Supabase
 */
export async function fetchUserSessionsFromSupabase(
  userId: string
): Promise<RoleplaySession[]> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch sessions from Supabase:', error);
      throw new Error(`Supabase list error: ${error.message}`);
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    const sessions: RoleplaySession[] = [];
    for (const row of data) {
      if (row && row.id && row.nodes) {
        sessions.push(mapRowToSession(row));
      }
    }

    return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err) {
    console.error('Error in fetchUserSessionsFromSupabase:', err);
    return [];
  }
}

/**
 * Saves sticky user presets (Persona & System Instructions) in Supabase
 */
export async function syncPresetsToSupabase(
  userId: string,
  presets: StickyPresets
): Promise<void> {
  const payload = sanitizeForDb({
    user_id: userId,
    user_persona: presets.userPersona,
    system_instructions: presets.systemInstructions || '',
    updated_at: Date.now(),
  });

  const { error } = await supabase.from('presets').upsert(payload, { onConflict: 'user_id' });
  if (error) {
    console.error('Failed to sync presets to Supabase:', error);
    throw new Error(`Supabase presets error: ${error.message}`);
  }
}

/**
 * Fetches sticky user presets from Supabase
 */
export async function fetchPresetsFromSupabase(
  userId: string
): Promise<StickyPresets | null> {
  try {
    const { data, error } = await supabase
      .from('presets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Could not fetch presets from Supabase:', error.message);
      return null;
    }

    if (data) {
      const persona = data.user_persona || data.userPersona;
      const instructions = data.system_instructions ?? data.systemInstructions;
      if (persona && instructions !== undefined) {
        return {
          userPersona: persona,
          systemInstructions: instructions,
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('Error in fetchPresetsFromSupabase:', err);
    return null;
  }
}

/**
 * Saves or updates the user's Google AI Studio API key in Supabase for cross-device sync
 */
export async function syncApiKeyToSupabase(
  userId: string,
  apiKey: string
): Promise<void> {
  const payload = sanitizeForDb({
    user_id: userId,
    api_key: apiKey.trim(),
    updated_at: Date.now(),
  });

  const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'user_id' });
  if (error) {
    console.error('Failed to sync API key to Supabase:', error);
    throw new Error(`Supabase API key sync error: ${error.message}`);
  }
}

/**
 * Fetches the user's cross-device synced Google AI Studio API key from Supabase
 */
export async function fetchApiKeyFromSupabase(
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('api_key')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Could not fetch API key from Supabase:', error.message);
      return null;
    }

    if (data && typeof data.api_key === 'string' && data.api_key.trim()) {
      return data.api_key.trim();
    }
    return null;
  } catch (err) {
    console.warn('Error in fetchApiKeyFromSupabase:', err);
    return null;
  }
}

/**
 * Removes the API key from Supabase settings
 */
export async function deleteApiKeyFromSupabase(userId: string): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .update({ api_key: null, updated_at: Date.now() })
    .eq('user_id', userId);

  if (error) {
    console.warn('Failed to delete API key from Supabase:', error);
  }
}

/**
 * Saves or updates generation hyperparameters in Supabase for cross-device sync
 */
export async function syncGenerationConfigToSupabase(
  userId: string,
  config: RoleplayGenerationConfig
): Promise<void> {
  const payload = sanitizeForDb({
    user_id: userId,
    generation_config: config,
    updated_at: Date.now(),
  });

  const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'user_id' });
  if (error) {
    console.error('Failed to sync generation config to Supabase:', error);
    throw new Error(`Supabase generation config sync error: ${error.message}`);
  }
}

/**
 * Fetches the user's cross-device synced generation configuration from Supabase
 */
export async function fetchGenerationConfigFromSupabase(
  userId: string
): Promise<RoleplayGenerationConfig | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('generation_config')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Could not fetch generation config from Supabase:', error.message);
      return null;
    }

    if (data && data.generation_config && typeof data.generation_config === 'object') {
      const raw = data.generation_config as any;
      return {
        ...raw,
        thinkingLevel: raw.thinkingLevel === 'high' ? 'high' : 'minimal',
      } as RoleplayGenerationConfig;
    }
    return null;
  } catch (err) {
    console.warn('Error in fetchGenerationConfigFromSupabase:', err);
    return null;
  }
}

/**
 * Performs a full bulk sync of all local sessions, presets, API key, and generation config to Supabase
 */
export async function syncAllToSupabase(
  userId: string,
  sessions: RoleplaySession[],
  presets: StickyPresets,
  apiKey?: string,
  generationConfig?: RoleplayGenerationConfig
): Promise<{ success: boolean; syncedCount: number; message: string }> {
  try {
    // 1. Sync Presets
    await syncPresetsToSupabase(userId, presets);

    // 2. Sync API Key if present
    if (apiKey && apiKey.trim()) {
      await syncApiKeyToSupabase(userId, apiKey.trim());
    }

    // 3. Sync Generation Config if present
    if (generationConfig) {
      await syncGenerationConfigToSupabase(userId, generationConfig);
    }

    // 4. Sync all sessions
    for (const session of sessions) {
      await syncSingleSessionToSupabase(userId, session);
    }

    return {
      success: true,
      syncedCount: sessions.length,
      message: `Successfully synchronized ${sessions.length} roleplay session${
        sessions.length === 1 ? '' : 's'
      }, presets, generation parameters, and API key to Supabase!`,
    };
  } catch (error: any) {
    console.error('Bulk sync to Supabase failed:', error);
    return {
      success: false,
      syncedCount: 0,
      message: error?.message || 'Failed to sync to Supabase.',
    };
  }
}

/**
 * Subscribes to real-time changes on the `sessions` table for the user
 * Catches turns, branches, or edits created on mobile/other clients instantly!
 */
export function subscribeToSessionsChanges(
  userId: string,
  onUpsert: (session: RoleplaySession) => void,
  onDelete: (sessionId: string) => void
) {
  // Use a uniquely stamped channel name to prevent re-attaching callbacks to an existing/subscribing channel
  const channelName = `realtime:sessions:${userId}:${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldRecord = payload.old as { id?: string };
          if (oldRecord?.id) {
            onDelete(oldRecord.id);
          }
        } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new;
          if (row && row.id && row.nodes) {
            const mapped = mapRowToSession(row);
            onUpsert(mapped);
          }
        }
      }
    );

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log(`[Supabase Realtime] Subscribed to sessions channel (${channelName})`);
    }
  });

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch (err) {
      console.warn('Error removing realtime channel:', err);
    }
  };
}
