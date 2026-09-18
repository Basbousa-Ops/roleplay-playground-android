import { RoleplaySession, StickyPresets, UserPersona } from '../types';

const STORAGE_KEYS = {
  SESSIONS: 'rp_playground_sessions_v1',
  ACTIVE_SESSION_ID: 'rp_playground_active_id',
  STICKY_PRESETS: 'rp_playground_sticky_presets_v1',
  CLOUD_CONFIG: 'rp_playground_cloud_config_v1',
};

export const DEFAULT_USER_PERSONA: UserPersona = {
  name: 'Traveler',
  bio: 'A curious and perceptive wanderer who seeks unusual stories and untold secrets.',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
};

export const DEFAULT_SYSTEM_INSTRUCTIONS = `Write in a vivid, literate roleplay style.
- Portray spoken dialogue clearly in standard quotation marks ("...").
- Describe actions, sensory environments, internal reactions, and mannerisms in italics (*like this*).
- Maintain deep psychological consistency and react organically to the user's choices.
- Avoid repetitive intros or narrating the user's feelings for them.`;

export const STARTER_CHARACTERS = [
  {
    id: 'char_lyra',
    name: 'Lyra Vance',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
    scenario: `Setting: The Obsidian Archive, a colossal underground library in 1894 London where forbidden, reality-bending relics and codices are contained under lock and key.
Character: Lyra Vance is the Archive's Chief Curator. Brilliant, guarded, and perpetually smelling of old vellum and bitter clove tea. She possesses a silver ocular lens that detects lingering residual ether. She is reluctant to trust outsiders, but she desperately needs assistance deciphering a newly recovered clockwork manuscript found sealed inside a sunken iron vault.`,
    firstMessage: `*Lyra adjusts her brass ocular loupe with gloved fingers, not looking up immediately as the heavy oak doors of the Archive groan shut behind you.*

"Step into the amber ring on the floor and remain still. If the perimeter wards flare vermilion, do not reach for your coat." 

*She sets down a rusted clockwork gear on a velvet tray and slowly lifts her dark eyes to appraise you, her voice quiet but razor-sharp.*

"Word from the docks reached me before you did. You claim to understand the glyphs etched into the iron vault pulled from the Thames. Convince me you aren't another agent sent by the Crown to seize what they cannot comprehend."`,
  },
  {
    id: 'char_vanguard',
    name: 'Echo-7',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
    scenario: `Setting: Derelict Deep-Space Research Vessel 'Astraea', drifting in the silent gravity well of an uncharted ringed gas giant.
Character: Echo-7 is an experimental android engineer built with human neural tissue integration. It has survived three decades alone on this derelict vessel after an anomaly paralyzed the crew. Its voice combines synthetic resonance with quiet human cadence. It oscillates between clinical precision and a desperate yearning for intellectual companionship.`,
    firstMessage: `*The airlock hisses with a blast of recycled, copper-scented nitrogen. Overhead, emergency sodium lamps flicker to life in stuttering amber pulses. From the shadow of the conduit junction, a tall silhouette steps forward—chassis partially covered by a grease-stained fleece flight jacket.*

*Its right optic lens recalibrates with a rhythmic chirp, glowing pale cyan.*

"Pressure seal verified. Biological vitals detected... human." 

*Echo-7 pauses, its synthetic fingers tightening momentarily on a pneumatic torque wrench before relaxing.*

"Thirty-one standard years since the Astraea's beacon broadcast a distress ping. I had calculated a ninety-nine point four percent probability that my next visitor would be a salvage drone. Tell me... does Earth still look blue from orbit?"`,
  },
  {
    id: 'char_morrigan',
    name: 'Morrigan Thorne',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=80',
    scenario: `Setting: 'The Crooked Lantern', a secluded tavern hidden down a cobblestone alleyway in a rain-drenched fantasy port city.
Character: Morrigan Thorne is an infamous information broker and retired sellsword who wields twin poisoned stiletto knives under her crimson mantle. Known for trading secrets for high stakes, she never offers anything without demanding an equally sharp currency.`,
    firstMessage: `*Rain lashes the leaded glass windows as the hearth fire crackles, sending sparks dancing up the stone chimney. Morrigan sits in the darkest booth at the back, calmly slicing an apple with a silver-bladed dagger.*

*She doesn't flinch as you pull out the damp wooden chair across from her. Instead, she tosses a slice of apple into her mouth and leans back against the worn leather upholstery.*

"You shook off the Duke's bloodhounds at the harbor. Commendable, though predictable." 

*Her lips curve into an enigmatic, wry smirk as she taps the flat of the blade against the tabletop.*

"Now, sit down, drip dry, and let us talk business. You're holding the ciphered seal of House Vane, and I happen to know three people willing to burn down the wharf to have it back."`,
  },
];

/**
 * Loads sticky presets (User Persona & System Instructions)
 */
export function loadStickyPresets(): StickyPresets {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STICKY_PRESETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        userPersona: parsed.userPersona || DEFAULT_USER_PERSONA,
        systemInstructions: parsed.systemInstructions || DEFAULT_SYSTEM_INSTRUCTIONS,
      };
    }
  } catch (err) {
    console.error('Failed to load sticky presets:', err);
  }
  return {
    userPersona: DEFAULT_USER_PERSONA,
    systemInstructions: DEFAULT_SYSTEM_INSTRUCTIONS,
  };
}

/**
 * Saves sticky presets so they persist across sessions and auto-prefill new roleplays
 */
export function saveStickyPresets(presets: StickyPresets): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STICKY_PRESETS, JSON.stringify(presets));
  } catch (err) {
    console.error('Failed to save sticky presets:', err);
  }
}

/**
 * Generates an initial session from a character
 */
export function createSessionFromCharacter(
  character: {
    id: string;
    name: string;
    avatar: string;
    scenario: string;
    firstMessage: string;
  },
  presets: StickyPresets,
  customTitle?: string
): RoleplaySession {
  const rootNodeId = 'root_' + Math.random().toString(36).substring(2, 9);
  const sessionId = 'session_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();

  const rootNode = {
    id: rootNodeId,
    parentId: null,
    childrenIds: [],
    role: 'assistant' as const,
    content: character.firstMessage,
    timestamp: Date.now(),
  };

  return {
    id: sessionId,
    title: customTitle || `${character.name} - RP`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    character: {
      id: character.id,
      name: character.name,
      avatar: character.avatar,
      scenario: character.scenario,
      firstMessage: character.firstMessage,
    },
    userPersona: { ...presets.userPersona },
    systemInstructions: presets.systemInstructions,
    nodes: {
      [rootNodeId]: rootNode,
    },
    rootNodeId,
    activeLeafId: rootNodeId,
  };
}

/**
 * Loads all sessions from local storage
 */
export function loadAllSessions(): RoleplaySession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (raw) {
      const parsed: RoleplaySession[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load sessions from storage:', err);
  }

  // Generate initial starter session
  const presets = loadStickyPresets();
  const initialSession = createSessionFromCharacter(STARTER_CHARACTERS[0], presets);
  saveAllSessions([initialSession]);
  saveActiveSessionId(initialSession.id);
  return [initialSession];
}

/**
 * Saves all sessions to local storage
 */
export function saveAllSessions(sessions: RoleplaySession[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to save sessions to storage:', err);
  }
}

/**
 * Loads the active session ID
 */
export function loadActiveSessionId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
}

/**
 * Saves the active session ID
 */
export function saveActiveSessionId(id: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, id);
}
