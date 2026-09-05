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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';

interface CustomerStampModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CustomerStampModal({ visible, onClose }: CustomerStampModalProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  
  // 'menu' | 'nfc' | 'qr'
  const [scanMode, setScanMode] = useState<'menu' | 'nfc' | 'qr'>('menu');
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
            backgroundColor: scanMode === 'nfc' ? '#09090B' : '#FFFFFF'
          }
        ]}>
          
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: scanMode === 'nfc' ? '#FFFFFF' : '#0F172A' }]}>
              {scanMode === 'menu' && 'Stamp Your Card'}
              {scanMode === 'nfc' && 'Ready to Scan NFC'}
              {scanMode === 'qr' && 'Scan Store QR'}
            </Text>
            <TouchableOpacity 
              onPress={handleClose} 
              style={[styles.closeBtn, { backgroundColor: scanMode === 'nfc' ? '#27272A' : '#F1F5F9' }]}
            >
              <Ionicons name="close" size={22} color={scanMode === 'nfc' ? '#FFFFFF' : '#1E293B'} />
            </TouchableOpacity>
          </View>

          {/* Menu Option Mode */}
          {scanMode === 'menu' && (
            <View style={styles.menuContainer}>
              <Text style={styles.menuSubtitle}>
                Choose how you want to collect your stamp at the counter.
              </Text>

              {/* NFC Option */}
              <TouchableOpacity 
                style={[styles.optionCard, { borderColor: '#FFE38F', backgroundColor: '#FFFBEA' }]}
                onPress={() => setScanMode('nfc')}
                activeOpacity={0.8}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#FFC700' }]}>
                  <Ionicons name="wifi-outline" size={24} color="#1A1400" style={{ transform: [{ rotate: '90deg' }] }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: '#806400' }]}>Tap NFC Reader</Text>
                  <Text style={[styles.optionDesc, { color: '#806400', opacity: 0.8 }]}>Hold your device near the shop's NFC counter card.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#806400" />
              </TouchableOpacity>

              {/* QR Option */}
              <TouchableOpacity 
                style={[styles.optionCard, { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }]}
                onPress={startQrScanner}
                activeOpacity={0.8}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#1E293B' }]}>
                  <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: '#1E293B' }]}>Scan QR Code</Text>
                  <Text style={[styles.optionDesc, { color: '#64748B' }]}>Use your phone camera to scan counter QR card.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
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
                <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
                  {/* Glowing Radar Ripple 1 */}
                  <Animated.View style={{
                    position: 'absolute',
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    borderWidth: 1.5,
                    borderColor: '#FFC700',
                    shadowColor: '#FFC700',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.6,
                    shadowRadius: 12,
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
                    borderColor: '#FFC700',
                    shadowColor: '#FFC700',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.6,
                    shadowRadius: 12,
                    transform: [{ scale: scale2 }],
                    opacity: opacity2,
                  }} />

                  {/* Static Center Phone Hub */}
                  <View style={[styles.nfcVisualInner, { backgroundColor: '#1A1400', borderWidth: 1.5, borderColor: '#FFC700' }]}>
                    <Ionicons name="phone-portrait-outline" size={42} color="#FFC700" />
                  </View>
                </View>

                <Text style={[styles.scanPrompt, { color: '#FFFFFF' }]}>Hold phone near NFC tag</Text>
                <Text style={[styles.scanInstructions, { color: '#94A3B8' }]}>
                  Place the top back corner of your device close to the counter sticker to load store stamps.
                </Text>

                <TouchableOpacity 
                  style={styles.backBtn}
                  onPress={() => setScanMode('menu')}
                >
                  <Text style={[styles.backBtnText, { color: '#FFC700' }]}>Choose another method</Text>
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
                  <Text style={styles.fallbackText}>Camera permissions are required to scan QR codes.</Text>
                  <TouchableOpacity style={styles.permissionBtn} onPress={startQrScanner}>
                    <Text style={styles.permissionBtnText}>Allow Camera Access</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.scanPrompt}>Align QR code in viewfinder</Text>
              
              <TouchableOpacity 
                style={styles.backBtn}
                onPress={() => setScanMode('menu')}
              >
                <Text style={styles.backBtnText}>Go Back</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContainer: {
    paddingHorizontal: 24,
    gap: 16,
    marginTop: 8,
  },
  menuSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    lineHeight: 16,
  },
  scanContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingVertical: 24,
  },
  nfcVisualOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFBEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  nfcVisualMiddle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFF1C5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcVisualInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE38F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanPrompt: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  scanInstructions: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  qrContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingBottom: 8,
  },
  cameraBox: {
    width: '100%',
    height: 260,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 20,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTargetBox: {
    width: 180,
    height: 180,
    position: 'relative',
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFC700',
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
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  fallbackText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  permissionBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
