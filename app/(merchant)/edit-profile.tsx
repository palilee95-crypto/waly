import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  Switch,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'expo-router';
import { handleSmartBack } from '@/lib/navigation';
import { pb } from '@/lib/pocketbase';
import AllCategoriesModal, { ALL_CATEGORIES_LIST, CategoryItemType } from '../(customer)/_components/AllCategoriesModal';

function mapSubCategoryToBase(subId: string): 'food' | 'retail' | 'beauty' | 'health' | 'entertainment' | 'other' {
  switch (subId) {
    case 'cafe':
    case 'restaurant':
    case 'dessert':
    case 'beverage':
      return 'food';
    case 'barber':
    case 'beauty':
    case 'spa':
    case 'muslimah_spa':
      return 'beauty';
    case 'gym':
    case 'sports':
    case 'optician':
      return 'health';
    case 'laundry':
    case 'boutique':
    case 'groceries':
    case 'florist':
      return 'retail';
    case 'studio':
      return 'entertainment';
    default:
      return 'other';
  }
}

export default function EditProfileScreen() {
  const { user, isOwner, staffPermissions } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [merchant, setMerchant] = useState<any>(null);
  const [locationRecord, setLocationRecord] = useState<any>(null);

  // Form States
  const [storeName, setStoreName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [monthlySalesGoal, setMonthlySalesGoal] = useState('10000');
  const [inactiveThresholdDays, setInactiveThresholdDays] = useState('30');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('dessert');
  const [lat, setLat] = useState('6.2443');
  const [lng, setLng] = useState('100.4217');

  const currentCatObj = ALL_CATEGORIES_LIST.find((c) => c.id === selectedCategoryId) || ALL_CATEGORIES_LIST[0];

  const getFullAddress = () => {
    const parts = [
      address.trim(),
      [postcode.trim(), city.trim()].filter(Boolean).join(' '),
      stateName.trim(),
    ].filter(Boolean);
    return parts.join(', ');
  };

  const currentThresholdDays = parseInt(inactiveThresholdDays, 10) || 30;

  const handleDecrementThresholdDays = () => {
    const cur = parseInt(inactiveThresholdDays, 10) || 30;
    const nextVal = Math.max(7, cur - 5);
    setInactiveThresholdDays(String(nextVal));
  };

  const handleIncrementThresholdDays = () => {
    const cur = parseInt(inactiveThresholdDays, 10) || 30;
    const nextVal = Math.min(180, cur + 5);
    setInactiveThresholdDays(String(nextVal));
  };

  // Media
  const [logoFile, setLogoFile] = useState<any>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<any>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Operating Hours
  const [monHours, setMonHours] = useState('08:00 - 22:00');
  const [monClosed, setMonClosed] = useState(false);
  const [tueHours, setTueHours] = useState('08:00 - 22:00');
  const [tueClosed, setTueClosed] = useState(false);
  const [wedHours, setWedHours] = useState('08:00 - 22:00');
  const [wedClosed, setWedClosed] = useState(false);
  const [thuHours, setThuHours] = useState('08:00 - 22:00');
  const [thuClosed, setThuClosed] = useState(false);
  const [friHours, setFriHours] = useState('08:00 - 22:00');
  const [friClosed, setFriClosed] = useState(false);
  const [satHours, setSatHours] = useState('09:00 - 23:00');
  const [satClosed, setSatClosed] = useState(false);
  const [sunHours, setSunHours] = useState('09:00 - 21:00');
  const [sunClosed, setSunClosed] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const mapRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);

  // Leaflet Map Injection and Management (Web Only)
  useEffect(() => {
    if (Platform.OS !== 'web' || loading) return;
    
    // Inject Leaflet Stylesheet if not already present
    let link = document.getElementById('leaflet-css') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Inject custom grayscale map and custom marker styles
    let customStyle = document.getElementById('leaflet-custom-style') as HTMLStyleElement;
    if (!customStyle) {
      customStyle = document.createElement('style');
      customStyle.id = 'leaflet-custom-style';
      customStyle.innerHTML = `
        .leaflet-container img.leaflet-tile {
          filter: grayscale(100%) contrast(0.88) brightness(1.04);
        }
        .custom-yellow-pin {
          background: none;
          border: none;
        }
        .leaflet-bar {
          border: none !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
          border-radius: 8px !important;
          overflow: hidden;
        }
        .leaflet-bar a {
          background-color: #FFFFFF !important;
          color: #050505 !important;
          border: none !important;
          border-bottom: 1px solid #F1F5F9 !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
          font-size: 16px !important;
          transition: all 0.2s ease;
        }
        .leaflet-bar a:last-child {
          border-bottom: none !important;
        }
        .leaflet-bar a:hover {
          background-color: #F8FAFC !important;
          color: #FFC700 !important;
        }
      `;
      document.head.appendChild(customStyle);
    }

    function initMap() {
      const L = (window as any).L;
      if (!L) return;

      const mapDiv = document.getElementById('store-edit-map');
      if (!mapDiv) return;

      const startLat = parseFloat(lat) || 6.2443;
      const startLng = parseFloat(lng) || 100.4217;

      try {
        const mapInstance = L.map('store-edit-map', { attributionControl: false }).setView([startLat, startLng], 14);
        mapRef.current = mapInstance;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(mapInstance);

        // Custom Yellow Marker Pin HTML
        const yellowPinHtml = `
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50% 50% 50% 0;
            background: #FFC700;
            position: absolute;
            transform: rotate(-45deg);
            left: 50%;
            top: 50%;
            margin: -12px 0 0 -12px;
            border: 2px solid #050505;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
          ">
            <div style="
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #050505;
              margin: 6px 0 0 6px;
            "></div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-yellow-pin',
          html: yellowPinHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 24]
        });

        let marker = L.marker([startLat, startLng], { 
          draggable: true,
          icon: customIcon
        }).addTo(mapInstance);
        markerRef.current = marker;

        marker.on('dragend', function (event: any) {
          const position = marker.getLatLng();
          setLat(position.lat.toFixed(6));
          setLng(position.lng.toFixed(6));
        });

        mapInstance.on('click', function (event: any) {
          const latlng = event.latlng;
          marker.setLatLng(latlng);
          setLat(latlng.lat.toFixed(6));
          setLng(latlng.lng.toFixed(6));
        });

        // Trigger resize event to render correctly
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 200);
      } catch (err) {
        console.warn("Leaflet initialization warning:", err);
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [loading]);

  // Reactive updates from coords inputs or GPS locator button
  useEffect(() => {
    if (Platform.OS === 'web' && mapRef.current && markerRef.current) {
      const lVal = parseFloat(lat);
      const gVal = parseFloat(lng);
      if (!isNaN(lVal) && !isNaN(gVal)) {
        const currentLatLng = markerRef.current.getLatLng();
        if (currentLatLng.lat.toFixed(6) !== lVal.toFixed(6) || currentLatLng.lng.toFixed(6) !== gVal.toFixed(6)) {
          mapRef.current.setView([lVal, gVal], 14);
          markerRef.current.setLatLng([lVal, gVal]);
        }
      }
    }
  }, [lat, lng]);

  const handleUseGPS = () => {
    if (Platform.OS === 'web') {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const currentLat = position.coords.latitude.toFixed(6);
            const currentLng = position.coords.longitude.toFixed(6);
            setLat(currentLat);
            setLng(currentLng);
          },
          (error) => {
            Alert.alert('GPS Error', 'Failed to retrieve current location.');
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      } else {
        Alert.alert('Not Supported', 'Geolocation is not supported by your browser.');
      }
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLat(position.coords.latitude.toFixed(6));
            setLng(position.coords.longitude.toFixed(6));
          },
          (error) => {
            Alert.alert('GPS Error', 'Failed to retrieve current location.');
          }
        );
      } else {
        Alert.alert('Not Supported', 'GPS is not available on this device.');
      }
    }
  };

  const fetchProfileData = async () => {
    if (!user?.merchant_id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // 1. Fetch merchant
      const mRec = await pb.collection('merchants').getOne(user.merchant_id);
      setMerchant(mRec);

      // Populate merchant fields
      setStoreName(mRec.name || '');
      setBusinessEmail(mRec.metadata?.email || mRec.website || user.email || '');
      setPhoneNumber(mRec.metadata?.phone || user.phone || '');
      setMonthlySalesGoal(String(mRec.metadata?.monthly_sales_goal || '10000'));
      setInactiveThresholdDays(String(mRec.inactive_threshold_days || '30'));
      setAddress(mRec.metadata?.street_address || mRec.description || '');
      setPostcode(mRec.metadata?.postcode || '');
      setCity(mRec.metadata?.city || '');
      setStateName(mRec.metadata?.state || '');
      const rawSubCat = mRec.metadata?.sub_category || mRec.category || 'dessert';
      const matchedCat = ALL_CATEGORIES_LIST.find((c) => c.id === rawSubCat || c.id === mRec.category);
      if (matchedCat) {
        setSelectedCategoryId(matchedCat.id);
      } else {
        if (rawSubCat === 'food') {
          setSelectedCategoryId(mRec.name?.toLowerCase().includes('cream') ? 'dessert' : 'cafe');
        } else if (rawSubCat === 'beauty') {
          setSelectedCategoryId('beauty');
        } else {
          setSelectedCategoryId('cafe');
        }
      }

      const logoUrl = mRec.logo 
        ? `${pb.baseUrl}/api/files/merchants/${mRec.id}/${mRec.logo}`
        : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200';
      setLogoPreview(logoUrl);

      const bannerUrl = mRec.banner 
        ? `${pb.baseUrl}/api/files/merchants/${mRec.id}/${mRec.banner}`
        : null;
      setBannerPreview(bannerUrl);

      // 2. Fetch location
      const locList = await pb.collection('store_locations').getFullList({
        filter: `merchant = "${user.merchant_id}"`
      });

      if (locList.length > 0) {
        const loc = locList[0];
        setLocationRecord(loc);
        setLat(String(loc.lat || '6.2443'));
        setLng(String(loc.lng || '100.4217'));
        // The stored location city is the source of truth — don't let the metadata
        // default overwrite it.
        if (loc.city) setCity(loc.city);

        // Parse hours
        const hours = loc.hours || {};
        const parseDay = (day: string, defaultVal: string) => {
          const val = hours[day] || defaultVal;
          return {
            closedVal: val === 'Closed',
            hoursStr: val === 'Closed' ? defaultVal : val,
          };
        };

        const mon = parseDay('Monday', '08:00 - 22:00');
        setMonHours(mon.hoursStr);
        setMonClosed(mon.closedVal);

        const tue = parseDay('Tuesday', '08:00 - 22:00');
        setTueHours(tue.hoursStr);
        setTueClosed(tue.closedVal);

        const wed = parseDay('Wednesday', '08:00 - 22:00');
        setWedHours(wed.hoursStr);
        setWedClosed(wed.closedVal);

        const thu = parseDay('Thursday', '08:00 - 22:00');
        setThuHours(thu.hoursStr);
        setThuClosed(thu.closedVal);

        const fri = parseDay('Friday', '08:00 - 22:00');
        setFriHours(fri.hoursStr);
        setFriClosed(fri.closedVal);

        const sat = parseDay('Saturday', '09:00 - 23:00');
        setSatHours(sat.hoursStr);
        setSatClosed(sat.closedVal);

        const sun = parseDay('Sunday', '09:00 - 21:00');
        setSunHours(sun.hoursStr);
        setSunClosed(sun.closedVal);
      }
    } catch (err) {
      console.warn("Failed to load profile data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = () => {
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

  const handlePickBanner = () => {
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
              const MAX_WIDTH = 800;
              const MAX_HEIGHT = 450;
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
                  const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_banner.jpg", {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  setBannerFile(compressedFile);
                  setBannerPreview(URL.createObjectURL(compressedFile));
                }
              }, 'image/jpeg', 0.8);
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

  const handleSave = async () => {
    if (!storeName.trim()) {
      Alert.alert('Validation Error', 'Store Name is required.');
      return;
    }
    if (!businessEmail.trim()) {
      Alert.alert('Validation Error', 'Business Email is required.');
      return;
    }

    setIsSaving(true);
    try {
      const fullAddress = getFullAddress();

      const formData = new FormData();
      formData.append('name', storeName.trim());
      const baseCat = mapSubCategoryToBase(selectedCategoryId);
      formData.append('category', baseCat);
      formData.append('description', fullAddress || address.trim());
      
      const updatedMetadata = {
        ...(merchant?.metadata || {}),
        sub_category: selectedCategoryId,
        sub_category_name: currentCatObj?.name || 'Store',
        street_address: address.trim(),
        postcode: postcode.trim(),
        city: city.trim(),
        state: stateName.trim(),
        full_address: fullAddress,
        phone: phoneNumber.trim(),
        email: businessEmail.trim(),
        monthly_sales_goal: parseFloat(monthlySalesGoal) || 10000,
      };
      formData.append('metadata', JSON.stringify(updatedMetadata));
      formData.append('inactive_threshold_days', String(parseInt(inactiveThresholdDays) || 30));

      if (logoFile) {
        formData.append('logo', logoFile);
      }
      if (bannerFile) {
        formData.append('banner', bannerFile);
      }

      const updatedMerchant = await pb.collection('merchants').update(merchant.id, formData);

      // Sync locations and hours
      const latVal = parseFloat(lat) || 0;
      const lngVal = parseFloat(lng) || 0;

      const updatedHours = {
        "Monday": monClosed ? "Closed" : monHours.trim(),
        "Tuesday": tueClosed ? "Closed" : tueHours.trim(),
        "Wednesday": wedClosed ? "Closed" : wedHours.trim(),
        "Thursday": thuClosed ? "Closed" : thuHours.trim(),
        "Friday": friClosed ? "Closed" : friHours.trim(),
        "Saturday": satClosed ? "Closed" : satHours.trim(),
        "Sunday": sunClosed ? "Closed" : sunHours.trim(),
      };

      if (locationRecord) {
        await pb.collection('store_locations').update(locationRecord.id, {
          address: fullAddress || address.trim(),
          city: city.trim(),
          phone: phoneNumber.trim(),
          lat: latVal,
          lng: lngVal,
          hours: updatedHours,
        });
      } else {
        await pb.collection('store_locations').create({
          merchant: merchant.id,
          name: 'Main Outlet',
          address: fullAddress || address.trim(),
          city: city.trim(),
          country: 'Malaysia',
          phone: phoneNumber.trim(),
          hours: updatedHours,
          lat: latVal,
          lng: lngVal,
          is_active: true
        });
      }

      setShowSuccessModal(true);
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Failed to update store profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFC700" />
      </View>
    );
  }

  if (!isOwner && !staffPermissions?.can_edit_store_profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBackBtn} 
            onPress={() => handleSmartBack(router, '/(merchant)/profile')} 
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#000000" />
            <Text style={styles.headerBackText}>{locale === 'en' ? 'Profile' : 'Profil'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>{t('edit_store_profile')}</Text>
          <View style={{ width: 70 }} />
        </View>

        <View style={styles.lockedContainer}>
          <View style={styles.lockedIconBg}>
            <Ionicons name="lock-closed" size={32} color="#000000" />
          </View>
          <Text style={styles.lockedTitle}>
            {locale === 'en' ? 'Store Profile Editing Locked' : 'Sunting Profil Kedai Dikunci'}
          </Text>
          <Text style={styles.lockedSubtitle}>
            {locale === 'en'
              ? 'This section is restricted by the store owner. You do not have permission to modify store information, logos, or operating hours.'
              : 'Bahagian ini dikunci oleh pemilik kedai. Anda tidak mempunyai kebenaran untuk mengubah maklumat kedai, logo, atau waktu operasi.'}
          </Text>
          <TouchableOpacity
            style={styles.lockedBackBtn}
            onPress={() => router.replace('/(merchant)/profile' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.lockedBackBtnText}>
              {locale === 'en' ? 'Return to Profile' : 'Kembali ke Profil'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Apple Pure White Sticky Header Bar ── */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerBackBtn} 
          onPress={() => handleSmartBack(router, '/(merchant)/profile')} 
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#000000" />
          <Text style={styles.headerBackText}>{locale === 'en' ? 'Profile' : 'Profil'}</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleText} numberOfLines={1}>
            {t('edit_store_profile')}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.headerSavePill, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFCC00" />
          ) : (
            <>
              <Ionicons name="checkmark-sharp" size={13} color="#FFCC00" />
              <Text style={styles.headerSaveText}>{t('save')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && { maxWidth: 740, alignSelf: 'center', width: '100%' }
        ]}
      >
        {/* ── 1. Hero Storefront Live Preview Card ── */}
        <View style={styles.heroCard}>
          {/* Banner Image Frame */}
          <TouchableOpacity 
            style={styles.heroBannerPicker} 
            onPress={handlePickBanner} 
            activeOpacity={0.9}
          >
            {bannerPreview ? (
              <Image source={{ uri: bannerPreview }} style={styles.heroBannerImage} />
            ) : (
              <View style={styles.heroBannerPlaceholder}>
                <Ionicons name="image-outline" size={26} color="#94A3B8" />
                <Text style={styles.heroBannerPlaceholderText}>
                  {locale === 'en' ? 'Tap to upload store banner photo' : 'Ketik untuk muat naik banner kedai'}
                </Text>
              </View>
            )}
            <View style={styles.heroBannerChip}>
              <Ionicons name="camera" size={11} color="#FFFFFF" />
              <Text style={styles.heroBannerChipText}>
                {locale === 'en' ? 'Change Cover' : 'Tukar Banner'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Overlapping Avatar Logo & Live Meta */}
          <View style={styles.heroProfileRow}>
            <TouchableOpacity 
              style={styles.heroAvatarPicker} 
              onPress={handlePickImage} 
              activeOpacity={0.9}
            >
              {logoPreview ? (
                <Image source={{ uri: logoPreview }} style={styles.heroAvatarImage} />
              ) : (
                <View style={[styles.heroAvatarImage, { backgroundColor: '#FFCC00', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="storefront" size={28} color="#000000" />
                </View>
              )}
              <View style={styles.heroAvatarCameraBadge}>
                <Ionicons name="camera" size={11} color="#000000" />
              </View>
            </TouchableOpacity>

            <View style={styles.heroInfoCol}>
              <Text style={styles.heroStoreName} numberOfLines={1}>
                {storeName.trim() || merchant?.name || 'Your Store Name'}
              </Text>
              <View style={styles.heroMetaRow}>
                <View style={[styles.heroCategoryPill, { backgroundColor: currentCatObj?.bg || '#F1F5F9' }]}>
                  <Text style={[styles.heroCategoryPillText, { color: currentCatObj?.color || '#0F172A' }]}>
                    {currentCatObj?.name?.toUpperCase() || 'STORE'}
                  </Text>
                </View>
                <Text style={styles.heroAddressText} numberOfLines={1}>
                  {getFullAddress() || (locale === 'en' ? 'No address set' : 'Alamat belum ditetapkan')}
                </Text>
              </View>
            </View>
          </View>

          {/* Micro Reassurance Banner */}
          <View style={styles.heroHelperRow}>
            <Ionicons name="eye-outline" size={13} color="#64748B" />
            <Text style={styles.heroHelperText}>
              {locale === 'en' 
                ? 'Live preview of your storefront appearance seen by customers.' 
                : 'Pratonton langsung profil kedai yang dilihat oleh pelanggan.'}
            </Text>
          </View>
        </View>

        {/* ── 2. Inset Group 1: Store Identity ── */}
        <Text style={styles.groupHeaderLabel}>
          {locale === 'en' ? 'STORE IDENTITY' : 'IDENTITI KEDAI'}
        </Text>
        <View style={styles.groupedCard}>
          {/* Store Name Input */}
          <View style={styles.inputItem}>
            <Text style={styles.inputItemLabel}>{t('store_name')}</Text>
            <View style={styles.inputFieldWrapper}>
              <Ionicons name="storefront-outline" size={17} color="#64748B" style={styles.inputFieldIcon} />
              <TextInput
                style={styles.textInputWithIcon}
                value={storeName}
                onChangeText={setStoreName}
                placeholder={locale === 'en' ? 'Enter official store name' : 'Masukkan nama rasmi kedai'}
                placeholderTextColor="#94A3B8"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Business Category Card Selector (Option 1) */}
          <View style={styles.inputItem}>
            <Text style={styles.inputItemLabel}>{t('store_category')}</Text>
            <TouchableOpacity
              style={styles.categorySelectCard}
              onPress={() => setShowCategoryModal(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.categorySelectIconBox, { backgroundColor: currentCatObj?.bg || '#FEF9C3' }]}>
                <Ionicons name={(currentCatObj?.icon as any) || 'storefront'} size={20} color={currentCatObj?.color || '#0F172A'} />
              </View>
              <View style={styles.categorySelectMetaCol}>
                <Text style={styles.categorySelectNameText} numberOfLines={1}>
                  {currentCatObj?.name || 'Select Category'}
                </Text>
                <Text style={styles.categorySelectGroupText} numberOfLines={1}>
                  {currentCatObj?.group} • {locale === 'en' ? 'Tap to change' : 'Ketik untuk tukar'}
                </Text>
              </View>
              <View style={styles.categoryChangePill}>
                <Text style={styles.categoryChangePillText}>
                  {locale === 'en' ? 'Change' : 'Tukar'}
                </Text>
                <Ionicons name="chevron-forward" size={13} color="#64748B" />
              </View>
            </TouchableOpacity>
            <Text style={styles.inputItemHelper}>
              {locale === 'en'
                ? 'Decides where your store appears in customer searches, discover filters, and automated reward matches.'
                : 'Menentukan kedudukan cawangan anda dalam carian pelanggan, penapis teroka, dan padanan ganjaran.'}
            </Text>
          </View>

          <View style={styles.cardDivider} />

          {/* Full Street Address (Alamat Jalan / Lot) */}
          <View style={styles.inputItem}>
            <Text style={styles.inputItemLabel}>
              {locale === 'en' ? 'Street Address (Premises / Lot)' : 'Alamat Premis (Jalan / Lot)'}
            </Text>
            <View style={styles.inputFieldWrapper}>
              <Ionicons name="location-outline" size={17} color="#64748B" style={styles.inputFieldIcon} />
              <TextInput
                style={styles.textInputWithIcon}
                value={address}
                onChangeText={setAddress}
                placeholder={locale === 'en' ? 'e.g. No 6, Kampung Padang' : 'cth. No 6, Kampung Padang'}
                placeholderTextColor="#94A3B8"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>
          </View>

          {/* Postcode & City Row (2 Columns) */}
          <View style={styles.addressDualRow}>
            {/* Postcode */}
            <View style={[styles.inputItem, { flex: 1 }]}>
              <Text style={styles.inputItemLabel}>
                {locale === 'en' ? 'Postcode' : 'Poskod'}
              </Text>
              <View style={styles.inputFieldWrapper}>
                <Ionicons name="mail-unread-outline" size={16} color="#64748B" style={styles.inputFieldIcon} />
                <TextInput
                  style={styles.textInputWithIcon}
                  value={postcode}
                  onChangeText={(val) => setPostcode(val.replace(/\D/g, '').slice(0, 5))}
                  placeholder="06000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={5}
                  {...Platform.select({
                    web: { outlineStyle: 'none' } as any,
                  })}
                />
              </View>
            </View>

            {/* City */}
            <View style={[styles.inputItem, { flex: 1.4, marginLeft: 10 }]}>
              <Text style={styles.inputItemLabel}>
                {locale === 'en' ? 'City / Area' : 'Bandar / Kawasan'}
              </Text>
              <View style={styles.inputFieldWrapper}>
                <Ionicons name="business-outline" size={16} color="#64748B" style={styles.inputFieldIcon} />
                <TextInput
                  style={styles.textInputWithIcon}
                  value={city}
                  onChangeText={setCity}
                  placeholder={locale === 'en' ? 'e.g. Jitra' : 'cth. Jitra'}
                  placeholderTextColor="#94A3B8"
                  {...Platform.select({
                    web: { outlineStyle: 'none' } as any,
                  })}
                />
              </View>
            </View>
          </View>

          {/* State / Negeri */}
          <View style={styles.inputItem}>
            <Text style={styles.inputItemLabel}>
              {locale === 'en' ? 'State' : 'Negeri'}
            </Text>
            <View style={styles.inputFieldWrapper}>
              <Ionicons name="map-outline" size={16} color="#64748B" style={styles.inputFieldIcon} />
              <TextInput
                style={styles.textInputWithIcon}
                value={stateName}
                onChangeText={setStateName}
                placeholder={locale === 'en' ? 'e.g. Kedah' : 'cth. Kedah'}
                placeholderTextColor="#94A3B8"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>
          </View>
        </View>

        {/* ── 3. Inset Group 2: Contact & Communications ── */}
        <Text style={styles.groupHeaderLabel}>
          {locale === 'en' ? 'CONTACT & NOTIFICATIONS' : 'HUBUNGAN & NOTIFIKASI'}
        </Text>
        <View style={styles.groupedCard}>
          {/* Business Email */}
          <View style={styles.inputItem}>
            <Text style={styles.inputItemLabel}>{t('business_email')}</Text>
            <View style={styles.inputFieldWrapper}>
              <Ionicons name="mail-outline" size={17} color="#64748B" style={styles.inputFieldIcon} />
              <TextInput
                style={styles.textInputWithIcon}
                value={businessEmail}
                onChangeText={setBusinessEmail}
                placeholder="store@example.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>
            <Text style={styles.inputItemHelper}>
              {locale === 'en' 
                ? 'Used for automated billing summaries, monthly reports, and merchant alerts.' 
                : 'Digunakan untuk ringkasan bil, laporan bulanan, dan notifikasi keselamatan.'}
            </Text>
          </View>

          <View style={styles.cardDivider} />

          {/* Phone Number */}
          <View style={styles.inputItem}>
            <Text style={styles.inputItemLabel}>{t('phone_number')}</Text>
            <View style={styles.inputFieldWrapper}>
              <Ionicons name="call-outline" size={17} color="#64748B" style={styles.inputFieldIcon} />
              <TextInput
                style={styles.textInputWithIcon}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+60123456789"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>
            <Text style={styles.inputItemHelper}>
              {locale === 'en' 
                ? 'Official contact number for customer inquiries and WhatsApp receipts.' 
                : 'Nombor rasmi kedai untuk pertanyaan pelanggan dan resit digital WhatsApp.'}
            </Text>
          </View>
        </View>

        {/* ── 4. Inset Group 3: Business Goals & Loyalty Rules ── */}
        <Text style={styles.groupHeaderLabel}>
          {locale === 'en' ? 'BUSINESS GOALS & LOYALTY' : 'SASARAN BISNES & KESETIAAN'}
        </Text>
        <View style={styles.groupedCard}>
          {/* Monthly Sales Goal */}
          <View style={styles.inputItem}>
            <Text style={styles.inputItemLabel}>{t('monthly_sales_goal')}</Text>
            <View style={styles.inputFieldWrapper}>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyBadgeText}>RM</Text>
              </View>
              <TextInput
                style={styles.textInputWithIcon}
                value={monthlySalesGoal}
                onChangeText={setMonthlySalesGoal}
                placeholder="10000"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>
            <Text style={styles.inputItemHelper}>
              {locale === 'en' 
                ? 'Sets the progress benchmark on your executive revenue dashboard.' 
                : 'Menetapkan penanda aras kemajuan pada papan pemuka hasil bulanan anda.'}
            </Text>
          </View>

          <View style={styles.cardDivider} />

          {/* Customer Win-Back Alert (Minimalist & Compact Standard Design) */}
          <View style={styles.inputItem}>
            <View style={styles.compactLabelRow}>
              <Text style={styles.inputItemLabel}>
                {locale === 'en' ? 'Customer Win-Back Alert' : 'Had Amaran Pelanggan Sepi'}
              </Text>
              <Text style={styles.compactRecommendedText}>
                {locale === 'en' ? 'Default: 30 days' : 'Piawaian: 30 hari'}
              </Text>
            </View>

            <View style={styles.inputFieldWrapper}>
              <Ionicons name="time-outline" size={17} color="#64748B" style={styles.inputFieldIcon} />
              <TextInput
                style={styles.textInputWithIcon}
                value={inactiveThresholdDays}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '');
                  setInactiveThresholdDays(cleaned);
                }}
                placeholder="30"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                maxLength={3}
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />

              <Text style={styles.inputInlineUnit}>
                {locale === 'en' ? 'Days' : 'Hari'}
              </Text>

              {/* Minimalist In-Field Stepper Pill */}
              <View style={styles.compactStepperPill}>
                <TouchableOpacity
                  style={[styles.compactStepperBtn, currentThresholdDays <= 7 && styles.compactStepperBtnDisabled]}
                  onPress={handleDecrementThresholdDays}
                  disabled={currentThresholdDays <= 7}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Ionicons name="remove" size={13} color={currentThresholdDays <= 7 ? '#CBD5E1' : '#0F172A'} />
                </TouchableOpacity>

                <View style={styles.compactStepperDivider} />

                <TouchableOpacity
                  style={[styles.compactStepperBtn, currentThresholdDays >= 180 && styles.compactStepperBtnDisabled]}
                  onPress={handleIncrementThresholdDays}
                  disabled={currentThresholdDays >= 180}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Ionicons name="add" size={13} color={currentThresholdDays >= 180 ? '#CBD5E1' : '#0F172A'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Subtle Minimalist Quick Chips */}
            <View style={styles.compactChipsRow}>
              {[
                { days: '14', label: '14d (F&B)' },
                { days: '30', label: '30d ★' },
                { days: '60', label: '60d' },
                { days: '90', label: '90d' },
              ].map((chip) => {
                const isActive = inactiveThresholdDays === chip.days;
                return (
                  <TouchableOpacity
                    key={chip.days}
                    style={[styles.compactChip, isActive && styles.compactChipActive]}
                    onPress={() => setInactiveThresholdDays(chip.days)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.compactChipText, isActive && styles.compactChipTextActive]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputItemHelper}>
              {locale === 'en' 
                ? 'Customers without visits in this period will be flagged for re-engagement perks.' 
                : 'Pelanggan yang tidak berkunjung dalam tempoh ini akan ditandakan untuk promosi semula.'}
            </Text>
          </View>
        </View>

        {/* ── 5. Inset Group 4: Daily Operating Hours ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.groupHeaderLabel}>
            {locale === 'en' ? 'DAILY OPERATING HOURS' : 'WAKTU OPERASI HARIAN'}
          </Text>
        </View>

        <View style={styles.groupedCard}>
          <Text style={[styles.inputItemHelper, { marginBottom: 12 }]}>
            {locale === 'en' 
              ? 'Specify your opening and closing hours. Toggle closed if your outlet is not operating on that day.' 
              : 'Tetapkan waktu buka dan tutup cawangan anda. Tutup togol jika cawangan tidak beroperasi pada hari tersebut.'}
          </Text>

          {[
            { dayKey: 'monday', dayName: t('monday'), hours: monHours, setHours: setMonHours, closed: monClosed, setClosed: setMonClosed },
            { dayKey: 'tuesday', dayName: t('tuesday'), hours: tueHours, setHours: setTueHours, closed: tueClosed, setClosed: setTueClosed },
            { dayKey: 'wednesday', dayName: t('wednesday'), hours: wedHours, setHours: setWedHours, closed: wedClosed, setClosed: setWedClosed },
            { dayKey: 'thursday', dayName: t('thursday'), hours: thuHours, setHours: setThuHours, closed: thuClosed, setClosed: setThuClosed },
            { dayKey: 'friday', dayName: t('friday'), hours: friHours, setHours: setFriHours, closed: friClosed, setClosed: setFriClosed },
            { dayKey: 'saturday', dayName: t('saturday'), hours: satHours, setHours: setSatHours, closed: satClosed, setClosed: setSatClosed },
            { dayKey: 'sunday', dayName: t('sunday'), hours: sunHours, setHours: setSunHours, closed: sunClosed, setClosed: setSunClosed },
          ].map((item, idx) => (
            <View key={item.dayKey}>
              <View style={styles.operatingHoursRow}>
                <Text style={styles.operatingDayText}>{item.dayName}</Text>
                
                <View style={styles.operatingToggleWrap}>
                  <Text style={[styles.operatingToggleLabel, item.closed && { color: '#EF4444' }]}>
                    {item.closed ? t('closed') : (locale === 'en' ? 'Open' : 'Buka')}
                  </Text>
                  <Switch
                    value={!item.closed}
                    onValueChange={(val) => item.setClosed(!val)}
                    trackColor={{ false: '#E2E8F0', true: '#FFCC00' }}
                    thumbColor="#FFFFFF"
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>

                <View style={{ width: 130 }}>
                  {!item.closed ? (
                    <TextInput
                      style={styles.operatingTimeInput}
                      value={item.hours}
                      onChangeText={item.setHours}
                      placeholder="08:00 - 22:00"
                      placeholderTextColor="#94A3B8"
                      {...Platform.select({
                        web: { outlineStyle: 'none' } as any,
                      })}
                    />
                  ) : (
                    <View style={styles.operatingClosedBadge}>
                      <Text style={styles.operatingClosedBadgeText}>{t('closed')}</Text>
                    </View>
                  )}
                </View>
              </View>
              {idx < 6 && <View style={styles.cardDivider} />}
            </View>
          ))}
        </View>

        {/* ── 6. Inset Group 5: Store Map & GPS Location ── */}
        <View style={[styles.sectionHeaderRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={styles.groupHeaderLabel}>
            {locale === 'en' ? 'STORE MAP & GPS PIN' : 'LOKASI PETA & GPS'}
          </Text>
          <TouchableOpacity 
            onPress={handleUseGPS}
            style={styles.gpsDetectBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={12} color="#FFCC00" />
            <Text style={styles.gpsDetectBtnText}>
              {locale === 'en' ? 'Detect My GPS' : 'Kesan Lokasi GPS'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.groupedCard}>
          <View style={styles.coordsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputItemLabel}>{t('latitude')}</Text>
              <View style={styles.inputFieldWrapper}>
                <Ionicons name="compass-outline" size={16} color="#64748B" style={styles.inputFieldIcon} />
                <TextInput
                  style={styles.textInputWithIcon}
                  value={lat}
                  onChangeText={setLat}
                  placeholder="6.2443"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  {...Platform.select({
                    web: { outlineStyle: 'none' } as any,
                  })}
                />
              </View>
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.inputItemLabel}>{t('longitude')}</Text>
              <View style={styles.inputFieldWrapper}>
                <Ionicons name="compass-outline" size={16} color="#64748B" style={styles.inputFieldIcon} />
                <TextInput
                  style={styles.textInputWithIcon}
                  value={lng}
                  onChangeText={setLng}
                  placeholder="100.4217"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  {...Platform.select({
                    web: { outlineStyle: 'none' } as any,
                  })}
                />
              </View>
            </View>
          </View>

          {/* Leaflet Map Div (Web Only) */}
          {Platform.OS === 'web' && (
            <View style={styles.mapContainer}>
              <div id="store-edit-map" style={{ width: '100%', height: '100%' }} />
            </View>
          )}

          <Text style={[styles.inputItemHelper, { marginTop: 10 }]}>
            {locale === 'en'
              ? 'Tap anywhere on the map or drag the pin to set your exact storefront coordinates.'
              : 'Ketik pada peta atau seret pin untuk menetapkan koordinat tepat premis anda.'}
          </Text>
        </View>

        {/* ── 7. Redundant Bottom Actions (For Long Scroll Closure) ── */}
        <View style={styles.bottomActionsRow}>
          <TouchableOpacity 
            style={styles.bottomCancelBtn} 
            onPress={() => handleSmartBack(router, '/(merchant)/profile')} 
            disabled={isSaving}
            activeOpacity={0.75}
          >
            <Text style={styles.bottomCancelBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.bottomSaveBtn, isSaving && { opacity: 0.7 }]} 
            onPress={handleSave} 
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFCC00" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-sharp" size={17} color="#FFCC00" style={{ marginRight: 6 }} />
                <Text style={styles.bottomSaveBtnText}>
                  {locale === 'en' ? 'Save Profile Changes' : 'Simpan Perubahan'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Premium Custom Success Modal ── */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-sharp" size={26} color="#000000" />
            </View>
            <Text style={styles.successModalTitle}>
              {locale === 'en' ? 'Store Profile Updated' : 'Profil Kedai Dikemas Kini'}
            </Text>
            <Text style={styles.successModalMessage}>
              {locale === 'en' 
                ? 'Your store identity, contact info, and business settings have been successfully saved.' 
                : 'Maklumat identiti, nombor hubungan, dan tetapan kedai anda telah berjaya disimpan.'}
            </Text>
            <TouchableOpacity
              style={styles.successModalBtn}
              onPress={() => {
                setShowSuccessModal(false);
                handleSmartBack(router, '/(merchant)/profile');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.successModalBtnText}>
                {locale === 'en' ? 'Done' : 'Selesai'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── All 20 Categories Modal Sheet (Option 2 Implementation) ── */}
      <AllCategoriesModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSelectCategory={(catId) => setSelectedCategoryId(catId)}
        mode="merchant"
        selectedCategoryId={selectedCategoryId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  // ── Apple Pure White Sticky Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 20,
  },
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingRight: 8,
  },
  headerBackText: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitleText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.2,
  },
  headerSavePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#000000',
    paddingHorizontal: 15,
    paddingVertical: 7.5,
    borderRadius: 99,
  },
  headerSaveText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
    letterSpacing: 0.3,
  },
  // ── Scroll Content ──
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 10,
  },
  // ── Hero Storefront Live Preview Card ──
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroBannerPicker: {
    width: '100%',
    height: 145,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  heroBannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroBannerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroBannerPlaceholderText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  heroBannerChip: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroBannerChipText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  heroProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: -26,
    paddingHorizontal: 8,
  },
  heroAvatarPicker: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  heroAvatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroInfoCol: {
    flex: 1,
    paddingTop: 24,
    gap: 2,
  },
  heroStoreName: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.2,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  heroCategoryPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  heroCategoryPillText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  heroAddressText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    flex: 1,
  },
  heroHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 4,
  },
  heroHelperText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    flex: 1,
  },
  // ── Inset Grouped Cards ──
  groupHeaderLabel: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  groupedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  inputItem: {
    gap: 5,
  },
  addressDualRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputItemLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  inputItemHelper: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
  },
  inputFieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputFieldIcon: {
    marginRight: 8,
  },
  textInputWithIcon: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
  },
  currencyBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  currencyBadgeText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
  },
  unitBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6,
  },
  unitBadgeText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  // ── Customer Win-Back (Compact Minimalist Standard Design) ──
  compactLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  compactRecommendedText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  inputInlineUnit: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginRight: 8,
  },
  compactStepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 28,
    paddingHorizontal: 2,
  },
  compactStepperBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactStepperBtnDisabled: {
    opacity: 0.3,
  },
  compactStepperDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#E2E8F0',
  },
  compactChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  compactChip: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  compactChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  compactChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  compactChipTextActive: {
    color: '#FFCC00',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  // ── Business Category Card (Option 1) ──
  categorySelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 12,
    marginTop: 2,
  },
  categorySelectIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySelectMetaCol: {
    flex: 1,
    gap: 2,
  },
  categorySelectNameText: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  categorySelectGroupText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  categoryChangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 99,
  },
  categoryChangePillText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  // ── Operating Hours ──
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  operatingHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  operatingDayText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    width: 85,
  },
  operatingToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  operatingToggleLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#15803D',
    minWidth: 32,
  },
  operatingTimeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
    textAlign: 'center',
  },
  operatingClosedBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatingClosedBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  // ── Map & GPS ──
  gpsDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#000000',
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 99,
  },
  gpsDetectBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapContainer: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  // ── Bottom Redundant Actions ──
  bottomActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 40,
  },
  bottomCancelBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCancelBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  bottomSaveBtn: {
    flex: 2,
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  bottomSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.3,
  },
  // ── Locked State ──
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  lockedIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  lockedSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 360,
    marginBottom: 24,
  },
  lockedBackBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  lockedBackBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
  },
  // ── Success Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  successIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginBottom: 8,
  },
  successModalMessage: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  successModalBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
});
