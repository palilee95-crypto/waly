import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 100; // Sleeker card width
const CARD_GAP = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

interface PricingCardProps {
  title: string;
  subtitle: string;
  price: string;
  period: string;
  icon: string;
  features: string[];
  buttonText: string;
  isPopular?: boolean;
  accentColor?: string;
  checkBgColor?: string;
  checkIconColor?: string;
}

const PricingCard = ({
  title,
  subtitle,
  price,
  period,
  icon,
  features,
  buttonText,
  isPopular = false,
  accentColor = '#FFC700',
  checkBgColor = '#050505',
  checkIconColor = '#FFFFFF',
}: PricingCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <TouchableOpacity 
      style={[styles.card, isPopular && styles.cardPopular]}
      onPress={() => setIsOpen(!isOpen)}
      activeOpacity={0.9}
    >
      {/* Popular Floating Tag */}
      {isPopular && (
        <View style={[styles.popularTag, { backgroundColor: accentColor }]}>
          <Text style={styles.popularTagText}>Popular</Text>
        </View>
      )}

      {/* Top Header Badge */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBadge}>
            <Ionicons name={icon as any} size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="#64748B" />
      </View>

      {/* Price section */}
      <View style={styles.priceContainer}>
        <Text style={styles.cardPrice}>{price}</Text>
        <Text style={styles.cardPeriod}> / {period}</Text>
      </View>

      {/* Action Button */}
      <TouchableOpacity 
        style={[styles.cardBtn, !isOpen && { marginBottom: 0 }]} 
        activeOpacity={0.8}
        onPress={(e) => {
          e.stopPropagation(); // Prevent toggling expansion when clicking button
          // Trigger upgrade action
        }}
      >
        <Text style={styles.cardBtnText}>{buttonText}</Text>
      </TouchableOpacity>

      {/* Feature List (Toggled) */}
      {isOpen && (
        <View style={styles.featureList}>
          {features.map((feat, idx) => (
            <View key={idx} style={styles.featureRow}>
              <View style={[styles.checkBadge, { backgroundColor: checkBgColor }]}>
                <Ionicons name="checkmark" size={8} color={checkIconColor} />
              </View>
              <Text style={styles.featureText}>{feat}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const [trialEnabled, setTrialEnabled] = useState(true);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#050505" />
          </TouchableOpacity>
          <Text style={styles.mainTitle}>Get Unlimited{'\n'}Access</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Card Stack (Vertical List) */}
          <View style={styles.cardsContainer}>
            {/* Starter Card */}
            <PricingCard 
              title="Starter"
              subtitle="For early-stage shops"
              price="RM 79"
              period="month"
              icon="flash-outline"
              buttonText="Get Started"
              checkBgColor="#050505"
              checkIconColor="#FFFFFF"
              features={[
                'Digital Loyalty Cards',
                'Basic Analytics Dashboard',
                '1 Free NFC VIP Stand',
                'Email support',
                'Up to 100 active customers'
              ]}
            />

            {/* Pro Card (Popular) */}
            <PricingCard 
              title="Pro"
              subtitle="For growing businesses"
              price="RM 99"
              period="month"
              icon="sparkles-outline"
              buttonText="Upgrade now"
              isPopular={true}
              accentColor="#FFC700"
              checkBgColor="#FFC700"
              checkIconColor="#050505"
              features={[
                'Everything in Starter',
                'Up to 5 staff accounts',
                'WhatsApp Automations',
                'Promotional Broadcasts',
                'Priority support',
                'Unlimited active customers'
              ]}
            />

            {/* Enterprise Card */}
            <PricingCard 
              title="Enterprise"
              subtitle="For franchise networks"
              price="RM 349"
              period="month"
              icon="business-outline"
              buttonText="Contact sales"
              checkBgColor="#FFC700"
              checkIconColor="#050505"
              features={[
                'Everything in Pro',
                'Unlimited staff accounts',
                'Multi-Branch Support',
                'Custom integrations',
                '24/7 dedicated support'
              ]}
            />
          </View>

          {/* Bottom Trial Toggle / Actions */}
          <View style={styles.bottomSection}>
            <View style={styles.trialRow}>
              <Text style={styles.trialText}>Start 7-day free trial</Text>
              <Switch 
                value={trialEnabled} 
                onValueChange={setTrialEnabled} 
                trackColor={{ false: '#E2E8F0', true: '#FFC700' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <TouchableOpacity style={styles.guestBtn} onPress={() => router.back()}>
              <Text style={styles.guestBtnText}>Continue as Guest</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Slate-white background to let white cards stand out
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  mainTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    lineHeight: 32,
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  cardsContainer: {
    gap: 24,
    marginBottom: 24,
    paddingTop: 16,
  },
  
  /* Pricing Card Styles */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    position: 'relative',
    width: '100%',
  },
  cardPopular: {
    borderColor: '#FFE082',
    borderWidth: 1.5,
  },
  popularTag: {
    position: 'absolute',
    top: -10,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    transform: [{ rotate: '4deg' }],
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  popularTagText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    textTransform: 'uppercase',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  cardSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: -2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  cardPrice: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.5,
  },
  cardPeriod: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  cardBtn: {
    backgroundColor: '#050505',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  featureList: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  featureText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    flex: 1,
  },

  /* Bottom Section */
  bottomSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    marginTop: 20, // Add top margin to separate it from the card stack
  },
  trialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  trialText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  guestBtn: {
    backgroundColor: '#050505',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
