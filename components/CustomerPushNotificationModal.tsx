// components/CustomerPushNotificationModal.tsx
// Persistent prompt modal in customer section to ensure push notifications are enabled.
// Matches the iOS Bottom Sheet native aesthetic with the 3D notification bell asset.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  isPushSupported,
  getPushPermissionStatus,
  subscribeToPushNotifications,
  PushPermissionStatus,
  isIOSDevice,
  isStandalonePWA,
  isCustomerPushActive,
  setCustomerPushActive,
  sendCustomerTestNotification,
} from '@/lib/push-notifications';

const texts = {
  en: {
    successTitle: 'Notifications Enabled! 🎉',
    successSub: 'Appointment reminders (2h & 30m) and reward alerts will be sent directly to your device screen.',
    statusActive: 'STATUS: ACTIVE ✅',
    activeTitle: 'Live Appointment Notifications',
    activeSubtitle: 'This device is ready to receive real-time alerts for your appointment slots & rewards.',
    scheduleTitle: 'Appointment Reminder Schedule',
    scheduleDesc: 'Sent automatically 2 hours and 30 minutes before your slot.',
    testNoticeSent: 'Test Notice Sent!',
    testNoticeBtn: 'Test Notification Now 🔔',
    closeBtn: 'Close',
    onboardingBadge: 'IMPORTANT REMINDER',
    onboardingTitle: 'Enable Appointment & Reward Notifications',
    onboardingSubtitle: 'Never miss your appointment! Get automated reminders and instant alerts directly on your phone screen without WhatsApp.',
    benefit1Title: 'Appointment Reminders',
    benefit1Desc: 'Get notified 2 hours and 30 minutes before your visit.',
    benefit2Title: 'Rewards & NFC Stamps',
    benefit2Desc: 'Instant alerts when stamps are added and vouchers are ready to redeem.',
    iosGuideTitle: 'iPhone User Guide 📱',
    iosGuideShare: 'To enable notifications on iPhone: Tap the Share button in Safari',
    iosGuideAddHome: 'Add to Home Screen (+)',
    iosGuideOpen: 'Open RISEV from your phone home screen.',
    deniedNotice: 'Notifications are blocked in your browser. Tap the lock icon (🔒) in the URL bar and select',
    deniedNoticeAllow: 'Allow Notifications',
    enableNowBtn: 'Enable Notifications Now',
    dismissBtn: 'Not Now',
    footerSettings: 'You can change notification preferences anytime in Settings.',
  },
  ms: {
    successTitle: 'Notifikasi Diaktifkan! 🎉',
    successSub: 'Peringatan temujanji (2 jam & 30 minit) dan makluman ganjaran akan dihantar terus ke peranti anda.',
    statusActive: 'STATUS: AKTIF ✅',
    activeTitle: 'Notifikasi Temujanji Langsung',
    activeSubtitle: 'Peranti ini sedia menerima amaran masa-nyata untuk slot temujanji & ganjaran anda.',
    scheduleTitle: 'Jadual Peringatan Temujanji',
    scheduleDesc: 'Dihantar secara automatik 2 jam dan 30 minit sebelum slot tiba.',
    testNoticeSent: 'Notis Ujian Telah Dihantar!',
    testNoticeBtn: 'Uji Notifikasi Sekarang 🔔',
    closeBtn: 'Tutup',
    onboardingBadge: 'PERINGATAN PENTING',
    onboardingTitle: 'Aktifkan Notifikasi Temujanji & Ganjaran',
    onboardingSubtitle: 'Jangan terlepas temujanji anda! Dapatkan peringatan automatik dan makluman terus pada skrin telefon anda tanpa WhatsApp.',
    benefit1Title: 'Peringatan Temujanji',
    benefit1Desc: 'Dapatkan notifikasi 2 jam dan 30 minit sebelum temujanji anda.',
    benefit2Title: 'Ganjaran & Setem NFC',
    benefit2Desc: 'Makluman serta-merta bila setem ditambah dan baucar sedia ditebus.',
    iosGuideTitle: 'Panduan Pengguna iPhone 📱',
    iosGuideShare: 'Untuk aktifkan notifikasi di iPhone: Tekan butang Kongsi di Safari',
    iosGuideAddHome: 'Add to Home Screen (+)',
    iosGuideOpen: 'Buka RISEV dari skrin utama telefon anda.',
    deniedNotice: 'Notifikasi disekat dalam pelayar. Sila tekan ikon mangga (🔒) di bahagian atas alamat URL dan pilih',
    deniedNoticeAllow: 'Benarkan Notifikasi',
    enableNowBtn: 'Aktifkan Notifikasi Sekarang',
    dismissBtn: 'Nanti Dahulu',
    footerSettings: 'Anda boleh mengubah pilihan notifikasi pada bila-bila masa di Tetapan.',
  }
};

interface CustomerPushNotificationModalProps {
  visible?: boolean;
  onClose?: () => void;
}

export default function CustomerPushNotificationModal({
  visible: controlledVisible,
  onClose: controlledOnClose,
}: CustomerPushNotificationModalProps = {}) {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = texts[locale === 'ms' ? 'ms' : 'en'];
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [internalVisible, setInternalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>('default');
  const [isCustomerActive, setIsCustomerActive] = useState<boolean>(false);
  const [success, setSuccess] = useState(false);
  const [deniedGuide, setDeniedGuide] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const isIOS = isIOSDevice();
  const isPWA = isStandalonePWA();
  const isIOSBrowser = isIOS && !isPWA;

  // Controlled or uncontrolled modal visibility
  const isControlled = controlledVisible !== undefined;
  const isVisible = isControlled ? controlledVisible : internalVisible;

  // Subtle ringing pulse animation for 3D bell
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Check storage and browser status
  const evaluateNotificationState = async (autoOpenIfInactive = true) => {
    const supported = isPushSupported();
    const currentStatus = getPushPermissionStatus();
    setPermissionStatus(currentStatus);

    const activeInStorage = await isCustomerPushActive(user?.phone || user?.id);
    setIsCustomerActive(activeInStorage);

    if (currentStatus === 'denied') {
      setDeniedGuide(true);
    } else {
      setDeniedGuide(false);
    }

    // Condition for "selagi tak on":
    const isFullyTurnedOn = activeInStorage && currentStatus === 'granted';

    if (autoOpenIfInactive && !isControlled) {
      if (!isFullyTurnedOn) {
        const dismissedSession = sessionStorage.getItem('risev_customer_push_dismissed_session');
        if (!dismissedSession) {
          setInternalVisible(true);
        }
      }
    }
  };

  useEffect(() => {
    evaluateNotificationState(true);

    // Subtle gentle ringing pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, [user]);

  // Request & subscribe to push
  const handleEnableNotifications = async () => {
    setLoading(true);

    try {
      const result = await subscribeToPushNotifications({
        customerPhone: user?.phone,
      });

      if (result?.success) {
        await setCustomerPushActive(user?.phone || user?.id, true);
        setIsCustomerActive(true);
        setPermissionStatus('granted');
        setSuccess(true);
        setDeniedGuide(false);

        setTimeout(() => {
          setSuccess(false);
          handleDismiss();
        }, 2200);
      } else {
        const status = getPushPermissionStatus();
        setPermissionStatus(status);
        if (status === 'denied') {
          setDeniedGuide(true);
        }
      }
    } catch (err) {
      console.error('[CustomerPushNotificationModal] error:', err);
      const status = getPushPermissionStatus();
      setPermissionStatus(status);
      if (status === 'denied') {
        setDeniedGuide(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestLoading(true);
    try {
      const ok = await sendCustomerTestNotification();
      if (ok) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
      }
    } catch (e) {
      console.warn('Test notice failed', e);
    } finally {
      setTestLoading(false);
    }
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('risev_customer_push_dismissed_session', 'true');
    }

    if (isControlled && controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalVisible(false);
    }
  };

  if (!isVisible) return null;

  const isAlreadyActiveState = isCustomerActive && permissionStatus === 'granted';

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <View style={[styles.modalOverlay, isDesktop && styles.desktopOverlay]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleDismiss}
        />

        <View style={[styles.bottomSheetCard, isDesktop && styles.desktopCard]}>
          {/* iOS Bottom Sheet Drag Handle Bar */}
          <View style={styles.sheetHandleBar} />

          {/* Close Button Circle Top-Right */}
          <TouchableOpacity
            style={styles.closeBtnCircle}
            onPress={handleDismiss}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color="#64748B" />
          </TouchableOpacity>

          {success ? (
            // ── SUCCESS CONFIRMATION STATE ──
            <View style={styles.successWrapper}>
              <View style={styles.successIconBox}>
                <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
              </View>
              <Text style={styles.successTitle}>{t.successTitle}</Text>
              <Text style={styles.successSub}>{t.successSub}</Text>
            </View>
          ) : isAlreadyActiveState ? (
            // ── ALREADY ACTIVE & TESTING STATE ──
            <View style={styles.innerContent}>
              <View style={styles.heroAssetWrap}>
                <Image
                  source={require('@/assets/notification-bell-hero.png')}
                  style={styles.hero3dImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.titleWrap}>
                <View style={[styles.pillBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#15803D' }]}>{t.statusActive}</Text>
                </View>
                <Text style={styles.mainTitle}>{t.activeTitle}</Text>
                <Text style={styles.mainSubtitle}>{t.activeSubtitle}</Text>
              </View>

              <View style={styles.benefitsContainer}>
                <View style={styles.benefitRow}>
                  <View style={styles.benefitIconBox}>
                    <Ionicons name="time-outline" size={20} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>{t.scheduleTitle}</Text>
                    <Text style={styles.benefitDesc}>{t.scheduleDesc}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionsWrap}>
                <TouchableOpacity
                  style={[styles.primaryEnableBtn, testLoading && { opacity: 0.85 }]}
                  onPress={handleSendTestNotification}
                  disabled={testLoading}
                  activeOpacity={0.88}
                >
                  {testLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : testSent ? (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      <Text style={styles.primaryEnableBtnText}>{t.testNoticeSent}</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryEnableBtnText}>{t.testNoticeBtn}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryDismissBtn}
                  onPress={handleDismiss}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryDismissBtnText}>{t.closeBtn}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // ── MAIN ONBOARDING BOTTOM SHEET STATE (MATCHES IMAGE 1) ──
            <View style={styles.innerContent}>
              {/* 3D Glossy Yellow Bell Hero Asset */}
              <View style={styles.heroAssetWrap}>
                <Animated.Image
                  source={require('@/assets/notification-bell-hero.png')}
                  style={[styles.hero3dImage, { transform: [{ scale: pulseAnim }] }]}
                  resizeMode="contain"
                />
              </View>

              {/* Title & Badge */}
              <View style={styles.titleWrap}>
                <View style={styles.pillBadge}>
                  <Text style={styles.pillBadgeText}>{t.onboardingBadge}</Text>
                </View>
                <Text style={styles.mainTitle}>{t.onboardingTitle}</Text>
                <Text style={styles.mainSubtitle}>{t.onboardingSubtitle}</Text>
              </View>

              {/* Unified Rounded Benefit Card (2 Key Benefits) */}
              <View style={styles.benefitsContainer}>
                {/* Benefit 1: Appointment Reminders */}
                <View style={styles.benefitRow}>
                  <View style={styles.benefitIconBox}>
                    <Ionicons name="time-outline" size={20} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>{t.benefit1Title}</Text>
                    <Text style={styles.benefitDesc}>{t.benefit1Desc}</Text>
                  </View>
                </View>

                {/* Subtle Divider */}
                <View style={styles.benefitDivider} />

                {/* Benefit 2: Rewards & NFC Stamps */}
                <View style={styles.benefitRow}>
                  <View style={styles.benefitIconBox}>
                    <Ionicons name="gift-outline" size={20} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>{t.benefit2Title}</Text>
                    <Text style={styles.benefitDesc}>{t.benefit2Desc}</Text>
                  </View>
                </View>
              </View>

              {/* Special Guide for iOS Safari Users */}
              {isIOSBrowser && (
                <View style={styles.iosNoticeBox}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#2563EB" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.iosNoticeTitle}>{t.iosGuideTitle}</Text>
                    <Text style={styles.iosNoticeText}>
                      {t.iosGuideShare} (<Ionicons name="share-outline" size={13} color="#2563EB" />) ➔ <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}>{t.iosGuideAddHome}</Text> ➔ {t.iosGuideOpen}
                    </Text>
                  </View>
                </View>
              )}

              {/* Browser Permission Denied Guide Box */}
              {deniedGuide && (
                <View style={styles.deniedNoticeBox}>
                  <Ionicons name="information-circle" size={18} color="#DC2626" />
                  <Text style={styles.deniedNoticeText}>
                    {t.deniedNotice} <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}>{t.deniedNoticeAllow}</Text>.
                  </Text>
                </View>
              )}

              {/* Dual Action Buttons */}
              <View style={styles.actionsWrap}>
                <TouchableOpacity
                  style={[styles.primaryEnableBtn, loading && { opacity: 0.85 }]}
                  onPress={handleEnableNotifications}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="notifications" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryEnableBtnText}>
                        {t.enableNowBtn}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryDismissBtn}
                  onPress={handleDismiss}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={styles.secondaryDismissBtnText}>{t.dismissBtn}</Text>
                </TouchableOpacity>
              </View>

              {/* Footer Settings Note */}
              <Text style={styles.footerSettingsText}>{t.footerSettings}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    zIndex: 999999,
  },
  desktopOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  bottomSheetCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 38 : 26,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 24,
    position: 'relative',
  },
  desktopCard: {
    maxWidth: 440,
    borderRadius: 32,
    alignSelf: 'center',
    paddingBottom: 28,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
  },
  sheetHandleBar: {
    width: 38,
    height: 4.5,
    borderRadius: 99,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  closeBtnCircle: {
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
  innerContent: {
    alignItems: 'center',
    width: '100%',
  },
  heroAssetWrap: {
    width: 124,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  hero3dImage: {
    width: 120,
    height: 120,
  },
  titleWrap: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  pillBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 5.5,
    borderRadius: 999,
    marginBottom: 10,
    alignSelf: 'center',
  },
  pillBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
    letterSpacing: 0.6,
  },
  mainTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    lineHeight: 28,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  mainSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19.5,
    maxWidth: 340,
    alignSelf: 'center',
  },
  benefitsContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  benefitIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
  },
  benefitDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  iosNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    width: '100%',
  },
  iosNoticeTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D4ED8',
    marginBottom: 2,
  },
  iosNoticeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1E40AF',
    lineHeight: 16,
  },
  deniedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    width: '100%',
  },
  deniedNoticeText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#991B1B',
    lineHeight: 16,
  },
  actionsWrap: {
    width: '100%',
    gap: 10,
  },
  primaryEnableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#000000',
    borderRadius: 999,
    height: 54,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryEnableBtnText: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  secondaryDismissBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 48,
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryDismissBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  footerSettingsText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
  },
  successWrapper: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
    width: '100%',
  },
  successIconBox: {
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },
});
