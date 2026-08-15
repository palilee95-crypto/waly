import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.brandGroup}>
            <Text style={styles.brandTitle}>RISEV</Text>
            <Text style={styles.brandSubtitle}>Terms of Service</Text>
          </View>
          <View style={{ width: 60 }} />
        </View>
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
        <View style={[styles.contentCard, isDesktop && { maxWidth: 840, alignSelf: 'center', width: '100%' }]}>
          
          <View style={styles.heroSection}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Effective: August 2026</Text>
            </View>
            <Text style={styles.title}>Terms of Service</Text>
            <Text style={styles.subtitle}>
              These Terms of Service ("Terms") govern your access to and use of RISEV’s mobile application, web services, and merchant loyalty solutions provided by RISEV ("we", "us", or "our").
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>1. Acceptance of Terms</Text>
            <Text style={styles.paragraph}>
              By accessing or using RISEV (as a merchant, customer, or visitor), you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, please do not use our services.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>2. Service Overview</Text>
            <Text style={styles.paragraph}>
              RISEV provides a digital customer loyalty and marketing platform that allows:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Customers:</Text> To collect digital stamps, earn reward points, store membership passes, and redeem reward vouchers.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Merchants:</Text> To create loyalty cards, issue stamps, manage customer records, staff members, and send authorized marketing/transactional notifications via Meta WhatsApp Business Cloud API.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>3. WhatsApp Cloud API & Messaging Acceptable Use</Text>
            <Text style={styles.paragraph}>
              Merchants utilizing our WhatsApp Cloud API integration must strictly comply with the following standards and Meta’s WhatsApp Business Messaging Policy:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Explicit Opt-In Required:</Text> Broadcasts and automation messages may only be delivered to customers who have legitimately opted in by registering for your store's loyalty program or scanning your in-store code.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Zero Tolerance for Spam:</Text> Unsolicited cold messaging, deceptive promotions, or harassment will result in immediate suspension of your merchant account.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Honor Opt-Outs:</Text> If a customer requests to stop receiving messages or replies with STOP, their opt-out must be immediately respected.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>4. Merchant Subscriptions & Payments</Text>
            <Text style={styles.paragraph}>
              Merchants access Pro features via subscription plans. Subscriptions are billed in advance for the selected term (1, 3, 6, 9, or 12 months). All fees paid are non-refundable once the billing period has commenced, except where mandated by applicable law.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>5. Account Responsibility & Fraud Prevention</Text>
            <Text style={styles.paragraph}>
              You are responsible for maintaining the confidentiality of your account credentials. Merchants and staff must not engage in fraudulent stamp issuance or self-issuance abuse. RISEV reserves the right to audit loyalty activity and terminate abusive accounts without prior notice.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>6. Intellectual Property</Text>
            <Text style={styles.paragraph}>
              All platform design, software, interfaces, trademarks, and branding of RISEV remain the exclusive property of RISEV. Merchants retain ownership of their respective store logos and business trademarks uploaded to the platform.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>7. Limitation of Liability</Text>
            <Text style={styles.paragraph}>
              RISEV provides the platform on an "AS IS" and "AS AVAILABLE" basis. To the maximum extent permitted by law, RISEV shall not be liable for any indirect, incidental, special, or consequential damages arising out of your use of or inability to use the platform.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>8. Governing Law</Text>
            <Text style={styles.paragraph}>
              These Terms shall be governed by and construed in accordance with the laws of Malaysia, without regard to its conflict of law provisions.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>9. Contact Us</Text>
            <Text style={styles.paragraph}>
              For any questions regarding these Terms of Service, please reach out to:
            </Text>
            <View style={styles.contactCard}>
              <Text style={styles.contactTitle}>RISEV Legal & Support</Text>
              <Text style={styles.contactEmail}>Email: support@risev.app</Text>
              <Text style={styles.contactUrl}>Website: https://risev.app</Text>
            </View>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  backBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  brandGroup: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  scrollContent: {
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  heroSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 24,
    marginBottom: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#3B82F6',
  },
  title: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 22,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeading: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletList: {
    gap: 8,
    paddingLeft: 8,
  },
  bulletItem: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    lineHeight: 20,
  },
  bold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  contactCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginTop: 8,
    gap: 4,
  },
  contactTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  contactEmail: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#3B82F6',
  },
  contactUrl: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
});
