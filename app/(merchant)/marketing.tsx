import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Image,
  Dimensions,
  Alert as RNAlert,
  Platform,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome, MaterialIcons, Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import { useRouter, usePathname } from 'expo-router';
// @ts-ignore
import * as ImagePicker from 'expo-image-picker';
import SmartFollowUp from './_components/SmartFollowUp';
import TemplateStudio, { WhatsAppTemplate } from './_components/TemplateStudio';



const { width } = Dimensions.get('window');

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
  { label: 'Silver', value: '#D1D5DB' },
  { label: 'Slate', value: '#1E293B' },
  { label: 'Gold', value: '#FFD700' },
  { label: 'Rose', value: '#F43F5E' },
];

export default function MarketingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale } = useLanguage();
  const pathname = usePathname();
  const isFocused = pathname.includes('marketing');
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const insets = useSafeAreaInsets();
  
  const [merchant, setMerchant] = useState<any>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  
  // Campaign configuration states
  const [isActive, setIsActive] = useState(true);
  const [requiredStamps, setRequiredStamps] = useState<5 | 10 | 15>(10);
  const [expiryDays, setExpiryDays] = useState('30');
  const [rewardDesc, setRewardDesc] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>('coffee');
  const [cardColor, setCardColor] = useState<string>('#050505');
  const [customHexInput, setCustomHexInput] = useState<string>('#050505');
  const [stampColor, setStampColor] = useState<string>('#3B82F6');
  const [customStampHexInput, setCustomStampHexInput] = useState<string>('#3B82F6');
  const [fontColor, setFontColor] = useState<string>('#FFFFFF');
  const [customFontHexInput, setCustomFontHexInput] = useState<string>('#FFFFFF');
  const [bgImage, setBgImage] = useState<string>('');
  const [bgFile, setBgFile] = useState<any>(null);
  const [removeBgImage, setRemoveBgImage] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessNotice, setShowSuccessNotice] = useState(false);

  // States to track input focuses
  const [expiryFocused, setExpiryFocused] = useState(false);
  const [rewardFocused, setRewardFocused] = useState(false);

  const [subTab, setSubTab] = useState<'campaigns' | 'blast' | 'followup' | 'templates'>('campaigns');
  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [launchSuccessModalVisible, setLaunchSuccessModalVisible] = useState(false);

  // Broadcast & WhatsApp Blast states
  const [broadcastsList, setBroadcastsList] = useState<any[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [whatsappQr, setWhatsappQr] = useState<string>('');
  const [bCampaignId, setBCampaignId] = useState('');
  const [bTitle, setBTitle] = useState('Exclusive Promotion! 🎁');
  const [bImageUrl, setBImageUrl] = useState('');
  const [bBtnText, setBBtnText] = useState('');
  const [bBtnUrl, setBBtnUrl] = useState('');
  const [bMessage, setBMessage] = useState('Hi {{name}}! 👋\n\nWe have a special promotion just for you. You currently have {{stamps}} stamps on your loyalty card. Don\'t miss out on earning more rewards this week! ✨');

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setBImageUrl(result.assets[0].uri);
    }
  };
  const [bSendWhatsApp, setBSendWhatsApp] = useState(false);
  const [isSendingBlast, setIsSendingBlast] = useState(false);
  const [blastStep, setBlastStep] = useState<1 | 2 | 3>(1);
  const [blastSubTab, setBlastSubTab] = useState<'create' | 'running' | 'history'>('create');
  const [selectedSegment, setSelectedSegment] = useState<'all' | 'spenders' | 'inactive' | 'visitors' | 'custom'>('all');
  const [isSegmentDropdownOpen, setIsSegmentDropdownOpen] = useState(false);
  const [customAudienceIds, setCustomAudienceIds] = useState<string[]>([]);
  const [showCustomAudienceModal, setShowCustomAudienceModal] = useState(false);
  const [caTab, setCaTab] = useState<'manual' | 'rules' | 'paste'>('manual');
  const [caManualSelection, setCaManualSelection] = useState<Set<string>>(new Set());
  const [caMinStamps, setCaMinStamps] = useState<string>('');
  const [caStartDate, setCaStartDate] = useState<string>('');
  const [caEndDate, setCaEndDate] = useState<string>('');
  const [caPasteText, setCaPasteText] = useState<string>('');
  
  const [dbCards, setDbCards] = useState<any[]>([]);
  const [dbTxs, setDbTxs] = useState<any[]>([]);
  const [dbAllCustomers, setDbAllCustomers] = useState<any[]>([]);

  const targetCustomerIds = React.useMemo(() => {
    const allCustomerIds = new Set<string>([
      ...dbCards.map((c: any) => c.customer),
      ...dbTxs.map((t: any) => t.customer)
    ].filter(Boolean));

    if (selectedSegment === 'custom') {
      return customAudienceIds;
    }

    if (selectedSegment === 'all') {
      return dbAllCustomers.map((u: any) => u.id).filter(Boolean);
    }

    if (selectedSegment === 'inactive') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const lastTxMap: Record<string, number> = {};
      dbTxs.forEach(t => {
        if (!t.customer) return;
        const time = new Date(t.created).getTime();
        if (!lastTxMap[t.customer] || time > lastTxMap[t.customer]) {
          lastTxMap[t.customer] = time;
        }
      });
      return Array.from(allCustomerIds).filter(cid => {
        const lastTxTime = lastTxMap[cid] || 0;
        return lastTxTime < thirtyDaysAgo;
      });
    }

    const statsMap: Record<string, { totalSpend: number; visits: number }> = {};
    dbTxs.forEach(t => {
      if (!t.customer) return;
      if (!statsMap[t.customer]) {
        statsMap[t.customer] = { totalSpend: 0, visits: 0 };
      }
      statsMap[t.customer].visits += 1;
      if ((t.type === 'PURCHASE' || t.type === 'earn') && t.bill_amount) {
        statsMap[t.customer].totalSpend += Number(t.bill_amount);
      }
    });

    if (selectedSegment === 'spenders') {
      const sorted = Array.from(allCustomerIds).sort((a, b) => {
        const spendA = statsMap[a]?.totalSpend || 0;
        const spendB = statsMap[b]?.totalSpend || 0;
        return spendB - spendA;
      });
      return sorted.slice(0, 10);
    }

    if (selectedSegment === 'visitors') {
      const sorted = Array.from(allCustomerIds).sort((a, b) => {
        const visA = statsMap[a]?.visits || 0;
        const visB = statsMap[b]?.visits || 0;
        return visB - visA;
      });
      return sorted.slice(0, 10);
    }

    return Array.from(allCustomerIds);
  }, [dbCards, dbTxs, selectedSegment, customAudienceIds]);

  const rulesMatchCount = React.useMemo(() => {
    let count = 0;
    
    let minStamps = 0;
    let maxStamps = Infinity;
    if (caMinStamps.includes('-')) {
      const parts = caMinStamps.split('-');
      minStamps = parseInt(parts[0]) || 0;
      maxStamps = parseInt(parts[1]) || Infinity;
    } else {
      minStamps = parseInt(caMinStamps) || 0;
    }

    const startTs = caStartDate ? new Date(caStartDate).getTime() : 0;
    const endTs = caEndDate ? new Date(caEndDate).getTime() + (24 * 60 * 60 * 1000) - 1 : Infinity;

    const lastVisitMap: Record<string, number> = {};
    dbTxs.forEach(t => {
      if (!t.customer) return;
      const time = new Date(t.created).getTime();
      if (!lastVisitMap[t.customer] || time > lastVisitMap[t.customer]) {
        lastVisitMap[t.customer] = time;
      }
    });

    dbCards.forEach(c => {
      if (c.customer) {
        const userStamps = c.stamps || c.stamps_collected || 0;
        const stampPass = (minStamps === 0 && maxStamps === Infinity) ? true : (userStamps >= minStamps && userStamps <= maxStamps);
        const lastV = lastVisitMap[c.customer] || 0;
        const hasDateRule = caStartDate || caEndDate;
        const datePass = !hasDateRule || (lastV >= startTs && lastV <= endTs);
        
        if (stampPass && datePass) {
          count++;
        }
      }
    });
    return count;
  }, [caMinStamps, caStartDate, caEndDate, dbCards, dbTxs]);

  const audienceEstimate = targetCustomerIds.length;

  // Automated winback rules states
  const [broadcastMode, setBroadcastMode] = useState<'manual' | 'automated' | 'smart'>('manual');
  const [automationRules, setAutomationRules] = useState<any[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<any | null>(null);
  const [arName, setArName] = useState('');
  const [arTriggerDays, setArTriggerDays] = useState<string>('7');
  const [arTitle, setArTitle] = useState('We Miss You! ❤️');
  const [arMessage, setArMessage] = useState('Hi {{name}}! 👋\n\nIt\'s been a while since your last visit. Come back soon to collect your next stamp! ✨');
  const [arSendWhatsApp, setArSendWhatsApp] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [activeFollowUpParent, setActiveFollowUpParent] = useState<any | null>(null);

  // Check for recent broadcasts to enforce 24-hour cooldown
  const lastBroadcast = broadcastsList.length > 0 ? broadcastsList[0] : null;
  const hasCooldown = lastBroadcast ? (Date.now() - new Date(lastBroadcast.created).getTime()) < 24 * 60 * 60 * 1000 : false;
  const cooldownHoursLeft = lastBroadcast ? Math.max(0, Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - new Date(lastBroadcast.created).getTime())) / (60 * 60 * 1000))) : 0;

  // Custom Confirm Alert Modal states
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmButtons, setConfirmButtons] = useState<any[]>([]);

  const Alert = {
    alert: (title: string, message?: string, buttons?: any[]) => {
      setConfirmTitle(title);
      setConfirmMsg(message || '');
      setConfirmButtons(buttons || [{ text: 'OK', onPress: () => {} }]);
      setConfirmVisible(true);
    }
  };

  // New Campaign Form States
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cType, setCType] = useState<'voucher_discount' | 'bonus_stamps' | 'double_points' | 'flat_bonus'>('voucher_discount');
  const [cCMultiplier, setCMultiplier] = useState('2');
  const [cBonusValue, setCBonusValue] = useState('0');
  const [cVoucherDiscountType, setCVoucherDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [cVoucherDiscountVal, setCVoucherDiscountVal] = useState('5');
  const [cVoucherMinSpend, setCVoucherMinSpend] = useState('');
  const [cVoucherPrefix, setCVoucherPrefix] = useState('PROMO');
  const [cVoucherAudience, setCVoucherAudience] = useState<'all' | 'spenders' | 'inactive' | 'visitors' | 'custom'>('all');
  const [cVoucherAutoDrop, setCVoucherAutoDrop] = useState(true);
  const [cVoucherAutoBlast, setCVoucherAutoBlast] = useState(false);
  const [cStartDate, setCStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [cEndDate, setCEndDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [cMaxRedemptions, setCMaxRedemptions] = useState('');
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  const activeIconObj = stampIcons.find((i) => i.id === selectedIcon) || stampIcons[0];

  const fetchCampaigns = async () => {
    if (!user || !user.merchant_id) return;
    try {
      setLoadingCampaigns(true);
      const records = await pb.collection('campaigns').getFullList({
        filter: `merchant = "${user.merchant_id}"`,
        sort: '-created'
      });
      setCampaignsList(records);
    } catch (err) {
      console.warn('Failed to fetch campaigns list:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const getCampaignStatus = (campaign: any): 'upcoming' | 'active' | 'ended' => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(campaign.start_date);
    const end = new Date(campaign.end_date);
    if (today < start) return 'upcoming';
    if (today > end) return 'ended';
    return 'active';
  };

  const getTargetCustomerIdsForAudience = (aud: 'all' | 'spenders' | 'inactive' | 'visitors' | 'custom') => {
    if (aud === 'all') {
      return dbAllCustomers.map((u: any) => u.id).filter(Boolean);
    }

    const allCustomerIds = new Set<string>([
      ...dbCards.map((c: any) => c.customer),
      ...dbTxs.map((t: any) => t.customer)
    ].filter(Boolean));

    if (aud === 'custom') {
      return customAudienceIds;
    }

    if (aud === 'inactive') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const lastTxMap: Record<string, number> = {};
      dbTxs.forEach(t => {
        if (!t.customer) return;
        const time = new Date(t.created).getTime();
        if (!lastTxMap[t.customer] || time > lastTxMap[t.customer]) {
          lastTxMap[t.customer] = time;
        }
      });
      return Array.from(allCustomerIds).filter(cid => {
        const lastTxTime = lastTxMap[cid] || 0;
        return lastTxTime < thirtyDaysAgo;
      });
    }

    const statsMap: Record<string, { totalSpend: number; visits: number }> = {};
    dbTxs.forEach(t => {
      if (!t.customer) return;
      if (!statsMap[t.customer]) {
        statsMap[t.customer] = { totalSpend: 0, visits: 0 };
      }
      statsMap[t.customer].visits += 1;
      if ((t.type === 'PURCHASE' || t.type === 'earn') && t.bill_amount) {
        statsMap[t.customer].totalSpend += Number(t.bill_amount);
      }
    });

    if (aud === 'spenders') {
      const sorted = Array.from(allCustomerIds).sort((a, b) => {
        const spendA = statsMap[a]?.totalSpend || 0;
        const spendB = statsMap[b]?.totalSpend || 0;
        return spendB - spendA;
      });
      return sorted.slice(0, 10);
    }

    if (aud === 'visitors') {
      const sorted = Array.from(allCustomerIds).sort((a, b) => {
        const visA = statsMap[a]?.visits || 0;
        const visB = statsMap[b]?.visits || 0;
        return visB - visA;
      });
      return sorted.slice(0, 10);
    }

    return Array.from(allCustomerIds);
  };

  const handleCreateCampaign = async () => {
    if (!user || !user.merchant_id) return;
    setShowValidationWarning(false);
    if (!cName.trim()) {
      setShowValidationWarning(true);
      return;
    }
    
    setIsCreatingCampaign(true);
    try {
      // Check if there are any active points rewards if launching a points promotion
      if (cType === 'double_points' || cType === 'flat_bonus') {
        const prog = await pb.collection('loyalty_programs')
          .getFirstListItem(`merchant = "${user.merchant_id}"`)
          .catch(() => null);
        const linkedRewardId = prog?.linked_reward || null;

        let filterStr = `merchant = "${user.merchant_id}" && is_active = true && points_cost > 0`;
        if (linkedRewardId) {
          filterStr += ` && id != "${linkedRewardId}"`;
        }

        const activePointsRewards = await pb.collection('rewards').getList(1, 1, {
          filter: filterStr
        });
        if (activePointsRewards.items.length === 0) {
          Alert.alert(
            locale === 'en' ? "Points Rewards Required" : "Ganjaran Mata Diperlukan",
            locale === 'en'
              ? "You must have at least one active reward that costs points in your Catalogue before you can launch points-based promotions (Double Points or Flat Bonus)."
              : "Anda mesti mempunyai sekurang-kurangnya satu ganjaran aktif yang memerlukan mata dalam Katalog anda sebelum anda boleh melancarkan promosi berasaskan mata (Mata Berganda atau Bonus Rata)."
          );
          setIsCreatingCampaign(false);
          return;
        }
      }

      const payload: any = {
        merchant: user.merchant_id,
        name: cName.trim(),
        description: cDesc.trim(),
        type: cType === 'voucher_discount' ? 'free_item' : cType,
        start_date: new Date(cStartDate).toISOString(),
        end_date: new Date(cEndDate).toISOString(),
        is_active: true,
      };

      if (cType === 'voucher_discount') {
        payload.bonus_value = parseFloat(cVoucherDiscountVal) || 0;
        payload.description = JSON.stringify({
          real_type: 'voucher_discount',
          discount_type: cVoucherDiscountType,
          discount_value: cVoucherDiscountVal,
          min_spend: cVoucherMinSpend,
          prefix: cVoucherPrefix,
          description: cDesc.trim(),
        });
      } else if (cType === 'double_points') {
        payload.multiplier = parseFloat(cCMultiplier) || 2.0;
      } else if (cType === 'bonus_stamps') {
        payload.bonus_value = parseInt(cBonusValue, 10) || 1;
      } else if (cType === 'flat_bonus') {
        payload.bonus_value = parseInt(cBonusValue, 10) || 50;
      }

      if (cMaxRedemptions.trim()) {
        payload.max_redemptions = parseInt(cMaxRedemptions, 10) || 0;
      }

      const campaignRecord = await pb.collection('campaigns').create(payload);

      // If it's a voucher promo and auto-drop or distribution is enabled
      if (cType === 'voucher_discount') {
        let rewardRecord: any = null;
        try {
          rewardRecord = await pb.collection('rewards').create({
            merchant: user.merchant_id,
            name: cName.trim(),
            description: cDesc.trim() || `${cVoucherDiscountType === 'percentage' ? cVoucherDiscountVal + '%' : 'RM ' + cVoucherDiscountVal} OFF Promo Voucher`,
            points_cost: 1,
            type: 'discount',
            is_active: true,
            stock: 9999,
          });
        } catch (rErr) {
          console.warn('Failed to create reward item for voucher campaign:', rErr);
        }

        if (cVoucherAutoDrop && rewardRecord) {
          const audienceIds = getTargetCustomerIdsForAudience(cVoucherAudience);
          const prefix = (cVoucherPrefix || 'PROMO').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          
          try {
            await pb.send('/api/risev/merchant/campaigns/auto-drop', {
              method: 'POST',
              body: {
                campaign_id: campaignRecord.id,
                reward_id: rewardRecord.id,
                prefix: prefix,
                audience: cVoucherAudience,
                customer_ids: audienceIds,
                discount_type: cVoucherDiscountType,
                discount_value: cVoucherDiscountVal,
                min_spend: cVoucherMinSpend,
                expires_at: new Date(cEndDate).toISOString(),
              }
            });
          } catch (autoDropErr) {
            console.warn('Backend auto-drop API error, falling back to direct creation:', autoDropErr);
            await Promise.all(
              audienceIds.map(async (custId) => {
                try {
                  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
                  const uniqueCode = `${prefix}-${randSuffix}`;
                  await pb.collection('vouchers').create({
                    customer: custId,
                    reward: rewardRecord.id,
                    code: uniqueCode,
                    status: 'active',
                    expires_at: new Date(cEndDate).toISOString(),
                    metadata: {
                      campaign_id: campaignRecord.id,
                      discount_type: cVoucherDiscountType,
                      discount_value: cVoucherDiscountVal,
                      min_spend: cVoucherMinSpend,
                    }
                  });
                } catch (vErr) {
                  console.warn(`Failed to auto-issue voucher to ${custId}:`, vErr);
                }
              })
            );
          }
        }

        if (cVoucherAutoBlast) {
          const discountStr = cVoucherDiscountType === 'percentage' ? `${cVoucherDiscountVal}%` : `RM ${cVoucherDiscountVal}`;
          setBTitle(cName.trim());
          setBMessage(
            locale === 'en'
              ? `Hi {{name}}! 👋\n\nEnjoy our special promo: *${cName.trim()}* (${discountStr} OFF)!\nShow this voucher code at our cashier to claim: {{code}}\n\nValid until ${new Date(cEndDate).toLocaleDateString()}. See you soon! ✨`
              : `Hai {{name}}! 👋\n\nNikmati promosi istimewa kami: *${cName.trim()}* (${discountStr} OFF)!\nTunjukkan kod baucar ini di kaunter untuk menebus: {{code}}\n\nSah sehingga ${new Date(cEndDate).toLocaleDateString()}. Jumpa anda di kedai! ✨`
          );
          setSelectedSegment(cVoucherAudience);
          setSubTab('blast');
        }
      }

      setLaunchSuccessModalVisible(true);
      setCreateModalVisible(false);
      
      // Reset form fields
      setCName('');
      setCDesc('');
      setCType('voucher_discount');
      setCVoucherDiscountVal('5');
      setCVoucherMinSpend('');
      setCVoucherPrefix('PROMO');
      setCMultiplier('2');
      setCBonusValue('0');
      setCStartDate(new Date().toISOString().split('T')[0]);
      setCEndDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
      setCMaxRedemptions('');
      
      fetchCampaigns();
    } catch (err: any) {
      console.warn(err);
      Alert.alert('Error', err.message || 'Failed to create campaign.');
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  const toggleCampaignActive = async (campaign: any) => {
    try {
      await pb.collection('campaigns').update(campaign.id, {
        is_active: !campaign.is_active
      });
      fetchCampaigns();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update campaign state.');
    }
  };

  const handleDeleteCampaign = (campaign: any) => {
    Alert.alert(
      locale === 'en' ? 'Delete Promotion?' : 'Padam Promosi?',
      locale === 'en'
        ? `Are you sure you want to permanently delete "${campaign.name}"? This action cannot be undone.`
        : `Adakah anda pasti ingin memadamkan "${campaign.name}" secara kekal? Tindakan ini tidak boleh diundur.`,
      [
        {
          text: locale === 'en' ? 'Cancel' : 'Batal',
          style: 'cancel'
        },
        {
          text: locale === 'en' ? 'Delete' : 'Padam',
          style: 'destructive',
          onPress: async () => {
            try {
              await pb.collection('campaigns').delete(campaign.id);
              fetchCampaigns();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete campaign.');
            }
          }
        }
      ]
    );
  };

  const fetchBroadcasts = async () => {
    if (!user || !user.merchant_id) return;
    try {
      setLoadingBroadcasts(true);
      const records = await pb.collection('broadcasts').getFullList({
        filter: `merchant = '${user.merchant_id}'`,
        sort: '-created',
        expand: 'campaign'
      });
      setBroadcastsList(records);
    } catch (err) {
      console.warn('Failed to fetch broadcasts list:', err);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const fetchAutomationRules = async () => {
    if (!user || !user.merchant_id) return;
    try {
      setLoadingRules(true);
      const records = await pb.collection('automation_rules').getFullList({
        filter: `merchant = '${user.merchant_id}'`,
        sort: '-created'
      });
      setAutomationRules(records);
    } catch (err) {
      console.warn('Failed to fetch automation rules:', err);
    } finally {
      setLoadingRules(false);
    }
  };

  const handleSaveAutomationRule = async () => {
    if (!user || !user.merchant_id) return;
    if (!arName.trim() || !arTitle.trim() || !arMessage.trim()) {
      Alert.alert('Validation Error', 'Rule Name, Message Title and Body are required.');
      return;
    }

    const triggerDaysInt = parseInt(arTriggerDays, 10);
    if (isNaN(triggerDaysInt) || triggerDaysInt <= 0) {
      Alert.alert('Validation Error', 'Please select or enter a valid number of inactive days (greater than 0).');
      return;
    }

    setIsSavingRule(true);
    try {
      if (selectedAutomation) {
        const payload = {
          merchant: user.merchant_id,
          name: arName.trim(),
          trigger_days: triggerDaysInt,
          title: arTitle.trim(),
          message: arMessage.trim(),
          send_whatsapp: arSendWhatsApp,
          is_active: true
        };
        await pb.collection('automation_rules').update(selectedAutomation.id, payload);
        Alert.alert('Success', 'Automation rule updated successfully!');
      } else {
        // Generate a random 15-char lowercase alphanumeric ID to satisfy pocketbase validation
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let randomId = '';
        for (let i = 0; i < 15; i++) {
          randomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const payload = {
          id: randomId,
          merchant: user.merchant_id,
          name: arName.trim(),
          trigger_days: triggerDaysInt,
          title: arTitle.trim(),
          message: arMessage.trim(),
          send_whatsapp: arSendWhatsApp,
          is_active: true
        };
        await pb.collection('automation_rules').create(payload);
        Alert.alert('Success', 'Automation rule created successfully!');
      }

      // Reset form
      setArName('');
      setArTriggerDays('7');
      setArTitle('We Miss You! ❤️');
      setArMessage("Hi {{name}}! 👋\n\nIt's been a while since your last visit. Come back soon to collect your next stamp! ✨");
      setArSendWhatsApp(true);
      setSelectedAutomation(null);
      
      fetchAutomationRules();
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Failed to save automation rule.');
    } finally {
      setIsSavingRule(false);
    }
  };

  const toggleAutomationRuleActive = async (rule: any) => {
    try {
      await pb.collection('automation_rules').update(rule.id, {
        is_active: !rule.is_active
      });
      fetchAutomationRules();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to toggle automation state.');
    }
  };

  const handleDeleteAutomationRule = async (ruleId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this automation rule?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await pb.collection('automation_rules').delete(ruleId);
              fetchAutomationRules();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete rule.');
            }
          }
        }
      ]
    );
  };

  const fetchWhatsappStatus = async () => {
    if (!user || !user.merchant_id) return;
    try {
      const res = await pb.send('/api/risev/merchant/whatsapp/status', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setWhatsappStatus(res.status);
      if (res.qrcode) {
        setWhatsappQr(res.qrcode);
      }
    } catch (err) {
      console.warn('Failed to fetch WhatsApp status:', err);
      setWhatsappStatus('disconnected');
    }
  };

  const fetchAudienceEstimate = async () => {
    if (!user || !user.merchant_id) return;
    try {
      const [cards, txs, allCusts] = await Promise.all([
        pb.collection('loyalty_cards').getFullList({
          filter: `merchant = '${user.merchant_id}'`,
          expand: 'customer'
        }),
        pb.collection('transactions').getFullList({
          filter: `merchant = '${user.merchant_id}'`
        }),
        pb.collection('users').getFullList({
          filter: "role = 'customer'"
        }).catch(() => [])
      ]);
      setDbCards(cards);
      setDbTxs(txs);
      setDbAllCustomers(allCusts);
    } catch (err) {
      console.warn('Failed to estimate audience:', err);
    }
  };

  const handleSendBlast = async () => {
    if (!bTitle.trim() || !bMessage.trim()) {
      Alert.alert('Validation Error', 'Please enter a Title and a Message.');
      return;
    }
    if (bSendWhatsApp && whatsappStatus !== 'connected') {
      Alert.alert('WhatsApp Error', 'Please connect your WhatsApp account or disable WhatsApp delivery.');
      return;
    }

    Alert.alert(
      'Confirm Send',
      `Are you sure you want to send this broadcast message to approximately ${audienceEstimate} customers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Blast',
          onPress: async () => {
            setIsSendingBlast(true);
            try {
              const res = await pb.send('/api/risev/merchant/blast', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + pb.authStore.token
                },
                body: {
                  title: bTitle.trim(),
                  message: bMessage.trim(),
                  campaignId: bCampaignId || undefined,
                  sendWhatsApp: bSendWhatsApp,
                  parentBroadcastId: activeFollowUpParent ? activeFollowUpParent.id : undefined,
                  targetCustomerIds: selectedSegment !== 'all' ? targetCustomerIds : undefined
                }
              });

              Alert.alert('Success', `Broadcast successfully sent to ${res.count || 0} customer(s).`);
              setBTitle('Exclusive Promotion! 🎁');
              setBMessage('Hi {{name}}! 👋\n\nWe have a special promotion just for you. You currently have {{stamps}} stamps on your loyalty card. Don\'t miss out on earning more rewards this week! ✨');
              setBCampaignId('');
              setActiveFollowUpParent(null);
              setBlastStep(1);
              fetchBroadcasts();
            } catch (err: any) {
              console.warn(err);
              Alert.alert('Error', err.message || 'Failed to send broadcast.');
            } finally {
              setIsSendingBlast(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    loadCampaignData();
    fetchCampaigns();
    fetchBroadcasts();
    fetchAutomationRules();
    fetchWhatsappStatus();
    fetchAudienceEstimate();

    if (user && user.merchant_id) {
      pb.collection('campaigns').subscribe('*', () => {
        fetchCampaigns();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      });

      pb.collection('broadcasts').subscribe('*', () => {
        fetchBroadcasts();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      });

      pb.collection('automation_rules').subscribe('*', () => {
        fetchAutomationRules();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      });
    }
    return () => {
      pb.collection('campaigns').unsubscribe('*');
      pb.collection('broadcasts').unsubscribe('*');
      pb.collection('automation_rules').unsubscribe('*');
    };
  }, [user]);

  const loadCampaignData = async () => {
    if (!user || !user.merchant_id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      // Fetch merchant details
      const mRec = await pb.collection('merchants').getOne(user.merchant_id);
      setMerchant(mRec);

      // Fetch active program (if any)
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
        setCardColor(prog.card_color || '#050505');
        setCustomHexInput(prog.card_color || '#050505');
        setStampColor(prog.stamp_color || '#3B82F6');
        setCustomStampHexInput(prog.stamp_color || '#3B82F6');
        setFontColor(prog.font_color || '#FFFFFF');
        setCustomFontHexInput(prog.font_color || '#FFFFFF');
        setBgImage(prog.card_background ? `${pb.baseUrl}/api/files/loyalty_programs/${prog.id}/${prog.card_background}` : '');
        setBgFile(null);
        setRemoveBgImage(false);
      }
    } catch (err) {
      console.warn('Failed to load merchant marketing settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !user.merchant_id) return;
    if (!rewardDesc.trim()) {
      Alert.alert('Validation Error', 'Please enter a Reward Description.');
      return;
    }
    const days = parseInt(expiryDays, 10);
    if (isNaN(days) || days <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid number of days for card expiry.');
      return;
    }

    setIsSaving(true);
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
        // Create FormData for multipart image upload
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

      setShowSuccessNotice(true);
      setTimeout(() => {
        setShowSuccessNotice(false);
      }, 4000);

      Alert.alert('Configuration Saved', 'Your loyalty reward program card design and settings have been successfully synchronized.');
    } catch (err: any) {
      console.warn(err);
      Alert.alert('Error', err.message || 'Failed to save card configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!programId) {
      Alert.alert('Info', 'No active campaign to delete.');
      return;
    }
    Alert.alert('Confirm Delete', 'Are you sure you want to permanently delete this loyalty program? This will also delete all active stamp cards currently held by your customers.', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: async () => {
          setIsSaving(true);
          try {
            await pb.collection('loyalty_programs').delete(programId);
            setProgramId(null);
            setIsActive(false);
            setRewardDesc('');
            setSelectedIcon('coffee');
            setCardColor('#050505');
            setCustomHexInput('#050505');
            setBgImage('');
            setBgFile(null);
            setRemoveBgImage(false);
            Alert.alert('Success', 'Campaign deleted successfully.');
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete campaign.');
          } finally {
            setIsSaving(false);
          }
        } 
      },
    ]);
  };

  // Renders the stamp slots in live preview card
  const renderPreviewStamps = () => {
    const previewSlots = [];
    for (let i = 1; i <= requiredStamps; i++) {
      const isEarned = i <= 3; // Preview 3 earned stamps with custom stamp color
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
    ? pb.files.getURL(merchant, merchant.logo)
    : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200';

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#050505" />
        <Text style={styles.loaderText}>Loading card details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Restrict to Owner Modal Overlay */}
      <Modal
        visible={isFocused && merchant !== null && merchant.owner !== user?.id}
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
        contentContainerStyle={[
          { paddingBottom: 110, minHeight: '100%' }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark Background - full black, spanning full width */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 142 + insets.top, zIndex: 0, backgroundColor: '#050505' }} />

        {/* Centered Content Wrapper */}
        <View style={[
          { paddingTop: 16 + insets.top, paddingHorizontal: 20, gap: 20 },
          isDesktop && { maxWidth: 840, alignSelf: 'center', width: '100%' }
        ]}>
          {/* Welcome Merchant Profile Header */}
          <View style={[styles.profileHeader, { marginBottom: 0 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image
                source={{ uri: merchantLogo }}
                style={styles.merchantAvatar}
              />
              <View style={styles.profileTextWrap}>
                <Text style={styles.welcomeSub}>Marketing Console</Text>
                <Text style={styles.merchantName}>{merchant?.name || 'Boutique Royal'}</Text>
              </View>
            </View>
            <Image
              source={require('../../assets/risev logo.png')}
              style={{ width: 96, height: 32, resizeMode: 'contain', tintColor: '#FFFFFF' }}
            />
          </View>

        {/* Sub-tab Selection Row */}
        <View style={styles.subTabContainer}>
          <TouchableOpacity 
            style={[styles.subTabButton, subTab === 'campaigns' && styles.subTabButtonActive]}
            onPress={() => setSubTab('campaigns')}
            activeOpacity={0.8}
          >
            <Text style={[styles.subTabText, subTab === 'campaigns' && styles.subTabTextActive]} numberOfLines={1}>
              Promo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.subTabButton, subTab === 'blast' && styles.subTabButtonActive]}
            onPress={() => setSubTab('blast')}
            activeOpacity={0.8}
          >
            <Text style={[styles.subTabText, subTab === 'blast' && styles.subTabTextActive]} numberOfLines={1}>
              Blast
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.subTabButton, subTab === 'followup' && styles.subTabButtonActive]}
            onPress={() => setSubTab('followup')}
            activeOpacity={0.8}
          >
            <Text style={[styles.subTabText, subTab === 'followup' && styles.subTabTextActive]} numberOfLines={1}>
              Follow Up
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.subTabButton, subTab === 'templates' && styles.subTabButtonActive]}
            onPress={() => setSubTab('templates')}
            activeOpacity={0.8}
          >
            <Text style={[styles.subTabText, subTab === 'templates' && styles.subTabTextActive]} numberOfLines={1}>
              Templates
            </Text>
          </TouchableOpacity>
        </View>

        {subTab === 'campaigns' && (
          <View style={styles.campaignsContent}>
            {/* Header row with a Create Button */}
            <View style={styles.campHeaderRow}>
              <View>
                <Text style={styles.campTitle}>{t('marketing_campaigns')}</Text>
                <Text style={styles.campSubtitle}>{t('marketing_subtitle')}</Text>
              </View>
              <TouchableOpacity 
                style={styles.createCampBtn}
                onPress={() => {
                  setWizardStep(1);
                  setCreateModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#050505" />
                <Text style={styles.createCampBtnText}>New</Text>
              </TouchableOpacity>
            </View>

            {/* Campaigns List */}
            {loadingCampaigns ? (
              <ActivityIndicator size="large" color="#050505" style={{ marginVertical: 40 }} />
            ) : campaignsList.length === 0 ? (
              <View style={styles.campEmptyState}>
                <Ionicons name="megaphone-outline" size={48} color="#FFC700" />
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={styles.campEmptyTitle}>{t('no_active_promotions')}</Text>
                  <Text style={styles.campEmptySub}>
                    {t('no_promotions_desc')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.campEmptyBtn}
                  onPress={() => {
                    setWizardStep(1);
                    setCreateModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.campEmptyBtnText}>{t('create_campaign')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.campList}>
                {campaignsList.map((camp) => {
                  const status = getCampaignStatus(camp);

                  let parsedDesc = camp.description || '';
                  let realType = camp.type;
                  let discountType = '';
                  let discountValue = camp.bonus_value || 0;

                  try {
                    if (camp.description && camp.description.trim().startsWith('{')) {
                      const data = JSON.parse(camp.description);
                      if (data.real_type === 'voucher_discount') {
                        realType = 'voucher_discount';
                        parsedDesc = data.description || '';
                        discountType = data.discount_type || 'amount';
                        discountValue = data.discount_value || camp.bonus_value;
                      }
                    }
                  } catch (e) {
                    // ignore
                  }

                  return (
                    <View key={camp.id} style={styles.campCard}>
                      <View style={styles.campCardHeader}>
                        <View style={styles.campCardTitleWrap}>
                          <Text style={styles.campCardName}>{camp.name}</Text>
                          {/* Type Badge */}
                          <View style={styles.campTypeBadge}>
                            <Text style={styles.campTypeBadgeText}>
                              {t(realType)}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Switch
                            value={camp.is_active}
                            onValueChange={() => toggleCampaignActive(camp)}
                            trackColor={{ false: '#E2E8F0', true: '#A3A3A3' }}
                            thumbColor={camp.is_active ? '#050505' : '#9CA3AF'}
                          />
                          <TouchableOpacity onPress={() => handleDeleteCampaign(camp)} style={{ padding: 4 }}>
                            <Feather name="trash-2" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.campCardDesc}>{parsedDesc || (locale === 'en' ? 'No description provided.' : 'Tiada keterangan diberikan.')}</Text>

                      {/* Details row */}
                      <View style={styles.campCardMetaRow}>
                        <View style={styles.campCardMetaCol}>
                          <Text style={styles.campMetaLabel}>{t('promotion_type')}</Text>
                          <Text style={styles.campMetaValue}>
                            {realType === 'voucher_discount'
                              ? `${discountType === 'percentage' ? discountValue + '%' : 'RM ' + discountValue} OFF Voucher`
                              : camp.type === 'double_points' 
                              ? `${camp.multiplier || 2}x ${locale === 'en' ? 'Multiplier' : 'Pengganda'}` 
                              : camp.type === 'bonus_stamps'
                              ? `+${camp.bonus_value || 1} ${locale === 'en' ? 'Stamps' : 'Setem'}`
                              : camp.type === 'flat_bonus'
                              ? `+${camp.bonus_value || 50} ${locale === 'en' ? 'Points' : 'Mata'}`
                              : (locale === 'en' ? 'Special reward' : 'Ganjaran khas')}
                          </Text>
                        </View>
                        <View style={styles.campCardMetaCol}>
                          <Text style={styles.campMetaLabel}>{t('campaign_period')}</Text>
                          <Text style={styles.campMetaValue}>
                            {new Date(camp.start_date).toLocaleDateString()} - {new Date(camp.end_date).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>

                      {/* Bottom Status Row */}
                      <View style={styles.campCardFooter}>
                        <View 
                          style={[
                            styles.statusDotBadge, 
                            status === 'active' && styles.statusDotActive,
                            status === 'upcoming' && styles.statusDotUpcoming,
                            status === 'ended' && styles.statusDotEnded
                          ]}
                        >
                          <View 
                            style={[
                              styles.statusDot, 
                              status === 'active' && { backgroundColor: '#10B981' },
                              status === 'upcoming' && { backgroundColor: '#3B82F6' },
                              status === 'ended' && { backgroundColor: '#64748B' }
                            ]} 
                          />
                          <Text 
                            style={[
                              styles.statusDotText,
                              status === 'active' && { color: '#047857' },
                              status === 'upcoming' && { color: '#1D4ED8' },
                              status === 'ended' && { color: '#475569' }
                            ]}
                          >
                            {status === 'active' 
                              ? (locale === 'en' ? 'ACTIVE' : 'AKTIF')
                              : status === 'upcoming'
                              ? (locale === 'en' ? 'UPCOMING' : 'AKAN DATANG')
                              : (locale === 'en' ? 'ENDED' : 'TAMAT')}
                          </Text>
                        </View>
                        
                        {camp.max_redemptions > 0 && (
                          <Text style={styles.redemptionsCounterText}>
                            {t('redemptions')}: {camp.current_redemptions || 0}/{camp.max_redemptions}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {subTab === 'blast' && (
          <View style={styles.broadcastContent}>
            <View style={{ width: '100%' }}>
                  
                  {/* WhatsApp Status Connection Banner */}
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    backgroundColor: whatsappStatus === 'connected' ? '#050505' : '#FFC700', 
                    borderRadius: 20, 
                    paddingHorizontal: 16, 
                    paddingVertical: 14, 
                    borderWidth: 1, 
                    borderColor: whatsappStatus === 'connected' ? '#10B981' : '#EAB308',
                    marginBottom: 24,
                    shadowColor: '#050505',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 3
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 12 }}>
                      <View style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20, 
                        backgroundColor: whatsappStatus === 'connected' ? '#10B981' : '#050505', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Ionicons 
                          name="logo-whatsapp" 
                          size={20} 
                          color={whatsappStatus === 'connected' ? '#FFFFFF' : '#FFC700'} 
                        />
                      </View>
                      <View style={{ gap: 2, flex: 1 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: whatsappStatus === 'connected' ? '#FFFFFF' : '#050505' }}>
                          {whatsappStatus === 'connected' ? 'Meta Cloud API Connected' : 'WhatsApp API Offline'}
                        </Text>
                        <Text style={{ fontSize: 11, color: whatsappStatus === 'connected' ? '#94A3B8' : '#0F172A', fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                          {whatsappStatus === 'connected' ? 'Messages will deliver via WhatsApp & Push' : 'Messages will deliver via Push Notification only'}
                        </Text>
                      </View>
                    </View>
                    {whatsappStatus !== 'connected' && (
                      <TouchableOpacity 
                        onPress={() => router.push('/(merchant)/profile')}
                        style={{ 
                          backgroundColor: '#050505', 
                          paddingHorizontal: 16, 
                          paddingVertical: 10, 
                          borderRadius: 12,
                          shadowColor: '#050505',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.2,
                          shadowRadius: 4,
                          elevation: 2,
                          flexShrink: 0
                        }}
                      >
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>LINK WABA</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Sub-Tabs for Instant Blast */}
                  <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    {[
                      { id: 'create', label: 'Create' },
                      { id: 'running', label: 'Running' },
                      { id: 'history', label: 'History' }
                    ].map(tab => (
                      <TouchableOpacity
                        key={tab.id}
                        onPress={() => setBlastSubTab(tab.id as any)}
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          alignItems: 'center',
                          borderRadius: 10,
                          backgroundColor: blastSubTab === tab.id ? '#FFC700' : 'transparent',
                          shadowColor: blastSubTab === tab.id ? '#050505' : 'transparent',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: blastSubTab === tab.id ? 2 : 0
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: blastSubTab === tab.id ? '#050505' : '#64748B' }}>
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {blastSubTab === 'create' && (
                    <View>
                      {/* Campaign Creation Card */}
                      <View style={{ 
                        backgroundColor: '#FFFFFF', 
                    borderRadius: 24, 
                    padding: 20, 
                    borderWidth: 1, 
                    borderColor: '#F1F5F9', 
                    shadowColor: '#050505', 
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.02, 
                    shadowRadius: 16, 
                    elevation: 2, 
                    marginBottom: 24 
                  }}>
                    
                    {/* Wizard Breadcrumbs */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: blastStep >= 1 ? '#FFC700' : '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: blastStep >= 1 ? '#050505' : '#94A3B8' }}>1</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: blastStep >= 1 ? '#050505' : '#94A3B8' }}>Audience</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: blastStep >= 2 ? '#FFC700' : '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: blastStep >= 2 ? '#050505' : '#94A3B8' }}>2</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: blastStep >= 2 ? '#050505' : '#94A3B8' }}>Compose</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: blastStep >= 3 ? '#FFC700' : '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: blastStep >= 3 ? '#050505' : '#94A3B8' }}>3</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: blastStep >= 3 ? '#050505' : '#94A3B8' }}>Preview</Text>
                      </View>
                    </View>

                    {blastStep === 1 && (
                      <View>
                    
                      {/* Target Segment Selector */}
                      <View style={{ marginBottom: 16, zIndex: 50, elevation: 50 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <Ionicons name="people-outline" size={13} color="#475569" />
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569', letterSpacing: 0.2 }}>TARGET SEGMENT</Text>
                        </View>
                        
                        <View style={{ flexDirection: 'row', gap: 8, zIndex: 10 }}>
                          {/* Dropdown Toggle */}
                          <View style={{ position: 'relative', flex: 1 }}>
                            <TouchableOpacity
                              onPress={() => setIsSegmentDropdownOpen(!isSegmentDropdownOpen)}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                borderRadius: 12,
                                backgroundColor: (selectedSegment !== 'custom' && selectedSegment !== 'all') ? '#FFC700' : '#F8FAFC',
                                borderWidth: 1,
                                borderColor: (selectedSegment !== 'custom' && selectedSegment !== 'all') ? '#FFC700' : '#E2E8F0',
                              }}
                            >
                              <Text style={{ 
                                fontSize: 14, 
                                fontFamily: 'PlusJakartaSans_600SemiBold',
                                color: (selectedSegment !== 'custom' && selectedSegment !== 'all') ? '#050505' : '#475569'
                              }}>
                                {selectedSegment === 'all' ? 'All Customers' : 
                                 selectedSegment === 'spenders' ? 'Top Spenders' : 
                                 selectedSegment === 'visitors' ? 'Top Visitors' : 
                                 selectedSegment === 'inactive' ? 'Inactive Customers' : 'Select Segment'}
                              </Text>
                              <Ionicons name={isSegmentDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color={(selectedSegment !== 'custom' && selectedSegment !== 'all') ? '#050505' : '#475569'} />
                            </TouchableOpacity>

                            {/* Dropdown Menu */}
                            {isSegmentDropdownOpen && (
                              <View style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: 8,
                                backgroundColor: '#FFFFFF',
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.1,
                                shadowRadius: 12,
                                elevation: 5,
                                zIndex: 20,
                                overflow: 'hidden'
                              }}>
                                {[
                                  { id: 'all', label: 'All Customers' },
                                  { id: 'spenders', label: 'Top Spenders' },
                                  { id: 'visitors', label: 'Top Visitors' },
                                  { id: 'inactive', label: 'Inactive Customers' },
                                ].map((seg, idx) => {
                                  const isActive = selectedSegment === seg.id;
                                  return (
                                    <TouchableOpacity
                                      key={seg.id}
                                      onPress={() => {
                                        setSelectedSegment(seg.id as any);
                                        setIsSegmentDropdownOpen(false);
                                      }}
                                      style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 12,
                                        backgroundColor: isActive ? '#F8FAFC' : '#FFFFFF',
                                        borderBottomWidth: idx < 3 ? 1 : 0,
                                        borderBottomColor: '#F1F5F9',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                      }}
                                    >
                                      <Text style={{
                                        fontSize: 14,
                                        fontFamily: isActive ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                                        color: isActive ? '#050505' : '#475569'
                                      }}>
                                        {seg.label}
                                      </Text>
                                      {isActive && <Ionicons name="checkmark" size={16} color="#FFC700" />}
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}
                          </View>

                          {/* Custom Button */}
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedSegment('custom');
                              setIsSegmentDropdownOpen(false);
                            }}
                            style={{
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              borderRadius: 12,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: selectedSegment === 'custom' ? '#FFC700' : '#F8FAFC',
                              borderWidth: 1,
                              borderColor: selectedSegment === 'custom' ? '#FFC700' : '#E2E8F0',
                            }}
                          >
                            <Text style={{
                              fontSize: 14,
                              fontFamily: selectedSegment === 'custom' ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
                              color: selectedSegment === 'custom' ? '#050505' : '#475569'
                            }}>
                              Custom
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                    {selectedSegment === 'custom' && (
                      <TouchableOpacity
                        onPress={() => setShowCustomAudienceModal(true)}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 }}
                      >
                        <Ionicons name="construct-outline" size={14} color="#050505" />
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>Build Custom Audience</Text>
                      </TouchableOpacity>
                    )}

                    <View style={{ backgroundColor: '#FFFFFF', padding: 24, borderRadius: 16, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94A3B8' }}>Targeting Approximately</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                        <Text style={{ fontSize: 40, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{audienceEstimate}</Text>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8' }}>Customers</Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      onPress={() => setBlastStep(2)}
                      style={{ backgroundColor: '#FFC700', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#050505', fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold' }}>Next: Compose Message</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {blastStep === 2 && (
                  <View>
                    {/* Campaign Title Input */}
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Ionicons name="bookmark-outline" size={14} color="#050505" />
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>Campaign Title</Text>
                      </View>
                      <TextInput
                        style={{ 
                          height: 52, 
                          borderWidth: 1, 
                          borderColor: '#E2E8F0', 
                          borderRadius: 12, 
                          paddingHorizontal: 16, 
                          fontFamily: 'PlusJakartaSans_600SemiBold', 
                          fontSize: 14, 
                          color: '#050505',
                          backgroundColor: '#FFFFFF',
                        }}
                        placeholder="e.g. Special Weekend Voucher 🎁"
                        placeholderTextColor="#94A3B8"
                        value={bTitle}
                        onChangeText={setBTitle}
                      />
                    </View>

                    {/* Campaign Message Body Input */}
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color="#050505" />
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>Message Body</Text>
                      </View>
                      <TextInput
                        style={{ 
                          minHeight: 120, 
                          borderWidth: 1, 
                          borderColor: '#E2E8F0', 
                          borderRadius: 12, 
                          padding: 16, 
                          fontFamily: 'PlusJakartaSans_500Medium', 
                          fontSize: 14, 
                          color: '#050505',
                          backgroundColor: '#FFFFFF',
                          textAlignVertical: 'top',
                        }}
                        multiline
                        numberOfLines={4}
                        placeholder="Enter broadcast message body..."
                        placeholderTextColor="#94A3B8"
                        value={bMessage}
                        onChangeText={setBMessage}
                      />
                    </View>

                    {/* Personalization badges */}
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                      <TouchableOpacity 
                        onPress={() => setBMessage(prev => prev + ' {{name}}')}
                        style={{ 
                          backgroundColor: '#FFFFFF', 
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          paddingHorizontal: 14, 
                          paddingVertical: 8, 
                          borderRadius: 20,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Ionicons name="add" size={14} color="#050505" />
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>Customer Name</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => setBMessage(prev => prev + ' {{stamps}}')}
                        style={{ 
                          backgroundColor: '#FFFFFF', 
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          paddingHorizontal: 14, 
                          paddingVertical: 8, 
                          borderRadius: 20,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Ionicons name="add" size={14} color="#050505" />
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>Stamp Balance</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Media & Action Button Settings */}
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505', marginBottom: 8 }}>Image Attachment (Optional)</Text>
                      {bImageUrl ? (
                        <View style={{ position: 'relative' }}>
                          <Image source={{ uri: bImageUrl }} style={{ width: '100%', height: 160, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }} resizeMode="cover" />
                          <TouchableOpacity 
                            onPress={() => setBImageUrl('')}
                            style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(5,5,5,0.6)', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Ionicons name="close" size={20} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          onPress={pickImage}
                          style={{ height: 64, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                        >
                          <Ionicons name="cloud-upload-outline" size={20} color="#64748B" />
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>Tap to upload image</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={{ marginBottom: 24 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505', marginBottom: 8 }}>Call to Action Button (Optional)</Text>
                      <View style={{ gap: 12 }}>
                        <TextInput
                          style={{ height: 52, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, backgroundColor: '#FFFFFF', color: '#050505' }}
                          placeholder="Button Text (e.g. Shop Now)"
                          placeholderTextColor="#94A3B8"
                          value={bBtnText}
                          onChangeText={setBBtnText}
                        />
                        <TextInput
                          style={{ height: 52, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, backgroundColor: '#FFFFFF', color: '#050505' }}
                          placeholder="Button URL (https://...)"
                          placeholderTextColor="#94A3B8"
                          value={bBtnUrl}
                          onChangeText={setBBtnUrl}
                        />
                      </View>
                    </View>

                    {/* Deliverability Channel Settings */}
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      paddingVertical: 14, 
                      borderTopWidth: 1, 
                      borderTopColor: '#F1F5F9', 
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F5F9',
                      marginBottom: 20 
                    }}>
                      <View style={{ gap: 2, flex: 1, marginRight: 16 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>Send via WhatsApp</Text>
                        <Text style={{ fontSize: 11, color: '#64748B', fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 15 }}>
                          Deliver message directly to customers' WhatsApp phones via official Meta WABA.
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => {
                          if (whatsappStatus !== 'connected' && !bSendWhatsApp) {
                            Alert.alert('WhatsApp Offline', 'Link your WhatsApp Business Account (WABA) in Settings to activate WhatsApp broadcasting.');
                            return;
                          }
                          setBSendWhatsApp(prev => !prev);
                        }}
                        style={{ 
                          width: 46, 
                          height: 26, 
                          borderRadius: 13, 
                          backgroundColor: bSendWhatsApp ? '#10B981' : '#E2E8F0', 
                          justifyContent: 'center', 
                          paddingHorizontal: 3 
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ 
                          width: 20, 
                          height: 20, 
                          borderRadius: 10, 
                          backgroundColor: '#FFFFFF', 
                          alignSelf: bSendWhatsApp ? 'flex-end' : 'flex-start',
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.15,
                          shadowRadius: 2,
                          elevation: 2
                        }} />
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity 
                        onPress={() => setBlastStep(1)}
                        style={{ flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ color: '#475569', fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' }}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => {
                          if (!bTitle.trim() || !bMessage.trim()) {
                            Alert.alert('Validation', 'Please enter title and message.');
                            return;
                          }
                          setBlastStep(3);
                        }}
                        style={{ flex: 2, backgroundColor: '#FFC700', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#050505', fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold' }}>Next: Review & Preview</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {blastStep === 3 && (
                  <View>
                    {/* High-Fidelity WhatsApp Device Mockup Container */}
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 10 }}>Live Message Preview</Text>
                    <View style={{ 
                      backgroundColor: '#E5DDD5', 
                      borderRadius: 18, 
                      borderWidth: 1, 
                      borderColor: '#E2E8F0',
                      overflow: 'hidden',
                      shadowColor: '#050505',
                      shadowOpacity: 0.05,
                      shadowRadius: 8,
                      elevation: 2,
                      marginBottom: 20
                    }}>
                      {/* WhatsApp Mockup Phone Top Header */}
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        backgroundColor: '#075E54', 
                        paddingHorizontal: 12, 
                        paddingVertical: 10 
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
                          {/* Store Avatar Circle */}
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#128C7E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {merchantLogo ? (
                              <Image source={{ uri: merchantLogo }} style={{ width: 28, height: 28 }} resizeMode="cover" />
                            ) : (
                              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                                {(merchant?.name || (user as any)?.merchant_name || 'K').substring(0, 1).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={{ gap: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }} numberOfLines={1}>
                                {merchant?.name || (user as any)?.merchant_name || 'Kedai Kami'}
                              </Text>
                              <MaterialIcons name="verified" size={12} color="#25D366" />
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#25D366' }} />
                              <Text style={{ fontSize: 8.5, color: '#A7F3D0', fontFamily: 'PlusJakartaSans_600SemiBold' }}>online</Text>
                            </View>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                          <Ionicons name="videocam" size={15} color="#FFFFFF" />
                          <Ionicons name="call" size={13} color="#FFFFFF" />
                          <Ionicons name="ellipsis-vertical" size={15} color="#FFFFFF" />
                        </View>
                      </View>

                      {/* Mockup Chat Body */}
                      <View style={{ padding: 12, paddingBottom: 16, backgroundColor: '#F8FAFC' }}>
                        <View style={{ 
                          backgroundColor: '#FFFFFF', 
                          borderRadius: 16, 
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          padding: 12, 
                          maxWidth: '85%', 
                          alignSelf: 'flex-start', 
                        }}>
                          {bImageUrl ? (
                            <Image source={{ uri: bImageUrl }} style={{ width: '100%', height: 160, borderRadius: 8, marginBottom: 8 }} resizeMode="cover" />
                          ) : null}
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                            📣 {bTitle || 'Campaign Title'}
                          </Text>
                          <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 }} />
                          <Text style={{ fontSize: 12, color: '#050505', lineHeight: 18, fontFamily: 'PlusJakartaSans_500Medium' }}>
                            {bMessage
                              .replace(/\{\{\s*name\s*\}\}/g, 'Hashiff')
                              .replace(/\{\{\s*stamps\s*\}\}/g, '8')}
                          </Text>
                          <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 }} />
                          <Text style={{ fontSize: 9.5, color: '#64748B', fontStyle: 'italic', fontFamily: 'PlusJakartaSans_500Medium' }}>
                            Untuk mengurus notifikasi, kemas kini Tetapan Profil di Aplikasi RISEV.
                          </Text>
                          
                          {/* Time & Double Tick inside bubble */}
                          <View style={{ flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 3, marginTop: 4 }}>
                            <Text style={{ fontSize: 9, color: '#94A3B8', fontFamily: 'PlusJakartaSans_500Medium' }}>
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <Ionicons name="checkmark-done" size={12} color="#0EA5E9" />
                          </View>

                          {bBtnText ? (
                            <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, alignItems: 'center' }}>
                              <Text style={{ fontSize: 13, color: '#050505', fontFamily: 'PlusJakartaSans_800ExtraBold' }}>{bBtnText}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    {/* Visual Segment Delivery Target Grid */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 16 }}>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="people-outline" size={14} color="#64748B" />
                          <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', textTransform: 'uppercase' }}>Audience</Text>
                        </View>
                        <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{audienceEstimate}</Text>
                      </View>

                      <View style={{ width: 1, height: 24, backgroundColor: '#E2E8F0' }} />

                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="notifications-outline" size={14} color="#64748B" />
                          <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', textTransform: 'uppercase' }}>Push</Text>
                        </View>
                        <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981' }}>Active</Text>
                      </View>

                      <View style={{ width: 1, height: 24, backgroundColor: '#E2E8F0' }} />

                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="logo-whatsapp" size={14} color="#64748B" />
                          <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', textTransform: 'uppercase' }}>WhatsApp</Text>
                        </View>
                        <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: bSendWhatsApp ? '#10B981' : '#94A3B8' }}>
                          {bSendWhatsApp ? 'Ready' : 'Off'}
                        </Text>
                      </View>
                    </View>

                    {/* Trigger Broadcast button */}
                    {hasCooldown ? (
                      <View style={{ 
                        backgroundColor: '#FFFBEA', 
                        borderWidth: 1, 
                        borderColor: '#FFE38F', 
                        borderRadius: 16, 
                        padding: 14, 
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                      }}>
                        <Ionicons name="time-outline" size={16} color="#D97706" />
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#B38B00', textAlign: 'center', flex: 1 }}>
                          Anti-Spam active. You can send another blast in {cooldownHoursLeft}h.
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        onPress={handleSendBlast}
                        disabled={isSendingBlast || audienceEstimate === 0}
                        style={{ 
                          backgroundColor: '#FFC700', 
                          height: 52, 
                          borderRadius: 14, 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          opacity: (isSendingBlast || audienceEstimate === 0) ? 0.5 : 1,
                          flexDirection: 'row',
                          gap: 8
                        }}
                        activeOpacity={0.8}
                      >
                        {isSendingBlast ? (
                          <ActivityIndicator size="small" color="#0F172A" />
                        ) : (
                          <>
                            <Ionicons name="paper-plane-outline" size={16} color="#0F172A" />
                            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                              Send Broadcast Notification
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity 
                      onPress={() => setBlastStep(2)}
                      style={{ marginTop: 16, paddingVertical: 12, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#64748B', fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' }}>Go Back to Edit</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

              {blastSubTab === 'running' && (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 24 }}>
                  <Ionicons name="rocket-outline" size={48} color="#CBD5E1" />
                  <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginTop: 16, textAlign: 'center' }}>No running broadcasts</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 8, textAlign: 'center', maxWidth: 250 }}>Active blast campaigns will appear here.</Text>
                </View>
              )}

              {blastSubTab === 'history' && (
                <View style={{ paddingBottom: 24 }}>

                {/* Broadcast History Title */}
                <Text style={styles.previewSectionHeader}>{t('broadcast_history')}</Text>

                {loadingBroadcasts ? (
                  <ActivityIndicator size="large" color="#050505" style={{ marginVertical: 30 }} />
                ) : broadcastsList.length === 0 ? (
                  <View style={styles.campEmptyState}>
                    <Ionicons name="megaphone-outline" size={40} color="#94A3B8" />
                    <Text style={styles.campEmptyTitle}>{t('no_broadcasts_sent')}</Text>
                    <Text style={styles.campEmptySub}>{t('no_broadcasts_desc')}</Text>
                  </View>
                ) : (
                  <View style={styles.campList}>
                    {broadcastsList.filter(bc => !bc.parent_broadcast).map((bc) => {
                      const replies = broadcastsList.filter(r => r.parent_broadcast === bc.id);
                      return (
                        <View key={bc.id} style={{ marginBottom: 16 }}>
                          {/* Parent Card */}
                          <View style={styles.campCard}>
                            <View style={styles.campCardHeader}>
                              <View style={{ gap: 4, flex: 1 }}>
                                <Text style={styles.campCardName}>{bc.title}</Text>
                                <Text style={{ fontSize: 11, color: '#64748B', fontFamily: 'PlusJakartaSans_500Medium' }}>
                                  {locale === 'en' ? 'Sent on ' : 'Dihantar pada '}{new Date(bc.created).toLocaleString()}
                                </Text>
                              </View>
                              <View style={[styles.statusDotBadge, { backgroundColor: '#ECFDF5' }]}>
                                <Text style={[styles.statusDotText, { color: '#047857' }]}>
                                  {bc.recipients_count || 0} {t('recipients')}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.campCardDesc}>{bc.message}</Text>
                            {bc.expand?.campaign && (
                              <View style={[styles.campTypeBadge, { marginTop: 4 }]}>
                                <Text style={styles.campTypeBadgeText}>
                                  {locale === 'en' ? 'Linked Promo: ' : 'Promosi Dipautkan: '}{bc.expand.campaign.name}
                                </Text>
                              </View>
                            )}

                            {/* Thread reply trigger */}
                            <TouchableOpacity
                              style={styles.followUpBtn}
                              onPress={() => {
                                setActiveFollowUpParent(bc);
                                setBTitle(`Re: ${bc.title}`);
                              }}
                              activeOpacity={0.8}
                            >
                              <Ionicons name={"reply-outline" as any} size={14} color="#050505" style={{ marginRight: 4 }} />
                              <Text style={styles.followUpBtnText}>{t('follow_up')}</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Nested Replies */}
                          {replies.map((reply) => (
                            <View key={reply.id} style={styles.replyCard}>
                              <View style={styles.replyLineConnector} />
                              <View style={{ flex: 1 }}>
                                <View style={styles.campCardHeader}>
                                  <View style={{ gap: 2, flex: 1 }}>
                                    <Text style={styles.replyCardName}>{reply.title}</Text>
                                    <Text style={{ fontSize: 10, color: '#64748B', fontFamily: 'PlusJakartaSans_500Medium' }}>
                                      {t('follow_up_on')} {new Date(reply.created).toLocaleString()}
                                    </Text>
                                  </View>
                                  <View style={[styles.statusDotBadge, { backgroundColor: '#F1F5F9' }]}>
                                    <Text style={[styles.statusDotText, { color: '#475569', fontSize: 9 }]}>
                                      {reply.recipients_count || 0} {t('recipients')}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={styles.replyCardDesc}>{reply.message}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      )}

        {subTab === 'followup' && (
          <View style={styles.broadcastContent}>
            <View style={{ width: '100%' }}>
              <SmartFollowUp styles={styles} Alert={Alert} />
            </View>
          </View>
        )}

        {subTab === 'templates' && (
          <View style={styles.campaignsContent}>
            <TemplateStudio 
              onSelectTemplateForBroadcast={(tpl: WhatsAppTemplate) => {
                setBTitle(tpl.headerText || tpl.name);
                setBMessage(tpl.bodyText);
                setBSendWhatsApp(true);
                setSubTab('blast');
              }}
            />
          </View>
        )}
        </View>

      </ScrollView>

      {/* Create Campaign Modal */}
      <Modal
        visible={createModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '88%', paddingBottom: 10 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('launch_campaign')}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 2 }}>
                  {locale === 'en' ? `Step ${wizardStep} of 5` : `Langkah ${wizardStep} daripada 5`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#050505" />
              </TouchableOpacity>
            </View>

            {/* Progress Bar Line */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginVertical: 10, gap: 6 }}>
              {[1, 2, 3, 4, 5].map((step) => {
                const isActive = wizardStep === step;
                const isCompleted = wizardStep > step;
                return (
                  <View 
                    key={step} 
                    style={{ 
                      flex: 1, 
                      height: 5, 
                      borderRadius: 3, 
                      backgroundColor: isCompleted ? '#050505' : isActive ? '#FFC700' : '#E2E8F0' 
                    }} 
                  />
                );
              })}
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalFormBody}>
                
                {/* STEP 1: Campaign Basics */}
                {wizardStep === 1 && (
                  <View style={{ gap: 16 }}>
                    <View>
                      <Text style={styles.modalInputLabel}>{t('campaign_name')}</Text>
                      <TextInput
                        style={[
                          styles.modalTextInput,
                          showValidationWarning && { borderColor: '#EF4444', borderWidth: 2 }
                        ]}
                        value={cName}
                        onChangeText={(val) => {
                          setCName(val);
                          if (val.trim()) setShowValidationWarning(false);
                        }}
                        placeholder={locale === 'en' ? "e.g. Merdeka RM10 OFF Voucher" : "cth. Baucar RM10 OFF Merdeka"}
                        placeholderTextColor="#BEC6E0"
                        {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                      />
                      {showValidationWarning && (
                        <Text style={{ color: '#EF4444', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 4, marginLeft: 4 }}>
                          {locale === 'en' ? 'Campaign name is mandatory' : 'Nama kempen adalah wajib'}
                        </Text>
                      )}
                    </View>

                    <View>
                      <Text style={styles.modalInputLabel}>{t('description')}</Text>
                      <TextInput
                        style={[styles.modalTextInput, { height: 100, textAlignVertical: 'top' }]}
                        multiline
                        value={cDesc}
                        onChangeText={setCDesc}
                        placeholder={locale === 'en' ? "Describe the terms and conditions..." : "Terangkan syarat-syarat kempen kepada pelanggan..."}
                        placeholderTextColor="#BEC6E0"
                        {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                      />
                    </View>
                  </View>
                )}

                {/* STEP 2: Promotion Type Card Grid */}
                {wizardStep === 2 && (
                  <View style={{ gap: 12 }}>
                    <Text style={[styles.modalInputLabel, { marginBottom: 4 }]}>
                      {locale === 'en' ? 'Select Promotion Type' : 'Pilih Jenis Promosi'}
                    </Text>
                    {[
                      { 
                        id: 'voucher_discount', 
                        title: t('voucher_discount'), 
                        desc: locale === 'en' ? 'Offer fixed cash OFF or percentage off discount vouchers.' : 'Tawarkan diskaun tunai tetap atau potongan peratusan.',
                        icon: 'ticket-outline',
                        color: '#7C3AED'
                      },
                      { 
                        id: 'bonus_stamps', 
                        title: t('bonus_stamps'), 
                        desc: locale === 'en' ? 'Award extra stamps for purchase visits.' : 'Berikan setem ganjaran tambahan untuk setiap lawatan.',
                        icon: 'ribbon-outline',
                        color: '#FFC700'
                      },
                      { 
                        id: 'double_points', 
                        title: t('double_points'), 
                        desc: locale === 'en' ? 'Multiply point returns for shopping transactions.' : 'Gandakan pulangan mata untuk setiap pembelian.',
                        icon: 'flash-outline',
                        color: '#3B82F6'
                      },
                      { 
                        id: 'flat_bonus', 
                        title: t('flat_bonus'), 
                        desc: locale === 'en' ? 'Award flat point bonus on every purchase.' : 'Berikan mata bonus tetap dengan setiap transaksi.',
                        icon: 'gift-outline',
                        color: '#10B981'
                      },
                    ].map((opt) => {
                      const isSelected = cType === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 14,
                            borderRadius: 16,
                            borderWidth: 2,
                            borderColor: isSelected ? '#050505' : '#E2E8F0',
                            backgroundColor: isSelected ? 'rgba(255, 199, 0, 0.05)' : '#FFFFFF',
                            gap: 12
                          }}
                          onPress={() => setCType(opt.id as any)}
                          activeOpacity={0.8}
                        >
                          <View style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: isSelected ? '#050505' : '#F1F5F9',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Ionicons name={opt.icon as any} size={22} color={isSelected ? '#FFC700' : '#475569'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                              {opt.title}
                            </Text>
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                              {opt.desc}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* STEP 3: Configuration & Dates */}
                {wizardStep === 3 && (
                  <View style={{ gap: 16 }}>
                    {cType === 'voucher_discount' && (
                      <View style={{ gap: 14 }}>
                        <View>
                          <Text style={styles.modalInputLabel}>{t('discount_type')}</Text>
                          <View style={[styles.segmentRow, { marginTop: 6, height: 44, padding: 4 }]}>
                            <TouchableOpacity
                              style={[
                                styles.segmentBtn,
                                cVoucherDiscountType === 'amount' && styles.segmentBtnActive,
                                { height: '100%' }
                              ]}
                              onPress={() => setCVoucherDiscountType('amount')}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.segmentText, cVoucherDiscountType === 'amount' && styles.segmentTextActive, { fontSize: 11 }]}>
                                Fixed (RM)
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.segmentBtn,
                                cVoucherDiscountType === 'percentage' && styles.segmentBtnActive,
                                { height: '100%' }
                              ]}
                              onPress={() => setCVoucherDiscountType('percentage')}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.segmentText, cVoucherDiscountType === 'percentage' && styles.segmentTextActive, { fontSize: 11 }]}>
                                Percentage (%)
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.modalInputLabel}>{t('discount_amount')}</Text>
                            <TextInput
                              style={styles.modalTextInput}
                              value={cVoucherDiscountVal}
                              onChangeText={setCVoucherDiscountVal}
                              placeholder={cVoucherDiscountType === 'percentage' ? 'e.g. 20' : 'e.g. 5'}
                              placeholderTextColor="#BEC6E0"
                              keyboardType="numeric"
                              {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.modalInputLabel}>{t('min_spend')}</Text>
                            <TextInput
                              style={styles.modalTextInput}
                              value={cVoucherMinSpend}
                              onChangeText={setCVoucherMinSpend}
                              placeholder="e.g. 30"
                              placeholderTextColor="#BEC6E0"
                              keyboardType="numeric"
                              {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                            />
                          </View>
                        </View>

                        <View>
                          <Text style={styles.modalInputLabel}>{t('voucher_prefix')}</Text>
                          <TextInput
                            style={styles.modalTextInput}
                            value={cVoucherPrefix}
                            onChangeText={(v) => setCVoucherPrefix(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            placeholder="e.g. MRDK, DISC, PROMO"
                            placeholderTextColor="#BEC6E0"
                            autoCapitalize="characters"
                            maxLength={8}
                            {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                          />
                        </View>
                      </View>
                    )}

                    {cType === 'double_points' && (
                      <View style={styles.condFieldWrap}>
                        <Text style={styles.modalInputLabel}>{t('point_multiplier')}</Text>
                        <TextInput
                          style={styles.modalTextInput}
                          value={cCMultiplier}
                          onChangeText={setCMultiplier}
                          placeholder="e.g. 2 for 2x points"
                          placeholderTextColor="#BEC6E0"
                          keyboardType="numeric"
                          {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                        />
                      </View>
                    )}

                    {cType === 'flat_bonus' && (
                      <View style={styles.condFieldWrap}>
                        <Text style={styles.modalInputLabel}>{t('flat_points_value')}</Text>
                        <TextInput
                          style={styles.modalTextInput}
                          value={cBonusValue}
                          onChangeText={setCBonusValue}
                          placeholder="e.g. 50 bonus points"
                          placeholderTextColor="#BEC6E0"
                          keyboardType="number-pad"
                          {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                        />
                      </View>
                    )}

                    {cType === 'bonus_stamps' && (
                      <View style={styles.condFieldWrap}>
                        <Text style={styles.modalInputLabel}>{t('bonus_stamps_awarded')}</Text>
                        <TextInput
                          style={styles.modalTextInput}
                          value={cBonusValue}
                          onChangeText={setCBonusValue}
                          placeholder="e.g. 1 bonus stamp"
                          placeholderTextColor="#BEC6E0"
                          keyboardType="number-pad"
                          {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                        />
                      </View>
                    )}

                    {/* Dates */}
                    <View style={styles.datesRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalInputLabel}>{t('start_date')}</Text>
                        {Platform.OS === 'web' ? (
                          <input
                            type="date"
                            value={cStartDate}
                            onChange={(e) => setCStartDate(e.target.value)}
                            style={{
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '14px',
                              padding: '12px 16px',
                              fontSize: '14px',
                              fontFamily: 'PlusJakartaSans_600SemiBold',
                              color: '#050505',
                              width: '100%',
                              height: 46,
                              boxSizing: 'border-box',
                              outline: 'none',
                            }}
                          />
                        ) : (
                          <TextInput
                            style={styles.modalTextInput}
                            value={cStartDate}
                            onChangeText={setCStartDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#BEC6E0"
                          />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalInputLabel}>{t('end_date')}</Text>
                        {Platform.OS === 'web' ? (
                          <input
                            type="date"
                            value={cEndDate}
                            onChange={(e) => setCEndDate(e.target.value)}
                            style={{
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '14px',
                              padding: '12px 16px',
                              fontSize: '14px',
                              fontFamily: 'PlusJakartaSans_600SemiBold',
                              color: '#050505',
                              width: '100%',
                              height: 46,
                              boxSizing: 'border-box',
                              outline: 'none',
                            }}
                          />
                        ) : (
                          <TextInput
                            style={styles.modalTextInput}
                            value={cEndDate}
                            onChangeText={setCEndDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#BEC6E0"
                          />
                        )}
                      </View>
                    </View>

                    {/* Presets Row */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: -4 }}>
                      {[
                        { label: locale === 'en' ? '7 Days' : '7 Hari', val: 7 },
                        { label: locale === 'en' ? '14 Days' : '14 Hari', val: 14 },
                        { label: locale === 'en' ? '30 Days' : '30 Hari', val: 30 },
                      ].map((preset, idx) => {
                        const startD = new Date(cStartDate);
                        const endD = new Date(cEndDate);
                        const diffTime = endD.getTime() - startD.getTime();
                        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                        const isPresetSelected = diffDays === preset.val;

                        return (
                          <TouchableOpacity
                            key={idx}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 20,
                              borderWidth: 1,
                              borderColor: isPresetSelected ? '#FFC700' : '#E2E8F0',
                              backgroundColor: isPresetSelected ? '#FEF3C7' : '#F8FAFC'
                            }}
                            onPress={() => {
                              const end = new Date(new Date(cStartDate).getTime() + preset.val * 86400000);
                              setCEndDate(end.toISOString().split('T')[0]);
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ 
                              fontSize: 11, 
                              fontFamily: isPresetSelected ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_700Bold', 
                              color: isPresetSelected ? '#B45309' : '#64748B' 
                            }}>
                              {preset.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Limit Max Redemptions */}
                    <View>
                      <Text style={styles.modalInputLabel}>{t('max_redemptions')}</Text>
                      <TextInput
                        style={styles.modalTextInput}
                        value={cMaxRedemptions}
                        onChangeText={setCMaxRedemptions}
                        placeholder={t('unlimited_placeholder')}
                        placeholderTextColor="#BEC6E0"
                        keyboardType="number-pad"
                        {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                      />
                    </View>
                  </View>
                )}

                {/* STEP 4: Target Audience & Channels */}
                {wizardStep === 4 && (
                  <View style={{ gap: 16 }}>
                    {/* Target Audience */}
                    <View>
                      <Text style={styles.modalInputLabel}>{t('target_audience')}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {[
                          { id: 'all', label: locale === 'en' ? 'All Customers' : 'Semua Pelanggan' },
                          { id: 'spenders', label: locale === 'en' ? 'Top Spenders' : 'VIP Spenders' },
                          { id: 'inactive', label: locale === 'en' ? 'Inactive (>30d)' : 'Pelanggan Lama' },
                          { id: 'visitors', label: locale === 'en' ? 'Top Visitors' : 'Kerap Datang' },
                        ].map((aud) => (
                          <TouchableOpacity
                            key={aud.id}
                            style={[
                              {
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderRadius: 12,
                                backgroundColor: cVoucherAudience === aud.id ? '#050505' : '#F1F5F9',
                                borderWidth: 1,
                                borderColor: cVoucherAudience === aud.id ? '#050505' : '#E2E8F0',
                              }
                            ]}
                            onPress={() => setCVoucherAudience(aud.id as any)}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontFamily: 'PlusJakartaSans_700Bold',
                                color: cVoucherAudience === aud.id ? '#FFC700' : '#475569',
                              }}
                            >
                              {aud.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Channels */}
                    <View style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 12, marginTop: 10 }}>
                      <Text style={[styles.modalInputLabel, { marginTop: 0 }]}>{t('distribution_options')}</Text>
                      
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                        onPress={() => setCVoucherAutoDrop(!cVoucherAutoDrop)}
                        activeOpacity={0.8}
                      >
                        <Ionicons 
                          name={cVoucherAutoDrop ? "checkbox" : "square-outline"} 
                          size={22} 
                          color={cVoucherAutoDrop ? "#050505" : "#94A3B8"} 
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                            {t('auto_wallet_drop')}
                          </Text>
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                            {locale === 'en' ? 'Each customer gets a unique QR / code in My Vouchers.' : 'Setiap pelanggan dapat kod/QR unik di Baucar Saya.'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}
                        onPress={() => setCVoucherAutoBlast(!cVoucherAutoBlast)}
                        activeOpacity={0.8}
                      >
                        <Ionicons 
                          name={cVoucherAutoBlast ? "checkbox" : "square-outline"} 
                          size={22} 
                          color={cVoucherAutoBlast ? "#050505" : "#94A3B8"} 
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                            {t('auto_whatsapp_blast')}
                          </Text>
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                            {locale === 'en' ? 'Pre-fill message template & open WhatsApp Blast.' : 'Sediakan template mesej WhatsApp & buka tab Blast.'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* STEP 5: Review & Launch Campaign Summary */}
                {wizardStep === 5 && (
                  <View style={{ gap: 16 }}>
                    <Text style={[styles.modalInputLabel, { marginBottom: 2 }]}>
                      {locale === 'en' ? 'Campaign Summary' : 'Ringkasan Kempen'}
                    </Text>

                    <View style={{
                      backgroundColor: '#050505',
                      borderRadius: 20,
                      padding: 18,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 199, 0, 0.3)',
                    }}>
                      {/* Name */}
                      <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                        {cName}
                      </Text>
                      {cDesc ? (
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#BEC6E0', marginTop: 6 }}>
                          {cDesc}
                        </Text>
                      ) : null}

                      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14 }} />

                      {/* Details list */}
                      <View style={{ gap: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#BEC6E0' }}>PROMO TYPE</Text>
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>
                            {cType === 'voucher_discount' 
                              ? '🎟️ VOUCHER DISCOUNT' 
                              : cType === 'bonus_stamps' 
                              ? '💮 BONUS STAMPS' 
                              : cType === 'double_points' 
                              ? '⚡ DOUBLE POINTS' 
                              : '🎁 FLAT BONUS'}
                          </Text>
                        </View>

                        {cType === 'voucher_discount' && (
                          <>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#BEC6E0' }}>DISCOUNT VALUE</Text>
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                                {cVoucherDiscountType === 'percentage' ? `${cVoucherDiscountVal}%` : `RM ${cVoucherDiscountVal}`} OFF
                              </Text>
                            </View>
                            {cVoucherMinSpend ? (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#BEC6E0' }}>MIN SPEND</Text>
                                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                                  RM {cVoucherMinSpend}
                                </Text>
                              </View>
                            ) : null}
                          </>
                        )}

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#BEC6E0' }}>PERIOD</Text>
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                            {cStartDate} to {cEndDate}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#BEC6E0' }}>TARGET AUDIENCE</Text>
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                            {cVoucherAudience === 'all' ? 'All Customers' : cVoucherAudience === 'spenders' ? 'Top Spenders (VIP)' : cVoucherAudience === 'inactive' ? 'Inactive Customers' : 'Custom'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Navigation Footer Row */}
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginTop: 24, 
                  gap: 12 
                }}>
                  {wizardStep > 1 ? (
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        backgroundColor: '#F8FAFC',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onPress={() => setWizardStep(wizardStep - 1)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569' }}>
                        {locale === 'en' ? 'Back' : 'Kembali'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ flex: wizardStep > 1 ? 1 : 0 }} />
                  )}

                  <TouchableOpacity
                    style={{
                      flex: 2,
                      height: 48,
                      borderRadius: 16,
                      backgroundColor: '#050505',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#050505',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      elevation: 3
                    }}
                    onPress={() => {
                      if (wizardStep === 1) {
                        if (!cName.trim()) {
                          setShowValidationWarning(true);
                          return;
                        }
                      }
                      if (wizardStep < 5) {
                        setWizardStep(wizardStep + 1);
                      } else {
                        handleCreateCampaign();
                      }
                    }}
                    disabled={isCreatingCampaign}
                    activeOpacity={0.9}
                  >
                    {isCreatingCampaign ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFC700' }}>
                        {wizardStep === 5 
                          ? t('launch_promotion_btn') 
                          : (locale === 'en' ? 'Next' : 'Seterusnya')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Confirmation Alert Modal */}
      <Modal
        visible={confirmVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContent}>
            <Text style={styles.confirmTitle}>{confirmTitle}</Text>
            {confirmMsg ? <Text style={styles.confirmMsg}>{confirmMsg}</Text> : null}
            <View style={styles.confirmButtons}>
              {confirmButtons.map((btn, index) => {
                const isCancel = btn.style === 'cancel' || btn.text?.toLowerCase() === 'cancel';
                const isDestructive = btn.style === 'destructive';
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      isCancel ? styles.confirmBtnCancel : styles.confirmBtnAction,
                      !isCancel && isDestructive && { backgroundColor: '#EF4444' }
                    ]}
                    onPress={() => {
                      setConfirmVisible(false);
                      if (btn.onPress) btn.onPress();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={isCancel ? styles.confirmBtnCancelText : styles.confirmBtnActionText}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Launch Success Modal */}
      <Modal
        visible={launchSuccessModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLaunchSuccessModalVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmContent, { alignItems: 'center', maxWidth: 360 }]}>
            <View style={{ backgroundColor: '#E8F5E9', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="checkmark-circle" size={32} color="#10B981" />
            </View>
            <Text style={[styles.confirmTitle, { textAlign: 'center' }]}>
              {locale === 'en' ? 'Campaign Launched' : 'Kempen Dilancarkan'}
            </Text>
            <Text style={[styles.confirmMsg, { textAlign: 'center', color: '#64748B' }]}>
              {locale === 'en' 
                ? 'Your new promotional campaign has been successfully launched!' 
                : 'Kempen promosi baharu anda telah berjaya dilancarkan!'}
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtnAction, { width: '100%', backgroundColor: '#050505', height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 16, marginTop: 8 }]}
              onPress={() => setLaunchSuccessModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.confirmBtnActionText, { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold' }]}>
                {locale === 'en' ? 'OK' : 'OK'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Audience Builder Modal */}
      <Modal
        visible={showCustomAudienceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCustomAudienceModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#FFFFFF' }}>
            <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>Build Custom Audience</Text>
            <TouchableOpacity onPress={() => setShowCustomAudienceModal(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center', shadowColor: '#050505', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 }}>
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 6, marginHorizontal: 20, marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
            {[
              { id: 'manual', label: 'Manual Pick' },
              { id: 'rules', label: 'Rules' },
              { id: 'paste', label: 'Paste List' }
            ].map(tab => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setCaTab(tab.id as any)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderRadius: 12,
                  backgroundColor: caTab === tab.id ? '#050505' : 'transparent',
                  shadowColor: caTab === tab.id ? '#050505' : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: caTab === tab.id ? 2 : 0
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: caTab === tab.id ? '#FFC700' : '#64748B' }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingTop: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {caTab === 'manual' && (
              <View>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 16 }}>Select specific customers to target.</Text>
                
                {dbCards.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'PlusJakartaSans_500Medium' }}>No customers found in database.</Text>
                ) : (
                  dbCards.map((card, idx) => {
                    const isSelected = caManualSelection.has(card.customer);
                    return (
                      <TouchableOpacity 
                        key={idx} 
                        onPress={() => {
                          setCaManualSelection(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(card.customer)) {
                              newSet.delete(card.customer);
                            } else {
                              newSet.add(card.customer);
                            }
                            return newSet;
                          });
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center', shadowColor: '#050505', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 1 }}>
                            <Ionicons name="person" size={20} color="#FFC700" />
                          </View>
                          <View>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>{card.expand?.customer?.name || card.expand?.customer?.phone || 'Unknown Customer'}</Text>
                            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>{card.stamps || card.stamps_collected || 0} Stamps collected</Text>
                          </View>
                        </View>
                        <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: isSelected ? 0 : 2, borderColor: '#CBD5E1', backgroundColor: isSelected ? '#FFC700' : '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: isSelected ? '#FFC700' : 'transparent', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: isSelected ? 2 : 0 }}>
                          {isSelected && <Ionicons name="checkmark" size={16} color="#050505" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            {caTab === 'rules' && (
              <View>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginBottom: 24 }}>Filter customers based on their activity.</Text>
                
                {/* Stamp Balance */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505', marginBottom: 8 }}>Stamp Balance Range</Text>
                  <TextInput
                    style={{ height: 52, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, backgroundColor: '#FFFFFF', color: '#050505' }}
                    placeholder="e.g. 5 or 1-9"
                    keyboardType="default"
                    value={caMinStamps}
                    onChangeText={setCaMinStamps}
                  />
                  <Text style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'PlusJakartaSans_500Medium', marginTop: 8, lineHeight: 16 }}>
                    Finds customers who have at least this many stamps, or fall within the specified range (e.g. 1-9).
                  </Text>
                </View>

                {/* Date Visited */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505', marginBottom: 8 }}>Date Visited Range</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 6 }}>Start Date</Text>
                      {Platform.OS === 'web' ? (
                        <input 
                          type="date"
                          value={caStartDate}
                          onChange={(e: any) => setCaStartDate(e.target.value)}
                          style={{ width: '100%', height: 52, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, backgroundColor: '#FFFFFF', color: '#050505', outline: 'none' } as any}
                        />
                      ) : (
                        <TextInput
                          style={{ height: 52, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, backgroundColor: '#FFFFFF', color: '#050505' }}
                          placeholder="YYYY-MM-DD"
                          value={caStartDate}
                          onChangeText={setCaStartDate}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 6 }}>End Date</Text>
                      {Platform.OS === 'web' ? (
                        <input 
                          type="date"
                          value={caEndDate}
                          onChange={(e: any) => setCaEndDate(e.target.value)}
                          style={{ width: '100%', height: 52, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, backgroundColor: '#FFFFFF', color: '#050505', outline: 'none' } as any}
                        />
                      ) : (
                        <TextInput
                          style={{ height: 52, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, backgroundColor: '#FFFFFF', color: '#050505' }}
                          placeholder="YYYY-MM-DD"
                          value={caEndDate}
                          onChangeText={setCaEndDate}
                        />
                      )}
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'PlusJakartaSans_500Medium', marginTop: 8, lineHeight: 16 }}>
                    Finds customers whose last visit falls within this date range. Leave blank for any date.
                  </Text>
                </View>

                {/* Rules Matching Tracker */}
                <View style={{ marginTop: 8, padding: 20, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>Rules Matching</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>Targeted Customers</Text>
                  </View>
                  <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{rulesMatchCount}</Text>
                </View>
              </View>
            )}

            {caTab === 'paste' && (
              <View>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 16 }}>Paste a list of phone numbers (comma-separated or line-by-line).</Text>
                <TextInput
                  style={{ minHeight: 180, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, backgroundColor: '#FFFFFF', color: '#0F172A', textAlignVertical: 'top' }}
                  multiline
                  placeholder="60123456789, 60198765432..."
                  value={caPasteText}
                  onChangeText={setCaPasteText}
                />
              </View>
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={{ padding: 20, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: 40 }}>
            <TouchableOpacity 
              style={{ backgroundColor: '#FFC700', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#FFC700', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 }}
              onPress={() => {
                let computedIds = new Set<string>();
                
                if (caTab === 'manual') {
                  computedIds = new Set(caManualSelection);
                } 
                else if (caTab === 'rules') {
                  let minStamps = 0;
                  let maxStamps = Infinity;
                  if (caMinStamps.includes('-')) {
                    const parts = caMinStamps.split('-');
                    minStamps = parseInt(parts[0]) || 0;
                    maxStamps = parseInt(parts[1]) || Infinity;
                  } else {
                    minStamps = parseInt(caMinStamps) || 0;
                  }
                  
                  const startTs = caStartDate ? new Date(caStartDate).getTime() : 0;
                  const endTs = caEndDate ? new Date(caEndDate).getTime() + (24 * 60 * 60 * 1000) - 1 : Infinity;

                  const lastVisitMap: Record<string, number> = {};
                  dbTxs.forEach(t => {
                    if (!t.customer) return;
                    const time = new Date(t.created).getTime();
                    if (!lastVisitMap[t.customer] || time > lastVisitMap[t.customer]) {
                      lastVisitMap[t.customer] = time;
                    }
                  });

                  dbCards.forEach(c => {
                    if (c.customer) {
                      const userStamps = c.stamps || c.stamps_collected || 0;
                      const stampPass = (minStamps === 0 && maxStamps === Infinity) ? true : (userStamps >= minStamps && userStamps <= maxStamps);
                      const lastV = lastVisitMap[c.customer] || 0;
                      // Only check date rule if start or end is provided
                      const hasDateRule = caStartDate || caEndDate;
                      const datePass = !hasDateRule || (lastV >= startTs && lastV <= endTs);
                      
                      if (stampPass && datePass) {
                        computedIds.add(c.customer);
                      }
                    }
                  });
                }
                else if (caTab === 'paste') {
                  // Not fully implemented DB matching for pasted text in this scope, but structure is here
                  Alert.alert("Coming Soon", "Matching pasted phone numbers to customer profiles requires backend resolution.");
                }

                setCustomAudienceIds(Array.from(computedIds));
                setShowCustomAudienceModal(false);
              }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>Save & Apply Audience</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingTop: 16,
    marginBottom: 20,
  },
  merchantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileTextWrap: {
    gap: 2,
  },
  welcomeSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  merchantName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  titleSection: {
    gap: 8,
  },
  welcomeTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
  },
  configCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleTextWrap: {
    flex: 1,
    gap: 4,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  cardSectionDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 100,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 44,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFC700',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  helpText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    paddingVertical: 4,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  colorCircleActive: {
    borderColor: '#050505',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  datePickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
  },
  inputFocused: {
    borderColor: '#050505',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  textAreaInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    height: 90,
    backgroundColor: '#F8FAFC',
    textAlignVertical: 'top',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  iconOption: {
    width: (width - 110) / 4,
    height: (width - 110) / 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  iconOptionActive: {
    borderColor: '#050505',
    borderWidth: 2,
    backgroundColor: '#F8FAFC',
  },
  previewSectionHeader: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 1,
    marginTop: 10,
  },
  liveCardPreview: {
    borderRadius: 24,
    padding: 24,
    gap: 20,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  cardPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  previewSub: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.8,
  },
  previewTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    width: '100%',
  },
  previewSlot: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 16,
  },
  previewRewardText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#FFFFFF',
    flex: 1,
  },
  buttonsWrap: {
    gap: 12,
    marginTop: 10,
  },
  saveBtn: {
    backgroundColor: '#050505',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  deleteBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  deleteBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EF4444',
  },
  successNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#050505',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  successNoticeText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  // Sub-tabs styles
  subTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    borderRadius: 100,
    padding: 5,
    marginBottom: 24,
    zIndex: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
  },
  subTabButtonActive: {
    backgroundColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  subTabText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    letterSpacing: 0.1,
  },
  subTabTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 12,
  },

  // Campaigns content styles
  campaignsContent: {
    gap: 20,
  },
  campHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  campTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  campSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
    maxWidth: width * 0.6,
  },
  createCampBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC700',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
    gap: 4,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  createCampBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  campEmptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  campEmptyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  campEmptySub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  campEmptyBtn: {
    backgroundColor: '#050505',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 12,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#FFC700',
  },
  campEmptyBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
  },
  campList: {
    gap: 16,
  },
  campCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 20,
    gap: 12,
  },
  campCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  campCardTitleWrap: {
    gap: 6,
    flex: 1,
    paddingRight: 12,
  },
  campCardName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  campTypeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  campTypeBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  campCardDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#4B5563',
    lineHeight: 18,
  },
  campCardMetaRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 12,
    marginTop: 4,
  },
  campCardMetaCol: {
    flex: 1,
    gap: 4,
  },
  campMetaLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  campMetaValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  campCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusDotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDotActive: {
    backgroundColor: '#ECFDF5',
  },
  statusDotUpcoming: {
    backgroundColor: '#EFF6FF',
  },
  statusDotEnded: {
    backgroundColor: '#F1F5F9',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  redemptionsCounterText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },

  // Modal styles for creation form
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  closeBtn: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  modalFormBody: {
    gap: 16,
    paddingBottom: 40,
  },
  modalInputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 1.0,
    marginBottom: 8,
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  condFieldWrap: {
    gap: 8,
  },
  datesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  broadcastContent: {
    gap: 20,
  },
  whatsappStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  whatsappStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTextWrap: {
    flex: 1,
    gap: 2,
  },
  connectLinkBtn: {
    backgroundColor: '#050505',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  connectLinkBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  disconnectLinkBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  disconnectLinkBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  inputLabelSmall: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 1.0,
    marginTop: 8,
    marginBottom: -4,
  },
  tagScrollGap: {
    gap: 8,
    paddingVertical: 4,
  },
  tagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  tagButtonActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  tagText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  tagTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  tagHelpersRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tagHelperBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  tagHelperBtnText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  audienceEstimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  audienceEstimateText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  warningBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#B45309',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    lineHeight: 15,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    gap: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  confirmMsg: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  confirmBtnCancel: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnCancelText: {
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
  },
  confirmBtnAction: {
    flex: 1,
    backgroundColor: '#050505',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnActionText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
  },
  modeSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    width: '100%',
  },
  modeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  modeSegmentBtnActive: {
    backgroundColor: '#050505',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modeSegmentBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  modeSegmentBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  switchDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  followUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  followUpBannerText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#E11D48',
  },
  followUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  followUpBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  replyCard: {
    flexDirection: 'row',
    marginLeft: 24,
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  replyLineConnector: {
    position: 'absolute',
    left: -14,
    top: -16,
    width: 2,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  replyCardName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  replyCardDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#4B5563',
    lineHeight: 16,
    marginTop: 4,
  },
  triggerDaysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
    width: '100%',
  },
  triggerDayBtn: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '18%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerDayBtnActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  triggerDayBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  triggerDayBtnTextActive: {
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  // Custom Color Picker & Background styles
  colorWheelCircle: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexInputContainer: {
    marginTop: 16,
  },
  hexInputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginBottom: 8,
  },
  hexInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    gap: 8,
  },
  hexHashSymbol: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
  },
  hexTextInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
    padding: 0,
  },
  hexColorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  uploadBlock: {
    marginTop: 12,
  },
  previewImageContainer: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  uploadPreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  removeImageText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  uploadPlaceholder: {
    width: '100%',
    height: 140,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
  },
  uploadPlaceholderText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginTop: 4,
  },
  uploadPlaceholderSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  restrictionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  restrictionContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  lockIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  restrictionTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  restrictionSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  restrictionBtn: {
    backgroundColor: '#050505',
    borderRadius: 16,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restrictionBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardBgWave: {
    position: 'absolute',
    right: -80,
    top: -50,
    width: 260,
    height: 300,
    borderRadius: 130,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  cardBgWave2: {
    position: 'absolute',
    right: -40,
    top: 10,
    width: 180,
    height: 220,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  cardMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginVertical: 4,
  },
  cardChip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EAB308',
    borderWidth: 1.2,
    borderColor: '#CA8A04',
    position: 'relative',
    overflow: 'hidden',
  },
  chipLineHoriz: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#CA8A04',
  },
  chipLineVert: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#CA8A04',
  },
  chipCenterPin: {
    position: 'absolute',
    top: 6,
    left: 10,
    width: 16,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#CA8A04',
    backgroundColor: '#EAB308',
  },
  cardNumberContainer: {
    paddingHorizontal: 4,
    marginVertical: 4,
  },
  cardLabelText: {
    fontSize: 7,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardNumberValueText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  holderBlock: {
    flex: 1,
    marginRight: 10,
  },
  holderValueText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  validBlock: {
    width: 45,
  },
  cvvBlock: {
    width: 35,
  },
  mastercardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  badgeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  shopCategoryText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  rewardDetailPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginTop: 20,
  },
  rewardIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rewardDetailInfo: {
    flex: 1,
  },
  rewardDetailTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  rewardDetailSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 15,
  },
});
