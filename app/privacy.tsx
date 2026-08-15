import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PrivacyPolicyScreen() {
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
            <Text style={styles.brandSubtitle}>Privacy Policy</Text>
          </View>
          <View style={{ width: 60 }} />
        </View>
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
        <View style={[styles.contentCard, isDesktop && { maxWidth: 840, alignSelf: 'center', width: '100%' }]}>
          
          <View style={styles.heroSection}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Last Updated: August 2026</Text>
            </View>
            <Text style={styles.title}>Privacy Policy</Text>
            <Text style={styles.subtitle}>
              At RISEV ("we", "our", or "us"), we are committed to protecting your privacy and personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, mobile application, and use our loyalty & WhatsApp notification services.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>1. Information We Collect</Text>
            <Text style={styles.paragraph}>
              We collect information that you provide directly to us when you create an account, register as a merchant or customer, collect loyalty stamps, redeem vouchers, or communicate with us:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Personal Identifiers:</Text> Name, phone number (+60), email address, and profile avatar.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Merchant Information:</Text> Business name, category, store address, operating hours, GPS coordinates, and branding assets.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Loyalty & Transaction Data:</Text> Stamp balances, points earned, vouchers redeemed, transaction timestamps, and bill totals.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Device & Usage Data:</Text> IP address, browser type, operating system, and push notification tokens.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>2. How We Use Your Information</Text>
            <Text style={styles.paragraph}>
              We use the collected information for the following business purposes:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• Providing, maintaining, and enhancing the RISEV customer loyalty platform.</Text>
              <Text style={styles.bulletItem}>• Tracking and issuing loyalty stamps, points, and reward vouchers accurately.</Text>
              <Text style={styles.bulletItem}>• Delivering transactional and promotional updates via Meta WhatsApp Business Cloud API and Push Notifications.</Text>
              <Text style={styles.bulletItem}>• Preventing fraud, self-issuance abuse, and ensuring platform security.</Text>
              <Text style={styles.bulletItem}>• Managing merchant subscriptions and billing administration.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>3. WhatsApp Cloud API & Meta Platform Compliance</Text>
            <Text style={styles.paragraph}>
              RISEV integrates with the official <Text style={styles.bold}>Meta WhatsApp Business Cloud API</Text> to deliver real-time notifications (such as stamp receipts, voucher unlocks, and authorized store updates):
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Opt-In Consent:</Text> Messages are only sent to customers who have willingly opted in by joining a merchant's loyalty program or scanning a store QR/NFC tag.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Opt-Out Mechanism:</Text> Customers can opt out of WhatsApp communications at any time by replying <Text style={styles.bold}>STOP</Text> to any message or toggling WhatsApp off in their RISEV profile.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Meta Privacy:</Text> WhatsApp message transmission is subject to Meta's Data Policy and WhatsApp Business Terms.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>4. Information Sharing & Disclosure</Text>
            <Text style={styles.paragraph}>
              We do not sell, rent, or trade your personal information. We only share information in the following limited circumstances:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Between Customers and Merchants:</Text> When you join a merchant's loyalty program, that specific merchant can view your name, phone number, and loyalty history with their store.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Service Providers:</Text> Trusted third-party cloud infrastructure (e.g. Meta Graph API, VPS hosting, Resend SMTP) operating under strict data confidentiality.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Legal Compliance:</Text> If required by law, regulation, or legal process.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>5. Data Security & Retention</Text>
            <Text style={styles.paragraph}>
              We implement industry-standard encryption, SSL/TLS transmission protocols, and strict access controls to safeguard your data. Personal data is retained only as long as necessary to provide platform services or comply with statutory requirements.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>6. Your Rights & Data Deletion Requests</Text>
            <Text style={styles.paragraph}>
              In accordance with applicable data protection laws (including the Malaysian Personal Data Protection Act - PDPA):
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• You have the right to access, review, update, or correct your personal data.</Text>
              <Text style={styles.bulletItem}>• You may request complete deletion of your account and associated records at any time by contacting us at <Text style={styles.bold}>support@risev.app</Text>.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeading}>7. Contact Us</Text>
            <Text style={styles.paragraph}>
              If you have any questions, concerns, or requests regarding this Privacy Policy, please contact our Data Protection Team at:
            </Text>
            <View style={styles.contactCard}>
              <Text style={styles.contactTitle}>RISEV Support & Data Protection</Text>
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
