import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import UpgradeModal from './_components/UpgradeModal';

export default function SubscriptionScreen() {
  const router = useRouter();
  const [upgradeModalVisible, setUpgradeModalVisible] = React.useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#050505" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. Hero Status Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="sparkles" size={24} color="#FF9800" />
            </View>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>
          <Text style={styles.planName}>Pro Plan</Text>
          <Text style={styles.planPrice}>$29<Text style={styles.planPricePeriod}> / month</Text></Text>
          
          <View style={styles.heroDivider} />
          
          <View style={styles.renewalRow}>
            <Ionicons name="calendar-outline" size={16} color="#B45309" />
            <Text style={styles.renewalText}>Your plan automatically renews on Oct 1, 2026</Text>
          </View>

          <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.8} onPress={() => setUpgradeModalVisible(true)}>
            <Text style={styles.upgradeBtnText}>Change Plan</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Usage & Limits */}
        <Text style={styles.sectionTitle}>Usage & Limits</Text>
        <View style={styles.bentoGrid}>
          {/* Bento Card: Staff */}
          <View style={styles.bentoSquareCard}>
            <View style={[styles.iconBg, { backgroundColor: '#F1F5F9' }]}>
              <Ionicons name="people-outline" size={20} color="#050505" />
            </View>
            <Text style={styles.bentoValue}>3 <Text style={styles.bentoValueTotal}>/ 5</Text></Text>
            <Text style={styles.bentoLabel}>Active Staff</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '60%', backgroundColor: '#050505' }]} />
            </View>
          </View>

          {/* Bento Card: WhatsApp */}
          <View style={styles.bentoSquareCard}>
            <View style={[styles.iconBg, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
            </View>
            <Text style={styles.bentoValue}>850 <Text style={styles.bentoValueTotal}>/ 1000</Text></Text>
            <Text style={styles.bentoLabel}>Msgs Sent</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '85%', backgroundColor: '#16A34A' }]} />
            </View>
          </View>
          
          {/* Bento Card: NFC */}
          <View style={styles.bentoSquareCard}>
            <View style={[styles.iconBg, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="wifi-outline" size={20} color="#9333EA" />
            </View>
            <Text style={styles.bentoValue}>∞</Text>
            <Text style={styles.bentoLabel}>NFC Cards Issued</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '100%', backgroundColor: '#9333EA' }]} />
            </View>
          </View>
          
          {/* Bento Card: Branches */}
          <View style={styles.bentoSquareCard}>
            <View style={[styles.iconBg, { backgroundColor: '#FEF9C3' }]}>
              <Ionicons name="storefront-outline" size={20} color="#CA8A04" />
            </View>
            <Text style={styles.bentoValue}>1 <Text style={styles.bentoValueTotal}>/ 2</Text></Text>
            <Text style={styles.bentoLabel}>Branches</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '50%', backgroundColor: '#CA8A04' }]} />
            </View>
          </View>
        </View>

        {/* 3. Payment & Billing */}
        <Text style={styles.sectionTitle}>Payment & Billing</Text>
        <View style={styles.listBlock}>
          <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
            <View style={styles.listIconBg}>
              <Ionicons name="card-outline" size={20} color="#050505" />
            </View>
            <View style={styles.listContent}>
              <Text style={styles.listTitle}>Payment Method</Text>
              <Text style={styles.listSubtitle}>Visa ending in 4242</Text>
            </View>
            <Text style={styles.listActionText}>Update</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
            <View style={styles.listIconBg}>
              <Ionicons name="receipt-outline" size={20} color="#050505" />
            </View>
            <View style={styles.listContent}>
              <Text style={styles.listTitle}>Billing History</Text>
              <Text style={styles.listSubtitle}>Download past invoices</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.6}>
          <Text style={styles.cancelBtnText}>Cancel Subscription</Text>
        </TouchableOpacity>

      </ScrollView>

      <UpgradeModal 
        visible={upgradeModalVisible} 
        onClose={() => setUpgradeModalVisible(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F8FAFC',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // To clear the floating gooey nav bar
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#FEF08A',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  planName: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  planPrice: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E293B',
    marginTop: 4,
  },
  planPricePeriod: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 20,
  },
  renewalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  renewalText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginLeft: 10,
    flex: 1,
  },
  upgradeBtn: {
    backgroundColor: '#050505',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  bentoSquareCard: {
    width: '48%', 
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bentoValue: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  bentoValueTotal: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  bentoLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  listBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 32,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  listIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  listSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  listActionText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#3B82F6',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
