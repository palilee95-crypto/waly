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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome, MaterialIcons, Feather } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

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
  { label: 'Carbon Black', value: '#050505' },
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
  { label: 'Black', value: '#050505' },
];

const fontColorOptions = [
  { label: 'White', value: '#FFFFFF' },
  { label: 'Black', value: '#050505' },
  { label: 'Slate', value: '#1E293B' },
  { label: 'Gold', value: '#FFD700' },
  { label: 'Silver', value: '#94A3B8' },
  { label: 'Orange', value: '#F59E0B' },
];

export default function UnifiedRewardsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Color picker refs (web only) — render inputs at top level so picker dialog is centered
  const cardColorInputRef = React.useRef<any>(null);
  const stampColorInputRef = React.useRef<any>(null);
  const fontColorInputRef = React.useRef<any>(null);
  const iconColorInputRef = React.useRef<any>(null);

  // Sub-tabs Selection
  const [activeTab, setActiveTab] = useState<'catalogue' | 'card_design' | 'points_tiers' | 'birthday'>('catalogue');

  // Shared Loading & Authorization States
  const [merchant, setMerchant] = useState<any>(null);
  const [loadingMerchant, setLoadingMerchant] = useState(true);

  // Tab 1: Catalogue Management States
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);

  // Tab 4: Birthday Rewards
  const [birthdayReward, setBirthdayReward] = useState<any>(null);
  const [loadingBirthday, setLoadingBirthday] = useState(false);
  const [birthdayForm, setBirthdayForm] = useState({
    title: '',
    description: '',
    reward_type: 'voucher_code' as 'voucher_code' | 'stamps' | 'discount_percent' | 'free_item',
    reward_value: '',
    message_template: 'Happy Birthday {{name}}! {{merchant}} has a special treat for you: {{title}}. Show this code at the counter: {{code}}. Valid until {{expiry}}.',
    message_template_b: '',
    expiry_days: '7',
    send_time: '09:00',
    is_active: true,
  });
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [showAdvancedMessages, setShowAdvancedMessages] = useState(false);
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
  const [linkedRewardId, setLinkedRewardId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [requiredStamps, setRequiredStamps] = useState<5 | 10 | 15>(10);
  const [expiryDays, setExpiryDays] = useState('30');
  const [rewardDesc, setRewardDesc] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>('coffee');
  const [iconColor, setIconColor] = useState<string>('#FFFFFF');
  const [customIconHexInput, setCustomIconHexInput] = useState<string>('#FFFFFF');
  const [cardColor, setCardColor] = useState<string>('#050505');
  const [customHexInput, setCustomHexInput] = useState<string>('#050505');

  // Detect brightness for Risev logo tint
  const isColorBright = (hex: string): boolean => {
    try {
      const c = hex.replace('#', '');
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 155;
    } catch { return false; }
  };
  const previewLogoTint = isColorBright(cardColor) ? '#000000' : '#FFFFFF';
  const [stampColor, setStampColor] = useState<string>('#3B82F6');
  const [customStampHexInput, setCustomStampHexInput] = useState<string>('#3B82F6');
  const [fontColor, setFontColor] = useState<string>('#FFFFFF');
  const [customFontHexInput, setCustomFontHexInput] = useState<string>('#FFFFFF');
  const [bgImage, setBgImage] = useState<string>('');
  const [bgFile, setBgFile] = useState<any>(null);
  const [removeBgImage, setRemoveBgImage] = useState<boolean>(false);

  const [bgImageBack, setBgImageBack] = useState<string>('');
  const [bgFileBack, setBgFileBack] = useState<any>(null);
  const [removeBgImageBack, setRemoveBgImageBack] = useState<boolean>(false);
  const [isSavingCard, setIsSavingCard] = useState(false);

  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnimation = React.useRef(new Animated.Value(0)).current;

  const flipCard = () => {
    Animated.spring(flipAnimation, {
      toValue: isFlipped ? 0 : 180,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  };

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
  };
  const backAnimatedStyle = {
    transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
  };

  const [expiryFocused, setExpiryFocused] = useState(false);
  const [rewardFocused, setRewardFocused] = useState(false);
  const [saveSuccessModalVisible, setSaveSuccessModalVisible] = useState(false);
  const [showValidationWarning, setShowValidationWarning] = useState(false);

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
        setLinkedRewardId(prog.linked_reward || null);
        setIsActive(prog.is_active);
        setRequiredStamps(prog.stamp_goal as any || 10);
        setExpiryDays(String(prog.expiry_days || '30'));
        setRewardDesc(prog.reward_description || '');
        setSelectedIcon(prog.card_icon || 'coffee');
        setIconColor(prog.icon_color || '#FFFFFF');
        setCustomIconHexInput(prog.icon_color || '#FFFFFF');
        setCardColor(prog.card_color || '#050505');
        setCustomHexInput(prog.card_color || '#050505');
        setStampColor(prog.stamp_color || '#3B82F6');
        setCustomStampHexInput(prog.stamp_color || '#3B82F6');
        setFontColor(prog.font_color || '#FFFFFF');
        setCustomFontHexInput(prog.font_color || '#FFFFFF');
        setBgImage(prog.card_background ? `${pb.baseUrl}/api/files/loyalty_programs/${prog.id}/${prog.card_background}` : '');
        setBgFile(null);
        setRemoveBgImage(false);
        setBgImageBack(prog.card_background_back ? `${pb.baseUrl}/api/files/loyalty_programs/${prog.id}/${prog.card_background_back}` : '');
        setBgFileBack(null);
        setRemoveBgImageBack(false);
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

  const fetchBirthdayReward = async () => {
    if (!user || !user.merchant_id) return;
    try {
      setLoadingBirthday(true);
      const records = await pb.collection('birthday_rewards').getFullList({
        filter: `merchant = "${user.merchant_id}"`,
        sort: '-created',
        requestKey: null,
      });
      if (records.length > 0) {
        const rec = records[0];
        setBirthdayReward(rec);
        setBirthdayForm({
          title: rec.title || '',
          description: rec.description || '',
          reward_type: rec.reward_type || 'voucher_code',
          reward_value: rec.reward_value ? String(rec.reward_value) : '',
          message_template: rec.message_template || '',
          message_template_b: rec.message_template_b || '',
          expiry_days: rec.expiry_days ? String(rec.expiry_days) : '7',
          send_time: rec.send_time || '09:00',
          is_active: rec.is_active ?? true,
        });
      } else {
        setBirthdayReward(null);
      }
    } catch (err: any) {
      console.warn("Failed to fetch birthday reward:", err.message || err);
    } finally {
      setLoadingBirthday(false);
    }
  };

  useEffect(() => {
    fetchMerchantAndProgram();
    fetchRewards();
    fetchBirthdayReward();
  }, [user]);

  // Tab 4: Birthday Rewards Handlers
  const handleSaveBirthday = async () => {
    if (!user || !user.merchant_id) return;
    if (!birthdayForm.title.trim()) {
      Alert.alert('Validation Error', 'Please enter a reward title.');
      return;
    }
    if (!birthdayForm.reward_value.trim()) {
      Alert.alert('Validation Error', 'Please enter a reward value.');
      return;
    }
    if (!birthdayForm.message_template.trim()) {
      Alert.alert('Validation Error', 'Please enter a WhatsApp message template.');
      return;
    }
    const expiryDays = parseInt(birthdayForm.expiry_days, 10);
    if (isNaN(expiryDays) || expiryDays < 1) {
      Alert.alert('Validation Error', 'Expiry must be at least 1 day.');
      return;
    }
    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(birthdayForm.send_time)) {
      Alert.alert('Validation Error', 'Send time must be HH:MM (e.g. 09:00).');
      return;
    }

    setSavingBirthday(true);
    try {
      const payload = {
        merchant: user.merchant_id,
        title: birthdayForm.title.trim(),
        description: birthdayForm.description.trim(),
        reward_type: birthdayForm.reward_type,
        reward_value: birthdayForm.reward_value.trim(),
        message_template: birthdayForm.message_template.trim(),
        message_template_b: birthdayForm.message_template_b.trim() || null,
        expiry_days: expiryDays,
        send_time: birthdayForm.send_time,
        is_active: birthdayForm.is_active,
      };

      if (birthdayReward) {
        await pb.collection('birthday_rewards').update(birthdayReward.id, payload, { requestKey: null });
        Alert.alert('Success', 'Birthday reward updated.');
      } else {
        await pb.collection('birthday_rewards').create(payload, { requestKey: null });
        Alert.alert('Success', 'Birthday reward created.');
      }
      fetchBirthdayReward();
    } catch (err: any) {
      console.warn('Failed to save birthday reward:', err.message || err);
      Alert.alert('Error', err.message || 'Failed to save birthday reward.');
    } finally {
      setSavingBirthday(false);
    }
  };

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
      formData.append('merchant', user?.merchant_id || '');
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
      case 'free_item': return t('free_item');
      case 'discount': return t('discount');
      case 'experience': return t('experience');
      case 'cash_credit': return t('cash_credit');
      default: return t('reward');
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

  const handlePickCardBgBack = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          setBgFileBack(file);
          setBgImageBack(URL.createObjectURL(file));
          setRemoveBgImageBack(false);
        }
      };
      input.click();
    } else {
      Alert.alert("Not Supported", "Image upload is web-only in this demo.");
    }
  };

  const handleSaveCardConfig = async () => {
    if (!user || !user.merchant_id) return;
    setShowValidationWarning(false);
    if (!rewardDesc.trim()) {
      setShowValidationWarning(true);
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
        icon_color: iconColor,
        points_per_stamp: 10,
        expiry_days: days,
      };

      if (bgFile || bgFileBack) {
        const formData = new FormData();
        Object.keys(payload).forEach(key => {
          formData.append(key, String(payload[key]));
        });
        if (bgFile) formData.append('card_background', bgFile);
        if (bgFileBack) formData.append('card_background_back', bgFileBack);

        if (removeBgImage) formData.append('card_background', '');
        if (removeBgImageBack) formData.append('card_background_back', '');

        if (programId) {
          const updated = await pb.collection('loyalty_programs').update(programId, formData);
          setBgImage(updated.card_background ? `${pb.baseUrl}/api/files/loyalty_programs/${updated.id}/${updated.card_background}` : '');
          setBgFile(null);
          setRemoveBgImage(false);
          setBgImageBack(updated.card_background_back ? `${pb.baseUrl}/api/files/loyalty_programs/${updated.id}/${updated.card_background_back}` : '');
          setBgFileBack(null);
          setRemoveBgImageBack(false);
          setLinkedRewardId(updated.linked_reward || null);
        } else {
          const newProg = await pb.collection('loyalty_programs').create(formData);
          setProgramId(newProg.id);
          setBgImage(newProg.card_background ? `${pb.baseUrl}/api/files/loyalty_programs/${newProg.id}/${newProg.card_background}` : '');
          setBgFile(null);
          setRemoveBgImage(false);
          setBgImageBack(newProg.card_background_back ? `${pb.baseUrl}/api/files/loyalty_programs/${newProg.id}/${newProg.card_background_back}` : '');
          setBgFileBack(null);
          setRemoveBgImageBack(false);
          setLinkedRewardId(newProg.linked_reward || null);
        }
      } else {
        if (removeBgImage) {
          payload.card_background = null;
        }
        if (removeBgImageBack) {
          payload.card_background_back = null;
        }

        if (programId) {
          const updated = await pb.collection('loyalty_programs').update(programId, payload);
          setLinkedRewardId(updated.linked_reward || null);
        } else {
          const newProg = await pb.collection('loyalty_programs').create(payload);
          setProgramId(newProg.id);
          setLinkedRewardId(newProg.linked_reward || null);
        }
      }

      setSaveSuccessModalVisible(true);
    } catch (err: any) {
      console.warn(err);
      Alert.alert("Error", err.message || "Failed to save card configuration.");
    } finally {
      setIsSavingCard(false);
    }
  };

  const renderPreviewStamps = () => {
    const slots: React.ReactNode[] = [];
    for (let i = 1; i <= requiredStamps; i++) {
      const isEarned = i <= 3;
      const slotStyle = isEarned
        ? [styles.prevLargeStampEarned, { backgroundColor: stampColor || 'rgba(255,255,255,0.95)' }]
        : [styles.prevLargeStampEmpty, { borderColor: fontColor ? `${fontColor}40` : 'rgba(255, 255, 255, 0.3)' }];
      slots.push(
        <View key={i} style={slotStyle}>
          {activeIconObj.family === 'Ionicons' && (
            <Ionicons name={activeIconObj.name} size={14} color={isEarned ? iconColor : (fontColor ? `${fontColor}40` : 'rgba(255, 255, 255, 0.3)')} />
          )}
          {activeIconObj.family === 'FontAwesome' && (
            <FontAwesome name={activeIconObj.name} size={14} color={isEarned ? iconColor : (fontColor ? `${fontColor}40` : 'rgba(255, 255, 255, 0.3)')} />
          )}
          {activeIconObj.family === 'MaterialIcons' && (
            <MaterialIcons name={activeIconObj.name} size={14} color={isEarned ? iconColor : (fontColor ? `${fontColor}40` : 'rgba(255, 255, 255, 0.3)')} />
          )}
        </View>
      );
    }
    return slots;
  };

  const merchantLogo = merchant?.logo
    ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
    : 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&q=80&w=120';

  if (loadingMerchant) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#050505" />
        <Text style={styles.loadingText}>Loading loyalty configurations...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hidden native color inputs — positioned mid-viewport so picker dialog is centred */}
      {Platform.OS === 'web' && (
        <>
          <input
            ref={cardColorInputRef}
            type="color"
            value={cardColor}
            style={{ position: 'fixed', top: '50%', left: '50%', width: 0, height: 0, opacity: 0, border: 'none', pointerEvents: 'none' } as any}
            onChange={(e: any) => { const v = e.target.value.toUpperCase(); setCardColor(v); setCustomHexInput(v); }}
          />
          <input
            ref={stampColorInputRef}
            type="color"
            value={stampColor}
            style={{ position: 'fixed', top: '50%', left: '50%', width: 0, height: 0, opacity: 0, border: 'none', pointerEvents: 'none' } as any}
            onChange={(e: any) => { const v = e.target.value.toUpperCase(); setStampColor(v); setCustomStampHexInput(v); }}
          />
          <input
            ref={fontColorInputRef}
            type="color"
            value={fontColor}
            style={{ position: 'fixed', top: '50%', left: '50%', width: 0, height: 0, opacity: 0, border: 'none', pointerEvents: 'none' } as any}
            onChange={(e: any) => { const v = e.target.value.toUpperCase(); setFontColor(v); setCustomFontHexInput(v); }}
          />
          <input
            ref={iconColorInputRef}
            type="color"
            value={iconColor}
            style={{ position: 'fixed', top: '50%', left: '50%', width: 0, height: 0, opacity: 0, border: 'none', pointerEvents: 'none' } as any}
            onChange={(e: any) => { const v = e.target.value.toUpperCase(); setIconColor(v); setCustomIconHexInput(v); }}
          />
        </>
      )}
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
            <Text style={styles.restrictionTitle}>{t('store_owner_only')}</Text>
            <Text style={styles.restrictionSubtitle}>
              {t('store_owner_only_desc')}
            </Text>
            <TouchableOpacity
              style={styles.restrictionBtn}
              onPress={() => router.replace('/(merchant)/give' as any)}
              activeOpacity={0.9}
            >
              <Text style={styles.restrictionBtnText}>{t('go_back_home')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark Background */}
        <View style={{ position: 'absolute', top: -30, left: -20, right: -20, height: 210, backgroundColor: '#050505', zIndex: 0 }} />

        {/* Header Row */}
        <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('loyalty_settings')}</Text>
          </View>
          <Image 
            source={require('../../assets/risev logo.png')}
            style={{ width: 85, height: 26, resizeMode: 'contain', tintColor: '#FFFFFF' }}
          />
        </View>

        {/* Intro */}
        <View style={[styles.introSection, { zIndex: 1 }]}>
          <Text style={[styles.screenTitle, { color: '#FFFFFF' }]}>{t('rewards_loyalty_setup')}</Text>
          <Text style={[styles.screenSubtitle, { color: '#94A3B8' }]}>
            {t('rewards_loyalty_setup_desc')}
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
              {t('catalogue_tab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'card_design' && styles.tabBtnActive]}
            onPress={() => setActiveTab('card_design')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabBtnText, activeTab === 'card_design' && styles.tabBtnTextActive]}>
              {t('card_design_tab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'points_tiers' && styles.tabBtnActive]}
            onPress={() => setActiveTab('points_tiers')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabBtnText, activeTab === 'points_tiers' && styles.tabBtnTextActive]}>
              {t('points_tiers_tab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'birthday' && styles.tabBtnActive]}
            onPress={() => setActiveTab('birthday')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabBtnText, activeTab === 'birthday' && styles.tabBtnTextActive]}>
              Birthday
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: Rewards Catalogue */}
        {activeTab === 'catalogue' && (
          <View style={{ flex: 1 }}>
            {/* Catalogue header title & button is in parent screen header */}
            {loadingRewards ? (
              <ActivityIndicator size="large" color="#050505" style={{ marginVertical: 40 }} />
            ) : rewards.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="gift-outline" size={48} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>{t('catalogue_empty')}</Text>
                <Text style={styles.emptySubtitle}>
                  {t('catalogue_empty_desc')}
                </Text>
                <TouchableOpacity style={styles.createFirstBtn} onPress={handleOpenCreate} activeOpacity={0.8}>
                  <Text style={styles.createFirstText}>{t('add_first_reward')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.rewardsList}>
                {rewards
                  .map((reward) => {
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
                            {reward.id !== linkedRewardId && (
                              <View style={[styles.statusBadge, { backgroundColor: reward.is_active ? '#E8F5E9' : '#F1F5F9' }]}>
                                <Text style={[styles.statusBadgeText, { color: reward.is_active ? '#10B981' : '#64748B' }]}>
                                  {reward.is_active ? (locale === 'en' ? 'Active' : 'Aktif') : (locale === 'en' ? 'Draft' : 'Deraf')}
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.rewardTitle} numberOfLines={1}>{reward.name}</Text>
                          <Text style={styles.rewardDesc} numberOfLines={2}>{reward.description || (locale === 'en' ? 'No description provided.' : 'Tiada keterangan diberikan.')}</Text>
                          
                          <View style={styles.rewardFooterRow}>
                            {reward.id === linkedRewardId ? (
                              <View style={[styles.pointsCostContainer, { backgroundColor: '#2563EB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, gap: 4 }]}>
                                <Ionicons name="card-outline" size={12} color="#FFFFFF" />
                                <Text style={[styles.pointsCostText, { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }]}>
                                  {locale === 'en' ? 'Stamp Card Reward' : 'Ganjaran Kad Setem'}
                                </Text>
                              </View>
                            ) : (
                              <>
                                <View style={styles.pointsCostContainer}>
                                  <Ionicons name="gift" size={14} color="#10B981" />
                                  <Text style={styles.pointsCostText}>{reward.points_cost} {locale === 'en' ? 'Pts' : 'Mata'}</Text>
                                </View>
                                <Text style={styles.stockText}>{locale === 'en' ? 'Stock' : 'Stok'}: {reward.stock || '0'}</Text>
                              </>
                            )}
                          </View>
                        </View>

                        <View style={styles.cardActions}>
                          {reward.id === linkedRewardId ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="lock-closed-outline" size={14} color="#10B981" />
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#10B981' }}>
                                {locale === 'en' ? 'Active' : 'Aktif'}
                              </Text>
                            </View>
                          ) : (
                            <>
                              <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleOpenEdit(reward)}>
                                <Ionicons name="create-outline" size={18} color="#475569" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleOpenDelete(reward)}>
                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                              </TouchableOpacity>
                            </>
                          )}
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
                  <Text style={styles.cardSectionTitle}>{t('enable_loyalty_program')}</Text>
                  <Text style={styles.cardSectionDesc}>
                    {t('enable_loyalty_desc')}
                  </Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#E2E8F0', true: '#050505' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Stamps Goal selector */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>{t('total_stamps_required')}</Text>
              <Text style={styles.cardSectionDesc}>
                {t('total_stamps_desc')}
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
                      {num} {locale === 'en' ? 'Stamps' : 'Setem'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 3-in-1 Card Color Theme */}
            <View style={styles.configCard}>
              {/* Card Background Color Selector */}
              <View style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 16, marginBottom: 16 }}>
                <Text style={styles.cardSectionTitle}>{t('Background')}</Text>
                <View style={styles.colorRow}>
                {colorOptions.map((opt) => {
                  const isSelected = cardColor === opt.value;
                  return (
                    <View key={opt.value} style={isSelected ? styles.colorCircleSelectedRing : undefined}>
                      <TouchableOpacity
                        style={[styles.colorCircle, { backgroundColor: opt.value }]}
                        onPress={() => { setCardColor(opt.value); setCustomHexInput(opt.value); }}
                        activeOpacity={0.8}
                      >
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {Platform.OS === 'web' && (
                  <View style={!colorOptions.some(o => o.value === cardColor) ? styles.colorCircleSelectedRing : undefined}>
                    <TouchableOpacity
                      style={[styles.colorCircle, styles.colorWheelCircle]}
                      onPress={() => cardColorInputRef.current?.click()}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="color-filter-outline" size={14} color="#050505" />
                    </TouchableOpacity>
                  </View>
                )}
                  <View style={styles.inlineHexWrapper}>
                    <Text style={styles.inlineHexHash}>#</Text>
                    <TextInput
                      style={styles.inlineHexInput}
                      value={customHexInput.replace('#', '')}
                      onChangeText={(val) => {
                        const cleaned = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                        setCustomHexInput('#' + cleaned);
                        if (cleaned.length === 6) { setCardColor('#' + cleaned.toUpperCase()); }
                      }}
                      placeholder="000000"
                      placeholderTextColor="#BEC6E0"
                      maxLength={6}
                      {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                    />
                  </View>
                </View>
              </View>

            {/* Collected Stamp Slots Color Selector */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 16, marginBottom: 16 }}>
              <Text style={styles.cardSectionTitle}>{t('Stamp Slots')}</Text>
              <View style={styles.colorRow}>
                {stampColorOptions.map((opt) => {
                  const isSelected = stampColor === opt.value;
                  return (
                    <View key={opt.value} style={isSelected ? styles.colorCircleSelectedRing : undefined}>
                      <TouchableOpacity
                        style={[styles.colorCircle, { backgroundColor: opt.value }]}
                        onPress={() => { setStampColor(opt.value); setCustomStampHexInput(opt.value); }}
                        activeOpacity={0.8}
                      >
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {Platform.OS === 'web' && (
                  <View style={!stampColorOptions.some(o => o.value === stampColor) ? styles.colorCircleSelectedRing : undefined}>
                    <TouchableOpacity
                      style={[styles.colorCircle, styles.colorWheelCircle]}
                      onPress={() => stampColorInputRef.current?.click()}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="color-filter-outline" size={14} color="#050505" />
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.inlineHexWrapper}>
                  <Text style={styles.inlineHexHash}>#</Text>
                  <TextInput
                    style={styles.inlineHexInput}
                    value={customStampHexInput.replace('#', '')}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                      setCustomStampHexInput('#' + cleaned);
                      if (cleaned.length === 6) { setStampColor('#' + cleaned.toUpperCase()); }
                    }}
                    placeholder="3B82F6"
                    placeholderTextColor="#BEC6E0"
                    maxLength={6}
                    {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                  />
                </View>
              </View>
            </View>

            {/* Stamp Card Font Color Selector */}
            <View>
              <Text style={styles.cardSectionTitle}>{t('Text')}</Text>
              <View style={styles.colorRow}>
                {fontColorOptions.map((opt) => {
                  const isSelected = fontColor === opt.value;
                  const checkColor = opt.value === '#FFFFFF' ? '#050505' : '#FFFFFF';
                  return (
                    <View key={opt.value} style={isSelected ? styles.colorCircleSelectedRing : undefined}>
                      <TouchableOpacity
                        style={[styles.colorCircle, { backgroundColor: opt.value, borderWidth: 1, borderColor: '#E2E8F0' }]}
                        onPress={() => { setFontColor(opt.value); setCustomFontHexInput(opt.value); }}
                        activeOpacity={0.8}
                      >
                        {isSelected && <Ionicons name="checkmark" size={14} color={checkColor} />}
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {Platform.OS === 'web' && (
                  <View style={!fontColorOptions.some(o => o.value === fontColor) ? styles.colorCircleSelectedRing : undefined}>
                    <TouchableOpacity
                      style={[styles.colorCircle, styles.colorWheelCircle]}
                      onPress={() => fontColorInputRef.current?.click()}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="color-filter-outline" size={14} color="#050505" />
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.inlineHexWrapper}>
                  <Text style={styles.inlineHexHash}>#</Text>
                  <TextInput
                    style={styles.inlineHexInput}
                    value={customFontHexInput.replace('#', '')}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                      setCustomFontHexInput('#' + cleaned);
                      if (cleaned.length === 6) { setFontColor('#' + cleaned.toUpperCase()); }
                    }}
                    placeholder="FFFFFF"
                    placeholderTextColor="#BEC6E0"
                    maxLength={6}
                    {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Custom Stamp Icons Picker */}
            <View style={styles.configCard}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 16, marginBottom: 16 }}>
                <Text style={styles.cardSectionTitle}>{t('stamp_check_icon')}</Text>
                <Text style={styles.cardSectionDesc}>
                  {t('stamp_check_desc')}
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
                        <Ionicons name={icon.name} size={18} color={selectedIcon === icon.id ? '#FFFFFF' : '#64748B'} />
                      )}
                      {icon.family === 'FontAwesome' && (
                        <FontAwesome name={icon.name} size={18} color={selectedIcon === icon.id ? '#FFFFFF' : '#64748B'} />
                      )}
                      {icon.family === 'MaterialIcons' && (
                        <MaterialIcons name={icon.name} size={18} color={selectedIcon === icon.id ? '#FFFFFF' : '#64748B'} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={styles.cardSectionTitle}>{t('Icon Color')}</Text>
                <View style={styles.colorRow}>
                  {fontColorOptions.map((opt) => {
                    const isSelected = iconColor === opt.value;
                    const checkColor = opt.value === '#FFFFFF' ? '#050505' : '#FFFFFF';
                    return (
                      <View key={opt.value} style={isSelected ? styles.colorCircleSelectedRing : undefined}>
                        <TouchableOpacity
                          style={[styles.colorCircle, { backgroundColor: opt.value, borderWidth: 1, borderColor: '#E2E8F0' }]}
                          onPress={() => { setIconColor(opt.value); setCustomIconHexInput(opt.value); }}
                          activeOpacity={0.8}
                        >
                          {isSelected && <Ionicons name="checkmark" size={14} color={checkColor} />}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  {Platform.OS === 'web' && (
                    <View style={!fontColorOptions.some(o => o.value === iconColor) ? styles.colorCircleSelectedRing : undefined}>
                      <TouchableOpacity
                        style={[styles.colorCircle, styles.colorWheelCircle]}
                        onPress={() => iconColorInputRef.current?.click()}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="color-filter-outline" size={14} color="#050505" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={styles.inlineHexWrapper}>
                    <Text style={styles.inlineHexHash}>#</Text>
                    <TextInput
                      style={styles.inlineHexInput}
                      value={customIconHexInput.replace('#', '')}
                      onChangeText={(val) => {
                        const cleaned = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                        setCustomIconHexInput('#' + cleaned);
                        if (cleaned.length === 6) { setIconColor('#' + cleaned.toUpperCase()); }
                      }}
                      placeholder="FFFFFF"
                      placeholderTextColor="#BEC6E0"
                      maxLength={6}
                      {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Custom Background Image Uploader */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>{t('custom_bg_image')}</Text>
              <Text style={styles.cardSectionDesc}>
                Upload custom designs for the front and back of your card.
              </Text>
              <View style={[styles.bgUploadRow, { gap: 16 }]}>
                {/* Front Image */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#475569', marginBottom: 8 }}>Front Design</Text>
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
                      <Text style={styles.bgUploadBtnText}>{t('upload_card_image')}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Back Image */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#475569', marginBottom: 8 }}>Back Design</Text>
                  {bgImageBack ? (
                    <View style={styles.bgPreviewContainer}>
                      <Image source={{ uri: bgImageBack }} style={styles.bgPreviewThumb} />
                      <TouchableOpacity 
                        style={styles.bgRemoveBtn}
                        onPress={() => {
                          setBgImageBack('');
                          setBgFileBack(null);
                          setRemoveBgImageBack(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.bgUploadBtn}
                      onPress={handlePickCardBgBack}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cloud-upload-outline" size={24} color="#64748B" />
                      <Text style={styles.bgUploadBtnText}>Upload Back</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* Expiry & Milestone Reward in one card */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>{t('card_settings')}</Text>

              <Text style={styles.settingsLabel}>{t('card_expiration_days')}</Text>
              <View style={[styles.inputWrapper, expiryFocused && styles.inputWrapperFocused]}>
                <TextInput
                  style={styles.nestedTextInput}
                  value={expiryDays}
                  onChangeText={setExpiryDays}
                  keyboardType="number-pad"
                  placeholder={locale === 'en' ? "e.g. 30" : "cth. 30"}
                  placeholderTextColor="#94A3B8"
                  onFocus={() => setExpiryFocused(true)}
                  onBlur={() => setExpiryFocused(false)}
                />
                <Text style={styles.inputSuffix}>{t('days')}</Text>
              </View>

              <Text style={[styles.settingsLabel, { marginTop: 16 }]}>{t('stamp_completion_desc')}</Text>
              <View style={[
                styles.inputWrapper, 
                rewardFocused && styles.inputWrapperFocused, 
                showValidationWarning && { borderColor: '#EF4444', borderWidth: 2 },
                { height: 72, alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10 }
              ]}>
                <TextInput
                  style={styles.nestedTextInputMultiline}
                  value={rewardDesc}
                  onChangeText={(val) => {
                    setRewardDesc(val);
                    if (val.trim()) setShowValidationWarning(false);
                  }}
                  placeholder={locale === 'en' ? "e.g. One Free Double Cheeseburger" : "cth. Satu Burger Keju Ganda Percuma"}
                  placeholderTextColor="#94A3B8"
                  multiline
                  onFocus={() => setRewardFocused(true)}
                  onBlur={() => setRewardFocused(false)}
                />
              </View>
              {showValidationWarning && (
                <Text style={{ color: '#EF4444', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 4, marginLeft: 4 }}>
                  {locale === 'en' ? 'Reward description is mandatory' : 'Keterangan ganjaran adalah wajib'}
                </Text>
              )}
            </View>

            {/* Live Visual Preview Header */}
            <Text style={styles.previewSectionHeader}>{t('live_preview_card')}</Text>

            {/* Card preview — mirrors customer Stamp Card Details modal exactly */}
            <View style={styles.flipCardContainer}>
              {(() => {
                const previewExpiryDate = new Date();
                previewExpiryDate.setDate(previewExpiryDate.getDate() + (parseInt(expiryDays, 10) || 0));
                const previewValidString = `${String(previewExpiryDate.getMonth() + 1).padStart(2, '0')}/${String(previewExpiryDate.getFullYear()).slice(-2)}`;
                return (
                  <>
                  {/* Transparent placeholder so the container gets its aspect-ratio height */}
                  <View style={{ width: '100%', aspectRatio: 1.586 }} />

              {/* Front of Card */}
              <Animated.View style={[styles.liveCardPreview, { backgroundColor: cardColor, backfaceVisibility: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, frontAnimatedStyle]}>
                {bgImage ? (
                  <Image source={{ uri: bgImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}
                {/* Subtle metallic sheen: single diagonal + top edge */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)', zIndex: 1, pointerEvents: 'none' }} />
                <View style={{ position: 'absolute', top: -300, left: '30%', width: '18%', height: 900, backgroundColor: 'rgba(255,255,255,0.07)', transform: [{ rotate: '40deg' }], zIndex: 1, pointerEvents: 'none' }} />
                {/* Header: merchant name + category + LOYALTY CARD badge */}
                <View style={styles.cardPreviewHeader}>
                  <View style={styles.previewShopLogoBg}>
                    {merchantLogo ? (
                      <Image source={{ uri: merchantLogo }} style={styles.previewShopLogo} resizeMode="cover" />
                    ) : null}
                  </View>
                  <View style={styles.previewShopTextCol}>
                    <Text style={[styles.previewShopName, { color: fontColor || '#FFFFFF' }]} numberOfLines={1}>
                      {merchant?.name || (locale === 'en' ? 'Your Shop' : 'Kedai Anda')}
                    </Text>
                    <Text style={[styles.previewShopCategory, { color: fontColor || '#FFFFFF' }]} numberOfLines={1}>
                      {(merchant?.category || (locale === 'en' ? 'FOOD' : 'MAKANAN')).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: fontColor || '#FFFFFF' }}>
                      3/{requiredStamps}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_500Medium', color: fontColor || '#FFFFFF', opacity: 0.75 }}>STAMPS</Text>
                  </View>
                </View>

                {/* EMV Chip + Wifi */}
                <View style={styles.cardMidRow}>
                  <View style={styles.cardChip}>
                    <View style={styles.chipLineHoriz} />
                    <View style={styles.chipLineVert} />
                    <View style={styles.chipCenterPin} />
                  </View>
                  <Ionicons name="wifi" size={18} color={fontColor || 'rgba(255,255,255,0.35)'} style={{ opacity: 0.35 }} />
                </View>

                <View style={{ flex: 1 }} />

                {/* Footer: CARD HOLDER | VALID | CVV | brand badge */}
                <View style={styles.cardBottomRow}>
                  <View style={styles.holderBlock}>
                    <Text style={[styles.cardLabelText, { color: fontColor || '#FFFFFF', opacity: 0.5 }]}>{t('card_holder')}</Text>
                    <Text style={[styles.holderValueText, { color: fontColor || '#FFFFFF' }]} numberOfLines={1}>
                      {(user?.name || (locale === 'en' ? 'MERCHANT' : 'PENIAGA')).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.validBlock}>
                    <Text style={[styles.cardLabelText, { color: fontColor || '#FFFFFF', opacity: 0.5 }]}>{t('valid')}</Text>
                    <Text style={[styles.holderValueText, { color: fontColor || '#FFFFFF' }]}>{previewValidString}</Text>
                  </View>
                  <View style={styles.cvvBlock}>
                    <Text style={[styles.cardLabelText, { color: fontColor || '#FFFFFF', opacity: 0.5 }]}>{t('cvv')}</Text>
                    <Text style={[styles.holderValueText, { color: fontColor || '#FFFFFF' }]}>888</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Image
                      source={require('../../assets/risev logo.png')}
                      style={{ width: 44, height: 16, resizeMode: 'contain', tintColor: previewLogoTint }}
                    />
                  </View>
                </View>
              </Animated.View>

              {/* Back of Card */}
              <Animated.View style={[styles.liveCardPreview, { backgroundColor: cardColor, backfaceVisibility: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 0, gap: 0 }, backAnimatedStyle]}>
                {bgImageBack ? (
                  <Image source={{ uri: bgImageBack }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}
                {/* Subtle metallic sheen: single diagonal + top edge */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)', zIndex: 1, pointerEvents: 'none' }} />
                <View style={{ position: 'absolute', top: -300, right: '30%', width: '18%', height: 900, backgroundColor: 'rgba(255,255,255,0.07)', transform: [{ rotate: '-40deg' }], zIndex: 1, pointerEvents: 'none' }} />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

                {/* Magnetic Stripe */}
                <View style={{ width: '100%', height: 44, backgroundColor: '#111827', marginTop: 16, opacity: 0.95, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.15)', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, letterSpacing: 6 }} numberOfLines={1}>
                    {(merchant?.name || (locale === 'en' ? 'Your Shop' : 'Kedai Anda')).toUpperCase()}
                  </Text>
                </View>

                <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12, flex: 1 }}>
                  {/* Minimalist Status Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, gap: 8 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: fontColor || '#FFFFFF', letterSpacing: 0.5, opacity: 0.7 }}>
                      {locale === 'en' ? 'YOUR STAMPS' : 'SETEM ANDA'}
                    </Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: fontColor || '#FFFFFF' }}>
                      3/{requiredStamps}
                    </Text>
                  </View>

                  <View style={styles.previewGrid}>{renderPreviewStamps()}</View>
                  
                  <View style={{ position: 'absolute', bottom: 16, right: 24 }}>
                    <Image
                      source={require('../../assets/risev logo.png')}
                      style={{ width: 44, height: 16, resizeMode: 'contain', tintColor: previewLogoTint }}
                    />
                  </View>
                </View>
              </Animated.View>
              {/* End of preview render block */}
              </>
              );})()}
            </View>

            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity style={styles.flipBtn} onPress={flipCard} activeOpacity={0.8}>
                <Ionicons name="sync-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.flipBtnText}>Tap card to flip</Text>
              </TouchableOpacity>
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
                <Text style={styles.saveSubmitBtnText}>{t('save_card_config')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 3: Points & Tiers Rules Dashboard */}
        {activeTab === 'points_tiers' && (
          <View style={{ marginTop: 12, gap: 16 }}>

            {/* Hero Banner for Points Rule */}
            <View style={[styles.configCard, { backgroundColor: '#1A1400', paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Ionicons name="star" size={28} color="#FFC700" />
                <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                  RM 1 = 1 Point
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                Example: RM 45.50 spent = 45 points automatically
              </Text>
            </View>

            {/* Membership Tiers Minimal Table */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>{t('membership_tiers')}</Text>
              
              <View style={{ marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' }}>
                
                {/* Header Row */}
                <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <Text style={{ flex: 1, fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.5 }}>TIER</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.5 }}>SPEND (12M)</Text>
                  <Text style={{ width: 80, fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', textAlign: 'right', letterSpacing: 0.5 }}>POINTS</Text>
                </View>

                {/* Bronze */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🥉</Text>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#1A1400' }}>Bronze</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>0 - RM 99</Text>
                  <View style={{ width: 80, alignItems: 'flex-end' }}>
                    <View style={{ backgroundColor: '#FFEDD5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#C2410C' }}>1x</Text>
                    </View>
                  </View>
                </View>

                {/* Silver */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🥈</Text>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#1A1400' }}>Silver</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>RM 100+</Text>
                  <View style={{ width: 80, alignItems: 'flex-end' }}>
                    <View style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569' }}>1.25x</Text>
                    </View>
                  </View>
                </View>

                {/* Gold */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🥇</Text>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#1A1400' }}>Gold</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>RM 300+</Text>
                  <View style={{ width: 80, alignItems: 'flex-end' }}>
                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>1.5x</Text>
                    </View>
                  </View>
                </View>

                {/* Platinum */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>💎</Text>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#1A1400' }}>Platinum</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>RM 1,000+</Text>
                  <View style={{ width: 80, alignItems: 'flex-end' }}>
                    <View style={{ backgroundColor: '#E0E7FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#3730A3' }}>2x</Text>
                    </View>
                  </View>
                </View>

              </View>
            </View>

            {/* Tip Card */}
            <View style={styles.tipCard}>
              <View style={styles.tipCardHeader}>
                <Ionicons name="bulb-outline" size={20} color="#D97706" />
                <Text style={styles.tipCardTitle}>{t('why_tiers_matter')}</Text>
              </View>
              <Text style={styles.tipCardText}>
                {t('why_tiers_matter_desc')}
              </Text>
            </View>
          </View>
        )}

        {/* TAB 4: Birthday Rewards */}
        {activeTab === 'birthday' && (
            <View style={{ marginTop: 12, gap: 16 }}>
              <View style={styles.configCard}>
                <View style={styles.cardSectionHeader}>
                  <Ionicons name="gift-outline" size={22} color="#0F172A" />
                  <Text style={styles.cardSectionTitle}>Birthday Rewards</Text>
                </View>
                <Text style={styles.cardSectionDesc}>
                  Automatically send a WhatsApp reward to customers on their birthday.
                </Text>

                {loadingBirthday ? (
                  <ActivityIndicator size="small" color="#050505" style={{ marginVertical: 20 }} />
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Reward Type</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        {[
                          { id: 'voucher_code', icon: 'ticket-outline', label: 'Voucher', color: '#10B981' },
                          { id: 'free_item', icon: 'gift-outline', label: 'Free Item', color: '#8B5CF6' },
                          { id: 'discount_percent', icon: 'pricetag-outline', label: 'Discount', color: '#F59E0B' },
                          { id: 'stamps', icon: 'star-outline', label: 'Stamps', color: '#EAB308' },
                        ].map((type) => {
                          const isActive = birthdayForm.reward_type === type.id;
                          return (
                            <TouchableOpacity
                              key={type.id}
                              style={{
                                width: '47%',
                                backgroundColor: isActive ? '#FFFBEB' : '#F8FAFC',
                                borderColor: isActive ? '#FFC700' : '#E2E8F0',
                                borderWidth: 1,
                                borderRadius: 16,
                                padding: 16,
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                              }}
                              onPress={() => setBirthdayForm((f) => ({ ...f, reward_type: type.id as any }))}
                              activeOpacity={0.7}
                            >
                              <View style={{ backgroundColor: isActive ? '#FFC700' : '#FFFFFF', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: isActive ? '#FFC700' : '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isActive ? 0.2 : 0.05, shadowRadius: 4, elevation: 2 }}>
                                <Ionicons name={type.icon as any} size={20} color={isActive ? '#1A1400' : type.color} />
                              </View>
                              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: isActive ? '#1A1400' : '#64748B' }}>
                                {type.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>What's the offer?</Text>
                      <TextInput
                        style={styles.textInput}
                        value={birthdayForm.reward_value}
                        onChangeText={(text) => setBirthdayForm((f) => ({ ...f, reward_value: text, title: text, description: `Birthday special: ${text}` }))}
                        placeholder={birthdayForm.reward_type === 'discount_percent' ? "e.g. 10% Off Your Next Meal" : birthdayForm.reward_type === 'stamps' ? "e.g. 3 Free Stamps" : "e.g. Free Coffee"}
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={styles.helpText}>
                        This is what the customer will see (e.g., "Free Coffee"). A unique code is auto-generated.
                      </Text>
                    </View>

                    <View style={styles.twoColumnInputs}>
                      <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>Expiry (days)</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16 }}>
                          <Ionicons name="time-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                          <TextInput
                            style={{ flex: 1, height: 48, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0F172A' }}
                            value={birthdayForm.expiry_days}
                            onChangeText={(text) => setBirthdayForm((f) => ({ ...f, expiry_days: text.replace(/[^0-9]/g, '') }))}
                            placeholder="7"
                            placeholderTextColor="#94A3B8"
                            keyboardType="number-pad"
                          />
                        </View>
                      </View>
                      <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>Send Time</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16 }}>
                          <Ionicons name="paper-plane-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                          <TextInput
                            style={{ flex: 1, height: 48, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0F172A' }}
                            value={birthdayForm.send_time}
                            onChangeText={(text) => {
                              let cleaned = text.replace(/[^0-9:]/g, '');
                              if (cleaned.length >= 3 && !cleaned.includes(':')) {
                                cleaned = cleaned.slice(0, 2) + ':' + cleaned.slice(2, 4);
                              }
                              setBirthdayForm((f) => ({ ...f, send_time: cleaned.slice(0, 5) }));
                            }}
                            placeholder="09:00"
                            placeholderTextColor="#94A3B8"
                            maxLength={5}
                          />
                        </View>
                      </View>
                    </View>

                    <View style={{ marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
                        onPress={() => setShowAdvancedMessages(!showAdvancedMessages)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="chatbubbles-outline" size={20} color="#64748B" />
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569' }}>
                            Advanced Message Settings
                          </Text>
                        </View>
                        <Ionicons name={showAdvancedMessages ? "chevron-up" : "chevron-down"} size={20} color="#64748B" />
                      </TouchableOpacity>

                      {showAdvancedMessages && (
                        <View style={{ marginTop: 16 }}>
                          <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>WhatsApp Message Template</Text>
                            <TextInput
                              style={[styles.textInput, { height: 96, textAlignVertical: 'top' }]}
                              value={birthdayForm.message_template}
                              onChangeText={(text) => setBirthdayForm((f) => ({ ...f, message_template: text }))}
                              placeholder="Happy Birthday {{name}}! {{merchant}} has a special treat: {{title}}. Show this code at the counter: {{code}}. Valid until {{expiry}}."
                              placeholderTextColor="#94A3B8"
                              multiline
                              numberOfLines={4}
                            />
                            <Text style={styles.helpText}>
                              Variables: {'{{name}}'}, {'{{merchant}}'}, {'{{title}}'}, {'{{code}}'}, {'{{expiry}}'}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Active</Text>
                      <Switch
                        value={birthdayForm.is_active}
                        onValueChange={(value) => setBirthdayForm((f) => ({ ...f, is_active: value }))}
                        trackColor={{ false: '#E2E8F0', true: '#050505' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.saveSubmitBtn, savingBirthday && { opacity: 0.6 }]}
                      onPress={handleSaveBirthday}
                      disabled={savingBirthday}
                      activeOpacity={0.8}
                    >
                      {savingBirthday ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.saveSubmitBtnText}>{birthdayReward ? 'Update Birthday Reward' : 'Create Birthday Reward'}</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
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
              <Text style={styles.modalTitle}>{editingReward ? t('edit_reward') : t('add_new_reward')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#050505" />
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
                      <Text style={styles.pickerText}>{t('upload_image')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Title Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('reward_title')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder={locale === 'en' ? "e.g. Free Hot Americano" : "cth. Americano Panas Percuma"}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Points Cost */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('points_cost')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={formPointsCost}
                  onChangeText={setFormPointsCost}
                  placeholder="e.g. 200"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                />
              </View>

              {/* Stock */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('stock_availability')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={formStock}
                  onChangeText={setFormStock}
                  placeholder="e.g. 100"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                />
              </View>

              {/* Type Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('reward_type')}</Text>
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
                <Text style={styles.inputLabel}>{t('description_terms')}</Text>
                <TextInput
                  style={[styles.textInput, { height: 80, textAlignVertical: 'top', paddingVertical: 10 }]}
                  multiline
                  numberOfLines={3}
                  value={formDesc}
                  onChangeText={setFormDesc}
                  placeholder={t('describe_terms_placeholder')}
                  placeholderTextColor="#94A3B8"
                  {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                />
              </View>

              {/* Is Active Toggle */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>{t('publish_reward')}</Text>
                  <Text style={styles.switchDesc}>{t('publish_reward_desc')}</Text>
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
                  <Text style={styles.saveSubmitBtnText}>{editingReward ? t('save_changes') : t('create_reward')}</Text>
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
            <Text style={styles.modalTitle}>{t('delete_reward')}</Text>
            <Text style={styles.modalSubtitle}>
              {locale === 'en'
                ? `Are you sure you want to delete "${selectedDeleteReward?.name}" from your catalogue? This action cannot be undone.`
                : `Adakah anda pasti mahu memadamkan "${selectedDeleteReward?.name}" dari katalog anda? Tindakan ini tidak boleh dibatalkan.`}
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
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
                  <Text style={styles.modalConfirmText}>{t('delete')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save Success Modal */}
      <Modal
        visible={saveSuccessModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.deleteIconBg, { backgroundColor: '#E8F5E9', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }]}>
              <Ionicons name="checkmark-circle" size={32} color="#10B981" />
            </View>
            <Text style={styles.modalTitle}>{locale === 'en' ? 'Configuration Saved' : 'Konfigurasi Disimpan'}</Text>
            <Text style={styles.modalSubtitle}>
              {locale === 'en' 
                ? 'Your loyalty reward program card design and settings have been synced successfully.' 
                : 'Reka bentuk kad dan tetapan program ganjaran kesetiaan anda telah berjaya diselaraskan.'}
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#050505', flex: 1 }]}
                onPress={() => setSaveSuccessModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>
                  {locale === 'en' ? 'OK' : 'OK'}
                </Text>
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
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#171717',
    borderRadius: 100,
    padding: 6,
    marginBottom: 24,
    zIndex: 2,
    marginTop: 0,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 100,
  },
  tabBtnActive: {
    backgroundColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F8FAFC',
  },
  tabBtnTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_700Bold',
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
    backgroundColor: '#050505',
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
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  typeBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
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
    padding: 24,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
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
  cardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardSectionDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#171717',
    borderRadius: 100,
    padding: 6,
    marginTop: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 100,
  },
  segmentBtnActive: {
    backgroundColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
  },
  segmentTextActive: {
    color: '#1A1400',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Active selection ring: wraps the circle to add a visible ring on any background
  colorCircleSelectedRing: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#050505',
    padding: 2,
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
  } as any,
  inlineHexWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    height: 32,
    marginLeft: 4,
  },
  inlineHexHash: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    marginRight: 4,
  },
  inlineHexInput: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    textTransform: 'uppercase',
    width: 52,
    padding: 0,
    margin: 0,
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
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
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
  },
  inputWrapperFocused: {
    borderColor: '#0F172A',
    borderWidth: 1.5,
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
  flipCardContainer: {
    width: '100%',
    aspectRatio: 1.586,
    position: 'relative',
  },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
  },
  flipBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  // Live visual preview card EMV
  liveCardPreview: {
    borderRadius: 24,
    padding: 24,
    paddingBottom: 24,
    gap: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  cardPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  prevLargeCardMerchant: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  prevLargeCardCategory: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 3,
    letterSpacing: 0.5,
  },
  prevGoldBadge: {
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  prevGoldBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  previewShopLogoBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  previewShopLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
  },
  previewShopTextCol: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
    justifyContent: 'center',
  },
  previewShopName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  previewShopCategory: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.5,
  },
  previewPtsCol: {
    alignItems: 'flex-end',
  },
  previewPtsValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  previewPtsLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.75)',
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
  cardStatusBadge: {
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
    gap: 10,
    justifyContent: 'center',
    alignContent: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 12,
    zIndex: 2,
  },
  prevLargeStampEarned: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  prevLargeStampEmpty: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderStyle: 'dashed',
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
  exampleBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  exampleTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  exampleText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#334155',
    lineHeight: 20,
  },
  tipCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    gap: 8,
  },
  tipCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipCardTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
  },
  tipCardText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#78350F',
    lineHeight: 19,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierEmoji: {
    fontSize: 18,
  },
  tierInfoCol: {
    flex: 1,
    gap: 2,
    marginRight: 6,
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
    lineHeight: 14,
  },
  multiplierBox: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiplierText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
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
    shadowColor: '#050505',
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
    backgroundColor: '#050505',
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
    shadowColor: '#050505',
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
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }) as any,
  },
  nestedTextInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    height: '100%',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }) as any,
  },
  nestedTextInputMultiline: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    textAlignVertical: 'top',
    height: '100%',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }) as any,
  },
  settingsLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  helpText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
    marginTop: 4,
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
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  typeSelectText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  typeSelectTextActive: {
    color: '#FFFFFF',
  },
  typeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  typeChipActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  typeChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  twoColumnInputs: {
    flexDirection: 'row',
    gap: 12,
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
    color: '#050505',
  },
  switchDesc: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
    maxWidth: 240,
  },
  saveSubmitBtn: {
    backgroundColor: '#050505',
    height: 52,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    width: '100%',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  saveSubmitBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14,
    letterSpacing: 0.5,
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
