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
import { handleSmartBack } from '@/lib/navigation';
import { pb } from '@/lib/pocketbase';
import { ALL_CATEGORIES_LIST, CategoryItemType } from '../(customer)/_components/AllCategoriesModal';

const BRAND_COLOR_OPTIONS = [
  { id: 'gold', name: 'Risev Gold', hex: '#FFC700', bg: '#FFFBEA', text: '#000000' },
  { id: 'berry', name: 'Berry Gelato', hex: '#FF6B8B', bg: '#FFF0F3', text: '#FFFFFF' },
  { id: 'emerald', name: 'Matcha Green', hex: '#10B981', bg: '#ECFDF5', text: '#FFFFFF' },
  { id: 'ocean', name: 'Ocean Sapphire', hex: '#0284C7', bg: '#F0F9FF', text: '#FFFFFF' },
  { id: 'obsidian', name: 'Midnight Obsidian', hex: '#18181B', bg: '#F4F4F5', text: '#FFFFFF' },
];

const POPULAR_CITIES = [
  'Jitra, Kedah',
  'Alor Setar, Kedah',
  'Sungai Petani, Kedah',
  'Kulim, Kedah',
  'George Town, Penang',
  'Bayan Lepas, Penang',
  'Ipoh, Perak',
  'Kuala Lumpur',
  'Petaling Jaya, Selangor',
  'Shah Alam, Selangor',
  'Subang Jaya, Selangor',
  'Bangi, Selangor',
  'Johor Bahru, Johor',
  'Melaka',
  'Kota Bharu, Kelantan',
  'Kuantan, Pahang',
];

const CATEGORY_GROUPS = [
  { id: 'all', label: 'All (20)' },
  { id: 'fnb', label: 'F&B & Cafe', ids: ['cafe', 'restaurant', 'dessert', 'beverage'] },
  { id: 'beauty', label: 'Beauty & Spa', ids: ['barber', 'beauty', 'spa', 'muslimah_spa'] },
  { id: 'auto_tech', label: 'Auto & Tech', ids: ['carwash', 'workshop', 'gadget'] },
  { id: 'retail_services', label: 'Services & Retail', ids: ['groceries', 'boutique', 'laundry', 'optician', 'florist', 'pet', 'gym', 'sports', 'studio', 'other'] },
];

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

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [merchant, setMerchant] = useState<any>(null);
  const [locationRecord, setLocationRecord] = useState<any>(null);

  // Form States (Aligned with 3-Step Onboarding)
  const [storeName, setStoreName] = useState('');
  const [tagline, setTagline] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [monthlySalesGoal, setMonthlySalesGoal] = useState('10000');
  const [inactiveThresholdDays, setInactiveThresholdDays] = useState('30');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Jitra, Kedah');
  const [category, setCategory] = useState<'food' | 'retail' | 'beauty' | 'health' | 'entertainment' | 'other'>('food');
  const [selectedCatGroup, setSelectedCatGroup] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('cafe');
  const [selectedBrandColor, setSelectedBrandColor] = useState('#FFC700');
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

  const handleApplyPreset = (preset: 'daily' | 'weekday_sat') => {
    if (preset === 'daily') {
      setMonHours('10:00 AM - 10:00 PM'); setMonClosed(false);
      setTueHours('10:00 AM - 10:00 PM'); setTueClosed(false);
      setWedHours('10:00 AM - 10:00 PM'); setWedClosed(false);
      setThuHours('10:00 AM - 10:00 PM'); setThuClosed(false);
      setFriHours('10:00 AM - 10:00 PM'); setFriClosed(false);
      setSatHours('10:00 AM - 10:00 PM'); setSatClosed(false);
      setSunHours('10:00 AM - 10:00 PM'); setSunClosed(false);
    } else if (preset === 'weekday_sat') {
      setMonHours('09:00 AM - 07:00 PM'); setMonClosed(false);
      setTueHours('09:00 AM - 07:00 PM'); setTueClosed(false);
      setWedHours('09:00 AM - 07:00 PM'); setWedClosed(false);
      setThuHours('09:00 AM - 07:00 PM'); setThuClosed(false);
      setFriHours('09:00 AM - 07:00 PM'); setFriClosed(false);
      setSatHours('09:00 AM - 07:00 PM'); setSatClosed(false);
      setSunHours('10:00 AM - 07:00 PM'); setSunClosed(true);
    }
  };

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

      // Populate merchant fields (aligned with onboarding)
      setStoreName(mRec.name || '');
      setTagline(mRec.metadata?.tagline || '');
      setBusinessEmail(mRec.metadata?.email || mRec.website || user.email || '');
      setPhoneNumber(mRec.metadata?.phone || user.phone || '');
      setGoogleReviewUrl(mRec.google_review_url || '');
      setSelectedBrandColor(mRec.pwa_brand_color || '#FFC700');
      setMonthlySalesGoal(String(mRec.metadata?.monthly_sales_goal || '10000'));
      setInactiveThresholdDays(String(mRec.inactive_threshold_days || '30'));

      // Category synchronization
      if (mRec.metadata?.sub_category) {
        setSelectedCategoryId(mRec.metadata.sub_category);
        setCategory(mapSubCategoryToBase(mRec.metadata.sub_category));
      } else if (mRec.category) {
        setCategory(mRec.category);
        const match = ALL_CATEGORIES_LIST.find((c) => mapSubCategoryToBase(c.id) === mRec.category);
        if (match) setSelectedCategoryId(match.id);
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
        setAddress(loc.address || mRec.description || '');
        setCity(loc.city || 'Jitra, Kedah');
        setLat(String(loc.lat || '6.2443'));
        setLng(String(loc.lng || '100.4217'));

        // Parse hours (supporting both object format {open, close, closed} and string format "08:00 - 22:00")
        const hours = loc.hours || {};
        const parseDay = (fullDay: string, shortDay: string, defaultVal: string) => {
          const raw = hours[fullDay] ?? hours[shortDay] ?? hours[fullDay.toLowerCase()];
          if (!raw) return { closedVal: false, hoursStr: defaultVal };
          if (typeof raw === 'object') {
            const isClosed = raw.closed !== undefined ? !!raw.closed : false;
            const open = raw.open || '08:00';
            const close = raw.close || '22:00';
            return {
              closedVal: isClosed,
              hoursStr: `${open} - ${close}`,
            };
          }
          if (typeof raw === 'string') {
            const isClosed = raw.trim().toLowerCase() === 'closed';
            return {
              closedVal: isClosed,
              hoursStr: isClosed ? defaultVal : raw.trim(),
            };
          }
          return { closedVal: false, hoursStr: defaultVal };
        };

        const mon = parseDay('Monday', 'mon', '08:00 - 22:00');
        setMonHours(mon.hoursStr);
        setMonClosed(mon.closedVal);

        const tue = parseDay('Tuesday', 'tue', '08:00 - 22:00');
        setTueHours(tue.hoursStr);
        setTueClosed(tue.closedVal);

        const wed = parseDay('Wednesday', 'wed', '08:00 - 22:00');
        setWedHours(wed.hoursStr);
        setWedClosed(wed.closedVal);

        const thu = parseDay('Thursday', 'thu', '08:00 - 22:00');
        setThuHours(thu.hoursStr);
        setThuClosed(thu.closedVal);

        const fri = parseDay('Friday', 'fri', '08:00 - 22:00');
        setFriHours(fri.hoursStr);
        setFriClosed(fri.closedVal);

        const sat = parseDay('Saturday', 'sat', '09:00 - 23:00');
        setSatHours(sat.hoursStr);
        setSatClosed(sat.closedVal);

        const sun = parseDay('Sunday', 'sun', '09:00 - 21:00');
        setSunHours(sun.hoursStr);
        setSunClosed(sun.closedVal);
      } else {
        setAddress(mRec.description || '');
        setCity('Jitra, Kedah');
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
      const selectedCatObj = ALL_CATEGORIES_LIST.find((c) => c.id === selectedCategoryId);
      const baseCategory = mapSubCategoryToBase(selectedCategoryId);

      const formData = new FormData();
      formData.append('name', storeName.trim());
      formData.append('category', baseCategory);
      formData.append('description', address.trim());
      formData.append('pwa_brand_color', selectedBrandColor);
      if (googleReviewUrl.trim()) {
        formData.append('google_review_url', googleReviewUrl.trim());
      }
      
      const updatedMetadata = {
        ...(merchant?.metadata || {}),
        sub_category: selectedCategoryId,
        sub_category_name: selectedCatObj?.name || 'Store',
        icon: selectedCatObj?.icon || 'storefront',
        tagline: tagline.trim(),
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
      setMerchant(updatedMerchant);

      // Sync locations and hours
      const latVal = parseFloat(lat) || 0;
      const lngVal = parseFloat(lng) || 0;

      const parseTimeRange = (str: string, defaultOpen: string, defaultClose: string) => {
        if (!str || !str.includes('-')) return { open: defaultOpen, close: defaultClose };
        const parts = str.split('-').map((s) => s.trim());
        return {
          open: parts[0] || defaultOpen,
          close: parts[1] || defaultClose,
        };
      };

      const monTimes = parseTimeRange(monHours, '08:00', '22:00');
      const tueTimes = parseTimeRange(tueHours, '08:00', '22:00');
      const wedTimes = parseTimeRange(wedHours, '08:00', '22:00');
      const thuTimes = parseTimeRange(thuHours, '08:00', '22:00');
      const friTimes = parseTimeRange(friHours, '08:00', '22:00');
      const satTimes = parseTimeRange(satHours, '09:00', '23:00');
      const sunTimes = parseTimeRange(sunHours, '09:00', '21:00');

      const updatedHours = {
        // Human string format (backwards compatible)
        "Monday": monClosed ? "Closed" : monHours.trim(),
        "Tuesday": tueClosed ? "Closed" : tueHours.trim(),
        "Wednesday": wedClosed ? "Closed" : wedHours.trim(),
        "Thursday": thuClosed ? "Closed" : thuHours.trim(),
        "Friday": friClosed ? "Closed" : friHours.trim(),
        "Saturday": satClosed ? "Closed" : satHours.trim(),
        "Sunday": sunClosed ? "Closed" : sunHours.trim(),

        // Structured format (used by onboarding and explore)
        mon: { open: monTimes.open, close: monTimes.close, closed: monClosed },
        tue: { open: tueTimes.open, close: tueTimes.close, closed: tueClosed },
        wed: { open: wedTimes.open, close: wedTimes.close, closed: wedClosed },
        thu: { open: thuTimes.open, close: thuTimes.close, closed: thuClosed },
        fri: { open: friTimes.open, close: friTimes.close, closed: friClosed },
        sat: { open: satTimes.open, close: satTimes.close, closed: satClosed },
        sun: { open: sunTimes.open, close: sunTimes.close, closed: sunClosed },
      };

      if (locationRecord) {
        const updatedLoc = await pb.collection('store_locations').update(locationRecord.id, {
          name: storeName.trim(),
          address: address.trim(),
          city: city.trim(),
          country: 'Malaysia',
          phone: phoneNumber.trim(),
          lat: latVal,
          lng: lngVal,
          hours: updatedHours,
        });
        setLocationRecord(updatedLoc);
      } else {
        const createdLoc = await pb.collection('store_locations').create({
          merchant: merchant.id,
          name: storeName.trim() || 'Main Outlet',
          address: address.trim(),
          city: city.trim() || 'Jitra, Kedah',
          country: 'Malaysia',
          phone: phoneNumber.trim(),
          hours: updatedHours,
          lat: latVal,
          lng: lngVal,
          is_active: true
        });
        setLocationRecord(createdLoc);
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={styles.backBtn} onPress={() => handleSmartBack(router, '/(merchant)/profile')} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('edit_store_profile')}</Text>
          </View>
          <Image
            source={require('../../assets/risev logo.png')}
            style={{ width: 80, height: 26, resizeMode: 'contain', tintColor: '#FFFFFF' }}
          />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F8FAFC' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="lock-closed" size={30} color="#D97706" />
          </View>
          <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 8, textAlign: 'center' }}>
            {locale === 'en' ? 'Store Profile Editing Locked' : 'Sunting Profil Kedai Dikunci'}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 20, maxWidth: 360, marginBottom: 24 }}>
            {locale === 'en'
              ? 'This section is locked by your store owner. You do not have permission to modify store information, logos, or operating hours.'
              : 'Bahagian ini dikunci oleh pemilik kedai. Anda tidak mempunyai kebenaran untuk mengubah maklumat kedai, logo, atau waktu operasi.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => router.replace('/(merchant)/profile' as any)}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 }}>
              {locale === 'en' ? 'Go Back to Profile' : 'Kembali ke Profil'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const selectedCatObj = ALL_CATEGORIES_LIST.find((c) => c.id === selectedCategoryId);
  const filteredCategories = ALL_CATEGORIES_LIST.filter((cat) => {
    if (selectedCatGroup === 'all') return true;
    const grp = CATEGORY_GROUPS.find((g) => g.id === selectedCatGroup);
    return grp?.ids ? grp.ids.includes(cat.id) : true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Custom Header Bar */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => handleSmartBack(router, '/(merchant)/profile')} activeOpacity={0.8}>
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
          <Text style={styles.inputLabel}>{t('store_name')} *</Text>
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

        {/* Store Tagline Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>STORE TAGLINE (OPTIONAL)</Text>
          <View style={styles.inputFieldWrapper}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
            <TextInput
              style={styles.textInputWithIcon}
              value={tagline}
              onChangeText={setTagline}
              placeholder="e.g. Gentlemen Cuts & Hot Towel Shave"
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          </View>
        </View>

        {/* Business Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('business_email')} *</Text>
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

        {/* Google Review URL */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>GOOGLE REVIEW LINK (OPTIONAL)</Text>
          <View style={styles.inputFieldWrapper}>
            <Ionicons name="star" size={18} color="#F59E0B" style={styles.inputFieldIcon} />
            <TextInput
              style={styles.textInputWithIcon}
              placeholder="https://g.page/r/your-google-business/review"
              placeholderTextColor="#94A3B8"
              value={googleReviewUrl}
              onChangeText={setGoogleReviewUrl}
              autoCapitalize="none"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          </View>
          <Text style={styles.fieldHint}>Encourage customers who tap their card to leave a 5-star Google review for bonus rewards.</Text>
        </View>

        {/* Inactive Customer Threshold Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Inactive Customer Threshold (Days)</Text>
          <View style={styles.inputFieldWrapper}>
            <Ionicons name="time-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
            <TextInput
              style={styles.textInputWithIcon}
              value={inactiveThresholdDays}
              onChangeText={setInactiveThresholdDays}
              placeholder="e.g. 30"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
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

        {/* Category Selector Input (Aligned with 3-Step Onboarding) */}
        <View style={[styles.inputContainer, { marginTop: 14 }]}>
          <Text style={styles.inputLabel}>CHOOSE YOUR BUSINESS CATEGORY *</Text>
          <Text style={styles.categorySubText}>
            Aligned with 3-step onboarding. Sets where you appear in customer search, discover tabs, and filter tags.
          </Text>

          {/* Currently Selected Category Summary Card */}
          {selectedCatObj && (
            <View style={styles.selectedCategorySummary}>
              <View style={[styles.categoryIconCircle, { backgroundColor: selectedCatObj.bg }]}>
                <Ionicons name={selectedCatObj.icon as any} size={20} color={selectedCatObj.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.selectedCatTitle}>{selectedCatObj.name}</Text>
                <Text style={styles.selectedCatSubtitle}>{selectedCatObj.group} • Base: {mapSubCategoryToBase(selectedCatObj.id).toUpperCase()}</Text>
              </View>
              <View style={styles.activePillBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={styles.activePillText}>Active</Text>
              </View>
            </View>
          )}

          {/* Category Group Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catGroupScroll}
          >
            {CATEGORY_GROUPS.map((grp) => {
              const isActive = selectedCatGroup === grp.id;
              return (
                <TouchableOpacity
                  key={grp.id}
                  style={[styles.catGroupPill, isActive && styles.catGroupPillActive]}
                  onPress={() => setSelectedCatGroup(grp.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catGroupPillText, isActive && styles.catGroupPillTextActive]}>
                    {grp.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Category Grid */}
          <View style={styles.categoryGrid}>
            {filteredCategories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedCategoryId(cat.id);
                    setCategory(mapSubCategoryToBase(cat.id));
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.categoryIconCircle, { backgroundColor: cat.bg }]}>
                    <Ionicons name={cat.icon as any} size={18} color={cat.color} />
                  </View>
                  <Text
                    style={[
                      styles.categoryCardLabel,
                      isSelected && styles.categoryCardLabelSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {cat.name}
                  </Text>

                  {isSelected ? (
                    <View style={styles.selectedCheckBadge}>
                      <Ionicons name="checkmark" size={12} color="#000000" />
                    </View>
                  ) : (
                    <View style={styles.unselectedRadio} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Primary Brand Accent Color (Aligned with Onboarding Step 1) */}
        <View style={[styles.inputContainer, { marginTop: 14 }]}>
          <Text style={styles.inputLabel}>PRIMARY BRAND ACCENT COLOR</Text>
          <Text style={styles.categorySubText}>
            Applied to your stamp card, storefront buttons, and highlights.
          </Text>

          <View style={styles.brandColorRow}>
            {BRAND_COLOR_OPTIONS.map((col) => {
              const isChosen = selectedBrandColor === col.hex;
              return (
                <TouchableOpacity
                  key={col.id}
                  style={[
                    styles.brandColorPill,
                    isChosen && styles.brandColorPillActive,
                  ]}
                  onPress={() => setSelectedBrandColor(col.hex)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.brandColorDot, { backgroundColor: col.hex }]} />
                  <Text
                    style={[
                      styles.brandColorName,
                      isChosen && { fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' },
                    ]}
                  >
                    {col.name}
                  </Text>
                  {isChosen && <Ionicons name="checkmark" size={14} color="#0F172A" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Address Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('address')} *</Text>
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

        {/* City / Area Input with Quick Pick Chips */}
        <View style={[styles.inputContainer, { marginTop: 6 }]}>
          <Text style={styles.inputLabel}>CITY / AREA *</Text>
          <View style={styles.inputFieldWrapper}>
            <Ionicons name="business-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
            <TextInput
              style={styles.textInputWithIcon}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Jitra, Kedah"
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          </View>

          <Text style={[styles.categorySubText, { marginTop: 8 }]}>Quick pick popular cities:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityChipsScroll}
          >
            {POPULAR_CITIES.map((c) => {
              const isSelected = city === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.cityChip, isSelected && styles.cityChipActive]}
                  onPress={() => setCity(c)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="location-sharp"
                    size={12}
                    color={isSelected ? '#000000' : '#64748B'}
                  />
                  <Text style={[styles.cityChipText, isSelected && styles.cityChipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Daily Operating Hours Section */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="time" size={18} color="#050505" />
          <Text style={styles.sectionLabel}>{t('operating_hours')}</Text>
        </View>

        {/* Operating Hours Quick Presets (Aligned with Onboarding Step 2) */}
        <View style={styles.presetRow}>
          <TouchableOpacity
            style={styles.presetBtn}
            onPress={() => handleApplyPreset('daily')}
            activeOpacity={0.8}
          >
            <Text style={styles.presetBtnText}>
              ⚡ Everyday (10am–10pm)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetBtn}
            onPress={() => handleApplyPreset('weekday_sat')}
            activeOpacity={0.8}
          >
            <Text style={styles.presetBtnText}>
              🏢 Mon–Sat (Sun Off)
            </Text>
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleSmartBack(router, '/(merchant)/profile')} disabled={isSaving}>
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
                handleSmartBack(router, '/(merchant)/profile');
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
  categorySubText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 16,
  },
  selectedCategorySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  selectedCatTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  selectedCatSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  activePillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  activePillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#059669',
  },
  catGroupScroll: {
    gap: 6,
    paddingBottom: 10,
  },
  catGroupPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catGroupPillActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  catGroupPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  catGroupPillTextActive: {
    color: '#FFFFFF',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryCardSelected: {
    borderColor: '#FFC700',
    backgroundColor: '#FFFBEB',
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardLabel: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginLeft: 8,
  },
  categoryCardLabelSelected: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  selectedCheckBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselectedRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  brandColorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  brandColorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  brandColorPillActive: {
    backgroundColor: '#FFFBEA',
    borderColor: '#FFC700',
  },
  brandColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  brandColorName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  cityChipsScroll: {
    gap: 6,
    marginTop: 6,
    paddingBottom: 4,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#F1F5F9',
  },
  cityChipActive: {
    backgroundColor: '#FFC700',
  },
  cityChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  cityChipTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  presetBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
  },
  fieldHint: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 4,
    paddingHorizontal: 2,
    lineHeight: 16,
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
