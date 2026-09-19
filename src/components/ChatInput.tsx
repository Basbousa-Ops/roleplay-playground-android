import React, { useRef, useEffect, useState } from 'react';
import { Send, Square, Sparkles, CornerDownLeft, Play, Brain, SpellCheck, X } from 'lucide-react';
import { ThinkingLevelOption } from '../types';
import { findMisspellingsInText, applySpellingFix, MisspellingItem } from '../lib/spelling';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onContinueLast?: () => void;
  canContinue?: boolean;
  isStreaming: boolean;
  characterName: string;
  userPersonaName?: string;
  disabled?: boolean;
  thinkingLevel?: ThinkingLevelOption;
  onCycleThinkingLevel?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  onStop,
  onContinueLast,
  canContinue = false,
  isStreaming,
  characterName,
  userPersonaName,
  disabled = false,
  thinkingLevel = 'minimal',
  onCycleThinkingLevel,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helpful Typing Correction Assistant state
  const [isSpellCheckEnabled, setIsSpellCheckEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rp_spellcheck_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<MisspellingItem[]>([]);

  // Debounced check for misspelled words in input
  useEffect(() => {
    if (!isSpellCheckEnabled || !input.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      const whitelist = [characterName, userPersonaName || ''].filter(Boolean);
      const found = findMisspellingsInText(input, whitelist, ignoredWords);
      setSuggestions(found);
    }, 280);

    return () => clearTimeout(timer);
  }, [input, isSpellCheckEnabled, characterName, userPersonaName, ignoredWords]);

  const handleToggleSpellCheck = () => {
    setIsSpellCheckEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('rp_spellcheck_enabled', String(next));
      } catch (e) {
        console.warn('Failed to save spellcheck preference:', e);
      }
      if (!next) {
        setSuggestions([]);
      }
      return next;
    });
  };

  const handleApplyCorrection = (item: MisspellingItem) => {
    const fixedText = applySpellingFix(input, item.word, item.suggestion, item.startIndex);
    setInput(fixedText);
    setSuggestions((prev) => prev.filter((s) => s.word.toLowerCase() !== item.word.toLowerCase()));
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleIgnoreWord = (word: string) => {
    setIgnoredWords((prev) => new Set([...prev, word.toLowerCase()]));
    setSuggestions((prev) => prev.filter((s) => s.word.toLowerCase() !== word.toLowerCase()));
  };

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Cap at 180px height
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 44), 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim() && !disabled) {
        onSend();
      }
    }
  };

  const insertActionWrapper = () => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = input;

    if (start !== end) {
      const selected = currentText.substring(start, end);
      const replacement = `*${selected}*`;
      const newText = currentText.substring(0, start) + replacement + currentText.substring(end);
      setInput(newText);
    } else {
      const newText = currentText.substring(0, start) + `*action*` + currentText.substring(end);
      setInput(newText);
    }
  };

  return (
    <div className="border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md px-3 sm:px-6 py-3.5 sm:py-4 sticky bottom-0 z-20 flex-shrink-0">
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        {/* Quick action tags & helpers — horizontal scroll on phones so the
            toolbar never wraps into a tall stack that squeezes the chat */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 select-none px-1">
          <div className="flex items-center gap-2 flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={insertActionWrapper}
              className="flex-shrink-0 text-zinc-400 hover:text-violet-300 font-serif italic hover:bg-zinc-850 px-1.5 py-0.5 rounded border border-zinc-800 transition-colors cursor-pointer"
              title="Wrap in *asterisks* for narrative actions"
            >
              *narrative action*
            </button>
            <span className="hidden sm:inline text-zinc-500">
              Use "quotes" for spoken words
            </span>

            {/* Quick Continue Button if last message is an assistant reply and user hasn't typed */}
            {canContinue && onContinueLast && !input.trim() && !isStreaming && (
              <button
                type="button"
                id="btn-quick-continue-reply"
                onClick={onContinueLast}
                className="flex-shrink-0 text-amber-400 hover:text-amber-300 hover:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 transition-colors cursor-pointer flex items-center gap-1 font-medium text-[11px] animate-fadeIn"
                title="Ask character to continue writing from the exact end of the previous message"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Continue reply</span>
              </button>
            )}

            {/* Thinking Level Toggle (Minimal / High) */}
            {onCycleThinkingLevel && (
              <button
                type="button"
                id="btn-chat-toggle-thinking-level"
                onClick={onCycleThinkingLevel}
                className={`flex-shrink-0 px-2.5 py-0.5 rounded border transition-all cursor-pointer flex items-center gap-1.5 font-medium text-[11px] ${
                  thinkingLevel === 'high'
                    ? 'bg-violet-950/80 border-violet-500/80 text-violet-200 shadow-sm'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700'
                }`}
                title={`Thinking level: ${thinkingLevel === 'high' ? 'High' : 'Minimal (Default)'}. Click to switch.`}
              >
                <Brain
                  className={`w-3 h-3 ${
                    thinkingLevel === 'high' ? 'text-violet-400 animate-pulse' : 'text-zinc-400'
                  }`}
                />
                <span>Thinking: <strong className="font-semibold text-zinc-100">{thinkingLevel === 'high' ? 'High' : 'Minimal'}</strong></span>
              </button>
            )}

            {/* Helpful Spell Check Assistant Toggle */}
            <button
              type="button"
              id="btn-chat-toggle-spellcheck"
              onClick={handleToggleSpellCheck}
              className={`flex-shrink-0 px-2.5 py-0.5 rounded border transition-all cursor-pointer flex items-center gap-1.5 font-medium text-[11px] ${
                isSpellCheckEnabled
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700'
                  : 'bg-zinc-900/50 border-zinc-850 text-zinc-500 hover:text-zinc-400'
              }`}
              title={`Typing spell assistance is ${isSpellCheckEnabled ? 'ON' : 'OFF'}. Click to toggle.`}
            >
              <SpellCheck className={`w-3 h-3 ${isSpellCheckEnabled ? 'text-amber-400' : 'text-zinc-500'}`} />
              <span>Spell: <strong className="font-semibold text-zinc-100">{isSpellCheckEnabled ? 'ON' : 'OFF'}</strong></span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="hidden sm:inline">gemma-4-31b-it</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* Subtle, non-annoying spelling correction suggestion bar */}
        {isSpellCheckEnabled && suggestions.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-900/95 border border-violet-900/40 rounded-xl text-xs shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <div className="flex items-center gap-1.5 text-zinc-400 font-medium flex-shrink-0">
                <SpellCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] text-zinc-300">Spelling:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {suggestions.map((item, idx) => (
                  <div
                    key={`${item.word}-${idx}`}
                    className="inline-flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 px-2 py-0.5 rounded-lg text-xs"
                  >
                    <span className="text-zinc-400 font-mono text-[11px] line-through">{item.word}</span>
                    <span className="text-zinc-600">→</span>
                    <button
                      type="button"
                      id={`btn-fix-spelling-${item.word.toLowerCase()}`}
                      onClick={() => handleApplyCorrection(item)}
                      className="font-medium text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1 group"
                      title={`Click to replace "${item.word}" with "${item.suggestion}"`}
                    >
                      <span className="group-hover:underline">{item.suggestion}</span>
                      <span className="text-[10px] px-1 py-0.2 bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 rounded font-sans font-semibold">
                        Fix
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIgnoreWord(item.word)}
                      className="text-zinc-500 hover:text-zinc-300 ml-0.5 cursor-pointer p-0.5 rounded hover:bg-zinc-800 transition-colors"
                      title={`Ignore "${item.word}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuggestions([])}
              className="text-zinc-500 hover:text-zinc-400 text-[11px] flex-shrink-0 cursor-pointer ml-auto"
              title="Dismiss suggestions"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input box */}
        <div className="relative flex items-end gap-2 bg-zinc-900 border border-zinc-750 focus-within:border-violet-500/80 rounded-2xl p-1.5 sm:p-2 shadow-lg transition-all">
          <textarea
            ref={textareaRef}
            id="roleplay-input-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={`Reply to ${characterName || 'character'}...`}
            rows={1}
            className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 text-sm sm:text-base px-2.5 py-1.5 focus:outline-none resize-none min-h-[42px] max-h-[180px] leading-relaxed"
          />

          {/* Action Button: Stop or Send */}
          {isStreaming ? (
            <button
              id="btn-stop-generation"
              onClick={onStop}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-600/90 hover:bg-red-500 active:bg-red-700 text-white transition-all shadow-md cursor-pointer flex-shrink-0"
              title="Stop Generation"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              id="btn-send-message"
              onClick={onSend}
              disabled={!input.trim() || disabled}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all shadow-md flex-shrink-0 cursor-pointer ${
                input.trim() && !disabled
                  ? 'bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white shadow-violet-950/40'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-750'
              }`}
              title="Send reply (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="hidden sm:flex justify-between items-center text-[11px] text-zinc-500 px-1 select-none">
          <span>
            Press <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300 font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300 font-mono text-[10px]">Shift + Enter</kbd> for newline
          </span>
          <span>Acyclic branching engine active</span>
        </div>
      </div>
    </div>
  );
};
