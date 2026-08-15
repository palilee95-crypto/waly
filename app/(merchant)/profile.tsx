import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Switch,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import FlippableLoyaltyCard from '../(customer)/_components/FlippableLoyaltyCard';

const { width } = Dimensions.get('window');

type SettingItemProps = {
  iconName: any;
  title: string;
  subtitle: string;
  onPress?: () => void;
  iconBgColor?: string;
  iconColor?: string;
  badgeText?: string;
  badgeColor?: string;
};

const SettingItem = ({
  iconName,
  title,
  subtitle,
  onPress,
  iconBgColor = '#F3F4F6',
  iconColor = '#565e74',
}: SettingItemProps) => (
  <TouchableOpacity style={styles.settingCard} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.settingIconBg, { backgroundColor: iconBgColor }]}>
      <Ionicons name={iconName} size={20} color={iconColor} />
    </View>
    <View style={styles.settingInfo}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#BEC6E0" />
  </TouchableOpacity>
);

const BentoSquareItem = ({
  iconName,
  title,
  subtitle,
  onPress,
  iconBgColor = '#F3F4F6',
  iconColor = '#565e74',
  badgeText,
  badgeColor = '#22C55E'
}: SettingItemProps) => (
  <TouchableOpacity style={styles.bentoSquareCard} onPress={onPress} activeOpacity={0.8}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <View style={[styles.settingIconBg, { backgroundColor: iconBgColor }]}>
        <Ionicons name={iconName} size={22} color={iconColor} />
      </View>
      {badgeText && (
        <View style={{ backgroundColor: badgeColor, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, shadowColor: badgeColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 }}>
          <Text style={{ color: '#FFF', fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: 0.5 }}>{badgeText}</Text>
        </View>
      )}
    </View>
    <Text style={styles.settingTitle} numberOfLines={1}>{title}</Text>
    <Text style={[styles.settingSubtitle, { marginTop: 4, color: '#737686', fontSize: 11 }]} numberOfLines={2}>{subtitle}</Text>
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { logout, user, switchRole, updateProfile } = useAuth();
  const router = useRouter();
  const { locale, setLocale, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [merchant, setMerchant] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // Language & Password modals
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [metaModalVisible, setMetaModalVisible] = useState(false);
  const [metaWabaId, setMetaWabaId] = useState('');
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaPhone, setMetaPhone] = useState('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isDisconnectingMeta, setIsDisconnectingMeta] = useState(false);
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);
  const [connectingStepText, setConnectingStepText] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [metaConfigId, setMetaConfigId] = useState<string | null>(null);

  const [showMetaHelp, setShowMetaHelp] = useState(false);
  const [showManualSetup, setShowManualSetup] = useState(false);
  const [showMetaDetails, setShowMetaDetails] = useState(false);

  // WhatsApp connection states
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [program, setProgram] = useState<any>(null);
  const [whatsappQr, setWhatsappQr] = useState<string>('');
  const [whatsappPhone, setWhatsappPhone] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairPhone, setPairPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalConfig, setResultModalConfig] = useState({ title: '', desc: '', type: 'success' });

  // Edit store profile states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editStoreName, setEditStoreName] = useState('');
  const [editBusinessEmail, setEditBusinessEmail] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editMonthlySalesGoal, setEditMonthlySalesGoal] = useState('10000');
  const [editAddress, setEditAddress] = useState('');
  const [editCategory, setEditCategory] = useState<'food' | 'retail' | 'beauty' | 'health' | 'entertainment' | 'other'>('food');
  const [editLat, setEditLat] = useState('6.2443');
  const [editLng, setEditLng] = useState('100.4217');
  const [logoFile, setLogoFile] = useState<any>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<any>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [locationRecord, setLocationRecord] = useState<any>(null);

  // Onboarding branding states
  const [brandingModalVisible, setBrandingModalVisible] = useState(false);
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState('#050505');
  const [brandingWelcomeText, setBrandingWelcomeText] = useState('');
  const [brandingLogoUrl, setBrandingLogoUrl] = useState('');
  const [brandingBgUrl, setBrandingBgUrl] = useState('');
  const [brandingBgFile, setBrandingBgFile] = useState<any>(null);
  const [brandingBgPreview, setBrandingBgPreview] = useState<string | null>(null);
  const [brandingLogoFile, setBrandingLogoFile] = useState<any>(null);
  const [brandingLogoPreview, setBrandingLogoPreview] = useState<string | null>(null);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  // Dedicated Operating Hours Modal States (Individual Days)
  const [hoursModalVisible, setHoursModalVisible] = useState(false);
  const [monHours, setMonHours] = useState('08:00 - 22:00');
  const [monClosed, setMonClosed] = useState(false);
  const [tueHours, setTueHours] = useState('08:00 - 22:00');
  const [tueClosed, setTueClosed] = useState(false);
  const [wedHours, setWedHours] = useState('08:00 - 22:00');
  const [wedClosed, setWedClosed] = useState(false);
  const [thuHours, setThuHours] = useState('08:00 - 22:00');
  const [thuClosed, setThuClosed] = useState(false);
  const [friHours, setFriHours] = useState('08:00 - 22:00');
  const [friClosed, setFriClosed] = useState(false);
  const [satHours, setSatHours] = useState('09:00 - 23:00');
  const [satClosed, setSatClosed] = useState(false);
  const [sunHours, setSunHours] = useState('09:00 - 21:00');
  const [sunClosed, setSunClosed] = useState(false);
  const [isSavingHours, setIsSavingHours] = useState(false);

  const logoUrl = merchant?.logo 
    ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
    : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200';

  const fetchWhatsappStatus = async (generateQr = false) => {
    if (!user || !user.merchant_id) return;
    try {
      const url = `/api/risev/merchant/whatsapp/status${generateQr ? '?generateQr=true' : ''}`;
      const res = await pb.send(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setWhatsappStatus(res.status);
      if (res.phone) {
        setWhatsappPhone(res.phone);
      } else {
        setWhatsappPhone('');
      }
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
      await pb.send('/api/risev/merchant/whatsapp/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setWhatsappStatus('disconnected');
      setWhatsappQr('');
      setWhatsappPhone('');
      setResultModalConfig({
        title: locale === 'en' ? 'Disconnected' : 'Dinyahsambung',
        desc: locale === 'en' ? 'Your WhatsApp account has been disconnected.' : 'Akaun WhatsApp anda telah diputuskan sambungan.',
        type: 'success'
      });
      setShowResultModal(true);
    } catch (err) {
      setResultModalConfig({
        title: locale === 'en' ? 'Error' : 'Ralat',
        desc: locale === 'en' ? 'Failed to disconnect WhatsApp account.' : 'Gagal memutuskan sambungan akaun WhatsApp.',
        type: 'error'
      });
      setShowResultModal(true);
      setWhatsappStatus('connected');
    }
  };

  const handleWhatsappPress = () => {
    if (whatsappStatus === 'connected') {
      setShowDisconnectModal(true);
    } else {
      setShowQrModal(true);
      fetchWhatsappStatus(true);
    }
  };

  // Initialize Facebook JS SDK for Embedded Signup popup on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const fbAppId = process.env.EXPO_PUBLIC_META_APP_ID || '1040853298682209';

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }

    (window as any).fbAsyncInit = function () {
      if ((window as any).FB) {
        (window as any).FB.init({
          appId: fbAppId,
          autoLogAppEvents: true,
          xfbml: true,
          version: 'v20.0'
        });
      }
    };

    const handleMetaMessage = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('[META EMBEDDED SIGNUP EVENT]', data);
          if (data.data?.waba_id) setMetaWabaId(data.data.waba_id);
          if (data.data?.phone_number_id) setMetaPhoneId(data.data.phone_number_id);
          if (data.data?.current_step) {
            setConnectingStepText(`Step: ${String(data.data.current_step).replace(/_/g, ' ')}...`);
          }
        }
      } catch (err) {}
    };

    window.addEventListener('message', handleMetaMessage);
    return () => {
      window.removeEventListener('message', handleMetaMessage);
    };
  }, []);

  const handleOpenMetaSetup = () => {
    fetchMetaConfig();
    setMetaModalVisible(true);
  };

  const handleSendTestMessage = async () => {
    if (!user || !user.merchant_id) return;
    setIsSendingTest(true);
    try {
      const res = await pb.send('/api/risev/merchant/whatsapp/send-test', {
        method: 'POST',
        body: { phone: metaPhone || user.phone }
      });
      if (res && res.success) {
        Alert.alert('Message Sent! 🚀', `A test WhatsApp message was sent to ${metaPhone || user.phone}. Please check your phone!`);
      } else {
        Alert.alert('Send Notice', res?.error || 'Could not send test message.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send test message.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleQuickConnectMeta = () => {
    if (!user || !user.merchant_id) return;
    
    const fbAppId = process.env.EXPO_PUBLIC_META_APP_ID || '1040853298682209'; 
    const fbConfigId = process.env.EXPO_PUBLIC_META_CONFIG_ID || '';

    // Check if FB SDK is loaded on web
    if (Platform.OS === 'web' && (window as any).FB && fbConfigId) {
      setIsConnectingMeta(true);
      setConnectingStepText('Connecting via Meta popup...');
      (window as any).FB.login(
        async (response: any) => {
          console.log('[META FB.LOGIN RESPONSE]', response);
          if (response?.authResponse?.code) {
            setConnectingStepText('Configuring WhatsApp Business Account & Webhooks...');
            try {
              const res = await pb.send('/api/risev/merchant/whatsapp/meta-connect', {
                method: 'POST',
                body: {
                  code: response.authResponse.code,
                  wabaId: metaWabaId,
                  phoneNumberId: metaPhoneId
                }
              });
              if (res && res.success) {
                await fetchMetaConfig();
                setResultModalConfig({
                  title: 'WhatsApp Connected! 🎉',
                  desc: `Your WhatsApp Business API (${res.phone_number || 'verified number'}) is active and ready to deliver loyalty updates!`,
                  type: 'success'
                });
                setShowResultModal(true);
              } else {
                Alert.alert('Notice', res?.message || 'Meta connection received.');
                await fetchMetaConfig();
              }
            } catch (err: any) {
              Alert.alert('Connection Error', err.message || 'Failed to complete Meta setup.');
            } finally {
              setIsConnectingMeta(false);
              setConnectingStepText('');
            }
          } else {
            setIsConnectingMeta(false);
            setConnectingStepText('');
          }
        },
        {
          config_id: fbConfigId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            feature: 'whatsapp_embedded_signup',
            version: 2,
            setup: {}
          }
        }
      );
      return;
    }

    // Fallback standard OAuth redirection if SDK not ready or on native
    const pbBaseUrl = pb.baseUrl.replace(/\/$/, '');
    const redirectUriRaw = pbBaseUrl + '/api/risev/merchant/whatsapp/callback';

    const stateObj = {
      merchantId: user.merchant_id,
      redirectHost: Platform.OS === 'web' ? window.location.origin : 'https://risev.app',
      callbackUrl: redirectUriRaw
    };
    
    const encodedState = encodeURIComponent(JSON.stringify(stateObj));
    const redirectUri = encodeURIComponent(redirectUriRaw);
    
    let oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${fbAppId}&redirect_uri=${redirectUri}&state=${encodedState}&response_type=code`;
    if (fbConfigId) {
      const extrasObj = { setup: {} };
      oauthUrl += `&config_id=${fbConfigId}&override_default_response_type=true&extras=${encodeURIComponent(JSON.stringify(extrasObj))}`;
    } else {
      oauthUrl += `&scope=whatsapp_business_management,whatsapp_business_messaging`;
    }
    
    Linking.openURL(oauthUrl).catch(() => {
      Alert.alert('Error', 'Unable to open Meta Embedded Signup portal.');
    });
  };

  const fetchMetaConfig = async () => {
    if (!user || !user.merchant_id) return;
    try {
      const records = await pb.collection('whatsapp_configurations').getFullList({
        filter: `merchant = '${user.merchant_id}'`,
      });
      if (records.length > 0) {
        const rec = records[0];
        setMetaConfigId(rec.id);
        setMetaWabaId(rec.waba_id || '');
        setMetaPhoneId(rec.phone_number_id || '');
        setMetaToken(rec.access_token || '');
        setMetaPhone(rec.phone_number || '');
      } else {
        setMetaConfigId(null);
        setMetaWabaId('');
        setMetaPhoneId('');
        setMetaToken('');
        setMetaPhone('');
      }
    } catch (err) {
      console.warn('Failed to fetch Meta configuration:', err);
    }
  };

  const handleSaveMeta = async () => {
    if (!user || !user.merchant_id) return;
    if (!metaWabaId.trim() || !metaPhoneId.trim() || !metaToken.trim() || !metaPhone.trim()) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    
    setIsSavingMeta(true);
    try {
      const payload = {
        merchant: user.merchant_id,
        waba_id: metaWabaId.trim(),
        phone_number_id: metaPhoneId.trim(),
        access_token: metaToken.trim(),
        phone_number: metaPhone.trim(),
        status: 'connected'
      };
      
      if (metaConfigId) {
        await pb.collection('whatsapp_configurations').update(metaConfigId, payload);
      } else {
        const rec = await pb.collection('whatsapp_configurations').create(payload);
        setMetaConfigId(rec.id);
      }
      
      Alert.alert('Success', 'WhatsApp Cloud API credentials saved successfully!');
      setMetaModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to save configuration: ' + (err.message || err));
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleDisconnectMeta = async () => {
    if (!metaConfigId) return;
    
    setIsDisconnectingMeta(true);
    try {
      await pb.collection('whatsapp_configurations').delete(metaConfigId);
      setMetaConfigId(null);
      setMetaWabaId('');
      setMetaPhoneId('');
      setMetaToken('');
      setMetaPhone('');
      Alert.alert('Success', 'WhatsApp account disconnected and credentials removed.');
      setMetaModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to disconnect: ' + (err.message || err));
    } finally {
      setIsDisconnectingMeta(false);
    }
  };

  const handlePair = async () => {
    if (!pairPhone.trim()) {
      Alert.alert(
        locale === 'en' ? 'Error' : 'Ralat', 
        locale === 'en' ? 'Please enter your WhatsApp phone number.' : 'Sila masukkan nombor telefon WhatsApp anda.'
      );
      return;
    }
    const cleanPhone = pairPhone.trim().replace(/[\s\-]/g, '');
    if (!/^(\+?60|0)?\d{8,12}$/.test(cleanPhone)) {
      Alert.alert(
        locale === 'en' ? 'Error' : 'Ralat', 
        locale === 'en' ? 'Please enter a valid Malaysian phone number (e.g. 0123456789).' : 'Sila masukkan nombor telefon Malaysia yang sah (cth. 0123456789).'
      );
      return;
    }

    setIsPairing(true);
    setPairingCode('');
    try {
      const res = await pb.send('/api/risev/merchant/whatsapp/pair', {
        method: 'POST',
        body: { phone: cleanPhone },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        },
        requestKey: null,
      });

      if (res.success && res.pairingCode) {
        setPairingCode(res.pairingCode);
      } else {
        const errMsg = res.message || (locale === 'en' ? 'Failed to generate pairing code.' : 'Gagal menjana kod berpasangan.');
        setShowPairModal(false);
        setResultModalConfig({
          title: locale === 'en' ? 'Error' : 'Ralat',
          desc: errMsg,
          type: 'error'
        });
        setShowResultModal(true);
      }
    } catch (err: any) {
      const errMsg = err?.response?.message || err?.message || (locale === 'en' ? 'Failed to generate pairing code.' : 'Gagal menjana kod berpasangan.');
      setShowPairModal(false);
      setResultModalConfig({
        title: locale === 'en' ? 'Error' : 'Ralat',
        desc: errMsg,
        type: 'error'
      });
      setShowResultModal(true);
    } finally {
      setIsPairing(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert(t('validation_error'), t('password_length'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('validation_error'), t('password_mismatch'));
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await updateProfile(user?.name || '', null, newPassword, confirmPassword);
      setPasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t('success'), t('password_updated'));
    } catch (err: any) {
      Alert.alert(t('error'), err.message || t('password_update_failed'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Helper to determine trial status
  const getTrialStatus = () => {
    if (subscription) {
      const subStatus = subscription.status;
      const periodEnd = subscription.current_period_end;

      if (subStatus === 'trialing' && periodEnd) {
        const expiryTime = new Date(periodEnd.replace(' ', 'T')).getTime();
        const diffDays = (expiryTime - Date.now()) / (1000 * 60 * 60 * 24);
        const daysRemaining = Math.max(0, Math.ceil(diffDays));
        return {
          isInTrial: daysRemaining > 0,
          daysRemaining: daysRemaining
        };
      }

      if (subStatus === 'active') {
        return {
          isInTrial: false,
          daysRemaining: 0
        };
      }
    }

    if (user?.merchant_status === 'pending' && user?.merchant_created) {
      const formattedDate = user.merchant_created.replace(' ', 'T');
      const createdTime = new Date(formattedDate).getTime();
      const now = new Date().getTime();
      const diffMs = now - createdTime;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays < 7) {
        return {
          isInTrial: true,
          daysRemaining: Math.max(0, Math.ceil(7 - diffDays))
        };
      }
    }
    return { isInTrial: false, daysRemaining: 0 };
  };

  const { isInTrial, daysRemaining: trialDaysRemaining } = getTrialStatus();

  const getExpiryLabel = () => {
    if (!subscription || !subscription.current_period_end) return '';
    try {
      const dateOnly = subscription.current_period_end.split(' ')[0]; // yyyy-mm-dd
      const parsedDate = new Date(dateOnly);
      const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `Exp: ${parsedDate.getDate()} ${monthsList[parsedDate.getMonth()]} ${parsedDate.getFullYear()}`;
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!user || !user.merchant_id) return;
      try {
        const mRec = await pb.collection('merchants').getOne(user.merchant_id);
        setMerchant(mRec);

        // Fetch WhatsApp status only if user is owner (Disabled - WhatsApp service decommissioned)
        // if (mRec.owner === user.id) {
        //   fetchWhatsappStatus();
        // }

        // Fetch subscription record
        try {
          const subRec = await pb.collection('subscriptions').getFirstListItem(`merchant = "${user.merchant_id}"`);
          setSubscription(subRec);
        } catch (e: any) {
          console.log("No active subscription row found for profile view:", e.message);
        }

        // Fetch program record for live preview
        try {
          const progRec = await pb.collection('loyalty_programs').getFirstListItem(`merchant = "${user.merchant_id}"`);
          setProgram(progRec);
        } catch (e: any) {
          console.log("No active program row found for profile view");
        }

        const locs = await pb.collection('store_locations').getFullList({
          filter: `merchant = "${user.merchant_id}"`,
          requestKey: null,
        });
        if (locs.length > 0) {
          setLocationRecord(locs[0]);
        }
      } catch (err) {
        console.warn('Failed to fetch merchant profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMerchant();
  }, [user]);

  useEffect(() => {
    let active = true;
    let intervalId: any;
    let attemptCount = 0;
    const MAX_ATTEMPTS = 20; // ~5min total with backoff; stops storming a broken backend
    const isModalOpen = showQrModal || showPairModal;
    if (isModalOpen && user && user.merchant_id) {
      const poll = async () => {
        if (!active) return;
        attemptCount += 1;
        if (attemptCount > MAX_ATTEMPTS) {
          console.warn('WhatsApp polling exceeded max attempts, stopping.');
          setWhatsappStatus('disconnected');
          return;
        }
        try {
          const url = `/api/risev/merchant/whatsapp/status${showQrModal ? '?generateQr=true' : ''}`;
          const res = await pb.send(url, {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer ' + pb.authStore.token
            }
          });
          if (!active) return;
          if (res.status === 'connected') {
            setWhatsappStatus('connected');
            if (res.phone) {
              setWhatsappPhone(res.phone);
            }
            setShowQrModal(false);
            setShowPairModal(false);
            setResultModalConfig({
              title: locale === 'en' ? 'Success' : 'Berjaya',
              desc: locale === 'en' ? 'WhatsApp connected successfully!' : 'WhatsApp berjaya disambungkan!',
              type: 'success'
            });
            setShowResultModal(true);
            return;
          } else if (showQrModal && res.qrcode) {
            setWhatsappQr(res.qrcode);
          }
        } catch (err) {
          console.warn('Polling WhatsApp status failed:', err);
        }
        if (!active) return;
        // Exponential backoff capped at 30s: 3s, 6s, 12s, 24s, 30s, 30s...
        const delay = Math.min(3000 * Math.pow(2, attemptCount - 1), 30000);
        intervalId = setTimeout(poll, delay);
      };
      poll();
    }
    return () => {
      active = false;
      if (intervalId) clearTimeout(intervalId);
    };
  }, [showQrModal, showPairModal]);

  // Leaflet Map Injection and Management (Web Only)
  useEffect(() => {
    if (Platform.OS !== 'web' || !editModalVisible) return;
    
    // Inject Leaflet Stylesheet if not already present
    let link = document.getElementById('leaflet-css') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    let mapInstance: any = null;

    function initMap() {
      const L = (window as any).L;
      if (!L) return;

      const mapDiv = document.getElementById('store-edit-map');
      if (!mapDiv) return;

      const startLat = parseFloat(editLat) || 6.2443;
      const startLng = parseFloat(editLng) || 100.4217;

      try {
        mapInstance = L.map('store-edit-map').setView([startLat, startLng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstance);

        let marker = L.marker([startLat, startLng], { draggable: true }).addTo(mapInstance);

        marker.on('dragend', function (event: any) {
          const position = marker.getLatLng();
          setEditLat(position.lat.toFixed(6));
          setEditLng(position.lng.toFixed(6));
        });

        mapInstance.on('click', function (event: any) {
          const latlng = event.latlng;
          marker.setLatLng(latlng);
          setEditLat(latlng.lat.toFixed(6));
          setEditLng(latlng.lng.toFixed(6));
        });

        // Trigger resize event to render correctly
        setTimeout(() => {
          if (mapInstance) {
            mapInstance.invalidateSize();
          }
        }, 200);
      } catch (err) {
        console.warn("Leaflet initialization warning:", err);
      }
    }

    // Inject Leaflet Javascript if not already present
    let script = document.getElementById('leaflet-js') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        initMap();
      };
      document.head.appendChild(script);
    } else {
      // If already loaded, initialize directly
      setTimeout(initMap, 100);
    }

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [editModalVisible]);

  const handleOpenBranding = () => {
    setBrandingPrimaryColor(merchant?.onboarding_primary_color || '#050505');
    setBrandingWelcomeText(merchant?.onboarding_welcome_text || '');
    setBrandingLogoUrl(merchant?.onboarding_logo_url || '');
    setBrandingBgUrl(merchant?.onboarding_bg_url || '');
    setBrandingBgFile(null);
    const bgUrl = merchant?.background_image
      ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.background_image}`
      : null;
    setBrandingBgPreview(bgUrl);
    setBrandingLogoFile(null);
    setBrandingLogoPreview(null);
    setBrandingModalVisible(true);
  };

  const handlePickBrandingBg = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            setBrandingBgFile(file);
            setBrandingBgPreview(event.target.result);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert('Not Supported', 'Image upload is web-only in this version.');
    }
  };

  const handlePickBrandingLogo = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            setBrandingLogoFile(file);
            setBrandingLogoPreview(event.target.result);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert('Not Supported', 'Image upload is web-only in this version.');
    }
  };

  const handleSaveBranding = async () => {
    if (!user?.merchant_id) return;
    setIsSavingBranding(true);
    try {
      const formData = new FormData();
      formData.append('onboarding_primary_color', brandingPrimaryColor);
      formData.append('onboarding_welcome_text', brandingWelcomeText);
      formData.append('onboarding_logo_url', brandingLogoUrl);
      formData.append('onboarding_bg_url', brandingBgUrl);

      if (brandingLogoFile) {
        formData.append('logo', brandingLogoFile);
      }
      if (brandingBgFile) {
        formData.append('background_image', brandingBgFile);
      }

      const mRec = await pb.collection('merchants').update(user.merchant_id, formData);
      setMerchant(mRec);
      setBrandingModalVisible(false);
      Alert.alert('Saved', 'Onboarding branding updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save branding.');
    } finally {
      setIsSavingBranding(false);
    }
  };
  const handleOpenEdit = () => {
    router.push('/(merchant)/edit-profile' as any);
  };

  const handleSwitchToCustomer = async () => {
    await switchRole('customer');
    router.replace('/(customer)');
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    await logout();
    router.replace('/(auth)/login');
  };

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 20 + insets.top },
          isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Dark Header Background */}
        <View style={{ position: 'absolute', top: -(30 + insets.top), left: -20, right: -20, height: 260 + insets.top, backgroundColor: '#050505', zIndex: 0 }} />

        {/* Header Row: Title & Logo aligned */}
        <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }, { justifyContent: 'space-between', paddingHorizontal: 0, marginTop: 8, marginBottom: 12 }]}>
          <Text style={[styles.screenTitle, { color: '#FFFFFF' }]}>{t('profile_settings')}</Text>
          <Image
            source={require('../../assets/risev logo.png')}
            style={{ width: 96, height: 32, resizeMode: 'contain', tintColor: '#FFFFFF' }}
          />
        </View>

        {/* Store Profile Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeaderRow}>
            <Image
              source={{ uri: logoUrl }}
              style={styles.shopImage}
            />
            <View style={styles.shopMainInfo}>
              <Text style={styles.shopName}>{merchant?.name || user?.name || 'The Coffee House'}</Text>
              <View style={styles.partnerRow}>
                {merchant?.status === 'active' ? (
                  <>
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                    {subscription?.current_period_end && (
                      <Text style={styles.locationText}>{getExpiryLabel()}</Text>
                    )}
                  </>
                ) : isInTrial ? (
                  <>
                    <View style={styles.trialBadge}>
                      <Text style={styles.trialBadgeText}>TRIAL</Text>
                    </View>
                    <Text style={styles.locationText}>{trialDaysRemaining}d left</Text>
                  </>
                ) : (
                  <View style={styles.expiredBadge}>
                    <Text style={styles.expiredBadgeText}>SUSPENDED</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.updateBtn} onPress={handleOpenEdit} activeOpacity={0.8}>
              <Text style={styles.updateBtnText}>
                {locale === 'en' ? 'Edit Profile' : 'Edit Profil'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Details Divider line */}
          <View style={styles.divider} />

          {/* Details list */}
          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('business_email')}</Text>
              <Text style={styles.detailValue}>
                {merchant?.metadata?.email || merchant?.website || (user as any)?.email || 'hello@thecoffeehouse.my'}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('phone_number')}</Text>
              <Text style={styles.detailValue}>
                {merchant?.metadata?.phone || user?.phone || '+60 3-1234 5678'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('address')}</Text>
              <Text style={styles.detailValue}>
                {merchant?.description || 'Lot G-12, Premium Galleries, Persiaran KLCC, 50088 Kuala Lumpur'}
              </Text>
            </View>
          </View>
        </View>

        {/* Switch Role Card (Go back to Customer mode) */}
        <View style={styles.switchCard}>
          <View style={styles.switchHeader}>
            <Ionicons name="people-outline" size={24} color="#050505" />
            <View style={styles.switchInfo}>
              <Text style={styles.switchTitle}>{t('personal_account')}</Text>
              <Text style={styles.switchSubtitle}>{t('switch_customer_desc')}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.switchButton} onPress={handleSwitchToCustomer} activeOpacity={0.8}>
            <Text style={styles.switchButtonText}>{t('switch_customer_btn')}</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>



        {/* Account Settings Section Header */}
        <Text style={styles.sectionHeader}>{t('account_settings')}</Text>

        {/* Settings Options Grid */}
        <View style={styles.settingsGrid}>
          {merchant && merchant.owner === user?.id && (
            <>
              <SettingItem
                iconName="people-outline"
                title={t('manage_staff')}
                subtitle={t('manage_staff_desc')}
                iconBgColor="#F1F5F9"
                iconColor="#050505"
                onPress={() => router.push('/(merchant)/staff' as any)}
              />

              <SettingItem
                iconName="gift-outline"
                title={t('manage_rewards')}
                subtitle={t('manage_rewards_desc')}
                iconBgColor="#FFF3E0"
                iconColor="#FF9800"
                onPress={() => router.push('/(merchant)/rewards' as any)}
              />
              <SettingItem
                iconName="logo-whatsapp"
                title="WhatsApp Cloud API"
                subtitle={metaConfigId ? `Connected to ${metaPhone}` : "Link your Meta WABA to run auto-campaigns"}
                iconBgColor="#E8F5E9"
                iconColor="#4CAF50"
                onPress={handleOpenMetaSetup}
              />
            </>
          )}
          <SettingItem
            iconName="color-palette-outline"
            title="Onboarding Setup"
            subtitle="Customize your customer-facing onboarding page"
            iconBgColor="#F1F5F9"
            iconColor="#050505"
            onPress={() => router.push('/(merchant)/onboarding-setup' as any)}
          />
          
          <View style={styles.bentoRow}>
            <BentoSquareItem
              iconName="cart-outline"
              title={locale === 'en' ? 'NFC Marketplace' : 'Pasaran NFC'}
              subtitle={locale === 'en' ? 'Explore NFC stand marketplace' : 'Teroka pasaran stand NFC'}
              iconBgColor="#F1F5F9"
              iconColor="#050505"
              onPress={() => router.push('/(merchant)/nfc-marketplace' as any)}
            />
            <BentoSquareItem
              iconName="shield-checkmark-outline"
              title={t('security')}
              subtitle={t('security_desc')}
              iconBgColor="#F1F5F9"
              iconColor="#050505"
              onPress={() => setPasswordModalVisible(true)}
            />
          </View>

          <View style={styles.bentoRow}>
            <BentoSquareItem
              iconName="globe-outline"
              title={t('language')}
              subtitle={locale === 'en' ? 'English' : 'Bahasa Melayu'}
              iconBgColor="#F1F5F9"
              iconColor="#050505"
              onPress={() => setLanguageModalVisible(true)}
            />
            <BentoSquareItem
              iconName="sparkles-outline"
              title="My Subscription"
              subtitle="Manage your plan & billing"
              iconBgColor="#FFF3E0"
              iconColor="#FF9800"
              badgeText="PRO"
              badgeColor="#FF9800"
              onPress={() => router.push('/(merchant)/subscription' as any)}
            />
          </View>
          
          <SettingItem
            iconName="document-text-outline"
            title={t('privacy_policy')}
            subtitle={t('privacy_policy_desc')}
            iconBgColor="#F1F5F9"
            iconColor="#050505"
          />
        </View>

        {/* Logout Button Card */}
        <TouchableOpacity
          style={styles.logoutCard}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <View style={styles.logoutIconBg}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </View>
          <View style={styles.logoutInfo}>
            <Text style={styles.logoutTitle}>{t('logout')}</Text>
            <Text style={styles.logoutSubtitle}>{t('logout_desc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FECACA" />
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Premium Log Out Confirmation Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBg}>
              <Ionicons name="log-out" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>{t('logout_confirm_title')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('logout_confirm_desc')}
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>{t('logout')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Premium WhatsApp Disconnect Confirmation Modal */}
      <Modal
        visible={showDisconnectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisconnectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconBg, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="logo-whatsapp" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>
              {locale === 'en' ? 'Disconnect WhatsApp' : 'Putuskan WhatsApp'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {locale === 'en'
                ? 'Your store WhatsApp account is currently connected. Do you want to disconnect it?'
                : 'Akaun WhatsApp kedai anda sedang bersambung. Adakah anda ingin memutus sambungan?'}
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDisconnectModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>
                  {locale === 'en' ? 'Cancel' : 'Batal'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#EF4444' }]}
                onPress={async () => {
                  setShowDisconnectModal(false);
                  await handleDisconnectWhatsapp();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>
                  {locale === 'en' ? 'Disconnect' : 'Putus Sambung'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Premium WhatsApp Result Modal (Success or Error notification) */}
      <Modal
        visible={showResultModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconBg, { backgroundColor: resultModalConfig.type === 'success' ? '#E8F5E9' : '#FEE2E2' }]}>
              <Ionicons
                name={resultModalConfig.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={28}
                color={resultModalConfig.type === 'success' ? '#25D366' : '#EF4444'}
              />
            </View>
            <Text style={styles.modalTitle}>{resultModalConfig.title}</Text>
            <Text style={styles.modalSubtitle}>{resultModalConfig.desc}</Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { flex: 1, backgroundColor: '#050505' }]}
                onPress={() => setShowResultModal(false)}
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

      {/* WhatsApp QR Pairing Modal */}
      <Modal
        visible={showQrModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { minHeight: 400, justifyContent: 'center', alignItems: 'center', gap: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12 }}>
              <Text style={[styles.modalTitle, { textAlign: 'left' }]}>{t('link_whatsapp')}</Text>
              <TouchableOpacity onPress={() => setShowQrModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalSubtitle, { textAlign: 'center', paddingHorizontal: 10, marginTop: 4 }]}>
              {t('scan_instructions')}
            </Text>

            {whatsappQr ? (
              <Image source={{ uri: whatsappQr }} style={{ width: 180, height: 180, borderRadius: 12 }} />
            ) : (
              <View style={{ width: 180, height: 180, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12 }}>
                <ActivityIndicator size="large" color="#050505" />
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>{t('generating_qr')}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={{ fontSize: 12, color: '#047857', fontFamily: 'PlusJakartaSans_700Bold' }}>
                {t('waiting_scan')}
              </Text>
            </View>

            <TouchableOpacity 
              style={{ marginTop: 12, padding: 8 }}
              onPress={() => {
                setShowQrModal(false);
                setPairPhone(merchant?.metadata?.phone || user?.phone || '');
                setPairingCode('');
                setShowPairModal(true);
              }}
            >
              <Text style={{ fontSize: 13, color: '#3B82F6', fontFamily: 'PlusJakartaSans_700Bold' }}>
                {locale === 'en' ? 'Link with phone number instead' : 'Paut dengan nombor telefon sebaliknya'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* WhatsApp Phone Pairing Modal */}
      <Modal
        visible={showPairModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPairModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { minHeight: 380, width: '100%', maxWidth: 350, gap: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12 }}>
              <Text style={[styles.modalTitle, { textAlign: 'left' }]}>
                {locale === 'en' ? 'Link with Phone Number' : 'Paut dengan Nombor Telefon'}
              </Text>
              <TouchableOpacity onPress={() => setShowPairModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {!pairingCode ? (
              <>
                <Text style={[styles.modalSubtitle, { textAlign: 'left', paddingHorizontal: 0, marginTop: 4, alignSelf: 'stretch' }]}>
                  {locale === 'en' 
                    ? 'Enter your WhatsApp phone number to request an 8-character pairing code to link your device.' 
                    : 'Masukkan nombor telefon WhatsApp anda untuk meminta kod berpasangan 8 aksara untuk memautkan peranti anda.'}
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    {locale === 'en' ? 'WhatsApp Number' : 'Nombor WhatsApp'}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={pairPhone}
                    onChangeText={setPairPhone}
                    placeholder="e.g. +60123456789"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />
                </View>

                <TouchableOpacity
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: '#050505',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: 8
                  }}
                  onPress={handlePair}
                  disabled={isPairing}
                >
                  {isPairing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalConfirmText}>
                      {locale === 'en' ? 'Generate Pairing Code' : 'Jana Kod Berpasangan'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ marginTop: 8, padding: 8, alignItems: 'center' }}
                  onPress={() => {
                    setShowPairModal(false);
                    setShowQrModal(true);
                    fetchWhatsappStatus(true);
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#3B82F6', fontFamily: 'PlusJakartaSans_700Bold' }}>
                    {locale === 'en' ? 'Scan QR Code instead' : 'Imbas Kod QR sebaliknya'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.modalSubtitle, { textAlign: 'left', paddingHorizontal: 0, marginTop: 4, alignSelf: 'stretch' }]}>
                  {locale === 'en' 
                    ? 'Enter this pairing code on your phone under Linked Devices > Link with Phone Number:'
                    : 'Masukkan kod berpasangan ini pada telefon anda di bawah Peranti Pautan > Paut dengan Nombor Telefon:'}
                </Text>

                <View style={{ 
                  backgroundColor: '#F8FAFC', 
                  borderWidth: 1.5, 
                  borderColor: '#E2E8F0', 
                  borderRadius: 16, 
                  paddingVertical: 18, 
                  paddingHorizontal: 24, 
                  marginVertical: 12, 
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%' 
                }}>
                  <Text style={{ 
                    fontSize: 32, 
                    fontFamily: 'PlusJakartaSans_800ExtraBold', 
                    letterSpacing: 4, 
                    color: '#0F172A',
                    textAlign: 'center'
                  }}>
                    {pairingCode}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginVertical: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color="#10B981" />
                    <Text style={{ fontSize: 12, color: '#047857', fontFamily: 'PlusJakartaSans_700Bold' }}>
                      {locale === 'en' ? 'Waiting for device linking...' : 'Menunggu pautan peranti...'}
                    </Text>
                  </View>

                  <TouchableOpacity 
                    onPress={handlePair} 
                    disabled={isPairing}
                    style={{ padding: 4 }}
                  >
                    <Text style={{ 
                      fontSize: 12, 
                      color: isPairing ? '#94A3B8' : '#3B82F6', 
                      fontFamily: 'PlusJakartaSans_700Bold',
                      textDecorationLine: 'underline' 
                    }}>
                      {isPairing 
                        ? (locale === 'en' ? 'Generating...' : 'Menjana...') 
                        : (locale === 'en' ? 'Regenerate Code' : 'Jana Semula Kod')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: '#F1F5F9',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: 12
                  }}
                  onPress={() => setPairingCode('')}
                >
                  <Text style={styles.modalCancelText}>
                    {locale === 'en' ? 'Use a different phone number' : 'Gunakan nombor telefon lain'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>



      {/* Custom Premium Language Selection Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: 24 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { textAlign: 'left', marginBottom: 0 }]}>{t('language')}</Text>
              <TouchableOpacity onPress={() => setLanguageModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.languageOptionRow, locale === 'en' && styles.languageOptionRowActive]}
              onPress={async () => {
                await setLocale('en');
                setLanguageModalVisible(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.languageOptionText, locale === 'en' && styles.languageOptionTextActive]}>English</Text>
              {locale === 'en' && <Ionicons name="checkmark-circle" size={20} color="#050505" />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.languageOptionRow, locale === 'ms' && styles.languageOptionRowActive]}
              onPress={async () => {
                await setLocale('ms');
                setLanguageModalVisible(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.languageOptionText, locale === 'ms' && styles.languageOptionTextActive]}>Bahasa Melayu</Text>
              {locale === 'ms' && <Ionicons name="checkmark-circle" size={20} color="#050505" />}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Meta WhatsApp Cloud API Configuration Modal */}
      <Modal
        visible={metaModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMetaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.editModalCard, { maxHeight: '90%', padding: 0, overflow: 'hidden' }]}>
            <ScrollView 
              style={{ width: '100%' }}
              contentContainerStyle={{ padding: 24, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
            {/* Header Area with WhatsApp Green branding */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Ionicons name="logo-whatsapp" size={26} color="#25D366" />
                  <Text style={[styles.modalTitle, { textAlign: 'left', marginBottom: 0 }]}>WhatsApp Cloud API</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 18 }}>
                  Configure your official Meta WhatsApp Business Cloud API credentials to run automated campaigns.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMetaModalVisible(false)} activeOpacity={0.7} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={28} color="#E2E8F0" />
              </TouchableOpacity>
            </View>

            {/* Meta API Pricing & Billing Info Card */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3, width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12 }}>
                <View style={{ backgroundColor: '#EEF2FF', padding: 6, borderRadius: 8 }}>
                  <Ionicons name="card" size={16} color="#4F46E5" />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B' }}>
                    Meta API Pricing (Malaysia)
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                    Meta charges directly to your linked card
                  </Text>
                </View>
              </View>
              
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#475569', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Utility (Follow-ups)</Text>
                  <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 13, color: '#1E293B', fontFamily: 'PlusJakartaSans_800ExtraBold' }}>~RM 0.06 <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>/msg</Text></Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#475569', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Marketing (Blasts)</Text>
                  <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 13, color: '#1E293B', fontFamily: 'PlusJakartaSans_800ExtraBold' }}>~RM 0.35 <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>/msg</Text></Text>
                  </View>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: '#94A3B8', lineHeight: 16, marginTop: 16, fontStyle: 'italic' }}>
                *You must link a debit/credit card to your WhatsApp Business Account (WABA) in Meta Business Suite to allow message delivery.
              </Text>
            </View>

             {metaConfigId ? (
              <View style={{ width: '100%', gap: 20 }}>
                {/* 1. Connected Status Banner */}
                <View style={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: 16, 
                  padding: 20, 
                  shadowColor: '#10B981', 
                  shadowOffset: { width: 0, height: 4 }, 
                  shadowOpacity: 0.1, 
                  shadowRadius: 12, 
                  elevation: 4,
                  alignItems: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: '#A7F3D0'
                }}>
                  <View style={{ backgroundColor: '#ECFDF5', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                    <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {locale === 'en' ? 'Verified & Connected' : 'Disahkan & Bersambung'}
                  </Text>
                  <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#064E3B' }}>
                    {metaPhone}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#047857', textAlign: 'center', opacity: 0.8, lineHeight: 18, marginTop: 4 }}>
                    {locale === 'en' 
                      ? 'Your Meta Cloud API is fully set up. Automated campaigns are now active.' 
                      : 'Meta Cloud API anda telah disiapkan sepenuhnya. Kempen automatik kini aktif.'}
                  </Text>
                </View>

                {/* 2. Sleek Actions Dashboard */}
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8', textTransform: 'uppercase', marginLeft: 4, marginBottom: 4, letterSpacing: 0.5 }}>
                    {locale === 'en' ? 'Dashboard Actions' : 'Tindakan Papan Pemuka'}
                  </Text>

                  {metaWabaId ? (
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}
                        onPress={() => Linking.openURL(`https://business.facebook.com/billing_hub/payment_methods?asset_id=${metaWabaId}`)}
                        activeOpacity={0.7}
                      >
                        <View style={{ backgroundColor: '#F0FDF4', padding: 8, borderRadius: 10, marginRight: 16 }}>
                          <Ionicons name="card" size={20} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#0F172A', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' }}>
                            {locale === 'en' ? 'Link Payment Card' : 'Pautkan Kad Pembayaran'}
                          </Text>
                          <Text style={{ color: '#64748B', fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 }}>
                            {locale === 'en' ? 'Add billing details to Meta' : 'Tambah maklumat bil ke Meta'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                      </TouchableOpacity>

                      {/* Send Test Message */}
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}
                        onPress={handleSendTestMessage}
                        disabled={isSendingTest}
                        activeOpacity={0.7}
                      >
                        <View style={{ backgroundColor: '#EFF6FF', padding: 8, borderRadius: 10, marginRight: 16 }}>
                          {isSendingTest ? (
                            <ActivityIndicator size="small" color="#3B82F6" />
                          ) : (
                            <Ionicons name="paper-plane" size={20} color="#3B82F6" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#0F172A', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' }}>
                            {locale === 'en' ? 'Send Test WhatsApp Message' : 'Hantar Mesej WhatsApp Ujian'}
                          </Text>
                          <Text style={{ color: '#64748B', fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 }}>
                            {locale === 'en' ? 'Send an instant test ping to your phone' : 'Hantar ujian segera ke telefon anda'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}
                        onPress={() => Linking.openURL(`https://business.facebook.com/wa/manage/message-templates/?waba_id=${metaWabaId}`)}
                        activeOpacity={0.7}
                      >
                        <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 10, marginRight: 16 }}>
                          <Ionicons name="document-text" size={20} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#0F172A', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' }}>
                            {locale === 'en' ? 'Message Templates' : 'Templat Mesej'}
                          </Text>
                          <Text style={{ color: '#64748B', fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 }}>
                            {locale === 'en' ? 'Edit or request new approved templates' : 'Edit atau mohon templat baharu'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
                        onPress={() => Linking.openURL(`https://business.facebook.com/wa/manage/home/?waba_id=${metaWabaId}`)}
                        activeOpacity={0.7}
                      >
                        <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 10, marginRight: 16 }}>
                          <Ionicons name="settings" size={20} color="#64748B" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#0F172A', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' }}>
                            {locale === 'en' ? 'Profile & Settings' : 'Profil & Tetapan'}
                          </Text>
                          <Text style={{ color: '#64748B', fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 }}>
                            {locale === 'en' ? 'Change photo, description on Meta' : 'Tukar foto, penerangan di Meta'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>

                {/* 3. Collapsible Diagnostics Accordion */}
                <View style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, overflow: 'hidden', width: '100%' }}>
                  <TouchableOpacity
                    onPress={() => setShowMetaDetails(!showMetaDetails)}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#F8FAFC',
                      padding: 12
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="construct-outline" size={16} color="#64748B" />
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                        {locale === 'en' ? 'Advanced Diagnostics Details' : 'Butiran Diagnostik Lanjutan'}
                      </Text>
                    </View>
                    <Ionicons name={showMetaDetails ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
                  </TouchableOpacity>

                  {showMetaDetails && (
                    <View style={{ padding: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8 }}>
                      <View style={{ gap: 2, alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8', textTransform: 'uppercase' }}>WhatsApp Business Account (WABA) ID</Text>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>{metaWabaId || '-'}</Text>
                      </View>
                      <View style={{ gap: 2, alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8', textTransform: 'uppercase' }}>Phone Number ID</Text>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>{metaPhoneId || '-'}</Text>
                      </View>
                      <View style={{ gap: 2, alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8', textTransform: 'uppercase' }}>Verified Phone Number</Text>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>{metaPhone || '-'}</Text>
                      </View>
                      <View style={{ gap: 2, alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8', textTransform: 'uppercase' }}>Status</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#047857' }}>Active & Synced</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <>
                {/* Step-by-Step Connection Guide */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3, width: '100%' }}>
                  <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 20 }}>
                    {locale === 'en' ? 'Setup Instructions' : 'Arahan Persediaan'}
                  </Text>

                  {/* Vertical Timeline */}
                  <View style={{ gap: 20 }}>
                    {/* Step 1 */}
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ alignItems: 'center', marginRight: 16 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#3B82F6' }}>1</Text>
                        </View>
                        <View style={{ width: 2, height: '100%', backgroundColor: '#E2E8F0', position: 'absolute', top: 28, bottom: -20 }} />
                      </View>
                      <View style={{ flex: 1, paddingBottom: 8 }}>
                        <Text style={{ fontSize: 14, color: '#1E293B', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 }}>
                          {locale === 'en' ? 'Prepare a Dedicated Number' : 'Sediakan Nombor Khas'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18 }}>
                          {locale === 'en' ? (
                            <>
                              The number must <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#EF4444' }}>NOT</Text> be active on any WhatsApp app. If it is, go to Settings → Account → <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Delete My Account</Text>.
                            </>
                          ) : (
                            <>
                              Nombor mestilah <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#EF4444' }}>TIDAK</Text> aktif di WhatsApp. Jika ya, pergi ke Tetapan → Akaun → <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Padam Akaun</Text>.
                            </>
                          )}
                        </Text>
                      </View>
                    </View>

                    {/* Step 2 */}
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ alignItems: 'center', marginRight: 16 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#3B82F6' }}>2</Text>
                        </View>
                        <View style={{ width: 2, height: '100%', backgroundColor: '#E2E8F0', position: 'absolute', top: 28, bottom: -20 }} />
                      </View>
                      <View style={{ flex: 1, paddingBottom: 8 }}>
                        <Text style={{ fontSize: 14, color: '#1E293B', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 }}>
                          {locale === 'en' ? 'Meta Signup Flow' : 'Aliran Pendaftaran Meta'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18 }}>
                          {locale === 'en' ? (
                            'Click the blue button below, log in with Facebook, select your Business Portfolio, and verify your number.'
                          ) : (
                            'Klik butang biru di bawah, log masuk dengan Facebook, pilih Portfolio Perniagaan, dan sahkan nombor.'
                          )}
                        </Text>
                      </View>
                    </View>

                    {/* Step 3 */}
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ alignItems: 'center', marginRight: 16 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#3B82F6' }}>3</Text>
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: '#1E293B', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 }}>
                          {locale === 'en' ? 'Automatic Sync' : 'Penyegerakan Automatik'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18 }}>
                          {locale === 'en' ? (
                            'Once completed, your Risev app will automatically sync and activate.'
                          ) : (
                            'Selepas selesai, aplikasi Risev anda akan disegerakkan dan aktif.'
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Quick Connect Button */}
                <TouchableOpacity 
                  onPress={handleQuickConnectMeta}
                  disabled={isConnectingMeta}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    backgroundColor: isConnectingMeta ? '#93C5FD' : '#1877F2',
                    paddingVertical: 14,
                    borderRadius: 12,
                    marginBottom: 20,
                    width: '100%',
                    shadowColor: '#1877F2',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 4
                  }}
                  activeOpacity={0.8}
                >
                  {isConnectingMeta ? (
                    <>
                      <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' }}>
                        {connectingStepText || (locale === 'en' ? 'Connecting to Meta...' : 'Menyambung ke Meta...')}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#FFFFFF', fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold' }}>
                        {locale === 'en' ? 'Quick Connect via Meta' : 'Sambungan Pantas via Meta'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Actions (Disconnect) */}
            <View style={{ marginTop: 24, width: '100%', alignItems: 'center' }}>
              {metaConfigId && (
                <TouchableOpacity
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isDisconnectingMeta ? 0.7 : 1
                  }}
                  onPress={handleDisconnectMeta}
                  disabled={isDisconnectingMeta}
                  activeOpacity={0.7}
                >
                  {isDisconnectingMeta ? (
                    <ActivityIndicator color="#EF4444" />
                  ) : (
                    <Text style={{ color: '#EF4444', fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', textDecorationLine: 'underline' }}>
                      {locale === 'en' ? 'Disconnect WABA Account' : 'Putuskan Sambungan Akaun WABA'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Premium Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.editModalCard, { maxHeight: '90%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { textAlign: 'left', marginBottom: 0 }]}>{t('change_password')}</Text>
              <TouchableOpacity onPress={() => {
                setPasswordModalVisible(false);
                setNewPassword('');
                setConfirmPassword('');
              }} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={{ width: '100%' }} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ width: '100%', alignItems: 'stretch', paddingBottom: 16 }}
            >
              {/* New Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('new_password')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t('enter_new_password')}
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  {...Platform.select({
                    web: { outlineStyle: 'none' } as any,
                  })}
                />
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('confirm_password')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('enter_confirm_password')}
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  {...Platform.select({
                    web: { outlineStyle: 'none' } as any,
                  })}
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={isUpdatingPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtnBlack}
                onPress={handleSavePassword}
                disabled={isUpdatingPassword}
                activeOpacity={0.8}
              >
                {isUpdatingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('save')}</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 64,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9', // Minimalist gray
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  notifyBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 20,
  },
  introSection: {
    gap: 6,
  },
  screenTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0b1c30',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#565e74',
    lineHeight: 22,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 20,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    marginTop: -10,
    zIndex: 2,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shopImage: {
    width: 60,
    height: 60,
    borderRadius: 16,
  },
  shopMainInfo: {
    flex: 1,
    gap: 4,
  },
  shopName: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#047857',
    letterSpacing: 0.5,
  },
  trialBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trialBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  expiredBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  expiredBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  updateBtn: {
    backgroundColor: '#050505',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  updateBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  detailsList: {
    gap: 12,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 1.0,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    lineHeight: 20,
  },
  hoursCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hoursTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  hoursList: {
    gap: 10,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hoursDay: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  hoursTime: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  sectionHeader: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
    marginTop: 8,
  },
  settingsGrid: {
    gap: 16,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  bentoSquareCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    justifyContent: 'flex-start',
  },
  settingIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
    marginLeft: 16,
    gap: 2,
  },
  settingTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  settingSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#737686',
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    marginTop: 8,
  },
  logoutIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutInfo: {
    flex: 1,
    marginLeft: 16,
    gap: 2,
  },
  logoutTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EF4444',
  },
  logoutSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#EF4444',
    opacity: 0.8,
  },
  switchCard: {
    backgroundColor: '#FFC700',
    borderRadius: 24,
    padding: 24,
    borderWidth: 0,
    gap: 20,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 3,
    marginTop: 8,
  },
  switchHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  switchInfo: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  switchSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    opacity: 0.8,
    lineHeight: 18,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
    height: 52,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  switchButtonText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
    maxWidth: 340,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
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
  // Edit Store Profile styles
  editModalCard: {
    maxWidth: 350,
  },
  avatarPickerContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    marginVertical: 4,
  },
  avatarPickerImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  avatarPencilIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarPickerLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  categoryChipActive: {
    borderColor: '#050505',
    backgroundColor: '#F1F5F9',
  },
  categoryChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  categoryChipTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  inputContainer: {
    width: '100%',
    gap: 6,
    marginVertical: 4,
  },
  hoursInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    alignSelf: 'flex-start',
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 1,
    alignSelf: 'flex-start',
  },
  textInput: {
    height: 46,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    backgroundColor: '#F8FAFC',
    width: '100%',
  },
  modalConfirmBtnBlack: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hoursEditRow: {
    width: '100%',
    marginVertical: 6,
    gap: 6,
  },
  hoursDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  hoursDayLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  closedToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  closedToggleText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  disabledInput: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  disabledInputText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  languageOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    width: '100%',
  },
  languageOptionRowActive: {
    borderColor: '#050505',
    backgroundColor: '#F8FAFC',
  },
  languageOptionText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0b1c30',
  },
  languageOptionTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
});
