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
import { useRouter, useFocusEffect } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import FlippableLoyaltyCard from '../(customer)/_components/FlippableLoyaltyCard';
import UpgradeModal from './_components/UpgradeModal';
import BookingAccessModal from './_components/BookingAccessModal';
import {
  isPushSupported,
  getPushPermissionStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendTestPushNotification,
} from '@/lib/push-notifications';
import { playClaimChime } from '@/lib/audioChime';


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
  isPro?: boolean;
  isLocked?: boolean;
};

type GroupedSettingRowProps = {
  iconName: any;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  iconBgColor?: string;
  iconColor?: string;
  badgeText?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  isPro?: boolean;
  isLocked?: boolean;
  rightElement?: React.ReactNode;
  showDivider?: boolean;
};

const GroupedSettingRow = ({
  iconName,
  title,
  subtitle,
  onPress,
  iconBgColor = '#F8FAFC',
  iconColor = '#050505',
  badgeText,
  badgeColor = '#000000',
  badgeTextColor = '#FFFFFF',
  isPro,
  isLocked,
  rightElement,
  showDivider = true,
}: GroupedSettingRowProps) => (
  <View>
    <TouchableOpacity 
      style={[styles.groupedRow, isLocked && { opacity: 0.75 }]} 
      onPress={onPress} 
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={[styles.groupedIconBg, { backgroundColor: isLocked ? '#F1F5F9' : iconBgColor }]}>
        <Ionicons name={iconName} size={18} color={isLocked ? '#94A3B8' : iconColor} />
      </View>
      <View style={styles.groupedInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={[styles.groupedTitle, isLocked && { color: '#64748B' }]} numberOfLines={1}>{title}</Text>
          {isLocked ? (
            <View style={styles.lockedPill}>
              <Ionicons name="lock-closed" size={8.5} color="#64748B" />
              <Text style={styles.lockedPillText}>LOCKED</Text>
            </View>
          ) : isPro ? (
            <View style={styles.proPill}>
              <Ionicons name="star" size={8.5} color="#000000" />
              <Text style={styles.proPillText}>PRO</Text>
            </View>
          ) : badgeText ? (
            <View style={[styles.customBadgePill, { backgroundColor: badgeColor }]}>
              <Text style={[styles.customBadgeText, { color: badgeTextColor }]}>{badgeText}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={[styles.groupedSubtitle, isLocked && { color: '#94A3B8' }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      {rightElement ? (
        rightElement
      ) : isLocked ? (
        <Ionicons name="lock-closed" size={15} color="#94A3B8" />
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
      )}
    </TouchableOpacity>
    {showDivider && <View style={styles.groupedDivider} />}
  </View>
);

export default function ProfileScreen() {
  const { logout, user, isOwner, isStaff, staffPermissions, switchRole, updateProfile } = useAuth();
  const router = useRouter();
  const { locale, setLocale, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [merchant, setMerchant] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [customerSlotLimit, setCustomerSlotLimit] = useState<number>(500);
  const [loading, setLoading] = useState(true);
  const [customersCount, setCustomersCount] = useState<number>(0);
  const [standsCount, setStandsCount] = useState<number>(1);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [permissionDeniedModalVisible, setPermissionDeniedModalVisible] = useState(false);
  const [deniedFeatureTitle, setDeniedFeatureTitle] = useState('');
  const [showBookingAccessModal, setShowBookingAccessModal] = useState(false);

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

  const handleLockedItemPress = (featureName: string) => {
    setDeniedFeatureTitle(featureName);
    setPermissionDeniedModalVisible(true);
  };

  const handleProFeaturePress = (route: string) => {
    if (user?.merchant_status !== 'active') {
      router.push('/(merchant)/subscription' as any);
    } else {
      router.push(route as any);
    }
  };
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

  // Web Push Notification States
  const [isPushSupportedState, setIsPushSupportedState] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  useEffect(() => {
    if (isPushSupported()) {
      setIsPushSupportedState(true);
      setIsPushEnabled(getPushPermissionStatus() === 'granted');
    }
  }, []);

  const handleTogglePush = async (newValue: boolean) => {
    if (!isPushSupportedState) {
      Alert.alert(
        locale === 'en' ? 'Not Supported' : 'Tidak Disokong',
        locale === 'en' ? 'Web Push is not supported on this browser or platform.' : 'Notifikasi Web Push tidak disokong pada pelayar ini.'
      );
      return;
    }

    setIsPushLoading(true);
    try {
      if (newValue) {
        playClaimChime();
        const res = await subscribeToPushNotifications({
          merchantId: user?.merchant_id,
          branchId: user?.branch,
        });
        if (res.success) {
          setIsPushEnabled(true);
        } else {
          setIsPushEnabled(getPushPermissionStatus() === 'granted');
          Alert.alert(
            locale === 'en' ? 'Permission Required' : 'Kebenaran Diperlukan',
            res.message || (locale === 'en' ? 'Please allow notification permissions in your browser.' : 'Sila benarkan notifikasi dalam tetapan pelayar anda.')
          );
        }
      } else {
        await unsubscribeFromPushNotifications();
        setIsPushEnabled(false);
      }
    } catch (err) {
      console.error('Error toggling push notifications:', err);
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    playClaimChime();
    await sendTestPushNotification();
  };

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

    const initFB = () => {
      if ((window as any).FB) {
        try {
          (window as any).FB.init({
            appId: fbAppId,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v20.0'
          });
        } catch (e) {
          console.warn('FB.init warning:', e);
        }
      }
    };

    (window as any).fbAsyncInit = function () {
      initFB();
    };

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        initFB();
      };
      document.body.appendChild(script);
    } else {
      initFB();
    }

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
    router.push('/(merchant)/whatsapp-integration' as any);
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
    const fbConfigId = (process.env.EXPO_PUBLIC_META_CONFIG_ID || '1067718449538944').trim();

    // Check if FB SDK is loaded and valid Configuration ID is provided
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).FB && fbConfigId) {
      setIsConnectingMeta(true);
      setConnectingStepText('Connecting via Meta popup...');
      try {
        (window as any).FB.login(
          function (response: any) {
            console.log('[META FB.LOGIN RESPONSE]', response);
            if (response?.authResponse?.code) {
              setConnectingStepText('Configuring WhatsApp Business Account & Webhooks...');
              pb.send('/api/risev/merchant/whatsapp/meta-connect', {
                method: 'POST',
                body: {
                  code: response.authResponse.code,
                  wabaId: metaWabaId,
                  phoneNumberId: metaPhoneId
                }
              })
                .then(async (res: any) => {
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
                })
                .catch((err: any) => {
                  Alert.alert('Connection Error', err.message || 'Failed to complete Meta setup.');
                })
                .finally(() => {
                  setIsConnectingMeta(false);
                  setConnectingStepText('');
                });
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
      } catch (fbErr) {
        console.warn('FB.login error, using fallback:', fbErr);
        setIsConnectingMeta(false);
        setConnectingStepText('');
      }
    }

    // Fallback standard OAuth redirection if SDK not ready or on native
    const pbBaseUrl = (pb.baseUrl || '').replace(/\/$/, '');
    const redirectUriRaw = pbBaseUrl + '/api/risev/merchant/whatsapp/callback';

    const stateObj = {
      merchantId: user.merchant_id,
      redirectHost: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://risev.app',
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

  const getSubscriptionBadgeInfo = () => {
    if (!subscription || merchant?.status !== 'active') {
      if (isInTrial) {
        return {
          title: 'TRIAL',
          bg: '#F8FAFC',
          color: '#050505',
          borderColor: '#E2E8F0',
          subtitle: `${trialDaysRemaining}d left`,
        };
      }
      return {
        title: 'SUSPENDED',
        bg: '#FEF2F2',
        color: '#DC2626',
        borderColor: '#FECACA',
        subtitle: locale === 'en' ? 'Action Required' : 'Tindakan Diperlukan',
      };
    }

    const plan = (subscription.plan || 'pro').toLowerCase();

    if (plan === 'stand_bundle') {
      return {
        title: 'NFC BUNDLE',
        bg: '#000000',
        color: '#FFCC00',
        borderColor: 'rgba(255, 204, 0, 0.4)',
        subtitle: locale === 'en' ? `Lifetime • ${customerSlotLimit.toLocaleString()} Cap` : `Seumur Hidup • ${customerSlotLimit.toLocaleString()} Had`,
      };
    }

    if (plan === 'starter') {
      return {
        title: 'STARTER',
        bg: '#F8FAFC',
        color: '#050505',
        borderColor: '#E2E8F0',
        subtitle: getExpiryLabel(),
      };
    }

    if (plan === 'business' || plan === 'enterprise') {
      return {
        title: 'BUSINESS',
        bg: '#000000',
        color: '#FFCC00',
        borderColor: 'rgba(255, 204, 0, 0.4)',
        subtitle: getExpiryLabel(),
      };
    }

    // Default to PRO: Pure Apple-grade Black with Risev Yellow Accent
    return {
      title: 'PRO',
      bg: '#000000',
      color: '#FFCC00',
      borderColor: 'rgba(255, 204, 0, 0.4)',
      subtitle: getExpiryLabel(),
    };
  };

  const fetchMerchant = React.useCallback(async () => {
    if (!user || !user.merchant_id) return;
    try {
      const mRec = await pb.collection('merchants').getOne(user.merchant_id);
      console.log('[DEBUG] Fetched merchant:', mRec);
      console.log('[DEBUG] user.id:', user.id);
      console.log('[DEBUG] merchant.owner:', mRec.owner);
      setMerchant(mRec);

      // Fetch subscription record (prioritize active record, then latest)
      try {
        const subList = await pb.collection('subscriptions').getList(1, 1, {
          filter: `merchant = "${user.merchant_id}" && status = "active"`,
          sort: '-created',
        });
        if (subList.items.length > 0) {
          setSubscription(subList.items[0]);
        } else {
          const fallbackList = await pb.collection('subscriptions').getList(1, 1, {
            filter: `merchant = "${user.merchant_id}"`,
            sort: '-created',
          });
          if (fallbackList.items.length > 0) {
            setSubscription(fallbackList.items[0]);
          }
        }
      } catch (e: any) {
        console.log("No active subscription row found for profile view:", e.message);
      }

      // Customer-slot capacity (redeemed stands + purchased top-ups)
      try {
        const quotaRes = await pb.send<any>('/api/risev/merchant/quota/packages', { method: 'GET' });
        if (quotaRes?.current && typeof quotaRes.current.limit === 'number') {
          setCustomerSlotLimit(quotaRes.current.limit);
        }
      } catch (quotaErr) {}

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

      try {
        const cardsRes = await pb.collection('loyalty_cards').getList(1, 1, {
          filter: `merchant = "${user.merchant_id}"`,
        });
        setCustomersCount(cardsRes.totalItems || 0);
      } catch (e) {}

      try {
        const standsRes = await pb.collection('activation_codes').getList(1, 1, {
          filter: `redeemed_by = "${user.merchant_id}"`,
          requestKey: null,
        });
        setStandsCount(Math.max(1, standsRes.totalItems));
      } catch (e) {
        setStandsCount(1);
      }
    } catch (err) {
      console.warn('Failed to fetch merchant profile:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.merchant_id]);

  useEffect(() => {
    fetchMerchant();
  }, [fetchMerchant]);

  useFocusEffect(
    React.useCallback(() => {
      fetchMerchant();
    }, [fetchMerchant])
  );

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

  const handleCopyText = async (text: string, label: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert(
      locale === 'en' ? 'Copied to Clipboard' : 'Disalin ke Papan Keratan',
      `${label}: ${text}`
    );
  };

  const handleCallPhone = (phone: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      handleCopyText(phone, locale === 'en' ? 'Phone Number' : 'Nombor Telefon');
    });
  };

  const handleOpenMaps = (address: string) => {
    if (!address) return;
    const query = encodeURIComponent(address);
    const mapsUrl = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(mapsUrl).catch(() => {
      handleCopyText(address, locale === 'en' ? 'Address' : 'Alamat');
    });
  };

  const handleSwitchToCustomer = async () => {
    await switchRole('customer');
    router.replace('/(customer)');
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const handlePrivacyPress = () => {
    Alert.alert(
      locale === 'en' ? 'Legal Agreements' : 'Perjanjian Undang-undang',
      locale === 'en' ? 'Please select a document to view:' : 'Sila pilih dokumen untuk dipaparkan:',
      [
        {
          text: locale === 'en' ? 'Privacy Policy' : 'Dasar Privasi',
          onPress: () => router.push('/privacy' as any)
        },
        {
          text: locale === 'en' ? 'Terms & Conditions' : 'Terma & Syarat',
          onPress: () => router.push('/terms' as any)
        },
        {
          text: locale === 'en' ? 'Cancel' : 'Batal',
          style: 'cancel'
        }
      ]
    );
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    await logout();
    router.replace('/(auth)/login');
  };

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top', 'bottom']}>
      {/* ── Apple iOS Pure White Header ── */}
      <View style={styles.headerContainer}>
        <View style={[styles.headerTopRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          <View style={styles.headerBrandRow}>
            <Image
              source={require('../../assets/risev logo.png')}
              style={styles.headerLogo}
            />
            <View style={styles.headerLogoDivider} />
            <Text style={styles.headerTitle}>{locale === 'en' ? 'Store Settings' : 'Tetapan Kedai'}</Text>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.roundHeaderBtn}
              onPress={handleOpenEdit}
              activeOpacity={0.8}
              accessibilityLabel="Edit Profile"
            >
              <Ionicons name="create-outline" size={18} color="#000000" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.roundHeaderBtn}
              onPress={() => {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.open('https://wa.me/60104648598?text=Hi%20Risev%20Support,%20I%20need%20some%20help%20with%20my%20merchant%20account.', '_blank');
                } else {
                  Linking.openURL('https://wa.me/60104648598?text=Hi%20Risev%20Support,%20I%20need%20some%20help%20with%20my%20merchant%20account.');
                }
              }}
              activeOpacity={0.8}
              accessibilityLabel="Help & Support"
            >
              <Ionicons name="help-buoy-outline" size={18} color="#000000" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 16, paddingBottom: 160 },
          isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Executive Store Identity Card (Reference Style 1:1) ── */}
        {/* ── Executive Store Identity Card (Reference Style 1:1 Image No 2) ── */}
        <View style={styles.storeCard}>
          {/* Top Profile Header Row (Tappable with Chevron) */}
          {(() => {
            const isProPlan = subscription?.plan 
              ? (subscription.plan.toLowerCase().includes('pro') || subscription.plan.toLowerCase().includes('stand')) 
              : (merchant?.status === 'active' || !subscription);
            
            // Clean location string (e.g. "Kampung Padang, Jitra")
            const cleanAddress = (() => {
              if (merchant?.city && merchant?.state) return `${merchant.city}, ${merchant.state}`;
              if (merchant?.description) {
                const parts = merchant.description.split(',').map((p: string) => p.trim());
                if (parts.length >= 2) {
                  const p1 = parts[0].replace(/^no\s*\d+[,.]?\s*/i, '').trim();
                  const p2 = parts[1].replace(/^\d{5}\s*/i, '').trim();
                  return `${p1}, ${p2}`;
                }
                return merchant.description.replace(/^no\s*\d+[,.]?\s*/i, '').trim();
              }
              return 'Kampung Padang, Jitra';
            })();

            return (
              <TouchableOpacity
                style={styles.storeProfileRow}
                onPress={handleOpenEdit}
                activeOpacity={0.75}
              >
                <View style={styles.avatarWrapper}>
                  <Image source={{ uri: logoUrl }} style={styles.storeAvatar} />
                </View>

                <View style={styles.storeInfoCol}>
                  <Text style={styles.storeNameText} numberOfLines={1}>
                    {merchant?.name || user?.name || 'Scoop creamy'}
                  </Text>

                  <View style={styles.storeAddressRow}>
                    <Ionicons name="location-sharp" size={13} color="#64748B" />
                    <Text style={styles.storeAddressText} numberOfLines={1}>
                      {cleanAddress}
                    </Text>
                  </View>

                  <View style={styles.storeTierRow}>
                    {isProPlan ? (
                      <View style={styles.storeVipBadge}>
                        <MaterialCommunityIcons name="crown-outline" size={13} color="#FFCC00" />
                        <Text style={styles.storeVipBadgeText}>
                          PRO
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.storeFreeBadge}>
                        <Text style={styles.storeFreeBadgeText}>
                          FREE
                        </Text>
                      </View>
                    )}

                    <View style={styles.storeTierDivider} />

                    <View style={styles.storeStatusGroup}>
                      <View style={[styles.vipStatusDot, { backgroundColor: (merchant?.status === 'active' || !subscription) ? '#16A34A' : '#94A3B8' }]} />
                      <Text style={styles.vipStatusText}>
                        {(merchant?.status === 'active' || !subscription) ? 'Active' : 'Inactive'}
                      </Text>
                    </View>

                    {!isProPlan && (
                      <TouchableOpacity
                        style={styles.upgradeInlinePill}
                        onPress={() => router.push('/(merchant)/subscription' as any)}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="crown-outline" size={12} color="#B45309" />
                        <Text style={styles.upgradeInlinePillText}>Upgrade PRO</Text>
                        <Ionicons name="chevron-forward" size={11} color="#B45309" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#000000" style={{ alignSelf: 'center', marginLeft: 4 }} />
              </TouchableOpacity>
            );
          })()}

          {/* Hairline Divider */}
          <View style={styles.storeCardDivider} />

          {/* 3-Column Modern Squircle Metric Tiles (Image No 2 Exact 1:1) */}
          <View style={styles.statsSnapshotRow}>
            {/* Tile 1: NFC Stand */}
            <TouchableOpacity 
              style={styles.statTile}
              onPress={() => router.push('/(merchant)/nfc-marketplace' as any)}
              activeOpacity={0.75}
            >
              <View style={styles.statTileTopRow}>
                <View style={styles.statTileIconYellow}>
                  <Ionicons name="radio" size={15} color="#000000" />
                </View>
                <Text style={styles.statTileNumber}>{standsCount > 0 ? standsCount : 1}</Text>
                <Ionicons name="chevron-forward" size={14} color="#000000" />
              </View>
              <Text style={styles.statTileLabel} numberOfLines={1}>{locale === 'en' ? 'NFC Stand' : 'Stand NFC'}</Text>
            </TouchableOpacity>

            {/* Vertical Hairline Divider */}
            <View style={styles.statVerticalDivider} />

            {/* Tile 2: Customers */}
            <TouchableOpacity 
              style={styles.statTile}
              onPress={() => router.push('/(merchant)/customers' as any)}
              activeOpacity={0.75}
            >
              <View style={styles.statTileTopRow}>
                <View style={styles.statTileIconGrey}>
                  <Ionicons name="people" size={15} color="#000000" />
                </View>
                <Text style={styles.statTileNumber}>{customersCount || 34}</Text>
                <Ionicons name="chevron-forward" size={14} color="#000000" />
              </View>
              <Text style={styles.statTileLabel} numberOfLines={1}>{locale === 'en' ? 'Customers' : 'Pelanggan'}</Text>
            </TouchableOpacity>

            {/* Vertical Hairline Divider */}
            <View style={styles.statVerticalDivider} />

            {/* Tile 3: Tap Alerts */}
            <TouchableOpacity 
              style={styles.statTile}
              onPress={() => handleTogglePush(!isPushEnabled)}
              activeOpacity={0.75}
            >
              <View style={styles.statTileTopRow}>
                <View style={styles.statTileIconMint}>
                  <Ionicons name="notifications" size={15} color="#16A34A" />
                  {isPushEnabled && <View style={styles.bellDot} />}
                </View>
                <Text style={[styles.statTileNumber, { color: isPushEnabled ? '#16A34A' : '#64748B' }]}>
                  {isPushEnabled ? (locale === 'en' ? 'On' : 'Hidup') : (locale === 'en' ? 'Off' : 'Tutup')}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#000000" />
              </View>
              <Text style={styles.statTileLabel} numberOfLines={1}>{locale === 'en' ? 'Tap Alerts' : 'Amaran Tap'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Ultra-Slim Horizontal Risev Yellow Switch Bar ── */}
        <TouchableOpacity
          style={styles.merchantSlimCard}
          onPress={handleSwitchToCustomer}
          activeOpacity={0.88}
        >
          <View style={styles.merchantSlimLeft}>
            <View style={styles.merchantIconSquircle}>
              <Ionicons name="person" size={15} color="#FFCC00" />
            </View>
            <View style={styles.merchantSlimTextCol}>
              <Text style={styles.merchantSlimTitle}>
                {locale === 'en' ? 'Personal Account?' : 'Akaun Peribadi?'}
              </Text>
              <Text style={styles.merchantSlimSubtitle} numberOfLines={1}>
                {locale === 'en' 
                  ? 'Switch to view loyalty cards & rewards' 
                  : 'Tukar ke konsol pelanggan & ganjaran'}
              </Text>
            </View>
          </View>
          <View style={styles.merchantSlimBtn}>
            <Text style={styles.merchantSlimBtnText}>
              {locale === 'en' ? 'Switch' : 'Tukar'}
            </Text>
            <Ionicons name="arrow-forward" size={12} color="#FFCC00" />
          </View>
        </TouchableOpacity>

        {/* ── Section 1: Store & Operations ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>{locale === 'en' ? 'STORE & OPERATIONS' : 'TETAPAN KEDAI & OPERASI'}</Text>
          <View style={styles.groupedCard}>
            <GroupedSettingRow
              iconName="business-outline"
              title={locale === 'en' ? 'Manage Branches' : 'Pengurusan Cawangan'}
              subtitle={locale === 'en' ? 'Expand to new outlets & assign managers' : 'Buka cawangan baharu & tetapkan pengurus'}
              isPro={isOwner}
              isLocked={!isOwner && !staffPermissions?.can_manage_branches}
              onPress={(!isOwner && !staffPermissions?.can_manage_branches)
                ? () => handleLockedItemPress(locale === 'en' ? 'Manage Branches' : 'Pengurusan Cawangan')
                : () => handleProFeaturePress('/(merchant)/branches')}
            />

            <GroupedSettingRow
              iconName="people-outline"
              title={t('manage_staff')}
              subtitle={locale === 'en' ? 'Cashier PINs, roles & daily permissions' : 'Akses PIN juruwang, peranan & had staf'}
              isLocked={!isOwner}
              onPress={!isOwner
                ? () => handleLockedItemPress(t('manage_staff'))
                : () => router.push('/(merchant)/staff' as any)}
            />

            <GroupedSettingRow
              iconName="calendar-outline"
              title="Smart Booking Management"
              subtitle={locale === 'en' ? 'Client appointments & service calendar' : 'Temu janji pelanggan & kalendar servis'}
              badgeText="ADD-ON ⚡"
              badgeColor="#FFCC00"
              badgeTextColor="#000000"
              onPress={() => {
                const plan = (subscription?.plan || '').toLowerCase();
                const hasBookingAccess = Boolean(
                  plan === 'pro' ||
                  plan === 'business' ||
                  plan === 'enterprise' ||
                  merchant?.has_booking_addon === true
                );
                if (hasBookingAccess) {
                  router.push('/(merchant)/bookings' as any);
                } else {
                  setShowBookingAccessModal(true);
                }
              }}
            />

            <GroupedSettingRow
              iconName="gift-outline"
              title={t('manage_rewards')}
              subtitle={locale === 'en' ? 'Stamp cards, point rules & voucher perks' : 'Kad setem digital, mata ganjaran & baucar'}
              isLocked={!isOwner && !staffPermissions?.can_manage_rewards}
              onPress={(!isOwner && !staffPermissions?.can_manage_rewards)
                ? () => handleLockedItemPress(t('manage_rewards'))
                : () => router.push('/(merchant)/rewards' as any)}
            />

            {/* NFC Claim Alerts Toggle Row */}
            <GroupedSettingRow
              iconName={isPushEnabled ? "notifications" : "notifications-off-outline"}
              iconColor={isPushEnabled ? "#050505" : "#64748B"}
              title={locale === 'en' ? 'NFC Claim Alerts' : 'Notifikasi Tuntutan NFC'}
              subtitle={isPushEnabled
                ? (locale === 'en' ? 'Instant chime & alert when stands are tapped' : 'Bunyi loceng & amaran bila stand diimbas')
                : (locale === 'en' ? 'Tap switch to enable counter alerts' : 'Tekan suis untuk aktifkan amaran stand')}
              badgeText={isPushEnabled ? "ACTIVE" : undefined}
              badgeColor="#15803D"
              showDivider={false}
              rightElement={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {isPushEnabled && (
                    <TouchableOpacity
                      onPress={handleTestPush}
                      style={styles.testBtnPill}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.testBtnText}>{locale === 'en' ? 'Test' : 'Uji'}</Text>
                    </TouchableOpacity>
                  )}
                  {isPushLoading ? (
                    <ActivityIndicator size="small" color="#FFCC00" />
                  ) : (
                    <Switch
                      value={isPushEnabled}
                      onValueChange={handleTogglePush}
                      trackColor={{ false: '#CBD5E1', true: '#FFCC00' }}
                      thumbColor={isPushEnabled ? '#050505' : '#FFFFFF'}
                    />
                  )}
                </View>
              }
            />
          </View>
        </View>

        {/* ── Section 2: Growth & Marketing ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>{locale === 'en' ? 'GROWTH & MARKETING' : 'PEMASARAN & PERTUMBUHAN'}</Text>
          <View style={styles.groupedCard}>
            <GroupedSettingRow
              iconName="cart-outline"
              title={locale === 'en' ? 'NFC Marketplace' : 'Pasaran NFC'}
              subtitle={locale === 'en' ? 'Order official acrylic counter stands & bundles' : 'Tempah stand akrilik rasmi & pakej perkakasan'}
              onPress={() => router.push('/(merchant)/nfc-marketplace' as any)}
            />

            <GroupedSettingRow
              iconName="star-outline"
              title="Google Reviews Integration"
              subtitle={locale === 'en' ? 'Turn walk-ins into 5-star Google ratings' : 'Tukar pelanggan walk-in kepada ulasan 5-bintang'}
              isLocked={!isOwner && !staffPermissions?.can_edit_store_profile}
              onPress={(!isOwner && !staffPermissions?.can_edit_store_profile)
                ? () => handleLockedItemPress('Google Reviews Integration')
                : () => router.push('/(merchant)/google-reviews' as any)}
            />

            <GroupedSettingRow
              iconName="color-palette-outline"
              title="Onboarding Setup"
              subtitle={locale === 'en' ? 'Brand logo, welcome message & store banner' : 'Logo kedai, ucapan aluan & sepanduk jenama'}
              isLocked={!isOwner && !staffPermissions?.can_edit_store_profile}
              onPress={(!isOwner && !staffPermissions?.can_edit_store_profile)
                ? () => handleLockedItemPress('Onboarding Setup')
                : () => router.push('/(merchant)/onboarding-setup' as any)}
            />

            <GroupedSettingRow
              iconName="school-outline"
              title={locale === 'en' ? 'Risev Academy & Video Guides' : 'Pusat Tutorial & Video Panduan'}
              subtitle={locale === 'en' ? 'Quick video playbooks to maximize repeat visits' : 'Video panduan pantas gandakan pelanggan setia'}
              badgeText="ACADEMY ✨"
              badgeColor="#050505"
              showDivider={false}
              onPress={() => {
                const isDev = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname === 'localhost';
                const url = isDev ? 'http://localhost:3000/docs/merchant/unboxing-stand' : 'https://docs.risev.app';
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.open(url, '_blank');
                } else {
                  Linking.openURL(url);
                }
              }}
            />
          </View>
        </View>

        {/* ── Section 3: Personal Account & Security ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>{locale === 'en' ? 'ACCOUNT & SECURITY' : 'AKAUN & KESELAMATAN'}</Text>
          
          {/* User Profile Mini Snippet */}
          <View style={styles.userSnippetCard}>
            <View style={styles.personalAvatarBg}>
              <Text style={styles.personalAvatarInitial}>{user?.name ? user.name[0].toUpperCase() : 'U'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.personalUserName}>{user?.name || 'User'}</Text>
                <View style={styles.personalRoleBadge}>
                  <Ionicons name={isOwner ? "briefcase" : "person"} size={10} color={isOwner ? "#050505" : "#64748B"} />
                  <Text style={[styles.personalRoleBadgeText, { color: isOwner ? "#050505" : "#64748B" }]}>
                    {isOwner ? (locale === 'en' ? 'Store Owner' : 'Pemilik Kedai') : (locale === 'en' ? 'Staff Member' : 'Staf Kedai')}
                  </Text>
                </View>
              </View>
              <Text style={styles.personalUserPhone}>{user?.phone || user?.email || ''}</Text>
            </View>
          </View>

          <View style={styles.groupedCard}>
            <GroupedSettingRow
              iconName="card-outline"
              title="My Subscription"
              subtitle="Manage plan limits & invoices"
              badgeText={isOwner ? getSubscriptionBadgeInfo().title : undefined}
              badgeColor="#000000"
              badgeTextColor="#FFCC00"
              isLocked={!isOwner}
              onPress={!isOwner
                ? () => handleLockedItemPress(locale === 'en' ? 'Subscription & Billing' : 'Langganan & Pengebilan')
                : () => router.push('/(merchant)/subscription' as any)}
            />

            <GroupedSettingRow
              iconName="key-outline"
              title={locale === 'en' ? 'My Login Password' : 'Kata Laluan Log Masuk'}
              subtitle={locale === 'en' ? 'Change your personal account password' : 'Tukar kata laluan peribadi anda'}
              onPress={() => setPasswordModalVisible(true)}
            />

            <GroupedSettingRow
              iconName="globe-outline"
              title={t('language')}
              subtitle={locale === 'en' ? 'English (US)' : 'Bahasa Melayu'}
              onPress={() => setLanguageModalVisible(true)}
            />

            <GroupedSettingRow
              iconName="document-text-outline"
              title={t('privacy_policy')}
              subtitle={t('privacy_policy_desc')}
              showDivider={false}
              onPress={handlePrivacyPress}
            />
          </View>
        </View>

        {/* ── Section 4: Log Out Soft Red Cell ── */}
        <TouchableOpacity
          style={styles.logoutCard}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <View style={styles.logoutIconBg}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </View>
          <View style={styles.logoutInfo}>
            <Text style={styles.logoutTitle}>{t('logout')}</Text>
            <Text style={styles.logoutSubtitle}>{t('logout_desc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FCA5A5" />
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

      {/* Meta WhatsApp Configuration is now its own page */}

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
              {/* User Identity Info Badge */}
              <View style={styles.passwordUserBadge}>
                <Ionicons name="person-circle" size={32} color="#050505" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.passwordUserBadgeName}>{user?.name || 'My Account'}</Text>
                  <Text style={styles.passwordUserBadgePhone}>{user?.phone || ''}</Text>
                </View>
                <View style={styles.personalScopeBadge}>
                  <Text style={styles.personalScopeBadgeText}>PERSONAL</Text>
                </View>
              </View>

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
      {/* Locked Feature Alert Modal */}
      <Modal
        visible={permissionDeniedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPermissionDeniedModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 380, padding: 24, alignItems: 'center' }]}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="lock-closed" size={28} color="#D97706" />
            </View>
            <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 6, textAlign: 'center' }}>
              {deniedFeatureTitle}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
              {locale === 'en'
                ? 'This feature is currently locked for staff accounts. Contact your store owner to unlock this permission in Manage Staff.'
                : 'Ciri ini dikunci untuk akaun staf. Hubungi pemilik kedai anda untuk membuka kebenaran ini dalam Pengurusan Staf.'}
            </Text>
            <TouchableOpacity
              style={{ width: '100%', height: 48, borderRadius: 12, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setPermissionDeniedModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 }}>
                {locale === 'en' ? 'Understood' : 'Faham'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Booking & PWA Suite Feature Access Gate Modal */}
      <BookingAccessModal
        visible={showBookingAccessModal}
        onClose={() => setShowBookingAccessModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 82,
    height: 26,
    resizeMode: 'contain',
  },
  headerLogoDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 160,
    gap: 16,
  },
  // ── Executive Store Identity Card (Reference Style 1:1 Image No 2) ──
  storeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  storeProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  storeAvatar: {
    width: 66,
    height: 66,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFCC00',
  },
  storeInfoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  storeNameText: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.4,
  },
  storeAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
    marginBottom: 5,
  },
  storeAddressText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  storeTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeVipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#050505',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 99,
  },
  storeVipBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
    letterSpacing: 0.5,
  },
  storeFreeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 99,
  },
  storeFreeBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  storeTierDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#E2E8F0',
  },
  storeStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  vipStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  vipStatusText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  upgradeInlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginLeft: 4,
  },
  upgradeInlinePillText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  storeCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  // ── 3-Column Modern Squircle Metric Tiles (Image No 2) ──
  statsSnapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statTile: {
    flex: 1,
    paddingHorizontal: 6,
  },
  statTileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statTileIconYellow: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTileIconGrey: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTileIconMint: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  statTileNumber: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.3,
    marginLeft: 6,
    flex: 1,
  },
  statTileLabel: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 6,
  },
  statVerticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#F1F5F9',
  },
  // ── Ultra-Slim Horizontal Risev Yellow Switch Bar ──
  merchantSlimCard: {
    backgroundColor: '#FFCC00',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#F2BD00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#FFCC00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  merchantSlimLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  merchantIconSquircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  merchantSlimTextCol: {
    flex: 1,
    gap: 1,
  },
  merchantSlimTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.2,
  },
  merchantSlimSubtitle: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(0, 0, 0, 0.72)',
  },
  merchantSlimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    height: 32,
    paddingHorizontal: 13,
    borderRadius: 99,
    gap: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  merchantSlimBtnText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  // ── Apple Inset Grouped Settings Sections ──
  sectionBlock: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 1.0,
    marginLeft: 6,
  },
  groupedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  groupedIconBg: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  groupedInfo: {
    flex: 1,
    gap: 2,
  },
  groupedTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  groupedSubtitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  groupedDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 64,
  },
  lockedPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockedPillText: {
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
  },
  proPill: {
    backgroundColor: '#FFCC00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  proPillText: {
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  customBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customBadgeText: {
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  testBtnPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  testBtnText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  // ── Personal Account User Snippet ──
  userSnippetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    marginBottom: 4,
  },
  personalAvatarBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalAvatarInitial: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  personalUserName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  personalRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  personalRoleBadgeText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  personalUserPhone: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  // ── Soft Red Apple Destructive Logout Card ──
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    marginTop: 4,
  },
  logoutIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutInfo: {
    flex: 1,
    marginLeft: 14,
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
  personalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  personalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 12,
  },
  personalActionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalActionTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  personalActionSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  passwordUserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    width: '100%',
  },
  passwordUserBadgeName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  passwordUserBadgePhone: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  personalScopeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  personalScopeBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
});
