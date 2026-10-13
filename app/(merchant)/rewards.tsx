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
import UpgradeModal from './_components/UpgradeModal';
import { RewardVisualPickerModal } from '@/components/RewardVisualPickerModal';
import { getRewardVisualById, getRewardVisualUrl } from '@/lib/rewardVisuals';

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
  const isMalay = locale === 'ms';
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Color picker refs (web only) — render inputs at top level so picker dialog is centered
  const cardColorInputRef = React.useRef<any>(null);
  const stampColorInputRef = React.useRef<any>(null);
  const fontColorInputRef = React.useRef<any>(null);
  const iconColorInputRef = React.useRef<any>(null);

  // Sub-tabs Selection
  const [activeTab, setActiveTab] = useState<'catalogue' | 'card_design' | 'points_tiers' | 'birthday'>('catalogue');

  // Loyalty Program Modes (Stamps, Points & Tiers)
  const [enableStamps, setEnableStamps] = useState<boolean>(true);
  const [enablePoints, setEnablePoints] = useState<boolean>(true);
  const [savingLoyaltyModules, setSavingLoyaltyModules] = useState<boolean>(false);
  const [spendPerPoint, setSpendPerPoint] = useState<string>('1');
  const [savingPointsRate, setSavingPointsRate] = useState<boolean>(false);

  // Shared Loading & Authorization States
  const [merchant, setMerchant] = useState<any>(null);
  const [loadingMerchant, setLoadingMerchant] = useState(true);

  // Tab 1: Catalogue Management States
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [catalogueFilter, setCatalogueFilter] = useState<'all' | 'active' | 'draft' | 'discount' | 'free_item'>('all');

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
  const [formPointsCost, setFormPointsCost] = useState('0');
  const [formStock, setFormStock] = useState('50');
  const [formType, setFormType] = useState<'free_item' | 'discount'>('free_item');
  const [formDiscountType, setFormDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [formMinSpend, setFormMinSpend] = useState('');
  const [formMaxDiscount, setFormMaxDiscount] = useState('');
  const [formFreeQty, setFormFreeQty] = useState('1');
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
  const [requiredStamps, setRequiredStamps] = useState<5 | 10 | 15>(10);
  const [expiryDays, setExpiryDays] = useState('30');
  const [minSpendAmount, setMinSpendAmount] = useState<string>('0');
  const [enableMinSpend, setEnableMinSpend] = useState<boolean>(false);
  const [minSpendFocused, setMinSpendFocused] = useState<boolean>(false);
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

  // Inline Reward Creator Modal States (from Card Design)
  const [showInlineCreateModal, setShowInlineCreateModal] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineType, setInlineType] = useState<'free_item' | 'discount'>('free_item');
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
  const [selectedLinkedItemIds, setSelectedLinkedItemIds] = useState<string[]>([]);
  const [merchantServicesList, setMerchantServicesList] = useState<any[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (!user?.merchant_id) return;
    (async () => {
      try {
        const sRes = await pb.collection('merchant_services').getList(1, 100, {
          filter: `merchant = "${user.merchant_id}" && is_active = true`,
          sort: 'name',
        });
        setMerchantServicesList(sRes.items);
      } catch (e) {}

      try {
        const subRes = await pb.collection('subscriptions').getList(1, 1, {
          filter: `merchant = "${user.merchant_id}" && status = "active"`,
        });
        if (subRes.items.length > 0) {
          const plan = (subRes.items[0].plan || '').toLowerCase();
          if (plan === 'pro' || plan === 'business') {
            setIsPro(true);
          }
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
        setLinkedRewardId(prog.linked_reward || null);
        setIsActive(prog.is_active);
        setRequiredStamps(prog.stamp_goal as any || 10);
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
    if (!birthdayForm.title.trim() || !birthdayForm.reward_value.trim()) {
      Alert.alert(
        'Validation Error',
        birthdayForm.reward_type === 'stamps'
          ? (isMalay ? 'Sila masukkan bilangan cop bonus.' : 'Please enter the number of bonus stamps.')
          : (isMalay ? 'Sila masukkan tawaran atau hadiah percuma.' : 'Please enter the reward offer or free gift.')
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
      const payload = {
        merchant: user.merchant_id,
        title: birthdayForm.title.trim(),
        description: birthdayForm.description.trim(),
        reward_type: birthdayForm.reward_type,
        reward_value: birthdayForm.reward_value.trim(),
        message_template: birthdayForm.message_template.trim() || `Happy Birthday {{name}}! Special gift from ${merchant?.name || 'us'}: ${birthdayForm.title.trim()}`,
        message_template_b: null,
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
    setFormPointsCost('0');
    setFormStock('50');
    setFormType('free_item');
    setFormDiscountType('percentage');
    setFormDiscountValue('');
    setFormMinSpend('');
    setFormMaxDiscount('');
    setFormFreeQty('1');
    setFormSelectedLinkedItemIds([]);
    setFormIsActive(true);
    setFormRewardVisualId(null);
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
    setFormDiscountType(reward.discount_type || 'percentage');
    setFormDiscountValue(reward.discount_value ? String(reward.discount_value) : '');
    setFormMinSpend(reward.min_spend ? String(reward.min_spend) : '');
    setFormMaxDiscount(reward.max_discount ? String(reward.max_discount) : '');
    setFormFreeQty(reward.free_quantity ? String(reward.free_quantity) : '1');
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
      formData.append('is_active', String(formIsActive));
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
      formData.append('stock', String(inlineStock ? (parseInt(inlineStock, 10) || 1000000) : 1000000));
      formData.append('points_cost', '0');
      formData.append('is_active', 'true');
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
    const parsed = parseFloat(spendPerPoint);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert(
        locale === 'en' ? 'Invalid Input' : 'Input Tidak Sah',
        locale === 'en'
          ? 'Please enter a valid spend amount greater than 0.'
          : 'Sila masukkan jumlah perbelanjaan yang sah lebih daripada 0.'
      );
      return;
    }

    if (!user?.merchant_id) return;

    try {
      setSavingPointsRate(true);
      if (programId) {
        await pb.collection('loyalty_programs').update(programId, {
          spend_per_point: parsed,
        });
      } else {
        const newProg = await pb.collection('loyalty_programs').create({
          merchant: user.merchant_id,
          name: `${merchant?.name || 'Store'} Loyalty Program`,
          spend_per_point: parsed,
          enable_stamps: enableStamps,
          enable_points: enablePoints,
          is_active: true,
        });
        setProgramId(newProg.id);
      }
      Alert.alert(
        locale === 'en' ? 'Points Rule Saved' : 'Peraturan Mata Disimpan',
        locale === 'en'
          ? `Points earning rule updated: RM ${parsed} spent = 1 Point.`
          : `Peraturan pendapatan mata dikemas kini: RM ${parsed} dibelanjakan = 1 Mata.`
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


        {/* Loyalty Program Modules Toggle Card */}
        <View style={styles.modulesConfigCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="options-outline" size={18} color="#050505" />
              <Text style={styles.modulesCardTitle}>
                {locale === 'en' ? 'Loyalty Program Modules' : 'Modul Program Kesetiaan'}
              </Text>
            </View>
            {savingLoyaltyModules && (
              <ActivityIndicator size="small" color="#050505" />
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Toggle 1: Stamp Cards */}
            <View style={{ flex: 1, backgroundColor: enableStamps ? '#FFFFFF' : 'rgba(5, 5, 5, 0.05)', borderWidth: 1, borderColor: enableStamps ? '#FFFFFF' : 'transparent', borderRadius: 16, padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: enableStamps ? 'rgba(16, 185, 129, 0.15)' : 'rgba(5, 5, 5, 0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={enableStamps ? "card" : "card-outline"} size={18} color={enableStamps ? '#10B981' : 'rgba(5, 5, 5, 0.6)'} />
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
                    if (!val && activeTab === 'card_design') {
                      setActiveTab(enablePoints ? 'catalogue' : 'birthday');
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
                  trackColor={{ false: 'rgba(5, 5, 5, 0.15)', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                  style={{ transform: [{ scale: 0.8 }] }}
                />
              </View>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                {locale === 'en' ? 'Stamp Cards' : 'Kad Setem'}
              </Text>
            </View>

            {/* Toggle 2: Points & Tiers */}
            <View style={{ flex: 1, backgroundColor: enablePoints ? '#FFFFFF' : 'rgba(5, 5, 5, 0.05)', borderWidth: 1, borderColor: enablePoints ? '#FFFFFF' : 'transparent', borderRadius: 16, padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: enablePoints ? 'rgba(217, 119, 6, 0.15)' : 'rgba(5, 5, 5, 0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={enablePoints ? "star" : "star-outline"} size={18} color={enablePoints ? '#D97706' : 'rgba(5, 5, 5, 0.6)'} />
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
                    if (!val && (activeTab === 'catalogue' || activeTab === 'points_tiers')) {
                      setActiveTab(enableStamps ? 'card_design' : 'birthday');
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
                  trackColor={{ false: 'rgba(5, 5, 5, 0.15)', true: '#D97706' }}
                  thumbColor="#FFFFFF"
                  style={{ transform: [{ scale: 0.8 }] }}
                />
              </View>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                {locale === 'en' ? 'Points & Tiers' : 'Mata & Tahap'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Selection Bar */}
        <View style={styles.tabContainer}>
          {enablePoints && (
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'catalogue' && styles.tabBtnActive]}
              onPress={() => setActiveTab('catalogue')}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabBtnText, activeTab === 'catalogue' && styles.tabBtnTextActive]}>
                {t('catalogue_tab')}
              </Text>
            </TouchableOpacity>
          )}

          {enableStamps && (
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'card_design' && styles.tabBtnActive]}
              onPress={() => setActiveTab('card_design')}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabBtnText, activeTab === 'card_design' && styles.tabBtnTextActive]}>
                {t('card_design_tab')}
              </Text>
            </TouchableOpacity>
          )}

          {enablePoints && (
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'points_tiers' && styles.tabBtnActive]}
              onPress={() => setActiveTab('points_tiers')}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabBtnText, activeTab === 'points_tiers' && styles.tabBtnTextActive]}>
                {t('points_tiers_tab')}
              </Text>
            </TouchableOpacity>
          )}

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
        {activeTab === 'catalogue' && (() => {
          const activeCount = rewards.filter((r) => r.is_active).length;
          const draftCount = rewards.filter((r) => !r.is_active).length;
          const discountCount = rewards.filter((r) => r.type === 'discount').length;
          const freeItemCount = rewards.filter((r) => r.type === 'free_item').length;

          const filteredRewards = rewards.filter((r) => {
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
              {rewards.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsContainer} style={{ marginBottom: 16 }}>
                  {[
                    { id: 'all', label: locale === 'en' ? 'All' : 'Semua', count: rewards.length },
                    { id: 'active', label: locale === 'en' ? 'Active' : 'Aktif', count: activeCount },
                    { id: 'draft', label: locale === 'en' ? 'Draft' : 'Deraf', count: draftCount },
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
              ) : filteredRewards.length === 0 ? (
                <View style={[styles.emptyContainer, { paddingVertical: 40 }]}>
                  <Ionicons name="filter-outline" size={36} color="#94A3B8" style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyTitle, { fontSize: 16 }]}>{locale === 'en' ? 'No matching rewards' : 'Tiada ganjaran sepadan'}</Text>
                  <Text style={styles.emptySubtitle}>{locale === 'en' ? 'Try selecting a different filter above.' : 'Cuba pilih penapis lain di atas.'}</Text>
                </View>
              ) : (
                <View style={styles.rewardsList}>
                  {filteredRewards.map((reward) => {
                    const itemImgUrl = reward.image
                      ? `${pb.baseUrl}/api/files/rewards/${reward.id}/${reward.image}`
                      : 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=150';

                    return (
                      <View
                        key={reward.id}
                        style={{
                          flexDirection: 'row',
                          borderRadius: 16,
                          height: 142,
                          backgroundColor: '#0F172A',
                          overflow: 'hidden',
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: 0.18,
                          shadowRadius: 10,
                          elevation: 4,
                          marginBottom: 8,
                        }}
                      >
                        {/* 1. LEFT ZONE: Merchant Identity ONLY */}
                        <View style={{ width: 105, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }}>
                          <View style={{
                            width: 54,
                            height: 54,
                            borderRadius: 27,
                            backgroundColor: '#FFFFFF',
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                            elevation: 3,
                            marginBottom: 6,
                          }}>
                            <Image source={{ uri: merchantLogo }} style={{ width: 48, height: 48, borderRadius: 24, resizeMode: 'cover' }} />
                          </View>
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', textAlign: 'center', width: '100%' }} numberOfLines={1}>
                            {merchant?.name || 'Your Store'}
                          </Text>
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', textAlign: 'center', width: '100%', marginTop: 1 }} numberOfLines={1}>
                            {merchant?.category || 'food'}
                          </Text>
                        </View>

                        {/* CENTER DIVIDER: Ticket Cutout Notches & Perforated Line */}
                        <View style={{ width: 16, alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                          <View style={{ width: 16, height: 8, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: '#F8FAFC', position: 'absolute', top: 0, zIndex: 5 }} />
                          <View style={{ width: 1, height: '100%', borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1, borderStyle: 'dashed' }} />
                          <View style={{ width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: '#F8FAFC', position: 'absolute', bottom: 0, zIndex: 5 }} />
                        </View>

                        {/* 2. CENTER ZONE: Reward Info */}
                        <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                          {/* Top Header Row: Ready to Redeem Badge */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
                            <View style={{ backgroundColor: '#FFC700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="gift" size={11} color="#000000" />
                              <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>Ready to redeem</Text>
                            </View>
                          </View>

                          {/* Middle Body: Title & Description */}
                          <View style={{ marginVertical: 3, zIndex: 2 }}>
                            <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: -0.3, lineHeight: 19 }} numberOfLines={2}>
                              {reward.name}
                            </Text>
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 2, lineHeight: 15 }} numberOfLines={1}>
                              {reward.description || (reward.type === 'discount' ? 'Discount reward offer' : 'Reward for completing store card')}
                            </Text>
                          </View>

                          {/* Bottom Footer Row: Source Badge + Stock Info */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 2 }}>
                            {reward.id === linkedRewardId ? (
                              <View style={{ backgroundColor: '#2563EB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name="card" size={10} color="#FFFFFF" />
                                <Text style={{ color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 8, letterSpacing: 0.5 }}>STAMP CARD REWARD</Text>
                              </View>
                            ) : (
                              <View style={{ backgroundColor: '#2563EB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name="gift" size={10} color="#FFFFFF" />
                                <Text style={{ color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 8, letterSpacing: 0.5 }}>POINTS REWARD ({reward.points_cost} Pts)</Text>
                              </View>
                            )}

                            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>|</Text>

                            {/* Stock Label */}
                            <View style={{ opacity: 0.9 }}>
                              {renderStockLabel(reward.stock)}
                            </View>
                          </View>
                        </View>

                        {/* 3. RIGHT SAFE ZONE: Tag & Edit Actions */}
                        <View style={{ width: 115, paddingVertical: 12, paddingHorizontal: 12, justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 2 }}>
                          {/* Top Right Tag */}
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700', letterSpacing: 0.5, zIndex: 3 }}>
                            {reward.type === 'discount' ? 'DISCOUNT' : 'FREE ITEM'}
                          </Text>

                          {/* Action buttons on bottom right */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 3 }}>
                            <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }} onPress={() => handleOpenEdit(reward)}>
                              <Ionicons name="create-outline" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.3)', alignItems: 'center', justifyContent: 'center' }} onPress={() => handleOpenDelete(reward)}>
                              <Ionicons name="trash-outline" size={14} color="#FCA5A5" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
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

            <View style={{ marginBottom: 24 }} />

            {/* Card Settings & Rules Combined Card */}
            <View style={styles.configCard}>
              <Text style={styles.cardSectionTitle}>{t('card_settings')}</Text>

              {/* Total Stamps */}
              <View style={{ marginTop: 8 }}>
                <Text style={styles.settingsLabel}>{t('total_stamps_required')}</Text>
                <View style={[styles.segmentRow, { marginTop: 8 }]}>
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
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 }} />

              {/* Expiry */}
              <Text style={styles.settingsLabel}>{t('card_expiration_days')}</Text>
              <View style={[styles.inputWrapper, expiryFocused && styles.inputWrapperFocused, { marginTop: 8 }]}>
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

              <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 }} />

              {/* Minimum Spend Requirement */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.settingsLabel}>
                    {locale === 'en' ? 'Minimum Spend per Stamp' : 'Syarat Belanja Minimum'}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                    {locale === 'en'
                      ? 'Require customers to reach a minimum bill amount to earn a stamp.'
                      : 'Syaratkan jumlah bil minimum untuk pelanggan menerima 1 cop.'}
                  </Text>
                </View>
                <Switch
                  value={enableMinSpend}
                  onValueChange={setEnableMinSpend}
                  trackColor={{ false: 'rgba(5, 5, 5, 0.15)', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {enableMinSpend && (
                <View style={[styles.inputWrapper, minSpendFocused && styles.inputWrapperFocused, { marginTop: 12 }]}>
                  <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505', marginRight: 6 }}>RM</Text>
                  <TextInput
                    style={styles.nestedTextInput}
                    value={minSpendAmount}
                    onChangeText={setMinSpendAmount}
                    keyboardType="numeric"
                    placeholder="15.00"
                    placeholderTextColor="#94A3B8"
                    onFocus={() => setMinSpendFocused(true)}
                    onBlur={() => setMinSpendFocused(false)}
                  />
                  <Text style={styles.inputSuffix}>{locale === 'en' ? 'min. bill' : 'bil minimum'}</Text>
                </View>
              )}

              <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 }} />

              {/* Completion Reward Selector */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.settingsLabel}>{t('stamp_completion_desc') || 'Completion Reward'}</Text>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: '#EFF6FF',
                    borderColor: '#93C5FD',
                    borderWidth: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                  }}
                  onPress={() => setShowInlineCreateModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={15} color="#2563EB" />
                  <Text style={{ color: '#2563EB', fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' }}>
                    {locale === 'en' ? '+ Create New Reward' : '+ Cipta Ganjaran Baru'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Reward Selector List / Cards */}
              {rewards && rewards.length > 0 ? (
                <View style={{ marginTop: 10, gap: 8 }}>
                  {rewards.map((rw) => {
                    const isSelected = linkedRewardId === rw.id;
                    return (
                      <TouchableOpacity
                        key={rw.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                          borderRadius: 16,
                          backgroundColor: isSelected ? '#F0F9FF' : '#F8FAFC',
                          borderColor: isSelected ? '#0284C7' : '#E2E8F0',
                          borderWidth: isSelected ? 2 : 1,
                        }}
                        onPress={() => {
                          setLinkedRewardId(rw.id);
                          setRewardDesc(rw.name);
                          setShowValidationWarning(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                          <View style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            backgroundColor: isSelected ? '#0284C7' : '#E2E8F0',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Ionicons name={rw.type === 'discount' ? 'pricetag' : 'gift'} size={18} color={isSelected ? '#FFFFFF' : '#64748B'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }} numberOfLines={1}>
                              {rw.name}
                            </Text>
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }} numberOfLines={1}>
                              {rw.type === 'discount' ? (locale === 'en' ? 'Discount Voucher' : 'Baucar Diskaun') : (locale === 'en' ? 'Free Item Reward' : 'Ganjaran Item Percuma')} • Stock: {rw.stock || 'Unlimited'}
                            </Text>
                          </View>
                        </View>
                        {isSelected && (
                          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#0284C7', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={{ marginTop: 10, padding: 16, borderRadius: 14, backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#92400E', textAlign: 'center', marginBottom: 10, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                    {locale === 'en' ? 'No rewards found in catalog. Create your first reward for this stamp card.' : 'Tiada ganjaran dijumpai dalam katalog. Cipta ganjaran pertama anda untuk kad setem ini.'}
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#D97706', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                    onPress={() => setShowInlineCreateModal(true)}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>+ Create First Reward</Text>
                  </TouchableOpacity>
                </View>
              )}

              {showValidationWarning && (
                <Text style={{ color: '#EF4444', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 6, marginLeft: 4 }}>
                  {locale === 'en' ? 'Please select or create a completion reward' : 'Sila pilih atau cipta ganjaran kelayakan'}
                </Text>
              )}
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

        {/* TAB 3: Points Rules Dashboard */}
        {activeTab === 'points_tiers' && (() => {
          const parsedSpend = parseFloat(spendPerPoint) || 1;
          return (
            <View style={{ marginTop: 12, gap: 16 }}>
              {/* Hero Banner for Points Rule */}
              <View style={[styles.configCard, { backgroundColor: '#1A1400', paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Ionicons name="star" size={28} color="#FFC700" />
                  <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                    RM {parsedSpend} = 1 Point
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                  Example: RM 50.00 spent = {Math.floor(50 / parsedSpend)} points automatically
                </Text>
              </View>

              {/* Points Conversion Rate Card */}
              <View style={styles.configCard}>
                <View style={styles.cardSectionHeader}>
                  <Ionicons name="calculator-outline" size={22} color="#0F172A" />
                  <Text style={styles.cardSectionTitle}>Points Earning Rate</Text>
                </View>
                <Text style={styles.cardSectionDesc}>
                  Set how many Malaysian Ringgit (RM) a customer must spend to earn 1 loyalty point at checkout.
                </Text>

                {/* Quick Presets */}
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 8, letterSpacing: 0.5 }}>
                    QUICK PRESETS
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { label: 'RM 1 = 1 Pt', val: '1' },
                      { label: 'RM 2 = 1 Pt', val: '2' },
                      { label: 'RM 5 = 1 Pt', val: '5' },
                      { label: 'RM 10 = 1 Pt', val: '10' },
                    ].map((preset) => {
                      const isSel = spendPerPoint === preset.val;
                      return (
                        <TouchableOpacity
                          key={preset.val}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 12,
                            backgroundColor: isSel ? '#1A1400' : '#F1F5F9',
                            borderWidth: 1,
                            borderColor: isSel ? '#FFC700' : '#E2E8F0',
                          }}
                          onPress={() => setSpendPerPoint(preset.val)}
                          activeOpacity={0.8}
                        >
                          <Text style={{
                            fontSize: 13,
                            fontFamily: 'PlusJakartaSans_700Bold',
                            color: isSel ? '#FFC700' : '#475569',
                          }}>
                            {preset.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Custom Spend Input */}
                <View style={{ marginTop: 20 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 8, letterSpacing: 0.5 }}>
                    SPEND REQUIRED PER 1 POINT (RM)
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', height: 52, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1' }}>
                    <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginLeft: 16, marginRight: 8 }}>
                      RM
                    </Text>
                    <TextInput
                      style={[{ flex: 1, fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A', paddingVertical: 12 }, Platform.OS === 'web' ? { outlineWidth: 0 } as any : null]}
                      placeholder="e.g. 2"
                      placeholderTextColor="#94A3B8"
                      value={spendPerPoint}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        setSpendPerPoint(cleaned);
                      }}
                      keyboardType="decimal-pad"
                    />
                    <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                        = 1 Point
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Live Simulation Preview */}
                <View style={{ marginTop: 20, backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="sparkles" size={16} color="#D97706" />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                      Live Checkout Simulation
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>Spend RM 20.00</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      +{Math.floor(20 / parsedSpend)} Points
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>Spend RM 50.00</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      +{Math.floor(50 / parsedSpend)} Points
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>Spend RM 100.00</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      +{Math.floor(100 / parsedSpend)} Points
                    </Text>
                  </View>
                </View>

                {/* Save Points Rule Action Button */}
                <TouchableOpacity
                  style={[
                    styles.saveSubmitBtn,
                    { marginTop: 24, backgroundColor: '#050505', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
                    savingPointsRate && { opacity: 0.6 },
                  ]}
                  onPress={handleSavePointsRate}
                  disabled={savingPointsRate}
                  activeOpacity={0.85}
                >
                  {savingPointsRate ? (
                    <ActivityIndicator color="#FFC700" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFC700" style={{ marginRight: 8 }} />
                      <Text style={styles.saveSubmitBtnText}>Save Points Earning Rule</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Informative Tip Card */}
              <View style={styles.tipCard}>
                <View style={styles.tipCardHeader}>
                  <Ionicons name="bulb-outline" size={20} color="#D97706" />
                  <Text style={styles.tipCardTitle}>Points Rate Strategy</Text>
                </View>
                <Text style={styles.tipCardText}>
                  A lower spend requirement (like RM 1 = 1 Point) creates higher customer engagement and excitement, while higher amounts (like RM 5 = 1 Point) work great for higher ticket merchants. You can adjust this anytime without affecting past customer balances.
                </Text>
              </View>
            </View>
          );
        })()}

        {/* TAB 4: Birthday Rewards */}
        {activeTab === 'birthday' && (
            <View style={{ marginTop: 12, gap: 16 }}>
              <View style={styles.configCard}>
                <View style={styles.cardSectionHeader}>
                  <Ionicons name="gift-outline" size={22} color="#0F172A" />
                  <Text style={styles.cardSectionTitle}>Birthday Rewards</Text>
                </View>
                <Text style={styles.cardSectionDesc}>
                  {isMalay
                    ? 'Ganjaran hari lahir diberikan secara automatik kepada pelanggan pada hari lahir mereka.'
                    : 'Automatically reward customers on their birthday with digital vouchers or bonus stamps.'}
                </Text>

                {loadingBirthday ? (
                  <ActivityIndicator size="small" color="#050505" style={{ marginVertical: 20 }} />
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>{isMalay ? 'Jenis Ganjaran' : 'Reward Type'}</Text>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        {[
                          {
                            id: 'voucher_code',
                            icon: 'gift-outline',
                            label: isMalay ? 'Baucar / Hadiah' : 'Voucher / Gift',
                            desc: isMalay ? 'Jana kod baucar digital' : 'Redeemable voucher code',
                            color: '#10B981',
                          },
                          {
                            id: 'stamps',
                            icon: 'star-outline',
                            label: isMalay ? 'Cop Bonus' : 'Bonus Stamps',
                            desc: isMalay ? 'Kredit terus ke kad' : 'Direct to stamp card',
                            color: '#EAB308',
                          },
                        ].map((type) => {
                          const isActive = birthdayForm.reward_type === type.id;
                          return (
                            <TouchableOpacity
                              key={type.id}
                              style={{
                                flex: 1,
                                backgroundColor: isActive ? '#FFFBEB' : '#F8FAFC',
                                borderColor: isActive ? '#FFC700' : '#E2E8F0',
                                borderWidth: 1.5,
                                borderRadius: 16,
                                padding: 14,
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                              onPress={() => {
                                const newType = type.id as any;
                                setBirthdayForm((f) => {
                                  const isStamps = newType === 'stamps';
                                  const defaultTpl = isStamps
                                    ? 'Happy Birthday {{name}}! {{merchant}} has gifted you {{title}} directly to your stamp card! Check your card anytime at {{login_link}}.'
                                    : 'Happy Birthday {{name}}! {{merchant}} has a special treat for you: {{title}}. Show this code at the counter: {{code}}. Valid until {{expiry}}.';
                                  return {
                                    ...f,
                                    reward_type: newType,
                                    reward_value: '',
                                    title: '',
                                    message_template: defaultTpl,
                                  };
                                });
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={{ backgroundColor: isActive ? '#FFC700' : '#FFFFFF', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', shadowColor: isActive ? '#FFC700' : '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isActive ? 0.2 : 0.05, shadowRadius: 4, elevation: 2 }}>
                                <Ionicons name={type.icon as any} size={22} color={isActive ? '#1A1400' : type.color} />
                              </View>
                              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: isActive ? '#1A1400' : '#0F172A', textAlign: 'center' }}>
                                {type.label}
                              </Text>
                              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center' }}>
                                {type.desc}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>
                        {birthdayForm.reward_type === 'stamps'
                          ? (isMalay ? 'Berapa banyak cop bonus?' : 'How many bonus stamps?')
                          : (isMalay ? 'Apakah tawaran / hadiah percuma?' : "What's the offer / gift?")}
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        value={birthdayForm.reward_value}
                        onChangeText={(text) => {
                          if (birthdayForm.reward_type === 'stamps') {
                            const cleaned = text.replace(/[^0-9]/g, '');
                            setBirthdayForm((f) => ({
                              ...f,
                              reward_value: cleaned,
                              title: cleaned ? `${cleaned} Free Stamp${Number(cleaned) > 1 ? 's' : ''}` : '',
                              description: cleaned ? `Birthday Reward: ${cleaned} free stamp${Number(cleaned) > 1 ? 's' : ''}` : '',
                            }));
                          } else {
                            setBirthdayForm((f) => ({
                              ...f,
                              reward_value: text,
                              title: text,
                              description: `Birthday special: ${text}`,
                            }));
                          }
                        }}
                        placeholder={birthdayForm.reward_type === 'stamps' ? 'e.g. 2' : 'e.g. Free Coffee / 15% Off'}
                        placeholderTextColor="#94A3B8"
                        keyboardType={birthdayForm.reward_type === 'stamps' ? 'number-pad' : 'default'}
                      />
                      <Text style={styles.helpText}>
                        {birthdayForm.reward_type === 'stamps'
                          ? (isMalay
                              ? 'Cop akan dikreditkan secara automatik ke kad cop digital pelanggan pada hari lahir mereka.'
                              : "Stamps will be credited directly to the customer's digital card on their birthday.")
                          : (isMalay
                              ? 'Pelanggan akan menerima kod baucar unik (cth: BDAY-XXXX) untuk ditebus di kedai.'
                              : 'Customer receives a unique voucher code (e.g. BDAY-XXXX) to show in-store.')}
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



      {/* Save Reward Modal (Refined Reference Layout) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}>
          <View style={{
            width: '100%',
            maxWidth: 520,
            maxHeight: '90%',
            backgroundColor: '#FFFFFF',
            borderRadius: 28,
            padding: 24,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 10,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, paddingRight: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="gift" size={24} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    {editingReward ? (locale === 'en' ? 'Edit Reward' : 'Sunting Ganjaran') : (locale === 'en' ? 'Create Reward' : 'Cipta Ganjaran')}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2, lineHeight: 16 }}>
                    {locale === 'en' ? 'Add a reward to your catalog and link it to your loyalty programs.' : 'Tambah ganjaran ke katalog dan hubungkan ke program kesetiaan anda.'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>

              {/* 🎫 Live Customer Ticket Voucher Preview */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  🎫 Live Customer Voucher Preview
                </Text>
                <View style={{
                  height: 140,
                  borderRadius: 18,
                  backgroundColor: '#0B0F17',
                  flexDirection: 'row',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                  position: 'relative',
                }}>
                  {/* 1. LEFT ZONE: Merchant Identity ONLY */}
                  <View style={{ width: 95, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 3,
                      elevation: 2,
                      marginBottom: 4,
                    }}>
                      <Image source={{ uri: merchantLogo }} style={{ width: 42, height: 42, borderRadius: 21, resizeMode: 'cover' }} />
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', textAlign: 'center', width: '100%' }} numberOfLines={1}>
                      {merchant?.name || 'Your Store'}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', textAlign: 'center', width: '100%', marginTop: 1 }} numberOfLines={1}>
                      {merchant?.category || 'food'}
                    </Text>
                  </View>

                  {/* CENTER DIVIDER: Ticket Notches & Dotted Line */}
                  <View style={{ width: 14, alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    <View style={{ width: 14, height: 7, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, backgroundColor: '#FFFFFF', position: 'absolute', top: 0, zIndex: 5 }} />
                    <View style={{ width: 1, height: '100%', borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1, borderStyle: 'dashed' }} />
                    <View style={{ width: 14, height: 7, borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: '#FFFFFF', position: 'absolute', bottom: 0, zIndex: 5 }} />
                  </View>

                  {/* 2. CENTER ZONE: Reward Information */}
                  <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                    <View style={{ zIndex: 2 }}>
                      <View style={{ backgroundColor: '#FFC700', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 100, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                        <Ionicons name="gift" size={10} color="#000000" />
                        <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>Ready to redeem</Text>
                      </View>

                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: -0.3, lineHeight: 18 }} numberOfLines={2}>
                        {formTitle || 'FREE AISKRIM Premium 3 scoop'}
                      </Text>
                      <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 2, lineHeight: 14 }} numberOfLines={1}>
                        {formType === 'discount' ? (formDiscountType === 'percentage' ? `${formDiscountValue || 'XX'}% OFF offer` : `RM ${formDiscountValue || 'XX'} OFF offer`) : 'Reward for completing store card'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 2 }}>
                      <View style={{ backgroundColor: '#2563EB', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="card" size={9} color="#FFFFFF" />
                        <Text style={{ fontSize: 7.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: 0.3 }}>STAMP CARD REWARD</Text>
                      </View>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>|</Text>
                      <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>
                        Stock: <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981' }}>Unlimited</Text>
                      </Text>
                    </View>
                  </View>

                  {/* 3. RIGHT SAFE ZONE: Tag & Use Voucher CTA */}
                  <View style={{ width: 115, paddingVertical: 10, paddingHorizontal: 10, justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 2 }}>
                    {/* Top Right Tag */}
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700', letterSpacing: 0.5, zIndex: 3 }}>
                      {formType === 'discount' ? `${formDiscountValue || '20'}% OFF` : 'FREE ITEM'}
                    </Text>

                    {/* Bottom Right CTA Button */}
                    <View style={{ height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
                      <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }} numberOfLines={1}>Use Voucher ➔</Text>
                    </View>
                  </View>
                </View>
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

              {/* Dynamic Inputs based on Reward Type */}
              {formType === 'free_item' ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Quantity' : 'Kuantiti'}
                  </Text>
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name="cube" size={18} color="#64748B" style={{ marginRight: 10 }} />
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
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 12, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
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

              {/* PRO Link Product / Service Section */}
              <View style={{
                borderRadius: 18,
                backgroundColor: isPro ? '#F8FAFC' : '#FAF5FF',
                borderColor: isPro ? '#E2E8F0' : '#E9D5FF',
                borderWidth: 1,
                padding: 14,
                marginBottom: 20,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name={isPro ? "link" : "lock-closed"} size={16} color={isPro ? "#3B82F6" : "#8B5CF6"} />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1E293B' }}>
                      Link Product or Service {!isPro && '— PRO'}
                    </Text>
                  </View>
                  {!isPro && (
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: '#8B5CF6',
                      }}
                      onPress={() => setShowUpgradeModal(true)}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Upgrade</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', lineHeight: 16, marginBottom: 10 }}>
                  {isPro
                    ? 'Select specific services or products that this reward applies to during counter checkout.'
                    : 'Automatically apply rewards and calculate discounts during counter checkout.'}
                </Text>

                {isPro ? (
                  merchantServicesList.length === 0 ? (
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', fontStyle: 'italic' }}>
                      No active products or services found in your catalog.
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {merchantServicesList.map((item) => {
                        const isSelected = formSelectedLinkedItemIds.includes(item.id);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 10,
                              backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                              borderColor: isSelected ? '#3B82F6' : '#CBD5E1',
                              borderWidth: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}
                            onPress={() => {
                              setFormSelectedLinkedItemIds(prev =>
                                isSelected ? prev.filter(id => id !== item.id) : [...prev, item.id]
                              );
                            }}
                          >
                            <Ionicons
                              name={isSelected ? "checkbox" : "square-outline"}
                              size={14}
                              color={isSelected ? "#3B82F6" : "#64748B"}
                            />
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: isSelected ? '#1E40AF' : '#334155' }}>
                              {item.name} (RM {parseFloat(item.price || 0).toFixed(2)})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )
                ) : null}
              </View>

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

              {/* Action Buttons Row */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 50,
                    borderRadius: 16,
                    backgroundColor: '#F8FAFC',
                    borderColor: '#E2E8F0',
                    borderWidth: 1.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#1E293B', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 }}>
                    {locale === 'en' ? 'Cancel' : 'Batal'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 50,
                    borderRadius: 16,
                    backgroundColor: '#F59E0B',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#F59E0B',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                    elevation: 3,
                  }}
                  onPress={handleSaveReward}
                  disabled={isSavingReward}
                  activeOpacity={0.85}
                >
                  {isSavingReward ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <Text style={{ color: '#000000', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14 }}>
                      {editingReward ? (locale === 'en' ? 'Save changes' : 'Simpan perubah') : (locale === 'en' ? 'Create reward' : 'Cipta ganjaran')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
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

      {/* Refined Create Reward Modal (Exact Match to Reference Design) */}
      <Modal
        visible={showInlineCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInlineCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 440, width: '92%', padding: 24, borderRadius: 28, backgroundColor: '#FFFFFF' }]}>
            {/* Header Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, paddingRight: 8 }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="gift-outline" size={24} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    {locale === 'en' ? 'Create Reward' : 'Cipta Ganjaran'}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2, lineHeight: 16 }}>
                    {locale === 'en' ? 'Add a reward to your catalog and link it to your loyalty programs.' : 'Tambah ganjaran ke katalog dan hubungkan ke program kesetiaan anda.'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowInlineCreateModal(false)}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* 🎫 Live Customer Ticket Voucher Preview */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  🎫 Live Customer Voucher Preview
                </Text>
                <View style={{
                  height: 140,
                  borderRadius: 18,
                  backgroundColor: '#0B0F17',
                  flexDirection: 'row',
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                  position: 'relative',
                }}>
                  {/* 1. LEFT ZONE: Merchant Identity ONLY */}
                  <View style={{ width: 95, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 3,
                      elevation: 2,
                      marginBottom: 4,
                    }}>
                      <Image source={{ uri: merchantLogo }} style={{ width: 42, height: 42, borderRadius: 21, resizeMode: 'cover' }} />
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', textAlign: 'center', width: '100%' }} numberOfLines={1}>
                      {merchant?.name || 'Your Store'}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', textAlign: 'center', width: '100%', marginTop: 1 }} numberOfLines={1}>
                      {merchant?.category || 'food'}
                    </Text>
                  </View>

                  {/* CENTER DIVIDER: Ticket Notches & Dotted Line */}
                  <View style={{ width: 14, alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    <View style={{ width: 14, height: 7, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, backgroundColor: '#FFFFFF', position: 'absolute', top: 0, zIndex: 5 }} />
                    <View style={{ width: 1, height: '100%', borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1, borderStyle: 'dashed' }} />
                    <View style={{ width: 14, height: 7, borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: '#FFFFFF', position: 'absolute', bottom: 0, zIndex: 5 }} />
                  </View>

                  {/* 2. CENTER ZONE: Reward Information */}
                  <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                    <View style={{ zIndex: 2 }}>
                      <View style={{ backgroundColor: '#FFC700', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 100, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                        <Ionicons name="gift" size={10} color="#000000" />
                        <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>Ready to redeem</Text>
                      </View>

                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: -0.3, lineHeight: 18 }} numberOfLines={2}>
                        {inlineTitle || 'FREE AISKRIM Premium 3 scoop'}
                      </Text>
                      <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 2, lineHeight: 14 }} numberOfLines={1}>
                        {inlineType === 'discount' ? (inlineDiscountType === 'percentage' ? `${inlineDiscountValue || 'XX'}% OFF offer` : `RM ${inlineDiscountValue || 'XX'} OFF offer`) : 'Reward for completing store card'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 2 }}>
                      <View style={{ backgroundColor: '#2563EB', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="card" size={9} color="#FFFFFF" />
                        <Text style={{ fontSize: 7.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: 0.3 }}>STAMP CARD REWARD</Text>
                      </View>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>|</Text>
                      <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>
                        Stock: <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981' }}>Unlimited</Text>
                      </Text>
                    </View>
                  </View>

                  {/* 3. RIGHT SAFE ZONE: Tag, Image Overlay & Use Voucher CTA */}
                  {/* 3. RIGHT SAFE ZONE: Tag & Use Voucher CTA */}
                  <View style={{ width: 115, paddingVertical: 10, paddingHorizontal: 10, justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 2 }}>
                    {/* Top Right Tag */}
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700', letterSpacing: 0.5, zIndex: 3 }}>
                      {inlineType === 'discount' ? `${inlineDiscountValue || '20'}% OFF` : 'FREE ITEM'}
                    </Text>

                    {/* Bottom Right CTA Button */}
                    <View style={{ height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
                      <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }} numberOfLines={1}>Use Voucher ➔</Text>
                    </View>
                  </View>
                </View>
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

              {/* Dynamic Inputs based on Reward Type */}
              {inlineType === 'free_item' ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', marginBottom: 6 }}>
                    {locale === 'en' ? 'Quantity' : 'Kuantiti'}
                  </Text>
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Ionicons name="cube" size={18} color="#64748B" style={{ marginRight: 10 }} />
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
                  <View style={[styles.inputWrapper, { height: 48, borderRadius: 14, marginBottom: 12, paddingHorizontal: 14, backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
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

              {/* PRO Link Product / Service Section */}
              <View style={{
                borderRadius: 18,
                backgroundColor: isPro ? '#F8FAFC' : '#FAF5FF',
                borderColor: isPro ? '#E2E8F0' : '#E9D5FF',
                borderWidth: 1,
                padding: 14,
                marginBottom: 20,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name={isPro ? "link" : "lock-closed"} size={16} color={isPro ? "#3B82F6" : "#8B5CF6"} />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1E293B' }}>
                      Link Product or Service {!isPro && '— PRO'}
                    </Text>
                  </View>
                  {!isPro && (
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: '#8B5CF6',
                      }}
                      onPress={() => setShowUpgradeModal(true)}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Upgrade</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', lineHeight: 16, marginBottom: 10 }}>
                  {isPro
                    ? 'Select specific services or products that this reward applies to during counter checkout.'
                    : 'Automatically apply rewards and calculate discounts during counter checkout.'}
                </Text>

                {isPro ? (
                  merchantServicesList.length === 0 ? (
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', fontStyle: 'italic' }}>
                      No active products or services found in your catalog.
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {merchantServicesList.map((item) => {
                        const isSelected = selectedLinkedItemIds.includes(item.id);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 10,
                              backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                              borderColor: isSelected ? '#3B82F6' : '#CBD5E1',
                              borderWidth: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}
                            onPress={() => {
                              setSelectedLinkedItemIds(prev =>
                                isSelected ? prev.filter(id => id !== item.id) : [...prev, item.id]
                              );
                            }}
                          >
                            <Ionicons
                              name={isSelected ? "checkbox" : "square-outline"}
                              size={14}
                              color={isSelected ? "#3B82F6" : "#64748B"}
                            />
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: isSelected ? '#1E40AF' : '#334155' }}>
                              {item.name} (RM {parseFloat(item.price || 0).toFixed(2)})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )
                ) : null}
              </View>

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

              {/* Action Buttons Row */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 50,
                    borderRadius: 16,
                    backgroundColor: '#F8FAFC',
                    borderColor: '#E2E8F0',
                    borderWidth: 1.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => setShowInlineCreateModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#1E293B', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 }}>
                    {locale === 'en' ? 'Cancel' : 'Batal'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 50,
                    borderRadius: 16,
                    backgroundColor: '#F59E0B',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#F59E0B',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                    elevation: 3,
                  }}
                  onPress={handleCreateInlineReward}
                  disabled={isSavingInlineReward}
                  activeOpacity={0.85}
                >
                  {isSavingInlineReward ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <Text style={{ color: '#000000', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14 }}>
                      {locale === 'en' ? 'Create reward' : 'Cipta ganjaran'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
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
  modulesConfigCard: {
    backgroundColor: '#FFC700',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  modulesCardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: 0.3,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
  },
  moduleName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  moduleDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
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
