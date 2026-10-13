import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

interface CustomerStampModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CustomerStampModal({ visible, onClose }: CustomerStampModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  
  // 'menu' | 'nfc' | 'qr' | 'my_qr'
  const [scanMode, setScanMode] = useState<'menu' | 'nfc' | 'qr' | 'my_qr'>('menu');
  const [isScanning, setIsScanning] = useState(false);

  // Pulse animation for NFC scanning radar ripples
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timeoutId: any;
    let isMounted = true;

    // Reset and stop animations when mode changes or modal closes
    pulseAnim1.stopAnimation();
    pulseAnim2.stopAnimation();

    if (visible && scanMode === 'nfc') {
      pulseAnim1.setValue(0);
      pulseAnim2.setValue(0);

      const runAnim1 = () => {
        if (!isMounted) return;
        pulseAnim1.setValue(0);
        Animated.timing(pulseAnim1, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && isMounted) {
            runAnim1();
          }
        });
      };

      const runAnim2 = () => {
        if (!isMounted) return;
        pulseAnim2.setValue(0);
        Animated.timing(pulseAnim2, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && isMounted) {
            runAnim2();
          }
        });
      };

      runAnim1();

      timeoutId = setTimeout(() => {
        runAnim2();
      }, 1200);
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      pulseAnim1.stopAnimation();
      pulseAnim2.stopAnimation();
    };
  }, [scanMode, visible]);

  const startQrScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setScanMode('qr');
  };

  const handleBarCodeScanned = (event: any) => {
    if (isScanning) return;
    const data = event?.data || event?.nativeEvent?.data || (typeof event === 'string' ? event : '');
    if (!data) return;
    
    // Parse link to find merchant ID 'm'
    // Format: https://risev.app/nfc?m=MERCHANT_ID or similar
    if (data.includes('m=')) {
      setIsScanning(true);
      const parts = data.split('m=');
      const merchantId = parts[parts.length - 1].split('&')[0];
      
      // Close scan sheet and navigate to NFC claim page
      onClose();
      resetModal();
      router.push(`/nfc?m=${merchantId}` as any);
    }
  };

  const resetModal = () => {
    setScanMode('menu');
    setIsScanning(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.bottomSheet, 
          { 
            maxWidth: width > 600 ? 500 : '100%', 
            alignSelf: 'center',
          }
        ]}>
          {/* Apple iOS Drag Handle Bar */}
          <View style={styles.sheetHandleBar} />

          {/* Modal Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.sheetTitle}>
                {scanMode === 'menu' && 'Stamp Your Card'}
                {scanMode === 'nfc' && 'Ready to Scan NFC'}
                {scanMode === 'qr' && 'Scan Store QR'}
                {scanMode === 'my_qr' && 'My Loyalty QR'}
              </Text>
              <Text style={styles.sheetSubtitle}>
                {scanMode === 'menu' && 'Choose how you want to collect your stamp at the counter.'}
                {scanMode === 'nfc' && 'Hold your device near the shop’s NFC counter card.'}
                {scanMode === 'qr' && 'Align the counter QR code within the frame.'}
                {scanMode === 'my_qr' && 'Present this QR code to the cashier to scan.'}
              </Text>
            </View>

            <TouchableOpacity 
              onPress={handleClose} 
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Menu Option Mode (3 Workflows) */}
          {scanMode === 'menu' && (
            <View style={styles.menuContainer}>
              {/* Option 1: Tap NFC Counter */}
              <TouchableOpacity 
                style={styles.optionCard}
                onPress={() => setScanMode('nfc')}
                activeOpacity={0.85}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="radio-outline" size={22} color="#FFCC00" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Text style={styles.optionTitle}>Tap NFC Reader</Text>
                    <View style={styles.instantBadge}>
                      <Text style={styles.instantBadgeText}>⚡ INSTANT</Text>
                    </View>
                  </View>
                  <Text style={styles.optionDesc}>Hold your device near the shop’s NFC counter card.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(0, 0, 0, 0.35)" />
              </TouchableOpacity>

              {/* Option 2: Scan Store QR */}
              <TouchableOpacity 
                style={styles.optionCard}
                onPress={startQrScanner}
                activeOpacity={0.85}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Text style={styles.optionTitle}>Scan Store QR</Text>
                    <View style={styles.neutralBadge}>
                      <Text style={styles.neutralBadgeText}>📷 CAMERA</Text>
                    </View>
                  </View>
                  <Text style={styles.optionDesc}>Use your camera to scan counter QR card.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(0, 0, 0, 0.35)" />
              </TouchableOpacity>

              {/* Option 3: Show My Loyalty QR */}
              <TouchableOpacity 
                style={styles.optionCard}
                onPress={() => setScanMode('my_qr')}
                activeOpacity={0.85}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Text style={styles.optionTitle}>Show My QR Code</Text>
                    <View style={styles.neutralBadge}>
                      <Text style={styles.neutralBadgeText}>👤 MY CODE</Text>
                    </View>
                  </View>
                  <Text style={styles.optionDesc}>Display your loyalty QR code for the cashier to scan.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(0, 0, 0, 0.35)" />
              </TouchableOpacity>

              {/* Bottom Tip Note */}
              <View style={styles.tipNoteRow}>
                <Ionicons name="information-circle-outline" size={14} color="rgba(0, 0, 0, 0.45)" />
                <Text style={styles.tipNoteText}>
                  NFC tapping does not require camera permissions and is faster.
                </Text>
              </View>
            </View>
          )}

          {/* Option 3 View: Show My Customer Loyalty QR */}
          {scanMode === 'my_qr' && (
            <View style={styles.myQrContainer}>
              <View style={styles.myQrCard}>
                <View style={styles.myQrImageWrap}>
                  <Image 
                    source={{ 
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(user?.phone || user?.id || 'risev-member')}` 
                    }}
                    style={{ width: 190, height: 190 }}
                    resizeMode="contain"
                  />
                </View>
                <View style={{ alignItems: 'center', marginTop: 14 }}>
                  <Text style={styles.myQrNameText}>{user?.name || 'Risev Member'}</Text>
                  <Text style={styles.myQrPhoneText}>{user?.phone || user?.id || ''}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.pillBackBtn}
                onPress={() => setScanMode('menu')}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-back" size={16} color="#000000" />
                <Text style={styles.pillBackBtnText}>Choose Another Method</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* NFC Radar Scanning Mode */}
          {scanMode === 'nfc' && (() => {
            const scale1 = pulseAnim1.interpolate({
              inputRange: [0, 1],
              outputRange: [0.9, 1.8],
            });
            const opacity1 = pulseAnim1.interpolate({
              inputRange: [0, 0.8, 1],
              outputRange: [0.6, 0.4, 0],
            });

            const scale2 = pulseAnim2.interpolate({
              inputRange: [0, 1],
              outputRange: [0.9, 1.8],
            });
            const opacity2 = pulseAnim2.interpolate({
              inputRange: [0, 0.8, 1],
              outputRange: [0.6, 0.4, 0],
            });

            return (
              <View style={styles.scanContainer}>
                <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  {/* Glowing Radar Ripple 1 */}
                  <Animated.View style={{
                    position: 'absolute',
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    borderWidth: 1.5,
                    borderColor: '#FFCC00',
                    shadowColor: '#FFCC00',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 10,
                    transform: [{ scale: scale1 }],
                    opacity: opacity1,
                  }} />

                  {/* Glowing Radar Ripple 2 */}
                  <Animated.View style={{
                    position: 'absolute',
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    borderWidth: 1.5,
                    borderColor: '#FFCC00',
                    shadowColor: '#FFCC00',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 10,
                    transform: [{ scale: scale2 }],
                    opacity: opacity2,
                  }} />

                  {/* Central Phone Hub */}
                  <View style={styles.nfcHubInner}>
                    <Ionicons name="phone-portrait-outline" size={38} color="#FFCC00" />
                  </View>
                </View>

                <Text style={styles.scanPrompt}>Hold phone near NFC tag</Text>
                <Text style={styles.scanInstructions}>
                  Place the top back of your device close to the counter sticker to load store stamps.
                </Text>

                <TouchableOpacity 
                  style={styles.pillBackBtn}
                  onPress={() => setScanMode('menu')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-back" size={16} color="#000000" />
                  <Text style={styles.pillBackBtnText}>Choose Another Method</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* QR Camera Scanner Mode */}
          {scanMode === 'qr' && (
            <View style={styles.qrContainer}>
              {permission?.granted ? (
                <View style={styles.cameraBox}>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={handleBarCodeScanned}
                  >
                    <View style={styles.scannerOverlay}>
                      <View style={styles.scanTargetBox}>
                        <View style={[styles.cornerBracket, styles.topLeft]} />
                        <View style={[styles.cornerBracket, styles.topRight]} />
                        <View style={[styles.cornerBracket, styles.bottomLeft]} />
                        <View style={[styles.cornerBracket, styles.bottomRight]} />
                      </View>
                    </View>
                  </CameraView>
                </View>
              ) : (
                <View style={styles.permissionFallback}>
                  <Ionicons name="camera-outline" size={36} color="rgba(0,0,0,0.4)" style={{ marginBottom: 12 }} />
                  <Text style={styles.fallbackText}>Camera access is required to scan store QR codes.</Text>
                  <TouchableOpacity style={styles.permissionBtn} onPress={startQrScanner}>
                    <Text style={styles.permissionBtnText}>Allow Camera Access</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.scanPrompt}>Align QR code within the viewfinder</Text>
              
              <TouchableOpacity 
                style={styles.pillBackBtn}
                onPress={() => setScanMode('menu')}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-back" size={16} color="#000000" />
                <Text style={styles.pillBackBtnText}>Choose Another Method</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHandleBar: {
    width: 38,
    height: 4.5,
    borderRadius: 99,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.5,
  },
  sheetSubtitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(0, 0, 0, 0.55)',
    marginTop: 2,
    lineHeight: 18,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  instantBadge: {
    backgroundColor: '#FFCC00',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  instantBadgeText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.4,
  },
  neutralBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  neutralBadgeText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    letterSpacing: 0.3,
  },
  optionDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(0, 0, 0, 0.55)',
    lineHeight: 16,
  },
  tipNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 4,
  },
  tipNoteText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(0, 0, 0, 0.45)',
  },
  // My QR Pass Styles
  myQrContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
  },
  myQrCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    marginBottom: 16,
  },
  myQrImageWrap: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  myQrNameText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  myQrPhoneText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(0, 0, 0, 0.5)',
    marginTop: 2,
  },
  pillBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  pillBackBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  // NFC Radar Scanner Styles
  scanContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 20,
  },
  nfcHubInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFCC00',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  scanPrompt: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    marginBottom: 6,
    textAlign: 'center',
  },
  scanInstructions: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(0, 0, 0, 0.55)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  // QR Camera Scanner Styles
  qrContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  cameraBox: {
    width: '100%',
    height: 250,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 16,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTargetBox: {
    width: 170,
    height: 170,
    position: 'relative',
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFCC00',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  permissionFallback: {
    width: '100%',
    height: 240,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  fallbackText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#000000',
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  permissionBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
