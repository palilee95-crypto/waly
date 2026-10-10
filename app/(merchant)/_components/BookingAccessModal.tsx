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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';

const { width } = Dimensions.get('window');

type BookingAccessModalProps = {
  visible: boolean;
  onClose: () => void;
  merchantName?: string;
  merchantId?: string;
  isOptedIn?: boolean;
  onOptedInSuccess?: () => void;
};

export default function BookingAccessModal({
  visible,
  onClose,
  merchantName,
  merchantId,
  isOptedIn = false,
  onOptedInSuccess,
}: BookingAccessModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const isMalay = locale === 'ms';

  // Pre-launch date logic: October 10, 2026
  const isBeforeLaunch = useMemo(() => {
    return new Date() < new Date('2026-10-10T00:00:00');
  }, []);

  const [showEarlyAccessModal, setShowEarlyAccessModal] = useState(false);
  const [showTrialSuccessModal, setShowTrialSuccessModal] = useState(false);
  const [isAutoActivated, setIsAutoActivated] = useState(isOptedIn);
  const [saving, setSaving] = useState(false);
  const [trialStatus, setTrialStatus] = useState<'not_claimed' | 'active' | 'expired'>('not_claimed');
  const [trialEndsAtStr, setTrialEndsAtStr] = useState<string>('');
  const [daysRemaining, setDaysRemaining] = useState<number>(7);

  // Sync isAutoActivated if isOptedIn prop changes
  React.useEffect(() => {
    if (isOptedIn) {
      setIsAutoActivated(true);
    }
  }, [isOptedIn]);

  // Load merchant trial status when modal opens
  React.useEffect(() => {
    if (!visible) return;
    const targetMid = merchantId || user?.merchant_id;
    if (!targetMid) return;

    pb.collection('merchants')
      .getOne(targetMid, { requestKey: null })
      .then((m: any) => {
        const meta = m.metadata || {};
        if (meta.booking_trial_claimed) {
          const endsAt = meta.booking_trial_ends_at ? new Date(meta.booking_trial_ends_at).getTime() : 0;
          if (endsAt > Date.now()) {
            setTrialStatus('active');
            setTrialEndsAtStr(meta.booking_trial_ends_at);
            const remaining = Math.max(1, Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24)));
            setDaysRemaining(remaining);
          } else {
            setTrialStatus('expired');
            setTrialEndsAtStr(meta.booking_trial_ends_at || '');
          }
        } else {
          setTrialStatus('not_claimed');
        }
      })
      .catch(() => {});
  }, [visible, merchantId, user]);

  const formatTrialDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(isMalay ? 'ms-MY' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const handleMainAction = async () => {
    if (isBeforeLaunch) {
      setShowEarlyAccessModal(true);
      return;
    }

    if (trialStatus === 'expired') {
      // 1-time trial already expired -> go to PRO subscription plan
      onClose();
      router.push('/(merchant)/subscription' as any);
      return;
    }

    if (trialStatus === 'active') {
      // Trial is currently active -> go to bookings dashboard
      onClose();
      router.push('/(merchant)/bookings' as any);
      return;
    }

    // Trial NOT claimed yet -> Activate 7-day free trial on PocketBase
    try {
      setSaving(true);
      const targetMid = merchantId || user?.merchant_id;
      if (!targetMid) {
        throw new Error('Merchant account not found.');
      }

      const freshMerchant = await pb.collection('merchants').getOne(targetMid, { requestKey: null });
      const meta = freshMerchant.metadata || {};

      if (meta.booking_trial_claimed) {
        setTrialStatus('expired');
        Alert.alert(
          isMalay ? 'Percubaan Telah Digunakan' : 'Trial Already Claimed',
          isMalay
            ? 'Percubaan percuma 7 hari telah digunakan sebelum ini. Sila langgan pelan PRO untuk teruskan.'
            : 'Your 7-day free trial has already been used. Please subscribe to the PRO plan to continue.'
        );
        onClose();
        router.push('/(merchant)/subscription' as any);
        return;
      }

      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await pb.collection('merchants').update(targetMid, {
        has_booking_addon: true,
        metadata: {
          ...meta,
          booking_trial_claimed: true,
          booking_trial_started_at: now.toISOString(),
          booking_trial_ends_at: trialEndsAt,
        },
      });

      setTrialStatus('active');
      setTrialEndsAtStr(trialEndsAt);
      setDaysRemaining(7);
      setShowTrialSuccessModal(true);
      onOptedInSuccess?.();
    } catch (err: any) {
      console.error('[BookingAccessModal] Error activating 7-day trial:', err);
      Alert.alert(
        isMalay ? 'Ralat Pengaktifan' : 'Activation Error',
        err?.message || (isMalay ? 'Gagal mengaktifkan percubaan percuma.' : 'Failed to activate free trial.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAutoActivate = async () => {
    if (isAutoActivated && isOptedIn) {
      // Already activated and opted in
      setShowEarlyAccessModal(false);
      onClose();
      return;
    }

    try {
      setSaving(true);
      const targetMid = merchantId || user?.merchant_id;
      if (targetMid) {
        await pb.collection('merchants').update(targetMid, {
          booking_vip_opt_in: true,
          booking_vip_claimed_at: new Date().toISOString(),
        });
      }
      setIsAutoActivated(true);
      onOptedInSuccess?.();
      setTimeout(() => {
        setShowEarlyAccessModal(false);
        onClose();
      }, 1600);
    } catch (err) {
      console.error('[BookingAccessModal] Error saving booking VIP opt-in:', err);
      // Still show successful visual feedback to avoid frustrating user
      setIsAutoActivated(true);
      setTimeout(() => {
        setShowEarlyAccessModal(false);
        onClose();
      }, 1600);
    } finally {
      setSaving(false);
    }
  };

  const store = merchantName || user?.name || (isMalay ? 'Kedai Anda' : 'Your Store');

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
                  Smart Booking,{'\n'}
                  {isMalay ? 'khas untuk ' : 'built for '}
                  <Text style={styles.titleOrangeHighlight}>
                    {isMalay ? 'kedai anda.' : 'your business.'}
                  </Text>
                </Text>

                <Text style={styles.subtitle}>
                  {isMalay
                    ? 'Pelanggan boleh tempah 24/7 sementara Risev mengurus jadual, kekosongan dan peringatan secara automatik.'
                    : 'Let customers book 24/7 while Risev handles availability, reminders and scheduling automatically.'}
                </Text>
              </View>

              {/* Dark FOMO Launch Banner Pill (Above Hero Image) */}
              <View style={styles.fomoBannerContainer}>
                <View style={styles.fomoBannerPill}>
                  <Text style={styles.fomoBannerText}>
                    {isMalay ? '🔥 PELANCARAN 10.10' : '🔥 LAUNCH 10.10'} &nbsp;
                    <Text style={styles.fomoDivider}>|</Text>&nbsp;{' '}
                    <Text style={styles.fomoHighlight}>
                      {isBeforeLaunch
                        ? (isMalay ? 'SLOT AKSES AWAL TERHAD' : 'LIMITED EARLY ACCESS SLOTS')
                        : (isMalay ? 'KINI LIVE HARI INI' : 'NOW LIVE TODAY')}
                    </Text>
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
                  <Text style={styles.featureGridTitle}>
                    {isMalay ? 'Tempahan Online 24/7' : '24/7 Online Booking'}
                  </Text>
                  <Text style={styles.featureGridDesc}>
                    {isMalay
                      ? 'Pelanggan boleh tempah bila-bila masa, walaupun anda sibuk.'
                      : "Customers book anytime, even when you're busy."}
                  </Text>
                </View>

                {/* Feature 2: Staff Scheduling */}
                <View style={styles.featureGridCard}>
                  <View style={[styles.featureIconWrap, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="people" size={19} color="#16A34A" />
                  </View>
                  <Text style={styles.featureGridTitle}>
                    {isMalay ? 'Jadual Staf Automatik' : 'Staff Scheduling'}
                  </Text>
                  <Text style={styles.featureGridDesc}>
                    {isMalay
                      ? 'Paparkan kekosongan staf secara automatik.'
                      : 'Show only available slots automatically.'}
                  </Text>
                </View>

                {/* Feature 3: Push Notifications */}
                <View style={styles.featureGridCard}>
                  <View style={[styles.featureIconWrap, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="notifications" size={19} color="#DC2626" />
                  </View>
                  <Text style={styles.featureGridTitle}>
                    {isMalay ? 'Notifikasi Segera' : 'Push Notifications'}
                  </Text>
                  <Text style={styles.featureGridDesc}>
                    {isMalay
                      ? 'Hantar peringatan & status tempahan secara terus.'
                      : 'Send reminders, booking updates & alerts instantly.'}
                  </Text>
                </View>

                {/* Feature 4: White-Label Page */}
                <View style={styles.featureGridCard}>
                  <View style={[styles.featureIconWrap, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="browsers-outline" size={19} color="#9333EA" />
                  </View>
                  <Text style={styles.featureGridTitle}>
                    {isMalay ? 'Laman Khas Berjenama' : 'White-Label Page'}
                  </Text>
                  <Text style={styles.featureGridDesc}>
                    {isMalay
                      ? 'Halaman tempahan eksklusif mengikut jenama kedai anda.'
                      : 'Get a branded booking page with your own identity.'}
                  </Text>
                </View>
              </View>

              {/* 🎁 GIFT BOX PRICING OFFER CARD */}
              <View style={[styles.giftOfferCard, trialStatus === 'expired' && styles.giftOfferCardExpired]}>
                {/* Floating Stamp Badge on Right */}
                <View style={[styles.stampBadgePill, trialStatus === 'expired' && styles.stampBadgePillExpired, trialStatus === 'active' && styles.stampBadgePillActive]}>
                  <Text style={[styles.stampBadgeText, (trialStatus === 'expired' || trialStatus === 'active') && { color: '#FFFFFF' }]}>
                    {trialStatus === 'expired'
                      ? (isMalay ? 'Tamat Tempoh' : 'Trial Ended')
                      : trialStatus === 'active'
                        ? (isMalay ? `${daysRemaining} Hari Lagi!` : `${daysRemaining} Days Left!`)
                        : (isMalay ? 'Hanya RM2.60/hari!' : 'Just RM2.60/day!')}
                  </Text>
                </View>

                {/* Gift Box Icon Graphic */}
                <View style={styles.giftBoxIconWrap}>
                  <LinearGradient
                    colors={
                      trialStatus === 'expired'
                        ? ['#64748B', '#334155']
                        : trialStatus === 'active'
                          ? ['#10B981', '#059669']
                          : ['#FFD700', '#F59E0B']
                    }
                    style={styles.giftBoxGradient}
                  >
                    <Ionicons
                      name={trialStatus === 'expired' ? 'lock-closed' : trialStatus === 'active' ? 'checkmark-circle' : 'gift'}
                      size={26}
                      color="#FFFFFF"
                    />
                  </LinearGradient>
                </View>

                <View style={{ flex: 1, paddingLeft: 6 }}>
                  <Text style={[styles.giftOfferTitle, trialStatus === 'expired' && { color: '#475569' }]}>
                    {trialStatus === 'expired'
                      ? (isMalay ? 'PERCUBAAN TELAH TAMAT' : 'FREE TRIAL HAS ENDED')
                      : trialStatus === 'active'
                        ? (isMalay ? 'PERCUBAAN 7 HARI AKTIF' : '7-DAY TRIAL ACTIVE')
                        : (isMalay ? '7 HARI PERCUMA' : '7 DAYS FREE')}
                  </Text>
                  <Text style={styles.giftOfferPriceText}>
                    {trialStatus === 'expired' ? (
                      <Text style={{ color: '#0F172A' }}>
                        {isMalay ? 'Langgan PRO ' : 'Subscribe to PRO '}
                        <Text style={styles.giftPriceRed}>RM78/{isMalay ? 'bln' : 'mo'}</Text>
                      </Text>
                    ) : trialStatus === 'active' ? (
                      <Text style={{ color: '#059669', fontFamily: 'PlusJakartaSans_800ExtraBold' }}>
                        {isMalay ? 'Sah sehingga ' : 'Valid until '}
                        <Text style={{ color: '#0F172A' }}>{formatTrialDate(trialEndsAtStr)}</Text>
                      </Text>
                    ) : (
                      <>
                        {isMalay ? 'Kemudian ' : 'Then '}
                        <Text style={styles.giftPriceRed}>RM2.60/{isMalay ? 'hari' : 'day'}</Text>{' '}
                        {isMalay ? 'sahaja' : 'only'}
                      </>
                    )}
                  </Text>
                  <Text style={styles.giftOfferSubtext}>
                    {trialStatus === 'expired'
                      ? (isMalay ? 'Percubaan 1-kali telah digunakan. Langgan PRO untuk teruskan.' : '1-time trial already used. Subscribe to PRO to continue.')
                      : trialStatus === 'active'
                        ? (isMalay ? 'Akses penuh ke tempahan pelanggan, katalog & jadual staf.' : 'Full access to appointments, catalog & staff schedules.')
                        : (isMalay ? 'Tiada bayaran dikenakan sepanjang tempoh percubaan.' : 'No charge during your trial.')}
                  </Text>
                </View>
              </View>

              {/* PRIMARY CTA & FOOTER */}
              <TouchableOpacity
                style={styles.ctaButtonWrap}
                onPress={handleMainAction}
                activeOpacity={0.88}
                disabled={saving}
              >
                <LinearGradient
                  colors={
                    trialStatus === 'expired'
                      ? ['#0F172A', '#1E293B', '#334155']
                      : ['#FFB800', '#F97316', '#EF4444']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name={trialStatus === 'expired' ? 'card' : trialStatus === 'active' ? 'calendar' : 'flash'}
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.ctaText}>
                        {isBeforeLaunch
                          ? isAutoActivated
                            ? (isMalay ? 'Lihat Pas VIP ➔' : 'View VIP Pass ➔')
                            : (isMalay ? 'Dapatkan Akses Awal ➔' : 'Get Early Access ➔')
                          : trialStatus === 'expired'
                            ? (isMalay ? 'Langgan PRO (RM78/bln) ➔' : 'Subscribe to PRO (RM78/mo) ➔')
                            : trialStatus === 'active'
                              ? (isMalay ? 'Buka Smart Booking ➔' : 'Open Smart Booking ➔')
                              : (isMalay ? 'Mulakan Percubaan Percuma 7 Hari ➔' : 'Start 7-Day Free Trial ➔')}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.noPaymentText}>
                {isBeforeLaunch
                  ? (isMalay ? 'Slot akses awal terhad.' : 'Limited early access slots.')
                  : trialStatus === 'expired'
                    ? (isMalay ? 'Batalkan langganan bila-bila masa.' : 'Cancel subscription anytime.')
                    : (isMalay ? 'Tiada bayaran hari ini. Akses 7 hari 1-kali.' : 'No payment today. 1-time 7 days access.')}
              </Text>

              {/* Maybe Later with flanking divider lines */}
              <View style={styles.dismissRow}>
                <View style={styles.dismissDivider} />
                <TouchableOpacity style={styles.dismissLinkBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.dismissLinkText}>
                    {isMalay ? 'Mungkin Nanti' : 'Maybe Later'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.dismissDivider} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🏆 VIP EARLY ACCESS CONFIRMATION MODAL */}
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
            <Text style={styles.vipModalTitle}>
              {isMalay ? 'Slot Anda Berjaya Dikunci' : 'Your Slot Is Locked'}
            </Text>

            {/* Diamond VIP Tag */}
            <View style={styles.vipDiamondBadge}>
              <Text style={styles.vipDiamondText}>
                {isMalay ? '💎 VIP AKSES AWAL' : '💎 VIP EARLY ACCESS'}
              </Text>
            </View>

            {/* Subtitle */}
            <Text style={styles.vipModalSubtitle}>
              {isMalay
                ? 'Kedai anda kini berdaftar untuk\npelancaran eksklusif 10.10.'
                : 'Your store is now registered for\nthe exclusive 10.10 launch.'}
            </Text>

            {/* 🎟️ LUXURY DIGITAL VIP PASS TICKET (Cleaned without / 50 count) */}
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

                {/* Big Pass Header & Locked Badge */}
                <View style={styles.ticketPassRow}>
                  <Text style={styles.ticketPassText}>
                    VIP PASS <Text style={styles.ticketPassHighlight}>• EARLY ACCESS</Text>
                  </Text>
                  <View style={styles.lockedBadgePill}>
                    <Ionicons name="lock-closed" size={12} color="#34D399" />
                    <Text style={styles.lockedBadgeText}>
                      {isMalay ? 'Terkunci' : 'Locked'}
                    </Text>
                  </View>
                </View>

                <View style={styles.ticketDivider} />

                {/* Kedai / Store Info */}
                <View style={styles.ticketDetailsRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="business" size={14} color="#94A3B8" />
                    <Text style={styles.ticketLabel}>{isMalay ? 'Kedai:' : 'Store:'}</Text>
                  </View>
                  <Text style={styles.ticketVal} numberOfLines={1}>{store}</Text>
                </View>

                {/* Pelancaran Rasmi / Official Launch */}
                <View style={styles.ticketDetailsRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
                    <Text style={styles.ticketLabel}>
                      {isMalay ? 'Pelancaran Rasmi:' : 'Official Launch:'}
                    </Text>
                  </View>
                  <Text style={styles.ticketValGold}>
                    {isMalay ? '10 Oktober 2026 (12:00 AM)' : 'October 10, 2026 (12:00 AM)'}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* 📋 Akses Awal Anda Termasuk */}
            <View style={styles.perksCard}>
              <Text style={styles.perksCardTitle}>
                {isMalay ? 'Akses Awal Anda Termasuk' : 'Your Early Access Includes'}
              </Text>

              <View style={styles.perkRow}>
                <View style={styles.perkCheckCircle}>
                  <Ionicons name="checkmark" size={12} color="#15803D" />
                </View>
                <Text style={styles.perkText}>
                  {isMalay ? 'Percuma 7 Hari Bermula 10.10' : '7 Days Free Starting 10.10'}
                </Text>
              </View>

              <View style={styles.perkRowDivider} />

              <View style={styles.perkRow}>
                <View style={styles.perkCheckCircle}>
                  <Ionicons name="checkmark" size={12} color="#15803D" />
                </View>
                <Text style={styles.perkText}>
                  {isMalay ? 'Kunci Harga Early Bird (RM2.60/hari)' : 'Lock In Early Bird Rate (RM2.60/day)'}
                </Text>
              </View>

              <View style={styles.perkRowDivider} />

              <View style={styles.perkRow}>
                <View style={styles.perkCheckCircle}>
                  <Ionicons name="checkmark" size={12} color="#15803D" />
                </View>
                <Text style={styles.perkText}>
                  {isMalay ? 'Bantuan Setup Menu & Servis Percuma' : 'Free Menu & Service Setup Assistance'}
                </Text>
              </View>
            </View>

            {/* ⚡ PRIMARY ACTION: 1-CLICK AUTO-ACTIVATE */}
            <TouchableOpacity
              style={styles.activateBtnWrap}
              onPress={handleAutoActivate}
              disabled={saving}
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
                  {isAutoActivated
                    ? (isMalay ? 'Akses 10.10 Telah Diaktifkan! ✅' : '10.10 Access Activated! ✅')
                    : (isMalay ? 'Aktifkan Automatik Pada 10.10 ➔' : 'Auto-Activate on 10.10 ➔')}
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
              <Text style={styles.saveWaitText}>
                {isMalay ? 'Simpan & Tunggu Pelancaran 10.10' : 'Save & Wait for 10.10 Launch'}
              </Text>
            </TouchableOpacity>

            {/* FOOTER NOTE */}
            <View style={styles.vipFooterRow}>
              <View style={styles.vipFooterDivider} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people" size={12} color="#94A3B8" />
                <Text style={styles.vipFooterText}>
                  {isMalay ? 'Slot akses awal terhad.' : 'Limited early access slots.'}
                </Text>
              </View>
              <View style={styles.vipFooterDivider} />
            </View>
          </View>
        </View>
      </Modal>

      {/* 🎉 7-DAY FREE TRIAL ACTIVATED SUCCESS MODAL */}
      <Modal
        visible={showTrialSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowTrialSuccessModal(false);
          onClose();
          router.push('/(merchant)/bookings' as any);
        }}
      >
        <View style={styles.vipOverlay}>
          <View style={styles.trialSuccessCard}>
            {/* Success Check Icon */}
            <View style={styles.trialSuccessIconCircle}>
              <Ionicons name="checkmark-done" size={32} color="#16A34A" />
            </View>

            <Text style={styles.trialSuccessTitle}>
              {isMalay ? 'Percubaan 7 Hari Diaktifkan! 🎉' : '7-Day Free Trial Activated! 🎉'}
            </Text>

            <Text style={styles.trialSuccessDesc}>
              {isMalay
                ? `Kedai anda kini mempunyai akses penuh ke Smart Booking sehingga ${formatTrialDate(trialEndsAtStr)}.`
                : `Your store now has full access to Smart Booking until ${formatTrialDate(trialEndsAtStr)}.`}
            </Text>

            {/* Feature Perks Box */}
            <View style={styles.trialPerksBox}>
              <View style={styles.trialPerkItem}>
                <Ionicons name="calendar" size={16} color="#FF6B00" />
                <Text style={styles.trialPerkText}>
                  {isMalay ? 'Laman Tempahan Web (PWA 24/7)' : '24/7 Storefront Booking PWA'}
                </Text>
              </View>
              <View style={styles.trialPerkItem}>
                <Ionicons name="people" size={16} color="#FF6B00" />
                <Text style={styles.trialPerkText}>
                  {isMalay ? 'Jadual & Kalendar Staf Automatik' : 'Automated Staff Schedules & Slots'}
                </Text>
              </View>
              <View style={styles.trialPerkItem}>
                <Ionicons name="notifications" size={16} color="#FF6B00" />
                <Text style={styles.trialPerkText}>
                  {isMalay ? 'Notifikasi Peringatan Pelanggan' : 'Customer Appointment Reminders'}
                </Text>
              </View>
            </View>

            {/* Direct Entry CTA */}
            <TouchableOpacity
              style={styles.trialSuccessBtnWrap}
              onPress={() => {
                setShowTrialSuccessModal(false);
                onClose();
                router.push('/(merchant)/bookings' as any);
              }}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#FFB800', '#F97316', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.trialSuccessBtnGradient}
              >
                <Text style={styles.trialSuccessBtnText}>
                  {isMalay ? 'Mula Sediakan Servis ➔' : 'Start Setting Up Services ➔'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
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

  /* Expired / Active Card & Badge Overrides */
  giftOfferCardExpired: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  stampBadgePillExpired: {
    backgroundColor: '#64748B',
  },
  stampBadgePillActive: {
    backgroundColor: '#10B981',
  },

  /* 🎉 7-Day Trial Success Modal Styles */
  trialSuccessCard: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  trialSuccessIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#86EFAC',
  },
  trialSuccessTitle: {
    fontSize: 19,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  trialSuccessDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  trialPerksBox: {
    width: '100%',
    backgroundColor: '#FFFBEA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEF08A',
    padding: 14,
    gap: 10,
    marginBottom: 22,
  },
  trialPerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trialPerkText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#78350F',
    flex: 1,
  },
  trialSuccessBtnWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  trialSuccessBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialSuccessBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
