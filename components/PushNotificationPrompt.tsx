// components/PushNotificationPrompt.tsx
// Merchant banner to enable Web Push notifications for real-time NFC claim alerts

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import {
  isPushSupported,
  getPushPermissionStatus,
  subscribeToPushNotifications,
  sendTestPushNotification,
  PushPermissionStatus,
} from '@/lib/push-notifications';
import { playClaimChime } from '@/lib/audioChime';

interface PushNotificationPromptProps {
  merchantId?: string;
  branchId?: string;
  onDismiss?: () => void;
}

export default function PushNotificationPrompt({
  merchantId,
  branchId,
  onDismiss,
}: PushNotificationPromptProps) {
  const [status, setStatus] = useState<PushPermissionStatus>('unsupported');
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isPushSupported()) {
      setStatus(getPushPermissionStatus());
    }
  }, []);

  // Do not render if push is not supported, already granted (and no recent success), or dismissed
  if (dismissed || status === 'unsupported' || (status === 'granted' && !successMessage)) {
    return null;
  }

  const handleEnable = async () => {
    try {
      setLoading(true);
      // Play a quick chime to unlock audio context
      playClaimChime();

      const result = await subscribeToPushNotifications({ merchantId, branchId });
      if (result.success) {
        setStatus('granted');
        setSuccessMessage('Real-time alerts active! Sound will chime on every NFC claim.');
        // Auto-dismiss success message after 5 seconds
        setTimeout(() => {
          setDismissed(true);
        }, 5000);
      } else {
        setStatus(getPushPermissionStatus());
      }
    } catch (err) {
      console.error('Error enabling push notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  const handleTestNotification = async () => {
    playClaimChime();
    await sendTestPushNotification();
  };

  if (successMessage) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={20} color="#22C55E" style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.successTitle}>Alerts Active 🔔</Text>
          <Text style={styles.successBody}>{successMessage}</Text>
        </View>
        <TouchableOpacity style={styles.testButton} onPress={handleTestNotification}>
          <Text style={styles.testButtonText}>Test Chime</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="notifications" size={18} color="#FFC700" />
        </View>

        <View style={styles.textWrapper}>
          <Text style={styles.title}>Enable NFC Tap Alerts</Text>
          <Text style={styles.description}>
            Get instant sound & lock-screen alerts whenever a customer claims stamps at your stand.
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.closeIcon} 
          onPress={handleDismiss} 
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity onPress={handleDismiss} disabled={loading} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>Maybe later</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.enableButton, loading && { opacity: 0.8 }]} 
          onPress={handleEnable} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text style={styles.enableText}>Enable Alerts</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D0D0E',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 199, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textWrapper: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14.5,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  description: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 17,
  },
  closeIcon: {
    padding: 2,
  },

  /* Action Buttons */
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 14,
    gap: 16,
  },
  dismissBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  dismissText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    color: '#9CA3AF',
  },
  enableButton: {
    backgroundColor: colors.primary.DEFAULT,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enableText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: '#000000',
  },

  /* Success Banner State */
  successContainer: {
    backgroundColor: '#0B1A12',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  successTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  successBody: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: '#86EFAC',
  },
  testButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    marginLeft: 10,
  },
  testButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11.5,
    color: '#FFFFFF',
  },
});

