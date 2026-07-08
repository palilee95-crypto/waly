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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome, MaterialIcons, Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';



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
  { label: 'Silver', value: '#D1D5DB' },
  { label: 'Slate', value: '#1E293B' },
  { label: 'Gold', value: '#FFD700' },
  { label: 'Rose', value: '#F43F5E' },
];

export default function MarketingScreen() {
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  
  const [merchant, setMerchant] = useState<any>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  
  // Campaign configuration states
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessNotice, setShowSuccessNotice] = useState(false);

  // States to track input focuses
  const [expiryFocused, setExpiryFocused] = useState(false);
  const [rewardFocused, setRewardFocused] = useState(false);

  const [subTab, setSubTab] = useState<'stamp_card' | 'campaigns' | 'broadcast'>('stamp_card');
  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Broadcast & WhatsApp Blast states
  const [broadcastsList, setBroadcastsList] = useState<any[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [whatsappQr, setWhatsappQr] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [bCampaignId, setBCampaignId] = useState('');
  const [bTitle, setBTitle] = useState('Exclusive Promotion! 🎁');
  const [bMessage, setBMessage] = useState('Hi {{name}}! 👋\n\nWe have a special promotion just for you. You currently have {{stamps}} stamps on your loyalty card. Don\'t miss out on earning more rewards this week! ✨');
  const [bSendWhatsApp, setBSendWhatsApp] = useState(true);
  const [isSendingBlast, setIsSendingBlast] = useState(false);
  const [audienceEstimate, setAudienceEstimate] = useState(0);

  // Automated winback rules states
  const [broadcastMode, setBroadcastMode] = useState<'manual' | 'automated'>('manual');
  const [automationRules, setAutomationRules] = useState<any[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<any | null>(null);
  const [arName, setArName] = useState('');
  const [arTriggerDays, setArTriggerDays] = useState<'3' | '7' | '14' | '30'>('7');
  const [arTitle, setArTitle] = useState('We Miss You! ❤️');
  const [arMessage, setArMessage] = useState('Hi {{name}}! 👋\n\nIt\'s been a while since your last visit. Come back soon to collect your next stamp! ✨');
  const [arSendWhatsApp, setArSendWhatsApp] = useState(true);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [activeFollowUpParent, setActiveFollowUpParent] = useState<any | null>(null);

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
  const [cType, setCType] = useState<'double_points' | 'bonus_stamps' | 'free_item' | 'flat_bonus'>('double_points');
  const [cCMultiplier, setCMultiplier] = useState('2');
  const [cBonusValue, setCBonusValue] = useState('0');
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

  const handleCreateCampaign = async () => {
    if (!user || !user.merchant_id) return;
    if (!cName.trim()) {
      Alert.alert('Validation Error', 'Please enter a Campaign Name.');
      return;
    }
    
    setIsCreatingCampaign(true);
    try {
      const payload: any = {
        merchant: user.merchant_id,
        name: cName.trim(),
        description: cDesc.trim(),
        type: cType,
        start_date: new Date(cStartDate).toISOString(),
        end_date: new Date(cEndDate).toISOString(),
        is_active: true,
      };

      if (cType === 'double_points') {
        payload.multiplier = parseFloat(cCMultiplier) || 2.0;
      } else if (cType === 'bonus_stamps') {
        payload.bonus_value = parseInt(cBonusValue, 10) || 1;
      } else if (cType === 'flat_bonus') {
        payload.bonus_value = parseInt(cBonusValue, 10) || 50;
      }

      if (cMaxRedemptions.trim()) {
        payload.max_redemptions = parseInt(cMaxRedemptions, 10) || 0;
      }

      await pb.collection('campaigns').create(payload);

      Alert.alert('Campaign Created', 'Your new promotional campaign has been successfully launched!');
      setCreateModalVisible(false);
      
      // Reset form fields
      setCName('');
      setCDesc('');
      setCType('double_points');
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

    setIsSavingRule(true);
    try {
      const payload = {
        merchant: user.merchant_id,
        name: arName.trim(),
        trigger_days: parseInt(arTriggerDays, 10),
        title: arTitle.trim(),
        message: arMessage.trim(),
        send_whatsapp: arSendWhatsApp,
        is_active: true
      };

      if (selectedAutomation) {
        await pb.collection('automation_rules').update(selectedAutomation.id, payload);
        Alert.alert('Success', 'Automation rule updated successfully!');
      } else {
        await pb.collection('automation_rules').create(payload);
        Alert.alert('Success', 'Automation rule created successfully!');
      }

      // Reset form
      setArName('');
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
      const res = await pb.send('/api/waly/merchant/whatsapp/status', {
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

  const handleDisconnectWhatsapp = async () => {
    try {
      setWhatsappStatus('checking');
      await pb.send('/api/waly/merchant/whatsapp/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setWhatsappStatus('disconnected');
      setWhatsappQr('');
      Alert.alert('Disconnected', 'Your WhatsApp account has been disconnected.');
    } catch (err) {
      Alert.alert('Error', 'Failed to disconnect WhatsApp account.');
      setWhatsappStatus('connected');
    }
  };

  const fetchAudienceEstimate = async () => {
    if (!user || !user.merchant_id) return;
    try {
      const [cards, txs] = await Promise.all([
        pb.collection('loyalty_cards').getFullList({
          filter: `merchant = '${user.merchant_id}' && opt_in_marketing != false`
        }),
        pb.collection('transactions').getFullList({
          filter: `merchant = '${user.merchant_id}'`
        })
      ]);
      const customerIds = new Set([
        ...cards.map((c: any) => c.customer),
        ...txs.map((t: any) => t.customer)
      ].filter(Boolean));
      setAudienceEstimate(customerIds.size);
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
              const res = await pb.send('/api/waly/merchant/blast', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + pb.authStore.token
                },
                body: {
                  title: bTitle.trim(),
                  message: bMessage.trim(),
                  campaignId: bCampaignId || undefined,
                  sendWhatsApp: bSendWhatsApp,
                  parentBroadcastId: activeFollowUpParent ? activeFollowUpParent.id : undefined
                }
              });

              Alert.alert('Success', `Broadcast successfully sent to ${res.count || 0} customer(s).`);
              setBTitle('Exclusive Promotion! 🎁');
              setBMessage('Hi {{name}}! 👋\n\nWe have a special promotion just for you. You currently have {{stamps}} stamps on your loyalty card. Don\'t miss out on earning more rewards this week! ✨');
              setBCampaignId('');
              setActiveFollowUpParent(null);
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
    let intervalId: any;
    if (showQrModal && user && user.merchant_id) {
      const poll = async () => {
        try {
          const res = await pb.send('/api/waly/merchant/whatsapp/status?generateQr=true', {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer ' + pb.authStore.token
            }
          });
          if (res.status === 'connected') {
            setWhatsappStatus('connected');
            setShowQrModal(false);
            Alert.alert('Success', 'WhatsApp connected successfully!');
            if (intervalId) clearInterval(intervalId);
          } else if (res.qrcode) {
            setWhatsappQr(res.qrcode);
          }
        } catch (err) {
          console.warn('Polling WhatsApp status failed:', err);
        }
      };
      poll();
      intervalId = setInterval(poll, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [showQrModal]);

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
            setCardColor('#000000');
            setCustomHexInput('#000000');
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
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loaderText}>Loading card details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Merchant Profile Header */}
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: merchantLogo }}
            style={styles.merchantAvatar}
          />
          <View style={styles.profileTextWrap}>
            <Text style={styles.welcomeSub}>Welcome back</Text>
            <Text style={styles.merchantName}>{merchant?.name || 'Boutique Royal'}</Text>
          </View>
        </View>

        {/* Sub-tab Selection Row */}
        <View style={styles.subTabContainer}>
          <TouchableOpacity 
            style={[styles.subTabButton, subTab === 'stamp_card' && styles.subTabButtonActive]}
            onPress={() => setSubTab('stamp_card')}
            activeOpacity={0.8}
          >
            <Text style={[styles.subTabText, subTab === 'stamp_card' && styles.subTabTextActive]}>
              Stamp Card
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.subTabButton, subTab === 'campaigns' && styles.subTabButtonActive]}
            onPress={() => setSubTab('campaigns')}
            activeOpacity={0.8}
          >
            <Text style={[styles.subTabText, subTab === 'campaigns' && styles.subTabTextActive]}>
              Promotions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.subTabButton, subTab === 'broadcast' && styles.subTabButtonActive]}
            onPress={() => setSubTab('broadcast')}
            activeOpacity={0.8}
          >
            <Text style={[styles.subTabText, subTab === 'broadcast' && styles.subTabTextActive]}>
              Broadcast
            </Text>
          </TouchableOpacity>
        </View>

        {subTab === 'stamp_card' && (
          <>
            {/* Screen Title */}
            <View style={styles.titleSection}>
              <Text style={styles.welcomeTitle}>Stamp Card Configuration</Text>
              <Text style={styles.welcomeSubtitle}>
                Design your loyalty stamp card look-and-feel and configure reward milestones for your customers.
              </Text>
            </View>

        {/* Form Card 1: Toggle Campaign Status */}
        <View style={styles.configCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.cardSectionTitle}>Enable Campaign</Text>
              <Text style={styles.cardSectionDesc}>
                Instantly activate or pause this loyalty program.
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: '#E5E7EB', true: '#A3A3A3' }}
              thumbColor={isActive ? '#000000' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Form Card 2: Stamps Required Segment */}
        <View style={styles.configCard}>
          <Text style={styles.cardSectionTitle}>Total Stamps Required</Text>
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
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helpText}>
            Customers must collect this total amount of stamps to unlock and redeem a reward.
          </Text>
        </View>


        {/* Form Card 2.5: Card Color Selector */}
        <View style={styles.configCard}>
          <Text style={styles.cardSectionTitle}>Select Card Background Color</Text>
          <View style={styles.colorRow}>
            {colorOptions.map((opt) => {
              const circleColor = opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: circleColor },
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
              );
            })}
            
            {/* Visual Color Picker Circle */}
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
                  style={{
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
                  }}
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

          {/* Hex input section */}
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
                {...Platform.select({
                  web: {
                    outlineStyle: 'none',
                  } as any,
                })}
              />
              <View style={[styles.hexColorPreview, { backgroundColor: cardColor }]} />
            </View>
          </View>
        </View>

        {/* Form Card 2.5a: Collected Stamp Color Selector */}
        <View style={styles.configCard}>
          <Text style={styles.cardSectionTitle}>Select Collected Stamp Color</Text>
          <View style={styles.colorRow}>
            {stampColorOptions.map((opt) => {
              const circleColor = opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: circleColor },
                    stampColor === opt.value && styles.colorCircleActive,
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
              );
            })}
            
            {/* Visual Color Picker Circle */}
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[
                  styles.colorCircle,
                  styles.colorWheelCircle,
                  !stampColorOptions.some(opt => opt.value === stampColor) && styles.colorCircleActive,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons name="color-filter-outline" size={16} color="#000000" />
                <input
                  type="color"
                  style={{
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
                  }}
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

          {/* Hex input section */}
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
                {...Platform.select({
                  web: {
                    outlineStyle: 'none',
                  } as any,
                })}
              />
              <View style={[styles.hexColorPreview, { backgroundColor: stampColor }]} />
            </View>
          </View>
        </View>

        {/* Form Card 2.5b: Card Text/Font Color Selector */}
        <View style={styles.configCard}>
          <Text style={styles.cardSectionTitle}>Select Card Text Color</Text>
          <View style={styles.colorRow}>
            {fontColorOptions.map((opt) => {
              const circleColor = opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: circleColor },
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
                      color={fontColor === '#FFFFFF' || fontColor === '#D1D5DB' ? '#000000' : '#FFFFFF'} 
                    />
                  )}
                </TouchableOpacity>
              );
            })}
            
            {/* Visual Color Picker Circle */}
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[
                  styles.colorCircle,
                  styles.colorWheelCircle,
                  !fontColorOptions.some(opt => opt.value === fontColor) && styles.colorCircleActive,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons name="color-filter-outline" size={16} color="#000000" />
                <input
                  type="color"
                  style={{
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
                  }}
                  value={fontColor}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setFontColor(val);
                    setCustomFontHexInput(val);
                  }}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Hex input section */}
          <View style={styles.hexInputContainer}>
            <Text style={styles.hexInputLabel}>Custom Hex Code</Text>
            <View style={styles.hexInputWrapper}>
              <Text style={styles.hexHashSymbol}>#</Text>
              <TextInput
                style={styles.hexTextInput}
                value={customFontHexInput.replace('#', '')}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                  setCustomFontHexInput('#' + cleaned);
                  if (cleaned.length === 6) {
                    setFontColor('#' + cleaned.toUpperCase());
                  }
                }}
                placeholder="FFFFFF"
                placeholderTextColor="#BEC6E0"
                maxLength={6}
                {...Platform.select({
                  web: {
                    outlineStyle: 'none',
                  } as any,
                })}
              />
              <View style={[styles.hexColorPreview, { backgroundColor: fontColor }]} />
            </View>
          </View>
        </View>

        {/* Form Card 2.7: Card Background Image */}
        <View style={styles.configCard}>
          <Text style={styles.cardSectionTitle}>Custom Card Background Image</Text>
          <View style={styles.uploadBlock}>
            {bgImage ? (
              <View style={styles.previewImageContainer}>
                <Image source={{ uri: bgImage }} style={styles.uploadPreview} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => {
                    setBgImage('');
                    setBgFile(null);
                    setRemoveBgImage(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.removeImageText}>Remove Image</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadPlaceholder}
                onPress={() => {
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
                    Alert.alert('Not Supported', 'Image upload is currently web-only in this demo.');
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="image-outline" size={28} color="#94A3B8" />
                <Text style={styles.uploadPlaceholderText}>Select Background Picture</Text>
                <Text style={styles.uploadPlaceholderSub}>Supports JPG, PNG, WEBP up to 5MB</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Form Card 3: Expiry Days */}
        <View style={styles.configCard}>
          <Text style={styles.cardSectionTitle}>Campaign Expiry Period (Days)</Text>
          <View style={[styles.datePickerInput, expiryFocused && styles.inputFocused]}>
            <TextInput
              style={styles.textInput}
              value={expiryDays}
              onChangeText={setExpiryDays}
              placeholder="e.g. 30, 90, 365"
              placeholderTextColor="#BEC6E0"
              keyboardType="number-pad"
              onFocus={() => setExpiryFocused(true)}
              onBlur={() => setExpiryFocused(false)}
              {...Platform.select({
                web: {
                  outlineStyle: 'none',
                } as any,
              })}
            />
            <Ionicons name="time-outline" size={20} color={expiryFocused ? '#000000' : '#565e74'} />
          </View>
          <Text style={styles.helpText}>
            Number of days the loyalty card remains active before automatically expiring.
          </Text>
        </View>

        {/* Form Card 4: Reward Description */}
        <View style={styles.configCard}>
          <Text style={styles.cardSectionTitle}>Reward Description</Text>
          <TextInput
            style={[styles.textInput, styles.textAreaInput, rewardFocused && styles.inputFocused]}
            multiline
            numberOfLines={4}
            value={rewardDesc}
            onChangeText={setRewardDesc}
            placeholder="Example: One free Latte or 50% discount on your next shop visit..."
            placeholderTextColor="#BEC6E0"
            onFocus={() => setRewardFocused(true)}
            onBlur={() => setRewardFocused(false)}
            {...Platform.select({
              web: {
                outlineStyle: 'none',
              } as any,
            })}
          />
        </View>

        {/* Form Card 5: Stamp Icon Select */}
        <View style={styles.configCard}>
          <Text style={styles.cardSectionTitle}>Select Stamp Icon</Text>
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
                  <Ionicons name={icon.name} size={20} color={selectedIcon === icon.id ? '#000000' : '#565e74'} />
                )}
                {icon.family === 'FontAwesome' && (
                  <FontAwesome name={icon.name} size={20} color={selectedIcon === icon.id ? '#000000' : '#565e74'} />
                )}
                {icon.family === 'MaterialIcons' && (
                  <MaterialIcons name={icon.name} size={20} color={selectedIcon === icon.id ? '#000000' : '#565e74'} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Live Preview Section Header */}
        <Text style={styles.previewSectionHeader}>STAMP CARD PREVIEW</Text>

        {/* Live Preview Loyalty Card representation */}
        <View style={[styles.liveCardPreview, { backgroundColor: cardColor, overflow: 'hidden' }]}>
          {bgImage ? (
            <Image
              source={{ uri: bgImage }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.cardPreviewHeader}>
            <View>
              <Text style={[styles.previewSub, { color: fontColor, opacity: 0.65 }]}>LOYALTY PROGRAM</Text>
              <Text style={[styles.previewTitle, { color: fontColor }]}>{merchant?.name || 'Store'} Reward</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#DC2626' }]}>
              <Text style={styles.statusText}>{isActive ? 'ACTIVE' : 'PAUSED'}</Text>
            </View>
          </View>

          {/* Dynamic grid of slots based on inputs */}
          <View style={styles.previewGrid}>{renderPreviewStamps()}</View>

          {/* Subtitle */}
          <View style={styles.previewFooter}>
            <Ionicons name="gift-outline" size={16} color={fontColor} />
            <Text style={[styles.previewRewardText, { color: fontColor }]} numberOfLines={1}>
              {rewardDesc.trim() || 'Please input reward description...'}
            </Text>
          </View>
        </View>

        {showSuccessNotice && (
          <View style={styles.successNoticeBanner}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.successNoticeText}>
              Loyalty program card design synced successfully!
            </Text>
          </View>
        )}

            {/* Action Buttons */}
            <View style={styles.buttonsWrap}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.9} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Configuration</Text>
                )}
              </TouchableOpacity>

              {programId && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8} disabled={isSaving}>
                  <Text style={styles.deleteBtnText}>Delete Campaign</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {subTab === 'campaigns' && (
          <View style={styles.campaignsContent}>
            {/* Header row with a Create Button */}
            <View style={styles.campHeaderRow}>
              <View>
                <Text style={styles.campTitle}>Marketing Campaigns</Text>
                <Text style={styles.campSubtitle}>Drive shop sales with multipliers and points promotions.</Text>
              </View>
              <TouchableOpacity 
                style={styles.createCampBtn}
                onPress={() => setCreateModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.createCampBtnText}>New</Text>
              </TouchableOpacity>
            </View>

            {/* Campaigns List */}
            {loadingCampaigns ? (
              <ActivityIndicator size="large" color="#000000" style={{ marginVertical: 40 }} />
            ) : campaignsList.length === 0 ? (
              <View style={styles.campEmptyState}>
                <Ionicons name="megaphone-outline" size={48} color="#94A3B8" />
                <Text style={styles.campEmptyTitle}>No active promotions yet</Text>
                <Text style={styles.campEmptySub}>
                  Launch a double points or flat bonus campaign to attract customers to your store.
                </Text>
                <TouchableOpacity 
                  style={styles.campEmptyBtn}
                  onPress={() => setCreateModalVisible(true)}
                >
                  <Text style={styles.campEmptyBtnText}>Create Campaign</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.campList}>
                {campaignsList.map((camp) => {
                  const status = getCampaignStatus(camp);

                  return (
                    <View key={camp.id} style={styles.campCard}>
                      <View style={styles.campCardHeader}>
                        <View style={styles.campCardTitleWrap}>
                          <Text style={styles.campCardName}>{camp.name}</Text>
                          {/* Type Badge */}
                          <View style={styles.campTypeBadge}>
                            <Text style={styles.campTypeBadgeText}>
                              {camp.type === 'double_points' ? 'Double Points' : camp.type === 'bonus_stamps' ? 'Bonus Stamps' : camp.type === 'flat_bonus' ? 'Flat Bonus' : 'Promotion'}
                            </Text>
                          </View>
                        </View>
                        <Switch
                          value={camp.is_active}
                          onValueChange={() => toggleCampaignActive(camp)}
                          trackColor={{ false: '#E2E8F0', true: '#A3A3A3' }}
                          thumbColor={camp.is_active ? '#000000' : '#9CA3AF'}
                        />
                      </View>

                      <Text style={styles.campCardDesc}>{camp.description || 'No description provided.'}</Text>

                      {/* Details row */}
                      <View style={styles.campCardMetaRow}>
                        <View style={styles.campCardMetaCol}>
                          <Text style={styles.campMetaLabel}>PROMOTION TYPE</Text>
                          <Text style={styles.campMetaValue}>
                            {camp.type === 'double_points' 
                              ? `${camp.multiplier || 2}x Multiplier` 
                              : camp.type === 'bonus_stamps'
                              ? `+${camp.bonus_value || 1} Stamps`
                              : camp.type === 'flat_bonus'
                              ? `+${camp.bonus_value || 50} Points`
                              : 'Special reward'}
                          </Text>
                        </View>
                        <View style={styles.campCardMetaCol}>
                          <Text style={styles.campMetaLabel}>CAMPAIGN PERIOD</Text>
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
                            {status.toUpperCase()}
                          </Text>
                        </View>
                        
                        {camp.max_redemptions > 0 && (
                          <Text style={styles.redemptionsCounterText}>
                            Redemptions: {camp.current_redemptions || 0}/{camp.max_redemptions}
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

        {subTab === 'broadcast' && (
          <View style={styles.broadcastContent}>
            {/* WhatsApp Status Indicator */}
            <View style={styles.whatsappStatusCard}>
              <View style={styles.statusRow}>
                <View style={[styles.whatsappStatusDot, { backgroundColor: whatsappStatus === 'connected' ? '#10B981' : whatsappStatus === 'checking' ? '#F59E0B' : '#EF4444' }]} />
                <View style={styles.statusTextWrap}>
                  <Text style={styles.cardSectionTitle}>
                    {whatsappStatus === 'connected' ? 'WhatsApp Connected' : whatsappStatus === 'checking' ? 'Checking connection...' : 'WhatsApp Disconnected'}
                  </Text>
                  <Text style={styles.cardSectionDesc}>
                    {whatsappStatus === 'connected' 
                      ? 'Messages will send directly from your personal number.' 
                      : 'Link your WhatsApp account to enable promotional chats.'}
                  </Text>
                </View>
                {whatsappStatus === 'connected' ? (
                  <TouchableOpacity style={styles.disconnectLinkBtn} onPress={handleDisconnectWhatsapp}>
                    <Text style={styles.disconnectLinkBtnText}>Disconnect</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={styles.connectLinkBtn} 
                    onPress={async () => {
                      setShowQrModal(true);
                      await fetchWhatsappStatus();
                    }}
                    disabled={whatsappStatus === 'checking'}
                  >
                    <Text style={styles.connectLinkBtnText}>Link WhatsApp</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Mode Switch Segment */}
            <View style={styles.modeSegmentContainer}>
              <TouchableOpacity
                style={[styles.modeSegmentBtn, broadcastMode === 'manual' && styles.modeSegmentBtnActive]}
                onPress={() => setBroadcastMode('manual')}
              >
                <Ionicons name="send-outline" size={15} color={broadcastMode === 'manual' ? '#FFFFFF' : '#475569'} style={{ marginRight: 6 }} />
                <Text style={[styles.modeSegmentBtnText, broadcastMode === 'manual' && styles.modeSegmentBtnTextActive]}>
                  Instant Blast
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeSegmentBtn, broadcastMode === 'automated' && styles.modeSegmentBtnActive]}
                onPress={() => setBroadcastMode('automated')}
              >
                <Ionicons name="time-outline" size={15} color={broadcastMode === 'automated' ? '#FFFFFF' : '#475569'} style={{ marginRight: 6 }} />
                <Text style={[styles.modeSegmentBtnText, broadcastMode === 'automated' && styles.modeSegmentBtnTextActive]}>
                  Auto Follow-Up
                </Text>
              </TouchableOpacity>
            </View>

            {broadcastMode === 'manual' && (
              <View style={{ width: '100%' }}>
                {/* Compose Broadcast Card */}
                <View style={styles.configCard}>
                  {activeFollowUpParent ? (
                    <View style={styles.followUpBanner}>
                      <Text style={styles.followUpBannerText}>
                        Replying to: <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{activeFollowUpParent.title}</Text>
                      </Text>
                      <TouchableOpacity onPress={() => {
                        setActiveFollowUpParent(null);
                        setBTitle('Exclusive Promotion! 🎁');
                      }}>
                        <Ionicons name="close-circle" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.cardSectionTitle}>Compose Broadcast Blast</Text>
                  )}
                  <Text style={styles.cardSectionDesc}>
                    {activeFollowUpParent 
                      ? 'Compose a threaded follow-up reply that will target the same customer list.'
                      : 'Customize a promotion template or type a custom update.'}
                  </Text>

                  {/* Campaign Picker Horizontal Tags (disabled in follow-up mode) */}
                  {!activeFollowUpParent && (
                    <>
                      <Text style={styles.inputLabelSmall}>LINK CAMPAIGN (OPTIONAL)</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagScrollGap}>
                        <TouchableOpacity
                          style={[styles.tagButton, !bCampaignId && styles.tagButtonActive]}
                          onPress={() => {
                            setBCampaignId('');
                            setBTitle('Exclusive Promotion! 🎁');
                            setBMessage('Hi {{name}}! 👋\n\nWe have a special promotion just for you. You currently have {{stamps}} stamps on your loyalty card. Don\'t miss out on earning more rewards this week! ✨');
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.tagText, !bCampaignId && styles.tagTextActive]}>No Campaign Link</Text>
                        </TouchableOpacity>
                        {campaignsList.map((camp) => (
                          <TouchableOpacity
                            key={camp.id}
                            style={[styles.tagButton, bCampaignId === camp.id && styles.tagButtonActive]}
                            onPress={() => {
                              setBCampaignId(camp.id);
                              setBTitle(`Promo: ${camp.name}`);
                              setBMessage(camp.description || '');
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.tagText, bCampaignId === camp.id && styles.tagTextActive]}>{camp.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}

                  <Text style={styles.inputLabelSmall}>BROADCAST TITLE</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={bTitle}
                    onChangeText={setBTitle}
                    placeholder="e.g. 2x Stamps Weekend!"
                    placeholderTextColor="#BEC6E0"
                  />

                  <Text style={styles.inputLabelSmall}>MESSAGE BODY (TEMPLATED)</Text>
                  <TextInput
                    style={[styles.modalTextInput, { height: 100, textAlignVertical: 'top' }]}
                    multiline
                    numberOfLines={4}
                    value={bMessage}
                    onChangeText={setBMessage}
                    placeholder="Type message here..."
                    placeholderTextColor="#BEC6E0"
                  />
                  <Text style={styles.helperText}>
                    Use <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{"{{name}}"}</Text> for customer name and <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{"{{stamps}}"}</Text> for stamp count.
                  </Text>

                  {/* Toggle WhatsApp Blast */}
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchLabel}>Send WhatsApp Message</Text>
                      <Text style={styles.switchDesc}>Delivers high-engagement chats in addition to app push alerts.</Text>
                    </View>
                    <Switch
                      value={bSendWhatsApp}
                      onValueChange={setBSendWhatsApp}
                      trackColor={{ false: '#E2E8F0', true: '#000000' }}
                      thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : bSendWhatsApp ? '#000000' : '#F4F3F4'}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.saveBtn, audienceEstimate === 0 && { opacity: 0.6 }]}
                    onPress={handleSendBlast}
                    disabled={isSendingBlast || audienceEstimate === 0}
                    activeOpacity={0.9}
                  >
                    {isSendingBlast ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {activeFollowUpParent ? 'Send Thread Follow-Up' : 'Send Broadcast Blast'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Broadcast History Title */}
                <Text style={styles.previewSectionHeader}>BROADCAST HISTORY</Text>

                {loadingBroadcasts ? (
                  <ActivityIndicator size="large" color="#000000" style={{ marginVertical: 30 }} />
                ) : broadcastsList.length === 0 ? (
                  <View style={styles.campEmptyState}>
                    <Ionicons name="megaphone-outline" size={40} color="#94A3B8" />
                    <Text style={styles.campEmptyTitle}>No broadcasts sent yet</Text>
                    <Text style={styles.campEmptySub}>Link your WhatsApp and send your first promotional blast!</Text>
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
                                  Sent on {new Date(bc.created).toLocaleString()}
                                </Text>
                              </View>
                              <View style={[styles.statusDotBadge, { backgroundColor: '#ECFDF5' }]}>
                                <Text style={[styles.statusDotText, { color: '#047857' }]}>
                                  {bc.recipients_count || 0} RECIPIENTS
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.campCardDesc}>{bc.message}</Text>
                            {bc.expand?.campaign && (
                              <View style={[styles.campTypeBadge, { marginTop: 4 }]}>
                                <Text style={styles.campTypeBadgeText}>Linked Promo: {bc.expand.campaign.name}</Text>
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
                              <Ionicons name={"reply-outline" as any} size={14} color="#000000" style={{ marginRight: 4 }} />
                              <Text style={styles.followUpBtnText}>Follow Up</Text>
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
                                      Follow-up on {new Date(reply.created).toLocaleString()}
                                    </Text>
                                  </View>
                                  <View style={[styles.statusDotBadge, { backgroundColor: '#F1F5F9' }]}>
                                    <Text style={[styles.statusDotText, { color: '#475569', fontSize: 9 }]}>
                                      {reply.recipients_count || 0} RECIPIENTS
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

            {broadcastMode === 'automated' && (
              <View style={{ width: '100%' }}>
                {/* Compose Automation Rule */}
                <View style={styles.configCard}>
                  <Text style={styles.cardSectionTitle}>
                    {selectedAutomation ? 'Edit Retention Follow-Up Rule' : 'Automated Win-Back Follow-Up'}
                  </Text>
                  <Text style={styles.cardSectionDesc}>
                    Automatically alert customers after they are inactive for a set number of days since their last visit/stamp.
                  </Text>

                  {/* Trigger Days Selection */}
                  <Text style={styles.inputLabelSmall}>TRIGGER DELAY INACTIVITY</Text>
                  <View style={styles.triggerDaysRow}>
                    {['3', '7', '14', '30'].map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.triggerDayBtn,
                          arTriggerDays === day && styles.triggerDayBtnActive
                        ]}
                        onPress={() => setArTriggerDays(day as any)}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.triggerDayBtnText,
                          arTriggerDays === day && styles.triggerDayBtnTextActive
                        ]}>
                          {day} Days
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabelSmall}>RULE NAME</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={arName}
                    onChangeText={setArName}
                    placeholder="e.g. 7-Day Winback Campaign"
                    placeholderTextColor="#BEC6E0"
                  />

                  <Text style={styles.inputLabelSmall}>MESSAGE TITLE</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={arTitle}
                    onChangeText={setArTitle}
                    placeholder="e.g. We Miss You! ❤️"
                    placeholderTextColor="#BEC6E0"
                  />

                  <Text style={styles.inputLabelSmall}>MESSAGE BODY (TEMPLATED)</Text>
                  <TextInput
                    style={[styles.modalTextInput, { height: 100, textAlignVertical: 'top' }]}
                    multiline
                    numberOfLines={4}
                    value={arMessage}
                    onChangeText={setArMessage}
                    placeholder="Use {{name}} and {{stamps}} tags..."
                    placeholderTextColor="#BEC6E0"
                  />
                  <Text style={styles.helperText}>
                    Use <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{"{{name}}"}</Text> for customer name and <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{"{{stamps}}"}</Text> for collected stamps count.
                  </Text>

                  {/* Toggle WhatsApp Blast */}
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchLabel}>Send via WhatsApp</Text>
                      <Text style={styles.switchDesc}>Delivers notification directly to client WhatsApp when triggered.</Text>
                    </View>
                    <Switch
                      value={arSendWhatsApp}
                      onValueChange={setArSendWhatsApp}
                      trackColor={{ false: '#E2E8F0', true: '#000000' }}
                      thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : arSendWhatsApp ? '#000000' : '#F4F3F4'}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveAutomationRule}
                    disabled={isSavingRule}
                    activeOpacity={0.9}
                  >
                    {isSavingRule ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {selectedAutomation ? 'Update Rule' : 'Activate Automation Rule'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {selectedAutomation && (
                    <TouchableOpacity
                      style={{ alignSelf: 'center', marginTop: 12 }}
                      onPress={() => {
                        setSelectedAutomation(null);
                        setArName('');
                        setArTitle('We Miss You! ❤️');
                        setArMessage("Hi {{name}}! 👋\n\nIt's been a while since your last visit. Come back soon to collect your next stamp! ✨");
                        setArSendWhatsApp(true);
                      }}
                    >
                      <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                        Cancel Edit
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Automation Rules List */}
                <Text style={styles.previewSectionHeader}>ACTIVE AUTOMATION RULES</Text>

                {loadingRules ? (
                  <ActivityIndicator size="large" color="#000000" style={{ marginVertical: 30 }} />
                ) : automationRules.length === 0 ? (
                  <View style={styles.campEmptyState}>
                    <Ionicons name="time-outline" size={40} color="#94A3B8" />
                    <Text style={styles.campEmptyTitle}>No automation rules yet</Text>
                    <Text style={styles.campEmptySub}>Define your first rule above to automatically follow up on inactive customers.</Text>
                  </View>
                ) : (
                  <View style={styles.campList}>
                    {automationRules.map((rule) => (
                      <View key={rule.id} style={[styles.campCard, !rule.is_active && { opacity: 0.7 }]}>
                        <View style={styles.campCardHeader}>
                          <View style={{ gap: 4, flex: 1 }}>
                            <Text style={styles.campCardName}>{rule.name}</Text>
                            <Text style={{ fontSize: 11, color: '#475569', fontFamily: 'PlusJakartaSans_700Bold' }}>
                              Trigger: {rule.trigger_days} Days Inactive
                            </Text>
                          </View>
                          <Switch
                            value={rule.is_active}
                            onValueChange={() => toggleAutomationRuleActive(rule)}
                            trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                            thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : rule.is_active ? '#10B981' : '#F4F3F4'}
                          />
                        </View>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A', marginTop: 4 }}>
                          Subject: {rule.title}
                        </Text>
                        <Text style={styles.campCardDesc}>{rule.message}</Text>
                        
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 }}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                            onPress={() => {
                              setSelectedAutomation(rule);
                              setArName(rule.name);
                              setArTriggerDays(String(rule.trigger_days) as any);
                              setArTitle(rule.title);
                              setArMessage(rule.message);
                              setArSendWhatsApp(rule.send_whatsapp);
                            }}
                          >
                            <Feather name="edit-2" size={13} color="#475569" style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 12, color: '#475569', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Edit</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                            onPress={() => handleDeleteAutomationRule(rule.id)}
                          >
                            <Feather name="trash-2" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 12, color: '#EF4444', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showQrModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 420, justifyContent: 'center', alignItems: 'center', gap: 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link WhatsApp Account</Text>
              <TouchableOpacity onPress={() => setShowQrModal(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#000000" />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.cardSectionDesc, { textAlign: 'center', paddingHorizontal: 10 }]}>
              Open WhatsApp on your phone, navigate to **Settings {'>'} Linked Devices**, and scan the QR code below.
            </Text>

            {whatsappQr ? (
              <Image source={{ uri: whatsappQr }} style={{ width: 180, height: 180, borderRadius: 12 }} />
            ) : (
              <View style={{ width: 180, height: 180, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12 }}>
                <ActivityIndicator size="large" color="#000000" />
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>Generating QR...</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={{ fontSize: 12, color: '#047857', fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                Waiting for device scan...
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Campaign Modal */}
      <Modal
        visible={createModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Launch Campaign</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalFormBody}>
                {/* Form fields */}
                <Text style={styles.modalInputLabel}>CAMPAIGN NAME</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={cName}
                  onChangeText={setCName}
                  placeholder="e.g. Double Points Weekend, Autumn Festival"
                  placeholderTextColor="#BEC6E0"
                  {...Platform.select({
                    web: {
                      outlineStyle: 'none',
                    } as any,
                  })}
                />

                <Text style={styles.modalInputLabel}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.modalTextInput, { height: 72, textAlignVertical: 'top' }]}
                  multiline
                  value={cDesc}
                  onChangeText={setCDesc}
                  placeholder="Describe the campaign terms to your customers..."
                  placeholderTextColor="#BEC6E0"
                  {...Platform.select({
                    web: {
                      outlineStyle: 'none',
                    } as any,
                  })}
                />

                <Text style={styles.modalInputLabel}>PROMOTION TYPE</Text>
                <View style={styles.segmentRow}>
                  {([
                    { label: 'Double Points', value: 'double_points' },
                    { label: 'Flat Bonus', value: 'flat_bonus' },
                    { label: 'Bonus Stamps', value: 'bonus_stamps' },
                  ] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.segmentBtn,
                        cType === opt.value && styles.segmentBtnActive,
                        { flex: 1, paddingHorizontal: 4 }
                      ]}
                      onPress={() => setCType(opt.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          cType === opt.value && styles.segmentTextActive,
                          { fontSize: 10 }
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Conditional Fields */}
                {cType === 'double_points' && (
                  <View style={styles.condFieldWrap}>
                    <Text style={styles.modalInputLabel}>POINT MULTIPLIER</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      value={cCMultiplier}
                      onChangeText={setCMultiplier}
                      placeholder="e.g. 2 for 2x points"
                      placeholderTextColor="#BEC6E0"
                      keyboardType="numeric"
                      {...Platform.select({
                        web: {
                          outlineStyle: 'none',
                        } as any,
                      })}
                    />
                  </View>
                )}

                {cType === 'flat_bonus' && (
                  <View style={styles.condFieldWrap}>
                    <Text style={styles.modalInputLabel}>FLAT POINTS VALUE</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      value={cBonusValue}
                      onChangeText={setCBonusValue}
                      placeholder="e.g. 50 bonus points"
                      placeholderTextColor="#BEC6E0"
                      keyboardType="number-pad"
                      {...Platform.select({
                        web: {
                          outlineStyle: 'none',
                        } as any,
                      })}
                    />
                  </View>
                )}

                {cType === 'bonus_stamps' && (
                  <View style={styles.condFieldWrap}>
                    <Text style={styles.modalInputLabel}>BONUS STAMPS AWARDED</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      value={cBonusValue}
                      onChangeText={setCBonusValue}
                      placeholder="e.g. 1 bonus stamp"
                      placeholderTextColor="#BEC6E0"
                      keyboardType="number-pad"
                      {...Platform.select({
                        web: {
                          outlineStyle: 'none',
                        } as any,
                      })}
                    />
                  </View>
                )}

                {/* Dates selection */}
                <View style={styles.datesRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalInputLabel}>START DATE</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      value={cStartDate}
                      onChangeText={setCStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#BEC6E0"
                      {...Platform.select({
                        web: {
                          outlineStyle: 'none',
                        } as any,
                      })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalInputLabel}>END DATE</Text>
                    <TextInput
                      style={styles.modalTextInput}
                      value={cEndDate}
                      onChangeText={setCEndDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#BEC6E0"
                      {...Platform.select({
                        web: {
                          outlineStyle: 'none',
                        } as any,
                      })}
                    />
                  </View>
                </View>

                <Text style={styles.modalInputLabel}>MAX REDEMPTIONS (OPTIONAL)</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={cMaxRedemptions}
                  onChangeText={setCMaxRedemptions}
                  placeholder="Unlimited if left empty"
                  placeholderTextColor="#BEC6E0"
                  keyboardType="number-pad"
                  {...Platform.select({
                    web: {
                      outlineStyle: 'none',
                    } as any,
                  })}
                />

                <TouchableOpacity 
                  style={[styles.saveBtn, { marginTop: 12 }]} 
                  onPress={handleCreateCampaign}
                  disabled={isCreatingCampaign}
                  activeOpacity={0.9}
                >
                  {isCreatingCampaign ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Launch Promotion</Text>
                  )}
                </TouchableOpacity>
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
    gap: 12,
    marginVertical: 4,
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
    color: '#9CA3AF',
  },
  merchantName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  titleSection: {
    gap: 8,
  },
  welcomeTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
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
    color: '#000000',
  },
  cardSectionDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  segmentBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  segmentBtnActive: {
    borderColor: '#000000',
    borderWidth: 2,
    backgroundColor: '#F8FAFC',
  },
  segmentText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
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
    borderColor: '#000000',
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
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
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
    borderColor: '#000000',
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
    shadowColor: '#000000',
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
    backgroundColor: '#000000',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
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
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    shadowColor: '#000000',
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
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  subTabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  subTabText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  subTabTextActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
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
    color: '#000000',
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
    backgroundColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 4,
  },
  createCampBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  campEmptyState: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  campEmptyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
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
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  campEmptyBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
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
    color: '#000000',
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
    color: '#000000',
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
    marginBottom: 4,
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#000000',
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
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
    borderColor: '#000000',
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
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
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
    shadowColor: '#000000',
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
    color: '#000000',
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
    color: '#000000',
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
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
    width: '100%',
  },
  triggerDayBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerDayBtnActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
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
});
