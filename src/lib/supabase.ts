import { createClient, User, Session, AuthChangeEvent } from '@supabase/supabase-js';

// Project credentials provided by the user
function normalizeSupabaseUrl(url?: string): string {
  const fallback = 'https://cwylubxrbwcjfneaxlvh.supabase.co';
  if (!url || typeof url !== 'string') return fallback;
  let normalized = url.trim().replace(/\/+$/, '');
  // Normalize .supabase.com (which has no DNS host) to .supabase.co
  normalized = normalized.replace(/\.supabase\.com$/i, '.supabase.co');
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

export const SUPABASE_URL = normalizeSupabaseUrl(
  typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined
);

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_GQLQTNwqT8HG4vKWUkdGZg_-cdWJE6O';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type SupabaseAuthUser = User;

/**
 * Sign in using Google OAuth.
 *
 * - Web: popup flow for iframe compatibility (unchanged behavior).
 * - Android (Capacitor): system browser (Custom Tabs) + deep-link callback
 *   `com.roleplay.playground://auth-callback`, captured via App 'appUrlOpen'
 *   in App.tsx. This is the only reliable Google flow inside a WebView.
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  try {
    // ---- Native Android path: must run before any window.open logic ----
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { ANDROID_AUTH_CALLBACK } = await import('./capacitor');
        const { Browser } = await import('@capacitor/browser');

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: ANDROID_AUTH_CALLBACK,
            skipBrowserRedirect: true,
          },
        });

        if (error) {
          return { error: new Error(error.message) };
        }
        if (!data?.url) {
          return { error: new Error('Could not start Google sign-in (no OAuth URL).') };
        }

        // Open Google in the system browser; Supabase redirects back to our
        // custom scheme, which Android routes to the app (see AndroidManifest
        // intent-filter injected by scripts/cap-after-sync.cjs).
        await Browser.open({ url: data.url, windowName: '_blank' });
        return { error: null };
      }
    } catch (nativeErr) {
      // If Capacitor plugins are unavailable (plain web build), fall through
      // to the web popup flow below.
      console.warn('Native Google auth unavailable, using web flow:', nativeErr);
    }

    // Crucial: The preview runs inside an iframe (where window.location could be a sandbox or blob).
    // Always use the real cloud container origin (APP_URL) as the explicit redirect target.
    const redirectTarget =
      import.meta.env.APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-pmfbofsmyhktrvoynd2leb-53020796844.europe-west2.run.app');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTarget,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    if (data?.url) {
      // In the AI Studio iframe environment, open the OAuth provider directly in a popup
      // to avoid frame-busting (X-Frame-Options) and keep the app preview intact.
      const width = 500;
      const height = 650;
      const left = typeof window !== 'undefined' ? window.screenX + (window.outerWidth - width) / 2 : 100;
      const top = typeof window !== 'undefined' ? window.screenY + (window.outerHeight - height) / 2 : 100;
      const popup = window.open(
        data.url,
        'supabase_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
      );

      if (popup) {
        // Poll the popup window to capture the redirect URL and access_token directly
        const timer = setInterval(() => {
          try {
            if (!popup || popup.closed) {
              clearInterval(timer);
              return;
            }
            // When redirect arrives at the app origin, read the hash
            if (popup.location && popup.location.href) {
              const href = popup.location.href;
              if (href.includes('access_token=')) {
                clearInterval(timer);
                setSessionFromUrl(href).then(() => {
                  try {
                    popup.close();
                  } catch {}
                });
              }
            }
          } catch {
            // Cross-origin restriction before redirect arrives back at same-origin, ignore
          }
        }, 300);

        // Auto-clear interval after 2 minutes
        setTimeout(() => clearInterval(timer), 120000);
      } else {
        // If popup was blocked by browser, open in a new tab
        window.open(data.url, '_blank');
      }
    }

    return { error: null };
  } catch (err: any) {
    return { error: new Error(err?.message || 'Failed to initiate Google OAuth') };
  }
}

/**
 * Complete authentication by setting session from a callback URL or hash string.
 * Useful when the redirect landed on localhost (ERR_CONNECTION_REFUSED) or another tab.
 */
export async function setSessionFromUrl(urlOrHash: string): Promise<{ error: Error | null; user?: User }> {
  try {
    let hash = '';
    if (urlOrHash.includes('#')) {
      hash = urlOrHash.substring(urlOrHash.indexOf('#') + 1);
    } else if (urlOrHash.includes('?')) {
      hash = urlOrHash.substring(urlOrHash.indexOf('?') + 1);
    } else {
      hash = urlOrHash;
    }

    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token || !refresh_token) {
      return {
        error: new Error(
          'Could not find access_token and refresh_token in the URL. Please make sure to copy the entire URL from the browser address bar.'
        ),
      };
    }

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    // On Android the OAuth flow lives in a Custom Tab; close it once the
    // deep-link callback has been consumed so the user lands back in the app.
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.close().catch(() => {});
      }
    } catch {}

    return { error: null, user: data.user || undefined };
  } catch (err: any) {
    return { error: new Error(err?.message || 'Failed to parse authentication tokens') };
  }
}

/**
 * Sign in with Email and Password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: Error | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    let friendly = error.message;
    if (error.message.includes('Invalid login credentials')) {
      friendly =
        'Invalid login credentials. Please double-check your password, or use "Forgot Password?" below. Note: If you registered earlier with "Confirm email" enabled on Supabase, check your inbox to confirm your email before signing in.';
    } else if (error.message.includes('Email not confirmed')) {
      friendly =
        'Email address has not been confirmed yet. Please check your email inbox for the Supabase confirmation link, or disable "Confirm email" in Supabase Dashboard (Authentication → Providers → Email).';
    }
    return { user: null, error: new Error(friendly) };
  }

  return {
    user: data.user,
    error: null,
  };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<{ error: Error | null }> {
  try {
    const redirectUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });
    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (err: any) {
    return { error: new Error(err?.message || 'Failed to send password reset email') };
  }
}

/**
 * Sign up with Email and Password
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null; error: Error | null; requiresConfirmation?: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    let userFriendlyMsg = error.message;
    if (error.message.includes('rate limit')) {
      userFriendlyMsg = 'Supabase email rate limit exceeded (maximum 3 emails/hour). In your Supabase Dashboard, go to Authentication → Providers → Email and turn OFF "Confirm email" to register instantly without rate limits.';
    } else if (error.message.includes('User already registered')) {
      userFriendlyMsg = 'An account with this email already exists. Please switch to "Sign in" above or sign in with Google.';
    }
    return {
      user: null,
      session: null,
      error: new Error(userFriendlyMsg),
    };
  }

  // If user is returned but session is null, Supabase requires email confirmation
  const requiresConfirmation = !!(data.user && !data.session);

  return {
    user: data.user,
    session: data.session,
    error: null,
    requiresConfirmation,
  };
}

/**
 * Sign in anonymously as a guest
 */
export async function signInAnonymously(): Promise<{ user: User | null; error: Error | null }> {
  const { data, error } = await supabase.auth.signInAnonymously();
  return {
    user: data.user,
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error ? new Error(error.message) : null };
}

/**
 * Get current session user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Test connectivity to Supabase backend
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('sessions').select('id').limit(1);
    if (error) {
      console.warn('Supabase connection warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase connection error:', err);
    return false;
  }
}

/**
 * Subscribe to Supabase authentication state changes
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
