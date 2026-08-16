import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { pb } from '../../lib/pocketbase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function WhatsappIntegration() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale } = useLanguage();

  const [metaWabaId, setMetaWabaId] = useState('');
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaPhone, setMetaPhone] = useState('');
  const [metaConfigId, setMetaConfigId] = useState<string | null>(null);
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);
  const [isDisconnectingMeta, setIsDisconnectingMeta] = useState(false);
  const [showMetaDetails, setShowMetaDetails] = useState(false);
  const [connectingStepText, setConnectingStepText] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchMetaConfig();
  }, [user]);

  // Listen for Meta Embedded Signup response events
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

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

  const fetchMetaConfig = async () => {
    if (!user?.merchant_id) return;
    try {
      const records = await pb.collection('whatsapp_configurations').getFullList({
        filter: `merchant = "${user.merchant_id}"`
      });
      if (records.length > 0) {
        const config = records[0];
        setMetaConfigId(config.id);
        setMetaWabaId(config.waba_id || '');
        setMetaPhoneId(config.phone_number_id || '');
        setMetaToken(config.access_token || '');
        setMetaPhone(config.phone_number || '');
      } else {
        setMetaConfigId(null);
        setMetaWabaId('');
        setMetaPhoneId('');
        setMetaToken('');
        setMetaPhone('');
      }
    } catch (err: any) {
      console.log('No Meta config found', err.message);
    }
  };

  const handleQuickConnectMeta = () => {
    if (!user || !user.merchant_id) return;
    
    const fbAppId = process.env.EXPO_PUBLIC_META_APP_ID || '1040853298682209'; 
    const fbConfigId = (process.env.EXPO_PUBLIC_META_CONFIG_ID || '1067718449538944').trim();

    // Check if FB SDK is loaded and valid Configuration ID is provided
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).FB && fbConfigId) {
      setIsConnectingMeta(true);
      setConnectingStepText(locale === 'en' ? 'Connecting via Meta popup...' : 'Menyambung via tetingkap Meta...');
      try {
        (window as any).FB.login(
          function (response: any) {
            console.log('[META FB.LOGIN RESPONSE]', response);
            if (response?.authResponse?.code) {
              setConnectingStepText(locale === 'en' ? 'Configuring WhatsApp Business Account...' : 'Mengkonfigurasi Akaun Perniagaan WhatsApp...');
              pb.send('/api/risev/merchant/whatsapp/meta-connect', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + pb.authStore.token },
                body: {
                  code: response.authResponse.code,
                  wabaId: metaWabaId,
                  phoneNumberId: metaPhoneId
                }
              })
                .then(async (res: any) => {
                  if (res && res.success) {
                    await fetchMetaConfig();
                    Alert.alert(
                      locale === 'en' ? 'WhatsApp Connected! 🎉' : 'WhatsApp Disambungkan! 🎉',
                      locale === 'en' 
                        ? `Your WhatsApp Business API (${res.phone_number || 'verified number'}) is active and ready to deliver updates!` 
                        : `API WhatsApp Business anda (${res.phone_number || 'nombor disahkan'}) kini aktif!`
                    );
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

  const handleDisconnectMeta = async () => {
    Alert.alert(
      locale === 'en' ? "Disconnect Meta WABA?" : "Putuskan Sambungan Meta WABA?",
      locale === 'en' ? "This will disable automated messages and blasts. You'll need to reconnect via Facebook later." : "Ini akan melumpuhkan mesej automatik. Anda perlu log masuk semula kemudian.",
      [
        { text: locale === 'en' ? "Cancel" : "Batal", style: 'cancel' },
        { 
          text: locale === 'en' ? "Disconnect" : "Putus Sambung", 
          style: 'destructive',
          onPress: async () => {
            if (!metaConfigId) return;
            setIsDisconnectingMeta(true);
            try {
              await pb.collection('whatsapp_configurations').delete(metaConfigId);
              setMetaConfigId(null);
              setMetaWabaId('');
              setMetaPhoneId('');
              setMetaToken('');
              setMetaPhone('');
              Alert.alert("Disconnected", "Your Meta WhatsApp account was removed.");
            } catch (err: any) {
              Alert.alert("Error", err.message);
            } finally {
              setIsDisconnectingMeta(false);
            }
          }
        }
      ]
    );
  };

  const handleSendTestMessage = async () => {
    setIsSendingTest(true);
    try {
      const res = await pb.send('/api/risev/merchant/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + pb.authStore.token },
        body: { phone: metaPhone || user?.phone }
      });
      if (res.success) {
        Alert.alert('Message Sent! 🚀', `A test WhatsApp message was sent to ${metaPhone || user?.phone}. Please check your phone!`);
      }
    } catch (error: any) {
      Alert.alert('Send Failed', error.message || 'Unknown error occurred.');
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050505' }} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WhatsApp Cloud API</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={{ width: '100%', flex: 1, backgroundColor: '#FAFAFA' }}
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160, backgroundColor: '#050505', zIndex: 0 }} />

        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24 }}>
          {/* Premium Intro Section */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginBottom: 32, paddingHorizontal: 4 }}>
            <View style={{ flex: 1, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="logo-whatsapp" size={32} color="#25D366" />
                <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: -0.5 }}>Integration</Text>
              </View>
              <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 22 }}>
                Connect your Meta Business account to securely run automated messaging campaigns, follow-ups, and broadcasts.
              </Text>
            </View>
          </View>

          {/* Meta API Pricing & Billing Info Card */}
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 24, elevation: 3, width: '100%', borderWidth: 1, borderColor: '#F1F5F9' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', paddingBottom: 16 }}>
              <View style={{ backgroundColor: '#F0FDF4', padding: 10, borderRadius: 12 }}>
                <Ionicons name="card" size={20} color="#22C55E" />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                  Meta API Pricing (Malaysia)
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2, fontFamily: 'PlusJakartaSans_500Medium' }}>
                  Billed directly to your linked credit card
                </Text>
              </View>
            </View>
            
            <View style={{ gap: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 14, color: '#334155', fontFamily: 'PlusJakartaSans_700Bold' }}>Utility Messages</Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Automated Follow-ups</Text>
                </View>
                <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9' }}>
                  <Text style={{ fontSize: 14, color: '#0F172A', fontFamily: 'PlusJakartaSans_800ExtraBold' }}>~RM 0.06 <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>/msg</Text></Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 14, color: '#334155', fontFamily: 'PlusJakartaSans_700Bold' }}>Marketing Messages</Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Broadcasts & Promos</Text>
                </View>
                <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9' }}>
                  <Text style={{ fontSize: 14, color: '#0F172A', fontFamily: 'PlusJakartaSans_800ExtraBold' }}>~RM 0.35 <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>/msg</Text></Text>
                </View>
              </View>
            </View>
            <View style={{ backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginTop: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Ionicons name="information-circle" size={16} color="#D97706" style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 12, color: '#B45309', lineHeight: 18, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                You must link a debit/credit card to your WhatsApp Business Account (WABA) in Meta Business Suite to allow message delivery.
              </Text>
            </View>
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
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 24, elevation: 3, width: '100%', borderWidth: 1, borderColor: '#F1F5F9' }}>
                <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 24 }}>
                  {locale === 'en' ? 'Setup Instructions' : 'Arahan Persediaan'}
                </Text>

                {/* Vertical Timeline */}
                <View style={{ gap: 24 }}>
                  {/* Step 1 */}
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ alignItems: 'center', marginRight: 16 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', zIndex: 2, borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#22C55E', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#16A34A' }}>1</Text>
                      </View>
                      <View style={{ width: 2, height: '100%', backgroundColor: '#E2E8F0', position: 'absolute', top: 32, bottom: -24 }} />
                    </View>
                    <View style={{ flex: 1, paddingBottom: 8 }}>
                      <Text style={{ fontSize: 15, color: '#0F172A', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 }}>
                        {locale === 'en' ? 'Prepare a Dedicated Number' : 'Sediakan Nombor Khas'}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 20 }}>
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
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', zIndex: 2, borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#3B82F6', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#2563EB' }}>2</Text>
                      </View>
                      <View style={{ width: 2, height: '100%', backgroundColor: '#E2E8F0', position: 'absolute', top: 32, bottom: -24 }} />
                    </View>
                    <View style={{ flex: 1, paddingBottom: 8 }}>
                      <Text style={{ fontSize: 15, color: '#0F172A', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 }}>
                        {locale === 'en' ? 'Meta Signup Flow' : 'Aliran Pendaftaran Meta'}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 20 }}>
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
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', zIndex: 2, borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 4 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#475569' }}>3</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, color: '#0F172A', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 }}>
                        {locale === 'en' ? 'Automatic Sync' : 'Penyegerakan Automatik'}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 20 }}>
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
                  paddingVertical: 18,
                  borderRadius: 16,
                  marginBottom: 20,
                  width: '100%',
                  shadowColor: '#1877F2',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 6
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#050505',
    borderBottomWidth: 0,
  },
  backButton: {
    padding: 8,
    marginLeft: -8
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF'
  }
});
