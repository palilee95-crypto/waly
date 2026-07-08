import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, useWindowDimensions, TextInput, ScrollView, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';

// Custom Merchant Tab Bar / Sidebar component
function CustomMerchantTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (isDesktop) {
    return (
      <View style={styles.desktopSidebar}>
        {/* Branding */}
        <View style={styles.sidebarBrand}>
          <Text style={styles.brandTitle}>RISEV</Text>
          <Text style={styles.brandSubtitle}>Merchant Console</Text>
        </View>

        {/* Navigation Links */}
        <View style={styles.sidebarLinks}>
          {state.routes.filter((route: any) => route.name !== 'staff').map((route: any, index: number) => {
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
            if (route.name === 'customers') {
              iconName = 'people';
              label = 'Customers';
            } else if (route.name === 'give') {
              iconName = 'scan';
              label = 'Scan Member';
            } else if (route.name === 'marketing') {
              iconName = 'megaphone';
              label = 'Marketing';
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
            <Text style={styles.userNameMini} numberOfLines={1}>{user?.name || 'Store Owner'}</Text>
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

  // Mobile Bottom Tab Bar view
  return (
    <View style={[styles.mobileTabBar, { paddingBottom: insets.bottom + 8 }]}>
      {state.routes.filter((route: any) => route.name !== 'staff').map((route: any, index: number) => {
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

        if (route.name === 'give') {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.floatingBtnWrap}
              activeOpacity={0.9}
            >
              <View style={styles.floatingBtn}>
                <Ionicons name="scan-outline" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          );
        }

        let iconName = 'home';
        let label = 'Home';
        if (route.name === 'customers') {
          iconName = 'people';
          label = 'Customer';
        } else if (route.name === 'marketing') {
          iconName = 'megaphone';
          label = 'Marketing';
        } else if (route.name === 'profile') {
          iconName = 'person';
          label = 'Profile';
        }

        return (
          <TouchableOpacity key={route.key} onPress={onPress} style={styles.tabButton} activeOpacity={0.8}>
            <Ionicons
              name={isFocused ? (iconName as any) : (`${iconName}-outline` as any)}
              size={20}
              color={isFocused ? '#000000' : '#9CA3AF'}
            />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MerchantLayout() {
  const { isAuthenticated, isLoading, activeRole, user, refreshSession, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [isPaying, setIsPaying] = React.useState(false);

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

  React.useEffect(() => {
    async function checkMerchantProfile() {
      if (!user || !user.merchant_id || user.merchant_status !== 'active') {
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

    function initMap() {
      const L = (window as any).L;
      if (!L) return;

      const mapDiv = document.getElementById('onboarding-map');
      if (!mapDiv) return;

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
          if (mapInstance) {
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
      // If already loaded, initialize directly
      setTimeout(initMap, 100);
    }

    return () => {
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

  const handleSimulatePayment = async () => {
    let merchantId = user?.merchant_id;
    if (!merchantId) {
      try {
        await refreshSession();
        if (pb.authStore.record?.merchant_id) {
          merchantId = pb.authStore.record.merchant_id;
        }
      } catch (e) {
        console.error("Self-healing session refresh failed:", e);
      }
    }

    if (!merchantId) {
      alert("Error: Merchant ID is missing from your session. Please log out and log back in to refresh your auth session.");
      return;
    }
    setIsPaying(true);
    try {
      // Simulate webhook call to Chip-in payment gateway
      const paymentId = 'chipin_' + Math.random().toString(36).substring(2, 10);
      const res = await fetch(`${pb.baseUrl}/api/risev/chipin-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: paymentId,
          status: 'success',
          email: (user?.phone || 'merchant') + '@risev.app',
          reference: merchantId,
        }),
      });

      const resJson = await res.json();
      if (resJson.success) {
        // Success! Reload session using AuthContext refresh helper
        await refreshSession();
      } else {
        alert(resJson.error || 'payment gateway simulation failed.');
      }
    } catch (e: any) {
      alert(e.message || 'Payment simulation failed.');
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading || checkingProfile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (activeRole !== 'merchant') {
    return <Redirect href="/(customer)" />;
  }

  // Gateway subscription gate blocker
  if (user?.merchant_status !== 'active') {
    return (
      <View style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <View style={styles.gateIconBg}>
            <Ionicons name="lock-closed" size={28} color="#EF4444" />
          </View>
          <Text style={styles.gateTitle}>Activate Store Console</Text>
          <Text style={styles.gateSubtitle}>
            Your merchant console is currently pending subscription setup. Subscribe to Pro to start issuing stamps and scan member rewards.
          </Text>

          <View style={styles.pricingSection}>
            <Text style={styles.pricingLabel}>PRO MERCHANT PLAN</Text>
            <View style={styles.pricingRow}>
              <Text style={styles.currency}>RM</Text>
              <Text style={styles.price}>99</Text>
              <Text style={styles.period}>/month</Text>
            </View>
            <Text style={styles.periodDetail}>Billed securely via Chip-in. Cancel anytime.</Text>
          </View>

          <TouchableOpacity
            style={styles.payBtn}
            onPress={handleSimulatePayment}
            disabled={isPaying}
            activeOpacity={0.8}
          >
            {isPaying ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="card-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.payBtnText}>Pay & Activate Store</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.logoutLink}
            onPress={logout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutLinkText}>Log Out Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
              <div id="onboarding-map" style={{ width: '100%', height: '100%' }} />
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
        tabBar={(props) => <CustomMerchantTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="customers" />
        <Tabs.Screen name="give" />
        <Tabs.Screen name="marketing" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="staff" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mobileTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    height: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#9CA3AF',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  floatingBtnWrap: {
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
    height: 64,
    width: 64,
  },
  floatingBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#000000', // Black brand styling
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
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
    shadowColor: '#000000',
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
    backgroundColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
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
    backgroundColor: '#000000',
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
    color: '#000000',
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
    borderColor: '#000000',
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
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
});
