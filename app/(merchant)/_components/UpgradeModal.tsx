import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type UpgradeModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function UpgradeModal({ visible, onClose }: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

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
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="infinite" size={28} color="#FF9800" />
            </View>
            <Text style={styles.title}>Risev Pro</Text>
            <Text style={styles.subtitle}>Save 20% with the Yearly plan</Text>
          </View>

          {/* Pricing Toggle */}
          <View style={styles.cardsContainer}>
            
            {/* Monthly Card */}
            <TouchableOpacity 
              style={[
                styles.card, 
                selectedPlan === 'monthly' ? styles.cardSelected : styles.cardUnselected
              ]}
              onPress={() => setSelectedPlan('monthly')}
              activeOpacity={0.9}
            >
              <View style={styles.cardTop}>
                <Text style={styles.planDuration}>1 month</Text>
                <Text style={styles.planPrice}>$29.00</Text>
              </View>
              <View style={[
                styles.cardBottom,
                selectedPlan === 'monthly' ? styles.cardBottomSelected : styles.cardBottomUnselected
              ]}>
                <Text style={[
                  styles.cardBottomText,
                  selectedPlan === 'monthly' ? styles.cardBottomTextSelected : styles.cardBottomTextUnselected
                ]}>$29.00 /mo</Text>
              </View>
            </TouchableOpacity>

            {/* Yearly Card */}
            <TouchableOpacity 
              style={[
                styles.card, 
                selectedPlan === 'yearly' ? styles.cardSelected : styles.cardUnselected
              ]}
              onPress={() => setSelectedPlan('yearly')}
              activeOpacity={0.9}
            >
              {/* Overlapping Badge */}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Save 20%</Text>
              </View>
              
              <View style={[styles.cardTop, { paddingTop: 24 }]}>
                <Text style={styles.planDuration}>1 year</Text>
                <Text style={styles.planPrice}>$278.00</Text>
              </View>
              <View style={[
                styles.cardBottom,
                selectedPlan === 'yearly' ? styles.cardBottomSelected : styles.cardBottomUnselected
              ]}>
                <Text style={[
                  styles.cardBottomText,
                  selectedPlan === 'yearly' ? styles.cardBottomTextSelected : styles.cardBottomTextUnselected
                ]}>$23.00 /mo</Text>
              </View>
            </TouchableOpacity>

          </View>

          {/* Action */}
          <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.8} onPress={onClose}>
            <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
          </TouchableOpacity>

          {/* Footer Text */}
          <Text style={styles.disclaimer}>
            Recurring billing, cancel anytime. Save 20% with Yearly plan compared to Monthly. Subscription auto-renews at same price until cancelled via App Store Settings.{'\n'}
            <Text style={styles.linkText}>Terms & Conditions</Text> & <Text style={styles.linkText}>Privacy Policy apply.</Text>
          </Text>

          <SafeAreaView />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 2,
    overflow: 'visible',
    marginTop: 12, // space for badge
  },
  cardUnselected: {
    borderColor: 'transparent',
    backgroundColor: '#F8FAFC',
  },
  cardSelected: {
    borderColor: '#FF9800',
    backgroundColor: '#FFFFFF',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTop: {
    padding: 20,
    alignItems: 'center',
  },
  planDuration: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  cardBottom: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  cardBottomUnselected: {
    backgroundColor: '#F1F5F9',
  },
  cardBottomSelected: {
    backgroundColor: '#FFC700',
  },
  cardBottomText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  cardBottomTextUnselected: {
    color: '#94A3B8',
  },
  cardBottomTextSelected: {
    color: '#050505',
  },
  badge: {
    position: 'absolute',
    top: -14,
    alignSelf: 'center',
    backgroundColor: '#050505',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  badgeText: {
    color: '#FFC700',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  upgradeBtn: {
    backgroundColor: '#050505',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  disclaimer: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  linkText: {
    color: '#64748B',
    textDecorationLine: 'underline',
  },
});
