import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

type BookingAccessModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function BookingAccessModal({ visible, onClose }: BookingAccessModalProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    onClose();
    router.push('/(merchant)/subscription' as any);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Top Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header Icon & Badges */}
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar" size={28} color="#D97706" />
                <View style={styles.sparkleBadge}>
                  <Ionicons name="sparkles" size={12} color="#000" />
                </View>
              </View>

              <View style={styles.titleRow}>
                <Text style={styles.title}>Smart Booking Management</Text>
                <View style={styles.badgePro}>
                  <Text style={styles.badgeProText}>PRO ADD-ON ⚡</Text>
                </View>
              </View>

              <Text style={styles.subtitle}>
                Unlock complete online appointment booking & customized customer storefront PWA.
              </Text>
            </View>

            {/* Feature Cards Grid */}
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <View style={[styles.featureIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureItemTitle}>24/7 Online Booking Engine</Text>
                  <Text style={styles.featureItemDesc}>
                    Let customers pick services, providers, and real-time open slots anytime.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIconWrap, { backgroundColor: '#FDF2F8' }]}>
                  <Ionicons name="globe-outline" size={20} color="#DB2777" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureItemTitle}>Dedicated Storefront PWA</Text>
                  <Text style={styles.featureItemDesc}>
                    Your branded web app with custom store cover, logo, colors & direct URL.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIconWrap, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="people-outline" size={20} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureItemTitle}>Staff & Branch Scheduling</Text>
                  <Text style={styles.featureItemDesc}>
                    Assign team members, set buffer times between appointments & deposit rules.
                  </Text>
                </View>
              </View>
            </View>

            {/* Pricing Callout Banner */}
            <View style={styles.calloutCard}>
              <Ionicons name="information-circle" size={20} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.calloutText}>
                  Included in the <Text style={styles.calloutBold}>PRO Plan (RM97/mo)</Text> or as an active add-on. Starter & Stand Bundle users can upgrade instantly.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={handleUpgrade}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#FFC700', '#F59E0B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeGradient}
              >
                <Ionicons name="flash" size={16} color="#000" />
                <Text style={styles.upgradeBtnText}>Upgrade to PRO ➔</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnDismiss} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.btnDismissText}>Maybe Later</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  header: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFBEA',
    borderWidth: 2,
    borderColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  sparkleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFC700',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  badgePro: {
    backgroundColor: '#FFC700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeProText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  featuresContainer: {
    gap: 10,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureItemTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  featureItemDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 15,
  },
  calloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    marginBottom: 20,
  },
  calloutText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#92400E',
    lineHeight: 16,
  },
  calloutBold: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#78350F',
  },
  upgradeBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  upgradeBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  btnDismiss: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnDismissText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
});
