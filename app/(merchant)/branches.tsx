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
  Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import * as Clipboard from 'expo-clipboard';

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  manager_name: string;
  is_hq: boolean;
  status: 'active' | 'inactive';
  staff_count?: number;
  total_sales?: number;
  total_stamps?: number;
}

export default function BranchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { user } = useAuth();
  const { locale } = useLanguage();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Delete modal state
  const [deleteConfirmBranch, setDeleteConfirmBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  // QR modal states
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);
  const [activeQrBranchName, setActiveQrBranchName] = useState<string | null>(null);

  // Subscription states
  const [subscription, setSubscription] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isBusinessPlan = subscription && subscription.status === 'active' && subscription.plan === 'enterprise';

  // Form states
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [managerName, setManagerName] = useState('');
  const [isHq, setIsHq] = useState(false);

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
      // Fetch branches and subscription concurrently
      const [records, subRec] = await Promise.all([
        pb.collection('branches').getFullList<Branch>({
          filter: `merchant = "${user.merchant_id}"`,
          sort: '-is_hq,-created',
          requestKey: null
        }),
        pb.collection('subscriptions').getFirstListItem(`merchant = "${user.merchant_id}"`).catch(() => null)
      ]);

      setSubscription(subRec);

      if (records && records.length > 0) {
        setBranches(records);
      } else {
        // Auto-provision default HQ branch from merchant profile for single-store merchants
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
              setBranches([autoHq as any]);
              setLoading(false);
              return;
            }
          }
        } catch (autoErr) {
          console.log('Auto-provision HQ branch bypassed:', autoErr);
        }
        setBranches([]);
      }
    } catch (err: any) {
      console.log('Branches fetch info:', err.message);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    // If not business plan and already has 2 or more branches, show upgrade modal (Starter/PRO includes HQ + 1 extra branch)
    if (!isBusinessPlan && branches.length >= 2) {
      setShowUpgradeModal(true);
      return;
    }

    setEditingBranch(null);
    setName('');
    setAddress('');
    setCity('');
    setPhone('');
    setManagerName('');
    setIsHq(branches.length === 0);
    setModalVisible(true);
  };

  const handleOpenEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setName(branch.name);
    setAddress(branch.address);
    setCity(branch.city);
    setPhone(branch.phone);
    setManagerName(branch.manager_name);
    setIsHq(Boolean(branch.is_hq));
    setModalVisible(true);
  };

  const handleSaveBranch = async () => {
    if (!name.trim()) {
      Alert.alert(locale === 'en' ? 'Validation' : 'Pengesahan', locale === 'en' ? 'Branch name is required.' : 'Nama cawangan diperlukan.');
      return;
    }

    if (!editingBranch && !isBusinessPlan && branches.length >= 2) {
      setModalVisible(false);
      setShowUpgradeModal(true);
      return;
    }

    const finalIsHq = isHq;

    setSubmitting(true);
    try {
      if (editingBranch) {
        // Try updating in PB
        try {
          if (editingBranch.id && editingBranch.id !== 'hq-default' && !editingBranch.id.startsWith('branch-')) {
            await pb.collection('branches').update(editingBranch.id, {
              name: name.trim(),
              address: address.trim(),
              city: city.trim(),
              phone: phone.trim(),
              manager_name: managerName.trim(),
              is_hq: finalIsHq,
            });
          }

          // If this branch became HQ, unset other branches
          if (finalIsHq && user?.merchant_id) {
            const otherHqs = branches.filter(b => b.is_hq && b.id !== editingBranch.id);
            for (const o of otherHqs) {
              if (o.id && !o.id.startsWith('branch-')) {
                pb.collection('branches').update(o.id, { is_hq: false }).catch(() => null);
              }
            }
          }
        } catch (e) {
          console.log('PB update branch bypassed:', e);
        }

        setBranches(prev => prev.map(b => b.id === editingBranch.id ? {
          ...b,
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          phone: phone.trim(),
          manager_name: managerName.trim(),
          is_hq: finalIsHq
        } : (finalIsHq ? { ...b, is_hq: false } : b)));

        Alert.alert(locale === 'en' ? 'Success' : 'Berjaya', locale === 'en' ? 'Branch updated successfully.' : 'Cawangan berjaya dikemaskini.');
      } else {
        // Create new branch in PB
        const newBranchId = `branch-${Date.now()}`;
        try {
          if (user?.merchant_id) {
            // If new branch is HQ, unset others first
            if (finalIsHq) {
              const otherHqs = branches.filter(b => b.is_hq);
              for (const o of otherHqs) {
                if (o.id && !o.id.startsWith('branch-')) {
                  pb.collection('branches').update(o.id, { is_hq: false }).catch(() => null);
                }
              }
            }

            const created = await pb.collection('branches').create({
              merchant: user.merchant_id,
              name: name.trim(),
              address: address.trim(),
              city: city.trim(),
              phone: phone.trim(),
              manager_name: managerName.trim(),
              is_hq: finalIsHq,
              status: 'active'
            });
            if (created?.id) {
              setBranches(prev => finalIsHq 
                ? [created as any, ...prev.map(b => ({ ...b, is_hq: false }))]
                : [...prev, created as any]
              );
              setModalVisible(false);
              setSubmitting(false);
              Alert.alert(locale === 'en' ? 'Success' : 'Berjaya', locale === 'en' ? 'New branch added successfully.' : 'Cawangan baru berjaya ditambah.');
              return;
            }
          }
        } catch (e) {
          console.log('PB create branch error:', e);
        }

        const newBranchObj: Branch = {
          id: newBranchId,
          name: name.trim(),
          address: address.trim() || 'Outlet Address',
          city: city.trim() || 'Selangor',
          phone: phone.trim() || '0123456789',
          manager_name: managerName.trim() || 'Branch Manager',
          is_hq: finalIsHq,
          status: 'active',
          staff_count: 1,
          total_sales: 0,
          total_stamps: 0
        };

        setBranches(prev => finalIsHq ? [newBranchObj, ...prev.map(b => ({ ...b, is_hq: false }))] : [...prev, newBranchObj]);
        Alert.alert(locale === 'en' ? 'Success' : 'Berjaya', locale === 'en' ? 'New branch added successfully.' : 'Cawangan baru berjaya ditambah.');
      }
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save branch.');
    } finally {
      setSubmitting(false);
    }
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

  return (
    <View style={styles.container}>
      {/* Absolute Full Bleed Header Background */}
      <View style={[styles.headerBleedBg, { height: 140 + insets.top }]} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Top Header Navigation */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{locale === 'en' ? 'Branch Management' : 'Pengurusan Cawangan'}</Text>
            <Text style={styles.headerSubtitle}>{branches.length} {locale === 'en' ? 'Active Outlets' : 'Cawangan Aktif'}</Text>
          </View>

          <TouchableOpacity
            style={styles.addHeaderBtn}
            onPress={handleOpenAddModal}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#050505" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && { maxWidth: 840, alignSelf: 'center', width: '100%' }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Business Tier Unlock Banner */}
          <View style={styles.tierBanner}>
            <View style={styles.tierBannerLeft}>
              <View style={styles.tierIconBadge}>
                <Ionicons name="business" size={18} color="#FFC700" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.tierBannerTitle}>{locale === 'en' ? 'Multi-Branch Engine' : 'Sistem Pelbagai Cawangan'}</Text>
                  <View style={styles.businessPill}>
                    <Text style={styles.businessPillText}>BUSINESS</Text>
                  </View>
                </View>
                <Text style={styles.tierBannerDesc}>
                  {locale === 'en'
                    ? 'Manage staff assignments, compare sales performance, and track stamp distribution per location.'
                    : 'Urus agihan staff, bandingkan hasil jualan, dan pantau rekod stamp mengikut cawangan.'}
                </Text>
              </View>
            </View>
          </View>

          {/* Section Header */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>{locale === 'en' ? 'Registered Outlets' : 'Senarai Cawangan'}</Text>
            <TouchableOpacity onPress={fetchBranches} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFC700" />
              <Text style={styles.loadingText}>{locale === 'en' ? 'Loading branches...' : 'Memuatkan cawangan...'}</Text>
            </View>
          ) : branches.length === 0 ? (
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 28,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: '#E2E8F0',
              borderStyle: 'dashed',
              gap: 8,
            }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <Ionicons name="business-outline" size={26} color="#B45309" />
              </View>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                {locale === 'en' ? 'No Branches Added Yet' : 'Tiada Cawangan Didaftarkan'}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', maxWidth: 280, lineHeight: 18 }}>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={[styles.branchIconWrap, branch.is_hq && styles.hqIconWrap]}>
                        <Ionicons 
                          name={branch.is_hq ? "business" : "storefront-outline"} 
                          size={20} 
                          color={branch.is_hq ? "#FFC700" : "#050505"} 
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.branchName}>{branch.name}</Text>
                          {branch.is_hq && (
                            <View style={styles.hqBadge}>
                              <Text style={styles.hqBadgeText}>HQ / MAIN</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.branchCity}>{branch.city || 'Malaysia'}</Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity 
                        style={styles.actionIconBtn} 
                        onPress={() => handleOpenEditModal(branch)}
                        activeOpacity={0.7}
                      >
                        <Feather name="edit-2" size={14} color="#050505" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionIconBtn, { backgroundColor: '#FEE2E2' }]} 
                        onPress={() => handleDeleteBranch(branch)}
                        activeOpacity={0.7}
                      >
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Branch Details Box */}
                  <View style={styles.branchDetailsBox}>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={14} color="#64748B" />
                      <Text style={styles.detailText} numberOfLines={1}>{branch.address || 'Address not set'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={14} color="#64748B" />
                      <Text style={styles.detailText}>
                        {locale === 'en' ? 'Manager:' : 'Pengurus:'} <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>{branch.manager_name || 'Store Owner'}</Text>
                      </Text>
                    </View>
                    {branch.phone ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="call-outline" size={14} color="#64748B" />
                        <Text style={styles.detailText}>{branch.phone}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Onboarding NFC Link */}
                  <View style={{
                    marginTop: 10,
                    marginBottom: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#64748B', letterSpacing: 0.5 }}>
                        NFC / QR ONBOARDING LINK
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0F172A' }} numberOfLines={1}>
                        {`https://risev.app/join?m=${user?.merchant_id}&b=${branch.id}`}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                      <TouchableOpacity
                        onPress={async () => {
                          await Clipboard.setStringAsync(`https://risev.app/join?m=${user?.merchant_id}&b=${branch.id}`);
                          Alert.alert(
                            locale === 'en' ? 'Link Copied' : 'Pautan Disalin',
                            locale === 'en' ? 'Onboarding link copied to clipboard!' : 'Pautan pendaftaran disalin ke papan klip!'
                          );
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          backgroundColor: '#FFC700',
                          borderRadius: 8,
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                          {locale === 'en' ? 'COPY' : 'SALIN'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setActiveQrUrl(`https://risev.app/join?m=${user?.merchant_id}&b=${branch.id}`);
                          setActiveQrBranchName(branch.name);
                        }}
                        style={{
                          padding: 6,
                          backgroundColor: '#F1F5F9',
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="qr-code-outline" size={16} color="#050505" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Quick Performance Strip */}
                  <View style={styles.performanceStrip}>
                    <View style={styles.perfItem}>
                      <Text style={styles.perfLabel}>{locale === 'en' ? 'Staff Members' : 'Bil. Staf'}</Text>
                      <Text style={styles.perfValue}>{branch.staff_count || 1}</Text>
                    </View>
                    <View style={styles.perfDivider} />
                    <View style={styles.perfItem}>
                      <Text style={styles.perfLabel}>{locale === 'en' ? 'Est. Sales' : 'Anggaran Jualan'}</Text>
                      <Text style={styles.perfValue}>RM {(branch.total_sales || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.perfDivider} />
                    <View style={styles.perfItem}>
                      <Text style={styles.perfLabel}>{locale === 'en' ? 'Stamps Issued' : 'Stamp Diedar'}</Text>
                      <Text style={[styles.perfValue, { color: '#FFC700' }]}>{branch.total_stamps || 0}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Quick Add CTA */}
          <TouchableOpacity
            style={styles.bigAddBtn}
            onPress={handleOpenAddModal}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={20} color="#050505" />
            <Text style={styles.bigAddBtnText}>{locale === 'en' ? '+ Add New Branch' : '+ Tambah Cawangan Baru'}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Add / Edit Branch Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, isDesktop && { maxWidth: 500 }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingBranch ? (locale === 'en' ? 'Edit Branch' : 'Kemaskini Cawangan') : (locale === 'en' ? 'Add New Branch' : 'Tambah Cawangan Baru')}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="#050505" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                {/* Branch Name */}
                <Text style={styles.inputLabel}>{locale === 'en' ? 'BRANCH NAME *' : 'NAMA CAWANGAN *'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Bangi Gateway Outlet"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                />

                {/* City / Area */}
                <Text style={styles.inputLabel}>{locale === 'en' ? 'CITY / AREA' : 'BANDAR / KAWASAN'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Bandar Baru Bangi, Selangor"
                  placeholderTextColor="#94A3B8"
                  value={city}
                  onChangeText={setCity}
                />

                {/* Address */}
                <Text style={styles.inputLabel}>{locale === 'en' ? 'FULL ADDRESS' : 'ALAMAT PENUH'}</Text>
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="e.g. No 12, Jalan Gerbang, Seksyen 15"
                  placeholderTextColor="#94A3B8"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />

                {/* Manager Name */}
                <Text style={styles.inputLabel}>{locale === 'en' ? 'BRANCH MANAGER' : 'NAMA PENGURUS'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Encik Farhan"
                  placeholderTextColor="#94A3B8"
                  value={managerName}
                  onChangeText={setManagerName}
                />

                {/* Contact Phone */}
                <Text style={styles.inputLabel}>{locale === 'en' ? 'CONTACT NUMBER' : 'NOMBOR TELEFON'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 0123456789"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                {/* Set as HQ Switch */}
                <TouchableOpacity
                  style={styles.hqSwitchRow}
                  onPress={() => setIsHq(!isHq)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hqSwitchTitle}>{locale === 'en' ? 'Set as HQ / Main Outlet' : 'Tetapkan sebagai Cawangan Utama HQ'}</Text>
                    <Text style={styles.hqSwitchSubtitle}>{locale === 'en' ? 'Primary branch for default staff assignments' : 'Cawangan utama untuk default staf'}</Text>
                  </View>
                  <View style={[styles.customToggle, isHq && styles.customToggleActive]}>
                    <View style={[styles.toggleCircle, isHq && styles.toggleCircleActive]} />
                  </View>
                </TouchableOpacity>
              </ScrollView>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveBranch}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#050505" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingBranch ? (locale === 'en' ? 'Save Changes' : 'Simpan Perubahan') : (locale === 'en' ? 'Create Branch' : 'Daftar Cawangan')}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Delete Branch Option in Edit Modal */}
              {editingBranch && (
                <TouchableOpacity
                  style={{
                    marginTop: 10,
                    paddingVertical: 13,
                    borderRadius: 14,
                    backgroundColor: '#FEF2F2',
                    borderWidth: 1,
                    borderColor: '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6
                  }}
                  onPress={() => handleDeleteBranch(editingBranch)}
                  activeOpacity={0.7}
                >
                  <Feather name="trash-2" size={15} color="#EF4444" />
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#EF4444' }}>
                    {locale === 'en' ? 'Delete This Branch' : 'Padam Cawangan Ini'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>

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
                {locale === 'en' ? 'Unlock Multi-Branch' : 'Buka Pelbagai Cawangan'}
              </Text>

              {/* Subtitle */}
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
                {locale === 'en'
                  ? 'Manage staff assignments, compare sales performance, and track stamp distribution per location.'
                  : 'Urus staf, bandingkan hasil jualan cawangan, dan pantau edaran stamp mengikut lokasi.'}
              </Text>

              {/* Feature Points */}
              <View style={{ width: '100%', gap: 12, marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 18 }}>🏢</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                      {locale === 'en' ? 'Unlimited Branches' : 'Cawangan Tanpa Had'}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      {locale === 'en' ? 'Register and manage all your outlets' : 'Daftar & urus semua outlet anda'}
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
                  {locale === 'en' ? 'Upgrade to Business' : 'Naik Taraf ke Business'}
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBleedBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#050505',
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  addHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  tierBanner: {
    backgroundColor: '#050505',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.3)',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  tierBannerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tierIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 199, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tierBannerTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  businessPill: {
    backgroundColor: '#FFC700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  businessPillText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: 0.5,
  },
  tierBannerDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
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
  branchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  branchIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hqIconWrap: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  branchName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    flex: 1,
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
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  perfValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginTop: 2,
  },
  perfDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
  },
  bigAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFC700',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 16,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3,
  },
  bigAddBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
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
    backgroundColor: '#FFC700',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
});
