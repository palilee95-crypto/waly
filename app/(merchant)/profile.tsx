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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pocketbase';

const { width } = Dimensions.get('window');

type SettingItemProps = {
  iconName: any;
  title: string;
  subtitle: string;
  onPress?: () => void;
  iconBgColor?: string;
  iconColor?: string;
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

export default function ProfileScreen() {
  const { logout, user, switchRole, updateProfile } = useAuth();
  const router = useRouter();
  const { locale, setLocale, t } = useLanguage();
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

  // WhatsApp connection states
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
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
        Alert.alert(
          locale === 'en' ? 'Error' : 'Ralat', 
          res.message || (locale === 'en' ? 'Failed to generate pairing code.' : 'Gagal menjana kod berpasangan.')
        );
      }
    } catch (err: any) {
      Alert.alert(
        locale === 'en' ? 'Error' : 'Ralat', 
        err?.message || (locale === 'en' ? 'Failed to generate pairing code.' : 'Gagal menjana kod berpasangan.')
      );
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

        // Fetch WhatsApp status only if user is owner
        if (mRec.owner === user.id) {
          fetchWhatsappStatus();
        }

        // Fetch subscription record
        try {
          const subRec = await pb.collection('subscriptions').getFirstListItem(`merchant = "${user.merchant_id}"`);
          setSubscription(subRec);
        } catch (e: any) {
          console.log("No active subscription row found for profile view:", e.message);
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

  const handleOpenEdit = () => {
    setEditStoreName(merchant?.name || user?.name || 'The Coffee House');
    setEditBusinessEmail(merchant?.metadata?.email || merchant?.website || (user as any)?.email || 'hello@thecoffeehouse.my');
    setEditPhoneNumber(merchant?.metadata?.phone || user?.phone || '+60 3-1234 5678');
    setEditMonthlySalesGoal(String(merchant?.metadata?.monthly_sales_goal || '10000'));
    setEditAddress(merchant?.description || 'Lot G-12, Premium Galleries, Persiaran KLCC, 50088 Kuala Lumpur');
    setEditCategory(merchant?.category || 'food');
    setEditLat(String(locationRecord?.lat || '6.2443'));
    setEditLng(String(locationRecord?.lng || '100.4217'));
    setLogoPreview(logoUrl);
    setLogoFile(null);
    const bannerUrl = merchant?.banner 
      ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.banner}`
      : null;
    setBannerPreview(bannerUrl);
    setBannerFile(null);
    setEditModalVisible(true);
  };

  const handlePickImage = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            const img = new window.Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 200;
              const MAX_HEIGHT = 200;
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  setLogoFile(compressedFile);
                  setLogoPreview(URL.createObjectURL(compressedFile));
                }
              }, 'image/jpeg', 0.75);
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert('Not Supported', 'Image upload is currently web-only in this demo.');
    }
  };

  const handlePickBanner = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            const img = new window.Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 600;
              const MAX_HEIGHT = 300;
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_banner.jpg", {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  setBannerFile(compressedFile);
                  setBannerPreview(URL.createObjectURL(compressedFile));
                }
              }, 'image/jpeg', 0.8);
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert('Not Supported', 'Image upload is currently web-only in this demo.');
    }
  };

  const handleSaveProfile = async () => {
    if (!editStoreName.trim()) {
      Alert.alert('Validation Error', 'Store Name is required.');
      return;
    }
    if (!editBusinessEmail.trim()) {
      Alert.alert('Validation Error', 'Business Email is required.');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', editStoreName.trim());
      formData.append('category', editCategory);
      formData.append('description', editAddress.trim());
      
      const updatedMetadata = {
        ...(merchant?.metadata || {}),
        phone: editPhoneNumber.trim(),
        email: editBusinessEmail.trim(),
        monthly_sales_goal: parseFloat(editMonthlySalesGoal) || 10000,
      };
      formData.append('metadata', JSON.stringify(updatedMetadata));

      if (logoFile) {
        formData.append('logo', logoFile);
      }
      if (bannerFile) {
        formData.append('banner', bannerFile);
      }

      const updatedMerchant = await pb.collection('merchants').update(merchant.id, formData);
      setMerchant(updatedMerchant);

      // Sync to store_locations record dynamically
      try {
        const existingLocs = await pb.collection('store_locations').getFullList({
          filter: `merchant = "${merchant.id}"`
        });
        const latVal = parseFloat(editLat) || 0;
        const lngVal = parseFloat(editLng) || 0;
        if (existingLocs.length > 0) {
          const updatedLoc = await pb.collection('store_locations').update(existingLocs[0].id, {
            address: editAddress.trim(),
            phone: editPhoneNumber.trim(),
            lat: latVal,
            lng: lngVal,
          });
          setLocationRecord(updatedLoc);
        } else {
          const newLoc = await pb.collection('store_locations').create({
            merchant: merchant.id,
            name: 'Main Outlet',
            address: editAddress.trim(),
            city: 'Jitra',
            country: 'Malaysia',
            phone: editPhoneNumber.trim(),
            hours: {
              "Monday": "08:00 - 22:00",
              "Tuesday": "08:00 - 22:00",
              "Wednesday": "08:00 - 22:00",
              "Thursday": "08:00 - 22:00",
              "Friday": "08:00 - 22:00",
              "Saturday": "09:00 - 23:00",
              "Sunday": "09:00 - 21:00"
            },
            lat: latVal,
            lng: lngVal,
            is_active: true
          });
          setLocationRecord(newLoc);
        }
      } catch (locErr) {
        console.warn("Failed to sync store location update:", locErr);
      }

      setEditModalVisible(false);
      Alert.alert('Success', 'Store profile updated successfully!');
    } catch (err: any) {
      Alert.alert('Update Error', err.message || 'Failed to update store profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchToCustomer = async () => {
    await switchRole('customer');
    router.replace('/(customer)');
  };

  const handleOpenHoursEdit = () => {
    const hrs = locationRecord?.hours || {};
    
    // Helper to get state values from DB hours JSON
    const getDayInfo = (dayName: string, fallbackTime: string) => {
      let val = hrs[dayName];
      if (val === undefined) {
        val = hrs["Monday - Friday"] || fallbackTime;
      }
      const isClosed = val.toLowerCase() === 'closed';
      return { hoursStr: isClosed ? fallbackTime : val, closedVal: isClosed };
    };

    const mon = getDayInfo("Monday", "08:00 - 22:00");
    setMonHours(mon.hoursStr);
    setMonClosed(mon.closedVal);

    const tue = getDayInfo("Tuesday", "08:00 - 22:00");
    setTueHours(tue.hoursStr);
    setTueClosed(tue.closedVal);

    const wed = getDayInfo("Wednesday", "08:00 - 22:00");
    setWedHours(wed.hoursStr);
    setWedClosed(wed.closedVal);

    const thu = getDayInfo("Thursday", "08:00 - 22:00");
    setThuHours(thu.hoursStr);
    setThuClosed(thu.closedVal);

    const fri = getDayInfo("Friday", "08:00 - 22:00");
    setFriHours(fri.hoursStr);
    setFriClosed(fri.closedVal);

    const sat = getDayInfo("Saturday", "09:00 - 23:00");
    setSatHours(sat.hoursStr);
    setSatClosed(sat.closedVal);

    const sun = getDayInfo("Sunday", "09:00 - 21:00");
    setSunHours(sun.hoursStr);
    setSunClosed(sun.closedVal);

    setHoursModalVisible(true);
  };

  const handleSaveHours = async () => {
    if (!user?.merchant_id) return;
    setIsSavingHours(true);
    try {
      const updatedHours = {
        "Monday": monClosed ? "Closed" : monHours.trim(),
        "Tuesday": tueClosed ? "Closed" : tueHours.trim(),
        "Wednesday": wedClosed ? "Closed" : wedHours.trim(),
        "Thursday": thuClosed ? "Closed" : thuHours.trim(),
        "Friday": friClosed ? "Closed" : friHours.trim(),
        "Saturday": satClosed ? "Closed" : satHours.trim(),
        "Sunday": sunClosed ? "Closed" : sunHours.trim(),
      };

      const existingLocs = await pb.collection('store_locations').getFullList({
        filter: `merchant = "${user.merchant_id}"`
      });

      if (existingLocs.length > 0) {
        const updatedLoc = await pb.collection('store_locations').update(existingLocs[0].id, {
          hours: updatedHours,
        });
        setLocationRecord(updatedLoc);
      } else {
        const newLoc = await pb.collection('store_locations').create({
          merchant: user.merchant_id,
          name: 'Main Outlet',
          address: merchant?.description || '',
          city: 'Jitra',
          country: 'Malaysia',
          phone: merchant?.metadata?.phone || '',
          hours: updatedHours,
          is_active: true
        });
        setLocationRecord(newLoc);
      }
      setHoursModalVisible(false);
      Alert.alert('Success', 'Operating hours updated successfully!');
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Failed to save operating hours.');
    } finally {
      setIsSavingHours(false);
    }
  };

  const renderProfileOperatingHours = () => {
    const hrs = locationRecord?.hours;
    if (!hrs || typeof hrs !== 'object' || Object.keys(hrs).length === 0) {
      return (
        <View style={styles.hoursList}>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursDay}>{t('monday')} - {t('friday')}</Text>
            <Text style={styles.hoursTime}>08:00 - 22:00</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursDay}>{t('saturday')}</Text>
            <Text style={styles.hoursTime}>09:00 - 23:00</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursDay}>{t('sunday')}</Text>
            <Text style={styles.hoursTime}>09:00 - 21:00</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.hoursList}>
        {Object.entries(hrs).map(([day, time]) => {
          const isClosed = String(time).toLowerCase() === 'closed';
          const localizedDay = t(day.toLowerCase());
          const localizedTime = isClosed ? t('closed') : String(time);
          return (
            <View key={day} style={styles.hoursRow}>
              <Text style={styles.hoursDay}>{localizedDay}</Text>
              <Text style={[styles.hoursTime, isClosed && { color: '#EF4444' }]}>{localizedTime}</Text>
            </View>
          );
        })}
      </View>
    );
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
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      <View style={[styles.headerRow, isDesktop && { paddingLeft: 260 }, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }, { justifyContent: 'space-between' }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Ionicons name="cafe" size={16} color="#000000" />
          </View>
          <Text style={styles.headerLogoText}>{t('merchant_portal')}</Text>
        </View>
        <Image
          source={require('../../theme/rise_officiallogo.png')}
          style={{ width: 110, height: 38, resizeMode: 'contain' }}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Intro */}
        <View style={styles.introSection}>
          <Text style={styles.screenTitle}>{t('profile_settings')}</Text>
          <Text style={styles.screenSubtitle}>
            {t('profile_subtitle')}
          </Text>
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
              <Text style={styles.updateBtnText}>{t('update')}</Text>
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
            <Ionicons name="people-outline" size={24} color="#000000" />
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

        {/* Operating Hours Card */}
        <TouchableOpacity style={styles.hoursCard} onPress={handleOpenHoursEdit} activeOpacity={0.95}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={styles.hoursHeader}>
              <Ionicons name="time-outline" size={20} color="#D97706" />
              <Text style={styles.hoursTitle}>{t('operating_hours')}</Text>
            </View>
            <Ionicons name="create-outline" size={18} color="#64748B" />
          </View>

          {renderProfileOperatingHours()}
        </TouchableOpacity>

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
                iconColor="#000000"
                onPress={() => router.push('/(merchant)/staff' as any)}
              />
              <SettingItem
                iconName="logo-whatsapp"
                title={t('link_whatsapp')}
                subtitle={
                  whatsappStatus === 'connected'
                    ? `${locale === 'en' ? 'Connected' : 'Disambung'}: ${whatsappPhone || ''} (${locale === 'en' ? 'Tap to manage' : 'Ketik untuk urus'})`
                    : whatsappStatus === 'checking'
                      ? t('whatsapp_checking')
                      : t('link_whatsapp_desc')
                }
                iconBgColor="#E8F5E9"
                iconColor="#25D366"
                onPress={handleWhatsappPress}
              />
              <SettingItem
                iconName="gift-outline"
                title={t('manage_rewards')}
                subtitle={t('manage_rewards_desc')}
                iconBgColor="#FFF3E0"
                iconColor="#FF9800"
                onPress={() => router.push('/(merchant)/rewards' as any)}
              />
            </>
          )}
          <SettingItem
            iconName="notifications-outline"
            title={t('notifications')}
            subtitle={t('notifications_desc')}
            iconBgColor="#F1F5F9"
            iconColor="#000000"
          />
          <SettingItem
            iconName="shield-checkmark-outline"
            title={t('security')}
            subtitle={t('security_desc')}
            iconBgColor="#F1F5F9"
            iconColor="#000000"
            onPress={() => setPasswordModalVisible(true)}
          />
          <SettingItem
            iconName="globe-outline"
            title={t('language')}
            subtitle={locale === 'en' ? 'English' : 'Bahasa Melayu'}
            iconBgColor="#F1F5F9"
            iconColor="#000000"
            onPress={() => setLanguageModalVisible(true)}
          />
          <SettingItem
            iconName="card-outline"
            title={t('payment_method')}
            subtitle={t('payment_method_desc')}
            iconBgColor="#F1F5F9"
            iconColor="#000000"
          />
          <SettingItem
            iconName="document-text-outline"
            title={t('privacy_policy')}
            subtitle={t('privacy_policy_desc')}
            iconBgColor="#F1F5F9"
            iconColor="#000000"
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
                style={[styles.modalConfirmBtn, { flex: 1, backgroundColor: '#000000' }]}
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
                <ActivityIndicator size="large" color="#000000" />
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
                    backgroundColor: '#000000',
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

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 }}>
                  <ActivityIndicator size="small" color="#10B981" />
                  <Text style={{ fontSize: 12, color: '#047857', fontFamily: 'PlusJakartaSans_700Bold' }}>
                    {locale === 'en' ? 'Waiting for device linking...' : 'Menunggu pautan peranti...'}
                  </Text>
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

      {/* Custom Premium Edit Store Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.editModalCard, { maxHeight: '90%' }]}>
            <Text style={[styles.modalTitle, { marginBottom: 12 }]}>{t('edit_store_profile')}</Text>
            
            <ScrollView 
              style={{ width: '100%' }} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ width: '100%', alignItems: 'stretch', paddingBottom: 16 }}
            >
              {/* Logo Picker */}
              <View style={{ alignItems: 'center', width: '100%', marginVertical: 8 }}>
                <TouchableOpacity style={styles.avatarPickerContainer} onPress={handlePickImage} activeOpacity={0.85}>
                  <Image source={{ uri: logoPreview || logoUrl }} style={styles.avatarPickerImage} />
                  <View style={styles.avatarPencilIcon}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.avatarPickerLabel}>{t('tap_logo_upload')}</Text>
              </View>

              {/* Background Banner Picker */}
              <View style={{ width: '100%', marginVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', alignSelf: 'flex-start', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {locale === 'en' ? 'Background Banner' : 'Banner Latar Belakang'}
                </Text>
                
                <TouchableOpacity 
                  style={{
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
                  }} 
                  onPress={handlePickBanner} 
                  activeOpacity={0.85}
                >
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

                {/* Tooltip Description */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 4 }}>
                  <Ionicons name="information-circle-outline" size={13} color="#64748B" />
                  <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
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
                  value={editStoreName}
                  onChangeText={setEditStoreName}
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
                  value={editBusinessEmail}
                  onChangeText={setEditBusinessEmail}
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
                  value={editPhoneNumber}
                  onChangeText={setEditPhoneNumber}
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
                  value={editMonthlySalesGoal}
                  onChangeText={setEditMonthlySalesGoal}
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
                        editCategory === cat.id && styles.categoryChipActive,
                      ]}
                      onPress={() => setEditCategory(cat.id as any)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        editCategory === cat.id && styles.categoryChipTextActive
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
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholder={t('address')}
                  placeholderTextColor="#94A3B8"
                  {...Platform.select({
                    web: { outlineStyle: 'none' } as any,
                  })}
                />
              </View>

              {/* Coordinates & Map Pin */}
              <Text style={[styles.sectionLabel, { marginTop: 12, marginBottom: 4 }]}>{t('map_location_coords')}</Text>
              <View style={styles.hoursInputsRow}>
                <View style={[styles.inputContainer, { flex: 1, marginVertical: 0 }]}>
                  <Text style={[styles.inputLabel, { fontSize: 10 }]}>{t('latitude')}</Text>
                  <TextInput
                    style={[styles.textInput, { fontSize: 12, paddingHorizontal: 8, paddingVertical: 6 }]}
                    value={editLat}
                    onChangeText={setEditLat}
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
                    value={editLng}
                    onChangeText={setEditLng}
                    placeholder="e.g. 100.4217"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    {...Platform.select({
                      web: { outlineStyle: 'none' } as any,
                    })}
                  />
                </View>
              </View>

              {/* Leaflet Map Div (Web Only) */}
              {Platform.OS === 'web' && (
                <View style={{ width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', marginTop: 8, borderWidth: 1.5, borderColor: '#E2E8F0' }}>
                  <div id="store-edit-map" style={{ width: '100%', height: '100%' }} />
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtnBlack}
                onPress={handleSaveProfile}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Operating Hours Modal */}
      <Modal
        visible={hoursModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHoursModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.editModalCard]}>
            <Text style={[styles.modalTitle, { marginBottom: 12 }]}>{t('edit_operating_hours')}</Text>

            <ScrollView 
              style={{ width: '100%', maxHeight: 320 }} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 4 }}
            >
              {/* Monday Row */}
              <View style={styles.hoursEditRow}>
                <View style={styles.hoursDayHeader}>
                  <Text style={styles.hoursDayLabel}>{t('monday')}</Text>
                  <View style={styles.closedToggleRow}>
                    <Text style={styles.closedToggleText}>{t('closed')}</Text>
                    <Switch
                      value={monClosed}
                      onValueChange={setMonClosed}
                      trackColor={{ false: '#CBD5E1', true: '#000000' }}
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

              {/* Tuesday Row */}
              <View style={styles.hoursEditRow}>
                <View style={styles.hoursDayHeader}>
                  <Text style={styles.hoursDayLabel}>{t('tuesday')}</Text>
                  <View style={styles.closedToggleRow}>
                    <Text style={styles.closedToggleText}>{t('closed')}</Text>
                    <Switch
                      value={tueClosed}
                      onValueChange={setTueClosed}
                      trackColor={{ false: '#CBD5E1', true: '#000000' }}
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

              {/* Wednesday Row */}
              <View style={styles.hoursEditRow}>
                <View style={styles.hoursDayHeader}>
                  <Text style={styles.hoursDayLabel}>{t('wednesday')}</Text>
                  <View style={styles.closedToggleRow}>
                    <Text style={styles.closedToggleText}>{t('closed')}</Text>
                    <Switch
                      value={wedClosed}
                      onValueChange={setWedClosed}
                      trackColor={{ false: '#CBD5E1', true: '#000000' }}
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

              {/* Thursday Row */}
              <View style={styles.hoursEditRow}>
                <View style={styles.hoursDayHeader}>
                  <Text style={styles.hoursDayLabel}>{t('thursday')}</Text>
                  <View style={styles.closedToggleRow}>
                    <Text style={styles.closedToggleText}>{t('closed')}</Text>
                    <Switch
                      value={thuClosed}
                      onValueChange={setThuClosed}
                      trackColor={{ false: '#CBD5E1', true: '#000000' }}
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

              {/* Friday Row */}
              <View style={styles.hoursEditRow}>
                <View style={styles.hoursDayHeader}>
                  <Text style={styles.hoursDayLabel}>{t('friday')}</Text>
                  <View style={styles.closedToggleRow}>
                    <Text style={styles.closedToggleText}>{t('closed')}</Text>
                    <Switch
                      value={friClosed}
                      onValueChange={setFriClosed}
                      trackColor={{ false: '#CBD5E1', true: '#000000' }}
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

              {/* Saturday Row */}
              <View style={styles.hoursEditRow}>
                <View style={styles.hoursDayHeader}>
                  <Text style={styles.hoursDayLabel}>{t('saturday')}</Text>
                  <View style={styles.closedToggleRow}>
                    <Text style={styles.closedToggleText}>{t('closed')}</Text>
                    <Switch
                      value={satClosed}
                      onValueChange={setSatClosed}
                      trackColor={{ false: '#CBD5E1', true: '#000000' }}
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

              {/* Sunday Row */}
              <View style={styles.hoursEditRow}>
                <View style={styles.hoursDayHeader}>
                  <Text style={styles.hoursDayLabel}>{t('sunday')}</Text>
                  <View style={styles.closedToggleRow}>
                    <Text style={styles.closedToggleText}>{t('closed')}</Text>
                    <Switch
                      value={sunClosed}
                      onValueChange={setSunClosed}
                      trackColor={{ false: '#CBD5E1', true: '#000000' }}
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
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setHoursModalVisible(false)}
                disabled={isSavingHours}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtnBlack}
                onPress={handleSaveHours}
                disabled={isSavingHours}
                activeOpacity={0.8}
              >
                {isSavingHours ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('save')}</Text>
                )}
              </TouchableOpacity>
            </View>
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
              {locale === 'en' && <Ionicons name="checkmark-circle" size={20} color="#000000" />}
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
              {locale === 'ms' && <Ionicons name="checkmark-circle" size={20} color="#000000" />}
            </TouchableOpacity>
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
    backgroundColor: '#FFFFFF', // Clean White Background
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    paddingBottom: 48,
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
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
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
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#3B82F6',
  },
  trialBadge: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trialBadgeText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
  },
  expiredBadge: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  expiredBadgeText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#EF4444',
  },
  locationText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#737686',
  },
  updateBtn: {
    borderWidth: 1,
    borderColor: '#000000', // Black borders
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  updateBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000', // Black label
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
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0b1c30',
    lineHeight: 18,
  },
  hoursCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 16,
  },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hoursTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
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
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#565e74',
  },
  hoursTime: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  sectionHeader: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
    marginTop: 8,
  },
  settingsGrid: {
    gap: 12,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#000000',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
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
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  switchSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    height: 44,
    borderRadius: 12,
    gap: 8,
  },
  switchButtonText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
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
    shadowColor: '#000000',
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
    backgroundColor: '#000000',
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
    borderColor: '#000000',
    backgroundColor: '#F1F5F9',
  },
  categoryChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  categoryChipTextActive: {
    color: '#000000',
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
    color: '#000000',
    backgroundColor: '#F8FAFC',
    width: '100%',
  },
  modalConfirmBtnBlack: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#000000',
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
    borderColor: '#000000',
    backgroundColor: '#F8FAFC',
  },
  languageOptionText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0b1c30',
  },
  languageOptionTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
});
