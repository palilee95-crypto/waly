import PocketBase from 'pocketbase';

// The API URL is inlined at build time (Metro replaces EXPO_PUBLIC_*). A build
// that forgets it used to fall back to production silently, so a preview or a
// staging build could read and write live merchant data without anyone noticing.
const RAW_PB_URL = process.env.EXPO_PUBLIC_PB_URL || '';
const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || '';

// Explicit builds (staging/production, and CI) must declare the URL. Plain
// `expo export` without an environment keeps the old fallback but warns loudly.
const REQUIRE_URL =
  process.env.EXPO_PUBLIC_REQUIRE_PB_URL === '1' ||
  APP_ENV === 'staging' ||
  APP_ENV === 'production';

const configuredUrl = RAW_PB_URL || (__DEV__ ? 'http://127.0.0.1:8090' : '');

if (!configuredUrl && REQUIRE_URL) {
  throw new Error(
    'EXPO_PUBLIC_PB_URL is required for staging/production builds. Refusing to fall back to the production API.'
  );
}

if (!configuredUrl) {
  console.error(
    '[pocketbase] EXPO_PUBLIC_PB_URL is not set — falling back to the production API. Set it in the Vercel environment for every environment.'
  );
}

// PocketBase URL (production Risev API is the last resort only for legacy builds)
const PB_URL = configuredUrl || 'https://api.risev.app';

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// Auth helpers
export const getCurrentUser = () => pb.authStore.record;
export const isLoggedIn = () => pb.authStore.isValid;
export const logout = () => pb.authStore.clear();

export default pb;
