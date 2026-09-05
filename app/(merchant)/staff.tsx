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
  Image,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { colors, radii } from '@/theme';
import { useRouter } from 'expo-router';
import { useAuth, StaffPermissions, defaultStaffPermissions } from '@/context/AuthContext';
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
  customers_served?: number;
  sales_volume?: number;
  rank?: number;
}

export default function StaffManagementScreen() {
  const router = useRouter();
  const { user, fetchStaffPermissions } = useAuth();
  const { t, locale } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [selectedBranchName, setSelectedBranchName] = useState('All Branches (HQ)');
  const [branchList, setBranchList] = useState<string[]>(['All Branches (HQ)']);
  const [isAdding, setIsAdding] = useState(false);
  const [addNameModalVisible, setAddNameModalVisible] = useState(false);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'performance' | 'settings'>('members');

  // Performance State
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [sortBy, setSortBy] = useState<'stamps' | 'sales' | 'customers'>('stamps');
  const [topPerformer, setTopPerformer] = useState<StaffMember | null>(null);
  const [summary, setSummary] = useState<any>(null);

  // Permissions State
  const [permissionsState, setPermissionsState] = useState<StaffPermissions>(defaultStaffPermissions);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Warning Modal States
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [warningTitle, setWarningTitle] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  const fetchStaff = async (tFrame = timeframe, sBy = sortBy) => {
    if (!user || !user.merchant_id) return;
    try {
      setLoading(true);
      const res = await pb.send<{
        staff: StaffMember[];
        top_performer?: StaffMember | null;
        summary?: any;
      }>(`/api/risev/merchant/staff?timeframe=${tFrame}&sort_by=${sBy}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      if (res && res.staff) {
        setStaff(res.staff);
        setTopPerformer(res.top_performer || null);
        setSummary(res.summary || null);
      }

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

  const fetchPermissions = async () => {
    if (!user?.merchant_id) return;
    try {
      setLoadingPermissions(true);
      // Fetch directly from merchant record in PocketBase SDK
      const mRec = await pb.collection('merchants').getOne(user.merchant_id, { requestKey: null });
      const rawPerms = mRec?.metadata?.staff_permissions;
      if (rawPerms) {
        setPermissionsState({
          can_view_analytics: !!rawPerms.can_view_analytics,
          can_view_marketing: !!rawPerms.can_view_marketing,
          can_manage_rewards: !!rawPerms.can_manage_rewards,
          can_manage_customers: !!rawPerms.can_manage_customers,
          can_edit_store_profile: !!rawPerms.can_edit_store_profile,
          can_manage_branches: !!rawPerms.can_manage_branches,
        });
      }
    } catch (err) {
      console.warn("Failed to fetch staff permissions:", err);
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (activeTab === 'performance') {
      fetchStaff(timeframe, sortBy);
    }
  }, [activeTab, timeframe, sortBy]);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchPermissions();
    }
  }, [activeTab]);

  const handleTogglePermission = async (key: keyof StaffPermissions, val: boolean) => {
    const updated = { ...permissionsState, [key]: val };
    setPermissionsState(updated);
    try {
      setSavingPermissions(true);
      const res = await pb.send<{ message: string; permissions?: StaffPermissions }>('/api/risev/merchant/staff/permissions', {
        method: 'POST',
        body: { permissions: updated },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      if (res?.permissions) {
        setPermissionsState(res.permissions);
      }
      if (fetchStaffPermissions) {
        fetchStaffPermissions();
      }
    } catch (err: any) {
      console.warn("Failed to save staff permissions:", err);
      Alert.alert(
        locale === 'en' ? "Error" : "Ralat",
        err?.data?.message || err?.message || (locale === 'en' ? "Failed to save permissions." : "Gagal menyimpan kebenaran.")
      );
      fetchPermissions();
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleOpenAddModal = () => {
    const cleanPhone = phoneInput.trim();
    if (!cleanPhone) {
      Alert.alert(
        locale === 'en' ? "Validation Error" : "Ralat Pengesahan", 
        locale === 'en' ? "Please enter a phone number." : "Sila masukkan nombor telefon."
      );
      return;
    }
    const digits = cleanPhone.replace(/\D/g, '');
    if (digits.length < 8) {
      Alert.alert(
        locale === 'en' ? "Invalid Phone" : "Nombor Tidak Sah", 
        locale === 'en' ? "Please enter a valid phone number." : "Sila masukkan nombor telefon yang sah."
      );
      return;
    }
    setAddNameModalVisible(true);
  };

  const handleConfirmAddStaff = async () => {
    const cleanPhone = phoneInput.trim();
    if (!cleanPhone) return;

    setIsAdding(true);
    try {
      await pb.send('/api/risev/merchant/staff', {
        method: 'POST',
        body: { 
          phone: cleanPhone, 
          name: nameInput.trim(),
          branch: selectedBranchName 
        },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setAddNameModalVisible(false);
      setPhoneInput('');
      setNameInput('');
      Alert.alert(
        locale === 'en' ? "Success" : "Berjaya", 
        locale === 'en' ? "Staff member added successfully!" : "Kakitangan berjaya ditambah!"
      );
      fetchStaff();
    } catch (err: any) {
      console.warn("Failed to add staff member:", err.response || err);
      const errMsg = err?.data?.message || err?.response?.message || err?.message || (locale === 'en' ? "Failed to add staff member." : "Gagal menambah kakitangan.");
      setAddNameModalVisible(false);
      setWarningTitle(locale === 'en' ? "Unable to Add Staff" : "Tidak Dapat Menambah Kakitangan");
      setWarningMessage(errMsg);
      setWarningModalVisible(true);
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
      const errMsg = err?.data?.message || err?.response?.message || err?.message || (locale === 'en' ? "Failed to remove staff member." : "Gagal membuang kakitangan.");
      Alert.alert(locale === 'en' ? "Error" : "Ralat", errMsg);
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('manage_staff')}</Text>
          </View>
          <Image 
            source={require('../../assets/risev logo.png')}
            style={{ width: 85, height: 26, resizeMode: 'contain', tintColor: '#FFFFFF' }}
          />
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

          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'settings' && styles.tabBtnActive]}
            onPress={() => setActiveTab('settings')}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-checkmark" size={16} color={activeTab === 'settings' ? '#050505' : '#64748B'} />
            <Text style={[styles.tabBtnText, activeTab === 'settings' && styles.tabBtnTextActive]}>
              {locale === 'en' ? 'Permissions' : 'Kebenaran'}
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

              <Text style={styles.inputMiniLabel}>{locale === 'en' ? 'PHONE NUMBER' : 'NOMBOR TELEFON'}</Text>
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
                  onPress={handleOpenAddModal}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.addBtnText}>{t('add_btn_label')}</Text>
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
        ) : activeTab === 'performance' ? (
          /* Staff Performance & Leaderboard View */
          <View style={{ gap: 16 }}>
            {/* Header Banner Card with Total Overview */}
            <View style={styles.leaderboardHeaderCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.trophyBadge}>
                  <Ionicons name="trophy" size={22} color="#050505" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaderboardTitle}>
                    {locale === 'en' ? 'Staff Performance Leaderboard' : 'Papan Pendahulu Prestasi Staf'}
                  </Text>
                  <Text style={styles.leaderboardSubtitle}>
                    {locale === 'en'
                      ? 'Recognize top contributors and motivate team loyalty delivery.'
                      : 'Iktiraf penyumbang terbaik dan dorong kejayaan program kesetiaan.'}
                  </Text>
                </View>
              </View>

              {/* Summary Stats Row */}
              {summary && (
                <View style={styles.summaryStatsRow}>
                  <View style={styles.summaryStatBox}>
                    <Text style={styles.summaryStatLabel}>{locale === 'en' ? 'Stamps Issued' : 'Cop Dikeluarkan'}</Text>
                    <Text style={styles.summaryStatValue}>{summary.total_stamps || 0}</Text>
                  </View>
                  <View style={styles.summaryStatDivider} />
                  <View style={styles.summaryStatBox}>
                    <Text style={styles.summaryStatLabel}>{locale === 'en' ? 'Sales Volume' : 'Jumlah Jualan'}</Text>
                    <Text style={styles.summaryStatValue}>RM {(summary.total_sales || 0).toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryStatDivider} />
                  <View style={styles.summaryStatBox}>
                    <Text style={styles.summaryStatLabel}>{locale === 'en' ? 'Served' : 'Dilayan'}</Text>
                    <Text style={styles.summaryStatValue}>{summary.total_customers_served || 0}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Timeframe Filter Bar */}
            <View style={styles.filterSection}>
              <View style={styles.timeframePillRow}>
                {[
                  { id: 'today', labelEn: 'Today', labelMs: 'Hari Ini' },
                  { id: 'week', labelEn: 'This Week', labelMs: 'Minggu Ini' },
                  { id: 'month', labelEn: 'This Month', labelMs: 'Bulan Ini' },
                  { id: 'all', labelEn: 'All Time', labelMs: 'Sepanjang Masa' },
                ].map((tf) => (
                  <TouchableOpacity
                    key={tf.id}
                    style={[styles.timeframePill, timeframe === tf.id && styles.timeframePillActive]}
                    onPress={() => setTimeframe(tf.id as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.timeframePillText, timeframe === tf.id && styles.timeframePillTextActive]}>
                      {locale === 'en' ? tf.labelEn : tf.labelMs}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Metric Sort Tabs */}
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>{locale === 'en' ? 'Sort by:' : 'Susun ikut:'}</Text>
                <View style={styles.sortPills}>
                  <TouchableOpacity
                    style={[styles.sortPill, sortBy === 'stamps' && styles.sortPillActive]}
                    onPress={() => setSortBy('stamps')}
                  >
                    <Ionicons name="ribbon-outline" size={13} color={sortBy === 'stamps' ? '#B45309' : '#64748B'} />
                    <Text style={[styles.sortPillText, sortBy === 'stamps' && styles.sortPillTextActive]}>
                      {locale === 'en' ? 'Stamps' : 'Cop'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sortPill, sortBy === 'sales' && styles.sortPillActive]}
                    onPress={() => setSortBy('sales')}
                  >
                    <Ionicons name="cash-outline" size={13} color={sortBy === 'sales' ? '#B45309' : '#64748B'} />
                    <Text style={[styles.sortPillText, sortBy === 'sales' && styles.sortPillTextActive]}>
                      {locale === 'en' ? 'Sales (RM)' : 'Jualan (RM)'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sortPill, sortBy === 'customers' && styles.sortPillActive]}
                    onPress={() => setSortBy('customers')}
                  >
                    <Ionicons name="people-outline" size={13} color={sortBy === 'customers' ? '#B45309' : '#64748B'} />
                    <Text style={[styles.sortPillText, sortBy === 'customers' && styles.sortPillTextActive]}>
                      {locale === 'en' ? 'Customers' : 'Pelanggan'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Hero Top Performer Spotlight Card */}
            {topPerformer && (
              <View style={styles.spotlightCard}>
                <View style={styles.spotlightHeader}>
                  <View style={styles.spotlightBadge}>
                    <Ionicons name="sparkles" size={14} color="#B45309" />
                    <Text style={styles.spotlightBadgeText}>
                      {locale === 'en' ? 'TOP PERFORMING STAFF' : 'STAF TERBAIK'}
                    </Text>
                  </View>
                  <View style={styles.spotlightPeriod}>
                    <Text style={styles.spotlightPeriodText}>
                      {timeframe === 'today' ? (locale === 'en' ? 'Today' : 'Hari Ini') :
                       timeframe === 'week' ? (locale === 'en' ? 'This Week' : 'Minggu Ini') :
                       timeframe === 'month' ? (locale === 'en' ? 'This Month' : 'Bulan Ini') : (locale === 'en' ? 'All-Time' : 'Sepanjang Masa')}
                    </Text>
                  </View>
                </View>

                <View style={styles.spotlightProfileRow}>
                  <View style={styles.spotlightAvatarWrap}>
                    <Image source={{ uri: getAvatarUrl(topPerformer) }} style={styles.spotlightAvatar} />
                    <View style={styles.spotlightCrown}>
                      <Text style={{ fontSize: 13 }}>👑</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spotlightName}>{topPerformer.name}</Text>
                    <View style={styles.spotlightBranch}>
                      <Ionicons name="location" size={11} color="#B45309" />
                      <Text style={styles.spotlightBranchText}>{topPerformer.branch_name || 'All Branches (HQ)'}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.spotlightMetricsGrid}>
                  <View style={styles.spotlightMetricItem}>
                    <Text style={styles.spotlightMetricVal}>{topPerformer.stamps_issued || 0}</Text>
                    <Text style={styles.spotlightMetricLbl}>{locale === 'en' ? 'Stamps Issued' : 'Cop Dikeluarkan'}</Text>
                  </View>
                  <View style={styles.spotlightMetricItem}>
                    <Text style={styles.spotlightMetricVal}>RM {(topPerformer.sales_volume || 0).toFixed(2)}</Text>
                    <Text style={styles.spotlightMetricLbl}>{locale === 'en' ? 'Sales Handled' : 'Jualan Dikendalikan'}</Text>
                  </View>
                  <View style={styles.spotlightMetricItem}>
                    <Text style={styles.spotlightMetricVal}>{topPerformer.customers_served || 0}</Text>
                    <Text style={styles.spotlightMetricLbl}>{locale === 'en' ? 'Customers' : 'Pelanggan'}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Staff Ranking List */}
            {loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator color="#050505" size="large" />
              </View>
            ) : staff.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="ribbon-outline" size={32} color="#64748B" />
                </View>
                <Text style={styles.emptyTitle}>{locale === 'en' ? 'No Staff Data' : 'Tiada Data Staf'}</Text>
                <Text style={styles.emptySubtitle}>
                  {locale === 'en'
                    ? 'Add staff members to start tracking stamp issuing activity.'
                    : 'Tambah ahli staf untuk mula memantau aktiviti pengeluaran stamp.'}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={styles.leaderboardSectionTitle}>
                  {locale === 'en' ? 'All Staff Rankings' : 'Semua Kedudukan Staf'} ({staff.length})
                </Text>

                {staff.map((member, index) => {
                  const rank = member.rank || index + 1;
                  const isTop3 = rank <= 3;
                  const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

                  return (
                    <View key={member.id} style={[styles.perfStaffCard, rank === 1 && styles.perfStaffCardGold]}>
                      <View style={[styles.rankPill, isTop3 && styles.rankPillTop]}>
                        <Text style={[styles.rankPillText, isTop3 && styles.rankPillTopText]}>
                          {rankBadge}
                        </Text>
                      </View>

                      <Image source={{ uri: getAvatarUrl(member) }} style={styles.avatarSmall} />

                      <View style={{ flex: 1, paddingRight: 4 }}>
                        <Text style={styles.staffName}>{member.name}</Text>
                        <Text style={styles.perfBranchText}>{member.branch_name || 'All Branches (HQ)'}</Text>
                      </View>

                      <View style={styles.perfMetricsColumn}>
                        <View style={styles.perfBadgeStamps}>
                          <Ionicons name="ribbon" size={11} color="#B45309" />
                          <Text style={styles.perfBadgeStampsText}>
                            {member.stamps_issued || 0} {locale === 'en' ? 'stamps' : 'cop'}
                          </Text>
                        </View>
                        <Text style={styles.perfSalesText}>
                          RM {(member.sales_volume || 0).toFixed(2)} · {member.customers_served || 0} cust
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          /* Staff Permissions & Settings View */
          <View style={{ gap: 16 }}>
            {/* Header Banner Card */}
            <View style={styles.permHeaderCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.permHeaderIconBg}>
                  <Ionicons name="shield-checkmark" size={22} color="#050505" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permHeaderTitle}>
                    {locale === 'en' ? 'Staff Role & Permissions' : 'Peranan & Kebenaran Staf'}
                  </Text>
                  <Text style={styles.permHeaderSubtitle}>
                    {locale === 'en'
                      ? 'Control which console sections your staff can access.'
                      : 'Kawal bahagian konsol yang boleh diakses oleh staf anda.'}
                  </Text>
                </View>
              </View>
              {savingPermissions && (
                <View style={styles.savingBadge}>
                  <ActivityIndicator size="small" color="#B45309" />
                  <Text style={styles.savingBadgeText}>{locale === 'en' ? 'Saving...' : 'Menyimpan...'}</Text>
                </View>
              )}
            </View>

            {/* Always Enabled Notice */}
            <View style={styles.permNoticeCard}>
              <Ionicons name="information-circle-outline" size={20} color="#0284C7" />
              <Text style={styles.permNoticeText}>
                {locale === 'en'
                  ? 'Cashier Mode (Issue Stamps, Scan QR, & Redeem Vouchers) and Customer Lookup are always unlocked for all active staff.'
                  : 'Mod Juruwang (Beri Stamp, Imbas QR, & Tebus Baucar) dan Carian Pelanggan sentiasa dibuka untuk semua staf aktif.'}
              </Text>
            </View>

            {/* Permission Toggles List */}
            <View style={styles.permListCard}>
              {/* 1. Financial Analytics */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBg, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="bar-chart" size={18} color="#0284C7" />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.permTitle}>
                    {locale === 'en' ? 'Financial Analytics & Revenue' : 'Analitik Kewangan & Hasil'}
                  </Text>
                  <Text style={styles.permSubtitle}>
                    {locale === 'en'
                      ? 'Allow staff to view sales figures, daily turnover, and revenue charts.'
                      : 'Benarkan staf melihat angka jualan, pusingan harian, dan carta hasil.'}
                  </Text>
                </View>
                <Switch
                  value={permissionsState.can_view_analytics ?? false}
                  onValueChange={(val) => handleTogglePermission('can_view_analytics', val)}
                  trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                  thumbColor={permissionsState.can_view_analytics ? '#050505' : '#FFFFFF'}
                />
              </View>

              <View style={styles.permDivider} />

              {/* 2. WhatsApp Marketing */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBg, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.permTitle}>
                    {locale === 'en' ? 'WhatsApp Blasts & Campaigns' : 'Hebahan WhatsApp & Kempen'}
                  </Text>
                  <Text style={styles.permSubtitle}>
                    {locale === 'en'
                      ? 'Allow staff to send broadcast messages, create templates, and trigger automations.'
                      : 'Benarkan staf menghantar mesej hebahan, cipta templat, dan memulakan automasi.'}
                  </Text>
                </View>
                <Switch
                  value={permissionsState.can_view_marketing ?? false}
                  onValueChange={(val) => handleTogglePermission('can_view_marketing', val)}
                  trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                  thumbColor={permissionsState.can_view_marketing ? '#050505' : '#FFFFFF'}
                />
              </View>

              <View style={styles.permDivider} />

              {/* 3. Loyalty Programs & Rewards */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="gift" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.permTitle}>
                    {locale === 'en' ? 'Loyalty Programs & Reward Editing' : 'Program Kesetiaan & Hadiah'}
                  </Text>
                  <Text style={styles.permSubtitle}>
                    {locale === 'en'
                      ? 'Allow staff to create new rewards, modify stamp card goals, and edit tiers.'
                      : 'Benarkan staf mencipta hadiah baharu, mengubah sasaran stamp, dan sunting tahap.'}
                  </Text>
                </View>
                <Switch
                  value={permissionsState.can_manage_rewards ?? false}
                  onValueChange={(val) => handleTogglePermission('can_manage_rewards', val)}
                  trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                  thumbColor={permissionsState.can_manage_rewards ? '#050505' : '#FFFFFF'}
                />
              </View>

              <View style={styles.permDivider} />

              {/* 4. Customer Stamp Adjustments */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBg, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="create-outline" size={18} color="#9333EA" />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.permTitle}>
                    {locale === 'en' ? 'Customer Stamp Adjustments' : 'Pelarasan Stamp Pelanggan'}
                  </Text>
                  <Text style={styles.permSubtitle}>
                    {locale === 'en'
                      ? 'Allow staff to manually increase/decrease customer stamp counts in CRM.'
                      : 'Benarkan staf menambah atau mengurangkan baki stamp pelanggan dalam CRM.'}
                  </Text>
                </View>
                <Switch
                  value={permissionsState.can_manage_customers ?? false}
                  onValueChange={(val) => handleTogglePermission('can_manage_customers', val)}
                  trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                  thumbColor={permissionsState.can_manage_customers ? '#050505' : '#FFFFFF'}
                />
              </View>

              <View style={styles.permDivider} />

              {/* 5. Store Profile & Branches */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBg, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="business" size={18} color="#475569" />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.permTitle}>
                    {locale === 'en' ? 'Store Profile & Branch Management' : 'Profil Kedai & Cawangan'}
                  </Text>
                  <Text style={styles.permSubtitle}>
                    {locale === 'en'
                      ? 'Allow staff to edit store address, logos, Google review links, and branch outlets.'
                      : 'Benarkan staf menyunting alamat kedai, logo, pautan Google review, dan cawangan.'}
                  </Text>
                </View>
                <Switch
                  value={permissionsState.can_edit_store_profile ?? false}
                  onValueChange={(val) => handleTogglePermission('can_edit_store_profile', val)}
                  trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                  thumbColor={permissionsState.can_edit_store_profile ? '#050505' : '#FFFFFF'}
                />
              </View>
            </View>

            {/* Owner Only Notice */}
            <View style={styles.ownerOnlyFooter}>
              <Ionicons name="lock-closed" size={14} color="#64748B" />
              <Text style={styles.ownerOnlyFooterText}>
                {locale === 'en'
                  ? 'Subscription billing, invoices, and staff account management are strictly restricted to the Store Owner.'
                  : 'Pengebilan langganan, invois, dan pengurusan akaun staf adalah terhad kepada Pemilik Kedai sahaja.'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Staff Name Modal */}
      <Modal
        visible={addNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="person-add" size={26} color="#050505" />
            </View>
            <Text style={styles.modalTitle}>
              {locale === 'en' ? 'Staff Member Details' : 'Maklumat Kakitangan'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {locale === 'en'
                ? 'Enter a name or nickname for this staff member. This will appear on receipts and leaderboards.'
                : 'Masukkan nama atau panggilan staf ini. Nama ini akan dipaparkan pada resit dan rekod staf.'}
            </Text>

            {/* Selected Info Badges */}
            <View style={styles.modalInfoBadgeRow}>
              <View style={styles.modalInfoBadge}>
                <Ionicons name="call-outline" size={12} color="#0F172A" />
                <Text style={styles.modalInfoBadgeText}>{phoneInput}</Text>
              </View>
              <View style={styles.modalInfoBadge}>
                <Ionicons name="location-outline" size={12} color="#B45309" />
                <Text style={[styles.modalInfoBadgeText, { color: '#B45309' }]}>{selectedBranchName}</Text>
              </View>
            </View>

            {/* Name Input */}
            <View style={{ width: '100%', marginBottom: 20 }}>
              <Text style={styles.inputMiniLabel}>
                {locale === 'en' ? 'NAME (OPTIONAL)' : 'NAMA (PILIHAN)'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={locale === 'en' ? "Name" : "Nama"}
                placeholderTextColor="#94A3B8"
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                autoCapitalize="words"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAddNameModalVisible(false)}
                disabled={isAdding}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#050505' }]}
                onPress={handleConfirmAddStaff}
                disabled={isAdding}
                activeOpacity={0.8}
              >
                {isAdding ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{locale === 'en' ? 'Add Staff' : 'Tambah Staf'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    justifyContent: 'space-between',
    height: 60,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.4,
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
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  summaryStatValue: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  summaryStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  filterSection: {
    gap: 10,
  },
  timeframePillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  timeframePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeframePillActive: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
  },
  timeframePillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  timeframePillTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sortLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  sortPills: {
    flexDirection: 'row',
    gap: 6,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortPillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FFC700',
  },
  sortPillText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  sortPillTextActive: {
    color: '#B45309',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  spotlightCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  spotlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  spotlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  spotlightBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  spotlightPeriod: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  spotlightPeriodText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#E2E8F0',
  },
  spotlightProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  spotlightAvatarWrap: {
    position: 'relative',
  },
  spotlightAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FFC700',
  },
  spotlightCrown: {
    position: 'absolute',
    top: -8,
    right: -4,
  },
  spotlightName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  spotlightBranch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  spotlightBranchText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  spotlightMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  spotlightMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  spotlightMetricVal: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
  },
  spotlightMetricLbl: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
    marginTop: 2,
  },
  leaderboardSectionTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 2,
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
  perfStaffCardGold: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  rankPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankPillTop: {
    backgroundColor: '#FEF3C7',
  },
  rankPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
  },
  rankPillTopText: {
    fontSize: 14,
  },
  perfMetricsColumn: {
    alignItems: 'flex-end',
    gap: 3,
  },
  perfBadgeStamps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  perfBadgeStampsText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  perfSalesText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
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
  modalInfoBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalInfoBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  permHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permHeaderIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permHeaderTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  permHeaderSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savingBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
  permNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0F9FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  permNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0369A1',
    lineHeight: 18,
  },
  permListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  permIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  permSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
  },
  permDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: -4,
  },
  ownerOnlyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ownerOnlyFooterText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
  },
});
