import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Image,
  Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { handleSmartBack } from '@/lib/navigation';
import * as Clipboard from 'expo-clipboard';
import BranchFormModal, { StaffOption } from '@/components/BranchFormModal';

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  manager_name: string;
  is_hq: boolean;
  status: 'active' | 'inactive';
  manager?: string;
  google_review_url?: string;
  staff_count?: number;
  total_sales?: number;
  total_stamps?: number;
  customer_count?: number;
  assigned_stands?: string[];
}

export default function BranchesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ linked_stand?: string; branch_id?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { user } = useAuth();
  const { locale } = useLanguage();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Stand linking toast banner state
  const [linkedStandBanner, setLinkedStandBanner] = useState<{ code: string; branchId?: string } | null>(null);

  useEffect(() => {
    if (params.linked_stand) {
      setLinkedStandBanner({
        code: String(params.linked_stand),
        branchId: params.branch_id ? String(params.branch_id) : undefined,
      });
    }
  }, [params.linked_stand, params.branch_id]);
  
  // Delete modal state
  const [deleteConfirmBranch, setDeleteConfirmBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  // QR modal states
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);
  const [activeQrBranchName, setActiveQrBranchName] = useState<string | null>(null);

  // Subscription states
  const [subscription, setSubscription] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const subPlan = subscription && subscription.status === 'active' ? (subscription.plan || 'starter') : 'none';
  const isProPlan = subPlan === 'pro';
  // Stand bundle: 2 (1 HQ + 1 Branch)
  // PRO: Unlimited (999)
  // Starter / Free Trial: 1 (HQ only)
  const maxAllowedBranches = isProPlan ? 999 : (subPlan === 'stand_bundle' ? 2 : 1);

  const [merchantName, setMerchantName] = useState('');
  const [availableStaff, setAvailableStaff] = useState<StaffOption[]>([]);

  // Smart Stand → outlet assignment
  const [standCodes, setStandCodes] = useState<any[]>([]);
  const [standModalBranchId, setStandModalBranchId] = useState<string | null>(null);
  const [savingStandCode, setSavingStandCode] = useState<string | null>(null);

  useEffect(() => {
    fetchBranches();
  }, [user]);

  const fetchBranches = async () => {
    if (!user?.merchant_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch branches, subscription, transactions, staff, stand codes, and merchant concurrently
      const [records, subRec, txRecords, staffRecords, codeRecords, merchRec, msRecords] = await Promise.all([
        pb.collection('branches').getFullList<Branch>({
          filter: `merchant = "${user.merchant_id}"`,
          sort: '-is_hq,-created',
          requestKey: null
        }),
        pb.collection('subscriptions').getFirstListItem(`merchant = "${user.merchant_id}"`).catch(() => null),
        pb.collection('transactions').getFullList({
          filter: `merchant = "${user.merchant_id}"`,
          sort: '-created',
          requestKey: null
        }).catch(() => []),
        pb.collection('users').getFullList({
          filter: `merchant_id = "${user.merchant_id}" && (role = "merchant" || role = "both" || role = "staff")`,
          requestKey: null
        }).catch(() => []),
        pb.collection('activation_codes').getFullList({
          filter: `redeemed_by = "${user.merchant_id}"`,
          requestKey: null
        }).catch(() => []),
        pb.collection('merchants').getOne(user.merchant_id).catch(() => null),
        pb.collection('merchant_staff').getFullList({
          filter: `merchant = "${user.merchant_id}" && is_active = true`,
          requestKey: null
        }).catch(() => [])
      ]);

      setSubscription(subRec);
      setStandCodes(codeRecords || []);
      if (merchRec?.name) {
        setMerchantName(merchRec.name);
      }

      // Build unified staff list from Staff Management
      const staffList: StaffOption[] = [];
      const ownerName = user?.name || merchRec?.name || (locale === 'en' ? 'Store Owner' : 'Pemilik Kedai');
      staffList.push({
        id: user?.id || 'owner_id',
        name: ownerName,
        phone: user?.phone || merchRec?.phone || '',
        role_title: locale === 'en' ? 'Store Owner' : 'Pemilik Kedai',
        is_owner: true
      });

      // 1. Try fetching from /api/risev/merchant/staff
      try {
        const sRes = await pb.send<any>('/api/risev/merchant/staff?timeframe=all&sort_by=stamps', {
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + pb.authStore.token }
        });
        if (sRes && Array.isArray(sRes.staff)) {
          sRes.staff.forEach((s: any) => {
            const cleanName = (s.name || '').trim();
            if (!cleanName || cleanName.toLowerCase() === ownerName.toLowerCase()) return;
            if (!staffList.some(item => item.id === s.id || item.name.toLowerCase() === cleanName.toLowerCase())) {
              staffList.push({
                id: s.id,
                name: cleanName,
                phone: s.phone || '',
                role_title: s.role_title || (locale === 'en' ? 'Staff' : 'Staf')
              });
            }
          });
        }
      } catch (stErr) {}

      // 2. Add from merchant_staff
      if (Array.isArray(msRecords)) {
        msRecords.forEach((ms: any) => {
          const cleanName = (ms.name || '').trim();
          if (!cleanName || cleanName.toLowerCase() === ownerName.toLowerCase()) return;
          if (!staffList.some(item => item.name.toLowerCase() === cleanName.toLowerCase())) {
            staffList.push({
              id: ms.id,
              name: cleanName,
              phone: ms.phone || '',
              role_title: ms.role_title || (locale === 'en' ? 'Staff' : 'Staf')
            });
          }
        });
      }

      // 3. Add from users
      if (Array.isArray(staffRecords)) {
        staffRecords.forEach((u: any) => {
          const cleanName = (u.name || '').trim();
          if (!cleanName || cleanName.toLowerCase() === ownerName.toLowerCase()) return;
          if (!staffList.some(item => item.id === u.id || item.name.toLowerCase() === cleanName.toLowerCase())) {
            staffList.push({
              id: u.id,
              name: cleanName,
              phone: u.phone || '',
              role_title: u.role_title || (locale === 'en' ? 'Staff' : 'Staf')
            });
          }
        });
      }

      setAvailableStaff(staffList);

      let branchList = records || [];

      // Auto-provision default HQ branch if merchant has no branches yet
      if (branchList.length === 0) {
        try {
          const merch = await pb.collection('merchants').getOne(user.merchant_id);
          if (merch) {
            const autoHq = await pb.collection('branches').create({
              merchant: user.merchant_id,
              name: merch.name ? `${merch.name} (HQ)` : 'Main Outlet',
              address: merch.address || '',
              city: merch.city || 'Malaysia',
              phone: merch.phone || user.phone || '',
              manager_name: user.name || 'Store Owner',
              is_hq: true,
              status: 'active'
            });
            if (autoHq?.id) {
              branchList = [autoHq as any];
            }
          }
        } catch (autoErr) {
          console.log('Auto-provision HQ branch notice:', autoErr);
        }
      }

      // Compute live performance metrics per branch
      const enriched = branchList.map((branch) => {
        let totalSales = 0;
        let totalStamps = 0;
        const customerSet = new Set<string>();

        txRecords.forEach((tx: any) => {
          // Match the outlet relation by ID; rows with no outlet count towards HQ.
          const isHqMatch = branch.is_hq && !tx.branch;
          const isSpecificMatch = tx.branch === branch.id;

          if (isSpecificMatch || isHqMatch) {
            totalSales += Number(tx.bill_amount) || 0;
            totalStamps += Number(tx.stamps) || (tx.type === 'earn' ? 1 : 0);
            if (tx.customer) customerSet.add(tx.customer);
          }
        });

        // Match staff for this branch
        const assignedStaff = staffRecords.filter((s: any) => {
          if (branch.is_hq && (!s.branch || s.branch === branch.id)) return true;
          return s.branch === branch.id || (s.branch_name && s.branch_name.toLowerCase() === branch.name.toLowerCase());
        });

        // Match assigned physical stand codes
        const assignedStands = codeRecords
          .filter((c: any) => c.branch === branch.id || (branch.is_hq && !c.branch))
          .map((c: any) => c.code);

        return {
          ...branch,
          total_sales: Math.round(totalSales),
          total_stamps: totalStamps,
          customer_count: customerSet.size,
          staff_count: Math.max(1, assignedStaff.length),
          assigned_stands: assignedStands
        };
      });

      setBranches(enriched);
    } catch (err: any) {
      console.log('Branches fetch info:', err.message);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    if (branches.length >= maxAllowedBranches) {
      setShowUpgradeModal(true);
      return;
    }
    setEditingBranch(null);
    setModalVisible(true);
  };

  const handleOpenEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setModalVisible(true);
  };

  const handleDeleteBranch = (branch: Branch) => {
    setModalVisible(false);
    setDeleteConfirmBranch(branch);
  };

  const confirmExecuteDelete = async () => {
    if (!deleteConfirmBranch) return;
    const branch = deleteConfirmBranch;
    setDeleting(true);
    try {
      if (branch.id && branch.id !== 'hq-default' && !branch.id.startsWith('branch-')) {
        await pb.collection('branches').delete(branch.id);
      }
    } catch (e: any) {
      console.log('PB delete branch error:', e);
    }
    setBranches(prev => {
      const remaining = prev.filter(b => b.id !== branch.id);
      if (branch.is_hq && remaining.length > 0) {
        remaining[0].is_hq = true;
        if (remaining[0].id && !remaining[0].id.startsWith('branch-')) {
          pb.collection('branches').update(remaining[0].id, { is_hq: true }).catch(() => null);
        }
      }
      return remaining;
    });
    setDeleting(false);
    setDeleteConfirmBranch(null);
  };

  const handleOpenStandManager = (branchId: string) => {
    setStandModalBranchId(branchId);
  };

  const handleAssignStand = async (code: string, branchId: string) => {
    if (!code || !branchId) return;
    setSavingStandCode(code);
    try {
      await pb.send('/api/risev/merchant/bind-stand-branch', {
        method: 'POST',
        body: { code, branch_id: branchId },
      });
      setStandCodes((prev) => prev.map((c: any) => (c.code === code ? { ...c, branch: branchId } : c)));
      await fetchBranches();
      Alert.alert(
        locale === 'en' ? 'Stand Updated' : 'Stand Dikemaskini',
        locale === 'en'
          ? `Stand ${code} is now assigned to the selected outlet.`
          : `Stand ${code} kini ditetapkan kepada cawangan yang dipilih.`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || (locale === 'en' ? 'Failed to assign stand.' : 'Gagal menetapkan stand.'));
    } finally {
      setSavingStandCode(null);
    }
  };

  // Prefer the durable manager relation over the denormalised name, so renaming
  // a staff member never leaves a stale manager on the outlet.
  const resolveManagerName = (branch: Branch) => {
    if (branch.manager) {
      const match = availableStaff.find((s) => s.id === branch.manager);
      if (match?.name) return match.name;
    }
    return branch.manager_name || (locale === 'en' ? 'Store Owner' : 'Pemilik Kedai');
  };

  return (
    <View style={styles.container}>
      {/* ── Sticky Pure White Header ── */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerInnerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => handleSmartBack(router, '/(merchant)/profile')}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#000000" />
            <Text style={styles.backButtonText}>
              {locale === 'en' ? 'Profile' : 'Profil'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {locale === 'en' ? 'Branch Management' : 'Pengurusan Cawangan'}
          </Text>

          <TouchableOpacity
            style={styles.headerAddPill}
            onPress={handleOpenAddModal}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={16} color="#FFCC00" />
            <Text style={styles.headerAddPillText}>
              {locale === 'en' ? 'Add' : 'Tambah'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && { maxWidth: 840, alignSelf: 'center', width: '100%' }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Linked Stand Celebratory Toast Banner */}
          {linkedStandBanner && (
            <View style={styles.standBannerCard}>
              <View style={styles.standBannerIconWrap}>
                <Ionicons name="hardware-chip" size={20} color="#000000" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.standBannerTitle}>
                    {locale === 'en' ? 'Smart Stand Successfully Linked!' : 'Smart Stand Berjaya Dihubungkan!'}
                  </Text>
                  <View style={styles.standBannerPill}>
                    <Text style={styles.standBannerPillText}>{linkedStandBanner.code}</Text>
                  </View>
                </View>
                <Text style={styles.standBannerSubtitle}>
                  {locale === 'en'
                    ? 'This stand is now active and ready for customer taps.'
                    : 'Stand ini kini aktif dan sedia untuk imbasan pelanggan.'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setLinkedStandBanner(null)}
                style={styles.standBannerCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          )}

          {/* Executive Brand KPI Summary Card (Concept A) */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.kpiIconBox}>
                  <Ionicons name="business" size={18} color="#FFCC00" />
                </View>
                <View>
                  <Text style={styles.kpiBrandTitle}>
                    {merchantName || (branches.find(b => b.is_hq)?.name.replace(/\s*\(HQ\)$/i, '')) || (locale === 'en' ? 'Brand-Wide Outlets' : 'Seluruh Cawangan Jenama')}
                  </Text>
                  <Text style={styles.kpiSubText}>
                    {branches.length} {locale === 'en' ? 'active locations registered' : 'cawangan aktif berdaftar'}
                  </Text>
                </View>
              </View>

              <View style={styles.quotaPill}>
                <Text style={styles.quotaPillText}>
                  {branches.length}/{maxAllowedBranches === 999 ? '∞' : maxAllowedBranches} {locale === 'en' ? 'Outlets' : 'Cawangan'}
                </Text>
              </View>
            </View>

            {/* 3-Column Metrics Grid */}
            <View style={styles.kpiMetricsRow}>
              <View style={styles.kpiMetricCol}>
                <Text style={styles.kpiMetricLabel}>{locale === 'en' ? 'TOTAL SALES' : 'JUMLAH JUALAN'}</Text>
                <Text style={styles.kpiMetricValue}>
                  RM {branches.reduce((sum, b) => sum + (b.total_sales || 0), 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.kpiMetricDivider} />
              <View style={styles.kpiMetricCol}>
                <Text style={styles.kpiMetricLabel}>{locale === 'en' ? 'TOTAL STAMPS' : 'JUMLAH STAMP'}</Text>
                <Text style={styles.kpiMetricValue}>
                  {branches.reduce((sum, b) => sum + (b.total_stamps || 0), 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.kpiMetricDivider} />
              <View style={styles.kpiMetricCol}>
                <Text style={styles.kpiMetricLabel}>{locale === 'en' ? 'TOTAL STAFF' : 'STAF BERTUGAS'}</Text>
                <Text style={styles.kpiMetricValue}>
                  {branches.reduce((sum, b) => sum + (b.staff_count || 1), 0)}
                </Text>
              </View>
            </View>

            {/* Multi-Branch Revenue Distribution Bar */}
            {(() => {
              const totalRev = branches.reduce((sum, b) => sum + (b.total_sales || 0), 0);
              const palette = ['#000000', '#FFCC00', '#475569', '#94A3B8', '#CBD5E1'];
              return (
                <View style={{ marginTop: 14 }}>
                  <View style={styles.distributionTrack}>
                    {branches.map((b, idx) => {
                      const pct = totalRev > 0 ? ((b.total_sales || 0) / totalRev) * 100 : (100 / branches.length);
                      return (
                        <View
                          key={b.id}
                          style={{
                            flex: pct,
                            backgroundColor: palette[idx % palette.length],
                          }}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.distributionLegend}>
                    {branches.map((b, idx) => {
                      const pct = totalRev > 0 ? Math.round(((b.total_sales || 0) / totalRev) * 100) : Math.round(100 / branches.length);
                      return (
                        <View key={b.id} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: palette[idx % palette.length] }]} />
                          <Text style={styles.legendText}>
                            {b.name.replace(' (HQ)', '')}: <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>{pct}%</Text>
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}
          </View>

          {/* Section Header */}
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionHeaderLabel}>
                {locale === 'en' ? 'REGISTERED OUTLETS' : 'SENARAI CAWANGAN'}
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{branches.length}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={fetchBranches} activeOpacity={0.7} style={styles.refreshBtn}>
              <Ionicons name="refresh-outline" size={17} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFCC00" />
              <Text style={styles.loadingText}>{locale === 'en' ? 'Loading branches...' : 'Memuatkan cawangan...'}</Text>
            </View>
          ) : branches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="business-outline" size={26} color="#000000" />
              </View>
              <Text style={styles.emptyTitle}>
                {locale === 'en' ? 'No Branches Added Yet' : 'Tiada Cawangan Didaftarkan'}
              </Text>
              <Text style={styles.emptyDesc}>
                {locale === 'en' 
                  ? 'Add your main store outlet and any branches to manage staff and track performance.' 
                  : 'Daftar cawangan utama dan cawangan lain untuk urus staf dan pantau prestasi.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {branches.map((branch) => (
                <View key={branch.id} style={styles.branchCard}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={[styles.branchIconWrap, branch.is_hq && styles.hqIconWrap]}>
                        <Ionicons 
                          name={branch.is_hq ? "business" : "storefront-outline"} 
                          size={20} 
                          color={branch.is_hq ? "#FFCC00" : "#0F172A"} 
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.branchName}>{branch.name}</Text>
                          {branch.is_hq && (
                            <View style={styles.hqBadge}>
                              <Text style={styles.hqBadgeText}>HQ / UTAMA</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.branchCity}>{branch.city || 'Malaysia'}</Text>
                      </View>
                    </View>

                    {/* Header Action Buttons */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity 
                        style={styles.actionIconBtn} 
                        onPress={() => handleOpenEditModal(branch)}
                        activeOpacity={0.7}
                      >
                        <Feather name="edit-2" size={13} color="#0F172A" />
                      </TouchableOpacity>
                      {(!branch.is_hq || branches.length > 1) && (
                        <TouchableOpacity 
                          style={[styles.actionIconBtn, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]} 
                          onPress={() => handleDeleteBranch(branch)}
                          activeOpacity={0.7}
                        >
                          <Feather name="trash-2" size={13} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Apple Unified Grouped Inset Box (Pilihan 1) */}
                  <View style={styles.unifiedInsetGroup}>
                    {/* Row 1: Location & Contact */}
                    <View style={styles.insetSection}>
                      <TouchableOpacity
                        style={styles.insetAddressRow}
                        onPress={() => handleOpenEditModal(branch)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="location-outline" size={15} color="#64748B" style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          {branch.address ? (
                            <Text style={styles.insetTextPrimary} numberOfLines={2}>
                              {branch.address}
                            </Text>
                          ) : (
                            <Text style={styles.insetTextPlaceholder}>
                              {locale === 'en' ? '+ Set outlet address' : '+ Tetapkan alamat cawangan'}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={13} color="#94A3B8" />
                      </TouchableOpacity>

                      <View style={styles.insetMetaRow}>
                        <View style={styles.insetMetaItem}>
                          <Ionicons name="person-outline" size={12} color="#64748B" />
                          <Text style={styles.insetTextSecondary}>
                            {locale === 'en' ? 'Manager: ' : 'Pengurus: '}
                            <Text style={styles.insetTextBold}>
                              {resolveManagerName(branch)}
                            </Text>
                          </Text>
                        </View>
                        {branch.phone ? (
                          <>
                            <View style={styles.metaDot} />
                            <View style={styles.insetMetaItem}>
                              <Ionicons name="call-outline" size={12} color="#64748B" />
                              <Text style={styles.insetTextSecondary}>{branch.phone}</Text>
                            </View>
                          </>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.insetDivider} />

                    {/* Row 2: Hardware & Integrations (Smart Stands & Google Review) */}
                    <View style={[styles.insetSection, styles.insetSectionRow]}>
                      {branch.assigned_stands && branch.assigned_stands.length > 0 ? (
                        <TouchableOpacity
                          style={styles.standPill}
                          onPress={() => handleOpenStandManager(branch.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="hardware-chip-outline" size={13} color="#000000" />
                          <Text style={styles.standPillText}>
                            {branch.assigned_stands.length} {locale === 'en' ? (branch.assigned_stands.length === 1 ? 'Stand Active' : 'Stands Active') : 'Stand Aktif'}
                          </Text>
                          <Ionicons name="information-circle-outline" size={12} color="#64748B" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.standPill, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}
                          onPress={() => handleOpenStandManager(branch.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="hardware-chip-outline" size={13} color="#94A3B8" />
                          <Text style={[styles.standPillText, { color: '#94A3B8' }]}>
                            {locale === 'en' ? '0 Stands' : '0 Stand'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {branch.google_review_url ? (
                        <TouchableOpacity
                          onPress={() => {
                            if (branch.google_review_url) {
                              Linking.openURL(branch.google_review_url).catch(() => {});
                            }
                          }}
                          style={styles.googleReviewActivePillUnified}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="star" size={12} color="#D97706" />
                          <Text style={styles.googleReviewActiveTextUnified}>Google Review</Text>
                          <Ionicons name="open-outline" size={11} color="#B45309" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleOpenEditModal(branch)}
                          style={styles.googleReviewAddPillUnified}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={12} color="#64748B" />
                          <Text style={styles.googleReviewAddTextUnified}>
                            {locale === 'en' ? '+ Google Review' : '+ Google Review'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.insetDivider} />

                    {/* Row 3: Customer Onboarding Link (NFC / QR) */}
                    <View style={[styles.insetSection, styles.insetSectionRow]}>
                      <View style={styles.onboardingRowLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="link-outline" size={14} color="#000000" />
                          <Text style={styles.onboardingRowTitle}>
                            {locale === 'en' ? 'Customer Onboarding' : 'Pautan Onboarding'}
                          </Text>
                        </View>
                        <Text style={styles.onboardingRowSubtitle}>
                          {locale === 'en' ? 'NFC Stand & QR Join Link' : 'Pendaftaran NFC & Kod QR'}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={async () => {
                            await Clipboard.setStringAsync(`https://risev.app/join?m=${user?.merchant_id}&b=${branch.id}`);
                            Alert.alert(
                              locale === 'en' ? 'Link Copied' : 'Pautan Disalin',
                              locale === 'en' ? 'Onboarding link copied to clipboard!' : 'Pautan pendaftaran disalin ke papan klip!'
                            );
                          }}
                          style={styles.copyLinkBtnUnified}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="copy-outline" size={12} color="#FFCC00" />
                          <Text style={styles.copyLinkBtnTextUnified}>
                            {locale === 'en' ? 'COPY' : 'SALIN'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            setActiveQrUrl(`https://risev.app/join?m=${user?.merchant_id}&b=${branch.id}`);
                            setActiveQrBranchName(branch.name);
                          }}
                          style={styles.qrIconBtnUnified}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="qr-code-outline" size={15} color="#000000" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* 4-Column Live Performance Strip */}
                  <View style={styles.performanceStrip}>
                    <View style={styles.perfItem}>
                      <Text style={styles.perfLabel}>{locale === 'en' ? 'Staff' : 'Staf'}</Text>
                      <Text style={styles.perfValue}>{branch.staff_count || 1}</Text>
                    </View>
                    <View style={styles.perfDivider} />
                    <View style={styles.perfItem}>
                      <Text style={styles.perfLabel}>{locale === 'en' ? 'Footfall' : 'Pelawat'}</Text>
                      <Text style={styles.perfValue}>{(branch.customer_count || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.perfDivider} />
                    <View style={styles.perfItem}>
                      <Text style={styles.perfLabel}>{locale === 'en' ? 'Sales' : 'Jualan'}</Text>
                      <Text style={styles.perfValue}>RM {(branch.total_sales || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.perfDivider} />
                    <View style={styles.perfItem}>
                      <Text style={styles.perfLabel}>{locale === 'en' ? 'Stamps' : 'Stamp'}</Text>
                      <Text style={[styles.perfValue, { color: '#000000' }]}>{(branch.total_stamps || 0).toLocaleString()}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Primary Add New Branch Button (Apple Style) */}
          <TouchableOpacity
            style={styles.bigAddBtn}
            onPress={handleOpenAddModal}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#FFCC00" />
            <Text style={styles.bigAddBtnText}>{locale === 'en' ? 'Add New Branch' : 'Tambah Cawangan Baru'}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Reusable Add / Edit Branch Modal */}
        <BranchFormModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSuccess={(savedBranch) => {
            if (editingBranch) {
              setBranches((prev) =>
                prev.map((b) =>
                  b.id === savedBranch.id
                    ? { ...b, ...savedBranch }
                    : savedBranch.is_hq
                    ? { ...b, is_hq: false }
                    : b
                )
              );
              Alert.alert(
                locale === 'en' ? 'Success' : 'Berjaya',
                locale === 'en' ? 'Branch updated successfully.' : 'Cawangan berjaya dikemaskini.'
              );
            } else {
              const newEnriched: Branch = {
                ...(savedBranch as any),
                total_sales: 0,
                total_stamps: 0,
                customer_count: 0,
                staff_count: 1,
                assigned_stands: [],
              };
              setBranches((prev) =>
                savedBranch.is_hq
                  ? [newEnriched, ...prev.map((b) => ({ ...b, is_hq: false }))]
                  : [...prev, newEnriched]
              );
              Alert.alert(
                locale === 'en' ? 'Success' : 'Berjaya',
                locale === 'en' ? 'New branch added successfully.' : 'Cawangan baru berjaya ditambah.'
              );
            }
          }}
          merchantId={user?.merchant_id || ''}
          editingBranch={editingBranch}
          availableStaff={availableStaff}
          existingBranchesCount={branches.length}
          onDeleteBranch={handleDeleteBranch}
        />

        {/* Custom In-App Delete Confirmation Modal */}
        <Modal
          visible={!!deleteConfirmBranch}
          transparent={true}
          animationType="fade"
          onRequestClose={() => { if (!deleting) setDeleteConfirmBranch(null); }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxWidth: 380, alignItems: 'center', padding: 24, borderRadius: 28 }]}>
              {/* Warning Icon Badge */}
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Feather name="trash-2" size={28} color="#EF4444" />
              </View>

              {/* Modal Title */}
              <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', textAlign: 'center', marginBottom: 8 }}>
                {locale === 'en' ? 'Delete Branch?' : 'Padam Cawangan?'}
              </Text>

              {/* Subtitle */}
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 19, marginBottom: 16 }}>
                {locale === 'en'
                  ? `Are you sure you want to permanently remove "${deleteConfirmBranch?.name}"?`
                  : `Adakah anda pasti mahu memadam "${deleteConfirmBranch?.name}" secara kekal?`}
              </Text>

              {/* HQ Warning Badge */}
              {deleteConfirmBranch?.is_hq ? (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#FEF3C7',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  marginBottom: 18,
                  width: '100%',
                }}>
                  <Ionicons name="warning-outline" size={18} color="#B45309" />
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309', flex: 1, lineHeight: 16 }}>
                    {locale === 'en'
                      ? 'This outlet is currently marked as HQ. The system will automatically designate another branch as HQ.'
                      : 'Cawangan ini adalah HQ utama. Sistem akan menetapkan cawangan lain sebagai HQ.'}
                  </Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 14,
                    backgroundColor: '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => setDeleteConfirmBranch(null)}
                  disabled={deleting}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569' }}>
                    {locale === 'en' ? 'Cancel' : 'Batal'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 14,
                    backgroundColor: '#EF4444',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#EF4444',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                  onPress={confirmExecuteDelete}
                  disabled={deleting}
                  activeOpacity={0.85}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                      {locale === 'en' ? 'Delete' : 'Padam'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* QR Code Viewer Modal */}
        <Modal
          visible={!!activeQrUrl}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setActiveQrUrl(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxWidth: 360, alignItems: 'center', padding: 24 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                  {locale === 'en' ? 'Branch QR Onboarding' : 'QR Pendaftaran Cawangan'}
                </Text>
                <TouchableOpacity onPress={() => setActiveQrUrl(null)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 20 }}>
                {activeQrBranchName}
              </Text>

              <View style={{
                backgroundColor: '#FFFFFF',
                padding: 16,
                borderRadius: 20,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
                elevation: 3,
                marginBottom: 20
              }}>
                {activeQrUrl ? (
                  <Image
                    source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${activeQrUrl}` }}
                    style={{ width: 180, height: 180 }}
                  />
                ) : null}
              </View>

              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94A3B8', textAlign: 'center', lineHeight: 16 }}>
                {locale === 'en' 
                  ? 'Print this QR code or display it at your counter. Customers can scan to join this cawangan.' 
                  : 'Cetak QR kod ini atau paparkan di kaunter anda. Pelanggan boleh mengimbas untuk menyertai cawangan ini.'}
              </Text>
            </View>
          </View>
        </Modal>

        {/* Business Upgrade Paywall Modal */}
        <Modal
          visible={showUpgradeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowUpgradeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxWidth: 360, padding: 24, alignItems: 'center' }]}>
              {/* Header Icon */}
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 20,
                backgroundColor: '#FFFBEB',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}>
                <Ionicons name="business" size={32} color="#D97706" />
              </View>

              {/* Title */}
              <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', textAlign: 'center', marginBottom: 8 }}>
                {isProPlan 
                  ? (locale === 'en' ? 'Unlock 6+ Multi-Branches' : 'Buka 6+ Cawangan')
                  : (locale === 'en' ? 'Unlock Extra Branches (1 HQ + 4 Branches)' : 'Buka Cawangan Tambahan (1 HQ + 4 Cawangan)')}
              </Text>

              {/* Subtitle */}
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
                {isProPlan
                  ? (locale === 'en'
                    ? 'Upgrade to Business Plan to manage unlimited branch locations and outlets.'
                    : 'Naik taraf ke Pelan Business untuk mengurus cawangan tanpa had.')
                  : (locale === 'en'
                    ? 'Upgrade to PRO Plan to unlock 4 extra store branches (1 HQ + 4 Branches).'
                    : 'Naik taraf ke Pelan PRO untuk membuka 4 cawangan tambahan (1 HQ + 4 Cawangan).')}
              </Text>

              {/* Feature Points */}
              <View style={{ width: '100%', gap: 12, marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 18 }}>🏢</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                      {isProPlan 
                        ? (locale === 'en' ? 'Unlimited Branches' : 'Cawangan Tanpa Had')
                        : (locale === 'en' ? '4 Extra Branches Included' : '4 Cawangan Tambahan Termasuk')}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      {isProPlan
                        ? (locale === 'en' ? 'Register and manage all your outlets' : 'Daftar & urus semua outlet anda')
                        : (locale === 'en' ? 'Total 5 outlets (1 HQ + 4 Branches)' : 'Jumlah 5 outlet (1 HQ + 4 Cawangan)')}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 18 }}>👥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                      {locale === 'en' ? 'Staff Allocation' : 'Agihan Staf Cawangan'}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      {locale === 'en' ? 'Assign staff members to specific outlets' : 'Agihkan staf mengikut outlet spesifik'}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 18 }}>📊</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                      {locale === 'en' ? 'Location Analytics' : 'Analitik Lokasi'}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      {locale === 'en' ? 'Compare performance between locations' : 'Banding prestasi antara cawangan'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                style={{
                  width: '100%',
                  backgroundColor: '#050505',
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginBottom: 8,
                  shadowColor: '#050505',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 4
                }}
                onPress={() => {
                  setShowUpgradeModal(false);
                  router.push('/(merchant)/subscription' as any);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                  {isProPlan 
                    ? (locale === 'en' ? 'Upgrade to Business (RM 329/mo)' : 'Naik Taraf ke Business (RM 329/bln)')
                    : (locale === 'en' ? 'Upgrade to PRO (RM 97/mo)' : 'Naik Taraf ke PRO (RM 97/bln)')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  width: '100%',
                  paddingVertical: 12,
                  alignItems: 'center'
                }}
                onPress={() => setShowUpgradeModal(false)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8' }}>
                  {locale === 'en' ? 'Maybe Later' : 'Mungkin Nanti'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        {/* Smart Stand → Outlet Assignment Modal */}
        <Modal
          visible={!!standModalBranchId}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setStandModalBranchId(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, isDesktop && { maxWidth: 560 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>
                    {locale === 'en' ? 'Assign Smart Stands' : 'Tetapkan Smart Stand'}
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                    {locale === 'en'
                      ? 'Choose the outlet each physical stand belongs to'
                      : 'Pilih cawangan bagi setiap stand fizikal'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setStandModalBranchId(null)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#050505" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                {(() => {
                  const list = (standCodes || []).filter(
                    (sc: any) => !sc.branch || sc.branch === standModalBranchId
                  );
                  if (list.length === 0) {
                    return (
                      <Text style={styles.loadingText}>
                        {locale === 'en' ? 'No stands to assign here.' : 'Tiada stand untuk ditetapkan di sini.'}
                      </Text>
                    );
                  }
                  return list.map((sc: any) => {
                    const assignedBranch = branches.find((b) => b.id === sc.branch);
                    const busy = savingStandCode === sc.code;
                    return (
                      <View key={sc.id || sc.code} style={styles.standRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="hardware-chip" size={15} color="#0F172A" />
                          <Text style={styles.standRowCode}>{sc.code}</Text>
                          {sc.plan ? (
                            <View style={styles.standRowPlanPill}>
                              <Text style={styles.standRowPlanText}>
                                {String(sc.plan).replace('_', ' ')}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.standRowSub}>
                          {sc.quota ? `${sc.quota} ${locale === 'en' ? 'customers' : 'pelanggan'}` : ''}
                          {assignedBranch
                            ? ` · ${assignedBranch.name}`
                            : ` · ${locale === 'en' ? 'Unassigned' : 'Belum ditetapkan'}`}
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 6, paddingTop: 8 }}
                        >
                          {branches.map((b) => {
                            const selected = sc.branch === b.id;
                            return (
                              <TouchableOpacity
                                key={b.id}
                                disabled={busy}
                                onPress={() => handleAssignStand(sc.code, b.id)}
                                style={[
                                  styles.standBranchChip,
                                  selected && styles.standBranchChipActive,
                                  busy && { opacity: 0.5 },
                                ]}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.standBranchChipText, selected && styles.standBranchChipTextActive]}>
                                  {b.name.replace(' (HQ)', '')}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    );
                  });
                })()}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
  },
  // ── Apple Pure White Sticky Header ──
  stickyHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 30,
    paddingBottom: 8,
  },
  headerInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingRight: 8,
    minWidth: 70,
  },
  backButtonText: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.3,
    textAlign: 'center',
    flex: 1,
  },
  headerAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    minWidth: 70,
    justifyContent: 'center',
  },
  headerAddPillText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  // ── Executive KPI Summary Card (Concept A) ──
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBrandTitle: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.2,
  },
  kpiSubText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  quotaPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quotaPillText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.2,
  },
  kpiMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 6,
  },
  kpiMetricCol: {
    alignItems: 'center',
    flex: 1,
  },
  kpiMetricLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  kpiMetricValue: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  kpiMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#F1F5F9',
  },
  distributionTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  distributionLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  // ── Section Header ──
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionHeaderLabel: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  countBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 6.5,
    paddingVertical: 2,
    borderRadius: 99,
  },
  countBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  // ── Empty State ──
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  // ── Registered Outlets ──
  branchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  branchIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hqIconWrap: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  branchName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  hqBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hqBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  branchCity: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Apple Unified Grouped Inset (Pilihan 1) ──
  unifiedInsetGroup: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
    overflow: 'hidden',
  },
  insetSection: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  insetSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 10,
  },
  insetDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 14,
  },
  insetAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  insetTextPrimary: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
    lineHeight: 17,
  },
  insetTextPlaceholder: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  insetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  insetMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  insetTextSecondary: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  insetTextBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  // Hardware & Review Pills in Row 2
  standPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 8,
  },
  standPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  googleReviewActivePillUnified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 8,
  },
  googleReviewActiveTextUnified: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
  googleReviewAddPillUnified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 8,
  },
  googleReviewAddTextUnified: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  // Row 3 Onboarding Link
  onboardingRowLeft: {
    flex: 1,
    gap: 2,
  },
  onboardingRowTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  onboardingRowSubtitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  copyLinkBtnUnified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#000000',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyLinkBtnTextUnified: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
    letterSpacing: 0.5,
  },
  qrIconBtnUnified: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  perfItem: {
    alignItems: 'center',
    flex: 1,
  },
  perfLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  perfValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginTop: 2,
  },
  perfDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#F1F5F9',
  },
  bigAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  bigAddBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  hqSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hqSwitchTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  hqSwitchSubtitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  customToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    padding: 2,
    justifyContent: 'center',
  },
  customToggleActive: {
    backgroundColor: '#FFC700',
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  saveBtn: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
  },
  // ── Staff Manager Selector Styles ──
  toggleCustomText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    textDecorationLine: 'underline',
  },
  staffPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  staffPickerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffPickerAvatarText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
  },
  staffPickerSelectedName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  staffPickerRoleText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  ownerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  ownerBadgeText: {
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  staffPickerChevronBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 8,
  },
  staffChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  staffChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  staffChipDotActive: {
    backgroundColor: '#FFCC00',
  },
  staffChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  staffChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  staffItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  staffItemRowActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    borderWidth: 1.5,
  },
  staffItemName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  staffItemSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  selectedCheckWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Stand Linking Celebratory Banner ──
  standBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  standBannerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  standBannerTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  standBannerPill: {
    backgroundColor: '#000000',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  standBannerPillText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
    letterSpacing: 0.5,
  },
  standBannerSubtitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#92400E',
    marginTop: 2,
  },
  standBannerCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  standRow: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  standRowCode: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  standRowPlanPill: {
    backgroundColor: '#000000',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  standRowPlanText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFCC00',
    textTransform: 'uppercase',
  },
  standRowSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 3,
  },
  standBranchChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  standBranchChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  standBranchChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  standBranchChipTextActive: {
    color: '#FFCC00',
  },
});
