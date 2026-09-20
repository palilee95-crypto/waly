// components/PushNotificationPrompt.tsx
// Merchant banner to enable Web Push notifications for real-time NFC claim alerts

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, shadows } from '@/theme';
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
        setSuccessMessage('Notifications enabled! You will be alerted when customers tap NFC.');
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
        <View style={styles.successIconWrapper}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success.DEFAULT} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.successTitle}>Notifications Active 🔔</Text>
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
          <Ionicons name="notifications" size={22} color={colors.primary.DEFAULT} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.title}>Never Miss an NFC Tap</Text>
          <Text style={styles.description}>
            Enable device notifications to get alerted with sound & vibration even when your screen is locked.
          </Text>
        </View>
        <TouchableOpacity style={styles.closeIcon} onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={18} color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss} disabled={loading}>
          <Text style={styles.dismissText}>Maybe Later</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.enableButton} onPress={handleEnable} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <>
              <Ionicons name="notifications-outline" size={16} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.enableText}>Enable Notifications</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A', // Dark sleek slate
    borderRadius: radii.lg,
    padding: spacing[4],
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: '#334155',
    ...shadows.md,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 199, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  textWrapper: {
    flex: 1,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  description: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  closeIcon: {
    padding: 2,
    marginLeft: spacing[2],
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  dismissButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.md,
  },
  dismissText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#94A3B8',
  },
  enableButton: {
    backgroundColor: colors.primary.DEFAULT,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enableText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#000000',
  },
  successContainer: {
    backgroundColor: '#064E3B', // Deep green
    borderRadius: radii.lg,
    padding: spacing[3.5],
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#059669',
  },
  successIconWrapper: {
    marginRight: spacing[3],
  },
  successTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  successBody: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: '#A7F3D0',
    marginTop: 1,
  },
  testButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    marginLeft: spacing[2],
  },
  testButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },
});
