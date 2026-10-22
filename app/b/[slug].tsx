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
  Dimensions,
  Image,
  Platform,
  Modal,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { pb } from '@/lib/pocketbase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildPassUrl, shortPassRef } from '@/lib/bookingPass';
import { ALL_TIME_SLOTS, getPeriodForSlot, isSlotInPast, parseSlotToMinutes } from '@/lib/bookingSlots';
import { AppointmentPassData, saveAppointmentPass, shareAppointmentPass } from '@/lib/appointmentPass';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  subscribeToPushNotifications,
  isPushSupported,
  getPushPermissionStatus,
} from '@/lib/push-notifications';

interface BranchItem {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  google_maps_url?: string;
  google_review_url?: string;
}

interface ServiceItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  price: number;
  duration_minutes: number;
  image_url?: string;
  image_source?: any;
  item_type?: 'service' | 'automotive' | 'facility' | 'lodging' | 'dining' | 'catering' | 'class' | 'product' | 'addon';
  requires_staff?: boolean;
  total_units?: number;
  max_pax?: number;
  peak_price?: number;
  security_deposit?: number;
  commission_type?: 'none' | 'percentage' | 'fixed';
  commission_rate?: number;
}

function getServiceItemIcon(type?: string): string {
  switch (type) {
    case 'automotive': return 'car-sport-outline';
    case 'facility': return 'business-outline';
    case 'lodging': return 'bed-outline';
    case 'dining': return 'restaurant-outline';
    case 'catering': return 'sparkles-outline';
    case 'class': return 'school-outline';
    case 'product': return 'cube-outline';
    case 'addon': return 'add-circle-outline';
    default: return 'sparkles-outline';
  }
}

interface StaffItem {
  id: string;
  name: string;
  role_title?: string;
  avatar?: string;
  photo?: string;
  role?: string;
}

function formatUpcomingDate(dateStr?: string) {
  if (!dateStr) return 'Thu, Oct 8';
  try {
    const clean = dateStr.trim().split(' ')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
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

function isObsidianDark(hexColor: string): boolean {
  if (!hexColor || typeof hexColor !== 'string') return false;
  let hex = hexColor.trim().replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 135;
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

interface OperatingHoursInfo {
  isOpen: boolean;
  todayHoursText: string;
  weeklySchedule: { day: string; hours: string; isToday: boolean }[];
}

function parseStoreOperatingHours(hoursData: any, fallbackStr?: string): OperatingHoursInfo {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shortDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const now = new Date();
  const dayIndex = now.getDay();
  const todayName = days[dayIndex];

  // Helper to format "08:00 - 22:00" to "8:00 AM – 10:00 PM"
  const formatTimeRange = (range: string): string => {
    if (!range || range.toLowerCase() === 'closed' || range.toLowerCase() === 'tutup') {
      return 'Closed';
    }
    const parts = range.split('-').map(s => s.trim());
    if (parts.length === 2) {
      const formatTime = (t: string) => {
        if (/am|pm/i.test(t)) return t.toUpperCase();
        const [hStr, mStr] = t.split(':');
        const h = parseInt(hStr, 10);
        if (isNaN(h)) return t;
        const m = mStr !== undefined ? parseInt(mStr, 10) : 0;
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 === 0 ? 12 : h % 12;
        const displayM = String(m).padStart(2, '0');
        return `${displayH}:${displayM} ${period}`;
      };
      return `${formatTime(parts[0])} – ${formatTime(parts[1])}`;
    }
    return range;
  };

  // Helper to parse if current time is within range
  const checkIfOpen = (range: string): boolean => {
    if (!range || range.toLowerCase() === 'closed' || range.toLowerCase() === 'tutup') {
      return false;
    }
    const parts = range.split('-').map(s => s.trim());
    if (parts.length === 2) {
      const parseMinutes = (t: string): number => {
        const isPM = /pm/i.test(t);
        const isAM = /am/i.test(t);
        const clean = t.replace(/am|pm/i, '').trim();
        const [hStr, mStr] = clean.split(':');
        let h = parseInt(hStr, 10) || 0;
        const m = parseInt(mStr, 10) || 0;
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        return h * 60 + m;
      };

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = parseMinutes(parts[0]);
      const endMinutes = parseMinutes(parts[1]);

      if (endMinutes > startMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Crosses midnight
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    }
    return true;
  };

  // Build weekly schedule (Monday to Sunday)
  const weeklySchedule: { day: string; hours: string; isToday: boolean }[] = [];
  let rawTodayRange = '';

  const weekOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  weekOrder.forEach(day => {
    const idx = days.indexOf(day);
    const shortKey = shortDays[idx];
    const isToday = day === todayName;

    let val = '';
    if (hoursData && typeof hoursData === 'object') {
      val = hoursData[day] || hoursData[day.toLowerCase()];
      if (!val && hoursData[shortKey]) {
        const item = hoursData[shortKey];
        if (typeof item === 'object') {
          if (item.closed) {
            val = 'Closed';
          } else if (item.open && item.close) {
            val = `${item.open} - ${item.close}`;
          }
        }
      }
    }

    const display = val ? formatTimeRange(String(val)) : (fallbackStr || '10:00 AM – 10:00 PM');
    if (isToday) {
      rawTodayRange = String(val || '');
    }

    weeklySchedule.push({
      day,
      hours: display,
      isToday,
    });
  });

  let isOpen = false;
  let todayHoursText = '';

  if (rawTodayRange) {
    todayHoursText = formatTimeRange(rawTodayRange);
    isOpen = checkIfOpen(rawTodayRange);
  } else if (fallbackStr) {
    todayHoursText = fallbackStr;
    isOpen = checkIfOpen(fallbackStr);
  } else {
    todayHoursText = '10:00 AM – 10:00 PM';
    isOpen = checkIfOpen('10:00 - 22:00');
  }

  return {
    isOpen,
    todayHoursText,
    weeklySchedule,
  };
}

export default function CustomerBookingPwaScreen() {
  const { slug, phone: queryPhone, name: queryName, ref: queryRef, pass: queryPass } = useLocalSearchParams<{ slug: string; phone?: string; name?: string; ref?: string; pass?: string }>();
  const router = useRouter();
  const { locale } = useLanguage();

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
  const [storeLocation, setStoreLocation] = useState<any>(null);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);

  // Live preview override state (when embedded in Merchant Bookings Tab 3 iframe)
  const [liveBrandColor, setLiveBrandColor] = useState<string | null>(null);
  const [liveBgColor, setLiveBgColor] = useState<string | null>(null);
  const [livePodColor, setLivePodColor] = useState<string | null>(null);
  const [liveCoverUrl, setLiveCoverUrl] = useState<string | null>(null);
  const [liveTagline, setLiveTagline] = useState<string | null>(null);
  const [liveAllowStaffSelection, setLiveAllowStaffSelection] = useState<boolean | null>(null);

  // Effective staff selection toggle
  const allowStaffSelection = liveAllowStaffSelection !== null
    ? liveAllowStaffSelection
    : (merchant?.allow_staff_selection !== false);

  // Selection states
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedBranch, setSelectedBranch] = useState<BranchItem | null>(null);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffItem | null>(null);
  const [showStaffPicker, setShowStaffPicker] = useState(false);

  // A service can require a staff member even when the store does not offer
  // customers the full team picker (merchant_services.requires_staff).
  const staffRequired = selectedServices.some((service: any) => service.requires_staff === true);
  const showStaffSelection = allowStaffSelection || staffRequired;
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getFullYear()}`;
  });
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<'Morning' | 'Afternoon' | 'Evening'>(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    const firstValid = ALL_TIME_SLOTS.find(s => !isSlotInPast(s, todayIso));
    return firstValid ? getPeriodForSlot(firstValid) : 'Morning';
  });
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    const firstValid = ALL_TIME_SLOTS.find(s => !isSlotInPast(s, todayIso));
    return firstValid || '09:00 AM';
  });

  // Compute actual earliest available slot for the selected date
  const earliestAvailableSlot = useMemo(() => {
    const firstValid = ALL_TIME_SLOTS.find(slot => !isSlotInPast(slot, selectedIsoDate));
    return firstValid || 'Closed today';
  }, [selectedIsoDate]);

  // Handle date selection with auto-alignment of valid time period and slot
  const handleDateSelect = (iso: string, full: string) => {
    setSelectedIsoDate(iso);
    setSelectedDate(full);

    const firstValid = ALL_TIME_SLOTS.find(s => !isSlotInPast(s, iso));
    if (firstValid) {
      const currentPeriodSlots = timeSlotsByPeriod[selectedTimePeriod] || [];
      const hasValidSlotInCurrentPeriod = currentPeriodSlots.some(s => !isSlotInPast(s, iso));
      if (!hasValidSlotInCurrentPeriod) {
        setSelectedTimePeriod(getPeriodForSlot(firstValid));
        setSelectedTime(firstValid);
      } else if (isSlotInPast(selectedTime, iso)) {
        const nextInPeriod = currentPeriodSlots.find(s => !isSlotInPast(s, iso));
        if (nextInPeriod) {
          setSelectedTime(nextInPeriod);
        } else {
          setSelectedTime(firstValid);
          setSelectedTimePeriod(getPeriodForSlot(firstValid));
        }
      }
    }
  };
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  // Phone-first identity on the final step: a known number resolves the name,
  // an unknown one reveals a required name field.
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'checking' | 'known' | 'unknown'>('idle');
  const [resolvedName, setResolvedName] = useState('');
  const [nameOverride, setNameOverride] = useState(false);
  // Digits of the phone the current name belongs to — whether it came from a
  // session, a URL, the cache, a lookup or was typed. A name is dropped as soon
  // as the phone changes to a different number.
  const nameOwnerPhoneRef = useRef('');
  const [profileTab, setProfileTab] = useState<'Services' | 'Reviews' | 'About'>('Services');

  // Post-booking state
  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [existingBooking, setExistingBooking] = useState<any>(null);
  const [dismissedPassId, setDismissedPassId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Appointment pass sheet (QR + check-in). Only a signed-in customer can see
  // the pass; guests are routed through the login redirect.
  const [showPassSheet, setShowPassSheet] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  // Web Push Customer Appointment Reminders state
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);

  useEffect(() => {
    if (isPushSupported() && getPushPermissionStatus() === 'granted') {
      setIsPushSubscribed(true);
    }
  }, []);

  const handleSubscribePushReminder = async () => {
    if (isPushSubscribed) return;
    setIsSubscribingPush(true);
    try {
      const res = await subscribeToPushNotifications({
        customerPhone: customerPhone,
        merchantId: merchant?.id,
        branchId: (selectedBranch?.id && selectedBranch.id !== 'main') ? selectedBranch.id : undefined,
      });
      if (res.success) {
        setIsPushSubscribed(true);
        showToast(
          locale === 'ms'
            ? 'Peringatan diaktifkan! 🔔 (2 jam & 30 minit)'
            : 'Reminders enabled! 🔔 (2h & 30m)'
        );
      } else {
        showToast(
          res.message || (locale === 'ms' ? 'Gagal mengaktifkan notifikasi.' : 'Failed to enable notifications.')
        );
      }
    } catch (e: any) {
      showToast(
        e?.message || (locale === 'ms' ? 'Ralat mengaktifkan notifikasi.' : 'Error enabling notifications.')
      );
    } finally {
      setIsSubscribingPush(false);
    }
  };

  // Operating hours calculation from real store_locations data
  const operatingHoursInfo = useMemo(() => {
    return parseStoreOperatingHours(storeLocation?.hours, merchant?.operating_hours);
  }, [storeLocation, merchant]);

  // Loyalty stamp card state
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [stampsCount, setStampsCount] = useState(5);
  const totalStamps = 10;

  // Merchant vouchers state
  const [showVouchersModal, setShowVouchersModal] = useState(false);
  const [selectedVoucherForQR, setSelectedVoucherForQR] = useState<any>(null);
  const [storeVouchers, setStoreVouchers] = useState<any[]>([]);

  // Google & Store Review Funnel State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Dynamic countdown timer for Step 4 appointment pass
  const [countdownText, setCountdownText] = useState<string>('Calculating...');
  const [countdownSubText, setCountdownSubText] = useState<string>('Your appointment starts in:');

  // Animated Radar Pulse & Shimmer Light Beam for Stepper
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentStep === 4 && !hasArrived) {
      const pulseLoop = Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      const shimmerLoop = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      pulseLoop.start();
      shimmerLoop.start();

      return () => {
        pulseLoop.stop();
        shimmerLoop.stop();
      };
    }
  }, [currentStep, hasArrived]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.7, 0.35, 0],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 80],
  });

  useEffect(() => {
    if (currentStep !== 4) return;

    const updateCountdown = () => {
      const targetIso = createdBooking?.booking_date || selectedIsoDate;
      const targetTimeStr = createdBooking?.start_time || selectedTime;

      if (!targetIso || !targetTimeStr) {
        setCountdownText('Upcoming');
        setCountdownSubText('Your appointment is scheduled');
        return;
      }

      const parts = targetIso.split('-');
      if (parts.length !== 3) {
        setCountdownText('Upcoming');
        return;
      }

      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);

      const totalMins = parseSlotToMinutes(targetTimeStr);
      const targetHours = Math.floor(totalMins / 60);
      const targetMinutes = totalMins % 60;
      const targetDate = new Date(y, m, d, targetHours, targetMinutes, 0, 0);

      const diffMs = targetDate.getTime() - Date.now();

      if (diffMs <= 0) {
        const pastMins = Math.floor(Math.abs(diffMs) / 60000);
        if (pastMins < 60) {
          setCountdownSubText('Current appointment status:');
          setCountdownText('Happening Now');
        } else {
          setCountdownSubText('Current appointment status:');
          setCountdownText('Appointment Started');
        }
        return;
      }

      setCountdownSubText('Your appointment starts in:');

      const totalSecs = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;

      if (days > 0) {
        setCountdownText(`${days}d ${hours}h ${mins}m ${secs}s`);
      } else if (hours > 0) {
        setCountdownText(`${hours} Hr${hours > 1 ? 's' : ''} ${mins} Min${mins !== 1 ? 's' : ''} ${secs} Secs`);
      } else {
        setCountdownText(`${mins} Min${mins !== 1 ? 's' : ''} ${secs} Secs`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [currentStep, createdBooking, selectedIsoDate, selectedTime]);

  const activeBrandColor = liveBrandColor || merchant?.pwa_brand_color || merchant?.brand_color || '#FFC700';
  const fallbackBg = merchant?.pwa_bg_color || merchant?.bg_color || (merchant?.pwa_theme === 'dark' || merchant?.theme === 'dark' ? '#000000' : (isObsidianDark(activeBrandColor) ? '#000000' : '#F5F0E8'));
  const activeBgColor = liveBgColor || fallbackBg;
  const activePodColor = livePodColor || merchant?.pwa_pod_color || 'auto';
  const contrastColor = getContrastColor(activeBrandColor);
  const isBrandDark = isObsidianDark(activeBrandColor);
  const isPageDark = false;
  
  const themeStyles = useMemo(() => {
    // 1. Fresha x Apple iOS Pure White Design System
    const baseBgColor = '#FFFFFF';
    const textPrimaryColor = '#111111';
    const textSecondaryColor = '#64748B';
    const textMutedColor = '#94A3B8';
    const secondaryColor = '#64748B';
    const borderColor = '#F1F5F9';
    const pillBgColor = '#F8FAFC';
    const podTextColor = '#111111';
    const podSecondaryTextColor = '#64748B';
    const hasCustomPod = false;
    const shadowDark = 'rgba(0, 0, 0, 0.04)';
    const shadowLight = '#FFFFFF';
    const isBrandDark = false;
    const contrastColor = '#FFFFFF';
    const activePodColor = '#FFFFFF';
    const activeBtnBg = '#000000';
    const activeBtnText = '#FFFFFF';
    const priceColor = '#111111';

    // Apple Card Style (Pure White card with subtle light-gray border and soft shadow)
    const neumorphicCard = {
      backgroundColor: '#FFFFFF',
      borderColor: '#F1F5F9',
      borderWidth: 1,
      borderRadius: 20,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
      ...(Platform.OS === 'web' ? {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      } : {}),
    };

    // Minimal Inset / Pill Surface
    const neumorphicInset = {
      backgroundColor: '#F8FAFC',
      borderColor: '#E2E8F0',
      borderWidth: 1,
      borderRadius: 16,
      ...(Platform.OS === 'web' ? {
        boxShadow: 'none',
      } : {}),
    };

    // Primary CTA Button Style (Pure Black #000000)
    const neumorphicActiveBtn = {
      backgroundColor: '#000000',
      borderColor: '#000000',
      borderWidth: 1,
      borderRadius: 20,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 3,
    };

    return {
      baseBgColor,
      textPrimaryColor,
      textSecondaryColor,
      textMutedColor,
      borderColor,
      pillBgColor,
      podTextColor,
      podSecondaryTextColor,
      hasCustomPod,
      shadowDark,
      shadowLight,
      isBrandDark,
      isPageDark: false,
      contrastColor,
      activeBrandColor,
      activePodColor,
      activeBtnBg,
      activeBtnText,
      priceColor,

      // Helpers
      neumorphicCard,
      neumorphicInset,
      neumorphicActiveBtn: {
        ...neumorphicActiveBtn,
        backgroundColor: activeBtnBg,
        borderColor: activeBtnBg,
      },
      bg: { backgroundColor: baseBgColor },
      textPrimary: { color: textPrimaryColor },
      textSecondary: { color: textSecondaryColor },
      border: { borderColor: borderColor },
      pillSurface: { backgroundColor: pillBgColor },
      iconCircle: { backgroundColor: pillBgColor },
    };
  }, [activeBrandColor]);

  // 1. Live Preview real-time listener from parent customization panel
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const readStoredState = () => {
      try {
        const stored = sessionStorage.getItem(`risev_booking_preview_${slug}`) ||
                       localStorage.getItem(`risev_booking_preview_${slug}`) ||
                       sessionStorage.getItem('risev_booking_preview_latest') ||
                       localStorage.getItem('risev_booking_preview_latest') ||
                       sessionStorage.getItem('risev_booking_preview_store') ||
                       localStorage.getItem('risev_booking_preview_store');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.brandColor) setLiveBrandColor(parsed.brandColor);
          if (parsed.bgColor !== undefined) setLiveBgColor(parsed.bgColor);
          if (parsed.podColor !== undefined) setLivePodColor(parsed.podColor);
          if (parsed.coverUrl !== undefined) setLiveCoverUrl(parsed.coverUrl);
          if (parsed.tagline !== undefined) setLiveTagline(parsed.tagline);
          if (parsed.allowStaffSelection !== undefined) setLiveAllowStaffSelection(parsed.allowStaffSelection);
        }
      } catch (e) {}
    };

    readStoredState();

    // Listen to real-time postMessage
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'RISEV_BOOKING_PREVIEW_UPDATE') {
        if (event.data.brandColor) setLiveBrandColor(event.data.brandColor);
        if (event.data.bgColor !== undefined) setLiveBgColor(event.data.bgColor);
        if (event.data.podColor !== undefined) setLivePodColor(event.data.podColor);
        if (event.data.coverUrl !== undefined) setLiveCoverUrl(event.data.coverUrl);
        if (event.data.tagline !== undefined) setLiveTagline(event.data.tagline);
        if (event.data.allowStaffSelection !== undefined) setLiveAllowStaffSelection(event.data.allowStaffSelection);
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', readStoredState);

    // Notify parent that iframe is ready to receive state
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'RISEV_BOOKING_PREVIEW_READY' }, '*');
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', readStoredState);
    };
  }, [slug]);

  const { user, activeRole } = useAuth();

  // A merchant browsing a booking page is not the customer. Prefill the form
  // only from a genuine customer session, otherwise the store owner ends up
  // booking as themselves and their name/phone leak into the walk-in flow.
  const customerSessionIdentity = (): { name: string; phone: string } => {
    const model: any = (pb.authStore as any)?.record || (pb.authStore as any)?.model || null;
    const role = String((user as any)?.role || model?.role || '');
    const isCustomer = activeRole === 'customer' || (activeRole !== 'merchant' && role === 'customer');
    if (!isCustomer) return { name: '', phone: '' };
    return {
      name: String(user?.name || model?.name || ''),
      phone: String(user?.phone || model?.phone || ''),
    };
  };

  // The appointment pass is customer-only. A merchant session (or a signed-out
  // device) must never unlock it: that confusion is what leaked the merchant's
  // identity into walk-ins earlier.
  const isCustomerSession = (): boolean => {
    if (!(pb.authStore as any)?.isValid) return false;
    const model: any = (pb.authStore as any)?.record || (pb.authStore as any)?.model || null;
    if (!model) return false;
    if (activeRole === 'merchant') return false;
    const role = String((user as any)?.role || model?.role || '');
    return activeRole === 'customer' || role === 'customer' || role === 'both';
  };

  const passBooking = createdBooking || existingBooking;
  const passBookingId = String(passBooking?.id || '');
  const passIsDemo = !passBookingId || passBookingId.startsWith('BK-');

  const openPassFor = (booking: any) => {
    if (!booking) return;
    setCreatedBooking(booking);
    const isoDate = String(booking.booking_date || '').split('T')[0];
    if (isoDate) {
      setSelectedIsoDate(isoDate);
      setSelectedDate(formatUpcomingDate(isoDate));
    }
    if (booking.start_time) setSelectedTime(booking.start_time);
    setHasArrived(booking.status === 'arrived' || booking.status === 'in_service');
    setCurrentStep(4);
  };

  const passServiceText = (() => {
    const raw = passBooking?.items_summary;
    let items: any[] = [];
    if (Array.isArray(raw)) items = raw;
    else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) items = parsed;
      } catch (e) {
        items = [];
      }
    }
    const names = items.map((item: any) => item?.name || item?.title).filter(Boolean);
    if (names.length > 0) return names.join(', ');
    return passBooking?.service_name || selectedServices.map((s: any) => s.name).join(', ') || 'Appointment';
  })();

  // Everything the sheet, the PDF and the print sheet render, in one shape.
  const passUrlForBooking = passBookingId ? buildPassUrl(String(slug), passBookingId) : '';
  const bookingStatus = String(passBooking?.status || 'booked');
  const passData: AppointmentPassData = {
    bookingId: passBookingId,
    shortRef: passBookingId ? shortPassRef(passBookingId) : '',
    status: bookingStatus === 'booked' && hasArrived ? 'arrived' : bookingStatus,
    merchantName: merchant?.store_name || merchant?.name || 'Risev merchant',
    merchantLogoUrl: merchant?.logo_url || null,
    passUrl: passUrlForBooking,
    qrUrl: passUrlForBooking
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(passUrlForBooking)}`
      : '',
    bookingDate: formatUpcomingDate(passBooking?.booking_date),
    startTime: String(passBooking?.start_time || '—'),
    serviceText: passServiceText,
    branchName: String(passBooking?.branch_name || selectedBranch?.name || merchant?.store_name || '—'),
    staffName: String(passBooking?.staff_name || 'Any Available'),
    total: Number(passBooking?.total_price || 0),
    customerName: String(passBooking?.customer_name || customerName || ''),
    customerPhone: String(passBooking?.customer_phone || customerPhone || ''),
  };
  const passStatus = passData.status;
  const passStatusLabel = passStatus === 'completed'
    ? 'COMPLETED'
    : (passStatus === 'arrived' || passStatus === 'in_service')
      ? 'CHECKED IN'
      : 'CONFIRMED';

  const goToLoginForPass = () => {
    if (!passBookingId) return;
    const redirect = `/b/${slug}?pass=${passBookingId}`;
    const phone = String(passBooking?.customer_phone || customerPhone || '').trim();
    router.push({
      pathname: '/login',
      params: {
        redirect_to: redirect,
        ...(phone ? { prefill_phone: phone } : {}),
        ...(customerName ? { prefill_name: customerName } : {}),
      },
    } as any);
  };

  const openPassSheet = () => {
    setPassError(null);
    if (passIsDemo) {
      showToast('Demo booking — there is no live pass to check in.');
      return;
    }
    if (!isCustomerSession()) {
      goToLoginForPass();
      return;
    }
    setShowPassSheet(true);
  };

  const savePass = async () => {
    if (passIsDemo) {
      showToast('Demo booking — there is no PDF pass to save.');
      return;
    }
    try {
      await saveAppointmentPass(passData);
      showToast(Platform.OS === 'web' ? 'Pass PDF downloaded.' : 'Choose where to save your pass.');
    } catch (e) {
      showToast('Could not prepare the pass PDF. Please try again.');
    }
  };

  const handleSharePass = async () => {
    if (passIsDemo) return;
    try {
      const result = await shareAppointmentPass(passData);
      if (result === 'copied') showToast('Pass link copied');
    } catch (e) {
      showToast('Could not share the pass. Please try again.');
    }
  };

  const handleCheckIn = async () => {
    if (passIsDemo || checkingIn) return;
    if (!isCustomerSession()) {
      goToLoginForPass();
      return;
    }
    setCheckingIn(true);
    setPassError(null);
    try {
      const res = await pb.send<any>('/api/risev/booking/check-in', {
        method: 'POST',
        body: { booking_id: passBookingId },
        requestKey: null,
      });
      setHasArrived(true);
      setCreatedBooking((prev: any) => (prev ? { ...prev, status: 'arrived' } : { id: passBookingId, status: 'arrived' }));
      setExistingBooking((prev: any) => (prev ? { ...prev, status: 'arrived' } : prev));
      // The sheet already shows the new state; the toast would cover its header.
      if (!showPassSheet) {
        showToast(res?.already ? 'Already checked in 📍' : 'Arrival confirmed — the counter has been notified 📍');
      }
    } catch (err: any) {
      const code = err?.response?.code || err?.data?.code || '';
      const messages: Record<string, string> = {
        AUTH_REQUIRED: 'Log in to check in.',
        PASS_FORBIDDEN: 'This pass belongs to a different customer.',
        BOOKING_NOT_TODAY: 'You can only check in on the day of your appointment.',
        BOOKING_NOT_ACTIVE: 'This booking can no longer be checked in.',
        BOOKING_NOT_FOUND: 'Booking not found.',
      };
      const message = messages[code] || err?.response?.message || err?.message || 'Could not check in right now.';
      setPassError(message);
      if (!showPassSheet) showToast(message);
    } finally {
      setCheckingIn(false);
    }
  };

  // The Vouchers sheet used to render two invented vouchers, so merchants saw
  // "Store Promo Voucher" cards they never created. Load this customer's real active
  // vouchers for this store instead; the sheet shows an empty state when there are none.
  useEffect(() => {
    if (!showVouchersModal) return;
    if (!user?.id || !merchant?.id) {
      setStoreVouchers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await pb.collection('vouchers').getFullList({
          filter: `customer = '${user.id}' && status = 'active' && reward.merchant = '${merchant.id}'`,
          expand: 'reward',
          sort: '-created',
          requestKey: null,
        });
        if (!cancelled) setStoreVouchers(list);
      } catch (e) {
        if (!cancelled) setStoreVouchers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showVouchersModal, user?.id, merchant?.id]);

  useEffect(() => {
    loadMerchantAndData();
    loadCachedCustomerInfo();
  }, [slug, queryPhone, queryName]);

  useEffect(() => {
    const qName = (typeof queryName === 'string' ? queryName : '').trim();
    const qPhone = (typeof queryPhone === 'string' ? queryPhone : '').trim();
    const session = customerSessionIdentity();

    if (qName) {
      setCustomerName(qName);
    } else if (session.name) {
      setCustomerName(session.name);
    }

    if (qPhone) {
      setCustomerPhone(qPhone);
    } else if (session.phone) {
      setCustomerPhone(session.phone);
    }
  }, [user, activeRole, queryName, queryPhone]);

  // Returning customers: resolve the name from the phone so nobody retypes it.
  // The lookup is scoped to this store — it only answers for customers that
  // already have a card or a booking here. It re-runs whenever the number
  // changes; the input handler drops a name that belonged to the old number.
  useEffect(() => {
    const digits = customerPhone.replace(/[^\d]/g, '');
    const merchantId = merchant?.id;

    if (!merchantId || digits.length < 9) {
      setLookupStatus('idle');
      return;
    }
    let cancelled = false;
    setLookupStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await pb.send<{ exists: boolean; name?: string }>('/api/risev/booking/customer-lookup', {
          method: 'GET',
          query: { merchant: merchantId, phone: digits },
          requestKey: null,
        });
        if (cancelled) return;
        const resolved = res && res.exists ? String(res.name || '').trim() : '';
        if (resolved) {
          nameOwnerPhoneRef.current = digits;
          setResolvedName(resolved);
          setLookupStatus('known');
          setCustomerName((prev) => (prev.trim() ? prev : resolved));
          AsyncStorage.setItem('risev_cust_identity', JSON.stringify({ name: resolved, phone: digits })).catch(() => {});
        } else {
          setLookupStatus('unknown');
        }
      } catch (err) {
        // Never leave the form stuck on "checking": an unreachable lookup is
        // treated like a new customer.
        if (!cancelled) setLookupStatus('unknown');
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerPhone, merchant?.id]);

  useEffect(() => {
    if (queryRef === 'nfc_walkin') {
      setCurrentStep(1);
    }
  }, [queryRef]);

  // A pass link (QR or shared link) restores the pass for the signed-in
  // customer. Guests are sent to login first and come back to this URL.
  const passRedirectRef = useRef(false);
  useEffect(() => {
    const passId = typeof queryPass === 'string' ? queryPass.trim() : '';
    if (!passId || passId.startsWith('BK-')) return;

    if (!isCustomerSession()) {
      if (!passRedirectRef.current) {
        passRedirectRef.current = true;
        router.replace({
          pathname: '/login',
          params: { redirect_to: `/b/${slug}?pass=${passId}` },
        } as any);
      }
      return;
    }

    let cancelled = false;
    (async () => {
      setPassLoading(true);
      try {
        const res = await pb.send<any>('/api/risev/booking/pass', {
          method: 'GET',
          query: { booking_id: passId },
          requestKey: null,
        });
        if (cancelled || !res?.booking) return;
        const payload = res.booking;
        const items = Array.isArray(payload.items_summary) ? payload.items_summary : [];
        openPassFor({
          ...payload,
          service_name: items.map((item: any) => item?.name || item?.title).filter(Boolean).join(', '),
        });
        setShowPassSheet(true);
      } catch (err: any) {
        if (!cancelled) {
          const code = err?.response?.code || '';
          const message = code === 'PASS_FORBIDDEN'
            ? 'This pass belongs to a different customer.'
            : code === 'AUTH_REQUIRED'
            ? 'Log in to view your pass.'
            : 'Could not load this pass.';
          setPassError(message);
          showToast(message);
        }
      } finally {
        if (!cancelled) setPassLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryPass, user?.id, activeRole, slug]);

  const loadCachedCustomerInfo = async () => {
    try {
      const qName = (typeof queryName === 'string' ? queryName : '').trim();
      const qPhone = (typeof queryPhone === 'string' ? queryPhone : '').trim();
      const session = customerSessionIdentity();

      // Phone first: the cached name is only trusted for the same number, so a
      // previous visitor's name never sticks to a different phone.
      let phone = qPhone || session.phone;
      if (!phone) {
        try {
          phone = (await AsyncStorage.getItem('risev_cust_phone')) || '';
        } catch (e) {
          phone = '';
        }
      }
      if (phone) {
        setCustomerPhone(phone);
        AsyncStorage.setItem('risev_cust_phone', phone).catch(() => {});
      }

      if (qName) {
        setCustomerName(qName);
        setNameOverride(true);
        nameOwnerPhoneRef.current = phone.replace(/[^\d]/g, '');
        return;
      }
      if (session.name) {
        setCustomerName(session.name);
        nameOwnerPhoneRef.current = phone.replace(/[^\d]/g, '');
        return;
      }

      try {
        const raw = await AsyncStorage.getItem('risev_cust_identity');
        if (!raw) return;
        const cached = JSON.parse(raw);
        const digits = phone.replace(/[^\d]/g, '');
        if (cached?.name && digits && String(cached.phone || '') === digits) {
          setCustomerName(String(cached.name));
          nameOwnerPhoneRef.current = digits;
          setResolvedName(String(cached.name));
          setLookupStatus('known');
        }
      } catch (e) {}
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
        if (slug === 'scoop-creamy') {
          mRecord = {
            id: 'demo-scoop',
            name: 'Scoop Creamy',
            store_name: 'Scoop Creamy',
            subtitle: 'Artisanal Gelato & Handcrafted Ice Cream',
            pwa_slug: 'scoop-creamy',
            category: 'Food & Drinks',
            is_pro: true,
            plan: 'pro',
            rating: '4.9',
            reviews_count: '98',
            pwa_brand_color: '#FF6B8B',
            address: 'Jitra, Kedah'
          };
        } else if (slug === 'jerami-barbershop') {
          mRecord = {
            id: 'demo-jerami',
            name: 'Jerami Barbershop',
            store_name: 'Jerami Barbershop',
            subtitle: 'Gentlemen Grooming & Classic Haircuts',
            pwa_slug: 'jerami-barbershop',
            category: 'Barber',
            is_pro: true,
            plan: 'pro',
            rating: '4.9',
            reviews_count: '142',
            pwa_brand_color: '#FFC700',
            address: 'Jitra, Kedah'
          };
        } else {
          setMerchant(null);
          setServices([]);
          setBranches([]);
          setStaffList([]);
          return;
        }
      }

      const bannerUrl = mRecord.banner 
        ? `${pb.baseUrl}/api/files/merchants/${mRecord.id}/${mRecord.banner}`
        : null;

      let fallbackCover = 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=1000&auto=format&fit=crop&q=80';
      if (slug === 'scoop-creamy') {
        try {
          fallbackCover = Image.resolveAssetSource(require('@/assets/images/scoop_creamy_storefront.jpg')).uri;
        } catch (e) {}
      } else if (slug === 'jerami-barbershop') {
        try {
          fallbackCover = Image.resolveAssetSource(require('@/assets/images/jerami_barbershop.jpg')).uri;
        } catch (e) {}
      }

      const normalizedMerchant = {
        ...mRecord,
        store_name: mRecord.name || mRecord.store_name || 'Store',
        subtitle: mRecord.subtitle || mRecord.category || 'Quality Services & Bookings',
        rating: mRecord.rating || '5.0',
        reviews_count: mRecord.reviews_count || '120',
        cover_url: bannerUrl || (mRecord.cover_url && isValidImageUri(mRecord.cover_url) ? mRecord.cover_url : fallbackCover),
        logo_url: mRecord.logo_url || (mRecord.logo ? pb.files.getURL(mRecord, mRecord.logo) : null),
        pwa_brand_color: mRecord.pwa_brand_color || '#FFC700',
      };
      setMerchant(normalizedMerchant);

      // Fetch store location for real operating hours
      try {
        const locRes = await pb.collection('store_locations').getFirstListItem(
          `merchant = "${mRecord.id}"`,
          { requestKey: null }
        );
        if (locRes) {
          setStoreLocation(locRes);
        }
      } catch (locErr) {
        // Fallback for mock demo merchant if no store_locations record found
        if (slug === 'scoop-creamy' || mRecord.name?.toLowerCase().includes('scoop')) {
          setStoreLocation({
            hours: {
              Monday: '08:00 - 22:00',
              Tuesday: '08:00 - 22:00',
              Wednesday: '08:00 - 22:00',
              Thursday: '08:00 - 22:00',
              Friday: '08:00 - 22:00',
              Saturday: '09:00 - 23:00',
              Sunday: '09:00 - 21:00',
            }
          });
        }
      }

      // Check if merchant is subscribed to PRO plan
      let proStatus = 
        mRecord.is_pro === true || 
        mRecord.plan === 'pro' || 
        mRecord.subscription_plan === 'pro' ||
        mRecord.plan === 'business' ||
        mRecord.subscription_plan === 'business' ||
        mRecord.has_booking_addon === true ||
        mRecord.pwa_slug === 'scoop-creamy' ||
        slug === 'scoop-creamy' ||
        mRecord.name?.toLowerCase().includes('scoop') ||
        mRecord.name?.toLowerCase().includes('risev') ||
        mRecord.name?.toLowerCase().includes('official') ||
        mRecord.store_name?.toLowerCase().includes('scoop') ||
        mRecord.store_name?.toLowerCase().includes('risev') ||
        mRecord.store_name?.toLowerCase().includes('official');

      if (!proStatus) {
        try {
          const subRes = await pb.collection('subscriptions').getList(1, 1, {
            filter: `merchant = "${mRecord.id}" && (plan = "pro" || plan = "business") && (status = "active" || status = "trialing")`,
            requestKey: null
          });
          if (subRes.items.length > 0) {
            proStatus = true;
          }
        } catch (subErr) {}
      }
      setIsPro(proStatus);

      // Fetch branches (public route — the branches collection is no longer world-readable)
      try {
        const bRes = await pb.send<any>('/api/risev/branches/public', {
          method: 'GET',
          query: { merchant: mRecord.id },
        });
        const branchItems = (bRes && bRes.branches) || [];
        if (branchItems.length > 0) {
          setBranches(branchItems as any);
          setSelectedBranch(branchItems[0] as any);
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
        let sItems = sRes.items.map((item: any) => ({
          ...item,
          image_url: item.image 
            ? `${pb.baseUrl}/api/files/merchant_services/${item.id}/${item.image}` 
            : (item.image_url || '')
        }));

        if (sItems.length === 0) {
          if (slug === 'scoop-creamy') {
            sItems = [
              {
                id: 'scoop-item-1',
                name: 'Catering Aiskrim 300 Pax',
                category: 'Catering',
                description: 'Full artisanal ice cream booth with live server for private events & weddings',
                price: 850,
                duration_minutes: 120,
                item_type: 'catering',
                image: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&auto=format&fit=crop&q=80',
                is_active: true
              },
              {
                id: 'scoop-item-2',
                name: 'Premium aiskrim custom booth',
                category: 'Catering',
                description: 'Custom branded luxury booth with unlimited scoops & waffle cones',
                price: 1450,
                duration_minutes: 180,
                item_type: 'catering',
                image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&auto=format&fit=crop&q=80',
                is_active: true
              }
            ];
          } else if (slug === 'jerami-barbershop') {
            sItems = [
              {
                id: 'jerami-item-1',
                name: 'Signature Gentlemen Haircut',
                category: 'Haircut',
                description: 'Precision cut, wash, hot towel and styling',
                price: 25,
                duration_minutes: 30,
                item_type: 'service',
                requires_staff: true,
                is_active: true
              }
            ];
          }
        }

        setServices(sItems as any);
        if (sItems.length > 0) {
          setSelectedServices([sItems[0] as any]);
          setIsPro(true);
        } else {
          setSelectedServices([]);
        }
      } catch (sErr) {
        console.warn('Error fetching services:', sErr);
        if (slug === 'scoop-creamy') {
          const fallbackScoop = [
            {
              id: 'scoop-item-1',
              name: 'Catering Aiskrim 300 Pax',
              category: 'Catering',
              description: 'Full artisanal ice cream booth with live server for private events & weddings',
              price: 850,
              duration_minutes: 120,
              item_type: 'catering',
              image: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&auto=format&fit=crop&q=80',
              is_active: true
            },
            {
              id: 'scoop-item-2',
              name: 'Premium aiskrim custom booth',
              category: 'Catering',
              description: 'Custom branded luxury booth with unlimited scoops & waffle cones',
              price: 1450,
              duration_minutes: 180,
              item_type: 'catering',
              image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&auto=format&fit=crop&q=80',
              is_active: true
            }
          ];
          setServices(fallbackScoop as any);
          setSelectedServices([fallbackScoop[0] as any]);
          setIsPro(true);
        } else {
          setServices([]);
          setSelectedServices([]);
        }
      }

      // Fetch staff (live active staff only). The public route resolves the
      // owner's avatar from the users collection, which the PWA cannot read.
      try {
        let activeStaff: any[] = [];
        let usedPublicRoute = false;
        try {
          const pubRes = await pb.send<{ staff: any[] }>('/api/risev/staff/public', {
            method: 'GET',
            query: { merchant: mRecord.id },
            requestKey: null,
          });
          if (pubRes && Array.isArray(pubRes.staff)) {
            usedPublicRoute = true;
            activeStaff = pubRes.staff.map((s: any) => ({
              id: s.id,
              name: s.name,
              role_title: s.role_title,
              user: s.user_id || '',
              is_active: true,
              avatar: '',
              avatar_url: s.avatar_url ? `${pb.baseUrl}${s.avatar_url}` : '',
            }));
          }
        } catch (pubErr) {
          usedPublicRoute = false;
        }

        if (!usedPublicRoute) {
          const stRes = await pb.collection('merchant_staff').getList(1, 20, {
            filter: `merchant = "${mRecord.id}" && is_active = true`,
            sort: 'sort_order,created'
          });
          activeStaff = (stRes.items || []).filter((s: any) => s.is_active !== false && s.attendance_status !== 'on_leave');
        }

        // Attach real rating aggregates (derived from completed bookings).
        let staffRatings: Record<string, { rating_avg: number; rating_count: number }> = {};
        try {
          const rRes = await pb.send<any>('/api/risev/staff/ratings', {
            method: 'GET',
            query: { merchant: mRecord.id },
          });
          staffRatings = (rRes && rRes.ratings) || {};
        } catch (rErr) {
          staffRatings = {};
        }

        setStaffList(activeStaff.map((s: any) => ({
          ...s,
          rating_avg: staffRatings[s.id]?.rating_avg ?? s.rating_avg,
          rating_count: staffRatings[s.id]?.rating_count ?? s.rating_count,
        })) as any);
      } catch (stErr) {
        setStaffList([]);
      }
      setSelectedStaff(null);

      // Check if customer already has an active booking for this merchant
      try {
        const activePhone = customerSessionIdentity().phone;
        const savedPhone = await AsyncStorage.getItem('risev_cust_phone');
        const phoneToQuery = activePhone || savedPhone;

        if (phoneToQuery && mRecord?.id) {
          const digits = phoneToQuery.replace(/[^\d]/g, '');
          const plusPhone = digits.startsWith('60') ? `+${digits}` : `+60${digits.replace(/^0/, '')}`;
          const localPhone = digits.startsWith('60') ? `0${digits.slice(2)}` : digits;

          const filterQuery = `merchant = "${mRecord.id}" && (customer_phone = "${plusPhone}" || customer_phone = "${phoneToQuery}" || customer_phone = "${localPhone}") && status != "cancelled"`;
          const bkRes = await pb.collection('service_bookings').getList(1, 1, {
            filter: filterQuery,
            sort: '-created',
            requestKey: null
          });

          if (bkRes.items.length > 0) {
            setExistingBooking(bkRes.items[0]);
          } else {
            setExistingBooking(null);
          }
        }
      } catch (bkErr) {
        setExistingBooking(null);
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

  const handleOpenLocationMap = () => {
    const targetBranch = selectedBranch || (branches.length > 0 ? branches[0] : null);
    const mapsLink = 
      targetBranch?.google_maps_url || 
      targetBranch?.google_review_url || 
      merchant?.google_maps_url || 
      merchant?.google_review_url || 
      merchant?.maps_url;

    const rawAddress = targetBranch?.address || merchant?.address || `${merchant?.store_name || 'Store'} ${targetBranch?.name || ''}`;

    if (mapsLink && typeof mapsLink === 'string' && (mapsLink.startsWith('http://') || mapsLink.startsWith('https://'))) {
      Linking.openURL(mapsLink).catch(() => {
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawAddress)}`;
        Linking.openURL(fallbackUrl);
      });
    } else {
      const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawAddress)}`;
      Linking.openURL(fallbackUrl);
    }
  };

  const handleOpenReviewModal = () => {
    setReviewRating(0);
    setReviewFeedback('');
    setReviewSubmitted(false);
    setShowReviewModal(true);
  };

  const handleSelectStar = async (star: number) => {
    setReviewRating(star);
    const phone = customerPhone || (user as any)?.phone || '';
    const name = customerName || (user as any)?.name || '';
    const targetBranch = selectedBranch || (branches.length > 0 ? branches[0] : null);

    if (star === 5) {
      // 1. Prepare target Google URL (Prioritize branch-specific Google Review link over general merchant link)
      let targetUrl = (targetBranch?.google_review_url || merchant?.google_review_url || '').trim();
      if (!targetUrl) {
        const outletName = targetBranch?.name ? `${merchant?.name || merchant?.store_name || ''} ${targetBranch.name}` : (merchant?.name || merchant?.store_name || '');
        const storeName = outletName ? `${outletName} review` : 'google review';
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(storeName)}`;
      } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `https://${targetUrl}`;
      }

      // 2. Open Google Review immediately
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const opened = window.open(targetUrl, '_blank');
          if (!opened || opened.closed || typeof opened.closed === 'undefined') {
            window.location.href = targetUrl;
          }
        } else {
          Linking.openURL(targetUrl).catch(() => {});
        }
      } catch {
        Linking.openURL(targetUrl).catch(() => {});
      }

      // 3. Save feedback in database
      // 3. Save feedback in database & rate staff
      if (existingBooking?.id) {
        pb.send('/api/risev/booking/rate-staff', {
          method: 'POST',
          body: {
            booking_id: existingBooking.id,
            rating: 5,
            feedback: '',
            customer_phone: phone || existingBooking?.customer_phone || '',
          }
        }).catch((err) => console.warn('[RATE STAFF 5-STAR ERROR]', err));
      } else if (merchant?.id) {
        pb.send('/api/risev/feedback/submit', {
          method: 'POST',
          body: {
            merchant: merchant.id,
            customer_phone: phone,
            customer_name: name,
            rating: 5,
            feedback: '',
            redirected_to_google: true,
          },
        }).catch((err) => {
          console.warn('[STORE FEEDBACK 5-STAR ERROR]', err?.message || err);
        });
      }

      setTimeout(() => {
        setReviewSubmitted(true);
      }, 1400);
    }
  };

  const handleSubmitPrivateFeedback = async () => {
    if (!merchant?.id) {
      setShowReviewModal(false);
      return;
    }
    setIsSubmittingReview(true);
    const phone = customerPhone || (user as any)?.phone || '';
    const name = customerName || (user as any)?.name || '';

    try {
      if (existingBooking?.id) {
        await pb.send('/api/risev/booking/rate-staff', {
          method: 'POST',
          body: {
            booking_id: existingBooking.id,
            rating: reviewRating,
            feedback: reviewFeedback.trim(),
            customer_phone: phone || existingBooking?.customer_phone || '',
          }
        }).catch((err) => console.warn('[RATE STAFF PRIVATE ERROR]', err));
      } else {
        await pb.send('/api/risev/feedback/submit', {
          method: 'POST',
          body: {
            merchant: merchant.id,
            customer_phone: phone,
            customer_name: name,
            rating: reviewRating,
            feedback: reviewFeedback.trim(),
            redirected_to_google: false,
          },
        });
      }
      setReviewSubmitted(true);
    } catch (err: any) {
      console.warn('[STORE FEEDBACK PRIVATE ERROR]', err?.message || err);
      setReviewSubmitted(true);
    } finally {
      setIsSubmittingReview(false);
    }
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
      if (isSlotInPast(selectedTime, selectedIsoDate)) {
        Alert.alert('Slot Unavailable', 'The selected time slot has already passed. Please choose an upcoming time or another date.');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      const digits = customerPhone.replace(/[^\d]/g, '');
      if (digits.length < 9 || digits.length > 12) {
        Alert.alert('Phone Number', 'Please enter a valid WhatsApp number to confirm your booking.');
        return;
      }
      if (lookupStatus === 'checking') {
        Alert.alert('Checking Number', 'Please wait a moment while we check this number.');
        return;
      }
      if (!customerName.trim()) {
        Alert.alert('Your Name', 'We do not have this number yet. Please enter your name to confirm your booking.');
        return;
      }

      setIsSubmitting(true);
      try {
        await AsyncStorage.setItem('risev_cust_identity', JSON.stringify({ name: customerName.trim(), phone: digits }));
        await AsyncStorage.setItem('risev_cust_phone', customerPhone);

        const totalPrice = calculateTotal();
        const serviceNameStr = selectedServices.map(s => s.name).join(', ');
        const staffNameStr = !showStaffSelection
          ? (merchant?.store_name ? `${merchant.store_name} Team` : 'Store Team')
          : (selectedStaff?.name || (staffList.length === 0 ? (merchant?.store_name ? `${merchant.store_name} Team` : 'Store Team') : 'Any Available'));
        const itemsSummaryData = selectedServices.map(s => ({
          id: s.id,
          service_id: s.id,
          name: s.name,
          price: s.price,
          duration_minutes: s.duration_minutes || 30,
          item_type: s.item_type || 'service',
          commission_type: s.commission_type || 'none',
          commission_rate: s.commission_rate || 0
        }));

        const finalNotes = [
          customerNotes.trim(),
          eventVenue.trim() ? `Event Logistics & Venue: ${eventVenue.trim()}` : ''
        ].filter(Boolean).join('\n');

        const payloadToSave = {
          merchant: merchant?.id,
          branch: (selectedBranch?.id && selectedBranch.id !== 'main') ? selectedBranch.id : null,
          staff: (!showStaffSelection || !selectedStaff?.id) ? null : selectedStaff.id,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          booking_date: selectedIsoDate || new Date().toISOString().split('T')[0],
          start_time: selectedTime,
          total_price: totalPrice,
          items_summary: itemsSummaryData,
          notes: finalNotes,
          status: 'booked'
        };

        let newRec: any = null;
        if (merchant?.id && !merchant.id.startsWith('demo-')) {
          try {
            newRec = await pb.collection('service_bookings').create(payloadToSave);
          } catch (pbErr: any) {
            console.warn('Booking create err:', pbErr);
            throw pbErr;
          }
        }

        setCreatedBooking({
          ...(newRec || {}),
          id: newRec?.id || `BK-${Math.floor(100000 + Math.random() * 900000)}`,
          service_name: serviceNameStr,
          staff_name: staffNameStr,
          ...payloadToSave
        });

        showToast('Booking Confirmed! 🎉');
        setCurrentStep(4);

        // Auto-subscribe if browser permission is already granted
        if (isPushSupported() && getPushPermissionStatus() === 'granted') {
          subscribeToPushNotifications({
            customerPhone: customerPhone,
            merchantId: merchant?.id,
            branchId: (selectedBranch?.id && selectedBranch.id !== 'main') ? selectedBranch.id : undefined,
          }).then(res => {
            if (res.success) setIsPushSubscribed(true);
          }).catch(() => {});
        }
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
    if (hasArrived) return;
    if (!isCustomerSession()) {
      // The public page cannot write the booking, so sign-in is the only way in.
      goToLoginForPass();
      return;
    }
    if (createdBooking?.id && !createdBooking.id.startsWith('BK-')) {
      await handleCheckIn();
      return;
    }
    setHasArrived(true);
    showToast('Arrival confirmed 📍');
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

  // Step 3 gate: a valid phone, a finished lookup, and a name (resolved or typed).
  const phoneDigits = customerPhone.replace(/[^\d]/g, '');
  const step3Ready = phoneDigits.length >= 9 && phoneDigits.length <= 12 &&
    lookupStatus !== 'checking' && Boolean(customerName.trim());


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeStyles.baseBgColor }]} edges={['top', 'left', 'right', 'bottom']}>
      
      {/* Toast Overlay */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Top Header Bar for Steps 1, 2, 3 (Fresha Compact x Apple iOS) */}
      {currentStep > 0 && currentStep < 4 && (
        <View style={{ backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.05)' }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 10,
          }}>
            <TouchableOpacity
              onPress={handlePrevStep}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color="#000000" />
            </TouchableOpacity>

            <Text style={{
              fontSize: 18,
              fontFamily: 'PlusJakartaSans_800ExtraBold',
              color: '#000000',
            }}>
              {currentStep === 1 && 'Select Service'}
              {currentStep === 2 && 'Schedule Appointment'}
              {currentStep === 3 && 'Your Details'}
            </Text>

            <Text style={{
              fontSize: 13,
              fontFamily: 'PlusJakartaSans_600SemiBold',
              color: 'rgba(0, 0, 0, 0.55)',
            }}>
              Step {currentStep} of 3
            </Text>
          </View>

          {/* Horizontal 3-Segment Progress Indicator */}
          <View style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}>
            <View style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#FFCC00',
            }} />
            <View style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: currentStep >= 2 ? '#FFCC00' : 'rgba(0, 0, 0, 0.08)',
            }} />
            <View style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: currentStep >= 3 ? '#FFCC00' : 'rgba(0, 0, 0, 0.08)',
            }} />
          </View>
        </View>
      )}

      {/* Main Body Scroll */}
      <ScrollView
        style={[styles.mainScroll, { backgroundColor: themeStyles.baseBgColor }]}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: currentStep === 4 ? 20 : 120,
        }}
      >
        
        {/* ======================================================== */}
        {/* SCREEN 0: STOREFRONT BUSINESS PROFILE LANDING            */}
        {/* ======================================================== */}
        {currentStep === 0 && (
          <View style={styles.profileContainer}>
            
            {/* 1. Hero Cover Header (Rounded Bottom Corners) */}
            <View style={{
              width: '100%',
              height: 320,
              position: 'relative',
              borderBottomLeftRadius: 28,
              borderBottomRightRadius: 28,
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
            }}>
              <Image
                source={{
                  uri: finalCoverUrl
                }}
                style={{ width: '100%', height: 320 }}
                resizeMode="cover"
              />

              {/* Floating Top Controls Row */}
              <View style={{
                position: 'absolute',
                top: 16,
                left: 16,
                right: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10,
              }}>
                {/* Floating Back Button */}
                <TouchableOpacity
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.12,
                    shadowRadius: 6,
                    elevation: 4,
                  }}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      router.push('/(customer)/explore');
                    }
                  }}
                >
                  <Ionicons name="arrow-back" size={20} color="#111111" />
                </TouchableOpacity>

                {/* Floating Loyalty Stamp Pill */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 6,
                    elevation: 4,
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                  }}
                  onPress={() => setShowLoyaltyModal(true)}
                  activeOpacity={0.85}
                >
                  <View style={{
                    backgroundColor: '#FEF08A',
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="gift" size={13} color="#D97706" />
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#111111' }}>
                    {stampsCount}/{totalStamps} stamps
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="#111111" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. Merchant Information Section */}
            <View style={{ paddingHorizontal: 20, paddingTop: 18, backgroundColor: '#FFFFFF' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  {/* Small Yellow RISEV VIP Badge (Conditional for PRO / Eligible) */}
                  {isPro && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: '#FFCC00',
                      paddingHorizontal: 8,
                      paddingVertical: 3.5,
                      borderRadius: 10,
                      alignSelf: 'flex-start',
                      marginBottom: 6,
                    }}>
                      <Ionicons name="sparkles" size={11} color="#111111" />
                      <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111', letterSpacing: 0.6 }}>
                        RISEV VIP
                      </Text>
                    </View>
                  )}

                  {/* Merchant Name */}
                  <Text style={{
                    fontSize: 26,
                    fontFamily: 'Outfit_800ExtraBold',
                    color: '#111111',
                    letterSpacing: -0.5,
                    lineHeight: 30,
                  }} numberOfLines={1}>
                    {merchant?.store_name || 'Scoop creamy'}
                  </Text>

                  {/* Description / Subtitle */}
                  <Text style={{
                    fontSize: 13.5,
                    fontFamily: 'PlusJakartaSans_500Medium',
                    color: '#64748B',
                    marginTop: 4,
                  }}>
                    {activeTagline || merchant?.subtitle || 'Quality Services & Online Booking'}
                  </Text>
                </View>

                {/* Rating & Review Count Compact Pill */}
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  alignSelf: 'center',
                }}>
                  <Ionicons name="star" size={15} color="#FFC700" />
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111' }}>
                    {merchant?.rating || '5.0'}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                    ({merchant?.reviews_count || '120'} reviews)
                  </Text>
                </View>
              </View>

              {/* 3. Location & Operating Hours Row */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 16,
                marginBottom: 12,
              }}>
                {/* Left: Location */}
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  onPress={handleOpenLocationMap}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: '#F8FAFC',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                  }}>
                    <Ionicons name="location-outline" size={18} color="#111111" />
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#111111', flex: 1 }} numberOfLines={1}>
                    {selectedBranch?.name || branches[0]?.name || merchant?.address || 'Scoop creamy (HQ)'}
                  </Text>
                </TouchableOpacity>

                {/* Vertical Divider */}
                <View style={{ width: 1, height: 26, backgroundColor: '#E2E8F0', marginHorizontal: 12 }} />

                {/* Right: Operating Hours */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  onPress={() => setShowHoursModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: '#F8FAFC',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                  }}>
                    <Ionicons name="time-outline" size={18} color="#111111" />
                  </View>
                  <View style={{ flexDirection: 'column' }}>
                    <View style={{
                      backgroundColor: operatingHoursInfo.isOpen ? '#DCFCE7' : '#FEE2E2',
                      paddingHorizontal: 7,
                      paddingVertical: 1.5,
                      borderRadius: 8,
                      alignSelf: 'flex-start',
                    }}>
                      <Text style={{
                        fontSize: 11,
                        fontFamily: 'PlusJakartaSans_800ExtraBold',
                        color: operatingHoursInfo.isOpen ? '#15803D' : '#B91C1C',
                      }}>
                        {operatingHoursInfo.isOpen ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1.5 }}>
                      {operatingHoursInfo.todayHoursText}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* 4. Upcoming Appointment Card (Apple Wallet Style Pass) */}
              {existingBooking && existingBooking.id !== dismissedPassId && (() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const bDateStr = existingBooking.booking_date ? existingBooking.booking_date.split('T')[0] : todayStr;
                const isCompleted = existingBooking.status === 'completed';
                const isPastDate = bDateStr < todayStr;
                const isMissed = isPastDate && !isCompleted;

                let headerTagline = 'UPCOMING APPOINTMENT';
                let actionBtnText = 'View Pass';

                if (isMissed) {
                  headerTagline = '⚠️ MISSED APPOINTMENT';
                  actionBtnText = 'Rebook';
                } else if (isCompleted) {
                  headerTagline = '🎉 RECENT VISIT';
                  actionBtnText = 'Review';
                }

                const handleCardPress = () => {
                  if (isMissed) {
                    setCurrentStep(1);
                  } else if (isCompleted) {
                    handleOpenReviewModal();
                  } else {
                    openPassFor(existingBooking);
                  }
                };

                return (
                  <View style={{ marginVertical: 10 }}>
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderWidth: 1,
                        borderColor: '#F1F5F9',
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.05,
                        shadowRadius: 10,
                        elevation: 2,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onPress={handleCardPress}
                      activeOpacity={0.88}
                    >
                      {/* Left & Right Semicircular Ticket Cutouts */}
                      <View style={{
                        position: 'absolute',
                        left: -9,
                        top: '50%',
                        marginTop: -9,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        zIndex: 5,
                      }} />
                      <View style={{
                        position: 'absolute',
                        right: -9,
                        top: '50%',
                        marginTop: -9,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        zIndex: 5,
                      }} />

                      {/* Left Section: Icon + Schedule + Location */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1.4, paddingLeft: 6 }}>
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          backgroundColor: '#F8FAFC',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                        }}>
                          <Ionicons name="calendar-outline" size={22} color="#111111" />
                          <View style={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            backgroundColor: '#10B981',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1.5,
                            borderColor: '#FFFFFF',
                          }}>
                            <Ionicons name="checkmark" size={9} color="#FFFFFF" />
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#64748B', letterSpacing: 0.5 }}>
                            {headerTagline}
                          </Text>
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111', lineHeight: 18, marginTop: 1 }}>
                            {formatUpcomingDate(existingBooking.booking_date)}
                          </Text>
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111', lineHeight: 17 }}>
                            {existingBooking.start_time || '03:00 PM'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                            <Ionicons name="location-outline" size={11} color="#64748B" />
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }} numberOfLines={1}>
                              {selectedBranch?.name || branches[0]?.name || merchant?.store_name || 'Scoop creamy (HQ)'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Dashed Perforation Line */}
                      <View style={{ width: 1, height: 50, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: '#E2E8F0', marginHorizontal: 8 }} />

                      {/* Right Section: Compact Pure Black CTA */}
                      <View style={{ alignItems: 'center', justifyContent: 'center', paddingRight: 6 }}>
                        <View style={{
                          backgroundColor: '#000000',
                          borderRadius: 20,
                          paddingHorizontal: 15,
                          paddingVertical: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                            {actionBtnText}
                          </Text>
                          <Ionicons name="chevron-forward" size={12} color="#FFFFFF" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {/* 5. Quick Action Navigation (4 Minimal Rounded-Square Icon Tiles) */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 16,
                marginBottom: 22,
              }}>
                {/* 1. Book Appointment (Active) */}
                <TouchableOpacity style={{ alignItems: 'center', flex: 1 }} onPress={() => setCurrentStep(1)} activeOpacity={0.8}>
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    backgroundColor: '#FEF9C3',
                    borderWidth: 1,
                    borderColor: '#FEF08A',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="calendar-outline" size={24} color="#111111" />
                  </View>
                  <Text style={{
                    fontSize: 11,
                    fontFamily: 'PlusJakartaSans_700Bold',
                    color: '#111111',
                    textAlign: 'center',
                    marginTop: 6,
                    lineHeight: 14,
                  }}>
                    Book{'\n'}Appointment
                  </Text>
                  <View style={{ width: 22, height: 3, borderRadius: 1.5, backgroundColor: '#FFCC00', marginTop: 4 }} />
                </TouchableOpacity>

                {/* 2. Menu */}
                <TouchableOpacity style={{ alignItems: 'center', flex: 1 }} onPress={() => setCurrentStep(1)} activeOpacity={0.8}>
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="list-outline" size={24} color="#111111" />
                  </View>
                  <Text style={{
                    fontSize: 11,
                    fontFamily: 'PlusJakartaSans_600SemiBold',
                    color: '#64748B',
                    textAlign: 'center',
                    marginTop: 6,
                    lineHeight: 14,
                  }}>
                    Menu
                  </Text>
                </TouchableOpacity>

                {/* 3. Promotions */}
                <TouchableOpacity
                  style={{ alignItems: 'center', flex: 1 }}
                  onPress={() => showToast('Promotions: Buy 2 Scoops Get 1 Waffle 20% Off! 🍦')}
                  activeOpacity={0.8}
                >
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="pricetag-outline" size={24} color="#111111" />
                  </View>
                  <Text style={{
                    fontSize: 11,
                    fontFamily: 'PlusJakartaSans_600SemiBold',
                    color: '#64748B',
                    textAlign: 'center',
                    marginTop: 6,
                    lineHeight: 14,
                  }}>
                    Promotions
                  </Text>
                </TouchableOpacity>

                {/* 4. Vouchers */}
                <TouchableOpacity
                  style={{ alignItems: 'center', flex: 1 }}
                  onPress={() => setShowVouchersModal(true)}
                  activeOpacity={0.8}
                >
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="ticket-outline" size={24} color="#111111" />
                  </View>
                  <Text style={{
                    fontSize: 11,
                    fontFamily: 'PlusJakartaSans_600SemiBold',
                    color: '#64748B',
                    textAlign: 'center',
                    marginTop: 6,
                    lineHeight: 14,
                  }}>
                    Vouchers
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 6. Popular Items Section (2-Column Cards) */}
              <View style={{ marginBottom: 28 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: '#111111' }}>
                    Popular Items
                  </Text>
                  <TouchableOpacity onPress={() => setCurrentStep(1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>See all</Text>
                    <Ionicons name="chevron-forward" size={13} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {services.length > 0 ? (
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {services.slice(0, 2).map(srv => {
                      const isSelected = selectedServices.some(s => s.id === srv.id);
                      return (
                        <View
                          key={srv.id}
                          style={{
                            flex: 1,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: '#F1F5F9',
                            shadowColor: '#000000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 6,
                            elevation: 1,
                            padding: 8,
                            overflow: 'hidden',
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => toggleServiceSelection(srv)}
                            activeOpacity={0.85}
                          >
                            <Image
                              source={{ uri: srv.image_url || 'https://images.unsplash.com/photo-1557142046-c704a3adf364?w=400&auto=format&fit=crop&q=80' }}
                              style={{ width: '100%', height: 115, borderRadius: 12, resizeMode: 'cover' }}
                            />
                          </TouchableOpacity>

                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#111111', marginTop: 8, marginBottom: 6 }} numberOfLines={1}>
                            {srv.name}
                          </Text>

                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111' }}>
                              RM{srv.price}
                            </Text>

                            <TouchableOpacity
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: isSelected ? '#000000' : '#F8FAFC',
                                borderWidth: isSelected ? 0 : 1,
                                borderColor: '#E2E8F0',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              onPress={() => toggleServiceSelection(srv)}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name={isSelected ? "checkmark" : "add"}
                                size={isSelected ? 17 : 18}
                                color={isSelected ? "#FFFFFF" : "#111111"}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ paddingVertical: 12 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                      No items published yet.
                    </Text>
                  </View>
                )}
              </View>

            </View>

          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 1: CHOOSE SERVICE (STEP 1 OF 3 - REDESIGN V3)     */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            
            {/* Walk-in Referral Welcome Banner */}
            {queryRef === 'nfc_walkin' && (
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.08)',
                padding: 14,
                marginBottom: 14,
              }}>
                <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                  {customerName ? `Welcome back, ${customerName}! 👋` : 'Welcome! 👋'}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(0, 0, 0, 0.55)', marginTop: 2 }}>
                  Select your service and preferred time slot for your next visit.
                </Text>
              </View>
            )}

            {/* 3. Selected Branch Card */}
            <TouchableOpacity
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.08)',
                paddingVertical: 14,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 6,
                elevation: 1,
              }}
              onPress={() => branches.length > 1 && setShowBranchPicker(!showBranchPicker)}
              activeOpacity={branches.length > 1 ? 0.7 : 1}
            >
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="location-outline" size={24} color="#000000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 10,
                  fontFamily: 'PlusJakartaSans_800ExtraBold',
                  color: 'rgba(0, 0, 0, 0.5)',
                  letterSpacing: 0.5,
                }}>
                  SELECTED BRANCH
                </Text>
                <Text style={{
                  fontSize: 15.5,
                  fontFamily: 'PlusJakartaSans_800ExtraBold',
                  color: '#000000',
                  marginTop: 2,
                }} numberOfLines={1}>
                  {selectedBranch?.name || (branches.length > 0 ? branches[0].name : (merchant?.store_name ? `${merchant.store_name} (HQ)` : 'Scoop creamy (HQ)'))}
                </Text>
              </View>
              {branches.length > 1 && (
                <Ionicons name={showBranchPicker ? "chevron-up" : "chevron-down"} size={20} color="#000000" />
              )}
            </TouchableOpacity>

            {/* Branch dropdown options if multiple branches exist */}
            {showBranchPicker && branches.length > 1 && (
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.08)',
                padding: 8,
                marginBottom: 16,
                marginTop: -8,
                gap: 6,
              }}>
                {branches.map(br => {
                  const isBrSelected = selectedBranch?.id === br.id;
                  return (
                    <TouchableOpacity
                      key={br.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: isBrSelected ? '#FFCC00' : 'transparent',
                        gap: 10,
                      }}
                      onPress={() => {
                        setSelectedBranch(br);
                        setShowBranchPicker(false);
                      }}
                    >
                      <Ionicons name="business-outline" size={16} color="#000000" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                          {br.name}
                        </Text>
                        {Boolean(br.address) && (
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(0, 0, 0, 0.55)', marginTop: 1 }}>
                            {br.address}
                          </Text>
                        )}
                      </View>
                      {isBrSelected && <Ionicons name="checkmark-circle" size={16} color="#000000" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 4. Horizontal Category Strip (Pill Badges) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 18 }}
              contentContainerStyle={{ gap: 10 }}
            >
              {availableCategories.map(cat => {
                const isActive = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={{
                      paddingHorizontal: 22,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: isActive ? '#000000' : '#FFFFFF',
                      borderWidth: isActive ? 0 : 1,
                      borderColor: 'rgba(0, 0, 0, 0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={() => setActiveCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'PlusJakartaSans_700Bold',
                      color: isActive ? '#FFFFFF' : '#000000',
                    }}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 5. Section Header: Available Services + count */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}>
              <Text style={{
                fontSize: 20,
                fontFamily: 'PlusJakartaSans_800ExtraBold',
                color: '#000000',
              }}>
                Available Services
              </Text>
              <Text style={{
                fontSize: 13,
                fontFamily: 'PlusJakartaSans_600SemiBold',
                color: 'rgba(0, 0, 0, 0.55)',
              }}>
                {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'}
              </Text>
            </View>

            {/* 6. Service Cards List */}
            {services.length === 0 ? (
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.08)',
                flexDirection: 'column',
                alignItems: 'center',
                padding: 32,
              }}>
                <Ionicons name="sparkles-outline" size={32} color="rgba(0, 0, 0, 0.3)" />
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginTop: 10, textAlign: 'center' }}>
                  No Services Available
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(0, 0, 0, 0.55)', textAlign: 'center', marginTop: 4 }}>
                  This store has not published any services for online booking yet.
                </Text>
              </View>
            ) : filteredServices.length === 0 ? (
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.08)',
                flexDirection: 'column',
                alignItems: 'center',
                padding: 32,
              }}>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                  No items in this category
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {filteredServices.map(srv => {
                  const isSelected = selectedServices.some(item => item.id === srv.id);
                  return (
                    <TouchableOpacity
                      key={srv.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        borderWidth: isSelected ? 1.5 : 1,
                        borderColor: isSelected ? '#FFCC00' : 'rgba(0, 0, 0, 0.08)',
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isSelected ? 0.06 : 0.02,
                        shadowRadius: 8,
                        elevation: 2,
                      }}
                      onPress={() => toggleServiceSelection(srv)}
                      activeOpacity={0.85}
                    >
                      {/* Left: Square Service Image */}
                      {srv.image_source ? (
                        <Image
                          source={srv.image_source}
                          style={{ width: 88, height: 88, borderRadius: 14 }}
                          resizeMode="cover"
                        />
                      ) : srv.image_url ? (
                        <Image
                          source={{ uri: srv.image_url }}
                          style={{ width: 88, height: 88, borderRadius: 14 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{
                          width: 88,
                          height: 88,
                          borderRadius: 14,
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1,
                          borderColor: 'rgba(0, 0, 0, 0.06)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Ionicons 
                            name={getServiceItemIcon(srv.item_type) as any} 
                            size={28} 
                            color="rgba(0, 0, 0, 0.4)" 
                          />
                        </View>
                      )}

                      {/* Center: Details */}
                      <View style={{ flex: 1, paddingRight: 4 }}>
                        <Text style={{
                          fontSize: 15.5,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: '#000000',
                          lineHeight: 20,
                        }} numberOfLines={2}>
                          {srv.name}
                        </Text>
                        
                        {/* Duration with Clock Icon */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Ionicons name="time-outline" size={13.5} color="rgba(0, 0, 0, 0.6)" />
                          <Text style={{
                            fontSize: 12.5,
                            fontFamily: 'PlusJakartaSans_600SemiBold',
                            color: 'rgba(0, 0, 0, 0.6)',
                          }}>
                            {srv.duration_minutes || 60} min
                          </Text>
                        </View>

                        {/* Subtle Divider */}
                        <View style={{ height: 1, backgroundColor: 'rgba(0, 0, 0, 0.05)', marginVertical: 6 }} />

                        {/* Price */}
                        <Text style={{
                          fontSize: 17,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: '#000000',
                        }}>
                          RM{srv.price}
                        </Text>
                      </View>

                      {/* Right: Circular Selection Button */}
                      <TouchableOpacity
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: isSelected ? '#FFCC00' : '#FFFFFF',
                          borderWidth: isSelected ? 0 : 1,
                          borderColor: 'rgba(0, 0, 0, 0.2)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={() => toggleServiceSelection(srv)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={isSelected ? 'checkmark' : 'add'}
                          size={20}
                          color="#000000"
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
        {/* SCREEN 2: PICK STAFF & TIMING SLOT (STEP 2 OF 3)          */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            
            {/* Choose Staff Section Header (conditionally shown if merchant allows staff selection) */}
            {showStaffSelection && (
              <>
                <View style={styles.staffHeaderRow}>
                  <View>
                    <Text style={[styles.staffSectionTitle, { color: themeStyles.textPrimaryColor }]}>Choose Staff</Text>
                    <Text style={[styles.staffSectionSub, { color: themeStyles.textSecondaryColor }]}>
                      {staffList.length === 0 ? 'Appointment will be handled by store team.' : "Select who you'd like for your appointment."}
                    </Text>
                  </View>
                  {staffList.length > 3 && (
                    <TouchableOpacity
                      style={[styles.btnSeeAllStaff, themeStyles.neumorphicInset]}
                      onPress={() => setShowStaffPicker(!showStaffPicker)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.btnSeeAllStaffText, { color: themeStyles.textPrimaryColor }]}>See All</Text>
                      <Ionicons name="chevron-forward" size={13} color={themeStyles.textSecondaryColor} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Horizontal Scrollable Staff Cards Grid */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.staffCardsScroll}>
                  
                  {/* Card 1: Any Available / Store Team Card */}
                  <TouchableOpacity
                    style={[
                      styles.staffCardItem,
                      selectedStaff === null ? [styles.staffCardSelected, { borderColor: themeStyles.activeBtnBg }] : themeStyles.neumorphicCard
                    ]}
                    onPress={() => setSelectedStaff(null)}
                    activeOpacity={0.85}
                  >
                    {/* Active Checkmark Badge */}
                    {selectedStaff === null && (
                      <View style={[styles.staffCheckmarkBadge, { backgroundColor: themeStyles.activeBtnBg }]}>
                        <Ionicons name="checkmark" size={14} color={themeStyles.activeBtnText} />
                      </View>
                    )}

                    {/* Top Full-Bleed Banner Box */}
                    <View style={[styles.anyStaffBanner, themeStyles.neumorphicInset]}>
                      <Ionicons name="people" size={32} color={themeStyles.priceColor} />
                    </View>

                    {/* Inner Content Body */}
                    <View style={styles.staffCardBody}>
                      <Text style={[styles.staffCardName, { color: themeStyles.textPrimaryColor }]} numberOfLines={1}>
                        {staffList.length === 0 ? 'Store Team' : 'Any Available'}
                      </Text>
                      <Text style={[styles.staffCardRole, { color: themeStyles.textSecondaryColor }]} numberOfLines={1}>
                        {staffList.length === 0 ? 'First available staff' : 'First available staff'}
                      </Text>

                      {/* Earliest Slot Pill */}
                      <View style={[styles.earliestSlotChip, themeStyles.neumorphicInset]}>
                        <Ionicons name="flash" size={12} color="#EF4444" />
                        <View style={{ marginLeft: 4 }}>
                          <Text style={[styles.earliestLabelText, { color: themeStyles.textSecondaryColor }]}>Earliest slot</Text>
                          <Text style={[styles.earliestTimeText, { color: themeStyles.textPrimaryColor }]}>{earliestAvailableSlot}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Individual Real Staff Cards (only renders if merchant has staff) */}
                  {staffList.map((st) => {
                    const isSelected = selectedStaff?.id === st.id;
                    const avatarUri = (st as any).avatar_url
                      || (st.avatar ? pb.files.getURL(st, st.avatar) : null)
                      || ((st as any).photo || null);

                    return (
                      <TouchableOpacity
                        key={st.id}
                        style={[
                          styles.staffCardItem,
                          isSelected ? [styles.staffCardSelected, { borderColor: themeStyles.activeBtnBg }] : themeStyles.neumorphicCard
                        ]}
                        onPress={() => setSelectedStaff(st)}
                        activeOpacity={0.85}
                      >
                        {/* Active Checkmark Badge */}
                        {isSelected && (
                          <View style={[styles.staffCheckmarkBadge, { backgroundColor: themeStyles.activeBtnBg }]}>
                            <Ionicons name="checkmark" size={14} color={themeStyles.activeBtnText} />
                          </View>
                        )}

                        {/* Staff Avatar Photo / Placeholder (Full Bleed Edge-to-Edge) */}
                        {avatarUri ? (
                          <Image source={{ uri: avatarUri }} style={styles.staffAvatarThumb} resizeMode="cover" />
                        ) : (
                          <View style={[styles.staffAvatarThumb, themeStyles.neumorphicInset, { alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="person" size={32} color={themeStyles.textMutedColor} />
                          </View>
                        )}

                        <View style={styles.staffCardBody}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <Text style={[styles.staffCardName, { color: themeStyles.textPrimaryColor, flex: 1 }]} numberOfLines={1}>
                              {st.name}
                            </Text>
                            {(st as any).rating_count > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 2, marginLeft: 4 }}>
                                <Ionicons name="star" size={10} color="#D97706" />
                                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>
                                  {(st as any).rating_avg}
                                </Text>
                                <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#92400E' }}>
                                  ({(st as any).rating_count})
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.staffCardRole, { color: themeStyles.textSecondaryColor }]} numberOfLines={1}>
                            {st.role_title || (st as any).role || 'Specialist'}
                          </Text>

                          {/* Status / Availability Pill */}
                          <View style={[styles.nextSlotChip, themeStyles.neumorphicInset]}>
                            <View style={styles.greenDotPulse} />
                            <Text style={[styles.nextSlotText, { color: themeStyles.textPrimaryColor }]}>
                              Available today
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
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
                    onPress={() => handleDateSelect(dt.iso, dt.full)}
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
              {(['Morning', 'Afternoon', 'Evening'] as const).map(p => {
                const pSlots = timeSlotsByPeriod[p] || [];
                const isAllPast = pSlots.every(s => isSlotInPast(s, selectedIsoDate));
                const isSelectedPeriod = selectedTimePeriod === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.periodSegmentPill,
                      isSelectedPeriod ? themeStyles.neumorphicActiveBtn : null,
                      isAllPast && !isSelectedPeriod ? { opacity: 0.45 } : null
                    ]}
                    onPress={() => {
                      setSelectedTimePeriod(p);
                      const validInPeriod = pSlots.filter(s => !isSlotInPast(s, selectedIsoDate));
                      if (validInPeriod.length > 0 && !validInPeriod.includes(selectedTime)) {
                        setSelectedTime(validInPeriod[0]);
                      }
                    }}
                  >
                    <Text style={[
                      styles.periodSegmentText,
                      {
                        color: isSelectedPeriod
                          ? themeStyles.contrastColor
                          : (isAllPast ? themeStyles.textMutedColor : themeStyles.textSecondaryColor)
                      }
                    ]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3-Column Time Slot Grid */}
            <View style={styles.timeSlotsGrid}>
              {(timeSlotsByPeriod[selectedTimePeriod] || []).map(tm => {
                const isPast = isSlotInPast(tm, selectedIsoDate);
                const isSelected = selectedTime === tm && !isPast;
                return (
                  <TouchableOpacity
                    key={tm}
                    disabled={isPast}
                    style={[
                      styles.timeSlotGridPill,
                      isSelected
                        ? themeStyles.neumorphicActiveBtn
                        : isPast
                        ? [themeStyles.neumorphicInset, { opacity: 0.35 }]
                        : themeStyles.neumorphicInset
                    ]}
                    onPress={() => setSelectedTime(tm)}
                    activeOpacity={isPast ? 1 : 0.85}
                  >
                    <Text
                      style={[
                        styles.timeSlotGridText,
                        {
                          color: isSelected
                            ? themeStyles.contrastColor
                            : isPast
                            ? themeStyles.textMutedColor
                            : themeStyles.textPrimaryColor,
                          textDecorationLine: isPast ? 'line-through' : 'none'
                        }
                      ]}
                    >
                      {tm}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Informational notice if all slots in the current period or day have passed */}
            {ALL_TIME_SLOTS.every(s => isSlotInPast(s, selectedIsoDate)) ? (
              <View style={[styles.allDayPastBanner, themeStyles.neumorphicInset]}>
                <Ionicons name="time-outline" size={18} color="#EF4444" />
                <Text style={{ fontSize: 13, color: themeStyles.textPrimaryColor, marginLeft: 8, fontWeight: '600', flex: 1 }}>
                  All appointment slots for today have ended. Please choose another date above.
                </Text>
              </View>
            ) : (timeSlotsByPeriod[selectedTimePeriod] || []).every(s => isSlotInPast(s, selectedIsoDate)) ? (
              <View style={[styles.allDayPastBanner, themeStyles.neumorphicInset]}>
                <Ionicons name="time-outline" size={16} color={themeStyles.textSecondaryColor} />
                <Text style={{ fontSize: 13, color: themeStyles.textSecondaryColor, marginLeft: 8, fontWeight: '500' }}>
                  All {selectedTimePeriod.toLowerCase()} slots have passed for today. Please select an upcoming period above.
                </Text>
              </View>
            ) : null}

          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 3: CUSTOMER DETAILS (STEP 3 OF 3)                 */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <View style={styles.stepContainer}>
            
            {/* Phone first: the number is the identity. */}
            <View style={styles.inputFieldGroup}>
              <Text style={[styles.inputFieldLabel, { color: themeStyles.textPrimaryColor }]}>
                {locale === 'ms' ? 'Nombor WhatsApp' : 'WhatsApp Number'}
              </Text>
              <View style={[styles.inputWithIconBox, themeStyles.neumorphicInset]}>
                <Ionicons name="logo-whatsapp" size={18} color={themeStyles.textSecondaryColor} />
                <TextInput
                  style={[styles.inputTextInner, { color: themeStyles.textPrimaryColor }]}
                  placeholder="e.g. 0123456789"
                  placeholderTextColor={themeStyles.textMutedColor}
                  keyboardType="phone-pad"
                  value={customerPhone}
                  onChangeText={(text) => {
                    setCustomerPhone(text);
                    const nextDigits = text.replace(/[^\d]/g, '');
                    // Drop a name that belongs to the previous number (session,
                    // URL, cached, lookup or typed). A different number is a
                    // different person until the lookup says otherwise.
                    if (nameOwnerPhoneRef.current && nameOwnerPhoneRef.current !== nextDigits) {
                      setCustomerName('');
                      setNameOverride(false);
                      nameOwnerPhoneRef.current = '';
                      setResolvedName('');
                    }
                  }}
                  autoFocus
                />
              </View>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(0, 0, 0, 0.45)', marginTop: 6 }}>
                {locale === 'ms'
                  ? 'Kami guna nombor ini untuk mencari kad loyaliti dan menghantar resit anda.'
                  : 'We use this number to find your loyalty card and send your receipt.'}
              </Text>
            </View>

            {lookupStatus === 'checking' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                <ActivityIndicator size="small" color="#111111" />
                <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: themeStyles.textSecondaryColor }}>
                  {locale === 'ms' ? 'Menyemak nombor ini…' : 'Checking this number…'}
                </Text>
              </View>
            ) : null}

            {lookupStatus === 'known' && !nameOverride ? (
              <View style={[styles.inputWithIconBox, themeStyles.neumorphicInset, { paddingVertical: 14, justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons name="person-circle-outline" size={26} color="#111111" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: themeStyles.textMutedColor, letterSpacing: 0.6 }}>
                      {locale === 'ms' ? 'SELAMAT KEMBALI' : 'WELCOME BACK'}
                    </Text>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: themeStyles.textPrimaryColor, marginTop: 1 }} numberOfLines={1}>
                      {customerName || resolvedName}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setNameOverride(true)} accessibilityRole="button">
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#111111', textDecorationLine: 'underline' }}>
                    {locale === 'ms' ? 'Bukan anda? Edit' : 'Not you? Edit'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {(lookupStatus === 'unknown' || nameOverride) ? (
              <View style={styles.inputFieldGroup}>
                <Text style={[styles.inputFieldLabel, { color: themeStyles.textPrimaryColor }]}>
                  {locale === 'ms' ? 'Nama Anda' : 'Your Name'}
                </Text>
                <View style={[styles.inputWithIconBox, themeStyles.neumorphicInset]}>
                  <Ionicons name="person-outline" size={18} color={themeStyles.textSecondaryColor} />
                  <TextInput
                    style={[styles.inputTextInner, { color: themeStyles.textPrimaryColor }]}
                    placeholder={locale === 'ms' ? 'Masukkan nama penuh anda' : 'Enter your full name'}
                    placeholderTextColor={themeStyles.textMutedColor}
                    value={customerName}
                    onChangeText={(text) => {
                      setCustomerName(text);
                      // A typed name belongs to the number on screen now.
                      nameOwnerPhoneRef.current = customerPhone.replace(/[^\d]/g, '');
                    }}
                  />
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(0, 0, 0, 0.45)', marginTop: 6 }}>
                  {lookupStatus === 'unknown'
                    ? (locale === 'ms' ? 'Nombor ini belum dikenali — masukkan nama untuk teruskan.' : "We don't have this number yet — add your name to continue.")
                    : (locale === 'ms' ? 'Edit nama yang disimpan untuk nombor ini.' : 'Edit the name saved for this number.')}
                </Text>
              </View>
            ) : null}

            {selectedServices.some(s => s.item_type === 'catering') && (
              <View style={styles.inputFieldGroup}>
                <Text style={[styles.inputFieldLabel, { color: themeStyles.textPrimaryColor }]}>Event Venue Address & Setup Time 🎪</Text>
                <View style={[styles.inputWithIconBox, themeStyles.neumorphicInset]}>
                  <Ionicons name="location-outline" size={18} color={themeStyles.textSecondaryColor} />
                  <TextInput
                    style={[styles.inputTextInner, { color: themeStyles.textPrimaryColor }]}
                    placeholder="e.g. Dewan Gemilang, Jitra • Setup by 11:30 AM"
                    placeholderTextColor={themeStyles.textMutedColor}
                    value={eventVenue}
                    onChangeText={setEventVenue}
                  />
                </View>
              </View>
            )}

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
                <Text style={[styles.recapItemVal, { color: themeStyles.textPrimaryColor }]}>
                  {!showStaffSelection
                    ? (merchant?.store_name ? `${merchant.store_name} Team` : 'Store Team')
                    : (selectedStaff?.name || (staffList.length === 0 ? (merchant?.store_name ? `${merchant.store_name} Team` : 'Store Team') : 'Any Available'))}
                </Text>
              </View>
              <View style={styles.recapItemRow}>
                <Text style={[styles.recapItemLabel, { color: themeStyles.textSecondaryColor }]}>Date & Time:</Text>
                <Text style={[styles.recapItemVal, { color: themeStyles.textPrimaryColor }]}>{selectedDate} @ {selectedTime}</Text>
              </View>
            </View>

          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 4: DIGITAL PASS & CONFIRMATION (APPLE WALLET x FRESHA) */}
        {currentStep === 4 && (
          <View style={[styles.stepContainer, { flex: 1, justifyContent: 'space-between' }]}>
            <View>
              {/* Top Navigation Row (Back & Options) */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <TouchableOpacity
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: 'rgba(0, 0, 0, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                }}
                onPress={() => setCurrentStep(0)}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={20} color="#000000" />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: 'rgba(0, 0, 0, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                }}
                onPress={handleSharePass}
                activeOpacity={0.8}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            {/* Header Title & Minimalist Calendar Hero Section */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                {/* Yellow Rounded Badge with Checkmark */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  alignSelf: 'flex-start',
                  backgroundColor: '#FFCC00',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 16,
                  marginBottom: 10,
                }}>
                  <View style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#000000',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="checkmark" size={10} color="#FFCC00" />
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: 0.4 }}>
                    BOOKING CONFIRMED
                  </Text>
                </View>

                <Text style={{ fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', lineHeight: 36, marginBottom: 4 }}>
                  Appointment Pass
                </Text>
                <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#000000', opacity: 0.85 }}>
                  Your appointment is ready.
                </Text>
              </View>

              {/* Minimal Apple-Style Calendar Confirmation Illustration */}
              <View style={{ width: 68, height: 68, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', top: 0, right: 0, zIndex: 3 }}>
                  <Text style={{ fontSize: 15 }}>✨</Text>
                </View>
                <View style={{
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 2,
                  borderColor: '#000000',
                  transform: [{ rotate: '5deg' }],
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                }}>
                  {/* Calendar Top Ring Binders */}
                  <View style={{
                    position: 'absolute',
                    top: -6,
                    left: 0,
                    right: 0,
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                    paddingHorizontal: 8,
                  }}>
                    <View style={{ width: 4, height: 8, borderRadius: 2, backgroundColor: '#000000' }} />
                    <View style={{ width: 4, height: 8, borderRadius: 2, backgroundColor: '#000000' }} />
                  </View>

                  {/* Yellow Check Badge */}
                  <View style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: '#FFCC00',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="checkmark" size={16} color="#000000" />
                  </View>
                </View>
              </View>
            </View>

            {/* Main Appointment Ticket Card (Pure White with Ticket Cutouts & Perforation) */}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(0, 0, 0, 0.1)',
              borderRadius: 24,
              position: 'relative',
              overflow: 'hidden',
              padding: 20,
              marginBottom: 16,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 12,
              elevation: 3,
            }}>
              {/* Left Notch Cutout */}
              <View style={{
                position: 'absolute',
                left: -10,
                top: 135,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.1)',
                zIndex: 5,
              }} />
              {/* Right Notch Cutout */}
              <View style={{
                position: 'absolute',
                right: -10,
                top: 135,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.1)',
                zIndex: 5,
              }} />

              {/* Top Row: UPCOMING APPOINTMENT & Yellow CONFIRMED Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#FFFFFF',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 14,
                  borderColor: 'rgba(0, 0, 0, 0.12)',
                  borderWidth: 1,
                }}>
                  <Ionicons name="calendar-outline" size={13} color="#000000" />
                  <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: 0.5 }}>
                    UPCOMING APPOINTMENT
                  </Text>
                </View>

                {/* Yellow CONFIRMED badge */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: '#FFCC00',
                  paddingHorizontal: 10,
                  paddingVertical: 4.5,
                  borderRadius: 12,
                }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#000000' }} />
                  <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                    CONFIRMED
                  </Text>
                </View>
              </View>

              {/* Merchant Info: Logo/Icon + Store Name + Service Name */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: 'rgba(0, 0, 0, 0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="storefront" size={24} color="#000000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }} numberOfLines={1}>
                    {merchant?.store_name || 'Scoop creamy'}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000000', opacity: 0.8, marginTop: 2 }} numberOfLines={1}>
                    {selectedServices.map(s => s.name).join(', ') || createdBooking?.service_name || 'Catering Aiskrim 300pax'}
                  </Text>
                </View>
              </View>

              {/* Dashed Perforation Divider */}
              <View style={{
                height: 1,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: 'rgba(0, 0, 0, 0.12)',
                marginHorizontal: -4,
                marginBottom: 16,
              }} />

              {/* Booking Information: 2 Columns (Scheduled Slot + Location) */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 18,
              }}>
                {/* Left: Scheduled Slot */}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <Ionicons name="time-outline" size={17} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: 0.5 }}>
                      SCHEDULED SLOT
                    </Text>
                    <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginTop: 2, lineHeight: 17 }}>
                      {selectedDate} @ {createdBooking?.start_time || selectedTime}
                    </Text>
                  </View>
                </View>

                {/* Right: Location */}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <Ionicons name="location-outline" size={17} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: 0.5 }}>
                      LOCATION
                    </Text>
                    <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginTop: 2, lineHeight: 17 }} numberOfLines={2}>
                      {selectedBranch?.name || (branches.length > 0 ? branches[0].name : (merchant?.store_name || 'Scoop creamy (HQ)'))}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Pass Action: Pure Black Button with White QR & Arrow */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#000000',
                  borderRadius: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                activeOpacity={0.85}
                onPress={openPassSheet}
              >
                <Ionicons name={isCustomerSession() ? 'qr-code-outline' : 'lock-closed-outline'} size={18} color="#FFFFFF" />
                <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF', flex: 1, textAlign: 'center' }}>
                  {isCustomerSession() ? 'View Pass & Check In' : 'Log in to view your pass'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* 4. Horizontal Three-Step Progress Tracker */}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(0, 0, 0, 0.08)',
              borderRadius: 20,
              paddingVertical: 16,
              paddingHorizontal: 20,
              marginBottom: 16,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.03,
              shadowRadius: 6,
              elevation: 2,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Step 1: Booked */}
                <View style={{ alignItems: 'center', width: 60 }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#000000',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginTop: 6 }}>
                    Booked
                  </Text>
                </View>

                {/* Connecting Line 1-2 (Solid Black) */}
                <View style={{ flex: 1, height: 2, backgroundColor: '#000000', marginHorizontal: 6, marginBottom: 18 }} />

                {/* Step 2: Arrive */}
                <View style={{ alignItems: 'center', width: 60 }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: hasArrived ? '#000000' : '#FFCC00',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#FFCC00',
                    shadowOpacity: hasArrived ? 0 : 0.35,
                    shadowRadius: 6,
                    elevation: 3,
                  }}>
                    <Ionicons name={hasArrived ? "checkmark" : "location"} size={18} color={hasArrived ? "#FFFFFF" : "#000000"} />
                  </View>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginTop: 6 }}>
                    Arrive
                  </Text>
                </View>

                {/* Connecting Line 2-3 (Dashed or Solid based on status) */}
                <View style={{
                  flex: 1,
                  height: 1,
                  borderTopWidth: 2,
                  borderStyle: hasArrived ? 'solid' : 'dashed',
                  borderColor: hasArrived ? '#000000' : 'rgba(0, 0, 0, 0.25)',
                  marginHorizontal: 6,
                  marginBottom: 18,
                }} />

                {/* Step 3: Service */}
                <View style={{ alignItems: 'center', width: 60 }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: hasArrived ? '#FFCC00' : '#FFFFFF',
                    borderWidth: hasArrived ? 0 : 1.5,
                    borderColor: '#000000',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="cut-outline" size={15} color="#000000" />
                  </View>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000000', marginTop: 6 }}>
                    Service
                  </Text>
                </View>
              </View>
            </View>
            </View>

            {/* 5. Arrival Check-In Action Section (Anchored to Bottom, customer-only) */}
            {isCustomerSession() && (
            <View style={{ marginTop: 'auto', paddingTop: 16 }}>
              <TouchableOpacity
                onPress={handleArrived}
                activeOpacity={0.88}
                style={{
                  backgroundColor: '#000000',
                  borderRadius: 999,
                  minHeight: 56,
                  paddingVertical: 16,
                  paddingHorizontal: 22,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 4,
                }}
              >
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="location" size={18} color="#FFFFFF" />
                </View>
                <Text style={{
                  fontSize: 15,
                  fontFamily: 'PlusJakartaSans_800ExtraBold',
                  color: '#FFFFFF',
                  letterSpacing: 0.5,
                }}>
                  {hasArrived ? '✓ ARRIVAL CONFIRMED' : 'I HAVE ARRIVED'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Helper Text */}
              <Text style={{
                fontSize: 12,
                fontFamily: 'PlusJakartaSans_500Medium',
                color: 'rgba(0, 0, 0, 0.55)',
                textAlign: 'center',
                marginTop: 10,
                marginBottom: 8,
              }}>
                Tap the button above as soon as you step inside the store.
              </Text>
            </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Screen 0 Floating Booking Button (Fresha x Apple iOS style) */}
      {currentStep === 0 && (isPro || services.length > 0) && (
        <View style={styles.floatingBottomProfileContainer}>
          <TouchableOpacity
            style={styles.btnFullYellowBook}
            onPress={() => setCurrentStep(1)}
            activeOpacity={0.85}
          >
            <Text style={styles.btnFullYellowBookText}>Book Appointment</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 7. Sticky Booking Summary (Steps 1, 2, 3 - Apple iOS Floating Sticky Bar) */}
      {currentStep > 0 && currentStep < 4 && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: 'rgba(0, 0, 0, 0.08)',
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: Platform.OS === 'ios' ? 24 : 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 5,
        }}>
          <View>
            {currentStep === 1 && (
              <>
                <Text style={{
                  fontSize: 12.5,
                  fontFamily: 'PlusJakartaSans_600SemiBold',
                  color: 'rgba(0, 0, 0, 0.55)',
                }}>
                  {selectedServices.length} service{selectedServices.length === 1 ? '' : 's'} selected
                </Text>
                <Text style={{
                  fontSize: 24,
                  fontFamily: 'PlusJakartaSans_800ExtraBold',
                  color: '#000000',
                  marginTop: 2,
                }}>
                  RM{calculateTotal().toFixed(2)}
                </Text>
              </>
            )}

            {currentStep === 2 && (
              <>
                <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(0, 0, 0, 0.55)' }}>
                  {selectedDate}
                </Text>
                <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginTop: 2 }}>
                  {selectedTime}
                </Text>
              </>
            )}

            {currentStep === 3 && (
              <>
                <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(0, 0, 0, 0.55)' }}>
                  {selectedServices.length} service • {calculateTotalDuration()} min
                </Text>
                <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginTop: 2 }}>
                  RM{calculateTotal().toFixed(2)}
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: '#000000',
              borderRadius: 999,
              minHeight: 56,
              paddingHorizontal: 26,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: (isSubmitting || (currentStep === 1 && selectedServices.length === 0) || (currentStep === 3 && !step3Ready)) ? 0.35 : 1,
            }}
            onPress={handleNextStep}
            disabled={isSubmitting || (currentStep === 1 && selectedServices.length === 0) || (currentStep === 3 && !step3Ready)}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={{
                  fontSize: 16,
                  fontFamily: 'PlusJakartaSans_800ExtraBold',
                  color: '#FFFFFF',
                }}>
                  {currentStep === 3 ? 'Confirm & Book 🚀' : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* 🕒 Weekly Operating Hours Modal */}
      <Modal
        visible={showHoursModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHoursModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropPress}
            activeOpacity={1}
            onPress={() => setShowHoursModal(false)}
          />
          <View style={[styles.loyaltyCardModalContent, themeStyles.neumorphicCard, { boxShadow: 'none', shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, elevation: 0, maxWidth: 420 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[styles.modalHeaderIconBadge, { backgroundColor: themeStyles.activeBtnBg }]}>
                  <Ionicons name="time" size={20} color={themeStyles.activeBtnText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.loyaltyModalTitle, { color: themeStyles.textPrimaryColor }]}>Operating Hours</Text>
                  <Text style={[styles.loyaltyModalSub, { color: themeStyles.textSecondaryColor }]}>{merchant?.store_name || 'Store'} Schedule</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseBtn, themeStyles.neumorphicInset]}
                onPress={() => setShowHoursModal(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={themeStyles.textPrimaryColor} />
              </TouchableOpacity>
            </View>

            {/* Current Live Status Pill */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: operatingHoursInfo.isOpen ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginVertical: 12, borderWidth: 1, borderColor: operatingHoursInfo.isOpen ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: operatingHoursInfo.isOpen ? '#10B981' : '#EF4444' }} />
                <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: operatingHoursInfo.isOpen ? '#059669' : '#DC2626' }}>
                  {operatingHoursInfo.isOpen ? 'Open Now' : 'Closed Now'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: themeStyles.textSecondaryColor }}>
                Today: {operatingHoursInfo.todayHoursText}
              </Text>
            </View>

            {/* Weekly Days List */}
            <View style={{ width: '100%', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: themeStyles.borderColor, backgroundColor: themeStyles.pillBgColor }}>
              {operatingHoursInfo.weeklySchedule.map((item, index) => {
                const isClosed = item.hours.toLowerCase().includes('closed');
                return (
                  <View
                    key={item.day}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 14,
                      paddingVertical: 11,
                      backgroundColor: item.isToday ? (isPageDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                      borderBottomWidth: index < operatingHoursInfo.weeklySchedule.length - 1 ? 1 : 0,
                      borderBottomColor: themeStyles.borderColor,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{
                        fontSize: 13,
                        fontFamily: item.isToday ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                        color: item.isToday ? (activeBrandColor || themeStyles.textPrimaryColor) : themeStyles.textPrimaryColor,
                      }}>
                        {item.day}
                      </Text>
                      {item.isToday && (
                        <View style={{ backgroundColor: activeBrandColor || '#10B981', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: themeStyles.contrastColor }}>Today</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{
                      fontSize: 13,
                      fontFamily: item.isToday ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                      color: isClosed ? '#EF4444' : (item.isToday ? themeStyles.textPrimaryColor : themeStyles.textSecondaryColor),
                    }}>
                      {item.hours}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.btnFullYellowBook, themeStyles.neumorphicActiveBtn, { marginTop: 16 }]}
              onPress={() => setShowHoursModal(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnFullYellowBookText, { color: themeStyles.activeBtnText }]}>Close Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Digital Loyalty Card Modal */}
      <Modal
        visible={showLoyaltyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLoyaltyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdropPress}
            activeOpacity={1}
            onPress={() => setShowLoyaltyModal(false)}
          />
          <View style={[styles.loyaltyCardModalContent, themeStyles.neumorphicCard, { boxShadow: 'none', shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, elevation: 0 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.modalHeaderIconBadge, { backgroundColor: themeStyles.activeBtnBg }]}>
                  <Ionicons name="ribbon" size={20} color={themeStyles.activeBtnText} />
                </View>
                <View>
                  <Text style={[styles.loyaltyModalTitle, { color: themeStyles.textPrimaryColor }]}>VIP Loyalty Stamp Card</Text>
                  <Text style={[styles.loyaltyModalSub, { color: themeStyles.textSecondaryColor }]}>{merchant?.store_name || 'Scoop Creamy'} Rewards</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.modalCloseBtn, themeStyles.neumorphicInset]}
                onPress={() => setShowLoyaltyModal(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={themeStyles.textPrimaryColor} />
              </TouchableOpacity>
            </View>

            {/* Stamp Card Digital Board */}
            <View style={[styles.loyaltyBoardCard, { backgroundColor: themeStyles.pillBgColor, borderColor: themeStyles.borderColor }]}>
              
              {/* Member Tag */}
              <View style={styles.loyaltyBoardHeader}>
                <Text style={[styles.loyaltyBoardMemberTag, { color: themeStyles.textSecondaryColor }]}>MEMBER CARD</Text>
                <Text style={[styles.loyaltyBoardCode, { color: themeStyles.priceColor }]}>#8849-RISEV</Text>
              </View>

              {/* 10 Stamps Grid (2 rows x 5 columns) */}
              <View style={styles.stampsGridContainer}>
                {Array.from({ length: totalStamps }).map((_, index) => {
                  const stampNum = index + 1;
                  const isCollected = stampNum <= stampsCount;
                  const isRewardSlot = stampNum === totalStamps;

                  return (
                    <View
                      key={stampNum}
                      style={[
                        styles.stampSlotCircle,
                        isCollected
                          ? [styles.stampSlotActive, { backgroundColor: themeStyles.activeBtnBg, borderColor: themeStyles.activeBtnBg }]
                          : [styles.stampSlotInactive, themeStyles.neumorphicInset]
                      ]}
                    >
                      {isCollected ? (
                        <Ionicons name="checkmark-sharp" size={22} color={themeStyles.activeBtnText} />
                      ) : isRewardSlot ? (
                        <Ionicons name="gift-outline" size={20} color={themeStyles.priceColor} />
                      ) : (
                        <Text style={[styles.stampSlotNumText, { color: themeStyles.textMutedColor }]}>{stampNum}</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Progress Footer */}
              <View style={styles.loyaltyBoardFooter}>
                <Ionicons name="sparkles" size={15} color={themeStyles.priceColor} />
                <Text style={[styles.loyaltyBoardProgressMsg, { color: themeStyles.textPrimaryColor }]}>
                  {stampsCount} stamps collected • {totalStamps - stampsCount} more for FREE Treat 🎉
                </Text>
              </View>
            </View>

            {/* Cashier Member Scan QR Code Box */}
            <View style={[styles.loyaltyQrBox, themeStyles.neumorphicInset]}>
              <Ionicons name="qr-code-outline" size={60} color={themeStyles.textPrimaryColor} />
              <Text style={[styles.loyaltyQrInstruction, { color: themeStyles.textSecondaryColor }]}>
                Scan QR at cashier counter to collect stamps upon checkout
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.btnFullYellowBook, themeStyles.neumorphicActiveBtn, { marginTop: 16 }]}
              onPress={() => setShowLoyaltyModal(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnFullYellowBookText, { color: themeStyles.activeBtnText }]}>Close Loyalty Card</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* 🎟️ Merchant Store Vouchers Modal (Exact Ticket Stub Design) */}
      <Modal
        visible={showVouchersModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVouchersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropPress}
            onPress={() => setShowVouchersModal(false)}
          />

          <View style={[styles.loyaltyCardModalContent, themeStyles.neumorphicCard, { boxShadow: 'none', shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, elevation: 0, maxHeight: '85%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[styles.modalHeaderIconBadge, { backgroundColor: themeStyles.activeBtnBg }]}>
                  <Ionicons name="ticket" size={20} color={themeStyles.activeBtnText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.loyaltyModalTitle, { color: themeStyles.textPrimaryColor }]}>Store Vouchers</Text>
                  <Text style={[styles.loyaltyModalSub, { color: themeStyles.textSecondaryColor }]}>{merchant?.store_name || 'Scoop Creamy'} Rewards</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseBtn, themeStyles.neumorphicInset]}
                onPress={() => setShowVouchersModal(false)}
              >
                <Ionicons name="close" size={18} color={themeStyles.textPrimaryColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', marginTop: 8 }}>
              {(() => {
                const merchantVouchersList = storeVouchers.map((v: any) => ({
                  id: v.id,
                  merchantName: merchant?.store_name || merchant?.name || 'Store',
                  logo: merchant?.logo ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}` : 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=150',
                  title: v.expand?.reward?.name || 'Store voucher',
                  subtitle: v.expand?.reward?.description || 'Loyalty reward',
                  expiry: v.expires_at
                    ? `Valid until ${new Date(String(v.expires_at).replace(' ', 'T')).toLocaleDateString('en-GB')}`
                    : 'No expiry date',
                  status: 'active',
                  serialNo: v.code ? `NO. ${v.code}` : '',
                  color: '#0F172A',
                }));

                if (merchantVouchersList.length === 0) {
                  return (
                    <View style={{ paddingVertical: 36, alignItems: 'center', gap: 8 }}>
                      <Ionicons name="ticket-outline" size={30} color={themeStyles.textSecondaryColor} />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: themeStyles.textPrimaryColor }}>
                        No vouchers available
                      </Text>
                      <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: themeStyles.textSecondaryColor, textAlign: 'center' }}>
                        Vouchers appear here once this store issues one to you.
                      </Text>
                    </View>
                  );
                }

                return merchantVouchersList.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      borderRadius: 14,
                      height: 135,
                      overflow: 'hidden',
                      backgroundColor: item.color,
                      marginBottom: 14,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                      elevation: 3,
                    }}
                  >
                    {/* Left Stub Column */}
                    <View style={{ width: 105, alignItems: 'center', justifyContent: 'center', padding: 10, gap: 4, position: 'relative', overflow: 'hidden' }}>
                      <View style={{ position: 'absolute', left: -10, top: 0, bottom: 0, width: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: 0.35, transform: [{ rotate: '90deg' }] }}>
                        <View style={{ width: 4, height: '60%', backgroundColor: '#FFFFFF', marginHorizontal: 2 }} />
                        <View style={{ width: 1, height: '60%', backgroundColor: '#FFFFFF', marginHorizontal: 1 }} />
                        <View style={{ width: 2, height: '60%', backgroundColor: '#FFFFFF', marginHorizontal: 2 }} />
                        <View style={{ width: 1, height: '60%', backgroundColor: '#FFFFFF', marginHorizontal: 1 }} />
                        <View style={{ width: 4, height: '60%', backgroundColor: '#FFFFFF', marginHorizontal: 2 }} />
                      </View>
                      <Image source={{ uri: item.logo }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', marginBottom: 2 }} />
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', textAlign: 'center' }} numberOfLines={2}>
                        {item.merchantName}
                      </Text>
                      <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
                        {item.serialNo}
                      </Text>
                    </View>

                    {/* Dotted Divider with Top/Bottom Notch Cutouts */}
                    <View style={{ width: 20, alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                      <View style={{ width: 20, height: 10, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: themeStyles.baseBgColor, position: 'absolute', top: 0, zIndex: 2 }} />
                      <View style={{ width: 1, height: '100%', borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1.5, borderStyle: 'dashed' }} />
                      <View style={{ width: 20, height: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: themeStyles.baseBgColor, position: 'absolute', bottom: 0, zIndex: 2 }} />
                    </View>

                    {/* Right Stub Column */}
                    <View style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
                      <View style={{ gap: 2 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.8)', lineHeight: 15 }} numberOfLines={2}>
                          {item.subtitle}
                        </Text>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFC700', marginTop: 4 }}>
                          {item.expiry}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={{
                          backgroundColor: '#FFFFFF',
                          height: 32,
                          borderRadius: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                          alignSelf: 'flex-start',
                          paddingHorizontal: 16,
                          marginTop: 6,
                        }}
                        onPress={() => setSelectedVoucherForQR(item)}
                        activeOpacity={0.85}
                      >
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>Use Now</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ));
              })()}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.btnFullYellowBook, themeStyles.neumorphicActiveBtn, { marginTop: 16 }]}
              onPress={() => setShowVouchersModal(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnFullYellowBookText, { color: themeStyles.activeBtnText }]}>Close Vouchers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🎫 Appointment Pass Sheet (QR + same-day check-in) */}
      <Modal
        visible={showPassSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPassSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdropPress} onPress={() => setShowPassSheet(false)} />
          <View style={[styles.loyaltyCardModalContent, {
            backgroundColor: '#FFFFFF',
            maxHeight: '92%',
            boxShadow: 'none',
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
          }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFCC00', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {merchant?.logo_url ? (
                    <Image source={{ uri: merchant.logo_url }} style={{ width: 44, height: 44 }} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111' }}>
                      {(passData.merchantName || 'Risev').slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8', letterSpacing: 1.4 }}>
                    APPOINTMENT PASS
                  </Text>
                  <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111', letterSpacing: -0.3, marginTop: 1 }} numberOfLines={1}>
                    {passData.merchantName}
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.8, marginTop: 2 }}>
                    #{passData.shortRef || 'DEMO'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.modalCloseBtn, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' }]}
                  onPress={() => setShowPassSheet(false)}
                >
                  <Ionicons name="close" size={18} color="#111111" />
                </TouchableOpacity>
              </View>

              {/* QR */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                borderWidth: 1,
                borderColor: '#F1F5F9',
                paddingVertical: 18,
                alignItems: 'center',
              }}>
                {passIsDemo ? (
                  <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="qr-code-outline" size={64} color="#CBD5E1" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94A3B8', marginTop: 8 }}>
                      Demo booking — no live pass
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(buildPassUrl(String(slug), passBookingId))}`,
                    }}
                    style={{ width: 200, height: 200 }}
                    resizeMode="contain"
                  />
                )}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 10,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}>
                  <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#64748B', letterSpacing: 1 }}>
                    PASS
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111', letterSpacing: 1.2 }}>
                    #{shortPassRef(passBookingId)}
                  </Text>
                </View>
                <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 8 }}>
                  Show this at the counter
                </Text>
              </View>

              {/* Details */}
              <View style={{ marginTop: 14, gap: 10 }}>
                {[
                  { icon: 'cut-outline', label: 'SERVICE', value: passData.serviceText },
                  { icon: 'calendar-outline', label: 'SLOT', value: `${passData.bookingDate} @ ${passData.startTime}` },
                  { icon: 'location-outline', label: 'LOCATION', value: passData.branchName },
                  { icon: 'person-outline', label: 'PROVIDER', value: passData.staffName },
                  { icon: 'cash-outline', label: 'TOTAL', value: `RM${Number(passData.total || 0).toFixed(2)}` },
                  ...(passData.customerName ? [{ icon: 'person-circle-outline', label: 'CUSTOMER', value: passData.customerName }] : []),
                ].map((row) => (
                  <View key={row.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={row.icon as any} size={15} color="#111111" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8', letterSpacing: 0.6 }}>
                        {row.label}
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#111111', marginTop: 1 }}>
                        {row.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Status */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginTop: 16,
                backgroundColor: passStatusLabel === 'CONFIRMED' ? '#FEF9C3' : '#DCFCE7',
                borderRadius: 999,
                paddingVertical: 8,
              }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: passStatusLabel === 'CONFIRMED' ? '#EAB308' : '#16A34A' }} />
                <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111', letterSpacing: 0.6 }}>
                  {passStatusLabel}
                </Text>
              </View>

              {/* Primary action */}
              <TouchableOpacity
                onPress={handleCheckIn}
                disabled={hasArrived || checkingIn || passLoading}
                activeOpacity={0.85}
                style={{
                  marginTop: 12,
                  backgroundColor: hasArrived ? '#16A34A' : '#000000',
                  borderRadius: 16,
                  paddingVertical: 15,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: checkingIn ? 0.7 : 1,
                }}
              >
                {checkingIn ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name={hasArrived ? 'checkmark-circle' : 'navigate'} size={18} color="#FFFFFF" />
                )}
                <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                  {hasArrived ? 'Arrival confirmed' : checkingIn ? 'Checking in…' : "I'm here — Check in"}
                </Text>
              </TouchableOpacity>

              {passError ? (
                <Text style={{
                  marginTop: 10,
                  fontSize: 12,
                  fontFamily: 'PlusJakartaSans_600SemiBold',
                  color: '#B91C1C',
                  textAlign: 'center',
                }}>
                  {passError}
                </Text>
              ) : null}

              {/* Save (PDF) + Share (link) */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={savePass}
                  disabled={passLoading || passIsDemo}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    backgroundColor: '#111111',
                    borderRadius: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    opacity: passLoading || passIsDemo ? 0.4 : 1,
                  }}
                >
                  <Ionicons name="download-outline" size={17} color="#FFFFFF" />
                  <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Save pass</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSharePass}
                  disabled={passLoading || passIsDemo}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: '#111111',
                    borderRadius: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    opacity: passLoading || passIsDemo ? 0.4 : 1,
                  }}
                >
                  <Ionicons name="share-outline" size={17} color="#111111" />
                  <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#111111' }}>Share pass</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 📱 Voucher QR Code Modal */}
      <Modal
        visible={!!selectedVoucherForQR}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedVoucherForQR(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {selectedVoucherForQR && (
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 330, padding: 24, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>Redeem Voucher</Text>
                <TouchableOpacity onPress={() => setSelectedVoucherForQR(null)}>
                  <Ionicons name="close" size={22} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <Image source={{ uri: selectedVoucherForQR.logo }} style={{ width: 48, height: 48, borderRadius: 24, marginBottom: 8 }} />
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', textTransform: 'uppercase' }}>{selectedVoucherForQR.merchantName}</Text>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', textAlign: 'center', marginTop: 4, marginBottom: 16 }}>{selectedVoucherForQR.title}</Text>

              <View style={{ padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', marginBottom: 16 }}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(selectedVoucherForQR.serialNo)}` }}
                  style={{ width: 170, height: 170 }}
                />
              </View>

              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 1 }}>SERIAL CODE</Text>
              <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginTop: 2, marginBottom: 12 }}>{selectedVoucherForQR.serialNo}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', textAlign: 'center' }}>Show this QR code to merchant staff at store counter to redeem your reward.</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* 🌟 GOOGLE & STORE REVIEW FUNNEL MODAL */}
      <Modal
        visible={showReviewModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.reviewModalBackdrop}>
          <BlurView intensity={85} tint="dark" style={[styles.reviewModalCard, { paddingVertical: 32 }]}>
            
            {/* Close ✕ Button */}
            <TouchableOpacity 
              style={styles.reviewCloseBtn}
              onPress={() => setShowReviewModal(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>

            {/* Store Avatar Icon & Google Badge */}
            <View style={{ position: 'relative', marginBottom: 20, zIndex: 2 }}>
              <View style={[styles.reviewAvatar, { 
                borderColor: '#334155', marginBottom: 0, width: 64, height: 64, borderRadius: 32,
                shadowColor: '#FBBC04', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 10
              }]}>
                {merchant?.logo ? (
                  <Image 
                    source={{ uri: `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}` }}
                    style={{ width: '100%', height: '100%', borderRadius: 32 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="storefront" size={30} color="#FFC700" />
                )}
              </View>
              {/* Google Badge */}
              <View style={{ 
                position: 'absolute', bottom: -4, right: -6, backgroundColor: '#FFFFFF', borderRadius: 14, 
                width: 28, height: 28, alignItems: 'center', justifyContent: 'center', 
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 5
              }}>
                <Ionicons name="logo-google" size={16} color="#4285F4" />
              </View>
            </View>

            <Text style={[styles.reviewTitle, { fontSize: 21, marginBottom: 8, paddingHorizontal: 4 }]}>
              {reviewSubmitted 
                ? 'Thank you for your review! 🎉' 
                : `How was your visit at ${merchant?.store_name || merchant?.name || 'our store'}?`}
            </Text>
            
            <Text style={[styles.reviewSubtitle, { color: '#F8FAFC', opacity: 0.85, fontSize: 13.5, lineHeight: 20, paddingHorizontal: 16 }]}>
              {reviewSubmitted 
                ? 'Your feedback helps us continuously improve our service.'
                : `Support ${merchant?.store_name || merchant?.name || 'us'} on Google with a quick rating.`}
            </Text>

            {!reviewSubmitted && (
              <>
                {/* 5-Star Rating Row */}
                <View style={[styles.reviewStarsRow, { marginTop: 16, gap: 8 }]}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => handleSelectStar(star)}
                      activeOpacity={0.6}
                      style={[styles.reviewStarBtn, { padding: 4 }]}
                    >
                      <Ionicons 
                        name="star" 
                        size={44} 
                        color={star <= reviewRating ? "#FBBC04" : "#475569"} 
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Rating Guide / Private Feedback */}
                {reviewRating > 0 && reviewRating < 5 && (
                  <View style={styles.reviewLowRatingSection}>
                    <Text style={styles.reviewFeedbackPrompt}>
                      What could we do better? (Private Feedback)
                    </Text>
                    <TextInput
                      style={styles.reviewFeedbackInput}
                      placeholder="Share your thoughts or suggestions..."
                      placeholderTextColor="#64748B"
                      multiline={true}
                      numberOfLines={3}
                      value={reviewFeedback}
                      onChangeText={setReviewFeedback}
                    />

                    <TouchableOpacity
                      style={[styles.reviewSubmitBtn, isSubmittingReview && { opacity: 0.7 }]}
                      onPress={handleSubmitPrivateFeedback}
                      disabled={isSubmittingReview}
                      activeOpacity={0.85}
                    >
                      {isSubmittingReview ? (
                        <ActivityIndicator size="small" color="#050505" />
                      ) : (
                        <Text style={styles.reviewSubmitBtnText}>Send Private Feedback</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 5-Star Note */}
                {reviewRating === 5 && (
                  <View style={[styles.review5StarRedirecting, { backgroundColor: 'rgba(251, 188, 4, 0.1)', borderColor: 'rgba(251, 188, 4, 0.25)', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }]}>
                    <ActivityIndicator size="small" color="#FBBC04" style={{ marginRight: 10 }} />
                    <Text style={[styles.review5StarText, { color: '#FBBC04' }]}>Opening Google Review...</Text>
                  </View>
                )}
              </>
            )}

            {/* Skip Option */}
            {!reviewSubmitted && reviewRating === 0 && (
              <TouchableOpacity 
                style={[styles.reviewSkipBtn, { marginTop: 8 }]} 
                onPress={() => setShowReviewModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewSkipText}>Maybe later</Text>
              </TouchableOpacity>
            )}

            {/* Done button after submission */}
            {reviewSubmitted && (
              <TouchableOpacity
                style={[styles.reviewSubmitBtn, { marginTop: 16 }]}
                onPress={() => setShowReviewModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.reviewSubmitBtnText}>Done</Text>
              </TouchableOpacity>
            )}
          </BlurView>
        </View>
      </Modal>

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
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 30,
    marginBottom: 16,
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
    alignItems: 'center',
    justifyContent: 'center',
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
  closedBadgePill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  closedBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B91C1C',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
    borderRadius: 22,
    overflow: 'hidden',
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
    alignItems: 'center',
    justifyContent: 'center',
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
    marginRight: 10,
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
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
  whiteServiceCardSelected: {
    borderColor: '#FFC700',
    backgroundColor: 'rgba(255, 199, 0, 0.15)',
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
    borderRadius: 16,
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
  allDayPastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginTop: 14,
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

  // Upcoming Appointment Ticket Stub Banner (Matching Image 2 Neumorphism)
  upcomingTicketCard: {
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  ticketNotchLeft: {
    position: 'absolute',
    left: -10,
    top: '50%',
    marginTop: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 0,
    zIndex: 10,
  },
  ticketNotchRight: {
    position: 'absolute',
    right: -10,
    top: '50%',
    marginTop: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 0,
    zIndex: 10,
  },
  ticketLeftInfoCol: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ticketIconContainer: {
    position: 'relative',
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  ticketHeaderTagline: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ticketDateMainText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    lineHeight: 18,
  },
  ticketTimeSubText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    lineHeight: 16,
  },
  ticketBranchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ticketBranchText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  ticketDashedVerticalLine: {
    width: 1,
    height: 54,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    marginHorizontal: 10,
  },
  ticketRightStubCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ticketPassChipTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  ticketPassChipText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  ticketViewPassButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 4,
  },
  ticketViewPassBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textAlign: 'center',
  },

  // Pass (Step 4) - Redesigned matching Image 2
  passHeaderNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  passNavCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passHeroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  boardingPassSubTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  calendarGraphicContainer: {
    position: 'relative',
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarGraphicSunburst: {
    position: 'absolute',
    top: -10,
    right: -4,
    zIndex: 2,
  },
  calendarGraphicCardBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FEF08A',
    shadowColor: '#FACC15',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    transform: [{ rotate: '6deg' }],
    padding: 4,
  },
  calendarGraphicTopBar: {
    height: 12,
    backgroundColor: '#FEF08A',
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  calendarRingBinding: {
    width: 4,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#EAB308',
    marginTop: -3,
  },
  calendarGraphicBody: {
    flex: 1,
    borderRadius: 6,
    marginTop: 4,
  },
  calendarGraphicBadgeCheck: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  passMainCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  passServiceSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  passServiceIconYellowBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passServiceTitleText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginTop: 1,
  },
  passCardDividerLine: {
    height: 1,
    marginVertical: 14,
  },
  passDateTimeCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  passDateColGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1.1,
  },
  passIconGreyBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passValBoldText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  passCountdownPillBox: {
    backgroundColor: '#FFFBEA',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passClockYellowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passCountdownPillLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#854D0E',
  },
  passCountdownPillVal: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
  },
  passProviderBranchSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passProviderColGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passVerticalDividerLine: {
    width: 1,
    height: 34,
    marginHorizontal: 10,
  },
  passBranchColGroup: {
    flex: 1.15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passStepperBarCard: {
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stepperItemCol: {
    alignItems: 'center',
    gap: 4,
  },
  stepperCircleCompleted: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabelCompleted: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  stepperLineTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  stepperCircleActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFC700',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  stepperLabelActive: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  stepperCircleMuted: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabelMuted: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  btnArrivedGradientTouchable: {
    borderRadius: 30,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  btnArrivedGradientContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  btnArrivedPinCircleBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnArrivedGradientTextTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  arrivedInstructionSubtext: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
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
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 2,
  },
  cellLabelText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginBottom: 2,
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
  pwaIconBoxYellow: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF9C3',
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
  btnInstallPwaYellowPill: {
    backgroundColor: '#FFC700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  btnInstallPwaTextBlack: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },

  // Floating Bottom Booking CTA (Screen 0)
  floatingBottomProfileContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 99,
  },
  btnFullYellowBook: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFullYellowBookText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
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

  // Compact Top-Right Stamp Badge Styles
  topRightStampPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    ...(Platform.OS === 'web' ? { boxShadow: 'none' } : {}),
  },
  topRightGiftBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightStampText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  loyaltyBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  loyaltyGiftBadgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyBannerSubText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  loyaltyBannerTitleText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginTop: 1,
  },
  loyaltyProgressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
    width: '92%',
  },
  loyaltyProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  loyaltyBannerRight: {
    paddingLeft: 10,
  },
  loyaltySeeStampsText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },

  // Digital Loyalty Card Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdropPress: {
    ...StyleSheet.absoluteFill,
  },
  loyaltyCardModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    padding: 20,
    zIndex: 11,
    boxShadow: 'none',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyModalTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  loyaltyModalSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyBoardCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  loyaltyBoardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  loyaltyBoardMemberTag: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 1.2,
  },
  loyaltyBoardCode: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  stampsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    marginBottom: 18,
  },
  stampSlotCircle: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampSlotActive: {
    elevation: 2,
  },
  stampSlotInactive: {
    borderWidth: 1,
  },
  stampSlotNumText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  loyaltyBoardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  loyaltyBoardProgressMsg: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
  },
  loyaltyQrBox: {
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyQrInstruction: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    marginTop: 8,
    textAlign: 'center',
  },

  // Staff Cards Carousel Styles
  staffHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  staffSectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    lineHeight: 22,
  },
  staffSectionSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    marginTop: 2,
  },
  btnSeeAllStaff: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  btnSeeAllStaffText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  staffCardsScroll: {
    paddingVertical: 8,
    marginBottom: 16,
    overflow: 'visible',
  },
  staffCardItem: {
    width: 155,
    borderRadius: 20,
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 245,
  },
  staffCardSelected: {
    borderWidth: 2,
  },
  staffCheckmarkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  anyStaffBanner: {
    width: '100%',
    height: 135,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarThumb: {
    width: '100%',
    height: 135,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  staffCardBody: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  staffCardName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textAlign: 'center',
    marginBottom: 2,
  },
  staffCardRole: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center',
    marginBottom: 6,
  },
  earliestSlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    width: '100%',
    marginTop: 4,
  },
  earliestLabelText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    lineHeight: 11,
  },
  earliestTimeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    lineHeight: 13,
  },
  nextSlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    gap: 5,
    marginTop: 4,
  },
  greenDotPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
  nextSlotText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // Google Review Funnel Modal Styles
  reviewModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 99999,
  },
  reviewModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121212',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#27272A',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
    position: 'relative',
  },
  reviewCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  reviewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#27272A',
    overflow: 'hidden',
  },
  reviewTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  reviewSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  reviewStarBtn: {
    padding: 4,
  },
  reviewLowRatingSection: {
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
  },
  reviewFeedbackPrompt: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#E2E8F0',
    marginBottom: 8,
    textAlign: 'center',
  },
  reviewFeedbackInput: {
    width: '100%',
    minHeight: 74,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  reviewSubmitBtn: {
    width: '100%',
    height: 44,
    backgroundColor: '#FFC700',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewSubmitBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  review5StarRedirecting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  review5StarText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
  },
  reviewSkipBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  reviewSkipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  walkinWelcomeBanner: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 16,
  },
  walkinWelcomeTitle: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.2,
  },
  walkinWelcomeSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    marginTop: 3,
    lineHeight: 17,
    opacity: 0.85,
  },
});

