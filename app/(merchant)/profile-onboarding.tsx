import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import { ALL_CATEGORIES_LIST, CategoryItemType } from '../(customer)/_components/AllCategoriesModal';
import * as ImagePicker from 'expo-image-picker';

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

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface DaySchedule {
  open: string;
  close: string;
  closed: boolean;
}

const DEFAULT_SCHEDULE: Record<DayKey, DaySchedule> = {
  mon: { open: '10:00 AM', close: '10:00 PM', closed: false },
  tue: { open: '10:00 AM', close: '10:00 PM', closed: false },
  wed: { open: '10:00 AM', close: '10:00 PM', closed: false },
  thu: { open: '10:00 AM', close: '10:00 PM', closed: false },
  fri: { open: '10:00 AM', close: '10:00 PM', closed: false },
  sat: { open: '10:00 AM', close: '10:00 PM', closed: false },
  sun: { open: '10:00 AM', close: '10:00 PM', closed: false },
};

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const TIME_PICKER_OPTIONS = [
  '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM',
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM',
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
  '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
  '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM',
  '10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM',
  '12:00 AM', '12:30 AM', '01:00 AM', '01:30 AM',
  '02:00 AM', '02:30 AM', '03:00 AM', '03:30 AM',
  '04:00 AM', '04:30 AM', '05:00 AM', '05:30 AM',
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

export default function ProfileOnboardingScreen() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const { locale } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [loadingMerchant, setLoadingMerchant] = useState(true);
  const [merchantData, setMerchantData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSuccess, setCompletedSuccess] = useState(false);

  // Step 1: Identity & Category
  const [storeName, setStoreName] = useState('');
  const [tagline, setTagline] = useState('');
  const [selectedCatGroup, setSelectedCatGroup] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('barber');
  const [selectedBrandColor, setSelectedBrandColor] = useState('#FFC700');

  // Step 2: Photos & Operating Hours
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<any>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<any>(null);
  const [hoursPreset, setHoursPreset] = useState<'daily' | 'weekday_sat' | 'custom'>('daily');
  const [schedule, setSchedule] = useState<Record<DayKey, DaySchedule>>(DEFAULT_SCHEDULE);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [pickerDay, setPickerDay] = useState<DayKey>('mon');
  const [pickerField, setPickerField] = useState<'open' | 'close'>('open');
  const [pickerTab, setPickerTab] = useState<'all' | 'morning' | 'afternoon' | 'night'>('all');
  const [applyToAllOpenDays, setApplyToAllOpenDays] = useState(false);

  // Step 3: Location & Contact
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Jitra, Kedah');
  const [phone, setPhone] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');

  useEffect(() => {
    loadExistingMerchant();
  }, [user]);

  const loadExistingMerchant = async () => {
    try {
      if (user?.merchant_id) {
        const m = await pb.collection('merchants').getOne(user.merchant_id);
        setMerchantData(m);
        if (m.name) setStoreName(m.name);
        if (m.pwa_brand_color) setSelectedBrandColor(m.pwa_brand_color);
        if (m.logo) setLogoUri(`${pb.baseUrl}/api/files/merchants/${m.id}/${m.logo}`);
        if (m.banner) setBannerUri(`${pb.baseUrl}/api/files/merchants/${m.id}/${m.banner}`);
        if (m.metadata?.sub_category) setSelectedCategoryId(m.metadata.sub_category);
        if (m.metadata?.tagline) setTagline(m.metadata.tagline);
        if (m.metadata?.phone) setPhone(m.metadata.phone);
        else if (user.phone) setPhone(user.phone);

        // Fetch location
        try {
          const locRes = await pb.collection('store_locations').getFirstListItem(`merchant = "${m.id}"`);
          if (locRes) {
            if (locRes.address) setAddress(locRes.address);
            if (locRes.city) setCity(locRes.city);
            if (locRes.phone && !phone) setPhone(locRes.phone);
            const savedHours = locRes.hours || locRes.operating_hours;
            if (savedHours && typeof savedHours === 'object') {
              setSchedule({ ...DEFAULT_SCHEDULE, ...savedHours });
              setHoursPreset('custom');
            }
          }
        } catch (e) {}
      } else {
        if (user?.name) setStoreName(`${user.name}'s Store`);
        if (user?.phone) setPhone(user.phone);
      }
    } catch (e) {
      console.warn('Error loading merchant for onboarding:', e);
    } finally {
      setLoadingMerchant(false);
    }
  };

  const handleApplyPreset = (preset: 'daily' | 'weekday_sat') => {
    setHoursPreset(preset);
    if (preset === 'daily') {
      const updated = { ...schedule };
      (Object.keys(updated) as DayKey[]).forEach((day) => {
        updated[day] = { open: '10:00 AM', close: '10:00 PM', closed: false };
      });
      setSchedule(updated);
    } else if (preset === 'weekday_sat') {
      const updated = { ...schedule };
      (Object.keys(updated) as DayKey[]).forEach((day) => {
        if (day === 'sun') {
          updated[day] = { open: '10:00 AM', close: '07:00 PM', closed: true };
        } else {
          updated[day] = { open: '09:00 AM', close: '07:00 PM', closed: false };
        }
      });
      setSchedule(updated);
    }
  };

  const toggleDayClosed = (day: DayKey) => {
    setHoursPreset('custom');
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], closed: !prev[day].closed },
    }));
  };

  const updateDayTime = (day: DayKey, field: 'open' | 'close', value: string) => {
    setHoursPreset('custom');
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const openTimePicker = (day: DayKey, field: 'open' | 'close') => {
    setPickerDay(day);
    setPickerField(field);
    setApplyToAllOpenDays(false);
    if (field === 'open') {
      setPickerTab('morning');
    } else {
      setPickerTab('night');
    }
    setTimePickerVisible(true);
  };

  const handleSelectTime = (selectedTime: string) => {
    setHoursPreset('custom');
    if (applyToAllOpenDays) {
      setSchedule((prev) => {
        const next = { ...prev };
        (Object.keys(next) as DayKey[]).forEach((d) => {
          if (!next[d].closed) {
            next[d] = { ...next[d], [pickerField]: selectedTime };
          }
        });
        return next;
      });
    } else {
      setSchedule((prev) => ({
        ...prev,
        [pickerDay]: { ...prev[pickerDay], [pickerField]: selectedTime },
      }));
    }
    setTimePickerVisible(false);
  };

  const filteredTimeOptions = TIME_PICKER_OPTIONS.filter((time) => {
    if (pickerTab === 'all') return true;
    const isAm = time.includes('AM');
    const hour = parseInt(time.split(':')[0], 10);
    if (pickerTab === 'morning') {
      return isAm && hour >= 6 && hour < 12;
    }
    if (pickerTab === 'afternoon') {
      return (!isAm && hour === 12) || (!isAm && hour >= 1 && hour < 6);
    }
    if (pickerTab === 'night') {
      return (!isAm && hour >= 6 && hour < 12) || (isAm && (hour === 12 || hour < 6));
    }
    return true;
  });

  const pickImage = async (type: 'logo' | 'banner') => {
    if (Platform.OS === 'web') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event: any) => {
              if (type === 'logo') {
                setLogoUri(event.target?.result as string);
                setLogoFile(file);
              } else {
                setBannerUri(event.target?.result as string);
                setBannerFile(file);
              }
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } catch (e) {
        console.warn('Web file picker error:', e);
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access gallery is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (type === 'logo') {
          setLogoUri(asset.uri);
          setLogoFile({ uri: asset.uri, name: `logo_${Date.now()}.jpg`, type: 'image/jpeg' });
        } else {
          setBannerUri(asset.uri);
          setBannerFile({ uri: asset.uri, name: `banner_${Date.now()}.jpg`, type: 'image/jpeg' });
        }
      }
    }
  };

  const validateStep1 = () => {
    if (!storeName.trim()) {
      Alert.alert('Store Name Required', 'Please enter your business or store name.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!logoUri && !bannerUri) {
      Alert.alert(
        'Store Photos Recommended',
        'Please upload at least your Store Logo or Storefront Banner so customers recognize your business on the app.',
        [
          { text: 'Upload Now', style: 'cancel' },
          { text: 'Continue Anyway', onPress: () => setCurrentStep(3) },
        ]
      );
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handleSaveAndComplete = async () => {
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please enter your store address or lot number.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('WhatsApp Required', 'Please enter your store contact phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const merchantId = user?.merchant_id;
      if (!merchantId) {
        throw new Error('Merchant account not found. Please log in again.');
      }

      const selectedCatObj = ALL_CATEGORIES_LIST.find((c) => c.id === selectedCategoryId);
      const baseCategory = mapSubCategoryToBase(selectedCategoryId);

      const existingMeta = merchantData?.metadata || {};
      const updatedMetadata = {
        ...existingMeta,
        sub_category: selectedCategoryId,
        sub_category_name: selectedCatObj?.name || 'Store',
        icon: selectedCatObj?.icon || 'storefront',
        tagline: tagline.trim(),
        phone: phone.trim(),
        profile_completed: true,
        completed_at: new Date().toISOString(),
      };

      // 1. Update Merchant Record
      const formData = new FormData();
      formData.append('name', storeName.trim());
      formData.append('category', baseCategory);
      formData.append('pwa_brand_color', selectedBrandColor);
      formData.append('metadata', JSON.stringify(updatedMetadata));
      if (googleReviewUrl.trim()) {
        formData.append('google_review_url', googleReviewUrl.trim());
      }
      if (logoFile) {
        formData.append('logo', logoFile);
      }
      if (bannerFile) {
        formData.append('banner', bannerFile);
      }

      await pb.collection('merchants').update(merchantId, formData);

      // 2. Update or Create store_locations record
      try {
        let existingLoc: any = null;
        try {
          existingLoc = await pb.collection('store_locations').getFirstListItem(`merchant = "${merchantId}"`);
        } catch (e) {}

        const locPayload = {
          merchant: merchantId,
          name: storeName.trim() || 'Main Outlet',
          address: address.trim(),
          city: city.trim(),
          country: 'Malaysia',
          phone: phone.trim(),
          hours: schedule,
          is_active: true,
        };

        if (existingLoc?.id) {
          await pb.collection('store_locations').update(existingLoc.id, locPayload);
        } else {
          await pb.collection('store_locations').create(locPayload);
        }
      } catch (locErr) {
        console.warn('Store location save error:', locErr);
      }

      // 3. Update User Phone if provided
      if (user?.id && phone.trim()) {
        try {
          await pb.collection('users').update(user.id, { phone: phone.trim() });
        } catch (uErr) {}
      }

      await refreshSession();
      setCompletedSuccess(true);
    } catch (err: any) {
      console.warn('Onboarding submit error:', err);
      Alert.alert('Save Error', err?.message || 'Failed to save merchant profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCatObj = ALL_CATEGORIES_LIST.find((c) => c.id === selectedCategoryId);

  const filteredCategories = ALL_CATEGORIES_LIST.filter((cat) => {
    if (selectedCatGroup === 'all') return true;
    const grp = CATEGORY_GROUPS.find((g) => g.id === selectedCatGroup);
    return grp?.ids ? grp.ids.includes(cat.id) : true;
  });

  if (loadingMerchant) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FFC700" />
        <Text style={{ marginTop: 14, color: '#94A3B8', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 }}>
          Loading Risev store setup...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={[styles.container, isDesktop && { maxWidth: 640, alignSelf: 'center', width: '100%' }]}>
        
        {/* Risev Obsidian Luxury Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (currentStep > 1) setCurrentStep((prev) => (prev - 1) as any);
              else router.replace('/(merchant)');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Complete Store Profile</Text>
            <View style={styles.stepBadge}>
              <View style={styles.stepBadgeDot} />
              <Text style={styles.stepBadgeText}>
                {currentStep === 1
                  ? 'STEP 1 OF 3 • BRAND & CATEGORY'
                  : currentStep === 2
                  ? 'STEP 2 OF 3 • PHOTOS & HOURS'
                  : 'STEP 3 OF 3 • LOCATION & CONTACT'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.helpHeaderBtn}
            activeOpacity={0.7}
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.open('https://wa.me/60104648598?text=Hi%20Risev%20Support,%20I%20need%20help%20setting%20up%20my%20store%20profile.', '_blank');
              }
            }}
          >
            <Ionicons name="help-circle-outline" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Progress Stepper Bar */}
        <View style={styles.stepperContainer}>
          <View style={[styles.stepperTrack, currentStep >= 1 && styles.stepperActive]} />
          <View style={[styles.stepperTrack, currentStep >= 2 && styles.stepperActive]} />
          <View style={[styles.stepperTrack, currentStep >= 3 && styles.stepperActive]} />
        </View>

        {completedSuccess ? (
          /* Success Screen */
          <View style={styles.successWrapper}>
            <View style={styles.successIconBubble}>
              <Ionicons name="sparkles" size={48} color="#FFC700" />
            </View>
            <Text style={styles.successHeading}>Profile Completed! 🚀</Text>
            <Text style={styles.successSub}>
              Your store is now fully configured and live! Customers can discover you on the Explore directory, collect stamps at your stand, and book appointments.
            </Text>

            <View style={styles.storeSummaryBadge}>
              <View style={[styles.categoryBadgeMini, { backgroundColor: selectedCatObj?.bg || '#FEF9C3' }]}>
                <Ionicons name={(selectedCatObj?.icon || 'storefront') as any} size={15} color={selectedCatObj?.color || '#0F172A'} />
                <Text style={[styles.categoryBadgeMiniText, { color: selectedCatObj?.color || '#0F172A' }]}>
                  {selectedCatObj?.name || 'Store'}
                </Text>
              </View>
              <Text style={styles.badgeStoreName}>{storeName}</Text>
              <Text style={styles.badgeStoreLoc}>📍 {city}</Text>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace('/(merchant)')}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={18} color="#000000" />
              <Text style={styles.primaryBtnText}>Open Merchant Dashboard ➔</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* STEP 1: IDENTITY & CATEGORY */}
              {currentStep === 1 && (
                <View>
                  <View style={styles.stepIntro}>
                    <Text style={styles.stepHeading}>Store Identity & Category 💈</Text>
                    <Text style={styles.stepSubheading}>
                      Help customers easily discover and recognize your brand on Risev.
                    </Text>
                  </View>

                  {/* Store Name Input */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>STORE / BUSINESS NAME *</Text>
                    <View style={styles.inputFieldWrapper}>
                      <Ionicons name="storefront-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
                      <TextInput
                        style={styles.textInputWithIcon}
                        placeholder="e.g. Jerami Barbershop"
                        placeholderTextColor="#94A3B8"
                        value={storeName}
                        onChangeText={setStoreName}
                      />
                    </View>
                  </View>

                  {/* Store Tagline */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>STORE TAGLINE (OPTIONAL)</Text>
                    <View style={styles.inputFieldWrapper}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
                      <TextInput
                        style={styles.textInputWithIcon}
                        placeholder="e.g. Gentlemen Cuts & Hot Towel Shave"
                        placeholderTextColor="#94A3B8"
                        value={tagline}
                        onChangeText={setTagline}
                      />
                    </View>
                  </View>

                  {/* Category Section Header */}
                  <View style={{ marginTop: 14, marginBottom: 8 }}>
                    <Text style={styles.inputLabel}>CHOOSE YOUR BUSINESS CATEGORY *</Text>
                    <Text style={styles.categorySubText}>
                      This decides where you appear in customer search, discover tabs, and filter tags.
                    </Text>
                  </View>

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

                  {/* Category Grid (2 columns) */}
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
                          onPress={() => setSelectedCategoryId(cat.id)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.categoryIconCircle, { backgroundColor: cat.bg }]}>
                            <Ionicons name={cat.icon as any} size={20} color={cat.color} />
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

                  {/* Brand Accent Color */}
                  <View style={{ marginTop: 22, marginBottom: 12 }}>
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
                </View>
              )}

              {/* STEP 2: PHOTOS & OPERATING HOURS */}
              {currentStep === 2 && (
                <View>
                  <View style={styles.stepIntro}>
                    <Text style={styles.stepHeading}>Storefront Photos & Hours 📸</Text>
                    <Text style={styles.stepSubheading}>
                      Upload your store branding and set when your doors are open for customers.
                    </Text>
                  </View>

                  {/* Risev Cover Banner + Overlapping Logo (Exact match with edit-profile) */}
                  <Text style={styles.inputLabel}>STORE BRANDING (COVER & LOGO)</Text>
                  <View style={styles.coverHeaderContainer}>
                    {/* Banner Picker */}
                    <TouchableOpacity
                      style={styles.coverBannerPicker}
                      onPress={() => pickImage('banner')}
                      activeOpacity={0.85}
                    >
                      {bannerUri ? (
                        <Image source={{ uri: bannerUri }} style={styles.coverBannerImage} />
                      ) : (
                        <View style={styles.coverBannerPlaceholder}>
                          <Ionicons name="image-outline" size={32} color="#94A3B8" />
                          <Text style={styles.coverBannerPlaceholderText}>Upload Storefront Banner (16:9)</Text>
                          <Text style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'PlusJakartaSans_500Medium' }}>
                            Tap to browse photo
                          </Text>
                        </View>
                      )}
                      <View style={styles.coverBannerCameraIcon}>
                        <Ionicons name="camera" size={13} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>

                    {/* Centered Circular Logo Wrapper */}
                    <View style={styles.coverLogoWrapper}>
                      <TouchableOpacity
                        style={styles.coverLogoPicker}
                        onPress={() => pickImage('logo')}
                        activeOpacity={0.85}
                      >
                        {logoUri ? (
                          <Image source={{ uri: logoUri }} style={styles.coverLogoImage} />
                        ) : (
                          <View style={styles.coverLogoPlaceholder}>
                            <Ionicons name="camera" size={24} color="#94A3B8" />
                            <Text style={styles.coverLogoPlaceholderText}>Logo</Text>
                          </View>
                        )}
                        <View style={styles.coverLogoCameraIcon}>
                          <Ionicons name="camera" size={11} color="#050505" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Photo Actions Row */}
                  <View style={styles.photoActionsRow}>
                    <TouchableOpacity
                      style={styles.smallPhotoActionBtn}
                      onPress={() => pickImage('logo')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera-outline" size={14} color="#0F172A" />
                      <Text style={styles.smallPhotoActionText}>
                        {logoUri ? 'Change Logo' : 'Upload Logo'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.smallPhotoActionBtn}
                      onPress={() => pickImage('banner')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="image-outline" size={14} color="#0F172A" />
                      <Text style={styles.smallPhotoActionText}>
                        {bannerUri ? 'Change Banner' : 'Upload Banner'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Operating Hours Section */}
                  <View style={{ marginTop: 24, marginBottom: 10 }}>
                    <Text style={styles.inputLabel}>OPERATING HOURS SCHEDULE</Text>
                    <Text style={styles.categorySubText}>
                      Pick a quick preset or customize individual days of the week.
                    </Text>

                    {/* Presets */}
                    <View style={styles.presetRow}>
                      <TouchableOpacity
                        style={[styles.presetBtn, hoursPreset === 'daily' && styles.presetBtnActive]}
                        onPress={() => handleApplyPreset('daily')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.presetBtnText, hoursPreset === 'daily' && styles.presetBtnTextActive]}>
                          ⚡ Everyday (10am–10pm)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.presetBtn, hoursPreset === 'weekday_sat' && styles.presetBtnActive]}
                        onPress={() => handleApplyPreset('weekday_sat')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.presetBtnText, hoursPreset === 'weekday_sat' && styles.presetBtnTextActive]}>
                          🏢 Mon–Sat (Sun Off)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Schedule Table */}
                    <View style={styles.scheduleCard}>
                      {(Object.keys(schedule) as DayKey[]).map((day) => {
                        const s = schedule[day];
                        return (
                          <View key={day} style={styles.dayCardItem}>
                            {/* Day Header Row */}
                            <View style={styles.dayHeaderRow}>
                              <Text style={[styles.dayText, s.closed && { color: '#94A3B8' }]}>
                                {DAY_LABELS[day]}
                              </Text>

                              <View style={styles.closedToggleWrap}>
                                <Text style={[styles.closedToggleLabel, s.closed ? styles.closedLabelOff : styles.closedLabelOn]}>
                                  {s.closed ? 'Closed' : 'Open'}
                                </Text>
                                <Switch
                                  value={!s.closed}
                                  onValueChange={() => toggleDayClosed(day)}
                                  trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                                  thumbColor="#FFFFFF"
                                  style={Platform.OS === 'web' ? { transform: [{ scale: 0.85 }] } : {}}
                                />
                              </View>
                            </View>

                            {/* Time Range Row */}
                            {s.closed ? (
                              <View style={styles.closedDayBanner}>
                                <Ionicons name="moon-outline" size={13} color="#94A3B8" />
                                <Text style={styles.closedDayBannerText}>Closed on this day</Text>
                              </View>
                            ) : (
                              <View style={styles.timeInputsRow}>
                                <TouchableOpacity
                                  style={styles.timePickerButton}
                                  onPress={() => openTimePicker(day, 'open')}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="sunny-outline" size={13} color="#D97706" />
                                  <Text style={styles.timePickerButtonText}>{s.open || '10:00 AM'}</Text>
                                  <Ionicons name="chevron-down" size={12} color="#94A3B8" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>

                                <Text style={styles.timeRangeArrow}>➔</Text>

                                <TouchableOpacity
                                  style={styles.timePickerButton}
                                  onPress={() => openTimePicker(day, 'close')}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="moon-outline" size={13} color="#6366F1" />
                                  <Text style={styles.timePickerButtonText}>{s.close || '10:00 PM'}</Text>
                                  <Ionicons name="chevron-down" size={12} color="#94A3B8" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {/* STEP 3: LOCATION & CONTACT */}
              {currentStep === 3 && (
                <View>
                  <View style={styles.stepIntro}>
                    <Text style={styles.stepHeading}>Location & Contact 📍</Text>
                    <Text style={styles.stepSubheading}>
                      Provide your physical location and customer support contacts so customers can visit and reach you.
                    </Text>
                  </View>

                  {/* Street Address */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>STREET / PREMISES ADDRESS *</Text>
                    <View style={styles.inputFieldWrapper}>
                      <Ionicons name="location-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
                      <TextInput
                        style={styles.textInputWithIcon}
                        placeholder="e.g. No. 12, Ground Floor, Jalan Melati 1"
                        placeholderTextColor="#94A3B8"
                        value={address}
                        onChangeText={setAddress}
                      />
                    </View>
                  </View>

                  {/* City Selector */}
                  <View style={{ marginTop: 14, marginBottom: 8 }}>
                    <Text style={styles.inputLabel}>CITY / AREA *</Text>
                    <View style={styles.inputFieldWrapper}>
                      <Ionicons name="business-outline" size={18} color="#94A3B8" style={styles.inputFieldIcon} />
                      <TextInput
                        style={styles.textInputWithIcon}
                        placeholder="e.g. Jitra, Kedah"
                        placeholderTextColor="#94A3B8"
                        value={city}
                        onChangeText={setCity}
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

                  {/* WhatsApp Phone */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>WHATSAPP BUSINESS PHONE *</Text>
                    <View style={styles.inputFieldWrapper}>
                      <View style={styles.phonePrefixBadge}>
                        <Ionicons name="logo-whatsapp" size={16} color="#10B981" />
                        <Text style={styles.phonePrefixText}>+60</Text>
                      </View>
                      <TextInput
                        style={styles.textInputWithIcon}
                        placeholder="112345678"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        value={phone.startsWith('+60') ? phone.replace('+60', '') : phone}
                        onChangeText={(txt) => {
                          const clean = txt.replace(/[^0-9]/g, '');
                          setPhone(`+60${clean}`);
                        }}
                      />
                    </View>
                    <Text style={styles.fieldHint}>Used for customer booking confirmations and automated WhatsApp stamp alerts.</Text>
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
                      />
                    </View>
                    <Text style={styles.fieldHint}>Encourage customers who tap their card to leave a 5-star Google review for bonus rewards.</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Pinned Bottom Navigation Footer */}
            <View style={styles.pinnedBottomBar}>
              {currentStep > 1 && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setCurrentStep((prev) => (prev - 1) as any)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-back" size={16} color="#0F172A" />
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
              )}

              {currentStep < 3 ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1 }]}
                  onPress={handleNext}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Continue to Step {currentStep + 1} ➔</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1, backgroundColor: '#050505' }]}
                  onPress={handleSaveAndComplete}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFC700" />
                  ) : (
                    <>
                      <Ionicons name="rocket-outline" size={18} color="#FFC700" />
                      <Text style={[styles.primaryBtnText, { color: '#FFC700' }]}>Complete Profile & Launch 🚀</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* TIME PICKER MODAL */}
      <Modal
        visible={timePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTimePickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContentCard}
            activeOpacity={1}
            onPress={(e) => {
              if (Platform.OS === 'web') {
                e.stopPropagation();
              }
            }}
          >
            <View style={styles.modalHandleBar} />

            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={pickerField === 'open' ? 'sunny-outline' : 'moon-outline'}
                    size={18}
                    color={pickerField === 'open' ? '#D97706' : '#6366F1'}
                  />
                  <Text style={styles.modalHeaderTitle}>
                    {pickerField === 'open' ? 'Select Opening Time' : 'Select Closing Time'}
                  </Text>
                </View>
                <Text style={styles.modalHeaderSubtitle}>
                  For {DAY_LABELS[pickerDay]} • Current: {schedule[pickerDay]?.[pickerField]}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setTimePickerVisible(false)}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Apply to all open days banner */}
            <View style={styles.modalBulkApplyBanner}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalBulkApplyTitle}>Apply to all open days</Text>
                <Text style={styles.modalBulkApplySub}>
                  Update {pickerField === 'open' ? 'opening' : 'closing'} time for every open day
                </Text>
              </View>
              <Switch
                value={applyToAllOpenDays}
                onValueChange={setApplyToAllOpenDays}
                trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                thumbColor="#FFFFFF"
                style={Platform.OS === 'web' ? { transform: [{ scale: 0.85 }] } : {}}
              />
            </View>

            {/* Quick Popular Picks */}
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.pickerSectionLabel}>QUICK PICKS</Text>
              <View style={styles.quickPicksRow}>
                {(pickerField === 'open'
                  ? ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM']
                  : ['06:00 PM', '08:00 PM', '10:00 PM', '11:00 PM', '12:00 AM']
                ).map((quickTime) => {
                  const isSelected = schedule[pickerDay]?.[pickerField] === quickTime;
                  return (
                    <TouchableOpacity
                      key={quickTime}
                      style={[styles.quickPickChip, isSelected && styles.quickPickChipActive]}
                      onPress={() => handleSelectTime(quickTime)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.quickPickChipText, isSelected && styles.quickPickChipTextActive]}>
                        {quickTime}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Filter Tabs */}
            <View style={styles.modalFilterTabs}>
              {[
                { id: 'all', label: 'All Slots' },
                { id: 'morning', label: 'Morning' },
                { id: 'afternoon', label: 'Afternoon' },
                { id: 'night', label: 'Evening & Night' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.modalFilterTab, pickerTab === tab.id && styles.modalFilterTabActive]}
                  onPress={() => setPickerTab(tab.id as any)}
                >
                  <Text style={[styles.modalFilterTabText, pickerTab === tab.id && styles.modalFilterTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time Slots Grid */}
            <ScrollView
              style={{ maxHeight: 240 }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.timeSlotsGrid}
            >
              {filteredTimeOptions.map((time) => {
                const isSelected = schedule[pickerDay]?.[pickerField] === time;
                return (
                  <TouchableOpacity
                    key={time}
                    style={[styles.timeSlotChip, isSelected && styles.timeSlotChipActive]}
                    onPress={() => handleSelectTime(time)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.timeSlotChipText, isSelected && styles.timeSlotChipTextActive]}>
                      {time}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={13} color="#FFC700" style={{ marginLeft: 3 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050505',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#050505',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  helpHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 199, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.3)',
  },
  stepBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFC700',
  },
  stepBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
    letterSpacing: 0.6,
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#050505',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  stepperTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1E293B',
  },
  stepperActive: {
    backgroundColor: '#FFC700',
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 30,
  },
  stepIntro: {
    marginBottom: 18,
  },
  stepHeading: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  stepSubheading: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputFieldIcon: {
    marginRight: 8,
  },
  textInputWithIcon: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  fieldHint: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 15,
  },
  categorySubText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginBottom: 10,
  },
  catGroupScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
  },
  catGroupPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catGroupPillActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  catGroupPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  catGroupPillTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  categoryCard: {
    width: '48.5%',
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 8,
  },
  categoryCardSelected: {
    borderColor: '#FFC700',
    backgroundColor: '#FFFDF0',
  },
  categoryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    lineHeight: 16,
  },
  categoryCardLabelSelected: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
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
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
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
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  brandColorPillActive: {
    borderColor: '#050505',
    backgroundColor: '#F8FAFC',
  },
  brandColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  brandColorName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },

  /* Storefront Cover & Overlapping Logo Styles (Risev edit-profile match) */
  coverHeaderContainer: {
    width: '100%',
    height: 185,
    position: 'relative',
    marginBottom: 40,
    marginTop: 10,
  },
  coverBannerPicker: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
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
    gap: 4,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
  },
  coverBannerPlaceholderText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  coverBannerCameraIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(5, 5, 5, 0.75)',
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
  coverLogoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 42,
  },
  coverLogoPlaceholderText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    marginTop: 2,
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
  photoActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  smallPhotoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  smallPhotoActionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },

  /* Operating Hours */
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  presetBtnActive: {
    borderColor: '#050505',
    backgroundColor: '#050505',
  },
  presetBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  dayCardItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  closedToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  closedToggleLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  closedLabelOn: {
    color: '#10B981',
  },
  closedLabelOff: {
    color: '#94A3B8',
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  timePickerButtonText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  timeRangeArrow: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  closedDayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  closedDayBannerText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },

  /* Time Picker Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHandleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBulkApplyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEA',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  modalBulkApplyTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#713F12',
  },
  modalBulkApplySub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#854D0E',
    marginTop: 1,
  },
  pickerSectionLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  quickPicksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickPickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickPickChipActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  quickPickChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  quickPickChipTextActive: {
    color: '#FFC700',
  },
  modalFilterTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  modalFilterTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalFilterTabActive: {
    backgroundColor: '#050505',
  },
  modalFilterTabText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  modalFilterTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 16,
  },
  timeSlotChip: {
    width: '31.3%',
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotChipActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  timeSlotChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
  },
  timeSlotChipTextActive: {
    color: '#FFC700',
  },

  /* City Chips */
  cityChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cityChipActive: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
  },
  cityChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  cityChipTextActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  phonePrefixBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  phonePrefixText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },

  /* Pinned Bottom Footer */
  pinnedBottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  primaryBtn: {
    backgroundColor: '#FFC700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },

  /* Success View */
  successWrapper: {
    flex: 1,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFBEA',
    borderWidth: 2,
    borderColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successHeading: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 24,
  },
  storeSummaryBadge: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 30,
  },
  categoryBadgeMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryBadgeMiniText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  badgeStoreName: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  badgeStoreLoc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
});
