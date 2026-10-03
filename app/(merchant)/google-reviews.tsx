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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';

export default function GoogleReviewsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

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
    } catch (err) {
      console.log('Error fetching merchant details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoConvertGoogleUrl = async (rawUrl: string) => {
    setGoogleReviewUrl(rawUrl);
    let clean = rawUrl.trim();
    if (!clean) {
      return;
    }

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#050505" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Google Reviews</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FFC700" />
        </View>
      </SafeAreaView>
    );
  }

  const trimmed = googleReviewUrl.trim();
  const isDirectPopup = trimmed.includes('search.google.com/local/writereview') || trimmed.includes('/review');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#050505" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Google Reviews</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

          <View style={{ gap: 12 }}>
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

            {trimmed && !trimmed.startsWith('http') && !trimmed.startsWith('ChIJ') ? (
              <View style={{ gap: 6 }}>
                <TouchableOpacity
                  style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#FDE68A' }}
                  onPress={() => {
                    const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
                    Linking.openURL(mapsSearchUrl).catch(() => Alert.alert('Error', 'Could not open Google Maps'));
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="search" size={14} color="#D97706" />
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>
                    Search "{trimmed}" on Google Maps ↗
                  </Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center' }}>
                  💡 Search your shop, click "Share" on your pin, and paste the link here.
                </Text>
              </View>
            ) : null}

            {googleReviewUrl && (googleReviewUrl.startsWith('http') || googleReviewUrl.startsWith('ChIJ')) ? (
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
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            isSaving && { opacity: 0.7 },
            isSaved && { backgroundColor: '#16A34A', borderColor: '#16A34A' }
          ]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.saveBtnText}>SAVING...</Text>
            </View>
          ) : isSaved ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>SAVED</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>SAVE SETTINGS</Text>
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
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 20,
  },
  urlInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  urlInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    height: '100%',
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  saveBtn: {
    backgroundColor: '#050505',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
