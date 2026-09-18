import React, { useState, useEffect } from 'react';
import { X, Upload, Sparkles, User, Bot, BookOpen, Sliders, Check } from 'lucide-react';
import { CharacterProfile, StickyPresets, UserPersona } from '../types';
import { STARTER_CHARACTERS } from '../lib/storage';

interface CharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  stickyPresets: StickyPresets;
  onSavePresets: (presets: StickyPresets) => void;
  onCreateRP: (
    character: CharacterProfile,
    userPersona: UserPersona,
    systemInstructions: string
  ) => void;
  onOpenImport?: () => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  isOpen,
  onClose,
  stickyPresets,
  onSavePresets,
  onCreateRP,
  onOpenImport,
}) => {
  // Active Tab
  const [activeTab, setActiveTab] = useState<'character' | 'persona' | 'system'>('character');

  // Character Fields
  const [charName, setCharName] = useState('');
  const [charAvatar, setCharAvatar] = useState('');
  const [charScenario, setCharScenario] = useState('');
  const [charFirstMessage, setCharFirstMessage] = useState('');

  // User Persona Fields (prefilled from stickyPresets)
  const [userName, setUserName] = useState(stickyPresets.userPersona.name);
  const [userBio, setUserBio] = useState(stickyPresets.userPersona.bio);
  const [userAvatar, setUserAvatar] = useState(stickyPresets.userPersona.avatar);

  // System Instructions (prefilled from stickyPresets)
  const [systemInstructions, setSystemInstructions] = useState(stickyPresets.systemInstructions);

  // Update fields whenever stickyPresets change or modal opens
  useEffect(() => {
    if (isOpen) {
      setUserName(stickyPresets.userPersona.name);
      setUserBio(stickyPresets.userPersona.bio);
      setUserAvatar(stickyPresets.userPersona.avatar);
      setSystemInstructions(stickyPresets.systemInstructions);

      // If character is empty, pick the first starter character by default
      if (!charName) {
        applyStarter(STARTER_CHARACTERS[0]);
      }
    }
  }, [isOpen, stickyPresets]);

  const applyStarter = (starter: (typeof STARTER_CHARACTERS)[0]) => {
    setCharName(starter.name);
    setCharAvatar(starter.avatar);
    setCharScenario(starter.scenario);
    setCharFirstMessage(starter.firstMessage);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'character' | 'user'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max ~3MB)
    if (file.size > 3 * 1024 * 1024) {
      alert('Image file is too large. Please select an image under 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (target === 'character') {
        setCharAvatar(base64);
      } else {
        setUserAvatar(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim() || !charScenario.trim() || !charFirstMessage.trim()) {
      setActiveTab('character');
      alert('Please fill in Character Name, Scenario, and First Message.');
      return;
    }

    const updatedUserPersona: UserPersona = {
      name: userName.trim() || 'User',
      bio: userBio.trim(),
      avatar: userAvatar.trim(),
    };

    const updatedPresets: StickyPresets = {
      userPersona: updatedUserPersona,
      systemInstructions: systemInstructions.trim(),
    };

    // Cache Sticky Presets
    onSavePresets(updatedPresets);

    const newCharacter: CharacterProfile = {
      id: 'char_' + Date.now(),
      name: charName.trim(),
      avatar: charAvatar.trim(),
      scenario: charScenario.trim(),
      firstMessage: charFirstMessage.trim(),
    };

    onCreateRP(newCharacter, updatedUserPersona, systemInstructions.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div
        id="character-creation-modal"
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-950 border border-violet-800/60 flex items-center justify-center text-violet-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-zinc-100">
                New Roleplay Session
              </h2>
              <p className="text-xs text-zinc-400">
                Configure your partner, persona, and behavioral boundaries
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

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-6 pt-2 gap-2 text-xs sm:text-sm font-medium select-none">
          <button
            type="button"
            onClick={() => setActiveTab('character')}
            className={`pb-2.5 px-2 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'character'
                ? 'border-violet-500 text-violet-300 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            Character Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('persona')}
            className={`pb-2.5 px-2 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'persona'
                ? 'border-violet-500 text-violet-300 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="w-4 h-4" />
            User Persona
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded">Sticky</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`pb-2.5 px-2 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'system'
                ? 'border-violet-500 text-violet-300 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            System Instructions
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded">Sticky</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: CHARACTER PROFILE */}
          {activeTab === 'character' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Starters quick picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-300">
                    Load a Quick Starter or Create Custom:
                  </label>
                  {onOpenImport && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenImport();
                      }}
                      className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 cursor-pointer bg-violet-950/40 hover:bg-violet-950/70 border border-violet-800/40 px-2 py-0.5 rounded-lg transition-colors"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Import Card or JSON</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {STARTER_CHARACTERS.map((starter) => (
                    <button
                      key={starter.id}
                      type="button"
                      onClick={() => applyStarter(starter)}
                      className={`flex items-center gap-2.5 p-2 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                        charName === starter.name
                          ? 'border-violet-500 bg-violet-950/30 text-zinc-100 ring-1 ring-violet-500/50'
                          : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
                      }`}
                    >
                      <img
                        src={starter.avatar}
                        alt={starter.name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                      />
                      <span className="font-medium truncate">{starter.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Character Name & Avatar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Character Name <span className="text-violet-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    placeholder="e.g. Lyra Vance, Lord Malakor, Kaelen"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                  />
                </div>

                {/* Avatar Preview & Upload */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">Avatar</label>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {charAvatar ? (
                        <img
                          src={charAvatar}
                          alt="Character avatar preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Bot className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:bg-zinc-850 text-xs text-zinc-300 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'character')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Avatar URL alternative */}
              <div className="space-y-1">
                <label className="block text-[11px] text-zinc-400">
                  Or provide Image URL:
                </label>
                <input
                  type="url"
                  value={charAvatar}
                  onChange={(e) => setCharAvatar(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Persona & World Scenario */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  Persona & World Scenario <span className="text-violet-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={charScenario}
                  onChange={(e) => setCharScenario(e.target.value)}
                  placeholder="Describe the setting, the character's background, personality, tone, motives, and current circumstances..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 resize-y leading-relaxed"
                />
              </div>

              {/* First Message (Turn 0) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-300">
                    First Message (Turn 0 Greeting) <span className="text-violet-400">*</span>
                  </label>
                  <span className="text-[11px] text-violet-400">Initiates the RP</span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={charFirstMessage}
                  onChange={(e) => setCharFirstMessage(e.target.value)}
                  placeholder="Write the opening greeting or narrative scene setting that immediately immerses the player..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 resize-y leading-relaxed font-sans"
                />
              </div>
            </div>
          )}

          {/* TAB 2: USER PERSONA */}
          {activeTab === 'persona' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 text-xs text-zinc-400 flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Sticky Preset:</strong> Your user persona details will be saved to
                  local storage and automatically prefilled for all future roleplay chats.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    User Display Name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Roland, Captain Thorne, Eleanor"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                  />
                </div>

                {/* User Avatar */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">User Avatar</label>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {userAvatar ? (
                        <img
                          src={userAvatar}
                          alt="User avatar preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:bg-zinc-850 text-xs text-zinc-300 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'user')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* User Avatar URL alternative */}
              <div className="space-y-1">
                <label className="block text-[11px] text-zinc-400">
                  Or provide Avatar URL:
                </label>
                <input
                  type="url"
                  value={userAvatar}
                  onChange={(e) => setUserAvatar(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* User Bio */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  User Bio / Identity
                </label>
                <textarea
                  rows={4}
                  value={userBio}
                  onChange={(e) => setUserBio(e.target.value)}
                  placeholder="Describe your character's role, appearance, skills, or personality so the AI knows who it is interacting with..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 resize-y leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM INSTRUCTIONS */}
          {activeTab === 'system' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 text-xs text-zinc-400 flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Sticky Preset:</strong> System instructions define the LLM's writing
                  guidelines, formatting rules, and style restrictions. They are cached across all new
                  roleplays.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  LLM Behavioral Rules & Style Constraints
                </label>
                <textarea
                  rows={8}
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  placeholder="Define formatting, dialogue styling, narrative pacing, and behavioral boundaries..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 resize-y font-mono text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              id="btn-confirm-create-rp"
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white transition-all shadow-md shadow-violet-950/50 cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Begin Roleplay</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
