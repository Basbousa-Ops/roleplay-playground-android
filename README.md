# Roleplay Playground (Web + Android)

> **Android APK:** this folder is the Capacitor Android port of the
> `remix-roleplay-playground` web app. Start here: **[README-ANDROID.md](README-ANDROID.md)**
> — it explains Supabase redirect setup, the 5-minute cloud APK build, and how
> phone ↔ web sync works (same Supabase project, Google / Email / Guest login,
> Realtime live updates).

Original AI Studio web instructions below (still valid for `npm run dev`).

---

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ea7af32f-f975-44bc-ad79-96adfef5bd59

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
