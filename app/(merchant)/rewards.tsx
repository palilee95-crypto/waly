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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { colors, radii } from '@/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

interface Reward {
  id: string;
  title: string;
  description: string;
  points_cost: number;
  stock: number;
  is_active: boolean;
  type: 'free_item' | 'discount' | 'experience' | 'cash_credit';
  image: string;
}

export default function RewardsManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Form States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPointsCost, setFormPointsCost] = useState('100');
  const [formStock, setFormStock] = useState('50');
  const [formType, setFormType] = useState<'free_item' | 'discount' | 'experience' | 'cash_credit'>('free_item');
  const [formIsActive, setFormIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirm Dialog States
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedDeleteReward, setSelectedDeleteReward] = useState<Reward | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchRewards = async () => {
    if (!user || !user.merchant_id) return;
    try {
      setLoading(true);
      const records = await pb.collection('rewards').getFullList({
        filter: `merchant = "${user.merchant_id}"`,
        sort: '-created',
        requestKey: null,
      });
      setRewards(records as any[]);
    } catch (err: any) {
      console.warn("Failed to fetch rewards:", err.message || err);
      Alert.alert("Error", "Failed to load rewards catalogue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, [user]);

  const handleOpenCreate = () => {
    setEditingReward(null);
    setFormTitle('');
    setFormDesc('');
    setFormPointsCost('100');
    setFormStock('50');
    setFormType('free_item');
    setFormIsActive(true);
    setImageFile(null);
    setImagePreview(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (reward: Reward) => {
    setEditingReward(reward);
    setFormTitle(reward.title);
    setFormDesc(reward.description || '');
    setFormPointsCost(String(reward.points_cost || 0));
    setFormStock(String(reward.stock || 0));
    setFormType(reward.type || 'free_item');
    setFormIsActive(!!reward.is_active);
    setImageFile(null);
    if (reward.image) {
      setImagePreview(`${pb.baseUrl}/api/files/rewards/${reward.id}/${reward.image}`);
    } else {
      setImagePreview(null);
    }
    setModalVisible(true);
  };

  const handlePickImage = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          setImageFile(file);
          const reader = new FileReader();
          reader.onload = (event: any) => {
            setImagePreview(event.target.result);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert("Not Supported", "Image upload is only supported on the Web version of the Merchant Portal.");
    }
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      Alert.alert("Validation Error", "Please enter a reward title.");
      return;
    }

    const pointsCostVal = parseInt(formPointsCost, 10);
    if (isNaN(pointsCostVal) || pointsCostVal < 0) {
      Alert.alert("Validation Error", "Points cost must be a positive number.");
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('merchant', user!.merchant_id);
      formData.append('title', formTitle.trim());
      formData.append('description', formDesc.trim());
      formData.append('points_cost', String(pointsCostVal));
      formData.append('stock', String(parseInt(formStock, 10) || 0));
      formData.append('type', formType);
      formData.append('is_active', String(formIsActive));
      
      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (editingReward) {
        await pb.collection('rewards').update(editingReward.id, formData);
        Alert.alert("Success", "Reward updated successfully!");
      } else {
        await pb.collection('rewards').create(formData);
        Alert.alert("Success", "Reward created successfully!");
      }

      setModalVisible(false);
      fetchRewards();
    } catch (err: any) {
      console.warn("Failed to save reward:", err.message || err);
      Alert.alert("Error", err.message || "Failed to save reward.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDelete = (reward: Reward) => {
    setSelectedDeleteReward(reward);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!selectedDeleteReward) return;
    setIsDeleting(true);
    try {
      await pb.collection('rewards').delete(selectedDeleteReward.id);
      setDeleteModalVisible(false);
      Alert.alert("Success", "Reward deleted successfully!");
      fetchRewards();
    } catch (err: any) {
      console.warn("Failed to delete reward:", err.message || err);
      Alert.alert("Error", "Failed to delete reward.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case 'free_item': return 'Free Item';
      case 'discount': return 'Discount';
      case 'experience': return 'Experience';
      case 'cash_credit': return 'Cash Credit';
      default: return 'Reward';
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards Catalogue</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreate} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introSection}>
          <Text style={styles.screenTitle}>Points Catalogue</Text>
          <Text style={styles.screenSubtitle}>
            Configure items and discounts your customers can redeem using their points balance.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={styles.loadingText}>Loading catalogue...</Text>
          </View>
        ) : rewards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="gift-outline" size={48} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>Catalogue is Empty</Text>
            <Text style={styles.emptySubtitle}>
              You haven't added any rewards for your customers to redeem yet. Click the "+" button in the top right to create your first reward!
            </Text>
            <TouchableOpacity style={styles.createFirstBtn} onPress={handleOpenCreate} activeOpacity={0.8}>
              <Text style={styles.createFirstText}>Add First Reward</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.rewardsList}>
            {rewards.map((reward) => {
              const itemImgUrl = reward.image
                ? `${pb.baseUrl}/api/files/rewards/${reward.id}/${reward.image}`
                : 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=150';

              return (
                <View key={reward.id} style={styles.rewardCard}>
                  <Image source={{ uri: itemImgUrl }} style={styles.rewardImage} />
                  
                  <View style={styles.rewardInfo}>
                    <View style={styles.rewardHeaderRow}>
                      <View style={[styles.typeBadge, { backgroundColor: reward.is_active ? '#F1F5F9' : '#F1F5F9' }]}>
                        <Text style={styles.typeBadgeText}>{getRewardTypeLabel(reward.type)}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: reward.is_active ? '#E8F5E9' : '#F1F5F9' }]}>
                        <Text style={[styles.statusBadgeText, { color: reward.is_active ? '#10B981' : '#64748B' }]}>
                          {reward.is_active ? 'Active' : 'Draft'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.rewardTitle} numberOfLines={1}>{reward.title}</Text>
                    <Text style={styles.rewardDesc} numberOfLines={2}>{reward.description || 'No description provided.'}</Text>
                    
                    <View style={styles.rewardFooterRow}>
                      <View style={styles.pointsCostContainer}>
                        <Ionicons name="gift" size={14} color="#10B981" />
                        <Text style={styles.pointsCostText}>{reward.points_cost} Pts</Text>
                      </View>
                      <Text style={styles.stockText}>Stock: {reward.stock || '0'}</Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleOpenEdit(reward)}>
                      <Ionicons name="create-outline" size={18} color="#475569" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleOpenDelete(reward)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Save Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingReward ? 'Edit Reward' : 'Add New Reward'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              {/* Image Picker */}
              <View style={styles.imagePickerContainer}>
                <TouchableOpacity style={styles.avatarPicker} onPress={handlePickImage} activeOpacity={0.85}>
                  {imagePreview ? (
                    <Image source={{ uri: imagePreview }} style={styles.pickerImg} />
                  ) : (
                    <View style={styles.pickerPlaceholder}>
                      <Ionicons name="image-outline" size={32} color="#94A3B8" />
                      <Text style={styles.pickerText}>Upload Image</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Title Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Reward Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="e.g. Free Hot Americano"
                  placeholderTextColor="#94A3B8"
                  {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                />
              </View>

              {/* Points Cost */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Points Cost</Text>
                <TextInput
                  style={styles.textInput}
                  value={formPointsCost}
                  onChangeText={setFormPointsCost}
                  placeholder="e.g. 200"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                />
              </View>

              {/* Stock */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Stock Availability</Text>
                <TextInput
                  style={styles.textInput}
                  value={formStock}
                  onChangeText={setFormStock}
                  placeholder="e.g. 100"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                />
              </View>

              {/* Type Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Reward Type</Text>
                <View style={styles.typeSelectionGrid}>
                  {['free_item', 'discount', 'experience', 'cash_credit'].map((t: any) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeSelectBtn, formType === t && styles.typeSelectBtnActive]}
                      onPress={() => setFormType(t)}
                    >
                      <Text style={[styles.typeSelectText, formType === t && styles.typeSelectTextActive]}>
                        {getRewardTypeLabel(t)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description / Terms</Text>
                <TextInput
                  style={[styles.textInput, { height: 80, textAlignVertical: 'top', paddingVertical: 10 }]}
                  multiline
                  numberOfLines={3}
                  value={formDesc}
                  onChangeText={setFormDesc}
                  placeholder="Describe the reward and redemption terms..."
                  placeholderTextColor="#94A3B8"
                  {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                />
              </View>

              {/* Is Active Toggle */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Publish Reward</Text>
                  <Text style={styles.switchDesc}>Make this reward immediately visible to customers.</Text>
                </View>
                <Switch
                  value={formIsActive}
                  onValueChange={setFormIsActive}
                  trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Form Action */}
              <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveSubmitBtnText}>{editingReward ? 'Save Changes' : 'Create Reward'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.deleteIconBg}>
              <Ionicons name="trash" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Delete Reward</Text>
            <Text style={styles.modalSubtitle}>
              Are you sure you want to delete "{selectedDeleteReward?.title}" from your catalogue? This action cannot be undone.
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmDelete}
                disabled={isDeleting}
                activeOpacity={0.8}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Delete</Text>
                )}
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
  headerRow: {
    flexDirection: 'row',
    height: 56,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  introSection: {
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  screenSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_500Medium',
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  createFirstBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  createFirstText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
  },
  rewardsList: {
    gap: 12,
  },
  rewardCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  rewardImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  rewardInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  rewardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  typeBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  rewardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  rewardDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
  },
  rewardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  pointsCostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsCostText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
  },
  stockText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  cardActions: {
    flexDirection: 'column',
    gap: 8,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#F1F5F9',
    marginLeft: 12,
  },
  actionIconBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  modalForm: {
    width: '100%',
  },
  imagePickerContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  avatarPicker: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pickerImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pickerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pickerText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  typeSelectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeSelectBtnActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  typeSelectText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  typeSelectTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginVertical: 12,
  },
  switchLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  switchDesc: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
    maxWidth: 240,
  },
  saveSubmitBtn: {
    backgroundColor: '#000000',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    width: '100%',
  },
  saveSubmitBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
  },
  deleteIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
