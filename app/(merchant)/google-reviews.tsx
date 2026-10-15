import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';

export default function GoogleReviewsScreen() {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [merchantName, setMerchantName] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    if (!user?.merchant_id) return;
    try {
      setLoading(true);
      const mRec = await pb.collection('merchants').getOne(user.merchant_id);
      setGoogleReviewUrl(mRec.google_review_url || '');
      setMerchantName(mRec.name || user?.name || 'Your Store');
    } catch (err) {
      console.log('Error fetching merchant details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoConvertGoogleUrl = async (rawUrl: string) => {
    setGoogleReviewUrl(rawUrl);
    let clean = rawUrl.trim();
    if (!clean) return;

    if (clean.startsWith('ChIJ') && clean.length > 20 && !clean.includes(' ')) {
      setGoogleReviewUrl(`https://search.google.com/local/writereview?placeid=${clean}`);
      return;
    }
    if (clean.includes('g.page/') && !clean.endsWith('/review') && !clean.includes('?')) {
      setGoogleReviewUrl(`${clean}/review`);
      return;
    }
    
    const convertHexPairToPlaceId = (hex1: string, hex2: string) => {
      try {
        const h1 = hex1.replace(/^0x/i, '').padStart(16, '0');
        const h2 = hex2.replace(/^0x/i, '').padStart(16, '0');
        const bytes: number[] = [];
        for (let i = 14; i >= 0; i -= 2) bytes.push(parseInt(h1.substring(i, i+2), 16));
        bytes.push(0x11);
        for (let i = 14; i >= 0; i -= 2) bytes.push(parseInt(h2.substring(i, i+2), 16));
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return 'ChIJ' + base64;
      } catch {
        return null;
      }
    };

    const hexMatch = clean.match(/(0x[0-9a-fA-F]+)(?:%3A|:)(0x[0-9a-fA-F]+)/i);
    if (hexMatch && hexMatch[1] && hexMatch[2]) {
      const generatedPid = convertHexPairToPlaceId(hexMatch[1], hexMatch[2]);
      if (generatedPid) {
        setGoogleReviewUrl(`https://search.google.com/local/writereview?placeid=${generatedPid}`);
        return;
      }
    }

    if (clean.includes('maps.app.goo.gl') || clean.includes('goo.gl/maps') || clean.includes('google.com/maps') || clean.startsWith('http')) {
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

  const handleCopyLink = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(googleReviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      Alert.alert('Link Ready', googleReviewUrl);
    }
  };

  const handlePasteClipboard = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) handleAutoConvertGoogleUrl(text);
      } catch (err) {
        console.warn('Clipboard read error:', err);
      }
    }
  };

  const handleOpenGoogleMapsSearch = () => {
    const query = merchantName || 'my store';
    const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    Linking.openURL(mapsSearchUrl).catch(() => Alert.alert('Error', 'Could not open Google Maps.'));
  };

  const handleSave = async () => {
    if (!user?.merchant_id) return;
    setIsSaving(true);
    setIsSaved(false);
    try {
      const formData = new FormData();
      formData.append('google_review_url', googleReviewUrl.trim());

      await pb.collection('merchants').update(user.merchant_id, formData);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
      }, 3500);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  const trimmed = googleReviewUrl.trim();
  const isDirectPopup = trimmed.includes('search.google.com/local/writereview') || trimmed.includes('/review');

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#050505" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Google Reviews</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* ── Daylight Studio Executive Header ── */}
      <View style={[styles.header, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#050505" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Google Reviews</Text>
            <Text style={styles.headerSubTitle}>
              {locale === 'en' ? 'Amplify 5-star ratings & local SEO' : 'Tingkatkan ulasan 5-bintang & SEO kedai'}
            </Text>
          </View>
        </View>
        <Image 
          source={require('../../assets/risev logo.png')}
          style={{ width: 80, height: 24, resizeMode: 'contain', tintColor: '#050505' }}
        />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]} 
        showsVerticalScrollIndicator={false}
      >
        {/* ── Executive Hero Card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="star" size={13} color="#FFCC00" />
              <Text style={styles.heroBadgeText}>
                {locale === 'en' ? '5.0★ Growth Engine' : 'Enjin Ulasan 5.0★'}
              </Text>
            </View>

            <View style={styles.heroSubBadge}>
              <View style={styles.heroDot} />
              <Text style={styles.heroSubBadgeText}>
                {locale === 'en' ? 'Smart NFC Trigger' : 'Pencetus Pintar NFC'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>
            {locale === 'en' ? 'Turn NFC Loyalty Taps Into 5-Star Reviews' : 'Tukar Setiap Tap Kad Kepada Ulasan 5-Bintang'}
          </Text>
          <Text style={styles.heroDesc}>
            {locale === 'en' 
              ? 'When happy customers complete their stamp claim, Risev automatically prompts them. A direct 1-click Google review form opens with 5 stars pre-selected — zero typing, zero friction!'
              : 'Apabila pelanggan selesai menuntut cop, Risev secara automatik membuka borang ulasan Google dengan 5 bintang tersedia — pantas dan tanpa sebarang halangan!'}
          </Text>

          {/* Micro Workflow Track */}
          <View style={styles.workflowTrack}>
            <View style={styles.workflowStep}>
              <View style={styles.workflowIconCircle}>
                <Ionicons name="radio" size={13} color="#FFCC00" />
              </View>
              <Text style={styles.workflowStepText}>NFC Tap</Text>
            </View>
            <Ionicons name="arrow-forward" size={12} color="#CBD5E1" />
            <View style={styles.workflowStep}>
              <View style={styles.workflowIconCircle}>
                <Ionicons name="star" size={13} color="#FFCC00" />
              </View>
              <Text style={styles.workflowStepText}>Rates 5★</Text>
            </View>
            <Ionicons name="arrow-forward" size={12} color="#CBD5E1" />
            <View style={styles.workflowStep}>
              <View style={[styles.workflowIconCircle, { backgroundColor: '#16A34A' }]}>
                <Ionicons name="logo-google" size={12} color="#FFFFFF" />
              </View>
              <Text style={[styles.workflowStepText, { color: '#16A34A', fontFamily: 'PlusJakartaSans_700Bold' }]}>
                Google Review 🚀
              </Text>
            </View>
          </View>
        </View>

        {/* ── Link Generator Card ── */}
        <View style={styles.settingsCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.cardIconSquircle}>
                <Ionicons name="link" size={18} color="#050505" />
              </View>
              <View>
                <Text style={styles.cardHeaderTitle}>
                  {locale === 'en' ? 'Google Review Link' : 'Pautan Ulasan Google'}
                </Text>
                <Text style={styles.cardHeaderSub}>
                  {locale === 'en' ? 'Direct 1-Click Popup Setup' : 'Tetapan Pautan Borang Pantas'}
                </Text>
              </View>
            </View>

            {/* Live Status Capsule */}
            {isResolvingUrl ? (
              <View style={styles.statusPillResolving}>
                <ActivityIndicator size="small" color="#2563EB" style={{ transform: [{ scale: 0.7 }] }} />
                <Text style={styles.statusPillResolvingText}>Resolving...</Text>
              </View>
            ) : isDirectPopup ? (
              <View style={styles.statusPillReady}>
                <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                <Text style={styles.statusPillReadyText}>1-Click Ready</Text>
              </View>
            ) : null}
          </View>

          {/* Input Label */}
          <Text style={styles.fieldLabel}>
            {locale === 'en' ? 'PASTE GOOGLE MAPS LINK OR PLACE ID' : 'TAMPAL PAUTAN GOOGLE MAPS ATAU PLACE ID'}
          </Text>

          {/* Input Box */}
          <View style={styles.urlInputBox}>
            <View style={styles.googleIconBox}>
              <Ionicons name="logo-google" size={16} color="#EA4335" />
            </View>
            <TextInput
              style={styles.urlInput}
              value={googleReviewUrl}
              onChangeText={handleAutoConvertGoogleUrl}
              placeholder="e.g. maps.app.goo.gl/... or Place ID (ChIJ...)"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {googleReviewUrl ? (
              <TouchableOpacity onPress={() => setGoogleReviewUrl('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick Helper Actions */}
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={styles.quickActionBtn} 
              onPress={handlePasteClipboard}
              activeOpacity={0.8}
            >
              <Ionicons name="clipboard-outline" size={13} color="#475569" />
              <Text style={styles.quickActionBtnText}>
                {locale === 'en' ? 'Paste from Clipboard' : 'Tampal'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionBtn} 
              onPress={handleOpenGoogleMapsSearch}
              activeOpacity={0.8}
            >
              <Ionicons name="search-outline" size={13} color="#475569" />
              <Text style={styles.quickActionBtnText}>
                {locale === 'en' ? 'Search Shop on Maps ↗' : 'Cari Kedai di Maps ↗'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Warning if Risev URL was pasted */}
          {trimmed.includes('risev.app') || trimmed.includes('localhost') ? (
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.warningText}>
                {locale === 'en' 
                  ? 'This appears to be your Risev app link. Please paste your Google Maps shop link instead.' 
                  : 'Ini adalah pautan Risev anda. Sila tampalkan pautan kedai Google Maps anda.'}
              </Text>
            </View>
          ) : null}

          {/* ── Generated Direct URL Result Box ── */}
          {googleReviewUrl && (googleReviewUrl.startsWith('http') || googleReviewUrl.startsWith('ChIJ')) ? (
            <View style={[styles.resultCard, isDirectPopup && styles.resultCardPopup]}>
              <View style={styles.resultHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons 
                    name={isDirectPopup ? "checkmark-circle" : "link"} 
                    size={16} 
                    color={isDirectPopup ? "#16A34A" : "#64748B"} 
                  />
                  <Text style={[styles.resultTitle, isDirectPopup && { color: '#15803D' }]}>
                    {isDirectPopup 
                      ? (locale === 'en' ? "YOUR 1-CLICK POPUP REVIEW LINK" : "PAUTAN BORANG ULASAN 1-CLICK")
                      : "GOOGLE REVIEW URL"}
                  </Text>
                </View>

                {/* 5 Stars Visual */}
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Ionicons key={s} name="star" size={13} color="#F59E0B" />
                  ))}
                </View>
              </View>

              {/* URL Display */}
              <View style={styles.urlDisplayBox}>
                <Text style={styles.urlDisplayText} numberOfLines={2} selectable={true}>
                  {googleReviewUrl}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity 
                  style={styles.testBtn}
                  onPress={() => {
                    let finalUrl = googleReviewUrl.trim();
                    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                      finalUrl = `https://${finalUrl}`;
                    }
                    Linking.openURL(finalUrl).catch(() => Alert.alert('Invalid URL', 'Please enter a valid URL.'));
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="open-outline" size={14} color="#FFCC00" />
                  <Text style={styles.testBtnText}>
                    {locale === 'en' ? 'Test Review Popup ↗' : 'Uji Borang Popup ↗'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.copyBtn, copied && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
                  onPress={handleCopyLink}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={copied ? "checkmark" : "copy-outline"} 
                    size={14} 
                    color={copied ? "#16A34A" : "#050505"} 
                  />
                  <Text style={[styles.copyBtnText, copied && { color: '#16A34A' }]}>
                    {copied ? (locale === 'en' ? 'Copied!' : 'Disalin!') : (locale === 'en' ? 'Copy' : 'Salin')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Interactive Customer Experience Mockup ── */}
        <View style={styles.mockupContainer}>
          <View style={styles.mockupHeaderRow}>
            <Ionicons name="eye-outline" size={15} color="#64748B" />
            <Text style={styles.mockupHeaderLabel}>
              {locale === 'en' ? 'PREVIEW: WHAT CUSTOMERS EXPERIENCE' : 'PREVIU: PENGALAMAN PELANGGAN'}
            </Text>
          </View>

          <View style={styles.googleModalMockup}>
            {/* Google Brand Strip */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="logo-google" size={18} color="#EA4335" />
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569' }}>
                  Google Reviews
                </Text>
              </View>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
            </View>

            {/* Shop Details */}
            <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
              {merchantName || 'Your Store'}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
              Posting publicly across Google Search & Maps
            </Text>

            {/* 5 Big Gold Stars Rating Bar */}
            <View style={styles.mockupStarsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <View key={s} style={styles.mockupStarCircle}>
                  <Ionicons name="star" size={24} color="#F59E0B" />
                </View>
              ))}
            </View>

            <View style={styles.mockupTextarea}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>
                Share details of your own experience at this place...
              </Text>
            </View>

            {/* Mockup Action Button */}
            <View style={styles.mockupPostBtn}>
              <Text style={styles.mockupPostBtnText}>Post Review</Text>
            </View>
          </View>
        </View>

        {/* ── 3-Step Simple Guide ── */}
        <View style={styles.guideCard}>
          <Text style={styles.guideTitle}>
            {locale === 'en' ? 'How Risev Automates Your 5★ Reviews' : 'Bagaimana Risev Mengautomasikan Ulasan 5★'}
          </Text>

          <View style={styles.guideStepRow}>
            <View style={styles.guideStepNum}>
              <Text style={styles.guideStepNumText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guideStepHead}>
                {locale === 'en' ? 'Smart Link Conversion' : 'Penukaran Pautan Pintar'}
              </Text>
              <Text style={styles.guideStepDesc}>
                {locale === 'en' 
                  ? 'Paste any normal Google Maps link. Risev automatically resolves your Place ID into a direct write-review popup.'
                  : 'Tampal apa jua pautan Google Maps biasa. Risev menukarnya kepada URL borang ulasan 1-klik secara automatik.'}
              </Text>
            </View>
          </View>

          <View style={styles.guideStepRow}>
            <View style={styles.guideStepNum}>
              <Text style={styles.guideStepNumText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guideStepHead}>
                {locale === 'en' ? '5-Star Rating Filter' : 'Penapis Kepuasan Pelanggan'}
              </Text>
              <Text style={styles.guideStepDesc}>
                {locale === 'en'
                  ? 'Only customers who rate 5 stars on their stamp claim are invited to Google, ensuring your public rating skyrockets!'
                  : 'Hanya pelanggan yang memberi 5 bintang pada tuntutan cop akan dijemput ke Google bagi melindungi reputasi kedai anda.'}
              </Text>
            </View>
          </View>

          <View style={styles.guideStepRow}>
            <View style={styles.guideStepNum}>
              <Text style={styles.guideStepNumText}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guideStepHead}>
                {locale === 'en' ? 'Zero Friction Submission' : 'Penghantaran Sepantas Kilat'}
              </Text>
              <Text style={styles.guideStepDesc}>
                {locale === 'en'
                  ? 'The review box opens instantly with 5 stars pre-selected, boosting review completion rates by over 300%.'
                  : 'Kotak ulasan terbuka serta-merta dengan 5 bintang tersedia, meningkatkan kadar selesai ulasan lebih 300%.'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Sticky Save Changes Button ── */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            isSaving && { opacity: 0.7 },
            isSaved && { backgroundColor: '#16A34A', borderColor: '#16A34A' }
          ]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {locale === 'en' ? 'SAVING SETTINGS...' : 'MENYIMPAN...'}
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
                {locale === 'en' ? 'SAVE SETTINGS' : 'SIMPAN TETAPAN'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 90,
    gap: 16,
  },
  // ── Hero Card ──
  heroCard: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 204, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  heroBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
    letterSpacing: 0.3,
  },
  heroSubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  heroSubBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 26,
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#CBD5E1',
    lineHeight: 19,
    marginBottom: 16,
  },
  workflowTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  workflowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workflowIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workflowStepText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#E2E8F0',
  },
  // ── Settings Card ──
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIconSquircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.3,
  },
  cardHeaderSub: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  statusPillResolving: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusPillResolvingText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#2563EB',
  },
  statusPillReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusPillReadyText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  urlInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 50,
  },
  googleIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  urlInput: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    height: '100%',
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 9,
    borderRadius: 11,
  },
  quickActionBtnText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  warningText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#DC2626',
    flex: 1,
    lineHeight: 16,
  },
  // ── Result Card ──
  resultCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    marginTop: 4,
  },
  resultCardPopup: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: 0.2,
  },
  urlDisplayBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  urlDisplayText: {
    fontSize: 11.5,
    fontFamily: 'monospace',
    color: '#334155',
    lineHeight: 16,
  },
  testBtn: {
    flex: 1.5,
    backgroundColor: '#050505',
    paddingVertical: 11,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  testBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
  },
  copyBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 11,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  copyBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  // ── Mockup Preview ──
  mockupContainer: {
    gap: 10,
  },
  mockupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  mockupHeaderLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  googleModalMockup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  mockupStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 16,
  },
  mockupStarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  mockupTextarea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    height: 52,
    justifyContent: 'center',
    marginBottom: 14,
  },
  mockupPostBtn: {
    backgroundColor: '#1A73E8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockupPostBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  // ── Guide ──
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  guideTitle: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.2,
  },
  guideStepRow: {
    flexDirection: 'row',
    gap: 12,
  },
  guideStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStepNumText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
  },
  guideStepHead: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    marginBottom: 2,
  },
  guideStepDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 17,
  },
  // ── Save Button ──
  saveBtn: {
    backgroundColor: '#050505',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
