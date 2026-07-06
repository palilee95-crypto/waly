import PocketBase from 'pocketbase';

// TODO: Replace with your PocketBase cloud URL
const PB_URL = process.env.EXPO_PUBLIC_PB_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);

// Auth helpers
export const getCurrentUser = () => pb.authStore.record;
export const isLoggedIn = () => pb.authStore.isValid;
export const logout = () => pb.authStore.clear();
