import { RoleplaySession, ConversationNode, CharacterProfile, UserPersona } from '../types';
import { DEFAULT_USER_PERSONA, DEFAULT_SYSTEM_INSTRUCTIONS } from './storage';

export interface ImportResult {
  session: RoleplaySession | null;
  error: string | null;
}

/**
 * Universal importer for Roleplay sessions.
 * Supports:
 * 1. Native Roleplay Playground backup JSON ({ version: '1.0', session: {...} } or direct RoleplaySession)
 * 2. Array of sessions (multi-session backup)
 * 3. SillyTavern / TavernAI character JSON & card V2 spec ({ name, description, personality, first_mes, mes_example, scenario, data: {...} })
 * 4. Character.ai / Pygmalion / Oobabooga character card exports
 * 5. Plain text transcripts (markdown or exported dialogue)
 */
export function parseImportedRoleplay(rawContent: string, fileName?: string): ImportResult {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    return { session: null, error: 'The uploaded file is empty.' };
  }

  // 1. Try JSON parsing
  try {
    const json = JSON.parse(trimmed);
    return parseRoleplayJson(json, fileName);
  } catch (jsonErr) {
    // If not JSON, try parsing as a text transcript
    return parseTranscriptText(trimmed, fileName);
  }
}

/**
 * Parses JSON object into a RoleplaySession
 */
export function parseRoleplayJson(json: any, fileName?: string): ImportResult {
  if (!json || typeof json !== 'object') {
    return { session: null, error: 'Invalid JSON format: expected an object or array.' };
  }

  // Case A: Multi-session array or wrapped array
  if (Array.isArray(json)) {
    if (json.length === 0) return { session: null, error: 'JSON array is empty.' };
    return parseRoleplayJson(json[0], fileName);
  }

  // Case B: Native Roleplay Playground backup: { session: { ... } }
  const sessionData = json.session || json;

  if (sessionData && sessionData.character && (sessionData.nodes || sessionData.rootNodeId)) {
    const id = 'session_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const character: CharacterProfile = {
      id: sessionData.character.id || 'char_' + Date.now(),
      name: sessionData.character.name || 'Imported Character',
      avatar: sessionData.character.avatar || '',
      scenario: sessionData.character.scenario || '',
      firstMessage: sessionData.character.firstMessage || '',
    };

    const userPersona: UserPersona = sessionData.userPersona || DEFAULT_USER_PERSONA;
    const systemInstructions = sessionData.systemInstructions || DEFAULT_SYSTEM_INSTRUCTIONS;

    let nodes: Record<string, ConversationNode> = sessionData.nodes || {};
    let rootNodeId: string = sessionData.rootNodeId || '';
    let activeLeafId: string = sessionData.activeLeafId || '';

    // If nodes are missing or empty, build an initial root node
    if (!rootNodeId || !nodes[rootNodeId]) {
      const rootId = 'node_root_' + Date.now();
      rootNodeId = rootId;
      activeLeafId = rootId;
      nodes = {
        [rootId]: {
          id: rootId,
          parentId: null,
          childrenIds: [],
          role: 'assistant',
          content: character.firstMessage || `*${character.name} arrives.*`,
          timestamp: Date.now(),
        },
      };
    }

    const session: RoleplaySession = {
      id,
      title: sessionData.title || `Imported: ${character.name}`,
      createdAt: sessionData.createdAt || Date.now(),
      updatedAt: Date.now(),
      character,
      userPersona,
      systemInstructions,
      nodes,
      rootNodeId,
      activeLeafId,
    };

    return { session, error: null };
  }

  // Case C: SillyTavern / TavernAI Character Card V2 (data: { name, description, personality, scenario, first_mes })
  const cardData = json.data || json;
  if (
    cardData &&
    (cardData.name || cardData.char_name) &&
    (cardData.first_mes || cardData.description || cardData.personality || cardData.scenario)
  ) {
    const name = cardData.name || cardData.char_name || 'Imported Character';
    const avatar = cardData.avatar || json.avatar || '';
    
    // Combine scenario, personality, and description into a rich scenario
    const scenarioParts: string[] = [];
    if (cardData.description) scenarioParts.push(`Description:\n${cardData.description}`);
    if (cardData.personality) scenarioParts.push(`Personality:\n${cardData.personality}`);
    if (cardData.scenario) scenarioParts.push(`Scenario:\n${cardData.scenario}`);
    if (cardData.mes_example) scenarioParts.push(`Dialogue Examples:\n${cardData.mes_example}`);

    const scenario = scenarioParts.join('\n\n') || `A roleplay with ${name}.`;
    const firstMessage = cardData.first_mes || `*${name} looks toward you attentively.*`;

    const id = 'session_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const rootId = 'node_root_' + Date.now();

    const character: CharacterProfile = {
      id: 'char_' + Date.now(),
      name,
      avatar,
      scenario,
      firstMessage,
    };

    const session: RoleplaySession = {
      id,
      title: `${name} (Imported Card)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      character,
      userPersona: DEFAULT_USER_PERSONA,
      systemInstructions: cardData.system_prompt || DEFAULT_SYSTEM_INSTRUCTIONS,
      nodes: {
        [rootId]: {
          id: rootId,
          parentId: null,
          childrenIds: [],
          role: 'assistant',
          content: firstMessage,
          timestamp: Date.now(),
        },
      },
      rootNodeId: rootId,
      activeLeafId: rootId,
    };

    return { session, error: null };
  }

  // Case D: Generic dialogue export array: [{ role, content }, ...]
  if (json.messages && Array.isArray(json.messages)) {
    return buildSessionFromMessageList(
      json.messages,
      json.characterName || (fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Imported Roleplay'),
      json.scenario || ''
    );
  }

  return {
    session: null,
    error: 'Unrecognized JSON structure. Expected a Roleplay Playground backup, SillyTavern character card, or message history.',
  };
}

/**
 * Builds a linear session from an array of { role: 'user' | 'assistant', content: string }
 */
export function buildSessionFromMessageList(
  messages: Array<{ role: string; content: string }>,
  titleName: string,
  scenarioDesc = ''
): ImportResult {
  if (!messages || messages.length === 0) {
    return { session: null, error: 'No dialogue messages found in import.' };
  }

  const id = 'session_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  const characterName = titleName || 'Character';

  const character: CharacterProfile = {
    id: 'char_' + Date.now(),
    name: characterName,
    avatar: '',
    scenario: scenarioDesc || `Roleplay dialogue imported from ${characterName}.`,
    firstMessage: messages[0]?.role === 'assistant' ? messages[0].content : `*${characterName} begins the conversation.*`,
  };

  const nodes: Record<string, ConversationNode> = {};
  let rootNodeId = '';
  let prevNodeId: string | null = null;
  let now = Date.now() - messages.length * 60000;

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const nodeId = `node_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const role: 'user' | 'assistant' = m.role === 'user' ? 'user' : 'assistant';

    if (i === 0) {
      rootNodeId = nodeId;
    } else if (prevNodeId && nodes[prevNodeId]) {
      nodes[prevNodeId].childrenIds.push(nodeId);
    }

    nodes[nodeId] = {
      id: nodeId,
      parentId: prevNodeId,
      childrenIds: [],
      role,
      content: m.content || '',
      timestamp: now + i * 60000,
    };

    prevNodeId = nodeId;
  }

  const session: RoleplaySession = {
    id,
    title: titleName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    character,
    userPersona: DEFAULT_USER_PERSONA,
    systemInstructions: DEFAULT_SYSTEM_INSTRUCTIONS,
    nodes,
    rootNodeId,
    activeLeafId: prevNodeId || rootNodeId,
  };

  return { session, error: null };
}

/**
 * Parses markdown or plain text dialogue transcript
 */
function parseTranscriptText(text: string, fileName?: string): ImportResult {
  const fallbackTitle = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Imported Transcript';
  const lines = text.split('\n');
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  let currentRole: 'user' | 'assistant' | null = null;
  let currentBuffer: string[] = [];

  // Match common role headers: [User], [Assistant], [CharacterName], You:, Character:
  const headerRegex = /^(?:\[(.*?)\]|([A-Za-z0-9_\s]+):)\s*(.*)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBuffer.length > 0) currentBuffer.push('');
      continue;
    }

    // Ignore separator banners
    if (trimmed.startsWith('====') || trimmed.startsWith('----')) continue;

    const match = trimmed.match(headerRegex);
    if (match) {
      const speaker = (match[1] || match[2] || '').toLowerCase().trim();
      const inlineText = match[3] || '';

      // Determine role
      const isUser = speaker.includes('user') || speaker.includes('you') || speaker === 'player';
      const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

      if (currentRole && currentBuffer.length > 0) {
        messages.push({
          role: currentRole,
          content: currentBuffer.join('\n').trim(),
        });
        currentBuffer = [];
      }

      currentRole = role;
      if (inlineText.trim()) {
        currentBuffer.push(inlineText.trim());
      }
    } else {
      if (!currentRole) {
        currentRole = 'assistant';
      }
      currentBuffer.push(line);
    }
  }

  if (currentRole && currentBuffer.length > 0) {
    messages.push({
      role: currentRole,
      content: currentBuffer.join('\n').trim(),
    });
  }

  if (messages.length === 0) {
    // If no dialog structure, treat the whole document as a single opening narrative/scenario
    const rootId = 'node_root_' + Date.now();
    const characterName = fallbackTitle;
    const session: RoleplaySession = {
      id: 'session_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      title: characterName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      character: {
        id: 'char_' + Date.now(),
        name: characterName,
        avatar: '',
        scenario: text.substring(0, 1500),
        firstMessage: text,
      },
      userPersona: DEFAULT_USER_PERSONA,
      systemInstructions: DEFAULT_SYSTEM_INSTRUCTIONS,
      nodes: {
        [rootId]: {
          id: rootId,
          parentId: null,
          childrenIds: [],
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
        },
      },
      rootNodeId: rootId,
      activeLeafId: rootId,
    };
    return { session, error: null };
  }

  return buildSessionFromMessageList(messages, fallbackTitle);
}
