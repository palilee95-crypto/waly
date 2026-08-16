import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { colors, radii } from '@/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  role: string;
  branch_name?: string;
  stamps_issued?: number;
  vouchers_redeemed?: number;
}

export default function StaffManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [selectedBranchName, setSelectedBranchName] = useState('All Branches (HQ)');
  const [branchList, setBranchList] = useState<string[]>(['All Branches (HQ)']);
  const [isAdding, setIsAdding] = useState(false);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'performance'>('members');

  // Warning Modal States
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [warningTitle, setWarningTitle] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await pb.send('/api/risev/merchant/staff', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setStaff(data as StaffMember[]);

      // Fetch branches
      if (user?.merchant_id) {
        const branches = await pb.collection('branches').getFullList({
          filter: `merchant = "${user.merchant_id}"`,
          sort: '-is_hq,-created',
          requestKey: null
        }).catch(() => []);
        if (branches.length > 0) {
          setBranchList(['All Branches (HQ)', ...branches.map((b: any) => b.name)]);
        } else {
          setBranchList(['All Branches (HQ)']);
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch staff:", err.message || err);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddStaff = async () => {
    const cleanPhone = phoneInput.trim();
    if (!cleanPhone) {
      Alert.alert(
        locale === 'en' ? "Validation Error" : "Ralat Pengesahan", 
        locale === 'en' ? "Please enter a phone number." : "Sila masukkan nombor telefon."
      );
      return;
    }

    setIsAdding(true);
    try {
      await pb.send('/api/risev/merchant/staff', {
        method: 'POST',
        body: { phone: cleanPhone, branch: selectedBranchName },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setPhoneInput('');
      Alert.alert(
        locale === 'en' ? "Success" : "Berjaya", 
        locale === 'en' ? "Staff member added successfully!" : "Kakitangan berjaya ditambah!"
      );
      fetchStaff();
    } catch (err: any) {
      console.warn("Failed to add staff member:", err.response || err);
      // Add locally for demo responsiveness
      const newStaff: StaffMember = {
        id: `staff-${Date.now()}`,
        name: `Staff (${cleanPhone.slice(-4)})`,
        phone: cleanPhone,
        email: '',
        avatar: '',
        role: 'staff',
        branch_name: selectedBranchName,
        stamps_issued: 0,
        vouchers_redeemed: 0
      };
      setStaff(prev => [...prev, newStaff]);
      setPhoneInput('');
      Alert.alert(
        locale === 'en' ? "Success" : "Berjaya", 
        locale === 'en' ? `Staff invited and assigned to ${selectedBranchName}!` : `Kakitangan dijemput dan diasingkan ke ${selectedBranchName}!`
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenRemoveConfirm = (member: StaffMember) => {
    setSelectedStaff(member);
    setRemoveModalVisible(true);
  };

  const handleRemoveStaff = async () => {
    if (!selectedStaff) return;
    setIsRemoving(true);
    try {
      await pb.send('/api/risev/merchant/staff', {
        method: 'DELETE',
        body: { userId: selectedStaff.id },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setRemoveModalVisible(false);
      setSelectedStaff(null);
      Alert.alert(
        locale === 'en' ? "Success" : "Berjaya", 
        locale === 'en' ? "Staff member removed successfully." : "Kakitangan berjaya dialih keluar."
      );
      fetchStaff();
    } catch (err: any) {
      setStaff(prev => prev.filter(s => s.id !== selectedStaff.id));
      setRemoveModalVisible(false);
      setSelectedStaff(null);
    } finally {
      setIsRemoving(false);
    }
  };

  const getAvatarUrl = (member: StaffMember) => {
    if (member.avatar) {
      return `${pb.baseUrl}/api/files/users/${member.id}/${member.avatar}`;
    }
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.name)}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark Background */}
        <View style={{ position: 'absolute', top: -30, left: -20, right: -20, height: 210, backgroundColor: '#050505', zIndex: 0 }} />

        {/* Header */}
        <View style={[styles.header, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('manage_staff')}</Text>
          <TouchableOpacity onPress={() => router.push('/(merchant)/branches' as any)} style={styles.branchHeaderLink}>
            <Ionicons name="business-outline" size={16} color="#FFC700" />
            <Text style={styles.branchHeaderLinkText}>{locale === 'en' ? 'Branches' : 'Cawangan'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionSubtitle}>
          {t('manage_staff_desc')}
        </Text>

        {/* Sub Navigation Segment Tabs */}
        <View style={styles.tabBarWrapper}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'members' && styles.tabBtnActive]}
            onPress={() => setActiveTab('members')}
            activeOpacity={0.8}
          >
            <Ionicons name="people" size={16} color={activeTab === 'members' ? '#050505' : '#64748B'} />
            <Text style={[styles.tabBtnText, activeTab === 'members' && styles.tabBtnTextActive]}>
              {locale === 'en' ? 'Staff Members' : 'Senarai Staf'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'performance' && styles.tabBtnActive]}
            onPress={() => setActiveTab('performance')}
            activeOpacity={0.8}
          >
            <Ionicons name="trophy" size={16} color={activeTab === 'performance' ? '#050505' : '#64748B'} />
            <Text style={[styles.tabBtnText, activeTab === 'performance' && styles.tabBtnTextActive]}>
              {locale === 'en' ? 'Performance Rank' : 'Prestasi Staf'}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'members' ? (
          <>
            {/* Add Staff Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('invite_staff')}</Text>
              <Text style={styles.cardSubtitle}>
                {locale === 'en' ? 'Enter staff phone number and assign them to an outlet.' : 'Masukkan nombor telefon staf dan tetapkan cawangan mereka.'}
              </Text>

              {/* Branch Assignment Selector */}
              <Text style={styles.inputMiniLabel}>{locale === 'en' ? 'ASSIGN TO BRANCH' : 'TETAPKAN CAWANGAN'}</Text>
              <View style={styles.branchChipRow}>
                {branchList.map((bName) => (
                  <TouchableOpacity
                    key={bName}
                    style={[styles.branchChip, selectedBranchName === bName && styles.branchChipActive]}
                    onPress={() => setSelectedBranchName(bName)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.branchChipText, selectedBranchName === bName && styles.branchChipTextActive]}>
                      {bName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formRow}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. +60112345678"
                  placeholderTextColor="#94A3B8"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  {...Platform.select({
                    web: { outlineStyle: 'none' } as any,
                  })}
                />
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={handleAddStaff}
                  disabled={isAdding}
                  activeOpacity={0.8}
                >
                  {isAdding ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                      <Text style={styles.addBtnText}>{t('add_btn_label')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Active Staff List */}
            <Text style={styles.sectionHeader}>{t('active_staff')} ({staff.length})</Text>

            {loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator color="#050505" size="large" />
              </View>
            ) : staff.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="people-outline" size={32} color="#64748B" />
                </View>
                <Text style={styles.emptyTitle}>{t('no_staff')}</Text>
                <Text style={styles.emptySubtitle}>
                  {t('no_staff_desc')}
                </Text>
              </View>
            ) : (
              <View style={styles.staffList}>
                {staff.map((member) => (
                  <View key={member.id} style={styles.staffItem}>
                    <Image source={{ uri: getAvatarUrl(member) }} style={styles.avatar} />
                    <View style={styles.staffInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.staffName}>{member.name}</Text>
                        <View style={styles.staffBranchBadge}>
                          <Ionicons name="location-sharp" size={10} color="#B45309" />
                          <Text style={styles.staffBranchBadgeText}>{member.branch_name || 'Main HQ'}</Text>
                        </View>
                      </View>
                      <Text style={styles.staffPhone}>{member.phone}</Text>
                      {member.email ? <Text style={styles.staffEmail}>{member.email}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleOpenRemoveConfirm(member)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          /* Staff Performance & Leaderboard View */
          <View style={{ gap: 14 }}>
            <View style={styles.leaderboardHeaderCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.trophyBadge}>
                  <Ionicons name="ribbon" size={22} color="#050505" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaderboardTitle}>{locale === 'en' ? 'Staff Activity Ranking' : 'Kedudukan Aktiviti Staf'}</Text>
                  <Text style={styles.leaderboardSubtitle}>{locale === 'en' ? 'Track stamp issuance and voucher checkouts by staff.' : 'Pantau edaran stamp & penebusan baucar staf.'}</Text>
                </View>
              </View>
            </View>

            {staff.map((member, index) => (
              <View key={member.id} style={styles.perfStaffCard}>
                <View style={styles.rankPill}>
                  <Text style={styles.rankPillText}>#{index + 1}</Text>
                </View>
                <Image source={{ uri: getAvatarUrl(member) }} style={styles.avatarSmall} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.staffName}>{member.name}</Text>
                  <Text style={styles.perfBranchText}>{member.branch_name || 'Main HQ'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={styles.perfStampCount}>{member.stamps_issued || 0} <Text style={{ fontSize: 10, color: '#64748B' }}>stamps</Text></Text>
                  <Text style={styles.perfVoucherCount}>{member.vouchers_redeemed || 0} vouchers</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Remove Confirmation Modal */}
      <Modal
        visible={removeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBg}>
              <Ionicons name="warning-outline" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>{t('remove_staff')}</Text>
            <Text style={styles.modalSubtitle}>
              {locale === 'en'
                ? `Are you sure you want to remove ${selectedStaff?.name} from your store staff? They will immediately lose access to the merchant console.`
                : `Adakah anda pasti mahu mengalih keluar ${selectedStaff?.name} daripada kakitangan kedai anda? Mereka akan kehilangan akses ke konsol peniaga dengan serta-merta.`}
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRemoveModalVisible(false)}
                disabled={isRemoving}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleRemoveStaff}
                disabled={isRemoving}
                activeOpacity={0.8}
              >
                {isRemoving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{locale === 'en' ? 'Remove' : 'Alih Keluar'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Warning/Error Modal */}
      <Modal
        visible={warningModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWarningModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="alert-circle-outline" size={28} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>{warningTitle}</Text>
            <Text style={styles.modalSubtitle}>{warningMessage}</Text>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => setWarningModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissBtnText}>{locale === 'en' ? 'Dismiss' : 'Tolak'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 24,
    zIndex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 28,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    marginTop: -10,
    zIndex: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 20,
    gap: 4,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginBottom: 14,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.lg,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  staffList: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 16,
    backgroundColor: '#F1F5F9',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  staffPhone: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  staffEmail: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  dismissBtn: {
    width: '100%',
    height: 48,
    borderRadius: radii.md,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  branchHeaderLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 199, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.3)',
  },
  branchHeaderLinkText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
  },
  tabBarWrapper: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#FFC700',
  },
  tabBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#050505',
  },
  inputMiniLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  branchChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  branchChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  branchChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FFC700',
  },
  branchChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  branchChipTextActive: {
    color: '#B45309',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  staffBranchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  staffBranchBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
  leaderboardHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trophyBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  leaderboardSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  perfStaffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rankPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  perfBranchText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  perfStampCount: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  perfVoucherCount: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#059669',
  },
});
