import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Dimensions, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

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

export default function CustomerLayout() {
  const { isAuthenticated, isLoading, activeRole } = useAuth();
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
});
