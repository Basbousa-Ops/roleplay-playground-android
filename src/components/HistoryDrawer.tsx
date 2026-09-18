import React, { useState } from 'react';
import {
  X,
  Search,
  FileText,
  Download,
  Copy,
  Trash2,
  Edit2,
  Check,
  Plus,
  Clock,
  GitBranch,
  Upload,
  Bot,
} from 'lucide-react';
import { RoleplaySession } from '../types';
import { exportRawJson, exportTranscript } from '../lib/tree';
import { parseImportedRoleplay } from '../lib/importer';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: RoleplaySession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDuplicateSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewRP: () => void;
  onImportBackup: (session: RoleplaySession) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onRenameSession,
  onDuplicateSession,
  onDeleteSession,
  onNewRP,
  onImportBackup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.character.name.toLowerCase().includes(q) ||
      s.character.scenario.toLowerCase().includes(q)
    );
  });

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const startEditing = (s: RoleplaySession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditTitleValue(s.title);
  };

  const saveEditing = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitleValue.trim()) {
      onRenameSession(id, editTitleValue.trim());
    }
    setEditingSessionId(null);
  };

  const handleDownloadTranscript = (s: RoleplaySession, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = exportTranscript(s);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.character.name.replace(/[^a-zA-Z0-9]/g, '_')}_Transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadRawJson = (s: RoleplaySession, e: React.MouseEvent) => {
    e.stopPropagation();
    const json = exportRawJson(s);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.character.name.replace(/[^a-zA-Z0-9]/g, '_')}_Backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const { session, error } = parseImportedRoleplay(content, file.name);
      if (session) {
        onImportBackup(session);
      } else {
        alert(error || 'Could not parse roleplay file format.');
      }
    };
    reader.readAsText(file);
    // Reset file input so user can import the same file again if desired
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-zinc-925 border-l border-zinc-800 shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-850 flex items-center justify-center text-zinc-300">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="text-base font-semibold text-zinc-100">Roleplay History</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions & Search */}
          <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/40 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onClose();
                  onNewRP();
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Roleplay</span>
              </button>

              <label className="cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-750 text-xs font-medium transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Import RP</span>
                <input
                  type="file"
                  accept=".json,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search past roleplays..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Export section for current active session */}
          {activeSession && (
            <div className="mx-4 my-3 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between text-zinc-300 font-medium">
                <span>Active Chat Export:</span>
                <span className="text-[11px] text-zinc-500 truncate max-w-[140px]">
                  {activeSession.title}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  id="btn-export-transcript"
                  onClick={(e) => handleDownloadTranscript(activeSession, e)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer"
                  title="Download clean script (.txt)"
                >
                  <FileText className="w-3.5 h-3.5 text-violet-400" />
                  <span>Transcript (.txt)</span>
                </button>
                <button
                  id="btn-export-raw-json"
                  onClick={(e) => handleDownloadRawJson(activeSession, e)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer"
                  title="Download raw tree backup (.json)"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Raw Tree (.json)</span>
                </button>
              </div>
            </div>
          )}

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-xs">
                No saved roleplays found matching "{searchQuery}"
              </div>
            ) : (
              filteredSessions.map((s) => {
                const isActive = s.id === activeSessionId;
                const nodeCount = Object.keys(s.nodes).length;
                const lastUpdated = new Date(s.updatedAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectSession(s.id);
                      onClose();
                    }}
                    className={`group relative rounded-xl p-3 border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-violet-950/20 border-violet-600/60 shadow-sm'
                        : 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Character Avatar */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700/60 flex-shrink-0 flex items-center justify-center">
                        {s.character.avatar ? (
                          <img
                            src={s.character.avatar}
                            alt={s.character.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Bot className="w-5 h-5 text-zinc-500" />
                        )}
                      </div>

                      {/* Info & Title */}
                      <div className="flex-1 min-w-0">
                        {editingSessionId === s.id ? (
                          <form
                            onSubmit={(e) => saveEditing(s.id, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 mb-1"
                          >
                            <input
                              type="text"
                              value={editTitleValue}
                              onChange={(e) => setEditTitleValue(e.target.value)}
                              autoFocus
                              className="w-full bg-zinc-950 border border-violet-500 rounded px-1.5 py-0.5 text-xs text-zinc-100 focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h3 className="text-xs font-semibold text-zinc-200 truncate">
                              {s.title}
                            </h3>
                            <button
                              onClick={(e) => startEditing(s, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-200 transition-opacity"
                              title="Rename chat"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <p className="text-[11px] text-zinc-400 truncate">
                          Partner: <span className="text-zinc-300">{s.character.name}</span>
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-500">
                          <span className="flex items-center gap-1">
                            <GitBranch className="w-3 h-3 text-zinc-500" />
                            {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
                          </span>
                          <span>•</span>
                          <span>{lastUpdated}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions (Duplicate, Export, Delete) */}
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-zinc-400 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateSession(s.id);
                          }}
                          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                          title="Duplicate conversation tree"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDownloadTranscript(s, e)}
                          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                          title="Export Transcript"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDownloadRawJson(s, e)}
                          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                          title="Export Raw JSON"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Delete */}
                      {confirmDeleteId === s.id ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[11px]"
                        >
                          <span className="text-red-400">Delete?</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(s.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-medium"
                          >
                            Yes
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(s.id);
                          }}
                          className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
                          title="Delete roleplay"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
