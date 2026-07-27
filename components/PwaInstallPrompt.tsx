import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // 1. Check if app is already running as standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (isStandalone) return;

    // 2. Check if user already dismissed prompt recently (24h cooldown)
    const lastDismissed = localStorage.getItem('risev_pwa_dismissed');
    if (lastDismissed) {
      const elapsed = Date.now() - parseInt(lastDismissed, 10);
      if (elapsed < 24 * 60 * 60 * 1000) return; // 24h cooldown
    }

    // 3. iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    if (isIosDevice) {
      // Show iOS instruction prompt after a short 2s delay
      const timer = setTimeout(() => setShowPrompt(true), 2000);
      return () => clearTimeout(timer);
    }

    // 4. Android / Chrome / Desktop beforeinstallprompt Listener
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('risev_pwa_dismissed', String(Date.now()));
    }
  };

  if (!showPrompt) return null;

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.bannerCard}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="phone-portrait-outline" size={26} color="#F4A825" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Install WALY Mobile App</Text>
            <Text style={styles.bannerSubtitle}>Get instant stamp notifications & 1-tap card access</Text>
          </View>
        </View>

        {isIos ? (
          /* iOS Step-by-Step Instructions */
          <View style={styles.iosBox}>
            <Text style={styles.iosInstructionTitle}>To install on iPhone / iPad:</Text>
            <View style={styles.iosStepRow}>
              <Text style={styles.iosStepNum}>1</Text>
              <Text style={styles.iosStepText}>
                Tap the <Text style={{ fontWeight: '700' }}>Share</Text> button <Ionicons name="share-outline" size={14} color="#3B82F6" /> at bottom of Safari
              </Text>
            </View>
            <View style={styles.iosStepRow}>
              <Text style={styles.iosStepNum}>2</Text>
              <Text style={styles.iosStepText}>
                Scroll down & select <Text style={{ fontWeight: '700' }}>Add to Home Screen ➕</Text>
              </Text>
            </View>
          </View>
        ) : (
          /* Android / Chrome Direct Install Button */
          <TouchableOpacity style={styles.installBtn} onPress={handleInstallClick} activeOpacity={0.85}>
            <Ionicons name="download-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.installBtnText}>Install App to Home Screen</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  bannerCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1E1442',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(244, 168, 37, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
    paddingRight: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 168, 37, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#CBD5E1',
  },
  installBtn: {
    backgroundColor: '#5C3BCC',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  installBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  iosBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  iosInstructionTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F4A825',
  },
  iosStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iosStepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5C3BCC',
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
    lineHeight: 20,
  },
  iosStepText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#E2E8F0',
    flex: 1,
  },
});
