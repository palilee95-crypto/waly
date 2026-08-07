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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';
import * as ImagePicker from 'expo-image-picker';

export default function EditProfileScreen() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [merchant, setMerchant] = useState<any>(null);
  const [locationRecord, setLocationRecord] = useState<any>(null);

  // Form States
  const [storeName, setStoreName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [monthlySalesGoal, setMonthlySalesGoal] = useState('10000');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<'food' | 'retail' | 'beauty' | 'health' | 'entertainment' | 'other'>('food');
  const [lat, setLat] = useState('6.2443');
  const [lng, setLng] = useState('100.4217');

  // Media
  const [logoFile, setLogoFile] = useState<any>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<any>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Operating Hours
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

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    if (!user?.merchant_id) return;
    try {
      setLoading(true);
      // 1. Fetch merchant
      const mRec = await pb.collection('merchants').getOne(user.merchant_id);
      setMerchant(mRec);

      // Populate merchant fields
      setStoreName(mRec.name || '');
      setBusinessEmail(mRec.metadata?.email || mRec.website || user.email || '');
      setPhoneNumber(mRec.metadata?.phone || user.phone || '');
      setMonthlySalesGoal(String(mRec.metadata?.monthly_sales_goal || '10000'));
      setAddress(mRec.description || '');
      setCategory(mRec.category || 'food');

      const logoUrl = mRec.logo 
        ? `${pb.baseUrl}/api/files/merchants/${mRec.id}/${mRec.logo}`
        : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200';
      setLogoPreview(logoUrl);

      const bannerUrl = mRec.banner 
        ? `${pb.baseUrl}/api/files/merchants/${mRec.id}/${mRec.banner}`
        : null;
      setBannerPreview(bannerUrl);

      // 2. Fetch location
      const locList = await pb.collection('store_locations').getFullList({
        filter: `merchant = "${user.merchant_id}"`
      });

      if (locList.length > 0) {
        const loc = locList[0];
        setLocationRecord(loc);
        setLat(String(loc.lat || '6.2443'));
        setLng(String(loc.lng || '100.4217'));

        // Parse hours
        const hours = loc.hours || {};
        const parseDay = (day: string, defaultVal: string) => {
          const val = hours[day] || defaultVal;
          return {
            closedVal: val === 'Closed',
            hoursStr: val === 'Closed' ? defaultVal : val,
          };
        };

        const mon = parseDay('Monday', '08:00 - 22:00');
        setMonHours(mon.hoursStr);
        setMonClosed(mon.closedVal);

        const tue = parseDay('Tuesday', '08:00 - 22:00');
        setTueHours(tue.hoursStr);
        setTueClosed(tue.closedVal);

        const wed = parseDay('Wednesday', '08:00 - 22:00');
        setWedHours(wed.hoursStr);
        setWedClosed(wed.closedVal);

        const thu = parseDay('Thursday', '08:00 - 22:00');
        setThuHours(thu.hoursStr);
        setThuClosed(thu.closedVal);

        const fri = parseDay('Friday', '08:00 - 22:00');
        setFriHours(fri.hoursStr);
        setFriClosed(fri.closedVal);

        const sat = parseDay('Saturday', '09:00 - 23:00');
        setSatHours(sat.hoursStr);
        setSatClosed(sat.closedVal);

        const sun = parseDay('Sunday', '09:00 - 21:00');
        setSunHours(sun.hoursStr);
        setSunClosed(sun.closedVal);
      }
    } catch (err) {
      console.warn("Failed to load profile data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selected = result.assets[0];
        setLogoPreview(selected.uri);
        
        // Convert URI to form data file object
        const uriParts = selected.uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        setLogoFile({
          uri: selected.uri,
          name: `logo.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick store logo.');
    }
  };

  const handlePickBanner = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selected = result.assets[0];
        setBannerPreview(selected.uri);
        
        const uriParts = selected.uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        setBannerFile({
          uri: selected.uri,
          name: `banner.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick background banner.');
    }
  };

  const handleSave = async () => {
    if (!storeName.trim()) {
      Alert.alert('Validation Error', 'Store Name is required.');
      return;
    }
    if (!businessEmail.trim()) {
      Alert.alert('Validation Error', 'Business Email is required.');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', storeName.trim());
      formData.append('category', category);
      formData.append('description', address.trim());
      
      const updatedMetadata = {
        ...(merchant?.metadata || {}),
        phone: phoneNumber.trim(),
        email: businessEmail.trim(),
        monthly_sales_goal: parseFloat(monthlySalesGoal) || 10000,
      };
      formData.append('metadata', JSON.stringify(updatedMetadata));

      if (logoFile) {
        formData.append('logo', logoFile);
      }
      if (bannerFile) {
        formData.append('banner', bannerFile);
      }

      const updatedMerchant = await pb.collection('merchants').update(merchant.id, formData);

      // Sync locations and hours
      const latVal = parseFloat(lat) || 0;
      const lngVal = parseFloat(lng) || 0;

      const updatedHours = {
        "Monday": monClosed ? "Closed" : monHours.trim(),
        "Tuesday": tueClosed ? "Closed" : tueHours.trim(),
        "Wednesday": wedClosed ? "Closed" : wedHours.trim(),
        "Thursday": thuClosed ? "Closed" : thuHours.trim(),
        "Friday": friClosed ? "Closed" : friHours.trim(),
        "Saturday": satClosed ? "Closed" : satHours.trim(),
        "Sunday": sunClosed ? "Closed" : sunHours.trim(),
      };

      if (locationRecord) {
        await pb.collection('store_locations').update(locationRecord.id, {
          address: address.trim(),
          phone: phoneNumber.trim(),
          lat: latVal,
          lng: lngVal,
          hours: updatedHours,
        });
      } else {
        await pb.collection('store_locations').create({
          merchant: merchant.id,
          name: 'Main Outlet',
          address: address.trim(),
          city: 'Jitra',
          country: 'Malaysia',
          phone: phoneNumber.trim(),
          hours: updatedHours,
          lat: latVal,
          lng: lngVal,
          is_active: true
        });
      }

      Alert.alert('Success', 'Store profile and operating hours updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Failed to update store profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFC700" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Custom Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#050505" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('edit_store_profile')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Logo Picker */}
        <View style={{ alignItems: 'center', width: '100%', marginVertical: 8 }}>
          <TouchableOpacity style={styles.avatarPickerContainer} onPress={handlePickImage} activeOpacity={0.85}>
            {logoPreview ? (
              <Image source={{ uri: logoPreview }} style={styles.avatarPickerImage} />
            ) : (
              <View style={[styles.avatarPickerImage, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="storefront-outline" size={32} color="#94A3B8" />
              </View>
            )}
            <View style={styles.avatarPencilIcon}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarPickerLabel}>{t('tap_logo_upload')}</Text>
        </View>

        {/* Background Banner Picker */}
        <View style={{ width: '100%', marginVertical: 12, alignItems: 'center' }}>
          <Text style={styles.sectionTitleLabel}>
            {locale === 'en' ? 'Background Banner' : 'Banner Latar Belakang'}
          </Text>
          
          <TouchableOpacity style={styles.bannerPickerContainer} onPress={handlePickBanner} activeOpacity={0.85}>
            {bannerPreview ? (
              <Image source={{ uri: bannerPreview }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Ionicons name="image-outline" size={28} color="#94A3B8" />
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                  {locale === 'en' ? 'Tap to upload background banner' : 'Ketik untuk memuat naik banner'}
                </Text>
              </View>
            )}
            <View style={[styles.avatarPencilIcon, { top: 8, right: 8, bottom: undefined }]}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={13} color="#64748B" />
            <Text style={styles.infoText}>
              {locale === 'en' 
                ? 'This image will be displayed as the background banner in customer explore.' 
                : 'Imej ini akan dipaparkan sebagai banner latar belakang dalam carian pelanggan.'}
            </Text>
          </View>
        </View>

        {/* Store Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('store_name')}</Text>
          <TextInput
            style={styles.textInput}
            value={storeName}
            onChangeText={setStoreName}
            placeholder="Enter store name"
            placeholderTextColor="#94A3B8"
            {...Platform.select({
              web: { outlineStyle: 'none' } as any,
            })}
          />
        </View>

        {/* Business Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('business_email')}</Text>
          <TextInput
            style={styles.textInput}
            value={businessEmail}
            onChangeText={setBusinessEmail}
            placeholder={t('business_email')}
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            keyboardType="email-address"
            {...Platform.select({
              web: { outlineStyle: 'none' } as any,
            })}
          />
        </View>

        {/* Phone Number Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('phone_number')}</Text>
          <TextInput
            style={styles.textInput}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder={t('phone_number')}
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            {...Platform.select({
              web: { outlineStyle: 'none' } as any,
            })}
          />
        </View>

        {/* Monthly Sales Goal Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('monthly_sales_goal')}</Text>
          <TextInput
            style={styles.textInput}
            value={monthlySalesGoal}
            onChangeText={setMonthlySalesGoal}
            placeholder="e.g. 10000"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            {...Platform.select({
              web: { outlineStyle: 'none' } as any,
            })}
          />
        </View>

        {/* Category Selector Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('store_category')}</Text>
          <View style={styles.categoryChipsRow}>
            {[
              { id: 'food' },
              { id: 'retail' },
              { id: 'beauty' },
              { id: 'health' },
              { id: 'entertainment' },
              { id: 'other' },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  category === cat.id && styles.categoryChipActive,
                ]}
                onPress={() => setCategory(cat.id as any)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.categoryChipText,
                  category === cat.id && styles.categoryChipTextActive
                ]}>
                  {t(cat.id)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Address Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('address')}</Text>
          <TextInput
            style={styles.textInput}
            value={address}
            onChangeText={setAddress}
            placeholder={t('address')}
            placeholderTextColor="#94A3B8"
            {...Platform.select({
              web: { outlineStyle: 'none' } as any,
            })}
          />
        </View>

        {/* Daily Operating Hours Section */}
        <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 8 }]}>{t('operating_hours')}</Text>
        
        {/* Monday */}
        <View style={styles.hoursEditRow}>
          <View style={styles.hoursDayHeader}>
            <Text style={styles.hoursDayLabel}>{t('monday')}</Text>
            <View style={styles.closedToggleRow}>
              <Text style={styles.closedToggleText}>{t('closed')}</Text>
              <Switch
                value={monClosed}
                onValueChange={setMonClosed}
                trackColor={{ false: '#CBD5E1', true: '#050505' }}
                thumbColor={monClosed ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>
          </View>
          {!monClosed ? (
            <TextInput
              style={styles.textInput}
              value={monHours}
              onChangeText={setMonHours}
              placeholder="08:00 - 22:00"
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          ) : (
            <View style={[styles.textInput, styles.disabledInput]}>
              <Text style={styles.disabledInputText}>{t('closed')}</Text>
            </View>
          )}
        </View>

        {/* Tuesday */}
        <View style={styles.hoursEditRow}>
          <View style={styles.hoursDayHeader}>
            <Text style={styles.hoursDayLabel}>{t('tuesday')}</Text>
            <View style={styles.closedToggleRow}>
              <Text style={styles.closedToggleText}>{t('closed')}</Text>
              <Switch
                value={tueClosed}
                onValueChange={setTueClosed}
                trackColor={{ false: '#CBD5E1', true: '#050505' }}
                thumbColor={tueClosed ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>
          </View>
          {!tueClosed ? (
            <TextInput
              style={styles.textInput}
              value={tueHours}
              onChangeText={setTueHours}
              placeholder="08:00 - 22:00"
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          ) : (
            <View style={[styles.textInput, styles.disabledInput]}>
              <Text style={styles.disabledInputText}>{t('closed')}</Text>
            </View>
          )}
        </View>

        {/* Wednesday */}
        <View style={styles.hoursEditRow}>
          <View style={styles.hoursDayHeader}>
            <Text style={styles.hoursDayLabel}>{t('wednesday')}</Text>
            <View style={styles.closedToggleRow}>
              <Text style={styles.closedToggleText}>{t('closed')}</Text>
              <Switch
                value={wedClosed}
                onValueChange={setWedClosed}
                trackColor={{ false: '#CBD5E1', true: '#050505' }}
                thumbColor={wedClosed ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>
          </View>
          {!wedClosed ? (
            <TextInput
              style={styles.textInput}
              value={wedHours}
              onChangeText={setWedHours}
              placeholder="08:00 - 22:00"
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          ) : (
            <View style={[styles.textInput, styles.disabledInput]}>
              <Text style={styles.disabledInputText}>{t('closed')}</Text>
            </View>
          )}
        </View>

        {/* Thursday */}
        <View style={styles.hoursEditRow}>
          <View style={styles.hoursDayHeader}>
            <Text style={styles.hoursDayLabel}>{t('thursday')}</Text>
            <View style={styles.closedToggleRow}>
              <Text style={styles.closedToggleText}>{t('closed')}</Text>
              <Switch
                value={thuClosed}
                onValueChange={setThuClosed}
                trackColor={{ false: '#CBD5E1', true: '#050505' }}
                thumbColor={thuClosed ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>
          </View>
          {!thuClosed ? (
            <TextInput
              style={styles.textInput}
              value={thuHours}
              onChangeText={setThuHours}
              placeholder="08:00 - 22:00"
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          ) : (
            <View style={[styles.textInput, styles.disabledInput]}>
              <Text style={styles.disabledInputText}>{t('closed')}</Text>
            </View>
          )}
        </View>

        {/* Friday */}
        <View style={styles.hoursEditRow}>
          <View style={styles.hoursDayHeader}>
            <Text style={styles.hoursDayLabel}>{t('friday')}</Text>
            <View style={styles.closedToggleRow}>
              <Text style={styles.closedToggleText}>{t('closed')}</Text>
              <Switch
                value={friClosed}
                onValueChange={setFriClosed}
                trackColor={{ false: '#CBD5E1', true: '#050505' }}
                thumbColor={friClosed ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>
          </View>
          {!friClosed ? (
            <TextInput
              style={styles.textInput}
              value={friHours}
              onChangeText={setFriHours}
              placeholder="08:00 - 22:00"
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          ) : (
            <View style={[styles.textInput, styles.disabledInput]}>
              <Text style={styles.disabledInputText}>{t('closed')}</Text>
            </View>
          )}
        </View>

        {/* Saturday */}
        <View style={styles.hoursEditRow}>
          <View style={styles.hoursDayHeader}>
            <Text style={styles.hoursDayLabel}>{t('saturday')}</Text>
            <View style={styles.closedToggleRow}>
              <Text style={styles.closedToggleText}>{t('closed')}</Text>
              <Switch
                value={satClosed}
                onValueChange={setSatClosed}
                trackColor={{ false: '#CBD5E1', true: '#050505' }}
                thumbColor={satClosed ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>
          </View>
          {!satClosed ? (
            <TextInput
              style={styles.textInput}
              value={satHours}
              onChangeText={setSatHours}
              placeholder="09:00 - 23:00"
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          ) : (
            <View style={[styles.textInput, styles.disabledInput]}>
              <Text style={styles.disabledInputText}>{t('closed')}</Text>
            </View>
          )}
        </View>

        {/* Sunday */}
        <View style={styles.hoursEditRow}>
          <View style={styles.hoursDayHeader}>
            <Text style={styles.hoursDayLabel}>{t('sunday')}</Text>
            <View style={styles.closedToggleRow}>
              <Text style={styles.closedToggleText}>{t('closed')}</Text>
              <Switch
                value={sunClosed}
                onValueChange={setSunClosed}
                trackColor={{ false: '#CBD5E1', true: '#050505' }}
                thumbColor={sunClosed ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>
          </View>
          {!sunClosed ? (
            <TextInput
              style={styles.textInput}
              value={sunHours}
              onChangeText={setSunHours}
              placeholder="09:00 - 21:00"
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          ) : (
            <View style={[styles.textInput, styles.disabledInput]}>
              <Text style={styles.disabledInputText}>{t('closed')}</Text>
            </View>
          )}
        </View>

        {/* Coordinates & Map Pin */}
        <Text style={[styles.sectionLabel, { marginTop: 12, marginBottom: 4 }]}>{t('map_location_coords')}</Text>
        <View style={styles.hoursInputsRow}>
          <View style={[styles.inputContainer, { flex: 1, marginVertical: 0 }]}>
            <Text style={[styles.inputLabel, { fontSize: 10 }]}>{t('latitude')}</Text>
            <TextInput
              style={[styles.textInput, { fontSize: 12, paddingHorizontal: 8, paddingVertical: 6 }]}
              value={lat}
              onChangeText={setLat}
              placeholder="e.g. 6.2443"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          </View>
          <View style={[styles.inputContainer, { flex: 1, marginLeft: 8, marginVertical: 0 }]}>
            <Text style={[styles.inputLabel, { fontSize: 10 }]}>{t('longitude')}</Text>
            <TextInput
              style={[styles.textInput, { fontSize: 12, paddingHorizontal: 8, paddingVertical: 6 }]}
              value={lng}
              onChangeText={setLng}
              placeholder="e.g. 100.4217"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={isSaving}>
            <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#050505" />
            ) : (
              <Text style={styles.saveBtnText}>{t('save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarPickerContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#FFC700',
    overflow: 'visible',
  },
  avatarPickerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  avatarPencilIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFC700',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPickerLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 8,
  },
  sectionTitleLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    alignSelf: 'flex-start',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bannerPickerContainer: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    flex: 1,
  },
  inputContainer: {
    width: '100%',
    marginVertical: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#F1F5F9',
  },
  categoryChipActive: {
    backgroundColor: '#FFC700',
  },
  categoryChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#050505',
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hoursEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#F8FAFC',
  },
  hoursDayHeader: {
    flex: 1,
    marginRight: 16,
  },
  hoursDayLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    marginBottom: 4,
  },
  closedToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  closedToggleText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  disabledInput: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    justifyContent: 'center',
  },
  disabledInputText: {
    color: '#94A3B8',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  hoursInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  saveBtn: {
    flex: 1.5,
    backgroundColor: '#FFC700',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#050505',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
