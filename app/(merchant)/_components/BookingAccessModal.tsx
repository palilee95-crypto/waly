import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');

type BookingAccessModalProps = {
  visible: boolean;
  onClose: () => void;
  merchantName?: string;
};

export default function BookingAccessModal({ visible, onClose, merchantName }: BookingAccessModalProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Pre-launch date logic: October 10, 2026
  const isBeforeLaunch = useMemo(() => {
    return new Date() < new Date('2026-10-10T00:00:00');
  }, []);

  // Sticky slot number between 36 and 39 for maximum realistic FOMO
  const slotNumber = useMemo(() => {
    const seed = user?.id || user?.name || 'risev_merchant';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash += seed.charCodeAt(i);
    return 36 + (Math.abs(hash) % 4); // yields 36, 37, 38, or 39
  }, [user?.id, user?.name]);

  const [showEarlyAccessModal, setShowEarlyAccessModal] = useState(false);
  const [isAutoActivated, setIsAutoActivated] = useState(false);

  const handleMainAction = () => {
    if (isBeforeLaunch) {
      setShowEarlyAccessModal(true);
    } else {
      onClose();
      router.push('/(merchant)/subscription' as any);
    }
  };

  const handleAutoActivate = () => {
    setIsAutoActivated(true);
    setTimeout(() => {
      setShowEarlyAccessModal(false);
      onClose();
    }, 1800);
  };

  const store = merchantName || user?.name || 'Hashiff';

  return (
    <>
      {/* 🌟 MAIN PROMO MODAL */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />

          <View style={styles.sheet}>
            {/* Top Sheet Drag Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Close Button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Main Headline & Subtitle */}
              <View style={styles.headerTextGroup}>
                <Text style={styles.mainTitle}>
                  Smart Booking,{'\n'}built for{' '}
                  <Text style={styles.titleOrangeHighlight}>your business.</Text>
                </Text>

                <Text style={styles.subtitle}>
                  Let customers book 24/7 while Risev handles availability, reminders and scheduling automatically.
                </Text>
              </View>

              {/* Dark FOMO Launch Banner Pill (Above Hero Image) */}
              <View style={styles.fomoBannerContainer}>
                <View style={styles.fomoBannerPill}>
                  <Text style={styles.fomoBannerText}>
                    🔥 LAUNCH 10.10 &nbsp;<Text style={styles.fomoDivider}>|</Text>&nbsp; LIMITED TO FIRST{' '}
                    <Text style={styles.fomoHighlight}>50 MERCHANTS</Text>
                  </Text>
                </View>
              </View>

              {/* HERO SHOWCASE: 3D PHONE + FLOATING NOTIFICATION CARD COMPOSITE */}
              <View style={styles.heroContainer}>
                {/* Ambient Warm Halo Behind Hero */}
                <View style={styles.heroGlowHalo} />

                {/* High-Resolution 3D Composite Graphic */}
                <Image
                  source={require('@/assets/images/booking_hero_showcase.png')}
                  style={styles.heroCompositeImage}
                  resizeMode="contain"
                />
              </View>

              {/* 2x2 FEATURE BENEFIT CARDS GRID */}
              <View style={styles.featureGrid}>
                {/* Feature 1: 24/7 Online Booking */}
                <View style={styles.featureGridCard}>
                  <View style={[styles.featureIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="calendar" size={19} color="#D97706" />
                  </View>
                  <Text style={styles.featureGridTitle}>24/7 Online Booking</Text>
                  <Text style={styles.featureGridDesc}>
                    Customers book anytime, even when you're busy.
                  </Text>
                </View>

                {/* Feature 2: Staff Scheduling */}
                <View style={styles.featureGridCard}>
                  <View style={[styles.featureIconWrap, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="people" size={19} color="#16A34A" />
                  </View>
                  <Text style={styles.featureGridTitle}>Staff Scheduling</Text>
                  <Text style={styles.featureGridDesc}>
                    Show only available slots automatically.
                  </Text>
                </View>

                {/* Feature 3: Push Notifications */}
                <View style={styles.featureGridCard}>
                  <View style={[styles.featureIconWrap, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="notifications" size={19} color="#DC2626" />
                  </View>
                  <Text style={styles.featureGridTitle}>Push Notifications</Text>
                  <Text style={styles.featureGridDesc}>
                    Send reminders, booking updates & alerts instantly.
                  </Text>
                </View>

                {/* Feature 4: White-Label Page */}
                <View style={styles.featureGridCard}>
                  <View style={[styles.featureIconWrap, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="browsers-outline" size={19} color="#9333EA" />
                  </View>
                  <Text style={styles.featureGridTitle}>White-Label Page</Text>
                  <Text style={styles.featureGridDesc}>
                    Get a branded booking page with your own identity.
                  </Text>
                </View>
              </View>

              {/* 🎁 GIFT BOX PRICING OFFER CARD */}
              <View style={styles.giftOfferCard}>
                {/* Floating Gold Stamp Badge on Right */}
                <View style={styles.stampBadgePill}>
                  <Text style={styles.stampBadgeText}>Just RM2.60/day!</Text>
                </View>

                {/* Gift Box Icon Graphic */}
                <View style={styles.giftBoxIconWrap}>
                  <LinearGradient
                    colors={['#FFD700', '#F59E0B']}
                    style={styles.giftBoxGradient}
                  >
                    <Ionicons name="gift" size={26} color="#FFFFFF" />
                  </LinearGradient>
                </View>

                <View style={{ flex: 1, paddingLeft: 6 }}>
                  <Text style={styles.giftOfferTitle}>7 DAYS FREE</Text>
                  <Text style={styles.giftOfferPriceText}>
                    Then <Text style={styles.giftPriceRed}>RM2.60/day</Text> only
                  </Text>
                  <Text style={styles.giftOfferSubtext}>No charge during your trial.</Text>
                </View>
              </View>

              {/* PRIMARY CTA & FOOTER */}
              <TouchableOpacity
                style={styles.ctaButtonWrap}
                onPress={handleMainAction}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#FFB800', '#F97316', '#EF4444']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  <Ionicons name="flash" size={18} color="#FFFFFF" />
                  <Text style={styles.ctaText}>
                    {isBeforeLaunch ? 'Get Early Access ➔' : 'Start Free Trial ➔'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.noPaymentText}>
                {isBeforeLaunch ? 'Slot terhad untuk 50 kedai pertama.' : 'No payment today.'}
              </Text>

              {/* Maybe Later with flanking divider lines */}
              <View style={styles.dismissRow}>
                <View style={styles.dismissDivider} />
                <TouchableOpacity style={styles.dismissLinkBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.dismissLinkText}>Maybe Later</Text>
                </TouchableOpacity>
                <View style={styles.dismissDivider} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🏆 IMAGE NO. 1 IDENTICAL: VIP EARLY ACCESS CONFIRMATION MODAL */}
      <Modal
        visible={showEarlyAccessModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEarlyAccessModal(false)}
      >
        <View style={styles.vipOverlay}>
          <TouchableOpacity
            style={styles.overlayBg}
            activeOpacity={1}
            onPress={() => setShowEarlyAccessModal(false)}
          />

          <View style={styles.vipCard}>
            {/* 3D Gold Crown Checkmark Badge with Confetti Burst */}
            <View style={styles.celebrationGraphicContainer}>
              <View style={styles.confettiRayTopLeft}>
                <Ionicons name="sparkles" size={16} color="#F59E0B" />
              </View>
              <View style={styles.confettiRayTopRight}>
                <Ionicons name="sparkles" size={16} color="#F59E0B" />
              </View>
              <View style={styles.confettiDotLeft} />
              <View style={styles.confettiDotRight} />

              {/* Gold Crown On Top */}
              <View style={styles.floatingCrown}>
                <Ionicons name="ribbon" size={18} color="#D97706" />
              </View>

              {/* Gold Glowing Circle Badge with Checkmark */}
              <LinearGradient
                colors={['#FDE047', '#EAB308', '#CA8A04']}
                style={styles.goldMedalCircle}
              >
                <View style={styles.goldMedalInner}>
                  <Ionicons name="checkmark-sharp" size={28} color="#451A03" />
                </View>
              </LinearGradient>
            </View>

            {/* Main Title */}
            <Text style={styles.vipModalTitle}>Slot Anda Berjaya Dikunci</Text>

            {/* Diamond VIP Tag */}
            <View style={styles.vipDiamondBadge}>
              <Text style={styles.vipDiamondText}>💎 VIP EARLY ACCESS</Text>
            </View>

            {/* Subtitle */}
            <Text style={styles.vipModalSubtitle}>
              Anda kini antara 50 merchant terawal{'\n'}untuk pelancaran 10.10.
            </Text>

            {/* 🎟️ LUXURY DIGITAL VIP PASS TICKET */}
            <View style={styles.vipTicket}>
              <LinearGradient
                colors={['#1E293B', '#0F172A']}
                style={styles.vipTicketGradient}
              >
                {/* Diagonal Gold Corner Ribbon */}
                <View style={styles.diagonalRibbon}>
                  <LinearGradient
                    colors={['#FFD700', '#D97706']}
                    style={styles.ribbonGradient}
                  />
                </View>

                {/* Ticket Header Row */}
                <View style={styles.ticketHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="ribbon" size={12} color="#FBBF24" />
                    <Text style={styles.ticketProLabel}>RISEV PRO • EARLY ACCESS</Text>
                  </View>
                </View>

                {/* Big Pass Number & Locked Badge */}
                <View style={styles.ticketPassRow}>
                  <Text style={styles.ticketPassText}>
                    PASS <Text style={styles.ticketPassHighlight}>#{slotNumber} / 50</Text>
                  </Text>
                  <View style={styles.lockedBadgePill}>
                    <Ionicons name="lock-closed" size={12} color="#34D399" />
                    <Text style={styles.lockedBadgeText}>Terkunci</Text>
                  </View>
                </View>

                <View style={styles.ticketDivider} />

                {/* Kedai Info */}
                <View style={styles.ticketDetailsRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="business" size={14} color="#94A3B8" />
                    <Text style={styles.ticketLabel}>Kedai:</Text>
                  </View>
                  <Text style={styles.ticketVal} numberOfLines={1}>{store}</Text>
                </View>

                {/* Pelancaran Rasmi */}
                <View style={styles.ticketDetailsRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
                    <Text style={styles.ticketLabel}>Pelancaran Rasmi:</Text>
                  </View>
                  <Text style={styles.ticketValGold}>10 Oktober 2026 (12:00 AM)</Text>
                </View>
              </LinearGradient>
            </View>

            {/* 📊 QUOTA PROGRESS CARD */}
            <View style={styles.quotaBox}>
              <View style={styles.quotaHeaderRow}>
                <Text style={styles.quotaProgressLabel}>Kuota Diambil</Text>
                <Text style={styles.quotaNumbersText}>
                  <Text style={{ color: '#D97706', fontFamily: 'PlusJakartaSans_800ExtraBold' }}>
                    {slotNumber}
                  </Text> / 50 Kedai
                </Text>
              </View>
              <View style={styles.quotaTrack}>
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.quotaFill, { width: `${(slotNumber / 50) * 100}%` }]}
                />
              </View>
              <View style={styles.quotaWarningRow}>
                <Ionicons name="warning" size={13} color="#D97706" />
                <Text style={styles.quotaWarningText}>
                  Tinggal <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#DC2626' }}>{50 - slotNumber} slot</Text> sahaja sebelum tawaran 10.10 ditutup!
                </Text>
              </View>
            </View>

            {/* 📋 AKses Awal Anda Termasuk */}
            <View style={styles.perksCard}>
              <Text style={styles.perksCardTitle}>Akses Awal Anda Termasuk</Text>

              <View style={styles.perkRow}>
                <View style={styles.perkCheckCircle}>
                  <Ionicons name="checkmark" size={12} color="#15803D" />
                </View>
                <Text style={styles.perkText}>Percuma 7 Hari Bermula 10.10</Text>
              </View>

              <View style={styles.perkRowDivider} />

              <View style={styles.perkRow}>
                <View style={styles.perkCheckCircle}>
                  <Ionicons name="checkmark" size={12} color="#15803D" />
                </View>
                <Text style={styles.perkText}>Kunci Harga Early Bird (RM2.60/hari)</Text>
              </View>

              <View style={styles.perkRowDivider} />

              <View style={styles.perkRow}>
                <View style={styles.perkCheckCircle}>
                  <Ionicons name="checkmark" size={12} color="#15803D" />
                </View>
                <Text style={styles.perkText}>Bantuan Setup Menu & Servis Percuma</Text>
              </View>
            </View>

            {/* ⚡ PRIMARY ACTION: 1-CLICK AUTO-ACTIVATE (OPTION A) */}
            <TouchableOpacity
              style={styles.activateBtnWrap}
              onPress={handleAutoActivate}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={isAutoActivated ? ['#15803D', '#166534'] : ['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.activateGradient}
              >
                <Ionicons
                  name={isAutoActivated ? "checkmark-circle" : "flash"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.activateBtnText}>
                  {isAutoActivated ? 'Akses 10.10 Telah Diaktifkan! ✅' : 'Aktifkan Automatik Pada 10.10 ➔'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* SECONDARY ACTION: SIMPAN & TUNGGU */}
            <TouchableOpacity
              style={styles.saveWaitBtn}
              onPress={() => {
                setShowEarlyAccessModal(false);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.saveWaitText}>Simpan & Tunggu Pelancaran 10.10</Text>
            </TouchableOpacity>

            {/* FOOTER NOTE */}
            <View style={styles.vipFooterRow}>
              <View style={styles.vipFooterDivider} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people" size={12} color="#94A3B8" />
                <Text style={styles.vipFooterText}>Slot terhad untuk 50 kedai pertama.</Text>
              </View>
              <View style={styles.vipFooterDivider} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  overlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 10,
    maxHeight: '94%',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTextGroup: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  mainTitle: {
    fontSize: 27,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 33,
    marginBottom: 2,
  },
  titleOrangeHighlight: {
    color: '#F97316',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 6,
  },
  fomoBannerContainer: {
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  fomoBannerPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  fomoBannerText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  fomoDivider: {
    color: '#475569',
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  fomoHighlight: {
    color: '#FFC700',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  heroContainer: {
    position: 'relative',
    marginBottom: -42,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    zIndex: 1,
  },
  heroGlowHalo: {
    position: 'absolute',
    width: 280,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FEF08A',
    opacity: 0.35,
  },
  heroCompositeImage: {
    width: '100%',
    height: 250,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    zIndex: 10,
  },
  featureGridCard: {
    width: (width > 450 ? 450 : width - 40) / 2 - 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  featureIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureGridTitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 3,
  },
  featureGridDesc: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 14,
  },
  giftOfferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 16,
    position: 'relative',
    gap: 10,
  },
  stampBadgePill: {
    position: 'absolute',
    top: -10,
    right: 14,
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
    transform: [{ rotate: '3deg' }],
  },
  stampBadgeText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#854D0E',
  },
  giftBoxIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
  },
  giftBoxGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftOfferTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  giftOfferPriceText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 1,
  },
  giftPriceRed: {
    color: '#DC2626',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  giftOfferSubtext: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#92400E',
  },
  ctaButtonWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 6,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  ctaText: {
    fontSize: 15.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  noPaymentText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
  },
  dismissRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  dismissDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dismissLinkBtn: {
    paddingHorizontal: 8,
  },
  dismissLinkText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },

  /* 🏆 VIP EARLY ACCESS PASS MODAL STYLES (IMAGE NO. 1 IDENTICAL) */
  vipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  vipCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  celebrationGraphicContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  floatingCrown: {
    position: 'absolute',
    top: -4,
    zIndex: 10,
  },
  goldMedalCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  goldMedalInner: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiRayTopLeft: {
    position: 'absolute',
    top: 6,
    left: -4,
  },
  confettiRayTopRight: {
    position: 'absolute',
    top: 6,
    right: -4,
  },
  confettiDotLeft: {
    position: 'absolute',
    bottom: 12,
    left: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F59E0B',
  },
  confettiDotRight: {
    position: 'absolute',
    bottom: 12,
    right: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F59E0B',
  },
  vipModalTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  vipDiamondBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 6,
  },
  vipDiamondText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
    letterSpacing: 0.6,
  },
  vipModalSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
  },
  vipTicket: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    marginBottom: 12,
    position: 'relative',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  vipTicketGradient: {
    padding: 14,
    position: 'relative',
  },
  diagonalRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 48,
    height: 48,
    overflow: 'hidden',
  },
  ribbonGradient: {
    position: 'absolute',
    top: 6,
    right: -16,
    width: 60,
    height: 14,
    transform: [{ rotate: '45deg' }],
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketProLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FBBF24',
    letterSpacing: 0.6,
  },
  ticketPassRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketPassText: {
    fontSize: 19,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  ticketPassHighlight: {
    color: '#FBBF24',
  },
  lockedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5, 150, 105, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  lockedBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#34D399',
  },
  ticketDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  ticketDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ticketLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  ticketVal: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    maxWidth: '65%',
  },
  ticketValGold: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FDE047',
  },
  quotaBox: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 10,
  },
  quotaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  quotaProgressLabel: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  quotaNumbersText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
  },
  quotaTrack: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FEF3C7',
    overflow: 'hidden',
    marginBottom: 5,
  },
  quotaFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  quotaWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quotaWarningText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#78350F',
  },
  perksCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  perksCardTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 8,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  perkCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  perkRowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  activateBtnWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  activateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  activateBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  saveWaitBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveWaitText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
  },
  vipFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  vipFooterDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  vipFooterText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
});
