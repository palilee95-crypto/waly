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
  TextInput,
  ActivityIndicator,
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

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [merchant, setMerchant] = useState<any>(null);
  const [program, setProgram] = useState<any>(null);

  // Form States
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState('#050505');
  const [brandingWelcomeText, setBrandingWelcomeText] = useState('');
  const [brandingLogoUrl, setBrandingLogoUrl] = useState('');
  const [brandingBgUrl, setBrandingBgUrl] = useState('');
  const [brandingBgFile, setBrandingBgFile] = useState<any>(null);
  const [brandingBgPreview, setBrandingBgPreview] = useState<string | null>(null);
  const [brandingLogoFile, setBrandingLogoFile] = useState<any>(null);
  const [brandingLogoPreview, setBrandingLogoPreview] = useState<string | null>(null);

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

      await pb.collection('merchants').update(user.merchant_id, formData);
      Alert.alert('Saved', 'Onboarding branding updated successfully.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save branding.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#050505" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#050505" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Onboarding Setup</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Customize your storefront. Make your loyalty program look and feel like your own brand.
        </Text>

        {/* LIVE PREVIEW SMARTPHONE MOCKUP */}
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Live Customer Preview</Text>
          
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
              <View style={styles.fakeFormCard}>
                <View style={styles.fakeScanBadge}>
                  <Ionicons name="wifi" size={10} color="#B45309" style={{ transform: [{ rotate: '90deg' }] }} />
                  <Text style={styles.fakeScanText}>NFC CARD SCANNED</Text>
                </View>

                <Text style={styles.fakeFormTitle}>
                  Claim Your Stamps
                </Text>
                <Text style={styles.fakeFormDesc} numberOfLines={2}>
                  {brandingWelcomeText || 'Welcome to our loyalty program! Scan to earn stamps.'}
                </Text>

                <Text style={styles.fakeInputLabel}>PHONE NUMBER</Text>
                <View style={styles.fakeInput}>
                  <Text style={{ fontSize: 12 }}>🇲🇾</Text>
                  <Text style={styles.fakeCountryCode}>+60</Text>
                  <View style={styles.fakeDivider} />
                  <Text style={styles.fakeInputPlaceholder}>11 234 5678</Text>
                </View>

                <View style={styles.fakeButton}>
                  <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.fakeButtonText}>Claim Stamps Now</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 1. Brand Identity Card */}
        <View style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="color-palette" size={20} color="#3B82F6" />
            <Text style={styles.cardHeaderTitle}>Brand Identity</Text>
          </View>

          {/* Primary Color */}
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.fieldLabel}>PRIMARY COLOR</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.colorPickerTrigger, { backgroundColor: brandingPrimaryColor, shadowColor: brandingPrimaryColor }]}>
                {Platform.OS === 'web' && (
                  <input
                    type="color"
                    value={brandingPrimaryColor}
                    onChange={(e: any) => setBrandingPrimaryColor(e.target.value)}
                    style={styles.webColorInput}
                  />
                )}
              </View>
              <View style={styles.colorTextInputContainer}>
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
            </View>

            {/* Preset Swatches */}
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
                />
              ))}
            </View>
          </View>

          {/* Store Logo */}
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.fieldLabel}>STORE LOGO (SQUARE)</Text>
            
            <View style={styles.logoPickerBox}>
              {!!(brandingLogoPreview || brandingLogoUrl) ? (
                <>
                  <TouchableOpacity style={{ flex: 1, width: '100%' }} onPress={handlePickBrandingLogo} activeOpacity={0.9}>
                    <Image
                      source={{ uri: brandingLogoPreview || brandingLogoUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => { setBrandingLogoFile(null); setBrandingLogoPreview(null); setBrandingLogoUrl(''); }}
                  >
                    <Ionicons name="trash" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.uploadTrigger} onPress={handlePickBrandingLogo}>
                  <Ionicons name="cloud-upload-outline" size={24} color="#64748B" />
                  <Text style={styles.uploadText}>Upload Logo</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.urlInputBox}>
              <Ionicons name="link-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.urlInput}
                value={brandingLogoUrl}
                onChangeText={setBrandingLogoUrl}
                placeholder="or enter image URL..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Background Image */}
          <View>
            <Text style={styles.fieldLabel}>BACKGROUND IMAGE (9:16)</Text>
            
            <View style={styles.bannerPickerBox}>
              {!!(brandingBgPreview || brandingBgUrl) ? (
                <>
                  <TouchableOpacity style={{ flex: 1, width: '100%' }} onPress={handlePickBrandingBg} activeOpacity={0.9}>
                    <Image
                      source={{ uri: brandingBgPreview || brandingBgUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => { setBrandingBgFile(null); setBrandingBgPreview(null); setBrandingBgUrl(''); }}
                  >
                    <Ionicons name="trash" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.uploadTrigger} onPress={handlePickBrandingBg}>
                  <Ionicons name="images-outline" size={32} color="#64748B" />
                  <Text style={styles.uploadText}>Upload Background (9:16)</Text>
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

        {/* 2. Messaging Card */}
        <View style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#F59E0B" />
            <Text style={styles.cardHeaderTitle}>Messaging</Text>
          </View>

          <Text style={styles.fieldLabel}>WELCOME TEXT</Text>
          <View style={styles.textAreaBox}>
            <TextInput
              style={styles.textArea}
              value={brandingWelcomeText}
              onChangeText={setBrandingWelcomeText}
              placeholder="Welcome to our loyalty program! Scan to earn stamps."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* 3. NFC Setup Link */}
        <View style={styles.nfcCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{ backgroundColor: '#1E293B', padding: 6, borderRadius: 8 }}>
              <Ionicons name="wifi" size={16} color="#38BDF8" style={{ transform: [{ rotate: '90deg' }] }} />
            </View>
            <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#F8FAFC' }}>
              NFC Hardware Link
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: '#94A3B8', lineHeight: 18, marginBottom: 16 }}>
            Copy this unique link and write it to your physical NFC tags so customers can tap to claim stamps.
          </Text>
          
          <View style={styles.nfcUrlBox}>
            <Text style={styles.nfcUrlText} selectable>
              https://risev.app/nfc?m={user?.merchant_id}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.copyBtn}
            onPress={async () => {
              const url = `https://risev.app/nfc?m=${user?.merchant_id}`;
              await Clipboard.setStringAsync(url);
              Alert.alert('Copied', 'NFC Claim URL copied to clipboard!');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="copy-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' }}>
              Copy NFC Link
            </Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
          onPress={handleSaveBranding}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
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
    height: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },
  previewContainer: {
    marginBottom: 24,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
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
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  fakeScanText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
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
  fakeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 36,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  fakeCountryCode: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
    marginLeft: 4,
  },
  fakeDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  fakeInputPlaceholder: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  fakeButton: {
    backgroundColor: '#050505',
    borderRadius: 10,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fakeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
  },
  colorPickerTrigger: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  webColorInput: {
    position: 'absolute',
    top: -10,
    left: -10,
    width: 68,
    height: 68,
    opacity: 0,
    cursor: 'pointer',
  },
  colorTextInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  hexSymbol: {
    color: '#94A3B8',
    fontFamily: 'PlusJakartaSans_700Bold',
    marginRight: 4,
  },
  hexInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E293B',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  swatchesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderColor: '#1E293B',
  },
  swatchActive: {
    borderWidth: 2,
  },
  logoPickerBox: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    height: 120,
    width: 120,
    alignSelf: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  trashBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTrigger: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  uploadText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
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
    shadowColor: '#000',
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
    color: '#F8FAFC',
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
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 15,
    letterSpacing: 1,
  },
});
