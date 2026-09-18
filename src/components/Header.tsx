import React from 'react';
import { Plus, History, Settings, Sparkles, User, GitBranch, Cloud, Upload } from 'lucide-react';
import { CharacterProfile, CloudSyncConfig } from '../types';

interface HeaderProps {
  character: CharacterProfile;
  turnCount: number;
  cloudConfig?: CloudSyncConfig;
  onOpenNewRP: () => void;
  onOpenImport?: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  character,
  turnCount,
  cloudConfig,
  onOpenNewRP,
  onOpenImport,
  onOpenHistory,
  onOpenSettings,
}) => {
  return (
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Active Character Info & Model Badge */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="relative group flex-shrink-0">
          <div className="w-10 h-10 rounded-full ring-2 ring-violet-500/40 overflow-hidden bg-zinc-800 flex items-center justify-center shadow-md">
            {character.avatar ? (
              <img
                src={character.avatar}
                alt={character.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <User className="w-5 h-5 text-zinc-400" />
            )}
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-zinc-950" />
        </div>

        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-semibold text-zinc-100 truncate tracking-tight">
              {character.name || 'Untitled Character'}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-violet-950/60 text-violet-300 border border-violet-800/40">
              <Sparkles className="w-3 h-3 text-violet-400" />
              gemma-4-31b-it
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="sm:hidden font-mono text-[10px] text-violet-400 bg-violet-950/50 px-1.5 py-0.2 rounded border border-violet-800/30">
              gemma-4-31b
            </span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-400">
              <GitBranch className="w-3 h-3 text-zinc-400" />
              {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        <button
          id="btn-new-rp"
          onClick={onOpenNewRP}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white transition-all shadow-sm shadow-violet-950/50 cursor-pointer"
          title="Start a new roleplay"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">New RP</span>
        </button>

        {onOpenImport && (
          <button
            id="btn-import-rp-header"
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
            title="Import roleplay (JSON, SillyTavern card, or transcript)"
          >
            <Upload className="w-4 h-4 text-violet-400" />
            <span className="hidden md:inline">Import</span>
          </button>
        )}

        <button
          id="btn-history-drawer"
          onClick={onOpenHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
          title="Open roleplay history and transcripts"
        >
          <History className="w-4 h-4 text-zinc-400" />
          <span className="hidden sm:inline">History</span>
        </button>

        <button
          id="btn-settings-modal"
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850 rounded-lg border border-zinc-800/80 transition-colors cursor-pointer"
          title={
            cloudConfig?.isConnected || cloudConfig?.isGoogleConnected
              ? `Connected (${cloudConfig.userEmail || (cloudConfig.authProvider === 'anonymous' ? 'Guest' : 'User')}) - Supabase Realtime Live`
              : 'Configure Google Gen AI & Supabase Cloud Sync'
          }
        >
          {cloudConfig?.isConnected || cloudConfig?.isGoogleConnected ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline text-[11px] text-zinc-300 font-mono">
                {cloudConfig.syncStatus === 'syncing' ? 'Syncing...' : 'Live Sync'}
              </span>
            </div>
          ) : (
            <Settings className="w-4 h-4 text-zinc-400" />
          )}
        </button>
      </div>
    </header>
  );
};
