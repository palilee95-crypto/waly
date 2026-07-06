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

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  role: string;
}

export default function StaffManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Warning Modal States
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [warningTitle, setWarningTitle] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await pb.send('/api/waly/merchant/staff', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setStaff(data as StaffMember[]);
    } catch (err: any) {
      console.warn("Failed to fetch staff:", err.message || err);
      setWarningTitle("Failed to Load Staff");
      setWarningMessage(err.response?.message || err.data?.message || err.message || "Failed to load staff list.");
      setWarningModalVisible(true);
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
      Alert.alert("Validation Error", "Please enter a phone number.");
      return;
    }

    setIsAdding(true);
    try {
      await pb.send('/api/waly/merchant/staff', {
        method: 'POST',
        body: { phone: cleanPhone },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setPhoneInput('');
      Alert.alert("Success", "Staff member added successfully!");
      fetchStaff();
    } catch (err: any) {
      console.warn("Failed to add staff member:", err.response || err);
      setWarningTitle("Operation Blocked");
      setWarningMessage(err.response?.message || err.data?.message || err.message || "Failed to add staff member.");
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
      await pb.send('/api/waly/merchant/staff', {
        method: 'DELETE',
        body: { userId: selectedStaff.id },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setRemoveModalVisible(false);
      setSelectedStaff(null);
      Alert.alert("Success", "Staff member removed successfully.");
      fetchStaff();
    } catch (err: any) {
      console.warn("Failed to remove staff member:", err.response || err);
      setWarningTitle("Failed to Remove Staff");
      setWarningMessage(err.response?.message || err.data?.message || err.message || "Failed to remove staff member.");
      setWarningModalVisible(true);
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
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Staff</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionSubtitle}>
          Authorize staff members to manage your store, issue stamps, and process reward redemptions.
        </Text>

        {/* Add Staff Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Staff Member</Text>
          <Text style={styles.cardSubtitle}>
            Enter the customer's phone number to invite them as staff. They must already have an account on the Customer App.
          </Text>
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
                  <Text style={styles.addBtnText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Staff List */}
        <Text style={styles.sectionHeader}>Active Staff ({staff.length})</Text>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color="#000000" size="large" />
          </View>
        ) : staff.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="people-outline" size={32} color="#64748B" />
            </View>
            <Text style={styles.emptyTitle}>No Staff Added Yet</Text>
            <Text style={styles.emptySubtitle}>
              You currently manage this store alone. Use the form above to add your cashiers or branch managers.
            </Text>
          </View>
        ) : (
          <View style={styles.staffList}>
            {staff.map((member) => (
              <View key={member.id} style={styles.staffItem}>
                <Image source={{ uri: getAvatarUrl(member) }} style={styles.avatar} />
                <View style={styles.staffInfo}>
                  <Text style={styles.staffName}>{member.name}</Text>
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
            <Text style={styles.modalTitle}>Remove Staff Member</Text>
            <Text style={styles.modalSubtitle}>
              Are you sure you want to remove {selectedStaff?.name} from your store staff? They will immediately lose access to the merchant console.
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRemoveModalVisible(false)}
                disabled={isRemoving}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
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
                  <Text style={styles.modalConfirmText}>Remove</Text>
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
                <Text style={styles.dismissBtnText}>Dismiss</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 28,
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
    backgroundColor: '#000000',
    borderRadius: radii.md,
    height: 48,
    paddingHorizontal: 20,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sectionHeader: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
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
});
