import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SafeAreaView, Dimensions, Platform, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

type UpgradeModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function UpgradeModal({ visible, onClose }: UpgradeModalProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

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
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Image 
                  source={require('../../../assets/risev logo.png')} 
                  style={{ height: 34, width: 115, resizeMode: 'contain', tintColor: '#FFFFFF' }} 
                />
                <View style={{ backgroundColor: '#FFC700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: 1 }}>PRO</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>Unlock full automation & limitless growth</Text>
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
                  <Text style={styles.planPrice}>RM 78</Text>
                </View>
                <View style={[
                  styles.cardBottom,
                  selectedPlan === 'monthly' ? styles.cardBottomSelected : styles.cardBottomUnselected
                ]}>
                  <Text style={[
                    styles.cardBottomText,
                    selectedPlan === 'monthly' ? styles.cardBottomTextSelected : styles.cardBottomTextUnselected
                  ]}>RM 78 /mo</Text>
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
                <LinearGradient
                  colors={['#FFD700', '#F59E0B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.badge}
                >
                  <Text style={styles.badgeText}>SAVE 20%</Text>
                </LinearGradient>
                
                <View style={[styles.cardTop, { paddingTop: 24 }]}>
                  <Text style={styles.planDuration}>1 year</Text>
                  <Text style={styles.planPrice}>RM 748</Text>
                </View>
                <View style={[
                  styles.cardBottom,
                  selectedPlan === 'yearly' ? styles.cardBottomSelected : styles.cardBottomUnselected
                ]}>
                  <Text style={[
                    styles.cardBottomText,
                    selectedPlan === 'yearly' ? styles.cardBottomTextSelected : styles.cardBottomTextUnselected
                  ]}>RM 62.33 /mo</Text>
                </View>
              </TouchableOpacity>

            </View>

            {/* Features Included Section */}
            <View style={styles.featuresCard}>
              <Text style={styles.featuresHeaderTitle}>FEATURES INCLUDED:</Text>
              
              <View style={styles.featuresList}>
                <View style={styles.featureRow}>
                  <View style={styles.checkWrap}>
                    <Ionicons name="checkmark" size={12} color="#FFC700" />
                  </View>
                  <Text style={styles.featureText}>Everything in Starter</Text>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.checkWrap}>
                    <Ionicons name="checkmark" size={12} color="#FFC700" />
                  </View>
                  <Text style={styles.featureText}>
                    Unlimited customer database <Text style={{ color: '#FFC700', fontFamily: 'PlusJakartaSans_800ExtraBold' }}>∞</Text>
                  </Text>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.checkWrap}>
                    <Ionicons name="checkmark" size={12} color="#FFC700" />
                  </View>
                  <Text style={styles.featureText}>Up to 2 store outlets (1 HQ + 1 Branch)</Text>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.checkWrap}>
                    <Ionicons name="checkmark" size={12} color="#FFC700" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                    <Text style={styles.featureText}>Official Meta WhatsApp Automation</Text>
                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeText}>META API</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.checkWrap}>
                    <Ionicons name="checkmark" size={12} color="#FFC700" />
                  </View>
                  <Text style={styles.featureText}>Promotional WhatsApp Broadcasts</Text>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.checkWrap}>
                    <Ionicons name="checkmark" size={12} color="#FFC700" />
                  </View>
                  <Text style={styles.featureText}>Pro Sales & Opportunity Analytics</Text>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.checkWrap}>
                    <Ionicons name="checkmark" size={12} color="#FFC700" />
                  </View>
                  <Text style={styles.featureText}>Unlimited active vouchers</Text>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.checkWrap}>
                    <Ionicons name="checkmark" size={12} color="#FFC700" />
                  </View>
                  <Text style={styles.featureText}>Up to 5 staff accounts</Text>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.checkWrap}>
                    <Ionicons name="checkmark" size={12} color="#FFC700" />
                  </View>
                  <Text style={styles.featureText}>Priority WhatsApp support</Text>
                </View>
              </View>
            </View>

            {/* Action */}
            <TouchableOpacity 
              style={styles.upgradeBtnContainer} 
              activeOpacity={0.8} 
              onPress={handleUpgrade}
            >
              <LinearGradient
                  colors={['#FACC15', '#EAB308']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.upgradeBtn}
              >
                <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Footer Text */}
            <Text style={styles.disclaimer}>
              System subscription only. NFC VIP stands sold separately.{'\n'}
              Recurring billing, cancel anytime. Save 20% with Yearly plan.{'\n'}
              <Text style={styles.linkText}>Terms & Conditions</Text> & <Text style={styles.linkText}>Privacy Policy apply.</Text>
            </Text>
          </ScrollView>

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
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    maxHeight: '88%',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#3F3F46',
    borderRadius: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#A1A1AA',
    textAlign: 'center',
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'visible',
    marginTop: 10, 
  },
  cardUnselected: {
    borderColor: '#27272A',
    backgroundColor: '#141416',
  },
  cardSelected: {
    borderColor: '#FFC700',
    backgroundColor: '#18181B',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTop: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  planDuration: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#A1A1AA',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  cardBottom: {
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  cardBottomUnselected: {
    backgroundColor: '#1E1E22',
  },
  cardBottomSelected: {
    backgroundColor: 'rgba(255, 199, 0, 0.12)',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.2)',
  },
  cardBottomText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  cardBottomTextUnselected: {
    color: '#71717A',
  },
  cardBottomTextSelected: {
    color: '#FFC700',
  },
  badge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  badgeText: {
    color: '#050505',
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  featuresCard: {
    backgroundColor: '#121215',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    marginBottom: 20,
  },
  featuresHeaderTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#71717A',
    letterSpacing: 0.8,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  featuresList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 199, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#E4E4E7',
  },
  metaBadge: {
    backgroundColor: 'rgba(255, 199, 0, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 199, 0, 0.3)',
  },
  metaBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
    letterSpacing: 0.5,
  },
  upgradeBtnContainer: {
    width: '100%',
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  upgradeBtn: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  disclaimer: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#52525B',
    textAlign: 'center',
    lineHeight: 15,
  },
  linkText: {
    textDecorationLine: 'underline',
    color: '#71717A',
  },
});

