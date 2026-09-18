# Roleplay Playground — Android App

Native Android wrapper for the **Remix Roleplay Playground** web app, built with
[Capacitor 6](https://capacitorjs.com). It runs the **exact same React UI**
(`dist/`) inside a native WebView, so all features look and behave the same:

- Tree-based branching conversations (`< n / m >`), regenerate, continue, edit + branch / edit in place
- Character creation modal, history drawer, import/export roleplay backups
- Gemma 4 31B via Google AI Studio (`gemma-4-31b-it`) with temperature / top-P / top-K /
  min-P / penalties / max tokens / thinking level (minimal ↔ high)
- Typing correction assistant, markdown dialogue rendering
- **Supabase cloud sync (same backend as web): sessions, presets, Gemini API key,
  generation config + Realtime live updates**

## How sync with the web app works

Both web and Android point at the **same Supabase project**:

- `VITE_SUPABASE_URL=https://cwylubxrbwcjfneaxlvh.supabase.co`
- Same `VITE_SUPABASE_ANON_KEY`

Sign in on the phone with the **same account as on web** (Google is fully
supported on Android via system browser + deep link, Email/Password and Guest
work too). On first login the app:

1. Fetches remote presets / sessions / API key / generation config, or seeds
   Supabase from local data if empty,
2. Merges newer `updatedAt` wins,
3. Subscribes to Realtime `postgres_changes` on `sessions` — roleplays created on
   web appear on the phone instantly and vice versa.

Your Gemini API key only needs to be entered once: it syncs through the
`settings` table to all devices.

## 1. One-time Supabase setup (required for Google on Android)

1. Open Supabase Dashboard → your project → **Authentication → URL Configuration**.
2. Under **Redirect URLs**, add exactly:
   ```
   com.roleplay.playground://auth-callback
   ```
3. Under **Authentication → Providers → Google**: must be **Enabled** (same
   Google OAuth client as web — no new client needed).
4. No change needed for Email or Anonymous providers.

How it works in code:

- `src/lib/supabase.ts` → `signInWithGoogle()` detects `Capacitor.isNativePlatform()`,
  requests Supabase OAuth with `redirectTo: com.roleplay.playground://auth-callback`,
  opens it with `@capacitor/browser` (Custom Tabs).
- `scripts/cap-after-sync.cjs` injects the matching `<intent-filter>` into
  `AndroidManifest.xml` on every `cap sync`.
- `src/App.tsx` listens to `App.addListener('appUrlOpen')` and calls
  `setSessionFromUrl(url)` → session persists, `Browser.close()` returns to the app.

## 2. Get the APK (cloud build, recommended — ~5 minutes)

No Android Studio needed.

```bash
cd roleplay-playground-android
git init
git add .
git commit -m "Roleplay Playground Android (Capacitor)"
git branch -M main
git remote add origin https://github.com/<you>/roleplay-playground-android.git
git push -u origin main
```

Then:

1. GitHub → your repo → **Actions** → **Build Android APK** → run completes.
2. Download artifact **`roleplay-playground-debug-apk`** → unzip → `app-debug.apk`.
3. Send it to your phone (Drive / USB / `adb install`) and install.
   - Android will warn "Unknown app" for debug APKs — tap **Install anyway**.
4. Open **Roleplay Playground** → Settings (gear) → **Sign in with Google**
   using the same Google account as the web app → everything syncs.

Optional: set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as GitHub Actions
secrets to override the baked-in defaults at build time.

## 3. Local build (optional, needs Android Studio / SDK)

```bash
npm install
npm run build
npx cap add android
npx cap sync android
node scripts/cap-after-sync.cjs
npm run assets:generate   # icons/splash from resources/
npx cap open android       # opens Android Studio → Run ▶ or Build → APK
# or headless:
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## 4. Project map

| File | Android role |
|---|---|
| `capacitor.config.ts` | appId `com.roleplay.playground`, `webDir: dist`, dark splash/keyboard/statusbar |
| `vite.config.ts` | `base: './'` so `dist/` loads from `https://localhost` in the WebView |
| `index.html` | `viewport-fit=cover`, theme `#09090b`, installable meta |
| `src/index.css` | safe-area insets, no overscroll/zoom-on-focus |
| `src/lib/capacitor.ts` | `ANDROID_AUTH_CALLBACK` + platform helpers |
| `src/lib/supabase.ts` | Google via Browser+deep link on native, popup on web; closes Browser after callback |
| `src/App.tsx` | `appUrlOpen` listener + StatusBar/Keyboard/Splash init on native |
| `scripts/cap-after-sync.cjs` | injects deep-link intent-filter after every sync |
| `.github/workflows/android-apk.yml` | cloud CI: build web → cap sync → gradle `assembleDebug` → APK artifact |
| `resources/icon.png`, `splash.png` | generated launcher icon + splash |

## 5. Feature parity checklist

- [x] Identical dark violet/zinc UI (same components, no rewrite)
- [x] Send / stop / continue / regenerate / branch switching
- [x] Edit in place + edit-as-new-branch
- [x] New RP modal, sticky user persona + system instructions
- [x] History drawer: rename / duplicate / delete / import backup
- [x] Settings: API key save+sync, all 8 generation sliders, thinking toggle, spellcheck toggle
- [x] Google (native deep-link) + Email + Guest auth against same Supabase users
- [x] Manual "Sync to Cloud" + automatic background sync + Realtime subscription
- [x] localStorage persistence works in WebView; cloud is source of truth when signed in

## 6. Troubleshooting

- **Google sign-in shows "redirect_to is not allowed"** → you missed step 1:
  add `com.roleplay.playground://auth-callback` to Supabase Redirect URLs.
- **Sessions don't sync** → make sure phone + web use the same Supabase URL/key
  and the same login (check Settings → User ID matches on both).
- **Blank white screen in APK** → `vite.config.ts` `base` must stay `'./'`;
  rebuild (`npm run build`) before `cap sync`.
- **Keyboard covers chat input** → `Keyboard.resize: 'body'` is set in
  `capacitor.config.ts` + runtime in `App.tsx`; don't change to `native`.
- **Play Store release** → debug APK is for sideloading. For Play: generate a
  signed AAB (`assembleRelease` + keystore) — ask and this can be added.
