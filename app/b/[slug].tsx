import React, { useState, useEffect } from 'react';
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

export default function CustomerBookingPwaScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  // Wizard state (0 = Storefront Profile, 1 = Select Service, 2 = Pick Date & Time, 3 = Details, 4 = Confirmed Pass)
  const [currentStep, setCurrentStep] = useState(0);

  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);

  // Selection states
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedBranch, setSelectedBranch] = useState<BranchItem | null>(null);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('Tue, 5 Oct 2026');
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
          mRecord = await pb.collection('merchants').getFirstListItem(`pwa_slug = "${slug}"`);
        }
      } catch (slugErr) {
        try {
          if (slug) {
            mRecord = await pb.collection('merchants').getOne(slug);
          }
        } catch (idErr) {}
      }

      if (!mRecord || slug === 'scoop-creamy') {
        mRecord = {
          id: 'demo-merchant',
          store_name: 'SCOOP CREAMY',
          subtitle: 'Handcrafted Gelato • Waffles • Desserts',
          rating: '4.9',
          reviews_count: '450',
          city: 'Bangi Sentral',
          hours: '11:00 AM - 11:00 PM',
          cover_url: 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=1000&auto=format&fit=crop&q=80',
          logo_url: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=200&auto=format&fit=crop&q=80',
          pwa_brand_color: '#FFC700',
        };
      } else if (!mRecord.cover_url || mRecord.cover_url.trim().length < 5) {
        mRecord.cover_url = 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=1000&auto=format&fit=crop&q=80';
      }
      setMerchant(mRecord);

      // Fetch branches
      try {
        const bRes = await pb.collection('branches').getList(1, 10, {
          filter: `merchant = "${mRecord.id}"`
        });
        if (bRes.items.length > 0) {
          setBranches(bRes.items as any);
          setSelectedBranch(bRes.items[0] as any);
        } else {
          setBranches([
            { id: 'b-1', name: 'Bangi Sentral Main Outlet', address: 'Jalan Medan Pusat 2d, Seksyen 9, Bandar Baru Bangi' },
            { id: 'b-2', name: 'Shah Alam Outlet', address: 'Jalan Plumbum 7/95, Seksyen 7, Shah Alam' }
          ]);
          setSelectedBranch({ id: 'b-1', name: 'Bangi Sentral Main Outlet', address: 'Jalan Medan Pusat 2d, Seksyen 9, Bandar Baru Bangi' });
        }
      } catch (bErr) {
        setBranches([
          { id: 'b-1', name: 'Bangi Sentral Main Outlet', address: 'Jalan Medan Pusat 2d, Seksyen 9, Bandar Baru Bangi' }
        ]);
        setSelectedBranch({ id: 'b-1', name: 'Bangi Sentral Main Outlet' });
      }

      // Fetch services
      try {
        const sRes = await pb.collection('merchant_services').getList(1, 20, {
          filter: `merchant = "${mRecord.id}" && is_active = true`
        });
        if (sRes.items.length > 0) {
          setServices(sRes.items as any);
          setSelectedServices([sRes.items[0] as any]);
        } else {
          const defaultServices: ServiceItem[] = [
            {
              id: 's-1',
              name: 'Strawberry Gelato',
              category: 'Gelato Scoops',
              description: 'Fresh strawberry scoop made with wild berries & organic milk',
              price: 16,
              duration_minutes: 5,
              image_url: 'https://images.unsplash.com/photo-1557142046-c704a3adf364?w=400&auto=format&fit=crop&q=80',
              item_type: 'service'
            },
            {
              id: 's-2',
              name: 'Cookies & Cream',
              category: 'Gelato Scoops',
              description: 'Creamy Madagascar vanilla folded with crunchy Oreo cookies',
              price: 16,
              duration_minutes: 5,
              image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&auto=format&fit=crop&q=80',
              item_type: 'service'
            },
            {
              id: 's-3',
              name: 'Belgian Chocolate',
              category: 'Gelato Scoops',
              description: '70% dark Belgian cocoa gelato topped with chocolate fudge sauce',
              price: 18,
              duration_minutes: 5,
              image_url: 'https://images.unsplash.com/photo-1580915411954-282cb1b0d780?w=400&auto=format&fit=crop&q=80',
              item_type: 'service'
            },
            {
              id: 's-4',
              name: 'Signature Belgian Waffle with Gelato',
              category: 'Waffles & Pastries',
              description: 'Freshly baked Belgian waffle topped with 1 gelato scoop & maple syrup',
              price: 24,
              duration_minutes: 15,
              image_url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=400&auto=format&fit=crop&q=80',
              item_type: 'service'
            },
            {
              id: 's-5',
              name: 'Affogato Espresso Delight',
              category: 'Beverages',
              description: 'Double shot hot espresso poured over vanilla gelato scoop',
              price: 14,
              duration_minutes: 10,
              image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&auto=format&fit=crop&q=80',
              item_type: 'service'
            }
          ];
          setServices(defaultServices);
          setSelectedServices([defaultServices[0]]);
        }
      } catch (sErr) {
        setServices([
          {
            id: 's-1',
            name: 'Double Scoop Artisanal Gelato',
            category: 'Gelato Scoops',
            description: 'Choose 2 flavors of fresh handcrafted gelato with waffle cone',
            price: 18,
            duration_minutes: 10,
            image_url: 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=300&auto=format&fit=crop&q=80',
            item_type: 'service'
          }
        ]);
        setSelectedServices([{
          id: 's-1',
          name: 'Double Scoop Artisanal Gelato',
          price: 18,
          duration_minutes: 10,
          item_type: 'service'
        }]);
      }

      // Fetch staff
      try {
        const stRes = await pb.collection('merchant_staff').getList(1, 10, {
          filter: `merchant = "${mRecord.id}" && is_active = true`
        });
        if (stRes.items.length > 0) {
          setStaffList([
            { id: 'any', name: 'Any Provider', role_title: 'First Available Slot' },
            ...(stRes.items as any)
          ]);
          setSelectedStaff({ id: 'any', name: 'Any Provider', role_title: 'First Available Slot' });
        } else {
          setStaffList([
            { id: 'any', name: 'Any Staff', role_title: 'First Available Slot' },
            { id: 'st-1', name: 'Chef Marco', role_title: 'Master Gelatieri' },
            { id: 'st-2', name: 'Aina Rose', role_title: 'Pastry & Dessert Specialist' }
          ]);
          setSelectedStaff({ id: 'any', name: 'Any Staff' });
        }
      } catch (stErr) {
        setStaffList([
          { id: 'any', name: 'Any Provider', role_title: 'First Available Slot' }
        ]);
        setSelectedStaff({ id: 'any', name: 'Any Provider' });
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
          branch: selectedBranch?.id,
          staff: selectedStaff?.id !== 'any' ? selectedStaff?.id : null,
          customer_name: customerName,
          customer_phone: customerPhone,
          booking_date: new Date().toISOString().split('T')[0],
          start_time: selectedTime,
          total_price: totalPrice,
          items_summary: selectedServices.map(s => ({ name: s.name, price: s.price })),
          notes: customerNotes,
          status: 'booked'
        };

        let newRec: any = null;
        if (merchant?.id && !merchant.id.startsWith('demo-')) {
          try {
            newRec = await pb.collection('service_bookings').create(bookingPayload);
          } catch (pbErr) {
            console.warn('Booking create err:', pbErr);
          }
        }

        setCreatedBooking(newRec || {
          id: `BK-${Math.floor(100000 + Math.random() * 900000)}`,
          ...bookingPayload
        });

        showToast('Booking Confirmed! 🎉');
        setCurrentStep(4);
      } catch (err) {
        Alert.alert('Error', 'Failed to process booking. Please try again.');
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

  const filteredServices = activeCategory === 'All'
    ? services
    : services.filter(s => s.category?.toLowerCase() === activeCategory.toLowerCase());

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      
      {/* Toast Overlay */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Top Header Bar for Steps 1, 2, 3 */}
      {currentStep > 0 && currentStep < 4 && (
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={handlePrevStep} style={styles.btnHeaderBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currentStep === 1 && 'Select Service'}
            {currentStep === 2 && 'Schedule Appointment'}
            {currentStep === 3 && 'Your Details'}
          </Text>
          <Text style={styles.stepBadgeText}>Step {currentStep} of 3</Text>
        </View>
      )}

      {/* Main Body Scroll */}
      <ScrollView style={styles.mainScroll} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* ======================================================== */}
        {/* SCREEN 0: STOREFRONT BUSINESS PROFILE LANDING            */}
        {/* ======================================================== */}
        {currentStep === 0 && (
          <View style={styles.profileContainer}>
            
            {/* Hero Cover Header */}
            <View style={styles.coverWrapper}>
              <Image
                source={{
                  uri: (merchant?.cover_url && merchant.cover_url.startsWith('http'))
                    ? merchant.cover_url
                    : 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?w=1000&auto=format&fit=crop&q=80'
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

            {/* Brand Card Info with Warm Background & Organic Blob */}
            <View style={styles.brandInfoCard}>
              
              {/* Store Title & Subtitle */}
              <Text style={styles.brandNameText}>{merchant?.store_name || 'SCOOP CREAMY'}</Text>
              <Text style={styles.brandSubtitleText}>{merchant?.subtitle || 'Handcrafted Gelato • Waffles • Desserts'}</Text>

              {/* Soft Golden Rating Pill Capsule */}
              <View style={styles.ratingCapsulePill}>
                <Ionicons name="star" size={24} color="#FFC700" />
                <Text style={styles.ratingCapsuleNum}>4.9</Text>
                <Text style={styles.ratingCapsuleRev}>(450 reviews)</Text>
              </View>

              {/* Split Meta Location & Operating Hours */}
              <View style={styles.splitMetaRow}>
                {/* Left Location Column */}
                <View style={styles.splitMetaCol}>
                  <View style={styles.iconCircleBg}>
                    <Ionicons name="location-outline" size={20} color="#0F172A" />
                  </View>
                  <Text style={styles.locationBoldText}>Bangi Sentral</Text>
                </View>

                {/* Vertical Divider Line */}
                <View style={styles.pipeDivider} />

                {/* Right Hours Column */}
                <View style={styles.splitMetaCol}>
                  <View style={styles.iconCircleBg}>
                    <Ionicons name="time-outline" size={20} color="#0F172A" />
                  </View>
                  <View style={{ flexDirection: 'column' }}>
                    <View style={styles.openBadgePill}>
                      <Text style={styles.openBadgeText}>Open</Text>
                    </View>
                    <Text style={styles.hoursSubText}>11:00 AM – 11:00 PM</Text>
                  </View>
                </View>
              </View>

              {/* Horizontal Divider Line */}
              <View style={styles.headerHorizontalDivider} />

              {/* Quick Action Navigation Bar */}
              <View style={styles.quickNavStrip}>
                <TouchableOpacity style={styles.quickNavItem} onPress={() => setCurrentStep(1)} activeOpacity={0.8}>
                  <View style={[styles.quickNavCircle, styles.quickNavCircleActive]}>
                    <Ionicons name="calendar" size={22} color="#0F172A" />
                  </View>
                  <Text style={styles.quickNavTitleActive}>Book{'\n'}Appointment</Text>
                  <View style={styles.activeTabIndicatorLine} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickNavItem} onPress={() => setCurrentStep(1)} activeOpacity={0.8}>
                  <View style={styles.quickNavCircle}>
                    <Ionicons name="list-outline" size={22} color="#0F172A" />
                  </View>
                  <Text style={styles.quickNavTitle}>Menu</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickNavItem} onPress={() => showToast('Promotions: Buy 2 Scoops Get 1 Waffle 20% Off! 🍦')} activeOpacity={0.8}>
                  <View style={styles.quickNavCircle}>
                    <Ionicons name="pricetag-outline" size={22} color="#0F172A" />
                  </View>
                  <Text style={styles.quickNavTitle}>Promotions</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickNavItem} onPress={() => showToast('📍 Main Outlet: Bangi Sentral Seksyen 9')} activeOpacity={0.8}>
                  <View style={styles.quickNavCircle}>
                    <Ionicons name="location-outline" size={22} color="#0F172A" />
                  </View>
                  <Text style={styles.quickNavTitle}>Location</Text>
                </TouchableOpacity>
              </View>

            </View>

            {/* Popular Items Horizontal Grid / Carousel */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingTitle}>Popular Items</Text>
              <TouchableOpacity onPress={() => setCurrentStep(1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.seeAllText}>See all</Text>
                <Ionicons name="arrow-forward" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularCarouselScroll}>
              {services.slice(0, 5).map(srv => {
                const isSelected = selectedServices.some(s => s.id === srv.id);
                return (
                  <View key={srv.id} style={styles.popularCardItem}>
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
                      <Text style={styles.popularCardName} numberOfLines={1}>{srv.name}</Text>

                      <View style={styles.popularCardBottomRow}>
                        <Text style={styles.popularCardPrice}>RM{srv.price}</Text>

                        <TouchableOpacity
                          style={[styles.popularAddCircleBtn, isSelected && styles.popularAddCircleBtnSelected]}
                          onPress={() => toggleServiceSelection(srv)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={isSelected ? "checkmark" : "add"}
                            size={20}
                            color={isSelected ? "#000000" : "#D97706"}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 1: CHOOSE SERVICE (STEP 1 OF 3)                    */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <View style={styles.stepContainer}>
            
            {/* Horizontal Category Strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {['All', 'Gelato Scoops', 'Waffles & Pastries', 'Beverages'].map(cat => {
                const isActive = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChipPill, isActive && styles.categoryChipPillActive]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Service Cards List */}
            <View style={styles.serviceCardsContainer}>
              {filteredServices.map(srv => {
                const isSelected = selectedServices.some(item => item.id === srv.id);
                return (
                  <TouchableOpacity
                    key={srv.id}
                    style={[styles.whiteServiceCard, isSelected && styles.whiteServiceCardSelected]}
                    onPress={() => toggleServiceSelection(srv)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: srv.image_url || 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=300&auto=format&fit=crop&q=80' }}
                      style={styles.servicePhotoThumb}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.whiteServiceTitle}>{srv.name}</Text>
                      {srv.description && (
                        <Text style={styles.whiteServiceSub} numberOfLines={1}>
                          {srv.description}
                        </Text>
                      )}
                      <View style={styles.whiteServiceMetaRow}>
                        <Ionicons name="time-outline" size={13} color="#64748B" />
                        <Text style={styles.whiteServiceDuration}>{srv.duration_minutes} min</Text>
                        <Text style={styles.whiteServicePrice}>RM{srv.price}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.circleAddBtn, isSelected && styles.circleAddBtnSelected]}
                      onPress={() => toggleServiceSelection(srv)}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark' : 'add'}
                        size={20}
                        color={isSelected ? '#FFFFFF' : '#000000'}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 2: PICK DATE & TIME (STEP 2 OF 3)                 */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            
            {/* Branch Selector Dropdown Box */}
            <View style={styles.dropdownCardBox}>
              <Ionicons name="location-outline" size={18} color="#0F172A" />
              <Text style={styles.dropdownTextValue}>{selectedBranch?.name || 'Bangi Sentral'}</Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </View>

            {/* Provider Selector Dropdown Box */}
            <View style={styles.dropdownCardBox}>
              <Ionicons name="person-outline" size={18} color="#0F172A" />
              <Text style={styles.dropdownTextValue}>{selectedStaff?.name || 'Any Provider'}</Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </View>

            {/* Date Picker Header */}
            <View style={styles.datePickerHeaderRow}>
              <Text style={styles.dateGroupTitle}>Select Date</Text>
              <Text style={styles.monthYearTitle}>October 2026</Text>
            </View>

            {/* Horizontal Day Selector Strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {[
                { day: 'Sun', num: '3' },
                { day: 'Mon', num: '4' },
                { day: 'Tue', num: '5', active: true },
                { day: 'Wed', num: '6' },
                { day: 'Thu', num: '7' },
                { day: 'Fri', num: '8' },
                { day: 'Sat', num: '9' },
              ].map(dt => {
                const dateFull = `${dt.day}, ${dt.num} Oct 2026`;
                const isSelected = selectedDate.includes(`${dt.num} Oct`);
                return (
                  <TouchableOpacity
                    key={dt.num}
                    style={[styles.dayColumnCard, isSelected && styles.dayColumnCardActive]}
                    onPress={() => setSelectedDate(dateFull)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.dayNameText, isSelected && styles.dayNameTextActive]}>{dt.day}</Text>
                    <Text style={[styles.dayNumText, isSelected && styles.dayNumTextActive]}>{dt.num}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time Period Filter Segment */}
            <Text style={styles.dateGroupTitle}>Select Time</Text>
            <View style={styles.periodSegmentTrack}>
              {(['Morning', 'Afternoon', 'Evening'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodSegmentPill, selectedTimePeriod === p && styles.periodSegmentPillActive]}
                  onPress={() => setSelectedTimePeriod(p)}
                >
                  <Text style={[styles.periodSegmentText, selectedTimePeriod === p && styles.periodSegmentTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 3-Column Time Slot Grid */}
            <View style={styles.timeSlotsGrid}>
              {[
                '09:00 AM', '09:30 AM', '10:00 AM',
                '10:30 AM', '11:00 AM', '11:30 AM',
                '12:00 PM', '12:30 PM', '01:00 PM',
                '01:30 PM', '02:00 PM', '02:30 PM'
              ].map(tm => {
                const isSelected = selectedTime === tm;
                return (
                  <TouchableOpacity
                    key={tm}
                    style={[styles.timeSlotGridPill, isSelected && styles.timeSlotGridPillActive]}
                    onPress={() => setSelectedTime(tm)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.timeSlotGridText, isSelected && styles.timeSlotGridTextActive]}>
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
              <Text style={styles.inputFieldLabel}>Full Name</Text>
              <View style={styles.inputWithIconBox}>
                <Ionicons name="person-outline" size={18} color="#64748B" />
                <TextInput
                  style={styles.inputTextInner}
                  placeholder="Hafiz Danial"
                  placeholderTextColor="#94A3B8"
                  value={customerName}
                  onChangeText={setCustomerName}
                />
              </View>
            </View>

            <View style={styles.inputFieldGroup}>
              <Text style={styles.inputFieldLabel}>WhatsApp Number</Text>
              <View style={styles.inputWithIconBox}>
                <Ionicons name="logo-whatsapp" size={18} color="#64748B" />
                <TextInput
                  style={styles.inputTextInner}
                  placeholder="0123456789"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                />
              </View>
            </View>

            <View style={styles.inputFieldGroup}>
              <Text style={styles.inputFieldLabel}>Add Note (Optional)</Text>
              <View style={styles.inputWithIconBox}>
                <Ionicons name="chatbox-outline" size={18} color="#64748B" />
                <TextInput
                  style={styles.inputTextInner}
                  placeholder="Any special request?"
                  placeholderTextColor="#94A3B8"
                  value={customerNotes}
                  onChangeText={setCustomerNotes}
                />
              </View>
            </View>

            {/* Selection Summary Box */}
            <View style={styles.summaryRecapCard}>
              <Text style={styles.summaryRecapTitle}>Booking Details</Text>
              <View style={styles.recapItemRow}>
                <Text style={styles.recapItemLabel}>Services:</Text>
                <Text style={styles.recapItemVal}>{selectedServices.map(s => s.name).join(', ')}</Text>
              </View>
              <View style={styles.recapItemRow}>
                <Text style={styles.recapItemLabel}>Branch:</Text>
                <Text style={styles.recapItemVal}>{selectedBranch?.name || 'Bangi Sentral'}</Text>
              </View>
              <View style={styles.recapItemRow}>
                <Text style={styles.recapItemLabel}>Provider:</Text>
                <Text style={styles.recapItemVal}>{selectedStaff?.name || 'Any Provider'}</Text>
              </View>
              <View style={styles.recapItemRow}>
                <Text style={styles.recapItemLabel}>Date & Time:</Text>
                <Text style={styles.recapItemVal}>{selectedDate} @ {selectedTime}</Text>
              </View>
            </View>

          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 4: DIGITAL PASS & CONFIRMATION                     */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <View style={styles.stepContainer}>
            <View style={styles.ticketCardBoarding}>
              <View style={styles.ticketGreenBadge}>
                <View style={styles.pulseDotGreen} />
                <Text style={styles.ticketBadgeGreenText}>BOOKING CONFIRMED</Text>
              </View>

              <Text style={styles.boardingPassTitle}>Appointment Pass</Text>

              <View style={styles.timerCountdownCard}>
                <Text style={styles.timerSubText}>Your appointment starts in:</Text>
                <Text style={styles.timerMainText}>24 Mins 30 Secs</Text>
              </View>

              <View style={styles.boardingInfoGrid}>
                <View style={styles.boardingGridCell}>
                  <Text style={styles.cellLabelText}>Service</Text>
                  <Text style={styles.cellValueText}>{selectedServices[0]?.name || 'Signature Massage'}</Text>
                </View>
                <View style={styles.boardingGridCell}>
                  <Text style={styles.cellLabelText}>Provider</Text>
                  <Text style={[styles.cellValueText, { color: '#0F172A' }]}>{selectedStaff?.name || 'Any Provider'}</Text>
                </View>
                <View style={styles.boardingGridCell}>
                  <Text style={styles.cellLabelText}>Slot Time</Text>
                  <Text style={[styles.cellValueText, { color: '#0F172A' }]}>{selectedDate} @ {selectedTime}</Text>
                </View>
                <View style={styles.boardingGridCell}>
                  <Text style={styles.cellLabelText}>Branch</Text>
                  <Text style={styles.cellValueText}>{selectedBranch?.name || 'Bangi Sentral'}</Text>
                </View>
              </View>

              <Text style={styles.arrivedInstructionText}>
                Tap the button below as soon as you step inside the store:
              </Text>

              <TouchableOpacity
                style={[styles.btnArrivedAction, hasArrived && { backgroundColor: '#22C55E' }]}
                onPress={handleArrived}
                activeOpacity={0.85}
              >
                <Ionicons name="location" size={18} color={hasArrived ? '#FFFFFF' : '#000000'} />
                <Text style={[styles.btnArrivedTextLabel, hasArrived && { color: '#FFFFFF' }]}>
                  {hasArrived ? '✓ ARRIVAL CONFIRMED' : '📍 I HAVE ARRIVED'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* PWA Save App Card */}
            <View style={styles.pwaCardBox}>
              <View style={styles.pwaIconBox}>
                <Ionicons name="phone-portrait-outline" size={22} color="#FFC700" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pwaTitleText}>Save {merchant?.store_name || 'Aura Wellness'} App</Text>
                <Text style={styles.pwaSubText}>Get instant slot reminders & fast re-booking</Text>
              </View>
              <TouchableOpacity
                style={styles.btnInstallPwa}
                onPress={() => showToast('Tap Share ➔ Add to Home Screen')}
                activeOpacity={0.8}
              >
                <Text style={styles.btnInstallPwaText}>Install</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Screen 0 Floating Yellow Button */}
      {currentStep === 0 && (
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

      {/* Sticky Dark Action Bar (Steps 1, 2, 3) */}
      {currentStep > 0 && currentStep < 4 && (
        <View style={styles.stickyDarkBar}>
          <View>
            {currentStep === 1 && (
              <>
                <Text style={styles.darkBarMetaLabel}>{selectedServices.length} service{selectedServices.length > 1 ? 's' : ''}</Text>
                <Text style={styles.darkBarPriceTotal}>RM {calculateTotal().toFixed(2)}</Text>
              </>
            )}

            {currentStep === 2 && (
              <>
                <Text style={styles.darkBarMetaLabel}>{selectedDate}</Text>
                <Text style={styles.darkBarPriceTotal}>{selectedTime}</Text>
              </>
            )}

            {currentStep === 3 && (
              <>
                <Text style={styles.darkBarPriceTotal}>RM {calculateTotal().toFixed(2)}</Text>
                <Text style={styles.darkBarMetaLabel}>{selectedServices.length} service • {calculateTotalDuration()} min</Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.btnYellowContinue}
            onPress={handleNextStep}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.btnYellowContinueText}>
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
    shadowColor: '#D3CBBD',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
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
