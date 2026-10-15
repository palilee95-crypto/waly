import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';

const STAND_A6_TEMPLATE = require('../../assets/images/stand_a6_template.png');


export default function OnboardingSetupScreen() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopSplit = windowWidth >= 1024;

  const [activeTab, setActiveTab] = useState<'theme' | 'qr_share' | 'preview'>('theme');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [merchant, setMerchant] = useState<any>(null);
  const [program, setProgram] = useState<any>(null);

  // Form States
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState('#050505');
  const [brandingWelcomeText, setBrandingWelcomeText] = useState('');
  const [brandingBgUrl, setBrandingBgUrl] = useState('');
  const [brandingBgFile, setBrandingBgFile] = useState<any>(null);
  const [brandingBgPreview, setBrandingBgPreview] = useState<string | null>(null);
  const [isDownloadingQr, setIsDownloadingQr] = useState(false);
  const [isDownloadingA6, setIsDownloadingA6] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(Date.now());

  const getOnboardingUrl = () => {
    const merchantId = merchant?.id || user?.merchant_id || (pb.authStore.record as any)?.merchant_id || '';
    return `https://risev.app/nfc?m=${merchantId}`;
  };

  const handleCopyOnboardingLink = async () => {
    const url = getOnboardingUrl();
    await Clipboard.setStringAsync(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsapp = () => {
    const storeName = merchant?.name || user?.name || 'our store';
    const url = getOnboardingUrl();
    const message = `Collect stamps & unlock rewards at ${storeName}! Tap or scan here: ${url}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(waUrl, '_blank');
    } else {
      Linking.openURL(waUrl);
    }
  };

  const handleDownloadA6Stand = async () => {
    const storeName = (merchant?.name || user?.name || 'STORE NAME').toUpperCase();
    const url = getOnboardingUrl();
    const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(url)}&margin=0`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        setIsDownloadingA6(true);

        const templateUri =
          typeof STAND_A6_TEMPLATE === 'string'
            ? STAND_A6_TEMPLATE
            : (STAND_A6_TEMPLATE?.uri || STAND_A6_TEMPLATE?.default?.uri || STAND_A6_TEMPLATE?.default || '/assets/stand_a6_template.png');

        // 1. Load Template Image
        const templateImg = new (window as any).Image();
        templateImg.crossOrigin = 'anonymous';
        const templateLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
          templateImg.onload = () => resolve(templateImg);
          templateImg.onerror = (e: any) => reject(new Error('Failed to load template image: ' + e));
          templateImg.src = templateUri;
        });

        // 2. Load QR Code Image
        const qrImg = new (window as any).Image();
        qrImg.crossOrigin = 'anonymous';
        const qrLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
          qrImg.onload = () => resolve(qrImg);
          qrImg.onerror = (e: any) => reject(new Error('Failed to load QR image: ' + e));
          qrImg.src = qrDataUrl;
        });

        const [loadedTemplate, loadedQr] = await Promise.all([templateLoaded, qrLoaded]);

        // 3. Create high-resolution Canvas (2x scale for 300 DPI print quality: 1282 x 2048)
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = (loadedTemplate.naturalWidth || 641) * scale;
        canvas.height = (loadedTemplate.naturalHeight || 1024) * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');

        // Draw background template
        ctx.drawImage(loadedTemplate, 0, 0, canvas.width, canvas.height);

        // 4. Draw QR Code inside the white squircle
        // Template bounds: left=147, top=498, width=346, height=344
        const padding = 18 * scale;
        const boxLeft = 147 * scale;
        const boxTop = 498 * scale;
        const boxW = 346 * scale;
        const boxH = 344 * scale;
        const qrSize = boxW - (padding * 2);
        const qrX = boxLeft + padding;
        const qrY = boxTop + Math.round((boxH - qrSize) / 2);

        ctx.drawImage(loadedQr, qrX, qrY, qrSize, qrSize);

        // 5. Draw Merchant Store Name (Clean Bold Text - Gaya 2)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let fontSize = 24 * scale;
        ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", "Inter", -apple-system, sans-serif`;

        const maxTextWidth = canvas.width - (80 * scale);
        let measuredWidth = ctx.measureText(storeName).width;
        if (measuredWidth > maxTextWidth) {
          fontSize = Math.floor(fontSize * (maxTextWidth / measuredWidth));
          ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", "Inter", -apple-system, sans-serif`;
        }

        ctx.fillStyle = '#050505';
        ctx.fillText(storeName, canvas.width / 2, 942 * scale);

        // 6. Trigger Download
        canvas.toBlob((blob) => {
          if (!blob) throw new Error('Blob creation failed');
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          const cleanName = storeName.replace(/[^A-Za-z0-9]/g, '_') || 'STORE';
          link.href = blobUrl;
          link.download = `Risev_Stand_A6_${cleanName}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1500);
        }, 'image/png');

      } catch (err: any) {
        console.error('Failed to generate A6 stand:', err);
        Alert.alert('Notice', 'Canvas composite fallback: downloading standard QR image.');
        handleDownloadQr();
      } finally {
        setIsDownloadingA6(false);
      }
    } else {
      handleDownloadQr();
    }
  };

  const handleDownloadQr = async () => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(url)}`;
    const fileName = `${merchant?.name ? merchant.name.replace(/[^a-zA-Z0-9]/g, '_') : 'store'}-onboarding-qr.png`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        setIsDownloadingQr(true);
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      } catch (err) {
        console.warn('Direct blob download failed, opening image in new tab:', err);
        window.open(qrUrl, '_blank');
      } finally {
        setIsDownloadingQr(false);
      }
    } else {
      Linking.openURL(qrUrl);
    }
  };

  const handleOpenLivePreview = async () => {
    const merchantId = merchant?.id || user?.merchant_id || (pb.authStore.record as any)?.merchant_id || '';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const liveUrl = `${window.location.origin}/nfc?m=${merchantId}`;
      window.open(liveUrl, '_blank');
    } else {
      router.push({
        pathname: '/nfc' as any,
        params: { m: merchantId }
      });
    }
  };

  const fetchProfileData = React.useCallback(async () => {
    const activeMerchantId = user?.merchant_id || (pb.authStore.record as any)?.merchant_id;
    let mRec: any = null;

    try {
      setLoading(true);
      if (activeMerchantId) {
        mRec = await pb.collection('merchants').getOne(activeMerchantId).catch(() => null);
      }
      
      // Fallback: look up by owner if merchant_id wasn't immediately linked
      if (!mRec && (user?.id || pb.authStore.record?.id)) {
        const ownerId = user?.id || pb.authStore.record?.id;
        try {
          const list = await pb.collection('merchants').getFullList({
            filter: `owner = "${ownerId}"`,
            requestKey: null,
          });
          if (list.length > 0) {
            mRec = list[0];
          }
        } catch (findErr) {
          console.warn('[OnboardingSetup] Fallback owner merchant lookup failed:', findErr);
        }
      }

      if (!mRec) {
        setLoading(false);
        return;
      }

      setMerchant(mRec);

      setBrandingPrimaryColor(mRec.onboarding_primary_color || '#050505');
      setBrandingWelcomeText(mRec.onboarding_welcome_text || '');
      setBrandingBgUrl(mRec.onboarding_bg_url || '');

      let bgUrl: string | null = null;
      if (mRec.background_image) {
        try {
          bgUrl = pb.files.getURL(mRec, mRec.background_image);
        } catch {
          bgUrl = `${pb.baseUrl}/api/files/merchants/${mRec.id}/${mRec.background_image}`;
        }
      } else if (mRec.onboarding_bg_url) {
        bgUrl = mRec.onboarding_bg_url;
      }
      setBrandingBgPreview(bgUrl);

      try {
        const progList = await pb.collection('loyalty_programs').getFullList({
          filter: `merchant = "${mRec.id}"`
        });
        if (progList.length > 0) {
          setProgram(progList[0]);
        }
      } catch (err) {
        console.warn('Failed to load loyalty program info:', err);
      }
    } catch (err) {
      console.warn("Failed to load profile data:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.merchant_id, user?.id]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  useFocusEffect(
    React.useCallback(() => {
      fetchProfileData();
    }, [fetchProfileData])
  );

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

  const handleSaveBranding = async () => {
    const targetMerchantId = merchant?.id || user?.merchant_id || (pb.authStore.record as any)?.merchant_id;
    if (!targetMerchantId) return;
    setIsSaving(true);
    setIsSaved(false);
    try {
      const formData = new FormData();
      formData.append('onboarding_primary_color', brandingPrimaryColor);
      formData.append('onboarding_welcome_text', brandingWelcomeText);
      formData.append('onboarding_bg_url', brandingBgUrl);

      if (brandingBgFile) {
        formData.append('background_image', brandingBgFile);
      } else if (brandingBgPreview === null && brandingBgUrl === '') {
        formData.append('background_image', '');
        formData.append('onboarding_bg_url', '');
      }

      const updated = await pb.collection('merchants').update(targetMerchantId, formData);
      setMerchant(updated);
      setIsSaved(true);
      setPreviewRefreshKey(Date.now());
      setTimeout(() => {
        setIsSaved(false);
      }, 3500);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save branding.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for color contrast
  const getIsLight = (color: string) => {
    const hex = (color || '#ffffff').replace('#', '');
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 180;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 180;
    }
    return true;
  };

  const isLightBrandColor = getIsLight(brandingPrimaryColor);
  const brandTextColor = isLightBrandColor ? '#0F172A' : '#FFFFFF';
  const brandSubtextColor = isLightBrandColor ? '#475569' : 'rgba(255, 255, 255, 0.75)';
  const brandInputBorderColor = isLightBrandColor ? '#CBD5E1' : 'rgba(255, 255, 255, 0.25)';
  const brandInputBgColor = isLightBrandColor ? '#F8FAFC' : 'rgba(255, 255, 255, 0.08)';

  // Interactive Customer Onboarding Device Frame (Matching Booking Page Architecture)
  const renderPhoneMockup = () => {
    const merchantId = merchant?.id || user?.merchant_id || (pb.authStore.record as any)?.merchant_id || '';
    const targetUrl = `/nfc?m=${merchantId}`;

    return (
      <View style={styles.previewContainerCard}>
        {/* Live Toolbar */}
        <View style={styles.previewToolbar}>
          <View style={styles.previewUrlBadge}>
            <Text style={styles.previewLiveDot}>●</Text>
            <Text style={styles.previewUrlText} numberOfLines={1} ellipsizeMode="tail">
              /nfc?m={merchantId}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <TouchableOpacity
              style={styles.btnToolbarAction}
              onPress={() => setPreviewRefreshKey(Date.now())}
              activeOpacity={0.7}
            >
              <Ionicons name="reload" size={13} color="#0F172A" />
              <Text style={styles.btnToolbarActionText}>
                {locale === 'en' ? 'Reload' : 'Muat Semula'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnToolbarAction, styles.btnToolbarActionPrimary]}
              onPress={handleOpenLivePreview}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={13} color="#000000" />
              <Text style={styles.btnToolbarActionPrimaryText}>
                {locale === 'en' ? 'Open ↗' : 'Buka ↗'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Device Frame Viewport */}
        <View style={styles.deviceFrame}>
          {/* Speaker Notch Bar */}
          <View style={styles.deviceSpeakerBar} />

          {Platform.OS === 'web' ? (
            React.createElement('iframe', {
              key: previewRefreshKey,
              src: `${targetUrl}&preview=1&t=${previewRefreshKey}`,
              style: {
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#FFFFFF',
                borderRadius: 36,
              },
              title: 'Live Customer Onboarding Preview',
            })
          ) : (
            <View style={styles.mobileFallbackPreview}>
              <Ionicons name="phone-portrait-outline" size={44} color="#FFCC00" />
              <Text style={styles.mobileFallbackTitle}>Live Customer View</Text>
              <Text style={styles.mobileFallbackSub}>
                {locale === 'en'
                  ? 'Tap below to test your full onboarding portal as customers see it.'
                  : 'Tekan butang di bawah untuk uji halaman sambutan pelanggan.'}
              </Text>
              <TouchableOpacity
                style={styles.btnOpenFallback}
                onPress={handleOpenLivePreview}
                activeOpacity={0.85}
              >
                <Ionicons name="open-outline" size={15} color="#000000" />
                <Text style={styles.btnOpenFallbackText}>
                  {locale === 'en' ? 'Launch Customer View ➔' : 'Buka Paparan Pelanggan ➔'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFCC00" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ── Executive Header ── */}
      <View style={[styles.header, isDesktopSplit && { maxWidth: 1200, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12, minWidth: 0 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#050505" />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {locale === 'en' ? 'Onboarding Setup' : 'Tetapan Sambutan'}
            </Text>
            <Text style={styles.headerSubTitle} numberOfLines={1} ellipsizeMode="tail">
              {locale === 'en' ? 'Customize storefront styling & welcome flow' : 'Urus tema sambutan & pautan NFC'}
            </Text>
          </View>
        </View>
        <Image 
          source={require('../../assets/risev logo.png')}
          style={{ width: 76, height: 22, resizeMode: 'contain', tintColor: '#050505', flexShrink: 0 }}
        />
      </View>

      {/* ── Segmented Tab Bar (Hidden on Desktop Split View) ── */}
      {!isDesktopSplit && (
        <View style={styles.segmentedTabBar}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'theme' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('theme')}
            activeOpacity={0.85}
          >
            <Ionicons name="color-palette" size={15} color={activeTab === 'theme' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.segmentBtnText, activeTab === 'theme' && styles.segmentBtnTextActive]}>
              {locale === 'en' ? 'Theme' : 'Tema'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'qr_share' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('qr_share')}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code" size={15} color={activeTab === 'qr_share' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.segmentBtnText, activeTab === 'qr_share' && styles.segmentBtnTextActive]}>
              {locale === 'en' ? 'QR & Links' : 'QR & Pautan'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'preview' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('preview')}
            activeOpacity={0.85}
          >
            <Ionicons name="eye" size={15} color={activeTab === 'preview' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.segmentBtnText, activeTab === 'preview' && styles.segmentBtnTextActive]}>
              {locale === 'en' ? 'Live Preview' : 'Previu'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Main Content Area (Responsive Split on Desktop) ── */}
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent, 
          isDesktopSplit && { maxWidth: 1200, alignSelf: 'center', width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 28 }
        ]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Left Column (Controls & Settings) */}
        <View style={[styles.controlsColumn, isDesktopSplit && { flex: 1.25 }]}>
          {/* Desktop Tab Switcher */}
          {isDesktopSplit && (
            <View style={[styles.segmentedTabBar, { marginBottom: 16 }]}>
              <TouchableOpacity
                style={[styles.segmentBtn, activeTab === 'theme' && styles.segmentBtnActive]}
                onPress={() => setActiveTab('theme')}
                activeOpacity={0.85}
              >
                <Ionicons name="color-palette" size={15} color={activeTab === 'theme' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.segmentBtnText, activeTab === 'theme' && styles.segmentBtnTextActive]}>
                  {locale === 'en' ? 'Theme & Styling' : 'Tema & Reka Letak'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, activeTab === 'qr_share' && styles.segmentBtnActive]}
                onPress={() => setActiveTab('qr_share')}
                activeOpacity={0.85}
              >
                <Ionicons name="qr-code" size={15} color={activeTab === 'qr_share' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.segmentBtnText, activeTab === 'qr_share' && styles.segmentBtnTextActive]}>
                  {locale === 'en' ? 'QR Code & Links' : 'Kod QR & Pautan'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 1: THEME & BRANDING */}
          {(activeTab === 'theme' || (isDesktopSplit && activeTab === 'preview')) && (
            <View style={{ gap: 16 }}>

              {/* Primary Color Customizer */}
              <View style={styles.sectionCard}>
                <Text style={styles.cardHeaderTitle}>
                  {locale === 'en' ? 'Primary Brand Color' : 'Warna Utama Jenama'}
                </Text>
                <Text style={styles.cardHeaderSub}>
                  {locale === 'en' ? 'Used for the customer sheet card, buttons & badges' : 'Warna kad borang, butang tuntut & lencana pelanggan'}
                </Text>

                <View style={styles.colorPickerRow}>
                  <View style={[styles.colorBox, { backgroundColor: brandingPrimaryColor }]}>
                    {Platform.OS === 'web' && (
                      <input
                        type="color"
                        value={brandingPrimaryColor}
                        onChange={(e: any) => setBrandingPrimaryColor(e.target.value.toUpperCase())}
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
                        } as any}
                      />
                    )}
                  </View>

                  <View style={styles.hexInputBox}>
                    <Text style={styles.hexPrefix}>#</Text>
                    <TextInput
                      style={styles.hexInput}
                      value={brandingPrimaryColor.replace('#', '')}
                      onChangeText={(val) => setBrandingPrimaryColor(`#${val.replace(/[^0-9A-Fa-f]/g, '')}`)}
                      maxLength={6}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                {/* Swatches Grid */}
                <View style={styles.swatchesRow}>
                  {['#050505', '#F59E0B', '#15803D', '#5C3BCC', '#DC2626', '#0284C7', '#0F172A'].map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.swatchCircle,
                        { backgroundColor: c },
                        brandingPrimaryColor.toLowerCase() === c.toLowerCase() && styles.swatchCircleActive,
                      ]}
                      onPress={() => setBrandingPrimaryColor(c)}
                      activeOpacity={0.8}
                    >
                      {brandingPrimaryColor.toLowerCase() === c.toLowerCase() && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Background Wallpaper (9:16) */}
              <View style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeaderTitle}>
                    {locale === 'en' ? 'Background Wallpaper (9:16)' : 'Gambar Latar Belakang (9:16)'}
                  </Text>
                  {!!(brandingBgPreview || brandingBgUrl) && (
                    <TouchableOpacity
                      onPress={() => {
                        setBrandingBgFile(null);
                        setBrandingBgPreview(null);
                        setBrandingBgUrl('');
                      }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#DC2626' }}>
                        {locale === 'en' ? 'Remove' : 'Buang'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.cardHeaderSub}>
                  {locale === 'en' 
                    ? 'Upload your store banner or select from our curated wallpaper collection' 
                    : 'Muat naik gambar kedai atau pilih dari koleksi wallpaper terpilih'}
                </Text>

                {/* Image Dropzone Preview */}
                <View style={styles.bannerDropzone}>
                  {!!(brandingBgPreview || brandingBgUrl) ? (
                    <View style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
                      <Image
                        source={{ uri: brandingBgPreview || brandingBgUrl }}
                        style={{ width: '100%', height: '100%', borderRadius: 14 }}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={styles.changeOverlayBtn}
                        onPress={handlePickBrandingBg}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="camera" size={16} color="#FFFFFF" />
                        <Text style={styles.changeOverlayText}>
                          {locale === 'en' ? 'Change Photo' : 'Tukar Gambar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadTriggerBox}
                      onPress={handlePickBrandingBg}
                      activeOpacity={0.8}
                    >
                      <View style={styles.uploadIconCircle}>
                        <Ionicons name="cloud-upload" size={20} color="#050505" />
                      </View>
                      <Text style={styles.uploadMainText}>
                        {locale === 'en' ? 'Tap to Upload Custom Wallpaper' : 'Sentuh untuk Muat Naik Wallpaper'}
                      </Text>
                      <Text style={styles.uploadSubText}>
                        {locale === 'en' ? 'Recommended: 1080 x 1920 (9:16 portrait)' : 'Disyorkan: Nisbah potret 9:16'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Direct Image URL fallback */}
                <View style={styles.urlInputRow}>
                  <Ionicons name="link-outline" size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.urlInput}
                    value={brandingBgUrl}
                    onChangeText={(val) => {
                      setBrandingBgUrl(val);
                      if (val.trim()) {
                        setBrandingBgPreview(val.trim());
                      }
                    }}
                    placeholder="or paste image URL (https://...)"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />
                </View>
              </View>

            </View>
          )}

          {/* TAB 2: QR & SHARE HUB */}
          {activeTab === 'qr_share' && (
            <View style={{ gap: 16 }}>
              <View style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="qr-code" size={18} color="#050505" />
                    <Text style={styles.cardHeaderTitle}>
                      {locale === 'en' ? 'Counter Stand Poster (A6)' : 'Poster Stand Meja Kaunter (A6)'}
                    </Text>
                  </View>
                  <View style={styles.presetCountBadge}>
                    <Text style={styles.presetCountText}>300 DPI Print-Ready</Text>
                  </View>
                </View>

                <Text style={styles.cardHeaderSub}>
                  {locale === 'en'
                    ? 'Official Risev A6 acrylic stand poster with your unique store QR code & name ready to print'
                    : 'Poster rasmi Risev saiz A6 lengkap dengan kod QR dan nama kedai anda, sedia untuk dicetak'}
                </Text>

                {/* Interactive A6 Counter Stand Mockup Card */}
                <View style={styles.standMockupCard}>
                  <View style={styles.standMockupFrame}>
                    {/* Background Poster Template */}
                    <Image
                      source={STAND_A6_TEMPLATE}
                      style={styles.standTemplateImg}
                      resizeMode="cover"
                    />

                    {/* Dynamic QR Injected into the White Squircle */}
                    <View style={styles.standQrContainer}>
                      <Image
                        source={{
                          uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getOnboardingUrl())}&margin=0`,
                        }}
                        style={styles.standQrImage}
                        resizeMode="contain"
                      />
                    </View>

                    {/* Live Merchant Store Name (Clean Bold Text Style) */}
                    <View style={styles.standStoreNameContainer}>
                      <Text style={styles.standStoreNameText} numberOfLines={1}>
                        {(merchant?.name || user?.name || 'STORE NAME').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.qrHintText}>
                    {locale === 'en'
                      ? 'Live Print Preview • A6 (105 × 148 mm)'
                      : 'Previu Siap Cetak • Saiz A6 (105 × 148 mm)'}
                  </Text>
                </View>

                {/* Primary CTA: Big A6 Stand Download */}
                <TouchableOpacity
                  style={[styles.downloadA6Btn, isDownloadingA6 && { opacity: 0.7 }]}
                  onPress={handleDownloadA6Stand}
                  disabled={isDownloadingA6}
                  activeOpacity={0.85}
                >
                  {isDownloadingA6 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color="#050505" />
                      <Text style={styles.downloadA6BtnText}>
                        {locale === 'en' ? 'GENERATING A6 POSTER...' : 'MENJANA STAND A6...'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="print" size={18} color="#050505" />
                        <Text style={styles.downloadA6BtnText}>
                          {locale === 'en' ? 'DOWNLOAD A6 STAND POSTER' : 'MUAT TURUN STAND MEJA A6'}
                        </Text>
                      </View>
                      <Text style={styles.downloadA6BtnSub}>
                        {locale === 'en' ? 'High-Res Print Ready (105 × 148 mm • 300 DPI)' : 'Format Siap Cetak (105 × 148 mm • 300 DPI)'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Secondary Actions: WhatsApp Share & Raw QR */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={styles.whatsappBtn}
                    onPress={handleShareWhatsapp}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                    <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.downloadBtn, isDownloadingQr && { opacity: 0.7 }]}
                    onPress={handleDownloadQr}
                    disabled={isDownloadingQr}
                    activeOpacity={0.85}
                  >
                    {isDownloadingQr ? (
                      <ActivityIndicator size="small" color="#050505" />
                    ) : (
                      <>
                        <Ionicons name="qr-code-outline" size={16} color="#050505" />
                        <Text style={styles.downloadBtnText}>QR Sahaja (PNG)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Link Bar with 1-Tap Copy */}
                <TouchableOpacity
                  style={[styles.linkBar, { marginTop: 12 }]}
                  onPress={handleCopyOnboardingLink}
                  activeOpacity={0.8}
                >
                  <Ionicons name="link" size={16} color="#94A3B8" />
                  <Text style={styles.linkBarText} numberOfLines={1}>
                    {getOnboardingUrl()}
                  </Text>
                  <View style={[styles.copyPill, copiedLink && { backgroundColor: '#16A34A' }]}>
                    <Ionicons name={copiedLink ? "checkmark" : "copy-outline"} size={12} color="#FFFFFF" />
                    <Text style={styles.copyPillText}>
                      {copiedLink ? (locale === 'en' ? 'Copied!' : 'Disalin!') : (locale === 'en' ? 'Copy' : 'Salin')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB 3: LIVE PREVIEW (Mobile Only) */}
          {!isDesktopSplit && activeTab === 'preview' && (
            <View style={{ gap: 16, alignItems: 'center' }}>
              {renderPhoneMockup()}
            </View>
          )}

          {/* Sticky Save Changes CTA (Visible in Theme tab or Desktop) */}
          {(activeTab === 'theme' || isDesktopSplit) && (
            <TouchableOpacity
            style={[
              styles.saveBtn,
              isSaving && { opacity: 0.7 },
              isSaved && { backgroundColor: '#16A34A' }
            ]}
            onPress={handleSaveBranding}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {locale === 'en' ? 'SAVING CHANGES...' : 'MENYIMPAN...'}
                </Text>
              </View>
            ) : isSaved ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {locale === 'en' ? 'CHANGES SAVED' : 'BERJAYA DISIMPAN'}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {locale === 'en' ? 'SAVE BRANDING' : 'SIMPAN TETAPAN'}
                </Text>
              </View>
            )}
            </TouchableOpacity>
          )}
        </View>

        {/* Right Column: Sticky Live Smartphone Mockup (Desktop Split View) */}
        {isDesktopSplit && (
          <View style={styles.previewDesktopColumn}>
            <View style={styles.previewStickyBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={styles.previewColumnTitle}>
                  {locale === 'en' ? 'Interactive Customer View' : 'Pandangan Interaktif Pelanggan'}
                </Text>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live Reactive</Text>
                </View>
              </View>
              {renderPhoneMockup()}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.3,
  },
  headerSubTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  segmentedTabBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#050505',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 160,
  },
  controlsColumn: {
    width: '100%',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.3,
  },
  cardHeaderSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginBottom: 14,
  },
  presetCountBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  presetCountText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
  colorPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  colorBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    position: 'relative',
    overflow: 'hidden',
  },
  hexInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    width: 140,
  },
  hexPrefix: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginRight: 4,
  },
  hexInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatchCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchCircleActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerDropzone: {
    height: 140,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginBottom: 10,
    overflow: 'hidden',
  },
  uploadTriggerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  uploadIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  uploadMainText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  uploadSubText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
  },
  changeOverlayBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  changeOverlayText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#050505',
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  qrCodeBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  standMockupCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  standMockupFrame: {
    width: 240,
    height: 383, // 240 * (1024 / 641) ≈ 383.4
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  standTemplateImg: {
    width: '100%',
    height: '100%',
  },
  standQrContainer: {
    position: 'absolute',
    left: '22.93%',
    top: '48.63%',
    width: '53.98%',
    height: '33.59%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  standQrImage: {
    width: '100%',
    height: '100%',
  },
  standStoreNameContainer: {
    position: 'absolute',
    bottom: 18,
    left: 10,
    right: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standStoreNameText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  downloadA6Btn: {
    backgroundColor: '#FFCC00',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAB308',
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  downloadA6BtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: 0.4,
  },
  downloadA6BtnSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#451A03',
    opacity: 0.85,
  },
  qrImage: {
    width: 220,
    height: 220,
    marginBottom: 8,
  },
  qrHintText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  linkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 8,
  },
  linkBarText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  copyPill: {
    backgroundColor: '#050505',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  whatsappBtn: {
    flex: 1,
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  whatsappBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  downloadBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  downloadBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  saveBtn: {
    backgroundColor: '#050505',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  // ── Phone Mockup Styles ──
  phoneMockupWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  previewDesktopColumn: {
    flex: 1,
  },
  previewStickyBox: {
    position: 'sticky' as any,
    top: 20,
    alignItems: 'center',
  },
  previewColumnTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  // ── Booking Page Style Interactive Preview Card Styles ──
  previewContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 414,
    alignSelf: 'center',
  },
  previewToolbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
    gap: 6,
  },
  previewUrlBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
  },
  previewLiveDot: {
    fontSize: 8,
    color: '#22C55E',
  },
  previewUrlText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    flexShrink: 1,
  },
  btnToolbarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  btnToolbarActionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  btnToolbarActionPrimary: {
    backgroundColor: '#FFCC00',
  },
  btnToolbarActionPrimaryText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  deviceFrame: {
    width: '100%',
    maxWidth: 390,
    height: 840,
    backgroundColor: '#0F172A',
    borderRadius: 44,
    padding: 6,
    borderWidth: 5,
    borderColor: '#1E293B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  deviceSpeakerBar: {
    width: 90,
    height: 18,
    backgroundColor: '#000000',
    borderRadius: 10,
    alignSelf: 'center',
    position: 'absolute',
    top: 10,
    zIndex: 10,
  },
  mobileFallbackPreview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  mobileFallbackTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  mobileFallbackSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  btnOpenFallback: {
    backgroundColor: '#FFCC00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  btnOpenFallbackText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
});
