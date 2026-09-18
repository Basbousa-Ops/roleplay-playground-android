import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  LogOut,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Database,
  Sparkles,
  GitBranch,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Check,
  Sliders,
  RotateCcw,
  Brain,
  SpellCheck,
  Link as LinkIcon,
} from 'lucide-react';
import { CloudSyncConfig, RoleplaySession, StickyPresets, RoleplayGenerationConfig } from '../types';
import {
  getStoredApiKey,
  saveStoredApiKey,
  GEMINI_MODEL,
  getStoredGenerationConfig,
  saveStoredGenerationConfig,
  DEFAULT_GENERATION_CONFIG,
} from '../lib/gemini';
import { syncGenerationConfigToSupabase } from '../lib/supabaseSync';
import { setSessionFromUrl, sendPasswordResetEmail } from '../lib/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudConfig: CloudSyncConfig;
  sessions: RoleplaySession[];
  stickyPresets: StickyPresets;
  apiKeyAlert?: string | null;
  onClearApiKeyAlert?: () => void;
  onSyncApiKey?: (apiKey: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onEmailSignIn?: (email: string, pass: string) => Promise<void>;
  onEmailSignUp?: (email: string, pass: string) => Promise<any>;
  onAnonymousSignIn?: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onManualSync: () => Promise<{ success: boolean; message: string }>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  cloudConfig,
  sessions,
  stickyPresets: _stickyPresets,
  apiKeyAlert,
  onClearApiKeyAlert,
  onSyncApiKey,
  onGoogleSignIn,
  onEmailSignIn,
  onEmailSignUp,
  onAnonymousSignIn,
  onGoogleSignOut,
  onManualSync,
}) => {
  // Google AI Studio API Key state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [keySavedMessage, setKeySavedMessage] = useState<string | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Generation parameters state (matching Google AI Studio)
  const [genConfig, setGenConfig] = useState<RoleplayGenerationConfig>(() =>
    getStoredGenerationConfig()
  );

  // Non-intrusive typing spellcheck assistant preference
  const [spellCheckEnabled, setSpellCheckEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rp_spellcheck_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const handleToggleSpellCheck = () => {
    setSpellCheckEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('rp_spellcheck_enabled', String(next));
      } catch (e) {
        console.warn('Failed to save spellcheck setting:', e);
      }
      return next;
    });
  };

  // Sync state
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [isSigningInEmail, setIsSigningInEmail] = useState(false);
  const [isSigningInAnon, setIsSigningInAnon] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Email & Password Auth State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isEmailSignUp, setIsEmailSignUp] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(true);

  // Callback URL / Token Paste State
  const [callbackUrlInput, setCallbackUrlInput] = useState('');
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Check and load API key and generation config on modal open
  useEffect(() => {
    if (isOpen) {
      const existingKey = getStoredApiKey();
      setApiKeyInput(existingKey);
      setGenConfig(getStoredGenerationConfig());
      setAuthError(null);
      setSyncStatusMsg('');
      setKeySavedMessage(null);
      setCallbackUrlInput('');
    }
  }, [isOpen]);

  const isConnected = !!(cloudConfig.isConnected || cloudConfig.isGoogleConnected);

  const handleUpdateGenConfig = (updates: Partial<RoleplayGenerationConfig>) => {
    setGenConfig((prev) => {
      const updated = { ...prev, ...updates };
      saveStoredGenerationConfig(updated);
      if (isConnected && cloudConfig.userId) {
        syncGenerationConfigToSupabase(cloudConfig.userId, updated).catch((err) => {
          console.warn('Failed to sync generation config to Supabase:', err);
        });
      }
      return updated;
    });
  };

  const handleResetGenConfig = () => {
    setGenConfig(DEFAULT_GENERATION_CONFIG);
    saveStoredGenerationConfig(DEFAULT_GENERATION_CONFIG);
    if (isConnected && cloudConfig.userId) {
      syncGenerationConfigToSupabase(cloudConfig.userId, DEFAULT_GENERATION_CONFIG).catch((err) => {
        console.warn('Failed to sync generation config to Supabase:', err);
      });
    }
  };

  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    setIsSavingKey(true);
    saveStoredApiKey(trimmed);

    try {
      if (onSyncApiKey && isConnected && trimmed) {
        await onSyncApiKey(trimmed);
        setKeySavedMessage('API key saved and synced across devices via Supabase Cloud!');
      } else if (!isConnected) {
        setKeySavedMessage('API key saved locally. Sign in below to sync across all devices.');
      } else {
        setKeySavedMessage('API key saved.');
      }
    } catch (err: any) {
      console.error('Failed to sync API key to Supabase:', err);
      setKeySavedMessage('API key saved locally (cloud sync error).');
    } finally {
      setIsSavingKey(false);
    }

    if (onClearApiKeyAlert) {
      onClearApiKeyAlert();
    }
    setTimeout(() => {
      setKeySavedMessage(null);
    }, 4500);
  };

  const handleClearApiKey = async () => {
    setApiKeyInput('');
    saveStoredApiKey('');
    if (onSyncApiKey && isConnected) {
      try {
        await onSyncApiKey('');
      } catch (err) {
        console.warn('Could not remove API key from Supabase:', err);
      }
    }
    setKeySavedMessage('API key removed from local storage and cloud sync.');
    setTimeout(() => {
      setKeySavedMessage(null);
    }, 3500);
  };

  const handleGoogleAuthClick = async () => {
    setIsSigningInGoogle(true);
    setAuthError(null);
    try {
      await onGoogleSignIn();
      const currentKey = getStoredApiKey();
      if (currentKey && onSyncApiKey) {
        try {
          await onSyncApiKey(currentKey);
        } catch {}
      }
      setSyncStatusMsg('Connecting to Google OAuth...');
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const msg = err?.message || '';
      if (msg.includes('provider is not enabled') || msg.includes('validation_failed')) {
        setAuthError(
          'Google OAuth provider is not yet enabled in your Supabase project (Authentication → Providers → Google). You can enable it in the Supabase Dashboard, or sign in using Email & Password below.'
        );
      } else {
        setAuthError(err?.message || 'Google sign-in was cancelled or failed.');
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) {
      setAuthError('Please enter both email and password.');
      return;
    }
    if (passwordInput.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    setIsSigningInEmail(true);
    setAuthError(null);
    setSyncStatusMsg('');
    try {
      if (isEmailSignUp) {
        if (!onEmailSignUp) throw new Error('Email sign-up not available');
        const res = await onEmailSignUp(emailInput.trim(), passwordInput);
        if (res?.requiresConfirmation) {
          setSyncStatusMsg(
            `Account created for ${emailInput.trim()}! Please check your email inbox to confirm your account (or disable "Confirm email" in Supabase Auth settings to log in immediately).`
          );
        } else {
          setSyncStatusMsg('Account created! Signed in to Supabase.');
        }
      } else {
        if (!onEmailSignIn) throw new Error('Email sign-in not available');
        await onEmailSignIn(emailInput.trim(), passwordInput);
        setSyncStatusMsg('Signed in to Supabase successfully!');
      }
      const currentKey = getStoredApiKey();
      if (currentKey && onSyncApiKey) {
        try {
          await onSyncApiKey(currentKey);
        } catch {}
      }
      setTimeout(() => setSyncStatusMsg(''), 6000);
    } catch (err: any) {
      console.error('Email auth error:', err);
      const msg = err?.message || 'Authentication failed. Please check your credentials.';
      if (msg.includes('already exists') && isEmailSignUp) {
        setIsEmailSignUp(false);
      }
      setAuthError(msg);
    } finally {
      setIsSigningInEmail(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailInput.trim()) {
      setAuthError('Please enter your email address in the field above to receive a password reset link.');
      return;
    }
    setIsSendingReset(true);
    setAuthError(null);
    try {
      const { error } = await sendPasswordResetEmail(emailInput.trim());
      if (error) throw error;
      setSyncStatusMsg(`Password reset link sent to ${emailInput.trim()}! Check your inbox.`);
      setTimeout(() => setSyncStatusMsg(''), 7000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setAuthError(err?.message || 'Failed to send password reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleAnonymousAuthClick = async () => {
    if (!onAnonymousSignIn) return;
    setIsSigningInAnon(true);
    setAuthError(null);
    try {
      await onAnonymousSignIn();
      setSyncStatusMsg('Signed in as Guest with cloud sync!');
      setTimeout(() => setSyncStatusMsg(''), 3500);
    } catch (err: any) {
      console.error('Guest sign-in error:', err);
      const msg = err?.message || '';
      if (msg.includes('disabled') || msg.includes('Anonymous sign-ins are disabled')) {
        setAuthError(
          'Anonymous guest sign-in is disabled in your Supabase project settings. Please sign in or register with Email & Password below, or toggle on Anonymous sign-in in Supabase Auth.'
        );
      } else {
        setAuthError(err?.message || 'Guest sign-in failed.');
      }
    } finally {
      setIsSigningInAnon(false);
    }
  };

  const handleCompleteWithUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!callbackUrlInput.trim()) return;
    setIsSubmittingUrl(true);
    setAuthError(null);
    try {
      const { error } = await setSessionFromUrl(callbackUrlInput.trim());
      if (error) throw error;
      setSyncStatusMsg('Successfully signed in from callback URL!');
      setCallbackUrlInput('');
      setTimeout(() => setSyncStatusMsg(''), 3500);
    } catch (err: any) {
      console.error('Callback URL sign in error:', err);
      setAuthError(err?.message || 'Failed to authenticate from the provided URL.');
    } finally {
      setIsSubmittingUrl(false);
    }
  };

  const handleSignOutClick = async () => {
    try {
      await onGoogleSignOut();
      setSyncStatusMsg('Signed out of Supabase.');
      setTimeout(() => setSyncStatusMsg(''), 2500);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const handleTriggerManualSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Syncing all sessions & trees to Supabase...');
    try {
      const res = await onManualSync();
      setSyncStatusMsg(res.message);
    } catch (err: any) {
      setSyncStatusMsg(err?.message || 'Sync failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(''), 4000);
    }
  };

  if (!isOpen) return null;

  const isKeyConfigured = !!apiKeyInput.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn select-none">
      <div
        id="settings-account-modal"
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
              <Key className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-zinc-100">
                Engine & Cloud Settings
              </h2>
              <p className="text-xs text-zinc-400">
                Google AI Studio ({GEMINI_MODEL}) and native Supabase PostgreSQL synchronization
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: GOOGLE AI STUDIO API KEY */}
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Key className="w-4 h-4 text-violet-400" />
                    Google AI Studio API Key
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-violet-950/80 text-violet-300 border border-violet-800/50 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-violet-400" />
                    {GEMINI_MODEL}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Roleplays are powered directly by Google's native Gen AI SDK. When connected,
                  your API key is automatically synced across all your devices via Supabase.
                </p>
              </div>

              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-violet-300 hover:text-violet-200 bg-violet-950/50 hover:bg-violet-900/50 rounded-lg border border-violet-800/40 transition-colors"
                title="Open Google AI Studio to generate or copy an API key"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Missing Key Warning Banner if triggered */}
            {apiKeyAlert && !isKeyConfigured && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs animate-fadeIn">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold">{apiKeyAlert}</p>
                  <p className="text-[11px] text-amber-300/80">
                    Paste your API key below and click "Save & Sync" to start generating roleplay responses.
                  </p>
                </div>
              </div>
            )}

            {/* Key Input Box */}
            <div className="space-y-2">
              <label
                htmlFor="input-gemini-api-key"
                className="text-xs font-medium text-zinc-300 flex items-center justify-between"
              >
                <span>API Key</span>
                {isKeyConfigured ? (
                  isConnected ? (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                      <Cloud className="w-3 h-3" />
                      Synced across devices (Supabase)
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-300/90 flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      Saved locally (Sign in below to sync)
                    </span>
                  )
                ) : (
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Not configured
                  </span>
                )}
              </label>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    id="input-gemini-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter your AI Studio API key (e.g. AIzaSy...)"
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-violet-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono pr-10 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1 rounded-md transition-colors cursor-pointer"
                    title={showApiKey ? 'Hide key' : 'Show key'}
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <button
                  id="btn-save-api-key"
                  type="button"
                  onClick={handleSaveApiKey}
                  disabled={isSavingKey}
                  className="px-3.5 py-2 text-xs font-medium rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white transition-all cursor-pointer shadow-sm flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                  title={
                    isConnected
                      ? 'Save API Key locally and sync across devices via Supabase'
                      : 'Save API Key locally'
                  }
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingKey ? 'Saving...' : 'Save & Sync'}</span>
                </button>

                {apiKeyInput && (
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="px-2.5 py-2 text-xs font-medium rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                    title="Remove API Key"
                  >
                    Clear
                  </button>
                )}
              </div>

              {keySavedMessage && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 animate-fadeIn pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{keySavedMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: GOOGLE AI STUDIO GENERATION PARAMETERS */}
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-violet-400" />
                    AI Studio Generation Parameters
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                    Gemma 4 Optimized
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Calibrated for Gemma roleplay in Google AI Studio. Changes persist locally and sync across devices via your Google account.
                </p>
              </div>

              <button
                type="button"
                id="btn-reset-generation-defaults"
                onClick={handleResetGenConfig}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                title="Reset to recommended Gemma 4 defaults"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>
            </div>

            <div className="space-y-4 pt-1">
              {/* Thinking Level (Minimal or High - No Off) */}
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-semibold text-zinc-200">Thinking level</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {genConfig.thinkingLevel === 'high' ? 'High' : 'Minimal (Default)'}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  Controls the internal reasoning level in Google AI Studio. Gemma supports <strong>Minimal</strong> or <strong>High</strong> (there is no off).
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    id="btn-thinking-level-minimal"
                    onClick={() => handleUpdateGenConfig({ thinkingLevel: 'minimal' })}
                    className={`px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                      genConfig.thinkingLevel !== 'high'
                        ? 'bg-violet-950/60 border-violet-500 text-violet-100 ring-1 ring-violet-500/50 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Minimal</span>
                      {genConfig.thinkingLevel !== 'high' && (
                        <span className="text-[10px] text-violet-400 font-mono font-medium">Default</span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 leading-tight">
                      Best for character dialogue & storytelling
                    </span>
                  </button>

                  <button
                    type="button"
                    id="btn-thinking-level-high"
                    onClick={() => handleUpdateGenConfig({ thinkingLevel: 'high' })}
                    className={`px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                      genConfig.thinkingLevel === 'high'
                        ? 'bg-violet-950/60 border-violet-500 text-violet-100 ring-1 ring-violet-500/50 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">High</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 leading-tight">
                      For Game Master, inventory & deep mechanics
                    </span>
                  </button>
                </div>
              </div>

              {/* Temperature Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                    <span>Temperature</span>
                  </span>
                  <span className="font-mono text-violet-400 font-semibold">
                    {genConfig.temperature.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Official baseline is 1.0, but 0.85–0.90 provides the ideal balance between rich prose and narrative coherence.
                </p>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.01"
                  value={genConfig.temperature}
                  onChange={(e) =>
                    handleUpdateGenConfig({ temperature: parseFloat(e.target.value) })
                  }
                  className="w-full accent-violet-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>0.00</span>
                  <span className="text-violet-400 font-medium">0.90 (Default)</span>
                  <span>2.00</span>
                </div>
              </div>

              {/* Top-P Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                    <span>Top-P (Nucleus Sampling)</span>
                  </span>
                  <span className="font-mono text-violet-400 font-semibold">
                    {genConfig.topP.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Official recommended nucleus cutoff for token probabilities.
                </p>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.01"
                  value={genConfig.topP}
                  onChange={(e) =>
                    handleUpdateGenConfig({ topP: parseFloat(e.target.value) })
                  }
                  className="w-full accent-violet-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>0.00</span>
                  <span className="text-violet-400 font-medium">0.95 (Default)</span>
                  <span>1.00</span>
                </div>
              </div>

              {/* Top-K Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                    <span>Top-K</span>
                  </span>
                  <span className="font-mono text-violet-400 font-semibold">
                    {genConfig.topK ?? 64}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Filters the extreme tail of Gemma’s 262,144-token vocabulary; set to 0 only if relying solely on Min-P.
                </p>
                <input
                  type="range"
                  min="0"
                  max="128"
                  step="1"
                  value={genConfig.topK ?? 64}
                  onChange={(e) =>
                    handleUpdateGenConfig({ topK: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-violet-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>0</span>
                  <span className="text-violet-400 font-medium">64 (Default)</span>
                  <span>128</span>
                </div>
              </div>

              {/* Min-P Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                    <span>Min-P</span>
                  </span>
                  <span className="font-mono text-violet-400 font-semibold">
                    {(genConfig.minP ?? 0.05).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Dynamically eliminates low-probability noise; values above 0.10 cause severe token merging and word-fusion glitches.
                </p>
                <input
                  type="range"
                  min="0.00"
                  max="0.30"
                  step="0.01"
                  value={genConfig.minP ?? 0.05}
                  onChange={(e) =>
                    handleUpdateGenConfig({ minP: parseFloat(e.target.value) })
                  }
                  className="w-full accent-violet-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>0.00</span>
                  <span className="text-violet-400 font-medium">0.05 (Default)</span>
                  <span>0.30</span>
                </div>
              </div>

              {/* Repetition Penalty Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                    <span>Repetition Penalty</span>
                  </span>
                  <span className="font-mono text-violet-400 font-semibold">
                    {(genConfig.repetitionPenalty ?? 1.00).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  1.00 = Disabled; standard logit penalties heavily distort sentence grammar and character voice on Gemma 4.
                </p>
                <input
                  type="range"
                  min="1.00"
                  max="2.00"
                  step="0.05"
                  value={genConfig.repetitionPenalty ?? 1.00}
                  onChange={(e) =>
                    handleUpdateGenConfig({ repetitionPenalty: parseFloat(e.target.value) })
                  }
                  className="w-full accent-violet-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span className="text-violet-400 font-medium">1.00 (Disabled)</span>
                  <span>1.50</span>
                  <span>2.00</span>
                </div>
              </div>

              {/* Frequency Penalty Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                    <span>Frequency Penalty</span>
                  </span>
                  <span className="font-mono text-violet-400 font-semibold">
                    {(genConfig.frequencyPenalty ?? 0.00).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Leave at 0; positive values punish character names, pronouns, and established lore.
                </p>
                <input
                  type="range"
                  min="0.00"
                  max="2.00"
                  step="0.05"
                  value={genConfig.frequencyPenalty ?? 0.00}
                  onChange={(e) =>
                    handleUpdateGenConfig({ frequencyPenalty: parseFloat(e.target.value) })
                  }
                  className="w-full accent-violet-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span className="text-violet-400 font-medium">0.00 (Default)</span>
                  <span>1.00</span>
                  <span>2.00</span>
                </div>
              </div>

              {/* Presence Penalty Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                    <span>Presence Penalty</span>
                  </span>
                  <span className="font-mono text-violet-400 font-semibold">
                    {(genConfig.presencePenalty ?? 0.00).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Leave at 0; values above 0 trigger erratic scene jumps and premature topic changes.
                </p>
                <input
                  type="range"
                  min="0.00"
                  max="2.00"
                  step="0.05"
                  value={genConfig.presencePenalty ?? 0.00}
                  onChange={(e) =>
                    handleUpdateGenConfig({ presencePenalty: parseFloat(e.target.value) })
                  }
                  className="w-full accent-violet-500 bg-zinc-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span className="text-violet-400 font-medium">0.00 (Default)</span>
                  <span>1.00</span>
                  <span>2.00</span>
                </div>
              </div>

              {/* Max Output Tokens Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                    <span>Max Output Tokens</span>
                    <span className="text-[11px] text-zinc-500 font-normal">
                      (Prevents truncation mid-reply)
                    </span>
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {genConfig.maxOutputTokens} tokens
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[2048, 4096, 8192].map((tokens) => (
                    <button
                      key={tokens}
                      type="button"
                      onClick={() => handleUpdateGenConfig({ maxOutputTokens: tokens })}
                      className={`py-2 px-3 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                        genConfig.maxOutputTokens === tokens
                          ? 'bg-violet-950/60 border-violet-500 text-violet-200 shadow-sm'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      {tokens} tokens
                      {tokens === 8192 && (
                        <span className="block text-[9px] text-emerald-400 font-sans font-medium">
                          Full AI Studio
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Helpful Typing Correction Assistant */}
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SpellCheck className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-zinc-200">Typing Correction Assistant</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Non-intrusive
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Discreetly points out misspelled words as you type with one-click fixes. It never changes your text automatically until you click Fix.
                  </p>
                </div>
                <button
                  type="button"
                  id="btn-settings-toggle-spellcheck"
                  onClick={handleToggleSpellCheck}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 ${
                    spellCheckEnabled
                      ? 'bg-violet-950/80 border-violet-500 text-violet-200 shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <SpellCheck className={`w-3.5 h-3.5 ${spellCheckEnabled ? 'text-amber-400' : 'text-zinc-600'}`} />
                  <span>{spellCheckEnabled ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: SUPABASE AUTH & REALTIME CLOUD SYNC */}
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-emerald-400" />
                    Supabase Cloud & Realtime Sync
                  </h3>
                  {isConnected ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Supabase Realtime Live
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Local Offline
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  Cross-device PostgreSQL sync for PC & Android. Sessions, conversation tree branches,
                  and persona presets synchronize automatically in real-time.
                </p>
              </div>
            </div>

            {/* Auth Status Card */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {cloudConfig.userPhoto ? (
                    <img
                      src={cloudConfig.userPhoto}
                      alt={cloudConfig.userName || 'User'}
                      className="w-10 h-10 rounded-full border border-zinc-700 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-semibold text-sm">
                      {cloudConfig.userName
                        ? cloudConfig.userName.slice(0, 2).toUpperCase()
                        : cloudConfig.userEmail
                        ? cloudConfig.userEmail.slice(0, 2).toUpperCase()
                        : isConnected
                        ? 'U'
                        : 'G'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium text-zinc-200">
                        {cloudConfig.userName ||
                          (isConnected
                            ? cloudConfig.authProvider === 'anonymous'
                              ? 'Guest User'
                              : 'Supabase User'
                            : 'Guest / Not Signed In')}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isConnected ? 'bg-emerald-500' : 'bg-zinc-600'
                        }`}
                      />
                      {cloudConfig.authProvider && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 capitalize font-mono">
                          {cloudConfig.authProvider}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {cloudConfig.userEmail || (isConnected ? 'Anonymous Supabase Session' : 'Local browser storage active')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions when Connected */}
                {isConnected && (
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-supabase-sync-now"
                      onClick={handleTriggerManualSync}
                      disabled={isSyncing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                      title="Force a complete sync of all sessions and presets to Supabase"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync to Cloud'}</span>
                    </button>

                    <button
                      id="btn-supabase-signout"
                      onClick={handleSignOutClick}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* User ID display when authenticated */}
              {isConnected && cloudConfig.userId && (
                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span>Supabase User ID:</span>
                  <span className="text-zinc-400 select-all truncate max-w-[280px] sm:max-w-md">
                    {cloudConfig.userId}
                  </span>
                </div>
              )}

              {/* Login Options when NOT connected */}
              {!isConnected && (
                <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Google Sign In */}
                    <button
                      id="btn-google-oauth-signin"
                      onClick={handleGoogleAuthClick}
                      disabled={isSigningInGoogle}
                      className="flex-1 min-w-[180px] flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 transition-all cursor-pointer shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>{isSigningInGoogle ? 'Connecting...' : 'Sign in with Google'}</span>
                    </button>

                    {/* Anonymous Guest Sign In */}
                    <button
                      id="btn-anonymous-signin"
                      onClick={handleAnonymousAuthClick}
                      disabled={isSigningInAnon}
                      className="flex-1 min-w-[150px] flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
                      title="Continue as anonymous guest with cloud database backing"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isSigningInAnon ? 'Connecting...' : 'Continue as Guest'}</span>
                    </button>

                    {/* Toggle Email Form Button */}
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(!showEmailForm)}
                      className="px-3 py-2 text-xs font-medium rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-750 transition-colors cursor-pointer"
                    >
                      {showEmailForm ? 'Hide Email' : 'Email / Password'}
                    </button>
                  </div>

                  {/* Expandable Email/Password Form */}
                  {showEmailForm && (
                    <form
                      onSubmit={handleEmailAuthSubmit}
                      className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2.5 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
                        <span>{isEmailSignUp ? 'Create Supabase Account' : 'Sign in with Email'}</span>
                        <button
                          type="button"
                          onClick={() => setIsEmailSignUp(!isEmailSignUp)}
                          className="text-violet-400 hover:text-violet-300 underline text-[11px] cursor-pointer"
                        >
                          {isEmailSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          id="input-supabase-email"
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="Email address"
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                        />
                        <input
                          id="input-supabase-password"
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Password (min. 6 characters)"
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <button
                          type="submit"
                          disabled={isSigningInEmail}
                          className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          {isSigningInEmail
                            ? 'Please wait...'
                            : isEmailSignUp
                            ? 'Register & Sign In'
                            : 'Sign In'}
                        </button>
                        {!isEmailSignUp && (
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={isSendingReset}
                            className="px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                          >
                            {isSendingReset ? 'Sending...' : 'Forgot Password?'}
                          </button>
                        )}
                      </div>

                      {/* Inline feedback inside the email form */}
                      {authError && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span className="leading-snug">{authError}</span>
                        </div>
                      )}
                      {syncStatusMsg && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                          <span className="leading-snug">{syncStatusMsg}</span>
                        </div>
                      )}
                    </form>
                  )}

                  {/* Quick-complete when OAuth redirected to localhost */}
                  <form
                    onSubmit={handleCompleteWithUrl}
                    className="p-3 rounded-xl bg-zinc-900/80 border border-violet-800/40 space-y-2"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-violet-300">
                      <LinkIcon className="w-3.5 h-3.5 text-violet-400" />
                      <span>Got a redirect error on localhost?</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      If your Google login landed on <code className="text-violet-300 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">localhost:3000/#access_token=...</code>, copy the full URL from that window's address bar and paste it below:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={callbackUrlInput}
                        onChange={(e) => setCallbackUrlInput(e.target.value)}
                        placeholder="Paste http://localhost:3000/#access_token=..."
                        className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={!callbackUrlInput.trim() || isSubmittingUrl}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {isSubmittingUrl ? 'Signing in...' : 'Sign In'}
                      </button>
                    </div>
                  </form>

                  {/* Informational tip */}
                  <p className="text-[11px] text-zinc-500 leading-relaxed px-1">
                    <span className="text-emerald-400 font-medium">Ready now:</span> Email & Password sign-up and sign-in is enabled on this project. To use Google OAuth or Guest login, toggle them on in your{' '}
                    <span className="text-zinc-400">Supabase Dashboard &rarr; Authentication &rarr; Providers</span>.
                  </p>
                </div>
              )}
            </div>

            {/* Status messages */}
            {authError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {syncStatusMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{syncStatusMsg}</span>
              </div>
            )}

            {/* Cloud Details Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-[11px] font-medium text-zinc-300">
                    Supabase PostgreSQL DB
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    Tables: sessions, presets, settings
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex items-center gap-2.5">
                <GitBranch className="w-4 h-4 text-violet-400" />
                <div>
                  <div className="text-[11px] font-medium text-zinc-300">
                    Local Sessions Cached
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} ready
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-750 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
