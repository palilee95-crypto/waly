import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { pb } from '@/lib/pocketbase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';

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
export const storage = {
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
  email: string;
  avatar?: string;
  role: UserRole;
  activeRole: UserRole; // currently active mode
  merchant_id?: string; // linked merchant ID
  merchant_status?: 'active' | 'suspended' | 'pending';
  merchant_created?: string;
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

  const params = useLocalSearchParams<{ ref?: string }>();

  useEffect(() => {
    if (params.ref) {
      storage.setItem('risev_referral_code', params.ref)
        .then(() => {
          console.log('[AuthContext] Stored referral code:', params.ref);
          pb.send(`/api/risev/agent/click?ref=${encodeURIComponent(params.ref || '')}`, { method: 'GET' })
            .then(res => console.log('[AuthContext] Click recorded successfully:', res))
            .catch(err => console.warn('[AuthContext] Failed to record agent click:', err));
        })
        .catch(err => console.error('[AuthContext] Failed to store referral code:', err));
    }
  }, [params.ref]);

  useEffect(() => {
    initAuth();
  }, []);

  const ensureMerchantProfile = async (record: any): Promise<{ id?: string; status?: 'active' | 'suspended' | 'pending'; created?: string }> => {
    let merchantId = record.merchant_id;
    let status: 'active' | 'suspended' | 'pending' = 'pending';
    let created: string | undefined = undefined;
    
    if (record.role === 'merchant' || record.role === 'both') {
      let merchantRecord = null;
      if (merchantId) {
        merchantRecord = await pb.collection('merchants').getOne(merchantId)
          .catch(() => null);
      }
      
      // Self-healing: if role is merchant but merchant_id is missing, find or create one
      if (!merchantRecord) {
        try {
          // Check if there is an orphaned merchant owned by this user
          const existing = await pb.collection('merchants').getFullList({
            filter: `owner = "${record.id}"`
          });
          if (existing.length > 0) {
            merchantRecord = existing[0];
          } else {
            // Retrieve referral code from local storage
            const refCode = await storage.getItem('risev_referral_code').catch(() => null);

            // Create a new pending merchant record
            merchantRecord = await pb.collection('merchants').create({
              name: `${record.name || 'New'}'s Shop`,
              owner: record.id,
              category: 'food',
              status: 'pending',
              referral_code: refCode || '',
              metadata: {},
            });

            if (refCode) {
              await storage.deleteItem('risev_referral_code').catch(() => null);
            }
          }
          
          if (merchantRecord) {
            merchantId = merchantRecord.id;
            status = (merchantRecord.status as any) || 'pending';
            created = merchantRecord.created;
            // Link it to the user profile
            await pb.collection('users').update(record.id, {
              merchant_id: merchantRecord.id,
            });
          }
        } catch (err) {
          console.error("Self-healing merchant profile creation failed:", err);
        }
      } else {
        merchantId = merchantRecord.id;
        status = (merchantRecord.status as any) || 'pending';
        created = merchantRecord.created;
      }
    }
    return { id: merchantId, status, created };
  };

  const initAuth = async () => {
    try {
      const storedRole = await storage.getItem('risev_active_role');
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
          email: record.email || '',
          avatar: record.avatar || undefined,
          role: record.role,
          activeRole: role,
          merchant_id: merchantData.id,
          merchant_status: merchantData.status,
          merchant_created: merchantData.created,
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
    const res = await pb.send<{ otpId: string }>("/api/risev/request-otp", {
      method: "POST",
      body: { phone }
    });
    return res.otpId;
  };

  const checkPhone = async (phone: string): Promise<{ exists: boolean; email?: string }> => {
    try {
      const res = await pb.send<{ exists: boolean; email?: string }>('/api/risev/check-phone', {
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
    const res = await pb.send<{ otpId: string }>('/api/risev/register', {
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
    await storage.setItem('risev_active_role', role || 'customer');
    const merchantData = await ensureMerchantProfile(authRecord);
    setUser({
      id: authRecord.id,
      phone: authRecord.phone || '',
      name: authRecord.name || '',
      email: authRecord.email || '',
      avatar: authRecord.avatar || undefined,
      role,
      activeRole: role,
      merchant_id: merchantData.id,
      merchant_status: merchantData.status,
      merchant_created: merchantData.created,
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
    await storage.setItem('risev_active_role', role || 'customer');
    const merchantData = await ensureMerchantProfile(authRecord);
    setUser({
      id: authRecord.id,
      phone: authRecord.phone || '',
      name: authRecord.name || '',
      email: authRecord.email || '',
      avatar: authRecord.avatar || undefined,
      role,
      activeRole: role,
      merchant_id: merchantData.id,
      merchant_status: merchantData.status,
      merchant_created: merchantData.created,
      tier: authRecord.tier || undefined,
      total_points: authRecord.total_points || 0,
    });
    setActiveRole(role);
    // Register push token upon login
    registerPushToken(authRecord.id);
  };

  const logout = async () => {
    pb.authStore.clear();
    await storage.deleteItem('risev_active_role');
    setUser(null);
    setActiveRole(null);
  };

  const switchRole = async (role: UserRole) => {
    if (!user) return;
    await storage.setItem('risev_active_role', role || 'customer');
    setActiveRole(role);
    setUser(prev => prev ? { ...prev, activeRole: role } : null);
  };

  const setUserRole = async (role: UserRole) => {
    if (!user) return;
    // Update role in PocketBase
    await pb.collection('users').update(user.id, { role });
    await storage.setItem('risev_active_role', role || 'customer');
    
    let merchantData: { id?: string; status?: 'active' | 'suspended' | 'pending'; created?: string } = { 
      id: user.merchant_id, 
      status: user.merchant_status,
      created: user.merchant_created
    };
    if (role === 'merchant') {
      merchantData = await ensureMerchantProfile({ ...user, role });
    }
    
    setUser(prev => prev ? { 
      ...prev, 
      role, 
      activeRole: role,
      merchant_id: merchantData.id,
      merchant_status: merchantData.status,
      merchant_created: merchantData.created
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

      const storedRole = await storage.getItem('risev_active_role');
      let role = (storedRole as UserRole) || record.role || 'customer';
      if (role === 'both') {
        role = 'customer';
      }
      const merchantData = await ensureMerchantProfile(record);
      
      setUser({
        id: record.id,
        phone: record.phone || '',
        name: record.name || '',
        email: record.email || '',
        avatar: record.avatar || undefined,
        role: record.role,
        activeRole: role,
        merchant_id: merchantData.id,
        merchant_status: merchantData.status,
        merchant_created: merchantData.created,
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
