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
import { Ionicons, FontAwesome, MaterialIcons, Feather } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

// Existing Catalogue Reward Interface
interface Reward {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  stock: number;
  is_active: boolean;
  type: 'free_item' | 'discount' | 'experience' | 'cash_credit';
  image: string;
}

// Icon options for custom stamp card design
type StampIconOption = {
  id: string;
  family: 'Ionicons' | 'FontAwesome' | 'MaterialIcons';
  name: any;
};

const stampIcons: StampIconOption[] = [
  { id: 'ticket', family: 'Ionicons', name: 'ticket-sharp' },
  { id: 'star', family: 'FontAwesome', name: 'star' },
  { id: 'heart', family: 'Ionicons', name: 'heart' },
  { id: 'coffee', family: 'MaterialIcons', name: 'local-cafe' },
  { id: 'cake', family: 'MaterialIcons', name: 'cake' },
  { id: 'restaurant', family: 'Ionicons', name: 'restaurant' },
  { id: 'tag', family: 'Ionicons', name: 'pricetag' },
  { id: 'gift', family: 'Ionicons', name: 'gift' },
  { id: 'beer', family: 'Ionicons', name: 'beer' },
  { id: 'pizza', family: 'Ionicons', name: 'pizza' },
  { id: 'card', family: 'Ionicons', name: 'card' },
  { id: 'store', family: 'Ionicons', name: 'storefront' },
  { id: 'car', family: 'Ionicons', name: 'car-sport' },
  { id: 'icecream', family: 'Ionicons', name: 'ice-cream' },
  { id: 'barbell', family: 'Ionicons', name: 'barbell' },
  { id: 'scissors', family: 'Ionicons', name: 'scissors' },
  { id: 'bag', family: 'Ionicons', name: 'bag-handle' },
  { id: 'sparkles', family: 'Ionicons', name: 'sparkles' },
];

const colorOptions = [
  { label: 'Carbon Black', value: '#000000' },
  { label: 'Deep Indigo', value: '#1E1B4B' },
  { label: 'Emerald Green', value: '#064E3B' },
  { label: 'Wine Crimson', value: '#4C0519' },
  { label: 'Amber Gold', value: '#78350F' },
  { label: 'Royal Blue', value: '#1E3A8A' },
];

const stampColorOptions = [
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Green', value: '#10B981' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Black', value: '#000000' },
];

const fontColorOptions = [
  { label: 'White', value: '#FFFFFF' },
  { label: 'Black', value: '#000000' },
  { label: 'Slate', value: '#1E293B' },
  { label: 'Gold', value: '#FFD700' },
];

export default function UnifiedRewardsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Sub-tabs Selection
  const [activeTab, setActiveTab] = useState<'catalogue' | 'card_design' | 'points_tiers'>('catalogue');

  // Shared Loading & Authorization States
  const [merchant, setMerchant] = useState<any>(null);
  const [loadingMerchant, setLoadingMerchant] = useState(true);

  // Tab 1: Catalogue Management States
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
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
  const [isSavingReward, setIsSavingReward] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedDeleteReward, setSelectedDeleteReward] = useState<Reward | null>(null);
  const [isDeletingReward, setIsDeletingReward] = useState(false);

  // Tab 2: Stamp Card Customizer States
  const [programId, setProgramId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [requiredStamps, setRequiredStamps] = useState<5 | 10 | 15>(10);
  const [expiryDays, setExpiryDays] = useState('30');
  const [rewardDesc, setRewardDesc] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>('coffee');
  const [cardColor, setCardColor] = useState<string>('#000000');
  const [customHexInput, setCustomHexInput] = useState<string>('#000000');
  const [stampColor, setStampColor] = useState<string>('#3B82F6');
  const [customStampHexInput, setCustomStampHexInput] = useState<string>('#3B82F6');
  const [fontColor, setFontColor] = useState<string>('#FFFFFF');
  const [customFontHexInput, setCustomFontHexInput] = useState<string>('#FFFFFF');
  const [bgImage, setBgImage] = useState<string>('');
  const [bgFile, setBgFile] = useState<any>(null);
  const [removeBgImage, setRemoveBgImage] = useState<boolean>(false);
  const [isSavingCard, setIsSavingCard] = useState(false);

  const [expiryFocused, setExpiryFocused] = useState(false);
  const [rewardFocused, setRewardFocused] = useState(false);

  const activeIconObj = stampIcons.find((i) => i.id === selectedIcon) || stampIcons[0];

  const fetchMerchantAndProgram = async () => {
    if (!user || !user.merchant_id) return;
    try {
      setLoadingMerchant(true);
      // 1. Fetch merchant details
      const mRec = await pb.collection('merchants').getOne(user.merchant_id);
      setMerchant(mRec);

      // 2. Fetch active stamp program details
      const prog = await pb.collection('loyalty_programs')
        .getFirstListItem(`merchant = "${user.merchant_id}"`)
        .catch(() => null);

      if (prog) {
        setProgramId(prog.id);
        setIsActive(prog.is_active);
        setRequiredStamps(prog.stamp_goal as any || 10);
        setExpiryDays(String(prog.expiry_days || '30'));
        setRewardDesc(prog.reward_description || '');
        setSelectedIcon(prog.card_icon || 'coffee');
        setCardColor(prog.card_color || '#000000');
        setCustomHexInput(prog.card_color || '#000000');
        setStampColor(prog.stamp_color || '#3B82F6');
        setCustomStampHexInput(prog.stamp_color || '#3B82F6');
        setFontColor(prog.font_color || '#FFFFFF');
        setCustomFontHexInput(prog.font_color || '#FFFFFF');
        setBgImage(prog.card_background ? `${pb.baseUrl}/api/files/loyalty_programs/${prog.id}/${prog.card_background}` : '');
        setBgFile(null);
        setRemoveBgImage(false);
      }
    } catch (err: any) {
      console.warn("Failed to load merchant settings:", err.message || err);
    } finally {
      setLoadingMerchant(false);
    }
  };

  const fetchRewards = async () => {
    if (!user || !user.merchant_id) return;
    try {
      setLoadingRewards(true);
      const records = await pb.collection('rewards').getFullList({
        filter: `merchant = "${user.merchant_id}"`,
        sort: '-created',
        requestKey: null,
      });
      setRewards(records as any[]);
    } catch (err: any) {
      console.warn("Failed to fetch rewards:", err.message || err);
    } finally {
      setLoadingRewards(false);
    }
  };

  useEffect(() => {
    fetchMerchantAndProgram();
    fetchRewards();
  }, [user]);

  // Tab 1: Catalogue Handlers
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
    setFormTitle(reward.name);
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
      Alert.alert("Not Supported", "Image upload is web-only in this demo.");
    }
  };

  const handleSaveReward = async () => {
    if (!formTitle.trim()) {
      Alert.alert("Validation Error", "Please enter a reward title.");
      return;
    }

    const pointsCostVal = parseInt(formPointsCost, 10);
    if (isNaN(pointsCostVal) || pointsCostVal < 0) {
      Alert.alert("Validation Error", "Points cost must be a positive number.");
      return;
    }

    setIsSavingReward(true);
    try {
      const formData = new FormData();
      formData.append('merchant', user!.merchant_id);
      formData.append('name', formTitle.trim());
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
      setIsSavingReward(false);
    }
  };

  const handleOpenDelete = (reward: Reward) => {
    setSelectedDeleteReward(reward);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!selectedDeleteReward) return;
    setIsDeletingReward(true);
    try {
      await pb.collection('rewards').delete(selectedDeleteReward.id);
      setDeleteModalVisible(false);
      Alert.alert("Success", "Reward deleted successfully!");
      fetchRewards();
    } catch (err: any) {
      console.warn("Failed to delete reward:", err.message || err);
      Alert.alert("Error", "Failed to delete reward.");
    } finally {
      setIsDeletingReward(false);
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

  // Tab 2: Stamp Card Handlers
  const handlePickCardBg = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          setBgFile(file);
          setBgImage(URL.createObjectURL(file));
          setRemoveBgImage(false);
        }
      };
      input.click();
    } else {
      Alert.alert("Not Supported", "Image upload is web-only in this demo.");
    }
  };

  const handleSaveCardConfig = async () => {
    if (!user || !user.merchant_id) return;
    if (!rewardDesc.trim()) {
      Alert.alert("Validation Error", "Please enter a Reward Description.");
      return;
    }
    const days = parseInt(expiryDays, 10);
    if (isNaN(days) || days <= 0) {
      Alert.alert("Validation Error", "Please enter a valid number of days for card expiry.");
      return;
    }

    setIsSavingCard(true);
    try {
      const payload: any = {
        merchant: user.merchant_id,
        name: `${merchant?.name || 'Store'} Reward Card`,
        is_active: isActive,
        stamp_goal: requiredStamps,
        reward_description: rewardDesc.trim(),
        card_color: cardColor,
        stamp_color: stampColor,
        font_color: fontColor,
        card_icon: selectedIcon,
        points_per_stamp: 10,
        expiry_days: days,
      };

      if (bgFile) {
        const formData = new FormData();
        Object.keys(payload).forEach(key => {
          formData.append(key, String(payload[key]));
        });
        formData.append('card_background', bgFile);

        if (programId) {
          const updated = await pb.collection('loyalty_programs').update(programId, formData);
          setBgImage(updated.card_background ? `${pb.baseUrl}/api/files/loyalty_programs/${updated.id}/${updated.card_background}` : '');
          setBgFile(null);
          setRemoveBgImage(false);
        } else {
          const newProg = await pb.collection('loyalty_programs').create(formData);
          setProgramId(newProg.id);
          setBgImage(newProg.card_background ? `${pb.baseUrl}/api/files/loyalty_programs/${newProg.id}/${newProg.card_background}` : '');
          setBgFile(null);
          setRemoveBgImage(false);
        }
      } else {
        if (removeBgImage) {
          payload.card_background = null;
        }

        if (programId) {
          await pb.collection('loyalty_programs').update(programId, payload);
        } else {
          const newProg = await pb.collection('loyalty_programs').create(payload);
          setProgramId(newProg.id);
        }
      }

      Alert.alert("Configuration Saved", "Your loyalty reward program card design and settings have been synced successfully.");
    } catch (err: any) {
      console.warn(err);
      Alert.alert("Error", err.message || "Failed to save card configuration.");
    } finally {
      setIsSavingCard(false);
    }
  };

  const renderPreviewStamps = () => {
    const previewSlots = [];
    for (let i = 1; i <= requiredStamps; i++) {
      const isEarned = i <= 3; // Mock 3 completed stamps for display
      previewSlots.push(
        <View 
          key={i} 
          style={[
            styles.previewSlot,
            isEarned && {
              backgroundColor: stampColor,
              borderStyle: 'solid',
              borderColor: 'rgba(255, 255, 255, 0.15)'
            }
          ]}
        >
          {activeIconObj.family === 'Ionicons' && (
            <Ionicons name={activeIconObj.name} size={18} color={isEarned ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)'} />
          )}
          {activeIconObj.family === 'FontAwesome' && (
            <FontAwesome name={activeIconObj.name} size={18} color={isEarned ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)'} />
          )}
          {activeIconObj.family === 'MaterialIcons' && (
            <MaterialIcons name={activeIconObj.name} size={18} color={isEarned ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)'} />
          )}
        </View>
      );
    }
    return previewSlots;
  };

  const merchantLogo = merchant?.logo
    ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
    : 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&q=80&w=120';

  if (loadingMerchant) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading loyalty configurations...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* Restrict to Owner Modal Overlay */}
      <Modal
        visible={merchant !== null && merchant.owner !== user?.id}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.restrictionOverlay}>
          <View style={styles.restrictionContent}>
            <View style={styles.lockIconBg}>
              <Ionicons name="lock-closed" size={44} color="#EF4444" />
            </View>
            <Text style={styles.restrictionTitle}>Store Owner Only</Text>
            <Text style={styles.restrictionSubtitle}>
              This configuration panel is restricted to the merchant store owner. Please contact your administrator to make design updates.
            </Text>
            <TouchableOpacity
              style={styles.restrictionBtn}
              onPress={() => router.replace('/(merchant)/give' as any)}
              activeOpacity={0.9}
            >
              <Text style={styles.restrictionBtnText}>Go Back Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header Row */}
      <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loyalty Settings</Text>
        {activeTab === 'catalogue' ? (
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreate} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={styles.introSection}>
          <Text style={styles.screenTitle}>Rewards & Loyalty Setup</Text>
          <Text style={styles.screenSubtitle}>
            Configure your customer loyalty experience, visual card details, point rules, and catalog items.
          </Text>
        </View>

        {/* Tab Selection Bar */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'catalogue' && styles.tabBtnActive]}
            onPress={() => setActiveTab('catalogue')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabBtnText, activeTab === 'catalogue' && styles.tabBtnTextActive]}>
              Catalogue
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'card_design' && styles.tabBtnActive]}
            onPress={() => setActiveTab('card_design')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabBtnText, activeTab === 'card_design' && styles.tabBtnTextActive]}>
              Card Design
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'points_tiers' && styles.tabBtnActive]}
            onPress={() => setActiveTab('points_tiers')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabBtnText, activeTab === 'points_tiers' && styles.tabBtnTextActive]}>
              Points & Tiers
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: Rewards Catalogue */}
        {activeTab === 'catalogue' && (
          <View style={{ marginTop: 12 }}>
            {loadingRewards ? (
              <ActivityIndicator size="large" color="#000000" style={{ marginVertical: 40 }} />
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
                          <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{getRewardTypeLabel(reward.type)}</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: reward.is_active ? '#E8F5E9' : '#F1F5F9' }]}>
                            <Text style={[styles.statusBadgeText, { color: reward.is_active ? '#10B981' : '#64748B' }]}>
                              {reward.is_active ? 'Active' : 'Draft'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.rewardTitle} numberOfLines={1}>{reward.name}</Text>
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
          </View>
        )}

        {/* TAB 2: Card Customizer */}
        {activeTab === 'card_design' && (
          <View style={{ marginTop: 12, gap: 16 }}>
            {/* Toggle Program Status */}
            <View style={styles.configCard}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.cardSectionTitle}>Enable Loyalty Program</Text>
                  <Text style={styles.cardSectionDesc}>
                    Instantly activate or pause this loyalty stamp program for your shop.
                  </Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#E2E8F0', true: '#000000' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Stamps Goal selector */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>Total Stamps Required</Text>
              <Text style={styles.cardSectionDesc}>
                Set the number of stamp collections milestones for voucher completion.
              </Text>
              <View style={styles.segmentRow}>
                {[5, 10, 15].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.segmentBtn,
                      requiredStamps === num && styles.segmentBtnActive,
                    ]}
                    onPress={() => setRequiredStamps(num as any)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        requiredStamps === num && styles.segmentTextActive,
                      ]}
                    >
                      {num} Stamps
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Card Background Color Selector */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>Card Background Color</Text>
              <View style={styles.colorRow}>
                {colorOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: opt.value },
                      cardColor === opt.value && styles.colorCircleActive,
                    ]}
                    onPress={() => {
                      setCardColor(opt.value);
                      setCustomHexInput(opt.value);
                    }}
                    activeOpacity={0.8}
                  >
                    {cardColor === opt.value && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ))}
                
                {Platform.OS === 'web' && (
                  <TouchableOpacity
                    style={[
                      styles.colorCircle,
                      styles.colorWheelCircle,
                      !colorOptions.some(opt => opt.value === cardColor) && styles.colorCircleActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="color-filter-outline" size={16} color="#000000" />
                    <input
                      type="color"
                      style={styles.webColorPickerInput}
                      value={cardColor}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setCardColor(val);
                        setCustomHexInput(val);
                      }}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.hexInputContainer}>
                <Text style={styles.hexInputLabel}>Custom Hex Code</Text>
                <View style={styles.hexInputWrapper}>
                  <Text style={styles.hexHashSymbol}>#</Text>
                  <TextInput
                    style={styles.hexTextInput}
                    value={customHexInput.replace('#', '')}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                      setCustomHexInput('#' + cleaned);
                      if (cleaned.length === 6) {
                        setCardColor('#' + cleaned.toUpperCase());
                      }
                    }}
                    placeholder="000000"
                    placeholderTextColor="#BEC6E0"
                    maxLength={6}
                    {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                  />
                  <View style={[styles.hexColorPreview, { backgroundColor: cardColor }]} />
                </View>
              </View>
            </View>

            {/* Collected Stamp Slots Color Selector */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>Collected Stamp Slots Color</Text>
              <View style={styles.colorRow}>
                {stampColorOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: opt.value },
                      stampColor === opt.value && styles.stampColorCircleActive,
                    ]}
                    onPress={() => {
                      setStampColor(opt.value);
                      setCustomStampHexInput(opt.value);
                    }}
                    activeOpacity={0.8}
                  >
                    {stampColor === opt.value && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ))}
                
                {Platform.OS === 'web' && (
                  <TouchableOpacity
                    style={[
                      styles.colorCircle,
                      styles.colorWheelCircle,
                      !stampColorOptions.some(opt => opt.value === stampColor) && styles.stampColorCircleActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="color-filter-outline" size={16} color="#000000" />
                    <input
                      type="color"
                      style={styles.webColorPickerInput}
                      value={stampColor}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setStampColor(val);
                        setCustomStampHexInput(val);
                      }}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.hexInputContainer}>
                <Text style={styles.hexInputLabel}>Custom Hex Code</Text>
                <View style={styles.hexInputWrapper}>
                  <Text style={styles.hexHashSymbol}>#</Text>
                  <TextInput
                    style={styles.hexTextInput}
                    value={customStampHexInput.replace('#', '')}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                      setCustomStampHexInput('#' + cleaned);
                      if (cleaned.length === 6) {
                        setStampColor('#' + cleaned.toUpperCase());
                      }
                    }}
                    placeholder="3B82F6"
                    placeholderTextColor="#BEC6E0"
                    maxLength={6}
                    {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                  />
                  <View style={[styles.hexColorPreview, { backgroundColor: stampColor }]} />
                </View>
              </View>
            </View>

            {/* Stamp Card Font Color Selector */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>Select Card Text Color</Text>
              <View style={styles.colorRow}>
                {fontColorOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: opt.value, borderWidth: 1, borderColor: '#E2E8F0' },
                      fontColor === opt.value && styles.colorCircleActive,
                    ]}
                    onPress={() => {
                      setFontColor(opt.value);
                      setCustomFontHexInput(opt.value);
                    }}
                    activeOpacity={0.8}
                  >
                    {fontColor === opt.value && (
                      <Ionicons 
                        name="checkmark" 
                        size={14} 
                        color={fontColor === '#FFFFFF' ? '#000000' : '#FFFFFF'} 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Stamp Icons Picker */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>Stamp Check Icon</Text>
              <Text style={styles.cardSectionDesc}>
                Choose the visual checkmark symbol displayed inside earned stamp slots.
              </Text>
              <View style={styles.iconsGrid}>
                {stampIcons.map((icon) => (
                  <TouchableOpacity
                    key={icon.id}
                    style={[
                      styles.iconOption,
                      selectedIcon === icon.id && styles.iconOptionActive,
                    ]}
                    onPress={() => setSelectedIcon(icon.id)}
                    activeOpacity={0.8}
                  >
                    {icon.family === 'Ionicons' && (
                      <Ionicons name={icon.name} size={20} color={selectedIcon === icon.id ? '#000000' : '#64748B'} />
                    )}
                    {icon.family === 'FontAwesome' && (
                      <FontAwesome name={icon.name} size={20} color={selectedIcon === icon.id ? '#000000' : '#64748B'} />
                    )}
                    {icon.family === 'MaterialIcons' && (
                      <MaterialIcons name={icon.name} size={20} color={selectedIcon === icon.id ? '#000000' : '#64748B'} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Background Image Uploader */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>Custom Background Image</Text>
              <Text style={styles.cardSectionDesc}>
                Upload a landscape brand image overlay for your card back. Recommended: 800x450, max 2MB.
              </Text>
              <View style={styles.bgUploadRow}>
                {bgImage ? (
                  <View style={styles.bgPreviewContainer}>
                    <Image source={{ uri: bgImage }} style={styles.bgPreviewThumb} />
                    <TouchableOpacity 
                      style={styles.bgRemoveBtn}
                      onPress={() => {
                        setBgImage('');
                        setBgFile(null);
                        setRemoveBgImage(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.bgUploadBtn}
                    onPress={handlePickCardBg}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cloud-upload-outline" size={24} color="#64748B" />
                    <Text style={styles.bgUploadBtnText}>Upload Card Image</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Expiry and Milestone reward configs */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>Card Expiration Days</Text>
              <View style={[styles.inputWrapper, expiryFocused && styles.inputWrapperFocused]}>
                <TextInput
                  style={styles.textInput}
                  value={expiryDays}
                  onChangeText={setExpiryDays}
                  keyboardType="number-pad"
                  placeholder="e.g. 30"
                  placeholderTextColor="#94A3B8"
                  onFocus={() => setExpiryFocused(true)}
                  onBlur={() => setExpiryFocused(false)}
                  {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                />
                <Text style={styles.inputSuffix}>Days</Text>
              </View>
            </View>

            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>Stamp Completion Milestone Reward Description</Text>
              <View style={[styles.inputWrapper, rewardFocused && styles.inputWrapperFocused, { height: 80, alignItems: 'flex-start', paddingTop: 10 }]}>
                <TextInput
                  style={[styles.textInput, { height: 60, flex: 1 }]}
                  value={rewardDesc}
                  onChangeText={setRewardDesc}
                  placeholder="e.g. Completing card awards one Free Double Cheeseburger"
                  placeholderTextColor="#94A3B8"
                  multiline
                  onFocus={() => setRewardFocused(true)}
                  onBlur={() => setRewardFocused(false)}
                  {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                />
              </View>
            </View>

            {/* Live Visual Preview Header */}
            <Text style={styles.previewSectionHeader}>LIVE PREVIEW CARD</Text>

            {/* Premium EMV Preview Card Layout */}
            <View style={[styles.liveCardPreview, { backgroundColor: cardColor }]}>
              {bgImage ? (
                <Image 
                  source={{ uri: bgImage }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : null}

              <View style={styles.cardPreviewHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.previewTitle, { color: fontColor }]} numberOfLines={1}>
                    {merchant?.name || 'Your Shop'}
                  </Text>
                  <Text style={[styles.shopCategoryText, { color: fontColor, opacity: 0.65 }]}>
                    {(merchant?.category || 'FOOD').toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#DC2626' }]}>
                  <Text style={styles.statusText}>{isActive ? 'ACTIVE' : 'PAUSED'}</Text>
                </View>
              </View>

              <View style={styles.cardMidRow}>
                <View style={styles.cardChip}>
                  <View style={styles.chipLineHoriz} />
                  <View style={styles.chipLineVert} />
                  <View style={styles.chipCenterPin} />
                </View>
                <Ionicons 
                  name="wifi" 
                  size={18} 
                  color={fontColor ? fontColor : "rgba(255, 255, 255, 0.35)"} 
                  style={{ opacity: 0.35 }} 
                />
              </View>

              <View style={styles.previewGrid}>{renderPreviewStamps()}</View>

              <View style={styles.cardBottomRow}>
                <View style={styles.holderBlock}>
                  <Text style={[styles.cardLabelText, { color: fontColor, opacity: 0.5 }]}>
                    CARD HOLDER
                  </Text>
                  <Text style={[styles.holderValueText, { color: fontColor }]} numberOfLines={1}>
                    {(user?.name || 'Ahmad Fazli').toUpperCase()}
                  </Text>
                </View>

                <View style={styles.validBlock}>
                  <Text style={[styles.cardLabelText, { color: fontColor, opacity: 0.5 }]}>
                    VALID
                  </Text>
                  <Text style={[styles.holderValueText, { color: fontColor }]}>
                    12/30
                  </Text>
                </View>

                <View style={styles.cvvBlock}>
                  <Text style={[styles.cardLabelText, { color: fontColor, opacity: 0.5 }]}>
                    CVV
                  </Text>
                  <Text style={[styles.holderValueText, { color: fontColor }]}>
                    ***
                  </Text>
                </View>

                <View style={styles.mastercardBadge}>
                  <View style={[styles.badgeCircle, { backgroundColor: 'rgba(255,255,255,0.4)', marginRight: -8 }]} />
                  <View style={[styles.badgeCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
                </View>
              </View>
            </View>

            {/* Action Save Button */}
            <TouchableOpacity 
              style={styles.saveSubmitBtn} 
              onPress={handleSaveCardConfig} 
              disabled={isSavingCard}
              activeOpacity={0.9}
            >
              {isSavingCard ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveSubmitBtnText}>Save Card Configuration</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 3: Points & Tiers Rules Dashboard */}
        {activeTab === 'points_tiers' && (
          <View style={{ marginTop: 12, gap: 16 }}>
            {/* Calculation Rules Info Block */}
            <View style={styles.configCard}>
              <View style={styles.pointsRuleHeader}>
                <Ionicons name="calculator-outline" size={24} color="#10B981" />
                <Text style={styles.ruleSectionTitle}>Earning Calculation Rules</Text>
              </View>
              <Text style={styles.pointsRuleText}>
                Your shop uses <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>Option B-2: Shop-Specific spend loyalty points</Text>. 
                Points earning is directly proportional to bill spending subtotal:
              </Text>
              <View style={styles.formulaBox}>
                <Text style={styles.formulaText}>RM 1.00 spent = 1.0 Base Point</Text>
              </View>
              <Text style={styles.helpText}>
                When manual stamps are credited to a customer's visit, the bill subtotal amount entered is automatically debited to their loyalty card point balance as base points.
              </Text>
            </View>

            {/* Tiers configurations breakdown list */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>Membership Tiers & Multipliers</Text>
              <Text style={styles.cardSectionDesc}>
                Customers automatically advance to premium tiers based on points earned at your store in the last 12 rolling months.
              </Text>

              <View style={styles.tiersContainer}>
                {/* Bronze */}
                <View style={styles.tierListItem}>
                  <View style={styles.tierBadgeHeader}>
                    <View style={[styles.tierCircle, { backgroundColor: '#B45309' }]} />
                    <View>
                      <Text style={styles.tierName}>Bronze Tier</Text>
                      <Text style={styles.tierThreshold}>Spend: RM 0 - RM 99</Text>
                    </View>
                  </View>
                  <View style={styles.multiplierBox}>
                    <Text style={styles.multiplierText}>1.0x Pts</Text>
                  </View>
                </View>

                {/* Silver */}
                <View style={styles.tierListItem}>
                  <View style={styles.tierBadgeHeader}>
                    <View style={[styles.tierCircle, { backgroundColor: '#94A3B8' }]} />
                    <View>
                      <Text style={styles.tierName}>Silver Tier</Text>
                      <Text style={styles.tierThreshold}>Spend: RM 100 - RM 299</Text>
                    </View>
                  </View>
                  <View style={[styles.multiplierBox, { backgroundColor: '#F1F5F9' }]}>
                    <Text style={[styles.multiplierText, { color: '#475569' }]}>1.25x Pts</Text>
                  </View>
                </View>

                {/* Gold */}
                <View style={styles.tierListItem}>
                  <View style={styles.tierBadgeHeader}>
                    <View style={[styles.tierCircle, { backgroundColor: '#D97706' }]} />
                    <View>
                      <Text style={styles.tierName}>Gold Tier</Text>
                      <Text style={styles.tierThreshold}>Spend: RM 300 - RM 499</Text>
                    </View>
                  </View>
                  <View style={[styles.multiplierBox, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.multiplierText, { color: '#B45309' }]}>1.5x Pts</Text>
                  </View>
                </View>

                {/* Platinum */}
                <View style={styles.tierListItem}>
                  <View style={styles.tierBadgeHeader}>
                    <View style={[styles.tierCircle, { backgroundColor: '#1E1B4B' }]} />
                    <View>
                      <Text style={styles.tierName}>Platinum Tier</Text>
                      <Text style={styles.tierThreshold}>Spend: RM 500+</Text>
                    </View>
                  </View>
                  <View style={[styles.multiplierBox, { backgroundColor: '#EEF2FF' }]}>
                    <Text style={[styles.multiplierText, { color: '#312E81' }]}>2.0x Pts</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Save Reward Modal */}
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
                  {['free_item', 'discount'].map((t: any) => (
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
              <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveReward} disabled={isSavingReward}>
                {isSavingReward ? (
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
              Are you sure you want to delete "{selectedDeleteReward?.name}" from your catalogue? This action cannot be undone.
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
                disabled={isDeletingReward}
                activeOpacity={0.8}
              >
                {isDeletingReward ? (
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
  // Sub-tabs styling
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#000000',
  },
  tabBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  // Catalogue Styles
  loadingContainer: {
    flex: 1,
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
  // Tab 2: Customizer Card Styles
  configCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardSectionTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardSectionDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#000000',
  },
  segmentText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  colorCircleActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  stampColorCircleActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  colorWheelCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webColorPickerInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
    border: 'none',
    padding: 0,
    margin: 0,
  },
  hexInputContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  hexInputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  hexInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 40,
    paddingHorizontal: 12,
  },
  hexHashSymbol: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    marginRight: 4,
  },
  hexTextInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  hexColorPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionActive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#000000',
    borderWidth: 1.5,
  },
  bgUploadRow: {
    marginTop: 12,
  },
  bgPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  bgPreviewThumb: {
    width: 80,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#CBD5E1',
  },
  bgRemoveBtn: {
    backgroundColor: '#EF4444',
    padding: 8,
    borderRadius: 10,
  },
  bgUploadBtn: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 16,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bgUploadBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  inputWrapperFocused: {
    borderColor: '#000000',
  },
  inputSuffix: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginLeft: 6,
  },
  previewSectionHeader: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },
  // Live visual preview card EMV
  liveCardPreview: {
    borderRadius: 24,
    padding: 20,
    height: 200,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  cardPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  previewTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.5,
  },
  shopCategoryText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  cardMidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
    marginTop: 8,
  },
  cardChip: {
    width: 32,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F59E0B',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  chipLineHoriz: {
    position: 'absolute',
    top: 11,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: '#B45309',
  },
  chipLineVert: {
    position: 'absolute',
    top: 0,
    left: 15,
    width: 1,
    height: '100%',
    backgroundColor: '#B45309',
  },
  chipCenterPin: {
    position: 'absolute',
    top: 6,
    left: 10,
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FBBF24',
    borderWidth: 1,
    borderColor: '#B45309',
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
    zIndex: 2,
  },
  previewSlot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  holderBlock: {
    flex: 1.5,
  },
  validBlock: {
    flex: 0.8,
  },
  cvvBlock: {
    flex: 0.6,
  },
  cardLabelText: {
    fontSize: 7,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.5,
  },
  holderValueText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  mastercardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  // Tab 3: Points Tiers Styles
  pointsRuleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  ruleSectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  pointsRuleText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    lineHeight: 18,
  },
  formulaBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  formulaText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#065F46',
  },
  tiersContainer: {
    marginTop: 16,
    gap: 10,
  },
  tierListItem: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tierName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  tierThreshold: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 1,
  },
  multiplierBox: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  multiplierText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
  },
  // Modal Overlays Restriction
  restrictionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  restrictionContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  lockIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  restrictionTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 10,
  },
  restrictionSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  restrictionBtn: {
    backgroundColor: '#000000',
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restrictionBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
  },
  // General Modal Form Inputs
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
