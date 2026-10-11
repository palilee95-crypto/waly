// components/CustomerPushNotificationModal.tsx
// Persistent prompt modal in customer section to ensure push notifications are enabled.
// Will continue to prompt the customer as long as notifications are not turned on ("selagi tak on").

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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
    successSub: 'Appointment reminders (12h, 3h & 30m) and reward alerts will be sent directly to your device.',
    statusActive: 'STATUS: ACTIVE ✅',
    activeTitle: 'Live Appointment Notifications',
    activeSubtitle: 'This device is ready to receive real-time alerts for your appointment slots & rewards.',
    scheduleTitle: 'Appointment Reminder Schedule',
    scheduleDesc: 'Sent automatically 2 hours and 30 minutes before your slot.',
    testNoticeSent: 'Test Notice Sent!',
    testNoticeBtn: 'Test Notification Now 🔔',
    closeBtn: 'Close',
    onboardingBadge: 'IMPORTANT REMINDER 🔔',
    onboardingTitle: 'Enable Appointment & Reward Notifications',
    onboardingSubtitle: 'Never miss your appointment! Get automated reminders directly on your phone screen without WhatsApp.',
    benefit1Title: 'Appointment Reminders',
    benefit1Desc: 'Automated alerts 2 hours & 30 minutes before your slot arrives.',
    benefit2Title: 'Rewards & NFC Stamps',
    benefit2Desc: 'Instant alerts when stamps are added & vouchers are ready to redeem.',
    benefit3Title: 'Easy Navigation',
    benefit3Desc: 'Quick links to Waze & Google Maps when your turn begins.',
    iosGuideTitle: 'iPhone User Guide 📱',
    iosGuideShare: 'To enable notifications on iPhone: Tap the Share button in Safari',
    iosGuideAddHome: 'Add to Home Screen (+)',
    iosGuideOpen: 'Open RISEV from your phone home screen.',
    deniedNotice: 'Notifications are blocked in your browser. Tap the lock icon (🔒) in the URL bar and select',
    deniedNoticeAllow: 'Allow Notifications',
    enableNowBtn: 'Enable Notifications Now',
    dismissBtn: 'Not Now',
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
    onboardingBadge: 'PERINGATAN PENTING 🔔',
    onboardingTitle: 'Aktifkan Notifikasi Temujanji & Ganjaran',
    onboardingSubtitle: 'Jangan terlepas slot anda! Dapatkan makluman automatik terus pada skrin telefon anda tanpa Meta WhatsApp.',
    benefit1Title: 'Peringatan Temujanji',
    benefit1Desc: 'Alert automatik 2 jam & 30 minit sebelum slot anda tiba.',
    benefit2Title: 'Ganjaran & Setem NFC',
    benefit2Desc: 'Makluman serta-merta bila setem bertambah & baucar sedia ditebus.',
    benefit3Title: 'Navigasi Mudah',
    benefit3Desc: 'Pautan pantas ke Waze & Google Maps bila giliran anda bermula.',
    iosGuideTitle: 'Panduan Pengguna iPhone 📱',
    iosGuideShare: 'Untuk aktifkan notifikasi di iPhone: Tekan butang Kongsi di Safari',
    iosGuideAddHome: 'Add to Home Screen (+)',
    iosGuideOpen: 'Buka RISEV dari skrin utama telefon anda.',
    deniedNotice: 'Notifikasi disekat dalam pelayar. Sila tekan ikon mangga (🔒) di bahagian atas alamat URL dan pilih',
    deniedNoticeAllow: 'Benarkan Notifikasi',
    enableNowBtn: 'Aktifkan Notifikasi Sekarang',
    dismissBtn: 'Nanti Dahulu',
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

  // Subtle pulse animation for glowing bell
  const pulseScale = useRef(new Animated.Value(1)).current;

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
    // If not active in storage OR permission not granted, customer has NOT turned it on yet!
    const isFullyTurnedOn = activeInStorage && currentStatus === 'granted';

    if (autoOpenIfInactive && !isControlled) {
      if (!isFullyTurnedOn) {
        // Customer has NOT turned on notifications yet -> Show popup!
        setInternalVisible(true);
      } else {
        // Already turned on, do not disturb automatically
        setInternalVisible(false);
      }
    }
  };

  useEffect(() => {
    // Initial evaluation with gentle delay to avoid blocking initial UI paint
    const timer = setTimeout(() => {
      evaluateNotificationState(true);
    }, 700);

    return () => clearTimeout(timer);
  }, [user?.phone, user?.id]);

  // If controlled externally (e.g. user clicked bell icon)
  useEffect(() => {
    if (controlledVisible) {
      evaluateNotificationState(false);
    }
  }, [controlledVisible]);

  // Continuous bell pulsation animation
  useEffect(() => {
    if (!isVisible) return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [isVisible]);

  const handleEnableNotifications = async () => {
    setLoading(true);
    setDeniedGuide(false);

    try {
      const customerPhone = user?.phone || '';
      const result = await subscribeToPushNotifications({ customerPhone });

      if (result.success) {
        // Mark active in storage
        await setCustomerPushActive(user?.phone || user?.id, true);
        setIsCustomerActive(true);
        setSuccess(true);
        setPermissionStatus('granted');

        setTimeout(() => {
          setSuccess(false);
          handleDismiss();
        }, 1800);
      } else {
        const updatedStatus = getPushPermissionStatus();
        setPermissionStatus(updatedStatus);
        if (updatedStatus === 'denied') {
          setDeniedGuide(true);
        }
      }
    } catch (err) {
      console.warn('[CUSTOMER PUSH MODAL ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    if (isControlled && controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalVisible(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestLoading(true);
    try {
      const sent = await sendCustomerTestNotification();
      if (sent) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
      }
    } finally {
      setTestLoading(false);
    }
  };

  const handleResetForTesting = async () => {
    await setCustomerPushActive(user?.phone || user?.id, false);
    setIsCustomerActive(false);
    evaluateNotificationState(false);
  };

  if (!isVisible) return null;

  const isAlreadyActiveState = isCustomerActive && permissionStatus === 'granted';

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, isDesktop && { maxWidth: 440 }]}>
          {success ? (
            // ── SUCCESS CONFIRMATION STATE ──
            <View style={styles.successWrapper}>
              <View style={styles.successIconBox}>
                <Ionicons name="checkmark-circle" size={54} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>{t.successTitle}</Text>
              <Text style={styles.successSub}>{t.successSub}</Text>
            </View>
          ) : isAlreadyActiveState ? (
            // ── ALREADY ACTIVE & TESTING STATE ──
            <>
              <View style={styles.headerGraphicRow}>
                <View style={[styles.bellAura, { backgroundColor: '#ECFDF5' }]}>
                  <View style={[styles.bellGradientCircle, { backgroundColor: '#10B981' }]}>
                    <Ionicons name="notifications" size={26} color="#FFFFFF" />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.closeBtnCircle}
                  onPress={handleDismiss}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View style={styles.titleWrap}>
                <View style={[styles.pillBadge, { backgroundColor: '#D1FAE5' }]}>
                  <Text style={[styles.pillBadgeText, { color: '#047857' }]}>{t.statusActive}</Text>
                </View>
                <Text style={styles.mainTitle}>{t.activeTitle}</Text>
                <Text style={styles.mainSubtitle}>{t.activeSubtitle}</Text>
              </View>

              <View style={styles.benefitsContainer}>
                <View style={styles.benefitRow}>
                  <View style={[styles.benefitIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="alarm-outline" size={18} color="#D97706" />
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
            </>
          ) : (
            // ── MAIN NOTIFICATION ONBOARDING STATE ("SELAGI TAK ON") ──
            <>
              {/* Top Graphic Bell Header with Pulse Aura */}
              <View style={styles.headerGraphicRow}>
                <Animated.View style={[styles.bellAura, { transform: [{ scale: pulseScale }] }]}>
                  <LinearGradient
                    colors={['#FEF3C7', '#FDE68A']}
                    style={styles.bellGradientCircle}
                  >
                    <Ionicons name="notifications" size={32} color="#D97706" />
                  </LinearGradient>
                </Animated.View>

                {/* Subtle Close Button */}
                <TouchableOpacity
                  style={styles.closeBtnCircle}
                  onPress={handleDismiss}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Title & Badge */}
              <View style={styles.titleWrap}>
                <View style={styles.pillBadge}>
                  <Text style={styles.pillBadgeText}>{t.onboardingBadge}</Text>
                </View>
                <Text style={styles.mainTitle}>{t.onboardingTitle}</Text>
                <Text style={styles.mainSubtitle}>{t.onboardingSubtitle}</Text>
              </View>

              {/* 3 Value Propositions / Features */}
              <View style={styles.benefitsContainer}>
                <View style={styles.benefitRow}>
                  <View style={[styles.benefitIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="time-outline" size={18} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>{t.benefit1Title}</Text>
                    <Text style={styles.benefitDesc}>{t.benefit1Desc}</Text>
                  </View>
                </View>

                <View style={styles.benefitRow}>
                  <View style={[styles.benefitIconBox, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="gift-outline" size={18} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>{t.benefit2Title}</Text>
                    <Text style={styles.benefitDesc}>{t.benefit2Desc}</Text>
                  </View>
                </View>

                <View style={styles.benefitRow}>
                  <View style={[styles.benefitIconBox, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="navigate-outline" size={18} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>{t.benefit3Title}</Text>
                    <Text style={styles.benefitDesc}>{t.benefit3Desc}</Text>
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

              {/* Action Buttons */}
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
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 999999,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 24,
  },
  headerGraphicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bellAura: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellGradientCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    marginTop: 8,
    marginBottom: 16,
  },
  pillBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  pillBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    lineHeight: 26,
    marginBottom: 6,
  },
  mainSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
  },
  benefitsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 15,
  },
  iosNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
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
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  deniedNoticeText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#991B1B',
    lineHeight: 16,
  },
  actionsWrap: {
    gap: 10,
  },
  primaryEnableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryEnableBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  secondaryDismissBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  secondaryDismissBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  successWrapper: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  successIconBox: {
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
