// components/MerchantNoticeCarousel.tsx
// Auto-rotating announcement banner for merchants (4s cycle) with pause-on-touch, custom graphic cards, and dedicated Video Academy card.

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Linking,
  Platform,
  Animated,
  Easing,
  LayoutChangeEvent,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii } from '@/theme';
import { playClaimChime } from '@/lib/audioChime';

interface MerchantNoticeCarouselProps {
  onOpenAcademy?: () => void;
  onOpenUpgrade?: () => void;
  merchant?: any;
  locale?: string;
}

export default function MerchantNoticeCarousel({
  onOpenAcademy,
  onOpenUpgrade,
  merchant,
  locale = 'en',
}: MerchantNoticeCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showFreeQuotaModal, setShowFreeQuotaModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [cardWidth, setCardWidth] = useState(360);

  // Animated values for horizontal translation & opacity
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);

  const slides = [
    {
      id: 'free_quota',
      type: 'reward',
      image: require('@/assets/images/banner_free_quota.png'),
      cardBg: '#FFEA79',
      cardBorder: '#FDE047',
      onPress: () => setShowFreeQuotaModal(true),
    },
    {
      id: 'promo',
      type: 'promo',
      image: require('@/assets/images/banner_pro_plan.png'),
      cardBg: '#FFEA79',
      cardBorder: '#FCD34D',
      isComingSoon: true,
      onPress: () => {
        // Coming soon - disabled
      },
    },
    {
      id: 'update',
      type: 'update',
      image: require('@/assets/images/banner_nfc_alerts.png'),
      cardBg: '#FFEA79',
      cardBorder: '#BAE6FD',
      onPress: () => setShowUpdateModal(true),
    },
  ];

  // Helper to transition to next index with horizontal slide motion
  const animateToNext = (targetIdx: number) => {
    if (isAnimating.current) return;
    isAnimating.current = true;

    const shiftDistance = Math.min(cardWidth * 0.75, 260);

    // Step 1: Current card slides OUT to the LEFT (-shiftDistance) & fades out
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -shiftDistance,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Step 2: Switch slide index & reposition incoming card to RIGHT (+shiftDistance)
      setCurrentIndex(targetIdx);
      translateX.setValue(shiftDistance);

      // Step 3: Incoming card slides IN from the RIGHT to CENTER (0) & fades in
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.back(1.1)),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });
    });
  };

  // Auto-rotating timer set to 4.0 seconds (4000ms), pauses on touch/press
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      const nextIdx = (currentIndex + 1) % slides.length;
      animateToNext(nextIdx);
    }, 4000);

    return () => clearInterval(timer);
  }, [isPaused, currentIndex, slides.length, cardWidth]);

  // Ensure currentIndex is always within valid bounds (prevents crashes during HMR or state shifts)
  const safeIndex = currentIndex >= 0 && currentIndex < slides.length ? currentIndex : 0;
  const currentSlide = slides[safeIndex] || slides[0];

  const handleSelectDot = (idx: number) => {
    if (idx === currentIndex || isAnimating.current) return;
    setIsPaused(true);
    animateToNext(idx);
    setTimeout(() => setIsPaused(false), 5000);
  };

  const handleSendWhatsAppClaim = () => {
    const storeName = merchant?.name || 'Store';
    const msg = `Salam Risev! Saya nak tuntut +100 kuota percuma untuk kedai ${storeName}.\n\nBerikut bukti review/video saya di TikTok (@risev.loyalty), Shopee, atau Google:\n[Sila sertakan pautan atau tangkapan skrin anda]`;
    const url = `https://wa.me/601156221568?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setCardWidth(w);
  };

  return (
    <>
      {/* 1. VISUAL CAROUSEL BANNER (4.0s Auto-Slide, Pause-on-Touch) */}
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={currentSlide.onPress}
        onPressIn={() => setIsPaused(true)}
        onPressOut={() => setIsPaused(false)}
        // @ts-ignore: Web mouse enter
        onMouseEnter={() => setIsPaused(true)}
        // @ts-ignore: Web mouse leave
        onMouseLeave={() => setIsPaused(false)}
        onLayout={handleLayout}
        style={styles.carouselCard}
      >
        <Animated.View
          style={[
            styles.slideContentContainer,
            {
              opacity: opacity,
              transform: [{ translateX: translateX }],
            },
          ]}
        >
          <Image
            source={currentSlide.image}
            style={[
              styles.bannerImage,
              currentSlide.isComingSoon && styles.blurredBannerImage,
            ]}
            blurRadius={currentSlide.isComingSoon ? (Platform.OS === 'web' ? 8 : 10) : 0}
            resizeMode="cover"
          />

          {currentSlide.isComingSoon && (
            <View style={styles.comingSoonOverlay}>
              <View style={styles.comingSoonPill}>
                <View style={styles.comingSoonDot} />
                <Text style={styles.comingSoonPillText}>COMING SOON</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Floating Overlay Pagination Dots */}
        <View style={styles.paginationRow}>
          {slides.map((_, idx) => {
            const isActive = safeIndex === idx;
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => handleSelectDot(idx)}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              />
            );
          })}
          {isPaused && (
            <View style={styles.pausePill}>
              <Ionicons name="pause" size={8} color="#050505" />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* ─── 1. FREE QUOTA CLAIM MODAL (Clean Light Glass Card) ─── */}
      <Modal
        visible={showFreeQuotaModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFreeQuotaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.lightModalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.lightModalIconCircle}>
                <Ionicons name="gift" size={24} color="#16A34A" />
              </View>
              <TouchableOpacity
                onPress={() => setShowFreeQuotaModal(false)}
                style={styles.lightModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.lightEyebrowBadge}>
              <Text style={styles.lightEyebrowText}>🎁 GANJARAN PERCUMA · +100 KUOTA DATABASE</Text>
            </View>

            <Text style={styles.lightModalTitle}>Tuntut +100 Kuota Pelanggan!</Text>
            <Text style={styles.lightModalDesc}>
              Pilih mana-mana <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>SATU</Text> syarat di bawah untuk tebus +100 kuota tambahan secara percuma:
            </Text>

            {/* 3 Step Cards */}
            <View style={styles.stepsContainer}>
              <View style={styles.lightStepItem}>
                <View style={styles.lightStepHeader}>
                  <Ionicons name="logo-tiktok" size={16} color="#000000" style={{ marginRight: 6 }} />
                  <Text style={styles.lightStepTitle}>TikTok Video / Unboxing Stand</Text>
                </View>
                <Text style={styles.lightStepDesc}>
                  Buat video kreatif stand Risev di kaunter kedai anda & tag <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#059669' }}>@risev.loyalty</Text>.
                </Text>
              </View>

              <View style={styles.lightStepItem}>
                <View style={styles.lightStepHeader}>
                  <Ionicons name="star" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={styles.lightStepTitle}>Shopee ATAU Google Maps Review</Text>
                </View>
                <Text style={styles.lightStepDesc}>
                  Hantar review 5-bintang ikhlas di Shopee atau Google Maps kami (pilih mana-mana satu).
                </Text>
              </View>

              <View style={[styles.lightStepItem, styles.lightStepItemHighlight]}>
                <View style={styles.lightStepHeader}>
                  <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={{ marginRight: 6 }} />
                  <Text style={[styles.lightStepTitle, { color: '#15803D' }]}>Hantar Bukti & Tebus Segera</Text>
                </View>
                <Text style={[styles.lightStepDesc, { color: '#166534' }]}>
                  Hantar pautan/screenshot review kepada admin Risev di WhatsApp. Kuota +100 dikreditkan dalam 24 jam!
                </Text>
              </View>
            </View>

            {/* Submit via WhatsApp CTA */}
            <TouchableOpacity style={styles.lightWaSubmitBtn} onPress={handleSendWhatsAppClaim} activeOpacity={0.85}>
              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.lightWaSubmitText}>Hantar Bukti ke WhatsApp →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── 2. WHAT'S NEW MODAL ─── */}
      <Modal
        visible={showUpdateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUpdateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconCircle, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="notifications" size={24} color="#2563EB" />
              </View>
              <TouchableOpacity
                onPress={() => setShowUpdateModal(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Ciri Baru: Notifikasi & Audio Chime ⚡</Text>
            <Text style={styles.modalDesc}>
              Kemaskini terkini untuk memastikan anda tidak terlepas sebarang aktiviti pelanggan di kedai:
            </Text>

            <View style={styles.updateFeaturesList}>
              <View style={styles.updateFeatureItem}>
                <Ionicons name="volume-high" size={20} color="#FFC700" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.updateFeatureTitle}>Bunyi Chime Juruwang Langsung</Text>
                  <Text style={styles.updateFeatureDesc}>Telefon atau tablet kaunter akan berbunyi 'ding' bila pelanggan tap NFC.</Text>
                </View>
              </View>

              <View style={styles.updateFeatureItem}>
                <Ionicons name="phone-portrait-outline" size={20} color="#FFC700" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.updateFeatureTitle}>Notifikasi Skrin Terkunci (Web Push)</Text>
                  <Text style={styles.updateFeatureDesc}>Terima push alerts terus ke telefon walaupun skrin anda sedang terpadam.</Text>
                </View>
              </View>

              <View style={styles.updateFeatureItem}>
                <Ionicons name="person-circle-outline" size={20} color="#FFC700" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.updateFeatureTitle}>Resolusi Nama Sebenar Pelanggan</Text>
                  <Text style={styles.updateFeatureDesc}>Nama berdaftar pelanggan akan dipaparkan secara langsung berbanding ID nombor.</Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.testChimeBtn}
                onPress={() => playClaimChime()}
              >
                <Ionicons name="volume-high" size={16} color="#050505" style={{ marginRight: 6 }} />
                <Text style={styles.testChimeBtnText}>Uji Bunyi Chime</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setShowUpdateModal(false)}
              >
                <Text style={styles.closeModalBtnText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /* Carousel Banner Styling (Direct Graphic Banner Without Outer Card) */
  carouselCard: {
    width: '100%',
    aspectRatio: 3.0,
    borderRadius: 24,
    borderWidth: 0,
    backgroundColor: 'transparent',
    marginBottom: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  slideContentContainer: {
    width: '100%',
    height: '100%',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  blurredBannerImage: {
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(7px)', transform: 'scale(1.04)' } as any)
      : {}),
    opacity: 0.88,
  },
  comingSoonOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(2px)' } as any)
      : {}),
  },
  comingSoonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  comingSoonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFC700',
  },
  comingSoonPillText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 1.1,
  },

  /* Pagination Row Overlay */
  paginationRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#050505',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(5, 5, 5, 0.25)',
  },
  pausePill: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(5, 5, 5, 0.15)',
  },

  /* Dedicated Video Academy Card */
  academyCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginBottom: 16,
  },
  academyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  academyTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  academyBadge: {
    backgroundColor: '#D97706',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  academyBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  academySubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  lightModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  lightModalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightEyebrowBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  lightEyebrowText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  lightModalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  lightModalDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 16,
  },
  stepsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  lightStepItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lightStepItemHighlight: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  lightStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  lightStepTitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  lightStepDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 15,
  },
  lightWaSubmitBtn: {
    backgroundColor: '#10B981',
    borderRadius: radii.full,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  lightWaSubmitText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },

  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  updateFeaturesList: {
    gap: 12,
    marginBottom: 14,
  },
  updateFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    borderRadius: 12,
  },
  updateFeatureTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  updateFeatureDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 15,
  },
  testChimeBtn: {
    flex: 1,
    backgroundColor: '#FFC700',
    borderRadius: radii.full,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testChimeBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  closeModalBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radii.full,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
