import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Alert,
  ScrollView,
  Platform,
  Modal,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
import { useRouter, usePathname } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width } = Dimensions.get('window');

export default function GiveStampsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isFocused = pathname.includes('give');
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Automatically request camera permission when screen is focused and permission is not yet granted
  useEffect(() => {
    if (isFocused && permission && !permission.granted) {
      requestPermission().catch((err) => {
        console.warn("Auto-request camera permission failed:", err);
      });
    }
  }, [isFocused, permission?.granted]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [stampsCount, setStampsCount] = useState('1');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showCreateConfirmModal, setShowCreateConfirmModal] = useState(false);
  const [showNoCampaignModal, setShowNoCampaignModal] = useState(false);
  const [tempPhone, setTempPhone] = useState('');
  const [tempCount, setTempCount] = useState(1);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [successDetails, setSuccessDetails] = useState<{
    customerName: string;
    customerPhone: string;
    awardedCount: number;
    totalStamps: number;
  } | null>(null);
  const [successType, setSuccessType] = useState<'stamps' | 'voucher'>('stamps');
  const [voucherDetails, setVoucherDetails] = useState<{
    code: string;
    customerName: string;
    rewardName: string;
  } | null>(null);

  const normalizePhoneNumber = (phone: string) => {
    let cleaned = phone.trim().replace(/[-\s]/g, ''); // Remove spaces and dashes
    if (cleaned.startsWith('0')) {
      cleaned = '+60' + cleaned.substring(1);
    } else if (cleaned.startsWith('60')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+') && cleaned.length > 0) {
      cleaned = '+60' + cleaned;
    }
    return cleaned;
  };

  const redeemVoucherCode = async (code: string) => {
    try {
      const voucher = await pb.collection('vouchers').getFirstListItem(
        `code = "${code.trim().toUpperCase()}" && status = "active"`,
        { expand: 'reward,customer' }
      );

      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
        throw new Error('This voucher has expired.');
      }

      // Mark voucher as used
      await pb.collection('vouchers').update(voucher.id, {
        status: 'used',
        used_at: new Date().toISOString(),
      });

      setSuccessType('voucher');
      setVoucherDetails({
        code: voucher.code,
        customerName: voucher.expand?.customer?.name || 'Unknown Customer',
        rewardName: voucher.expand?.reward?.name || 'Voucher Reward',
      });
      setShowSuccessModal(true);
      setPhoneNumber('');
    } catch (err: any) {
      console.warn(err);
      Alert.alert('Redemption Failed', err.message || 'Invalid, expired, or already used voucher.');
    }
  };

  const proceedWithIssuingStamps = async (customer: any, count: number, rawInput: string) => {
    let program;
    try {
      // Fetch merchant's active loyalty program
      program = await pb.collection('loyalty_programs').getFirstListItem(`merchant = "${user!.merchant_id}" && is_active = true`);
    } catch (err: any) {
      console.warn("Active loyalty campaign search failed:", err);
      setShowNoCampaignModal(true);
      return;
    }

    try {
      let loyaltyCard = await pb.collection('loyalty_cards')
        .getFirstListItem(`customer = "${customer.id}" && program = "${program.id}"`)
        .catch(() => null);

      if (!loyaltyCard) {
        loyaltyCard = await pb.collection('loyalty_cards').create({
          customer: customer.id,
          program: program.id,
          merchant: user!.merchant_id,
          stamps_collected: 0,
          completions: 0,
          status: 'active',
        });
      }

      const currentStamps = loyaltyCard!.stamps_collected || 0;
      const newStamps = currentStamps + count;

      // 1. Update the loyalty card stamps collected count
      await pb.collection('loyalty_cards').update(loyaltyCard!.id, {
        stamps_collected: newStamps,
      });

      // 2. Issue earn transaction log
      await pb.collection('transactions').create({
        customer: customer.id,
        merchant: user!.merchant_id,
        loyalty_card: loyaltyCard!.id,
        type: 'earn',
        points: count, // Hook will multiply points
        stamps: count,
      });

      setSuccessType('stamps');
      setSuccessDetails({
        customerName: customer.name || rawInput,
        customerPhone: customer.phone,
        awardedCount: count,
        totalStamps: newStamps,
      });
      setShowSuccessModal(true);
      setPhoneNumber('');
    } catch (err: any) {
      console.warn(err);
      Alert.alert('Error', err.message || 'Failed to award stamps.');
    }
  };

  const handleManualSubmit = async () => {
    const rawInput = phoneNumber.trim();
    if (!rawInput) {
      Alert.alert('Error', 'Please enter a valid phone number or voucher code.');
      return;
    }
    if (!user || !user.merchant_id) {
      Alert.alert('Error', 'Unauthorized merchant account.');
      return;
    }

    // If input starts with WV- prefix, process as voucher redemption
    if (rawInput.toUpperCase().startsWith('WV-')) {
      await redeemVoucherCode(rawInput);
      return;
    }

    const count = parseInt(stampsCount || '1', 10);
    let customer;
    const normalizedPhone = normalizePhoneNumber(rawInput);
    try {
      // Find the user by phone
      customer = await pb.collection('users').getFirstListItem(`phone = "${normalizedPhone}"`);
      await proceedWithIssuingStamps(customer, count, rawInput);
    } catch (err: any) {
      console.warn("Phone lookup failed (customer doesn't exist yet):", err);
      // Trigger the custom beautiful in-app modal instead of browser native Alerts!
      setTempPhone(normalizedPhone);
      setTempCount(count);
      setShowCreateConfirmModal(true);
    }
  };

  const handleCreateAndIssue = async () => {
    try {
      const cleanNum = tempPhone.replace(/[^\d]/g, '');
      const emailVal = `user_${cleanNum}@waly.app`;
      const randomPassword = Math.random().toString(36).substring(2, 12) + 'W!1';

      // Create new customer
      const newCustomer = await pb.collection('users').create({
        phone: tempPhone,
        email: emailVal,
        name: newCustomerName.trim() || `User ${tempPhone.slice(-4)}`,
        role: 'customer',
        password: randomPassword,
        passwordConfirm: randomPassword,
        total_points: 0,
        tier: 'bronze',
      });

      setNewCustomerName('');

      // Continue the stamp issue process using the new customer!
      await proceedWithIssuingStamps(newCustomer, tempCount, tempPhone);
    } catch (createErr: any) {
      console.error("Auto customer creation failed:", createErr);
      Alert.alert('Error', 'Failed to create new customer account: ' + (createErr.message || createErr));
      setScanned(false);
    }
  };

  const handleCreateAndIssueSubmit = async () => {
    setNewCustomerName('');
    setShowCreateConfirmModal(false);
    await handleCreateAndIssue();
  };

  const simulateVoucherScan = async () => {
    if (!user || !user.merchant_id) {
      Alert.alert('Error', 'Not logged in as a merchant.');
      return;
    }
    try {
      const activeVouchers = await pb.collection('vouchers').getFullList({
        filter: `status = "active" && reward.merchant = "${user.merchant_id}"`,
        expand: 'reward,customer',
        limit: 1
      });

      if (activeVouchers.length === 0) {
        Alert.alert(
          'No Active Vouchers',
          'There are currently no active customer vouchers for your store to simulate scanning. Complete a stamp card first to issue one!'
        );
        return;
      }

      const mockVoucher = activeVouchers[0];
      const code = mockVoucher.code;
      const customerName = mockVoucher.expand?.customer?.name || 'Customer';
      const rewardName = mockVoucher.expand?.reward?.name || 'Reward';

      Alert.alert(
        'Voucher Scanned',
        `Simulated scanning voucher code: ${code}\nReward: ${rewardName}\nCustomer: ${customerName}\n\nClick OK to redeem this voucher.`,
        [
          {
            text: 'OK',
            onPress: async () => {
              await redeemVoucherCode(code);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to simulate voucher scan.');
    }
  };

  const simulateStampScan = async () => {
    if (!user || !user.merchant_id) {
      Alert.alert('Error', 'Not logged in as a merchant.');
      return;
    }
    let targetPhone = phoneNumber.trim();
    if (!targetPhone) {
      try {
        const firstCust = await pb.collection('users').getFirstListItem('role = "customer"');
        targetPhone = firstCust.phone;
      } catch (e) {
        targetPhone = '+601153300472';
      }
    } else {
      targetPhone = normalizePhoneNumber(targetPhone);
    }

    Alert.alert(
      'Stamp Card Scanned',
      `Simulated scanning customer phone number: ${targetPhone}.\nClick OK to award 1 stamp.`,
      [
        {
          text: 'OK',
          onPress: async () => {
            try {
              const customer = await pb.collection('users').getFirstListItem(`phone = "${targetPhone}"`);
              const program = await pb.collection('loyalty_programs').getFirstListItem(`merchant = "${user.merchant_id}" && is_active = true`);

              let loyaltyCard = await pb.collection('loyalty_cards')
                .getFirstListItem(`customer = "${customer.id}" && program = "${program.id}"`)
                .catch(() => null);

              if (!loyaltyCard) {
                loyaltyCard = await pb.collection('loyalty_cards').create({
                  customer: customer.id,
                  program: program.id,
                  merchant: user.merchant_id,
                  stamps_collected: 0,
                  completions: 0,
                  status: 'active',
                });
              }

              const currentStamps = loyaltyCard!.stamps_collected || 0;
              const newStamps = currentStamps + 1;

              await pb.collection('loyalty_cards').update(loyaltyCard!.id, {
                stamps_collected: newStamps,
              });

              await pb.collection('transactions').create({
                customer: customer.id,
                merchant: user.merchant_id,
                loyalty_card: loyaltyCard!.id,
                type: 'earn',
                points: 1,
                stamps: 1,
              });

              setSuccessType('stamps');
              setSuccessDetails({
                customerName: customer.name || targetPhone,
                customerPhone: customer.phone,
                awardedCount: 1,
                totalStamps: newStamps,
              });
              setShowSuccessModal(true);
            } catch (err: any) {
              console.warn(err);
              let errorMsg = 'Failed to award scan stamp.';
              if (err.status === 404) {
                errorMsg = 'Customer not found. Please verify that the phone number is registered with Waly.';
              } else if (err.message) {
                errorMsg = err.message;
              }
              Alert.alert('Error', errorMsg);
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const triggerMockScanSuccess = () => {
    if (!user || !user.merchant_id) {
      Alert.alert('Error', 'Unauthorized merchant account.');
      return;
    }
    setShowSimulateModal(true);
  };

  const handleBarcodeScanned = async (data: string) => {
    const rawInput = data.trim();
    if (!rawInput || scanned) return;

    if (!user || !user.merchant_id) {
      Alert.alert('Error', 'Unauthorized merchant account.');
      return;
    }

    setScanned(true);

    if (rawInput.toUpperCase().startsWith('WV-')) {
      // It's a voucher redemption scan!
      await redeemVoucherCode(rawInput);
    } else {
      // It's a loyalty card stamp issue scan!
      const count = parseInt(stampsCount || '1', 10);
      const normalizedPhone = normalizePhoneNumber(rawInput);
      try {
        const customer = await pb.collection('users').getFirstListItem(`phone = "${normalizedPhone}"`);
        await proceedWithIssuingStamps(customer, count, rawInput);
      } catch (err: any) {
        console.warn("QR Phone lookup failed:", err);
        // If the customer doesn't exist, trigger the customer creation modal
        setTempPhone(normalizedPhone);
        setTempCount(count);
        setShowCreateConfirmModal(true);
      }
    }
  };

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* Top Header - White minimalist luxury style */}
      <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Ionicons name="cafe" size={15} color="#000000" />
          </View>
          <Text style={styles.headerLogoText}>Waly Merchant Portal</Text>
        </View>
        <TouchableOpacity style={styles.notifyBtn}>
          <Ionicons name="notifications-outline" size={22} color="#0b1c30" />
        </TouchableOpacity>
      </View>

      {/* Main Container Area */}
      <ScrollView contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]} showsVerticalScrollIndicator={false}>
        {/* Sleek Segmented Mode Selector */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, scanMode === 'camera' && styles.segmentBtnActive]}
            onPress={() => setScanMode('camera')}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={16} color={scanMode === 'camera' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.segmentText, scanMode === 'camera' && styles.segmentTextActive]}>Scan QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, scanMode === 'manual' && styles.segmentBtnActive]}
            onPress={() => setScanMode('manual')}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={scanMode === 'manual' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.segmentText, scanMode === 'manual' && styles.segmentTextActive]}>Manual Input</Text>
          </TouchableOpacity>
        </View>

        {scanMode === 'camera' ? (
          // MINIMALIST LIGHT QR CODE SCAN VIEWFINDER
          <View style={styles.scanWrapper}>
            <View style={styles.viewfinderCard}>
              <Text style={styles.scanTitle}>Scan Customer QR</Text>
              <Text style={styles.scanSubtitle}>
                Align the customer's QR code within the viewfinder frame to credit stamp points automatically.
              </Text>

              {/* Live Camera / Fallback permission target Area */}
              <View style={[styles.viewfinderFrame, { overflow: 'hidden' }]}>
                {permission === null ? (
                  <ActivityIndicator color="#000000" size="large" />
                ) : !permission.granted ? (
                  <View style={styles.permissionContainer}>
                    <Ionicons name="camera-reverse-outline" size={40} color="#64748B" />
                    <Text style={styles.permissionText}>Camera access is required to scan QR codes.</Text>
                    <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.8}>
                      <Text style={styles.permissionBtnText}>Enable Camera</Text>
                    </TouchableOpacity>
                  </View>
                ) : !scanned && isFocused ? (
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={({ data }) => handleBarcodeScanned(data)}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.scannedPlaceholder]}>
                    <ActivityIndicator color="#000000" size="large" />
                    <Text style={styles.processingText}>Processing...</Text>
                  </View>
                )}

                {/* Thin elegant black brackets */}
                <View style={[styles.bracket, styles.topLeftBracket]} />
                <View style={[styles.bracket, styles.topRightBracket]} />
                <View style={[styles.bracket, styles.bottomLeftBracket]} />
                <View style={[styles.bracket, styles.bottomRightBracket]} />
                <View style={styles.scanIndicatorDot} />
              </View>
            </View>
          </View>
        ) : (
          // MANUAL ENTRY FORM MODE
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Manual Stamp or Voucher</Text>
            <Text style={styles.formSubtitle}>
              Enter customer's phone number to credit stamps, or enter a voucher code (starts with WV-) to redeem.
            </Text>

            {/* Input field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PHONE NUMBER OR VOUCHER CODE</Text>
              <View style={[styles.inputWrapper, phoneFocused && styles.inputWrapperFocused]}>
                <Ionicons name="phone-portrait-outline" size={18} color={phoneFocused ? '#000000' : '#94A3B8'} />
                <TextInput
                  style={styles.textInput}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="+60123456789 or WV-XXXX-XXXX"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                />
              </View>
            </View>

            {/* Count Selector field */}
            {!phoneNumber.toUpperCase().startsWith('WV-') && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NUMBER OF STAMPS TO ISSUE</Text>
                <View style={styles.stampControls}>
                  <TouchableOpacity
                    style={styles.controlBtn}
                    onPress={() => setStampsCount(Math.max(1, parseInt(stampsCount || '1') - 1).toString())}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={18} color="#000000" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stampCountInput}
                    value={stampsCount}
                    onChangeText={setStampsCount}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={styles.controlBtn}
                    onPress={() => setStampsCount((parseInt(stampsCount || '1') + 1).toString())}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={18} color="#000000" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleManualSubmit}
              activeOpacity={0.9}
            >
              <Text style={styles.submitBtnText}>
                {phoneNumber.toUpperCase().startsWith('WV-') ? 'Redeem Voucher' : 'Issue Stamp Points'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Celebratory Checkmark Icon */}
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={54} color="#10B981" />
            </View>

            <Text style={styles.modalTitle}>
              {successType === 'voucher' ? 'VOUCHER REDEEMED!' : 'STAMPS AWARDED!'}
            </Text>
            
            {successType === 'stamps' && successDetails && (
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer</Text>
                  <Text style={styles.detailValue}>{successDetails.customerName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{successDetails.customerPhone}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Awarded</Text>
                  <Text style={[styles.detailValue, { color: '#10B981', fontFamily: 'PlusJakartaSans_800ExtraBold' }]}>
                    +{successDetails.awardedCount} Stamp{successDetails.awardedCount > 1 ? 's' : ''}
                  </Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Current Balance</Text>
                  <View style={styles.stampBadge}>
                    <Text style={styles.stampBadgeText}>{successDetails.totalStamps} Stamp{successDetails.totalStamps !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
              </View>
            )}

            {successType === 'voucher' && voucherDetails && (
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer</Text>
                  <Text style={styles.detailValue}>{voucherDetails.customerName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Voucher Code</Text>
                  <Text style={styles.detailValue}>{voucherDetails.code}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reward</Text>
                  <Text style={[styles.detailValue, { color: '#10B981', fontFamily: 'PlusJakartaSans_800ExtraBold' }]}>
                    {voucherDetails.rewardName}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                setShowSuccessModal(false);
                setScanned(false);
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.modalCloseBtnText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* New Customer Auto-Provisioning Confirmation Modal */}
      <Modal
        visible={showCreateConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCreateConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Elegant Prompt Icon */}
            <View style={[styles.successIconContainer, { backgroundColor: '#F1F5F9' }]}>
              <Ionicons name="person-add-outline" size={40} color="#000000" />
            </View>

            <Text style={[styles.modalTitle, { color: '#0F172A', marginBottom: 12, textAlign: 'center' }]}>
              NEW CUSTOMER PROFILE
            </Text>

            <Text style={{
              fontSize: 13,
              fontFamily: 'PlusJakartaSans_600SemiBold',
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 18,
              marginBottom: 24,
            }}>
              Phone number <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>{phoneNumber}</Text> is not registered with WALY. Create a new guest account to credit these stamps?
            </Text>

            {/* Optional Customer Name Input */}
            <View style={{ width: '100%', marginBottom: 20 }}>
              <Text style={{
                fontSize: 10,
                fontFamily: 'PlusJakartaSans_700Bold',
                color: '#94A3B8',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}>
                CUSTOMER NAME (OPTIONAL)
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: '#E2E8F0',
                borderRadius: 12,
                height: 44,
                paddingHorizontal: 12,
                backgroundColor: '#F8FAFC',
              }}>
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontFamily: 'PlusJakartaSans_600SemiBold',
                    color: '#000000',
                    ...Platform.select({
                      web: {
                        outlineStyle: 'none',
                      } as any,
                    }),
                  }}
                  value={newCustomerName}
                  onChangeText={setNewCustomerName}
                  placeholder="Enter name (e.g. Adam)"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderRadius: 16,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: '#E2E8F0',
                  backgroundColor: '#FFFFFF',
                }}
                onPress={() => {
                  setShowCreateConfirmModal(false);
                  setScanned(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#000000',
                  borderRadius: 16,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={async () => {
                  setShowCreateConfirmModal(false);
                  await handleCreateAndIssue();
                }}
                activeOpacity={0.9}
              >
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                  Create & Issue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Campaign Inactive Warning Modal */}
      <Modal
        visible={showNoCampaignModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNoCampaignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Elegant Warning Icon */}
            <View style={[styles.successIconContainer, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="megaphone-outline" size={40} color="#D97706" />
            </View>

            <Text style={[styles.modalTitle, { color: '#D97706', marginBottom: 12, textAlign: 'center' }]}>
              CAMPAIGN INACTIVE
            </Text>

            <Text style={{
              fontSize: 13,
              fontFamily: 'PlusJakartaSans_600SemiBold',
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 18,
              marginBottom: 24,
            }}>
              No active loyalty program found for your store. Please go to the Marketing section to create a campaign and enable it first.
            </Text>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderRadius: 16,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: '#E2E8F0',
                  backgroundColor: '#FFFFFF',
                }}
                onPress={() => setShowNoCampaignModal(false)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                  Close
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#000000',
                  borderRadius: 16,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  setShowNoCampaignModal(false);
                  router.push('/(merchant)/marketing' as any);
                }}
                activeOpacity={0.9}
              >
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                  Go to Marketing
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Simulation Selection Modal */}
      <Modal
        visible={showSimulateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSimulateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: '#000000', marginBottom: 12 }]}>Simulate Scan</Text>
            <Text style={[styles.formSubtitle, { textAlign: 'center', marginBottom: 20 }]}>
              Select what type of customer QR code you want to simulate scanning:
            </Text>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { marginBottom: 12 }]}
              onPress={async () => {
                setShowSimulateModal(false);
                await simulateStampScan();
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.modalCloseBtnText}>LOYALTY CARD (EARN STAMP)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: '#7C3AED', marginBottom: 12 }]}
              onPress={async () => {
                setShowSimulateModal(false);
                await simulateVoucherScan();
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.modalCloseBtnText}>VOUCHER CODE (REDEEM)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: '#64748B' }]}
              onPress={() => setShowSimulateModal(false)}
              activeOpacity={0.9}
            >
              <Text style={styles.modalCloseBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Pure clean white matching the theme
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 10,
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
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerLogoText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  notifyBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 20,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#000000', // Solid black matching active pills
  },
  segmentText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  scanWrapper: {
    width: '100%',
  },
  viewfinderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 16,
  },
  scanTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    textAlign: 'center',
  },
  scanSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  viewfinderFrame: {
    width: 200,
    height: 200,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
  },
  bracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#000000', // Luxury black brackets
  },
  topLeftBracket: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 16,
  },
  topRightBracket: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 16,
  },
  bottomLeftBracket: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 16,
  },
  bottomRightBracket: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 16,
  },
  qrBgIcon: {
    opacity: 0.8,
  },
  scanIndicatorDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981', // green target indicator
  },
  simulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    height: 44,
    width: '100%',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  simulateBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  tipPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    width: '100%',
  },
  tipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    flex: 1,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 18,
  },
  formTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  formSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  inputWrapperFocused: {
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  stampControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampCountInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    textAlign: 'center',
    paddingHorizontal: 12,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  submitBtn: {
    backgroundColor: '#000000',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 340,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#065F46',
    letterSpacing: 1,
    marginBottom: 20,
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  stampBadge: {
    backgroundColor: '#000000',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stampBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    backgroundColor: '#000000',
    borderRadius: 16,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  permissionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
    lineHeight: 16,
  },
  permissionBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  permissionBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  scannedPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
  },
  processingText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginTop: 10,
  },
});
