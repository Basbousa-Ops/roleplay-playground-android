/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CharacterProfile,
  ConversationNode,
  RoleplaySession,
  StickyPresets,
  UserPersona,
  TokenUsage,
  CloudSyncConfig,
  RoleplayGenerationConfig,
} from './types';
import {
  loadAllSessions,
  saveAllSessions,
  loadActiveSessionId,
  saveActiveSessionId,
  loadStickyPresets,
  saveStickyPresets,
  createSessionFromCharacter,
  STARTER_CHARACTERS,
} from './lib/storage';
import {
  getActiveTimeline,
  switchBranch,
  appendChildNode,
  updateNodeContent,
  removeLeafNode,
} from './lib/tree';
import {
  streamGeminiChat,
  hasApiKey,
  getStoredApiKey,
  saveStoredApiKey,
  getStoredGenerationConfig,
  saveStoredGenerationConfig,
  GEMINI_MODEL,
} from './lib/gemini';
import {
  testConnection,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signInAnonymously,
  signOutUser,
  getCurrentUser,
  onAuthStateChange,
  setSessionFromUrl,
} from './lib/supabase';
import {
  syncSingleSessionToSupabase,
  deleteSessionFromSupabase,
  fetchUserSessionsFromSupabase,
  syncPresetsToSupabase,
  fetchPresetsFromSupabase,
  syncApiKeyToSupabase,
  fetchApiKeyFromSupabase,
  deleteApiKeyFromSupabase,
  syncGenerationConfigToSupabase,
  fetchGenerationConfigFromSupabase,
  syncAllToSupabase,
  subscribeToSessionsChanges,
} from './lib/supabaseSync';
import { Header } from './components/Header';
import { DialogueViewport } from './components/DialogueViewport';
import { ChatInput } from './components/ChatInput';
import { CharacterModal } from './components/CharacterModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { SettingsModal } from './components/SettingsModal';
import { EditMessageModal } from './components/EditMessageModal';
import { ImportRoleplayModal } from './components/ImportRoleplayModal';
import { ANDROID_AUTH_CALLBACK } from './lib/capacitor';

// Applies native-only UI polish (status bar, keyboard) without touching web.
async function initNativeShell(): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      await StatusBar.setBackgroundColor({ color: '#09090b' }).catch(() => {});
    } catch {}
    try {
      const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
      await Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => {});
    } catch {}
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide().catch(() => {});
    } catch {}
  } catch {}
}

export default function App() {
  // Persistence state
  const [sessions, setSessions] = useState<RoleplaySession[]>(() => loadAllSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const savedId = loadActiveSessionId();
    const all = loadAllSessions();
    if (savedId && all.some((s) => s.id === savedId)) {
      return savedId;
    }
    return all[0]?.id || '';
  });

  const [stickyPresets, setStickyPresets] = useState<StickyPresets>(() => loadStickyPresets());
  const [cloudConfig, setCloudConfig] = useState<CloudSyncConfig>({
    isConnected: false,
    isGoogleConnected: false,
    syncStatus: 'idle',
  });

  // Roleplay Generation Hyperparameters (synced across sessions and Supabase)
  const [genConfig, setGenConfig] = useState<RoleplayGenerationConfig>(() =>
    getStoredGenerationConfig()
  );

  const handleCycleThinkingLevel = () => {
    setGenConfig((prev) => {
      const nextLevel = prev.thinkingLevel === 'high' ? 'minimal' : 'high';
      const updated: RoleplayGenerationConfig = { ...prev, thinkingLevel: nextLevel };
      saveStoredGenerationConfig(updated);
      if ((cloudConfig.isConnected || cloudConfig.isGoogleConnected) && cloudConfig.userId) {
        syncGenerationConfigToSupabase(cloudConfig.userId, updated).catch((err) =>
          console.warn('Failed to sync thinking level to Supabase:', err)
        );
      }
      return updated;
    });
  };

  // Active session helper
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  // Active timeline (root to leaf)
  const activeTimeline = useMemo(() => {
    if (!activeSession) return [];
    return getActiveTimeline(activeSession);
  }, [activeSession]);

  // Streaming & Generation State
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingNodeId, setStreamingNodeId] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<{
    message: string;
    retryUserNodeId?: string;
    retryContinueNodeId?: string;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Modals & Drawers
  const [isNewRPModalOpen, setIsNewRPModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeyAlert, setApiKeyAlert] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<ConversationNode | null>(null);

  // Auto-save sessions to local storage
  useEffect(() => {
    if (sessions.length > 0) {
      saveAllSessions(sessions);
    }
  }, [sessions]);

  // Auto-save active session ID
  useEffect(() => {
    if (activeSessionId) {
      saveActiveSessionId(activeSessionId);
    }
  }, [activeSessionId]);

  // Verify Supabase connection & handle native Supabase Auth state & Realtime subscriptions
  useEffect(() => {
    testConnection();
    initNativeShell();

    // Android deep-link OAuth callback:
    // com.roleplay.playground://auth-callback#access_token=...&refresh_token=...
    let removeAppUrlListener: (() => void) | null = null;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { App: CapApp } = await import('@capacitor/app');
        const listener = await CapApp.addListener('appUrlOpen', (event: { url: string }) => {
          try {
            if (event?.url && event.url.startsWith(ANDROID_AUTH_CALLBACK)) {
              setSessionFromUrl(event.url).then(({ error, user }) => {
                if (!error && user) {
                  setupAuthAndSync(user);
                }
              });
            }
          } catch (e) {
            console.warn('Deep-link auth handling failed:', e);
          }
        });
        removeAppUrlListener = () => listener.remove();
      } catch (e) {
        console.warn('App URL listener unavailable (web build):', e);
      }
    })();

    let realtimeCleanup: (() => void) | null = null;
    let currentSyncedUserId: string | null = null;
    let isSyncing = false;

    const setupAuthAndSync = async (user: any) => {
      if (user) {
        // If already actively syncing or already subscribed to the same user, avoid re-attaching listeners
        if (isSyncing) return;
        if (currentSyncedUserId === user.id && realtimeCleanup) {
          return;
        }

        isSyncing = true;
        currentSyncedUserId = user.id;

        const isGoogle = user.app_metadata?.provider === 'google';
        const provider = (isGoogle ? 'google' : user.is_anonymous ? 'anonymous' : 'email') as
          | 'google'
          | 'email'
          | 'anonymous';

        setCloudConfig({
          isConnected: true,
          isGoogleConnected: isGoogle,
          authProvider: provider,
          userId: user.id,
          userEmail: user.email || undefined,
          userName:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            (user.is_anonymous ? 'Guest User' : user.email?.split('@')[0]) ||
            undefined,
          userPhoto: user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
          syncStatus: 'syncing',
          isRealtimeActive: true,
        });

        try {
          // Teardown any existing realtime subscription before re-creating
          if (realtimeCleanup) {
            try {
              realtimeCleanup();
            } catch (cleanErr) {
              console.warn('Realtime cleanup warning:', cleanErr);
            }
            realtimeCleanup = null;
          }

          // 1. Sync & fetch remote presets
          const remotePresets = await fetchPresetsFromSupabase(user.id);
          if (remotePresets) {
            setStickyPresets(remotePresets);
            saveStickyPresets(remotePresets);
          } else {
            await syncPresetsToSupabase(user.id, stickyPresets);
          }

          // 2. Sync & fetch remote sessions
          const remoteSessions = await fetchUserSessionsFromSupabase(user.id);
          if (remoteSessions.length > 0) {
            setSessions((localSessions) => {
              const map = new Map<string, RoleplaySession>();
              for (const s of localSessions) {
                map.set(s.id, s);
              }
              for (const s of remoteSessions) {
                const existing = map.get(s.id);
                if (!existing || (s.updatedAt || 0) >= (existing.updatedAt || 0)) {
                  map.set(s.id, s);
                }
              }
              const merged = Array.from(map.values()).sort(
                (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
              );
              saveAllSessions(merged);
              return merged;
            });
          } else {
            // Seed Supabase with local sessions, presets, API key, and generation config
            await syncAllToSupabase(
              user.id,
              sessions,
              stickyPresets,
              getStoredApiKey(),
              getStoredGenerationConfig()
            );
          }

          // 3. Sync & fetch remote API key for cross-device persistence
          try {
            const remoteApiKey = await fetchApiKeyFromSupabase(user.id);
            const localApiKey = getStoredApiKey();

            if (remoteApiKey && remoteApiKey.trim()) {
              saveStoredApiKey(remoteApiKey);
            } else if (localApiKey && localApiKey.trim()) {
              await syncApiKeyToSupabase(user.id, localApiKey);
            }
          } catch (keyErr) {
            console.warn('Could not sync API key with Supabase:', keyErr);
          }

          // 4. Sync & fetch remote generation parameters for cross-device persistence
          try {
            const remoteGenConfig = await fetchGenerationConfigFromSupabase(user.id);
            if (remoteGenConfig) {
              saveStoredGenerationConfig(remoteGenConfig);
              setGenConfig(remoteGenConfig);
            } else {
              const localGenConfig = getStoredGenerationConfig();
              await syncGenerationConfigToSupabase(user.id, localGenConfig);
            }
          } catch (genErr) {
            console.warn('Could not sync generation parameters with Supabase:', genErr);
          }

          setCloudConfig((prev) => ({
            ...prev,
            syncStatus: 'synced',
            lastSyncedAt: Date.now(),
          }));

          // 5. Establish Realtime Postgres Changes Subscription on sessions table
          realtimeCleanup = subscribeToSessionsChanges(
            user.id,
            (incomingSession) => {
              setSessions((currentSessions) => {
                const index = currentSessions.findIndex((s) => s.id === incomingSession.id);
                if (index >= 0) {
                  const existing = currentSessions[index];
                  // If incoming is same or newer, update local state
                  if ((incomingSession.updatedAt || 0) >= (existing.updatedAt || 0)) {
                    const updatedList = [...currentSessions];
                    updatedList[index] = incomingSession;
                    saveAllSessions(updatedList);
                    return updatedList;
                  }
                  return currentSessions;
                } else {
                  const updatedList = [incomingSession, ...currentSessions];
                  saveAllSessions(updatedList);
                  return updatedList;
                }
              });
            },
            (deletedSessionId) => {
              setSessions((currentSessions) => {
                const updatedList = currentSessions.filter((s) => s.id !== deletedSessionId);
                saveAllSessions(updatedList);
                return updatedList;
              });
            }
          );
        } catch (err) {
          console.error('Error during initial Supabase synchronization:', err);
          setCloudConfig((prev) => ({
            ...prev,
            syncStatus: 'error',
            errorMessage: err instanceof Error ? err.message : String(err),
          }));
        } finally {
          isSyncing = false;
        }
      } else {
        currentSyncedUserId = null;
        if (realtimeCleanup) {
          try {
            realtimeCleanup();
          } catch {}
          realtimeCleanup = null;
        }
        setCloudConfig({
          isConnected: false,
          isGoogleConnected: false,
          syncStatus: 'idle',
          isRealtimeActive: false,
        });
      }
    };

    // Detect if the window loaded with an access_token in the URL hash
    if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
      setSessionFromUrl(window.location.hash).then(({ error, user }) => {
        if (!error && user) {
          setupAuthAndSync(user);
          try {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch {}
        }
      });
    }

    getCurrentUser().then((user) => {
      if (user) {
        setupAuthAndSync(user);
      }
    });

    const { data: authListener } = onAuthStateChange((_event, session) => {
      setupAuthAndSync(session?.user ?? null);
    });

    const handleWindowFocus = () => {
      getCurrentUser().then((user) => {
        if (user) {
          setupAuthAndSync(user);
        }
      });
    };
    window.addEventListener('focus', handleWindowFocus);

    // Listen for postMessage from OAuth popup when authentication completes
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SUPABASE_AUTH_CALLBACK') {
        const hash = event.data.hash || event.data.search || event.data.fullUrl;
        if (hash) {
          setSessionFromUrl(hash).then(({ error, user }) => {
            if (!error && user) {
              setupAuthAndSync(user);
            }
          });
        }
      }
    };
    window.addEventListener('message', handleAuthMessage);

    return () => {
      authListener?.subscription.unsubscribe();
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('message', handleAuthMessage);
      if (removeAppUrlListener) {
        try {
          removeAppUrlListener();
        } catch {}
      }
      if (realtimeCleanup) {
        realtimeCleanup();
      }
    };
  }, []);

  // Helper to sync single session to Supabase when logged in
  const syncSessionIfConnected = (sessionToSync: RoleplaySession) => {
    if ((cloudConfig.isConnected || cloudConfig.isGoogleConnected) && cloudConfig.userId) {
      syncSingleSessionToSupabase(cloudConfig.userId, sessionToSync).catch((err) => {
        console.warn('Background Supabase session sync failed:', err);
      });
    }
  };

  // Switch Active Session
  const handleSelectSession = (id: string) => {
    if (isStreaming) {
      handleStopGeneration();
    }
    setGenerationError(null);
    setRetryNotice(null);
    setActiveSessionId(id);
  };

  // Helper to update active session in state
  const updateActiveSession = (newSession: RoleplaySession) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === newSession.id ? newSession : s))
    );
  };

  // Switch branch (< n / m >)
  const handleSwitchBranch = (nodeId: string, direction: 'prev' | 'next') => {
    if (!activeSession || isStreaming) return;
    const updated = switchBranch(activeSession, nodeId, direction);
    updateActiveSession(updated);
    syncSessionIfConnected(updated);
  };

  // Trigger stream completion for a given user node
  const triggerCompletion = async (
    currentSession: RoleplaySession,
    userNodeId: string
  ) => {
    if (!hasApiKey()) {
      setApiKeyAlert(`A Google AI Studio API Key is required to chat with ${GEMINI_MODEL}. Please enter your key below.`);
      setIsSettingsOpen(true);
      return;
    }

    // 1. Create a child assistant node under userNode
    const { session: sessionWithAssistant, newNodeId: assistantNodeId } = appendChildNode(
      currentSession,
      userNodeId,
      'assistant',
      ''
    );

    updateActiveSession(sessionWithAssistant);
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingNodeId(assistantNodeId);
    setRetryNotice(null);
    setGenerationError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 2. Build active timeline up to this point (excluding empty streaming node)
    const currentTimeline = getActiveTimeline(sessionWithAssistant);
    const historyUpToAssistant = currentTimeline.filter((n) => n.id !== assistantNodeId);

    let accumulatedText = '';

    await streamGeminiChat({
      session: sessionWithAssistant,
      activeTimeline: historyUpToAssistant,
      generationConfig: genConfig,
      signal: abortController.signal,
      onToken: (_token, accumulated) => {
        accumulatedText = accumulated;
        setStreamingContent(accumulated);
        setRetryNotice(null);
      },
      onRetry: (_attempt, _max, _delayMs, reason) => {
        setRetryNotice(reason);
      },
      onDone: (fullText, verifiedUsage) => {
        const finalContent = fullText || accumulatedText;
        const finalizedSession = updateNodeContent(
          sessionWithAssistant,
          assistantNodeId,
          finalContent,
          verifiedUsage
        );
        updateActiveSession(finalizedSession);
        syncSessionIfConnected(finalizedSession);
        setIsStreaming(false);
        setStreamingContent('');
        setStreamingNodeId(null);
        setRetryNotice(null);
        abortControllerRef.current = null;
      },
      onError: (err) => {
        console.error('Gemma streaming error:', err);
        // Remove the empty placeholder instead of baking the error text into
        // the chat tree (it would otherwise pollute all future requests).
        const cleanedSession = removeLeafNode(sessionWithAssistant, assistantNodeId);
        updateActiveSession(cleanedSession);
        syncSessionIfConnected(cleanedSession);
        setGenerationError({ message: err.message, retryUserNodeId: userNodeId });
        setIsStreaming(false);
        setStreamingContent('');
        setStreamingNodeId(null);
        setRetryNotice(null);
        abortControllerRef.current = null;
      },
    });
  };

  // Retry a failed generation from the error banner (chat tree is untouched).
  const handleRetryFailed = async () => {
    if (!activeSession || !generationError || isStreaming) return;
    const failed = generationError;
    setGenerationError(null);
    if (failed.retryUserNodeId) {
      if (!activeSession.nodes[failed.retryUserNodeId]) return;
      await triggerCompletion(activeSession, failed.retryUserNodeId);
    } else if (failed.retryContinueNodeId) {
      await handleContinueResponse(failed.retryContinueNodeId);
    }
  };

  // Send new message
  const handleSendMessage = async () => {
    if (!input.trim() || !activeSession || isStreaming) return;

    if (!hasApiKey()) {
      setApiKeyAlert(`A Google AI Studio API Key is required to chat with ${GEMINI_MODEL}. Please enter your key below.`);
      setIsSettingsOpen(true);
      return;
    }

    const userText = input.trim();
    setInput('');
    setGenerationError(null);

    // Append user node under the current active leaf
    const parentId = activeSession.activeLeafId;
    const { session: updatedSession, newNodeId: userNodeId } = appendChildNode(
      activeSession,
      parentId,
      'user',
      userText
    );

    updateActiveSession(updatedSession);
    syncSessionIfConnected(updatedSession);
    await triggerCompletion(updatedSession, userNodeId);
  };

  // Regenerate assistant message (creates an alternate sibling branch)
  const handleRegenerate = async (assistantNodeId: string) => {
    if (!activeSession || isStreaming) return;

    if (!hasApiKey()) {
      setApiKeyAlert(`A Google AI Studio API Key is required to regenerate responses with ${GEMINI_MODEL}. Please enter your key below.`);
      setIsSettingsOpen(true);
      return;
    }

    const assistantNode = activeSession.nodes[assistantNodeId];
    if (!assistantNode || !assistantNode.parentId) return;

    const parentUserNodeId = assistantNode.parentId;
    await triggerCompletion(activeSession, parentUserNodeId);
  };

  // Continue assistant message seamlessly from where it stopped
  const handleContinueResponse = async (assistantNodeId: string) => {
    if (!activeSession || isStreaming) return;

    if (!hasApiKey()) {
      setApiKeyAlert(
        `A Google AI Studio API Key is required to continue responses with ${GEMINI_MODEL}. Please enter your key below.`
      );
      setIsSettingsOpen(true);
      return;
    }

    const assistantNode = activeSession.nodes[assistantNodeId];
    if (!assistantNode || assistantNode.role !== 'assistant') return;

    const existingText = assistantNode.content;
    setIsStreaming(true);
    setStreamingNodeId(assistantNodeId);
    setStreamingContent(existingText);
    setRetryNotice(null);
    setGenerationError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentTimeline = getActiveTimeline(activeSession);
    let streamedAddition = '';

    await streamGeminiChat({
      session: activeSession,
      activeTimeline: currentTimeline,
      generationConfig: genConfig,
      isContinuation: true,
      continuationTargetNodeId: assistantNodeId,
      signal: abortController.signal,
      onToken: (_token, accumulated) => {
        streamedAddition = accumulated;
        const separator =
          existingText && !existingText.endsWith(' ') && !existingText.endsWith('\n')
            ? ' '
            : '';
        setStreamingContent(existingText + separator + accumulated);
        setRetryNotice(null);
      },
      onRetry: (_attempt, _max, _delayMs, reason) => {
        setRetryNotice(reason);
      },
      onDone: (fullText, verifiedUsage) => {
        const addition = fullText || streamedAddition;
        const separator =
          existingText && !existingText.endsWith(' ') && !existingText.endsWith('\n')
            ? ' '
            : '';
        const combined = existingText + separator + addition.trimStart();

        const finalizedSession = updateNodeContent(
          activeSession,
          assistantNodeId,
          combined,
          verifiedUsage
        );
        updateActiveSession(finalizedSession);
        syncSessionIfConnected(finalizedSession);
        setIsStreaming(false);
        setStreamingContent('');
        setStreamingNodeId(null);
        setRetryNotice(null);
        abortControllerRef.current = null;
      },
      onError: (err) => {
        console.error('Gemma continuation error:', err);
        // Original message is untouched (partial text was never written).
        setGenerationError({ message: err.message, retryContinueNodeId: assistantNodeId });
        setIsStreaming(false);
        setStreamingContent('');
        setStreamingNodeId(null);
        setRetryNotice(null);
        abortControllerRef.current = null;
      },
    });
  };

  // Edit message & branch
  const handleConfirmEditBranch = async (nodeId: string, newContent: string) => {
    if (!activeSession || isStreaming) return;
    const targetNode = activeSession.nodes[nodeId];
    if (!targetNode) return;

    if (targetNode.role === 'user') {
      const parentId = targetNode.parentId || activeSession.rootNodeId;
      const { session: branchedSession, newNodeId: newUserId } = appendChildNode(
        activeSession,
        parentId,
        'user',
        newContent
      );
      updateActiveSession(branchedSession);
      syncSessionIfConnected(branchedSession);
      await triggerCompletion(branchedSession, newUserId);
    } else {
      const parentId = targetNode.parentId || activeSession.rootNodeId;
      const { session: branchedSession } = appendChildNode(
        activeSession,
        parentId,
        'assistant',
        newContent
      );
      updateActiveSession(branchedSession);
      syncSessionIfConnected(branchedSession);
    }
  };

  // Edit message in-place without branching
  const handleConfirmEditInPlace = (nodeId: string, newContent: string) => {
    if (!activeSession) return;
    const updated = updateNodeContent(activeSession, nodeId, newContent);
    updateActiveSession(updated);
    syncSessionIfConnected(updated);
  };

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setRetryNotice(null);
    if (streamingNodeId && activeSession) {
      const updated = updateNodeContent(
        activeSession,
        streamingNodeId,
        streamingContent
      );
      updateActiveSession(updated);
      syncSessionIfConnected(updated);
    }
    setStreamingContent('');
    setStreamingNodeId(null);
  };

  // Create new roleplay
  const handleCreateRP = (
    character: CharacterProfile,
    userPersona: UserPersona,
    systemInstructions: string
  ) => {
    const newSession = createSessionFromCharacter(character, {
      userPersona,
      systemInstructions,
    });
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    syncSessionIfConnected(newSession);
  };

  // Sticky Presets save
  const handleSavePresets = (presets: StickyPresets) => {
    setStickyPresets(presets);
    saveStickyPresets(presets);
    if ((cloudConfig.isConnected || cloudConfig.isGoogleConnected) && cloudConfig.userId) {
      syncPresetsToSupabase(cloudConfig.userId, presets).catch((err) => {
        console.warn('Failed to sync presets to Supabase:', err);
      });
    }
  };

  // Rename session
  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, title: newTitle, updatedAt: Date.now() };
          syncSessionIfConnected(updated);
          return updated;
        }
        return s;
      })
    );
  };

  // Duplicate session
  const handleDuplicateSession = (id: string) => {
    const source = sessions.find((s) => s.id === id);
    if (!source) return;

    const newId = 'session_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    const duplicated: RoleplaySession = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      title: `${source.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSessions((prev) => [duplicated, ...prev]);
    setActiveSessionId(newId);
    syncSessionIfConnected(duplicated);
  };

  // Delete session
  const handleDeleteSession = (id: string) => {
    const remaining = sessions.filter((s) => s.id !== id);
    if ((cloudConfig.isConnected || cloudConfig.isGoogleConnected) && cloudConfig.userId) {
      deleteSessionFromSupabase(cloudConfig.userId, id).catch((err) =>
        console.warn('Failed to delete session from Supabase:', err)
      );
    }

    if (remaining.length === 0) {
      const starter = createSessionFromCharacter(STARTER_CHARACTERS[0], stickyPresets);
      setSessions([starter]);
      setActiveSessionId(starter.id);
      syncSessionIfConnected(starter);
    } else {
      setSessions(remaining);
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  // Import Backup
  const handleImportBackup = (importedSession: RoleplaySession) => {
    setSessions((prev) => [importedSession, ...prev]);
    setActiveSessionId(importedSession.id);
    syncSessionIfConnected(importedSession);
  };

  // Supabase Auth Handlers
  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) throw error;
  };

  const handleEmailSignIn = async (email: string, pass: string) => {
    const { error } = await signInWithEmail(email, pass);
    if (error) throw error;
  };

  const handleEmailSignUp = async (email: string, pass: string) => {
    const res = await signUpWithEmail(email, pass);
    if (res.error) throw res.error;
    return res;
  };

  const handleAnonymousSignIn = async () => {
    const { error } = await signInAnonymously();
    if (error) throw error;
  };

  const handleSignOut = async () => {
    const { error } = await signOutUser();
    if (error) throw error;
  };

  // Manual Bulk Sync
  const handleManualSync = async () => {
    if ((!cloudConfig.isConnected && !cloudConfig.isGoogleConnected) || !cloudConfig.userId) {
      return {
        success: false,
        message: 'Please sign in to sync your sessions to Supabase.',
      };
    }
    setCloudConfig((prev) => ({ ...prev, syncStatus: 'syncing' }));
    const result = await syncAllToSupabase(
      cloudConfig.userId,
      sessions,
      stickyPresets,
      getStoredApiKey(),
      genConfig
    );
    setCloudConfig((prev) => ({
      ...prev,
      syncStatus: result.success ? 'synced' : 'error',
      lastSyncedAt: result.success ? Date.now() : prev.lastSyncedAt,
    }));
    return result;
  };

  // Cross-device API key sync handler
  const handleSyncApiKey = async (newKey: string) => {
    if ((cloudConfig.isConnected || cloudConfig.isGoogleConnected) && cloudConfig.userId) {
      if (newKey.trim()) {
        await syncApiKeyToSupabase(cloudConfig.userId, newKey.trim());
      } else {
        await deleteApiKeyFromSupabase(cloudConfig.userId);
      }
    }
  };

  if (!activeSession) {
    return (
      <div className="flex h-dvh items-center justify-center bg-zinc-950 text-zinc-300">
        <div className="text-center space-y-4">
          <p>Initializing Roleplay Playground...</p>
          <button
            onClick={() => setIsNewRPModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium cursor-pointer"
          >
            Start New Roleplay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-[100dvh] bg-zinc-950 text-zinc-100 antialiased overflow-hidden select-text"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Top Header */}
      <Header
        character={activeSession.character}
        turnCount={activeTimeline.length}
        cloudConfig={cloudConfig}
        onOpenNewRP={() => setIsNewRPModalOpen(true)}
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Dialogue Scroll Area */}
      <DialogueViewport
        session={activeSession}
        timeline={activeTimeline}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        streamingNodeId={streamingNodeId}
        retryNotice={retryNotice}
        onSwitchBranch={handleSwitchBranch}
        onRegenerate={handleRegenerate}
        onContinue={handleContinueResponse}
        onEditMessage={(node) => setEditingNode(node)}
      />

      {/* Generation error banner (failed node was removed, chat untouched) */}
      {generationError && !isStreaming && (
        <div className="px-3 sm:px-6 pb-2 bg-zinc-950/90">
          <div className="max-w-4xl mx-auto flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs animate-fadeIn">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Generation failed</p>
              <p className="text-[11px] text-amber-300/80 mt-0.5">{generationError.message}</p>
            </div>
            <button
              type="button"
              onClick={handleRetryFailed}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer flex-shrink-0"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setGenerationError(null)}
              className="px-2 py-1.5 text-xs text-amber-300/70 hover:text-amber-200 cursor-pointer flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Bottom Chat Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSend={handleSendMessage}
        onStop={handleStopGeneration}
        onContinueLast={() => {
          const lastNode = activeTimeline[activeTimeline.length - 1];
          if (lastNode && lastNode.role === 'assistant') {
            handleContinueResponse(lastNode.id);
          }
        }}
        canContinue={
          !isStreaming &&
          activeTimeline.length > 0 &&
          activeTimeline[activeTimeline.length - 1].role === 'assistant'
        }
        isStreaming={isStreaming}
        characterName={activeSession.character.name}
        userPersonaName={activeSession?.userPersona?.name || stickyPresets.userPersona?.name}
        thinkingLevel={genConfig.thinkingLevel || 'minimal'}
        onCycleThinkingLevel={handleCycleThinkingLevel}
      />

      {/* Character Creation Modal ("New RP") */}
      <CharacterModal
        isOpen={isNewRPModalOpen}
        onClose={() => setIsNewRPModalOpen(false)}
        stickyPresets={stickyPresets}
        onSavePresets={handleSavePresets}
        onCreateRP={handleCreateRP}
        onOpenImport={() => setIsImportModalOpen(true)}
      />

      {/* Import Roleplay Modal */}
      <ImportRoleplayModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSession={handleImportBackup}
      />

      {/* History Slide-over Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onRenameSession={handleRenameSession}
        onDuplicateSession={handleDuplicateSession}
        onDeleteSession={handleDeleteSession}
        onNewRP={() => setIsNewRPModalOpen(true)}
        onImportBackup={handleImportBackup}
      />

      {/* Settings & Engine Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setApiKeyAlert(null);
          setGenConfig(getStoredGenerationConfig());
        }}
        cloudConfig={cloudConfig}
        sessions={sessions}
        stickyPresets={stickyPresets}
        apiKeyAlert={apiKeyAlert}
        onClearApiKeyAlert={() => setApiKeyAlert(null)}
        onSyncApiKey={handleSyncApiKey}
        onGoogleSignIn={handleGoogleSignIn}
        onEmailSignIn={handleEmailSignIn}
        onEmailSignUp={handleEmailSignUp}
        onAnonymousSignIn={handleAnonymousSignIn}
        onGoogleSignOut={handleSignOut}
        onManualSync={handleManualSync}
      />

      {/* Edit & Branching Modal */}
      <EditMessageModal
        isOpen={!!editingNode}
        onClose={() => setEditingNode(null)}
        node={editingNode}
        onConfirmEditBranch={handleConfirmEditBranch}
        onConfirmEditInPlace={handleConfirmEditInPlace}
      />
    </div>
  );
}
