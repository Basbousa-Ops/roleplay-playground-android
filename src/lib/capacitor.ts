import { Capacitor } from '@capacitor/core';

/**
 * Deep-link scheme the Android app uses for Supabase Google OAuth.
 *
 * IMPORTANT: this exact value must be added in the Supabase Dashboard under
 * Authentication -> URL Configuration -> Redirect URLs, otherwise Google
 * sign-in on Android will fail with "redirect_to is not allowed".
 */
export const ANDROID_AUTH_CALLBACK = 'com.roleplay.playground://auth-callback';

export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
