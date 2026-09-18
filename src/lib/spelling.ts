/**
 * High-accuracy, non-intrusive spell checker and suggestion engine.
 *
 * Rules:
 * 1. Zero false positives on valid English words (e.g., "throws", "chair", "whispered").
 * 2. Instant synchronous core vocabulary (11,000+ words) + background expansion to 63,500+ words.
 * 3. Never auto-replaces without user action.
 * 4. Only suggests when confidence is high (no nonsensical "throws -> throat").
 * 5. Roleplay aware: ignores asterisks, quotes, character names, user persona names, and session-ignored words.
 */

import { EMBEDDED_CORE_WORDS_COMPRESSED } from '../data/embeddedDictionary';

export interface SpellingSuggestion {
  word: string;
  suggestion: string;
  startIndex: number;
  endIndex: number;
}

export type MisspellingItem = SpellingSuggestion;

// Active in-memory dictionary set
const DICTIONARY: Set<string> = new Set();

// Initialize with embedded core words (11,000+ words)
const initialWords = EMBEDDED_CORE_WORDS_COMPRESSED.split(' ');
for (let i = 0; i < initialWords.length; i++) {
  DICTIONARY.add(initialWords[i]);
}

// Track background expansion
let isFullDictionaryLoaded = false;
let loadPromise: Promise<void> | null = null;

export function loadFullDictionary(): Promise<void> {
  if (isFullDictionaryLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const response = await fetch('/words.txt');
      if (response.ok) {
        const text = await response.text();
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const w = lines[i].trim().toLowerCase();
          if (w) DICTIONARY.add(w);
        }
        isFullDictionaryLoaded = true;
      }
    } catch (e) {
      console.warn('Full dictionary background load deferred, using core dictionary:', e);
    }
  })();

  return loadPromise;
}

// Kick off background load immediately
if (typeof window !== 'undefined') {
  loadFullDictionary();
}

/**
 * Curated high-confidence misspellings map.
 */
export const COMMON_TYPO_MAP: Record<string, string> = {
  // Frequently misspelled everyday and roleplay words
  cieling: 'ceiling',
  cielings: 'ceilings',
  misspilled: 'misspelled',
  mispelled: 'misspelled',
  mispell: 'misspell',
  misspil: 'misspell',
  teh: 'the',
  taht: 'that',
  waht: 'what',
  wiht: 'with',
  thier: 'their',
  ther: 'there',
  recieve: 'receive',
  recieved: 'received',
  recieving: 'receiving',
  seperate: 'separate',
  seperated: 'separated',
  definately: 'definitely',
  definitly: 'definitely',
  untill: 'until',
  alot: 'a lot',
  wierd: 'weird',
  wierdest: 'weirdest',
  beleive: 'believe',
  beleived: 'believed',
  beleif: 'belief',
  occured: 'occurred',
  occuring: 'occurring',
  truely: 'truly',
  tommorrow: 'tomorrow',
  tomorow: 'tomorrow',
  goverment: 'government',
  embarass: 'embarrass',
  embarassed: 'embarrassed',
  disapear: 'disappear',
  disapeared: 'disappeared',
  neccessary: 'necessary',
  necesary: 'necessary',
  acheive: 'achieve',
  acheived: 'achieved',
  accross: 'across',
  agressive: 'aggressive',
  alright: 'all right',
  appearence: 'appearance',
  arguement: 'argument',
  assasin: 'assassin',
  begining: 'beginning',
  calender: 'calendar',
  collegue: 'colleague',
  concious: 'conscious',
  curiosity: 'curiosity',
  dilemna: 'dilemma',
  dissapoint: 'disappoint',
  dissappointed: 'disappointed',
  enviroment: 'environment',
  existance: 'existence',
  familar: 'familiar',
  foward: 'forward',
  freind: 'friend',
  freinds: 'friends',
  gaurantee: 'guarantee',
  garantee: 'guarantee',
  glamerous: 'glamorous',
  grammer: 'grammar',
  happend: 'happened',
  harrass: 'harass',
  heigth: 'height',
  humerous: 'humorous',
  immediatly: 'immediately',
  incidently: 'incidentally',
  independant: 'independent',
  interupt: 'interrupt',
  interrupted: 'interrupted',
  knowlege: 'knowledge',
  liasion: 'liaison',
  lightening: 'lightning',
  maintanance: 'maintenance',
  millenium: 'millennium',
  miniture: 'miniature',
  mischevious: 'mischievous',
  noticable: 'noticeable',
  ocassion: 'occasion',
  occassion: 'occasion',
  persue: 'pursue',
  posession: 'possession',
  preceed: 'precede',
  prefered: 'preferred',
  presance: 'presence',
  priviledge: 'privilege',
  probaly: 'probably',
  realy: 'really',
  reccomend: 'recommend',
  refered: 'referred',
  religous: 'religious',
  rember: 'remember',
  resistence: 'resistance',
  rythm: 'rhythm',
  shedule: 'schedule',
  similiar: 'similar',
  speach: 'speech',
  succesful: 'successful',
  suprise: 'surprise',
  suprised: 'surprised',
  tounge: 'tongue',
  unforseen: 'unforeseen',
  untilll: 'until',
  whould: 'would',
  witchcraft: 'witchcraft',
  writting: 'writing',
  yeild: 'yield',
};

/**
 * Checks if a word is recognized as valid in English or the active session.
 */
export function isKnownWord(word: string, customWhitelist: Set<string> = new Set()): boolean {
  const lower = word.toLowerCase();

  // Fast check: direct dictionary or custom whitelist
  if (DICTIONARY.has(lower) || customWhitelist.has(lower)) {
    return true;
  }

  // Handle plural / past tense / gerund inflections
  if (lower.endsWith('s') && DICTIONARY.has(lower.slice(0, -1))) return true;
  if (lower.endsWith('es') && DICTIONARY.has(lower.slice(0, -2))) return true;
  if (lower.endsWith('ed') && DICTIONARY.has(lower.slice(0, -2))) return true;
  if (lower.endsWith('ed') && DICTIONARY.has(lower.slice(0, -1))) return true; // liked -> like
  if (lower.endsWith('ing') && DICTIONARY.has(lower.slice(0, -3))) return true;
  if (lower.endsWith('ing') && DICTIONARY.has(lower.slice(0, -3) + 'e')) return true; // making -> make
  if (lower.endsWith('ly') && DICTIONARY.has(lower.slice(0, -2))) return true;

  // Handle common contractions with or without apostrophe
  const cleanNoApos = lower.replace(/'/g, '');
  if (DICTIONARY.has(cleanNoApos)) return true;

  return false;
}

/**
 * Searches for high-confidence suggestions for an unrecognized word.
 * Returns null if no high-confidence candidate exists (to avoid annoying false guesses).
 */
export function findCorrectionForWord(word: string): string | null {
  const lower = word.toLowerCase();

  // 1. Direct typo map match
  if (COMMON_TYPO_MAP[lower]) {
    return COMMON_TYPO_MAP[lower];
  }

  // 2. Rule: ie <-> ei swap (e.g. cieling -> ceiling, recieve -> receive)
  if (lower.includes('ie')) {
    const candidate = lower.replace('ie', 'ei');
    if (DICTIONARY.has(candidate)) return candidate;
  }
  if (lower.includes('ei')) {
    const candidate = lower.replace('ei', 'ie');
    if (DICTIONARY.has(candidate)) return candidate;
  }

  // 3. Rule: Adjacent letter transposition (e.g. teh -> the, woudl -> would)
  for (let i = 0; i < lower.length - 1; i++) {
    const candidate = lower.slice(0, i) + lower[i + 1] + lower[i] + lower.slice(i + 2);
    if (DICTIONARY.has(candidate)) {
      return candidate;
    }
  }

  // 4. Rule: Single vowel replacement (e.g. misspilled -> misspelled)
  const vowels = ['a', 'e', 'i', 'o', 'u', 'y'];
  for (let i = 0; i < lower.length; i++) {
    if (vowels.includes(lower[i])) {
      for (const v of vowels) {
        if (v !== lower[i]) {
          const candidate = lower.slice(0, i) + v + lower.slice(i + 1);
          if (DICTIONARY.has(candidate)) {
            return candidate;
          }
        }
      }
    }
  }

  // 5. Rule: Missing or extra double consonant (e.g. embarass -> embarrass, neccessary -> necessary)
  for (let i = 0; i < lower.length; i++) {
    const doubled = lower.slice(0, i) + lower[i] + lower.slice(i);
    if (DICTIONARY.has(doubled)) return doubled;
    if (lower[i] === lower[i + 1]) {
      const undoubled = lower.slice(0, i) + lower.slice(i + 1);
      if (DICTIONARY.has(undoubled)) return undoubled;
    }
  }

  // No high-confidence correction found.
  // Return null so we never show absurd guesses like "throat" for "throws".
  return null;
}

/**
 * Preserves the casing of the original word on the suggestion.
 */
function preserveCasing(original: string, replacement: string): string {
  if (original === original.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  }
  return replacement;
}

/**
 * Scans the current input text and finds misspellings with accurate suggestions.
 */
export function findMisspellingsInText(
  text: string,
  arg1?: Set<string> | string[],
  arg2?: string[] | Set<string>
): SpellingSuggestion[] {
  if (!text.trim()) return [];

  let ignoredWords: Set<string>;
  let whitelistNames: string[];

  if (arg1 instanceof Set) {
    ignoredWords = arg1;
    whitelistNames = Array.isArray(arg2) ? arg2 : [];
  } else if (Array.isArray(arg1)) {
    whitelistNames = arg1;
    ignoredWords = arg2 instanceof Set ? arg2 : new Set();
  } else {
    ignoredWords = new Set();
    whitelistNames = [];
  }

  // Build temporary whitelist from character / persona names
  const customWhitelist = new Set<string>();
  for (const name of whitelistNames) {
    if (!name) continue;
    const parts = name.split(/\s+/);
    for (const part of parts) {
      const clean = part.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (clean) customWhitelist.add(clean);
    }
  }

  const results: SpellingSuggestion[] = [];
  const seenWords = new Set<string>();

  // Extract whole words with apostrophes
  const wordRegex = /[a-zA-Z]+(?:'[a-zA-Z]+)?/g;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + word.length;
    const lower = word.toLowerCase();

    // Skip short words or single letters
    if (word.length <= 1) continue;

    // Check if word is at the very end of the text without trailing space (actively being typed)
    const isAtEnd = endIndex === text.length;
    if (isAtEnd) {
      // Only flag if it's an exact known typo in the common map (e.g. "cieling" or "misspilled")
      if (!COMMON_TYPO_MAP[lower]) {
        continue;
      }
    }

    if (ignoredWords.has(lower) || seenWords.has(lower)) {
      continue;
    }

    // If it's already a known English word or whitelist word, it is completely valid!
    if (isKnownWord(word, customWhitelist)) {
      continue;
    }

    // Find high-confidence correction
    const candidate = findCorrectionForWord(word);
    if (candidate && candidate.toLowerCase() !== lower) {
      results.push({
        word,
        suggestion: preserveCasing(word, candidate),
        startIndex,
        endIndex,
      });
      seenWords.add(lower);
    }
  }

  return results;
}

/**
 * Replaces a misspelled word with the accepted suggestion in the user's input text.
 */
export function applySpellingFix(
  text: string,
  targetWord: string,
  suggestion: string,
  startIndex?: number
): string {
  if (typeof startIndex === 'number' && startIndex >= 0) {
    const before = text.slice(0, startIndex);
    const after = text.slice(startIndex + targetWord.length);
    return before + suggestion + after;
  }

  // Fallback to word boundary replacement
  const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`);
  return text.replace(regex, suggestion);
}
