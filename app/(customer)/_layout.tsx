import React, { useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Dimensions, ActivityIndicator, useWindowDimensions, TextInput, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';

// Custom Bottom Tab Bar / Sidebar to match the clean minimalist black/white design
function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (isDesktop) {
    return (
      <View style={styles.desktopSidebar}>
        {/* Branding */}
        <View style={styles.sidebarBrand}>
          <Text style={styles.brandTitle}>Waly</Text>
          <Text style={styles.brandSubtitle}>Loyalty Wallet</Text>
        </View>

        {/* Navigation Links */}
        <View style={styles.sidebarLinks}>
          {state.routes.map((route: any, index: number) => {
            if (route.name === 'my-cards' || route.name === 'history') return null;
            
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            let iconName = 'home';
            let label = 'Home';
            if (route.name === 'explore') {
              iconName = 'compass';
              label = 'Explore';
            } else if (route.name === 'vouchers') {
              iconName = 'ticket';
              label = 'Voucher';
            } else if (route.name === 'profile') {
              iconName = 'person';
              label = 'Profile';
            }

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.8}
                style={[
                  styles.sidebarBtn,
                  isFocused && styles.sidebarBtnActive
                ]}
              >
                <Ionicons
                  name={isFocused ? (iconName as any) : (`${iconName}-outline` as any)}
                  size={18}
                  color={isFocused ? '#FFFFFF' : '#0F172A'}
                />
                <Text style={[styles.sidebarBtnText, isFocused && styles.sidebarBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer with User and Logout */}
        <View style={styles.sidebarFooter}>
          <View style={styles.userProfileMini}>
            <Text style={styles.userNameMini} numberOfLines={1}>{user?.name || 'Ahmad Fazli'}</Text>
            <Text style={styles.userPhoneMini} numberOfLines={1}>{user?.phone || ''}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.tabBarContainer, { bottom: Platform.OS === 'ios' ? 24 : 16 }]}>
      <View style={styles.tabBarInner}>
        {state.routes.map((route: any, index: number) => {
          if (route.name === 'my-cards' || route.name === 'history') return null; // Skip rendering in tab bar
          
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let iconName = 'home';
          let label = 'Home';
          if (route.name === 'explore') {
            iconName = 'compass';
            label = 'Explore';
          } else if (route.name === 'vouchers') {
            iconName = 'ticket';
            label = 'Voucher';
          } else if (route.name === 'profile') {
            iconName = 'person';
            label = 'Profile';
          }

          return (
            <React.Fragment key={route.key}>
              <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.8}
                style={[
                  styles.tabButton,
                  isFocused ? styles.tabButtonActive : styles.tabButtonInactive
                ]}
              >
                {isFocused ? (
                  <View style={styles.activePill}>
                    <Ionicons name={iconName as any} size={16} color="#FFFFFF" />
                    <Text style={styles.activePillText} numberOfLines={1}>{label}</Text>
                  </View>
                ) : (
                  <Ionicons name={`${iconName}-outline` as any} size={22} color="#0F172A" />
                )}
              </TouchableOpacity>

              {/* Vertical divider line next to active tab */}
              {isFocused && (
                <View style={styles.verticalDivider} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

function CustomerOnboardingGate({ user, refreshSession, logout }: { user: any; refreshSession: () => Promise<void>; logout: () => Promise<void> }) {
  // Pre-fill the name if it is not the placeholder User XXXX format
  const initialName = user?.name && !user.name.startsWith('User ') ? user.name : '';
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const handleSubmit = async () => {
    setError('');
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError('Please enter your Full Name.');
      return;
    }
    if (!trimmedEmail) {
      setError('Please enter your Email Address.');
      return;
    }
    
    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (trimmedEmail.endsWith('@waly.app')) {
      setError('Please use your personal email address, not a temporary @waly.app domain.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update the user profile in PocketBase
      await pb.collection('users').update(user.id, {
        name: trimmedName,
        email: trimmedEmail,
        emailConfirm: trimmedEmail,
      });

      // 2. Refresh the local session to update state and unlock the portal
      await refreshSession();
    } catch (err: any) {
      console.error(err);
      let errMsg = '';
      if (err.data && err.data.data) {
        const details = [];
        for (const key in err.data.data) {
          details.push(`${key.toUpperCase()}: ${err.data.data[key].message}`);
        }
        errMsg = details.join(', ');
      }
      if (!errMsg) {
        errMsg = err.message || 'Failed to complete profile registration.';
      }
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.onboardScroll} style={styles.onboardContainer}>
      <View style={[styles.onboardCard, isDesktop && { maxWidth: 500, alignSelf: 'center', width: '100%' }]}>
        <View style={styles.onboardHeader}>
          <View style={styles.onboardIconBg}>
            <Ionicons name="sparkles" size={28} color="#000000" style={{ transform: [{ rotate: '15deg' }] }} />
          </View>
          <Text style={styles.onboardTitle}>Welcome to WALY! 🎁</Text>
          <Text style={styles.onboardSubtitle}>
            Let's complete your profile so you can manage your loyalty cards and start claiming rewards.
          </Text>
        </View>

        {/* Inputs */}
        <View style={styles.onboardForm}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>FULL NAME</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="John Doe"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <Text style={styles.inputHint}>This email will be used for account recovery and rewards notification.</Text>
          </View>

          {/* Validation Error Message Box */}
          {error ? (
            <View style={styles.errorBoxContainer}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.submitBtnText}>Continue to Wallet</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutLink} onPress={logout} activeOpacity={0.7}>
            <Text style={styles.logoutLinkText}>Log Out Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

export default function CustomerLayout() {
  const { isAuthenticated, isLoading, activeRole, user, refreshSession, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (activeRole !== 'customer') {
    return <Redirect href="/(merchant)" />;
  }

  const isShadowUser = user?.email?.startsWith('user_') && user?.email?.endsWith('@waly.app');
  if (isShadowUser) {
    return <CustomerOnboardingGate user={user} refreshSession={refreshSession} logout={logout} />;
  }

  return (
    <View style={styles.container}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="vouchers" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="my-cards" options={{ href: null }} />
        <Tabs.Screen name="history" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF', // Clean white background matching the new style
    borderWidth: 1,
    borderColor: '#E2E8F0', // Light gray divider border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  tabBarInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabButtonActive: {
    flex: 1.6,
  },
  tabButtonInactive: {
    flex: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000', // Solid black active pill matching image
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 40,
    gap: 8,
    alignSelf: 'center',
  },
  activePillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  verticalDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
  },
  // Desktop Sidebar Navigation Styles
  desktopSidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 260,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    paddingVertical: 28,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    zIndex: 100,
  },
  sidebarBrand: {
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  brandTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -1.0,
  },
  brandSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
  },
  sidebarLinks: {
    flex: 1,
    gap: 8,
  },
  sidebarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
    height: 48,
  },
  sidebarBtnActive: {
    backgroundColor: '#000000',
  },
  sidebarBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  sidebarBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 20,
    gap: 16,
  },
  userProfileMini: {
    paddingHorizontal: 8,
  },
  userNameMini: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  userPhoneMini: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFF1F2',
    gap: 8,
  },
  logoutBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EF4444',
  },
  // Onboarding Blocker Styles
  onboardContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  onboardScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  onboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  onboardHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  onboardIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  onboardTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  onboardSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  onboardForm: {
    gap: 20,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  inputHint: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  logoutLink: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  logoutLinkText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EF4444',
  },
  errorBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorBoxText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
  },
});
