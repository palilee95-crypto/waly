import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type NotificationType = 'points' | 'reward' | 'campaign' | 'tier' | 'badge' | 'voucher' | 'system';

interface NotificationBannerProps {
  visible: boolean;
  title: string;
  body: string;
  type: NotificationType;
  onDismiss: () => void;
}

export default function NotificationBanner({ visible, title, body, type, onDismiss }: NotificationBannerProps) {
  const translateY = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 20,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        dismissBanner();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-150);
    }
  }, [visible]);

  const dismissBanner = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  const getIcon = () => {
    switch (type) {
      case 'points': return { name: 'star', color: '#D97706', bg: '#FEF3C7' };
      case 'reward': return { name: 'gift', color: '#059669', bg: '#D1FAE5' };
      case 'campaign': return { name: 'megaphone', color: '#DC2626', bg: '#FEE2E2' };
      case 'tier': return { name: 'trophy', color: '#7C3AED', bg: '#F5F3FF' };
      case 'badge': return { name: 'medal', color: '#2563EB', bg: '#DBEAFE' };
      case 'voucher': return { name: 'ticket', color: '#0D9488', bg: '#CCFBF1' };
      default: return { name: 'notifications', color: '#4B5563', bg: '#F3F4F6' };
    }
  };

  const iconInfo = getIcon();

  return (
    <Animated.View style={[styles.bannerContainer, { transform: [{ translateY }] }]}>
      <TouchableOpacity style={styles.bannerContent} onPress={dismissBanner} activeOpacity={0.9}>
        <View style={[styles.iconWrapper, { backgroundColor: iconInfo.bg }]}>
          <Ionicons name={iconInfo.name as any} size={20} color={iconInfo.color} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
          <Text style={styles.bodyText} numberOfLines={2}>{body}</Text>
        </View>
        <Ionicons name="close" size={16} color="#9CA3AF" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  bannerContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrapper: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    gap: 2,
  },
  titleText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  bodyText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#6B7280',
    lineHeight: 15,
  },
});
