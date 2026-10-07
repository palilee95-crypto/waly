import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
  Image,
  Clipboard,
  Share,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { pb } from '@/lib/pocketbase';
import { colors, radii } from '@/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { handleSmartBack } from '@/lib/navigation';
import * as ImagePicker from 'expo-image-picker';
import BookingAccessModal from './_components/BookingAccessModal';

interface BookingItem {
  id: string;
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  start_time: string;
  end_time?: string;
  status: 'booked' | 'arrived' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
  items_summary?: any;
  total_price: number;
  notes?: string;
  staff_name?: string;
  service_name?: string;
}

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  duration_minutes: number;
  item_type: 'service' | 'class' | 'product' | 'addon';
  is_active: boolean;
  image_url?: string;
}

function getContrastColor(hexColor: string): string {
  if (!hexColor || typeof hexColor !== 'string') return '#000000';
  const hex = hexColor.replace('#', '').trim();
  if (hex.length !== 6) return '#000000';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#000000';
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 150 ? '#000000' : '#FFFFFF';
}

function isObsidianDark(hexColor?: string | null): boolean {
  if (!hexColor || typeof hexColor !== 'string') return false;
  let hex = hexColor.trim().replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 130;
}

const COLOR_PALETTES = [
  { id: 'gold', name: 'Risev Gold', primary: '#FFC700', bg: '#FFFBEA', border: '#FEF08A', text: '#0F172A', checkmark: '#B45309' },
  { id: 'berry', name: 'Gelato Berry', primary: '#FF6B8B', bg: '#FFF0F3', border: '#FFD6E0', text: '#881337', checkmark: '#FF6B8B' },
  { id: 'mocha', name: 'Warm Cocoa', primary: '#8D5B4C', bg: '#F9F6F0', border: '#E8DED5', text: '#451A03', checkmark: '#8D5B4C' },
  { id: 'matcha', name: 'Emerald Matcha', primary: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', text: '#064E3B', checkmark: '#10B981' },
  { id: 'ocean', name: 'Ocean Sapphire', primary: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD', text: '#0C4A6E', checkmark: '#0284C7' },
  { id: 'dark', name: 'Midnight Obsidian', primary: '#1E2028', bg: '#1E2028', border: '#334155', text: '#FFFFFF', checkmark: '#FFC700' },
];

const BG_THEME_PALETTES = [
  { id: 'obsidian', name: 'Obsidian Dark', primary: '#121318', bg: '#18181B', border: '#334155', text: '#FFFFFF', checkmark: '#FFC700' },
  { id: 'cream', name: 'Warm Cream', primary: '#F5F0E8', bg: '#FAF6F0', border: '#EAE3D7', text: '#0F172A', checkmark: '#0F172A' },
  { id: 'white', name: 'Pure White', primary: '#FFFFFF', bg: '#FFFFFF', border: '#CBD5E1', text: '#0F172A', checkmark: '#0F172A' },
  { id: 'pink', name: 'Pastel Pink', primary: '#FCE7F3', bg: '#FDF2F8', border: '#FBCFE8', text: '#831843', checkmark: '#831843' },
  { id: 'matcha', name: 'Soft Matcha', primary: '#ECFDF5', bg: '#F0FDF4', border: '#A7F3D0', text: '#064E3B', checkmark: '#064E3B' },
  { id: 'navy', name: 'Midnight Navy', primary: '#0F172A', bg: '#1E293B', border: '#334155', text: '#FFFFFF', checkmark: '#FFC700' },
];

const POD_COLOR_PALETTES = [
  { id: 'auto', name: 'Auto Neumorphic', primary: 'auto', bg: '#F8FAFC', border: '#E2E8F0', text: '#0F172A', checkmark: '#0284C7' },
  { id: 'white', name: 'Crisp White', primary: '#FFFFFF', bg: '#FFFFFF', border: '#CBD5E1', text: '#0F172A', checkmark: '#000000' },
  { id: 'slate', name: 'Dark Slate', primary: '#1E293B', bg: '#1E293B', border: '#334155', text: '#FFFFFF', checkmark: '#FFC700' },
  { id: 'gold', name: 'Gold Pod', primary: '#FEF08A', bg: '#FFFBEA', border: '#FDE047', text: '#854D0E', checkmark: '#854D0E' },
  { id: 'translucent', name: 'Glass Frost', primary: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.4)', border: '#CBD5E1', text: '#0F172A', checkmark: '#0284C7' },
];

export default function BookingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'appointments' | 'services' | 'pwa'>('appointments');
  const [loading, setLoading] = useState(true);
  const [merchantData, setMerchantData] = useState<any>(null);
  const [hasBookingAccess, setHasBookingAccess] = useState(true);
  const [currentPlan, setCurrentPlan] = useState('stand_bundle');
  const [showBookingAccessModal, setShowBookingAccessModal] = useState(false);

  // Appointments State
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const now = new Date();
  const [selectedDateTitle, setSelectedDateTitle] = useState('Today');
  const [selectedDateSubtitle, setSelectedDateSubtitle] = useState(
    now.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [calMonthDate, setCalMonthDate] = useState<Date>(new Date());
  const [calViewMode, setCalViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [selectedCalIsoDate, setSelectedCalIsoDate] = useState<string>(new Date().toISOString().substring(0, 10));

  // Services State
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceFilter, setServiceFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [selectedActionService, setSelectedActionService] = useState<ServiceItem | null>(null);
  const [showServiceActionModal, setShowServiceActionModal] = useState(false);
  const [isDeletingService, setIsDeletingService] = useState(false);
  
  // Add Item Wizard State (Step 1, 2, 3)
  const [addModalStep, setAddModalStep] = useState<1 | 2 | 3>(1);
  const [addItemType, setAddItemType] = useState<'service' | 'class' | 'product' | 'addon'>('service');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<any>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('Haircut');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('30');
  const [isOnlineAvailable, setIsOnlineAvailable] = useState(true);
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [assignedStaff, setAssignedStaff] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [bufferTime, setBufferTime] = useState('10 minutes');
  const [depositPolicy, setDepositPolicy] = useState('No deposit');
  const [isSavingService, setIsSavingService] = useState(false);

  // Wizard Dropdown & Staff Picker States
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showBufferPicker, setShowBufferPicker] = useState(false);
  const [showDepositPicker, setShowDepositPicker] = useState(false);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffInput, setNewStaffInput] = useState('');

  // Dynamic Location Options based on real branches + flexible options
  const locationOptions = useMemo(() => {
    const list: string[] = [];
    if (branchesList && branchesList.length > 0) {
      branchesList.forEach(b => {
        if (b.name && !list.includes(b.name)) list.push(b.name);
      });
    } else {
      const fallbackName = `${merchantData?.name || user?.name || 'Store'} (HQ)`;
      list.push(fallbackName);
    }
    if (!list.includes('At Customer Location')) list.push('At Customer Location');
    if (!list.includes('Online / Virtual')) list.push('Online / Virtual');
    return list;
  }, [branchesList, merchantData, user]);

  // PWA State & Branding Customizer
  const [pwaSlug, setPwaSlug] = useState('store');
  const [copiedLink, setCopiedLink] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState<string>('');
  const [bannerFile, setBannerFile] = useState<any>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [selectedBrandColor, setSelectedBrandColor] = useState<string>('#FFC700');
  const [selectedBgColor, setSelectedBgColor] = useState<string>('#121318');
  const [selectedPodColor, setSelectedPodColor] = useState<string>('auto');
  const [customTagline, setCustomTagline] = useState<string>('Quality Services & Online Booking');
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState<number>(Date.now());
  const iframeRef = useRef<any>(null);

  // Broadcast preview updates in real-time to the embedded iframe device frame
  const broadcastPreviewUpdate = (override?: { brandColor?: string; bgColor?: string; podColor?: string; coverUrl?: string | null; tagline?: string }) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const colorToSend = override?.brandColor !== undefined ? override.brandColor : selectedBrandColor;
    const bgColorToSend = override?.bgColor !== undefined ? override.bgColor : selectedBgColor;
    const podColorToSend = override?.podColor !== undefined ? override.podColor : selectedPodColor;
    const coverToSend = override?.coverUrl !== undefined ? override.coverUrl : (bannerPreview || customCoverUrl);
    const taglineToSend = override?.tagline !== undefined ? override.tagline : customTagline;

    const payload = {
      type: 'RISEV_BOOKING_PREVIEW_UPDATE',
      brandColor: colorToSend,
      bgColor: bgColorToSend,
      podColor: podColorToSend,
      coverUrl: coverToSend,
      tagline: taglineToSend,
    };

    try {
      if (pwaSlug) {
        sessionStorage.setItem(`risev_booking_preview_${pwaSlug}`, JSON.stringify(payload));
        localStorage.setItem(`risev_booking_preview_${pwaSlug}`, JSON.stringify(payload));
        window.postMessage(payload, '*');
      }
    } catch (e) {}

    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(payload, '*');
      }
    } catch (e) {}
  };

  useEffect(() => {
    broadcastPreviewUpdate();
  }, [selectedBrandColor, selectedBgColor, bannerPreview, customCoverUrl, customTagline, pwaSlug]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleParentMsg = (evt: MessageEvent) => {
      if (evt.data?.type === 'RISEV_BOOKING_PREVIEW_READY') {
        broadcastPreviewUpdate();
      }
    };
    window.addEventListener('message', handleParentMsg);
    return () => window.removeEventListener('message', handleParentMsg);
  }, [selectedBrandColor, selectedBgColor, bannerPreview, customCoverUrl, customTagline, pwaSlug]);

  const handlePickBanner = async () => {
    if (Platform.OS === 'web') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            setBannerFile(file);
            const reader = new FileReader();
            reader.onload = (event: any) => {
              const res = event.target?.result as string;
              setBannerPreview(res);
              setCustomCoverUrl(res);
              broadcastPreviewUpdate({ coverUrl: res });
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } catch (e) {
        console.warn('Web banner picker error:', e);
      }
    } else {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access photo gallery is required.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.85,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setBannerPreview(asset.uri);
          setCustomCoverUrl(asset.uri);
          setBannerFile({
            uri: asset.uri,
            name: `banner_${Date.now()}.jpg`,
            type: 'image/jpeg'
          });
        }
      } catch (err: any) {
        Alert.alert('Error', 'Failed to pick image from library.');
      }
    }
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      const targetMerchantId = user?.merchant_id || merchantData?.id;
      if (targetMerchantId) {
        let updated: any = null;
        if (bannerFile) {
          const formData = new FormData();
          formData.append('banner', bannerFile);
          formData.append('pwa_brand_color', selectedBrandColor);
          formData.append('pwa_bg_color', selectedBgColor);
          formData.append('pwa_pod_color', selectedPodColor);
          formData.append('pwa_theme', isObsidianDark(selectedBgColor) ? 'dark' : 'light');
          formData.append('subtitle', customTagline);
          formData.append('pwa_slug', pwaSlug || merchantData?.pwa_slug || 'store');
          updated = await pb.collection('merchants').update(targetMerchantId, formData, { requestKey: null });
          setMerchantData(updated);
          if (updated.banner) {
            const bUrl = `${pb.baseUrl}/api/files/merchants/${updated.id}/${updated.banner}`;
            setBannerPreview(bUrl);
            setCustomCoverUrl(bUrl);
          }
          setBannerFile(null);
        } else {
          const payload: any = {
            pwa_brand_color: selectedBrandColor,
            pwa_bg_color: selectedBgColor,
            pwa_pod_color: selectedPodColor,
            pwa_theme: isObsidianDark(selectedBgColor) ? 'dark' : 'light',
            subtitle: customTagline,
            pwa_slug: pwaSlug || merchantData?.pwa_slug || 'store',
          };
          if (customCoverUrl) {
            payload.cover_url = customCoverUrl;
          }
          updated = await pb.collection('merchants').update(targetMerchantId, payload, { requestKey: null });
          setMerchantData(updated);
        }

        // Keep local preview synchronized
        broadcastPreviewUpdate({
          brandColor: selectedBrandColor,
          bgColor: selectedBgColor,
          podColor: selectedPodColor,
          tagline: customTagline,
          coverUrl: bannerPreview || customCoverUrl,
        });
      }
      setPreviewRefreshKey(Date.now());
      Alert.alert('Branding Saved', 'Your live booking PWA color and branding have been updated!');
    } catch (e: any) {
      console.warn('Save branding error:', e);
      Alert.alert('Error', e?.message || 'Failed to update branding.');
    } finally {
      setIsSavingBranding(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      let mRecord: any = null;
      const targetMerchantId = user?.merchant_id || merchantData?.id;
      
      if (targetMerchantId) {
        try {
          mRecord = await pb.collection('merchants').getOne(targetMerchantId, { requestKey: null });
        } catch (e) {
          console.warn('Error fetching merchant by ID:', e);
        }
      }

      if (!mRecord && user?.id) {
        try {
          mRecord = await pb.collection('merchants').getFirstListItem(`owner = "${user.id}"`, { requestKey: null });
        } catch (e) {}
      }

      if (mRecord) {
        setMerchantData(mRecord);
        const computedSlug = mRecord.pwa_slug || mRecord.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'store';
        setPwaSlug(computedSlug);
        if (mRecord.banner) {
          const bUrl = `${pb.baseUrl}/api/files/merchants/${mRecord.id}/${mRecord.banner}`;
          setCustomCoverUrl(bUrl);
          setBannerPreview(bUrl);
        } else if (mRecord.cover_url) {
          setCustomCoverUrl(mRecord.cover_url);
          setBannerPreview(mRecord.cover_url);
        } else {
          setCustomCoverUrl('');
          setBannerPreview(null);
        }
        if (mRecord.pwa_brand_color) setSelectedBrandColor(mRecord.pwa_brand_color);
        if (mRecord.pwa_bg_color) setSelectedBgColor(mRecord.pwa_bg_color);
        if (mRecord.pwa_pod_color) setSelectedPodColor(mRecord.pwa_pod_color);
        if (mRecord.subtitle) setCustomTagline(mRecord.subtitle);

        if (!mRecord.pwa_slug && computedSlug) {
          pb.collection('merchants').update(mRecord.id, { pwa_slug: computedSlug }, { requestKey: null }).catch(() => {});
        }
      }

      let planName = 'stand_bundle';
      let hasAccess = false;
      if (mRecord?.has_booking_addon === true) {
        hasAccess = true;
      }
      if (user?.merchant_id) {
        try {
          const subs = await pb.collection('subscriptions').getList(1, 1, {
            filter: `merchant = "${user.merchant_id}" && (status = "active" || status = "trialing")`,
            requestKey: null
          });
          if (subs.items.length > 0) {
            planName = (subs.items[0].plan || 'stand_bundle').toLowerCase();
            if (planName === 'pro' || planName === 'business') {
              hasAccess = true;
            }
          }
        } catch (sErr) {}
      }
      setCurrentPlan(planName);
      setHasBookingAccess(hasAccess);

      if (!mRecord) {
        setMerchantData({ name: user?.name || 'My Store' });
        setPwaSlug('store');
      }

      // Fetch bookings (live data only, no mock fallback)
      try {
        let bItems: any[] = [];
        if (user?.merchant_id) {
          const bRes = await pb.collection('service_bookings').getList(1, 500, {
            filter: `merchant = "${user.merchant_id}"`,
            sort: '-booking_date,-start_time',
            expand: 'staff'
          });
          bItems = bRes.items.map((item: any) => {
            let sName = item.service_name;
            if (!sName && item.items_summary) {
              let its = item.items_summary;
              if (typeof its === 'string') {
                try { its = JSON.parse(its); } catch (e) { its = []; }
              }
              if (Array.isArray(its) && its.length > 0) {
                sName = its.map((it: any) => it.name).join(', ');
              }
            }
            return {
              ...item,
              service_name: sName || 'Service',
              staff_name: item.staff_name || item.expand?.staff?.name || 'Staff'
            };
          });
        }
        setBookings(bItems as any);
      } catch (bErr) {
        console.warn('Error fetching bookings:', bErr);
        setBookings([]);
      }

      // Fetch services (live data only, no mock fallback)
      try {
        let sItems: any[] = [];
        if (user?.merchant_id) {
          const sRes = await pb.collection('merchant_services').getList(1, 100, {
            filter: `merchant = "${user.merchant_id}"`,
            sort: 'created'
          });
          sItems = sRes.items.map((item: any) => ({
            ...item,
            image_url: item.image
              ? `${pb.baseUrl}/api/files/merchant_services/${item.id}/${item.image}`
              : (item.image_url || '')
          }));
        }
        setServices(sItems as any);
      } catch (sErr) {
        console.warn('Error fetching services:', sErr);
        setServices([]);
      }

      // Fetch branches (live data only, no mock fallback)
      let bList: any[] = [];
      try {
        if (user?.merchant_id) {
          const bRes = await pb.collection('branches').getFullList({
            filter: `merchant = "${user.merchant_id}" && status = "active"`,
            sort: '-is_hq,name',
            requestKey: null,
          });
          bList = bRes || [];
        }
      } catch (brErr) {
        console.warn('Error fetching branches:', brErr);
      }
      setBranchesList(bList);
      if (bList.length > 0) {
        setSelectedLocation(bList[0].name);
      } else {
        setSelectedLocation(`${mRecord?.name || user?.name || 'Store'} (HQ)`);
      }

      // Fetch staff members (live data only, no mock fallback)
      let sMembers: any[] = [];
      try {
        if (user?.merchant_id) {
          const sRes = await pb.send<any>('/api/risev/merchant/staff?timeframe=all&sort_by=stamps', {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer ' + pb.authStore.token
            }
          });
          if (sRes && Array.isArray(sRes.staff)) {
            sMembers = sRes.staff;
          }
        }
      } catch (stErr) {
        console.warn('Error fetching staff:', stErr);
      }
      setStaffList(sMembers);
      const defaultStaff = user?.name || mRecord?.name || 'Owner';
      setAssignedStaff([defaultStaff]);

    } catch (err) {
      console.warn('Load booking error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: any) => {
    setUpdatingId(bookingId);
    try {
      if (!bookingId.startsWith('mock-')) {
        try {
          await pb.collection('service_bookings').update(bookingId, { status: newStatus });
        } catch (upErr) {
          // Fall back to server-side endpoint with full privileges
          await pb.send('/api/risev/merchant/booking-status', {
            method: 'POST',
            body: { booking_id: bookingId, status: newStatus }
          });
        }
      }
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      if (newStatus === 'completed') {
        Alert.alert('Completed & Stamped! 🎉', 'Customer loyalty stamps credited and digital receipt issued.');
      } else if (newStatus === 'no_show') {
        Alert.alert('Marked as No Show', 'The appointment has been marked as No Show.');
      } else {
        Alert.alert('Status Updated', `Appointment marked as ${newStatus.toUpperCase()}`);
      }
    } catch (e: any) {
      console.warn('Status update error:', e);
      Alert.alert('Error', e?.message || 'Failed to update appointment status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleNoShowWhatsApp = (b: BookingItem) => {
    let rawPhone = (b.customer_phone || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '60' + rawPhone.slice(1);
    } else if (rawPhone.length > 0 && !rawPhone.startsWith('60')) {
      rawPhone = '60' + rawPhone;
    }
    const storeTitle = merchantData?.name || merchantData?.store_name || user?.name || 'our store';
    const bookingUrl = pwaSlug ? `https://risev.app/b/${pwaSlug}` : '';
    const text = `Hi ${b.customer_name || 'there'}, we missed you today for your ${b.service_name || 'appointment'} at ${storeTitle}! Would you like to reschedule for another time? You can pick a new slot here: ${bookingUrl}`;
    const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(text)}`;
    Linking.openURL(waUrl).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp.');
    });
  };

  const handleMarkNoShow = (b: BookingItem) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`Mark appointment for ${b.customer_name || 'this customer'} as No Show?`);
      if (confirmed) {
        handleUpdateStatus(b.id, 'no_show');
      }
      return;
    }
    Alert.alert(
      'Mark as No Show?',
      `Confirm that ${b.customer_name || 'this customer'} did not attend the scheduled appointment on ${b.booking_date} at ${b.start_time}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'No Show & WhatsApp',
          onPress: async () => {
            await handleUpdateStatus(b.id, 'no_show');
            handleNoShowWhatsApp(b);
          }
        },
        {
          text: 'Mark No Show',
          style: 'destructive',
          onPress: async () => {
            await handleUpdateStatus(b.id, 'no_show');
          }
        }
      ]
    );
  };

  const handleCustomerWhatsApp = (b: BookingItem) => {
    let rawPhone = (b.customer_phone || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '60' + rawPhone.slice(1);
    } else if (rawPhone.length > 0 && !rawPhone.startsWith('60')) {
      rawPhone = '60' + rawPhone;
    }
    const storeTitle = merchantData?.name || merchantData?.store_name || user?.name || 'our store';
    const text = `Hi ${b.customer_name || 'there'}, regarding your booking for ${b.service_name || 'service'} at ${storeTitle} on ${b.booking_date} at ${b.start_time}:`;
    const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(text)}`;
    Linking.openURL(waUrl).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp.');
    });
  };

  const handleAddStaffSubmit = () => {
    const trimmed = newStaffInput.trim();
    if (!trimmed) {
      setIsAddingStaff(false);
      return;
    }
    if (!assignedStaff.includes(trimmed)) {
      setAssignedStaff(prev => [...prev, trimmed]);
      if (user?.merchant_id) {
        pb.collection('merchant_staff').create({
          merchant: user.merchant_id,
          name: trimmed,
          role_title: 'Provider',
          is_active: true
        }).catch(() => {});
      }
    }
    setNewStaffInput('');
    setIsAddingStaff(false);
  };

  const handleOpenAddService = () => {
    setEditingService(null);
    setAddModalStep(1);
    setAddItemType('service');
    setPhotoUri(null);
    setPhotoFile(null);
    setNewServiceName('');
    setNewServiceCategory('Haircut');
    setNewServicePrice('');
    setNewServiceDuration('30');
    setIsOnlineAvailable(true);
    const primaryStaff = user?.name || merchantData?.name || 'Owner';
    setAssignedStaff([primaryStaff]);
    const defaultLoc = branchesList.length > 0
      ? branchesList[0].name
      : `${merchantData?.name || user?.name || 'Store'} (HQ)`;
    setSelectedLocation(defaultLoc);
    setShowAddServiceModal(true);
  };

  const handleOpenEditService = (s: ServiceItem) => {
    setEditingService(s);
    setAddItemType(s.item_type || 'service');
    setPhotoUri(s.image_url || null);
    setPhotoFile(null);
    setNewServiceName(s.name);
    setNewServiceCategory(s.category || 'Haircut');
    setNewServicePrice(String(s.price || ''));
    setNewServiceDuration(String(s.duration_minutes || '30'));
    setIsOnlineAvailable(s.is_active !== false);
    const primaryStaff = user?.name || merchantData?.name || 'Owner';
    setAssignedStaff([primaryStaff]);
    const defaultLoc = branchesList.length > 0
      ? branchesList[0].name
      : `${merchantData?.name || user?.name || 'Store'} (HQ)`;
    setSelectedLocation(defaultLoc);
    setAddModalStep(2); // Jump straight to basic info for editing
    setShowAddServiceModal(true);
    setShowServiceActionModal(false);
  };

  const handleOpenServiceActions = (s: ServiceItem) => {
    setSelectedActionService(s);
    setShowServiceActionModal(true);
  };

  const handleToggleServiceStatus = async (service: ServiceItem) => {
    const nextStatus = !service.is_active;
    try {
      if (user?.merchant_id && !service.id.startsWith('srv-')) {
        await pb.collection('merchant_services').update(service.id, { is_active: nextStatus });
      }
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, is_active: nextStatus } : s));
      setShowServiceActionModal(false);
      Alert.alert('Status Updated', `"${service.name}" is now ${nextStatus ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update status.');
    }
  };

  const handleDeleteService = (service: ServiceItem) => {
    const doDelete = async () => {
      setIsDeletingService(true);
      try {
        if (user?.merchant_id && !service.id.startsWith('srv-')) {
          await pb.collection('merchant_services').delete(service.id);
        }
        setServices(prev => prev.filter(s => s.id !== service.id));
        setShowServiceActionModal(false);
        Alert.alert('Deleted', `"${service.name}" was removed from your catalog.`);
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to delete service.');
      } finally {
        setIsDeletingService(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete "${service.name}"?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Service',
        `Are you sure you want to delete "${service.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete }
        ]
      );
    }
  };

  const handleCloseAddService = () => {
    setShowAddServiceModal(false);
    setEditingService(null);
    setAddModalStep(1);
    setPhotoUri(null);
    setPhotoFile(null);
    setNewServiceName('');
    setNewServicePrice('');
  };

  const handlePickPhoto = async () => {
    if (Platform.OS === 'web') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onload = (event: any) => {
              setPhotoUri(event.target?.result as string);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } catch (e) {
        console.warn('Web file picker error:', e);
      }
    } else {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access photo gallery is required.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setPhotoUri(asset.uri);
          setPhotoFile({
            uri: asset.uri,
            name: `service_${Date.now()}.jpg`,
            type: 'image/jpeg'
          });
        }
      } catch (err: any) {
        Alert.alert('Error', 'Failed to pick image from library.');
      }
    }
  };

  const handleSaveService = async (): Promise<boolean> => {
    if (!newServiceName.trim()) {
      Alert.alert('Missing Details', 'Service name is required.');
      return false;
    }
    if (!newServicePrice.trim()) {
      Alert.alert('Missing Details', 'Price is required.');
      return false;
    }
    setIsSavingService(true);
    try {
      const priceNum = parseFloat(newServicePrice) || 0;
      const durNum = parseInt(newServiceDuration) || 0;
      
      let finalImageUrl = photoUri || '';

      if (editingService) {
        // UPDATE EXISTING SERVICE
        const updatedService: ServiceItem = {
          ...editingService,
          name: newServiceName.trim(),
          category: newServiceCategory,
          price: priceNum,
          duration_minutes: durNum,
          item_type: addItemType,
          is_active: isOnlineAvailable,
          image_url: finalImageUrl
        };

        if (user?.merchant_id && !editingService.id.startsWith('srv-')) {
          const matchingBranch = branchesList.find(b => b.name === selectedLocation);
          try {
            const formData = new FormData();
            formData.append('name', newServiceName.trim());
            formData.append('category', newServiceCategory);
            formData.append('price', String(priceNum));
            formData.append('duration_minutes', String(durNum));
            formData.append('item_type', addItemType);
            formData.append('is_active', String(isOnlineAvailable));
            if (matchingBranch?.id) {
              formData.append('branch', matchingBranch.id);
            }
            if (photoFile) {
              formData.append('image', photoFile);
            } else if (photoUri && !photoUri.startsWith('data:') && !photoUri.startsWith('http')) {
              formData.append('image_url', photoUri);
            }

            const rec = await pb.collection('merchant_services').update(editingService.id, formData);
            if (rec.image) {
              finalImageUrl = `${pb.baseUrl}/api/files/merchant_services/${rec.id}/${rec.image}`;
              updatedService.image_url = finalImageUrl;
            } else if (rec.image_url) {
              finalImageUrl = rec.image_url;
              updatedService.image_url = finalImageUrl;
            }
          } catch (pbErr: any) {
            console.warn('FormData update failed, trying fallback JSON:', pbErr);
            try {
              const rec = await pb.collection('merchant_services').update(editingService.id, {
                name: newServiceName.trim(),
                category: newServiceCategory,
                price: priceNum,
                duration_minutes: durNum,
                item_type: addItemType,
                is_active: isOnlineAvailable,
                image_url: photoUri || ''
              });
              if (rec.image_url) updatedService.image_url = rec.image_url;
            } catch (jsonErr: any) {
              console.warn('Fallback JSON update failed, trying basic fields:', jsonErr);
              await pb.collection('merchant_services').update(editingService.id, {
                name: newServiceName.trim(),
                category: newServiceCategory,
                price: priceNum,
                duration_minutes: durNum,
                item_type: addItemType,
                is_active: isOnlineAvailable
              });
            }
          }
        }

        setServices(prev => prev.map(s => s.id === editingService.id ? updatedService : s));
        handleCloseAddService();
        Alert.alert('Saved ✨', `"${updatedService.name}" updated successfully.`);
        return true;
      }

      // CREATE NEW SERVICE
      const newService: ServiceItem = {
        id: `srv-${Date.now()}`,
        name: newServiceName.trim(),
        category: newServiceCategory,
        price: priceNum,
        duration_minutes: durNum,
        item_type: addItemType,
        is_active: isOnlineAvailable,
        image_url: finalImageUrl
      };

      if (user?.merchant_id) {
        const matchingBranch = branchesList.find(b => b.name === selectedLocation);
        try {
          const formData = new FormData();
          formData.append('merchant', user.merchant_id);
          if (matchingBranch?.id) {
            formData.append('branch', matchingBranch.id);
          }
          formData.append('name', newServiceName.trim());
          formData.append('category', newServiceCategory);
          formData.append('price', String(priceNum));
          formData.append('duration_minutes', String(durNum));
          formData.append('item_type', addItemType);
          formData.append('is_active', String(isOnlineAvailable));

          if (photoFile) {
            formData.append('image', photoFile);
          } else if (photoUri && !photoUri.startsWith('data:')) {
            formData.append('image_url', photoUri);
          }

          const rec = await pb.collection('merchant_services').create(formData);
          newService.id = rec.id;
          if (rec.image) {
            finalImageUrl = `${pb.baseUrl}/api/files/merchant_services/${rec.id}/${rec.image}`;
            newService.image_url = finalImageUrl;
          } else if (rec.image_url) {
            finalImageUrl = rec.image_url;
            newService.image_url = finalImageUrl;
          }
        } catch (pbErr: any) {
          console.warn('FormData create failed, trying fallback JSON:', pbErr);
          try {
            const rec = await pb.collection('merchant_services').create({
              merchant: user.merchant_id,
              ...(matchingBranch?.id ? { branch: matchingBranch.id } : {}),
              name: newServiceName.trim(),
              category: newServiceCategory,
              price: priceNum,
              duration_minutes: durNum,
              item_type: addItemType,
              is_active: isOnlineAvailable,
              image_url: photoUri || ''
            });
            newService.id = rec.id;
          } catch (jsonErr: any) {
            console.warn('Fallback JSON with image_url failed, trying basic fields:', jsonErr);
            const rec = await pb.collection('merchant_services').create({
              merchant: user.merchant_id,
              ...(matchingBranch?.id ? { branch: matchingBranch.id } : {}),
              name: newServiceName.trim(),
              category: newServiceCategory,
              price: priceNum,
              duration_minutes: durNum,
              item_type: addItemType,
              is_active: isOnlineAvailable
            });
            newService.id = rec.id;
          }
        }
      }

      setServices(prev => [newService, ...prev]);
      handleCloseAddService();
      Alert.alert('Success 🎉', `"${newService.name}" has been added to your catalog.`);
      return true;
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add service.');
      return false;
    } finally {
      setIsSavingService(false);
    }
  };

  const handleCreateService = handleSaveService;

  const handleCopyLink = () => {
    const url = `https://risev.app/b/${pwaSlug}`;
    Clipboard.setString(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    Alert.alert('Link Copied! 📋', `Your booking page URL:\n${url}`);
  };

  const handleShare = async (platform: string) => {
    const url = `https://risev.app/b/${pwaSlug}`;
    const text = `Book your appointment with ${merchantData?.name || merchantData?.store_name || 'our store'} online:\n${url}`;

    if (platform === 'whatsapp') {
      const waUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
      Linking.canOpenURL(waUrl).then(supported => {
        if (supported) {
          Linking.openURL(waUrl);
        } else {
          Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
        }
      });
    } else {
      Share.share({ message: text });
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'today') {
      const todayIso = new Date().toISOString().substring(0, 10);
      return b.booking_date === todayIso;
    }
    return b.status === filterStatus;
  });

  const filteredServices = services.filter(s => {
    if (serviceFilter === 'all') return true;
    if (serviceFilter === 'active') return s.is_active;
    if (serviceFilter === 'inactive') return !s.is_active;
    return true;
  });

  const arrivedCount = bookings.filter(b => b.status === 'arrived').length;
  const bookedCount = bookings.filter(b => b.status === 'booked').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  // Real month calendar days calculation
  const calendarDays = useMemo(() => {
    const year = calMonthDate.getFullYear();
    const month = calMonthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const result: {
      day: number;
      isoDate: string;
      isPrev?: boolean;
      isNext?: boolean;
      count: number;
      hasNoShow: boolean;
      hasCompleted: boolean;
      hasUpcoming: boolean;
      dotColor?: string;
    }[] = [];

    // Prev month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, d);
      const isoDate = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayBookings = bookings.filter(b => b.booking_date === isoDate);
      result.push({
        day: d,
        isoDate,
        isPrev: true,
        count: dayBookings.length,
        hasNoShow: dayBookings.some(b => b.status === 'no_show'),
        hasCompleted: dayBookings.some(b => b.status === 'completed'),
        hasUpcoming: dayBookings.some(b => b.status === 'booked' || b.status === 'arrived'),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayBookings = bookings.filter(b => b.booking_date === isoDate);
      const count = dayBookings.length;
      const hasNoShow = dayBookings.some(b => b.status === 'no_show');
      const hasCompleted = dayBookings.some(b => b.status === 'completed');
      const hasUpcoming = dayBookings.some(b => b.status === 'booked' || b.status === 'arrived');

      let dotColor = '#EAB308';
      if (hasNoShow) {
        dotColor = '#EF4444'; // Red for missed / no-show
      } else if (hasCompleted) {
        dotColor = '#22C55E'; // Green for completed
      } else if (hasUpcoming) {
        dotColor = '#3B82F6'; // Blue for booked / arrived
      }

      result.push({
        day: d,
        isoDate,
        count,
        hasNoShow,
        hasCompleted,
        hasUpcoming,
        dotColor: count > 0 ? dotColor : undefined,
      });
    }

    // Next month days to complete 7-day grid rows
    const totalCells = result.length;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const isoDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayBookings = bookings.filter(b => b.booking_date === isoDate);
      result.push({
        day: d,
        isoDate,
        isNext: true,
        count: dayBookings.length,
        hasNoShow: dayBookings.some(b => b.status === 'no_show'),
        hasCompleted: dayBookings.some(b => b.status === 'completed'),
        hasUpcoming: dayBookings.some(b => b.status === 'booked' || b.status === 'arrived'),
      });
    }

    return result;
  }, [calMonthDate, bookings]);

  // Week days calculation
  const calendarWeekDays = useMemo(() => {
    const cur = new Date(selectedCalIsoDate + 'T00:00:00');
    const dayOfWeek = isNaN(cur.getTime()) ? 0 : cur.getDay(); // 0 = Sun
    const sun = new Date(cur);
    sun.setDate(cur.getDate() - dayOfWeek);

    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sun);
      d.setDate(sun.getDate() + i);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayBookings = bookings.filter(b => b.booking_date === isoDate);
      const count = dayBookings.length;
      const hasNoShow = dayBookings.some(b => b.status === 'no_show');
      const hasCompleted = dayBookings.some(b => b.status === 'completed');
      const hasUpcoming = dayBookings.some(b => b.status === 'booked' || b.status === 'arrived');

      let dotColor = '#EAB308';
      if (hasNoShow) dotColor = '#EF4444';
      else if (hasCompleted) dotColor = '#22C55E';
      else if (hasUpcoming) dotColor = '#3B82F6';

      result.push({
        day: d.getDate(),
        isoDate,
        count,
        hasNoShow,
        hasCompleted,
        hasUpcoming,
        dotColor: count > 0 ? dotColor : undefined,
      });
    }
    return result;
  }, [selectedCalIsoDate, bookings]);

  const selectedDayBookings = useMemo(() => {
    return bookings.filter(b => b.booking_date === selectedCalIsoDate);
  }, [bookings, selectedCalIsoDate]);

  const handleSelectCalendarDate = (item: { day: number; isoDate: string; isPrev?: boolean; isNext?: boolean }) => {
    setSelectedCalIsoDate(item.isoDate);
    const todayIso = new Date().toISOString().substring(0, 10);
    const dObj = new Date(item.isoDate + 'T00:00:00');
    if (item.isoDate === todayIso) {
      setSelectedDateTitle('Today');
    } else {
      setSelectedDateTitle(dObj.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }));
    }
    setSelectedDateSubtitle(dObj.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    
    if (item.isPrev || item.isNext) {
      setCalMonthDate(new Date(dObj.getFullYear(), dObj.getMonth(), 1));
    }
  };

  const handleCalendarNavPrev = () => {
    if (calViewMode === 'month') {
      setCalMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (calViewMode === 'week') {
      const d = new Date(selectedCalIsoDate + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      handleSelectCalendarDate({ day: d.getDate(), isoDate: iso });
    } else {
      const d = new Date(selectedCalIsoDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      handleSelectCalendarDate({ day: d.getDate(), isoDate: iso });
    }
  };

  const handleCalendarNavNext = () => {
    if (calViewMode === 'month') {
      setCalMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (calViewMode === 'week') {
      const d = new Date(selectedCalIsoDate + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      handleSelectCalendarDate({ day: d.getDate(), isoDate: iso });
    } else {
      const d = new Date(selectedCalIsoDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      handleSelectCalendarDate({ day: d.getDate(), isoDate: iso });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => handleSmartBack(router, '/(merchant)/profile')}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#050505" />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Smart Booking Management</Text>
          <Text style={styles.headerSubtitle}>Manage appointments, services & booking page</Text>
        </View>

        <View style={styles.addonTag}>
          <Text style={styles.addonTagText}>ADD-ON ⚡</Text>
        </View>
      </View>

      {/* Plan Upgrade Banner if not PRO and no Add-on */}
      {!hasBookingAccess && (
        <View style={{ marginHorizontal: 20, marginBottom: 14, padding: 14, backgroundColor: '#FFFBEB', borderRadius: 16, borderWidth: 1, borderColor: '#FDE68A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Ionicons name="sparkles" size={15} color="#D97706" />
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>
                PRO Feature
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#92400E', lineHeight: 15 }}>
              The Live Booking Engine & Customer PWA is included with the PRO Plan (RM97/mo). Upgrade to unlock online bookings for your store.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowBookingAccessModal(true)}
            style={{ backgroundColor: '#050505', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            activeOpacity={0.85}
          >
            <Ionicons name="flash" size={12} color="#FFC700" />
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Segmented Top Tabs */}
      <View style={styles.tabBarWrap}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'appointments' && styles.tabItemActive]}
          onPress={() => setActiveTab('appointments')}
          activeOpacity={0.9}
        >
          <Ionicons
            name="calendar"
            size={15}
            color={activeTab === 'appointments' ? '#000000' : '#64748B'}
          />
          <Text
            style={[styles.tabItemText, activeTab === 'appointments' && styles.tabItemTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Appointments
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'services' && styles.tabItemActive]}
          onPress={() => setActiveTab('services')}
          activeOpacity={0.9}
        >
          <Ionicons
            name="cut"
            size={15}
            color={activeTab === 'services' ? '#000000' : '#64748B'}
          />
          <Text
            style={[styles.tabItemText, activeTab === 'services' && styles.tabItemTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Services & Catalog
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'pwa' && styles.tabItemActive]}
          onPress={() => setActiveTab('pwa')}
          activeOpacity={0.9}
        >
          <Ionicons
            name="phone-portrait"
            size={15}
            color={activeTab === 'pwa' ? '#000000' : '#64748B'}
          />
          <Text
            style={[styles.tabItemText, activeTab === 'pwa' && styles.tabItemTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Booking Page
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FFC700" />
        </View>
      ) : (
        <ScrollView style={styles.contentScroll} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          
          {/* ========================================== */}
          {/* TAB 1: APPOINTMENTS                        */}
          {/* ========================================== */}
          {activeTab === 'appointments' && (
            <View>
              {/* Yellow Gradient Hero Card */}
              <LinearGradient colors={['#FFDE59', '#FFC700']} style={styles.yellowHeroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.yellowHeroHeader}>
                  <View>
                    <Text style={styles.yellowHeroTitle}>{selectedDateTitle}</Text>
                    <Text style={styles.yellowHeroDate}>{selectedDateSubtitle}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.btnCalendarViewLight}
                    onPress={() => setShowCalendarModal(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="calendar-outline" size={14} color="#0F172A" />
                    <Text style={styles.btnCalendarViewTextLight}>View Calendar ›</Text>
                  </TouchableOpacity>
                </View>

                {/* 3 Stat Boxes */}
                <View style={styles.glassStatsGrid}>
                  <View style={[styles.glassStatBox, { borderLeftColor: '#10B981' }]}>
                    <View style={styles.statBoxTopRow}>
                      <Text style={styles.glassStatNum}>{arrivedCount}</Text>
                      <View style={[styles.statIconWrap, { backgroundColor: '#E6F4EA' }]}>
                        <Ionicons name="calendar" size={14} color="#10B981" />
                      </View>
                    </View>
                    <Text style={styles.glassStatLabel} numberOfLines={2}>
                      Today's{'\n'}Appointments
                    </Text>
                  </View>

                  <View style={[styles.glassStatBox, { borderLeftColor: '#F59E0B' }]}>
                    <View style={styles.statBoxTopRow}>
                      <Text style={styles.glassStatNum}>{bookedCount}</Text>
                      <View style={[styles.statIconWrap, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="time" size={14} color="#F59E0B" />
                      </View>
                    </View>
                    <Text style={styles.glassStatLabel} numberOfLines={2}>
                      Upcoming
                    </Text>
                  </View>

                  <View style={[styles.glassStatBox, { borderLeftColor: '#3B82F6' }]}>
                    <View style={styles.statBoxTopRow}>
                      <Text style={styles.glassStatNum}>{completedCount}</Text>
                      <View style={[styles.statIconWrap, { backgroundColor: '#DBEAFE' }]}>
                        <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />
                      </View>
                    </View>
                    <Text style={styles.glassStatLabel} numberOfLines={2}>
                      Completed
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Status Filter Chips */}
              <View style={styles.filterPillsRow}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'today', label: 'Today' },
                  { key: 'booked', label: 'Upcoming' },
                  { key: 'completed', label: 'Completed' },
                  { key: 'no_show', label: 'No Show' },
                ].map(st => (
                  <TouchableOpacity
                    key={st.key}
                    style={[styles.filterPill, filterStatus === st.key && styles.filterPillActive]}
                    onPress={() => setFilterStatus(st.key)}
                  >
                    <Text style={[styles.filterPillText, filterStatus === st.key && styles.filterPillTextActive]}>
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Section Header */}
              <View style={styles.appointmentsHeaderRow}>
                <Text style={styles.appointmentsSectionTitle}>Today</Text>
                <TouchableOpacity style={styles.btnDateSelect}>
                  <Ionicons name="calendar-outline" size={14} color="#000" />
                  <Text style={styles.btnDateSelectText}>5 Oct 2026</Text>
                </TouchableOpacity>
              </View>

              {/* Appointment Card Items or Clean Empty State */}
              {filteredBookings.length > 0 ? (
                <View style={styles.appointmentsList}>
                  {filteredBookings.map(b => (
                    <View key={b.id} style={styles.bookingCardContainer}>
                      
                      {/* Time Badge on Left */}
                      <View style={styles.timeColumn}>
                        <Text style={styles.timeText}>{b.start_time || '10:00'}</Text>
                        <Text style={styles.timeSubText}>Today</Text>
                      </View>

                      {/* Main Booking Card on Right */}
                      <View style={styles.bookingCardMain}>
                        <View style={styles.bookingCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.customerName}>{b.customer_name || 'Customer'}</Text>
                            <Text style={styles.customerPhone}>📞 {b.customer_phone}</Text>
                          </View>
                          <View style={[
                            styles.statusBadge,
                            b.status === 'arrived' ? styles.statusBadgeArrived :
                            b.status === 'completed' ? styles.statusBadgeCompleted :
                            b.status === 'no_show' ? styles.statusBadgeNoShow : styles.statusBadgeBooked
                          ]}>
                            <Text style={[
                              styles.statusBadgeText,
                              b.status === 'arrived' && { color: '#15803D' },
                              b.status === 'no_show' && { color: '#DC2626' }
                            ]}>
                              {b.status === 'arrived' ? '● ARRIVED' : b.status === 'completed' ? 'COMPLETED' : b.status === 'no_show' ? 'NO SHOW' : 'SCHEDULED'}
                            </Text>
                          </View>
                        </View>

                        {/* Service & Price Row */}
                        <View style={styles.serviceMetaBox}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Ionicons name="cut-outline" size={14} color="#000" />
                            <Text style={styles.serviceNameText}>{b.service_name || 'Service Booking'}</Text>
                          </View>
                          <Text style={styles.bookingPriceText}>RM {Number(b.total_price || 0).toFixed(2)}</Text>
                        </View>

                        {/* Staff & Duration */}
                        <View style={styles.staffMetaRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="person-outline" size={13} color="#64748B" />
                            <Text style={styles.staffMetaText}>{b.staff_name || 'Staff'}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="time-outline" size={13} color="#64748B" />
                            <Text style={styles.staffMetaText}>30 min</Text>
                          </View>
                        </View>

                        {/* Actions Buttons */}
                        <View style={styles.bookingActionsRow}>
                          {b.status === 'arrived' && (
                            <TouchableOpacity
                              style={styles.btnPrimaryAction}
                              onPress={() => handleUpdateStatus(b.id, 'completed')}
                              disabled={updatingId === b.id}
                              activeOpacity={0.85}
                            >
                              {updatingId === b.id ? (
                                <ActivityIndicator size="small" color="#000" />
                              ) : (
                                <>
                                  <Ionicons name="checkmark" size={16} color="#000" />
                                  <Text style={styles.btnPrimaryActionText}>Complete & Stamp</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}

                          {b.status === 'booked' && (
                            <>
                              <TouchableOpacity
                                style={styles.btnPrimaryAction}
                                onPress={() => handleUpdateStatus(b.id, 'arrived')}
                                disabled={updatingId === b.id}
                                activeOpacity={0.85}
                              >
                                {updatingId === b.id ? (
                                  <ActivityIndicator size="small" color="#000" />
                                ) : (
                                  <>
                                    <Ionicons name="location" size={16} color="#000" />
                                    <Text style={styles.btnPrimaryActionText}>Mark Arrived</Text>
                                  </>
                                )}
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.btnDangerAction}
                                onPress={() => handleMarkNoShow(b)}
                                disabled={updatingId === b.id}
                                activeOpacity={0.85}
                              >
                                <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                                <Text style={styles.btnDangerActionText}>No Show</Text>
                              </TouchableOpacity>
                            </>
                          )}

                          {b.status === 'no_show' && (
                            <>
                              <TouchableOpacity
                                style={[styles.btnSecondaryAction, { flex: 1.5, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
                                onPress={() => handleNoShowWhatsApp(b)}
                                activeOpacity={0.85}
                              >
                                <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
                                <Text style={[styles.btnSecondaryActionText, { color: '#16A34A' }]}>Reschedule WA</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.btnSecondaryAction, { flex: 1 }]}
                                onPress={() => handleUpdateStatus(b.id, 'booked')}
                                disabled={updatingId === b.id}
                                activeOpacity={0.85}
                              >
                                <Ionicons name="refresh-outline" size={15} color="#050505" />
                                <Text style={styles.btnSecondaryActionText}>Reopen</Text>
                              </TouchableOpacity>
                            </>
                          )}

                          {b.status !== 'no_show' && (
                            <TouchableOpacity
                              style={styles.btnSecondaryAction}
                              onPress={() => handleCustomerWhatsApp(b)}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="logo-whatsapp" size={16} color="#000" />
                              <Text style={styles.btnSecondaryActionText}>WhatsApp</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyNextCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="calendar-outline" size={24} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyText}>No appointments booked yet</Text>
                  <Text style={styles.emptySubtext}>
                    Share your online booking link with customers to start receiving appointments.
                  </Text>
                  <View style={styles.emptyActionsRow}>
                    <TouchableOpacity
                      style={styles.btnEmptySecondary}
                      onPress={handleCopyLink}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={copiedLink ? "checkmark-circle" : "copy-outline"} size={16} color={copiedLink ? "#16A34A" : "#0F172A"} />
                      <Text style={[styles.btnEmptySecondaryText, copiedLink && { color: '#16A34A' }]}>
                        {copiedLink ? 'Copied Link!' : 'Copy Link'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnEmptyPrimary}
                      onPress={() => router.push(`/b/${pwaSlug}` as any)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="open-outline" size={16} color="#000" />
                      <Text style={styles.btnEmptyPrimaryText}>Preview Page</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Next Appointments (when appointments exist) */}
              {filteredBookings.length > 0 && (
                <View style={{ marginTop: 24 }}>
                  <Text style={styles.nextTitle}>Next Appointments</Text>
                  <View style={styles.emptyNextCard}>
                    <View style={styles.emptyIconCircle}>
                      <Ionicons name="calendar-outline" size={24} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyText}>All caught up</Text>
                    <Text style={styles.emptySubtext}>You have handled all scheduled appointments for today</Text>
                  </View>
                </View>
              )}

            </View>
          )}

          {/* ========================================== */}
          {/* TAB 2: SERVICES & CATALOG                  */}
          {/* ========================================== */}
          {activeTab === 'services' && (
            <View>
              {/* Section Header */}
              <View style={styles.catalogHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catalogSectionTitle}>Services & Products</Text>
                  <Text style={styles.catalogSectionSubtitle}>
                    Items available for booking on your page
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.btnAddItemPill}
                  onPress={handleOpenAddService}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={16} color="#000" />
                  <Text style={styles.btnAddItemText}>Add Item</Text>
                </TouchableOpacity>
              </View>

              {/* Service Filter Chips */}
              <View style={styles.filterPillsRow}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'active', label: 'Active' },
                  { key: 'inactive', label: 'Inactive' },
                ].map(sf => (
                  <TouchableOpacity
                    key={sf.key}
                    style={[styles.filterPill, serviceFilter === sf.key && styles.filterPillActive]}
                    onPress={() => setServiceFilter(sf.key as any)}
                  >
                    <Text style={[styles.filterPillText, serviceFilter === sf.key && styles.filterPillTextActive]}>
                      {sf.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Service Item Cards or Clean Empty State */}
              {filteredServices.length > 0 ? (
                <View style={styles.servicesCatalogList}>
                  {filteredServices.map(s => (
                    <TouchableOpacity 
                      key={s.id} 
                      style={styles.catalogCard}
                      onPress={() => handleOpenEditService(s)}
                      activeOpacity={0.92}
                    >
                      {s.image_url ? (
                        <Image
                          source={{ uri: s.image_url }}
                          style={styles.catalogThumb}
                        />
                      ) : (
                        <View style={[styles.catalogThumb, { backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons 
                            name={s.item_type === 'product' ? 'cube-outline' : 'cut-outline'} 
                            size={22} 
                            color="#94A3B8" 
                          />
                        </View>
                      )}

                      <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={styles.catalogItemTitle}>{s.name}</Text>
                        <Text style={styles.catalogItemSubtitle}>
                          {s.category} • ⏱️ {s.duration_minutes > 0 ? `${s.duration_minutes} min` : 'Product'}
                        </Text>
                        <Text style={styles.catalogItemPrice}>RM {Number(s.price || 0).toFixed(2)}</Text>
                      </View>

                      <View style={styles.catalogRightWrap}>
                        <TouchableOpacity 
                          style={styles.btnDotsMenu} 
                          onPress={(e: any) => {
                            if (e?.stopPropagation) e.stopPropagation();
                            handleOpenServiceActions(s);
                          }}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="ellipsis-vertical" size={18} color="#64748B" />
                        </TouchableOpacity>
                        <View style={[styles.activeBadge, !s.is_active && { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.activeBadgeText, !s.is_active && { color: '#64748B' }]}>
                            {s.is_active ? '● Active' : '○ Inactive'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyNextCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="cut-outline" size={24} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyText}>Your service catalog is empty</Text>
                  <Text style={styles.emptySubtext}>
                    Add your haircuts, treatments, services, or products so customers can book them online.
                  </Text>
                  <TouchableOpacity
                    style={[styles.btnEmptyPrimary, { marginTop: 16 }]}
                    onPress={handleOpenAddService}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add" size={18} color="#000" />
                    <Text style={styles.btnEmptyPrimaryText}>+ Add Your First Service</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Tips Box */}
              <View style={styles.tipsCalloutCard}>
                <View style={styles.tipsIconCircle}>
                  <Ionicons name="bulb" size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipsTitle}>Tips</Text>
                  <Text style={styles.tipsText}>
                    Services you add will be displayed on your booking page for customers to book directly.
                  </Text>
                </View>
              </View>

            </View>
          )}

          {/* ========================================== */}
          {/* TAB 3: BOOKING PAGE (BRANDING & PWA SHARE) */}
          {/* ========================================== */}
          {activeTab === 'pwa' && (
            <View>
              
              {/* Online Booking Header */}
              <View style={styles.pwaSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles" size={18} color="#D97706" />
                  <Text style={styles.pwaSectionTitle}>Online Booking Page</Text>
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>● LIVE</Text>
                  </View>
                </View>
                <Text style={styles.pwaSectionSubtitle}>
                  Customize your hero cover image, brand color palette, and share your link with customers.
                </Text>
              </View>

              {/* Live Interactive Customer PWA Embed */}
              <View style={styles.previewContainerCard}>
                {/* Live Toolbar */}
                <View style={styles.previewToolbar}>
                  <View style={styles.previewUrlBadge}>
                    <Text style={styles.previewLiveDot}>●</Text>
                    <Text style={styles.previewUrlText} numberOfLines={1} ellipsizeMode="tail">
                      /b/{pwaSlug}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <TouchableOpacity
                      style={styles.btnToolbarAction}
                      onPress={() => setPreviewRefreshKey(Date.now())}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="reload" size={13} color="#0F172A" />
                      <Text style={styles.btnToolbarActionText}>Reload</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btnToolbarAction, styles.btnToolbarActionPrimary]}
                      onPress={() => {
                        const targetUrl = `/b/${pwaSlug}`;
                        if (Platform.OS === 'web') {
                          window.open(targetUrl, '_blank');
                        } else {
                          router.push(targetUrl as any);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="open-outline" size={13} color="#000" />
                      <Text style={styles.btnToolbarActionPrimaryText}>Open ↗</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Device Frame Viewport */}
                <View style={styles.deviceFrame}>
                  {/* Speaker Notch */}
                  <View style={styles.deviceSpeakerBar} />

                  {Platform.OS === 'web' ? (
                    React.createElement('iframe', {
                      ref: iframeRef,
                      key: previewRefreshKey,
                      src: `/b/${pwaSlug}?preview=1&t=${previewRefreshKey}`,
                      onLoad: () => broadcastPreviewUpdate(),
                      style: {
                        width: '100%',
                        height: 640,
                        border: 'none',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 24,
                      },
                      title: 'Live Customer Booking PWA',
                    })
                  ) : (
                    <View style={styles.mobileFallbackPreview}>
                      <Ionicons name="phone-portrait-outline" size={44} color="#FFC700" />
                      <Text style={styles.mobileFallbackTitle}>Live Customer PWA</Text>
                      <Text style={styles.mobileFallbackSub}>
                        Tap below to test your full booking portal as customers see it.
                      </Text>
                      <TouchableOpacity
                        style={styles.btnOpenFallback}
                        onPress={() => router.push(`/b/${pwaSlug}` as any)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="open-outline" size={15} color="#000" />
                        <Text style={styles.btnOpenFallbackText}>Launch Booking Flow ➔</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* BRANDING & HERO CUSTOMIZER CARD */}
              <View style={styles.brandingCustomizerCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Ionicons name="color-palette-outline" size={20} color="#000" />
                  <Text style={styles.brandingSectionTitle}>Branding & Theme Settings</Text>
                </View>

                {/* SECTION 1: Brand Accent Color */}
                <Text style={styles.brandingFieldLabel}>1. Brand Accent Color (Buttons & Accents)</Text>
                <View style={styles.paletteGrid}>
                  {COLOR_PALETTES.map(p => {
                    const isSelected = selectedBrandColor.toLowerCase() === p.primary.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.paletteChip,
                          { backgroundColor: p.bg, borderColor: isSelected ? (p.text === '#FFFFFF' ? '#FFC700' : '#000000') : p.border },
                          isSelected && styles.paletteChipSelected
                        ]}
                        onPress={() => {
                          setSelectedBrandColor(p.primary);
                          broadcastPreviewUpdate({ brandColor: p.primary });
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.paletteDot, { backgroundColor: p.primary, borderWidth: p.primary === '#FFFFFF' ? 1 : 0, borderColor: '#CBD5E1' }]} />
                        <Text style={[styles.paletteName, { color: p.text || '#0F172A' }, isSelected && { fontWeight: '800' }]}>
                          {p.name}
                        </Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={16} color={p.checkmark || p.text} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Brand Color Hex + Visual Color Wheel */}
                <View style={styles.hexInputRow}>
                  <View 
                    style={[
                      styles.hexInputSwatch, 
                      { backgroundColor: selectedBrandColor || '#FFC700', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', position: 'relative' }
                    ]}
                  >
                    {Platform.OS === 'web' ? (
                      React.createElement('input', {
                        id: 'risev_brand_color_wheel_input',
                        type: 'color',
                        value: selectedBrandColor || '#FFC700',
                        onChange: (e: any) => {
                          const val = e.target.value.toUpperCase();
                          setSelectedBrandColor(val);
                          broadcastPreviewUpdate({ brandColor: val });
                        },
                        style: {
                          position: 'absolute',
                          top: -10,
                          left: -10,
                          width: '200%',
                          height: '200%',
                          cursor: 'pointer',
                          opacity: 0,
                        },
                        title: 'Choose Brand Color',
                      })
                    ) : null}
                    <Ionicons name="color-palette" size={16} color={getContrastColor(selectedBrandColor || '#FFC700')} />
                  </View>

                  <TextInput
                    style={styles.hexTextInput}
                    placeholder="#FFC700"
                    placeholderTextColor="#94A3B8"
                    value={selectedBrandColor}
                    onChangeText={(val) => {
                      let formatted = val.trim();
                      if (formatted && !formatted.startsWith('#')) formatted = '#' + formatted;
                      setSelectedBrandColor(formatted);
                      if (formatted.length === 7) {
                        broadcastPreviewUpdate({ brandColor: formatted });
                      }
                    }}
                    maxLength={7}
                    autoCapitalize="characters"
                  />

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6 }}
                    onPress={() => {
                      if (Platform.OS === 'web' && typeof document !== 'undefined') {
                        const inputEl = document.getElementById('risev_brand_color_wheel_input');
                        if (inputEl) inputEl.click();
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="color-palette-outline" size={18} color="#0284C7" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0284C7' }}>Color Wheel 🎨</Text>
                  </TouchableOpacity>
                </View>

                {/* SECTION 2: Background Theme Color */}
                <Text style={[styles.brandingFieldLabel, { marginTop: 20 }]}>2. Background Theme (PWA & VIP Card)</Text>
                <View style={styles.paletteGrid}>
                  {BG_THEME_PALETTES.map(p => {
                    const isSelected = selectedBgColor.toLowerCase() === p.primary.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.paletteChip,
                          { backgroundColor: p.bg, borderColor: isSelected ? (p.text === '#FFFFFF' ? '#FFC700' : '#000000') : p.border },
                          isSelected && styles.paletteChipSelected
                        ]}
                        onPress={() => {
                          setSelectedBgColor(p.primary);
                          broadcastPreviewUpdate({ bgColor: p.primary });
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.paletteDot, { backgroundColor: p.primary, borderWidth: p.primary === '#FFFFFF' ? 1 : 0, borderColor: '#CBD5E1' }]} />
                        <Text style={[styles.paletteName, { color: p.text || '#0F172A' }, isSelected && { fontWeight: '800' }]}>
                          {p.name}
                        </Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={16} color={p.checkmark || p.text} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Background Color Hex + Visual Color Wheel */}
                <View style={styles.hexInputRow}>
                  <View 
                    style={[
                      styles.hexInputSwatch, 
                      { backgroundColor: selectedBgColor || '#121318', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', position: 'relative', borderWidth: selectedBgColor === '#FFFFFF' ? 1 : 0, borderColor: '#CBD5E1' }
                    ]}
                  >
                    {Platform.OS === 'web' ? (
                      React.createElement('input', {
                        id: 'risev_bg_color_wheel_input',
                        type: 'color',
                        value: selectedBgColor || '#121318',
                        onChange: (e: any) => {
                          const val = e.target.value.toUpperCase();
                          setSelectedBgColor(val);
                          broadcastPreviewUpdate({ bgColor: val });
                        },
                        style: {
                          position: 'absolute',
                          top: -10,
                          left: -10,
                          width: '200%',
                          height: '200%',
                          cursor: 'pointer',
                          opacity: 0,
                        },
                        title: 'Choose Background Color',
                      })
                    ) : null}
                    <Ionicons name="color-palette" size={16} color={getContrastColor(selectedBgColor || '#121318')} />
                  </View>

                  <TextInput
                    style={styles.hexTextInput}
                    placeholder="#121318"
                    placeholderTextColor="#94A3B8"
                    value={selectedBgColor}
                    onChangeText={(val) => {
                      let formatted = val.trim();
                      if (formatted && !formatted.startsWith('#')) formatted = '#' + formatted;
                      setSelectedBgColor(formatted);
                      if (formatted.length === 7) {
                        broadcastPreviewUpdate({ bgColor: formatted });
                      }
                    }}
                    maxLength={7}
                    autoCapitalize="characters"
                  />

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6 }}
                    onPress={() => {
                      if (Platform.OS === 'web' && typeof document !== 'undefined') {
                        const inputEl = document.getElementById('risev_bg_color_wheel_input');
                        if (inputEl) inputEl.click();
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="color-palette-outline" size={18} color="#0284C7" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0284C7' }}>Color Wheel 🎨</Text>
                  </TouchableOpacity>
                </View>

                {/* SECTION 3: Button & Capsule Pod Color */}
                <Text style={[styles.brandingFieldLabel, { marginTop: 20 }]}>3. Buttons & Capsule Pod Color</Text>
                <View style={styles.paletteGrid}>
                  {POD_COLOR_PALETTES.map(p => {
                    const isSelected = selectedPodColor.toLowerCase() === p.primary.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.paletteChip,
                          { backgroundColor: p.bg, borderColor: isSelected ? '#000000' : p.border },
                          isSelected && styles.paletteChipSelected
                        ]}
                        onPress={() => {
                          setSelectedPodColor(p.primary);
                          broadcastPreviewUpdate({ podColor: p.primary });
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.paletteDot, { backgroundColor: p.primary === 'auto' ? '#0284C7' : p.primary, borderWidth: 1, borderColor: '#CBD5E1' }]} />
                        <Text style={[styles.paletteName, { color: p.text || '#0F172A' }, isSelected && { fontWeight: '800' }]}>
                          {p.name}
                        </Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={16} color={p.checkmark || p.text} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Pod Color Hex + Visual Color Wheel */}
                <View style={styles.hexInputRow}>
                  <View 
                    style={[
                      styles.hexInputSwatch, 
                      { backgroundColor: selectedPodColor === 'auto' ? '#FFFFFF' : (selectedPodColor || '#FFFFFF'), overflow: 'hidden', alignItems: 'center', justifyContent: 'center', position: 'relative', borderWidth: 1, borderColor: '#CBD5E1' }
                    ]}
                  >
                    {Platform.OS === 'web' ? (
                      React.createElement('input', {
                        id: 'risev_pod_color_wheel_input',
                        type: 'color',
                        value: selectedPodColor === 'auto' ? '#FFFFFF' : (selectedPodColor || '#FFFFFF'),
                        onChange: (e: any) => {
                          const val = e.target.value.toUpperCase();
                          setSelectedPodColor(val);
                          broadcastPreviewUpdate({ podColor: val });
                        },
                        style: {
                          position: 'absolute',
                          top: -10,
                          left: -10,
                          width: '200%',
                          height: '200%',
                          cursor: 'pointer',
                          opacity: 0,
                        },
                        title: 'Choose Button & Pod Color',
                      })
                    ) : null}
                    <Ionicons name="color-palette" size={16} color={getContrastColor(selectedPodColor === 'auto' ? '#FFFFFF' : (selectedPodColor || '#FFFFFF'))} />
                  </View>

                  <TextInput
                    style={styles.hexTextInput}
                    placeholder="auto or #FFFFFF"
                    placeholderTextColor="#94A3B8"
                    value={selectedPodColor}
                    onChangeText={(val) => {
                      let formatted = val.trim();
                      if (formatted && formatted !== 'auto' && !formatted.startsWith('#')) formatted = '#' + formatted;
                      setSelectedPodColor(formatted);
                      if (formatted === 'auto' || formatted.length === 7) {
                        broadcastPreviewUpdate({ podColor: formatted });
                      }
                    }}
                    maxLength={15}
                  />

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6 }}
                    onPress={() => {
                      if (Platform.OS === 'web' && typeof document !== 'undefined') {
                        const inputEl = document.getElementById('risev_pod_color_wheel_input');
                        if (inputEl) inputEl.click();
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="color-palette-outline" size={18} color="#0284C7" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0284C7' }}>Color Wheel 🎨</Text>
                  </TouchableOpacity>
                </View>

                {/* Real Store Hero Banner Photo Uploader */}
                <Text style={[styles.brandingFieldLabel, { marginTop: 18 }]}>Store Hero Banner Photo</Text>
                <Text style={styles.brandingFieldSub}>
                  Upload a high-quality photo of your storefront, salon, or workspace (16:9 recommended).
                </Text>

                <View style={styles.bannerUploadCard}>
                  {bannerPreview ? (
                    <View style={styles.bannerPreviewWrapper}>
                      <Image source={{ uri: bannerPreview }} style={styles.bannerPreviewImg} />
                      <View style={styles.bannerActionsOverlay}>
                        <TouchableOpacity
                          style={styles.btnChangeBannerPill}
                          onPress={handlePickBanner}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="camera-outline" size={14} color="#FFF" />
                          <Text style={styles.btnChangeBannerPillText}>Change Photo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnRemoveBannerPill}
                          onPress={() => {
                            setBannerPreview(null);
                            setBannerFile(null);
                            setCustomCoverUrl('');
                            broadcastPreviewUpdate({ coverUrl: '' });
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trash-outline" size={14} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.bannerPlaceholderBox}
                      onPress={handlePickBanner}
                      activeOpacity={0.7}
                    >
                      <View style={styles.bannerPlaceholderIconCircle}>
                        <Ionicons name="cloud-upload-outline" size={26} color="#D97706" />
                      </View>
                      <Text style={styles.bannerPlaceholderTitle}>Tap to Upload Store Banner</Text>
                      <Text style={styles.bannerPlaceholderSubtitle}>PNG, JPG, or WEBP up to 5MB</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Tagline Field */}
                <Text style={[styles.brandingFieldLabel, { marginTop: 12 }]}>Store Tagline & Subtitle</Text>
                <View style={styles.taglineInputRow}>
                  <Ionicons name="pricetag-outline" size={18} color="#64748B" />
                  <TextInput
                    style={styles.taglineTextInput}
                    placeholder="e.g. Handcrafted Gelato • Waffles • Desserts"
                    value={customTagline}
                    onChangeText={(val) => {
                      setCustomTagline(val);
                      broadcastPreviewUpdate({ tagline: val });
                    }}
                  />
                </View>

                {/* Save Branding Button (Fixed Yellow) */}
                <TouchableOpacity
                  style={styles.btnSaveBranding}
                  onPress={handleSaveBranding}
                  disabled={isSavingBranding}
                  activeOpacity={0.85}
                >
                  {isSavingBranding ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={18} color="#000000" />
                      <Text style={styles.btnSaveBrandingText}>Save & Update Live PWA</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Official Booking Link Box */}
              <View style={styles.officialLinkBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="link" size={16} color="#000" />
                  <Text style={styles.officialLinkLabel}>OFFICIAL BOOKING LINK</Text>
                </View>

                <View style={styles.urlDisplayRow}>
                  <Text style={styles.urlDisplayText} numberOfLines={1}>
                    https://risev.app/b/{pwaSlug}
                  </Text>
                  <TouchableOpacity onPress={handleCopyLink}>
                    <Ionicons name="copy-outline" size={18} color="#000" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    style={styles.btnSalinPautanMain}
                    onPress={handleCopyLink}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="copy-outline" size={16} color="#000" />
                    <Text style={styles.btnSalinPautanText}>
                      {copiedLink ? 'Link Copied!' : 'Copy Link'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnPreviewOutline}
                    onPress={() => router.push(`/b/${pwaSlug}` as any)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="open-outline" size={16} color="#000" />
                    <Text style={styles.btnPreviewText}>Preview</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Share Your Booking Page */}
              <View style={styles.shareSection}>
                <Text style={styles.shareSectionTitle}>Share Your Booking Page</Text>

                <View style={styles.shareButtonsGrid}>
                  
                  {/* WhatsApp Share */}
                  <TouchableOpacity
                    style={styles.shareItem}
                    onPress={() => handleShare('whatsapp')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.shareIconCircle, { backgroundColor: '#25D366' }]}>
                      <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
                    </View>
                    <Text style={styles.shareItemLabel}>WhatsApp</Text>
                  </TouchableOpacity>

                  {/* Instagram Share */}
                  <TouchableOpacity
                    style={styles.shareItem}
                    onPress={() => handleShare('instagram')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.shareIconCircle, { backgroundColor: '#E1306C' }]}>
                      <Ionicons name="logo-instagram" size={24} color="#FFF" />
                    </View>
                    <Text style={styles.shareItemLabel}>Instagram</Text>
                  </TouchableOpacity>

                  {/* QR Code Share */}
                  <TouchableOpacity
                    style={styles.shareItem}
                    onPress={handleCopyLink}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.shareIconCircle, { backgroundColor: '#000000' }]}>
                      <Ionicons name="qr-code-outline" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.shareItemLabel}>QR Code</Text>
                  </TouchableOpacity>

                  {/* Others Share */}
                  <TouchableOpacity
                    style={styles.shareItem}
                    onPress={() => handleShare('other')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.shareIconCircle, { backgroundColor: '#64748B' }]}>
                      <Ionicons name="share-social-outline" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.shareItemLabel}>More</Text>
                  </TouchableOpacity>

                </View>
              </View>

            </View>
          )}

        </ScrollView>
      )}

      {/* Floating Action Help Button (FAB) */}
      <TouchableOpacity
        style={styles.fabHelpButton}
        onPress={() => Alert.alert('Help Center', 'Need help with Booking Suite? Contact Risev support.')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabHelpText}>?</Text>
      </TouchableOpacity>

      {/* Add Item 3-Step Wizard Modal */}
      <Modal visible={showAddServiceModal} animationType="slide" transparent={true}>
        <View style={styles.calendarModalOverlay}>
          <View style={styles.wizardModalContainer}>
            
            {/* STEP 1: SELECT TYPE */}
            {addModalStep === 1 && (
              <View>
                <View style={styles.wizardHeaderRow}>
                  <View>
                    <Text style={styles.wizardMainTitle}>{editingService ? 'Edit Item' : 'Add Item'}</Text>
                    <Text style={styles.wizardSubTitle}>What would you like to add?</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleCloseAddService}
                    style={styles.btnCloseWizard}
                  >
                    <Ionicons name="close" size={20} color="#050505" />
                  </TouchableOpacity>
                </View>

                <View style={styles.typeCardsList}>
                  {/* Service Card */}
                  <TouchableOpacity
                    style={[styles.typeCardItem, addItemType === 'service' && styles.typeCardItemSelected]}
                    onPress={() => {
                      setAddItemType('service');
                      setAddModalStep(2);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.typeIconBox}>
                      <Ionicons name="cut-outline" size={22} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeCardTitle}>Service</Text>
                      <Text style={styles.typeCardSub}>One-on-one appointment</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#64748B" />
                  </TouchableOpacity>

                  {/* Class / Session Card */}
                  <TouchableOpacity
                    style={[styles.typeCardItem, addItemType === 'class' && styles.typeCardItemSelected]}
                    onPress={() => {
                      setAddItemType('class');
                      setAddModalStep(2);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.typeIconBox}>
                      <Ionicons name="calendar-outline" size={22} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeCardTitle}>Class / Session</Text>
                      <Text style={styles.typeCardSub}>Group session with a set schedule</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#64748B" />
                  </TouchableOpacity>

                  {/* Product Card */}
                  <TouchableOpacity
                    style={[styles.typeCardItem, addItemType === 'product' && styles.typeCardItemSelected]}
                    onPress={() => {
                      setAddItemType('product');
                      setAddModalStep(2);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.typeIconBox}>
                      <Ionicons name="cube-outline" size={22} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeCardTitle}>Product</Text>
                      <Text style={styles.typeCardSub}>Physical product for sale</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#64748B" />
                  </TouchableOpacity>

                  {/* Add-on Card */}
                  <TouchableOpacity
                    style={[styles.typeCardItem, addItemType === 'addon' && styles.typeCardItemSelected]}
                    onPress={() => {
                      setAddItemType('addon');
                      setAddModalStep(2);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.typeIconBox}>
                      <Ionicons name="extension-puzzle-outline" size={22} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeCardTitle}>Add-on</Text>
                      <Text style={styles.typeCardSub}>Extra service or option</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 2: BASIC INFO */}
            {addModalStep === 2 && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                
                {/* Header */}
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity 
                    onPress={() => {
                      if (editingService) {
                        handleCloseAddService();
                      } else {
                        setAddModalStep(1);
                      }
                    }} 
                    style={styles.btnBackWizard}
                  >
                    <Ionicons name="arrow-back" size={20} color="#050505" />
                  </TouchableOpacity>

                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.wizardMainTitle}>{editingService ? 'Edit Service' : 'New Service'}</Text>
                    <Text style={styles.wizardStepIndicatorText}>
                      {editingService ? 'Edit Details • Basic Info' : 'Step 1 of 2 • Basic Info'}
                    </Text>
                  </View>

                  <TouchableOpacity onPress={handleCloseAddService} style={styles.btnCloseWizard}>
                    <Ionicons name="close" size={20} color="#050505" />
                  </TouchableOpacity>
                </View>

                {/* Progress Track (50%) */}
                <View style={styles.wizardProgressTrack}>
                  <View style={[styles.wizardProgressFill, { width: '50%' }]} />
                </View>

                {/* Photo Upload Area */}
                <View style={styles.photoUploadRow}>
                  {photoUri ? (
                    <View style={styles.photoPreviewBox}>
                      <Image source={{ uri: photoUri }} style={styles.photoImage} />
                      <TouchableOpacity 
                        onPress={() => {
                          setPhotoUri(null);
                          setPhotoFile(null);
                        }} 
                        style={styles.btnRemovePhoto}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.btnAddPhotoBox}
                    onPress={handlePickPhoto}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={photoUri ? "images-outline" : "camera-outline"} size={22} color="#64748B" />
                    <Text style={styles.btnAddPhotoText}>{photoUri ? 'Change' : 'Add Photo'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Form Inputs */}
                <View style={styles.wizardFormGroup}>
                  <Text style={styles.wizardInputLabel}>Service Name</Text>
                  <TextInput
                    style={styles.wizardInputText}
                    placeholder="Signature Fade Cut"
                    placeholderTextColor="#94A3B8"
                    value={newServiceName}
                    onChangeText={setNewServiceName}
                  />
                </View>

                <View style={styles.wizardFormGroup}>
                  <Text style={styles.wizardInputLabel}>Category</Text>
                  <TouchableOpacity
                    style={styles.dropdownPickerBox}
                    onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="cut-outline" size={16} color="#000" />
                    <Text style={styles.dropdownPickerValue}>{newServiceCategory}</Text>
                    <Ionicons name={showCategoryPicker ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
                  </TouchableOpacity>
                  {showCategoryPicker && (
                    <View style={styles.pickerOptionsWrap}>
                      {['Haircut', 'Hair Treatment', 'Shave & Beard', 'Facial & Spa', 'Styling', 'Coloring', 'Massage', 'Other'].map(cat => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.pickerOptionChip, newServiceCategory === cat && styles.pickerOptionChipActive]}
                          onPress={() => {
                            setNewServiceCategory(cat);
                            setShowCategoryPicker(false);
                          }}
                        >
                          <Text style={[styles.pickerOptionText, newServiceCategory === cat && styles.pickerOptionTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Price & Duration */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wizardInputLabel}>Price (RM)</Text>
                    <TextInput
                      style={styles.wizardInputText}
                      placeholder="35.00"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={newServicePrice}
                      onChangeText={setNewServicePrice}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.wizardInputLabel}>Duration</Text>
                    <TouchableOpacity
                      style={styles.dropdownPickerBox}
                      onPress={() => setShowDurationPicker(!showDurationPicker)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownPickerValue}>{newServiceDuration} mins</Text>
                      <Ionicons name={showDurationPicker ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>

                {showDurationPicker && (
                  <View style={[styles.pickerOptionsWrap, { marginBottom: 16, marginTop: -8 }]}>
                    {['15', '30', '45', '60', '90', '120'].map(dur => (
                      <TouchableOpacity
                        key={dur}
                        style={[styles.pickerOptionChip, newServiceDuration === dur && styles.pickerOptionChipActive]}
                        onPress={() => {
                          setNewServiceDuration(dur);
                          setShowDurationPicker(false);
                        }}
                      >
                        <Text style={[styles.pickerOptionText, newServiceDuration === dur && styles.pickerOptionTextActive]}>
                          {dur} mins
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Available for Online Booking Toggle */}
                <View style={styles.toggleRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleRowTitle}>Available for online booking</Text>
                    <Text style={styles.toggleRowSub}>Show this service on your booking page.</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.switchTrack, isOnlineAvailable && styles.switchTrackActive]}
                    onPress={() => setIsOnlineAvailable(!isOnlineAvailable)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.switchThumb, isOnlineAvailable && styles.switchThumbActive]} />
                  </TouchableOpacity>
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity
                    style={[styles.btnWizardPrimary, { flex: 1, backgroundColor: '#F1F5F9', elevation: 0, shadowOpacity: 0 }]}
                    onPress={async () => {
                      const ok = await handleCreateService();
                      if (ok) {
                        setAddModalStep(1);
                      }
                    }}
                    disabled={isSavingService}
                    activeOpacity={0.8}
                  >
                    {isSavingService ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={[styles.btnWizardPrimaryText, { color: '#0F172A' }]}>
                        {editingService ? 'Save Changes' : 'Quick Save'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnWizardPrimary, { flex: 1.4 }]}
                    onPress={() => setAddModalStep(3)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.btnWizardPrimaryText}>More Settings ➔</Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            )}

            {/* STEP 3: OPTIONAL SETTINGS */}
            {addModalStep === 3 && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                
                {/* Header */}
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity onPress={() => setAddModalStep(2)} style={styles.btnBackWizard}>
                    <Ionicons name="arrow-back" size={20} color="#050505" />
                  </TouchableOpacity>

                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.wizardMainTitle}>{editingService ? 'Edit Service' : 'More Settings'}</Text>
                    <Text style={styles.wizardStepIndicatorText}>
                      {editingService ? 'Edit Details • Settings' : 'Step 2 of 2 • Optional'}
                    </Text>
                  </View>

                  <TouchableOpacity onPress={handleCloseAddService} style={styles.btnCloseWizard}>
                    <Ionicons name="close" size={20} color="#050505" />
                  </TouchableOpacity>
                </View>

                {/* Progress Track (100%) */}
                <View style={styles.wizardProgressTrack}>
                  <View style={[styles.wizardProgressFill, { width: '100%' }]} />
                </View>

                {/* Settings Card 1: Staff Assignment */}
                <View style={styles.settingAccordionCard}>
                  <View style={styles.settingHeaderRow}>
                    <Ionicons name="people-outline" size={20} color="#000" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Staff Assignment</Text>
                      <Text style={styles.settingSub}>Choose who can provide this service</Text>
                    </View>
                  </View>

                  {/* Selected Staff Chips */}
                  <View style={styles.staffChipsRow}>
                    {assignedStaff.map(st => (
                      <View key={st} style={styles.staffChipPill}>
                        <View style={styles.staffChipAvatarBadge}>
                          <Text style={styles.staffChipAvatarBadgeText}>
                            {(st || 'S').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.staffChipName}>{st}</Text>
                        <TouchableOpacity onPress={() => setAssignedStaff(prev => prev.filter(s => s !== st))}>
                          <Ionicons name="close" size={14} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {!isAddingStaff && (
                      <TouchableOpacity
                        style={styles.btnAddStaffPill}
                        onPress={() => setIsAddingStaff(true)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={14} color="#000" />
                        <Text style={styles.btnAddStaffText}>Add Staff</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Inline Staff Input & Quick Suggestions */}
                  {isAddingStaff && (
                    <View style={{ marginTop: 10 }}>
                      {staffList.filter(s => s.name && !assignedStaff.includes(s.name)).length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {staffList
                            .filter(s => s.name && !assignedStaff.includes(s.name))
                            .map(s => (
                              <TouchableOpacity
                                key={s.id || s.name}
                                style={[styles.staffChipPill, { backgroundColor: '#F8FAFC' }]}
                                onPress={() => {
                                  setAssignedStaff(prev => [...prev, s.name]);
                                  setIsAddingStaff(false);
                                }}
                              >
                                <Ionicons name="person-add-outline" size={12} color="#050505" />
                                <Text style={styles.staffChipName}>{s.name}</Text>
                              </TouchableOpacity>
                            ))}
                        </View>
                      )}
                      <View style={styles.staffInputWrap}>
                        <TextInput
                          style={styles.staffInputField}
                          placeholder="Staff or Provider Name..."
                          placeholderTextColor="#94A3B8"
                          value={newStaffInput}
                          onChangeText={setNewStaffInput}
                          autoFocus
                        />
                        <TouchableOpacity
                          style={styles.btnStaffInlineAdd}
                          onPress={handleAddStaffSubmit}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="checkmark" size={16} color="#000" />
                          <Text style={styles.btnStaffInlineAddText}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btnStaffInlineCancel}
                          onPress={() => {
                            setNewStaffInput('');
                            setIsAddingStaff(false);
                          }}
                        >
                          <Ionicons name="close" size={16} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Settings Card 2: Location */}
                <View style={styles.settingAccordionCard}>
                  <View style={styles.settingHeaderRow}>
                    <Ionicons name="location-outline" size={20} color="#000" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Location</Text>
                      <Text style={styles.settingSub}>Where is this service provided?</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.dropdownPickerBox}
                    onPress={() => setShowLocationPicker(!showLocationPicker)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownPickerValue}>{selectedLocation || locationOptions[0] || 'Main Location'}</Text>
                    <Ionicons name={showLocationPicker ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
                  </TouchableOpacity>

                  {showLocationPicker && (
                    <View style={styles.pickerOptionsWrap}>
                      {locationOptions.map(loc => (
                        <TouchableOpacity
                          key={loc}
                          style={[styles.pickerOptionChip, selectedLocation === loc && styles.pickerOptionChipActive]}
                          onPress={() => {
                            setSelectedLocation(loc);
                            setShowLocationPicker(false);
                          }}
                        >
                          <Text style={[styles.pickerOptionText, selectedLocation === loc && styles.pickerOptionTextActive]}>
                            {loc}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Settings Card 3: Buffer Time */}
                <View style={styles.settingAccordionCard}>
                  <View style={styles.settingHeaderRow}>
                    <Ionicons name="time-outline" size={20} color="#000" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Buffer Time</Text>
                      <Text style={styles.settingSub}>Add time before and after each booking</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.dropdownPickerBox}
                    onPress={() => setShowBufferPicker(!showBufferPicker)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownPickerValue}>{bufferTime}</Text>
                    <Ionicons name={showBufferPicker ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
                  </TouchableOpacity>

                  {showBufferPicker && (
                    <View style={styles.pickerOptionsWrap}>
                      {['No buffer', '5 minutes', '10 minutes', '15 minutes', '30 minutes'].map(buf => (
                        <TouchableOpacity
                          key={buf}
                          style={[styles.pickerOptionChip, bufferTime === buf && styles.pickerOptionChipActive]}
                          onPress={() => {
                            setBufferTime(buf);
                            setShowBufferPicker(false);
                          }}
                        >
                          <Text style={[styles.pickerOptionText, bufferTime === buf && styles.pickerOptionTextActive]}>
                            {buf}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Settings Card 4: Deposit */}
                <View style={styles.settingAccordionCard}>
                  <View style={styles.settingHeaderRow}>
                    <Ionicons name="card-outline" size={20} color="#000" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Deposit</Text>
                      <Text style={styles.settingSub}>Require a deposit to confirm booking</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.dropdownPickerBox}
                    onPress={() => setShowDepositPicker(!showDepositPicker)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownPickerValue}>{depositPolicy}</Text>
                    <Ionicons name={showDepositPicker ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
                  </TouchableOpacity>

                  {showDepositPicker && (
                    <View style={styles.pickerOptionsWrap}>
                      {['No deposit', 'RM 10.00', 'RM 20.00', '50% Deposit', 'Full Payment Required'].map(dep => (
                        <TouchableOpacity
                          key={dep}
                          style={[styles.pickerOptionChip, depositPolicy === dep && styles.pickerOptionChipActive]}
                          onPress={() => {
                            setDepositPolicy(dep);
                            setShowDepositPicker(false);
                          }}
                        >
                          <Text style={[styles.pickerOptionText, depositPolicy === dep && styles.pickerOptionTextActive]}>
                            {dep}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={styles.btnWizardPrimary}
                  onPress={async () => {
                    const ok = await handleCreateService();
                    if (ok) {
                      setAddModalStep(1);
                    }
                  }}
                  disabled={isSavingService}
                  activeOpacity={0.85}
                >
                  {isSavingService ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.btnWizardPrimaryText}>
                      {editingService ? 'Save Changes ➔' : 'Create Service ➔'}
                    </Text>
                  )}
                </TouchableOpacity>

              </ScrollView>
            )}

          </View>
        </View>
      </Modal>

      {/* Service Item Actions Bottom Sheet / Modal */}
      <Modal visible={showServiceActionModal} animationType="fade" transparent={true} onRequestClose={() => setShowServiceActionModal(false)}>
        <TouchableOpacity 
          style={styles.actionSheetOverlay} 
          activeOpacity={1} 
          onPress={() => setShowServiceActionModal(false)}
        >
          <TouchableOpacity style={styles.actionSheetCard} activeOpacity={1} onPress={(e: any) => { if (e?.stopPropagation) e.stopPropagation(); }}>
            <View style={styles.actionSheetDragIndicator} />

            {selectedActionService && (
              <>
                <View style={styles.actionSheetHeader}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.actionSheetTitle} numberOfLines={1}>{selectedActionService.name}</Text>
                    <Text style={styles.actionSheetSubtitle}>
                      {selectedActionService.category} • RM {Number(selectedActionService.price || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.activeBadge, !selectedActionService.is_active && { backgroundColor: '#F1F5F9' }]}>
                    <Text style={[styles.activeBadgeText, !selectedActionService.is_active && { color: '#64748B' }]}>
                      {selectedActionService.is_active ? '● Active' : '○ Inactive'}
                    </Text>
                  </View>
                </View>

                {/* Option 1: Edit Details */}
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    if (selectedActionService) {
                      handleOpenEditService(selectedActionService);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionSheetIconBox, { backgroundColor: '#FEF9C3' }]}>
                    <Ionicons name="create-outline" size={20} color="#CA8A04" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionSheetItemTitle}>Edit Service</Text>
                    <Text style={styles.actionSheetItemSub}>Modify title, pricing, category or duration</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

                {/* Option 2: Toggle Active Status */}
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    if (selectedActionService) {
                      handleToggleServiceStatus(selectedActionService);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionSheetIconBox, { backgroundColor: selectedActionService.is_active ? '#FEE2E2' : '#DCFCE7' }]}>
                    <Ionicons 
                      name={selectedActionService.is_active ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color={selectedActionService.is_active ? "#DC2626" : "#16A34A"} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionSheetItemTitle}>
                      {selectedActionService.is_active ? 'Set as Inactive' : 'Set as Active'}
                    </Text>
                    <Text style={styles.actionSheetItemSub}>
                      {selectedActionService.is_active ? 'Hide from online booking storefront' : 'Make available for customer bookings'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

                {/* Option 3: Delete Service */}
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    if (selectedActionService) {
                      handleDeleteService(selectedActionService);
                    }
                  }}
                  disabled={isDeletingService}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionSheetIconBox, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionSheetItemTitle, { color: '#DC2626' }]}>
                      {isDeletingService ? 'Deleting...' : 'Delete Service'}
                    </Text>
                    <Text style={styles.actionSheetItemSub}>Permanently delete this service from catalog</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.actionSheetCancelBtn}
                  onPress={() => setShowServiceActionModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionSheetCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* View Calendar Modal */}
      <Modal visible={showCalendarModal} animationType="slide" transparent={true}>
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContainer}>
            
            {/* Modal Header */}
            <View style={styles.calendarModalHeader}>
              <Text style={styles.calendarModalTitle}>Appointment Calendar</Text>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)} style={styles.btnCloseModal}>
                <Ionicons name="close" size={20} color="#050505" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              
              {/* Day / Week / Month Switcher Pills */}
              <View style={styles.calTabPillsWrap}>
                <TouchableOpacity
                  style={[styles.calTabPill, calViewMode === 'day' && styles.calTabPillActive]}
                  onPress={() => setCalViewMode('day')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.calTabPillText, calViewMode === 'day' && styles.calTabPillTextActive]}>Day</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.calTabPill, calViewMode === 'week' && styles.calTabPillActive]}
                  onPress={() => setCalViewMode('week')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.calTabPillText, calViewMode === 'week' && styles.calTabPillTextActive]}>Week</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.calTabPill, calViewMode === 'month' && styles.calTabPillActive]}
                  onPress={() => setCalViewMode('month')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.calTabPillText, calViewMode === 'month' && styles.calTabPillTextActive]}>Month</Text>
                </TouchableOpacity>
              </View>

              {/* Month Navigator Header */}
              <View style={styles.monthNavHeader}>
                <TouchableOpacity onPress={handleCalendarNavPrev} style={styles.btnMonthArrow} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={18} color="#050505" />
                </TouchableOpacity>
                <Text style={styles.monthTitleText}>
                  {calViewMode === 'month'
                    ? calMonthDate.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
                    : selectedDateTitle}
                </Text>
                <TouchableOpacity onPress={handleCalendarNavNext} style={styles.btnMonthArrow} activeOpacity={0.7}>
                  <Ionicons name="chevron-forward" size={18} color="#050505" />
                </TouchableOpacity>
              </View>

              {/* Weekday Headers (for Month and Week views) */}
              {calViewMode !== 'day' && (
                <View style={styles.weekdaysRow}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <Text key={d} style={styles.weekdayText}>{d}</Text>
                  ))}
                </View>
              )}

              {/* Month Calendar Grid (7 columns) */}
              {calViewMode === 'month' && (
                <View style={styles.monthGrid}>
                  {calendarDays.map((item, idx) => {
                    const isSel = item.isoDate === selectedCalIsoDate;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.gridCell,
                          (item.isPrev || item.isNext) && styles.gridCellPrev,
                          isSel && styles.gridCellSelected
                        ]}
                        onPress={() => handleSelectCalendarDate(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.gridDayNum,
                          (item.isPrev || item.isNext) && styles.gridDayNumPrev,
                          isSel && styles.gridDayNumSelected
                        ]}>
                          {item.day}
                        </Text>

                        {item.count > 0 && (
                          <View style={styles.gridBadgeRow}>
                            <View style={[styles.gridDot, { backgroundColor: item.dotColor || '#3B82F6' }]} />
                            <Text style={[styles.gridCountText, isSel && styles.gridCountTextSelected]}>
                              {item.count}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Week Calendar Row */}
              {calViewMode === 'week' && (
                <View style={[styles.monthGrid, { marginBottom: 12 }]}>
                  {calendarWeekDays.map((item, idx) => {
                    const isSel = item.isoDate === selectedCalIsoDate;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.gridCell,
                          isSel && styles.gridCellSelected
                        ]}
                        onPress={() => handleSelectCalendarDate(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.gridDayNum,
                          isSel && styles.gridDayNumSelected
                        ]}>
                          {item.day}
                        </Text>

                        {item.count > 0 && (
                          <View style={styles.gridBadgeRow}>
                            <View style={[styles.gridDot, { backgroundColor: item.dotColor || '#3B82F6' }]} />
                            <Text style={[styles.gridCountText, isSel && styles.gridCountTextSelected]}>
                              {item.count}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Selected Day Schedule Title Row */}
              <View style={styles.dayScheduleHeaderRow}>
                <View>
                  <Text style={styles.dayScheduleTitle}>{selectedDateTitle}</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 1 }}>
                    {selectedDateSubtitle}
                  </Text>
                </View>
                <Text style={styles.dayScheduleSub}>
                  {selectedDayBookings.length} {selectedDayBookings.length === 1 ? 'appointment' : 'appointments'}
                </Text>
              </View>

              {/* Appointment Cards List Below Calendar */}
              <View style={styles.dayApptList}>
                {selectedDayBookings.length === 0 ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <Ionicons name="calendar-outline" size={44} color="#CBD5E1" />
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginTop: 12 }}>
                      No Appointments on this Day
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>
                      There are no scheduled, completed or missed appointments on {selectedDateTitle}.
                    </Text>
                  </View>
                ) : (
                  selectedDayBookings.map((b) => (
                    <View
                      key={b.id}
                      style={[
                        styles.calApptCard,
                        b.status === 'no_show' && { borderColor: '#FECACA', backgroundColor: '#FFF5F5' },
                        b.status === 'completed' && { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' }}>
                        <View style={[
                          styles.calCustAvatarBadge,
                          b.status === 'no_show' && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
                          b.status === 'completed' && { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }
                        ]}>
                          <Text style={[
                            styles.calCustAvatarBadgeText,
                            b.status === 'no_show' && { color: '#DC2626' },
                            b.status === 'completed' && { color: '#15803D' }
                          ]}>
                            {(b.customer_name || 'C').charAt(0).toUpperCase()}
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.calApptTime}>{b.start_time || '10:00 AM'} • {b.booking_date}</Text>
                          <Text style={styles.calCustName}>{b.customer_name || 'Customer'}</Text>
                          <Text style={styles.calSrvStaff}>
                            {b.service_name || 'Service'} • {b.staff_name || 'Staff'}
                            {b.total_price ? ` • RM ${Number(b.total_price).toFixed(2)}` : ''}
                          </Text>
                        </View>

                        {/* Status Badge */}
                        <View style={[
                          b.status === 'completed' ? styles.badgeArrived :
                          b.status === 'no_show' ? styles.badgeNoShow :
                          b.status === 'cancelled' ? styles.badgePending :
                          styles.badgeConfirmed
                        ]}>
                          <Ionicons
                            name={
                              b.status === 'completed' ? "checkmark-circle" :
                              b.status === 'no_show' ? "alert-circle" :
                              b.status === 'cancelled' ? "close-circle" :
                              "time"
                            }
                            size={12}
                            color={
                              b.status === 'completed' ? "#15803D" :
                              b.status === 'no_show' ? "#DC2626" :
                              b.status === 'cancelled' ? "#EF4444" :
                              "#2563EB"
                            }
                          />
                          <Text style={[
                            b.status === 'completed' ? styles.badgeArrivedText :
                            b.status === 'no_show' ? styles.badgeNoShowText :
                            b.status === 'cancelled' ? [styles.badgePendingText, { color: '#EF4444' }] :
                            styles.badgeConfirmedText
                          ]}>
                            {b.status === 'no_show' ? 'NO SHOW' : (b.status || 'booked').toUpperCase()}
                          </Text>
                        </View>

                        {/* WhatsApp Icon */}
                        <TouchableOpacity
                          onPress={() => b.status === 'no_show' ? handleNoShowWhatsApp(b) : handleCustomerWhatsApp(b)}
                          style={{ padding: 6, borderRadius: 10, backgroundColor: '#DCFCE7' }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                        </TouchableOpacity>
                      </View>

                      {/* Merchant Action Row under each card */}
                      <View style={styles.calCardActionRow}>
                        {b.status !== 'completed' && b.status !== 'no_show' && (
                          <>
                            <TouchableOpacity
                              style={styles.btnCalActionComplete}
                              onPress={() => handleUpdateStatus(b.id, 'completed')}
                              disabled={updatingId === b.id}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.btnCalActionCompleteText}>
                                {updatingId === b.id ? 'Updating...' : '✓ Complete & Stamp'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.btnCalActionNoShow}
                              onPress={() => handleMarkNoShow(b)}
                              disabled={updatingId === b.id}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.btnCalActionNoShowText}>
                                ✕ Mark No Show
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}

                        {b.status === 'no_show' && (
                          <>
                            <TouchableOpacity
                              style={styles.btnCalActionReopen}
                              onPress={() => handleUpdateStatus(b.id, 'booked')}
                              disabled={updatingId === b.id}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.btnCalActionReopenText}>
                                ↺ Reopen Booking
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.btnCalActionComplete}
                              onPress={() => handleNoShowWhatsApp(b)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.btnCalActionCompleteText}>
                                💬 WhatsApp Reschedule
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}

                        {b.status === 'completed' && (
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 }}>
                            <Ionicons name="checkmark-done-circle" size={16} color="#15803D" />
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#15803D' }}>
                              Completed & Loyalty Stamped
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>

            </ScrollView>

          </View>
        </View>
      </Modal>

      {/* Booking & PWA Suite Feature Access Gate Modal */}
      <BookingAccessModal
        visible={showBookingAccessModal}
        onClose={() => setShowBookingAccessModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  addonTag: {
    backgroundColor: '#FFFBEA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFC700',
  },
  addonTagText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
  },

  // Segmented Tabs
  tabBarWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 46,
  },
  tabItemActive: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabItemText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  tabItemTextActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },

  contentScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Yellow Hero Card
  yellowHeroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  yellowHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  yellowHeroTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  yellowHeroDate: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginTop: 2,
  },
  btnCalendarViewLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  btnCalendarViewTextLight: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  glassStatsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  glassStatBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 16,
    borderLeftWidth: 4,
    minHeight: 96,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statBoxTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  glassStatNum: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  statIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassStatLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
    lineHeight: 14,
  },

  // Filter Chips
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  filterPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // Appointments Header & Cards
  appointmentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  appointmentsSectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  btnDateSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  btnDateSelectText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },

  appointmentsList: {
    gap: 12,
  },
  bookingCardContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  timeColumn: {
    width: 54,
    alignItems: 'center',
    paddingTop: 4,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  timeSubText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },

  bookingCardMain: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  customerName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  customerPhone: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeArrived: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeBooked: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeCompleted: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeNoShow: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },

  serviceMetaBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  serviceNameText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  bookingPriceText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
  },

  staffMetaRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  staffMetaText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },

  bookingActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimaryAction: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFC700',
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnPrimaryActionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  btnSecondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnSecondaryActionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  btnDangerAction: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnDangerActionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#DC2626',
  },

  // Next Appointments
  nextTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 10,
  },
  emptyNextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  emptySubtext: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  emptyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 18,
    flexWrap: 'wrap',
  },
  btnEmptySecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  btnEmptySecondaryText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  btnEmptyPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFC700',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  btnEmptyPrimaryText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // FAB Help
  fabHelpButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },
  fabHelpText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // Services & Catalog Styles
  catalogHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  catalogSectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  catalogSectionSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  btnAddItemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFC700',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  btnAddItemText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  servicesCatalogList: {
    gap: 12,
    marginBottom: 18,
  },
  catalogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  catalogThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  catalogItemTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  catalogItemSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginVertical: 2,
  },
  catalogItemPrice: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  catalogRightWrap: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 56,
  },
  btnDotsMenu: {
    padding: 4,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },

  tipsCalloutCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEA',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  tipsIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  tipsText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },

  // PWA Tab Styles
  pwaSectionHeader: {
    marginBottom: 16,
  },
  pwaSectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  liveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  pwaSectionSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 4,
  },

  // Live Interactive PWA Preview Container
  previewContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    alignItems: 'center',
  },
  previewToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
    gap: 6,
  },
  previewUrlBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
  },
  previewLiveDot: {
    fontSize: 8,
    color: '#22C55E',
  },
  previewUrlText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    flexShrink: 1,
  },
  btnToolbarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  btnToolbarActionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  btnToolbarActionPrimary: {
    backgroundColor: '#FFC700',
  },
  btnToolbarActionPrimaryText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  deviceFrame: {
    width: '100%',
    maxWidth: 390,
    height: 640,
    backgroundColor: '#0F172A',
    borderRadius: 32,
    padding: 6,
    borderWidth: 4,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  deviceSpeakerBar: {
    width: 60,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    position: 'absolute',
    top: 6,
    zIndex: 10,
  },
  mobileFallbackPreview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  mobileFallbackTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginTop: 12,
  },
  mobileFallbackSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  btnOpenFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFC700',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  btnOpenFallbackText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // Official Link Box
  officialLinkBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  officialLinkLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
  },
  urlDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  urlDisplayText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  btnSalinPautanMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFC700',
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnSalinPautanText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  btnPreviewOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPreviewText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },

  // Share Section
  shareSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shareSectionTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 14,
  },
  shareButtonsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  shareItem: {
    alignItems: 'center',
  },
  shareIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shareItemLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },

  // 3-Step Wizard Modal Styles
  wizardModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  wizardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  wizardMainTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  wizardSubTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  wizardStepIndicatorText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
    marginTop: 2,
  },
  btnCloseWizard: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBackWizard: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Step 1 Cards
  typeCardsList: {
    gap: 12,
    marginTop: 10,
    marginBottom: 16,
  },
  typeCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  typeCardItemSelected: {
    backgroundColor: '#FFFBEA',
    borderColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeCardTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  typeCardSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },

  // Progress Bar
  wizardProgressTrack: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    marginBottom: 18,
    overflow: 'hidden',
  },
  wizardProgressFill: {
    height: '100%',
    backgroundColor: '#FFC700',
    borderRadius: 2,
  },

  // Photo Upload Row
  photoUploadRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  photoPreviewBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    position: 'relative',
  },
  photoImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  btnRemovePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAddPhotoBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  btnAddPhotoText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },

  // Form Inputs
  wizardFormGroup: {
    marginBottom: 14,
  },
  wizardInputLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    marginBottom: 6,
  },
  wizardInputText: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  dropdownPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  dropdownPickerValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    flex: 1,
  },

  // Toggle Row Card
  toggleRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  toggleRowTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  toggleRowSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#FFC700',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },

  // Primary Wizard Button
  btnWizardPrimary: {
    backgroundColor: '#FFC700',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnWizardPrimaryText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // Step 3 Accordion Setting Cards
  settingAccordionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  settingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  settingTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  settingSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },

  // Staff Chips Row
  staffChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  staffChipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  staffChipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  staffChipAvatarBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffChipAvatarBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  staffChipName: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  btnAddStaffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  btnAddStaffText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  pickerOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickerOptionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerOptionChipActive: {
    backgroundColor: '#FFC700',
    borderColor: '#EAB308',
  },
  pickerOptionText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  pickerOptionTextActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  staffInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  staffInputField: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    paddingVertical: 4,
  },
  btnStaffInlineAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFC700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnStaffInlineAddText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  btnStaffInlineCancel: {
    padding: 6,
  },
  typePill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  typePillActive: {
    backgroundColor: '#FFC700',
  },
  typePillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  typePillTextActive: {
    color: '#000000',
  },
  btnModalSave: {
    backgroundColor: '#FFC700',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnModalSaveText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // Calendar Modal Styles
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  calendarModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '90%',
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarModalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  btnCloseModal: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cal Tab Pills
  calTabPillsWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  calTabPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  calTabPillActive: {
    backgroundColor: '#121318',
  },
  calTabPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  calTabPillTextActive: {
    color: '#FFFFFF',
  },

  // Month Navigator Header
  monthNavHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  monthTitleText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  btnMonthArrow: {
    padding: 6,
  },

  // Weekdays Row
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    width: '14%',
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },

  // Month Grid
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  gridCell: {
    width: '14.28%',
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginVertical: 2,
  },
  gridCellPrev: {
    opacity: 0.25,
  },
  gridCellSelected: {
    backgroundColor: '#FFFBEA',
    borderWidth: 1.5,
    borderColor: '#FFC700',
  },
  gridDayNum: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  gridDayNumPrev: {
    color: '#94A3B8',
  },
  gridDayNumSelected: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  gridBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  gridDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  gridCountText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  gridCountTextSelected: {
    color: '#000000',
  },

  // Day Schedule Header Row
  dayScheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dayScheduleTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  dayScheduleSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },

  // Day Appointment Cards List
  dayApptList: {
    gap: 10,
  },
  calApptCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  calCustAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  calCustAvatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCustAvatarBadgeText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  calApptTime: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  calCustName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginVertical: 1,
  },
  calSrvStaff: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },

  // Status Badges
  badgeConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeConfirmedText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#2563EB',
  },
  badgeArrived: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeArrivedText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  badgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgePendingText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#D97706',
  },
  badgeNoShow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeNoShowText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#DC2626',
  },
  calCardActionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  btnCalActionComplete: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnCalActionCompleteText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  btnCalActionNoShow: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnCalActionNoShowText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#DC2626',
  },
  btnCalActionReopen: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnCalActionReopenText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },

  // Branding & Hero Customizer Styles
  mockupHeroCoverWrapper: {
    width: '100%',
    height: 90,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: -24,
  },
  mockupHeroCoverImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mockupCoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  mockupEmblemBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#121318',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  brandingCustomizerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  brandingSectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  brandingFieldLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    marginBottom: 8,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  paletteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  paletteChipSelected: {
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paletteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  paletteName: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  hexInputSwatch: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  hexTextInput: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    width: 80,
  },
  hexHelperText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginLeft: 'auto',
  },
  brandingFieldSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: -4,
    marginBottom: 10,
  },
  bannerUploadCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  bannerPreviewWrapper: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  bannerPreviewImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerActionsOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnChangeBannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  btnChangeBannerPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  btnRemoveBannerPill: {
    backgroundColor: 'rgba(239,68,68,0.85)',
    padding: 6,
    borderRadius: 20,
  },
  bannerPlaceholderBox: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 16,
  },
  bannerPlaceholderIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bannerPlaceholderTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  bannerPlaceholderSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  taglineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  taglineTextInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  btnSaveBranding: {
    backgroundColor: '#FFC700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnSaveBrandingText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // Service Action Sheet Modal
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    maxWidth: 520,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  actionSheetDragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  actionSheetSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 12,
    marginBottom: 4,
  },
  actionSheetIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetItemTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  actionSheetItemSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  actionSheetCancelBtn: {
    marginTop: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetCancelText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
});
