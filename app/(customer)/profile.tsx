import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Platform, Alert, Modal, TextInput, ActivityIndicator, Linking, useWindowDimensions, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, storage } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { cachedFetch } from '@/lib/data-cache';
import { cacheKeys, TTL } from '@/lib/cache-keys';
import { colors } from '@/theme';
import { parseAndNormalizeBirthday } from '@/lib/emailValidator';

export default function CustomerProfile() {
  const { user, logout, switchRole, updateProfile, refreshSession } = useAuth();
  const router = useRouter();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
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


  const [optInMarketing, setOptInMarketing] = useState(true);
  const [cardsCount, setCardsCount] = useState(0);
  const [vouchersCount, setVouchersCount] = useState(0);
  const [vouchersTotalValue, setVouchersTotalValue] = useState(0);

  const fetchProfileStats = React.useCallback(() => {
    if (!user) return;
    refreshSession().catch(() => {});
    cachedFetch(
      cacheKeys.cardsAllMe(user.id),
      () => pb.collection('loyalty_cards').getFullList({
        filter: `customer = '${user.id}'`,
        fields: 'id,opt_in_marketing,status',
        requestKey: null,
      }),
      { ttl: TTL.own }
    )
      .then((cards: any[]) => {
        setCardsCount(cards.length);
        const hasOptedOut = cards.some((c: any) => c.opt_in_marketing === false);
        setOptInMarketing(!hasOptedOut);
      })
      .catch(() => {});

    cachedFetch(
      cacheKeys.vouchersMe(user.id),
      () => pb.collection('vouchers').getFullList({
        filter: `customer = '${user.id}'`,
        expand: 'reward,reward.merchant,campaign,campaign.merchant',
        sort: '-created',
        requestKey: null,
      }),
      { ttl: TTL.own }
    )
      .then((all: any[]) => {
        const vouchers = all.filter((v: any) => v.status === 'active');
        setVouchersCount(vouchers.length);
        let totalVal = 0;
        vouchers.forEach((v: any) => {
          let meta: any = {};
          try {
            meta = typeof v.metadata === 'string' ? JSON.parse(v.metadata) : (v.metadata || {});
          } catch (e) {}
          const rawVal = parseFloat(
            v.discount_value ||
            v.expand?.reward?.discount_value ||
            v.expand?.campaign?.discount_value ||
            meta.discount_value ||
            '0'
          );
          if (!isNaN(rawVal) && rawVal > 0) {
            totalVal += rawVal;
          }
        });
        setVouchersTotalValue(totalVal);
      })
      .catch(() => {});
  }, [user?.id]);

  React.useEffect(() => {
    fetchProfileStats();
  }, [fetchProfileStats]);

  useFocusEffect(
    React.useCallback(() => {
      fetchProfileStats();
    }, [fetchProfileStats])
  );

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
    if (user?.merchant_id) {
      await switchRole('merchant');
      router.replace('/(merchant)');
    } else {
      router.push('/(merchant)/nfc-marketplace');
    }
  };



  const handleOpenEdit = () => {
    setEditName(user?.name || '');
    let formattedBday = '';
    if (user?.birthday && user.birthday !== '2000-01-01') {
      const datePart = String(user.birthday).split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        // YYYY-MM-DD to DD-MM-YYYY
        formattedBday = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        formattedBday = datePart;
      }
    }
    setEditBirthday(formattedBday);
    setEditPassword('');
    setEditConfirmPassword('');
    setAvatarPreview(avatarUrl);
    setAvatarFile(null);
    setEditModalVisible(true);
  };

  const handleBirthdayChange = (text: string) => {
    // If user is deleting/backspacing, allow free deletion
    if (text.length < editBirthday.length) {
      setEditBirthday(text);
      return;
    }
    const clean = text.replace(/[^0-9\-\/]/g, '');
    if (!clean.includes('-') && !clean.includes('/')) {
      let formatted = clean;
      if (clean.length > 2 && clean.length <= 4) {
        formatted = `${clean.slice(0, 2)}-${clean.slice(2)}`;
      } else if (clean.length > 4) {
        formatted = `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 8)}`;
      }
      setEditBirthday(formatted.slice(0, 10));
    } else {
      setEditBirthday(clean.slice(0, 10));
    }
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

    let birthDateToSave: string | undefined = undefined;
    if (editBirthday && editBirthday.trim()) {
      const bdayCheck = parseAndNormalizeBirthday(editBirthday);
      if (!bdayCheck.isValid) {
        Alert.alert('Validation Error', bdayCheck.error || 'Please enter a valid birthday in DD-MM-YYYY format (e.g. 01-09-2000).');
        return;
      }
      birthDateToSave = bdayCheck.isoDate;
    }

    setIsSaving(true);
    try {
      await updateProfile(
        editName.trim(), 
        avatarFile, 
        editPassword ? editPassword : undefined, 
        editPassword ? editConfirmPassword : undefined,
        birthDateToSave
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
        {/* ── Apple iOS Pure White Header ── */}
        <View style={styles.headerContainer}>
          <View style={[styles.headerTopRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
            <View style={styles.headerBrandRow}>
              {router.canGoBack() && (
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.roundHeaderBtn}
                  activeOpacity={0.75}
                  accessibilityLabel="Back"
                >
                  <Ionicons name="chevron-back" size={18} color="#000000" />
                </TouchableOpacity>
              )}
              <Image
                source={require('../../assets/risev logo.png')}
                style={styles.headerLogo}
              />
              <View style={styles.headerLogoDivider} />
              <Text style={styles.headerTitle}>My Profile</Text>
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
                onPress={() => setSupportModalVisible(true)}
                activeOpacity={0.8}
                accessibilityLabel="Help & Support"
              >
                <Ionicons name="help-buoy-outline" size={18} color="#000000" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Executive Member Identity Card ── */}
          <View style={styles.memberCard}>
            <View style={styles.memberProfileRow}>
              <TouchableOpacity
                style={styles.avatarWrapper}
                onPress={handleOpenEdit}
                activeOpacity={0.85}
              >
                <Image source={{ uri: avatarUrl }} style={styles.memberAvatar} />
                <View style={styles.avatarPencilBadge}>
                  <Ionicons name="camera" size={11} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              <View style={styles.memberInfoCol}>
                <Text style={styles.memberNameText} numberOfLines={1}>
                  {user?.name || 'Risev Member'}
                </Text>
                <Text style={styles.memberPhoneText}>
                  {user?.phone || '+60 12-345 6789'}
                </Text>

                <View style={styles.memberTierBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#FFCC00" />
                  <Text style={styles.memberTierText}>
                    {(user?.tier || 'BRONZE').toUpperCase()} MEMBER
                  </Text>
                </View>
              </View>
            </View>

            {/* 3-Column Loyalty Snapshot Row */}
            <View style={styles.statsSnapshotRow}>
              <View style={styles.statCol}>
                <View style={styles.statIconBadge}>
                  <Ionicons name="star" size={13} color="#FFCC00" />
                </View>
                <Text style={styles.statNumber}>{user?.total_points || 0}</Text>
                <Text style={styles.statLabel}>Total Points</Text>
              </View>

              <View style={styles.statDivider} />

              <TouchableOpacity
                style={styles.statCol}
                onPress={() => router.push('/(customer)/my-cards')}
                activeOpacity={0.7}
              >
                <View style={styles.statIconBadge}>
                  <Ionicons name="card-outline" size={13} color="#000000" />
                </View>
                <Text style={styles.statNumber}>{cardsCount}</Text>
                <Text style={styles.statLabel}>Stamp Cards</Text>
              </TouchableOpacity>

              <View style={styles.statDivider} />

              <TouchableOpacity
                style={styles.statCol}
                onPress={() => router.push('/(customer)/vouchers')}
                activeOpacity={0.7}
              >
                <View style={styles.statIconBadge}>
                  <Ionicons name="ticket-outline" size={13} color="#000000" />
                </View>
                <Text style={styles.statNumber}>{vouchersCount}</Text>
                <Text style={styles.statLabel}>My Vouchers</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Business Owner / Switch to Merchant Card (Concept 2: Compact Risev Yellow Hero Card) ── */}
          <View style={styles.merchantCard}>
            <View style={styles.merchantHeaderRow}>
              <View style={styles.merchantIconSquircle}>
                <Ionicons name="storefront" size={18} color="#FFCC00" />
              </View>
              <View style={styles.merchantTextCol}>
                <Text style={styles.merchantTitle}>Business Owner?</Text>
                <Text style={styles.merchantSubtitle}>
                  More stamps, more bookings. 10x more repeat customers.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.merchantCtaBtn}
              onPress={handleSwitchToMerchant}
              activeOpacity={0.85}
            >
              <Text style={styles.merchantCtaText}>Manage My Business</Text>
              <Ionicons name="arrow-forward" size={15} color="#FFCC00" />
            </TouchableOpacity>
          </View>

          {/* ── Birthday Reward Claim Prompt for Verified Users with Default/Unset Birthday ── */}
          {(user?.verified || (user?.email && !user.email.startsWith('shadow_') && !user.email.startsWith('quick_') && !user.email.endsWith('@risev.app'))) && (!user?.birthday || user.birthday === '2000-01-01') && (
            <TouchableOpacity
              style={styles.birthdayPromptCard}
              onPress={handleOpenEdit}
              activeOpacity={0.88}
            >
              <View style={styles.birthdayPromptLeft}>
                <View style={styles.birthdayPromptIconBox}>
                  <Ionicons name="gift" size={20} color="#000000" />
                </View>
                <View style={styles.birthdayPromptTextCol}>
                  <View style={styles.birthdayPromptTitleRow}>
                    <Text style={styles.birthdayPromptTitle}>Set Your Real Birthday 🎂</Text>
                    <View style={styles.birthdayPromptBadge}>
                      <Text style={styles.birthdayPromptBadgeText}>REWARD READY</Text>
                    </View>
                  </View>
                  <Text style={styles.birthdayPromptSubtitle}>
                    Stores give free birthday vouchers & treats! Tap to confirm your date.
                  </Text>
                </View>
              </View>
              <View style={styles.birthdayPromptCta}>
                <Ionicons name="chevron-forward" size={16} color="#92400E" />
              </View>
            </TouchableOpacity>
          )}

          {/* ── Inset Grouped Settings Sections ── */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeaderTitle}>Account & Wallet</Text>
            
            <View style={styles.groupedContainer}>
              <TouchableOpacity
                style={styles.groupedCell}
                activeOpacity={0.7}
                onPress={handleOpenEdit}
              >
                <View style={styles.cellLeft}>
                  <View style={styles.cellIconBg}>
                    <Ionicons name="person-outline" size={18} color="#000000" />
                  </View>
                  <Text style={styles.cellTitle}>Edit Profile Information</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>

              <View style={styles.cellDivider} />

              <TouchableOpacity 
                style={styles.groupedCell} 
                activeOpacity={0.7} 
                onPress={() => router.push('/(customer)/history')}
              >
                <View style={styles.cellLeft}>
                  <View style={styles.cellIconBg}>
                    <Ionicons name="time-outline" size={18} color="#000000" />
                  </View>
                  <Text style={styles.cellTitle}>Stamp History & Logs</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeaderTitle}>Preferences & Support</Text>

            <View style={styles.groupedContainer}>
              <View style={styles.groupedCell}>
                <View style={styles.cellLeft}>
                  <View style={styles.cellIconBg}>
                    <Ionicons name="notifications-outline" size={18} color="#000000" />
                  </View>
                  <View style={{ gap: 2, flex: 1, paddingRight: 8 }}>
                    <Text style={styles.cellTitle}>Push Notifications</Text>
                    <Text style={styles.cellSubtitle} numberOfLines={1}>
                      Receive instant alerts for rewards, stamps & promos
                    </Text>
                  </View>
                </View>
                <Switch
                  value={optInMarketing}
                  onValueChange={handleToggleMarketing}
                  trackColor={{ false: '#E2E8F0', true: '#000000' }}
                  thumbColor={optInMarketing ? '#FFCC00' : '#FFFFFF'}
                />
              </View>

              <View style={styles.cellDivider} />

              <TouchableOpacity
                style={styles.groupedCell}
                activeOpacity={0.7}
                onPress={() => setSupportModalVisible(true)}
              >
                <View style={styles.cellLeft}>
                  <View style={styles.cellIconBg}>
                    <Ionicons name="help-buoy-outline" size={18} color="#000000" />
                  </View>
                  <Text style={styles.cellTitle}>Help & Customer Support</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>

              <View style={styles.cellDivider} />

              <TouchableOpacity
                style={styles.groupedCell}
                activeOpacity={0.7}
                onPress={() => setPrivacyModalVisible(true)}
              >
                <View style={styles.cellLeft}>
                  <View style={styles.cellIconBg}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#000000" />
                  </View>
                  <Text style={styles.cellTitle}>Privacy & Terms of Service</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Logout Action Button ── */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out Account</Text>
          </TouchableOpacity>
        </ScrollView>

      {/* Apple Native Bottom Sheet Log Out Confirmation (Option 1) */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.logoutSheetOverlay}
          activeOpacity={1}
          onPress={() => setLogoutModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.logoutSheetCard,
              isDesktop && { maxWidth: 440, alignSelf: 'center', marginBottom: 'auto', marginTop: 'auto', borderRadius: 32 }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* iOS Drag Handle */}
            <View style={styles.logoutSheetHandle} />

            {/* Soft Retention Icon Squircle */}
            <View style={styles.logoutIconSquircle}>
              <Ionicons name={vouchersCount > 0 ? "ticket-outline" : "log-out-outline"} size={26} color="#EF4444" />
            </View>

            <Text style={styles.logoutSheetTitle}>We'll Miss You!</Text>
            <Text style={styles.logoutSheetSubtitle}>
              {vouchersCount > 0 ? (
                <>
                  Don't forget you have{' '}
                  <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                    {vouchersCount} {vouchersCount === 1 ? 'voucher' : 'vouchers'}
                  </Text>
                  {vouchersTotalValue > 0 ? (
                    <>
                      {' '}worth{' '}
                      <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' }}>
                        RM {vouchersTotalValue % 1 === 0 ? vouchersTotalValue : vouchersTotalValue.toFixed(2)}
                      </Text>
                    </>
                  ) : null}{' '}
                  waiting in your wallet.
                </>
              ) : (
                "Are you sure you want to log out of your RISEV account? You can sign back in anytime with your credentials."
              )}
            </Text>

            {/* Stacked Apple Action Pills */}
            <View style={styles.logoutActionsCol}>
              <TouchableOpacity
                style={styles.logoutConfirmPill}
                onPress={confirmLogout}
                activeOpacity={0.85}
              >
                <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
                <Text style={styles.logoutConfirmPillText}>Log Out</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutCancelPill}
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutCancelPillText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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

            {/* Birthday field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Birthday (DD-MM-YYYY)</Text>
              <TextInput
                style={styles.textInput}
                value={editBirthday}
                onChangeText={handleBirthdayChange}
                placeholder="DD-MM-YYYY (e.g. 01-09-2000)"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                {...Platform.select({
                  web: {
                    outlineStyle: 'none',
                  } as any,
                })}
              />
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4 }}>
                🎁 Needed for merchants to send you birthday surprise rewards!
              </Text>
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
              
              <Text style={styles.privacyHeading}>3. Push Notifications & Alerts</Text>
              <Text style={styles.privacyText}>
                RISEV dispatches real-time push notifications for stamp rewards, voucher redemptions, and exclusive promotions. You can customize your notification preferences at any time in your profile settings.
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


      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 88,
    height: 28,
    resizeMode: 'contain',
  },
  headerLogoDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 130, // Safe clearance for floating bottom dock
    gap: 16,
  },
  // Executive Member Identity Card
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    gap: 16,
  },
  memberProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  memberAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: '#000000',
  },
  avatarPencilBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberInfoCol: {
    flex: 1,
    gap: 4,
  },
  memberNameText: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.4,
  },
  memberPhoneText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  memberTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 99,
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  memberTierText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
    letterSpacing: 0.5,
  },
  // 3-Column Loyalty Snapshot Row
  statsSnapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statIconBadge: {
    marginBottom: 2,
  },
  statNumber: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  // Merchant Switch Card (Concept 2: Compact Risev Yellow Hero Card)
  merchantCard: {
    backgroundColor: '#FFCC00',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#F2BD00',
    gap: 11,
    shadowColor: '#FFCC00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3,
  },
  merchantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  merchantIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  merchantTextCol: {
    flex: 1,
    gap: 1.5,
  },
  merchantTitle: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.3,
  },
  merchantSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(0, 0, 0, 0.72)',
    lineHeight: 15,
  },
  merchantCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    height: 38,
    borderRadius: 99,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  merchantCtaText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  birthdayPromptCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  birthdayPromptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  birthdayPromptIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayPromptTextCol: {
    flex: 1,
    gap: 3,
  },
  birthdayPromptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  birthdayPromptTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
  },
  birthdayPromptBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  birthdayPromptBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.4,
  },
  birthdayPromptSubtitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#B45309',
    lineHeight: 16,
  },
  birthdayPromptCta: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inset Grouped Settings
  sectionGroup: {
    gap: 8,
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  groupedContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  groupedCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  cellLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cellIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cellTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  cellSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  cellDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 60,
  },
  // Logout Button
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    height: 50,
    borderRadius: 16,
    gap: 8,
    marginTop: 4,
  },
  logoutText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EF4444',
  },
  // Apple Native Bottom Sheet Log Out Styles
  logoutSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  logoutSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  logoutSheetHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 99,
    backgroundColor: '#CBD5E1',
    marginBottom: 16,
  },
  logoutIconSquircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    marginBottom: 6,
  },
  logoutSheetTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    textAlign: 'center',
  },
  logoutSheetSubtitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  logoutActionsCol: {
    width: '100%',
    gap: 10,
    marginTop: 18,
  },
  logoutConfirmPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    height: 52,
    borderRadius: 999,
    gap: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutConfirmPillText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  logoutCancelPill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    height: 52,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  logoutCancelPillText: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
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
  // Bento-Style Upgrade Modal Styles
  bentoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bentoProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bentoProBadgeText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.8,
  },
  bentoCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoHeroBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: 10,
  },
  bentoHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bentoHeroTag: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.6,
  },
  bentoPriceTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  bentoPriceTagText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  bentoHeroTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.4,
    lineHeight: 23,
    marginBottom: 4,
  },
  bentoHeroSubtitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#78350F',
  },
  bentoGrid: {
    gap: 8,
    marginBottom: 14,
  },
  bentoWideTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bentoHalfTile: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  bentoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bentoTileTitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  bentoTileDesc: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 14,
  },
  bentoCtaBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  bentoCtaBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  bentoTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
  },
  bentoTrustText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
});
