import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Edit3,
  Copy,
  Check,
  User,
  Bot,
  Hash,
  Play,
} from 'lucide-react';
import { ConversationNode, RoleplaySession } from '../types';
import { getSiblingInfo } from '../lib/tree';
import { RoleplayMarkdown } from './RoleplayMarkdown';

interface DialogueViewportProps {
  session: RoleplaySession;
  timeline: ConversationNode[];
  isStreaming: boolean;
  streamingContent: string;
  streamingNodeId: string | null;
  onSwitchBranch: (nodeId: string, direction: 'prev' | 'next') => void;
  onRegenerate: (nodeId: string) => void;
  onContinue: (nodeId: string) => void;
  onEditMessage: (node: ConversationNode) => void;
}

export const DialogueViewport: React.FC<DialogueViewportProps> = ({
  session,
  timeline,
  isStreaming,
  streamingContent,
  streamingNodeId,
  onSwitchBranch,
  onRegenerate,
  onContinue,
  onEditMessage,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Auto-scroll handler
  useEffect(() => {
    if (shouldAutoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [timeline, streamingContent, shouldAutoScroll]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // If within 100px of bottom, keep auto-scroll on
    const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 100;
    setShouldAutoScroll(isAtBottom);
  };

  const handleCopy = async (nodeId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNodeId(nodeId);
      setTimeout(() => setCopiedNodeId(null), 1800);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 space-y-6 sm:space-y-8 scroll-smooth"
    >
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-7">
        {timeline.map((node, index) => {
          const isUser = node.role === 'user';
          const siblingInfo = getSiblingInfo(session, node.id);
          const isCurrentStreamingNode = isStreaming && streamingNodeId === node.id;
          const displayContent = isCurrentStreamingNode ? streamingContent || node.content : node.content;
          const timestamp = new Date(node.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          // Only display verified token usage if returned by the SDK
          const hasVerifiedTokenUsage =
            node.tokenUsage && typeof node.tokenUsage.total_tokens === 'number';

          return (
            <div
              key={node.id}
              id={`msg-node-${node.id}`}
              className={`group relative flex gap-3.5 sm:gap-4.5 transition-all ${
                isUser ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0 pt-0.5">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center ring-1 shadow-sm ${
                    isUser
                      ? 'bg-zinc-800 ring-zinc-700/80'
                      : 'bg-violet-950/60 ring-violet-700/50'
                  }`}
                >
                  {isUser ? (
                    session.userPersona.avatar ? (
                      <img
                        src={session.userPersona.avatar}
                        alt={session.userPersona.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <User className="w-4 h-4 text-zinc-300" />
                    )
                  ) : session.character.avatar ? (
                    <img
                      src={session.character.avatar}
                      alt={session.character.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Bot className="w-4 h-4 text-violet-300" />
                  )}
                </div>
              </div>

              {/* Message Content & Controls */}
              <div
                className={`flex flex-col max-w-[86%] sm:max-w-[80%] ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                {/* Header (Speaker Name, Turn #, Timestamp) */}
                <div
                  className={`flex items-center gap-2 mb-1.5 text-xs text-zinc-400 select-none ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <span className="font-medium text-zinc-200">
                    {isUser ? session.userPersona.name || 'User' : session.character.name}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Turn {index}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-[11px] text-zinc-500">{timestamp}</span>

                  {/* Real token counter - ONLY shown if model returned verified usage */}
                  {hasVerifiedTokenUsage && (
                    <span
                      title={`Verified token count: ${node.tokenUsage?.total_tokens} total (${node.tokenUsage?.prompt_tokens ?? 0} prompt, ${node.tokenUsage?.completion_tokens ?? 0} response)`}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono text-zinc-400 bg-zinc-850 border border-zinc-700/60"
                    >
                      <Hash className="w-2.5 h-2.5 text-zinc-500" />
                      {node.tokenUsage?.total_tokens}t
                    </span>
                  )}
                </div>

                {/* Bubble Container */}
                <div
                  className={`relative rounded-2xl p-4 sm:p-5 transition-all text-sm sm:text-base border shadow-md ${
                    isUser
                      ? 'bg-zinc-850/90 text-zinc-100 border-zinc-750 rounded-tr-sm'
                      : 'bg-zinc-900/90 text-zinc-200 border-zinc-800/80 rounded-tl-sm'
                  }`}
                >
                  <RoleplayMarkdown content={displayContent} role={node.role} />

                  {/* Pulsing indicator when generating */}
                  {isCurrentStreamingNode && (
                    <span className="inline-block w-2 h-4 ml-1 bg-violet-400 animate-pulse align-middle" />
                  )}
                </div>

                {/* Inline Controls (Branch Navigator, Edit, Regenerate, Copy) */}
                <div
                  className={`mt-2 flex items-center gap-1.5 flex-wrap select-none transition-opacity ${
                    isUser ? 'justify-end' : 'justify-start'
                  } ${isStreaming ? 'pointer-events-none opacity-40' : 'opacity-85 sm:opacity-75 sm:group-hover:opacity-100'}`}
                >
                  {/* Branch Traversal Controls (< n / m >) */}
                  {siblingInfo.hasSiblings && (
                    <div className="flex items-center rounded-lg bg-zinc-900/90 border border-zinc-800 px-1 py-0.5 text-xs text-zinc-300 shadow-sm mr-1">
                      <button
                        id={`btn-prev-branch-${node.id}`}
                        onClick={() => onSwitchBranch(node.id, 'prev')}
                        className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                        title="Previous alternate branch"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-1.5 font-mono text-[11px] text-zinc-300">
                        {siblingInfo.currentIndex + 1} / {siblingInfo.totalSiblings}
                      </span>
                      <button
                        id={`btn-next-branch-${node.id}`}
                        onClick={() => onSwitchBranch(node.id, 'next')}
                        className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                        title="Next alternate branch"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Edit Message Button */}
                  <button
                    id={`btn-edit-${node.id}`}
                    onClick={() => onEditMessage(node)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-md transition-colors cursor-pointer border border-transparent hover:border-zinc-700/60"
                    title={isUser ? "Edit & Resend (branches conversation)" : "Edit response text"}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>

                  {/* Regenerate Button (Assistant only) */}
                  {!isUser && (
                    <button
                      id={`btn-regen-${node.id}`}
                      onClick={() => onRegenerate(node.id)}
                      disabled={isStreaming}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-950/40 rounded-md transition-colors cursor-pointer border border-transparent hover:border-violet-800/50 disabled:opacity-40"
                      title="Generate alternate response branch from parent"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Regenerate</span>
                    </button>
                  )}

                  {/* Continue Button (Assistant only) */}
                  {!isUser && !isCurrentStreamingNode && (
                    <button
                      id={`btn-continue-${node.id}`}
                      onClick={() => onContinue(node.id)}
                      disabled={isStreaming}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-md transition-colors cursor-pointer border border-transparent hover:border-amber-800/50 disabled:opacity-40"
                      title="Continue writing response seamlessly from where it stopped"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span className="hidden sm:inline">Continue</span>
                    </button>
                  )}

                  {/* Copy Button */}
                  <button
                    id={`btn-copy-${node.id}`}
                    onClick={() => handleCopy(node.id, displayContent)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-md transition-colors cursor-pointer"
                    title="Copy message to clipboard"
                  >
                    {copiedNodeId === node.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-[11px]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
