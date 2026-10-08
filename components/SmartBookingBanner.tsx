import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';

type SmartBookingBannerProps = {
  onPress: () => void;
  hasAccess?: boolean;
  isOptedIn?: boolean;
  style?: StyleProp<ViewStyle>;
  targetDate?: Date;
};

export default function SmartBookingBanner({
  onPress,
  hasAccess = false,
  isOptedIn = false,
  style,
  targetDate,
}: SmartBookingBannerProps) {
  const { locale } = useLanguage();
  const isMalay = locale === 'ms';
  // Live Countdown Timer state (seconds included for real-time live ticking)
  const [timeLeft, setTimeLeft] = useState({ days: '02', hours: '14', minutes: '31', seconds: '59' });

  useEffect(() => {
    // Default launch time: Oct 10 or 2 days, 14 hours, 31 minutes from current time
    const launchTime = targetDate
      ? targetDate.getTime()
      : new Date().getTime() + (2 * 24 * 3600 + 14 * 3600 + 31 * 60) * 1000;

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, launchTime - now);

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        days: String(d).padStart(2, '0'),
        hours: String(h).padStart(2, '0'),
        minutes: String(m).padStart(2, '0'),
        seconds: String(s).padStart(2, '0'),
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000); // 1-second live countdown interval
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.container, style]}>
      <LinearGradient
        colors={['#7E22CE', '#EC4899', '#FF6B00']}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.gradientCard}
      >
        {/* Background Ambient Decorative Elements */}
        <View style={styles.bgGlowHalo} />
        <View style={styles.bgWaveRight} />

        <View style={styles.mainRow}>
          {/* Left Icon Container */}
          <View style={styles.iconWrapper}>
            <View style={styles.iconGlowHalo} />
            <View style={styles.iconSparkle}>
              <Ionicons name="sparkles" size={13} color="#FFD700" />
            </View>

            <View style={styles.glassIconBox}>
              <LinearGradient
                colors={['#E11D48', '#C084FC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Ionicons name="calendar" size={22} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </View>

          {/* Middle Content */}
          <View style={styles.contentSection}>
            {/* Title + Gold Badge Row */}
            <View style={styles.titleRow}>
              <Text style={styles.titleText}>Smart Booking</Text>
              {!hasAccess && (
                <View style={styles.goldBadge}>
                  <Ionicons name="ribbon" size={10} color="#000000" />
                  <Text style={styles.goldBadgeText}>{isMalay ? '7 HARI PERCUMA' : '7 DAYS FREE'}</Text>
                </View>
              )}
            </View>

            {/* Headline Benefit */}
            <Text style={styles.headlineText}>
              {isMalay ? 'Pelanggan boleh tempah 24/7' : 'Let customers book you 24/7'}
            </Text>

            {/* Clean Subtitle */}
            <Text style={styles.subdetailText} numberOfLines={1}>
              {isMalay ? 'Temujanji & peringatan automatik' : 'Automated appointments & reminders'}
            </Text>
          </View>

          {/* Right Action & Countdown Section */}
          <View style={styles.rightSection}>
            {/* Live Countdown Box */}
            <View style={styles.countdownPill}>
              <View style={styles.launchTag}>
                <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                <Text style={styles.launchTagText}>{isMalay ? 'Pelancaran dlm' : 'Launch in'}</Text>
              </View>

              {/* Ticking Digits */}
              <View style={styles.digitsRow}>
                <View style={styles.digitUnit}>
                  <Text style={styles.digitValue}>{timeLeft.days}</Text>
                  <Text style={styles.digitUnitLabel}>{isMalay ? 'H' : 'D'}</Text>
                </View>
                <Text style={styles.colon}>:</Text>

                <View style={styles.digitUnit}>
                  <Text style={styles.digitValue}>{timeLeft.hours}</Text>
                  <Text style={styles.digitUnitLabel}>{isMalay ? 'J' : 'H'}</Text>
                </View>
                <Text style={styles.colon}>:</Text>

                <View style={styles.digitUnit}>
                  <Text style={styles.digitValue}>{timeLeft.minutes}</Text>
                  <Text style={styles.digitUnitLabel}>M</Text>
                </View>
              </View>
            </View>

            {/* CTA Button */}
            <View style={styles.ctaButton}>
              <Text style={styles.ctaButtonText}>
                {hasAccess
                  ? (isMalay ? 'Buka ➔' : 'Open ➔')
                  : isOptedIn
                    ? (isMalay ? 'VIP Dikunci ➔' : 'VIP Locked ➔')
                    : (isMalay ? 'Akses Awal ➔' : 'Early Access ➔')}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: -4,
    marginBottom: 2,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 7,
  },
  gradientCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlowHalo: {
    position: 'absolute',
    left: -20,
    top: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  bgWaveRight: {
    position: 'absolute',
    right: -30,
    bottom: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ rotate: '25deg' }],
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    position: 'relative',
  },
  iconGlowHalo: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  iconSparkle: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 6,
  },
  glassIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 11.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentSection: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  titleText: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFC700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  goldBadgeText: {
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.3,
  },
  headlineText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  subdetailText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  countdownPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingTop: 14,
    paddingBottom: 4,
    alignItems: 'center',
    position: 'relative',
  },
  launchTag: {
    position: 'absolute',
    top: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  launchTagText: {
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  digitUnit: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    minWidth: 20,
  },
  digitValue: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    lineHeight: 12,
  },
  digitUnitLabel: {
    fontSize: 7.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    marginTop: -1,
  },
  colon: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  ctaButton: {
    backgroundColor: '#090A0F',
    paddingHorizontal: 10,
    paddingVertical: 6.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaButtonText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
});
