import PocketBase from 'pocketbase';

// PocketBase URL (defaults to production Risev API)
const PB_URL = process.env.EXPO_PUBLIC_PB_URL || 'https://api.risev.app';

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// Auth helpers
export const getCurrentUser = () => pb.authStore.record;
export const isLoggedIn = () => pb.authStore.isValid;
export const logout = () => pb.authStore.clear();

export default pb;
