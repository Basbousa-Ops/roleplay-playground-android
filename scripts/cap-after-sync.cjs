/**
 * Runs after `npx cap sync android`.
 *
 * Injects the Supabase Google OAuth deep-link intent-filter into
 * android/app/src/main/AndroidManifest.xml so that redirects to
 *   com.roleplay.playground://auth-callback
 * reopen the app and complete sign-in (captured via App 'appUrlOpen').
 *
 * Idempotent: safe to run on every sync / CI build.
 */
const fs = require('fs');
const path = require('path');

const MANIFEST = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml'
);

const INTENT_FILTER = `        <intent-filter android:autoVerify="false">
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="com.roleplay.playground" android:host="auth-callback" />
        </intent-filter>`;

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.warn('[cap-after-sync] AndroidManifest.xml not found (did `cap add android` run?). Skipping.');
    return;
  }
  let xml = fs.readFileSync(MANIFEST, 'utf8');

  if (xml.includes('android:scheme="com.roleplay.playground"')) {
    console.log('[cap-after-sync] Deep-link intent-filter already present.');
    return;
  }

  // Insert inside the MainActivity <activity> block, before its closing tag.
  const activityClose = xml.indexOf('</activity>');
  if (activityClose === -1) {
    console.error('[cap-after-sync] Could not find </activity> in AndroidManifest.xml');
    process.exitCode = 1;
    return;
  }

  xml = xml.slice(0, activityClose) + INTENT_FILTER + '\n    ' + xml.slice(activityClose);
  fs.writeFileSync(MANIFEST, xml);
  console.log('[cap-after-sync] Injected Google OAuth deep-link intent-filter.');
}

main();
