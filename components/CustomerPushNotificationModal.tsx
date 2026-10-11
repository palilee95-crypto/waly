// components/CustomerPushNotificationModal.tsx
// Persistent prompt modal in customer section to ensure notifications are enabled
// Will continue to prompt the customer as long as notifications are not turned on

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
import {
  isPushSupported,
  getPushPermissionStatus,
  subscribeToPushNotifications,
  PushPermissionStatus,
} from '@/lib/push-notifications';

export default function CustomerPushNotificationModal() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>('unsupported');
  const [success, setSuccess] = useState(false);
  const [deniedGuide, setDeniedGuide] = useState(false);

  // Subtle pulse animation for glowing bell
  const pulseScale = useRef(new Animated.Value(1)).current;

  const checkStatusAndPrompt = () => {
    if (!isPushSupported()) {
      return;
    }

    const currentStatus = getPushPermissionStatus();
    setPermissionStatus(currentStatus);

    // If already granted, do NOT show popup
    if (currentStatus === 'granted') {
      setVisible(false);
      return;
    }

    // If not granted (default or denied), prompt customer!
    if (currentStatus === 'denied') {
      setDeniedGuide(true);
    } else {
      setDeniedGuide(false);
    }
    setVisible(true);
  };

  useEffect(() => {
    // Initial check with a gentle delay to allow page render
    const timer = setTimeout(() => {
      checkStatusAndPrompt();
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  // Continuous bell pulsation animation
  useEffect(() => {
    if (!visible) return;
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
  }, [visible]);

  const handleEnableNotifications = async () => {
    setLoading(true);
    setDeniedGuide(false);

    try {
      const customerPhone = user?.phone || '';
      const result = await subscribeToPushNotifications({ customerPhone });

      if (result.success) {
        setSuccess(true);
        setPermissionStatus('granted');
        setTimeout(() => {
          setVisible(false);
          setSuccess(false);
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

  const handleDismissTemporary = () => {
    // Closes for this session/action, but since "selagi tak on", next reload or visit prompts again
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDismissTemporary}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, isDesktop && { maxWidth: 440 }]}>
          {success ? (
            // ── SUCCESS CONFIRMATION STATE ──
            <View style={styles.successWrapper}>
              <View style={styles.successIconBox}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Notifikasi Diaktifkan! 🎉</Text>
              <Text style={styles.successSub}>
                Peringatan temujanji 12 jam, 3 jam & 30 minit serta kemas kini setem akan dihantar terus ke peranti ini.
              </Text>
            </View>
          ) : (
            // ── MAIN NOTIFICATION ONBOARDING STATE ──
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
                  onPress={handleDismissTemporary}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Title & Badge */}
              <View style={styles.titleWrap}>
                <View style={styles.pillBadge}>
                  <Text style={styles.pillBadgeText}>PERINGATAN PENTING 🔔</Text>
                </View>
                <Text style={styles.mainTitle}>
                  Aktifkan Notifikasi Temujanji & Ganjaran
                </Text>
                <Text style={styles.mainSubtitle}>
                  Jangan terlepas giliran anda! Dapatkan makluman automatik terus pada skrin telefon anda.
                </Text>
              </View>

              {/* 3 Value Propositions / Features */}
              <View style={styles.benefitsContainer}>
                <View style={styles.benefitRow}>
                  <View style={[styles.benefitIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="time-outline" size={18} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>Peringatan Temujanji</Text>
                    <Text style={styles.benefitDesc}>
                      Alert automatik 12 jam, 3 jam & 30 minit sebelum waktu slot anda.
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitRow}>
                  <View style={[styles.benefitIconBox, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="gift-outline" size={18} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>Ganjaran & Setem NFC</Text>
                    <Text style={styles.benefitDesc}>
                      Makluman serta-merta bila setem bertambah & baucar sedia ditebus.
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitRow}>
                  <View style={[styles.benefitIconBox, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="navigate-outline" size={18} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>Navigasi Mudah</Text>
                    <Text style={styles.benefitDesc}>
                      Pautan terus ke Waze & Google Maps bila giliran anda tiba.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Browser Permission Denied Guide Box */}
              {deniedGuide && (
                <View style={styles.deniedNoticeBox}>
                  <Ionicons name="information-circle" size={18} color="#DC2626" />
                  <Text style={styles.deniedNoticeText}>
                    Notifikasi disekat dalam pelayar. Sila tekan ikon mangga (🔒) di bahagian atas alamat pelayar dan pilih <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}>Allow / Benarkan Notifikasi</Text>.
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
                        Aktifkan Notifikasi Sekarang
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryDismissBtn}
                  onPress={handleDismissTemporary}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={styles.secondaryDismissBtnText}>Nanti Dahulu</Text>
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
