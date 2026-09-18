import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Sparkles,
  Bot,
  AlertCircle,
  CheckCircle2,
  FileJson,
  ArrowRight,
} from 'lucide-react';
import { RoleplaySession } from '../types';
import { parseImportedRoleplay } from '../lib/importer';

interface ImportRoleplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSession: (session: RoleplaySession) => void;
}

export const ImportRoleplayModal: React.FC<ImportRoleplayModalProps> = ({
  isOpen,
  onClose,
  onImportSession,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successPreview, setSuccessPreview] = useState<RoleplaySession | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleProcessRaw = (content: string, fileName?: string) => {
    setErrorMsg(null);
    const result = parseImportedRoleplay(content, fileName);
    if (result.error || !result.session) {
      setErrorMsg(result.error || 'Failed to parse roleplay data.');
      setSuccessPreview(null);
    } else {
      setSuccessPreview(result.session);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessRaw(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        handleProcessRaw(content, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handlePasteProcess = () => {
    if (!pasteContent.trim()) {
      setErrorMsg('Please paste your roleplay JSON or transcript text first.');
      return;
    }
    handleProcessRaw(pasteContent.trim(), 'Pasted Roleplay');
  };

  const handleConfirmImport = () => {
    if (successPreview) {
      onImportSession(successPreview);
      onClose();
      // Reset state
      setSuccessPreview(null);
      setPasteContent('');
      setErrorMsg(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none animate-fadeIn">
      <div
        className="w-full max-w-xl bg-zinc-925 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-950/80 border border-violet-800/60 flex items-center justify-center text-violet-300">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                Import Roleplay
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/40">
                  JSON / Card / Text
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Supports Roleplay Playground backups, SillyTavern cards, and chat transcripts
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

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* File Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
              dragActive
                ? 'border-violet-500 bg-violet-950/30'
                : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-950/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt,.md"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 group-hover:scale-105 transition-transform">
              <FileJson className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">
                Click to browse or drop file here
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                .json (Playground backup or SillyTavern card), .txt, or .md
              </p>
            </div>
          </div>

          {/* Or Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-zinc-800 w-full" />
            <span className="bg-zinc-925 px-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider absolute">
              or paste text / JSON directly
            </span>
          </div>

          {/* Paste Textarea */}
          <div className="space-y-2">
            <textarea
              rows={4}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Paste raw roleplay JSON or transcript messages here..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
            />
            <button
              type="button"
              onClick={handlePasteProcess}
              className="w-full py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>Parse Pasted Content</span>
            </button>
          </div>

          {/* Feedback & Preview Card */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {successPreview && (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Ready to Import
                </span>
                <span className="text-[11px] font-mono text-emerald-300/80">
                  {Object.keys(successPreview.nodes).length} messages / nodes
                </span>
              </div>

              <div className="flex items-center gap-3 bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800/80">
                <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {successPreview.character.avatar ? (
                    <img
                      src={successPreview.character.avatar}
                      alt={successPreview.character.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Bot className="w-4 h-4 text-violet-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-zinc-100 truncate">
                    {successPreview.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 truncate">
                    Character: {successPreview.character.name}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 line-clamp-2 italic">
                "{successPreview.character.firstMessage || successPreview.character.scenario}"
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!successPreview}
            onClick={handleConfirmImport}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 text-white text-xs sm:text-sm font-semibold shadow-md shadow-violet-950/50 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>Confirm & Open Roleplay</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
