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
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import UpgradeModal from './_components/UpgradeModal';
import { RewardVisualPickerModal } from '@/components/RewardVisualPickerModal';
import { getRewardVisualById, getRewardVisualUrl } from '@/lib/rewardVisuals';
import { getVoucherSpineTheme, PRO_CAMPAIGN_RECIPES, ProCampaignRecipe } from '@/theme';

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
  reward_visual_id?: string;
  discount_type?: string;
  discount_value?: number;
  metadata?: Record<string, any>;
}

export interface CardSubReward {
  id: string;
  at_stamp: number;
  reward_title: string;
  reward_type: 'discount_amount' | 'discount_percent' | 'free_item' | 'voucher_code';
  reward_value: string;
  linked_reward?: string;
  badge_icon?: 'gift' | 'ribbon' | 'star' | 'coffee' | 'heart';
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
  { label: 'RiseV Gold', value: '#FFCC00' },
  { label: 'Deep Indigo', value: '#1E293B' },
  { label: 'Emerald Green', value: '#064E3B' },
  { label: 'Wine Crimson', value: '#7F1D1D' },
  { label: 'Amber Gold', value: '#78350F' },
  { label: 'Carbon Black', value: '#050505' },
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
  const isMalay = locale === 'ms';
  const { width, height: screenHeight } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Color picker refs (web only) — render inputs at top level so picker dialog is centered
  const cardColorInputRef = React.useRef<any>(null);
  const stampColorInputRef = React.useRef<any>(null);
  const fontColorInputRef = React.useRef<any>(null);
  const iconColorInputRef = React.useRef<any>(null);

  // Sub-tabs Selection
  const [activeTab, setActiveTab] = useState<'catalogue' | 'card_design' | 'stamp_rules' | 'points_tiers' | 'birthday'>('catalogue');
  const [cardSubTab, setCardSubTab] = useState<'colors' | 'images'>('colors');
  const [isArtworkExpanded, setIsArtworkExpanded] = useState<boolean>(true);
  const [activeColorPickerModal, setActiveColorPickerModal] = useState<'background' | 'slots' | 'text' | 'icons' | null>(null);
  const [pointsSubTab, setPointsSubTab] = useState<'earn' | 'redeem' | 'limits'>('earn');

  // Loyalty Program Modes (Stamps, Points & Tiers)
  const [enableStamps, setEnableStamps] = useState<boolean>(true);
  const [enablePoints, setEnablePoints] = useState<boolean>(true);
  const [savingLoyaltyModules, setSavingLoyaltyModules] = useState<boolean>(false);
  const [spendPerPoint, setSpendPerPoint] = useState<string>('1');
  const [pointsPerRm, setPointsPerRm] = useState<string>('100');
  const [minRedeemPoints, setMinRedeemPoints] = useState<string>('0');
  const [maxRedeemPercent, setMaxRedeemPercent] = useState<string>('0');
  const [savingPointsRate, setSavingPointsRate] = useState<boolean>(false);
  const [testSpend, setTestSpend] = useState<string>('100');
  const [showEarnRateModal, setShowEarnRateModal] = useState<boolean>(false);
  const [showRedeemRateModal, setShowRedeemRateModal] = useState<boolean>(false);
  const [showPointsRulesModal, setShowPointsRulesModal] = useState<boolean>(false);

  // Shared Loading & Authorization States
  const [merchant, setMerchant] = useState<any>(null);
  const [loadingMerchant, setLoadingMerchant] = useState(true);

  // Tab 1: Catalogue Management States
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [catalogueFilter, setCatalogueFilter] = useState<'all' | 'active' | 'draft' | 'birthday' | 'discount' | 'free_item'>('all');

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
    expiry_days: '3',
    send_time: '09:00',
    is_active: true,
  });
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [showAdvancedMessages, setShowAdvancedMessages] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPointsCost, setFormPointsCost] = useState('0');
  const [formStock, setFormStock] = useState('50');
  const [formType, setFormType] = useState<'free_item' | 'discount'>('free_item');
  const [formCampaignType, setFormCampaignType] = useState<string | null>(null);
  const [formDiscountType, setFormDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [formMinSpend, setFormMinSpend] = useState('');
  const [formMaxDiscount, setFormMaxDiscount] = useState('');
  const [formFreeQty, setFormFreeQty] = useState('1');
  const [formApplicableItemsText, setFormApplicableItemsText] = useState('');
  const [formDiscountScope, setFormDiscountScope] = useState<'all' | 'specific'>('all');
  const [formSelectedLinkedItemIds, setFormSelectedLinkedItemIds] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSavingReward, setIsSavingReward] = useState(false);

  // Risev Curated Reward Visual States
  const [formRewardVisualId, setFormRewardVisualId] = useState<string | null>(null);
  const [inlineRewardVisualId, setInlineRewardVisualId] = useState<string | null>(null);
  const [showVisualPickerModal, setShowVisualPickerModal] = useState<boolean>(false);
  const [visualPickerTarget, setVisualPickerTarget] = useState<'main' | 'inline'>('main');

  // 3:4 Image Crop & Preview States
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [cropImageUri, setCropImageUri] = useState<string | null>(null);
  const [originalCropImageUri, setOriginalCropImageUri] = useState<string | null>(null);
  const [cropImageDimensions, setCropImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropTarget, setCropTarget] = useState<'reward' | 'inline' | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [removeBgProgress, setRemoveBgProgress] = useState<string | null>(null);
  const [isBgRemoved, setIsBgRemoved] = useState(false);

  const processImageForCrop = (file: any, target: 'reward' | 'inline') => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const reader = new FileReader();
      reader.onload = (event: any) => {
        const dataUrl = event.target.result;
        const img = new (window as any).Image();
        img.onload = () => {
          setCropImageUri(dataUrl);
          setOriginalCropImageUri(dataUrl);
          setCropImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
          setCropTarget(target);
          setCropZoom(1);
          setIsBgRemoved(false);
          setIsRemovingBg(false);
          setRemoveBgProgress(null);
          setCropModalVisible(true);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const cleanBackgroundWithCanvas = (imageUri: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new (window as any).Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Clean white and fake checkerboard pattern (light grey and pure white pixels)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const isWhiteOrLightGrey = r > 175 && g > 175 && b > 175 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15;
          if (isWhiteOrLightGrey) {
            data[i + 3] = 0; // Transparent
          }
        }

        ctx.putImageData(imgData, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            reject('Blob creation failed');
          }
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = imageUri;
    });
  };

  const handleRemoveBackground = async () => {
    if (!cropImageUri || Platform.OS !== 'web' || typeof window === 'undefined') return;
    setIsRemovingBg(true);
    setRemoveBgProgress(locale === 'en' ? 'Preparing AI model...' : 'Menyediakan model AI...');

    try {
      // Dynamic browser ESM import without triggering Metro bundler AST parser
      const loadImgly = new Function("return import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.8/+esm')");
      const imglyModule = await loadImgly();
      const removeBackground = (imglyModule as any).default || imglyModule;

      setRemoveBgProgress(locale === 'en' ? 'Processing image...' : 'Memproses gambar...');

      const blob = await removeBackground(cropImageUri, {
        output: {
          format: 'image/png',
          quality: 0.92,
        },
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.round((current / total) * 100);
            if (key.includes('fetch')) {
              setRemoveBgProgress(locale === 'en' ? `Downloading AI (${pct}%)...` : `Memuat turun AI (${pct}%)...`);
            } else {
              setRemoveBgProgress(locale === 'en' ? `Removing background (${pct}%)...` : `Membuang latar belakang (${pct}%)...`);
            }
          }
        },
      });

      const transparentUrl = URL.createObjectURL(blob);
      const img = new (window as any).Image();
      img.onload = () => {
        setCropImageUri(transparentUrl);
        setCropImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setIsBgRemoved(true);
        setIsRemovingBg(false);
        setRemoveBgProgress(null);
      };
      img.src = transparentUrl;
    } catch (err: any) {
      console.warn('AI background removal error, trying smart canvas cleaner:', err);
      try {
        const cleanedUrl = await cleanBackgroundWithCanvas(cropImageUri);
        if (cleanedUrl) {
          const img = new (window as any).Image();
          img.onload = () => {
            setCropImageUri(cleanedUrl);
            setCropImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            setIsBgRemoved(true);
            setIsRemovingBg(false);
            setRemoveBgProgress(null);
          };
          img.src = cleanedUrl;
          return;
        }
      } catch (fallbackErr) {
        console.error('Fallback background removal error:', fallbackErr);
      }

      Alert.alert(
        locale === 'en' ? 'Background Removal' : 'Buang Latar Belakang',
        locale === 'en'
          ? 'Failed to remove background automatically. You can proceed with the current image.'
          : 'Gagal membuang latar belakang secara automatik. Anda boleh teruskan dengan gambar sedia ada.'
      );
      setIsRemovingBg(false);
      setRemoveBgProgress(null);
    }
  };

  const handleUndoRemoveBackground = () => {
    if (!originalCropImageUri || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const img = new (window as any).Image();
    img.onload = () => {
      setCropImageUri(originalCropImageUri);
      setCropImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setIsBgRemoved(false);
    };
    img.src = originalCropImageUri;
  };

  const performCropAndSave = () => {
    if (!cropImageUri || !cropImageDimensions || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const img = new (window as any).Image();
    img.onload = () => {
      const targetW = 900;
      const targetH = 1200; // Exact 3:4 portrait ratio
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const srcAspect = srcW / srcH;
      const targetAspect = 3 / 4;

      let cropW = srcW;
      let cropH = srcH;
      let cropX = 0;
      let cropY = 0;

      if (srcAspect > targetAspect) {
        cropW = srcH * targetAspect;
        cropX = (srcW - cropW) / 2;
      } else {
        cropH = srcW / targetAspect;
        cropY = (srcH - cropH) / 2;
      }

      const zoomFactor = Math.max(1, cropZoom);
      const zoomedW = cropW / zoomFactor;
      const zoomedH = cropH / zoomFactor;
      const zoomedX = cropX + (cropW - zoomedW) / 2;
      const zoomedY = cropY + (cropH - zoomedH) / 2;

      ctx.drawImage(img, zoomedX, zoomedY, zoomedW, zoomedH, 0, 0, targetW, targetH);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const croppedFile = new File([blob], 'reward_photo_3x4.webp', { type: 'image/webp' });
        const previewUrl = URL.createObjectURL(blob);

        if (cropTarget === 'reward') {
          setImageFile(croppedFile);
          setImagePreview(previewUrl);
        } else if (cropTarget === 'inline') {
          setInlineImageFile(croppedFile);
          setInlineImagePreview(previewUrl);
        }
        setCropModalVisible(false);
      }, 'image/webp', 0.92);
    };
    img.src = cropImageUri;
  };

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedDeleteReward, setSelectedDeleteReward] = useState<Reward | null>(null);
  const [isDeletingReward, setIsDeletingReward] = useState(false);

  // Tab 2: Stamp Card Customizer States
  const [programId, setProgramId] = useState<string | null>(null);
  const [linkedRewardId, setLinkedRewardId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [requiredStamps, setRequiredStamps] = useState<number>(10);
  const [subRewards, setSubRewards] = useState<CardSubReward[]>([]);
  const [expiryDays, setExpiryDays] = useState('90');
  const [minSpendAmount, setMinSpendAmount] = useState<string>('0');
  const [enableMinSpend, setEnableMinSpend] = useState<boolean>(false);
  const [minSpendFocused, setMinSpendFocused] = useState<boolean>(false);
  const [rewardDesc, setRewardDesc] = useState('');

  // V3 Focused Editing Flow States (Reference Image 1: Fresha x Apple iOS x Risev Signature)
  const [stampSubScreen, setStampSubScreen] = useState<null | 'goal' | 'reward' | 'expiry' | 'min_spend' | 'milestones' | 'simulator'>(null);
  const [tempGoal, setTempGoal] = useState<number>(10);
  const [customGoalInput, setCustomGoalInput] = useState<string>('');
  const [isCustomGoalMode, setIsCustomGoalMode] = useState<boolean>(false);

  const [tempLinkedRewardId, setTempLinkedRewardId] = useState<string | null>(null);
  const [tempRewardDesc, setTempRewardDesc] = useState<string>('');
  const [rewardSearchQuery, setRewardSearchQuery] = useState<string>('');
  const [rewardCategoryFilter, setRewardCategoryFilter] = useState<'all' | 'free_item' | 'discount' | 'custom'>('all');

  const [tempExpiryDays, setTempExpiryDays] = useState<string>('90');

  const [tempEnableMinSpend, setTempEnableMinSpend] = useState<boolean>(false);
  const [tempMinSpendAmount, setTempMinSpendAmount] = useState<string>('0');
  const [minSpendPreset, setMinSpendPreset] = useState<'none' | '10' | '20' | 'custom'>('none');

  const [enableMilestones, setEnableMilestones] = useState<boolean>(true);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [showMilestoneEditorModal, setShowMilestoneEditorModal] = useState<boolean>(false);
  const [milestoneFormStamp, setMilestoneFormStamp] = useState<number>(3);
  const [milestoneFormTitle, setMilestoneFormTitle] = useState<string>('');
  const [milestoneFormType, setMilestoneFormType] = useState<'free_item' | 'discount_percent' | 'discount_amount'>('free_item');
  const [milestoneFormValue, setMilestoneFormValue] = useState<string>('5');
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

  // Inline Reward Creator Modal States (from Card Design)
  const [showInlineCreateModal, setShowInlineCreateModal] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineType, setInlineType] = useState<'free_item' | 'discount'>('free_item');
  const [inlineCampaignType, setInlineCampaignType] = useState<string | null>(null);
  const [inlineDesc, setInlineDesc] = useState('');
  const [inlineStock, setInlineStock] = useState('50');
  const [inlineImageFile, setInlineImageFile] = useState<any>(null);
  const [inlineImagePreview, setInlineImagePreview] = useState<string | null>(null);
  const [linkToStampCard, setLinkToStampCard] = useState<boolean>(true);
  const [isSavingInlineReward, setIsSavingInlineReward] = useState(false);

  // Structured Reward Fields & Pro Link States
  const [inlineDiscountType, setInlineDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [inlineDiscountValue, setInlineDiscountValue] = useState('');
  const [inlineMinSpend, setInlineMinSpend] = useState('');
  const [inlineMaxDiscount, setInlineMaxDiscount] = useState('');
  const [inlineFreeQty, setInlineFreeQty] = useState('1');
  const [inlineApplicableItemsText, setInlineApplicableItemsText] = useState('');
  const [inlineDiscountScope, setInlineDiscountScope] = useState<'all' | 'specific'>('all');
  const [selectedLinkedItemIds, setSelectedLinkedItemIds] = useState<string[]>([]);
  const [merchantServicesList, setMerchantServicesList] = useState<any[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [showBirthdayItemPicker, setShowBirthdayItemPicker] = useState(false);
  const [selectedBirthdayItem, setSelectedBirthdayItem] = useState<any | null>(null);
  const [birthdayItemSearch, setBirthdayItemSearch] = useState('');
  const [birthdayItemFilter, setBirthdayItemFilter] = useState<'all' | 'service' | 'product'>('all');
  const [birthdayGiftMode, setBirthdayGiftMode] = useState<'manual' | 'catalog'>('manual');
  const [manualGiftInput, setManualGiftInput] = useState('');
  const [manualGiftDescInput, setManualGiftDescInput] = useState('');
  const [helpModalInfo, setHelpModalInfo] = useState<{ title: string; desc: string } | null>(null);
  const [showValidityPicker, setShowValidityPicker] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showStampsPicker, setShowStampsPicker] = useState(false);

  const handleConfirmManualGift = () => {
    const trimmedTitle = manualGiftInput.trim();
    if (!trimmedTitle) {
      Alert.alert(
        locale === 'en' ? 'Missing Gift Title' : 'Nama Hadiah Diperlukan',
        locale === 'en' ? 'Please enter the name of the birthday gift.' : 'Sila masukkan nama hadiah hari jadi.'
      );
      return;
    }
    setSelectedBirthdayItem(null);
    setBirthdayForm((f) => ({
      ...f,
      reward_type: 'voucher_code',
      title: trimmedTitle,
      reward_value: trimmedTitle,
      description: manualGiftDescInput.trim() || (locale === 'en' ? `Special birthday gift: ${trimmedTitle}` : `Hadiah khas hari jadi: ${trimmedTitle}`),
      message_template: `Happy Birthday {{name}}! ${merchant?.name || 'Us'} has gifted you: ${trimmedTitle}! Show this code at the counter: {{code}}. Valid for 3 days.`,
    }));
    setShowBirthdayItemPicker(false);
  };

  const handleSelectBirthdayItem = (item: any) => {
    setSelectedBirthdayItem(item);
    setShowBirthdayItemPicker(false);
    const itemTitle = `Free ${item.name}`;
    const itemValue = item.price ? `${item.name} (RM${Number(item.price).toFixed(0)})` : item.name;
    setBirthdayForm((f) => ({
      ...f,
      reward_type: 'voucher_code',
      title: itemTitle,
      reward_value: itemValue,
      description: item.description || `Special birthday gift: complimentary ${item.name}`,
      message_template: `Happy Birthday {{name}}! ${merchant?.name || 'Us'} has gifted you a complimentary ${item.name}! Show this code at the counter: {{code}}. Valid for 3 days.`,
    }));
  };

  useEffect(() => {
    if (!user?.merchant_id) return;
    (async () => {
      try {
        const sRes = await pb.collection('merchant_services').getList(1, 100, {
          filter: `merchant = "${user.merchant_id}" && is_active = true`,
          sort: 'name',
        });
        setMerchantServicesList(sRes.items);
        const match = sRes.items.find((item: any) =>
          birthdayForm.title.toLowerCase().includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().includes(birthdayForm.title.toLowerCase())
        );
        if (match) {
          setSelectedBirthdayItem(match);
        } else if (birthdayForm.title.toLowerCase().includes('aiskrim') || birthdayForm.title.toLowerCase().includes('catering')) {
          setSelectedBirthdayItem({
            id: 'demo_icecream',
            name: 'Catering Aiskrim 300pax',
            price: 850,
            item_type: 'product',
          });
        }
      } catch (e) {}

      try {
        const subRes = await pb.collection('subscriptions').getList(1, 1, {
          filter: `merchant = "${user.merchant_id}" && status = "active"`,
        });
        if (subRes.items.length > 0) {
          const plan = (subRes.items[0].plan || '').toLowerCase();
          if (plan === 'pro' || plan === 'business' || plan === 'growth') {
            setIsPro(true);
          }
        } else if ((merchant as any)?.is_pro || (merchant as any)?.plan === 'pro' || (user as any)?.is_pro) {
          setIsPro(true);
        }
      } catch (e) {}
    })();
  }, [user?.merchant_id]);

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
        setEnableStamps(prog.enable_stamps !== false);
        setEnablePoints(prog.enable_points !== false);
        setSpendPerPoint(String(prog.spend_per_point || '1'));
        setPointsPerRm(String(prog.points_per_rm || '100'));
        setMinRedeemPoints(String(prog.min_redeem_points ?? '0'));
        setMaxRedeemPercent(String(prog.max_redeem_percent ?? '0'));
        setLinkedRewardId(prog.linked_reward || null);
        setIsActive(prog.is_active);
        setRequiredStamps(prog.stamp_goal as any || 10);
        if (prog.sub_rewards) {
          try {
            const parsed = typeof prog.sub_rewards === 'string' ? JSON.parse(prog.sub_rewards) : prog.sub_rewards;
            if (Array.isArray(parsed)) {
              setSubRewards(parsed);
            } else {
              setSubRewards([]);
            }
          } catch {
            setSubRewards([]);
          }
        } else {
          setSubRewards([]);
        }
        setExpiryDays(String(prog.expiry_days || '30'));
        const loadedMinSpend = parseFloat(prog.min_spend_amount) || 0;
        setMinSpendAmount(loadedMinSpend > 0 ? String(loadedMinSpend) : '0');
        setEnableMinSpend(loadedMinSpend > 0);
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
          expiry_days: rec.expiry_days ? String(rec.expiry_days) : '3',
          send_time: rec.send_time || '09:00',
          is_active: rec.is_active ?? true,
        });
      } else {
        setBirthdayReward(null);
        setBirthdayForm({
          title: 'Free Birthday Treat',
          description: 'Valid during your birthday celebration',
          reward_type: 'voucher_code',
          reward_value: 'Free Birthday Drink or Item',
          message_template: 'Happy Birthday {{name}}! {{merchant}} has a special treat for you: {{title}}. Show this code at the counter: {{code}}. Valid for 3 days (Day before, Birthday & Next day).',
          message_template_b: '',
          expiry_days: '3',
          send_time: '09:00',
          is_active: true,
        });
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

  useFocusEffect(
    React.useCallback(() => {
      fetchMerchantAndProgram();
      fetchRewards();
      fetchBirthdayReward();
    }, [user?.id, user?.merchant_id])
  );

  // Tab 4: Birthday Rewards Handlers
  const handleSaveBirthday = async () => {
    if (!user || !user.merchant_id) return;
    const finalTitle = (birthdayForm.title || (selectedBirthdayItem?.name ? `Free ${selectedBirthdayItem.name}` : '')).trim();
    const finalValue = (birthdayForm.reward_value || finalTitle || 'Birthday Treat').trim();

    if (!finalTitle) {
      Alert.alert(
        'Validation Error',
        birthdayForm.reward_type === 'stamps'
          ? (isMalay ? 'Sila masukkan bilangan cop bonus.' : 'Please enter the number of bonus stamps.')
          : (isMalay ? 'Sila masukkan atau pilih tawaran hadiah hari jadi.' : 'Please enter or select the birthday gift offer.')
      );
      return;
    }
    const expiryDays = parseInt(birthdayForm.expiry_days, 10);
    if (isNaN(expiryDays) || expiryDays < 1) {
      Alert.alert('Validation Error', isMalay ? 'Tempoh luput mestilah sekurang-kurangnya 1 hari.' : 'Expiry must be at least 1 day.');
      return;
    }
    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(birthdayForm.send_time)) {
      Alert.alert('Validation Error', isMalay ? 'Masa hantar mestilah dalam format JJ:MM (cth: 09:00).' : 'Send time must be HH:MM (e.g. 09:00).');
      return;
    }

    setSavingBirthday(true);
    try {
      const payload: Record<string, any> = {
        merchant: user.merchant_id,
        title: finalTitle,
        description: birthdayForm.description.trim() || `Special birthday gift: ${finalTitle}`,
        reward_type: birthdayForm.reward_type,
        reward_value: finalValue,
        message_template: birthdayForm.message_template.trim() || `Happy Birthday {{name}}! Special gift from ${merchant?.name || 'us'}: ${finalTitle}`,
        message_template_b: '',
        expiry_days: expiryDays,
        send_time: birthdayForm.send_time,
        is_active: birthdayForm.is_active,
      };

      if (birthdayReward && birthdayReward.id) {
        const updated = await pb.collection('birthday_rewards').update(birthdayReward.id, payload, { requestKey: null });
        setBirthdayReward(updated);
      } else {
        const created = await pb.collection('birthday_rewards').create(payload, { requestKey: null });
        setBirthdayReward(created);
      }
      await fetchBirthdayReward();
      await fetchRewards();

      Alert.alert(
        locale === 'en' ? 'Birthday Reward Saved' : 'Ganjaran Hari Jadi Disimpan',
        locale === 'en'
          ? 'Your birthday reward has been saved and is now active in your Rewards Catalog!'
          : 'Ganjaran hari jadi telah disimpan dan kini aktif dalam Katalog Ganjaran!',
        [
          { text: locale === 'en' ? 'Stay Here' : 'Kekal di Sini', style: 'cancel' },
          {
            text: locale === 'en' ? 'View in Catalog' : 'Lihat di Katalog',
            onPress: () => setActiveTab('catalogue'),
          },
        ]
      );
    } catch (err: any) {
      console.warn('Failed to save birthday reward:', err.message || err);
      Alert.alert('Error', err.message || 'Failed to save birthday reward.');
    } finally {
      setSavingBirthday(false);
    }
  };

  const handleDeleteBirthday = () => {
    if (!birthdayReward) return;
    Alert.alert(
      locale === 'en' ? 'Remove Birthday Reward' : 'Padam Ganjaran Hari Jadi',
      locale === 'en'
        ? 'Are you sure you want to deactivate or remove this birthday reward?'
        : 'Adakah anda pasti mahu memadam ganjaran hari jadi ini?',
      [
        { text: locale === 'en' ? 'Cancel' : 'Batal', style: 'cancel' },
        {
          text: locale === 'en' ? 'Delete' : 'Padam',
          style: 'destructive',
          onPress: async () => {
            try {
              await pb.collection('birthday_rewards').delete(birthdayReward.id);
              await fetchBirthdayReward();
              Alert.alert('Success', locale === 'en' ? 'Birthday reward removed.' : 'Ganjaran hari jadi dipadam.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete birthday reward.');
            }
          },
        },
      ]
    );
  };

  // Tab 1: Catalogue Handlers
  const handleOpenCreate = () => {
    setEditingReward(null);
    setFormTitle('');
    setFormDesc('');
    setFormPointsCost('0');
    setFormStock('50');
    setFormType('free_item');
    setFormDiscountType('percentage');
    setFormDiscountValue('');
    setFormMinSpend('');
    setFormMaxDiscount('');
    setFormFreeQty('1');
    setFormApplicableItemsText('');
    setFormDiscountScope('all');
    setFormSelectedLinkedItemIds([]);
    setFormIsActive(true);
    setFormRewardVisualId(null);
    setFormCampaignType(null);
    setImageFile(null);
    setImagePreview(null);
    setModalVisible(true);
  };

  const handleOpenEdit = async (reward: any) => {
    setEditingReward(reward);
    setFormTitle(reward.name || reward.title || '');
    setFormDesc(reward.description || '');
    setFormPointsCost(String(reward.points_cost || 0));
    setFormStock(String(reward.stock || 50));
    setFormType(reward.type === 'discount' ? 'discount' : 'free_item');
    setFormCampaignType(reward.metadata?.campaign_type || null);
    setFormDiscountType(reward.discount_type || 'percentage');
    setFormDiscountValue(reward.discount_value ? String(reward.discount_value) : '');
    setFormMinSpend(reward.min_spend ? String(reward.min_spend) : '');
    setFormMaxDiscount(reward.max_discount ? String(reward.max_discount) : '');
    setFormFreeQty(reward.free_quantity ? String(reward.free_quantity) : '1');
    setFormApplicableItemsText(reward.applicable_items_text || '');
    setFormDiscountScope(reward.discount_scope || 'all');
    setFormIsActive(!!reward.is_active);
    setFormRewardVisualId(reward.reward_visual_id || null);
    setImageFile(null);
    if (reward.image) {
      setImagePreview(`${pb.baseUrl}/api/files/rewards/${reward.id}/${reward.image}`);
    } else {
      setImagePreview(null);
    }

    try {
      const rels = await pb.collection('reward_eligible_items').getFullList({
        filter: `reward = "${reward.id}"`,
      });
      setFormSelectedLinkedItemIds(rels.map((r: any) => r.item));
    } catch (e) {
      setFormSelectedLinkedItemIds([]);
    }

    setModalVisible(true);
  };

  const handleSelectRecipe = (recipe: ProCampaignRecipe) => {
    if (!isPro) {
      setShowUpgradeModal(true);
      return;
    }
    if (formCampaignType === recipe.id) {
      setFormCampaignType(null);
      return;
    }
    setFormCampaignType(recipe.id);
    setFormType(recipe.baseType as any);

    if (recipe.id === 'bogo') {
      if (!formTitle || formTitle === 'FREE AISKRIM Premium 3 scoop') setFormTitle(locale === 'en' ? 'Buy 1 Free 1 Special' : 'Beli 1 Percuma 1 Khas');
      setFormApplicableItemsText(prev => prev || (locale === 'en' ? 'Buy 1 Get 1 Free on selected menu' : 'Beli 1 Percuma 1 untuk menu terpilih'));
      setFormFreeQty('1');
    } else if (recipe.id === 'happy_hour') {
      if (!formTitle || formTitle === 'FREE AISKRIM Premium 3 scoop') setFormTitle(locale === 'en' ? 'Happy Hour 20% OFF' : 'Happy Hour Diskaun 20%');
      setFormDiscountType('percentage');
      if (!formDiscountValue) setFormDiscountValue('20');
      setFormApplicableItemsText(prev => prev || (locale === 'en' ? 'Valid Mon-Thu, 2:00 PM – 5:00 PM' : 'Sah Isnin–Khamis, 2:00 PM – 5:00 PM'));
      setFormDiscountScope('specific');
    } else if (recipe.id === 'flash_sale') {
      if (!formTitle || formTitle === 'FREE AISKRIM Premium 3 scoop') setFormTitle(locale === 'en' ? 'Flash Sale 30% OFF' : 'Jualan Kilat 30% OFF');
      setFormDiscountType('percentage');
      if (!formDiscountValue) setFormDiscountValue('30');
      if (!formStock || formStock === '50') setFormStock('30');
    } else if (recipe.id === 'welcome_gift') {
      if (!formTitle || formTitle === 'FREE AISKRIM Premium 3 scoop') setFormTitle(locale === 'en' ? 'Welcome Gift (First Visit)' : 'Hadiah Aluan Khas');
      setFormApplicableItemsText(prev => prev || (locale === 'en' ? '1x Special welcome gift upon first visit' : '1x Hadiah aluan khas lawatan pertama'));
      setFormFreeQty('1');
    } else if (recipe.id === 'bring_friend') {
      if (!formTitle || formTitle === 'FREE AISKRIM Premium 3 scoop') setFormTitle(locale === 'en' ? 'Bring A Friend RM10 OFF' : 'Bawa Kawan Jimat RM10');
      setFormDiscountType('fixed_amount');
      if (!formDiscountValue) setFormDiscountValue('10');
      setFormApplicableItemsText(prev => prev || (locale === 'en' ? 'Valid for orders with 2 or more pax' : 'Sah untuk pesanan 2 orang atau lebih'));
      setFormDiscountScope('specific');
    } else if (recipe.id === 'win_back') {
      if (!formTitle || formTitle === 'FREE AISKRIM Premium 3 scoop') setFormTitle(locale === 'en' ? 'We Miss You! RM5 OFF' : 'Kami Rindu Anda! RM5 OFF');
      setFormDiscountType('fixed_amount');
      if (!formDiscountValue) setFormDiscountValue('5');
      setFormApplicableItemsText(prev => prev || (locale === 'en' ? 'Exclusive comeback voucher for you' : 'Baucar khas kembali ke kedai'));
    } else if (recipe.id === 'spend_save') {
      if (!formTitle || formTitle === 'FREE AISKRIM Premium 3 scoop') setFormTitle(locale === 'en' ? 'Spend RM50 Save RM10' : 'Belanja RM50 Jimat RM10');
      setFormDiscountType('fixed_amount');
      if (!formDiscountValue) setFormDiscountValue('10');
      if (!formMinSpend) setFormMinSpend('50');
    } else if (recipe.id === 'festive') {
      if (!formTitle || formTitle === 'FREE AISKRIM Premium 3 scoop') setFormTitle(locale === 'en' ? 'Payday & Festive Special' : 'Kempen Gaji & Pesta');
      setFormDiscountType('percentage');
      if (!formDiscountValue) setFormDiscountValue('15');
      setFormApplicableItemsText(prev => prev || (locale === 'en' ? 'Special celebration treat' : 'Tawaran istimewa sambutan'));
    }
  };

  const handleSelectInlineRecipe = (recipe: ProCampaignRecipe) => {
    if (!isPro) {
      setShowUpgradeModal(true);
      return;
    }
    if (inlineCampaignType === recipe.id) {
      setInlineCampaignType(null);
      return;
    }
    setInlineCampaignType(recipe.id);
    setInlineType(recipe.baseType as any);

    if (recipe.id === 'bogo') {
      if (!inlineTitle) setInlineTitle(locale === 'en' ? 'Buy 1 Free 1 Special' : 'Beli 1 Percuma 1 Khas');
      setInlineApplicableItemsText(prev => prev || (locale === 'en' ? 'Buy 1 Get 1 Free on selected menu' : 'Beli 1 Percuma 1 untuk menu terpilih'));
      setInlineFreeQty('1');
    } else if (recipe.id === 'happy_hour') {
      if (!inlineTitle) setInlineTitle(locale === 'en' ? 'Happy Hour 20% OFF' : 'Happy Hour Diskaun 20%');
      setInlineDiscountType('percentage');
      if (!inlineDiscountValue) setInlineDiscountValue('20');
      setInlineApplicableItemsText(prev => prev || (locale === 'en' ? 'Valid Mon-Thu, 2:00 PM – 5:00 PM' : 'Sah Isnin–Khamis, 2:00 PM – 5:00 PM'));
      setInlineDiscountScope('specific');
    } else if (recipe.id === 'flash_sale') {
      if (!inlineTitle) setInlineTitle(locale === 'en' ? 'Flash Sale 30% OFF' : 'Jualan Kilat 30% OFF');
      setInlineDiscountType('percentage');
      if (!inlineDiscountValue) setInlineDiscountValue('30');
      if (!inlineStock || inlineStock === '50') setInlineStock('30');
    } else if (recipe.id === 'welcome_gift') {
      if (!inlineTitle) setInlineTitle(locale === 'en' ? 'Welcome Gift (First Visit)' : 'Hadiah Aluan Khas');
      setInlineApplicableItemsText(prev => prev || (locale === 'en' ? '1x Special welcome gift upon first visit' : '1x Hadiah aluan khas lawatan pertama'));
      setInlineFreeQty('1');
    } else if (recipe.id === 'bring_friend') {
      if (!inlineTitle) setInlineTitle(locale === 'en' ? 'Bring A Friend RM10 OFF' : 'Bawa Kawan Jimat RM10');
      setInlineDiscountType('fixed_amount');
      if (!inlineDiscountValue) setInlineDiscountValue('10');
      setInlineApplicableItemsText(prev => prev || (locale === 'en' ? 'Valid for orders with 2 or more pax' : 'Sah untuk pesanan 2 orang atau lebih'));
      setInlineDiscountScope('specific');
    } else if (recipe.id === 'win_back') {
      if (!inlineTitle) setInlineTitle(locale === 'en' ? 'We Miss You! RM5 OFF' : 'Kami Rindu Anda! RM5 OFF');
      setInlineDiscountType('fixed_amount');
      if (!inlineDiscountValue) setInlineDiscountValue('5');
      setInlineApplicableItemsText(prev => prev || (locale === 'en' ? 'Exclusive comeback voucher for you' : 'Baucar khas kembali ke kedai'));
    } else if (recipe.id === 'spend_save') {
      if (!inlineTitle) setInlineTitle(locale === 'en' ? 'Spend RM50 Save RM10' : 'Belanja RM50 Jimat RM10');
      setInlineDiscountType('fixed_amount');
      if (!inlineDiscountValue) setInlineDiscountValue('10');
      if (!inlineMinSpend) setInlineMinSpend('50');
    } else if (recipe.id === 'festive') {
      if (!inlineTitle) setInlineTitle(locale === 'en' ? 'Payday & Festive Special' : 'Kempen Gaji & Pesta');
      setInlineDiscountType('percentage');
      if (!inlineDiscountValue) setInlineDiscountValue('15');
      setInlineApplicableItemsText(prev => prev || (locale === 'en' ? 'Special celebration treat' : 'Tawaran istimewa sambutan'));
    }
  };

  const handlePickImage = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          processImageForCrop(file, 'reward');
        }
      };
      input.click();
    } else {
      Alert.alert("Not Supported", "Image upload is web-only in this demo.");
    }
  };

  const handleSaveReward = async () => {
    if (!formTitle.trim()) {
      Alert.alert(locale === 'en' ? 'Required' : 'Wajib', locale === 'en' ? 'Please enter a reward title.' : 'Sila masukkan tajuk ganjaran.');
      return;
    }

    setIsSavingReward(true);
    try {
      const formData = new FormData();
      formData.append('merchant', user?.merchant_id || '');
      formData.append('name', formTitle.trim());
      formData.append('description', formDesc.trim());
      formData.append('points_cost', String(parseInt(formPointsCost, 10) || 0));
      formData.append('stock', String(parseInt(formStock, 10) || 1000000));
      formData.append('type', formType);
      formData.append('discount_type', formType === 'discount' ? formDiscountType : 'none');
      formData.append('discount_value', String(formType === 'discount' ? (parseFloat(formDiscountValue) || 0) : 0));
      formData.append('min_spend', String(parseFloat(formMinSpend) || 0));
      formData.append('max_discount', String(parseFloat(formMaxDiscount) || 0));
      formData.append('free_quantity', String(parseInt(formFreeQty, 10) || 1));
      formData.append('applicable_items_text', formApplicableItemsText.trim());
      formData.append('discount_scope', formType === 'discount' ? formDiscountScope : 'all');
      formData.append('is_active', String(formIsActive));
      if (formCampaignType) {
        formData.append('metadata', JSON.stringify({
          ...(editingReward?.metadata || {}),
          campaign_type: formCampaignType,
        }));
      }
      if (formRewardVisualId) {
        formData.append('reward_visual_id', formRewardVisualId);
      }
      
      if (imageFile) {
        formData.append('image', imageFile);
      }

      let rwRecord: any;
      if (editingReward) {
        rwRecord = await pb.collection('rewards').update(editingReward.id, formData);

        if (isPro) {
          try {
            const oldRels = await pb.collection('reward_eligible_items').getFullList({
              filter: `reward = "${editingReward.id}"`,
            });
            for (const rel of oldRels) {
              await pb.collection('reward_eligible_items').delete(rel.id);
            }
          } catch (e) {}
        }
      } else {
        rwRecord = await pb.collection('rewards').create(formData);
      }

      if (isPro && formSelectedLinkedItemIds.length > 0 && rwRecord?.id) {
        for (const itemId of formSelectedLinkedItemIds) {
          try {
            await pb.collection('reward_eligible_items').create({
              reward: rwRecord.id,
              item: itemId,
              merchant: user?.merchant_id || '',
            });
          } catch (e) {}
        }
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
      const msg = err?.data?.message || err?.message || "Failed to delete reward.";
      Alert.alert("Error", msg);
    } finally {
      setIsDeletingReward(false);
    }
  };

  const handleToggleRewardActive = async (reward: Reward) => {
    const nextVal = !reward.is_active;
    setRewards(prev => prev.map(r => r.id === reward.id ? { ...r, is_active: nextVal } : r));
    try {
      await pb.collection('rewards').update(reward.id, { is_active: nextVal });
    } catch (err: any) {
      console.warn("Failed to toggle reward active status:", err);
      setRewards(prev => prev.map(r => r.id === reward.id ? { ...r, is_active: reward.is_active } : r));
      Alert.alert(locale === 'en' ? 'Error' : 'Ralat', locale === 'en' ? 'Failed to update reward status.' : 'Gagal mengemaskini status ganjaran.');
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

  const handlePickInlineImage = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          processImageForCrop(file, 'inline');
        }
      };
      input.click();
    } else {
      Alert.alert("Not Supported", "Image upload is web-only in this demo.");
    }
  };

  const handleCreateInlineReward = async () => {
    if (!inlineTitle.trim()) {
      Alert.alert(locale === 'en' ? 'Required' : 'Wajib', locale === 'en' ? 'Please enter a reward title.' : 'Sila masukkan tajuk ganjaran.');
      return;
    }
    if (!user?.merchant_id) return;

    try {
      setIsSavingInlineReward(true);
      const formData = new FormData();
      formData.append('merchant', user.merchant_id);
      formData.append('name', inlineTitle.trim());
      formData.append('description', inlineDesc.trim());
      formData.append('type', inlineType);
      formData.append('discount_type', inlineType === 'discount' ? inlineDiscountType : 'none');
      formData.append('discount_value', String(inlineType === 'discount' ? (parseFloat(inlineDiscountValue) || 0) : 0));
      formData.append('min_spend', String(parseFloat(inlineMinSpend) || 0));
      formData.append('max_discount', String(parseFloat(inlineMaxDiscount) || 0));
      formData.append('free_quantity', String(parseInt(inlineFreeQty, 10) || 1));
      formData.append('applicable_items_text', inlineApplicableItemsText.trim());
      formData.append('discount_scope', inlineType === 'discount' ? inlineDiscountScope : 'all');
      formData.append('stock', String(inlineStock ? (parseInt(inlineStock, 10) || 1000000) : 1000000));
      formData.append('points_cost', '0');
      formData.append('is_active', 'true');
      if (inlineCampaignType) {
        formData.append('metadata', JSON.stringify({
          campaign_type: inlineCampaignType,
        }));
      }
      if (inlineRewardVisualId) {
        formData.append('reward_visual_id', inlineRewardVisualId);
      }
      if (inlineImageFile) {
        formData.append('image', inlineImageFile);
      }

      const newRw = await pb.collection('rewards').create(formData);

      // Save Pro linked items
      if (isPro && selectedLinkedItemIds.length > 0) {
        for (const itemId of selectedLinkedItemIds) {
          try {
            await pb.collection('reward_eligible_items').create({
              reward: newRw.id,
              item: itemId,
              merchant: user.merchant_id,
            });
          } catch (relErr) {
            console.log("Error creating reward_eligible_item:", relErr);
          }
        }
      }

      await fetchRewards();
      if (linkToStampCard) {
        setLinkedRewardId(newRw.id);
        setRewardDesc(newRw.name);
      }
      setShowInlineCreateModal(false);
      setInlineTitle('');
      setInlineDesc('');
      setInlineDiscountValue('');
      setInlineMinSpend('');
      setInlineMaxDiscount('');
      setInlineFreeQty('1');
      setInlineApplicableItemsText('');
      setInlineDiscountScope('all');
      setSelectedLinkedItemIds([]);
      setInlineImageFile(null);
      setInlineImagePreview(null);
      setShowValidationWarning(false);
    } catch (err: any) {
      console.warn("Failed to create inline reward:", err.message || err);
      Alert.alert("Error", err.message || "Failed to create reward.");
    } finally {
      setIsSavingInlineReward(false);
    }
  };

  const handleSelectStampGoal = (newGoal: number) => {
    setRequiredStamps(newGoal);
    setSubRewards(prev => prev.filter(sr => sr.at_stamp < newGoal));
  };

  const handleAddSubReward = () => {
    const maxMilestone = requiredStamps - 1;
    const existingStamps = new Set(subRewards.map(s => Number(s.at_stamp)));
    let nextAvailable: number | null = null;
    for (let s = 1; s <= maxMilestone; s++) {
      if (!existingStamps.has(s)) {
        nextAvailable = s;
        break;
      }
    }

    if (!nextAvailable) {
      Alert.alert(
        locale === 'en' ? 'Limit Reached' : 'Had Dicapai',
        locale === 'en' 
          ? `All milestone stamps (1 to ${maxMilestone}) already have configured rewards.` 
          : `Semua cop pertengahan (1 hingga ${maxMilestone}) telah mempunyai ganjaran.`
      );
      return;
    }

    const newMilestone: CardSubReward = {
      id: 'sr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      at_stamp: nextAvailable,
      reward_title: locale === 'en' ? 'Free Drink / Snack' : 'Minuman / Snek Percuma',
      reward_type: 'free_item',
      reward_value: '5',
      badge_icon: 'gift',
    };

    setSubRewards(prev => [...prev, newMilestone].sort((a, b) => a.at_stamp - b.at_stamp));
  };

  const handleRemoveSubReward = (id: string) => {
    setSubRewards(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateSubReward = (id: string, updates: Partial<CardSubReward>) => {
    setSubRewards(prev => {
      return prev.map(s => {
        if (s.id !== id) return s;
        return { ...s, ...updates };
      }).sort((a, b) => a.at_stamp - b.at_stamp);
    });
  };

  const handleSaveCardConfig = async () => {
    if (!user || !user.merchant_id) return;
    setShowValidationWarning(false);
    const selectedRw = rewards.find(r => r.id === linkedRewardId);
    const finalRewardName = rewardDesc.trim() || selectedRw?.name || '';
    if (!linkedRewardId && !finalRewardName) {
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
        enable_stamps: enableStamps,
        enable_points: enablePoints,
        stamp_goal: requiredStamps,
        reward_description: finalRewardName,
        linked_reward: linkedRewardId || null,
        sub_rewards: JSON.stringify(subRewards),
        card_color: cardColor,
        stamp_color: stampColor,
        font_color: fontColor,
        card_icon: selectedIcon,
        icon_color: iconColor,
        points_per_stamp: 10,
        expiry_days: days,
        min_spend_amount: enableMinSpend ? (parseFloat(minSpendAmount) || 0) : 0,
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

  const handleSavePointsRate = async () => {
    const parsedSpend = parseFloat(spendPerPoint);
    const parsedRedeem = parseInt(pointsPerRm, 10);
    const parsedMinRedeem = parseInt(minRedeemPoints, 10) || 0;
    const parsedMaxPercent = parseInt(maxRedeemPercent, 10) || 0;

    if (isNaN(parsedSpend) || parsedSpend <= 0) {
      Alert.alert(
        locale === 'en' ? 'Invalid Input' : 'Input Tidak Sah',
        locale === 'en'
          ? 'Please enter a valid spend amount greater than 0.'
          : 'Sila masukkan jumlah perbelanjaan yang sah lebih daripada 0.'
      );
      return;
    }

    if (isNaN(parsedRedeem) || parsedRedeem <= 0) {
      Alert.alert(
        locale === 'en' ? 'Invalid Input' : 'Input Tidak Sah',
        locale === 'en'
          ? 'Please enter valid points per RM greater than 0.'
          : 'Sila masukkan bilangan mata per RM yang sah lebih daripada 0.'
      );
      return;
    }

    if (parsedMaxPercent < 0 || parsedMaxPercent > 100) {
      Alert.alert(
        locale === 'en' ? 'Invalid Input' : 'Input Tidak Sah',
        locale === 'en'
          ? 'Max discount percentage must be between 0% and 100%.'
          : 'Peratusan diskaun maksima mestilah antara 0% dan 100%.'
      );
      return;
    }

    if (!user?.merchant_id) return;

    try {
      setSavingPointsRate(true);
      if (programId) {
        await pb.collection('loyalty_programs').update(programId, {
          spend_per_point: parsedSpend,
          points_per_rm: parsedRedeem,
          min_redeem_points: parsedMinRedeem,
          max_redeem_percent: parsedMaxPercent,
        });
      } else {
        const newProg = await pb.collection('loyalty_programs').create({
          merchant: user.merchant_id,
          name: `${merchant?.name || 'Store'} Loyalty Program`,
          spend_per_point: parsedSpend,
          points_per_rm: parsedRedeem,
          min_redeem_points: parsedMinRedeem,
          max_redeem_percent: parsedMaxPercent,
          enable_stamps: enableStamps,
          enable_points: enablePoints,
          is_active: true,
        });
        setProgramId(newProg.id);
      }
      Alert.alert(
        locale === 'en' ? 'Points Rules Saved' : 'Peraturan Mata Disimpan',
        locale === 'en'
          ? `Points rules updated:\n• Earn: RM ${parsedSpend} = 1 Pt\n• Redeem: ${parsedRedeem} Pts = RM 1.00 Discount\n• Min Points: ${parsedMinRedeem > 0 ? parsedMinRedeem + ' Pts' : 'None'}`
          : `Peraturan mata berjaya disimpan:\n• Dapat: RM ${parsedSpend} = 1 Mata\n• Tebus: ${parsedRedeem} Mata = RM 1.00 Diskaun\n• Minima Tebus: ${parsedMinRedeem > 0 ? parsedMinRedeem + ' Mata' : 'Tiada'}`
      );
    } catch (err: any) {
      console.warn("Failed to save points rate:", err);
      Alert.alert("Error", err.message || "Failed to save points rule.");
    } finally {
      setSavingPointsRate(false);
    }
  };

  const renderPreviewStamps = () => {
    const slots: React.ReactNode[] = [];
    for (let i = 1; i <= requiredStamps; i++) {
      const isEarned = i <= 3;
      const subRewardForSlot = subRewards.find(sr => sr.at_stamp === i);
      const isFinalGoal = i === requiredStamps;

      const slotStyle = isEarned
        ? [styles.prevLargeStampEarned, { backgroundColor: stampColor || 'rgba(255,255,255,0.95)', position: 'relative' as const }]
        : [styles.prevLargeStampEmpty, { 
            borderColor: subRewardForSlot ? '#FFCC00' : (fontColor ? `${fontColor}40` : 'rgba(255, 255, 255, 0.3)'),
            backgroundColor: subRewardForSlot ? 'rgba(255, 204, 0, 0.12)' : 'transparent',
            position: 'relative' as const,
          }];

      slots.push(
        <View key={i} style={slotStyle}>
          {isEarned ? (
            <>
              {activeIconObj.family === 'Ionicons' && (
                <Ionicons name={activeIconObj.name} size={14} color={iconColor} />
              )}
              {activeIconObj.family === 'FontAwesome' && (
                <FontAwesome name={activeIconObj.name} size={14} color={iconColor} />
              )}
              {activeIconObj.family === 'MaterialIcons' && (
                <MaterialIcons name={activeIconObj.name} size={14} color={iconColor} />
              )}
              {subRewardForSlot && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  backgroundColor: '#FFCC00',
                  borderRadius: 6,
                  paddingHorizontal: 2,
                  paddingVertical: 1,
                  borderWidth: 1,
                  borderColor: '#000000',
                }}>
                  <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>🎁</Text>
                </View>
              )}
            </>
          ) : subRewardForSlot ? (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13 }}>🎁</Text>
              <View style={{
                position: 'absolute',
                top: -6,
                right: -6,
                backgroundColor: '#FFCC00',
                borderRadius: 6,
                paddingHorizontal: 3,
                paddingVertical: 0.5,
                borderWidth: 1,
                borderColor: '#000000',
              }}>
                <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>{i}</Text>
              </View>
            </View>
          ) : isFinalGoal ? (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="ribbon" size={15} color={fontColor || '#FFFFFF'} />
            </View>
          ) : (
            <>
              {activeIconObj.family === 'Ionicons' && (
                <Ionicons name={activeIconObj.name} size={14} color={fontColor ? `${fontColor}40` : 'rgba(255, 255, 255, 0.3)'} />
              )}
              {activeIconObj.family === 'FontAwesome' && (
                <FontAwesome name={activeIconObj.name} size={14} color={fontColor ? `${fontColor}40` : 'rgba(255, 255, 255, 0.3)'} />
              )}
              {activeIconObj.family === 'MaterialIcons' && (
                <MaterialIcons name={activeIconObj.name} size={14} color={fontColor ? `${fontColor}40` : 'rgba(255, 255, 255, 0.3)'} />
              )}
            </>
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
        {/* Daylight Studio Header Row */}
        <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#050505" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('loyalty_settings')}</Text>
          </View>
          <Image 
            source={require('../../assets/risev logo.png')}
            style={{ width: 85, height: 26, resizeMode: 'contain', tintColor: '#050505' }}
          />
        </View>

        {/* Compact Loyalty Modules Status Capsule */}
        <View style={[styles.programModuleCapsule, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          <View style={styles.moduleCapsuleHeader}>
            <Text style={styles.moduleCapsuleLabel}>
              {locale === 'en' ? 'LOYALTY ENGINES' : 'ENJIN KESETIAAN'}
            </Text>
            {savingLoyaltyModules && (
              <ActivityIndicator size="small" color="#0F172A" />
            )}
          </View>

          <View style={styles.moduleTogglesRow}>
            {/* Stamp Engine Capsule */}
            <View style={[styles.moduleToggleCard, enableStamps && styles.moduleToggleCardActive]}>
              <View style={[styles.moduleIconWrap, { backgroundColor: enableStamps ? '#ECFDF5' : '#F1F5F9' }]}>
                <Ionicons name="card" size={16} color={enableStamps ? '#10B981' : '#94A3B8'} />
              </View>
              <View style={{ flex: 1, marginRight: 4 }}>
                <Text style={styles.moduleToggleTitle} numberOfLines={1}>
                  {locale === 'en' ? 'Stamps' : 'Kad Setem'}
                </Text>
                <Text style={[styles.moduleToggleStatus, { color: enableStamps ? '#10B981' : '#94A3B8' }]}>
                  {enableStamps ? (locale === 'en' ? 'Active' : 'Aktif') : (locale === 'en' ? 'Off' : 'Tutup')}
                </Text>
              </View>
              <Switch
                value={enableStamps}
                onValueChange={async (val) => {
                  if (!val && !enablePoints) {
                    Alert.alert(
                      locale === 'en' ? 'Cannot Disable' : 'Tidak Boleh Dinyahdayakan',
                      locale === 'en' 
                        ? 'At least one loyalty module (Stamp Cards or Points & Tiers) must remain active.' 
                        : 'Sekurang-kurangnya satu modul kesetiaan mesti kekal aktif.'
                    );
                    return;
                  }
                  setEnableStamps(val);
                  if (!val && (activeTab as string) === 'stamp_rules') {
                    setActiveTab('catalogue');
                  }
                  if (programId) {
                    try {
                      setSavingLoyaltyModules(true);
                      await pb.collection('loyalty_programs').update(programId, { enable_stamps: val });
                    } catch (err) {
                      console.warn("Failed to toggle stamps:", err);
                    } finally {
                      setSavingLoyaltyModules(false);
                    }
                  }
                }}
                trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scale: 0.75 }] }}
              />
            </View>

            <View style={styles.moduleDivider} />

            {/* Points Engine Capsule */}
            <View style={[styles.moduleToggleCard, enablePoints && styles.moduleToggleCardActive]}>
              <View style={[styles.moduleIconWrap, { backgroundColor: enablePoints ? '#FFFBEB' : '#F1F5F9' }]}>
                <Ionicons name="star" size={16} color={enablePoints ? '#D97706' : '#94A3B8'} />
              </View>
              <View style={{ flex: 1, marginRight: 4 }}>
                <Text style={styles.moduleToggleTitle} numberOfLines={1}>
                  {locale === 'en' ? 'Points' : 'Mata & Tahap'}
                </Text>
                <Text style={[styles.moduleToggleStatus, { color: enablePoints ? '#D97706' : '#94A3B8' }]}>
                  {enablePoints ? (locale === 'en' ? 'Active' : 'Aktif') : (locale === 'en' ? 'Off' : 'Tutup')}
                </Text>
              </View>
              <Switch
                value={enablePoints}
                onValueChange={async (val) => {
                  if (!val && !enableStamps) {
                    Alert.alert(
                      locale === 'en' ? 'Cannot Disable' : 'Tidak Boleh Dinyahdayakan',
                      locale === 'en' 
                        ? 'At least one loyalty module (Stamp Cards or Points & Tiers) must remain active.' 
                        : 'Sekurang-kurangnya satu modul kesetiaan mesti kekal aktif.'
                    );
                    return;
                  }
                  setEnablePoints(val);
                  if (!val && activeTab === 'points_tiers') {
                    setActiveTab('catalogue');
                  }
                  if (programId) {
                    try {
                      setSavingLoyaltyModules(true);
                      await pb.collection('loyalty_programs').update(programId, { enable_points: val });
                    } catch (err) {
                      console.warn("Failed to toggle points:", err);
                    } finally {
                      setSavingLoyaltyModules(false);
                    }
                  }
                }}
                trackColor={{ false: '#E2E8F0', true: '#D97706' }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scale: 0.75 }] }}
              />
            </View>
          </View>
        </View>

        {/* Apple 2-Row Compact Segmented Tab Bar (Full Width, Zero Scroll) */}
        <View style={[styles.compactTabBarContainer, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          {/* Reward Catalog Tab - Permanent Reward Catalog, Never Hidden On Toggle */}
          <TouchableOpacity 
            style={[styles.compactTabBtn, activeTab === 'catalogue' && styles.compactTabBtnActive]}
            onPress={() => setActiveTab('catalogue')}
            activeOpacity={0.85}
          >
            <Ionicons 
              name={activeTab === 'catalogue' ? "gift" : "gift-outline"} 
              size={16} 
              color={activeTab === 'catalogue' ? "#0F172A" : "#64748B"} 
            />
            <Text 
              style={[styles.compactTabBtnText, activeTab === 'catalogue' && styles.compactTabBtnTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {locale === 'en' ? 'Reward' : 'Ganjaran'}
            </Text>
          </TouchableOpacity>

          {/* Card Design Tab - Permanent Brand Card, Never Hidden On Toggle */}
          <TouchableOpacity 
            style={[styles.compactTabBtn, activeTab === 'card_design' && styles.compactTabBtnActive]}
            onPress={() => setActiveTab('card_design')}
            activeOpacity={0.85}
          >
            <Ionicons 
              name={activeTab === 'card_design' ? "card" : "card-outline"} 
              size={16} 
              color={activeTab === 'card_design' ? "#0F172A" : "#64748B"} 
            />
            <Text 
              style={[styles.compactTabBtnText, activeTab === 'card_design' && styles.compactTabBtnTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {locale === 'en' ? 'Card Design' : 'Reka Kad'}
            </Text>
          </TouchableOpacity>

          {enableStamps && (
            <TouchableOpacity 
              style={[styles.compactTabBtn, (activeTab as string) === 'stamp_rules' && styles.compactTabBtnActive]}
              onPress={() => setActiveTab('stamp_rules')}
              activeOpacity={0.85}
            >
              <Ionicons 
                name={(activeTab as string) === 'stamp_rules' ? "checkbox" : "checkbox-outline"} 
                size={16} 
                color={(activeTab as string) === 'stamp_rules' ? "#0F172A" : "#64748B"} 
              />
              <Text 
                style={[styles.compactTabBtnText, (activeTab as string) === 'stamp_rules' && styles.compactTabBtnTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {locale === 'en' ? 'Stamp Rule' : 'Aturan Cop'}
              </Text>
            </TouchableOpacity>
          )}

          {enablePoints && (
            <TouchableOpacity 
              style={[styles.compactTabBtn, activeTab === 'points_tiers' && styles.compactTabBtnActive]}
              onPress={() => setActiveTab('points_tiers')}
              activeOpacity={0.85}
            >
              <Ionicons 
                name={activeTab === 'points_tiers' ? "star" : "star-outline"} 
                size={16} 
                color={activeTab === 'points_tiers' ? "#0F172A" : "#64748B"} 
              />
              <Text 
                style={[styles.compactTabBtnText, activeTab === 'points_tiers' && styles.compactTabBtnTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {locale === 'en' ? 'Point Rule' : 'Aturan Mata'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.compactTabBtn, activeTab === 'birthday' && styles.compactTabBtnActive]}
            onPress={() => setActiveTab('birthday')}
            activeOpacity={0.85}
          >
            <Ionicons 
              name={activeTab === 'birthday' ? "balloon" : "balloon-outline"} 
              size={16} 
              color={activeTab === 'birthday' ? "#0F172A" : "#64748B"} 
            />
            <Text 
              style={[styles.compactTabBtnText, activeTab === 'birthday' && styles.compactTabBtnTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {locale === 'en' ? 'Birthday' : 'Hari Lahir'}
            </Text>
          </TouchableOpacity>
        </View>


        {/* TAB 1: Rewards Catalogue */}
        {activeTab === 'catalogue' && (() => {
          const hasBirthday = !!birthdayReward;
          const bdayActive = hasBirthday && (birthdayReward.is_active ?? true);
          const bdayCount = hasBirthday ? 1 : 0;
          const activeCount = rewards.filter((r) => r.is_active).length + (bdayActive ? 1 : 0);
          const draftCount = rewards.filter((r) => !r.is_active).length + (hasBirthday && !bdayActive ? 1 : 0);
          const discountCount = rewards.filter((r) => r.type === 'discount').length;
          const freeItemCount = rewards.filter((r) => r.type === 'free_item').length;
          const totalCount = rewards.length + bdayCount;

          const showBirthdayCard = hasBirthday && (
            catalogueFilter === 'all' ||
            catalogueFilter === 'birthday' ||
            (catalogueFilter === 'active' && bdayActive) ||
            (catalogueFilter === 'draft' && !bdayActive)
          );

          const filteredRewards = rewards.filter((r) => {
            if (catalogueFilter === 'birthday') return false;
            if (catalogueFilter === 'active') return r.is_active;
            if (catalogueFilter === 'draft') return !r.is_active;
            if (catalogueFilter === 'discount') return r.type === 'discount';
            if (catalogueFilter === 'free_item') return r.type === 'free_item';
            return true;
          });

          const renderStockLabel = (stock: number) => {
            if (stock >= 9999 || stock < 0) {
              return (
                <Text style={styles.stockText}>
                  {locale === 'en' ? 'Stock' : 'Stok'}: <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#10B981' }}>{locale === 'en' ? 'Unlimited' : 'Tanpa Had'}</Text>
                </Text>
              );
            }
            if (stock === 0) {
              return (
                <Text style={[styles.stockText, { color: '#EF4444', fontFamily: 'PlusJakartaSans_700Bold' }]}>
                  {locale === 'en' ? 'Out of Stock' : 'Habis Stok'}
                </Text>
              );
            }
            if (stock < 10) {
              return (
                <Text style={[styles.stockText, { color: '#F59E0B', fontFamily: 'PlusJakartaSans_700Bold' }]}>
                  {locale === 'en' ? 'Low Stock' : 'Stok Rendah'}: {stock}
                </Text>
              );
            }
            return (
              <Text style={styles.stockText}>
                {locale === 'en' ? 'Stock' : 'Stok'}: {stock}
              </Text>
            );
          };

          return (
            <View style={{ flex: 1 }}>
              {/* Catalogue Header & Action Bar */}
              <View style={styles.catalogueActionBar}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.catalogueTitle}>
                    {t('rewards_catalog')}
                  </Text>
                  <Text style={styles.catalogueSubtitle}>
                    {locale === 'en' ? 'Manage point redemptions & rewards' : 'Urus penebusan mata & ganjaran'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addRewardBtn}
                  onPress={handleOpenCreate}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={18} color="#FFC700" />
                  <Text style={styles.addRewardBtnText}>
                    {t('create_reward')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Filter Pills Bar */}
              {totalCount > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsContainer} style={{ marginBottom: 16 }}>
                  {[
                    { id: 'all', label: locale === 'en' ? 'All' : 'Semua', count: totalCount },
                    { id: 'active', label: locale === 'en' ? 'Active' : 'Aktif', count: activeCount },
                    { id: 'draft', label: locale === 'en' ? 'Draft' : 'Deraf', count: draftCount },
                    { id: 'birthday', label: locale === 'en' ? 'Birthday' : 'Hari Jadi', count: bdayCount },
                    { id: 'discount', label: locale === 'en' ? 'Discounts' : 'Diskaun', count: discountCount },
                    { id: 'free_item', label: locale === 'en' ? 'Free Items' : 'Item Percuma', count: freeItemCount },
                  ].map((pill) => {
                    const isSelected = catalogueFilter === pill.id;
                    return (
                      <TouchableOpacity
                        key={pill.id}
                        style={[styles.filterPill, isSelected && styles.filterPillActive]}
                        onPress={() => setCatalogueFilter(pill.id as any)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                          {pill.label}
                        </Text>
                        <View style={[styles.filterPillCount, isSelected && styles.filterPillCountActive]}>
                          <Text style={[styles.filterPillCountText, isSelected && styles.filterPillCountTextActive]}>
                            {pill.count}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {loadingRewards ? (
                <ActivityIndicator size="large" color="#050505" style={{ marginVertical: 40 }} />
              ) : totalCount === 0 ? (
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
              ) : catalogueFilter === 'birthday' && !hasBirthday ? (
                <View style={[styles.emptyContainer, { paddingVertical: 36 }]}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Ionicons name="gift" size={28} color="#D97706" />
                  </View>
                  <Text style={[styles.emptyTitle, { fontSize: 16 }]}>
                    {locale === 'en' ? 'No Birthday Voucher Configured' : 'Tiada Baucar Hari Jadi Ditetapkan'}
                  </Text>
                  <Text style={[styles.emptySubtitle, { maxWidth: 300, textAlign: 'center' }]}>
                    {locale === 'en'
                      ? 'Set up an automated birthday voucher to surprise customers on their special day.'
                      : 'Tetapkan baucar hari jadi automatik untuk mengejutkan pelanggan pada hari lahir mereka.'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.createFirstBtn, { marginTop: 14 }]}
                    onPress={() => setActiveTab('birthday')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="sparkles" size={15} color="#000000" style={{ marginRight: 6 }} />
                    <Text style={styles.createFirstText}>
                      {locale === 'en' ? 'Configure Birthday Voucher' : 'Tetapkan Baucar Hari Jadi'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : filteredRewards.length === 0 && !showBirthdayCard ? (
                <View style={[styles.emptyContainer, { paddingVertical: 40 }]}>
                  <Ionicons name="filter-outline" size={36} color="#94A3B8" style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyTitle, { fontSize: 16 }]}>{locale === 'en' ? 'No matching rewards' : 'Tiada ganjaran sepadan'}</Text>
                  <Text style={styles.emptySubtitle}>{locale === 'en' ? 'Try selecting a different filter above.' : 'Cuba pilih penapis lain di atas.'}</Text>
                </View>
              ) : (
                <View style={styles.rewardsList}>
                  {(() => {
                    const merchantBrandColor = merchant?.onboarding_primary_color || merchant?.pwa_brand_color || merchant?.brand_color || cardColor || '#050505';
                    const isLightBrand = (() => {
                      const hex = (merchantBrandColor || '#050505').replace('#', '');
                      const r = parseInt(hex.substring(0, 2), 16) || 0;
                      const g = parseInt(hex.substring(2, 4), 16) || 0;
                      const b = parseInt(hex.substring(4, 6), 16) || 0;
                      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
                      return yiq >= 160;
                    })();
                    const brandTextColor = isLightBrand ? '#0F172A' : '#FFFFFF';
                    return (
                      <>
                        {showBirthdayCard && (
                          <View
                            key="birthday_reward_catalog_card"
                            style={{
                              flexDirection: 'row',
                              borderRadius: 16,
                              height: 160,
                              backgroundColor: '#FFFFFF',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              overflow: 'hidden',
                              shadowColor: '#000000',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.08,
                              shadowRadius: 10,
                              elevation: 4,
                              marginBottom: 12,
                            }}
                          >
                            {/* 1. LEFT STUB: Voucher Category Color Spine */}
                            <View style={{
                              width: 44,
                              backgroundColor: merchantBrandColor,
                              alignItems: 'center',
                              position: 'relative',
                              borderTopLeftRadius: 16,
                              borderBottomLeftRadius: 16,
                              overflow: 'hidden',
                            }}>
                              <View style={{
                                width: 160,
                                height: 44,
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                marginLeft: -80,
                                marginTop: -22,
                                transform: [{ rotate: '-90deg' }],
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: brandTextColor, letterSpacing: 0.8, textAlign: 'center' }} numberOfLines={1}>
                                  BIRTHDAY PASS
                                </Text>
                                <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_700Bold', color: brandTextColor, opacity: 0.85, letterSpacing: 1.2, marginTop: 1 }}>
                                  ANNUAL REWARD
                                </Text>
                              </View>
                            </View>

                            {/* 2. MIDDLE MAIN BODY (Pure White Card) */}
                            <View style={{
                              flex: 1,
                              backgroundColor: '#FFFFFF',
                              paddingVertical: 12,
                              paddingHorizontal: 12,
                              justifyContent: 'space-between',
                            }}>
                              {/* Top Header Row: Ready to Redeem & Type Tag */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3.5 }}>
                                  <Ionicons name="sparkles" size={11} color="#B45309" />
                                  <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>Birthday Special</Text>
                                </View>

                                <View style={{
                                  backgroundColor: birthdayReward.reward_type === 'stamps' ? '#10B981' : '#FFCC00',
                                  paddingHorizontal: 7,
                                  paddingVertical: 2.5,
                                  borderRadius: 6,
                                }}>
                                  <Text style={{
                                    fontSize: 8.5,
                                    fontFamily: 'PlusJakartaSans_800ExtraBold',
                                    color: birthdayReward.reward_type === 'stamps' ? '#FFFFFF' : '#050505',
                                    letterSpacing: 0.5,
                                  }}>
                                    {birthdayReward.reward_type === 'stamps' ? 'BONUS STAMPS' : 'FREE ITEM'}
                                  </Text>
                                </View>
                              </View>

                              {/* Middle Body: YOUR REWARD micro-label + Title + Description */}
                              <View style={{ marginVertical: 2 }}>
                                <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 2, textTransform: 'uppercase' }}>
                                  YOUR BIRTHDAY OFFER
                                </Text>
                                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.2, lineHeight: 19 }} numberOfLines={2}>
                                  {birthdayReward.title || 'Free Birthday Treat'}
                                </Text>
                                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#6B7280', marginTop: 2, lineHeight: 14 }} numberOfLines={1}>
                                  {birthdayReward.description || (birthdayReward.reward_type === 'stamps' ? 'Bonus stamps issued on customer birthday' : 'Special treat during birthday celebration')}
                                </Text>
                              </View>

                              {/* Bottom Footer Row: Source Badge + Validity (Left) + Apple Squircle Actions (Right) */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
                                  <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <Ionicons name="gift" size={9} color="#DC2626" />
                                    <Text style={{ color: '#DC2626', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 8, letterSpacing: 0.3 }}>BIRTHDAY PASS</Text>
                                  </View>

                                  <Text style={{ fontSize: 10, color: '#CBD5E1' }}>|</Text>

                                  <Text style={styles.stockText}>
                                    {locale === 'en' ? 'Validity' : 'Sah'}: <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#059669' }}>{birthdayReward.expiry_days || 3} {locale === 'en' ? 'Days' : 'Hari'}</Text>
                                  </Text>

                                  <Text style={{ fontSize: 10, color: '#CBD5E1' }}>|</Text>

                                  <Text style={styles.stockText}>
                                    ⏰ {birthdayReward.send_time || '09:00'}
                                  </Text>
                                </View>

                                {/* Apple Squircle Action Buttons */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                  <TouchableOpacity
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 8,
                                      backgroundColor: '#F1F5F9',
                                      borderWidth: 1,
                                      borderColor: '#E2E8F0',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    onPress={() => setActiveTab('birthday')}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="create-outline" size={14} color="#0F172A" />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 8,
                                      backgroundColor: '#FEF2F2',
                                      borderWidth: 1,
                                      borderColor: '#FEE2E2',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    onPress={handleDeleteBirthday}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>

                            {/* 3. PERFORATION COLUMN (Notches & Dashed Line) */}
                            <View style={{
                              width: 18,
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              position: 'relative',
                              zIndex: 3,
                            }} pointerEvents="none">
                              {/* Background fill for right half to connect brand color to dashed line */}
                              <View style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: 9,
                                backgroundColor: merchantBrandColor,
                              }} />

                              {/* Dashed line */}
                              <View style={{
                                width: 1,
                                height: '100%',
                                borderColor: '#FFFFFF',
                                borderWidth: 1,
                                borderStyle: 'dashed',
                                zIndex: 1,
                              }} />

                              {/* Top Notch */}
                              <View style={{
                                position: 'absolute',
                                width: 18,
                                height: 18,
                                borderRadius: 9,
                                top: -9,
                                backgroundColor: '#F8FAFC',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                zIndex: 2,
                              }} />

                              {/* Bottom Notch */}
                              <View style={{
                                position: 'absolute',
                                width: 18,
                                height: 18,
                                borderRadius: 9,
                                bottom: -9,
                                backgroundColor: '#F8FAFC',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                zIndex: 2,
                              }} />
                            </View>

                            {/* 4. RIGHT STUB (Brand Color from Image 2) */}
                            <View style={{
                              width: 100,
                              backgroundColor: merchantBrandColor,
                              borderTopRightRadius: 16,
                              borderBottomRightRadius: 16,
                              paddingVertical: 12,
                              paddingHorizontal: 8,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <View style={{
                                width: 52,
                                height: 52,
                                borderRadius: 26,
                                backgroundColor: '#FFFFFF',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 2,
                                borderColor: isLightBrand ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.3)',
                                shadowColor: '#000000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.12,
                                shadowRadius: 4,
                                elevation: 3,
                                marginBottom: 8,
                              }}>
                                <Image source={{ uri: merchantLogo }} style={{ width: 46, height: 46, borderRadius: 23, resizeMode: 'cover' }} />
                              </View>
                              <Text style={{
                                fontSize: 11,
                                fontFamily: 'PlusJakartaSans_800ExtraBold',
                                color: brandTextColor,
                                textAlign: 'center',
                                width: '100%',
                                letterSpacing: 0.3,
                              }} numberOfLines={2}>
                                {(merchant?.name || 'STORE').toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        )}
                        {filteredRewards.map((reward) => {
                      return (
                        <View
                          key={reward.id}
                          style={{
                            flexDirection: 'row',
                            borderRadius: 16,
                            height: 160,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            overflow: 'hidden',
                            shadowColor: '#000000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.08,
                            shadowRadius: 10,
                            elevation: 4,
                            marginBottom: 12,
                          }}
                        >
                          {/* 1. LEFT STUB: Voucher Category Color Spine (Standardized to Merchant Brand Color) */}
                          {(() => {
                            const spineTheme = getVoucherSpineTheme(reward.type, reward.name, merchantBrandColor);
                            return (
                              <View style={{
                                width: 44,
                                backgroundColor: merchantBrandColor,
                                alignItems: 'center',
                                position: 'relative',
                                borderTopLeftRadius: 16,
                                borderBottomLeftRadius: 16,
                                overflow: 'hidden',
                              }}>
                                <View style={{
                                  width: 160,
                                  height: 44,
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  marginLeft: -80,
                                  marginTop: -22,
                                  transform: [{ rotate: '-90deg' }],
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: brandTextColor, letterSpacing: 0.8, textAlign: 'center' }} numberOfLines={1}>
                                    {spineTheme.spineText}
                                  </Text>
                                  <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_700Bold', color: brandTextColor, opacity: 0.85, letterSpacing: 1.2, marginTop: 1 }}>
                                    {spineTheme.subText}
                                  </Text>
                                </View>
                              </View>
                            );
                          })()}

                          {/* 2. MIDDLE MAIN BODY (Pure White Card) */}
                          <View style={{
                            flex: 1,
                            backgroundColor: '#FFFFFF',
                            paddingVertical: 12,
                            paddingHorizontal: 12,
                            justifyContent: 'space-between',
                          }}>
                            {/* Top Header Row: Ready to Redeem & Type Tag */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3.5 }}>
                                <Ionicons name="gift" size={11} color="#B45309" />
                                <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>Ready to redeem</Text>
                              </View>

                              <View style={{
                                backgroundColor: reward.type === 'discount' ? '#0F172A' : '#FFCC00',
                                paddingHorizontal: 7,
                                paddingVertical: 2.5,
                                borderRadius: 6,
                              }}>
                                <Text style={{
                                  fontSize: 8.5,
                                  fontFamily: 'PlusJakartaSans_800ExtraBold',
                                  color: reward.type === 'discount' ? '#FFFFFF' : '#050505',
                                  letterSpacing: 0.5,
                                }}>
                                  {reward.type === 'discount' ? 'DISCOUNT' : 'FREE ITEM'}
                                </Text>
                              </View>
                            </View>

                            {/* Middle Body: YOUR REWARD micro-label + Title + Description */}
                            <View style={{ marginVertical: 2 }}>
                              <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 2, textTransform: 'uppercase' }}>
                                YOUR REWARD
                              </Text>
                              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.2, lineHeight: 19 }} numberOfLines={2}>
                                {reward.name}
                              </Text>
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#6B7280', marginTop: 2, lineHeight: 14 }} numberOfLines={1}>
                                {reward.description || (reward.type === 'discount' ? 'Discount reward offer' : 'Reward for completing store card')}
                              </Text>
                            </View>

                            {/* Bottom Footer Row: Source Badge + Stock Info (Left) + Apple Squircle Actions (Right) */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
                                {reward.id === linkedRewardId ? (
                                  <View style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <Ionicons name="card" size={9} color="#059669" />
                                    <Text style={{ color: '#059669', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 8, letterSpacing: 0.3 }}>STAMP REWARD</Text>
                                  </View>
                                ) : (
                                  <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <Ionicons name="gift" size={9} color="#2563EB" />
                                    <Text style={{ color: '#2563EB', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 8, letterSpacing: 0.3 }}>POINTS ({reward.points_cost} Pts)</Text>
                                  </View>
                                )}

                                <Text style={{ fontSize: 10, color: '#CBD5E1' }}>|</Text>

                                {/* Stock Label */}
                                <View style={{ opacity: 0.95 }}>
                                  {renderStockLabel(reward.stock)}
                                </View>
                              </View>

                              {/* Apple Squircle Action Buttons */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <TouchableOpacity
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 8,
                                    backgroundColor: '#F1F5F9',
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  onPress={() => handleOpenEdit(reward)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="create-outline" size={14} color="#0F172A" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 8,
                                    backgroundColor: '#FEF2F2',
                                    borderWidth: 1,
                                    borderColor: '#FEE2E2',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  onPress={() => handleOpenDelete(reward)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>

                          {/* 3. PERFORATION COLUMN (Notches & Dashed Line) */}
                          <View style={{
                            width: 18,
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            position: 'relative',
                            zIndex: 3,
                          }} pointerEvents="none">
                            {/* Background fill for right half to connect brand color to dashed line */}
                            <View style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: 9,
                              backgroundColor: merchantBrandColor,
                            }} />

                            {/* Dashed line */}
                            <View style={{
                              width: 1,
                              height: '100%',
                              borderColor: '#FFFFFF',
                              borderWidth: 1,
                              borderStyle: 'dashed',
                              zIndex: 1,
                            }} />

                            {/* Top Notch */}
                            <View style={{
                              position: 'absolute',
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              top: -9,
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              zIndex: 2,
                            }} />

                            {/* Bottom Notch */}
                            <View style={{
                              position: 'absolute',
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              bottom: -9,
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              zIndex: 2,
                            }} />
                          </View>

                          {/* 4. RIGHT STUB (Brand Color from Image 2) */}
                          <View style={{
                            width: 100,
                            backgroundColor: merchantBrandColor,
                            borderTopRightRadius: 16,
                            borderBottomRightRadius: 16,
                            paddingVertical: 12,
                            paddingHorizontal: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <View style={{
                              width: 52,
                              height: 52,
                              borderRadius: 26,
                              backgroundColor: '#FFFFFF',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 2,
                              borderColor: isLightBrand ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.3)',
                              shadowColor: '#000000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.12,
                              shadowRadius: 4,
                              elevation: 3,
                              marginBottom: 8,
                            }}>
                              <Image source={{ uri: merchantLogo }} style={{ width: 46, height: 46, borderRadius: 23, resizeMode: 'cover' }} />
                            </View>
                            <Text style={{
                              fontSize: 11,
                              fontFamily: 'PlusJakartaSans_800ExtraBold',
                              color: brandTextColor,
                              textAlign: 'center',
                              width: '100%',
                              letterSpacing: 0.3,
                            }} numberOfLines={2}>
                              {(merchant?.name || 'STORE').toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                      </>
                    );
                  })()}
                </View>
              )}
            </View>
          );
        })()}

        {/* TAB 2: Card Customizer */}
        {activeTab === 'card_design' && (
          <View style={{ marginTop: 12, gap: 16 }}>

            {/* Live Visual Preview Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 24 }}>
              <Text style={[styles.previewSectionHeader, { marginTop: 0, marginBottom: 0 }]}>{t('live_preview_card')}</Text>
              <TouchableOpacity style={[styles.flipBtn, { marginTop: 0, marginBottom: 0 }]} onPress={flipCard} activeOpacity={0.8}>
                <Ionicons name="sync-outline" size={14} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.flipBtnText}>Tap card to flip</Text>
              </TouchableOpacity>
            </View>

            {/* Card preview — mirrors customer Stamp Card Details modal exactly */}
            <TouchableOpacity activeOpacity={1} onPress={flipCard} style={styles.flipCardContainer}>
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
            </TouchableOpacity>

            {/* UNIFIED CARD DESIGN VIEW (Refined & Beautified - Image 2 Standard) */}
            <View style={{ gap: 14, marginTop: 18 }}>
              {/* CARD 1: Colors & Icons (Unified Settings Card) */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                borderWidth: 1,
                borderColor: '#F1F5F9',
                paddingHorizontal: 16,
                paddingVertical: 2,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.03,
                shadowRadius: 10,
                elevation: 2,
              }}>
                {/* 1. Background Row */}
                <TouchableOpacity
                  onPress={() => setActiveColorPickerModal('background')}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F8FAFC',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 }}>
                    <View style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="color-palette-outline" size={19} color="#0F172A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Background' : 'Background'}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                        {locale === 'en' ? 'Card background color' : 'Warna latar kad'}
                      </Text>
                    </View>
                  </View>

                  {/* Selected Color Only + Chevron */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: cardColor || '#FFCC00',
                      borderWidth: 2,
                      borderColor: (cardColor === '#FFFFFF' || cardColor?.toLowerCase() === '#ffffff') ? '#CBD5E1' : '#0F172A',
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 1,
                    }} />
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </View>
                </TouchableOpacity>

                {/* 2. Stamp Slots Row */}
                <TouchableOpacity
                  onPress={() => setActiveColorPickerModal('slots')}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F8FAFC',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 }}>
                    <View style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="grid-outline" size={17} color="#0F172A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Stamp Slots' : 'Stamp Slots'}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                        {locale === 'en' ? 'Color for stamp slots' : 'Warna slot cop setem'}
                      </Text>
                    </View>
                  </View>

                  {/* Selected Color Only + Chevron */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: stampColor || '#3B82F6',
                      borderWidth: 2,
                      borderColor: (stampColor === '#FFFFFF' || stampColor?.toLowerCase() === '#ffffff') ? '#CBD5E1' : '#0F172A',
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 1,
                    }} />
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </View>
                </TouchableOpacity>

                {/* 3. Text Color Row */}
                <TouchableOpacity
                  onPress={() => setActiveColorPickerModal('text')}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F8FAFC',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 }}>
                    <View style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>Aa</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Text Color' : 'Text Color'}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                        {locale === 'en' ? 'Name, balance and labels' : 'Nama kedai & baki setem'}
                      </Text>
                    </View>
                  </View>

                  {/* Selected Color Only + Chevron */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: fontColor || '#050505',
                      borderWidth: 2,
                      borderColor: (fontColor === '#FFFFFF' || fontColor?.toLowerCase() === '#ffffff') ? '#CBD5E1' : '#0F172A',
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 1,
                    }} />
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </View>
                </TouchableOpacity>

                {/* 4. Stamp Check Icon Row */}
                <TouchableOpacity
                  onPress={() => setActiveColorPickerModal('icons')}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 }}>
                    <View style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="checkmark-circle-outline" size={19} color="#0F172A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Stamp Check Icon' : 'Stamp Check Icon'}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                        {locale === 'en' ? 'Icon for collected stamps' : 'Ikon visual bila cop ditebus'}
                      </Text>
                    </View>
                  </View>

                  {/* Selected Icon Only + Chevron */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      const curIconObj = stampIcons.find(i => i.id === selectedIcon) || { id: 'checkmark', name: 'checkmark', family: 'Ionicons' };
                      return (
                        <View style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: '#0F172A',
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 2,
                          elevation: 1,
                        }}>
                          {curIconObj.family === 'Ionicons' && (
                            <Ionicons name={curIconObj.name as any} size={13} color="#FFFFFF" />
                          )}
                          {curIconObj.family === 'FontAwesome' && (
                            <FontAwesome name={curIconObj.name as any} size={11} color="#FFFFFF" />
                          )}
                          {curIconObj.family === 'MaterialIcons' && (
                            <MaterialIcons name={curIconObj.name as any} size={13} color="#FFFFFF" />
                          )}
                        </View>
                      );
                    })()}
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* CARD 2: Artwork (Accordion Card) */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                borderWidth: 1,
                borderColor: '#F1F5F9',
                padding: 18,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.03,
                shadowRadius: 10,
                elevation: 2,
              }}>
                {/* Accordion Header */}
                <TouchableOpacity
                  onPress={() => setIsArtworkExpanded(!isArtworkExpanded)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="image-outline" size={18} color="#0F172A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Artwork' : 'Artwork'}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                        {locale === 'en' ? 'Custom designs for front and back of your card.' : 'Reka bentuk kustom untuk depan dan belakang kad.'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name={isArtworkExpanded ? "chevron-up" : "chevron-down"} size={18} color="#0F172A" />
                </TouchableOpacity>

                {/* Accordion Body */}
                {isArtworkExpanded && (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F8FAFC', gap: 14 }}>
                    {/* Front Design Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        {/* Thumbnail */}
                        <View style={{
                          width: 66,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: cardColor || '#FFCC00',
                          overflow: 'hidden',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {bgImage ? (
                            <Image source={{ uri: bgImage }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                          ) : (
                            <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                            {locale === 'en' ? 'Front Design' : 'Front Design'}
                          </Text>
                          <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                            {bgImage ? (locale === 'en' ? 'Custom artwork uploaded' : 'Imej kustom dimuat naik') : (locale === 'en' ? 'No artwork uploaded' : 'Tiada imej dimuat naik')}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={handlePickCardBg}
                          style={{
                            backgroundColor: '#F1F5F9',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 10,
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                            {bgImage ? (locale === 'en' ? 'Replace' : 'Tukar') : (locale === 'en' ? 'Upload' : 'Muat Naik')}
                          </Text>
                        </TouchableOpacity>

                        {bgImage ? (
                          <TouchableOpacity
                            onPress={() => { setBgImage(''); setBgFile(null); setRemoveBgImage(true); }}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              backgroundColor: '#EF4444',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity onPress={handlePickCardBg} style={{ paddingLeft: 2 }} activeOpacity={0.7}>
                          <Ionicons name="chevron-forward" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: '#F8FAFC' }} />

                    {/* Back Design Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        {/* Thumbnail */}
                        <View style={{
                          width: 66,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: cardColor || '#FFCC00',
                          overflow: 'hidden',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {bgImageBack ? (
                            <Image source={{ uri: bgImageBack }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                          ) : (
                            <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                            {locale === 'en' ? 'Back Design' : 'Back Design'}
                          </Text>
                          <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                            {bgImageBack ? (locale === 'en' ? 'Custom artwork uploaded' : 'Imej kustom dimuat naik') : (locale === 'en' ? 'No artwork uploaded' : 'Tiada imej dimuat naik')}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={handlePickCardBgBack}
                          style={{
                            backgroundColor: '#F1F5F9',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 10,
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                            {bgImageBack ? (locale === 'en' ? 'Replace' : 'Tukar') : (locale === 'en' ? 'Upload' : 'Muat Naik')}
                          </Text>
                        </TouchableOpacity>

                        {bgImageBack ? (
                          <TouchableOpacity
                            onPress={() => { setBgImageBack(''); setBgFileBack(null); setRemoveBgImageBack(true); }}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              backgroundColor: '#EF4444',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity onPress={handlePickCardBgBack} style={{ paddingLeft: 2 }} activeOpacity={0.7}>
                          <Ionicons name="chevron-forward" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* STICKY BOTTOM ACTION: Save Changes (Solid High-Contrast Black Button) */}
              <TouchableOpacity 
                style={{
                  backgroundColor: '#050505',
                  borderRadius: 16,
                  height: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18,
                  shadowRadius: 10,
                  elevation: 4,
                  marginTop: 6,
                  marginBottom: 20,
                }} 
                onPress={handleSaveCardConfig} 
                disabled={isSavingCard}
                activeOpacity={0.88}
              >
                {isSavingCard ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                    {locale === 'en' ? 'Save Changes' : 'Save Changes'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* COLOR & ICON FULL PICKER MODAL SHEET */}
            <Modal
              visible={activeColorPickerModal !== null}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setActiveColorPickerModal(null)}
            >
              <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.45)',
                justifyContent: 'flex-end',
              }}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={1}
                  onPress={() => setActiveColorPickerModal(null)}
                />

                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingHorizontal: 20,
                  paddingTop: 12,
                  paddingBottom: 36,
                  maxHeight: '80%',
                }}>
                  {/* Handle */}
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />

                  {/* Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      {activeColorPickerModal === 'background'
                        ? (locale === 'en' ? 'Card Background Color' : 'Warna Latar Kad')
                        : activeColorPickerModal === 'slots'
                          ? (locale === 'en' ? 'Stamp Slots Color' : 'Warna Slot Cop')
                          : activeColorPickerModal === 'text'
                            ? (locale === 'en' ? 'Text Color' : 'Warna Teks')
                            : (locale === 'en' ? 'Choose Stamp Check Icon' : 'Pilih Ikon Cop Setem')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActiveColorPickerModal(null)}
                      style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="close" size={17} color="#0F172A" />
                    </TouchableOpacity>
                  </View>

                  {/* Body Content */}
                  {activeColorPickerModal === 'icons' ? (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 14 }}>
                        {locale === 'en' ? 'Select the symbol displayed inside earned stamp slots:' : 'Pilih simbol yang dipaparkan dalam petak cop:'}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {stampIcons.map((icon) => {
                          const isSel = selectedIcon === icon.id;
                          return (
                            <TouchableOpacity
                              key={icon.id}
                              style={{
                                width: 50,
                                height: 50,
                                borderRadius: 14,
                                backgroundColor: isSel ? '#0F172A' : '#F8FAFC',
                                borderWidth: 1,
                                borderColor: isSel ? '#0F172A' : '#E2E8F0',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              onPress={() => {
                                setSelectedIcon(icon.id);
                                setActiveColorPickerModal(null);
                              }}
                              activeOpacity={0.8}
                            >
                              {icon.family === 'Ionicons' && (
                                <Ionicons name={icon.name as any} size={20} color={isSel ? '#FFFFFF' : '#475569'} />
                              )}
                              {icon.family === 'FontAwesome' && (
                                <FontAwesome name={icon.name as any} size={18} color={isSel ? '#FFFFFF' : '#475569'} />
                              )}
                              {icon.family === 'MaterialIcons' && (
                                <MaterialIcons name={icon.name as any} size={20} color={isSel ? '#FFFFFF' : '#475569'} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  ) : (
                    <View style={{ gap: 18 }}>
                      {/* Presets Grid */}
                      <View>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 10 }}>
                          {locale === 'en' ? 'Preset Palette' : 'Palet Pilihan'}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                          {(activeColorPickerModal === 'background'
                            ? colorOptions
                            : activeColorPickerModal === 'slots'
                              ? stampColorOptions
                              : fontColorOptions
                          ).map((opt) => {
                            const curVal = activeColorPickerModal === 'background' ? cardColor : activeColorPickerModal === 'slots' ? stampColor : fontColor;
                            const isSel = curVal.toLowerCase() === opt.value.toLowerCase();
                            return (
                              <TouchableOpacity
                                key={opt.value}
                                onPress={() => {
                                  if (activeColorPickerModal === 'background') { setCardColor(opt.value); setCustomHexInput(opt.value); }
                                  else if (activeColorPickerModal === 'slots') { setStampColor(opt.value); setCustomStampHexInput(opt.value); }
                                  else { setFontColor(opt.value); setCustomFontHexInput(opt.value); }
                                }}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 8,
                                  backgroundColor: isSel ? '#F1F5F9' : '#FFFFFF',
                                  borderWidth: 1,
                                  borderColor: isSel ? '#0F172A' : '#E2E8F0',
                                  paddingHorizontal: 12,
                                  paddingVertical: 7,
                                  borderRadius: 20,
                                }}
                              >
                                <View style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 8,
                                  backgroundColor: opt.value,
                                  borderWidth: opt.value === '#FFFFFF' ? 1 : 0,
                                  borderColor: '#CBD5E1',
                                }} />
                                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {/* Custom Hex Code */}
                      <View>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 8 }}>
                          {locale === 'en' ? 'Custom Hex Code' : 'Kod Warna Hex'}
                        </Text>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          gap: 8,
                        }}>
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8' }}>#</Text>
                          <TextInput
                            style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}
                            value={(activeColorPickerModal === 'background'
                              ? customHexInput
                              : activeColorPickerModal === 'slots'
                                ? customStampHexInput
                                : customFontHexInput
                            ).replace('#', '')}
                            onChangeText={(val) => {
                              const cleaned = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                              if (activeColorPickerModal === 'background') {
                                setCustomHexInput('#' + cleaned);
                                if (cleaned.length === 6) setCardColor('#' + cleaned.toUpperCase());
                              } else if (activeColorPickerModal === 'slots') {
                                setCustomStampHexInput('#' + cleaned);
                                if (cleaned.length === 6) setStampColor('#' + cleaned.toUpperCase());
                              } else {
                                setCustomFontHexInput('#' + cleaned);
                                if (cleaned.length === 6) setFontColor('#' + cleaned.toUpperCase());
                              }
                            }}
                            placeholder="000000"
                            placeholderTextColor="#94A3B8"
                            maxLength={6}
                            {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                          />
                          <View style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            backgroundColor: activeColorPickerModal === 'background' ? cardColor : activeColorPickerModal === 'slots' ? stampColor : fontColor,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                          }} />
                        </View>
                      </View>

                      {/* Close Done Button */}
                      <TouchableOpacity
                        onPress={() => setActiveColorPickerModal(null)}
                        style={{
                          backgroundColor: '#0F172A',
                          borderRadius: 12,
                          paddingVertical: 12,
                          alignItems: 'center',
                          marginTop: 8,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                          Done
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </Modal>
          </View>
        )}

        {/* TAB: Stamp Rules (Stamp Loyalty V3 - Fresha x Apple iOS x Risev Signature) */}
        {activeTab === 'stamp_rules' && (() => {
          const selectedRw = rewards.find(r => r.id === linkedRewardId);
          const finalRewardName = rewardDesc.trim() || selectedRw?.name || (locale === 'en' ? 'Free Reward' : 'Ganjaran Percuma');

          // Helper Open Handlers
          const openGoalScreen = () => {
            setTempGoal(requiredStamps);
            setIsCustomGoalMode(![5, 10, 15].includes(requiredStamps));
            setCustomGoalInput(![5, 10, 15].includes(requiredStamps) ? String(requiredStamps) : '');
            setStampSubScreen('goal');
          };

          const openRewardScreen = () => {
            setTempLinkedRewardId(linkedRewardId);
            setTempRewardDesc(rewardDesc);
            setRewardSearchQuery('');
            setRewardCategoryFilter('all');
            setStampSubScreen('reward');
          };

          const openExpiryScreen = () => {
            setTempExpiryDays(expiryDays || '90');
            setStampSubScreen('expiry');
          };

          const openMinSpendScreen = () => {
            setTempEnableMinSpend(enableMinSpend);
            setTempMinSpendAmount(minSpendAmount || '0');
            const val = parseFloat(minSpendAmount) || 0;
            if (!enableMinSpend || val === 0) setMinSpendPreset('none');
            else if (val === 10) setMinSpendPreset('10');
            else if (val === 20) setMinSpendPreset('20');
            else setMinSpendPreset('custom');
            setStampSubScreen('min_spend');
          };

          const openMilestonesScreen = () => {
            setStampSubScreen('milestones');
          };

          const openSimulatorScreen = () => {
            setStampSubScreen('simulator');
          };

          // Simulator Math
          const spendPerStamp = enableMinSpend ? (parseFloat(minSpendAmount) || 15) : 15;
          const totalCycleSpend = spendPerStamp * requiredStamps;
          const subRewardsTotalVal = subRewards.reduce((acc, curr) => acc + (parseFloat(curr.reward_value) || 0), 0);
          const fullRewardEstVal = 10;
          const totalRewardsGiven = fullRewardEstVal + subRewardsTotalVal;
          const effectiveRate = totalCycleSpend > 0 ? ((totalRewardsGiven / totalCycleSpend) * 100).toFixed(1) : '0';

          // -------------------------------------------------------------
          // 3/4 BOTTOM SHEET SUB-SCREENS CONTENT RENDERER
          // -------------------------------------------------------------
          const renderSubScreenContent = () => {
            // SCREEN A: SET STAMP GOAL
            if (stampSubScreen === 'goal') {
              const currentGoalNum = isCustomGoalMode ? (parseInt(customGoalInput, 10) || 10) : tempGoal;
              return (
              <View style={{ gap: 18, paddingBottom: 24 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity 
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }} 
                    onPress={() => setStampSubScreen(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-back" size={20} color="#000000" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: -0.4 }}>
                      Set Stamp Goal
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      How many stamps should customers collect to complete their card?
                    </Text>
                  </View>
                </View>

                {/* 2x2 Grid of Stamp Goals */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {[
                    { stamps: 5, label: '5', sub: 'Fast Goal' },
                    { stamps: 10, label: '10', sub: 'Recommended' },
                    { stamps: 15, label: '15', sub: 'High Value' },
                  ].map((opt) => {
                    const isSelected = !isCustomGoalMode && tempGoal === opt.stamps;
                    return (
                      <TouchableOpacity
                        key={opt.stamps}
                        style={{
                          width: '48%',
                          backgroundColor: '#FFFFFF',
                          borderRadius: 18,
                          paddingVertical: 18,
                          paddingHorizontal: 16,
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected ? '#FFCC00' : '#E2E8F0',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                        }}
                        onPress={() => {
                          setIsCustomGoalMode(false);
                          setTempGoal(opt.stamps);
                        }}
                        activeOpacity={0.85}
                      >
                        {isSelected && (
                          <View style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: '#FFCC00',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Ionicons name="checkmark" size={13} color="#000000" />
                          </View>
                        )}
                        <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                          {opt.label}
                        </Text>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginTop: 2 }}>
                          stamps
                        </Text>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 3 }}>
                          {opt.sub}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Custom Option */}
                  <TouchableOpacity
                    style={{
                      width: '48%',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 18,
                      paddingVertical: 18,
                      paddingHorizontal: 16,
                      borderWidth: isCustomGoalMode ? 2 : 1,
                      borderColor: isCustomGoalMode ? '#FFCC00' : '#E2E8F0',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                    onPress={() => {
                      setIsCustomGoalMode(true);
                      if (!customGoalInput) setCustomGoalInput(String(tempGoal || 10));
                    }}
                    activeOpacity={0.85}
                  >
                    {isCustomGoalMode && (
                      <View style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: '#FFCC00',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name="checkmark" size={13} color="#000000" />
                      </View>
                    )}
                    <Ionicons name="calendar-outline" size={26} color="#000000" />
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginTop: 4 }}>
                      Custom
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      Set your own
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom Goal Input Row */}
                {isCustomGoalMode && (
                  <View style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                      Enter Custom Stamps:
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TextInput
                        style={{
                          width: 60,
                          height: 40,
                          backgroundColor: '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: '#CBD5E1',
                          textAlign: 'center',
                          fontSize: 16,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: '#000000',
                        }}
                        keyboardType="number-pad"
                        value={customGoalInput}
                        onChangeText={setCustomGoalInput}
                        placeholder="8"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                        stamps
                      </Text>
                    </View>
                  </View>
                )}

                {/* Helper Card */}
                <View style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}>
                  <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569', lineHeight: 18 }}>
                    Customers need <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>{currentGoalNum} stamps</Text> to complete their card and redeem the reward.
                  </Text>
                </View>

                {/* Sticky Save CTA */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#000000',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8,
                  }}
                  onPress={() => {
                    const finalG = isCustomGoalMode ? (parseInt(customGoalInput, 10) || 10) : tempGoal;
                    const clampedG = Math.max(2, Math.min(30, finalG));
                    handleSelectStampGoal(clampedG);
                    setStampSubScreen(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

          // -------------------------------------------------------------
          // SCREEN B: SELECT COMPLETION REWARD
          // -------------------------------------------------------------
          if (stampSubScreen === 'reward') {
            const filteredRewards = rewards.filter((r) => {
              if (rewardCategoryFilter === 'free_item' && r.type !== 'free_item') return false;
              if (rewardCategoryFilter === 'discount' && r.type !== 'discount') return false;
              if (rewardSearchQuery.trim()) {
                const q = rewardSearchQuery.toLowerCase();
                return r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
              }
              return true;
            });

            return (
              <View style={{ gap: 16, paddingBottom: 24 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity 
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }} 
                    onPress={() => setStampSubScreen(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-back" size={20} color="#000000" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: -0.4 }}>
                      Select Completion Reward
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      Choose the reward customers will receive when they complete all stamps.
                    </Text>
                  </View>
                </View>

                {/* Filter Tabs */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { key: 'all', label: 'All Items' },
                    { key: 'free_item', label: 'Free Item' },
                    { key: 'discount', label: 'Discount' },
                    { key: 'custom', label: 'Custom' },
                  ].map((tab) => {
                    const isSel = rewardCategoryFilter === tab.key;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 20,
                          backgroundColor: isSel ? '#000000' : '#F1F5F9',
                        }}
                        onPress={() => setRewardCategoryFilter(tab.key as any)}
                        activeOpacity={0.8}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontFamily: 'PlusJakartaSans_700Bold',
                          color: isSel ? '#FFFFFF' : '#64748B',
                        }}>
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Search Bar */}
                {rewardCategoryFilter !== 'custom' && (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    paddingHorizontal: 12,
                    height: 44,
                  }}>
                    <Ionicons name="search-outline" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
                    <TextInput
                      style={{
                        flex: 1,
                        fontSize: 13.5,
                        fontFamily: 'PlusJakartaSans_600SemiBold',
                        color: '#000000',
                      }}
                      placeholder="Search menu items..."
                      placeholderTextColor="#94A3B8"
                      value={rewardSearchQuery}
                      onChangeText={setRewardSearchQuery}
                    />
                    {rewardSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setRewardSearchQuery('')}>
                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Rewards List */}
                {rewardCategoryFilter !== 'custom' && (
                  <View style={{ gap: 8 }}>
                    {filteredRewards.length === 0 ? (
                      <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Ionicons name="gift-outline" size={32} color="#94A3B8" />
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 8 }}>
                          No matching rewards found
                        </Text>
                      </View>
                    ) : (
                      filteredRewards.map((rw) => {
                        const isSelected = tempLinkedRewardId === rw.id;
                        const rwImgUrl = rw.image ? `${pb.baseUrl}/api/files/rewards/${rw.id}/${rw.image}` : null;
                        return (
                          <TouchableOpacity
                            key={rw.id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: '#FFFFFF',
                              borderRadius: 16,
                              padding: 12,
                              borderWidth: isSelected ? 1.5 : 1,
                              borderColor: isSelected ? '#000000' : '#E2E8F0',
                            }}
                            onPress={() => {
                              setTempLinkedRewardId(rw.id);
                              setTempRewardDesc(rw.name);
                            }}
                            activeOpacity={0.8}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
                              {rwImgUrl ? (
                                <Image source={{ uri: rwImgUrl }} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9' }} />
                              ) : (
                                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }}>
                                  <Ionicons name={rw.type === 'discount' ? 'pricetag' : 'gift'} size={20} color="#FFCC00" />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }} numberOfLines={1}>
                                  {rw.name}
                                </Text>
                                <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                                  {rw.type === 'discount' ? 'Discount Voucher' : 'Free Item'}
                                </Text>
                              </View>
                            </View>

                            {/* Fresha x iOS Signature Radio Indicator */}
                            <View style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              borderWidth: isSelected ? 2 : 1.5,
                              borderColor: isSelected ? '#000000' : '#CBD5E1',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              {isSelected && (
                                <View style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 6,
                                  backgroundColor: '#FFCC00',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#000000' }} />
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                )}

                {/* Custom Reward Mode */}
                {rewardCategoryFilter === 'custom' && (
                  <View style={{ gap: 12 }}>
                    <View style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      gap: 8,
                    }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                        Custom Reward Name
                      </Text>
                      <TextInput
                        style={{
                          height: 44,
                          backgroundColor: '#F8FAFC',
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#CBD5E1',
                          paddingHorizontal: 12,
                          fontSize: 14,
                          fontFamily: 'PlusJakartaSans_600SemiBold',
                          color: '#000000',
                        }}
                        placeholder="e.g. Free Hot Latte / RM10 Off"
                        placeholderTextColor="#94A3B8"
                        value={tempRewardDesc}
                        onChangeText={(val) => {
                          setTempRewardDesc(val);
                          setTempLinkedRewardId(null);
                        }}
                      />
                    </View>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: '#000000',
                        paddingVertical: 13,
                      }}
                      onPress={() => setShowInlineCreateModal(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={18} color="#000000" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                        Create New in Catalog
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Sticky Save CTA */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#000000',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8,
                  }}
                  onPress={() => {
                    setLinkedRewardId(tempLinkedRewardId);
                    setRewardDesc(tempRewardDesc);
                    setStampSubScreen(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

          // -------------------------------------------------------------
          // SCREEN C: SET CARD EXPIRATION
          // -------------------------------------------------------------
          if (stampSubScreen === 'expiry') {
            const expOptions = [
              { val: '30', label: '30 days' },
              { val: '60', label: '60 days' },
              { val: '90', label: '90 days' },
              { val: '180', label: '180 days' },
              { val: '0', label: 'No expiry' },
            ];

            const expiryDaysNum = parseInt(tempExpiryDays, 10) || 0;

            return (
              <View style={{ gap: 16, paddingBottom: 24 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity 
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }} 
                    onPress={() => setStampSubScreen(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-back" size={20} color="#000000" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: -0.4 }}>
                      Set Card Expiration
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      Number of days before a stamp card expires from the customer's first visit.
                    </Text>
                  </View>
                </View>

                {/* Expiry Options List */}
                <View style={{ gap: 10 }}>
                  {expOptions.map((opt) => {
                    const isSelected = (opt.val === '0' && (!tempExpiryDays || tempExpiryDays === '0')) || tempExpiryDays === opt.val;
                    return (
                      <TouchableOpacity
                        key={opt.val}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#FFFFFF',
                          borderRadius: 16,
                          padding: 16,
                          borderWidth: isSelected ? 1.5 : 1,
                          borderColor: isSelected ? '#000000' : '#E2E8F0',
                          gap: 12,
                        }}
                        onPress={() => setTempExpiryDays(opt.val)}
                        activeOpacity={0.8}
                      >
                        {/* Radio */}
                        <View style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: isSelected ? 2 : 1.5,
                          borderColor: isSelected ? '#000000' : '#CBD5E1',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {isSelected && (
                            <View style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: '#FFCC00',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#000000' }} />
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Helper Card */}
                <View style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}>
                  <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569', lineHeight: 18 }}>
                    {expiryDaysNum > 0 
                      ? `The stamp card will expire ${expiryDaysNum} days after the customer's first visit.`
                      : 'The stamp card will never expire.'}
                  </Text>
                </View>

                {/* Sticky Save CTA */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#000000',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8,
                  }}
                  onPress={() => {
                    setExpiryDays(tempExpiryDays);
                    setStampSubScreen(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

          // -------------------------------------------------------------
          // SCREEN D: MINIMUM SPEND PER STAMP
          // -------------------------------------------------------------
          if (stampSubScreen === 'min_spend') {
            const minSpendChoices = [
              { key: 'none', label: 'No minimum spend' },
              { key: '10', label: 'RM 10 per stamp' },
              { key: '20', label: 'RM 20 per stamp' },
              { key: 'custom', label: 'Custom amount' },
            ];

            return (
              <View style={{ gap: 16, paddingBottom: 24 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity 
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }} 
                    onPress={() => setStampSubScreen(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-back" size={20} color="#000000" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: -0.4 }}>
                      Minimum Spend per Stamp
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      Set a minimum bill amount for each stamp to be earned.
                    </Text>
                  </View>
                </View>

                {/* Options List */}
                <View style={{ gap: 10 }}>
                  {minSpendChoices.map((opt) => {
                    const isSelected = minSpendPreset === opt.key;
                    return (
                      <View key={opt.key} style={{ gap: 8 }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#FFFFFF',
                            borderRadius: 16,
                            padding: 16,
                            borderWidth: isSelected ? 1.5 : 1,
                            borderColor: isSelected ? '#000000' : '#E2E8F0',
                            gap: 12,
                          }}
                          onPress={() => setMinSpendPreset(opt.key as any)}
                          activeOpacity={0.8}
                        >
                          {/* Radio */}
                          <View style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            borderWidth: isSelected ? 2 : 1.5,
                            borderColor: isSelected ? '#000000' : '#CBD5E1',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {isSelected && (
                              <View style={{
                                width: 12,
                                height: 12,
                                borderRadius: 6,
                                backgroundColor: '#FFCC00',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#000000' }} />
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>

                        {/* Custom Input */}
                        {opt.key === 'custom' && isSelected && (
                          <View style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            height: 48,
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginLeft: 34,
                          }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginRight: 6 }}>
                              RM
                            </Text>
                            <TextInput
                              style={{
                                flex: 1,
                                fontSize: 14,
                                fontFamily: 'PlusJakartaSans_700Bold',
                                color: '#000000',
                              }}
                              keyboardType="numeric"
                              placeholder="15.00"
                              placeholderTextColor="#94A3B8"
                              value={tempMinSpendAmount}
                              onChangeText={setTempMinSpendAmount}
                            />
                            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                              per stamp
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Helper Card */}
                <View style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}>
                  <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569', lineHeight: 18 }}>
                    {minSpendPreset === 'none' 
                      ? 'Customers can earn a stamp from any eligible purchase amount.'
                      : minSpendPreset === '10'
                      ? 'Customers must spend at least RM10.00 to receive each stamp.'
                      : minSpendPreset === '20'
                      ? 'Customers must spend at least RM20.00 to receive each stamp.'
                      : `Customers must spend at least RM${parseFloat(tempMinSpendAmount || '0').toFixed(2)} to receive each stamp.`}
                  </Text>
                </View>

                {/* Sticky Save CTA */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#000000',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8,
                  }}
                  onPress={() => {
                    if (minSpendPreset === 'none') {
                      setEnableMinSpend(false);
                      setMinSpendAmount('0');
                    } else if (minSpendPreset === '10') {
                      setEnableMinSpend(true);
                      setMinSpendAmount('10');
                    } else if (minSpendPreset === '20') {
                      setEnableMinSpend(true);
                      setMinSpendAmount('20');
                    } else {
                      setEnableMinSpend(true);
                      setMinSpendAmount(tempMinSpendAmount || '15');
                    }
                    setStampSubScreen(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

          // -------------------------------------------------------------
          // SCREEN E: MILESTONE REWARDS
          // -------------------------------------------------------------
          if (stampSubScreen === 'milestones') {
            return (
              <View style={{ gap: 16, paddingBottom: 24 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity 
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }} 
                    onPress={() => setStampSubScreen(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-back" size={20} color="#000000" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: -0.4 }}>
                      Milestone Rewards
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      Offer extra rewards at specific stamp milestones.
                    </Text>
                  </View>
                </View>

                {/* Enable Switch Card */}
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="gift-outline" size={18} color="#000000" />
                    </View>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                      Enable milestone rewards
                    </Text>
                  </View>
                  <Switch
                    value={enableMilestones}
                    onValueChange={setEnableMilestones}
                    trackColor={{ false: '#E2E8F0', true: '#000000' }}
                    thumbColor={enableMilestones ? '#FFCC00' : '#FFFFFF'}
                  />
                </View>

                {/* Milestones List */}
                {enableMilestones && (
                  <View style={{ gap: 10 }}>
                    {subRewards.length === 0 ? (
                      <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Ionicons name="gift-outline" size={32} color="#94A3B8" />
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginTop: 8 }}>
                          No milestone rewards configured
                        </Text>
                        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 3, textAlign: 'center' }}>
                          Add extra gifts at intermediate stamps to boost customer motivation before reaching {requiredStamps} stamps.
                        </Text>
                      </View>
                    ) : (
                      subRewards.map((sr) => (
                        <TouchableOpacity
                          key={sr.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#FFFFFF',
                            borderRadius: 16,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            justifyContent: 'space-between',
                          }}
                          onPress={() => {
                            setEditingMilestoneId(sr.id);
                            setMilestoneFormStamp(sr.at_stamp);
                            setMilestoneFormTitle(sr.reward_title);
                            setMilestoneFormType(sr.reward_type as any);
                            setMilestoneFormValue(sr.reward_value);
                            setShowMilestoneEditorModal(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
                            <Ionicons name="reorder-two-outline" size={20} color="#94A3B8" />
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFCC00', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 16 }}>🎁</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                                {sr.at_stamp} stamps
                              </Text>
                              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                                {sr.reward_title}
                              </Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                      ))
                    )}

                    {/* Add Milestone Reward Button */}
                    {subRewards.length < (requiredStamps - 1) && (
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 14,
                          paddingVertical: 14,
                          borderWidth: 1.5,
                          borderColor: '#000000',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          marginTop: 4,
                        }}
                        onPress={handleAddSubReward}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={18} color="#000000" />
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                          Add Milestone Reward
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Milestone Edit Modal */}
                <Modal visible={showMilestoneEditorModal} transparent animationType="slide">
                  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                          Edit Milestone Reward
                        </Text>
                        <TouchableOpacity onPress={() => setShowMilestoneEditorModal(false)}>
                          <Ionicons name="close" size={22} color="#000000" />
                        </TouchableOpacity>
                      </View>

                      {/* Stamp Pill Selector */}
                      <View>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                          On Stamp:
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {Array.from({ length: requiredStamps - 1 }).map((_, i) => {
                            const sNum = i + 1;
                            const isCurr = milestoneFormStamp === sNum;
                            return (
                              <TouchableOpacity
                                key={sNum}
                                style={{
                                  width: 44,
                                  height: 38,
                                  borderRadius: 10,
                                  backgroundColor: isCurr ? '#000000' : '#F1F5F9',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                onPress={() => setMilestoneFormStamp(sNum)}
                              >
                                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: isCurr ? '#FFCC00' : '#000000' }}>
                                  #{sNum}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>

                      {/* Title Input */}
                      <View>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                          Reward Title:
                        </Text>
                        <TextInput
                          style={{
                            height: 44,
                            backgroundColor: '#F8FAFC',
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                            paddingHorizontal: 12,
                            fontSize: 14,
                            fontFamily: 'PlusJakartaSans_600SemiBold',
                            color: '#000000',
                          }}
                          value={milestoneFormTitle}
                          onChangeText={setMilestoneFormTitle}
                          placeholder="e.g. Free AISKRM Cup"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      {/* Estimated Value */}
                      <View>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                          Estimated Value (RM):
                        </Text>
                        <TextInput
                          style={{
                            height: 44,
                            backgroundColor: '#F8FAFC',
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                            paddingHorizontal: 12,
                            fontSize: 14,
                            fontFamily: 'PlusJakartaSans_800ExtraBold',
                            color: '#000000',
                          }}
                          keyboardType="numeric"
                          value={milestoneFormValue}
                          onChangeText={setMilestoneFormValue}
                          placeholder="5.00"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: '#FEE2E2',
                            borderRadius: 14,
                            paddingVertical: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => {
                            if (editingMilestoneId) {
                              handleRemoveSubReward(editingMilestoneId);
                            }
                            setShowMilestoneEditorModal(false);
                          }}
                        >
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#DC2626' }}>
                            Delete
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            flex: 2,
                            backgroundColor: '#000000',
                            borderRadius: 14,
                            paddingVertical: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => {
                            if (editingMilestoneId) {
                              handleUpdateSubReward(editingMilestoneId, {
                                at_stamp: milestoneFormStamp,
                                reward_title: milestoneFormTitle,
                                reward_value: milestoneFormValue,
                                reward_type: milestoneFormType,
                              });
                            }
                            setShowMilestoneEditorModal(false);
                          }}
                        >
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                            Save Milestone
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>

                {/* Sticky Save CTA */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#000000',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8,
                  }}
                  onPress={() => setStampSubScreen(null)}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

          // -------------------------------------------------------------
          // SCREEN F: REWARD COST PREVIEW
          // -------------------------------------------------------------
          if (stampSubScreen === 'simulator') {
            return (
              <View style={{ gap: 18, paddingBottom: 24 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity 
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }} 
                    onPress={() => setStampSubScreen(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-back" size={20} color="#000000" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: -0.4 }}>
                      Reward Cost Preview
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      Estimate the cost and impact of your loyalty rewards.
                    </Text>
                  </View>
                </View>

                {/* 3-Column Stats Box */}
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  flexDirection: 'row',
                  gap: 8,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                      Total Spend
                    </Text>
                    <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginTop: 4 }}>
                      RM {totalCycleSpend.toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 2 }}>
                      ({requiredStamps} × RM{spendPerStamp.toFixed(0)})
                    </Text>
                  </View>

                  <View style={{ width: 1, backgroundColor: '#E2E8F0' }} />

                  <View style={{ flex: 1, paddingLeft: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                      Total Rewards
                    </Text>
                    <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginTop: 4 }}>
                      RM {totalRewardsGiven.toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 2 }}>
                      (1 redemption)
                    </Text>
                  </View>

                  <View style={{ width: 1, backgroundColor: '#E2E8F0' }} />

                  <View style={{ flex: 1, paddingLeft: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                      Effective Rate
                    </Text>
                    <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981', marginTop: 4 }}>
                      {effectiveRate}%
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 2 }}>
                      of turnover
                    </Text>
                  </View>
                </View>

                {/* Bulb Advice Box */}
                <View style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  flexDirection: 'row',
                  gap: 12,
                }}>
                  <Ionicons name="bulb-outline" size={24} color="#FFCC00" style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569', lineHeight: 18 }}>
                    Customers spend RM{totalCycleSpend.toFixed(2)} across {requiredStamps} visits to earn RM{totalRewardsGiven.toFixed(2)} in rewards ({effectiveRate}% effective rate). This estimate helps you plan your margin while maximizing visit frequency.
                  </Text>
                </View>

                {/* Sticky Save CTA */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#000000',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8,
                  }}
                  onPress={() => setStampSubScreen(null)}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

            return null;
          };

          // -------------------------------------------------------------
          // SCREEN 1: MAIN STAMP LOYALTY OVERVIEW (Fresha x Apple iOS x Risev)
          // -------------------------------------------------------------
          return (
            <View style={{ gap: 20, paddingBottom: 24 }}>
              {/* Stamp Rule Section Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <View>
                  <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: -0.4 }}>
                    {locale === 'en' ? 'Stamp Loyalty' : 'Aturan Kad Setem'}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                    {locale === 'en' ? 'Manage your stamp rules & milestones' : 'Urus aturan cop & ganjaran kemajuan'}
                  </Text>
                </View>

                {/* Status Pill */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: isActive ? '#F0FDF4' : '#F8FAFC',
                    borderWidth: 1,
                    borderColor: isActive ? '#BBF7D0' : '#E2E8F0',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                  }}
                  onPress={() => setIsActive(!isActive)}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isActive ? '#16A34A' : '#94A3B8' }} />
                  <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: isActive ? '#16A34A' : '#64748B' }}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* YOUR LOYALTY CARD Section */}
              <View>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                  YOUR LOYALTY CARD
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                  onPress={openRewardScreen}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, paddingRight: 8 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFCC00', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="gift" size={24} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', letterSpacing: -0.3 }} numberOfLines={1}>
                        Collect {requiredStamps} stamps
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 3 }} numberOfLines={1}>
                        Get {finalRewardName}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Loyalty Rules Section */}
              <View>
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginBottom: 12 }}>
                  Loyalty Rules
                </Text>

                <View style={{ gap: 10 }}>
                  {/* Row 1: Stamps Required */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onPress={openGoalScreen}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="bag-handle-outline" size={18} color="#000000" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                          Stamps Required
                        </Text>
                        <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 2 }}>
                          {requiredStamps} stamps
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  {/* Row 2: Completion Reward */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onPress={openRewardScreen}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="gift-outline" size={18} color="#000000" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                          Completion Reward
                        </Text>
                        <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                          {finalRewardName}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  {/* Row 3: Card Expiration */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onPress={openExpiryScreen}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="calendar-outline" size={18} color="#000000" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                          Card Expiration
                        </Text>
                        <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 2 }}>
                          {parseInt(expiryDays, 10) > 0 ? `${expiryDays} days` : 'No expiry'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  {/* Row 4: Minimum Spend per Stamp */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onPress={openMinSpendScreen}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="receipt-outline" size={18} color="#000000" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                          Minimum Spend per Stamp
                        </Text>
                        <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 2 }}>
                          {enableMinSpend && parseFloat(minSpendAmount) > 0 ? `RM ${parseFloat(minSpendAmount).toFixed(0)} per stamp` : 'No minimum spend'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* More Options Section */}
              <View>
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginBottom: 12 }}>
                  More Options
                </Text>

                <View style={{ gap: 10 }}>
                  {/* Row 1: Milestone Rewards */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onPress={openMilestonesScreen}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="stats-chart-outline" size={18} color="#000000" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                          Milestone Rewards
                        </Text>
                        <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 2 }}>
                          {subRewards.length > 0 ? `${subRewards.length} configured` : 'Not set up • Optional'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  {/* Row 2: Reward Cost Preview */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onPress={openSimulatorScreen}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="calculator-outline" size={18} color="#000000" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' }}>
                          Reward Cost Preview
                        </Text>
                        <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 2 }}>
                          Estimate your reward expenses
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sticky Save Changes CTA */}
              <View style={{ marginTop: 10, marginBottom: 20 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#000000',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                  onPress={handleSaveCardConfig}
                  disabled={isSavingCard}
                  activeOpacity={0.85}
                >
                  {isSavingCard ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                      Save Changes
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* 3/4 Height Bottom Sheet Modal for Sub-Screens (Slide from down to 3/4 of the page) */}
              <Modal
                visible={stampSubScreen !== null}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setStampSubScreen(null)}
              >
                <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'flex-end' }}>
                  {/* Backdrop touch to dismiss */}
                  <TouchableOpacity 
                    style={{ flex: 1 }} 
                    activeOpacity={1} 
                    onPress={() => setStampSubScreen(null)} 
                  />

                  {/* Bottom Sheet Container (3/4 of page) */}
                  <View style={{
                    height: Math.round(screenHeight * 0.75),
                    maxHeight: Math.round(screenHeight * 0.75),
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                    paddingHorizontal: 20,
                    paddingTop: 10,
                    paddingBottom: 24,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: -6 },
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                    elevation: 20,
                    maxWidth: isDesktop ? 600 : '100%',
                    width: '100%',
                    alignSelf: 'center',
                  }}>
                    {/* Top Drag Handle Indicator Bar */}
                    <View style={{
                      width: 40,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: '#CBD5E1',
                      alignSelf: 'center',
                      marginBottom: 14,
                    }} />

                    <ScrollView
                      style={{ flex: 1 }}
                      contentContainerStyle={{ paddingBottom: 20 }}
                      showsVerticalScrollIndicator={false}
                    >
                      {renderSubScreenContent()}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            </View>
          );
        })()}

        {/* TAB 3: Points Loyalty Dashboard (IMAGE 1 EXACT DESIGN) */}
        {activeTab === 'points_tiers' && (() => {
          const parsedSpend = parseFloat(spendPerPoint) || 1;
          const parsedRedeem = parseInt(pointsPerRm, 10) || 100;
          const parsedMin = parseInt(minRedeemPoints, 10) || 0;
          const parsedMax = parseInt(maxRedeemPercent, 10) || 0;

          // Live Calculator Math
          const testSpendNum = parseFloat(testSpend) || 100;
          const calculatedPoints = Math.floor(testSpendNum / parsedSpend);
          const calculatedDiscount = (calculatedPoints / parsedRedeem).toFixed(2);
          const rewardRatePercent = testSpendNum > 0
            ? ((parseFloat(calculatedDiscount) / testSpendNum) * 100).toFixed(1).replace(/\.0$/, '')
            : '0';

          return (
            <View style={{ marginTop: 12, gap: 14 }}>
              {/* Header: Points Loyalty Title + Live Active Status Toggle */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 4,
                marginBottom: 2,
              }}>
                <View>
                  <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', letterSpacing: -0.3 }}>
                    {locale === 'en' ? 'Points Loyalty' : 'Mata Ganjaran'}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                    {locale === 'en' ? 'Reward customers for every purchase.' : 'Ganjarkan pelanggan bagi setiap pembelian.'}
                  </Text>
                </View>

                {/* Status Badge with Toggle */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: enablePoints ? '#ECFDF5' : '#F1F5F9',
                    paddingHorizontal: 9,
                    paddingVertical: 3.5,
                    borderRadius: 9999,
                    borderWidth: 1,
                    borderColor: enablePoints ? '#A7F3D0' : '#E2E8F0',
                  }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: enablePoints ? '#10B981' : '#94A3B8' }} />
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: enablePoints ? '#059669' : '#64748B' }}>
                      {enablePoints ? (locale === 'en' ? 'Active' : 'Aktif') : (locale === 'en' ? 'Paused' : 'Dijeda')}
                    </Text>
                  </View>
                  <Switch
                    value={enablePoints}
                    onValueChange={(val) => {
                      if (!val && !enableStamps) {
                        Alert.alert('Action Restricted', locale === 'en' ? 'At least one loyalty module (Stamps or Points) must remain active.' : 'Sekurang-kurangnya satu modul mesti aktif.');
                        return;
                      }
                      setEnablePoints(val);
                    }}
                    trackColor={{ false: '#E2E8F0', true: '#000000' }}
                    thumbColor="#FFFFFF"
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>
              </View>

              {/* CARD 1: EARN POINTS (IMAGE 1 EXACT) */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                padding: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}>
                {/* Header Row */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}
                  onPress={() => setShowEarnRateModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                    <View style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: '#FEF08A',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="cash-outline" size={22} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Earn Points' : 'Dapatkan Mata'}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                        {locale === 'en' ? 'Set how much customers need to spend to earn 1 point.' : 'Tetapkan jumlah belanja untuk dapatkan 1 mata.'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                {/* Quick Presets Pills */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {['1', '2', '5', '10'].map((amt) => {
                    const isSelected = spendPerPoint === amt;
                    return (
                      <TouchableOpacity
                        key={amt}
                        onPress={() => setSpendPerPoint(amt)}
                        style={{
                          flex: 1,
                          height: 38,
                          borderRadius: 10,
                          backgroundColor: isSelected ? '#000000' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: isSelected ? '#000000' : '#E2E8F0',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={{
                          fontSize: 12.5,
                          fontFamily: isSelected ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_700Bold',
                          color: isSelected ? '#FFCC00' : '#0F172A',
                        }}>
                          RM {amt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Split Dual-Metric Display */}
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  flexDirection: 'row',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                }}>
                  {/* Left: Spend */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 2 }}>
                      {locale === 'en' ? 'Spend' : 'Belanja'}
                    </Text>
                    <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      RM {spendPerPoint || '1'}
                    </Text>
                  </View>

                  {/* Vertical Hairline Divider */}
                  <View style={{ width: 1, backgroundColor: '#E2E8F0', marginHorizontal: 16 }} />

                  {/* Right: Earn */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 2 }}>
                      {locale === 'en' ? 'Earn' : 'Dapat'}
                    </Text>
                    <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      1 Point
                    </Text>
                  </View>
                </View>
              </View>

              {/* CARD 2: REDEEM VALUE (IMAGE 1 EXACT) */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                padding: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}>
                {/* Header Row */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}
                  onPress={() => setShowRedeemRateModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                    <View style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: '#FEF08A',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="gift-outline" size={22} color="#000000" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Redeem Value' : 'Nilai Tebus'}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                        {locale === 'en' ? 'Set how many points can be redeemed for a discount.' : 'Tetapkan berapa mata untuk ditebus sebagai diskaun.'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                {/* Split Dual-Metric Display */}
                <TouchableOpacity
                  onPress={() => setShowRedeemRateModal(true)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    flexDirection: 'row',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                  }}
                >
                  {/* Left: Points */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 2 }}>
                      {locale === 'en' ? 'Points' : 'Mata'}
                    </Text>
                    <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      {pointsPerRm || '100'} Pts
                    </Text>
                  </View>

                  {/* Vertical Hairline Divider */}
                  <View style={{ width: 1, backgroundColor: '#E2E8F0', marginHorizontal: 16 }} />

                  {/* Right: Discount Value */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 2 }}>
                      {locale === 'en' ? 'Discount Value' : 'Nilai Diskaun'}
                    </Text>
                    <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      RM 1.00
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* CARD 3: PREVIEW EXAMPLE (LIVE CALCULATOR - IMAGE 1 EXACT) */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                padding: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}>
                {/* Header Row with Inline Test Spend Input */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 10 }}>
                    <View style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="calculator-outline" size={22} color="#0F172A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        {locale === 'en' ? 'Preview Example' : 'Contoh Pratonton'}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                        {locale === 'en' ? 'See how it works at checkout.' : 'Lihat kiraan semasa pembayaran.'}
                      </Text>
                    </View>
                  </View>

                  {/* Interactive Spending Input Box */}
                  <View style={{
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    minWidth: 110,
                    alignItems: 'flex-end',
                  }}>
                    <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 1 }}>
                      {locale === 'en' ? 'Customer spending (RM)' : 'Belanja Pelanggan (RM)'}
                    </Text>
                    <TextInput
                      value={testSpend}
                      onChangeText={setTestSpend}
                      keyboardType="numeric"
                      style={{
                        fontSize: 16,
                        fontFamily: 'PlusJakartaSans_800ExtraBold',
                        color: '#0F172A',
                        textAlign: 'right',
                        padding: 0,
                        minWidth: 50,
                      }}
                      placeholder="100"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Calculation Summary Strip (Creamy Gold) */}
                <View style={{
                  backgroundColor: '#FEFCE8',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#FEF08A',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}>
                  {/* Points Earned */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#713F12', marginBottom: 2 }}>
                      {locale === 'en' ? 'Points earned' : 'Mata diperoleh'}
                    </Text>
                    <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      {calculatedPoints} Pts
                    </Text>
                  </View>

                  {/* Hairline Divider */}
                  <View style={{ width: 1, backgroundColor: '#FDE047', marginHorizontal: 8, opacity: 0.6 }} />

                  {/* Discount Value */}
                  <View style={{ flex: 1.1 }}>
                    <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#713F12', marginBottom: 2 }}>
                      {locale === 'en' ? 'Discount value' : 'Nilai diskaun'}
                    </Text>
                    <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      RM {calculatedDiscount}
                    </Text>
                  </View>

                  {/* Hairline Divider */}
                  <View style={{ width: 1, backgroundColor: '#FDE047', marginHorizontal: 8, opacity: 0.6 }} />

                  {/* Reward Rate */}
                  <View style={{ flex: 1.1 }}>
                    <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#713F12', marginBottom: 2 }}>
                      {locale === 'en' ? 'Reward rate' : 'Kadar ganjaran'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                      <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        {rewardRatePercent}%
                      </Text>
                      <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#713F12' }}>
                        {locale === 'en' ? 'of spend' : 'belanja'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* CARD 4: RULES & LIMITS (IMAGE 1 EXACT) */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
                onPress={() => setShowPointsRulesModal(true)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                  <View style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="shield-checkmark-outline" size={22} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      {locale === 'en' ? 'Rules & Limits' : 'Peraturan & Had'}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                      {locale === 'en'
                        ? 'Set redemption rules, limits and fraud protection.'
                        : 'Tetapkan syarat penebusan, had minima dan keselamatan.'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {/* Primary Save Action Button (IMAGE 1 EXACT CAPSULE) */}
              <TouchableOpacity
                style={[{
                  backgroundColor: '#000000',
                  height: 52,
                  borderRadius: 9999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 6,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  elevation: 4,
                }, savingPointsRate && { opacity: 0.6 }]}
                onPress={handleSavePointsRate}
                disabled={savingPointsRate}
                activeOpacity={0.8}
              >
                {savingPointsRate ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                    {locale === 'en' ? 'Save Changes' : 'Simpan Perubahan'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* TAB 4: Birthday Rewards */}
        {activeTab === 'birthday' && (() => {
          const birthdayBrandColor = merchant?.onboarding_primary_color || merchant?.pwa_brand_color || merchant?.brand_color || cardColor || '#050505';
          const isLightBrand = (() => {
            const hex = (birthdayBrandColor || '#050505').replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16) || 0;
            const g = parseInt(hex.substring(2, 4), 16) || 0;
            const b = parseInt(hex.substring(4, 6), 16) || 0;
            const yiq = (r * 299 + g * 587 + b * 114) / 1000;
            return yiq >= 160;
          })();
          const brandTextColor = isLightBrand ? '#0F172A' : '#FFFFFF';

          return (
            <View style={{ marginTop: 12, gap: 16 }}>
              {/* 1. TOP AUTOMATION STATUS BANNER */}
              <View style={[styles.configCard, { padding: 18, marginBottom: 0 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#64748B', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    AUTOMATED BIRTHDAY ENGINE
                  </Text>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: birthdayForm.is_active ? '#ECFDF5' : '#F1F5F9',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: birthdayForm.is_active ? '#A7F3D0' : '#E2E8F0',
                  }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: birthdayForm.is_active ? '#10B981' : '#94A3B8' }} />
                    <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: birthdayForm.is_active ? '#065F46' : '#64748B', letterSpacing: 0.4 }}>
                      {birthdayForm.is_active ? (locale === 'en' ? 'ALWAYS ACTIVE' : 'SENTIASA AKTIF') : (locale === 'en' ? 'PAUSED' : 'DIJEDA')}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', letterSpacing: -0.3 }}>
                    {locale === 'en' ? 'Turn Birthdays Into Guaranteed Visits' : 'Tukar Hari Lahir Kepada Pelanggan Setia'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setHelpModalInfo({
                      title: locale === 'en' ? 'Automated Birthday Engine' : 'Enjin Hari Lahir Automatik',
                      desc: locale === 'en'
                        ? 'Every customer with a birthday on file automatically receives a branded digital pass in their wallet on their birthday morning to celebrate and redeem at your store.'
                        : 'Setiap pelanggan yang berdaftar akan menerima baucar khas ini secara automatik pada pagi hari lahir mereka untuk ditebus di kedai.',
                    })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="help-circle-outline" size={15} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 2. LIVE CUSTOMER BOARDING PASS PREVIEW */}
              <View style={[styles.configCard, { padding: 16, marginBottom: 0 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#64748B', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    {locale === 'en' ? 'LIVE CUSTOMER VOUCHER PREVIEW' : 'PRATONTON BAUCAR PELANGGAN'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6 }}>
                    <Ionicons name="eye-outline" size={10.5} color="#64748B" />
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                      {locale === 'en' ? 'Customer View' : 'Pandangan Pelanggan'}
                    </Text>
                  </View>
                </View>

                {/* THE REFINED AIRLINE BOARDING PASS TICKET CARD */}
                <View style={{
                  height: 142,
                  borderRadius: 16,
                  backgroundColor: '#FFFFFF',
                  flexDirection: 'row',
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 3,
                  position: 'relative',
                }}>
                  {/* LEFT ACCENT STRIP: Brand Color Accent Bar */}
                  <View style={{
                    width: 7,
                    backgroundColor: birthdayBrandColor,
                    borderTopLeftRadius: 16,
                    borderBottomLeftRadius: 16,
                  }} />

                  {/* CENTER ZONE: Reward Info with ample breathing room */}
                  <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'space-between' }}>
                    {/* Top Row: Clean Single Badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{
                        backgroundColor: '#FFFBEB',
                        borderWidth: 1,
                        borderColor: '#FDE68A',
                        paddingHorizontal: 8,
                        paddingVertical: 2.5,
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <Ionicons name={birthdayForm.reward_type === 'stamps' ? "star" : "gift"} size={11} color="#B45309" />
                        <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309', letterSpacing: 0.2 }}>
                          {birthdayForm.reward_type === 'stamps'
                            ? (locale === 'en' ? 'BIRTHDAY STAMPS' : 'COP HARI LAHIR')
                            : (locale === 'en' ? 'BIRTHDAY SPECIAL' : 'KHAS HARI LAHIR')}
                        </Text>
                      </View>

                      <View style={{
                        backgroundColor: '#F1F5F9',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}>
                        <Text style={{ fontSize: 8, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#475569', letterSpacing: 0.4 }}>
                          {birthdayForm.reward_type === 'stamps' ? 'AUTO-CREDIT' : 'IN-STORE PASS'}
                        </Text>
                      </View>
                    </View>

                    {/* Middle: Title & Subtitle */}
                    <View style={{ marginVertical: 2 }}>
                      <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', letterSpacing: -0.2, lineHeight: 19 }} numberOfLines={1}>
                        {birthdayForm.title || (locale === 'en' ? 'Free Birthday Treat' : 'Hadiah Hari Lahir')}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                        {birthdayForm.reward_type === 'stamps'
                          ? (locale === 'en' ? `${birthdayForm.reward_value || '2'} bonus stamps added to card` : `${birthdayForm.reward_value || '2'} cop bonus ditambah ke kad`)
                          : (birthdayForm.reward_value || (locale === 'en' ? 'Valid during birthday celebration' : 'Sah semasa sambutan hari lahir'))}
                      </Text>
                    </View>

                    {/* Bottom Metadata & Action CTA */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="time-outline" size={12} color="#059669" />
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#059669' }}>
                          {locale === 'en' ? 'Valid: 3 Days' : 'Sah: 3 Hari'}
                        </Text>
                      </View>

                      <View style={{
                        height: 25,
                        borderRadius: 12.5,
                        backgroundColor: '#0F172A',
                        paddingHorizontal: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }} numberOfLines={1}>
                          {locale === 'en' ? 'Use Pass ➔' : 'Tebus Baucar ➔'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* PERFORATION NOTCHES & DASHED LINE */}
                  <View style={{ width: 14, alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 3 }} pointerEvents="none">
                    <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, backgroundColor: birthdayBrandColor }} />
                    <View style={{ width: 1, height: '100%', borderColor: '#FFFFFF', borderWidth: 1, borderStyle: 'dashed', zIndex: 1 }} />
                    <View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, top: -7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', zIndex: 2 }} />
                    <View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, bottom: -7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', zIndex: 2 }} />
                  </View>

                  {/* RIGHT STUB: Logo & Merchant Name */}
                  <View style={{
                    width: 86,
                    backgroundColor: birthdayBrandColor,
                    borderTopRightRadius: 16,
                    borderBottomRightRadius: 16,
                    paddingVertical: 10,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: isLightBrand ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.3)',
                      marginBottom: 6,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                      elevation: 2,
                    }}>
                      <Image source={{ uri: merchantLogo }} style={{ width: 38, height: 38, borderRadius: 19, resizeMode: 'cover' }} />
                    </View>
                    <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: brandTextColor, textAlign: 'center', width: '100%', letterSpacing: 0.3 }} numberOfLines={2}>
                      {(merchant?.name || 'STORE').toUpperCase()}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2.5, marginTop: 4, opacity: 0.85 }}>
                      <Ionicons name="barcode-outline" size={10} color={brandTextColor} />
                      <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_800ExtraBold', color: brandTextColor, letterSpacing: 0.6 }}>
                        PASS
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 3. APPLE GROUPED LIST CONFIGURATION (IMAGE 1 EXACT DESIGN) */}
              <View style={[styles.configCard, { padding: 16, backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0, paddingHorizontal: 0, marginTop: 4 }]}>
                {loadingBirthday ? (
                  <ActivityIndicator size="small" color="#050505" style={{ marginVertical: 20 }} />
                ) : (
                  <>
                    {/* Header with Title and Automation Toggle */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 }}>
                      <View>
                        <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', letterSpacing: -0.2 }}>
                          {locale === 'en' ? 'Birthday Pass Automation' : 'Automasi Baucar Hari Lahir'}
                        </Text>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                          {locale === 'en' ? 'Automated in-wallet delivery on customer birthdays' : 'Dihantar automatik pada pagi hari lahir'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: birthdayForm.is_active ? '#059669' : '#64748B' }}>
                          {birthdayForm.is_active ? (locale === 'en' ? 'Active' : 'Aktif') : (locale === 'en' ? 'Paused' : 'Dijeda')}
                        </Text>
                        <Switch
                          value={birthdayForm.is_active}
                          onValueChange={(val) => setBirthdayForm((f) => ({ ...f, is_active: val }))}
                          trackColor={{ false: '#E2E8F0', true: '#000000' }}
                          thumbColor="#FFFFFF"
                          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                      </View>
                    </View>

                    {/* SECTION 1: REWARD TYPE ROW (IMAGE 1 EXACT) */}
                    <View style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 3,
                      elevation: 1,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                          {locale === 'en' ? 'Reward Type' : 'Jenis Ganjaran'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setHelpModalInfo({
                            title: locale === 'en' ? 'Reward Type' : 'Jenis Ganjaran',
                            desc: locale === 'en'
                              ? 'Choose between issuing a digital Voucher Pass for checkout redemption or crediting bonus loyalty stamps directly to the customer card.'
                              : 'Pilih antara memberi Baucar Hadiah digital untuk ditebus di kaunter, atau cop bonus dimasukkan terus ke kad pelanggan.',
                          })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="help-circle-outline" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>

                      <View style={{
                        flexDirection: 'row',
                        backgroundColor: '#F1F5F9',
                        borderRadius: 9999,
                        padding: 3,
                        gap: 3,
                      }}>
                        {[
                          { id: 'voucher_code', icon: 'gift-outline', label: locale === 'en' ? 'Voucher' : 'Baucar' },
                          { id: 'stamps', icon: 'star-outline', label: locale === 'en' ? 'Stamps' : 'Cop' },
                        ].map((t) => {
                          const isSelected = birthdayForm.reward_type === t.id;
                          return (
                            <TouchableOpacity
                              key={t.id}
                              onPress={() => {
                                const newType = t.id as any;
                                setBirthdayForm((f) => ({
                                  ...f,
                                  reward_type: newType,
                                  title: newType === 'stamps' ? '2 Bonus Stamps' : (f.title || 'Free Birthday Treat'),
                                  reward_value: newType === 'stamps' ? '2' : (f.reward_value || 'Free Birthday Item'),
                                }));
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 9999,
                                backgroundColor: isSelected ? '#000000' : 'transparent',
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name={t.icon as any} size={13} color={isSelected ? '#FFFFFF' : '#64748B'} />
                              <Text style={{
                                fontSize: 11.5,
                                fontFamily: isSelected ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                                color: isSelected ? '#FFFFFF' : '#64748B',
                              }}>
                                {t.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* SECTION 2: GIFT OFFER ROW (IMAGE 1 EXACT) */}
                    <View style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                          {birthdayForm.reward_type === 'stamps'
                            ? (locale === 'en' ? 'Bonus Stamps' : 'Cop Bonus')
                            : (locale === 'en' ? 'Gift Offer' : 'Tawaran Hadiah')}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setHelpModalInfo({
                            title: birthdayForm.reward_type === 'stamps'
                              ? (locale === 'en' ? 'Bonus Stamps Quantity' : 'Bilangan Cop')
                              : (locale === 'en' ? 'Gift Offer' : 'Tawaran Hadiah'),
                            desc: birthdayForm.reward_type === 'stamps'
                              ? (locale === 'en' ? 'Number of stamps added directly to customer card on their birthday.' : 'Bilangan cop bonus dimasukkan ke kad pelanggan.')
                              : (locale === 'en' ? 'Select a product or service from your menu to offer as a birthday gift.' : 'Pilih produk atau servis dari menu anda untuk dihadiahkan.'),
                          })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="help-circle-outline" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          padding: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                        }}
                        onPress={() => {
                          if (birthdayForm.reward_type === 'stamps') {
                            setShowStampsPicker(true);
                          } else {
                            setManualGiftInput(selectedBirthdayItem?.name || birthdayForm.title || '');
                            setManualGiftDescInput(selectedBirthdayItem?.description || birthdayForm.description || '');
                            setBirthdayGiftMode(selectedBirthdayItem && isPro ? 'catalog' : 'manual');
                            setShowBirthdayItemPicker(true);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                          {birthdayForm.reward_type === 'stamps' ? (
                            <View style={{ width: 52, height: 44, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="star" size={22} color="#D97706" />
                            </View>
                          ) : selectedBirthdayItem ? (
                            <View style={{ width: 52, height: 44, borderRadius: 10, backgroundColor: '#F1F5F9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                              <Image
                                source={{
                                  uri: (selectedBirthdayItem?.image ? pb.files.getUrl(selectedBirthdayItem, selectedBirthdayItem.image) : (selectedBirthdayItem?.photo ? pb.files.getUrl(selectedBirthdayItem, selectedBirthdayItem.photo) : null)) ||
                                    'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=240'
                                }}
                                style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                              />
                            </View>
                          ) : (
                            <View style={{ width: 52, height: 44, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="gift" size={22} color="#D97706" />
                            </View>
                          )}

                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }} numberOfLines={1}>
                              {selectedBirthdayItem?.name || birthdayForm.title || (birthdayForm.reward_type === 'stamps' ? '2 Bonus Stamps' : (locale === 'en' ? 'Select or Type a Gift' : 'Pilih atau Taip Hadiah'))}
                            </Text>
                            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                              {birthdayForm.reward_type === 'stamps'
                                ? (locale === 'en' ? `${birthdayForm.reward_value || '2'} stamps auto-credited` : `${birthdayForm.reward_value || '2'} cop dikreditkan`)
                                : (selectedBirthdayItem
                                    ? `Linked menu item · RM${Number(selectedBirthdayItem.price || 0).toFixed(0)}`
                                    : (birthdayForm.description || (locale === 'en' ? 'Custom gift voucher' : 'Baucar hadiah tersuai')))}
                            </Text>
                          </View>
                        </View>

                        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {/* SECTION 3: VALIDITY WINDOW ROW (IMAGE 1 EXACT) */}
                    <View style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                          {locale === 'en' ? 'Validity Window' : 'Tempoh Sah'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setHelpModalInfo({
                            title: locale === 'en' ? 'Validity Window' : 'Tempoh Sah',
                            desc: locale === 'en'
                              ? 'Determines how many days the customer has to claim their birthday treat.'
                              : 'Berapa hari pelanggan boleh menggunakan baucar hari lahir mereka.',
                          })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="help-circle-outline" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          padding: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                        }}
                        onPress={() => setShowValidityPicker(true)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                          <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="calendar-outline" size={24} color="#0F172A" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                              {birthdayForm.expiry_days === '7'
                                ? (locale === 'en' ? '7 Days' : '7 Hari')
                                : (birthdayForm.expiry_days === '30'
                                    ? (locale === 'en' ? '30 Days' : '30 Hari')
                                    : (locale === 'en' ? '3 Days' : '3 Hari'))}
                            </Text>
                            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                              {birthdayForm.expiry_days === '7'
                                ? (locale === 'en' ? '3 days before · Birthday · 3 days after' : '3 hari sebelum · Hari lahir · 3 hari selepas')
                                : (birthdayForm.expiry_days === '30'
                                    ? (locale === 'en' ? 'Entire customer birthday month' : 'Sepanjang bulan hari lahir')
                                    : (locale === 'en' ? 'Day before · Birthday · Day after' : 'Hari sebelum · Hari lahir · Hari selepas'))}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {/* SECTION 4: SEND SCHEDULE ROW (IMAGE 1 EXACT) */}
                    <View style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                          {locale === 'en' ? 'Send Schedule' : 'Waktu Hantar'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setHelpModalInfo({
                            title: locale === 'en' ? 'Send Schedule' : 'Waktu Hantar',
                            desc: locale === 'en'
                              ? 'Automated delivery time when the birthday notification is delivered to the customer wallet.'
                              : 'Waktu automatik bila notifikasi dihantar ke pelanggan.',
                          })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="help-circle-outline" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          padding: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                        }}
                        onPress={() => setShowSchedulePicker(true)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                          <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="time-outline" size={24} color="#0F172A" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                              {birthdayForm.send_time ? `${birthdayForm.send_time} ${Number(birthdayForm.send_time.split(':')[0]) >= 12 ? 'PM' : 'AM'}` : '09:00 AM'}
                            </Text>
                            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                              {locale === 'en' ? "Send on customer's birthday · Store local time" : "Dihantar pada hari lahir · Waktu tempatan"}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {/* SECTION 5: REDEMPTION RULES ROW (IMAGE 1 EXACT) */}
                    <View style={{ marginBottom: 20 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                          {locale === 'en' ? 'Redemption Rules' : 'Syarat Penebusan'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setHelpModalInfo({
                            title: locale === 'en' ? 'Redemption Rules' : 'Syarat Penebusan',
                            desc: locale === 'en'
                              ? 'Security and anti-fraud rules applied to birthday passes.'
                              : 'Syarat keselamatan dan pencegahan penipuan baucar.',
                          })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="help-circle-outline" size={15} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          padding: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                        }}
                        onPress={() => setShowRulesModal(true)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                          <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="document-text-outline" size={24} color="#0F172A" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                              {locale === 'en' ? 'Standard rules' : 'Syarat standard'}
                            </Text>
                            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                              {locale === 'en' ? 'Once per customer, per birthday year' : 'Sekali bagi setiap pelanggan, setiap tahun'}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {/* Primary Save Action Button (IMAGE 1 EXACT CAPSULE) */}
                    <TouchableOpacity
                      style={[{
                        backgroundColor: '#000000',
                        height: 50,
                        borderRadius: 9999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.15,
                        shadowRadius: 6,
                        elevation: 3,
                      }, savingBirthday && { opacity: 0.6 }]}
                      onPress={handleSaveBirthday}
                      disabled={savingBirthday}
                      activeOpacity={0.8}
                    >
                      {savingBirthday ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                          {locale === 'en' ? 'Save Changes' : 'Simpan Perubahan'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })()}
        </ScrollView>



      {/* Save Reward Full Page Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom', 'left', 'right']}>
          {/* Top Full-Page Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0, 0, 0, 0.06)',
            backgroundColor: '#FFFFFF',
          }}>
            {/* Left Balance Spacer */}
            <View style={{ width: 40 }} />

            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                {editingReward ? (locale === 'en' ? 'Edit Reward' : 'Sunting Ganjaran') : (locale === 'en' ? 'Create Reward' : 'Cipta Ganjaran')}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                {locale === 'en' ? 'Catalog Voucher Setup' : 'Tetapan Baucar Katalog'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={20} color="#000000" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
            keyboardShouldPersistTaps="handled"
          >

              {/* 🎫 Live Customer Ticket Voucher Preview */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#64748B', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                  Live Customer Voucher Preview
                </Text>
                {(() => {
                  const modalBrandColor = merchant?.onboarding_primary_color || merchant?.pwa_brand_color || merchant?.brand_color || cardColor || '#050505';
                  const isLightModalBrand = (() => {
                    const hex = (modalBrandColor || '#050505').replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16) || 0;
                    const g = parseInt(hex.substring(2, 4), 16) || 0;
                    const b = parseInt(hex.substring(4, 6), 16) || 0;
                    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
                    return yiq >= 160;
                  })();
                  const modalBrandTextColor = isLightModalBrand ? '#0F172A' : '#FFFFFF';

                  return (
                    <View style={{
                      height: 155,
                      borderRadius: 16,
                      backgroundColor: '#FFFFFF',
                      flexDirection: 'row',
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.08,
                      shadowRadius: 8,
                      elevation: 4,
                      position: 'relative',
                    }}>
                      {/* 1. LEFT STUB: Voucher Category Color Spine (Standardized to Merchant Brand Color) */}
                      {(() => {
                        const spineTheme = getVoucherSpineTheme(formCampaignType || formType, formTitle, modalBrandColor);
                        return (
                          <View style={{
                            width: 42,
                            backgroundColor: modalBrandColor,
                            alignItems: 'center',
                            position: 'relative',
                            borderTopLeftRadius: 16,
                            borderBottomLeftRadius: 16,
                            overflow: 'hidden',
                          }}>
                            <View style={{
                              width: 155,
                              height: 42,
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              marginLeft: -77.5,
                              marginTop: -21,
                              transform: [{ rotate: '-90deg' }],
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: modalBrandTextColor, letterSpacing: 0.8, textAlign: 'center' }} numberOfLines={1}>
                                {spineTheme.spineText}
                              </Text>
                              <Text style={{ fontSize: 6.5, fontFamily: 'PlusJakartaSans_700Bold', color: modalBrandTextColor, opacity: 0.85, letterSpacing: 1.2, marginTop: 1 }}>
                                {spineTheme.subText}
                              </Text>
                            </View>
                          </View>
                        );
                      })()}

                      {/* 2. CENTER ZONE: Reward Information on Pure White */}
                      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'space-between' }}>
                        {/* Top Row: Ready to redeem pill + Discount tag */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3.5 }}>
                            <Ionicons name="gift" size={10} color="#B45309" />
                            <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>Ready to redeem</Text>
                          </View>

                          <View style={{
                            backgroundColor: formType === 'discount' ? '#0F172A' : '#FFCC00',
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}>
                            <Text style={{
                              fontSize: 8,
                              fontFamily: 'PlusJakartaSans_800ExtraBold',
                              color: formType === 'discount' ? '#FFFFFF' : '#050505',
                              letterSpacing: 0.5,
                            }}>
                              {formType === 'discount' ? (formDiscountValue ? (formDiscountType === 'percentage' ? `${formDiscountValue}% OFF` : `RM ${formDiscountValue} OFF`) : 'DISCOUNT') : 'FREE ITEM'}
                            </Text>
                          </View>
                        </View>

                        {/* Middle: YOUR REWARD + Title + Description */}
                        <View style={{ marginVertical: 1 }}>
                          <Text style={{ fontSize: 8, fontFamily: 'PlusJakartaSans_700Bold', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 1, textTransform: 'uppercase' }}>
                            YOUR REWARD
                          </Text>
                          <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.2, lineHeight: 18 }} numberOfLines={2}>
                            {formTitle || 'FREE AISKRIM Premium 3 scoop'}
                          </Text>
                          <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#6B7280', marginTop: 1, lineHeight: 14 }} numberOfLines={1}>
                            {formDesc || (
                              formType === 'discount'
                                ? (formDiscountType === 'percentage'
                                    ? `${formDiscountValue || 'XX'}% OFF${formDiscountScope === 'specific' && formApplicableItemsText ? ` (${formApplicableItemsText})` : ' offer'}`
                                    : `RM ${formDiscountValue || 'XX'} OFF${formDiscountScope === 'specific' && formApplicableItemsText ? ` (${formApplicableItemsText})` : ' offer'}`)
                                : (formApplicableItemsText
                                    ? `${formFreeQty && Number(formFreeQty) > 1 ? `${formFreeQty}x ` : ''}${formApplicableItemsText}`
                                    : 'Reward for completing store card')
                            )}
                          </Text>
                        </View>

                        {/* Bottom Row: Source Pill & Stock + Use Voucher Button */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Ionicons name="card" size={8.5} color="#059669" />
                              <Text style={{ fontSize: 7.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#059669', letterSpacing: 0.3 }}>STAMP REWARD</Text>
                            </View>
                            <Text style={{ fontSize: 9, color: '#CBD5E1' }}>|</Text>
                            <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                              Stock: <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981' }}>{formStock || 'Unlimited'}</Text>
                            </Text>
                          </View>

                          {/* Customer CTA Button */}
                          <View style={{ height: 24, borderRadius: 12, backgroundColor: '#0F172A', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }} numberOfLines={1}>Use Voucher ➔</Text>
                          </View>
                        </View>
                      </View>

                      {/* 3. PERFORATION COLUMN */}
                      <View style={{
                        width: 16,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'relative',
                        zIndex: 3,
                      }} pointerEvents="none">
                        <View style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 8,
                          backgroundColor: modalBrandColor,
                        }} />
                        <View style={{
                          width: 1,
                          height: '100%',
                          borderColor: '#FFFFFF',
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          zIndex: 1,
                        }} />
                        <View style={{
                          position: 'absolute',
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          top: -8,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          zIndex: 2,
                        }} />
                        <View style={{
                          position: 'absolute',
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          bottom: -8,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          zIndex: 2,
                        }} />
                      </View>

                      {/* 4. RIGHT STUB */}
                      <View style={{
                        width: 95,
                        backgroundColor: modalBrandColor,
                        borderTopRightRadius: 16,
                        borderBottomRightRadius: 16,
                        paddingVertical: 10,
                        paddingHorizontal: 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <View style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderColor: isLightModalBrand ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.3)',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.12,
                          shadowRadius: 3,
                          elevation: 2,
                          marginBottom: 6,
                        }}>
                          <Image source={{ uri: merchantLogo }} style={{ width: 42, height: 42, borderRadius: 21, resizeMode: 'cover' }} />
                        </View>
                        <Text style={{
                          fontSize: 10,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: modalBrandTextColor,
                          textAlign: 'center',
                          width: '100%',
                          letterSpacing: 0.3,
                        }} numberOfLines={2}>
                          {(merchant?.name || 'STORE').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Title Input */}
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                {locale === 'en' ? 'Reward title ' : 'Tajuk ganjaran '}
                <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 16, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                <Ionicons name="gift-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.nestedTextInput}
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder={locale === 'en' ? "e.g. Free Double Scoop" : "cth. Aiskrim Double Scoop Percuma"}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Reward Type Toggle */}
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                {locale === 'en' ? 'Reward type' : 'Jenis ganjaran'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, padding: 4, borderRadius: 16, backgroundColor: '#F1F5F9', marginBottom: 16 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: formType === 'free_item' ? '#FFFBEB' : 'transparent',
                    borderWidth: formType === 'free_item' ? 1.5 : 0,
                    borderColor: formType === 'free_item' ? '#F59E0B' : 'transparent',
                  }}
                  onPress={() => setFormType('free_item')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="gift" size={16} color={formType === 'free_item' ? '#D97706' : '#64748B'} />
                  <Text style={{ color: formType === 'free_item' ? '#92400E' : '#475569', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 }}>
                    {locale === 'en' ? 'Free item' : 'Item percuma'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: formType === 'discount' ? '#FFFBEB' : 'transparent',
                    borderWidth: formType === 'discount' ? 1.5 : 0,
                    borderColor: formType === 'discount' ? '#F59E0B' : 'transparent',
                  }}
                  onPress={() => setFormType('discount')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pricetag" size={16} color={formType === 'discount' ? '#D97706' : '#64748B'} />
                  <Text style={{ color: formType === 'discount' ? '#92400E' : '#475569', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 }}>
                    {locale === 'en' ? 'Discount' : 'Diskaun'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* PRO Campaign Recipes (8 Formula Pintar) */}
              <View style={{
                borderRadius: 18,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                padding: 14,
                marginBottom: 20,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="diamond" size={16} color="#B45309" />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1E293B' }}>
                      {locale === 'en' ? 'PRO Campaign Recipes' : 'Formula Kempen Pintar PRO'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      if (!isPro) setShowUpgradeModal(true);
                    }}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2.5,
                      borderRadius: 999,
                      backgroundColor: isPro ? '#000000' : '#FEF3C7',
                      borderWidth: 1,
                      borderColor: isPro ? '#000000' : '#F59E0B',
                    }}
                  >
                    <Text style={{
                      fontSize: 9.5,
                      fontFamily: 'PlusJakartaSans_800ExtraBold',
                      color: isPro ? '#FFCC00' : '#B45309',
                      letterSpacing: 0.5,
                    }}>
                      {isPro ? 'PRO UNLOCKED' : '🔒 PRO ONLY'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', lineHeight: 16, marginBottom: 12 }}>
                  {locale === 'en'
                    ? 'Pre-built promotion formulas to boost footfall, fill off-peak hours, or bring back quiet customers.'
                    : 'Formula promosi siap-pakai untuk lonjakkan jualan, penuhkan waktu lengang, atau panggil pelanggan sepi.'}
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {PRO_CAMPAIGN_RECIPES.map((recipe) => {
                    const isSelected = formCampaignType === recipe.id;
                    return (
                      <TouchableOpacity
                        key={recipe.id}
                        style={{
                          width: '48%',
                          flexGrow: 1,
                          padding: 10,
                          borderRadius: 14,
                          backgroundColor: isSelected ? '#000000' : '#FFFFFF',
                          borderWidth: 1.5,
                          borderColor: isSelected ? '#000000' : '#E2E8F0',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                          justifyContent: 'space-between',
                          minHeight: 82,
                        }}
                        onPress={() => handleSelectRecipe(recipe)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <View style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : `${recipe.color}15`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Ionicons name={recipe.icon as any} size={15} color={isSelected ? '#FFCC00' : recipe.color} />
                          </View>
                          <View style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${recipe.color}15`,
                          }}>
                            <Text style={{
                              fontSize: 8,
                              fontFamily: 'PlusJakartaSans_800ExtraBold',
                              color: isSelected ? '#FFCC00' : recipe.color,
                              letterSpacing: 0.3,
                            }}>
                              {!isPro ? '🔒 PRO' : recipe.tag}
                            </Text>
                          </View>
                        </View>

                        <Text style={{
                          fontSize: 11.5,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: isSelected ? '#FFFFFF' : '#1E293B',
                          marginBottom: 2,
                        }} numberOfLines={1}>
                          {recipe.name}
                        </Text>
                        <Text style={{
                          fontSize: 9.5,
                          fontFamily: 'PlusJakartaSans_500Medium',
                          color: isSelected ? '#94A3B8' : '#64748B',
                          lineHeight: 13,
                        }} numberOfLines={2}>
                          {recipe.desc}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Dynamic PRO Campaign Smart Controls (if active) */}
              {formCampaignType && (() => {
                const activeRecipe = PRO_CAMPAIGN_RECIPES.find(r => r.id === formCampaignType);
                if (!activeRecipe) return null;

                return (
                  <View style={{
                    borderRadius: 18,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: '#000000',
                    padding: 14,
                    marginBottom: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                  }}>
                    {/* Header: Recipe badge + Clear button */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: activeRecipe.color,
                        }}>
                          <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: 0.5 }}>
                            {activeRecipe.tag}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1E293B' }}>
                          {activeRecipe.name}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => setFormCampaignType(null)}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9' }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                          {locale === 'en' ? '✕ Reset Formula' : '✕ Batal Formula'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Controls based on specific recipe */}
                    {formCampaignType === 'happy_hour' && (
                      <View>
                        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569', marginBottom: 6 }}>
                          {locale === 'en' ? 'Quick Time Presets:' : 'Pilihan Waktu Lengang Pantas:'}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {[
                            { label: '2:00 PM – 5:00 PM', timeStr: 'Sah 2:00 PM – 5:00 PM' },
                            { label: '3:00 PM – 6:00 PM', timeStr: 'Sah 3:00 PM – 6:00 PM' },
                            { label: '11:00 AM – 2:00 PM', timeStr: 'Sah 11:00 AM – 2:00 PM' },
                          ].map((preset) => {
                            const isSlotActive = formApplicableItemsText.includes(preset.label);
                            return (
                              <TouchableOpacity
                                key={preset.label}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  backgroundColor: isSlotActive ? '#7C3AED' : '#F1F5F9',
                                  borderWidth: 1,
                                  borderColor: isSlotActive ? '#7C3AED' : '#E2E8F0',
                                }}
                                onPress={() => {
                                  const dayPart = formApplicableItemsText.includes('Isnin') ? ' (Isnin–Khamis)' : (formApplicableItemsText.includes('Mon') ? ' (Mon-Thu)' : '');
                                  setFormApplicableItemsText(`${preset.timeStr}${dayPart}`);
                                }}
                                activeOpacity={0.8}
                              >
                                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: isSlotActive ? '#FFFFFF' : '#475569' }}>
                                  {preset.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569', marginBottom: 6 }}>
                          {locale === 'en' ? 'Valid Days:' : 'Hari Sah Digunakan:'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {[
                            { label: 'Isnin – Khamis', enLabel: 'Mon – Thu', suffix: ' (Isnin–Khamis)' },
                            { label: 'Isnin – Jumaat', enLabel: 'Mon – Fri', suffix: ' (Isnin–Jumaat)' },
                            { label: 'Setiap Hari', enLabel: 'Daily', suffix: ' (Setiap Hari)' },
                          ].map((dayPreset) => {
                            const label = locale === 'en' ? dayPreset.enLabel : dayPreset.label;
                            const isDayActive = formApplicableItemsText.includes(dayPreset.label) || formApplicableItemsText.includes(dayPreset.enLabel);
                            return (
                              <TouchableOpacity
                                key={dayPreset.label}
                                style={{
                                  flex: 1,
                                  alignItems: 'center',
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  backgroundColor: isDayActive ? '#000000' : '#F1F5F9',
                                  borderWidth: 1,
                                  borderColor: isDayActive ? '#000000' : '#E2E8F0',
                                }}
                                onPress={() => {
                                  const baseTime = formApplicableItemsText.split('(')[0].trim() || 'Sah 2:00 PM – 5:00 PM';
                                  setFormApplicableItemsText(`${baseTime}${dayPreset.suffix}`);
                                }}
                                activeOpacity={0.8}
                              >
                                <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_700Bold', color: isDayActive ? '#FFCC00' : '#475569' }}>
                                  {label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {formCampaignType === 'flash_sale' && (
                      <View>
                        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569', marginBottom: 6 }}>
                          {locale === 'en' ? 'Limited-time deal duration:' : 'Tempoh tawaran kilat:'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                          {[
                            { label: '⚡ 24 Jam', val: '24' },
                            { label: '⚡ 48 Jam', val: '48' },
                            { label: '⚡ 3 Hari', val: '72' },
                          ].map((d) => (
                            <TouchableOpacity
                              key={d.val}
                              style={{
                                flex: 1,
                                alignItems: 'center',
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: '#000000',
                              }}
                              onPress={() => {
                                if (!formDesc) setFormDesc(`Tamat dalam tempoh ${d.label}. Terhad selagi stok masih ada!`);
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFCC00' }}>
                                {d.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                          {locale === 'en' ? 'Live countdown timer will be displayed prominently on customer vouchers.' : 'Jam undur langsung akan dipaparkan dengan jelas pada baucar pelanggan.'}
                        </Text>
                      </View>
                    )}

                    {formCampaignType === 'spend_save' && (
                      <View style={{ backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0' }}>
                        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#166534', marginBottom: 2 }}>
                          {locale === 'en' ? 'Spend & Save Summary' : 'Rumusan Belanja & Jimat'}
                        </Text>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#15803D' }}>
                          {locale === 'en'
                            ? `Spend min RM ${formMinSpend || '50'} ➔ Save RM ${formDiscountValue || '10'} immediately.`
                            : `Belanja minima RM ${formMinSpend || '50'} ➔ Jimat RM ${formDiscountValue || '10'} serta-merta.`}
                        </Text>
                      </View>
                    )}

                    {['bogo', 'welcome_gift', 'bring_friend', 'win_back', 'festive'].includes(formCampaignType) && (
                      <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#334155' }}>
                          {activeRecipe.desc}. {locale === 'en' ? 'Parameters are auto-configured below.' : 'Parameter di bawah telah dilaraskan secara pintar.'}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Dynamic Inputs based on Reward Type */}
              {formType === 'free_item' ? (
                <View style={{ marginBottom: 16 }}>
                  {/* Free Item Name / Specific Details */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Free item details (optional)' : 'Nama item percuma / perincian (pilihan)'}
                  </Text>
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 4, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name="gift-outline" size={18} color="#D97706" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.nestedTextInput}
                      value={formApplicableItemsText}
                      onChangeText={setFormApplicableItemsText}
                      placeholder={locale === 'en' ? "e.g. 1x Iced Latte / 3x Curry Puffs" : "Contoh: 1x Kopi O Ais / Karipap 3 Ketul / Servis Cuci Luar"}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 14, marginLeft: 2 }}>
                    {locale === 'en' ? 'What the customer physically receives when claiming at the counter.' : 'Nama item fizikal atau servis yang akan diterima pelanggan apabila menuntut di kaunter.'}
                  </Text>

                  {/* Quantity */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Quantity' : 'Kuantiti'}
                  </Text>
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name="cube-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.nestedTextInput}
                      value={formFreeQty}
                      onChangeText={setFormFreeQty}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              ) : (
                <View style={{ marginBottom: 16 }}>
                  {/* Discount Type */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Discount type' : 'Jenis diskaun'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor: formDiscountType === 'percentage' ? '#FEF3C7' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: formDiscountType === 'percentage' ? '#F59E0B' : '#E2E8F0',
                      }}
                      onPress={() => setFormDiscountType('percentage')}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: formDiscountType === 'percentage' ? '#B45309' : '#64748B' }}>
                        Percentage (%)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor: formDiscountType === 'fixed_amount' ? '#FEF3C7' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: formDiscountType === 'fixed_amount' ? '#F59E0B' : '#E2E8F0',
                      }}
                      onPress={() => setFormDiscountType('fixed_amount')}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: formDiscountType === 'fixed_amount' ? '#B45309' : '#64748B' }}>
                        Fixed Amount (RM)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {formDiscountType === 'percentage' ? 'Discount percentage (%) *' : 'Discount amount (RM) *'}
                  </Text>
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name={formDiscountType === 'percentage' ? 'pricetag-outline' : 'cash-outline'} size={18} color="#64748B" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.nestedTextInput}
                      value={formDiscountValue}
                      onChangeText={setFormDiscountValue}
                      keyboardType="decimal-pad"
                      placeholder={formDiscountType === 'percentage' ? "e.g. 20" : "e.g. 10"}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Discount Scope (Semua Pesanan vs Item Khusus) */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Discount applies to' : 'Skop diskaun (Sah untuk)'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                        backgroundColor: formDiscountScope === 'all' ? '#000000' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: formDiscountScope === 'all' ? '#000000' : '#E2E8F0',
                      }}
                      onPress={() => setFormDiscountScope('all')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cart" size={14} color={formDiscountScope === 'all' ? '#FFCC00' : '#64748B'} />
                      <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: formDiscountScope === 'all' ? '#FFCC00' : '#475569' }}>
                        {locale === 'en' ? 'All Items (Whole Bill)' : 'Semua Pesanan (Seluruh Bil)'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                        backgroundColor: formDiscountScope === 'specific' ? '#000000' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: formDiscountScope === 'specific' ? '#000000' : '#E2E8F0',
                      }}
                      onPress={() => setFormDiscountScope('specific')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="pricetags" size={14} color={formDiscountScope === 'specific' ? '#FFCC00' : '#64748B'} />
                      <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: formDiscountScope === 'specific' ? '#FFCC00' : '#475569' }}>
                        {locale === 'en' ? 'Specific Items Only' : 'Item / Menu Khusus'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {formDiscountScope === 'specific' ? (
                    <View style={{ marginBottom: 14 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                        {locale === 'en' ? 'Applicable items / terms *' : 'Nama produk / terma item khusus *'}
                      </Text>
                      <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                        <Ionicons name="pricetag" size={16} color="#D97706" style={{ marginRight: 10 }} />
                        <TextInput
                          style={styles.nestedTextInput}
                          value={formApplicableItemsText}
                          onChangeText={setFormApplicableItemsText}
                          placeholder={locale === 'en' ? "e.g. Valid for beverages only" : "Contoh: Sah untuk minuman sahaja / Menu sarapan"}
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, marginLeft: 2 }}>
                        {locale === 'en' ? 'This term will be displayed on customer vouchers & staff counter screen.' : 'Terma ini akan dipaparkan dengan jelas pada baucar pelanggan & skrin kaunter staf.'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>
                        💡 {locale === 'en' ? 'Discount will apply to the customer’s total checkout bill at the counter.' : 'Diskaun akan dipotong terus daripada jumlah keseluruhan bil semasa bayaran di kaunter.'}
                      </Text>
                    </View>
                  )}

                  {/* Minimum spend (optional) */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Minimum spend (RM) (optional)' : 'Belanja minimum (RM) (pilihan)'}
                  </Text>
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 12, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name="cart-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.nestedTextInput}
                      value={formMinSpend}
                      onChangeText={setFormMinSpend}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 50"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Maximum discount cap (optional) */}
                  {formDiscountType === 'percentage' && (
                    <>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                        {locale === 'en' ? 'Maximum discount cap (RM) (optional)' : 'Had diskaun maksimum (RM) (pilihan)'}
                      </Text>
                      <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                        <Ionicons name="trending-down-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                        <TextInput
                          style={styles.nestedTextInput}
                          value={formMaxDiscount}
                          onChangeText={setFormMaxDiscount}
                          keyboardType="decimal-pad"
                          placeholder="e.g. 30"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Description / Terms Input */}
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                {locale === 'en' ? 'Description / terms (optional)' : 'Keterangan / terma (pilihan)'}
              </Text>
              <View style={[styles.inputWrapper, { height: 72, borderRadius: 14, alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10, marginBottom: 16, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                <Ionicons name="document-text-outline" size={18} color="#64748B" style={{ marginRight: 10, marginTop: 2 }} />
                <TextInput
                  style={styles.nestedTextInputMultiline}
                  value={formDesc}
                  onChangeText={setFormDesc}
                  placeholder={locale === 'en' ? "Present voucher at the counter before payment." : "Tunjukkan baucar di kaunter sebelum membuat pembayaran."}
                  placeholderTextColor="#94A3B8"
                  multiline
                />
              </View>

              {/* Stock Input */}
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                {locale === 'en' ? 'Stock availability (optional)' : 'Ketersediaan stok (pilihan)'}
              </Text>
              <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 4, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                <Ionicons name="cube-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.nestedTextInput}
                  value={formStock}
                  onChangeText={setFormStock}
                  keyboardType="number-pad"
                  placeholder="50"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 16, marginLeft: 2 }}>
                {locale === 'en' ? 'Leave blank for unlimited.' : 'Biarkan kosong untuk tanpa had.'}
              </Text>

              {/* Publish Switch */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 14,
                borderRadius: 18,
                backgroundColor: '#F8FAFC',
                borderColor: '#E2E8F0',
                borderWidth: 1,
                marginBottom: 20,
              }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B' }}>
                    {locale === 'en' ? 'Publish reward' : 'Terbitkan ganjaran'}
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                    {locale === 'en' ? 'Make this reward active and visible to customers immediately.' : 'Jadikan ganjaran ini aktif dan boleh dilihat oleh pelanggan serta-merta.'}
                  </Text>
                </View>
                <Switch
                  value={formIsActive}
                  onValueChange={setFormIsActive}
                  trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

          </ScrollView>

          {/* Sticky Bottom Action Bar */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: 'rgba(0, 0, 0, 0.08)',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 24 : 16,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.06,
            shadowRadius: 10,
            elevation: 8,
            flexDirection: 'row',
            gap: 12,
          }}>
            <TouchableOpacity
              style={{
                width: 90,
                height: 52,
                borderRadius: 999,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#000000', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 }}>
                {locale === 'en' ? 'Cancel' : 'Batal'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                height: 52,
                borderRadius: 999,
                backgroundColor: '#000000',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
              }}
              onPress={handleSaveReward}
              disabled={isSavingReward}
              activeOpacity={0.85}
            >
              {isSavingReward ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFCC00" />
                  <Text style={{ color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15 }}>
                    {editingReward ? (locale === 'en' ? 'Save Changes' : 'Simpan Perubahan') : (locale === 'en' ? 'Create Reward' : 'Cipta Ganjaran')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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

      {/* Interactive 3:4 Image Crop Modal */}
      <Modal
        visible={cropModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCropModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 460, width: '92%', maxHeight: '90%', padding: 0, borderRadius: 24, backgroundColor: '#FFFFFF', overflow: 'hidden', alignItems: 'stretch', gap: 0 }]}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="crop" size={18} color="#2563EB" />
                </View>
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }} numberOfLines={1}>
                  Crop Reward Photo (3:4 Ratio)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCropModalVisible(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Modal Content */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              {/* Resolution Check Warning Banner */}
              {cropImageDimensions && (
                cropImageDimensions.width < 600 || cropImageDimensions.height < 800 ? (
                  <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 14, padding: 12, marginBottom: 14 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#991B1B', marginBottom: 3 }}>
                      ⚠️ Low Resolution Image ({cropImageDimensions.width} x {cropImageDimensions.height} px)
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#7F1D1D', lineHeight: 16 }}>
                      Recommended upload size is 900 x 1200 px (min 600 x 800 px). Image may appear pixelated on customer vouchers.
                    </Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 14, padding: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#065F46' }}>
                      Excellent Resolution ({cropImageDimensions.width} x {cropImageDimensions.height} px)
                    </Text>
                  </View>
                )
              )}

              {/* 3:4 Crop Frame Box */}
              <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 8 }}>
                <View style={{
                  width: 195,
                  height: 260,
                  borderRadius: 16,
                  overflow: 'hidden',
                  position: 'relative',
                  borderWidth: 3,
                  borderColor: '#FFC700',
                  backgroundColor: '#0F172A',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 10,
                  elevation: 4,
                }}>
                  {cropImageUri && (
                    <Image
                      source={{ uri: cropImageUri }}
                      style={{
                        width: '100%',
                        height: '100%',
                        transform: [{ scale: cropZoom }],
                      }}
                      resizeMode="cover"
                    />
                  )}
                  {isBgRemoved && (
                    <View style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      backgroundColor: 'rgba(16, 185, 129, 0.95)',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      zIndex: 10,
                    }}>
                      <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
                      <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                        CUTOUT
                      </Text>
                    </View>
                  )}
                  {/* 3:4 Safe Area Guide Lines */}
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: '33.3%', width: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: '66.6%', width: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                  <View style={{ position: 'absolute', left: 0, right: 0, top: '33.3%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                  <View style={{ position: 'absolute', left: 0, right: 0, top: '66.6%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                </View>
              </View>

              {/* 1-Click AI Background Removal Action */}
              <View style={{ marginVertical: 10, width: '100%' }}>
                {isRemovingBg ? (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    backgroundColor: '#F5F3FF',
                    borderWidth: 1.5,
                    borderColor: '#C4B5FD',
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                  }}>
                    <ActivityIndicator size="small" color="#7C3AED" />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#6D28D9' }}>
                      {removeBgProgress || (locale === 'en' ? 'Removing background (AI)...' : 'Membuang latar belakang (AI)...')}
                    </Text>
                  </View>
                ) : isBgRemoved ? (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#ECFDF5',
                    borderWidth: 1.5,
                    borderColor: '#A7F3D0',
                    borderRadius: 14,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="sparkles" size={16} color="#10B981" />
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#065F46' }}>
                        {locale === 'en' ? 'Background Removed!' : 'Latar Belakang Dibuang!'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleUndoRemoveBackground}
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#CBD5E1',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569' }}>
                        {locale === 'en' ? '↺ Undo' : '↺ Asal'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleRemoveBackground}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: '#FAF5FF',
                      borderWidth: 1.5,
                      borderColor: '#DDD6FE',
                      borderRadius: 14,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Ionicons name="sparkles" size={18} color="#7C3AED" />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#7C3AED' }}>
                      {locale === 'en' ? 'Remove Background (1-Click AI)' : 'Buang Background (1-Klik AI)'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Zoom Slider Control */}
              <View style={{ marginVertical: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569' }}>
                    Adjust Zoom
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    {cropZoom.toFixed(1)}x
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity
                    style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => setCropZoom(prev => Math.max(1, prev - 0.2))}
                  >
                    <Ionicons name="remove" size={18} color="#0F172A" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ width: `${((cropZoom - 1) / 1.5) * 100}%`, height: '100%', backgroundColor: '#FFC700' }} />
                  </View>
                  <TouchableOpacity
                    style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => setCropZoom(prev => Math.min(2.5, prev + 0.2))}
                  >
                    <Ionicons name="add" size={18} color="#0F172A" />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Sticky Actions Footer */}
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFFFFF' }}>
              <TouchableOpacity
                style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setCropModalVisible(false)}
              >
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }}
                onPress={performCropAndSave}
              >
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>Confirm 3:4 Crop</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Refined Create Reward Full Page Modal */}
      <Modal
        visible={showInlineCreateModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowInlineCreateModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom', 'left', 'right']}>
          {/* Top Full-Page Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0, 0, 0, 0.06)',
            backgroundColor: '#FFFFFF',
          }}>
            {/* Left Balance Spacer */}
            <View style={{ width: 40 }} />

            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                {locale === 'en' ? 'Create Reward' : 'Cipta Ganjaran'}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                {locale === 'en' ? 'Stamp Reward Setup' : 'Tetapan Ganjaran Cop'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowInlineCreateModal(false)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={20} color="#000000" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 }}
            keyboardShouldPersistTaps="handled"
          >
              {/* 🎫 Live Customer Ticket Voucher Preview */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#64748B', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                  Live Customer Voucher Preview
                </Text>
                {(() => {
                  const modalBrandColor = merchant?.onboarding_primary_color || merchant?.pwa_brand_color || merchant?.brand_color || cardColor || '#050505';
                  const isLightModalBrand = (() => {
                    const hex = (modalBrandColor || '#050505').replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16) || 0;
                    const g = parseInt(hex.substring(2, 4), 16) || 0;
                    const b = parseInt(hex.substring(4, 6), 16) || 0;
                    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
                    return yiq >= 160;
                  })();
                  const modalBrandTextColor = isLightModalBrand ? '#0F172A' : '#FFFFFF';

                  return (
                    <View style={{
                      height: 155,
                      borderRadius: 16,
                      backgroundColor: '#FFFFFF',
                      flexDirection: 'row',
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.08,
                      shadowRadius: 8,
                      elevation: 4,
                      position: 'relative',
                    }}>
                      {/* 1. LEFT STUB: Voucher Category Color Spine (Standardized to Merchant Brand Color) */}
                      {(() => {
                        const spineTheme = getVoucherSpineTheme(inlineCampaignType || inlineType, inlineTitle, modalBrandColor);
                        return (
                          <View style={{
                            width: 42,
                            backgroundColor: modalBrandColor,
                            alignItems: 'center',
                            position: 'relative',
                            borderTopLeftRadius: 16,
                            borderBottomLeftRadius: 16,
                            overflow: 'hidden',
                          }}>
                            <View style={{
                              width: 155,
                              height: 42,
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              marginLeft: -77.5,
                              marginTop: -21,
                              transform: [{ rotate: '-90deg' }],
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: modalBrandTextColor, letterSpacing: 0.8, textAlign: 'center' }} numberOfLines={1}>
                                {spineTheme.spineText}
                              </Text>
                              <Text style={{ fontSize: 6.5, fontFamily: 'PlusJakartaSans_700Bold', color: modalBrandTextColor, opacity: 0.85, letterSpacing: 1.2, marginTop: 1 }}>
                                {spineTheme.subText}
                              </Text>
                            </View>
                          </View>
                        );
                      })()}

                      {/* 2. CENTER ZONE: Reward Information on Pure White */}
                      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'space-between' }}>
                        {/* Top Row: Ready to redeem pill + Discount tag */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3.5 }}>
                            <Ionicons name="gift" size={10} color="#B45309" />
                            <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>Ready to redeem</Text>
                          </View>

                          <View style={{
                            backgroundColor: inlineType === 'discount' ? '#0F172A' : '#FFCC00',
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}>
                            <Text style={{
                              fontSize: 8,
                              fontFamily: 'PlusJakartaSans_800ExtraBold',
                              color: inlineType === 'discount' ? '#FFFFFF' : '#050505',
                              letterSpacing: 0.5,
                            }}>
                              {inlineType === 'discount' ? (inlineDiscountValue ? (inlineDiscountType === 'percentage' ? `${inlineDiscountValue}% OFF` : `RM ${inlineDiscountValue} OFF`) : 'DISCOUNT') : 'FREE ITEM'}
                            </Text>
                          </View>
                        </View>

                        {/* Middle: YOUR REWARD + Title + Description */}
                        <View style={{ marginVertical: 1 }}>
                          <Text style={{ fontSize: 8, fontFamily: 'PlusJakartaSans_700Bold', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 1, textTransform: 'uppercase' }}>
                            YOUR REWARD
                          </Text>
                          <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.2, lineHeight: 18 }} numberOfLines={2}>
                            {inlineTitle || 'FREE AISKRIM Premium 3 scoop'}
                          </Text>
                          <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#6B7280', marginTop: 1, lineHeight: 14 }} numberOfLines={1}>
                            {inlineDesc || (
                              inlineType === 'discount'
                                ? (inlineDiscountType === 'percentage'
                                    ? `${inlineDiscountValue || 'XX'}% OFF${inlineDiscountScope === 'specific' && inlineApplicableItemsText ? ` (${inlineApplicableItemsText})` : ' offer'}`
                                    : `RM ${inlineDiscountValue || 'XX'} OFF${inlineDiscountScope === 'specific' && inlineApplicableItemsText ? ` (${inlineApplicableItemsText})` : ' offer'}`)
                                : (inlineApplicableItemsText
                                    ? `${inlineFreeQty && Number(inlineFreeQty) > 1 ? `${inlineFreeQty}x ` : ''}${inlineApplicableItemsText}`
                                    : 'Reward for completing store card')
                            )}
                          </Text>
                        </View>

                        {/* Bottom Row: Source Pill & Stock + Use Voucher Button */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Ionicons name="card" size={8.5} color="#059669" />
                              <Text style={{ fontSize: 7.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#059669', letterSpacing: 0.3 }}>STAMP REWARD</Text>
                            </View>
                            <Text style={{ fontSize: 9, color: '#CBD5E1' }}>|</Text>
                            <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                              Stock: <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981' }}>{inlineStock || 'Unlimited'}</Text>
                            </Text>
                          </View>

                          {/* Customer CTA Button */}
                          <View style={{ height: 24, borderRadius: 12, backgroundColor: '#0F172A', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }} numberOfLines={1}>Use Voucher ➔</Text>
                          </View>
                        </View>
                      </View>

                      {/* 3. PERFORATION COLUMN */}
                      <View style={{
                        width: 16,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'relative',
                        zIndex: 3,
                      }} pointerEvents="none">
                        <View style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 8,
                          backgroundColor: modalBrandColor,
                        }} />
                        <View style={{
                          width: 1,
                          height: '100%',
                          borderColor: '#FFFFFF',
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          zIndex: 1,
                        }} />
                        <View style={{
                          position: 'absolute',
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          top: -8,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          zIndex: 2,
                        }} />
                        <View style={{
                          position: 'absolute',
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          bottom: -8,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          zIndex: 2,
                        }} />
                      </View>

                      {/* 4. RIGHT STUB */}
                      <View style={{
                        width: 95,
                        backgroundColor: modalBrandColor,
                        borderTopRightRadius: 16,
                        borderBottomRightRadius: 16,
                        paddingVertical: 10,
                        paddingHorizontal: 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <View style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderColor: isLightModalBrand ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.3)',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.12,
                          shadowRadius: 3,
                          elevation: 2,
                          marginBottom: 6,
                        }}>
                          <Image source={{ uri: merchantLogo }} style={{ width: 42, height: 42, borderRadius: 21, resizeMode: 'cover' }} />
                        </View>
                        <Text style={{
                          fontSize: 10,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: modalBrandTextColor,
                          textAlign: 'center',
                          width: '100%',
                          letterSpacing: 0.3,
                        }} numberOfLines={2}>
                          {(merchant?.name || 'STORE').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Title Input */}
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                {locale === 'en' ? 'Reward title ' : 'Tajuk ganjaran '}
                <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 16, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                <Ionicons name="gift-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.nestedTextInput}
                  value={inlineTitle}
                  onChangeText={setInlineTitle}
                  placeholder={locale === 'en' ? "e.g. Free Double Scoop" : "cth. Aiskrim Double Scoop Percuma"}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Reward Type Toggle */}
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                {locale === 'en' ? 'Reward type' : 'Jenis ganjaran'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, padding: 4, borderRadius: 16, backgroundColor: '#F1F5F9', marginBottom: 16 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: inlineType === 'free_item' ? '#FFFBEB' : 'transparent',
                    borderWidth: inlineType === 'free_item' ? 1.5 : 0,
                    borderColor: inlineType === 'free_item' ? '#F59E0B' : 'transparent',
                  }}
                  onPress={() => setInlineType('free_item')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="gift" size={16} color={inlineType === 'free_item' ? '#D97706' : '#64748B'} />
                  <Text style={{ color: inlineType === 'free_item' ? '#92400E' : '#475569', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 }}>
                    {locale === 'en' ? 'Free item' : 'Item percuma'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: inlineType === 'discount' ? '#FFFBEB' : 'transparent',
                    borderWidth: inlineType === 'discount' ? 1.5 : 0,
                    borderColor: inlineType === 'discount' ? '#F59E0B' : 'transparent',
                  }}
                  onPress={() => setInlineType('discount')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pricetag" size={16} color={inlineType === 'discount' ? '#D97706' : '#64748B'} />
                  <Text style={{ color: inlineType === 'discount' ? '#92400E' : '#475569', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 }}>
                    {locale === 'en' ? 'Discount' : 'Diskaun'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* PRO Campaign Recipes (8 Formula Pintar) */}
              <View style={{
                borderRadius: 18,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                padding: 14,
                marginBottom: 20,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="diamond" size={16} color="#B45309" />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1E293B' }}>
                      {locale === 'en' ? 'PRO Campaign Recipes' : 'Formula Kempen Pintar PRO'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      if (!isPro) setShowUpgradeModal(true);
                    }}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2.5,
                      borderRadius: 999,
                      backgroundColor: isPro ? '#000000' : '#FEF3C7',
                      borderWidth: 1,
                      borderColor: isPro ? '#000000' : '#F59E0B',
                    }}
                  >
                    <Text style={{
                      fontSize: 9.5,
                      fontFamily: 'PlusJakartaSans_800ExtraBold',
                      color: isPro ? '#FFCC00' : '#B45309',
                      letterSpacing: 0.5,
                    }}>
                      {isPro ? 'PRO UNLOCKED' : '🔒 PRO ONLY'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', lineHeight: 16, marginBottom: 12 }}>
                  {locale === 'en'
                    ? 'Pre-built promotion formulas to boost footfall, fill off-peak hours, or bring back quiet customers.'
                    : 'Formula promosi siap-pakai untuk lonjakkan jualan, penuhkan waktu lengang, atau panggil pelanggan sepi.'}
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {PRO_CAMPAIGN_RECIPES.map((recipe) => {
                    const isSelected = inlineCampaignType === recipe.id;
                    return (
                      <TouchableOpacity
                        key={recipe.id}
                        style={{
                          width: '48%',
                          flexGrow: 1,
                          padding: 10,
                          borderRadius: 14,
                          backgroundColor: isSelected ? '#000000' : '#FFFFFF',
                          borderWidth: 1.5,
                          borderColor: isSelected ? '#000000' : '#E2E8F0',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                          justifyContent: 'space-between',
                          minHeight: 82,
                        }}
                        onPress={() => handleSelectInlineRecipe(recipe)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <View style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : `${recipe.color}15`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Ionicons name={recipe.icon as any} size={15} color={isSelected ? '#FFCC00' : recipe.color} />
                          </View>
                          <View style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${recipe.color}15`,
                          }}>
                            <Text style={{
                              fontSize: 8,
                              fontFamily: 'PlusJakartaSans_800ExtraBold',
                              color: isSelected ? '#FFCC00' : recipe.color,
                              letterSpacing: 0.3,
                            }}>
                              {!isPro ? '🔒 PRO' : recipe.tag}
                            </Text>
                          </View>
                        </View>

                        <Text style={{
                          fontSize: 11.5,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: isSelected ? '#FFFFFF' : '#1E293B',
                          marginBottom: 2,
                        }} numberOfLines={1}>
                          {recipe.name}
                        </Text>
                        <Text style={{
                          fontSize: 9.5,
                          fontFamily: 'PlusJakartaSans_500Medium',
                          color: isSelected ? '#94A3B8' : '#64748B',
                          lineHeight: 13,
                        }} numberOfLines={2}>
                          {recipe.desc}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Dynamic PRO Campaign Smart Controls (if active) */}
              {inlineCampaignType && (() => {
                const activeRecipe = PRO_CAMPAIGN_RECIPES.find(r => r.id === inlineCampaignType);
                if (!activeRecipe) return null;

                return (
                  <View style={{
                    borderRadius: 18,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: '#000000',
                    padding: 14,
                    marginBottom: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                  }}>
                    {/* Header: Recipe badge + Clear button */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: activeRecipe.color,
                        }}>
                          <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: 0.5 }}>
                            {activeRecipe.tag}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1E293B' }}>
                          {activeRecipe.name}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => setInlineCampaignType(null)}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9' }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                          {locale === 'en' ? '✕ Reset Formula' : '✕ Batal Formula'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Controls based on specific recipe */}
                    {inlineCampaignType === 'happy_hour' && (
                      <View>
                        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569', marginBottom: 6 }}>
                          {locale === 'en' ? 'Quick Time Presets:' : 'Pilihan Waktu Lengang Pantas:'}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {[
                            { label: '2:00 PM – 5:00 PM', timeStr: 'Sah 2:00 PM – 5:00 PM' },
                            { label: '3:00 PM – 6:00 PM', timeStr: 'Sah 3:00 PM – 6:00 PM' },
                            { label: '11:00 AM – 2:00 PM', timeStr: 'Sah 11:00 AM – 2:00 PM' },
                          ].map((preset) => {
                            const isSlotActive = inlineApplicableItemsText.includes(preset.label);
                            return (
                              <TouchableOpacity
                                key={preset.label}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  backgroundColor: isSlotActive ? '#7C3AED' : '#F1F5F9',
                                  borderWidth: 1,
                                  borderColor: isSlotActive ? '#7C3AED' : '#E2E8F0',
                                }}
                                onPress={() => {
                                  const dayPart = inlineApplicableItemsText.includes('Isnin') ? ' (Isnin–Khamis)' : (inlineApplicableItemsText.includes('Mon') ? ' (Mon-Thu)' : '');
                                  setInlineApplicableItemsText(`${preset.timeStr}${dayPart}`);
                                }}
                                activeOpacity={0.8}
                              >
                                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: isSlotActive ? '#FFFFFF' : '#475569' }}>
                                  {preset.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569', marginBottom: 6 }}>
                          {locale === 'en' ? 'Valid Days:' : 'Hari Sah Digunakan:'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {[
                            { label: 'Isnin – Khamis', enLabel: 'Mon – Thu', suffix: ' (Isnin–Khamis)' },
                            { label: 'Isnin – Jumaat', enLabel: 'Mon – Fri', suffix: ' (Isnin–Jumaat)' },
                            { label: 'Setiap Hari', enLabel: 'Daily', suffix: ' (Setiap Hari)' },
                          ].map((dayPreset) => {
                            const label = locale === 'en' ? dayPreset.enLabel : dayPreset.label;
                            const isDayActive = inlineApplicableItemsText.includes(dayPreset.label) || inlineApplicableItemsText.includes(dayPreset.enLabel);
                            return (
                              <TouchableOpacity
                                key={dayPreset.label}
                                style={{
                                  flex: 1,
                                  alignItems: 'center',
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  backgroundColor: isDayActive ? '#000000' : '#F1F5F9',
                                  borderWidth: 1,
                                  borderColor: isDayActive ? '#000000' : '#E2E8F0',
                                }}
                                onPress={() => {
                                  const baseTime = inlineApplicableItemsText.split('(')[0].trim() || 'Sah 2:00 PM – 5:00 PM';
                                  setInlineApplicableItemsText(`${baseTime}${dayPreset.suffix}`);
                                }}
                                activeOpacity={0.8}
                              >
                                <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_700Bold', color: isDayActive ? '#FFCC00' : '#475569' }}>
                                  {label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {inlineCampaignType === 'flash_sale' && (
                      <View>
                        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569', marginBottom: 6 }}>
                          {locale === 'en' ? 'Limited-time deal duration:' : 'Tempoh tawaran kilat:'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                          {[
                            { label: '⚡ 24 Jam', val: '24' },
                            { label: '⚡ 48 Jam', val: '48' },
                            { label: '⚡ 3 Hari', val: '72' },
                          ].map((d) => (
                            <TouchableOpacity
                              key={d.val}
                              style={{
                                flex: 1,
                                alignItems: 'center',
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: '#000000',
                              }}
                              onPress={() => {
                                if (!inlineDesc) setInlineDesc(`Tamat dalam tempoh ${d.label}. Terhad selagi stok masih ada!`);
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFCC00' }}>
                                {d.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                          {locale === 'en' ? 'Live countdown timer will be displayed prominently on customer vouchers.' : 'Jam undur langsung akan dipaparkan dengan jelas pada baucar pelanggan.'}
                        </Text>
                      </View>
                    )}

                    {inlineCampaignType === 'spend_save' && (
                      <View style={{ backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0' }}>
                        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#166534', marginBottom: 2 }}>
                          {locale === 'en' ? 'Spend & Save Summary' : 'Rumusan Belanja & Jimat'}
                        </Text>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#15803D' }}>
                          {locale === 'en'
                            ? `Spend min RM ${inlineMinSpend || '50'} ➔ Save RM ${inlineDiscountValue || '10'} immediately.`
                            : `Belanja minima RM ${inlineMinSpend || '50'} ➔ Jimat RM ${inlineDiscountValue || '10'} serta-merta.`}
                        </Text>
                      </View>
                    )}

                    {['bogo', 'welcome_gift', 'bring_friend', 'win_back', 'festive'].includes(inlineCampaignType) && (
                      <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#334155' }}>
                          {activeRecipe.desc}. {locale === 'en' ? 'Parameters are auto-configured below.' : 'Parameter di bawah telah dilaraskan secara pintar.'}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Dynamic Inputs based on Reward Type */}
              {inlineType === 'free_item' ? (
                <View style={{ marginBottom: 16 }}>
                  {/* Free Item Name / Specific Details */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Free item details (optional)' : 'Nama item percuma / perincian (pilihan)'}
                  </Text>
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 4, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name="gift-outline" size={18} color="#D97706" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.nestedTextInput}
                      value={inlineApplicableItemsText}
                      onChangeText={setInlineApplicableItemsText}
                      placeholder={locale === 'en' ? "e.g. 1x Iced Latte / 3x Curry Puffs" : "Contoh: 1x Kopi O Ais / Karipap 3 Ketul / Servis Cuci Luar"}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 14, marginLeft: 2 }}>
                    {locale === 'en' ? 'What the customer physically receives when claiming at the counter.' : 'Nama item fizikal atau servis yang akan diterima pelanggan apabila menuntut di kaunter.'}
                  </Text>

                  {/* Quantity */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Quantity' : 'Kuantiti'}
                  </Text>
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name="cube-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.nestedTextInput}
                      value={inlineFreeQty}
                      onChangeText={setInlineFreeQty}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              ) : (
                <View style={{ marginBottom: 16 }}>
                  {/* Discount Type Selector */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Discount type' : 'Jenis diskaun'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor: inlineDiscountType === 'percentage' ? '#FEF3C7' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: inlineDiscountType === 'percentage' ? '#F59E0B' : '#E2E8F0',
                      }}
                      onPress={() => setInlineDiscountType('percentage')}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: inlineDiscountType === 'percentage' ? '#B45309' : '#64748B' }}>
                        Percentage (%)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor: inlineDiscountType === 'fixed_amount' ? '#FEF3C7' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: inlineDiscountType === 'fixed_amount' ? '#F59E0B' : '#E2E8F0',
                      }}
                      onPress={() => setInlineDiscountType('fixed_amount')}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: inlineDiscountType === 'fixed_amount' ? '#B45309' : '#64748B' }}>
                        Fixed Amount (RM)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Discount Value */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {inlineDiscountType === 'percentage' ? 'Discount percentage (%) *' : 'Discount amount (RM) *'}
                  </Text>
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name={inlineDiscountType === 'percentage' ? 'pricetag-outline' : 'cash-outline'} size={18} color="#64748B" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.nestedTextInput}
                      value={inlineDiscountValue}
                      onChangeText={setInlineDiscountValue}
                      keyboardType="decimal-pad"
                      placeholder={inlineDiscountType === 'percentage' ? "e.g. 20" : "e.g. 10"}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Discount Scope (Semua Pesanan vs Item Khusus) */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Discount applies to' : 'Skop diskaun (Sah untuk)'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                        backgroundColor: inlineDiscountScope === 'all' ? '#000000' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: inlineDiscountScope === 'all' ? '#000000' : '#E2E8F0',
                      }}
                      onPress={() => setInlineDiscountScope('all')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cart" size={14} color={inlineDiscountScope === 'all' ? '#FFCC00' : '#64748B'} />
                      <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: inlineDiscountScope === 'all' ? '#FFCC00' : '#475569' }}>
                        {locale === 'en' ? 'All Items (Whole Bill)' : 'Semua Pesanan (Seluruh Bil)'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                        backgroundColor: inlineDiscountScope === 'specific' ? '#000000' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: inlineDiscountScope === 'specific' ? '#000000' : '#E2E8F0',
                      }}
                      onPress={() => setInlineDiscountScope('specific')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="pricetags" size={14} color={inlineDiscountScope === 'specific' ? '#FFCC00' : '#64748B'} />
                      <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: inlineDiscountScope === 'specific' ? '#FFCC00' : '#475569' }}>
                        {locale === 'en' ? 'Specific Items Only' : 'Item / Menu Khusus'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {inlineDiscountScope === 'specific' ? (
                    <View style={{ marginBottom: 14 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                        {locale === 'en' ? 'Applicable items / terms *' : 'Nama produk / terma item khusus *'}
                      </Text>
                      <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                        <Ionicons name="pricetag" size={16} color="#D97706" style={{ marginRight: 10 }} />
                        <TextInput
                          style={styles.nestedTextInput}
                          value={inlineApplicableItemsText}
                          onChangeText={setInlineApplicableItemsText}
                          placeholder={locale === 'en' ? "e.g. Valid for beverages only" : "Contoh: Sah untuk minuman sahaja / Menu sarapan"}
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, marginLeft: 2 }}>
                        {locale === 'en' ? 'This term will be displayed on customer vouchers & staff counter screen.' : 'Terma ini akan dipaparkan dengan jelas pada baucar pelanggan & skrin kaunter staf.'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>
                        💡 {locale === 'en' ? 'Discount will apply to the customer’s total checkout bill at the counter.' : 'Diskaun akan dipotong terus daripada jumlah keseluruhan bil semasa bayaran di kaunter.'}
                      </Text>
                    </View>
                  )}

                  {/* Minimum Spend */}
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Minimum spend (RM) (optional)' : 'Belanja minimum (RM) (pilihan)'}
                  </Text>
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 12, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name="cart-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.nestedTextInput}
                      value={inlineMinSpend}
                      onChangeText={setInlineMinSpend}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 50"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Maximum Discount (Percentage only) */}
                  {inlineDiscountType === 'percentage' && (
                    <>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                        {locale === 'en' ? 'Maximum discount cap (RM) (optional)' : 'Had diskaun maksimum (RM) (pilihan)'}
                      </Text>
                      <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                        <Ionicons name="trending-down-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                        <TextInput
                          style={styles.nestedTextInput}
                          value={inlineMaxDiscount}
                          onChangeText={setInlineMaxDiscount}
                          keyboardType="decimal-pad"
                          placeholder="e.g. 30"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Description / Terms Input */}
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                {locale === 'en' ? 'Description / terms (optional)' : 'Keterangan / terma (pilihan)'}
              </Text>
              <View style={[styles.inputWrapper, { height: 72, borderRadius: 14, alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10, marginBottom: 16, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                <Ionicons name="document-text-outline" size={18} color="#64748B" style={{ marginRight: 10, marginTop: 2 }} />
                <TextInput
                  style={styles.nestedTextInputMultiline}
                  value={inlineDesc}
                  onChangeText={setInlineDesc}
                  placeholder={locale === 'en' ? "Present voucher at the counter before payment." : "Tunjukkan baucar di kaunter sebelum membuat pembayaran."}
                  placeholderTextColor="#94A3B8"
                  multiline
                />
              </View>

              {/* Stock Input */}
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                {locale === 'en' ? 'Stock availability (optional)' : 'Ketersediaan stok (pilihan)'}
              </Text>
              <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 4, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                <Ionicons name="cube-outline" size={18} color="#64748B" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.nestedTextInput}
                  value={inlineStock}
                  onChangeText={setInlineStock}
                  keyboardType="number-pad"
                  placeholder="50"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 16, marginLeft: 2 }}>
                {locale === 'en' ? 'Leave blank for unlimited.' : 'Biarkan kosong untuk tanpa had.'}
              </Text>

              {/* Link to Stamp Card Banner */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 14,
                borderRadius: 18,
                backgroundColor: '#FEF3C7',
                borderColor: '#FDE68A',
                borderWidth: 1,
                marginBottom: 20,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="link" size={18} color="#B45309" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B' }}>
                      {locale === 'en' ? 'Link to stamp card after save' : 'Hubung ke kad setem selepas simpan'}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2, lineHeight: 15 }}>
                      {locale === 'en' ? 'Automatically use this reward as the completion reward for the current stamp card.' : 'Gunakan ganjaran ini secara automatik sebagai ganjaran kelayakan kad setem semasa.'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={linkToStampCard}
                  onValueChange={setLinkToStampCard}
                  trackColor={{ false: '#CBD5E1', true: '#F59E0B' }}
                  thumbColor="#FFFFFF"
                />
              </View>

          </ScrollView>

          {/* Sticky Bottom Action Bar */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: 'rgba(0, 0, 0, 0.08)',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 24 : 16,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.06,
            shadowRadius: 10,
            elevation: 8,
            flexDirection: 'row',
            gap: 12,
          }}>
            <TouchableOpacity
              style={{
                width: 90,
                height: 52,
                borderRadius: 999,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => setShowInlineCreateModal(false)}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#000000', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 }}>
                {locale === 'en' ? 'Cancel' : 'Batal'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                height: 52,
                borderRadius: 999,
                backgroundColor: '#000000',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
              }}
              onPress={handleCreateInlineReward}
              disabled={isSavingInlineReward}
              activeOpacity={0.85}
            >
              {isSavingInlineReward ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFCC00" />
                  <Text style={{ color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15 }}>
                    {locale === 'en' ? 'Create Reward' : 'Cipta Ganjaran'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Risev Curated Reward Visual Picker Modal */}
      <RewardVisualPickerModal
        visible={showVisualPickerModal}
        onClose={() => setShowVisualPickerModal(false)}
        selectedVisualId={visualPickerTarget === 'main' ? formRewardVisualId : inlineRewardVisualId}
        onSelectVisual={(id) => {
          if (visualPickerTarget === 'main') {
            setFormRewardVisualId(id);
          } else {
            setInlineRewardVisualId(id);
          }
        }}
        merchantCategory={merchant?.category || 'food'}
        rewardType={visualPickerTarget === 'main' ? formType : inlineType}
        rewardTitle={visualPickerTarget === 'main' ? formTitle : inlineTitle}
        discountType={visualPickerTarget === 'main' ? formDiscountType : inlineDiscountType}
        discountValue={visualPickerTarget === 'main' ? formDiscountValue : inlineDiscountValue}
      />

      {/* PRO: Birthday Product & Service Picker Modal */}
      <Modal
        visible={showBirthdayItemPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBirthdayItemPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowBirthdayItemPicker(false)}
          />
          <View style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '80%',
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 34 : 20,
            paddingHorizontal: 20,
          }}>
            {/* Sheet Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 14 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                  {locale === 'en' ? 'Gift Offer' : 'Tawaran Hadiah'}
                </Text>
                <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                  {locale === 'en' ? 'Type a custom gift (Free) or link catalog item (PRO)' : 'Taip hadiah manual (Percuma) atau paut katalog (PRO)'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowBirthdayItemPicker(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: '#F1F5F9',
              borderRadius: 12,
              padding: 3,
              marginBottom: 14,
            }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: birthdayGiftMode === 'manual' ? '#FFFFFF' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: birthdayGiftMode === 'manual' ? 0.08 : 0,
                  shadowRadius: 2,
                  elevation: birthdayGiftMode === 'manual' ? 1 : 0,
                }}
                onPress={() => setBirthdayGiftMode('manual')}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 12,
                  fontFamily: birthdayGiftMode === 'manual' ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
                  color: birthdayGiftMode === 'manual' ? '#0F172A' : '#64748B',
                }}>
                  ✏️ {locale === 'en' ? 'Custom Gift' : 'Taip Manual'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: birthdayGiftMode === 'catalog' ? '#000000' : 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: birthdayGiftMode === 'catalog' ? 0.08 : 0,
                  shadowRadius: 2,
                  elevation: birthdayGiftMode === 'catalog' ? 1 : 0,
                }}
                onPress={() => setBirthdayGiftMode('catalog')}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 12,
                  fontFamily: birthdayGiftMode === 'catalog' ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
                  color: birthdayGiftMode === 'catalog' ? '#FFFFFF' : '#64748B',
                }}>
                  🛍️ {locale === 'en' ? 'Link Catalog' : 'Paut Item'}
                </Text>
                <View style={{ backgroundColor: '#FFCC00', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>PRO</Text>
                </View>
              </TouchableOpacity>
            </View>

            {birthdayGiftMode === 'manual' ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {/* Manual Gift Input */}
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
                  {locale === 'en' ? 'Gift Title / Item Name' : 'Nama Hadiah / Item'}
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: '#E2E8F0',
                  paddingHorizontal: 12,
                  height: 46,
                  marginBottom: 12,
                }}>
                  <TextInput
                    style={{ flex: 1, fontSize: 13.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0F172A' }}
                    placeholder={locale === 'en' ? 'e.g. Free 1 Scoop Ais Krim, 10% Off...' : 'cth: Percuma 1 Skop Ais Krim, Baucar RM10...'}
                    placeholderTextColor="#94A3B8"
                    value={manualGiftInput}
                    onChangeText={setManualGiftInput}
                  />
                  {manualGiftInput.length > 0 && (
                    <TouchableOpacity onPress={() => setManualGiftInput('')}>
                      <Ionicons name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Manual Description Input */}
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
                  {locale === 'en' ? 'Description (Optional)' : 'Keterangan (Pilihan)'}
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: '#E2E8F0',
                  paddingHorizontal: 12,
                  height: 46,
                  marginBottom: 14,
                }}>
                  <TextInput
                    style={{ flex: 1, fontSize: 13.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0F172A' }}
                    placeholder={locale === 'en' ? 'e.g. Valid with any dine-in order' : 'cth: Sah untuk sebarang pesanan'}
                    placeholderTextColor="#94A3B8"
                    value={manualGiftDescInput}
                    onChangeText={setManualGiftDescInput}
                  />
                </View>

                {/* Preset Suggestions */}
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
                  {locale === 'en' ? 'Quick Suggestions' : 'Cadangan Pantas'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
                  {[
                    { title: locale === 'en' ? 'Free 1 Scoop Ice Cream' : 'Percuma 1 Skop Ais Krim', desc: locale === 'en' ? 'Complimentary ice cream treat' : 'Hadiah ais krim percuma' },
                    { title: locale === 'en' ? 'Free Drink / Coffee' : 'Minuman Percuma', desc: locale === 'en' ? 'Any beverage of customer choice' : 'Sebarang minuman pilihan pelanggan' },
                    { title: locale === 'en' ? 'Free Birthday Dessert' : 'Pencuci Mulut Percuma', desc: locale === 'en' ? 'Complimentary slice of cake' : 'Sepotong kek percuma' },
                    { title: locale === 'en' ? '10% Off Total Bill' : 'Diskaun 10% Jumlah Bil', desc: locale === 'en' ? 'Birthday celebration discount' : 'Ganjaran diskaun hari lahir' },
                    { title: locale === 'en' ? 'RM10 Birthday Voucher' : 'Baucar RM10 Hari Jadi', desc: locale === 'en' ? 'Deducted at cashier counter' : 'Ditolak di kaunter bayaran' },
                    { title: locale === 'en' ? 'Special Birthday Treat' : 'Hadiah Istimewa Hari Jadi', desc: locale === 'en' ? 'Exclusive gift treat' : 'Pek hadiah istimewa' },
                  ].map((preset, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        paddingVertical: 7,
                        paddingHorizontal: 12,
                        borderRadius: 9999,
                      }}
                      onPress={() => {
                        setManualGiftInput(preset.title);
                        setManualGiftDescInput(preset.desc);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0F172A' }}>
                        {preset.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Confirm Button */}
                <TouchableOpacity
                  style={{
                    height: 48,
                    backgroundColor: '#000000',
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 4,
                  }}
                  onPress={handleConfirmManualGift}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                    {locale === 'en' ? 'Confirm Gift Offer' : 'Sahkan Tawaran Hadiah'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : !isPro ? (
              <View style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: '#E2E8F0',
                padding: 18,
                alignItems: 'center',
                marginVertical: 8,
              }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ionicons name="sparkles" size={24} color="#D97706" />
                </View>
                <View style={{ backgroundColor: '#000000', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 6, marginBottom: 8 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFCC00', letterSpacing: 0.5 }}>
                    PRO FEATURE
                  </Text>
                </View>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', textAlign: 'center', marginBottom: 6 }}>
                  {locale === 'en' ? 'Link Real Products & Services' : 'Paut Produk & Servis Sebenar'}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 16, paddingHorizontal: 12 }}>
                  {locale === 'en'
                    ? 'Upgrade to Risev PRO to link items directly from your menu with high-res photos, real prices, and automatic inventory sync.'
                    : 'Naik taraf ke Risev PRO untuk memautkan item terus dari menu anda dengan foto resolusi tinggi, harga sebenar, dan penyegerakan inventori automatik.'}
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#000000',
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 9999,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    justifyContent: 'center',
                  }}
                  onPress={() => {
                    setShowBirthdayItemPicker(false);
                    setShowUpgradeModal(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="lock-open" size={14} color="#FFCC00" />
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                    {locale === 'en' ? 'Unlock with Risev PRO' : 'Buka Kunci dengan Risev PRO'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ marginTop: 12, paddingVertical: 4 }}
                  onPress={() => setBirthdayGiftMode('manual')}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', textDecorationLine: 'underline' }}>
                    {locale === 'en' ? '← Continue with free custom gift' : '← Teruskan dengan taip manual percuma'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Search Input */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  paddingHorizontal: 12,
                  height: 42,
                  marginBottom: 10,
                  gap: 8,
                }}>
                  <Ionicons name="search-outline" size={16} color="#94A3B8" />
                  <TextInput
                    style={{ flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0F172A' }}
                    placeholder={locale === 'en' ? 'Search products or services...' : 'Cari produk atau servis...'}
                    placeholderTextColor="#94A3B8"
                    value={birthdayItemSearch}
                    onChangeText={setBirthdayItemSearch}
                  />
                  {birthdayItemSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setBirthdayItemSearch('')}>
                      <Ionicons name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Tabs: All, Services, Products */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {[
                    { id: 'all', label: locale === 'en' ? 'All Items' : 'Semua' },
                    { id: 'service', label: locale === 'en' ? 'Services' : 'Servis' },
                    { id: 'product', label: locale === 'en' ? 'Products' : 'Produk' },
                  ].map((tab) => {
                    const isActive = birthdayItemFilter === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        onPress={() => setBirthdayItemFilter(tab.id as any)}
                        style={{
                          paddingVertical: 5,
                          paddingHorizontal: 12,
                          borderRadius: 9999,
                          backgroundColor: isActive ? '#000000' : '#F1F5F9',
                        }}
                      >
                        <Text style={{
                          fontSize: 11,
                          fontFamily: isActive ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
                          color: isActive ? '#FFFFFF' : '#64748B',
                        }}>
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Items List */}
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                  {(() => {
                    const itemsToFilter = merchantServicesList.length > 0 ? merchantServicesList : [
                      { id: 'srv_1', name: 'Signature Haircut', item_type: 'service', price: 35, category: 'Hair', duration_minutes: 45 },
                      { id: 'srv_2', name: 'Iced Latte / Coffee', item_type: 'product', price: 12, category: 'Beverage' },
                      { id: 'srv_3', name: 'Express Manicure', item_type: 'service', price: 45, category: 'Nails', duration_minutes: 30 },
                      { id: 'srv_4', name: 'Deluxe Car Wash', item_type: 'service', price: 25, category: 'Auto', duration_minutes: 30 },
                      { id: 'srv_5', name: 'Artisan Slice Cake', item_type: 'product', price: 16, category: 'Dessert' },
                    ];

                    const filtered = itemsToFilter.filter((item) => {
                      const matchesSearch = item.name.toLowerCase().includes(birthdayItemSearch.toLowerCase()) ||
                        (item.category && item.category.toLowerCase().includes(birthdayItemSearch.toLowerCase()));
                      const matchesType = birthdayItemFilter === 'all' || item.item_type === birthdayItemFilter;
                      return matchesSearch && matchesType;
                    });

                    if (filtered.length === 0) {
                      return (
                        <View style={{ paddingVertical: 28, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="search" size={28} color="#CBD5E1" style={{ marginBottom: 6 }} />
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                            {locale === 'en' ? 'No matching items found' : 'Tiada item ditemui'}
                          </Text>
                        </View>
                      );
                    }

                    return filtered.map((item) => {
                      const isSelected = selectedBirthdayItem?.id === item.id;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 12,
                            borderRadius: 14,
                            backgroundColor: isSelected ? '#000000' : '#F8FAFC',
                            borderWidth: 1.5,
                            borderColor: isSelected ? '#000000' : '#E2E8F0',
                          }}
                          onPress={() => handleSelectBirthdayItem(item)}
                          activeOpacity={0.8}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              backgroundColor: isSelected ? '#FFFFFF' : '#F1F5F9',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <Ionicons
                                name={item.item_type === 'product' ? 'cube-outline' : 'sparkles-outline'}
                                size={18}
                                color={isSelected ? '#000000' : '#0F172A'}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{
                                  fontSize: 13.5,
                                  fontFamily: 'PlusJakartaSans_700Bold',
                                  color: isSelected ? '#FFFFFF' : '#0F172A',
                                }} numberOfLines={1}>
                                  {item.name}
                                </Text>
                                <View style={{
                                  backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
                                  paddingHorizontal: 5,
                                  paddingVertical: 1,
                                  borderRadius: 4,
                                }}>
                                  <Text style={{
                                    fontSize: 8.5,
                                    fontFamily: 'PlusJakartaSans_800ExtraBold',
                                    color: isSelected ? '#FFCC00' : '#475569',
                                    textTransform: 'uppercase',
                                  }}>
                                    {item.item_type || 'service'}
                                  </Text>
                                </View>
                              </View>
                              <Text style={{
                                fontSize: 11,
                                fontFamily: 'PlusJakartaSans_500Medium',
                                color: isSelected ? '#94A3B8' : '#64748B',
                                marginTop: 1,
                              }}>
                                {item.category ? `${item.category} · ` : ''}{item.duration_minutes ? `${item.duration_minutes} mins` : ''}
                              </Text>
                            </View>
                          </View>

                          {item.price ? (
                            <Text style={{
                              fontSize: 13,
                              fontFamily: 'PlusJakartaSans_800ExtraBold',
                              color: isSelected ? '#FFCC00' : '#0F172A',
                              marginLeft: 8,
                            }}>
                              RM{Number(item.price).toFixed(0)}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* On-Demand Contextual Info Tooltip Modal */}
      <Modal
        visible={!!helpModalInfo}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setHelpModalInfo(null)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          activeOpacity={1}
          onPress={() => setHelpModalInfo(null)}
        >
          <View style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            padding: 22,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 8,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#0F172A',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="help" size={20} color="#FFFFFF" />
              </View>
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', flex: 1 }}>
                {helpModalInfo?.title}
              </Text>
            </View>

            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#475569', lineHeight: 20, marginBottom: 18 }}>
              {helpModalInfo?.desc}
            </Text>

            <TouchableOpacity
              onPress={() => setHelpModalInfo(null)}
              style={{
                height: 44,
                borderRadius: 12,
                backgroundColor: '#0F172A',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                {locale === 'en' ? 'Got It' : 'Faham'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Validity Window Picker Modal */}
      <Modal
        visible={showValidityPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowValidityPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowValidityPicker(false)} />
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 4 }}>
              {locale === 'en' ? 'Validity Window' : 'Tempoh Sah'}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 16 }}>
              {locale === 'en' ? 'Choose how long the customer has to claim their birthday treat.' : 'Pilih tempoh masa untuk pelanggan menebus baucar.'}
            </Text>
            <View style={{ gap: 10 }}>
              {[
                { id: '3', title: locale === 'en' ? '3 Days (Recommended)' : '3 Hari (Disyorkan)', desc: locale === 'en' ? 'Day before · Birthday · Day after' : 'Hari sebelum · Hari lahir · Hari selepas' },
                { id: '7', title: locale === 'en' ? '7 Days (1 Week)' : '7 Hari (1 Minggu)', desc: locale === 'en' ? '3 days before · Birthday · 3 days after' : '3 hari sebelum · Hari lahir · Hari selepas' },
                { id: '30', title: locale === 'en' ? '30 Days (Full Month)' : '30 Hari (1 Bulan)', desc: locale === 'en' ? 'Entire customer birthday month' : 'Sepanjang bulan hari lahir' },
              ].map((opt) => {
                const isSelected = birthdayForm.expiry_days === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => {
                      setBirthdayForm((f) => ({ ...f, expiry_days: opt.id }));
                      setShowValidityPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 14,
                      backgroundColor: isSelected ? '#F8FAFC' : '#FFFFFF',
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#000000' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {opt.title}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                        {opt.desc}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#000000" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Send Schedule Picker Modal */}
      <Modal
        visible={showSchedulePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSchedulePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSchedulePicker(false)} />
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 4 }}>
              {locale === 'en' ? 'Send Schedule' : 'Waktu Hantar'}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 16 }}>
              {locale === 'en' ? "Select the dispatch time for automated in-wallet delivery." : "Pilih masa hantaran automatik ke telefon pelanggan."}
            </Text>
            <View style={{ gap: 10 }}>
              {[
                { time: '09:00', label: '09:00 AM (Recommended)', desc: locale === 'en' ? "Send on customer's birthday · Store local time" : "Dihantar pada pagi hari lahir" },
                { time: '10:00', label: '10:00 AM', desc: locale === 'en' ? "Mid-morning dispatch before lunchtime visits" : "Hantaran pertengahan pagi" },
                { time: '12:00', label: '12:00 PM', desc: locale === 'en' ? "Lunchtime celebration surprise" : "Hantaran waktu makan tengah hari" },
              ].map((opt) => {
                const isSelected = birthdayForm.send_time === opt.time;
                return (
                  <TouchableOpacity
                    key={opt.time}
                    onPress={() => {
                      setBirthdayForm((f) => ({ ...f, send_time: opt.time }));
                      setShowSchedulePicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 14,
                      backgroundColor: isSelected ? '#F8FAFC' : '#FFFFFF',
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#000000' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {opt.label}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                        {opt.desc}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#000000" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Redemption Rules Modal */}
      <Modal
        visible={showRulesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRulesModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowRulesModal(false)} />
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 4 }}>
              {locale === 'en' ? 'Redemption Rules' : 'Syarat Penebusan'}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 16 }}>
              {locale === 'en' ? 'Standard safeguard policies applied to this birthday pass.' : 'Syarat keselamatan baucar hari lahir.'}
            </Text>
            <View style={{ gap: 12, marginBottom: 20 }}>
              {[
                { icon: 'shield-checkmark-outline', title: locale === 'en' ? 'Once per Birthday Year' : 'Sekali Setiap Tahun Lahir', desc: locale === 'en' ? 'Each customer can only claim this offer once per calendar birthday year.' : 'Setiap pelanggan hanya boleh menebus sekali dalam setahun.' },
                { icon: 'qr-code-outline', title: locale === 'en' ? 'In-Store Verification' : 'Pengesahan Kaunter', desc: locale === 'en' ? 'Customer must present their digital pass or code for staff verification at checkout.' : 'Pelanggan perlu menunjukkan kod atau imbasan QR semasa pembayaran.' },
                { icon: 'timer-outline', title: locale === 'en' ? 'Auto-Expiring Pass' : 'Tamat Tempoh Automatik', desc: locale === 'en' ? 'The pass automatically expires at 11:59 PM on the final day of the validity window.' : 'Baucar lupus secara automatik pada hari terakhir tempoh sah.' },
              ].map((rule, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
                  <Ionicons name={rule.icon as any} size={20} color="#0F172A" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>{rule.title}</Text>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>{rule.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setShowRulesModal(false)}
              style={{ backgroundColor: '#000000', height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>{locale === 'en' ? 'Done' : 'Selesai'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Stamps Count Picker Modal */}
      <Modal
        visible={showStampsPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStampsPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowStampsPicker(false)} />
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 4 }}>
              {locale === 'en' ? 'Bonus Stamps' : 'Cop Bonus'}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 16 }}>
              {locale === 'en' ? 'How many bonus stamps to credit directly on their birthday.' : 'Bilangan cop bonus untuk dikreditkan secara automatik.'}
            </Text>
            <View style={{ gap: 10 }}>
              {['1', '2', '3', '5'].map((count) => {
                const isSelected = birthdayForm.reward_value === count;
                return (
                  <TouchableOpacity
                    key={count}
                    onPress={() => {
                      setBirthdayForm((f) => ({
                        ...f,
                        reward_value: count,
                        title: `${count} Bonus Stamps`,
                        description: `Birthday celebration: ${count} bonus stamps credited to your card.`,
                      }));
                      setShowStampsPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 14,
                      backgroundColor: isSelected ? '#F8FAFC' : '#FFFFFF',
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#000000' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="star" size={18} color="#D97706" />
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {count} {locale === 'en' ? (count === '1' ? 'Bonus Stamp' : 'Bonus Stamps') : 'Cop Bonus'} {count === '2' ? `(${locale === 'en' ? 'Recommended' : 'Disyorkan'})` : ''}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#000000" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Earn Points Custom Rate Modal */}
      <Modal
        visible={showEarnRateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEarnRateModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowEarnRateModal(false)} />
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 4 }}>
              {locale === 'en' ? 'Earn Points Rate' : 'Kadar Perolehan Mata'}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 16 }}>
              {locale === 'en' ? 'How much customer spends to earn 1 loyalty point.' : 'Jumlah belanja pelanggan untuk dapatkan 1 mata.'}
            </Text>

            {/* Quick Presets */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {['1', '2', '5', '10'].map((amt) => {
                const isSelected = spendPerPoint === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setSpendPerPoint(amt)}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: isSelected ? '#000000' : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: isSelected ? '#000000' : '#E2E8F0',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontFamily: isSelected ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_700Bold',
                      color: isSelected ? '#FFCC00' : '#0F172A',
                    }}>
                      RM {amt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Spend Input */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              paddingHorizontal: 14,
              height: 48,
              marginBottom: 20,
            }}>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginRight: 8 }}>RM</Text>
              <TextInput
                value={spendPerPoint}
                onChangeText={setSpendPerPoint}
                keyboardType="decimal-pad"
                style={{ flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}
                placeholder="1"
                placeholderTextColor="#94A3B8"
              />
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>= 1 Point</Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowEarnRateModal(false)}
              style={{ backgroundColor: '#000000', height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                {locale === 'en' ? 'Done' : 'Selesai'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Redeem Value Selection Modal */}
      <Modal
        visible={showRedeemRateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRedeemRateModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowRedeemRateModal(false)} />
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 4 }}>
              {locale === 'en' ? 'Redeem Value' : 'Nilai Penebusan'}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 16 }}>
              {locale === 'en' ? 'Choose how many points convert to RM 1.00 discount.' : 'Pilih berapa mata untuk ditukar kepada RM 1.00 diskaun.'}
            </Text>

            <View style={{ gap: 10, marginBottom: 20 }}>
              {[
                { pts: '100', title: '100 Pts = RM 1.00', desc: locale === 'en' ? '1% reward rate (Industry Standard)' : 'Kadar ganjaran 1% (Standard Industri)' },
                { pts: '50', title: '50 Pts = RM 1.00', desc: locale === 'en' ? '2% reward rate (High Generosity)' : 'Kadar ganjaran 2% (Lebih Lumayan)' },
                { pts: '200', title: '200 Pts = RM 1.00', desc: locale === 'en' ? '0.5% reward rate (Conservative Margin)' : 'Kadar ganjaran 0.5% (Margin Selamat)' },
              ].map((opt) => {
                const isSelected = pointsPerRm === opt.pts;
                return (
                  <TouchableOpacity
                    key={opt.pts}
                    onPress={() => {
                      setPointsPerRm(opt.pts);
                      setShowRedeemRateModal(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 14,
                      backgroundColor: isSelected ? '#F8FAFC' : '#FFFFFF',
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#000000' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                        {opt.title}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                        {opt.desc}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#000000" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Points Rules & Limits Modal */}
      <Modal
        visible={showPointsRulesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPointsRulesModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPointsRulesModal(false)} />
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 4 }}>
              {locale === 'en' ? 'Rules & Limits' : 'Syarat & Had Penebusan'}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 16 }}>
              {locale === 'en' ? 'Protect your business margins with redemption thresholds.' : 'Lindungi margin perniagaan dengan had penebusan.'}
            </Text>

            {/* Min Redeem Threshold */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A', marginBottom: 6 }}>
                {locale === 'en' ? 'Minimum Points to Redeem (0 = No Min)' : 'Minima Mata untuk Tebus (0 = Tiada)'}
              </Text>
              <TextInput
                value={minRedeemPoints}
                onChangeText={setMinRedeemPoints}
                keyboardType="number-pad"
                style={{
                  height: 44,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  paddingHorizontal: 12,
                  fontSize: 14,
                  fontFamily: 'PlusJakartaSans_700Bold',
                  color: '#0F172A',
                }}
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Max Discount % Cap */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A', marginBottom: 6 }}>
                {locale === 'en' ? 'Max Bill Discount Cap (%) (0 = No Cap)' : 'Had Maksima Diskaun Bil (%) (0 = Tiada Had)'}
              </Text>
              <TextInput
                value={maxRedeemPercent}
                onChangeText={setMaxRedeemPercent}
                keyboardType="number-pad"
                style={{
                  height: 44,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  paddingHorizontal: 12,
                  fontSize: 14,
                  fontFamily: 'PlusJakartaSans_700Bold',
                  color: '#0F172A',
                }}
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <TouchableOpacity
              onPress={() => setShowPointsRulesModal(false)}
              style={{ backgroundColor: '#000000', height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                {locale === 'en' ? 'Save & Close' : 'Simpan & Tutup'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Risev Pro Upgrade Modal */}
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    marginBottom: 16,
    zIndex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  catalogueActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 14,
  },
  catalogueTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  catalogueSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  addRewardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#050505',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  addRewardBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
  },
  fabBtn: {
    position: 'absolute',
    bottom: 85,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },
  fabBtnDesktop: {
    right: 32,
    bottom: 32,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
  },
  // Compact Loyalty Modules Capsule
  programModuleCapsule: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  moduleCapsuleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  moduleCapsuleLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  moduleTogglesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moduleToggleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  moduleToggleCardActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  moduleIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  moduleToggleTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  moduleToggleStatus: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginTop: 1,
  },
  moduleDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E2E8F0',
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
  // Apple 2-Row Compact Segmented Tab Bar (Full Width, Zero Scroll)
  compactTabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 3,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
  },
  compactTabBtn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  compactTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  compactTabBtnText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 3,
    textAlign: 'center',
  },
  compactTabBtnTextActive: {
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  // Apple Segmented Tab Bar
  segmentedTabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
  },
  segmentedTabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  segmentedTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentedTabBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  segmentedTabBtnTextActive: {
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  // Apple Pass Digital Voucher Card
  appleRewardPassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  rewardPassThumbWrap: {
    position: 'relative',
    width: 60,
    height: 60,
    marginRight: 12,
  },
  rewardPassThumb: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    resizeMode: 'cover',
  },
  rewardTypeBadge: {
    position: 'absolute',
    bottom: -4,
    left: 2,
    right: 2,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardTypeBadgeFree: {
    backgroundColor: '#FFCC00',
  },
  rewardTypeBadgeDiscount: {
    backgroundColor: '#0F172A',
  },
  rewardTypeBadgeText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: 0.5,
  },
  rewardPassContent: {
    flex: 1,
    marginRight: 8,
  },
  rewardPassTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  rewardPassDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 15,
    marginBottom: 6,
  },
  rewardPassMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  stampRewardPill: {
    backgroundColor: '#FFCC00',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stampRewardPillText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: 0.4,
  },
  pointsRewardPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsRewardPillText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#2563EB',
    letterSpacing: 0.4,
  },
  stockStatusBadge: {
    justifyContent: 'center',
  },
  rewardPassActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 64,
    paddingLeft: 2,
  },
  rewardActionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardActionEditBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardActionDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginTop: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_700Bold',
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

  // Filter Pills Styling
  filterPillsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFC700',
  },
  filterPillCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  filterPillCountActive: {
    backgroundColor: '#1E293B',
  },
  filterPillCountText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
  },
  filterPillCountTextActive: {
    color: '#FFC700',
  },
});
