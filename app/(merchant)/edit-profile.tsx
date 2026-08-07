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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';

export default function EditProfileScreen() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [merchant, setMerchant] = useState<any>(null);
  const [locationRecord, setLocationRecord] = useState<any>(null);

  // Form States
  const [storeName, setStoreName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [monthlySalesGoal, setMonthlySalesGoal] = useState('10000');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<'food' | 'retail' | 'beauty' | 'health' | 'entertainment' | 'other'>('food');
  const [lat, setLat] = useState('6.2443');
  const [lng, setLng] = useState('100.4217');

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

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors, © CARTO'
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
    if (!user?.merchant_id) return;
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
      setAddress(mRec.description || '');
      setCategory(mRec.category || 'food');

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
      const formData = new FormData();
      formData.append('name', storeName.trim());
      formData.append('category', category);
      formData.append('description', address.trim());
      
      const updatedMetadata = {
        ...(merchant?.metadata || {}),
        phone: phoneNumber.trim(),
        email: businessEmail.trim(),
        monthly_sales_goal: parseFloat(monthlySalesGoal) || 10000,
      };
      formData.append('metadata', JSON.stringify(updatedMetadata));

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
          address: address.trim(),
          phone: phoneNumber.trim(),
          lat: latVal,
          lng: lngVal,
          hours: updatedHours,
        });
      } else {
        await pb.collection('store_locations').create({
          merchant: merchant.id,
          name: 'Main Outlet',
          address: address.trim(),
          city: 'Jitra',
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Custom Header Bar */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('edit_store_profile')}</Text>
        </View>
        <Image
          source={require('../../assets/risev logo.png')}
          style={{ width: 80, height: 26, resizeMode: 'contain', tintColor: '#FFFFFF' }}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Scrolling Black Header Background */}
        <View style={styles.scrollHeaderBg} />

        {/* Unified Cover & Logo Header Picker */}
        <View style={styles.coverHeaderContainer}>
          {/* Banner Image Frame */}
          <TouchableOpacity 
            style={styles.coverBannerPicker} 
            onPress={handlePickBanner} 
            activeOpacity={0.9}
          >
            {bannerPreview ? (
              <Image source={{ uri: bannerPreview }} style={styles.coverBannerImage} />
            ) : (
              <View style={styles.coverBannerPlaceholder}>
                <Ionicons name="image-outline" size={24} color="#94A3B8" />
                <Text style={styles.coverBannerPlaceholderText}>
                  {locale === 'en' ? 'Tap to upload background banner' : 'Ketik untuk memuat naik banner'}
                </Text>
              </View>
            )}
            <View style={styles.coverBannerCameraIcon}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* Floating Logo Overlay Container */}
          <View style={styles.coverLogoWrapper}>
            <TouchableOpacity 
              style={styles.coverLogoPicker} 
              onPress={handlePickImage} 
              activeOpacity={0.9}
            >
              <View style={{ width: '100%', height: '100%', borderRadius: 45, overflow: 'hidden' }}>
                {logoPreview ? (
                  <Image source={{ uri: logoPreview }} style={styles.coverLogoImage} />
                ) : (
                  <View style={[styles.coverLogoImage, { backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="storefront-outline" size={24} color="#94A3B8" />
                  </View>
                )}
              </View>
              <View style={styles.coverLogoCameraIcon}>
                <Ionicons name="camera" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Helper Tooltip Info */}
        <View style={[styles.infoRow, { marginTop: 4, marginBottom: 16, alignSelf: 'center', paddingHorizontal: 12 }]}>
          <Ionicons name="information-circle-outline" size={13} color="#64748B" />
          <Text style={[styles.infoText, { textAlign: 'center' }]}>
            {locale === 'en' 
              ? 'This previews your actual store profile appearance. Tap banner or logo circle to change.' 
              : 'Imej ini menunjukkan rupa profil kedai sebenar anda. Ketik banner atau logo untuk menukar.'}
          </Text>
        </View>

        {/* Store Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('store_name')}</Text>
          <View style={styles.inputFieldWrapper}>
            <Ionicons name="storefront-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
            <TextInput
              style={styles.textInputWithIcon}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Enter store name"
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          </View>
        </View>

        {/* Business Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('business_email')}</Text>
          <View style={styles.inputFieldWrapper}>
            <Ionicons name="mail-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
            <TextInput
              style={styles.textInputWithIcon}
              value={businessEmail}
              onChangeText={setBusinessEmail}
              placeholder={t('business_email')}
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType="email-address"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          </View>
        </View>

        {/* Phone Number Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('phone_number')}</Text>
          <View style={styles.inputFieldWrapper}>
            <Ionicons name="call-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
            <TextInput
              style={styles.textInputWithIcon}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder={t('phone_number')}
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          </View>
        </View>

        {/* Monthly Sales Goal Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('monthly_sales_goal')}</Text>
          <View style={styles.inputFieldWrapper}>
            <Ionicons name="cash-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
            <TextInput
              style={styles.textInputWithIcon}
              value={monthlySalesGoal}
              onChangeText={setMonthlySalesGoal}
              placeholder="e.g. 10000"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          </View>
        </View>

        {/* Category Selector Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('store_category')}</Text>
          <View style={styles.categoryChipsRow}>
            {[
              { id: 'food' },
              { id: 'retail' },
              { id: 'beauty' },
              { id: 'health' },
              { id: 'entertainment' },
              { id: 'other' },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  category === cat.id && styles.categoryChipActive,
                ]}
                onPress={() => setCategory(cat.id as any)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.categoryChipText,
                  category === cat.id && styles.categoryChipTextActive
                ]}>
                  {t(cat.id)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Address Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('address')}</Text>
          <View style={styles.inputFieldWrapper}>
            <Ionicons name="location-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
            <TextInput
              style={styles.textInputWithIcon}
              value={address}
              onChangeText={setAddress}
              placeholder={t('address')}
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          </View>
        </View>

        {/* Daily Operating Hours Section */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="time" size={18} color="#050505" />
          <Text style={styles.sectionLabel}>{t('operating_hours')}</Text>
        </View>

        <View style={styles.hoursCardList}>
          {/* Monday */}
          <View style={styles.compactHoursRow}>
            <Text style={styles.compactDayLabel}>{t('monday')}</Text>
            <View style={styles.compactClosedWrap}>
              <Text style={styles.compactClosedText}>{t('closed')}</Text>
              <Switch
                value={monClosed}
                onValueChange={setMonClosed}
                trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
            <View style={{ flex: 1 }}>
              {!monClosed ? (
                <TextInput
                  style={styles.compactTimeInput}
                  value={monHours}
                  onChangeText={setMonHours}
                  placeholder="08:00 - 22:00"
                  placeholderTextColor="#94A3B8"
                />
              ) : (
                <View style={[styles.compactTimeInput, styles.compactDisabledInput]}>
                  <Text style={styles.compactDisabledInputText}>{t('closed')}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Tuesday */}
          <View style={styles.compactHoursRow}>
            <Text style={styles.compactDayLabel}>{t('tuesday')}</Text>
            <View style={styles.compactClosedWrap}>
              <Text style={styles.compactClosedText}>{t('closed')}</Text>
              <Switch
                value={tueClosed}
                onValueChange={setTueClosed}
                trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
            <View style={{ flex: 1 }}>
              {!tueClosed ? (
                <TextInput
                  style={styles.compactTimeInput}
                  value={tueHours}
                  onChangeText={setTueHours}
                  placeholder="08:00 - 22:00"
                  placeholderTextColor="#94A3B8"
                />
              ) : (
                <View style={[styles.compactTimeInput, styles.compactDisabledInput]}>
                  <Text style={styles.compactDisabledInputText}>{t('closed')}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Wednesday */}
          <View style={styles.compactHoursRow}>
            <Text style={styles.compactDayLabel}>{t('wednesday')}</Text>
            <View style={styles.compactClosedWrap}>
              <Text style={styles.compactClosedText}>{t('closed')}</Text>
              <Switch
                value={wedClosed}
                onValueChange={setWedClosed}
                trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
            <View style={{ flex: 1 }}>
              {!wedClosed ? (
                <TextInput
                  style={styles.compactTimeInput}
                  value={wedHours}
                  onChangeText={setWedHours}
                  placeholder="08:00 - 22:00"
                  placeholderTextColor="#94A3B8"
                />
              ) : (
                <View style={[styles.compactTimeInput, styles.compactDisabledInput]}>
                  <Text style={styles.compactDisabledInputText}>{t('closed')}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Thursday */}
          <View style={styles.compactHoursRow}>
            <Text style={styles.compactDayLabel}>{t('thursday')}</Text>
            <View style={styles.compactClosedWrap}>
              <Text style={styles.compactClosedText}>{t('closed')}</Text>
              <Switch
                value={thuClosed}
                onValueChange={setThuClosed}
                trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
            <View style={{ flex: 1 }}>
              {!thuClosed ? (
                <TextInput
                  style={styles.compactTimeInput}
                  value={thuHours}
                  onChangeText={setThuHours}
                  placeholder="08:00 - 22:00"
                  placeholderTextColor="#94A3B8"
                />
              ) : (
                <View style={[styles.compactTimeInput, styles.compactDisabledInput]}>
                  <Text style={styles.compactDisabledInputText}>{t('closed')}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Friday */}
          <View style={styles.compactHoursRow}>
            <Text style={styles.compactDayLabel}>{t('friday')}</Text>
            <View style={styles.compactClosedWrap}>
              <Text style={styles.compactClosedText}>{t('closed')}</Text>
              <Switch
                value={friClosed}
                onValueChange={setFriClosed}
                trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
            <View style={{ flex: 1 }}>
              {!friClosed ? (
                <TextInput
                  style={styles.compactTimeInput}
                  value={friHours}
                  onChangeText={setFriHours}
                  placeholder="08:00 - 22:00"
                  placeholderTextColor="#94A3B8"
                />
              ) : (
                <View style={[styles.compactTimeInput, styles.compactDisabledInput]}>
                  <Text style={styles.compactDisabledInputText}>{t('closed')}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Saturday */}
          <View style={styles.compactHoursRow}>
            <Text style={styles.compactDayLabel}>{t('saturday')}</Text>
            <View style={styles.compactClosedWrap}>
              <Text style={styles.compactClosedText}>{t('closed')}</Text>
              <Switch
                value={satClosed}
                onValueChange={setSatClosed}
                trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
            <View style={{ flex: 1 }}>
              {!satClosed ? (
                <TextInput
                  style={styles.compactTimeInput}
                  value={satHours}
                  onChangeText={setSatHours}
                  placeholder="09:00 - 23:00"
                  placeholderTextColor="#94A3B8"
                />
              ) : (
                <View style={[styles.compactTimeInput, styles.compactDisabledInput]}>
                  <Text style={styles.compactDisabledInputText}>{t('closed')}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Sunday */}
          <View style={styles.compactHoursRow}>
            <Text style={styles.compactDayLabel}>{t('sunday')}</Text>
            <View style={styles.compactClosedWrap}>
              <Text style={styles.compactClosedText}>{t('closed')}</Text>
              <Switch
                value={sunClosed}
                onValueChange={setSunClosed}
                trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
            <View style={{ flex: 1 }}>
              {!sunClosed ? (
                <TextInput
                  style={styles.compactTimeInput}
                  value={sunHours}
                  onChangeText={setSunHours}
                  placeholder="09:00 - 21:00"
                  placeholderTextColor="#94A3B8"
                />
              ) : (
                <View style={[styles.compactTimeInput, styles.compactDisabledInput]}>
                  <Text style={styles.compactDisabledInputText}>{t('closed')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Coordinates & Map Pin */}
        <View style={[styles.sectionHeaderRow, { justifyContent: 'space-between', width: '100%' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="compass" size={18} color="#050505" />
            <Text style={styles.sectionLabel}>{t('map_location_coords')}</Text>
          </View>
          <TouchableOpacity 
            onPress={handleUseGPS}
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 4, 
              backgroundColor: '#EFF6FF', 
              borderWidth: 1,
              borderColor: '#DBEAFE',
              paddingHorizontal: 12, 
              paddingVertical: 6, 
              borderRadius: 20,
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="location" size={12} color="#2563EB" />
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#2563EB' }}>
              {locale === 'en' ? 'Detect Location' : 'Kesan Lokasi'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hoursCardList}>
          <View style={styles.hoursInputsRow}>
            <View style={[styles.inputContainer, { flex: 1, marginVertical: 0 }]}>
              <Text style={[styles.inputLabel, { fontSize: 10, color: '#64748B' }]}>{t('latitude')}</Text>
              <TextInput
                style={[styles.textInput, { fontSize: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF' }]}
                value={lat}
                onChangeText={setLat}
                placeholder="e.g. 6.2443"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 10, marginVertical: 0 }]}>
              <Text style={[styles.inputLabel, { fontSize: 10, color: '#64748B' }]}>{t('longitude')}</Text>
              <TextInput
                style={[styles.textInput, { fontSize: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF' }]}
                value={lng}
                onChangeText={setLng}
                placeholder="e.g. 100.4217"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>
          </View>

          {/* Leaflet Map Div (Web Only) */}
          {Platform.OS === 'web' && (
            <View style={{ width: '100%', height: 220, borderRadius: 12, overflow: 'hidden', marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div id="store-edit-map" style={{ width: '100%', height: '100%' }} />
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={isSaving}>
            <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#050505" />
            ) : (
              <Text style={styles.saveBtnText}>{t('save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Premium Custom Success Modal */}
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
              <Ionicons name="checkmark" size={28} color="#050505" />
            </View>
            <Text style={styles.successModalTitle}>
              {locale === 'en' ? 'Success' : 'Berjaya'}
            </Text>
            <Text style={styles.successModalMessage}>
              {locale === 'en' ? 'Successfully updated your information!' : 'Berjaya mengemas kini maklumat anda!'}
            </Text>
            <TouchableOpacity
              style={styles.successModalBtn}
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.successModalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  scrollHeaderBg: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    height: 170,
    backgroundColor: '#050505',
    zIndex: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#050505',
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  coverHeaderContainer: {
    width: '100%',
    height: 185,
    position: 'relative',
    marginBottom: 40,
    marginTop: 18,
  },
  coverBannerPicker: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  coverBannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverBannerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
  },
  coverBannerPlaceholderText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  coverBannerCameraIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(5, 5, 5, 0.65)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  coverLogoWrapper: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: -45,
    zIndex: 10,
    borderRadius: 45,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  coverLogoPicker: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    position: 'relative',
  },
  coverLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  coverLogoCameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFC700',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    flex: 1,
  },
  inputContainer: {
    width: '100%',
    marginVertical: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#F1F5F9',
  },
  categoryChipActive: {
    backgroundColor: '#FFC700',
  },
  categoryChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#050505',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hoursCardList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    marginBottom: 8,
  },
  compactHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  compactDayLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
    width: 80,
  },
  compactClosedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginRight: 10,
  },
  compactClosedText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  compactTimeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    textAlign: 'center',
  },
  compactDisabledInput: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactDisabledInputText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    textTransform: 'uppercase',
  },
  hoursInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  saveBtn: {
    flex: 1.5,
    backgroundColor: '#FFC700',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#050505',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 8,
  },
  successModalMessage: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  successModalBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
