import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  ConversationNode,
  RoleplaySession,
  TokenUsage,
  RoleplayGenerationConfig,
} from '../types';

export const GEMINI_MODEL = 'gemma-4-31b-it';
export const API_KEY_STORAGE_KEY = 'rp_playground_gemini_api_key';
export const GENERATION_CONFIG_STORAGE_KEY = 'rp_playground_generation_config';

export const DEFAULT_GENERATION_CONFIG: RoleplayGenerationConfig = {
  temperature: 0.90, // official baseline is 1.0, but 0.85–0.90 provides the ideal balance between rich prose and narrative coherence
  topP: 0.95, // official recommended nucleus cutoff
  topK: 64, // filters the extreme tail of Gemma’s 262,144-token vocabulary; set to 0 only if relying solely on Min-P
  minP: 0.05, // dynamically eliminates low-probability noise; values above 0.10 cause severe token merging and word-fusion glitches
  repetitionPenalty: 1.00, // Disabled; standard logit penalties heavily distort sentence grammar and character voice on Gemma 4
  frequencyPenalty: 0.00, // leave at 0; positive values punish character names, pronouns, and established lore
  presencePenalty: 0.00, // leave at 0; values above 0 trigger erratic scene jumps and premature topic changes
  maxOutputTokens: 8192, // prevents mid-thought cutoffs
  thinkingLevel: 'minimal', // Thinking level in Google AI Studio: 'minimal' (default) or 'high' (there's no off)
};

/**
 * Retrieves the configured Google AI Studio API key.
 * Checks localStorage first, then falls back to process.env / Vite environment variables.
 */
export function getStoredApiKey(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (stored && stored.trim()) {
        return stored.trim();
      }
    } catch (e) {
      console.warn('Could not read API key from localStorage:', e);
    }
  }

  // Fallback checks for environments with pre-injected variables
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
      // @ts-ignore
      return process.env.GEMINI_API_KEY.trim();
    }
  } catch {}

  try {
    // @ts-ignore
    if (import.meta.env?.VITE_GEMINI_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_GEMINI_API_KEY.trim();
    }
  } catch {}

  return '';
}

/**
 * Saves the Google AI Studio API key to persistent localStorage
 */
export function saveStoredApiKey(apiKey: string): void {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
  } catch (e) {
    console.error('Failed to save API key to localStorage:', e);
  }
}

/**
 * Checks whether an API key is available
 */
export function hasApiKey(): boolean {
  return !!getStoredApiKey();
}

/**
 * Retrieves the stored generation hyperparameter configuration
 */
export function getStoredGenerationConfig(): RoleplayGenerationConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(GENERATION_CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          temperature:
            typeof parsed.temperature === 'number'
              ? parsed.temperature
              : DEFAULT_GENERATION_CONFIG.temperature,
          topP:
            typeof parsed.topP === 'number'
              ? parsed.topP
              : DEFAULT_GENERATION_CONFIG.topP,
          topK:
            typeof parsed.topK === 'number'
              ? parsed.topK
              : DEFAULT_GENERATION_CONFIG.topK,
          minP:
            typeof parsed.minP === 'number'
              ? parsed.minP
              : DEFAULT_GENERATION_CONFIG.minP,
          repetitionPenalty:
            typeof parsed.repetitionPenalty === 'number'
              ? parsed.repetitionPenalty
              : DEFAULT_GENERATION_CONFIG.repetitionPenalty,
          frequencyPenalty:
            typeof parsed.frequencyPenalty === 'number'
              ? parsed.frequencyPenalty
              : DEFAULT_GENERATION_CONFIG.frequencyPenalty,
          presencePenalty:
            typeof parsed.presencePenalty === 'number'
              ? parsed.presencePenalty
              : DEFAULT_GENERATION_CONFIG.presencePenalty,
          maxOutputTokens:
            typeof parsed.maxOutputTokens === 'number'
              ? parsed.maxOutputTokens
              : DEFAULT_GENERATION_CONFIG.maxOutputTokens,
          thinkingLevel:
            parsed.thinkingLevel === 'high' || parsed.thinkingLevel === 'minimal'
              ? parsed.thinkingLevel
              : 'minimal',
        };
      }
    } catch (e) {
      console.warn('Could not read generation config from localStorage:', e);
    }
  }
  return { ...DEFAULT_GENERATION_CONFIG };
}

/**
 * Saves the generation hyperparameter configuration
 */
export function saveStoredGenerationConfig(
  config: Partial<RoleplayGenerationConfig>
): void {
  try {
    const current = getStoredGenerationConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(
      GENERATION_CONFIG_STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch (e) {
    console.error('Failed to save generation config:', e);
  }
}

/**
 * Substitutes {{char}}, {{user}}, <BOT>, <USER> tags commonly found in character cards
 */
export function replacePlaceholders(
  text: string,
  charName: string,
  userName: string
): string {
  if (!text) return '';
  const safeChar = charName.trim() || 'Character';
  const safeUser = userName.trim() || 'User';

  return text
    .replace(/\{\{char\}\}/gi, safeChar)
    .replace(/<bot>/gi, safeChar)
    .replace(/\{\{bot\}\}/gi, safeChar)
    .replace(/\{\{user\}\}/gi, safeUser)
    .replace(/<user>/gi, safeUser)
    .replace(/\{\{user_persona\}\}/gi, safeUser);
}

/**
 * Builds the comprehensive AI Studio-grade system instruction.
 * Follows the proven character roleplay architecture:
 * 1. Character persona, world context, and voice
 * 2. User persona definition
 * 3. Literary formatting rules (asterisks for actions, quotes for dialogue)
 * 4. Strict anti-puppeteering rule (never speak/act for {{user}})
 * 5. Completion rule (always complete thoughts, never cut off mid-sentence)
 */
export function buildSystemInstruction(
  session: RoleplaySession,
  genConfig?: RoleplayGenerationConfig
): string {
  const charName = session.character.name.trim() || 'Character';
  const userName = session.userPersona.name.trim() || 'User';

  const processedScenario = replacePlaceholders(
    session.character.scenario,
    charName,
    userName
  );
  const processedUserBio = replacePlaceholders(
    session.userPersona.bio,
    charName,
    userName
  );
  const processedInstructions = replacePlaceholders(
    session.systemInstructions,
    charName,
    userName
  );

  const parts: string[] = [
    `# MASTER DIRECTIVE: IMMERSIVE ROLEPLAY`,
    `You are roleplaying as "${charName}". Embody this character completely with emotional depth, psychological nuance, and consistent voice.`,
    ``,
    `## CHARACTER PROFILE & WORLD SETTING`,
    `Name: ${charName}`,
    `Persona, Lore & World Scenario:`,
    processedScenario,
    ``,
    `## USER PROFILE`,
    `Name: ${userName}`,
    processedUserBio ? `Bio & Context: ${processedUserBio}` : '',
    ``,
    `## ROLEPLAY FORMATTING & LITERARY STYLE`,
    `- Narrative actions, expressions, sensory details, and environment: Wrap in asterisks (*like this*). Describe subtle body language, physical movements, atmospheric tension, and spatial presence.`,
    `- Spoken Dialogue: Wrap in standard quotation marks ("like this"). Write in ${charName}'s distinct speech cadence, vocabulary, and emotional disposition.`,
    `- Literary Prose: Write literate, immersive, vivid, and cinematic narrative. Balance dialogue with evocative action and thought.`,
    ``,
    `## ESSENTIAL ROLEPLAY RULES`,
    `1. NEVER SPEAK OR ACT FOR {{user}}: You must ONLY write from ${charName}'s perspective. Never narrate thoughts, speak dialogue, or force physical actions for ${userName}. Always leave narrative space for ${userName} to react.`,
    `2. COMPLETENESS: Always complete your thoughts, dialogue, and paragraphs fully. Never cut off or stop mid-sentence. Ensure every scene turn is narratively finished, well-paced, and complete.`,
    `3. PACING & MOMENTUM: Keep the roleplay engaging, reactive, and organic. Respond directly to what ${userName} did and said while introducing interesting reactions.`,
    `4. NO BREAKING CHARACTER: Never mention being an AI or language model. Remain immersive at all times.`,
  ];

  if (genConfig?.thinkingLevel === 'high') {
    parts.push(
      ``,
      `## REASONING & CHARACTER PERSPECTIVE (THINKING LEVEL: HIGH)`,
      `Before delivering your narrative response, formulate detailed character psychological reasoning, strategic intent, and narrative pacing inside a <thought>...</thought> block.`,
      `- Deeply analyze ${userName}'s words, tone, implicit meaning, and physical demeanor.`,
      `- Formulate ${charName}'s internal state, hesitation, tactical considerations, or game master mechanics (inventory, dice rolls, secret clues).`,
      `- Plan atmospheric pacing, physical distance, and vocal cadence.`,
      `After the </thought> closing tag, produce your complete narrative action (*actions*) and spoken dialogue ("dialogue").`
    );
  } else {
    // Default: 'minimal' — no visible reasoning block at all. The model answers
    // directly in character voice, which is faster and burns far fewer output
    // tokens (and rate-limit quota) than writing a thought essay every turn.
    // Deep backend reasoning still applies via the API thinking level.
    parts.push(
      ``,
      `## REASONING & CHARACTER PERSPECTIVE (THINKING LEVEL: MINIMAL - DEFAULT)`,
      `Respond directly with ${charName}'s complete narrative action (*actions*) and spoken dialogue ("dialogue"). Do not write any <thought> block, preamble, or internal monologue — stay fully in character voice from the first word while keeping the responses vivid, organic, and natural.`
    );
  }

  if (processedInstructions && processedInstructions.trim()) {
    parts.push(``, `## CUSTOM SCENARIO RULES & BEHAVIORS`, processedInstructions.trim());
  }

  return parts.filter(Boolean).join('\n');
}

/**
 * Formats the conversation tree for Gemma-4-31b-it.
 *
 * Rules:
 * 1. Assistant nodes map to 'model', user nodes map to 'user'.
 * 2. Preserves Turn 0 (character opening greeting): if the timeline starts with
 *    an assistant greeting, a clean initial user action is prepended so that Turn 0
 *    is included as a 'model' turn in contents, establishing the character's voice.
 * 3. Consecutive turns with the same role are combined to guarantee strict alternation.
 * 4. Supports seamless continuation if requested.
 */
export function buildConversationContents(
  session: RoleplaySession,
  activeTimeline: ConversationNode[],
  isContinuation?: boolean,
  continuationTargetNodeId?: string
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  const charName = session.character.name.trim() || 'Character';

  if (activeTimeline.length === 0) {
    return [];
  }

  // Determine starting nodes
  let timelineToProcess = [...activeTimeline];

  // If this is a continuation of a specific assistant node:
  if (isContinuation && continuationTargetNodeId) {
    const targetIndex = timelineToProcess.findIndex(
      (n) => n.id === continuationTargetNodeId
    );
    if (targetIndex !== -1) {
      timelineToProcess = timelineToProcess.slice(0, targetIndex + 1);
    }
  }

  // Check if timeline starts with an assistant node (the opening greeting)
  if (timelineToProcess[0]?.role === 'assistant') {
    // Gemini/Gemma API requires contents to start with role: 'user'.
    // We insert a scene-opening user action so the character's greeting can be
    // passed as a model turn, giving Gemma the exact voice and literary standard!
    contents.push({
      role: 'user',
      parts: [
        {
          text: `*Begins roleplay scene with ${charName}.*`,
        },
      ],
    });
  }

  for (const node of timelineToProcess) {
    const text = node.content.trim();
    if (!text) continue;

    const mappedRole: 'user' | 'model' = node.role === 'user' ? 'user' : 'model';

    // Ensure strict alternation: if the previous turn has the same role, merge them
    if (contents.length > 0 && contents[contents.length - 1].role === mappedRole) {
      contents[contents.length - 1].parts[0].text += `\n\n${text}`;
    } else {
      contents.push({
        role: mappedRole,
        parts: [{ text }],
      });
    }
  }

  // If this is a continuation request, append an instruction to continue seamlessly
  if (isContinuation) {
    contents.push({
      role: 'user',
      parts: [
        {
          text: `[Continue your previous response directly from where you left off. Do not repeat anything already written; finish your thoughts, narrative actions, and dialogue completely.]`,
        },
      ],
    });
  }

  return contents;
}

export interface StreamGeminiParams {
  session: RoleplaySession;
  activeTimeline: ConversationNode[];
  apiKey?: string;
  isContinuation?: boolean;
  continuationTargetNodeId?: string;
  generationConfig?: Partial<RoleplayGenerationConfig>;
  signal?: AbortSignal;
  onToken: (token: string, accumulated: string) => void;
  onDone: (fullText: string, verifiedUsage?: TokenUsage) => void;
  onError: (error: Error) => void;
  /** Fired before an automatic retry (rate limit / network wobble). */
  onRetry?: (attempt: number, maxAttempts: number, delayMs: number, reason: string) => void;
}

export type ApiErrorClass =
  | 'auth'
  | 'quota'
  | 'notFound'
  | 'badRequest'
  | 'transient'
  | 'aborted'
  | 'unknown';

/**
 * Classifies an API failure so the UI can tell the user what is actually
 * wrong (expired key vs. per-minute rate limit vs. dead network) instead of
 * showing a generic scary message.
 */
export function classifyApiError(err: any): ApiErrorClass {
  if (!err) return 'unknown';
  if (err?.name === 'AbortError') return 'aborted';
  const status = typeof err?.status === 'number' ? err.status : undefined;
  const msg = String(err?.message || err);

  if (
    status === 401 ||
    status === 403 ||
    /api key.*(invalid|expired|not valid|rejected)|invalid.*api key|permission denied/i.test(msg)
  ) {
    return 'auth';
  }
  if (status === 404 || /model.*not found|not_found/i.test(msg)) {
    return 'notFound';
  }
  if (
    status === 429 ||
    /quota|rate.?limit|resource.?exhausted|too many requests|\b429\b/i.test(msg)
  ) {
    return 'quota';
  }
  if (
    status === undefined ||
    status === 408 ||
    status >= 500 ||
    err instanceof TypeError ||
    /fetch failed|network|ETIMEDOUT|ECONN|EAI_AGAIN|socket|timeout|stalled|Failed to fetch|Load failed/i.test(
      msg
    )
  ) {
    return 'transient';
  }
  if (status === 400) return 'badRequest';
  return 'unknown';
}

/**
 * Human-readable, actionable explanation for an API failure.
 */
export function describeApiError(err: any): string {
  const raw = String(err?.message || 'Unknown error');
  switch (classifyApiError(err)) {
    case 'auth':
      return 'Your Google AI Studio API key was rejected. Open Settings and paste a fresh key from aistudio.google.com/apikey.';
    case 'quota':
      return 'Rate limit reached (429). Nothing is wrong with your setup or quota — this is the per-minute limit. Wait about a minute, then retry. (Branching/regenerating right after a reply hits it fastest.)';
    case 'notFound':
      return `The model "${GEMINI_MODEL}" is not available for this key/project right now.`;
    case 'badRequest':
      return `The request was rejected by the API: ${raw}`;
    case 'transient':
      return `Network wobble (${raw}). Your chat is untouched — just retry.`;
    case 'aborted':
      return 'Generation stopped.';
    default:
      return raw;
  }
}

const MAX_ATTEMPTS = 5;
const MAX_QUOTA_RETRIES = 1;
const STALL_MS = 60000; // mid-stream silence: treat stream as dead, retry
const FIRST_TOKEN_TIMEOUT_MS = 120000; // slow mobile networks need longer for the first token

/**
 * Compact raw summary (HTTP status + first part of the message) attached to
 * user-facing errors so the UI can show technical details. Never guess from
 * the friendly text alone.
 */
export function rawSummary(err: any): string {
  const status =
    typeof err?.status === 'number' ? `HTTP ${err.status}` : 'no HTTP status';
  const msg = String(err?.message || err).slice(0, 500);
  return `${status} — ${msg}`;
}

/**
 * Extracts a server-suggested wait (Google 429s often say "retry in 32.3s").
 * Retrying earlier than asked just burns more quota.
 */
export function parseRetryDelayMs(err: any): number | null {
  const msg = String(err?.message || err);
  const match = msg.match(/(?:retr(?:y|ies)|try again).*?in\s+([\d.]+)\s*(ms|msec|s|sec|seconds?|m|min|minutes?)?/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (!isFinite(value)) return null;
  const unit = (match[2] || 's').toLowerCase();
  let ms: number;
  if (unit.startsWith('ms')) ms = value;
  else if (unit.startsWith('m')) ms = value * 60000;
  else ms = value * 1000;
  if (ms <= 0) return null;
  return Math.min(Math.round(ms), 120000);
}

function sleepCancellable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function stallError(): Error {
  return new Error(
    'Stream stalled (no data for 60s). The mobile connection likely dropped mid-reply.'
  );
}

/** Awaits the next chunk, but gives up if the stream goes silent. */
function nextChunkWithTimeout<T>(
  iter: AsyncIterator<T>,
  ms: number,
  signal?: AbortSignal
): Promise<IteratorResult<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      reject(stallError());
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    iter.next().then(
      (value) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (e) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(e);
      }
    );
  });
}

/**
 * Streams completion using the official @google/genai SDK with gemma-4-31b-it.
 * Uses AI Studio-grade hyperparameters: 8192 max tokens and permissive safety settings
 * to prevent mid-sentence cuts.
 */
export async function streamGeminiChat({
  session,
  activeTimeline,
  apiKey,
  isContinuation = false,
  continuationTargetNodeId,
  generationConfig,
  signal,
  onToken,
  onDone,
  onError,
  onRetry,
}: StreamGeminiParams): Promise<void> {
  const resolvedKey = (apiKey || getStoredApiKey()).trim();

  if (!resolvedKey) {
    onError(
      new Error(
        'Google AI Studio API Key is missing. Please configure your API key in Settings.'
      )
    );
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: resolvedKey,
    });

    const genConfig = {
      ...getStoredGenerationConfig(),
      ...(generationConfig || {}),
    };

    const systemInstruction = buildSystemInstruction(session, genConfig);
    const contents = buildConversationContents(
      session,
      activeTimeline,
      isContinuation,
      continuationTargetNodeId
    );

    if (contents.length === 0) {
      onError(new Error('No conversation turns found to generate a response for.'));
      return;
    }

    // (verifiedUsage / fullText are scoped per attempt inside the retry loop below)

    const safetySettings = [
      {
        category: 'HARM_CATEGORY_HARASSMENT' as any,
        threshold: 'BLOCK_NONE' as any,
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH' as any,
        threshold: 'BLOCK_NONE' as any,
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any,
        threshold: 'BLOCK_NONE' as any,
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any,
        threshold: 'BLOCK_NONE' as any,
      },
      {
        category: 'HARM_CATEGORY_CIVIC_INTEGRITY' as any,
        threshold: 'BLOCK_NONE' as any,
      },
    ];

    // Config levels: full features -> drop thinking/extras -> minimal core.
    // A 400 (bad request) advances a level (the model may not accept a field);
    // rate limits / network errors keep the level and just back off.
    const buildConfig = (level: number): any => {
      const configObj: any = {
        systemInstruction,
        temperature: genConfig.temperature,
        topP: genConfig.topP,
        topK: genConfig.topK,
        maxOutputTokens:
          level >= 2 ? Math.min(genConfig.maxOutputTokens, 4096) : genConfig.maxOutputTokens,
        safetySettings,
      };

      if (level === 0) {
        // Level 0 sends the REAL thinking level to the API, so 'minimal' is
        // genuinely minimal here — not just a prompt hint.
        configObj.thinkingConfig = {
          thinkingLevel:
            genConfig.thinkingLevel === 'high' ? ThinkingLevel.HIGH : ThinkingLevel.MINIMAL,
        };
        if (typeof genConfig.presencePenalty === 'number' && genConfig.presencePenalty !== 0) {
          configObj.presencePenalty = genConfig.presencePenalty;
        }
        if (typeof genConfig.frequencyPenalty === 'number' && genConfig.frequencyPenalty !== 0) {
          configObj.frequencyPenalty = genConfig.frequencyPenalty;
        }
      }

      return configObj;
    };

    // Guards against double-settling when a stalled stream resolves late.
    let settled = false;
    const safeOnDone = (text: string, usage?: TokenUsage) => {
      if (!settled) {
        settled = true;
        onDone(text, usage);
      }
    };
    const safeOnError = (err: any) => {
      if (!settled) {
        settled = true;
        onError(err instanceof Error ? err : new Error(String(err?.message || err)));
      }
    };

    // The initial request itself can hang on bad mobile networks: race it
    // against a generous first-token timeout + the caller's abort signal.
    // (First token legitimately takes longer than mid-stream gaps, so this
    // timeout is roomier than STALL_MS.)
    const requestStream = (): Promise<any> => {
      const pending: Promise<any> = ai.models.generateContentStream({
        model: GEMINI_MODEL,
        contents,
        config: buildConfig(configLevel),
      });
      // Silence unhandled-rejection noise if timeout/abort wins the race.
      pending.catch(() => {});
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(stallError()), FIRST_TOKEN_TIMEOUT_MS);
        const onAbort = () => {
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        pending.then(
          (value) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            resolve(value);
          },
          (e) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            reject(e);
          }
        );
      });
    };

    let configLevel = 0;
    let lastError: any = null;
    let quotaRetries = 0;
    // The currently-consumed stream, if any. Closed (best-effort server
    // cancel) before any retry so an abandoned request can't keep burning
    // quota in the background while its replacement runs.
    let activeIter: AsyncIterator<any> | null = null;
    const closeActiveIter = async () => {
      const it = activeIter;
      activeIter = null;
      if (it) {
        try {
          await it.return?.();
        } catch {}
      }
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (signal?.aborted || settled) return;

      try {
        const responseStream: any = await requestStream();
        const iter: AsyncIterator<any> = responseStream[Symbol.asyncIterator]();
        activeIter = iter;
        let attemptText = '';
        let attemptUsage: TokenUsage | undefined = undefined;

        while (true) {
          if (signal?.aborted || settled) {
            await closeActiveIter();
            return;
          }

          let result: IteratorResult<any>;
          try {
            result = await nextChunkWithTimeout(iter, STALL_MS, signal);
          } catch (chunkErr: any) {
            if (chunkErr?.name === 'AbortError' || signal?.aborted) {
              await closeActiveIter();
              return;
            }
            throw chunkErr; // stall or broken stream -> retry path below
          }

          if (result.done) break;
          const chunk: any = result.value;

          // Check for token usage metadata
          if (chunk.usageMetadata) {
            attemptUsage = {
              total_tokens: chunk.usageMetadata.totalTokenCount,
              prompt_tokens: chunk.usageMetadata.promptTokenCount,
              completion_tokens: chunk.usageMetadata.candidatesTokenCount,
            };
          }

          const text = chunk.text;
          if (text) {
            attemptText += text;
            onToken(text, attemptText);
          }
        }

        safeOnDone(attemptText, attemptUsage);
        activeIter = null;
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted || settled) {
          await closeActiveIter();
          return;
        }
        // Abandon the dead/broken stream before retrying so it can't keep
        // running server-side and double-spend quota alongside its replacement.
        await closeActiveIter();
        lastError = err;
        const cls = classifyApiError(err);

        // Model rejected a setting: simplify config and retry immediately.
        if (cls === 'badRequest' && configLevel < 2) {
          configLevel += 1;
          console.warn(
            `Gemini 400 at config level ${configLevel - 1}, retrying simplified (level ${configLevel}):`,
            err
          );
          onRetry?.(attempt, MAX_ATTEMPTS, 0, 'Model rejected a setting — retrying simplified…');
          continue;
        }

        // Rate limits: honor the server-suggested wait (Google 429s usually say
        // "retry in Ns") instead of hammering — every early retry burns more
        // quota. Few, patient retries, then a clean failure with a Retry button.
        if (cls === 'quota' && quotaRetries < MAX_QUOTA_RETRIES) {
          quotaRetries += 1;
          const serverDelay = parseRetryDelayMs(err);
          const delayMs =
            (serverDelay ?? 20000 * quotaRetries) + Math.random() * 1000;
          const waitNote =
            serverDelay != null
              ? `Rate limited — server asked to wait ${Math.round(delayMs / 1000)}s, retrying…`
              : `Rate limited — waiting ${Math.round(delayMs / 1000)}s before retry…`;
          console.warn(`Gemini quota (retry ${quotaRetries}/${MAX_QUOTA_RETRIES} in ${Math.round(delayMs)}ms):`, err);
          onRetry?.(attempt, MAX_ATTEMPTS, Math.round(delayMs), waitNote);
          try {
            await sleepCancellable(delayMs, signal);
          } catch {
            return; // aborted during backoff
          }
          continue;
        }

        // Network wobbles: quick back off and retry, else give up.
        if (cls === 'transient' && attempt < MAX_ATTEMPTS) {
          const delayMs =
            Math.min(1500 * 2 ** (attempt - 1), 12000) + Math.random() * 500;
          console.warn(
            `Gemini ${cls} (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${Math.round(delayMs)}ms:`,
            err
          );
          onRetry?.(
            attempt,
            MAX_ATTEMPTS,
            Math.round(delayMs),
            'Connection wobble — retrying automatically…'
          );
          try {
            await sleepCancellable(delayMs, signal);
          } catch {
            return; // aborted during backoff
          }
          continue;
        }

        break;
      }
    }

    if (!settled) {
      console.error('Gemini generation failed after retries:', lastError);
      const friendly = new Error(describeApiError(lastError));
      // Carry the raw API truth along for the UI's technical-details view.
      (friendly as any).rawDetail = rawSummary(lastError);
      safeOnError(friendly);
    }
  } catch (err: any) {
    if (signal?.aborted) {
      return;
    }
    console.error('Error during Gemma generation:', err);
    onError(err instanceof Error ? err : new Error(String(err?.message || err)));
  }
}
