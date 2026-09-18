import React, { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface RoleplayMarkdownProps {
  content: string;
  role: 'user' | 'assistant';
}

/**
 * Parses and highlights roleplay dialogue and narrative actions.
 * - Parses and neatly collapses <thought>...</thought> blocks when Thinking Mode is enabled.
 * - Spoken dialogue in quotes ("...") is highlighted for immediate vocal clarity.
 * - Actions in *asterisks* are styled in refined, atmospheric italics.
 */
export const RoleplayMarkdown: React.FC<RoleplayMarkdownProps> = ({ content, role }) => {
  const [thoughtsExpanded, setThoughtsExpanded] = useState(false);

  const { thoughtText, mainBody, isThinkingActive } = useMemo(() => {
    if (!content) return { thoughtText: '', mainBody: '', isThinkingActive: false };

    // Check for <thought>...</thought> or unclosed <thought> during streaming
    const thoughtRegex = /<thought>([\s\S]*?)(?:<\/thought>|$)/i;
    const match = content.match(thoughtRegex);

    if (match) {
      const extractedThought = match[1].trim();
      const hasClosingTag = content.toLowerCase().includes('</thought>');
      const body = hasClosingTag ? content.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim() : '';
      return {
        thoughtText: extractedThought,
        mainBody: body,
        isThinkingActive: !hasClosingTag,
      };
    }

    return { thoughtText: '', mainBody: content, isThinkingActive: false };
  }, [content]);

  return (
    <div
      className={`prose prose-invert max-w-none text-base leading-relaxed break-words ${
        role === 'assistant' ? 'text-zinc-200' : 'text-zinc-100'
      }`}
    >
      {/* Collapsible Thoughts Callout for Thinking Mode */}
      {thoughtText && (
        <div className="not-prose mb-3.5 rounded-xl border border-violet-900/50 bg-zinc-950/80 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setThoughtsExpanded((prev) => !prev)}
            className="w-full px-3 py-2 text-xs font-mono text-violet-300 bg-violet-950/30 hover:bg-violet-950/50 flex items-center justify-between transition-colors cursor-pointer select-none text-left"
          >
            <div className="flex items-center gap-2">
              <Brain
                className={`w-3.5 h-3.5 text-violet-400 ${
                  isThinkingActive ? 'animate-pulse' : ''
                }`}
              />
              <span className="font-semibold">
                {isThinkingActive ? 'Reasoning & Character Intent...' : 'Internal Character Thoughts'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-sans">
              <span>{thoughtsExpanded ? 'Hide' : 'Show reasoning'}</span>
              {thoughtsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </div>
          </button>

          {(thoughtsExpanded || isThinkingActive) && (
            <div className="p-3 text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed border-t border-violet-950/50 bg-zinc-950/50 max-h-60 overflow-y-auto">
              {thoughtText}
            </div>
          )}
        </div>
      )}

      {/* Main Roleplay Prose */}
      {mainBody ? (
        <Markdown
          components={{
            p: ({ children }) => (
              <p className="mb-3.5 last:mb-0 leading-relaxed font-normal">{children}</p>
            ),
            em: ({ children }) => (
              <em className="italic text-zinc-300/90 font-serif font-light tracking-wide bg-violet-950/20 px-1 py-0.5 rounded border-b border-violet-800/30">
                {children}
              </em>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-zinc-100">{children}</strong>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-violet-500/60 pl-3.5 my-2.5 italic text-zinc-300">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="bg-zinc-800/80 px-1.5 py-0.5 rounded text-xs font-mono text-violet-300">
                {children}
              </code>
            ),
          }}
        >
          {mainBody}
        </Markdown>
      ) : isThinkingActive ? (
        <div className="text-xs text-zinc-500 italic flex items-center gap-1.5 pt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
          <span>Formulating character response...</span>
        </div>
      ) : null}
    </div>
  );
};
