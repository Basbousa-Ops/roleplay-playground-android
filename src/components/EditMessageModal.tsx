import React, { useState, useEffect } from 'react';
import { X, GitBranch, Edit3, Send, Check } from 'lucide-react';
import { ConversationNode } from '../types';

interface EditMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: ConversationNode | null;
  onConfirmEditBranch: (nodeId: string, newContent: string) => void;
  onConfirmEditInPlace: (nodeId: string, newContent: string) => void;
}

export const EditMessageModal: React.FC<EditMessageModalProps> = ({
  isOpen,
  onClose,
  node,
  onConfirmEditBranch,
  onConfirmEditInPlace,
}) => {
  const [content, setContent] = useState('');

  useEffect(() => {
    if (node) {
      setContent(node.content);
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const isUser = node.role === 'user';

  const handleBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onConfirmEditBranch(node.id, content.trim());
    onClose();
  };

  const handleInPlaceSubmit = () => {
    if (!content.trim()) return;
    onConfirmEditInPlace(node.id, content.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-950 border border-violet-800/60 flex items-center justify-center text-violet-300">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Edit {isUser ? 'User Message' : 'Character Message'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isUser ? 'Branch timeline or edit in place' : 'Modify response text or regenerate'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleBranchSubmit} className="p-6 space-y-4">
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 text-xs text-zinc-400 flex items-start gap-2">
            <GitBranch className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Branching Protection:</strong> Editing creates an alternate branch. Your
              prior messages are never lost—use the <code className="text-violet-300 font-mono">&lt; n / m &gt;</code> branch
              navigator in the chat viewport to flip between alternate timelines.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">Message Content</label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Edit the dialogue or narrative actions..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 resize-y leading-relaxed font-sans"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleInPlaceSubmit}
              className="px-3.5 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer border border-zinc-750"
              title="Save text without generating a new completion branch"
            >
              Save in place (No branch)
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                id="btn-confirm-branch-send"
                className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white transition-all shadow-md shadow-violet-950/50 cursor-pointer flex items-center gap-1.5"
              >
                <GitBranch className="w-4 h-4" />
                <span>{isUser ? 'Branch & Resend' : 'Branch Alternate'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
