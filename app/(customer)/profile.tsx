import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Platform, Alert, Modal, TextInput, ActivityIndicator, Linking, useWindowDimensions, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { colors } from '@/theme';

export default function CustomerProfile() {
  const { user, logout, switchRole, updateProfile, refreshSession } = useAuth();
  const router = useRouter();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [avatarFile, setAvatarFile] = useState<any>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [supportFocused, setSupportFocused] = useState(false);

  const [subscribeModalVisible, setSubscribeModalVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const [optInMarketing, setOptInMarketing] = useState(true);

  React.useEffect(() => {
    if (!user) return;
    pb.collection('loyalty_cards')
      .getFullList({ filter: `customer = '${user.id}'` })
      .then((cards) => {
        const hasOptedOut = cards.some((c: any) => c.opt_in_marketing === false);
        setOptInMarketing(!hasOptedOut);
      })
      .catch(() => {});
  }, [user]);

  const handleToggleMarketing = async (value: boolean) => {
    if (!user) return;
    setOptInMarketing(value);
    try {
      const cards = await pb.collection('loyalty_cards').getFullList({ filter: `customer = '${user.id}'` });
      await Promise.all(cards.map((c: any) => 
        pb.collection('loyalty_cards').update(c.id, { opt_in_marketing: value })
      ));
    } catch (err) {
      console.warn("Failed to update marketing preference:", err);
    }
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    await logout();
    router.replace('/(auth)/login');
  };

  const handleSwitchToMerchant = async () => {
    if ((user?.role === 'merchant' || (user?.role as any) === 'both') && user?.merchant_id) {
      await switchRole('merchant');
      router.replace('/(merchant)');
    } else {
      setSubscribeModalVisible(true);
    }
  };

  const handleSubscribe = async () => {
    if (!user) return;
    setIsSubscribing(true);
    try {
      // 1. Simulate webhook/payment ID generation
      const paymentId = 'chipin_' + Math.random().toString(36).substring(2, 10);
      
      // 2. Create active merchant record in database
      const newMerchant = await pb.collection('merchants').create({
        name: `${user.name}'s Shop`,
        owner: user.id,
        category: 'food',
        status: 'active',
      });

      // 3. Link merchant profile to user and change role to merchant
      await pb.collection('users').update(user.id, {
        role: 'merchant',
        merchant_id: newMerchant.id,
      });

      // 4. Create active subscription record in database for history logging
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);
      const periodEndStr = periodEnd.toISOString().replace('T', ' ').substring(0, 19);

      await pb.collection('subscriptions').create({
        merchant: newMerchant.id,
        status: 'active',
        plan: 'pro',
        chipin_payment_id: paymentId,
        chipin_customer_email: (user.phone || 'merchant') + '@risev.app',
        current_period_end: periodEndStr,
        cancel_at_period_end: false,
      });

      // 5. Refresh local authStore session to align updated records
      await refreshSession();

      // 6. Switch role locally
      await switchRole('merchant');
      
      Alert.alert('Subscription Active', 'Welcome to RISEV Merchant Pro! Your shop console is now active.');
      setSubscribeModalVisible(false);
      router.replace('/(merchant)');
    } catch (err: any) {
      Alert.alert('Subscription Error', err.message || 'Payment processing failed.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleOpenEdit = () => {
    setEditName(user?.name || '');
    setEditPassword('');
    setEditConfirmPassword('');
    setAvatarPreview(avatarUrl);
    setAvatarFile(null);
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
          // Client-side compression and resizing using Canvas
          const reader = new FileReader();
          reader.onload = (event: any) => {
            const img = new window.Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 200;
              const MAX_HEIGHT = 200;
              let width = img.width;
              let height = img.height;

              // Calculate new dimensions maintaining aspect ratio
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
                  // Re-wrap blob into a File object with optimized JPEG compression
                  const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  setAvatarFile(compressedFile);
                  setAvatarPreview(URL.createObjectURL(compressedFile));
                }
              }, 'image/jpeg', 0.75); // 75% quality JPEG
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
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }

    if (editPassword) {
      if (editPassword.length < 8) {
        Alert.alert('Validation Error', 'Password must be at least 8 characters long.');
        return;
      }
      if (editPassword !== editConfirmPassword) {
        Alert.alert('Validation Error', 'Passwords do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      await updateProfile(
        editName.trim(), 
        avatarFile, 
        editPassword ? editPassword : undefined, 
        editPassword ? editConfirmPassword : undefined
      );
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (e: any) {
      Alert.alert('Update Error', e?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendSupport = () => {
    if (!supportMessage.trim()) {
      Alert.alert('Validation Error', 'Please enter a message to support.');
      return;
    }
    setIsSendingSupport(true);
    setTimeout(() => {
      setIsSendingSupport(false);
      setSupportMessage('');
      setSupportModalVisible(false);
      Alert.alert('Support Request Sent', 'Thank you! RISEV support team has received your message and will respond shortly.');
    }, 1200);
  };

  const handleWhatsAppSupport = () => {
    Linking.openURL('https://wa.me/601153300472').catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp.');
    });
  };

  const avatarUrl = user?.avatar
    ? `${pb.baseUrl}/api/files/_pb_users_auth_/${user.id}/${user.avatar}`
    : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
        {/* Top Header Row */}
        <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatarMini}
          />
          
          <Image
            source={require('../../theme/rise_officiallogo.png')}
            style={{ width: 90, height: 32, resizeMode: 'contain' }}
          />

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.roundHeaderBtn} onPress={() => router.push('/(customer)/explore')}>
              <Ionicons name="compass-outline" size={18} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundHeaderBtn}>
              <Ionicons name="notifications-outline" size={18} color="#000000" />
              <View style={styles.badgeDot} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro Section */}
          <View style={styles.introSection}>
            <Text style={styles.title}>My Profile</Text>
            <Text style={styles.subtitle}>
              Manage your personal information, settings, and partner merchant credentials.
            </Text>
          </View>

          {/* User Profile Card */}
          <View style={styles.profileCard}>
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarLarge}
            />
            <View style={styles.userInfo}>
              <Text style={styles.name}>{user?.name || 'Ahmad Fazli'}</Text>
              <Text style={styles.phone}>{user?.phone || '+60 12-345 6789'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <View style={styles.memberBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#000000" />
                  <Text style={styles.memberBadgeText}>{(user?.tier || 'BRONZE').toUpperCase()} MEMBER</Text>
                </View>
                <View style={[styles.memberBadge, { marginLeft: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                  <Ionicons name="star" size={12} color="#EAB308" />
                  <Text style={[styles.memberBadgeText, { color: '#854D0E' }]}>{user?.total_points || 0} PTS</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Switch Role Card (Matches new payment/topup mockup visual weight) */}
          <View style={styles.switchCard}>
            <View style={styles.switchHeader}>
              <Ionicons name="storefront-outline" size={24} color="#000000" />
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Business Owner?</Text>
                <Text style={styles.switchSubtitle}>Switch to merchant console to scan stamps and manage reward plans.</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.switchButton} onPress={handleSwitchToMerchant} activeOpacity={0.8}>
              <Text style={styles.switchButtonText}>Switch to Merchant Mode</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Menu Options List */}
          <View style={styles.menuList}>
            <Text style={styles.menuSectionHeader}>Account Settings</Text>
            
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleOpenEdit}>
              <View style={styles.menuItemLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="person-outline" size={18} color="#000000" />
                </View>
                <Text style={styles.menuItemText}>Edit Profile Information</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.7} 
              onPress={() => router.push('/(customer)/history')}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="time-outline" size={18} color="#000000" />
                </View>
                <Text style={styles.menuItemText}>Stamp History & Logs</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => setPrivacyModalVisible(true)}>
              <View style={styles.menuItemLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="lock-closed-outline" size={18} color="#000000" />
                </View>
                <Text style={styles.menuItemText}>Privacy & Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => setSupportModalVisible(true)}>
              <View style={styles.menuItemLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="help-buoy-outline" size={18} color="#000000" />
                </View>
                <Text style={styles.menuItemText}>Help & Customer Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#64748B" />
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="megaphone-outline" size={18} color="#000000" />
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={styles.menuItemText}>WhatsApp Promotions</Text>
                  <Text style={{ fontSize: 10, color: '#64748B', fontFamily: 'PlusJakartaSans_500Medium', maxWidth: Platform.OS === 'web' ? '100%' : 220 }} numberOfLines={1}>
                    Receive discounts & stamps blasts on WhatsApp
                  </Text>
                </View>
              </View>
              <Switch
                value={optInMarketing}
                onValueChange={handleToggleMarketing}
                trackColor={{ false: '#E5E7EB', true: '#A3A3A3' }}
                thumbColor={optInMarketing ? '#000000' : '#9CA3AF'}
              />
            </View>
          </View>

          {/* Logout Action Button */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out Account</Text>
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
            <Text style={styles.modalTitle}>Log Out Account</Text>
            <Text style={styles.modalSubtitle}>
              Are you sure you want to log out of your RISEV account? You will need to verify your mobile number again to sign back in.
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Premium Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.editModalCard]}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            
            {/* Avatar Picker */}
            <TouchableOpacity style={styles.avatarPickerContainer} onPress={handlePickImage} activeOpacity={0.85}>
              <Image source={{ uri: avatarPreview || avatarUrl }} style={styles.avatarPickerImage} />
              <View style={styles.avatarPencilIcon}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarPickerLabel}>Tap avatar to upload image</Text>

            {/* Input field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                {...Platform.select({
                  web: {
                    outlineStyle: 'none',
                  } as any,
                })}
              />
            </View>

            {/* Optional Change Password Section */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>New Password (Optional)</Text>
              <TextInput
                style={[styles.textInput, passwordFocused && styles.textInputFocused]}
                value={editPassword}
                onChangeText={setEditPassword}
                placeholder="Leave blank to keep current"
                placeholderTextColor="#BEC6E0"
                secureTextEntry
                autoCapitalize="none"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                {...Platform.select({
                  web: {
                    outlineStyle: 'none',
                  } as any,
                })}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={[styles.textInput, confirmPasswordFocused && styles.textInputFocused]}
                value={editConfirmPassword}
                onChangeText={setEditConfirmPassword}
                placeholder="Re-type new password"
                placeholderTextColor="#BEC6E0"
                secureTextEntry
                autoCapitalize="none"
                onFocus={() => setConfirmPasswordFocused(true)}
                onBlur={() => setConfirmPasswordFocused(false)}
                {...Platform.select({
                  web: {
                    outlineStyle: 'none',
                  } as any,
                })}
              />
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
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
                  <Text style={styles.modalConfirmText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy & Terms of Service Modal */}
      <Modal
        visible={privacyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.privacyModalCard]}>
            <Text style={styles.modalTitle}>Privacy & Terms</Text>
            
            <ScrollView style={styles.privacyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.privacyHeading}>1. Terms of Service</Text>
              <Text style={styles.privacyText}>
                Welcome to RISEV. By using our loyalty and rewards application, you agree to comply with our stamp validation protocols. Any attempt to exploit points, forge transactions, or bypass security rules will result in the immediate termination of your active cards.
              </Text>
              
              <Text style={styles.privacyHeading}>2. Data Privacy</Text>
              <Text style={styles.privacyText}>
                We collect your phone number and email address to manage reward programs, secure your credentials, and display transactions logs. We implement strict data integrity measures and do not sell your personal details to third-party advertisers.
              </Text>
              
              <Text style={styles.privacyHeading}>3. WhatsApp Protocols</Text>
              <Text style={styles.privacyText}>
                RISEV uses an automated messaging relay to dispatch OTP authentication codes and stamp completion logs to your WhatsApp instance. By registering, you opt in to receive transactional messages.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalConfirmBtnBlack}
              onPress={() => setPrivacyModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalConfirmText}>Accept & Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help & Customer Support Modal */}
      <Modal
        visible={supportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSupportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.supportModalCard]}>
            <Text style={styles.modalTitle}>Help & Support</Text>
            <Text style={styles.modalSubtitle}>How can we assist you today?</Text>

            {/* Support Form message */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Message</Text>
              <TextInput
                style={[styles.textInput, styles.supportTextInput, supportFocused && styles.textInputFocused]}
                value={supportMessage}
                onChangeText={setSupportMessage}
                placeholder="Describe your issue or feedback..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                onFocus={() => setSupportFocused(true)}
                onBlur={() => setSupportFocused(false)}
                {...Platform.select({
                  web: {
                    outlineStyle: 'none',
                  } as any,
                })}
              />
            </View>

            {/* Modal actions row */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setSupportModalVisible(false);
                  setSupportMessage('');
                }}
                disabled={isSendingSupport}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtnBlack}
                onPress={handleSendSupport}
                disabled={isSendingSupport}
                activeOpacity={0.8}
              >
                {isSendingSupport ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Quick WhatsApp Support Shortcut */}
            <View style={styles.whatsappContainer}>
              <Text style={styles.whatsappLabel}>Or reach us instantly on WhatsApp:</Text>
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={handleWhatsAppSupport}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                <Text style={styles.whatsappBtnText}>Chat on WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Premium Subscription Onboarding Modal */}
      <Modal
        visible={subscribeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSubscribeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { height: 'auto', paddingBottom: 32 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upgrade to Merchant Pro</Text>
              <TouchableOpacity onPress={() => setSubscribeModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            <View style={styles.pricingCard}>
              <Text style={styles.pricingLabel}>PRO PLAN</Text>
              <View style={styles.pricingRow}>
                <Text style={styles.currencySymbol}>RM</Text>
                <Text style={styles.priceText}>99</Text>
                <Text style={styles.billingPeriod}>/month</Text>
              </View>
              <Text style={styles.pricingDesc}>Recurring billing. Cancel anytime.</Text>
            </View>

            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.featureText}>Unlimited loyalty active members</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.featureText}>Launch points & stamps campaigns</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.featureText}>Scan stamp cards & redeem vouchers</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.featureText}>Customer analytics & behavior logs</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.subscribeBtn, { marginTop: 8 }]}
              onPress={handleSubscribe}
              disabled={isSubscribing}
              activeOpacity={0.8}
            >
              {isSubscribing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.subscribeBtnText}>Subscribe & Activate Console</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Consistent pure white background
  },
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    gap: 1,
  },
  logoText: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.5,
  },
  logoSubtext: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  roundHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    right: 10,
    top: 10,
  },
  avatarMini: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 110, // Safe clearance padding for bottom navbar
    gap: 24,
  },
  introSection: {
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 22,
  },
  // User Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  userInfo: {
    gap: 2,
  },
  name: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  phone: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  memberBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  // Switch to Merchant Card
  switchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#000000', // Black focus border matching image 2 style
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
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
    backgroundColor: '#000000', // Solid black action button matching mockup
    height: 44,
    borderRadius: 12,
    gap: 8,
  },
  switchButtonText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  // Menu Options List
  menuList: {
    gap: 12,
  },
  menuSectionHeader: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuItemText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
  },
  // Logout Button
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5', // Red theme logout
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    height: 52,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  closeBtn: {
    padding: 4,
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
  // Edit Profile styles
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
    marginTop: -8,
  },
  inputContainer: {
    width: '100%',
    gap: 6,
    marginVertical: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
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
  textInputFocused: {
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  modalConfirmBtnBlack: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Privacy Modal Styles
  privacyModalCard: {
    maxWidth: 360,
    maxHeight: '80%',
  },
  privacyScroll: {
    width: '100%',
    marginVertical: 8,
  },
  privacyHeading: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 4,
  },
  privacyText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'left',
  },
  // Support Modal Styles
  supportModalCard: {
    maxWidth: 360,
  },
  supportTextInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  whatsappContainer: {
    width: '100%',
    marginTop: 12,
    gap: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  whatsappLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366', // Official WhatsApp green
    height: 44,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  whatsappBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  // Subscription Pricing Styles
  pricingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 8,
    marginVertical: 4,
  },
  pricingLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.primary.DEFAULT,
    letterSpacing: 1.0,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginRight: 2,
  },
  priceText: {
    fontSize: 42,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -1.0,
  },
  billingPeriod: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginLeft: 4,
  },
  pricingDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  featuresList: {
    gap: 12,
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#334155',
  },
  // Subscription Pricing Button Styles
  subscribeBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  subscribeBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
