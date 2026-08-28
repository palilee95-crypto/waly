import React, { useState, useEffect, useRef } from 'react';
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
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import FlippableLoyaltyCard from '../(customer)/_components/FlippableLoyaltyCard';

export default function OnboardingSetupScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [merchant, setMerchant] = useState<any>(null);
  const [program, setProgram] = useState<any>(null);

  const webColorInputRef = useRef<any>(null);

  // Form States
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState('#050505');
  const [brandingWelcomeText, setBrandingWelcomeText] = useState('');
  const [brandingLogoUrl, setBrandingLogoUrl] = useState('');
  const [brandingBgUrl, setBrandingBgUrl] = useState('');
  const [brandingBgFile, setBrandingBgFile] = useState<any>(null);
  const [brandingBgPreview, setBrandingBgPreview] = useState<string | null>(null);
  const [brandingLogoFile, setBrandingLogoFile] = useState<any>(null);
  const [brandingLogoPreview, setBrandingLogoPreview] = useState<string | null>(null);
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);

  const handleAutoConvertGoogleUrl = async (rawUrl: string) => {
    let clean = rawUrl.trim();
    if (!clean) {
      setGoogleReviewUrl('');
      return;
    }

    // 1. Immediate client conversions
    if (clean.startsWith('ChIJ') && clean.length > 20 && !clean.includes(' ')) {
      setGoogleReviewUrl(`https://search.google.com/local/writereview?placeid=${clean}`);
      return;
    }
    if (clean.includes('g.page/') && !clean.endsWith('/review') && !clean.includes('?')) {
      setGoogleReviewUrl(`${clean}/review`);
      return;
    }
    if (clean.includes('placeid=')) {
      const match = clean.match(/placeid=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        setGoogleReviewUrl(`https://search.google.com/local/writereview?placeid=${match[1]}`);
        return;
      }
    }

    setGoogleReviewUrl(clean);

    // 2. Server-side auto resolver for maps.app.goo.gl or standard Google Maps URLs
    if (clean.includes('maps.app.goo.gl') || clean.includes('goo.gl/maps') || clean.includes('google.com/maps')) {
      try {
        setIsResolvingUrl(true);
        const res = await fetch(`${pb.baseUrl}/api/risev/google-review/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: clean }),
        });
        const data = await res.json();
        if (data && data.direct_url) {
          setGoogleReviewUrl(data.direct_url);
        }
      } catch (err) {
        console.log('Error auto-resolving Google Review URL:', err);
      } finally {
        setIsResolvingUrl(false);
      }
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    if (!user?.merchant_id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const mRec = await pb.collection('merchants').getOne(user.merchant_id);
      setMerchant(mRec);

      setBrandingPrimaryColor(mRec.onboarding_primary_color || '#050505');
      setBrandingWelcomeText(mRec.onboarding_welcome_text || '');
      setBrandingLogoUrl(mRec.onboarding_logo_url || '');
      setBrandingBgUrl(mRec.onboarding_bg_url || '');
      setGoogleReviewUrl(mRec.google_review_url || '');

      const bgUrl = mRec.background_image
        ? `${pb.baseUrl}/api/files/merchants/${mRec.id}/${mRec.background_image}`
        : null;
      setBrandingBgPreview(bgUrl);

      // Fetch program for loyalty card mockup
      try {
        const progList = await pb.collection('loyalty_programs').getFullList({
          filter: `merchant = "${user.merchant_id}"`
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
    if (!user?.merchant_id) return;
    setIsSaving(true);
    setIsSaved(false);
    try {
      const formData = new FormData();
      formData.append('onboarding_primary_color', brandingPrimaryColor);
      formData.append('onboarding_welcome_text', brandingWelcomeText);
      formData.append('onboarding_bg_url', brandingBgUrl);
      formData.append('google_review_url', googleReviewUrl.trim());

      if (brandingBgFile) {
        formData.append('background_image', brandingBgFile);
      } else if (brandingBgPreview === null && brandingBgUrl === '') {
        formData.append('background_image', '');
        formData.append('onboarding_bg_url', '');
      }

      await pb.collection('merchants').update(user.merchant_id, formData);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
      }, 3500);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save branding.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFC700" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Scrollable Dashboard View */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Dark Background Header Block */}
        <View style={{ position: 'absolute', top: -30, left: -20, right: -20, height: 220, backgroundColor: '#050505', borderBottomLeftRadius: 65, borderBottomRightRadius: 65, zIndex: 0 }} />

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Onboarding Setup</Text>
          </View>
          <Image 
            source={require('../../assets/risev logo.png')}
            style={{ width: 85, height: 26, resizeMode: 'contain', tintColor: '#FFFFFF' }}
          />
        </View>

        {/* Editorial styled subtitle box */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            Customize your storefront. Make your loyalty program look and feel like your own brand.
          </Text>
        </View>

        {/* LIVE PREVIEW SMARTPHONE MOCKUP */}
        <View style={styles.previewContainer}>
          <View style={styles.previewLabelRow}>
            <View style={styles.previewLine} />
            <Text style={styles.previewLabel}>LIVE CUSTOMER PREVIEW</Text>
            <View style={styles.previewLine} />
          </View>
          
          {/* Phone Frame */}
          <View style={styles.phoneFrame}>
            {/* Fake Notch */}
            <View style={styles.notch} />

            {/* Customer View Content */}
            <View style={styles.phoneContent}>
              {/* Background Layer */}
              {brandingBgUrl || brandingBgPreview ? (
                <Image source={{ uri: brandingBgPreview || brandingBgUrl }} style={[StyleSheet.absoluteFill, { zIndex: -1 }]} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: brandingPrimaryColor, zIndex: -1 }]} />
              )}

              {/* Gradient Overlay for better readability */}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.15)', zIndex: -1 }]} />

              {/* Back Button */}
              <View style={styles.fakeBackBtn}>
                <Ionicons name="chevron-back" size={16} color="#0F172A" />
              </View>

              {/* Mock Loyalty Card */}
              <View style={styles.cardContainerWrapper}>
                <View style={{ width: 360, alignSelf: 'center' }}>
                  <FlippableLoyaltyCard 
                    card={{
                      gradientColors: [program?.card_color || '#5C3BCC'],
                      logo: merchant?.logo ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}` : 'https://via.placeholder.com/150',
                      cardBackground: program?.card_background ? `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}` : null,
                      fontColor: program?.font_color || undefined,
                      cardIcon: program?.card_icon || 'coffee',
                      merchantName: merchant?.name || user?.name || 'Your Brand',
                      category: merchant?.category || 'OTHER',
                      totalStamps: 10,
                      collectedStamps: 0,
                    }}
                    user={user}
                  />
                </View>
              </View>

              {/* Bottom Sheet Claim Form */}
              {(() => {
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

                return (
                  <>
                  <View style={[styles.fakeFormCard, { backgroundColor: brandingPrimaryColor }]}>
                    <View style={[styles.fakeScanBadge, { backgroundColor: isLightBrandColor ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.15)' }]}>
                      <View style={[styles.fakeScanDot, { backgroundColor: isLightBrandColor ? '#10B981' : '#FFFFFF' }]} />
                      <Text style={[styles.fakeScanText, { color: isLightBrandColor ? '#10B981' : '#FFFFFF' }]}>VERIFIED NFC SCAN</Text>
                    </View>

                    <Text style={[styles.fakeFormTitle, { color: brandTextColor }]}>
                      Claim Your Stamps
                    </Text>


                    <Text style={[styles.fakeInputLabel, { color: brandSubtextColor }]}>PHONE NUMBER</Text>
                    <View style={[styles.fakeInputCapsule, { backgroundColor: brandInputBgColor, borderColor: brandInputBorderColor }]}>
                      <View style={[styles.fakeFlagPocket, { borderColor: brandInputBorderColor }]}>
                        <Text style={{ fontSize: 13 }}>🇲🇾</Text>
                        <Text style={styles.fakeCountryCode}>+60</Text>
                      </View>
                      <Text style={[styles.fakeInputPlaceholder, { color: brandSubtextColor }]}>11-234 5678</Text>
                    </View>

                    <View style={[styles.fakeButton, { backgroundColor: isLightBrandColor ? '#050505' : '#FFFFFF' }]}>
                      <Text style={[styles.fakeButtonText, { color: isLightBrandColor ? '#FFFFFF' : '#0F172A' }]}>
                        Claim Stamps Now
                      </Text>
                      <Ionicons 
                        name="arrow-forward" 
                        size={14} 
                        color={isLightBrandColor ? '#FFFFFF' : '#0F172A'} 
                      />
                    </View>

                    {/* Trust Footer */}
                    <View style={styles.fakeTrustFooter}>
                      <Ionicons name="lock-closed" size={10} color={brandSubtextColor} />
                      <Text style={[styles.fakeTrustText, { color: brandSubtextColor }]}>Secure connection by risev.app</Text>
                    </View>
                  </View>

                  {/* Risev Logo below the sheet card */}
                  <Image 
                    source={require('../../assets/risev logo.png')}
                    style={styles.fakeRisevLogoPhoneBg}
                    resizeMode="contain"
                  />
                  </>
                );
              })()}
            </View>
          </View>
        </View>

        {/* 3. NFC Stand Preview Button Only */}
        <TouchableOpacity
          style={[styles.copyBtnGold, { marginBottom: 24 }]}
          onPress={async () => {
            const merchantId = user?.merchant_id || '';
            const publicUrl = `https://risev.app/nfc?m=${merchantId}`;
            await Clipboard.setStringAsync(publicUrl);

            if (Platform.OS === 'web') {
              const liveUrl = `${window.location.origin}/nfc?m=${merchantId}`;
              window.open(liveUrl, '_blank');
            } else {
              // Open seamlessly inside the mobile app
              router.push({
                pathname: '/nfc' as any,
                params: { m: merchantId }
              });
            }
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="open-outline" size={16} color="#050505" style={{ marginRight: 6 }} />
          <Text style={{ color: '#050505', fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' }}>
            Open Live Preview
          </Text>
        </TouchableOpacity>

        {/* 1. Brand Identity Card */}
        <View style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="color-palette-outline" size={20} color="#050505" />
            <Text style={styles.cardHeaderTitle}>Brand Identity</Text>
          </View>

          {/* Primary Color */}
          <View style={{ marginBottom: 24 }}>
            <Text style={styles.fieldLabel}>PRIMARY BRAND COLOR</Text>
            
            <View style={styles.colorCapsule}>
              <View style={[styles.colorIndicator, { backgroundColor: brandingPrimaryColor }]}>
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
                      zIndex: 10,
                      border: 'none',
                      padding: 0,
                      margin: 0,
                    } as any}
                  />
                )}
              </View>
              <Text style={styles.hexSymbol}>#</Text>
              <TextInput
                style={styles.hexInput}
                value={brandingPrimaryColor.replace('#', '')}
                onChangeText={(text) => setBrandingPrimaryColor(text.startsWith('#') ? text : `#${text}`)}
                placeholder="050505"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                maxLength={7}
              />
            </View>

            {/* Preset Swatches with Checkmarks */}
            <View style={styles.swatchesRow}>
              {['#050505', '#F97316', '#10B981', '#5C3BCC', '#D97706', '#DC2626', '#0284C7'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    brandingPrimaryColor.toLowerCase() === c.toLowerCase() && styles.swatchActive
                  ]}
                  onPress={() => setBrandingPrimaryColor(c)}
                  activeOpacity={0.8}
                >
                  {brandingPrimaryColor.toLowerCase() === c.toLowerCase() && (
                    <Ionicons 
                      name="checkmark" 
                      size={14} 
                      color={c.toLowerCase() === '#ffffff' || c.toLowerCase() === '#ffc700' ? '#050505' : '#FFFFFF'} 
                    />
                  )}
                </TouchableOpacity>
              ))}
              
              {/* Color Wheel Swatch */}
              {(() => {
                const isCustomColor = !['#050505', '#f97316', '#10b981', '#5c3bcc', '#d97706', '#dc2626', '#0284c7'].includes(brandingPrimaryColor.toLowerCase());
                return (
                  <View
                    style={[
                      styles.swatch,
                      Platform.OS === 'web' 
                        ? { 
                            backgroundImage: 'conic-gradient(from 0deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #7f00ff, #ff00ff, #ff0000)',
                            boxShadow: isCustomColor 
                              ? 'inset 0 0 0 2px rgba(255,255,255,1), 0 4px 10px rgba(255, 199, 0, 0.3)' 
                              : 'inset 0 0 0 1.5px rgba(255,255,255,0.85), 0 2px 5px rgba(0,0,0,0.1)',
                            borderWidth: 0,
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: 'pointer',
                          } as any
                        : { backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: isCustomColor ? '#FFC700' : '#CBD5E1' },
                      isCustomColor && styles.swatchActive
                    ]}
                  >
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
                          zIndex: 10,
                        } as any}
                      />
                    )}
                    {isCustomColor ? (
                      <Ionicons 
                        name="checkmark" 
                        size={14} 
                        color="#FFFFFF" 
                        style={{ textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
                      />
                    ) : (
                      <Ionicons 
                        name="aperture-outline" 
                        size={16} 
                        color={Platform.OS === 'web' ? '#FFFFFF' : '#64748B'} 
                        style={Platform.OS === 'web' ? { textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } : {}}
                      />
                    )}
                  </View>
                );
              })()}
            </View>
          </View>

          {/* Background Image with Dropzone Layout */}
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.fieldLabel}>BACKGROUND IMAGE (9:16)</Text>
            
            <View style={styles.bannerPickerBox}>
              {!!(brandingBgPreview || brandingBgUrl) ? (
                <View style={{ flex: 1, position: 'relative' }}>
                  <Image
                    source={{ uri: brandingBgPreview || brandingBgUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.imageOverlay}
                    onPress={handlePickBrandingBg}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="camera" size={20} color="#FFFFFF" />
                    <Text style={styles.overlayText}>Change Background</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteOverlayBtn}
                    onPress={() => { setBrandingBgFile(null); setBrandingBgPreview(null); setBrandingBgUrl(''); }}
                  >
                    <Ionicons name="trash" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadTrigger} onPress={handlePickBrandingBg} activeOpacity={0.8}>
                  <Ionicons name="images-outline" size={32} color="#64748B" />
                  <Text style={styles.uploadTextBold}>Tap to Select Image</Text>
                  <Text style={styles.uploadTextSub}>Portrait aspect ratio (9:16) recommended</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.urlInputBox}>
              <Ionicons name="link-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.urlInput}
                value={brandingBgUrl}
                onChangeText={setBrandingBgUrl}
                placeholder="or enter image URL..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {/* 3. Risev Built-in Google Review Link Generator */}
        <View style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="star" size={17} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.cardHeaderTitle}>Google Review Link Generator</Text>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                  Native 1-Click Review Popup Builder
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.fieldSub, { marginBottom: 16 }]}>
            Generate a direct Google review link for your store in seconds. When customers give 5 stars on their NFC stamp claim, the review and rating form opens instantly — no searching, no extra steps!
          </Text>

          {/* Generator Input Section */}
          {(() => {
            const trimmed = googleReviewUrl.trim();
            const isDirectPopup = trimmed.includes('search.google.com/local/writereview') || trimmed.includes('/review');

            return (
              <View style={{ gap: 12 }}>
                {/* Search / Paste Input */}
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>BUSINESS NAME OR GOOGLE MAPS LINK</Text>
                    {isResolvingUrl ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <ActivityIndicator size="small" color="#2563EB" style={{ transform: [{ scale: 0.7 }] }} />
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#2563EB' }}>Generating...</Text>
                      </View>
                    ) : isDirectPopup ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Ionicons name="checkmark-circle" size={11} color="#15803D" />
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#15803D' }}>1-Click Popup Ready</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.urlInputBox}>
                    <Ionicons name="logo-google" size={16} color="#EA4335" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.urlInput}
                      value={googleReviewUrl}
                      onChangeText={handleAutoConvertGoogleUrl}
                      placeholder="Paste Google Maps link (e.g. maps.app.goo.gl)..."
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                    />
                    {googleReviewUrl ? (
                      <TouchableOpacity onPress={() => setGoogleReviewUrl('')} style={{ padding: 4 }}>
                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {trimmed.includes('risev.app') || trimmed.includes('localhost') ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#FECACA' }}>
                      <Ionicons name="warning-outline" size={14} color="#DC2626" />
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#DC2626', flex: 1 }}>
                        This is your Risev link. Please paste your Google Maps shop link instead.
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Quick 1-Click Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {merchant?.name && !googleReviewUrl ? (
                    <TouchableOpacity
                      style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#CBD5E1' }}
                      onPress={() => {
                        const storeQuery = `${merchant.name} review`;
                        handleAutoConvertGoogleUrl(`https://www.google.com/search?q=${encodeURIComponent(storeQuery)}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="flash-outline" size={13} color="#050505" />
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                        Use Store Name: "{merchant.name}"
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Result Card Preview */}
                {googleReviewUrl ? (
                  <View style={{ backgroundColor: isDirectPopup ? '#F0FDF4' : '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isDirectPopup ? '#BBF7D0' : '#E2E8F0' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons 
                          name={isDirectPopup ? "checkmark-circle" : "link-outline"} 
                          size={16} 
                          color={isDirectPopup ? "#16A34A" : "#64748B"} 
                        />
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: isDirectPopup ? '#15803D' : '#050505' }}>
                          {isDirectPopup ? "YOUR 1-CLICK GOOGLE REVIEW LINK" : "GOOGLE REVIEW URL"}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <Ionicons key={s} name="star" size={11} color="#F59E0B" />
                        ))}
                      </View>
                    </View>

                    <Text 
                      style={{ fontSize: 11, fontFamily: 'monospace', color: '#334155', backgroundColor: '#FFFFFF', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 10 }}
                      numberOfLines={2}
                      selectable={true}
                    >
                      {googleReviewUrl}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        style={{ flex: 1, backgroundColor: '#050505', paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onPress={() => {
                          let finalUrl = googleReviewUrl.trim();
                          if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                            finalUrl = `https://${finalUrl}`;
                          }
                          Linking.openURL(finalUrl).catch(() => Alert.alert('Invalid URL', 'Please enter a valid URL.'));
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="open-outline" size={13} color="#FFC700" />
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>
                          Test Review Popup ↗
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        onPress={() => {
                          if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(googleReviewUrl);
                            Alert.alert('Copied!', 'Google Review link copied to clipboard.');
                          } else {
                            Alert.alert('Link Ready', googleReviewUrl);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="copy-outline" size={13} color="#050505" />
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                          Copy
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* Step-by-Step Generator Guide */
                  <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      How It Works (3 Easy Steps)
                    </Text>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>1</Text>
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#475569', flex: 1 }}>
                        Paste your Google Maps link (e.g. <Text style={{ fontFamily: 'monospace' }}>maps.app.goo.gl/...</Text>) or Place ID above.
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>2</Text>
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#475569', flex: 1 }}>
                        Risev instantly converts it into a direct 1-click review popup URL.
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>3</Text>
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#475569', flex: 1 }}>
                        Customers who give 5 stars on their stamp claim are redirected straight to your review form!
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })()}
        </View>



        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            isSaving && { opacity: 0.7 },
            isSaved && { backgroundColor: '#16A34A', borderColor: '#16A34A' }
          ]}
          onPress={handleSaveBranding}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.saveBtnText}>SAVING...</Text>
            </View>
          ) : isSaved ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>SAVED</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>SAVE BRANDING</Text>
          )}
        </TouchableOpacity>
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
    paddingHorizontal: 20,
    height: 60,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  subtitleContainer: {
    marginVertical: 4,
    marginBottom: 24,
    zIndex: 1,
    paddingHorizontal: 12,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 20,
    textAlign: 'center',
  },
  previewContainer: {
    marginTop: 65,
    marginBottom: 28,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
  },
  previewLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  previewLine: {
    flex: 0.15,
    height: 1,
    backgroundColor: '#E2E8F0',
    maxWidth: 60,
  },
  previewLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  phoneFrame: {
    width: 260,
    height: 520,
    backgroundColor: '#0F172A',
    borderRadius: 36,
    borderWidth: 6,
    borderColor: '#1E293B',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  notch: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: [{ translateX: -40 }],
    width: 80,
    height: 20,
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    zIndex: 10,
  },
  phoneContent: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    padding: 12,
    paddingTop: 32,
  },
  fakeBackBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardContainerWrapper: {
    marginTop: -40,
    marginBottom: -28,
    transform: [{ scale: 0.65 }],
  },
  fakeFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  fakeScanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  fakeScanDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  fakeScanText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
  },
  fakeFormTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 2,
  },
  fakeFormDesc: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginBottom: 12,
  },
  fakeInputLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 4,
  },
  fakeInputCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    height: 38,
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  fakeFlagPocket: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  fakeCountryCode: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  fakeInputPlaceholder: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
    marginLeft: 8,
  },
  fakeButton: {
    borderRadius: 12,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  fakeButtonText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  fakeTrustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  fakeTrustText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  fakeRisevLogo: {
    height: 11,
    width: 44,
    alignSelf: 'center',
    marginTop: 8,
    opacity: 0.55,
  },
  fakeRisevLogoPhoneBg: {
    height: 16,
    width: 64,
    alignSelf: 'center',
    marginTop: 12,
    tintColor: '#FFFFFF',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E293B',
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 6,
    width: 180,
  },
  colorIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  webColorInput: {
    position: 'absolute',
    top: -10,
    left: -10,
    width: 56,
    height: 56,
    opacity: 0,
    cursor: 'pointer',
  },
  hexSymbol: {
    color: '#94A3B8',
    fontFamily: 'PlusJakartaSans_700Bold',
    marginLeft: 12,
    marginRight: 2,
    fontSize: 15,
  },
  hexInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E293B',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  swatchesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  logoPickerBox: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    height: 140,
    width: 140,
    alignSelf: 'center',
    marginBottom: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    opacity: 0.85,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  deleteOverlayBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadTrigger: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  uploadTextBold: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E293B',
    marginTop: 8,
    textAlign: 'center',
  },
  uploadTextSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  urlInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
  },
  urlInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1E293B',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  bannerPickerBox: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    height: 200,
    width: '100%',
    marginBottom: 12,
    position: 'relative',
  },
  textAreaBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    minHeight: 96,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textArea: {
    flex: 1,
    minHeight: 70,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1E293B',
    textAlignVertical: 'top',
    lineHeight: 20,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  nfcCard: {
    marginBottom: 24,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  nfcUrlBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  nfcUrlText: {
    fontSize: 12,
    color: '#38BDF8',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    padding: 12,
    textAlign: 'center',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    marginTop: 12,
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 15,
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    color: '#10B981',
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  statusBadgeGold: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 199, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusDotGold: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFC700',
  },
  statusTextGold: {
    color: '#D97706',
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  copyBtnGold: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFC700',
    paddingVertical: 12,
    borderRadius: 14,
    width: '100%',
    marginTop: 20,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
});
