import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { pb } from '@/lib/pocketbase';
import { useLocalSearchParams } from 'expo-router';

// Lightweight IndexedDB storage wrapper for Web/PWA persistence
const initIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }
    const request = indexedDB.open('risev_storage', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('keyvalue')) {
        db.createObjectStore('keyvalue');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const idbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const db = await initIndexedDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('keyvalue', 'readonly');
        const store = transaction.objectStore('keyvalue');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[idbStorage] getItem failed, falling back to localStorage:', e);
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const db = await initIndexedDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('keyvalue', 'readwrite');
        const store = transaction.objectStore('keyvalue');
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[idbStorage] setItem failed, falling back to localStorage:', e);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    }
  },
  deleteItem: async (key: string): Promise<void> => {
    try {
      const db = await initIndexedDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('keyvalue', 'readwrite');
        const store = transaction.objectStore('keyvalue');
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[idbStorage] deleteItem failed, falling back to localStorage:', e);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    }
  }
};

// Cross-platform storage (SecureStore on native, IndexedDB on web with localStorage fallback)
export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return idbStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') return idbStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') return idbStorage.deleteItem(key);
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
  birthday?: string;
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
  loginWithIdentifier: (identifier: string, password: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  requestOTP: (phone: string) => Promise<string>;
  resetPassword: (phone: string, otpId: string, otpCode: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  checkPhone: (phone: string) => Promise<{ exists: boolean; email?: string; verified?: boolean }>;
  register: (phone: string, email: string, name: string, password: string, role: UserRole, birthday?: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  quickRegister: (name: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  setUserRole: (role: UserRole) => Promise<void>;
  updateProfile: (name: string, avatarFile?: any, password?: string, passwordConfirm?: string, birthday?: string) => Promise<void>;
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
    // Synchronize pb.authStore changes directly to cross-platform storage
    console.log('[AuthContext] Registering pb.authStore.onChange subscriber');
    const unsubscribe = pb.authStore.onChange(async (token, model) => {
      console.log('[AuthContext] pb.authStore.onChange fired, token:', token ? 'present' : 'empty');
      try {
        if (token) {
          await storage.setItem('risev_token', token);
          await storage.setItem('risev_record', JSON.stringify(model));
          console.log('[AuthContext] Successfully saved token and record to storage');
        } else {
          await storage.deleteItem('risev_token');
          await storage.deleteItem('risev_record');
          console.log('[AuthContext] Successfully cleared token and record from storage');
        }
      } catch (err) {
        console.error('[AuthContext] Failed to save auth to storage:', err);
      }
    });

    initAuth();

    return () => {
      unsubscribe();
    };
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
      
      // Self-healing: if role is merchant/both but merchant_id is missing, find orphaned merchant owned by user
      if (!merchantRecord) {
        try {
          // Check if there is an existing merchant owned by this user
          const existing = await pb.collection('merchants').getFullList({
            filter: `owner = "${record.id}"`,
            requestKey: null
          });
          if (existing.length > 0) {
            merchantRecord = existing[0];
            merchantId = merchantRecord.id;
            status = (merchantRecord.status as any) || 'pending';
            created = merchantRecord.created;
            // Link it to the user profile
            await pb.collection('users').update(record.id, {
              merchant_id: merchantRecord.id,
            });
          }
        } catch (err) {
          console.error("Linking existing merchant profile failed:", err);
        }
      }
      if (merchantRecord) {
        merchantId = merchantRecord.id;
        status = (merchantRecord.status as any) || 'pending';
        created = merchantRecord.created;

        // Auto-check and auto-sync active subscription status (e.g. stand_bundle, starter, pro)
        try {
          const subs = await pb.collection('subscriptions').getList(1, 1, {
            filter: `merchant = "${merchantRecord.id}" && (status = "active" || status = "trialing")`,
            requestKey: null,
          });
          if (subs.items.length > 0) {
            status = 'active';
            if (merchantRecord.status !== 'active') {
              pb.collection('merchants').update(merchantRecord.id, { status: 'active' }).catch(() => {});
            }
          }
        } catch (subErr) {
          // Keep current status if subscription check encounters network/filter error
        }
      }
    }
    return { id: merchantId, status, created };
  };

  const initAuth = async () => {
    try {
      console.log('[AuthContext] initAuth started');
      // Restore auth state from our cross-platform storage (SecureStore on native, localStorage on web)
      const token = await storage.getItem('risev_token');
      const recordStr = await storage.getItem('risev_record');
      console.log('[AuthContext] initAuth read storage - risev_token:', token ? 'present' : 'empty', 'risev_record:', recordStr ? 'present' : 'empty');
      if (token && recordStr) {
        try {
          const record = JSON.parse(recordStr);
          pb.authStore.save(token, record);
          console.log('[AuthContext] initAuth successfully restored pb.authStore from storage');
        } catch (e) {
          console.error('[AuthContext] Failed to parse stored PocketBase auth record:', e);
        }
      }

      const storedRole = await storage.getItem('risev_active_role');
      console.log('[AuthContext] initAuth read storage - active role:', storedRole);
      console.log('[AuthContext] initAuth checking pb.authStore - isValid:', pb.authStore.isValid, 'record:', pb.authStore.record ? 'present' : 'empty');
      if (pb.authStore.isValid && pb.authStore.record) {
        const record = pb.authStore.record;
        const isShadowOrQuick = (record.email || '').startsWith('quick_') || (record.email || '').startsWith('shadow_');
        
        // Strict Mode: if user is not verified, clear session and force login after verification
        if (!record.verified && !isShadowOrQuick) {
          console.log('[AuthContext] Unverified user session detected, clearing for Strict Mode verification');
          pb.authStore.clear();
          await storage.deleteItem('risev_token');
          await storage.deleteItem('risev_record');
          await storage.deleteItem('risev_active_role');
          setUser(null);
          setActiveRole(null);
          setIsLoading(false);
          return;
        }

        let role = (storedRole as UserRole) || record.role || 'customer';
        if (role === 'both') {
          role = 'customer';
        }
        
        // 🚀 Set initial cache state
        setUser({
          id: record.id,
          phone: record.phone || '',
          name: record.name || '',
          email: record.email || '',
          avatar: record.avatar || undefined,
          birthday: record.birthday ? String(record.birthday).slice(0, 10) : undefined,
          role: record.role,
          activeRole: role,
          merchant_status: 'active',
          tier: record.tier || undefined,
          total_points: record.total_points || 0,
        });
        setActiveRole(role);
        setIsLoading(false); // Instantly bypass spinner!

        // Asynchronously refresh user session & profile in the background
        try {
          const refreshResult = await pb.collection('users').authRefresh().catch(() => null);
          const freshRecord = refreshResult?.record || pb.authStore.record;
          const merchantData = await ensureMerchantProfile(freshRecord);
          
          setUser({
            id: freshRecord.id,
            phone: freshRecord.phone || '',
            name: freshRecord.name || '',
            email: freshRecord.email || '',
            avatar: freshRecord.avatar || undefined,
            birthday: freshRecord.birthday ? String(freshRecord.birthday).slice(0, 10) : undefined,
            role: freshRecord.role,
            activeRole: role,
            merchant_id: merchantData.id,
            merchant_status: merchantData.status,
            merchant_created: merchantData.created,
            tier: freshRecord.tier || undefined,
            total_points: freshRecord.total_points || 0,
          });
        } catch (bgErr) {
          console.warn('[AuthContext] Background session refresh failed:', bgErr);
        }
      } else {
        setIsLoading(false);
      }
    } catch (e) {
      console.error('Auth init error:', e);
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

  const checkPhone = async (phone: string): Promise<{ exists: boolean; email?: string; verified?: boolean }> => {
    try {
      const cleanPhone = encodeURIComponent(phone.trim());
      const res = await pb.send<{ exists: boolean; email?: string; verified?: boolean }>(`/api/risev/check-phone?phone=${cleanPhone}`, {
        method: 'GET',
        requestKey: null,
      });
      return res;
    } catch (e) {
      console.error('Check phone error:', e);
      return { exists: false };
    }
  };

  const register = async (phone: string, email: string, name: string, password: string, role: UserRole, birthday?: string): Promise<void> => {
    const body: any = { phone, email, name, password, role };
    if (birthday) body.birthday = birthday;
    
    // Clear old auth state before registering to prevent mixed authorization headers
    pb.authStore.clear();

    await pb.send('/api/risev/register', {
      method: 'POST',
      body,
      requestKey: null,
    });
    // In Strict Mode, we do not auto-login unverified accounts. The user must verify via email first.
  };

  const resendVerificationEmail = async (email: string): Promise<void> => {
    await pb.collection('users').requestVerification(email);
  };

  const quickRegister = async (name: string, phone: string): Promise<void> => {
    const res = await pb.send<{ success: boolean; token: string; user: any }>('/api/risev/qr/quick-register', {
      method: 'POST',
      body: { name, phone },
      requestKey: null,
    });
    if (res.token && res.user) {
      pb.authStore.save(res.token, res.user);
      const merchantData = await ensureMerchantProfile(res.user);
      setUser({
        id: res.user.id,
        phone: res.user.phone || phone,
        name: res.user.name || name,
        email: res.user.email || '',
        avatar: res.user.avatar || undefined,
        role: res.user.role || 'customer',
        activeRole: 'customer',
        merchant_id: merchantData.id,
        merchant_status: merchantData.status,
        merchant_created: merchantData.created,
      });
      setActiveRole('customer');
      await storage.setItem('risev_active_role', 'customer');
    }
  };

  const loginWithIdentifier = async (identifier: string, password: string) => {
    // Try email login first via PocketBase SDK
    try {
      await loginWithPassword(identifier, password);
      return;
    } catch (e: any) {
      if (e?.message === 'EMAIL_NOT_VERIFIED') {
        throw e;
      }
      // If email fails with invalid credentials, try phone login via custom endpoint
    }

    // Phone-based login: get email from phone, then auth
    const cleanIdentifier = encodeURIComponent(identifier.trim());
    const res = await pb.send<{ exists: boolean; email?: string }>(`/api/risev/check-phone?phone=${cleanIdentifier}`, {
      method: 'GET',
      requestKey: null,
    });
    if (!res.exists || !res.email) {
      throw new Error('Invalid credentials');
    }
    await loginWithPassword(res.email, password);
  };

  const resetPassword = async (phone: string, otpId: string, otpCode: string, newPassword: string) => {
    await pb.send('/api/risev/reset-password', {
      method: 'POST',
      body: { phone, otpId, otpCode, newPassword },
      requestKey: null,
    });
  };

  const requestPasswordReset = async (email: string) => {
    await pb.collection('users').requestPasswordReset(email);
  };

  const loginWithPassword = async (email: string, password: string) => {
    // Authenticate using the email and password
    const authData = await pb.collection('users').authWithPassword(email, password);
    const authRecord = authData.record;

    // Strict Mode: require email verification before granting access
    const isShadowOrQuick = (authRecord.email || '').startsWith('quick_') || (authRecord.email || '').startsWith('shadow_');
    if (!authRecord.verified && !isShadowOrQuick) {
      pb.authStore.clear();
      await storage.deleteItem('risev_token');
      await storage.deleteItem('risev_record');
      await storage.deleteItem('risev_active_role');
      throw new Error('EMAIL_NOT_VERIFIED');
    }

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
  };

  const logout = async () => {
    try {
      await pb.realtime.unsubscribe().catch(() => {});
    } catch (_) {}
    pb.authStore.clear();
    await storage.deleteItem('risev_active_role');
    setUser(null);
    setActiveRole(null);
  };

  const switchRole = async (role: UserRole) => {
    if (!user) return;
    try {
      await pb.realtime.unsubscribe().catch(() => {});
    } catch (_) {}
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

  const updateProfile = async (name: string, avatarFile?: any, password?: string, passwordConfirm?: string, birthday?: string) => {
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
    if (birthday) {
      formData.append('birthday', birthday);
    }
    const record = await pb.collection('users').update(user.id, formData);
    setUser(prev => prev ? {
      ...prev,
      name: record.name,
      avatar: record.avatar || undefined,
      birthday: record.birthday ? String(record.birthday).slice(0, 10) : prev.birthday,
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
        birthday: record.birthday ? String(record.birthday).slice(0, 10) : undefined,
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
      loginWithIdentifier,
      loginWithPassword,
      requestOTP,
      resetPassword,
      requestPasswordReset,
      checkPhone,
      register,
      resendVerificationEmail,
      quickRegister,
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
