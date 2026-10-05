import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BranchItem {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
}

interface ServiceItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  price: number;
  duration_minutes: number;
  image_url?: string;
  item_type: 'service' | 'product';
}

interface StaffItem {
  id: string;
  name: string;
  role_title?: string;
  avatar?: string;
}

function getContrastColor(hexColor?: string | null) {
  if (!hexColor || !hexColor.startsWith('#') || hexColor.length < 7) return '#000000';
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#000000';
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#000000' : '#FFFFFF';
}

function isValidImageUri(uri?: string | null) {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file://')
  );
}

export default function CustomerBookingPwaScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  // Dynamic upcoming dates from today
  const upcomingDates = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate().toString();
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const year = d.getFullYear();
      const iso = d.toISOString().split('T')[0];
      const full = `${dayName}, ${dayNum} ${monthName} ${year}`;
      list.push({ day: dayName, num: dayNum, monthName, year, iso, full });
    }
    return list;
  }, []);

  const timeSlotsByPeriod = useMemo(() => {
    return {
      Morning: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'],
      Afternoon: ['12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM'],
      Evening: ['05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM']
    };
  }, []);

  // Wizard state (0 = Storefront Profile, 1 = Select Service, 2 = Pick Date & Time, 3 = Details, 4 = Confirmed Pass)
  const [currentStep, setCurrentStep] = useState(0);

  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);

  // Live preview override state (when embedded in Merchant Bookings Tab 3 iframe)
  const [liveBrandColor, setLiveBrandColor] = useState<string | null>(null);
  const [liveCoverUrl, setLiveCoverUrl] = useState<string | null>(null);
  const [liveTagline, setLiveTagline] = useState<string | null>(null);

  // Selection states
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedBranch, setSelectedBranch] = useState<BranchItem | null>(null);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffItem | null>(null);
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getFullYear()}`;
  });
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<'Morning' | 'Afternoon' | 'Evening'>('Morning');
  const [selectedTime, setSelectedTime] = useState<string>('11:00 AM');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [profileTab, setProfileTab] = useState<'Services' | 'Reviews' | 'About'>('Services');

  // Post-booking state
  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  const activeBrandColor = liveBrandColor || merchant?.pwa_brand_color || '#FFC700';
  const contrastColor = getContrastColor(activeBrandColor);
  const isBrandDark = contrastColor === '#FFFFFF';
  
  const themeStyles = useMemo(() => {
    // 1. Base Adaptive Neumorphic Background Color
    const baseBgColor = isBrandDark ? '#14161C' : '#F5F0E8';
    
    // 2. Text Color Palette
    const textPrimaryColor = isBrandDark ? '#F8FAFC' : '#0F172A';
    const textSecondaryColor = isBrandDark ? 'rgba(248, 250, 252, 0.65)' : '#64748B';
    const textMutedColor = isBrandDark ? 'rgba(248, 250, 252, 0.45)' : '#94A3B8';

    // 3. Borders & Inset Surfaces
    const borderColor = isBrandDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const pillBgColor = isBrandDark ? '#1C1E26' : '#EAE3D7';

    // 4. Shadow System for Neumorphism
    const shadowDark = isBrandDark ? '#08090C' : 'rgba(180, 168, 150, 0.45)';
    const shadowLight = isBrandDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF';

    // Neumorphic Convex Card Style (Soft 3D elevation matching base background)
    const neumorphicCard = {
      backgroundColor: baseBgColor,
      borderColor: isBrandDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.8)',
      borderWidth: 1,
      shadowColor: shadowDark,
      shadowOffset: { width: 4, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 4,
      ...(Platform.OS === 'web' ? {
        boxShadow: isBrandDark
          ? '6px 6px 16px #08090c, -6px -6px 16px #20232b'
          : '6px 6px 16px rgba(185, 172, 154, 0.4), -6px -6px 16px #ffffff',
      } : {}),
    };

    // Neumorphic Recessed / Inset Surface (Pills, inputs, chips)
    const neumorphicInset = {
      backgroundColor: pillBgColor,
      borderColor: isBrandDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      borderWidth: 1,
      ...(Platform.OS === 'web' ? {
        boxShadow: isBrandDark
          ? 'inset 3px 3px 6px #08090c, inset -3px -3px 6px #20232b'
          : 'inset 3px 3px 6px rgba(185, 172, 154, 0.35), inset -3px -3px 6px #ffffff',
      } : {}),
    };

    // Neumorphic Active Accent Button Style
    const neumorphicActiveBtn = {
      backgroundColor: activeBrandColor,
      borderColor: activeBrandColor,
      borderWidth: 1,
      shadowColor: activeBrandColor,
      shadowOffset: { width: 3, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
      ...(Platform.OS === 'web' ? {
        boxShadow: `4px 4px 14px ${activeBrandColor}66`,
      } : {}),
    };

    return {
      baseBgColor,
      textPrimaryColor,
      textSecondaryColor,
      textMutedColor,
      borderColor,
      pillBgColor,
      shadowDark,
      shadowLight,
      isBrandDark,
      contrastColor,
      activeBrandColor,

      // Pre-baked Neumorphic Objects & Helpers
      neumorphicCard,
      neumorphicInset,
      neumorphicActiveBtn,
      bg: { backgroundColor: baseBgColor },
      textPrimary: { color: textPrimaryColor },
      textSecondary: { color: textSecondaryColor },
      border: { borderColor: borderColor },
      pillSurface: { backgroundColor: pillBgColor },
      iconCircle: { backgroundColor: pillBgColor },
    };
  }, [activeBrandColor, contrastColor, isBrandDark]);

  // 1. Live Preview real-time listener from parent customization panel
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check sessionStorage for initial sync
    try {
      const stored = sessionStorage.getItem(`risev_booking_preview_${slug}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.brandColor) setLiveBrandColor(parsed.brandColor);
        if (parsed.coverUrl !== undefined) setLiveCoverUrl(parsed.coverUrl);
        if (parsed.tagline !== undefined) setLiveTagline(parsed.tagline);
      }
    } catch (e) {}

    // Listen to real-time postMessage
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'RISEV_BOOKING_PREVIEW_UPDATE') {
        if (event.data.brandColor) setLiveBrandColor(event.data.brandColor);
        if (event.data.coverUrl !== undefined) setLiveCoverUrl(event.data.coverUrl);
        if (event.data.tagline !== undefined) setLiveTagline(event.data.tagline);
      }
    };

    window.addEventListener('message', handleMessage);

    // Notify parent that iframe is ready to receive state
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'RISEV_BOOKING_PREVIEW_READY' }, '*');
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [slug]);

  useEffect(() => {
    loadMerchantAndData();
    loadCachedCustomerInfo();
  }, [slug]);

  const loadCachedCustomerInfo = async () => {
    try {
      const savedName = await AsyncStorage.getItem('risev_cust_name');
      const savedPhone = await AsyncStorage.getItem('risev_cust_phone');
      if (savedName) setCustomerName(savedName);
      if (savedPhone) setCustomerPhone(savedPhone);
    } catch (e) {}
  };

  const loadMerchantAndData = async () => {
    setLoading(true);
    try {
      let mRecord: any = null;
      try {
        if (slug) {
          mRecord = await pb.collection('merchants').getFirstListItem(`pwa_slug = "${slug}"`, { requestKey: null });
        }
      } catch (slugErr) {
        try {
          // Fallback 1: Match by slug formatted name (e.g. "scoop-creamy" matches "Scoop creamy")
          const nameNormalized = (slug as string).replace(/-/g, ' ');
          mRecord = await pb.collection('merchants').getFirstListItem(`name ~ "${nameNormalized}"`, { requestKey: null });
        } catch (nameErr) {
          try {
            if (slug) {
              mRecord = await pb.collection('merchants').getOne(slug as string, { requestKey: null });
            }
          } catch (idErr) {}
        }
      }

      if (!mRecord) {
        setMerchant(null);
        setServices([]);
        setBranches([]);
        setStaffList([]);
        return;
      }

      const bannerUrl = mRecord.banner 
        ? `${pb.baseUrl}/api/files/merchants/${mRecord.id}/${mRecord.banner}`
        : null;

      const normalizedMerchant = {
        ...mRecord,
        store_name: mRecord.name || mRecord.store_name || 'Store',
        subtitle: mRecord.subtitle || mRecord.category || 'Quality Services & Bookings',
        rating: mRecord.rating || '5.0',
        reviews_count: mRecord.reviews_count || '120',
        cover_url: bannerUrl || (mRecord.cover_url && isValidImageUri(mRecord.cover_url) ? mRecord.cover_url : 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=1000&auto=format&fit=crop&q=80'),
        logo_url: mRecord.logo_url || (mRecord.logo ? pb.files.getURL(mRecord, mRecord.logo) : null),
        pwa_brand_color: mRecord.pwa_brand_color || '#FFC700',
      };
      setMerchant(normalizedMerchant);

      // Fetch branches
      try {
        const bRes = await pb.collection('branches').getList(1, 10, {
          filter: `merchant = "${mRecord.id}"`
        });
        if (bRes.items.length > 0) {
          setBranches(bRes.items as any);
          setSelectedBranch(bRes.items[0] as any);
        } else {
          const mainBranch = {
            id: 'main',
            name: `${normalizedMerchant.store_name} Main`,
            address: normalizedMerchant.address || 'In-store service'
          };
          setBranches([mainBranch]);
          setSelectedBranch(mainBranch);
        }
      } catch (bErr) {
        const mainBranch = {
          id: 'main',
          name: `${normalizedMerchant.store_name} Main`,
          address: normalizedMerchant.address || 'In-store service'
        };
        setBranches([mainBranch]);
        setSelectedBranch(mainBranch);
      }

      // Fetch services (live active services only)
      try {
        const sRes = await pb.collection('merchant_services').getList(1, 50, {
          filter: `merchant = "${mRecord.id}" && is_active = true`,
          sort: 'created'
        });
        const sItems = sRes.items.map((item: any) => ({
          ...item,
          image_url: item.image 
            ? `${pb.baseUrl}/api/files/merchant_services/${item.id}/${item.image}` 
            : (item.image_url || '')
        }));
        setServices(sItems as any);
        if (sItems.length > 0) {
          setSelectedServices([sItems[0] as any]);
        } else {
          setSelectedServices([]);
        }
      } catch (sErr) {
        console.warn('Error fetching services:', sErr);
        setServices([]);
        setSelectedServices([]);
      }

      // Fetch staff (live active staff only)
      try {
        const stRes = await pb.collection('merchant_staff').getList(1, 10, {
          filter: `merchant = "${mRecord.id}" && is_active = true`
        });
        if (stRes.items.length > 0) {
          setStaffList([
            { id: 'any', name: 'Any Available Provider', role_title: 'First Available Slot' },
            ...(stRes.items as any)
          ]);
        } else {
          setStaffList([
            { id: 'any', name: 'Any Available Provider', role_title: 'First Available Slot' }
          ]);
        }
        setSelectedStaff({ id: 'any', name: 'Any Available Provider', role_title: 'First Available Slot' });
      } catch (stErr) {
        setStaffList([
          { id: 'any', name: 'Any Available Provider', role_title: 'First Available Slot' }
        ]);
        setSelectedStaff({ id: 'any', name: 'Any Available Provider', role_title: 'First Available Slot' });
      }

    } catch (err) {
      console.warn('Load PWA err:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleServiceSelection = (srv: ServiceItem) => {
    setSelectedServices(prev => {
      const exists = prev.some(item => item.id === srv.id);
      if (exists) {
        if (prev.length === 1) return prev;
        return prev.filter(item => item.id !== srv.id);
      } else {
        return [...prev, srv];
      }
    });
  };

  const calculateTotal = () => {
    return selectedServices.reduce((sum, item) => sum + item.price, 0);
  };

  const calculateTotalDuration = () => {
    return selectedServices.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);
  };

  const handleNextStep = async () => {
    if (currentStep === 0) {
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (selectedServices.length === 0) {
        Alert.alert('Select Service', 'Please select at least one service to continue.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!customerName.trim() || !customerPhone.trim()) {
        Alert.alert('Required Details', 'Please enter your name and phone number to confirm your booking.');
        return;
      }

      setIsSubmitting(true);
      try {
        await AsyncStorage.setItem('risev_cust_name', customerName);
        await AsyncStorage.setItem('risev_cust_phone', customerPhone);

        const totalPrice = calculateTotal();
        const bookingPayload = {
          merchant: merchant?.id,
          branch: (selectedBranch?.id && selectedBranch.id !== 'main') ? selectedBranch.id : null,
          staff: (selectedStaff?.id && selectedStaff.id !== 'any') ? selectedStaff.id : null,
          customer_name: customerName,
          customer_phone: customerPhone,
          booking_date: selectedIsoDate || new Date().toISOString().split('T')[0],
          start_time: selectedTime,
          service_name: selectedServices.map(s => s.name).join(', '),
          staff_name: selectedStaff?.name || 'Any Provider',
          total_price: totalPrice,
          items_summary: selectedServices.map(s => ({ name: s.name, price: s.price })),
          notes: customerNotes,
          status: 'booked'
        };

        let newRec: any = null;
        if (merchant?.id && !merchant.id.startsWith('demo-')) {
          try {
            newRec = await pb.collection('service_bookings').create(bookingPayload);
          } catch (pbErr: any) {
            console.warn('Booking create err:', pbErr);
            throw pbErr;
          }
        }

        setCreatedBooking(newRec || {
          id: `BK-${Math.floor(100000 + Math.random() * 900000)}`,
          ...bookingPayload
        });

        showToast('Booking Confirmed! 🎉');
        setCurrentStep(4);
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to process booking. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleArrived = async () => {
    setHasArrived(true);
    showToast('Arrival notification sent to counter! 📍');
    if (createdBooking?.id && !createdBooking.id.startsWith('BK-')) {
      try {
        await pb.collection('service_bookings').update(createdBooking.id, {
          status: 'arrived'
        });
      } catch (e) {}
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFC700" />
      </View>
    );
  }

  if (!merchant && !loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={[styles.brandInfoCard, { width: '100%', alignItems: 'center', padding: 32 }]}>
          <Ionicons name="storefront-outline" size={48} color="#94A3B8" style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={[styles.brandNameText, { textAlign: 'center', fontSize: 18 }]}>Store Not Found</Text>
          <Text style={[styles.brandSubtitleText, { textAlign: 'center', marginTop: 6 }]}>
            The booking page for "{slug}" does not exist or may have been renamed.
          </Text>
          <TouchableOpacity
            style={[styles.btnFullYellowBook, { backgroundColor: liveBrandColor || merchant?.pwa_brand_color || '#FFC700', marginTop: 24, paddingHorizontal: 24 }]}
            onPress={() => router.push('/')}
          >
            <Text style={[styles.btnFullYellowBookText, { color: getContrastColor(liveBrandColor || merchant?.pwa_brand_color || '#FFC700') }]}>Go to Risev Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const activeCoverUrl = (liveCoverUrl !== null && liveCoverUrl !== undefined) 
    ? liveCoverUrl 
    : (merchant?.cover_url || 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=1000&auto=format&fit=crop&q=80');
  const activeTagline = (liveTagline !== null && liveTagline !== undefined)
    ? liveTagline
    : (merchant?.subtitle || 'Quality Services & Bookings');
  const finalCoverUrl = isValidImageUri(activeCoverUrl)
    ? activeCoverUrl
    : 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=1000&auto=format&fit=crop&q=80';

  const availableCategories: string[] = ['All', ...Array.from(new Set(services.map(s => s.category).filter((c): c is string => Boolean(c))))];

  const filteredServices = activeCategory === 'All'
    ? services
    : services.filter(s => s.category?.toLowerCase() === activeCategory.toLowerCase());


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeStyles.baseBgColor }]} edges={['top', 'left', 'right', 'bottom']}>
      
      {/* Toast Overlay */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Top Header Bar for Steps 1, 2, 3 */}
      {currentStep > 0 && currentStep < 4 && (
        <View style={[styles.headerBar, { backgroundColor: themeStyles.baseBgColor, borderBottomColor: themeStyles.borderColor }]}>
          <TouchableOpacity onPress={handlePrevStep} style={[styles.btnHeaderBack, themeStyles.neumorphicInset]} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={themeStyles.textPrimaryColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeStyles.textPrimaryColor }]}>
            {currentStep === 1 && 'Select Service'}
            {currentStep === 2 && 'Schedule Appointment'}
            {currentStep === 3 && 'Your Details'}
          </Text>
          <Text style={[styles.stepBadgeText, { color: themeStyles.textSecondaryColor }]}>Step {currentStep} of 3</Text>
        </View>
      )}

      {/* Main Body Scroll */}
      <ScrollView style={[styles.mainScroll, { backgroundColor: themeStyles.baseBgColor }]} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* ======================================================== */}
        {/* SCREEN 0: STOREFRONT BUSINESS PROFILE LANDING            */}
        {/* ======================================================== */}
        {currentStep === 0 && (
          <View style={styles.profileContainer}>
            
            {/* Hero Cover Header */}
            <View style={styles.coverWrapper}>
              <Image
                source={{
                  uri: finalCoverUrl
                }}
                style={styles.coverImage}
                resizeMode="cover"
              />
              <View style={styles.coverDarkOverlay} />

              <View style={styles.coverTopRow}>
                <TouchableOpacity style={styles.circleIconButton} activeOpacity={0.8}>
                  <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={styles.circleIconButton} activeOpacity={0.8}>
                    <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.circleIconButton} activeOpacity={0.8}>
                    <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Brand Card Info (Flat background transition over cover, no top shadow) */}
            <View style={[styles.brandInfoCard, { backgroundColor: themeStyles.baseBgColor }, { shadowColor: 'transparent', shadowOpacity: 0, elevation: 0, boxShadow: 'none' }]}>
              
              {/* Store Title & Subtitle */}
              <Text style={[styles.brandNameText, { color: themeStyles.textPrimaryColor }]}>{merchant?.store_name || 'SCOOP CREAMY'}</Text>
              <Text style={[styles.brandSubtitleText, { color: themeStyles.textSecondaryColor }]}>{activeTagline}</Text>

              {/* Soft Rating Pill Capsule */}
              <View style={[styles.ratingCapsulePill, themeStyles.neumorphicInset]}>
                <Ionicons name="star" size={24} color="#FFC700" />
                <Text style={[styles.ratingCapsuleNum, { color: themeStyles.textPrimaryColor }]}>4.9</Text>
                <Text style={[styles.ratingCapsuleRev, { color: themeStyles.textSecondaryColor }]}>(450 reviews)</Text>
              </View>

              {/* Split Meta Location & Operating Hours */}
              <View style={styles.splitMetaRow}>
                {/* Left Location Column */}
                <View style={styles.splitMetaCol}>
                  <View style={[styles.iconCircleBg, themeStyles.neumorphicInset]}>
                    <Ionicons name="location-outline" size={20} color={themeStyles.textPrimaryColor} />
                  </View>
                  <Text style={[styles.locationBoldText, { color: themeStyles.textPrimaryColor }]}>Bangi Sentral</Text>
                </View>

                {/* Vertical Divider Line */}
                <View style={[styles.pipeDivider, { backgroundColor: themeStyles.borderColor }]} />

                {/* Right Hours Column */}
                <View style={styles.splitMetaCol}>
                  <View style={[styles.iconCircleBg, themeStyles.neumorphicInset]}>
                    <Ionicons name="time-outline" size={20} color={themeStyles.textPrimaryColor} />
                  </View>
                  <View style={{ flexDirection: 'column' }}>
                    <View style={styles.openBadgePill}>
                      <Text style={styles.openBadgeText}>Open</Text>
                    </View>
                    <Text style={[styles.hoursSubText, { color: themeStyles.textSecondaryColor }]}>11:00 AM – 11:00 PM</Text>
                  </View>
                </View>
              </View>

              {/* Horizontal Divider Line */}
              <View style={[styles.headerHorizontalDivider, { backgroundColor: themeStyles.borderColor }]} />

              {/* Quick Action Navigation Bar */}
              <View style={styles.quickNavStrip}>
                <TouchableOpacity style={styles.quickNavItem} onPress={() => setCurrentStep(1)} activeOpacity={0.8}>
                  <View style={[styles.quickNavCircle, themeStyles.neumorphicActiveBtn]}>
                    <Ionicons name="calendar" size={22} color={themeStyles.contrastColor} />
                  </View>
                  <Text style={[styles.quickNavTitleActive, { color: themeStyles.textPrimaryColor }]}>Book{'\n'}Appointment</Text>
                  <View style={[styles.activeTabIndicatorLine, { backgroundColor: activeBrandColor }]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickNavItem} onPress={() => setCurrentStep(1)} activeOpacity={0.8}>
                  <View style={[styles.quickNavCircle, themeStyles.neumorphicInset]}>
                    <Ionicons name="list-outline" size={22} color={themeStyles.textPrimaryColor} />
                  </View>
                  <Text style={[styles.quickNavTitle, { color: themeStyles.textSecondaryColor }]}>Menu</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickNavItem} onPress={() => showToast('Promotions: Buy 2 Scoops Get 1 Waffle 20% Off! 🍦')} activeOpacity={0.8}>
                  <View style={[styles.quickNavCircle, themeStyles.neumorphicInset]}>
                    <Ionicons name="pricetag-outline" size={22} color={themeStyles.textPrimaryColor} />
                  </View>
                  <Text style={[styles.quickNavTitle, { color: themeStyles.textSecondaryColor }]}>Promotions</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickNavItem} onPress={() => showToast('📍 Main Outlet: Bangi Sentral Seksyen 9')} activeOpacity={0.8}>
                  <View style={[styles.quickNavCircle, themeStyles.neumorphicInset]}>
                    <Ionicons name="location-outline" size={22} color={themeStyles.textPrimaryColor} />
                  </View>
                  <Text style={[styles.quickNavTitle, { color: themeStyles.textSecondaryColor }]}>Location</Text>
                </TouchableOpacity>
              </View>

            </View>

            {/* Popular Items Horizontal Grid / Carousel */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeadingTitle, { color: themeStyles.textPrimaryColor }]}>Popular Items</Text>
              <TouchableOpacity onPress={() => setCurrentStep(1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.seeAllText, { color: themeStyles.textSecondaryColor }]}>See all</Text>
                <Ionicons name="arrow-forward" size={14} color={themeStyles.textSecondaryColor} />
              </TouchableOpacity>
            </View>

            {services.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularCarouselScroll}>
                {services.slice(0, 5).map(srv => {
                  const isSelected = selectedServices.some(s => s.id === srv.id);
                  return (
                    <View key={srv.id} style={[styles.popularCardItem, themeStyles.neumorphicCard]}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedServices([srv]);
                          setCurrentStep(1);
                        }}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: srv.image_url || 'https://images.unsplash.com/photo-1557142046-c704a3adf364?w=400&auto=format&fit=crop&q=80' }}
                          style={styles.popularCardPhoto}
                        />
                      </TouchableOpacity>

                      <View style={styles.popularCardBody}>
                        <Text style={[styles.popularCardName, { color: themeStyles.textPrimaryColor }]} numberOfLines={1}>{srv.name}</Text>

                        <View style={styles.popularCardBottomRow}>
                          <Text style={[styles.popularCardPrice, { color: activeBrandColor }]}>RM{srv.price}</Text>

                          <TouchableOpacity
                            style={[
                              styles.popularAddCircleBtn, 
                              isSelected ? themeStyles.neumorphicActiveBtn : themeStyles.neumorphicInset
                            ]}
                            onPress={() => toggleServiceSelection(srv)}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name={isSelected ? "checkmark" : "add"}
                              size={20}
                              color={isSelected ? themeStyles.contrastColor : themeStyles.textPrimaryColor}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={[styles.seeAllText, { color: themeStyles.textSecondaryColor }]}>No items published yet.</Text>
              </View>
            )}

          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 1: CHOOSE SERVICE (STEP 1 OF 3)                    */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <View style={styles.stepContainer}>
            
            {/* Horizontal Category Strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {availableCategories.map(cat => {
                const isActive = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChipPill,
                      isActive ? themeStyles.neumorphicActiveBtn : themeStyles.neumorphicInset
                    ]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, { color: isActive ? themeStyles.contrastColor : themeStyles.textSecondaryColor }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Service Cards List */}
            {services.length === 0 ? (
              <View style={[styles.whiteServiceCard, themeStyles.neumorphicCard, { flexDirection: 'column', alignItems: 'center', padding: 32 }]}>
                <Ionicons name="sparkles-outline" size={32} color={themeStyles.textMutedColor} />
                <Text style={[styles.whiteServiceTitle, { color: themeStyles.textPrimaryColor, marginTop: 10, textAlign: 'center' }]}>No Services Available</Text>
                <Text style={[styles.whiteServiceSub, { color: themeStyles.textSecondaryColor, textAlign: 'center', marginTop: 4 }]}>
                  This store has not published any services for online booking yet.
                </Text>
              </View>
            ) : filteredServices.length === 0 ? (
              <View style={[styles.whiteServiceCard, themeStyles.neumorphicCard, { flexDirection: 'column', alignItems: 'center', padding: 32 }]}>
                <Text style={[styles.whiteServiceTitle, { color: themeStyles.textPrimaryColor }]}>No items in this category</Text>
              </View>
            ) : (
              <View style={styles.serviceCardsContainer}>
                {filteredServices.map(srv => {
                const isSelected = selectedServices.some(item => item.id === srv.id);
                return (
                  <TouchableOpacity
                    key={srv.id}
                    style={[
                      styles.whiteServiceCard,
                      themeStyles.neumorphicCard,
                      isSelected && { borderColor: activeBrandColor, borderWidth: 2 }
                    ]}
                    onPress={() => toggleServiceSelection(srv)}
                    activeOpacity={0.85}
                  >
                    {srv.image_url ? (
                      <Image
                        source={{ uri: srv.image_url }}
                        style={styles.servicePhotoThumb}
                      />
                    ) : (
                      <View style={[styles.servicePhotoThumb, themeStyles.neumorphicInset, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons 
                          name={srv.item_type === 'product' ? 'cube-outline' : 'sparkles-outline'} 
                          size={24} 
                          color={themeStyles.textMutedColor} 
                        />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.whiteServiceTitle, { color: themeStyles.textPrimaryColor }]}>{srv.name}</Text>
                      {srv.description && (
                        <Text style={[styles.whiteServiceSub, { color: themeStyles.textSecondaryColor }]} numberOfLines={1}>
                          {srv.description}
                        </Text>
                      )}
                      <View style={styles.whiteServiceMetaRow}>
                        <Ionicons name="time-outline" size={13} color={themeStyles.textSecondaryColor} />
                        <Text style={[styles.whiteServiceDuration, { color: themeStyles.textSecondaryColor }]}>{srv.duration_minutes} min</Text>
                        <Text style={[styles.whiteServicePrice, { color: activeBrandColor }]}>RM{srv.price}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.circleAddBtn, 
                        isSelected ? themeStyles.neumorphicActiveBtn : themeStyles.neumorphicInset
                      ]}
                      onPress={() => toggleServiceSelection(srv)}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark' : 'add'}
                        size={20}
                        color={isSelected ? themeStyles.contrastColor : themeStyles.textPrimaryColor}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 2: PICK DATE & TIME (STEP 2 OF 3)                 */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            
            {/* Branch Selector Dropdown Box */}
            <TouchableOpacity
              style={[styles.dropdownCardBox, themeStyles.neumorphicCard]}
              onPress={() => setShowBranchPicker(!showBranchPicker)}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={18} color={themeStyles.textPrimaryColor} />
              <Text style={[styles.dropdownTextValue, { color: themeStyles.textPrimaryColor }]}>{selectedBranch?.name || 'Main Branch'}</Text>
              <Ionicons name={showBranchPicker ? "chevron-up" : "chevron-down"} size={18} color={themeStyles.textSecondaryColor} />
            </TouchableOpacity>

            {showBranchPicker && branches.length > 0 && (
              <View style={[styles.pickerOptionsContainer, themeStyles.neumorphicCard]}>
                {branches.map(br => (
                  <TouchableOpacity
                    key={br.id}
                    style={[
                      styles.pickerOptionItem,
                      { backgroundColor: selectedBranch?.id === br.id ? (isBrandDark ? '#262933' : '#FEF08A') : themeStyles.pillBgColor }
                    ]}
                    onPress={() => {
                      setSelectedBranch(br);
                      setShowBranchPicker(false);
                    }}
                  >
                    <Ionicons name="business-outline" size={16} color={selectedBranch?.id === br.id ? (isBrandDark ? "#FFFFFF" : "#000000") : themeStyles.textSecondaryColor} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerOptionItemTitle, { color: themeStyles.textPrimaryColor }]}>
                        {br.name}
                      </Text>
                      {br.address ? <Text style={[styles.pickerOptionItemSub, { color: themeStyles.textSecondaryColor }]}>{br.address}</Text> : null}
                    </View>
                    {selectedBranch?.id === br.id && <Ionicons name="checkmark-circle" size={16} color={isBrandDark ? "#FFFFFF" : "#000000"} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Provider Selector Dropdown Box */}
            <TouchableOpacity
              style={[styles.dropdownCardBox, themeStyles.neumorphicCard]}
              onPress={() => setShowStaffPicker(!showStaffPicker)}
              activeOpacity={0.7}
            >
              <Ionicons name="person-outline" size={18} color={themeStyles.textPrimaryColor} />
              <Text style={[styles.dropdownTextValue, { color: themeStyles.textPrimaryColor }]}>{selectedStaff?.name || 'Any Provider'}</Text>
              <Ionicons name={showStaffPicker ? "chevron-up" : "chevron-down"} size={18} color={themeStyles.textSecondaryColor} />
            </TouchableOpacity>

            {showStaffPicker && staffList.length > 0 && (
              <View style={[styles.pickerOptionsContainer, themeStyles.neumorphicCard]}>
                {staffList.map(st => (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.pickerOptionItem,
                      { backgroundColor: selectedStaff?.id === st.id ? (isBrandDark ? '#262933' : '#FEF08A') : themeStyles.pillBgColor }
                    ]}
                    onPress={() => {
                      setSelectedStaff(st);
                      setShowStaffPicker(false);
                    }}
                  >
                    <Ionicons name="person-circle-outline" size={18} color={selectedStaff?.id === st.id ? (isBrandDark ? "#FFFFFF" : "#000000") : themeStyles.textSecondaryColor} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerOptionItemTitle, { color: themeStyles.textPrimaryColor }]}>
                        {st.name}
                      </Text>
                      {st.role_title ? <Text style={[styles.pickerOptionItemSub, { color: themeStyles.textSecondaryColor }]}>{st.role_title}</Text> : null}
                    </View>
                    {selectedStaff?.id === st.id && <Ionicons name="checkmark-circle" size={16} color={isBrandDark ? "#FFFFFF" : "#000000"} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Date Picker Header */}
            <View style={styles.datePickerHeaderRow}>
              <Text style={[styles.dateGroupTitle, { color: themeStyles.textPrimaryColor }]}>Select Date</Text>
              <Text style={[styles.monthYearTitle, { color: themeStyles.textSecondaryColor }]}>
                {upcomingDates.find(d => d.iso === selectedIsoDate)?.monthName || 'Upcoming'}{' '}
                {upcomingDates.find(d => d.iso === selectedIsoDate)?.year || new Date().getFullYear()}
              </Text>
            </View>

            {/* Horizontal Day Selector Strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {upcomingDates.map(dt => {
                const isSelected = selectedIsoDate === dt.iso;
                return (
                  <TouchableOpacity
                    key={dt.iso}
                    style={[
                      styles.dayColumnCard,
                      isSelected ? themeStyles.neumorphicActiveBtn : themeStyles.neumorphicInset
                    ]}
                    onPress={() => {
                      setSelectedIsoDate(dt.iso);
                      setSelectedDate(dt.full);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.dayNameText, { color: isSelected ? themeStyles.contrastColor : themeStyles.textSecondaryColor }]}>{dt.day}</Text>
                    <Text style={[styles.dayNumText, { color: isSelected ? themeStyles.contrastColor : themeStyles.textPrimaryColor }]}>{dt.num}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time Period Filter Segment */}
            <Text style={[styles.dateGroupTitle, { color: themeStyles.textPrimaryColor }]}>Select Time</Text>
            <View style={[styles.periodSegmentTrack, themeStyles.neumorphicInset]}>
              {(['Morning', 'Afternoon', 'Evening'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.periodSegmentPill,
                    selectedTimePeriod === p ? themeStyles.neumorphicActiveBtn : null
                  ]}
                  onPress={() => {
                    setSelectedTimePeriod(p);
                    const slots = timeSlotsByPeriod[p] || [];
                    if (!slots.includes(selectedTime) && slots.length > 0) {
                      setSelectedTime(slots[0]);
                    }
                  }}
                >
                  <Text style={[styles.periodSegmentText, { color: selectedTimePeriod === p ? themeStyles.contrastColor : themeStyles.textSecondaryColor }]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 3-Column Time Slot Grid */}
            <View style={styles.timeSlotsGrid}>
              {(timeSlotsByPeriod[selectedTimePeriod] || []).map(tm => {
                const isSelected = selectedTime === tm;
                return (
                  <TouchableOpacity
                    key={tm}
                    style={[
                      styles.timeSlotGridPill,
                      isSelected ? themeStyles.neumorphicActiveBtn : themeStyles.neumorphicInset
                    ]}
                    onPress={() => setSelectedTime(tm)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.timeSlotGridText, { color: isSelected ? themeStyles.contrastColor : themeStyles.textPrimaryColor }]}>
                      {tm}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 3: CUSTOMER DETAILS (STEP 3 OF 3)                 */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <View style={styles.stepContainer}>
            
            <View style={styles.inputFieldGroup}>
              <Text style={[styles.inputFieldLabel, { color: themeStyles.textPrimaryColor }]}>Full Name</Text>
              <View style={[styles.inputWithIconBox, themeStyles.neumorphicInset]}>
                <Ionicons name="person-outline" size={18} color={themeStyles.textSecondaryColor} />
                <TextInput
                  style={[styles.inputTextInner, { color: themeStyles.textPrimaryColor }]}
                  placeholder="Hafiz Danial"
                  placeholderTextColor={themeStyles.textMutedColor}
                  value={customerName}
                  onChangeText={setCustomerName}
                />
              </View>
            </View>

            <View style={styles.inputFieldGroup}>
              <Text style={[styles.inputFieldLabel, { color: themeStyles.textPrimaryColor }]}>WhatsApp Number</Text>
              <View style={[styles.inputWithIconBox, themeStyles.neumorphicInset]}>
                <Ionicons name="logo-whatsapp" size={18} color={themeStyles.textSecondaryColor} />
                <TextInput
                  style={[styles.inputTextInner, { color: themeStyles.textPrimaryColor }]}
                  placeholder="0123456789"
                  placeholderTextColor={themeStyles.textMutedColor}
                  keyboardType="phone-pad"
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                />
              </View>
            </View>

            <View style={styles.inputFieldGroup}>
              <Text style={[styles.inputFieldLabel, { color: themeStyles.textPrimaryColor }]}>Add Note (Optional)</Text>
              <View style={[styles.inputWithIconBox, themeStyles.neumorphicInset]}>
                <Ionicons name="chatbox-outline" size={18} color={themeStyles.textSecondaryColor} />
                <TextInput
                  style={[styles.inputTextInner, { color: themeStyles.textPrimaryColor }]}
                  placeholder="Any special request?"
                  placeholderTextColor={themeStyles.textMutedColor}
                  value={customerNotes}
                  onChangeText={setCustomerNotes}
                />
              </View>
            </View>

            {/* Selection Summary Box */}
            <View style={[styles.summaryRecapCard, themeStyles.neumorphicCard]}>
              <Text style={[styles.summaryRecapTitle, { color: themeStyles.textPrimaryColor }]}>Booking Details</Text>
              <View style={styles.recapItemRow}>
                <Text style={[styles.recapItemLabel, { color: themeStyles.textSecondaryColor }]}>Services:</Text>
                <Text style={[styles.recapItemVal, { color: themeStyles.textPrimaryColor }]}>{selectedServices.map(s => s.name).join(', ')}</Text>
              </View>
              <View style={styles.recapItemRow}>
                <Text style={[styles.recapItemLabel, { color: themeStyles.textSecondaryColor }]}>Branch:</Text>
                <Text style={[styles.recapItemVal, { color: themeStyles.textPrimaryColor }]}>{selectedBranch?.name || 'Bangi Sentral'}</Text>
              </View>
              <View style={styles.recapItemRow}>
                <Text style={[styles.recapItemLabel, { color: themeStyles.textSecondaryColor }]}>Provider:</Text>
                <Text style={[styles.recapItemVal, { color: themeStyles.textPrimaryColor }]}>{selectedStaff?.name || 'Any Provider'}</Text>
              </View>
              <View style={styles.recapItemRow}>
                <Text style={[styles.recapItemLabel, { color: themeStyles.textSecondaryColor }]}>Date & Time:</Text>
                <Text style={[styles.recapItemVal, { color: themeStyles.textPrimaryColor }]}>{selectedDate} @ {selectedTime}</Text>
              </View>
            </View>

          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 4: DIGITAL PASS & CONFIRMATION                     */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <View style={styles.stepContainer}>
            <View style={[styles.ticketCardBoarding, themeStyles.neumorphicCard]}>
              <View style={styles.ticketGreenBadge}>
                <View style={styles.pulseDotGreen} />
                <Text style={styles.ticketBadgeGreenText}>BOOKING CONFIRMED</Text>
              </View>

              <Text style={[styles.boardingPassTitle, { color: themeStyles.textPrimaryColor }]}>Appointment Pass</Text>

              <View style={[styles.timerCountdownCard, themeStyles.neumorphicInset]}>
                <Text style={[styles.timerSubText, { color: themeStyles.textSecondaryColor }]}>Your appointment starts in:</Text>
                <Text style={[styles.timerMainText, { color: activeBrandColor }]}>24 Mins 30 Secs</Text>
              </View>

              <View style={[styles.boardingInfoGrid, { borderColor: themeStyles.borderColor }]}>
                <View style={styles.boardingGridCell}>
                  <Text style={[styles.cellLabelText, { color: themeStyles.textSecondaryColor }]}>Service</Text>
                  <Text style={[styles.cellValueText, { color: themeStyles.textPrimaryColor }]}>{selectedServices[0]?.name || 'Signature Massage'}</Text>
                </View>
                <View style={styles.boardingGridCell}>
                  <Text style={[styles.cellLabelText, { color: themeStyles.textSecondaryColor }]}>Provider</Text>
                  <Text style={[styles.cellValueText, { color: themeStyles.textPrimaryColor }]}>{selectedStaff?.name || 'Any Provider'}</Text>
                </View>
                <View style={styles.boardingGridCell}>
                  <Text style={[styles.cellLabelText, { color: themeStyles.textSecondaryColor }]}>Slot Time</Text>
                  <Text style={[styles.cellValueText, { color: themeStyles.textPrimaryColor }]}>{selectedDate} @ {selectedTime}</Text>
                </View>
                <View style={styles.boardingGridCell}>
                  <Text style={[styles.cellLabelText, { color: themeStyles.textSecondaryColor }]}>Branch</Text>
                  <Text style={[styles.cellValueText, { color: themeStyles.textPrimaryColor }]}>{selectedBranch?.name || 'Bangi Sentral'}</Text>
                </View>
              </View>

              <Text style={[styles.arrivedInstructionText, { color: themeStyles.textSecondaryColor }]}>
                Tap the button below as soon as you step inside the store:
              </Text>

              <TouchableOpacity
                style={[styles.btnArrivedAction, hasArrived ? { backgroundColor: '#22C55E' } : themeStyles.neumorphicActiveBtn]}
                onPress={handleArrived}
                activeOpacity={0.85}
              >
                <Ionicons name="location" size={18} color={hasArrived ? '#FFFFFF' : themeStyles.contrastColor} />
                <Text style={[styles.btnArrivedTextLabel, { color: hasArrived ? '#FFFFFF' : themeStyles.contrastColor }]}>
                  {hasArrived ? '✓ ARRIVAL CONFIRMED' : '📍 I HAVE ARRIVED'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* PWA Save App Card */}
            <View style={[styles.pwaCardBox, themeStyles.neumorphicCard]}>
              <View style={[styles.pwaIconBox, themeStyles.neumorphicInset]}>
                <Ionicons name="phone-portrait-outline" size={22} color={activeBrandColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pwaTitleText, { color: themeStyles.textPrimaryColor }]}>Save {merchant?.store_name || 'Aura Wellness'} App</Text>
                <Text style={[styles.pwaSubText, { color: themeStyles.textSecondaryColor }]}>Get instant slot reminders & fast re-booking</Text>
              </View>
              <TouchableOpacity
                style={[styles.btnInstallPwa, themeStyles.neumorphicActiveBtn, { paddingHorizontal: 14, paddingVertical: 7 }]}
                onPress={() => showToast('Tap Share ➔ Add to Home Screen')}
                activeOpacity={0.8}
              >
                <Text style={[styles.btnInstallPwaText, { color: themeStyles.contrastColor }]}>Install</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Screen 0 Floating Yellow Button */}
      {currentStep === 0 && (
        <View style={[styles.floatingBottomProfileContainer, { backgroundColor: themeStyles.baseBgColor, borderTopColor: themeStyles.borderColor }]}>
          <TouchableOpacity
            style={[styles.btnFullYellowBook, themeStyles.neumorphicActiveBtn]}
            onPress={() => setCurrentStep(1)}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnFullYellowBookText, { color: themeStyles.contrastColor }]}>Book Appointment</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sticky Dark Action Bar (Steps 1, 2, 3) */}
      {currentStep > 0 && currentStep < 4 && (
        <View style={[styles.stickyDarkBar, { backgroundColor: themeStyles.baseBgColor, borderTopColor: themeStyles.borderColor }]}>
          <View>
            {currentStep === 1 && (
              <>
                <Text style={[styles.darkBarMetaLabel, { color: themeStyles.textSecondaryColor }]}>{selectedServices.length} service{selectedServices.length > 1 ? 's' : ''}</Text>
                <Text style={[styles.darkBarPriceTotal, { color: activeBrandColor }]}>RM {calculateTotal().toFixed(2)}</Text>
              </>
            )}

            {currentStep === 2 && (
              <>
                <Text style={[styles.darkBarMetaLabel, { color: themeStyles.textSecondaryColor }]}>{selectedDate}</Text>
                <Text style={[styles.darkBarPriceTotal, { color: activeBrandColor }]}>{selectedTime}</Text>
              </>
            )}

            {currentStep === 3 && (
              <>
                <Text style={[styles.darkBarPriceTotal, { color: activeBrandColor }]}>RM {calculateTotal().toFixed(2)}</Text>
                <Text style={[styles.darkBarMetaLabel, { color: themeStyles.textSecondaryColor }]}>{selectedServices.length} service • {calculateTotalDuration()} min</Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.btnYellowContinue, themeStyles.neumorphicActiveBtn]}
            onPress={handleNextStep}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={themeStyles.contrastColor} />
            ) : (
              <Text style={[styles.btnYellowContinueText, { color: themeStyles.contrastColor }]}>
                {currentStep === 3 ? 'Confirm & Book 🚀' : 'Continue ➔'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
  },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    zIndex: 999,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F5F0E8',
    borderBottomWidth: 1,
    borderBottomColor: '#E6DFC3',
  },
  btnHeaderBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F0E8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D3CBBD',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#FAF6F0',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  stepBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  mainScroll: {
    flex: 1,
    backgroundColor: '#F5F0E8',
  },
  stepContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Profile Screen 0 Styles
  profileContainer: {
    flex: 1,
  },
  coverWrapper: {
    width: '100%',
    height: 320,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: 320,
  },
  coverDarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 12, 8, 0.2)',
  },
  coverTopRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  circleIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverCenterContent: {
    position: 'absolute',
    top: 55,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  goldEmblemBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 199, 0, 0.12)',
    borderWidth: 1.5,
    borderColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  coverBrandTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  coverBrandSubtitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F8FAFC',
    letterSpacing: 2,
    marginTop: 4,
    textAlign: 'center',
  },
  coverCursiveTagline: {
    position: 'absolute',
    bottom: 38,
    right: 20,
    fontSize: 18,
    fontStyle: 'italic',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
    zIndex: 10,
  },
  brandInfoCard: {
    backgroundColor: '#F5F0E8',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    marginTop: -28,
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 20,
    position: 'relative',
    alignItems: 'center',
  },
  brandNameText: {
    fontSize: 30,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0B132B',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  brandSubtitleText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },

  // Soft Golden Rating Pill Capsule (Neumorphic Pod)
  ratingCapsulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5F0E8',
    borderWidth: 1.5,
    borderColor: '#FAF6F0',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 30,
    marginBottom: 20,
    shadowColor: '#C8BEAE',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  ratingCapsuleNum: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  ratingCapsuleRev: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },

  // Split Meta Location & Operating Hours Row
  splitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
  },
  splitMetaCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircleBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F0E8',
    borderWidth: 1.5,
    borderColor: '#FAF6F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C8BEAE',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  locationBoldText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  pipeDivider: {
    width: 1.5,
    height: 28,
    backgroundColor: '#D6CEBF',
  },
  openBadgePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  openBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  hoursSubText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },

  // Horizontal Divider
  headerHorizontalDivider: {
    width: '100%',
    height: 1.5,
    backgroundColor: '#E6DFC3',
    marginVertical: 18,
  },

  // Quick Nav Strip (3D Embossed Soft Circle Buttons)
  quickNavStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  quickNavItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  quickNavCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F0E8',
    borderWidth: 1.5,
    borderColor: '#FAF6F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#C8BEAE',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5,
  },
  quickNavCircleActive: {
    backgroundColor: '#FFC700',
    borderWidth: 0,
    shadowColor: '#D97706',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 7,
  },
  quickNavTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 14,
  },
  quickNavTitleActive: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 14,
  },
  activeTabIndicatorLine: {
    width: 28,
    height: 3.5,
    backgroundColor: '#FFC700',
    borderRadius: 2,
    marginTop: 6,
  },

  // Popular Services & Card Carousel
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 14,
  },
  sectionHeadingTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  seeAllText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  popularCarouselScroll: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 16,
  },
  popularCardItem: {
    width: 155,
    backgroundColor: '#F5F0E8',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FAF6F0',
    overflow: 'hidden',
    shadowColor: '#C8BEAE',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  popularCardPhoto: {
    width: '100%',
    height: 130,
    resizeMode: 'cover',
  },
  popularCardBody: {
    padding: 12,
  },
  popularCardName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 8,
  },
  popularCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popularCardPrice: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  popularAddCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F0E8',
    borderWidth: 1,
    borderColor: '#FAF6F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C8BEAE',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  popularAddCircleBtnSelected: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
    shadowColor: '#D97706',
  },

  // Category Strip (Step 1)
  categoryScroll: {
    marginBottom: 16,
  },
  categoryChipPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#F5F0E8',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#FAF6F0',
    shadowColor: '#C8BEAE',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryChipPillActive: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
    shadowColor: '#D97706',
    shadowOffset: { width: 3, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  categoryChipTextActive: {
    color: '#000000',
  },

  // Service Cards (Step 1)
  serviceCardsContainer: {
    gap: 12,
  },
  whiteServiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F0E8',
    borderRadius: 22,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#FAF6F0',
    shadowColor: '#C8BEAE',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  whiteServiceCardSelected: {
    borderColor: '#FFC700',
    backgroundColor: '#FFFBEA',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.35,
  },
  servicePhotoThumb: {
    width: 60,
    height: 60,
    borderRadius: 14,
  },
  whiteServiceTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  whiteServiceSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginVertical: 2,
  },
  whiteServiceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  whiteServiceDuration: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginRight: 8,
  },
  whiteServicePrice: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  circleAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleAddBtnSelected: {
    backgroundColor: '#0F172A',
  },

  // Step 2 Pickers
  dropdownCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 12,
  },
  dropdownTextValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    flex: 1,
  },
  pickerOptionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    marginBottom: 14,
    marginTop: -4,
    gap: 6,
  },
  pickerOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  pickerOptionItemActive: {
    backgroundColor: '#FEF08A',
  },
  pickerOptionItemTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  pickerOptionItemTitleActive: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  pickerOptionItemSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  datePickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  dateGroupTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  monthYearTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  dayColumnCard: {
    width: 50,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginRight: 8,
    gap: 4,
  },
  dayColumnCardActive: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
  },
  dayNameText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  dayNameTextActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  dayNumText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  dayNumTextActive: {
    color: '#000000',
  },

  // Period Segment & Time Grid
  periodSegmentTrack: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 3,
    marginTop: 10,
    marginBottom: 16,
  },
  periodSegmentPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12,
  },
  periodSegmentPillActive: {
    backgroundColor: '#FFC700',
  },
  periodSegmentText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  periodSegmentTextActive: {
    color: '#000000',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotGridPill: {
    width: (Dimensions.get('window').width - 48) / 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  timeSlotGridPillActive: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
  },
  timeSlotGridText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  timeSlotGridTextActive: {
    color: '#000000',
  },

  // Form Inputs (Step 3)
  inputFieldGroup: {
    marginBottom: 14,
  },
  inputFieldLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  inputWithIconBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  inputTextInner: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  summaryRecapCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    marginTop: 10,
    gap: 8,
  },
  summaryRecapTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 2,
  },
  recapItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recapItemLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  recapItemVal: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },

  // Pass (Step 4)
  ticketCardBoarding: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 22,
    padding: 20,
  },
  ticketGreenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  pulseDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  ticketBadgeGreenText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  boardingPassTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 14,
  },
  timerCountdownCard: {
    backgroundColor: '#FFFBEA',
    borderWidth: 1,
    borderColor: '#FFC700',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  timerSubText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  timerMainText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginTop: 2,
  },
  boardingInfoGrid: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    marginBottom: 16,
  },
  boardingGridCell: {
    width: '50%',
  },
  cellLabelText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginBottom: 2,
  },
  cellValueText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  arrivedInstructionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  btnArrivedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFC700',
    paddingVertical: 15,
    borderRadius: 16,
  },
  btnArrivedTextLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  pwaCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  pwaIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFBEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pwaTitleText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  pwaSubText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  btnInstallPwa: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  btnInstallPwaText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },

  // Floating Bottom Yellow CTA (Screen 0)
  floatingBottomProfileContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  btnFullYellowBook: {
    backgroundColor: '#FFC700',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnFullYellowBookText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // Sticky Dark Action Bar (Steps 1, 2, 3)
  stickyDarkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#121318',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  darkBarMetaLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  darkBarPriceTotal: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
  },
  btnYellowContinue: {
    backgroundColor: '#FFC700',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnYellowContinueText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
});
