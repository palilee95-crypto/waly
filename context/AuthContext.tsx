import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { pb } from '@/lib/pocketbase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Helper to register push token in PocketBase for native devices
const registerPushToken = async (userId: string) => {
  if (!Device.isDevice) return; // Simulators/web can't receive native push notifications

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    // Check if token already exists for the user
    const existing = await pb.collection('push_tokens')
      .getFirstListItem(`user = '${userId}'`)
      .catch(() => null);

    if (existing) {
      await pb.collection('push_tokens').update(existing.id, { token, platform: Platform.OS, is_active: true });
    } else {
      await pb.collection('push_tokens').create({
        user: userId,
        token,
        platform: Platform.OS,
        is_active: true,
      });
    }
  } catch (err) {
    console.warn('Failed to register push token:', err);
  }
};

// Cross-platform storage (SecureStore on native, localStorage on web)
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    return SecureStore.deleteItemAsync(key);
  },
};

export type UserRole = 'customer' | 'merchant' | null;

interface AuthUser {
  id: string;
  phone: string;
  name: string;
  avatar?: string;
  role: UserRole;
  activeRole: UserRole; // currently active mode
  merchant_id?: string; // linked merchant ID
  merchant_status?: 'active' | 'suspended' | 'pending';
  tier?: string;
  total_points?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeRole: UserRole;
  login: (otpId: string, otp: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  requestOTP: (phone: string) => Promise<string>;
  checkPhone: (phone: string) => Promise<{ exists: boolean; email?: string }>;
  register: (phone: string, email: string, name: string, password: string, role: UserRole) => Promise<string>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  setUserRole: (role: UserRole) => Promise<void>;
  updateProfile: (name: string, avatarFile?: any, password?: string, passwordConfirm?: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<UserRole>(null);

  useEffect(() => {
    initAuth();
  }, []);

  const ensureMerchantProfile = async (record: any): Promise<{ id?: string; status?: 'active' | 'suspended' | 'pending' }> => {
    let merchantId = record.merchant_id;
    let status: 'active' | 'suspended' | 'pending' = 'pending';
    
    if (record.role === 'merchant' || record.role === 'both') {
      let merchantRecord = null;
      if (merchantId) {
        merchantRecord = await pb.collection('merchants').getOne(merchantId)
          .catch(() => null);
      }
      if (merchantRecord) {
        merchantId = merchantRecord.id;
        status = (merchantRecord.status as any) || 'pending';
      }
    }
    return { id: merchantId, status };
  };

  const initAuth = async () => {
    try {
      const storedRole = await storage.getItem('waly_active_role');
      if (pb.authStore.isValid && pb.authStore.record) {
        const refreshResult = await pb.collection('users').authRefresh().catch(() => null);
        const record = refreshResult?.record || pb.authStore.record;
        let role = (storedRole as UserRole) || record.role || 'customer';
        if (role === 'both') {
          role = 'customer';
        }
        const merchantData = await ensureMerchantProfile(record);
        
        setUser({
          id: record.id,
          phone: record.phone || '',
          name: record.name || '',
          avatar: record.avatar || undefined,
          role: record.role,
          activeRole: role,
          merchant_id: merchantData.id,
          merchant_status: merchantData.status,
          tier: record.tier || undefined,
          total_points: record.total_points || 0,
        });
        setActiveRole(role);
        // Register push token for active session
        registerPushToken(record.id);
      }
    } catch (e) {
      console.error('Auth init error:', e);
    } finally {
      setIsLoading(false);
    }
  };
  const requestOTP = async (phone: string): Promise<string> => {
    // Call the custom PocketBase endpoint we registered
    const res = await pb.send<{ otpId: string }>("/api/waly/request-otp", {
      method: "POST",
      body: { phone }
    });
    return res.otpId;
  };

  const checkPhone = async (phone: string): Promise<{ exists: boolean; email?: string }> => {
    try {
      const res = await pb.send<{ exists: boolean; email?: string }>('/api/waly/check-phone', {
        method: 'GET',
        params: { phone }
      });
      return res;
    } catch (e) {
      console.error('Check phone error:', e);
      return { exists: false };
    }
  };

  const register = async (phone: string, email: string, name: string, password: string, role: UserRole): Promise<string> => {
    const res = await pb.send<{ otpId: string }>('/api/waly/register', {
      method: 'POST',
      body: { phone, email, name, password, role }
    });
    return res.otpId;
  };

  const login = async (otpId: string, otp: string) => {
    // Authenticate using the otpId and OTP code
    const authData = await pb.collection('users').authWithOTP(otpId, otp);
    const authRecord = authData.record;
    const rawRole = authRecord.role || 'customer';
    const role: UserRole = rawRole === 'both' ? 'customer' : (rawRole as UserRole);
    await storage.setItem('waly_active_role', role || 'customer');
    const merchantData = await ensureMerchantProfile(authRecord);
    setUser({
      id: authRecord.id,
      phone: authRecord.phone || '',
      name: authRecord.name || '',
      avatar: authRecord.avatar || undefined,
      role,
      activeRole: role,
      merchant_id: merchantData.id,
      merchant_status: merchantData.status,
      tier: authRecord.tier || undefined,
      total_points: authRecord.total_points || 0,
    });
    setActiveRole(role);
    // Register push token upon login
    registerPushToken(authRecord.id);
  };

  const loginWithPassword = async (email: string, password: string) => {
    // Authenticate using the email and password
    const authData = await pb.collection('users').authWithPassword(email, password);
    const authRecord = authData.record;
    const rawRole = authRecord.role || 'customer';
    const role: UserRole = rawRole === 'both' ? 'customer' : (rawRole as UserRole);
    await storage.setItem('waly_active_role', role || 'customer');
    const merchantData = await ensureMerchantProfile(authRecord);
    setUser({
      id: authRecord.id,
      phone: authRecord.phone || '',
      name: authRecord.name || '',
      avatar: authRecord.avatar || undefined,
      role,
      activeRole: role,
      merchant_id: merchantData.id,
      merchant_status: merchantData.status,
      tier: authRecord.tier || undefined,
      total_points: authRecord.total_points || 0,
    });
    setActiveRole(role);
    // Register push token upon login
    registerPushToken(authRecord.id);
  };

  const logout = async () => {
    pb.authStore.clear();
    await storage.deleteItem('waly_active_role');
    setUser(null);
    setActiveRole(null);
  };

  const switchRole = async (role: UserRole) => {
    if (!user) return;
    await storage.setItem('waly_active_role', role || 'customer');
    setActiveRole(role);
    setUser(prev => prev ? { ...prev, activeRole: role } : null);
  };

  const setUserRole = async (role: UserRole) => {
    if (!user) return;
    // Update role in PocketBase
    await pb.collection('users').update(user.id, { role });
    await storage.setItem('waly_active_role', role || 'customer');
    
    let merchantData: { id?: string; status?: 'active' | 'suspended' | 'pending' } = { 
      id: user.merchant_id, 
      status: user.merchant_status 
    };
    if (role === 'merchant') {
      merchantData = await ensureMerchantProfile({ ...user, role });
    }
    
    setUser(prev => prev ? { 
      ...prev, 
      role, 
      activeRole: role,
      merchant_id: merchantData.id,
      merchant_status: merchantData.status
    } : null);
    setActiveRole(role);
  };

  const updateProfile = async (name: string, avatarFile?: any, password?: string, passwordConfirm?: string) => {
    if (!user) return;
    const formData = new FormData();
    formData.append('name', name);
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }
    if (password) {
      formData.append('password', password);
    }
    if (passwordConfirm) {
      formData.append('passwordConfirm', passwordConfirm);
    }
    const record = await pb.collection('users').update(user.id, formData);
    setUser(prev => prev ? {
      ...prev,
      name: record.name,
      avatar: record.avatar || undefined,
      tier: record.tier || undefined,
      total_points: record.total_points || 0,
    } : null);
  };

  const refreshSession = async () => {
    if (!pb.authStore.isValid || !pb.authStore.record) return;
    try {
      const refreshResult = await pb.collection('users').authRefresh().catch(() => null);
      const record = refreshResult?.record || pb.authStore.record;
      if (!record) return;

      const storedRole = await storage.getItem('waly_active_role');
      let role = (storedRole as UserRole) || record.role || 'customer';
      if (role === 'both') {
        role = 'customer';
      }
      const merchantData = await ensureMerchantProfile(record);
      
      setUser({
        id: record.id,
        phone: record.phone || '',
        name: record.name || '',
        avatar: record.avatar || undefined,
        role: record.role,
        activeRole: role,
        merchant_id: merchantData.id,
        merchant_status: merchantData.status,
        tier: record.tier || undefined,
        total_points: record.total_points || 0,
      });
    } catch (e) {
      console.error('Refresh session error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      activeRole,
      login,
      loginWithPassword,
      requestOTP,
      checkPhone,
      register,
      logout,
      switchRole,
      setUserRole,
      updateProfile,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
