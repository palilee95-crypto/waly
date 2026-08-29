import React from 'react';
import { Tabs, Redirect, useRouter, usePathname } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, useWindowDimensions, TextInput, ScrollView, Image, Alert, Linking, LayoutAnimation, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import NfcClaimModal from '@/components/NfcClaimModal';
import GooeyTabBarBackground from './_components/GooeyTabBarBackground';
import { LinearGradient } from 'expo-linear-gradient';
import SubscriptionScreen from './subscription';

// Custom Merchant Tab Bar / Sidebar component
function CustomMerchantTabBar({ state, descriptors, navigation, isSidebarExpanded, toggleSidebar, sidebarWidth }: any) {
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const { width } = useWindowDimensions();
  const { t } = useLanguage();
  const isDesktop = width >= 768;

  const currentRoute = state.routes[state.index]?.name;
  // Hide tab bar on sub-screens like subscription paywall or nfc-marketplace
  if (currentRoute === 'subscription' || currentRoute === 'nfc-marketplace') {
    return null;
  }

  if (isDesktop) {
    return (
      <View style={[styles.desktopSidebar, { width: sidebarWidth, paddingHorizontal: isSidebarExpanded ? 20 : 16 }]}>
        {/* Toggle Sidebar Button */}
        <TouchableOpacity 
          style={{ position: 'absolute', right: -14, top: 32, width: 28, height: 28, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', zIndex: 10 }} 
          onPress={toggleSidebar}
        >
          <Ionicons name={isSidebarExpanded ? 'chevron-back' : 'chevron-forward'} size={16} color="#64748B" />
        </TouchableOpacity>

        {/* Branding */}
        <View style={[styles.sidebarBrand, !isSidebarExpanded && { alignItems: 'center', paddingHorizontal: 0 }]}>
          {isSidebarExpanded ? (
            <>
              <Image source={require('../../assets/risev logo.png')} style={{ width: 96, height: 28, resizeMode: 'contain', tintColor: '#050505' }} />
              <Text style={styles.brandSubtitle}>{t('merchant_console')}</Text>
            </>
          ) : (
            <View style={{ width: 36, height: 36, backgroundColor: '#050505', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18 }}>R</Text>
            </View>
          )}
        </View>

        {/* Navigation Links */}
        <View style={styles.sidebarLinks}>
          {state.routes.filter((route: any) => ['index', 'customers', 'give', 'marketing', 'profile'].includes(route.name)).map((route: any) => {
            const isFocused = state.routes[state.index]?.name === route.name;

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
            let label = t('home');
            if (route.name === 'customers') {
              iconName = 'people';
              label = t('customers');
            } else if (route.name === 'give') {
              iconName = 'card';
              label = 'Issue Stamps';
            } else if (route.name === 'marketing') {
              iconName = 'megaphone';
              label = t('marketing');
            } else if (route.name === 'profile') {
              iconName = 'person';
              label = t('profile');
            }

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.8}
                style={[
                  styles.sidebarBtn,
                  isFocused && styles.sidebarBtnActive,
                  !isSidebarExpanded && { justifyContent: 'center', paddingHorizontal: 0 }
                ]}
              >
                <Ionicons
                  name={isFocused ? (iconName as any) : (`${iconName}-outline` as any)}
                  size={20}
                  color={isFocused ? '#FFFFFF' : '#64748B'}
                />
                {isSidebarExpanded && (
                  <Text style={[styles.sidebarBtnText, isFocused && styles.sidebarBtnTextActive]}>
                    {label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer with User and Logout */}
        <View style={[styles.sidebarFooter, !isSidebarExpanded && { alignItems: 'center' }]}>
          {isSidebarExpanded && (
            <View style={styles.userProfileMini}>
              <Text style={styles.userNameMini} numberOfLines={1}>{user?.name || 'Store Owner'}</Text>
              <Text style={styles.userPhoneMini} numberOfLines={1}>{user?.phone || ''}</Text>
            </View>
          )}
          <TouchableOpacity 
            style={[styles.logoutBtn, !isSidebarExpanded && { justifyContent: 'center', paddingHorizontal: 0, width: 44, height: 44, borderRadius: 12 }]} 
            onPress={logout} 
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            {isSidebarExpanded && <Text style={styles.logoutBtnText}>{t('logout')}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Mobile Bottom Tab Bar view
  const tabBarWidth = width - 32;

  return (
    <View style={[styles.mobileTabBarWrap, { bottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
      <GooeyTabBarBackground width={tabBarWidth} color="#121214" />
      <View style={styles.mobileTabBar}>
        {state.routes.filter((route: any) => ['index', 'customers', 'give', 'marketing', 'profile'].includes(route.name)).map((route: any) => {
          const isFocused = state.routes[state.index]?.name === route.name;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              LayoutAnimation.configureNext({
                duration: 350,
                create: { type: 'easeInEaseOut', property: 'opacity' },
                update: { type: 'spring', springDamping: 0.8 },
                delete: { type: 'easeInEaseOut', property: 'opacity' },
              });
              navigation.navigate(route.name);
            }
          };

          if (route.name === 'give') {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={styles.floatingBtnWrap}
                activeOpacity={0.9}
              >
                <View style={styles.centerGlowBtnContainer}>
                  <LinearGradient
                    colors={['#FFFEE0', '#FFC700', '#FF8F00']}
                    start={{ x: 0.2, y: 0.2 }}
                    end={{ x: 0.8, y: 0.8 }}
                    style={styles.centerGlowBtnGradient}
                  >
                    {/* Glass Orb Top Highlight */}
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.65)', 'rgba(255, 255, 255, 0.0)']}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.orbHighlight}
                    />
                    <Ionicons name="qr-code" size={22} color="#FFFFFF" style={styles.qrIconShadow} />
                  </LinearGradient>
                </View>
              </TouchableOpacity>
            );
          }

          let iconName = 'home';
          let label = t('home');
          if (route.name === 'customers') {
            iconName = 'people';
            label = t('customers');
          } else if (route.name === 'marketing') {
            iconName = 'megaphone';
            label = t('marketing');
          } else if (route.name === 'profile') {
            iconName = 'person';
            label = t('profile');
          }

          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={styles.tabButton} activeOpacity={0.8}>
              <View style={[styles.iconContainer, isFocused && styles.iconContainerActive]}>
                <Ionicons
                  name={isFocused ? (iconName as any) : (`${iconName}-outline` as any)}
                  size={18}
                  color={isFocused ? '#050505' : '#94A3B8'}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function MerchantLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, activeRole, user, refreshSession, logout, switchRole } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [isPaying, setIsPaying] = React.useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(true);
  const sidebarWidth = isSidebarExpanded ? 260 : 88;

  const [isOnboardingRequired, setIsOnboardingRequired] = React.useState(false);
  const [checkingProfile, setCheckingProfile] = React.useState(true);
  const [merchant, setMerchant] = React.useState<any>(null);

  // Onboarding Form States
  const [storeName, setStoreName] = React.useState('');
  const [storeCategory, setStoreCategory] = React.useState<'food' | 'retail' | 'beauty' | 'health' | 'entertainment' | 'other'>('food');
  const [storeDescription, setStoreDescription] = React.useState('');
  const [storeWebsite, setStoreWebsite] = React.useState('');
  const [storePhone, setStorePhone] = React.useState('');
  const [storeLat, setStoreLat] = React.useState('6.2443');
  const [storeLng, setStoreLng] = React.useState('100.4217');
  const [logoFile, setLogoFile] = React.useState<any>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [isSubmittingOnboarding, setIsSubmittingOnboarding] = React.useState(false);

  const [pricing, setPricing] = React.useState({
    base_price_1m: 119,
    discount_3m: 5,
    discount_6m: 10,
    discount_9m: 12,
    discount_12m: 15,
    enable_3m: true,
    enable_6m: true,
    enable_9m: true,
    enable_12m: true,
  });

  const [promoCode, setPromoCode] = React.useState('');
  const [promoError, setPromoError] = React.useState('');
  const [promoSuccess, setPromoSuccess] = React.useState('');
  const [appliedPromo, setAppliedPromo] = React.useState<any>(null);
  const [selectedMonths, setSelectedMonths] = React.useState<1 | 3 | 6 | 9 | 12>(1);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    const loadPricing = async () => {
      try {
        const record = await pb.collection('pricing_settings').getOne('pricesettings01');
        setPricing({
          base_price_1m: record.base_price_1m || 119,
          discount_3m: record.discount_3m || 5,
          discount_6m: record.discount_6m || 10,
          discount_9m: record.discount_9m || 12,
          discount_12m: record.discount_12m || 15,
          enable_3m: record.enable_3m !== false,
          enable_6m: record.enable_6m !== false,
          enable_9m: record.enable_9m !== false,
          enable_12m: record.enable_12m !== false,
        });
      } catch (err) {
        console.warn('Failed to load dynamic pricing, using defaults:', err);
      }
    };
    if (user) {
      loadPricing();
    }
  }, [user]);

  React.useEffect(() => {
    // Reset selectedMonths to 1 if the selected option gets disabled
    if (selectedMonths === 3 && !pricing.enable_3m) setSelectedMonths(1);
    if (selectedMonths === 6 && !pricing.enable_6m) setSelectedMonths(1);
    if (selectedMonths === 9 && !pricing.enable_9m) setSelectedMonths(1);
    if (selectedMonths === 12 && !pricing.enable_12m) setSelectedMonths(1);
  }, [pricing, selectedMonths]);

  const handleApplyPromo = async () => {
    setPromoError('');
    setPromoSuccess('');
    const code = promoCode.trim();
    if (!code) return;
    try {
      const record = await pb.collection('subscription_promo_codes').getFirstListItem(`code = "${code}" && is_active = true`);
      setAppliedPromo({
        code: record.code,
        discount_type: record.discount_type,
        discount_value: record.discount_value,
      });
      setPromoSuccess(
        record.discount_type === 'percentage'
          ? `Promo applied! -${record.discount_value}% off`
          : `Promo applied! -RM${record.discount_value} off`
      );
    } catch (err) {
      setPromoError('Invalid or expired promo code.');
      setAppliedPromo(null);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoSuccess('');
    setPromoError('');
  };

  const [activeSub, setActiveSub] = React.useState<any>(null);

  React.useEffect(() => {
    async function loadActiveSub() {
      if (!user?.merchant_id) return;
      try {
        const subList = await pb.collection('subscriptions').getList(1, 1, {
          filter: `merchant = '${user.merchant_id}' && (status = 'active' || status = 'trialing')`,
          sort: '-created',
        });
        if (subList.items.length > 0) setActiveSub(subList.items[0]);
      } catch (e) {}
    }
    loadActiveSub();
  }, [user]);

  // Helper to determine trial status
  const getTrialStatus = () => {
    if (activeSub) {
      const subStatus = activeSub.status;
      const periodEnd = activeSub.current_period_end;
      if (subStatus === 'trialing' && periodEnd) {
        const expiryTime = new Date(periodEnd.replace(' ', 'T')).getTime();
        const diffDays = (expiryTime - Date.now()) / (1000 * 60 * 60 * 24);
        const daysRemaining = Math.max(0, Math.ceil(diffDays));
        return { isInTrial: daysRemaining > 0, daysRemaining: daysRemaining };
      }
    }
    return { isInTrial: false, daysRemaining: 0 };
  };

  const { isInTrial } = getTrialStatus();

  React.useEffect(() => {
    async function checkMerchantProfile() {
      const isAllowed = user?.merchant_status === 'active' || activeSub?.status === 'active' || isInTrial;
      if (!user || !user.merchant_id || !isAllowed) {
        setCheckingProfile(false);
        return;
      }
      try {
        setCheckingProfile(true);
        const mRec = await pb.collection('merchants').getOne(user.merchant_id, { requestKey: null });
        setMerchant(mRec);
        
        // If profile hasn't been onboarded yet, prompt onboarding UI
        if (mRec.metadata && mRec.metadata.onboarded) {
          setIsOnboardingRequired(false);
        } else {
          setIsOnboardingRequired(true);
          setStoreName(mRec.name || '');
          setStoreCategory(mRec.category || 'food');
          setStoreDescription(mRec.description || '');
          setStoreWebsite(mRec.website || '');
          
          // Look up if location already exists to prefill
          try {
            const locs = await pb.collection('store_locations').getFullList({
              filter: `merchant = "${user.merchant_id}"`,
              requestKey: null,
            });
            if (locs.length > 0) {
              const loc = locs[0];
              setStorePhone(loc.phone || mRec.metadata?.phone || user?.phone || '');
              setStoreLat(String(loc.lat || '6.2443'));
              setStoreLng(String(loc.lng || '100.4217'));
            } else {
              setStorePhone(mRec.metadata?.phone || user?.phone || '');
              setStoreLat('6.2443');
              setStoreLng('100.4217');
            }
          } catch (e) {
            setStorePhone(mRec.metadata?.phone || user?.phone || '');
            setStoreLat('6.2443');
            setStoreLng('100.4217');
          }
        }
      } catch (err: any) {
        if (err.isAbort) return; // Silent discard for request auto-cancellation
        console.error('Failed to fetch merchant profile for onboarding check:', err);
      } finally {
        setCheckingProfile(false);
      }
    }
    checkMerchantProfile();
  }, [user]);

  // Leaflet Map Injection and Management for Onboarding (Web Only)
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !isOnboardingRequired) return;
    
    // Inject Leaflet Stylesheet if not already present
    let link = document.getElementById('leaflet-css') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    let mapInstance: any = null;
    let checkInterval: any = null;
    let isCleanedUp = false;

    function initMap() {
      if (isCleanedUp) return;
      const L = (window as any).L;
      if (!L) return;

      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }

      const mapDiv = document.getElementById('onboarding-map');
      if (!mapDiv) {
        setTimeout(initMap, 100);
        return;
      }

      // Avoid double initialization
      if ((mapDiv as any)._leaflet_id) {
        return;
      }

      const startLat = parseFloat(storeLat) || 6.2443;
      const startLng = parseFloat(storeLng) || 100.4217;

      try {
        mapInstance = L.map('onboarding-map').setView([startLat, startLng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstance);

        let marker = L.marker([startLat, startLng], { draggable: true }).addTo(mapInstance);

        marker.on('dragend', function (event: any) {
          const position = marker.getLatLng();
          setStoreLat(position.lat.toFixed(6));
          setStoreLng(position.lng.toFixed(6));
        });

        mapInstance.on('click', function (event: any) {
          const latlng = event.latlng;
          marker.setLatLng(latlng);
          setStoreLat(latlng.lat.toFixed(6));
          setStoreLng(latlng.lng.toFixed(6));
        });

        // Trigger resize event to render correctly
        setTimeout(() => {
          if (mapInstance && !isCleanedUp) {
            mapInstance.invalidateSize();
          }
        }, 200);
      } catch (err) {
        console.warn("Leaflet onboarding initialization warning:", err);
      }
    }

    // Inject Leaflet Javascript if not already present
    let script = document.getElementById('leaflet-js') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        initMap();
      };
      document.head.appendChild(script);
    } else {
      if ((window as any).L) {
        // If script is in DOM and L is ready, initialize map
        setTimeout(initMap, 50);
      } else {
        // If script is in DOM but L is not ready (still loading), poll for L
        checkInterval = setInterval(() => {
          if ((window as any).L) {
            initMap();
          }
        }, 50);
      }
    }

    return () => {
      isCleanedUp = true;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [isOnboardingRequired]);

  const handlePickLogo = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            const img = new window.Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 200;
              const MAX_HEIGHT = 200;
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  setLogoFile(compressedFile);
                  setLogoPreview(URL.createObjectURL(compressedFile));
                }
              }, 'image/jpeg', 0.75);
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert('Not Supported', 'Image upload is currently web-only in this demo.');
    }
  };

  const handleSubmitOnboarding = async () => {
    if (!user || !user.merchant_id) {
      Alert.alert('Error', 'No authenticated store session found.');
      return;
    }

    if (!storeName.trim()) {
      Alert.alert('Validation Error', 'Store Name is required.');
      return;
    }
    if (!storeDescription.trim()) {
      Alert.alert('Validation Error', 'Store Address/Description is required.');
      return;
    }

    setIsSubmittingOnboarding(true);
    try {
      const formData = new FormData();
      formData.append('name', storeName.trim());
      formData.append('category', storeCategory);
      formData.append('description', storeDescription.trim());
      if (storeWebsite.trim()) {
        formData.append('website', storeWebsite.trim());
      }

      const updatedMetadata = {
        ...(merchant?.metadata || {}),
        onboarded: true
      };
      formData.append('metadata', JSON.stringify(updatedMetadata));

      if (logoFile) {
        formData.append('logo', logoFile);
      }

      await pb.collection('merchants').update(user.merchant_id, formData);
      
      // Auto-provision or update store location in store_locations collection
      try {
        const existingLocs = await pb.collection('store_locations').getFullList({
          filter: `merchant = "${user.merchant_id}"`
        });
        const latVal = parseFloat(storeLat) || 6.2443;
        const lngVal = parseFloat(storeLng) || 100.4217;
        const phoneVal = storePhone.trim() || user.phone || '';
        
        if (existingLocs.length > 0) {
          await pb.collection('store_locations').update(existingLocs[0].id, {
            address: storeDescription.trim(),
            phone: phoneVal,
            lat: latVal,
            lng: lngVal,
          });
        } else {
          await pb.collection('store_locations').create({
            merchant: user.merchant_id,
            name: 'Main Outlet',
            address: storeDescription.trim(),
            city: 'Jitra',
            country: 'Malaysia',
            phone: phoneVal,
            hours: {
              "Monday": "08:00 - 22:00",
              "Tuesday": "08:00 - 22:00",
              "Wednesday": "08:00 - 22:00",
              "Thursday": "08:00 - 22:00",
              "Friday": "08:00 - 22:00",
              "Saturday": "09:00 - 23:00",
              "Sunday": "09:00 - 21:00"
            },
            lat: latVal,
            lng: lngVal,
            is_active: true
          });
        }
      } catch (locErr) {
        console.warn("Failed to provision/sync store location during onboarding:", locErr);
      }

      setIsOnboardingRequired(false);
      Alert.alert('Success', 'Store profile successfully set up! Welcome to RISEV.');
    } catch (err: any) {
      Alert.alert('Setup Error', err.message || 'Failed to complete store setup.');
    } finally {
      setIsSubmittingOnboarding(false);
    }
  };

  const handleProceedToSubscription = () => {
    router.push('/(merchant)/subscription' as any);
  };

  if (isLoading || checkingProfile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#050505" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (activeRole !== 'merchant' && !pathname.includes('nfc-marketplace')) {
    return <Redirect href="/(customer)" />;
  }

  // Gateway subscription gate blocker (REMOVED: Users can now access the dashboard for free)
  // We use a soft paywall banner in the dashboard instead.

  // Blocker page for merchant profile onboarding
  if (isOnboardingRequired) {
    return (
      <ScrollView contentContainerStyle={styles.onboardingScroll} style={styles.onboardingContainer}>
        <View style={[styles.onboardingCard, isDesktop && { maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
          <View style={styles.onboardingHeader}>
            <View style={styles.onboardingIconBg}>
              <Ionicons name="rocket-outline" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.onboardingTitle}>Welcome to RISEV Merchant Pro! 🚀</Text>
            <Text style={styles.onboardingSubtitle}>
              Let's set up your store profile so customers can start collecting your stamps.
            </Text>
          </View>

          {/* Circular Store Logo Picker */}
          <Text style={[styles.sectionLabel, { textAlign: 'center', marginBottom: 0 }]}>STORE LOGO</Text>
          <View style={{ alignItems: 'center', marginVertical: 12 }}>
            <TouchableOpacity style={styles.logoPickerCircular} onPress={handlePickLogo} activeOpacity={0.85}>
              {logoPreview ? (
                <Image source={{ uri: logoPreview }} style={styles.logoPreviewCircular} />
              ) : (
                <View style={styles.logoPlaceholderCircular}>
                  <Ionicons name="camera-outline" size={26} color="#94A3B8" />
                  <Text style={styles.logoPlaceholderTextCircular}>Upload Logo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Store Name Input */}
          <Text style={styles.sectionLabel}>STORE NAME</Text>
          <TextInput
            style={styles.onboardingInput}
            value={storeName}
            onChangeText={setStoreName}
            placeholder="e.g. The Coffee House"
            placeholderTextColor="#9CA3AF"
            {...Platform.select({
              web: { outlineStyle: 'none' } as any,
            })}
          />

          {/* Store Category Selector */}
          <Text style={styles.sectionLabel}>STORE CATEGORY</Text>
          <View style={styles.categoryGrid}>
            {[
              { id: 'food', label: 'Food & Drink', icon: 'restaurant-outline' },
              { id: 'retail', label: 'Retail', icon: 'bag-handle-outline' },
              { id: 'beauty', label: 'Beauty & Salon', icon: 'brush-outline' },
              { id: 'health', label: 'Health', icon: 'medical-outline' },
              { id: 'entertainment', label: 'Entertainment', icon: 'game-controller-outline' },
              { id: 'other', label: 'Services / Other', icon: 'star-outline' },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryCard,
                  storeCategory === cat.id && styles.categoryCardActive
                ]}
                onPress={() => setStoreCategory(cat.id as any)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={16}
                  color={storeCategory === cat.id ? '#FFFFFF' : '#475569'}
                />
                <Text style={[styles.categoryLabel, storeCategory === cat.id && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Store Description / Address */}
          <Text style={styles.sectionLabel}>STORE ADDRESS</Text>
          <TextInput
            style={styles.onboardingInput}
            value={storeDescription}
            onChangeText={setStoreDescription}
            placeholder="e.g. Lot 12, Ground Floor, Plaza Sentral, 50470 Kuala Lumpur"
            placeholderTextColor="#9CA3AF"
            {...Platform.select({
              web: { outlineStyle: 'none' } as any,
            })}
          />

          {/* Store Contact Phone */}
          <Text style={styles.sectionLabel}>STORE CONTACT PHONE</Text>
          <TextInput
            style={styles.onboardingInput}
            value={storePhone}
            onChangeText={setStorePhone}
            placeholder="e.g. +601153300472"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            {...Platform.select({
              web: { outlineStyle: 'none' } as any,
            })}
          />

          {/* Store GPS Coordinates */}
          <Text style={styles.sectionLabel}>STORE GPS COORDINATES</Text>
          <View style={styles.coordinatesRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.coordSubLabel}>Latitude</Text>
              <TextInput
                style={[styles.onboardingInput, { fontSize: 13, paddingVertical: 10 }]}
                value={storeLat}
                onChangeText={setStoreLat}
                placeholder="e.g. 6.2443"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.coordSubLabel}>Longitude</Text>
              <TextInput
                style={[styles.onboardingInput, { fontSize: 13, paddingVertical: 10 }]}
                value={storeLng}
                onChangeText={setStoreLng}
                placeholder="e.g. 100.4217"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>
          </View>

          {/* Leaflet Map Div (Web Only) */}
          {Platform.OS === 'web' && (
            <View style={{ width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', marginTop: 8, borderWidth: 1.5, borderColor: '#E2E8F0' }}>
              <div id="onboarding-map" style={{ width: '100%', height: '100%', minHeight: '160px' }} />
            </View>
          )}

          {/* Store Website */}
          <Text style={styles.sectionLabel}>STORE WEBSITE (OPTIONAL)</Text>
          <TextInput
            style={styles.onboardingInput}
            value={storeWebsite}
            onChangeText={setStoreWebsite}
            placeholder="e.g. https://thecoffeehouse.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="url"
            autoCapitalize="none"
            {...Platform.select({
              web: { outlineStyle: 'none' } as any,
            })}
          />

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmitOnboarding}
            disabled={isSubmittingOnboarding}
            activeOpacity={0.8}
          >
            {isSubmittingOnboarding ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.submitBtnText}>Complete Store Setup</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.switchRoleBtn, { marginTop: 12 }]}
            onPress={() => switchRole('customer')}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal" size={16} color="#0F172A" style={{ marginRight: 6 }} />
            <Text style={styles.switchRoleBtnText}>Switch to Customer Mode</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.onboardingCancelBtn} onPress={logout} activeOpacity={0.7}>
            <Text style={styles.onboardingCancelBtnText}>Cancel & Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Tabs
        tabBar={(props) => <CustomMerchantTabBar {...props} isSidebarExpanded={isSidebarExpanded} toggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)} sidebarWidth={sidebarWidth} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { paddingLeft: isDesktop ? sidebarWidth : 0 }
        } as any}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="customers" />
        <Tabs.Screen name="give" />
        <Tabs.Screen name="marketing" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="staff" options={{ href: null }} />
        <Tabs.Screen name="rewards" options={{ href: null }} />
        <Tabs.Screen name="subscription" options={{ href: null }} />
        <Tabs.Screen name="nfc-marketplace" options={{ href: null }} />
        <Tabs.Screen name="analytics" options={{ href: null }} />
        <Tabs.Screen name="branches" options={{ href: null }} />
        <Tabs.Screen name="create-template" options={{ href: null }} />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
        <Tabs.Screen name="onboarding-setup" options={{ href: null }} />
        <Tabs.Screen name="whatsapp-integration" options={{ href: null }} />
      </Tabs>
      <NfcClaimModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  mobileTabBarWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  mobileTabBar: {
    flexDirection: 'row',
    height: 56, // Reduced height for sleeker profile
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 56,
    paddingTop: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    marginBottom: 2,
  },
  iconContainerActive: {
    backgroundColor: '#FFFFFF', // Active tab gets a white circle background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  floatingBtnWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 56,
    width: 56,
    zIndex: 2,
  },
  centerGlowBtnContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)', // Crisp white border ring
    shadowColor: '#FF8F00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    marginTop: -20, // Float nicely above the hump
    overflow: 'hidden',
  },
  centerGlowBtnGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  qrIconShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  // Subscription Billing Block Overlays
  gateContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  gateIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gateTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  gateSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  pricingSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  pricingLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#4F46E5',
    letterSpacing: 1.0,
    marginBottom: 4,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  currency: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginRight: 2,
  },
  price: {
    fontSize: 36,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -1.0,
  },
  period: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginLeft: 4,
  },
  periodDetail: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
  },
  payBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#050505',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  payBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  logoutLink: {
    padding: 8,
  },
  logoutLinkText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
    textDecorationLine: 'underline',
  },
  switchRoleBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchRoleBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  // Desktop Sidebar Navigation Styles
  desktopSidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    paddingVertical: 28,
    justifyContent: 'space-between',
    zIndex: 100,
  },
  sidebarBrand: {
    marginBottom: 36,
    paddingHorizontal: 8,
    height: 48,
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
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
    borderRadius: 12,
    gap: 14,
    height: 48,
  },
  sidebarBtnActive: {
    backgroundColor: '#050505',
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
  onboardingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  onboardingScroll: {
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  onboardingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  onboardingHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  onboardingIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  onboardingTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  onboardingSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 16,
  },
  logoPickerCircular: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  logoPreviewCircular: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  logoPlaceholderCircular: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderTextCircular: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    marginTop: 4,
  },
  onboardingInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    width: '100%',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
    width: '100%',
  },
  categoryCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  categoryCardActive: {
    borderColor: '#050505',
    backgroundColor: '#050505',
  },
  categoryEmoji: {
    fontSize: 18,
  },
  categoryLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  categoryLabelActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  coordinatesRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 8,
  },
  coordSubLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
    borderRadius: 14,
    height: 48,
    marginTop: 24,
    width: '100%',
  },
  submitBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  onboardingCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
    width: '100%',
  },
  onboardingCancelBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  planGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: 4,
    width: '100%',
  },
  planCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  planCardActive: {
    borderColor: '#050505',
    backgroundColor: '#F8FAFC',
  },
  planDuration: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E293B',
  },
  planDiscountBadge: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  planDiscountText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  promoRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
    width: '100%',
  },
  promoInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    backgroundColor: '#FFFFFF',
  },
  promoBtn: {
    backgroundColor: '#050505',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  promoSuccessText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#10B981',
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  promoErrorText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  summarySection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    marginTop: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    marginTop: 6,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  summaryTotalValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  dropdownHeaderText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1E293B',
  },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    width: '100%',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemActive: {
    backgroundColor: '#F8FAFC',
  },
  dropdownItemText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  dropdownItemTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0040e0',
  },
});
