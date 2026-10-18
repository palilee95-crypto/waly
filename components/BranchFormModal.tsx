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
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { useLanguage } from '@/context/LanguageContext';

export interface StaffOption {
  id: string;
  name: string;
  phone?: string;
  role_title?: string;
  is_owner?: boolean;
}

export interface BranchFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (branch: any) => void;
  merchantId: string;
  editingBranch?: any | null;
  availableStaff?: StaffOption[];
  existingBranchesCount?: number;
  onDeleteBranch?: (branch: any) => void;
}

export default function BranchFormModal({
  visible,
  onClose,
  onSuccess,
  merchantId,
  editingBranch,
  availableStaff = [],
  existingBranchesCount = 0,
  onDeleteBranch,
}: BranchFormModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { locale } = useLanguage();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [managerName, setManagerName] = useState('');
  const [isHq, setIsHq] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [resolvingGoogleUrl, setResolvingGoogleUrl] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isCustomManager, setIsCustomManager] = useState<boolean>(false);
  const [showStaffPickerModal, setShowStaffPickerModal] = useState<boolean>(false);

  useEffect(() => {
    if (!visible) return;

    if (editingBranch) {
      setName(editingBranch.name || '');
      setAddress(editingBranch.address || '');
      setCity(editingBranch.city || '');
      setPhone(editingBranch.phone || '');
      setManagerName(editingBranch.manager_name || '');
      setGoogleReviewUrl(editingBranch.google_review_url || '');
      setIsHq(Boolean(editingBranch.is_hq));

      const matched = availableStaff.find(
        (s) => s.name.trim().toLowerCase() === (editingBranch.manager_name || '').trim().toLowerCase()
      );
      if (matched) {
        setSelectedStaffId(matched.id);
        setIsCustomManager(false);
      } else {
        setSelectedStaffId('');
        setIsCustomManager(Boolean(editingBranch.manager_name));
      }
    } else {
      setName('');
      setAddress('');
      setCity('');
      setGoogleReviewUrl('');
      setIsHq(existingBranchesCount === 0);

      const defaultStaff = availableStaff.find((s) => s.is_owner) || availableStaff[0];
      if (defaultStaff) {
        setManagerName(defaultStaff.name);
        setPhone(defaultStaff.phone || '');
        setSelectedStaffId(defaultStaff.id);
        setIsCustomManager(false);
      } else {
        setManagerName('');
        setPhone('');
        setSelectedStaffId('');
        setIsCustomManager(false);
      }
    }
  }, [visible, editingBranch, existingBranchesCount, availableStaff]);

  const handleTestGoogleReviewUrl = async () => {
    if (!googleReviewUrl.trim()) return;
    setResolvingGoogleUrl(true);
    try {
      const res = await pb.send<any>('/api/risev/google-review/resolve', {
        method: 'POST',
        body: { url: googleReviewUrl.trim() },
      });
      if (res?.direct_url) {
        setGoogleReviewUrl(res.direct_url);
        Alert.alert(
          locale === 'en' ? 'Google Review Link Verified' : 'Pautan Review Google Disahkan',
          locale === 'en'
            ? 'Optimized 1-click Direct Review URL generated!'
            : 'Pautan 1-klik Google Review berjaya dijana!'
        );
      }
    } catch (err: any) {
      Alert.alert('Notice', locale === 'en' ? 'Using link as entered.' : 'Menggunakan pautan seperti yang dimasukkan.');
    } finally {
      setResolvingGoogleUrl(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(
        locale === 'en' ? 'Validation' : 'Pengesahan',
        locale === 'en' ? 'Branch name is required.' : 'Nama cawangan diperlukan.'
      );
      return;
    }

    if (!merchantId) {
      Alert.alert('Error', 'Missing merchant identifier.');
      return;
    }

    setSubmitting(true);
    // Only link the relation when the picker holds a real user id — it may hold a
    // placeholder (e.g. 'owner_id'), and custom names have no user behind them.
    const resolvedManagerId = !isCustomManager && /^[a-z0-9]{15}$/.test(selectedStaffId || '') ? selectedStaffId : '';
    try {
      if (editingBranch) {
        const updated = await pb.collection('branches').update(editingBranch.id, {
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          phone: phone.trim(),
          manager: resolvedManagerId,
          manager_name: managerName.trim(),
          is_hq: isHq,
          google_review_url: googleReviewUrl.trim(),
        });
        onSuccess(updated);
      } else {
        const created = await pb.collection('branches').create({
          merchant: merchantId,
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          phone: phone.trim(),
          manager: resolvedManagerId,
          manager_name: managerName.trim(),
          is_hq: isHq,
          google_review_url: googleReviewUrl.trim(),
          status: 'active',
        });
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      console.log('[BranchFormModal Error]', err.message || err);
      Alert.alert('Error', err.message || 'Failed to save branch.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDesktop && { maxWidth: 500 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBranch
                  ? locale === 'en'
                    ? 'Edit Branch'
                    : 'Kemaskini Cawangan'
                  : locale === 'en'
                  ? 'Add New Branch'
                  : 'Tambah Cawangan Baru'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#050505" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Branch Name */}
              <Text style={styles.inputLabel}>
                {locale === 'en' ? 'BRANCH NAME *' : 'NAMA CAWANGAN *'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Bangi Gateway Outlet"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />

              {/* City / Area */}
              <Text style={styles.inputLabel}>
                {locale === 'en' ? 'CITY / AREA' : 'BANDAR / KAWASAN'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Bandar Baru Bangi, Selangor"
                placeholderTextColor="#94A3B8"
                value={city}
                onChangeText={setCity}
              />

              {/* Address */}
              <Text style={styles.inputLabel}>
                {locale === 'en' ? 'FULL ADDRESS' : 'ALAMAT PENUH'}
              </Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder="e.g. No 12, Jalan Gerbang, Seksyen 15"
                placeholderTextColor="#94A3B8"
                value={address}
                onChangeText={setAddress}
                multiline
              />

              {/* Branch Google Review Link */}
              <Text style={styles.inputLabel}>
                {locale === 'en' ? 'OUTLET GOOGLE REVIEW URL (OPTIONAL)' : 'URL GOOGLE REVIEW CAWANGAN (PILIHAN)'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="https://maps.app.goo.gl/... or g.page"
                  placeholderTextColor="#94A3B8"
                  value={googleReviewUrl}
                  onChangeText={setGoogleReviewUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={handleTestGoogleReviewUrl}
                  disabled={resolvingGoogleUrl || !googleReviewUrl.trim()}
                  style={[
                    styles.verifyBtn,
                    { opacity: googleReviewUrl.trim() ? 1 : 0.5 },
                  ]}
                  activeOpacity={0.8}
                >
                  {resolvingGoogleUrl ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.verifyBtnText}>
                      {locale === 'en' ? 'Verify' : 'Sahkan'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Branch Manager Selection */}
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>
                    {locale === 'en' ? 'BRANCH MANAGER' : 'PENGURUS CAWANGAN'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (isCustomManager) {
                        setIsCustomManager(false);
                        const def = availableStaff[0];
                        if (def) {
                          setManagerName(def.name);
                          if (def.phone) setPhone(def.phone);
                          setSelectedStaffId(def.id);
                        }
                      } else {
                        setIsCustomManager(true);
                        setSelectedStaffId('');
                      }
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.toggleCustomText}>
                      {isCustomManager
                        ? locale === 'en'
                          ? '← Choose from Staff'
                          : '← Pilih Dari Staf'
                        : locale === 'en'
                        ? '+ Custom Name'
                        : '+ Tulis Nama Manual'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isCustomManager && availableStaff.length > 0 ? (
                  <View>
                    <TouchableOpacity
                      style={styles.staffPickerTrigger}
                      onPress={() => setShowStaffPickerModal(true)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={styles.staffPickerAvatar}>
                          <Text style={styles.staffPickerAvatarText}>
                            {(managerName || 'P').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.staffPickerSelectedName} numberOfLines={1}>
                              {managerName || (locale === 'en' ? 'Select a manager' : 'Pilih pengurus')}
                            </Text>
                            {availableStaff.find(
                              (s) => s.name.trim().toLowerCase() === managerName.trim().toLowerCase()
                            )?.is_owner && (
                              <View style={styles.ownerBadge}>
                                <Text style={styles.ownerBadgeText}>OWNER</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.staffPickerRoleText}>
                            {availableStaff.find(
                              (s) => s.name.trim().toLowerCase() === managerName.trim().toLowerCase()
                            )?.role_title || (locale === 'en' ? 'Staff Member' : 'Staf Berdaftar')}
                            {phone ? ` · ${phone}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.staffPickerChevronBox}>
                        <Ionicons name="swap-vertical" size={15} color="#000000" />
                      </View>
                    </TouchableOpacity>

                    {/* Quick Select Horizontal Chips */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6, paddingTop: 8, paddingBottom: 2 }}
                    >
                      {availableStaff.map((staff) => {
                        const isSelected = managerName.trim().toLowerCase() === staff.name.trim().toLowerCase();
                        return (
                          <TouchableOpacity
                            key={staff.id}
                            onPress={() => {
                              setManagerName(staff.name);
                              if (staff.phone) {
                                setPhone(staff.phone);
                              }
                              setSelectedStaffId(staff.id);
                              setIsCustomManager(false);
                            }}
                            style={[styles.staffChip, isSelected && styles.staffChipActive]}
                            activeOpacity={0.8}
                          >
                            <View style={[styles.staffChipDot, isSelected && styles.staffChipDotActive]} />
                            <Text style={[styles.staffChipText, isSelected && styles.staffChipTextActive]}>
                              {staff.name} {staff.is_owner ? '👑' : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder={locale === 'en' ? 'e.g. Encik Farhan' : 'cth: Encik Farhan'}
                    placeholderTextColor="#94A3B8"
                    value={managerName}
                    onChangeText={setManagerName}
                  />
                )}
              </View>

              {/* Contact Phone */}
              <Text style={styles.inputLabel}>
                {locale === 'en' ? 'CONTACT NUMBER' : 'NOMBOR TELEFON'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 0123456789"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              {/* Set as HQ Switch (Only when editing or allowed) */}
              <TouchableOpacity
                style={styles.hqSwitchRow}
                onPress={() => setIsHq(!isHq)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.hqSwitchTitle}>
                    {locale === 'en' ? 'Set as HQ / Main Outlet' : 'Tetapkan sebagai Cawangan Utama HQ'}
                  </Text>
                  <Text style={styles.hqSwitchSubtitle}>
                    {locale === 'en'
                      ? 'Primary branch for default staff assignments'
                      : 'Cawangan utama untuk default staf'}
                  </Text>
                </View>
                <View style={[styles.customToggle, isHq && styles.customToggleActive]}>
                  <View style={[styles.toggleCircle, isHq && styles.toggleCircleActive]} />
                </View>
              </TouchableOpacity>
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFCC00" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editingBranch
                    ? locale === 'en'
                      ? 'Save Changes'
                      : 'Simpan Perubahan'
                    : locale === 'en'
                    ? 'Create Branch'
                    : 'Daftar Cawangan'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Delete Option if editing */}
            {editingBranch && onDeleteBranch && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => onDeleteBranch(editingBranch)}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={15} color="#EF4444" />
                <Text style={styles.deleteBtnText}>
                  {locale === 'en' ? 'Delete This Branch' : 'Padam Cawangan Ini'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Staff Picker Sub-Modal */}
      <Modal
        visible={showStaffPickerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStaffPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDesktop && { maxWidth: 460 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {locale === 'en' ? 'Select Branch Manager' : 'Pilih Pengurus Cawangan'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {locale === 'en'
                    ? 'Registered staff from Staff Management'
                    : 'Staf berdaftar dari Pengurusan Staf'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowStaffPickerModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#050505" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {availableStaff.map((staff) => {
                const isSelected = managerName.trim().toLowerCase() === staff.name.trim().toLowerCase();
                return (
                  <TouchableOpacity
                    key={staff.id}
                    style={[styles.staffItemRow, isSelected && styles.staffItemRowActive]}
                    onPress={() => {
                      setManagerName(staff.name);
                      if (staff.phone) {
                        setPhone(staff.phone);
                      }
                      setSelectedStaffId(staff.id);
                      setIsCustomManager(false);
                      setShowStaffPickerModal(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={[styles.staffPickerAvatar, isSelected && { backgroundColor: '#000000' }]}>
                        <Text style={styles.staffPickerAvatarText}>
                          {staff.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text
                            style={[
                              styles.staffItemName,
                              isSelected && { fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' },
                            ]}
                          >
                            {staff.name}
                          </Text>
                          {staff.is_owner && (
                            <View style={styles.ownerBadge}>
                              <Text style={styles.ownerBadgeText}>OWNER</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.staffItemSubtitle}>
                          {staff.role_title} {staff.phone ? `· ${staff.phone}` : ''}
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <View style={styles.selectedCheckWrap}>
                        <Ionicons name="checkmark" size={14} color="#000000" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
  modalSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
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
  verifyBtn: {
    backgroundColor: '#050505',
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
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
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  staffChipTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#FFCC00',
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
  deleteBtn: {
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  deleteBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EF4444',
  },
  staffItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  staffItemRowActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  staffItemName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E293B',
  },
  staffItemSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  selectedCheckWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
