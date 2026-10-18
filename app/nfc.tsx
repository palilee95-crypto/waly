import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  useWindowDimensions,
  Image,
  ImageBackground,
  Animated,
  Easing,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { formatMalaysianPhone } from '@/lib/emailValidator';
import { getRewardVisualUrl } from '@/lib/rewardVisuals';
import { getVoucherSpineTheme } from '@/theme';
import * as Clipboard from 'expo-clipboard';
import BranchFormModal, { StaffOption } from '@/components/BranchFormModal';

const stampIcons = [
  { id: 'ticket', family: 'Ionicons', name: 'ticket-sharp' },
  { id: 'star', family: 'FontAwesome', name: 'star' },
  { id: 'heart', family: 'Ionicons', name: 'heart' },
  { id: 'coffee', family: 'MaterialIcons', name: 'local-cafe' },
  { id: 'cake', family: 'MaterialIcons', name: 'cake' },
  { id: 'restaurant', family: 'Ionicons', name: 'restaurant' },
  { id: 'tag', family: 'Ionicons', name: 'pricetag' },
  { id: 'gift', family: 'Ionicons', name: 'gift' },
  { id: 'beer', family: 'Ionicons', name: 'beer' },
  { id: 'pizza', family: 'Ionicons', name: 'pizza' },
  { id: 'card', family: 'Ionicons', name: 'card' },
  { id: 'store', family: 'Ionicons', name: 'storefront' },
  { id: 'car', family: 'Ionicons', name: 'car-sport' },
  { id: 'icecream', family: 'Ionicons', name: 'ice-cream' },
  { id: 'barbell', family: 'Ionicons', name: 'barbell' },
  { id: 'scissors', family: 'Ionicons', name: 'scissors' },
  { id: 'bag', family: 'Ionicons', name: 'bag-handle' },
  { id: 'sparkles', family: 'Ionicons', name: 'sparkles' },
];

const renderStampIcon = (iconId: string, size: number, color: string) => {
  const icon = stampIcons.find(i => i.id === iconId) || stampIcons.find(i => i.id === 'coffee')!;
  if (icon.family === 'Ionicons') {
    return <Ionicons name={icon.name as any} size={size} color={color} />;
  }
  if (icon.family === 'FontAwesome') {
    return <FontAwesome name={icon.name as any} size={size} color={color} />;
  }
  if (icon.family === 'MaterialIcons') {
    return <MaterialIcons name={icon.name as any} size={size} color={color} />;
  }
  return <Ionicons name="cafe" size={size} color={color} />;
};

// ─── Animated Stamp Bubble ──────────────────────────────────────────────────
// Plays a "physical ink press" animation when a new stamp is freshly earned.
interface AnimatedStampBubbleProps {
  isEarned: boolean;
  isNew: boolean;           // true = just received this session
  delay: number;            // stagger delay in ms
  iconId: string;
  bubbleColor: string;      // filled bg color
  iconColor: string;        // icon tint
  borderColor: string;
  emptyBgColor: string;
  isMilestone?: boolean;
  milestoneNumber?: number;
  isFinalGoal?: boolean;
}

const AnimatedStampBubble: React.FC<AnimatedStampBubbleProps> = ({
  isEarned,
  isNew,
  delay,
  iconId,
  bubbleColor,
  iconColor,
  borderColor,
  emptyBgColor,
  isMilestone,
  milestoneNumber,
  isFinalGoal,
}) => {
  const scaleAnim = useRef(new Animated.Value(isNew ? 2.5 : 1.0)).current;
  const ringScale = useRef(new Animated.Value(1.0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (isNew && !hasAnimated.current) {
      hasAnimated.current = true;
      const timeout = setTimeout(() => {
        // 1. Slow spring slam: scale 2.5x → 1x
        Animated.spring(scaleAnim, {
          toValue: 1.0,
          friction: 12,
          tension: 40,
          useNativeDriver: true,
        }).start();

        // 2. Ring burst: expand ring and fade
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 2.0, duration: 900, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          ]),
        ]).start();
      }, delay);

      return () => clearTimeout(timeout);
    }
  }, [isNew]);

  const activeBorderColor = isEarned
    ? 'transparent'
    : isMilestone
    ? '#FFCC00'
    : borderColor;

  const activeBgColor = isEarned
    ? bubbleColor
    : isMilestone
    ? 'rgba(255, 204, 0, 0.15)'
    : emptyBgColor;

  return (
    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      {/* Ring burst overlay */}
      {isNew && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: '80%',
            aspectRatio: 1,
            borderRadius: 99,
            borderWidth: 2.5,
            borderColor: bubbleColor,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
      )}

      {/* Stamp bubble */}
      <Animated.View
        style={{
          width: '80%',
          aspectRatio: 1,
          borderRadius: 99,
          borderWidth: isEarned ? 0 : 1.5,
          borderColor: activeBorderColor,
          borderStyle: isEarned ? 'solid' : 'dashed',
          backgroundColor: activeBgColor,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: scaleAnim }],
          position: 'relative',
        }}
      >
        {isEarned ? (
          <>
            {renderStampIcon(iconId, 14, iconColor)}
            {isMilestone && (
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  backgroundColor: '#FFCC00',
                  borderRadius: 6,
                  paddingHorizontal: 2.5,
                  paddingVertical: 1,
                  borderWidth: 1,
                  borderColor: '#000000',
                  zIndex: 10,
                }}
              >
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#000000' }}>🎁</Text>
              </View>
            )}
          </>
        ) : isMilestone ? (
          <>
            <Text style={{ fontSize: 13 }}>🎁</Text>
            {milestoneNumber !== undefined && (
              <View
                style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  backgroundColor: '#FFCC00',
                  borderRadius: 6,
                  paddingHorizontal: 3,
                  paddingVertical: 0.5,
                  borderWidth: 1,
                  borderColor: '#000000',
                  zIndex: 10,
                }}
              >
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#000000' }}>
                  {milestoneNumber}
                </Text>
              </View>
            )}
          </>
        ) : isFinalGoal ? (
          <Ionicons name="ribbon" size={15} color={borderColor} />
        ) : (
          renderStampIcon(iconId, 14, borderColor)
        )}
      </Animated.View>
    </View>
  );
};

// ─── Color Alpha Utility ──────────────────────────────────────────────────
const getHexAlpha = (hex: string, alpha: number) => {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const r = parseInt(c.substring(0, 2), 16) || 0;
  const g = parseInt(c.substring(2, 4), 16) || 0;
  const b = parseInt(c.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

// ─── Liquid Radar Waiting View (Mesmerizing Animation Flow) ─────────────────
interface LiquidRadarWaitingViewProps {
  primaryColor: string;
  merchant: any;
  program: any;
  isApproved: boolean;
  approvedStamps: number | null;
  onViewStampCard: () => void;
  onChangePhone: () => void;
  canBookAppointment?: boolean;
  onBookAppointment?: () => void;
}

const PARTICLES = Array.from({ length: 12 }).map((_, i) => {
  const angle = (i * 30) * (Math.PI / 180);
  const distance = 85 + (i % 3) * 25;
  const colors = ['#10B981', '#F59E0B', '#60A5FA', '#F43F5E', '#A855F7', '#34D399'];
  return {
    key: i,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    color: colors[i % colors.length],
    size: 7 + (i % 3) * 2,
  };
});

const LiquidRadarWaitingView: React.FC<LiquidRadarWaitingViewProps> = ({
  primaryColor,
  merchant,
  program,
  isApproved,
  approvedStamps,
  onViewStampCard,
  onChangePhone,
  canBookAppointment,
  onBookAppointment,
}) => {
  // 1. Radar Pulse Rings
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  // 2. Levitation & Hover
  const floatAnim = useRef(new Animated.Value(0)).current;

  // 3. Beacon & Sync Dots
  const beaconAnim = useRef(new Animated.Value(0.4)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  // 4. Approval Climax
  const orbScaleAnim = useRef(new Animated.Value(1)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const particlesAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse rings loop
    const startPulse = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2500,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startPulse(pulse1, 0);
    startPulse(pulse2, 800);
    startPulse(pulse3, 1600);

    // Floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 8,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Beacon ping
    Animated.loop(
      Animated.sequence([
        Animated.timing(beaconAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(beaconAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // 3-dots wave
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }),
          Animated.delay(700 - delay),
        ])
      ).start();
    };
    animateDot(dot1, 0);
    animateDot(dot2, 220);
    animateDot(dot3, 440);
  }, []);

  // Climax reaction when approved
  useEffect(() => {
    if (isApproved) {
      Animated.sequence([
        Animated.spring(orbScaleAnim, {
          toValue: 1.28,
          friction: 4,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.spring(orbScaleAnim, {
          toValue: 1.0,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.spring(checkmarkScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();

      Animated.timing(particlesAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [isApproved]);

  const renderPulseRing = (anim: Animated.Value, key: number) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.85, 2.7],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.2, 0.75, 1],
      outputRange: [0, 0.75, 0.15, 0],
    });

    return (
      <Animated.View
        key={key}
        pointerEvents="none"
        style={[
          styles.radarPulseRing,
          {
            borderColor: getHexAlpha(primaryColor, 0.75),
            backgroundColor: getHexAlpha(primaryColor, 0.04),
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    );
  };

  const merchantLogoUri = merchant?.logo
    ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
    : null;

  const isPointsOnly = program?.enable_stamps === false && program?.enable_points === true;

  return (
    <View style={styles.radarCardWrap}>
      <BlurView intensity={35} tint="dark" style={styles.radarGlassCard}>
        {/* Stage Area: Radar rings + Orb */}
        <View style={styles.radarStage}>
          {/* Pulsing Concentric Rings */}
          {!isApproved && (
            <>
              {renderPulseRing(pulse1, 1)}
              {renderPulseRing(pulse2, 2)}
              {renderPulseRing(pulse3, 3)}
            </>
          )}

          {/* Confetti Particles on Approval */}
          {isApproved &&
            PARTICLES.map((p) => {
              const translateX = particlesAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, p.x],
              });
              const translateY = particlesAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, p.y],
              });
              const scale = particlesAnim.interpolate({
                inputRange: [0, 0.6, 1],
                outputRange: [0.2, 1.2, 0],
              });
              const opacity = particlesAnim.interpolate({
                inputRange: [0, 0.2, 0.85, 1],
                outputRange: [0, 1, 0.8, 0],
              });

              return (
                <Animated.View
                  key={p.key}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    width: p.size,
                    height: p.size,
                    borderRadius: p.size / 2,
                    backgroundColor: p.color,
                    opacity,
                    transform: [{ translateX }, { translateY }, { scale }],
                  }}
                />
              );
            })}

          {/* Center Glass Orb */}
          <Animated.View
            style={[
              styles.radarCenterOrbWrapper,
              {
                transform: [
                  { translateY: isApproved ? 0 : floatAnim },
                  { scale: orbScaleAnim },
                ],
              },
            ]}
          >
            <BlurView
              intensity={50}
              tint="dark"
              style={[
                styles.radarCenterOrb,
                {
                  backgroundColor: isApproved
                    ? 'rgba(16, 185, 129, 0.25)'
                    : getHexAlpha(primaryColor, 0.35),
                  borderColor: isApproved
                    ? 'rgba(52, 211, 153, 0.6)'
                    : 'rgba(255, 255, 255, 0.4)',
                },
              ]}
            >
              {isApproved ? (
                <Animated.View style={{ transform: [{ scale: checkmarkScale }] }}>
                  <Ionicons name="checkmark-circle" size={68} color="#34D399" />
                </Animated.View>
              ) : merchantLogoUri ? (
                <View style={styles.radarLogoWrap}>
                  <Image
                    source={{ uri: merchantLogoUri }}
                    style={styles.radarLogoImage}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <Ionicons name="storefront" size={46} color="#FFFFFF" />
              )}
            </BlurView>

            {/* Pulsing Live Beacon Indicator (Top-Right of Orb) */}
            {!isApproved && (
              <View style={styles.radarBeaconWrap} pointerEvents="none">
                <Animated.View
                  style={[
                    styles.radarBeaconPing,
                    {
                      opacity: beaconAnim,
                      transform: [
                        {
                          scale: beaconAnim.interpolate({
                            inputRange: [0.3, 1],
                            outputRange: [0.8, 1.8],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <View style={styles.radarBeaconCore} />
              </View>
            )}
          </Animated.View>
        </View>

        {/* Live Status Pill */}
        <View
          style={[
            styles.radarStatusPill,
            isApproved && { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(52, 211, 153, 0.4)' },
          ]}
        >
          <Animated.View
            style={[
              styles.radarStatusDot,
              {
                backgroundColor: isApproved ? '#34D399' : '#10B981',
                opacity: isApproved ? 1 : beaconAnim,
              },
            ]}
          />
          <Text
            style={[
              styles.radarStatusPillText,
              isApproved && { color: '#34D399' },
            ]}
          >
            {isApproved ? (isPointsOnly ? 'POINTS APPROVED' : 'CLAIM APPROVED') : 'WAITING FOR CASHIER'}
          </Text>
        </View>

        {/* Heading & Subtitle */}
        <Text style={styles.radarHeading}>
          {isApproved ? (isPointsOnly ? 'Points Approved! ✨' : 'Stamp Approved! 🎉') : 'Awaiting Cashier Approval...'}
        </Text>
        <Text style={styles.radarSubheading}>
          {isApproved
            ? isPointsOnly
              ? 'Your loyalty points have been credited! Check your card.'
              : typeof approvedStamps === 'number'
                ? `${approvedStamps} Stamps Earned! Check your loyalty card.`
                : 'Your loyalty stamp has been credited!'
            : isPointsOnly
              ? "Please inform the cashier you've sent your points claim."
              : "Please inform the cashier you've sent your stamp claim."}
        </Text>

        {/* Sync 3-dots wave (only while pending) */}
        {!isApproved && (
          <View style={styles.radarDotsWaveRow}>
            <Animated.View style={[styles.radarDotPulse, { opacity: dot1 }]} />
            <Animated.View style={[styles.radarDotPulse, { opacity: dot2 }]} />
            <Animated.View style={[styles.radarDotPulse, { opacity: dot3 }]} />
          </View>
        )}

        {/* Instant Sync Instruction Box */}
        {!isApproved && (
          <View style={styles.radarInstructionBox}>
            <Ionicons name="radio" size={16} color="#34D399" style={{ marginRight: 8 }} />
            <Text style={styles.radarInstructionText}>
              Instant sync active • Keep this screen open
            </Text>
          </View>
        )}

        {/* Approved Action Button */}
        {isApproved && (
          <View style={{ width: '100%', gap: 8, marginTop: 10 }}>
            <TouchableOpacity
              style={styles.radarSuccessBtn}
              onPress={onViewStampCard}
              activeOpacity={0.88}
            >
              <Ionicons name="card" size={20} color="#0F172A" style={{ marginRight: 8 }} />
              <Text style={styles.radarSuccessBtnText}>
                {isPointsOnly ? 'View My Points Card' : 'View My Stamp Card'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#0F172A" style={{ marginLeft: 8 }} />
            </TouchableOpacity>

            {canBookAppointment && onBookAppointment && (
              <TouchableOpacity
                style={[styles.radarSuccessBtn, { backgroundColor: '#10B981' }]}
                onPress={onBookAppointment}
                activeOpacity={0.88}
              >
                <Ionicons name="calendar" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={[styles.radarSuccessBtnText, { color: '#FFFFFF' }]}>
                  Book Next Appointment
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Wrong Phone Number Link */}
        {!isApproved && (
          <TouchableOpacity
            onPress={onChangePhone}
            activeOpacity={0.7}
            style={styles.radarChangePhoneBtn}
          >
            <Ionicons name="create-outline" size={13} color="rgba(255, 255, 255, 0.65)" style={{ marginRight: 5 }} />
            <Text style={styles.radarChangePhoneText}>Wrong phone number? Tap to edit</Text>
          </TouchableOpacity>
        )}
      </BlurView>
    </View>
  );
};

export default function NfcLandingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    m?: string;
    merchant?: string;
    c?: string;
    s?: string;
    code?: string;
    tag?: string;
    b?: string;
    branch?: string;
    preview_step?: string;
    preview_approved?: string;
    preview_declined?: string;
  }>();
  const { user, logout, refreshSession } = useAuth();
  const { locale } = useLanguage();
  const isEn = locale === 'en';
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth > 768;

  // Contrast calculations for text color overlay on dynamic brand primary colors
  const getContrastColor = (hex: string) => {
    if (!hex) return '#FFFFFF';
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16);
      const g = parseInt(cleanHex[1] + cleanHex[1], 16);
      const b = parseInt(cleanHex[2] + cleanHex[2], 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 170 ? '#1A1400' : '#FFFFFF';
    }
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 170 ? '#1A1400' : '#FFFFFF';
    }
    return '#FFFFFF';
  };

  // Helper to format Malaysian phone numbers cleanly (e.g. +60 11-1020 9669)
  const formatDisplayPhone = (raw: string) => {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '').replace(/^60/, '').replace(/^0/, '');
    if (digits.length >= 9) {
      if (digits.startsWith('11') || digits.startsWith('15')) {
        return `+60 ${digits.slice(0, 2)}-${digits.slice(2, 6)} ${digits.slice(6)}`;
      }
      return `+60 ${digits.slice(0, 2)}-${digits.slice(2, 5)} ${digits.slice(5)}`;
    }
    return `+60 ${raw}`;
  };

  const [merchant, setMerchant] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [program, setProgram] = useState<any>(null);
  const [reward, setReward] = useState<any>(null);
  const [loyaltyCard, setLoyaltyCard] = useState<any>(null);
  const [canBookAppointment, setCanBookAppointment] = useState(false);
  const bookingSlug = merchant?.pwa_slug || merchant?.slug || merchant?.id;
  const [approvedStamps, setApprovedStamps] = useState<number | null>(null);
  const [step, setStep] = useState<'loading' | 'form' | 'sent' | 'card' | 'pairing' | 'invalid'>('loading');
  const [invalidReason, setInvalidReason] = useState('');
  
  // Adaptive background brightness (for light vs dark wallpaper contrast)
  const [isLightBg, setIsLightBg] = useState<boolean>(true);
  
  // Digital Receipt state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Loyalty Mode
  const isPointsOnly = program?.enable_stamps === false && program?.enable_points === true;
  const isStampsOnly = program?.enable_stamps !== false && program?.enable_points === false;
  const currentPoints = loyaltyCard?.points_balance ?? user?.total_points ?? 0;

  // Unclaimed stand pairing state
  const [unclaimedStand, setUnclaimedStand] = useState<{ code: string; plan?: string; quota?: number } | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [pairingBranches, setPairingBranches] = useState<any[]>([]);
  const [selectedPairingBranchId, setSelectedPairingBranchId] = useState<string>('');
  const [showAddBranchModal, setShowAddBranchModal] = useState<boolean>(false);
  const [pairingStaff, setPairingStaff] = useState<StaffOption[]>([]);

  const [phoneInput, setPhoneInput] = useState(user?.phone ? user.phone.replace('+60', '').replace('+', '') : '');
  const [nameInput, setNameInput] = useState(user?.name || '');

  const [showNameField, setShowNameField] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Customer active vouchers slide-up modal state
  const [showVoucherPrompt, setShowVoucherPrompt] = useState(false);
  const [availableCustomerVouchers, setAvailableCustomerVouchers] = useState<any[]>([]);
  const [selectedVoucherToUse, setSelectedVoucherToUse] = useState<any>(null);
  const [appliedVoucherForClaim, setAppliedVoucherForClaim] = useState<any>(null);
  
  const pulseAnim = useRef(new Animated.Value(0.2)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Real-time counter waiting animations
  const beaconAnim = useRef(new Animated.Value(0.4)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Beacon breathing loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(beaconAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(beaconAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // 3-dots wave
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }),
          Animated.delay(700 - delay),
        ])
      ).start();
    };
    animateDot(dot1, 0);
    animateDot(dot2, 200);
    animateDot(dot3, 400);
  }, []);

  useEffect(() => {
    if (step === 'pairing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 800, useNativeDriver: true }),
        ])
      ).start();

      if (user?.merchant_id) {
        pb.collection('branches').getFullList({
          filter: `merchant = "${user.merchant_id}"`,
          sort: '-is_hq,-created',
          requestKey: null,
        }).then(list => {
          setPairingBranches(list);
          if (list.length > 0) {
            const hq = list.find(b => b.is_hq) || list[0];
            setSelectedPairingBranchId(hq.id);
          }
        }).catch(() => {});

        pb.collection('users').getFullList({
          filter: `merchant_id = "${user.merchant_id}" && (role = "merchant" || role = "both" || role = "staff")`,
          requestKey: null,
        }).then(users => {
          const ownerName = user?.name || (locale === 'en' ? 'Store Owner' : 'Pemilik Kedai');
          const list: StaffOption[] = [{
            id: user?.id || 'owner_id',
            name: ownerName,
            phone: user?.phone || '',
            role_title: locale === 'en' ? 'Store Owner' : 'Pemilik Kedai',
            is_owner: true,
          }];
          users.forEach((u: any) => {
            const cleanName = (u.name || '').trim();
            if (cleanName && cleanName.toLowerCase() !== ownerName.toLowerCase()) {
              list.push({
                id: u.id,
                name: cleanName,
                phone: u.phone || '',
                role_title: u.role_title || (locale === 'en' ? 'Staff' : 'Staf'),
              });
            }
          });
          setPairingStaff(list);
        }).catch(() => {});
      }
    }
  }, [step, user?.merchant_id]);

  const handleOpenAddBranchModal = async () => {
    let allowed = 2; // Stand Bundle default: 1 HQ + 1 Branch
    try {
      const sub = await pb.collection('subscriptions').getFirstListItem(`merchant = "${user?.merchant_id}"`).catch(() => null);
      if (sub && sub.status === 'active') {
        if (sub.plan === 'pro') allowed = 999;
        else if (sub.plan === 'stand_bundle') allowed = 2;
        else allowed = 1;
      }
    } catch (e) {}

    if (pairingBranches.length >= allowed) {
      Alert.alert(
        locale === 'en' ? 'Branch Limit Reached' : 'Had Cawangan Dicapai',
        locale === 'en'
          ? `Your current plan supports up to ${allowed} outlet(s). Upgrade to PRO for unlimited outlets.`
          : `Pelan semasa anda menyokong sehingga ${allowed} cawangan. Naik taraf ke PRO untuk cawangan tanpa had.`
      );
      return;
    }

    setShowAddBranchModal(true);
  };

  const handleBranchCreated = (newBranch: any) => {
    const branchObj = {
      id: newBranch.id,
      name: newBranch.name,
      address: newBranch.address,
      city: newBranch.city,
      phone: newBranch.phone,
      manager_name: newBranch.manager_name,
      is_hq: Boolean(newBranch.is_hq),
      status: newBranch.status || 'active',
    };
    setPairingBranches((prev) => [...prev, branchObj]);
    setSelectedPairingBranchId(newBranch.id);
    setShowAddBranchModal(false);
  };

  useEffect(() => {
    if (step === 'sent') {
      setShowBack(true);
      rotateAnim.setValue(0);
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [step]);

  // Realtime listening & WhatsApp state
  const [isWaitingConfirm, setIsWaitingConfirm] = useState(false);
  const [claimId, setClaimId] = useState<string>('');
  const claimIdRef = useRef<string>('');
  const stepRef = useRef<string>(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  const hasTriggeredReviewRef = useRef<boolean>(false);
  const [hasSentWhatsapp, setHasSentWhatsapp] = useState<boolean>(false);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [isDeclined, setIsDeclined] = useState<boolean>(false);
  const isDeclinedRef = useRef<boolean>(false);
  const [showBack, setShowBack] = useState<boolean>(false);

  const handleResetToForm = () => {
    setStep('form');
    setIsWaitingConfirm(false);
    setIsApproved(false);
    setIsDeclined(false);
    isDeclinedRef.current = false;
    setShowReviewModal(false);
    setShowRewardModal(false);
    setUnlockedReward(null);
    claimIdRef.current = '';
    setClaimId('');
    hasTriggeredReviewRef.current = false;
  };
  
  // 🌟 Store & Google Review Funnel State
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewFeedback, setReviewFeedback] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // 🎁 Unlocked Milestone or Completed Card Reward Voucher Modal
  const [showRewardModal, setShowRewardModal] = useState<boolean>(false);
  const hasDismissedRewardRef = useRef<boolean>(false);
  const hasShownRewardForClaimRef = useRef<string | null>(null);

  const handleCloseRewardModal = () => {
    hasDismissedRewardRef.current = true;
    setShowRewardModal(false);
  };

  const [unlockedReward, setUnlockedReward] = useState<{
    id?: string;
    code?: string;
    title: string;
    description?: string;
    isMilestone: boolean;
    atStamp?: number;
    discountValue?: number;
    snapshotType?: string;
  } | null>(null);
  const [copiedVoucherCode, setCopiedVoucherCode] = useState<boolean>(false);

  const copyVoucherCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedVoucherCode(true);
      setTimeout(() => setCopiedVoucherCode(false), 2000);
    } catch (e) {
      // ignore
    }
  };

  // Debug/preview support
  useEffect(() => {
    const previewReward = (params as any)?.preview_reward;
    if (params.preview_step === 'sent') {
      setStep('sent');
    }
    if (params.preview_approved === 'true' || params.preview_approved === '1') {
      setIsApproved(true);
    }
    if (params.preview_declined === 'true' || params.preview_declined === '1') {
      isDeclinedRef.current = true;
      setIsDeclined(true);
    }
    if (previewReward === 'milestone') {
      if (!hasDismissedRewardRef.current) {
        setUnlockedReward({
          title: 'Free Artisan Coffee',
          description: 'Milestone Reward for Stamp #5',
          isMilestone: true,
          atStamp: 5,
          code: 'WV-MILE-5555',
        });
        setShowRewardModal(true);
      }
    } else if (previewReward === 'goal') {
      if (!hasDismissedRewardRef.current) {
        setUnlockedReward({
          title: 'Complete Free Meal Voucher',
          description: 'Full Loyalty Card Completion Reward',
          isMilestone: false,
          code: 'WV-GOAL-9999',
        });
        setShowRewardModal(true);
      }
    }
  }, [params.preview_step, params.preview_approved, params.preview_declined, (params as any)?.preview_reward]);
  const [reviewSubmitted, setReviewSubmitted] = useState<boolean>(false);

  // Tracks which stamp slot indices are "newly earned" this session for animation
  const [newlyEarnedIndices, setNewlyEarnedIndices] = useState<Set<number>>(new Set());
  const prevStampsRef = useRef<number>(-1); // -1 = not yet initialised

  const flipAnim = useRef(new Animated.Value(0)).current;
  const voucherSlideAnim = useRef(new Animated.Value(0)).current;
  const voucherProgressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let reviewTimer: any = null;

    if (isApproved && step === 'sent') {
      setShowBack(true);

      const activeClaimId = claimIdRef.current || claimId;
      if (activeClaimId) {
        pb.collection('digital_receipts').getList(1, 1, {
          filter: `customer_phone = "${phoneInput || user?.phone || ''}" && merchant = "${merchant?.id}"`,
          sort: '-created'
        }).then(res => {
          if (res.items.length > 0) setReceiptData(res.items[0]);
        }).catch(() => {});
      }

      Animated.sequence([
        Animated.delay(800), // Delay to let flip and stamp ink finish
        Animated.parallel([
          Animated.spring(voucherSlideAnim, {
            toValue: 1,
            friction: 7,
            tension: 50,
            useNativeDriver: false,
          }),
          Animated.timing(voucherProgressAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          })
        ])
      ]).start();
    } else {
      voucherSlideAnim.setValue(0);
      voucherProgressAnim.setValue(0);
    }

      // Trigger Review Funnel ONLY after merchant approved the claim, and only once per session
      if (isApproved && step === 'sent' && merchant?.id && !hasTriggeredReviewRef.current) {
        hasTriggeredReviewRef.current = true;

        const checkAndTriggerReview = async () => {
          const phone = phoneInput || user?.phone || '';
          const storageKey = `risev_reviewed_${merchant.id}_${phone}`;
          
          let hasReviewedLocal = false;
          if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            hasReviewedLocal = localStorage.getItem(storageKey) === 'true';
          }
          
          if (hasReviewedLocal) return;

          if (phone) {
            try {
              const existing = await pb.collection('store_feedbacks').getList(1, 1, {
                filter: `merchant = "${merchant.id}" && customer_phone = "${phone}"`,
                requestKey: null,
              }).catch(() => null);

              if (existing && existing.items && existing.items.length > 0) {
                if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
                  localStorage.setItem(storageKey, 'true');
                }
                return;
              }
            } catch (e) {}
          }

          // Delay popup ~3.5s to let customer celebrate their stamp and see the voucher progress first
          // If a reward celebration modal was unlocked, skip review modal to avoid stacking popups
          reviewTimer = setTimeout(() => {
            if (!unlockedReward && !showRewardModal) {
              setShowReviewModal(true);
            }
          }, 3500);
        };

        checkAndTriggerReview();
      }

    return () => {
      if (reviewTimer) clearTimeout(reviewTimer);
    };
  }, [isApproved, step, merchant?.id, unlockedReward, showRewardModal]);

  const handleSelectStar = async (star: number) => {
    setReviewRating(star);
    const phone = phoneInput || user?.phone || '';
    const name = nameInput || user?.name || '';
    const storageKey = `risev_reviewed_${merchant?.id}_${phone}`;

    if (star === 5) {
      // 1. Prepare target Google URL (Prioritize outlet-specific Google Review link over general merchant link)
      let targetUrl = (branch?.branch_google_review_url || branch?.google_review_url || merchant?.google_review_url || '').trim();
      if (!targetUrl) {
        const outletName = branch?.branch_name ? `${merchant?.name || ''} ${branch.branch_name}` : merchant?.name;
        const storeName = outletName ? `${outletName} review` : 'google review';
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(storeName)}`;
      } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `https://${targetUrl}`;
      }

      // 2. Open Google Review immediately on user click
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const opened = window.open(targetUrl, '_blank');
          if (!opened || opened.closed || typeof opened.closed === 'undefined') {
            window.location.href = targetUrl;
          }
        } else {
          Linking.openURL(targetUrl).catch(() => {});
        }
      } catch (err) {
        Linking.openURL(targetUrl).catch(() => {});
      }

      // 3. Mark as reviewed locally
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, 'true');
      }

      // 4. Save feedback in database
      if (merchant?.id) {
        const genId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 9);
        pb.collection('store_feedbacks').create({
          id: genId,
          merchant: merchant.id,
          customer_phone: phone,
          customer_name: name,
          rating: 5,
          feedback: '',
          redirected_to_google: true,
        }).catch((err) => {
          console.warn('[STORE FEEDBACK 5-STAR ERROR]', err?.message || err);
        });
      }

      setShowReviewModal(false);
    }
  };

  const handleSubmitPrivateFeedback = async () => {
    if (reviewRating === 0) return;
    setIsSubmittingReview(true);
    const phone = phoneInput || user?.phone || '';
    const name = nameInput || user?.name || '';
    const storageKey = `risev_reviewed_${merchant?.id}_${phone}`;

    try {
      if (merchant?.id) {
        const genId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 9);
        await pb.collection('store_feedbacks').create({
          id: genId,
          merchant: merchant.id,
          customer_phone: phone,
          customer_name: name,
          rating: reviewRating,
          feedback: reviewFeedback.trim(),
          redirected_to_google: false,
        });
      }

      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, 'true');
      }

      setReviewSubmitted(true);
      setTimeout(() => {
        setShowReviewModal(false);
        setReviewSubmitted(false);
      }, 1600);
    } catch (err: any) {
      console.warn('[STORE FEEDBACK SUBMIT ERROR]', err?.message || err);
      setShowReviewModal(false);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: showBack ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [showBack]);

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const handleViewStampCard = () => {
    // Always redirect to login page with phone pre-filled
    // Registered users will see password step; new users will see register step
    const rawPhone = phoneInput || user?.phone || '';
    // Strip country code prefix — login page prepends +60 itself
    const strippedPhone = rawPhone.startsWith('+60')
      ? rawPhone.slice(3)
      : rawPhone.startsWith('60')
      ? rawPhone.slice(2)
      : rawPhone;
    // Also pass the name they typed on the NFC page (if any)
    const prefillName = nameInput.trim() || '';
    router.push({
      pathname: '/(auth)/login' as any,
      params: { prefill_phone: strippedPhone, prefill_name: prefillName },
    });
  };

  const handleClaimVoucherLogin = () => {
    handleCloseRewardModal();
    const isAuthenticated = !!(user || (pb.authStore.isValid && pb.authStore.record));
    if (isAuthenticated) {
      router.push('/(customer)/vouchers' as any);
    } else {
      const rawPhone = phoneInput || '';
      const strippedPhone = rawPhone.startsWith('+60')
        ? rawPhone.slice(3)
        : rawPhone.startsWith('60')
        ? rawPhone.slice(2)
        : rawPhone;
      router.push({
        pathname: '/(auth)/login' as any,
        params: {
          prefill_phone: strippedPhone,
          prefill_name: nameInput.trim() || '',
          redirect_to: '/(customer)/vouchers',
        },
      });
    }
  };

  const handleNavigateToBooking = () => {
    if (!bookingSlug) return;
    const phone = (phoneInput || user?.phone || '').trim();
    const name = (nameInput || user?.name || '').trim();
    const q = new URLSearchParams();
    if (phone) q.append('phone', phone);
    if (name) q.append('name', name);
    q.append('ref', 'nfc_walkin');
    const qs = q.toString();
    router.push(`/b/${bookingSlug}${qs ? `?${qs}` : ''}` as any);
  };

  const handleSendWhatsapp = async () => {
    if (claimId) {
      try {
        await pb.send('/api/risev/nfc/whatsapp-sent', {
          method: 'POST',
          body: { claim_id: claimId },
        });
      } catch (err) {
        console.warn('[NFC] whatsapp-sent endpoint error:', err);
      }
    }
    setHasSentWhatsapp(true);
    if (waUrl) {
      if (Platform.OS === 'web') {
        window.location.href = waUrl;
      } else {
        await Linking.openURL(waUrl);
      }
    }
  };

  // Helper to load Merchant, Loyalty Program & Rewards
  const loadMerchantAndPrograms = async (merchantId: string, isMounted: boolean) => {
    try {
      const m = await pb.collection('merchants').getOne(merchantId, { expand: 'owner' });
      if (!m || m.status === 'suspended' || m.status === 'rejected') {
        if (isMounted) {
          setInvalidReason('This store is currently not accepting stamps.');
          setStep('invalid');
        }
        return;
      }
      if (isMounted) setMerchant(m);

      // Fetch primary loyalty program for this merchant (with linked_reward expansion)
      try {
        const progs = await pb.collection('loyalty_programs').getFullList({
          filter: `merchant = "${merchantId}" && is_active = true`,
          sort: '-created',
          expand: 'linked_reward',
        });
        if (progs.length > 0 && isMounted) {
          const activeProg = progs[0];
          setProgram(activeProg);
          // Prioritize the exact reward linked to this stamp program
          if (activeProg.expand?.linked_reward) {
            setReward(activeProg.expand.linked_reward);
          } else if (activeProg.linked_reward) {
            try {
              const rw = await pb.collection('rewards').getOne(activeProg.linked_reward);
              if (isMounted) setReward(rw);
            } catch (rErr) {}
          } else {
            // Fallback only if program has no linked reward at all
            try {
              const rws = await pb.collection('rewards').getFullList({
                filter: `merchant = "${merchantId}" && is_active = true`,
                sort: '-created',
              });
              if (rws.length > 0 && isMounted) setReward(rws[0]);
            } catch (rErr) {}
          }
        }
      } catch (pErr) {}

      // Check if merchant is eligible for appointment bookings (Pro / Business plan, add-on, or VIP trial)
      try {
        let hasBookingPlan = m.has_booking_addon === true ||
          m.booking_vip_opt_in === true ||
          (m.metadata && (m.metadata.booking_trial_claimed === true || m.metadata.booking_trial_started_at));

        if (!hasBookingPlan) {
          try {
            const subs = await pb.collection('subscriptions').getList(1, 1, {
              filter: `merchant = "${merchantId}" && (status = "active" || status = "trialing")`,
              requestKey: null,
            });
            if (subs.items.length > 0) {
              const plan = (subs.items[0].plan || '').toLowerCase();
              if (plan === 'pro' || plan === 'business') {
                hasBookingPlan = true;
              }
            }
          } catch (subErr) {}
        }

        // Enable walk-in appointment booking if merchant has booking add-on or pwa_slug
        if (hasBookingPlan || m.pwa_slug) {
          if (isMounted) setCanBookAppointment(true);
        }
      } catch (bookErr) {
        console.warn('[NFC] Error checking booking eligibility:', bookErr);
      }

      if (isMounted) {
        setStep((prev) => (prev === 'loading' || prev === 'pairing' ? 'form' : prev));
      }
    } catch (err) {
      if (isMounted) {
        setInvalidReason('Invalid or expired NFC merchant link.');
        setStep('invalid');
      }
    }
  };

  // 1. Fetch & Resolve Stand / Merchant on Mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const getSearchParam = (key: string): string => {
        if (params && (params as any)[key]) return String((params as any)[key]).trim();
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          try {
            const sp = new URLSearchParams(window.location.search);
            const val = sp.get(key);
            if (val) return val.trim();
          } catch (e) {}
        }
        return '';
      };

      const rawCode = (getSearchParam('c') || getSearchParam('s') || getSearchParam('code') || getSearchParam('tag')).toUpperCase();
      const rawMerchantId = getSearchParam('m') || getSearchParam('merchant');

      if (rawCode === 'RSV-8MBE-VG5D' || getSearchParam('preview') === 'stand') {
        if (isMounted) {
          setUnclaimedStand({
            code: rawCode || 'RSV-8MBE-VG5D',
            quota: 500,
            plan: 'stand_bundle',
          });
          setStep('pairing');
        }
        return;
      }

      if (!rawCode && !rawMerchantId) {
        if (isMounted) {
          setInvalidReason('No NFC Stand code or merchant ID provided.');
          setStep('invalid');
        }
        return;
      }

      try {
        const resolveRes = await pb.send<{
          success: boolean;
          is_paired: boolean;
          merchant_id?: string;
          code?: string;
          quota?: number;
          plan?: string;
          branch?: any;
        }>(`/api/risev/nfc/resolve?c=${encodeURIComponent(rawCode)}&m=${encodeURIComponent(rawMerchantId)}`, {
          method: 'GET',
        });

        if (resolveRes.success) {
          if (resolveRes.branch) {
            setBranch(resolveRes.branch);
          }
          if (resolveRes.is_paired && resolveRes.merchant_id) {
            // Paired Stand: load merchant details
            await loadMerchantAndPrograms(resolveRes.merchant_id, isMounted);
          } else {
            // Unpaired Stand (Fresh Out-of-Box: Merchant Pairing Mode)
            if (isMounted) {
              setUnclaimedStand({
                code: resolveRes.code || rawCode,
                quota: resolveRes.quota || 500,
                plan: resolveRes.plan || 'stand_bundle',
              });
              setStep('pairing');
            }
          }
        } else {
          if (isMounted) {
            setInvalidReason('NFC Stand code was not recognized.');
            setStep('invalid');
          }
        }
      } catch (resErr) {
        // Fallback: direct merchant lookup
        if (rawMerchantId) {
          await loadMerchantAndPrograms(rawMerchantId, isMounted);
        } else {
          if (isMounted) {
            setInvalidReason('Invalid or unrecognized NFC Stand link.');
            setStep('invalid');
          }
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [params.m, params.merchant, params.c, params.s, params.code, params.tag]);

  // Merchant Pairing Execution Handler
  const handlePairStand = async () => {
    if (!unclaimedStand?.code) return;
    if (!user) {
      router.push({
        pathname: '/(auth)/login' as any,
        params: { redirect_to: `/nfc?c=${unclaimedStand.code}` },
      });
      return;
    }

    setIsPairing(true);
    try {
      const token = pb.authStore.token;
      const res = await pb.send<{ success: boolean; message: string }>('/api/risev/merchant/redeem-stand-code', {
        method: 'POST',
        body: { 
          code: unclaimedStand.code,
          branch_id: selectedPairingBranchId || undefined
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.success) {
        await refreshSession();
        router.push({
          pathname: '/(merchant)/branches' as any,
          params: {
            linked_stand: unclaimedStand.code,
            branch_id: selectedPairingBranchId || undefined,
          },
        });
      } else {
        alert(res.message || 'Failed to activate stand code.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to pair stand.');
    } finally {
      setIsPairing(false);
    }
  };

  // 2. Fetch User Loyalty Card when Merchant & User are available
  useEffect(() => {
    const merchantId = params.m;
    const customerId = user?.id || pb.authStore.record?.id;
    if (merchantId && customerId) {
      fetchUserLoyaltyCard(merchantId, customerId);
    }
  }, [params.m, user?.id]);

  // 3. Auto-populate phone/name input if user state updates
  useEffect(() => {
    if (user?.phone && !phoneInput) {
      setPhoneInput(user.phone.replace('+60', '').replace('+', ''));
    }
    if (user?.name && !nameInput) {
      setNameInput(user.name);
    }
  }, [user]);

  const fetchUserLoyaltyCard = async (merchantId: string, customerId: string) => {
    try {
      const cards = await pb.collection('loyalty_cards').getFullList({
        filter: `merchant = "${merchantId}" && customer = "${customerId}" && status = "active"`,
        sort: '-updated'
      });
      if (cards.length > 0) {
        setLoyaltyCard(cards[0]);
      }
    } catch (err) {}
  };

  const [waUrl, setWaUrl] = useState('');

  // 2. Realtime SSE Subscriptions for Instant Merchant Confirmation Reveal
  useEffect(() => {
    if (!merchant) return;

    let isSubscribed = true;

    // Subscribe to loyalty_cards updates for this user & merchant
    pb.collection('loyalty_cards').subscribe('*', (e) => {
      if (!isSubscribed) return;
      if (e.action === 'update' || e.action === 'create') {
        const cardRecord = e.record;
        const currentCustId = user?.id || pb.authStore.record?.id;
        if (cardRecord.merchant === merchant.id && currentCustId && cardRecord.customer === currentCustId) {
          setLoyaltyCard(cardRecord);
          if (stepRef.current === 'sent') {
            setIsApproved(true);
            setIsWaitingConfirm(false);
          }
        }
      }
    }, {
      filter: `merchant = "${merchant.id}"`
    }).catch(() => {});

    // Subscribe to transactions updates
    pb.collection('transactions').subscribe('*', (e) => {
      if (!isSubscribed) return;
      if (e.action === 'create') {
        const tx = e.record;
        const currentCustId = user?.id || pb.authStore.record?.id;
        if (tx.merchant === merchant.id && currentCustId && tx.customer === currentCustId) {
          fetchUserLoyaltyCard(merchant.id, currentCustId);
          if (stepRef.current === 'sent') {
            setIsApproved(true);
            setIsWaitingConfirm(false);
          }
        }
      }
    }, {
      filter: `merchant = "${merchant.id}"`
    }).catch(() => {});

    // Subscribe to nfc_claims updates for instant auto-reveal when WhatsApp is verified or merchant approves
    pb.collection('nfc_claims').subscribe('*', (e: any) => {
      if (!isSubscribed) return;
      const record = e.record;
      const activeClaimId = claimIdRef.current || claimId;
      // CRITICAL: Strictly match this customer's active claim ID — never blindly match all claims for the merchant!
      const isThisClaim = Boolean(record && activeClaimId && record.id === activeClaimId);
      if (isThisClaim && !isDeclinedRef.current && (stepRef.current === 'sent' || step === 'sent')) {
        if (record.status === 'pending') {
          setHasSentWhatsapp(true);
        }
        if (record.status === 'cancelled') {
          isDeclinedRef.current = true;
          setIsDeclined(true);
          setIsWaitingConfirm(false);
          return;
        }
        if (record.status === 'completed') {
          if (typeof record.total_stamps === 'number') {
            setApprovedStamps(record.total_stamps);
          } else if (typeof record.stamp_amount === 'number') {
            setApprovedStamps(prev => (prev || 0) + record.stamp_amount);
          }
          const currentCustId = user?.id || pb.authStore.record?.id;
          if (currentCustId) {
            fetchUserLoyaltyCard(merchant.id, currentCustId);
          }
          setIsApproved(true);
          setIsWaitingConfirm(false);

          // Fetch claim-status to check if this completion generated a voucher
          const cid = activeClaimId;
          if (cid) {
            pb.send<any>('/api/risev/nfc/claim-status', {
              method: 'GET',
              params: { claim_id: cid },
              requestKey: null,
            }).then(res => {
              if (res?.earned_voucher) {
                const voucherKey = res.earned_voucher.id || cid;
                if (hasShownRewardForClaimRef.current !== voucherKey && !hasDismissedRewardRef.current) {
                  hasShownRewardForClaimRef.current = voucherKey;
                  setUnlockedReward({
                    id: res.earned_voucher.id,
                    code: res.earned_voucher.code,
                    title: res.earned_voucher.title,
                    description: res.earned_voucher.description,
                    isMilestone: res.earned_voucher.is_sub_reward === true,
                    atStamp: res.earned_voucher.at_stamp,
                    discountValue: res.earned_voucher.discount_value,
                    snapshotType: res.earned_voucher.snapshot_type,
                  });
                  setTimeout(() => {
                    if (!hasDismissedRewardRef.current) {
                      setShowRewardModal(true);
                    }
                  }, 1200);
                }
              }
            }).catch(() => {});
          }
        }
      }
    }, {
      filter: `merchant = "${merchant.id}"`
    }).catch(() => {});

    return () => {
      isSubscribed = false;
      pb.collection('loyalty_cards').unsubscribe('*').catch(() => {});
      pb.collection('transactions').unsubscribe('*').catch(() => {});
      pb.collection('nfc_claims').unsubscribe('*').catch(() => {});
    };
  }, [merchant, user, claimId, step]);

  // 3. Robust Polling & Tab Visibility Listener for Mobile Browsers (iOS Safari / Android Chrome)
  useEffect(() => {
    if (step !== 'sent' || !merchant || isApproved || isDeclined) return;

    let isMounted = true;

    const checkApprovalStatus = async () => {
      if (!isMounted || isApproved || isDeclinedRef.current) return;
      try {
        // 1. Check claim status endpoint
        if (claimId) {
          try {
            const res = await pb.send<any>('/api/risev/nfc/claim-status', {
              method: 'GET',
              params: { claim_id: claimId },
              requestKey: null,
            });
            if (res && res.status === 'cancelled' && isMounted) {
              isDeclinedRef.current = true;
              setIsDeclined(true);
              setIsWaitingConfirm(false);
              return;
            }
            if (res && res.status === 'completed' && isMounted) {
              if (typeof res.total_stamps === 'number') {
                setApprovedStamps(res.total_stamps);
              }
              const currentCustId = user?.id || pb.authStore.record?.id;
              if (currentCustId) {
                await fetchUserLoyaltyCard(merchant.id, currentCustId);
              }
              setIsApproved(true);
              setIsWaitingConfirm(false);

              if (res.earned_voucher) {
                const voucherKey = res.earned_voucher.id || claimId;
                if (hasShownRewardForClaimRef.current !== voucherKey && !hasDismissedRewardRef.current) {
                  hasShownRewardForClaimRef.current = voucherKey;
                  setUnlockedReward({
                    id: res.earned_voucher.id,
                    code: res.earned_voucher.code,
                    title: res.earned_voucher.title,
                    description: res.earned_voucher.description,
                    isMilestone: res.earned_voucher.is_sub_reward === true,
                    atStamp: res.earned_voucher.at_stamp,
                    discountValue: res.earned_voucher.discount_value,
                    snapshotType: res.earned_voucher.snapshot_type,
                  });
                  setTimeout(() => {
                    if (!hasDismissedRewardRef.current) {
                      setShowRewardModal(true);
                    }
                  }, 1200);
                }
              }
              return;
            }
          } catch (cErr) {}
        }

        // 2. Check if customer's loyalty card stamps updated (stamps increased)
        const currentCustId = user?.id || pb.authStore.record?.id;
        if (currentCustId) {
          const cards = await pb.collection('loyalty_cards').getFullList({
            filter: `merchant = "${merchant.id}" && customer = "${currentCustId}"`,
            requestKey: null,
          });
          if (cards.length > 0 && isMounted) {
            const cardRec = cards[0];
            if (loyaltyCard && cardRec.stamps_collected > loyaltyCard.stamps_collected) {
              setLoyaltyCard(cardRec);
              setIsApproved(true);
              setIsWaitingConfirm(false);
            }
          }
        }
      } catch (err) {}
    };

    // Active polling every 2 seconds while waiting for approval
    const interval = setInterval(checkApprovalStatus, 2000);

    // Immediately trigger check when returning from WhatsApp app to browser tab
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkApprovalStatus();
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', checkApprovalStatus);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', checkApprovalStatus);
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      }
    };
  }, [step, merchant, claimId, user, loyaltyCard, isApproved, isDeclined]);

  // Brand Tokens & Assets
  const merchantName = merchant?.name || 'Risev Merchant';
  const merchantPhone = merchant?.phone || merchant?.metadata?.phone || merchant?.expand?.owner?.phone || '';
  
  const merchantLogoUrl = merchant?.logo
    ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}`
    : (merchant?.onboarding_logo_url || null);

  const merchantBgUrl = merchant?.background_image
    ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.background_image}`
    : (merchant?.onboarding_bg_url || null);

  const primaryColor = merchant?.onboarding_primary_color || program?.card_color || '#5C3BCC';
  const contrastTextColor = getContrastColor(primaryColor);

  // Dynamic background luminance detection (analyzes wallpaper to set text/logo to black or white)
  useEffect(() => {
    if (merchantBgUrl && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const img = new (window as any).Image();
        img.crossOrigin = 'anonymous';
        img.src = merchantBgUrl;
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Sample the top 25% where the header sits
              ctx.drawImage(img, 0, 0, img.naturalWidth, Math.min(img.naturalHeight, img.naturalWidth * 0.25), 0, 0, 32, 32);
              const data = ctx.getImageData(0, 0, 32, 32).data;
              let totalBrightness = 0;
              let count = 0;
              for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                totalBrightness += (r * 299 + g * 587 + b * 114) / 1000;
                count++;
              }
              const avg = count > 0 ? totalBrightness / count : 180;
              setIsLightBg(avg >= 145);
            }
          } catch {
            const contrast = getContrastColor(merchant?.onboarding_primary_color || primaryColor || '#FFC700');
            setIsLightBg(contrast === '#1A1400');
          }
        };
        img.onerror = () => {
          const contrast = getContrastColor(merchant?.onboarding_primary_color || primaryColor || '#FFC700');
          setIsLightBg(contrast === '#1A1400');
        };
      } catch {
        setIsLightBg(true);
      }
    } else {
      const colorToCheck = merchant?.onboarding_bg_color || merchant?.onboarding_primary_color || primaryColor || '#FFFFFF';
      const contrast = getContrastColor(colorToCheck);
      setIsLightBg(contrast === '#1A1400');
    }
  }, [merchantBgUrl, merchant, primaryColor]);

  // Adaptive header colors based on background brightness
  const headerTextColor = isLightBg ? '#0F172A' : '#FFFFFF';
  const headerSubtextColor = isLightBg ? 'rgba(15, 23, 42, 0.70)' : 'rgba(255, 255, 255, 0.85)';
  const headerLogoTint = isLightBg ? '#0F172A' : '#FFFFFF';
  
  // Exact Loyalty Card Tokens configured by Merchant
  const cardBgColor = program?.card_color || merchant?.onboarding_primary_color || '#5C3BCC';
  const cardFontColor = program?.font_color || '#FFFFFF';
  const stampColor = program?.stamp_color || '#000000';
  const cardIcon = program?.card_icon || 'coffee';

  const welcomeText = merchant?.onboarding_welcome_text || `Welcome to ${merchantName}! Tap below to claim your stamps.`;
  const stampGoal = program?.stamp_goal || 10;
  const subRewardsList: any[] = useMemo(() => {
    if (!program?.sub_rewards) return [];
    if (Array.isArray(program.sub_rewards)) return program.sub_rewards;
    try {
      return JSON.parse(program.sub_rewards);
    } catch {
      return [];
    }
  }, [program?.sub_rewards]);
  const currentStamps = approvedStamps !== null ? approvedStamps : (loyaltyCard?.stamps_collected || 0);

  // Detect newly-earned stamps and store their 0-based indices for animation
  useEffect(() => {
    if (prevStampsRef.current === -1) {
      // First initialisation — set baseline without animating
      prevStampsRef.current = currentStamps;
      return;
    }
    const prev = prevStampsRef.current;
    if (currentStamps > prev) {
      const newIndices = new Set<number>();
      for (let i = prev; i < currentStamps; i++) {
        newIndices.add(i); // 0-based index of each newly earned slot
      }
      setNewlyEarnedIndices(newIndices);
    }
    prevStampsRef.current = currentStamps;
  }, [currentStamps]);

  // Real Merchant Reward Title & Image Resolution
  const linkedReward = program?.expand?.linked_reward || reward;
  const rewardTitle =
    program?.reward_description ||
    linkedReward?.name ||
    linkedReward?.title ||
    reward?.name ||
    reward?.title ||
    program?.reward_name ||
    'Free Reward';

  const rewardSubtitle =
    (program?.reward_description && linkedReward?.description && !linkedReward.description.startsWith('Reward for completing'))
      ? linkedReward.description
      : (reward?.description && !reward.description.startsWith('Reward for completing'))
      ? reward.description
      : `Collect all ${stampGoal} stamps to unlock this voucher and redeem at counter.`;

  let rewardImageUrl = getRewardVisualUrl(reward) || getRewardVisualUrl(linkedReward) || merchantLogoUrl || '';

  // Trigger celebration modal if milestone or card goal was reached during approval
  useEffect(() => {
    if (!isApproved) return;
    if (unlockedReward) return; // already populated from server response

    const prev = prevStampsRef.current;
    if (prev < 0) return;

    // 1. Check Full Card Completion
    const isCompleted = (currentStamps >= stampGoal && prev < stampGoal) || (currentStamps === 0 && prev > 0);
    if (isCompleted) {
      setUnlockedReward({
        title: rewardTitle || 'Loyalty Reward Voucher',
        description: rewardSubtitle || 'Card Goal Completed!',
        isMilestone: false,
      });
      const timer = setTimeout(() => {
        setShowRewardModal(true);
      }, 1200);
      return () => clearTimeout(timer);
    }

    // 2. Check Intermediate Milestones
    if (subRewardsList && subRewardsList.length > 0) {
      const crossed = subRewardsList.find((sr: any) => {
        const at = parseInt(sr.at_stamp, 10);
        return at && ((prev < at && currentStamps >= at) || currentStamps === at);
      });
      if (crossed) {
        setUnlockedReward({
          title: crossed.reward_title || 'Milestone Reward',
          description: `Reward unlocked for collecting ${crossed.at_stamp} stamps`,
          isMilestone: true,
          atStamp: parseInt(crossed.at_stamp, 10),
        });
        const timer = setTimeout(() => {
          setShowRewardModal(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [isApproved, currentStamps, stampGoal, subRewardsList, unlockedReward, rewardTitle, rewardSubtitle]);

  // 3. Submit Direct NFC Claim & Setup Optional WhatsApp Redirect
  const handleNfcSubmit = async () => {
    if (!phoneInput.trim()) {
      setErrorMsg('Please enter your phone number.');
      return;
    }

    let digits = phoneInput.trim().replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '6' + digits;
    if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
    const cleanPhone = '+' + digits;

    setErrorMsg('');

    if (showNameField && !nameInput.trim()) {
      setErrorMsg('Please enter your full name to complete your claim.');
      return;
    }

    setIsLoading(true);

    try {
      let finalName = nameInput.trim();

      // Always check the entered phone against DB unless:
      // 1. Name field is already showing (user already filled it in), OR
      // 2. The entered phone matches the currently logged-in user's own phone
      const enteredPhoneMatchesUser = user?.phone && (user.phone === cleanPhone || user.phone === cleanPhone.replace('+', ''));
      const shouldCheckPhone = !showNameField && !enteredPhoneMatchesUser;

      if (shouldCheckPhone) {
        setIsCheckingPhone(true);
        try {
          const res = await pb.send<{ exists: boolean; name?: string }>('/api/risev/check-phone', {
            method: 'GET',
            params: { phone: cleanPhone },
            requestKey: null,
          });

          if (res.exists && res.name) {
            finalName = res.name;
          } else if (!res.exists) {
            // New customer — ask for their name
            setShowNameField(true);
            setNameInput('');
            setIsLoading(false);
            setIsCheckingPhone(false);
            return;
          }
        } catch (checkErr) {
          console.warn('[NFC] check-phone error:', checkErr);
        } finally {
          setIsCheckingPhone(false);
        }
      } else if (enteredPhoneMatchesUser && user?.name) {
        finalName = user.name;
      }

      // Fallback name if still empty
      if (!finalName) finalName = 'Customer ' + digits.slice(-4);
      const displayName = finalName;

      // 2. Check if customer has existing active vouchers for this store
      if (!appliedVoucherForClaim) {
        let foundVouchers: any[] = [];

        // Method A: Check client-authenticated user if logged in in this browser session
        const activeUserId = user?.id || pb.authStore.record?.id;
        if (activeUserId) {
          try {
            const vList = await pb.collection('vouchers').getFullList({
              filter: `customer = "${activeUserId}" && status = "active"`,
              expand: 'reward,reward.merchant,campaign,campaign.merchant',
              sort: '-created',
              requestKey: null,
            });

            foundVouchers = vList
              .map((v: any) => {
                const reward = v.expand?.reward;
                const campaign = v.expand?.campaign;
                const mId =
                  reward?.merchant ||
                  reward?.expand?.merchant?.id ||
                  campaign?.merchant ||
                  campaign?.expand?.merchant?.id;

                let meta: any = {};
                try {
                  meta = typeof v.metadata === 'string' ? JSON.parse(v.metadata) : (v.metadata || {});
                } catch (e) {}

                const title =
                  reward?.name ||
                  reward?.title ||
                  campaign?.name ||
                  campaign?.title ||
                  meta.snapshot_title ||
                  'Reward Voucher';
                const description =
                  reward?.description ||
                  campaign?.description ||
                  meta.snapshot_description ||
                  (locale === 'en' ? 'Redeem at counter' : 'Tebus di kaunter');

                return {
                  id: v.id,
                  code: v.code || '',
                  title,
                  description,
                  merchantId: mId,
                  expires_at: v.expires_at || v.valid_until || '',
                };
              })
              .filter((v: any) => !v.merchantId || v.merchantId === merchant?.id);
          } catch (dirErr) {
            console.warn('[NFC] Direct voucher check notice:', dirErr);
          }
        }

        // Method B: Call server endpoint /api/risev/nfc/customer-vouchers (for guest / phone lookup)
        if (foundVouchers.length === 0) {
          try {
            const vCheck = await pb.send<{ success: boolean; vouchers: any[] }>('/api/risev/nfc/customer-vouchers', {
              method: 'POST',
              body: {
                merchant_id: merchant.id,
                phone: cleanPhone,
              },
              requestKey: null,
            });

            if (vCheck?.vouchers && vCheck.vouchers.length > 0) {
              foundVouchers = vCheck.vouchers;
            }
          } catch (vErr) {
            console.warn('[NFC] customer-vouchers server endpoint note:', vErr);
          }
        }

        if (foundVouchers.length > 0) {
          setAvailableCustomerVouchers(foundVouchers);
          setSelectedVoucherToUse(foundVouchers[0]);
          setShowVoucherPrompt(true);
          setIsLoading(false);
          return; // Pause execution to show slide-up modal!
        }
      }

      await executeNfcClaim(cleanPhone, displayName, null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit NFC claim.');
      setIsLoading(false);
    }
  };

  // Helper to execute the actual NFC claim submission to PocketBase
  const executeNfcClaim = async (cleanPhone: string, displayName: string, voucherToApply?: any) => {
    setIsLoading(true);
    let claimSessionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    let createdClaimId = '';
    try {
      const voucherTag = voucherToApply ? ` [VOUCHER:${voucherToApply.id}#${voucherToApply.title || voucherToApply.code || ''}]` : '';
      const encodedName = `${displayName}${voucherTag}`;

      const reqRes = await pb.send<{ success: boolean; claim_id: string; session_code: string; current_stamps?: number }>('/api/risev/nfc/request', {
        method: 'POST',
        body: {
          merchant_id: merchant.id,
          phone: cleanPhone,
          name: encodedName,
          branch_id: branch?.branch_id || params.b || params.branch || undefined,
          branch_name: branch?.branch_name || undefined,
          voucher_id: voucherToApply?.id || undefined,
          voucher_name: voucherToApply?.title || undefined,
          voucher_code: voucherToApply?.code || undefined,
        },
      });
      if (reqRes?.claim_id) {
        claimIdRef.current = reqRes.claim_id;
        setClaimId(reqRes.claim_id);
        createdClaimId = reqRes.claim_id;
      }
      if (reqRes?.session_code) claimSessionCode = reqRes.session_code;
      if (typeof reqRes?.current_stamps === 'number') {
        setApprovedStamps(reqRes.current_stamps);
      }

      setIsApproved(false);
      setShowReviewModal(false);
      setShowRewardModal(false);
      setUnlockedReward(null);
      hasTriggeredReviewRef.current = false;
      setIsWaitingConfirm(true);
      setHasSentWhatsapp(true);
      setStep('sent');
    } catch (apiErr: any) {
      console.warn('[NFC] /api/risev/nfc/request error:', apiErr);
      setErrorMsg(apiErr?.message || 'Failed to submit NFC claim.');
    } finally {
      setIsLoading(false);
    }
  };

  // Customer chooses to redeem selected voucher at counter
  const handleUseVoucherAndProceed = async () => {
    setShowVoucherPrompt(false);
    setAppliedVoucherForClaim(selectedVoucherToUse);

    let digits = phoneInput.trim().replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '6' + digits;
    if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
    const cleanPhone = '+' + digits;
    const displayName = nameInput.trim() || user?.name || ('Customer ' + digits.slice(-4));

    await executeNfcClaim(cleanPhone, displayName, selectedVoucherToUse);
  };

  // Customer chooses to skip voucher and collect stamps only
  const handleDismissVoucherAndProceed = async () => {
    setShowVoucherPrompt(false);
    setAppliedVoucherForClaim(null);

    let digits = phoneInput.trim().replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '6' + digits;
    if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
    const cleanPhone = '+' + digits;
    const displayName = nameInput.trim() || user?.name || ('Customer ' + digits.slice(-4));

    await executeNfcClaim(cleanPhone, displayName, null);
  };

  // ══════════════════════════════════════════════════════════════════
  // RENDER STATES
  // ══════════════════════════════════════════════════════════════════

  if (step === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>Loading store details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // UNCLAIMED STAND ACTIVATION & PAIRING STATE (BLACK IAP STYLE)
  // ══════════════════════════════════════════════════════════════════
  if (step === 'pairing' && unclaimedStand) {
    return (
      <SafeAreaView style={styles.pairingContainer} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={[styles.pairingScrollContent, isDesktop && styles.desktopScrollContent]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.pairingContentCard, isDesktop && styles.pairingDesktopCard]}>
            {/* 1. Row Header (Logo Left, Tap Activation Right) */}
            <View style={styles.pairingHeaderDashboard}>
              <Image
                source={require('../assets/risev logo.png')}
                style={styles.pairingLogo}
                resizeMode="contain"
              />
              <View style={styles.pairingTapBadge}>
                <Ionicons name="radio" size={15} color="#000000" />
                <Text style={styles.pairingTapBadgeText}>Tap Activation</Text>
              </View>
            </View>

            {/* 2. Hero 3D Mockup Container */}
            <View style={styles.pairingHeroContainer}>
              <Image
                source={require('../assets/imej nfc.png')}
                style={styles.pairingHeroImage}
                resizeMode="contain"
              />
            </View>

            {/* 3. Title Section */}
            <View style={styles.pairingTitleSection}>
              <Text style={styles.pairingTitle}>Activate Your Risev Tap</Text>
              <Text style={styles.pairingSubtitle}>
                Pair this physical NFC counter stand to your store to start collecting customer visits and loyalty stamps instantly.
              </Text>
            </View>

            {/* 4. Unified Serial & Hardware Specs Card */}
            <View style={styles.pairingSpecsCard}>
              {/* Top Row: Serial & Official Hardware Badge */}
              <View style={styles.pairingSpecsTopRow}>
                <View>
                  <Text style={styles.pairingSpecsSerialLabel}>STAND ACTIVATION SERIAL</Text>
                  <Text style={styles.pairingSpecsSerialCode}>{unclaimedStand.code}</Text>
                </View>

                <View style={styles.pairingOfficialBadge}>
                  <Ionicons name="checkmark-circle" size={15} color="#15803D" />
                  <Text style={styles.pairingOfficialBadgeText}>Official Hardware</Text>
                </View>
              </View>

              {/* Subtle Horizontal Divider */}
              <View style={styles.pairingSpecsDivider} />

              {/* Bottom Row: 3 Compact Spec Columns */}
              <View style={styles.pairingSpecsGrid}>
                {/* Column 1: Capacity */}
                <View style={styles.pairingSpecCol}>
                  <View style={styles.pairingSpecColHeader}>
                    <Ionicons name="people" size={16} color="#000000" />
                    <Text style={styles.pairingSpecColVal}>
                      {(unclaimedStand?.quota || 500).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.pairingSpecColLabel}>Customer Capacity</Text>
                </View>

                {/* Vertical Divider */}
                <View style={styles.pairingSpecColDivider} />

                {/* Column 2: License */}
                <View style={styles.pairingSpecCol}>
                  <View style={styles.pairingSpecColHeader}>
                    <Ionicons name="infinite" size={16} color="#000000" />
                    <Text style={styles.pairingSpecColVal}>Lifetime</Text>
                  </View>
                  <Text style={styles.pairingSpecColLabel}>Hardware License</Text>
                </View>

                {/* Vertical Divider */}
                <View style={styles.pairingSpecColDivider} />

                {/* Column 3: Instant Access */}
                <View style={styles.pairingSpecCol}>
                  <View style={styles.pairingSpecColHeader}>
                    <Ionicons name="flash" size={16} color="#000000" />
                    <Text style={styles.pairingSpecColVal}>Instant</Text>
                  </View>
                  <Text style={styles.pairingSpecColLabel}>Tap & QR Access</Text>
                </View>
              </View>
            </View>

            {/* 5. Context-Aware Merchant Account & Action Buttons */}
            {user ? (
              <View style={styles.pairingActionWrap}>
                {/* Store Context Card */}
                <View style={styles.pairingAccountCard}>
                  <View style={styles.pairingAccountAvatar}>
                    <Ionicons name="storefront" size={18} color="#000000" />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.pairingAccountLabel}>PAIRING TO YOUR ACCOUNT</Text>
                    <Text style={styles.pairingAccountName} numberOfLines={1}>
                      {user.name || user.email || 'Store Owner'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      if (logout) await logout();
                      router.push({
                        pathname: '/(auth)/login' as any,
                        params: { redirect_to: `/nfc?c=${unclaimedStand.code}` },
                      });
                    }}
                    style={styles.pairingSwitchBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pairingSwitchBtnText}>Switch</Text>
                  </TouchableOpacity>
                </View>

                {/* Outlet Selection Pills (Always visible for logged-in merchant) */}
                <View style={styles.pairingBranchBox}>
                  <Text style={styles.pairingBranchBoxLabel}>
                    {locale === 'en' ? 'SELECT OUTLET FOR THIS STAND:' : 'PILIH CAWANGAN UNTUK STAND INI:'}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {pairingBranches.map(b => {
                      const isSelected = selectedPairingBranchId === b.id;
                      return (
                        <TouchableOpacity
                          key={b.id}
                          onPress={() => setSelectedPairingBranchId(b.id)}
                          style={[styles.pairingBranchChip, isSelected && styles.pairingBranchChipSelected]}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={b.is_hq ? "business" : "storefront"} size={12} color={isSelected ? "#000000" : "#475569"} />
                          <Text style={[styles.pairingBranchChipText, isSelected && styles.pairingBranchChipTextSelected]}>
                            {b.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    {/* + Add Branch Chip */}
                    <TouchableOpacity
                      onPress={handleOpenAddBranchModal}
                      style={styles.pairingAddBranchChip}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={13} color="#000000" />
                      <Text style={styles.pairingAddBranchChipText}>
                        {locale === 'en' ? 'Add Branch' : 'Tambah Cawangan'}
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                {/* Add Branch Modal */}
                {showAddBranchModal && user?.merchant_id && (
                  <BranchFormModal
                    visible={showAddBranchModal}
                    onClose={() => setShowAddBranchModal(false)}
                    onSuccess={handleBranchCreated}
                    merchantId={user.merchant_id}
                    availableStaff={pairingStaff}
                    existingBranchesCount={pairingBranches.length}
                  />
                )}

                {/* Primary Bind CTA */}
                <TouchableOpacity
                  style={[styles.pairingBtnPrimary, isPairing && { opacity: 0.7 }]}
                  onPress={handlePairStand}
                  disabled={isPairing}
                  activeOpacity={0.88}
                >
                  {isPairing ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <View style={styles.pairingBtnContent}>
                      <Ionicons name="sparkles" size={18} color="#000000" />
                      <Text style={styles.pairingBtnPrimaryText}>
                        Bind Stand to My Store
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Footer Help Link */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.open('https://wa.me/60104648598?text=Hi%20Risev%20Support,%20I%20need%20some%20help%20setting%20up%20my%20NFC%20stand.', '_blank');
                    }
                  }}
                  style={styles.pairingHelpLink}
                >
                  <Ionicons name="help-circle-outline" size={16} color="#000000" />
                  <Text style={styles.pairingHelpLinkText}>Need help setting up?</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.pairingActionWrap}>
                {/* Primary Yellow Button: Store Owner Log In -> */}
                <TouchableOpacity
                  style={styles.pairingBtnPrimary}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/login' as any,
                      params: { redirect_to: `/nfc?c=${unclaimedStand.code}` },
                    })
                  }
                  activeOpacity={0.88}
                >
                  <View style={styles.pairingBtnContent}>
                    <Text style={styles.pairingBtnPrimaryText}>
                      Store Owner Log In
                    </Text>
                    <Ionicons name="arrow-forward" size={17} color="#000000" />
                  </View>
                </TouchableOpacity>

                {/* Secondary White Button: Create New Store Account (2 min) */}
                <TouchableOpacity
                  style={styles.pairingBtnSecondary}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/login' as any,
                      params: { redirect_to: `/nfc?c=${unclaimedStand.code}`, isRegister: '1' },
                    })
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.pairingBtnSecondaryText}>
                    Create New Store Account (2 min)
                  </Text>
                </TouchableOpacity>

                {/* Footer Help Link */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.open('https://wa.me/60104648598?text=Hi%20Risev%20Support,%20I%20need%20some%20help%20setting%20up%20my%20NFC%20stand.', '_blank');
                    }
                  }}
                  style={styles.pairingHelpLink}
                >
                  <Ionicons name="help-circle-outline" size={16} color="#000000" />
                  <Text style={styles.pairingHelpLinkText}>Need help setting up?</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'invalid') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.invalidWrap}>
          <View style={styles.invalidIconBg}>
            <Ionicons name="close-circle-outline" size={48} color="#EF4444" />
          </View>
          <Text style={styles.invalidTitle}>NFC Link Invalid</Text>
          <Text style={styles.invalidSubtitle}>{invalidReason}</Text>
          <TouchableOpacity style={[styles.primaryActionBtn, { backgroundColor: '#000000', paddingHorizontal: 24 }]} onPress={() => router.replace('/')} activeOpacity={0.8}>
            <Text style={styles.primaryActionBtnText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // REWARD VOUCHER PREVIEW TICKET (What customer gets upon completion)
  // ══════════════════════════════════════════════════════════════════
  const renderRewardVoucherPreview = () => {
    // Brand header color (Dynamic merchant primary color)
    const headerBg = primaryColor || '#2563EB';
    const headerTextColor = getContrastColor(headerBg);

    const cardBg = '#FFFFFF'; // Crisp white paper background
    const textColor = '#111827';
    const subtextColor = '#4B5563';
    const dividerColor = 'rgba(0, 0, 0, 0.15)';
    const notchColor = '#100720'; // Seamless dark cutout blending with page backdrop

    const isComplete = currentStamps >= stampGoal;
    const remainingStamps = Math.max(0, stampGoal - currentStamps);
    const progressPercent = Math.min(100, Math.round((currentStamps / Math.max(1, stampGoal)) * 100));

    const serialNo = `#WLY-${(merchant?.id || '88421').slice(-5).toUpperCase()}`;

    const animatedMaxHeight = (step === 'form') ? 185 : voucherSlideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 185]
    });

    const animatedMarginBottom = (step === 'form') ? 14 : voucherSlideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, isApproved ? 6 : 10]
    });

    const animatedTranslateY = (step === 'form') ? 0 : voucherSlideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-24, 0]
    });
    
    const animatedOpacity = (step === 'form') ? 1 : voucherSlideAnim.interpolate({
      inputRange: [0, 0.35, 1],
      outputRange: [0, 0.4, 1]
    });

    const animatedWidth: any = (step === 'form') ? `${progressPercent}%` : voucherProgressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', `${progressPercent}%`]
    });

    return (
      <Animated.View style={[
        styles.voucherPreviewContainer,
        {
          maxHeight: animatedMaxHeight,
          marginBottom: animatedMarginBottom,
          opacity: animatedOpacity,
          transform: [{ translateY: animatedTranslateY }],
          overflow: 'hidden',
        }
      ]}>
        {/* Boarding Pass Ticket Card Container */}
        <View style={[styles.boardingPassCard, { backgroundColor: cardBg }]}>
          
          {/* Left Brand Band (The "Airline" Strip) */}
          <View style={[styles.boardingPassBrandBand, { backgroundColor: headerBg }]}>
            <View style={styles.boardingPassBandTextWrapper}>
              <Text style={[styles.boardingPassBandText, { color: headerTextColor }]} numberOfLines={1}>
                {merchantName.toUpperCase()}
              </Text>
              <Text style={[styles.boardingPassBandSubtext, { color: headerTextColor }]}>
                REWARD PASS
              </Text>
            </View>
          </View>

          {/* Middle Main Body */}
          <View style={styles.boardingPassMainBody}>
            <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
              
              {/* Top: Premium Progress Bar */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#6B7280', letterSpacing: 0.5 }}>
                    PROGRESS
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827' }}>
                    {isComplete ? 'UNLOCKED' : `${progressPercent}%`}
                  </Text>
                </View>
                <View style={{ height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                  <Animated.View style={{ height: '100%', width: animatedWidth, backgroundColor: headerBg, borderRadius: 4 }} />
                </View>
              </View>

              {/* Middle: Reward Info */}
              <View>
                <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 2, textTransform: 'uppercase' }}>
                  Your Reward
                </Text>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: 0.1 }} numberOfLines={2}>
                  {rewardTitle}
                </Text>
              </View>

              {/* Bottom: Stamp Status & Next Milestone */}
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="gift-outline" size={13} color="#6B7280" />
                  <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#4B5563' }}>
                    {isComplete ? 'Ready to claim!' : `${currentStamps} out of ${stampGoal} stamps collected`}
                  </Text>
                </View>
                {(() => {
                  const nextMilestone = subRewardsList
                    .filter((sr: any) => Number(sr.at_stamp) > currentStamps)
                    .sort((a: any, b: any) => Number(a.at_stamp) - Number(b.at_stamp))[0];
                  if (nextMilestone) {
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                        <View style={{ 
                          backgroundColor: '#FEF3C7', 
                          paddingHorizontal: 7, 
                          paddingVertical: 2.5, 
                          borderRadius: 6, 
                          borderWidth: 1, 
                          borderColor: '#FDE68A',
                          maxWidth: '96%',
                          alignSelf: 'flex-start'
                        }}>
                          <Text 
                            style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#92400E' }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            🎁 Milestone at {nextMilestone.at_stamp} stamps: {nextMilestone.reward_title}
                          </Text>
                        </View>
                      </View>
                    );
                  }
                  return null;
                })()}
              </View>

            </View>
          </View>

          {/* Perforation Column */}
          <View style={styles.boardingPassPerforationCol} pointerEvents="none">
            {/* Background fill for the right half to connect the brand color to the dashed line */}
            <View style={{ 
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 10, 
              backgroundColor: headerBg,
              shadowColor: '#000',
              shadowOffset: { width: -4, height: 0 },
              shadowOpacity: 0.12,
              shadowRadius: 6,
              elevation: 4
            }} />
            
            <View style={[styles.voucherDashedLine, { borderColor: '#FFFFFF', zIndex: 1 }]} />
            <View style={[styles.voucherNotchTop, { backgroundColor: notchColor, zIndex: 2 }]} />
            <View style={[styles.voucherNotchBottom, { backgroundColor: notchColor, zIndex: 2 }]} />
          </View>

          {/* Right Stub */}
          <View style={[styles.boardingPassRightStub, { backgroundColor: headerBg }]}>
            <View style={[styles.boardingPassStubBody, { justifyContent: 'center', alignItems: 'center', gap: 6, padding: 6 }]}>
              {merchantLogoUrl && !merchantLogoUrl.includes('placeholder') ? (
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.06)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                  padding: 2,
                }}>
                  <Image source={{ uri: merchantLogoUrl }} style={{ width: '100%', height: '100%', borderRadius: 22 }} resizeMode="contain" />
                </View>
              ) : (
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                }}>
                  <Ionicons name="storefront" size={22} color={headerBg} />
                </View>
              )}
              
              <Text style={[styles.boardingPassStubValueText, { textAlign: 'center', fontSize: 10, color: headerTextColor, letterSpacing: 0.3 }]} numberOfLines={2}>
                {merchantName.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // 9:16 CUSTOMIZABLE CARD CONTAINER
  // ══════════════════════════════════════════════════════════════════
  const renderCardContent = () => (
    <>
          {/* Step 1: Top Brand Strip (Merchant Logo + Welcome + Risev Mark) */}
          {step === 'form' && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              paddingHorizontal: 4,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {merchantLogoUrl ? (
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#FFFFFF',
                    padding: 2,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 3,
                  }}>
                    <Image source={{ uri: merchantLogoUrl }} style={{ width: '100%', height: '100%', borderRadius: 20 }} resizeMode="contain" />
                  </View>
                ) : (
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 3,
                  }}>
                    <Ionicons name="storefront" size={22} color="#0F172A" />
                  </View>
                )}
                <View>
                  <Text style={{
                    fontSize: 11,
                    fontFamily: 'PlusJakartaSans_600SemiBold',
                    color: headerSubtextColor,
                    letterSpacing: 0.2,
                  }}>
                    Welcome to
                  </Text>
                  <Text style={{
                    fontSize: 16.5,
                    fontFamily: 'PlusJakartaSans_800ExtraBold',
                    color: headerTextColor,
                    letterSpacing: -0.3,
                  }} numberOfLines={1}>
                    {merchantName}
                  </Text>
                </View>
              </View>

              <Image
                source={require('../assets/risev logo.png')}
                style={{ width: 56, height: 20, resizeMode: 'contain', tintColor: headerLogoTint }}
              />
            </View>
          )}

          {/* Step 2 & Beyond: Top Navigation Bar */}
          {step !== 'form' && (
            <View style={[styles.cardHeaderRow, { marginBottom: 16 }]}>
              <TouchableOpacity 
                style={styles.iconCircleBtn} 
                onPress={() => {
                  if (step === 'sent' && !isApproved) {
                    handleResetToForm();
                  } else {
                    handleViewStampCard();
                  }
                }}
              >
                <Ionicons name="chevron-back" size={20} color="#000000" />
              </TouchableOpacity>
              
              <Image
                source={require('../assets/risev logo.png')}
                style={{ width: 56, height: 20, resizeMode: 'contain', tintColor: headerLogoTint }}
              />
            </View>
          )}

          {/* Merchant Brand Logo & Header / Animated Flipping Loyalty Card (Revealed on Step 2 / Approved) */}
          {(step === 'sent' || isApproved) ? (
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={() => setShowBack(prev => !prev)}
              style={{ marginBottom: 16, position: 'relative' }}
            >
              {/* Front Card Panel */}
              <Animated.View
                style={[
                  styles.largeCardView,
                  {
                    backgroundColor: cardBgColor,
                    overflow: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: [{ rotateY: frontInterpolate }],
                  },
                ]}
              >
                {program?.card_background ? (
                  <Image
                    source={{ uri: `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}` }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : null}



                {/* Card plastic gloss shine reflection */}
                <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="none">
                  <View style={{ position: 'absolute', top: -160, left: -80, width: '150%', height: 260, backgroundColor: 'rgba(255, 255, 255, 0.04)', transform: [{ rotate: '-30deg' }] }} />
                  <View style={{ position: 'absolute', top: -160, left: 25, width: 28, height: 600, backgroundColor: 'rgba(255, 255, 255, 0.16)', transform: [{ rotate: '-30deg' }] }} />
                </View>

                {/* Header: Shop Name & Logo */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 2 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                    {merchantLogoUrl && !merchantLogoUrl.includes('placeholder') ? (
                      <Image source={{ uri: merchantLogoUrl }} style={{ width: '100%', height: '100%', borderRadius: 6 }} resizeMode="cover" />
                    ) : (
                      <Ionicons name="storefront" size={20} color="#64748B" />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: cardFontColor }} numberOfLines={1}>
                      {merchantName}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: cardFontColor, opacity: 0.65 }} numberOfLines={1}>
                      {(merchant?.category || 'store').toUpperCase()}
                    </Text>
                  </View>
                  {isPointsOnly ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>
                        {currentPoints.toLocaleString()}
                      </Text>
                      <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: cardFontColor, opacity: 0.75 }}>
                        POINTS
                      </Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: cardFontColor }}>
                        {currentStamps}/{program?.stamp_goal || 10}
                      </Text>
                      <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_500Medium', color: cardFontColor, opacity: 0.75 }}>
                        STAMPS
                      </Text>
                    </View>
                  )}
                </View>

                {/* Middle row: EMV Chip & Wifi Contactless Symbol */}
                <View style={[styles.cardMidRow, { zIndex: 2 }]}>
                  <View style={{ width: 32, height: 24, borderRadius: 6, backgroundColor: '#F59E0B', position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#D97706' }}>
                    <View style={{ position: 'absolute', top: 11, left: 0, width: '100%', height: 1, backgroundColor: '#B45309' }} />
                    <View style={{ position: 'absolute', top: 0, left: 15, width: 1, height: '100%', backgroundColor: '#B45309' }} />
                    <View style={{ position: 'absolute', top: 6, left: 10, width: 12, height: 12, borderRadius: 2, backgroundColor: '#FBBF24', borderWidth: 1, borderColor: '#B45309' }} />
                  </View>
                  <Ionicons 
                    name="wifi" 
                    size={18} 
                    color={cardFontColor ? cardFontColor : "rgba(255, 255, 255, 0.35)"} 
                    style={{ opacity: 0.45 }} 
                  />
                </View>

                <View style={{ flex: 1 }} />

                {/* Footer row: Holder Name, Expiration, CVV, and brand logo */}
                <View style={[styles.largeCardFooter, { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2 }]}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_600SemiBold', color: cardFontColor, opacity: 0.5, letterSpacing: 0.5 }}>
                      CARD HOLDER
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: cardFontColor, marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' }} numberOfLines={1}>
                      {isApproved ? (user?.name || 'VALUED CUSTOMER').toUpperCase() : '----'}
                    </Text>
                  </View>

                  <View style={{ flex: 0.8 }}>
                    <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_600SemiBold', color: cardFontColor, opacity: 0.5, letterSpacing: 0.5 }}>
                      VALID
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: cardFontColor, marginTop: 2, letterSpacing: 0.5 }}>
                      12/30
                    </Text>
                  </View>

                  <View style={{ flex: 0.6 }}>
                    <Text style={{ fontSize: 7, fontFamily: 'PlusJakartaSans_600SemiBold', color: cardFontColor, opacity: 0.5, letterSpacing: 0.5 }}>
                      CVV
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: cardFontColor, marginTop: 2, letterSpacing: 0.5 }}>
                      888
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Image
                      source={require('../assets/risev logo.png')}
                      style={{ width: 44, height: 16, resizeMode: 'contain', tintColor: cardFontColor || '#FFFFFF' }}
                    />
                  </View>
                </View>
              </Animated.View>

              {/* Back Card Panel */}
              <Animated.View
                style={[
                  styles.largeCardView,
                  {
                    backgroundColor: cardBgColor,
                    overflow: 'hidden',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: 0,
                    gap: 0,
                    backfaceVisibility: 'hidden',
                    transform: [{ rotateY: backInterpolate }],
                  },
                ]}
              >
                {program?.card_background_back ? (
                  <Image
                    source={{ uri: `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background_back}` }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Card plastic gloss shine reflection */}
                <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="none">
                  <View style={{ position: 'absolute', top: -160, left: -80, width: '150%', height: 260, backgroundColor: 'rgba(255, 255, 255, 0.04)', transform: [{ rotate: '-30deg' }] }} />
                  <View style={{ position: 'absolute', top: -160, left: 25, width: 28, height: 600, backgroundColor: 'rgba(255, 255, 255, 0.16)', transform: [{ rotate: '-30deg' }] }} />
                </View>


                {/* Magnetic Stripe overlay */}
                <View style={{ width: '100%', height: 44, backgroundColor: '#111827', marginTop: 16, opacity: 0.95, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.15)', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, letterSpacing: 6 }} numberOfLines={1}>
                    {merchantName.toUpperCase()}
                  </Text>
                </View>

                {isPointsOnly ? (
                  <View style={{ paddingHorizontal: 20, paddingBottom: 16, paddingTop: 16, flex: 1, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: cardFontColor, letterSpacing: 0.5, opacity: 0.7 }}>
                          POINTS BALANCE
                        </Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: '#FFC700' }}>
                          {currentPoints.toLocaleString()} PTS
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255, 199, 0, 0.2)', borderWidth: 1, borderColor: '#FFC700' }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, color: '#FFC700', textTransform: 'uppercase' }}>
                          VIP MEMBER
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: cardFontColor, opacity: 0.8, textAlign: 'center', marginTop: 8 }}>
                      {program?.spend_per_point && Number(program.spend_per_point) > 1
                        ? `✨ Earn 1 point per RM ${program.spend_per_point} spent at ${merchantName}`
                        : `✨ Earn 1 point per RM 1 spent at ${merchantName}`}
                    </Text>

                    <View style={{ position: 'absolute', bottom: 16, right: 24 }}>
                      <Image
                        source={require('../assets/risev logo.png')}
                        style={{ width: 44, height: 16, resizeMode: 'contain', tintColor: cardFontColor || '#FFFFFF' }}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12, flex: 1 }}>
                    {/* Minimalist Status Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, gap: 8 }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: cardFontColor, letterSpacing: 0.5, opacity: 0.7 }}>
                        YOUR STAMPS
                      </Text>
                      <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: cardFontColor }}>
                        {currentStamps}/{stampGoal}
                      </Text>
                    </View>

                    {/* Stamps Grid Row */}
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      {stampGoal === 10 ? (
                        <View style={{ gap: 6, marginVertical: 6 }}>
                          {/* Row 1 (6 Stamps) */}
                          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', width: '100%' }}>
                            {Array.from({ length: 6 }).map((_, idx) => {
                              const slotNum = idx + 1;
                              const isEarned = slotNum <= currentStamps;
                              const isNew = newlyEarnedIndices.has(idx);
                              const bubbleColor = cardFontColor === '#FFFFFF' ? '#000000' : cardFontColor;
                              const minIdx = newlyEarnedIndices.size > 0 ? Math.min(...Array.from(newlyEarnedIndices)) : 0;
                              const milestone = subRewardsList.find((sr: any) => Number(sr.at_stamp) === slotNum);
                              const isFinalGoal = slotNum === stampGoal;
                              return (
                                <View key={idx} style={{ width: '13.5%', aspectRatio: 1 }}>
                                  <AnimatedStampBubble
                                    isEarned={isEarned}
                                    isNew={isNew}
                                    delay={isNew ? (idx - minIdx) * 400 : 0}
                                    iconId={cardIcon}
                                    bubbleColor={bubbleColor}
                                    iconColor={cardBgColor}
                                    borderColor={cardFontColor + '30'}
                                    emptyBgColor={cardFontColor + '08'}
                                    isMilestone={!!milestone}
                                    milestoneNumber={slotNum}
                                    isFinalGoal={isFinalGoal}
                                  />
                                </View>
                              );
                            })}
                          </View>

                          {/* Row 2 (4 Stamps, Centered) */}
                          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', width: '100%' }}>
                            {Array.from({ length: 4 }).map((_, idx) => {
                              const globalIdx = idx + 6;
                              const slotNum = globalIdx + 1;
                              const isEarned = slotNum <= currentStamps;
                              const isNew = newlyEarnedIndices.has(globalIdx);
                              const bubbleColor = cardFontColor === '#FFFFFF' ? '#000000' : cardFontColor;
                              const minIdx = newlyEarnedIndices.size > 0 ? Math.min(...Array.from(newlyEarnedIndices)) : 0;
                              const milestone = subRewardsList.find((sr: any) => Number(sr.at_stamp) === slotNum);
                              const isFinalGoal = slotNum === stampGoal;
                              return (
                                <View key={idx} style={{ width: '13.5%', aspectRatio: 1 }}>
                                  <AnimatedStampBubble
                                    isEarned={isEarned}
                                    isNew={isNew}
                                    delay={isNew ? (globalIdx - minIdx) * 400 : 0}
                                    iconId={cardIcon}
                                    bubbleColor={bubbleColor}
                                    iconColor={cardBgColor}
                                    borderColor={cardFontColor + '30'}
                                    emptyBgColor={cardFontColor + '08'}
                                    isMilestone={!!milestone}
                                    milestoneNumber={slotNum}
                                    isFinalGoal={isFinalGoal}
                                  />
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6, justifyContent: 'center' }}>
                          {Array.from({ length: stampGoal }).map((_, idx) => {
                            const slotNum = idx + 1;
                            const isEarned = slotNum <= currentStamps;
                            const isNew = newlyEarnedIndices.has(idx);
                            const bubbleColor = cardFontColor === '#FFFFFF' ? '#000000' : cardFontColor;
                            const minIdx = newlyEarnedIndices.size > 0 ? Math.min(...Array.from(newlyEarnedIndices)) : 0;
                            const milestone = subRewardsList.find((sr: any) => Number(sr.at_stamp) === slotNum);
                            const isFinalGoal = slotNum === stampGoal;
                            return (
                              <View key={idx} style={{ width: '17%', aspectRatio: 1 }}>
                                <AnimatedStampBubble
                                  isEarned={isEarned}
                                  isNew={isNew}
                                  delay={isNew ? (idx - minIdx) * 400 : 0}
                                  iconId={cardIcon}
                                  bubbleColor={bubbleColor}
                                  iconColor={cardBgColor}
                                  borderColor={cardFontColor + '30'}
                                  emptyBgColor={cardFontColor + '08'}
                                  isMilestone={!!milestone}
                                  milestoneNumber={slotNum}
                                  isFinalGoal={isFinalGoal}
                                />
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>

                    <View style={{ position: 'absolute', bottom: 16, right: 24 }}>
                      <Image
                        source={require('../assets/risev logo.png')}
                        style={{ width: 44, height: 16, resizeMode: 'contain', tintColor: cardFontColor || '#FFFFFF' }}
                      />
                    </View>
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>
          ) : null}

          {/* ───────────────────────────────────────────────────────── */}
          {/* REWARD VOUCHER PREVIEW TICKET (Revealed on Step 2 / Approved) */}
          {/* ───────────────────────────────────────────────────────── */}
          {(step === 'sent' || isApproved) && !isPointsOnly && renderRewardVoucherPreview()}

          {/* ───────────────────────────────────────────────────────── */}
          {/* STEP 1: Phone Input Form (Clean Wallpaper Hero View) */}
          {/* ───────────────────────────────────────────────────────── */}
          {step === 'form' && (() => {
            const getIsLight = (color: string) => {
              const hex = (color || '#ffffff').replace('#', '');
              if (hex.length === 3) {
                const r = parseInt(hex[0] + hex[0], 16);
                const g = parseInt(hex[1] + hex[1], 16);
                const b = parseInt(hex[2] + hex[2], 16);
                return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 180;
              }
              if (hex.length === 6) {
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                return ((r * 299) + (g * 587) + (b * 114)) / 1000 >= 180;
              }
              return true;
            };

            const isLightBrandColor = getIsLight(primaryColor);
            
            const getHexAlpha = (hex: string, alpha: number) => {
              let c = hex.replace('#', '');
              if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
              const r = parseInt(c.substring(0,2), 16) || 0;
              const g = parseInt(c.substring(2,4), 16) || 0;
              const b = parseInt(c.substring(4,6), 16) || 0;
              return `rgba(${r},${g},${b},${alpha})`;
            };

            const brandTextColor = '#FFFFFF';
            const brandSubtextColor = 'rgba(255,255,255,0.75)';
            const brandInputBorderColor = 'rgba(255,255,255,0.2)';
            const brandInputBgColor = 'rgba(0,0,0,0.15)';

            return (
              <>
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 24,
                  paddingHorizontal: 20,
                  paddingVertical: 18,
                  borderWidth: 1,
                  borderColor: '#F1F5F9',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.10,
                  shadowRadius: 20,
                  elevation: 8,
                  marginTop: 'auto',
                  marginBottom: 12,
                }}>
                  {/* NFC Tap Successful Green Pill */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    backgroundColor: '#ECFDF5',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 9999,
                    gap: 6,
                    marginBottom: 10,
                  }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10B981' }} />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#047857' }}>
                      NFC tap successful
                    </Text>
                  </View>

                  {/* Title & Subtitle */}
                  <Text style={{
                    fontSize: 22,
                    fontFamily: 'PlusJakartaSans_800ExtraBold',
                    color: '#000000',
                    letterSpacing: -0.6,
                    marginBottom: 2,
                  }}>
                    {isPointsOnly ? 'Collect your points.' : 'Collect your stamp.'}
                  </Text>
                  <Text style={{
                    fontSize: 13,
                    fontFamily: 'PlusJakartaSans_500Medium',
                    color: '#64748B',
                    marginBottom: 12,
                  }}>
                    Enter your phone number to continue.
                  </Text>

                  {errorMsg ? (
                    <View style={{
                      backgroundColor: '#FEF2F2',
                      borderWidth: 1,
                      borderColor: '#FCA5A5',
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      marginBottom: 10,
                    }}>
                      <Text style={{ color: '#DC2626', fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                        {errorMsg}
                      </Text>
                    </View>
                  ) : null}

                  {/* Phone Input Box */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 14,
                    padding: 5,
                    height: 48,
                    marginBottom: 10,
                  }}>
                    {/* Country Selector Pill */}
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      height: 36,
                      gap: 4,
                    }}>
                      <Text style={{ fontSize: 14 }}>🇲🇾</Text>
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        +60
                      </Text>
                      <Ionicons name="chevron-down" size={12} color="#64748B" />
                    </View>

                    {/* Hairline Divider */}
                    <View style={{ width: 1, height: 22, backgroundColor: '#E2E8F0', marginHorizontal: 8 }} />

                    {/* Phone TextInput */}
                    <TextInput
                      style={[
                        {
                          flex: 1,
                          fontSize: 16,
                          fontFamily: 'PlusJakartaSans_700Bold',
                          color: '#0F172A',
                          height: '100%',
                        },
                        Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                      ]}
                      placeholder="1110209669"
                      placeholderTextColor="#94A3B8"
                      value={phoneInput}
                      onChangeText={(text) => {
                        setPhoneInput(formatMalaysianPhone(text));
                        setErrorMsg('');
                      }}
                      keyboardType="phone-pad"
                    />

                    {/* Circular Clear Button */}
                    {phoneInput ? (
                      <TouchableOpacity
                        onPress={() => {
                          setPhoneInput('');
                          setErrorMsg('');
                        }}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: '#E2E8F0',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 6,
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close" size={14} color="#64748B" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Full Name Input (New Customer) */}
                  {showNameField && (
                    <View style={{ marginBottom: 16 }}>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#F0FDF4',
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: '#DCFCE7',
                      }}>
                        <Text style={{ fontSize: 16, marginRight: 8 }}>👋</Text>
                        <Text style={{ flex: 1, fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#166534', lineHeight: 18 }}>
                          Looks like you're new here! Just tell us your name to claim.
                        </Text>
                      </View>

                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#F8FAFC',
                        borderColor: '#E2E8F0',
                        borderWidth: 1,
                        borderRadius: 14,
                        paddingHorizontal: 12,
                        height: 50,
                      }}>
                        <Ionicons name="person-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                        <TextInput
                          style={[
                            { flex: 1, color: '#0F172A', fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
                            Platform.OS === 'web' ? { outlineWidth: 0 } as any : null
                          ]}
                          placeholder="e.g. Ahmad Rizal"
                          placeholderTextColor="#94A3B8"
                          value={nameInput}
                          onChangeText={setNameInput}
                          autoFocus
                          autoCapitalize="words"
                        />
                      </View>
                    </View>
                  )}

                  {/* Yellow Primary Action Button */}
                  <TouchableOpacity
                    style={[
                      {
                        backgroundColor: '#FFCC00',
                        borderRadius: 14,
                        height: 48,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#FFCC00',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 3,
                      },
                      (isLoading || isCheckingPhone) && { opacity: 0.6 }
                    ]}
                    onPress={handleNfcSubmit}
                    disabled={isLoading || isCheckingPhone}
                    activeOpacity={0.85}
                  >
                    {isLoading || isCheckingPhone ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{
                          fontSize: 15,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: '#000000',
                        }}>
                          {showNameField
                            ? (isPointsOnly ? 'Complete Points Claim' : 'Complete Stamp Claim')
                            : (isPointsOnly ? 'Collect My Points' : 'Collect My Stamp')}
                        </Text>
                        <Ionicons name="arrow-forward" size={17} color="#000000" />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Secondary Book Appointment Button (Directly under Collect Button) */}
                  {canBookAppointment && bookingSlug ? (
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        borderRadius: 14,
                        height: 44,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 8,
                      }}
                      onPress={handleNavigateToBooking}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#0F172A" />
                      <Text style={{
                        fontSize: 13.5,
                        fontFamily: 'PlusJakartaSans_700Bold',
                        color: '#0F172A',
                      }}>
                        Walk-In Customer Booking
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#64748B" />
                    </TouchableOpacity>
                  ) : null}

                  {/* Privacy / Loyalty Note */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
                    <Ionicons name="lock-closed" size={12} color="#64748B" />
                    <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                      Your number is used for loyalty rewards.
                    </Text>
                  </View>
                </View>
              </>
            );
          })()}

          {/* ───────────────────────────────────────────────────────── */}
          {/* STEP 2: Real-Time Store Approval (Waiting Card & Live Pulse) */}
          {/* ───────────────────────────────────────────────────────── */}
          {step === 'sent' && (
            <View style={{ alignItems: 'center', width: '100%', marginTop: 0, marginBottom: 0 }}>
              {isDeclined ? (
                <View style={{
                  width: '100%',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: '#F1F5F9',
                  paddingHorizontal: 18,
                  paddingTop: 16,
                  paddingBottom: 18,
                  marginTop: 0,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.08,
                  shadowRadius: 20,
                  elevation: 6,
                  position: 'relative',
                }}>
                  {/* Top-Right Dismiss (X) Button */}
                  <TouchableOpacity
                    onPress={handleResetToForm}
                    activeOpacity={0.75}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      zIndex: 10,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={16} color="#0F172A" />
                  </TouchableOpacity>

                  {/* Declined Centerpiece with Soft Rose Halo */}
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 10 }}>
                    <View
                      style={{
                        position: 'absolute',
                        width: 108,
                        height: 108,
                        borderRadius: 54,
                        backgroundColor: '#FECACA',
                        opacity: 0.42,
                      }}
                    />
                    <View style={{
                      width: 76,
                      height: 76,
                      borderRadius: 38,
                      backgroundColor: '#FEE2E2',
                      borderWidth: 2,
                      borderColor: '#FCA5A5',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="close" size={34} color="#DC2626" />
                    </View>
                  </View>

                  {/* Centered Typography: Title & Subtitle */}
                  <Text style={{
                    fontSize: 21,
                    fontFamily: 'PlusJakartaSans_800ExtraBold',
                    color: '#0F172A',
                    textAlign: 'center',
                    letterSpacing: -0.4,
                  }}>
                    {locale === 'en' ? 'Request declined' : 'Permintaan ditolak'}
                  </Text>
                  <Text style={{
                    fontSize: 12.5,
                    fontFamily: 'PlusJakartaSans_500Medium',
                    color: '#64748B',
                    textAlign: 'center',
                    lineHeight: 17,
                    marginTop: 4,
                    paddingHorizontal: 8,
                  }}>
                    {locale === 'en'
                      ? `${merchantName} did not approve this ${isPointsOnly ? 'point' : 'stamp'} request.`
                      : `${merchantName} tidak meluluskan permintaan ${isPointsOnly ? 'mata ganjaran' : 'cop'} ini.`}
                  </Text>

                  {/* Inset Rows: Declined Approval (and Voucher when applied) */}
                  <View style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginTop: 14,
                    gap: 8,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 6 }}>
                        <View style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: '#0F172A',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10,
                        }}>
                          <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                            {locale === 'en'
                              ? (isPointsOnly ? 'Points Approval' : 'Stamp Approval')
                              : (isPointsOnly ? 'Kelulusan Mata' : 'Kelulusan Cop')}
                          </Text>
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                            {locale === 'en' ? 'Declined by store' : 'Ditolak oleh kedai'}
                          </Text>
                        </View>
                      </View>

                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: '#FEE2E2',
                        borderWidth: 1,
                        borderColor: '#FCA5A5',
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderRadius: 99,
                      }}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B91C1C' }}>
                          {locale === 'en' ? 'Declined' : 'Ditolak'}
                        </Text>
                      </View>
                    </View>

                    {appliedVoucherForClaim && (
                      <>
                        <View style={{ height: 1, backgroundColor: '#EDF2F7' }} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 6 }}>
                            <View style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: '#0F172A',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 10,
                            }}>
                              <Ionicons name="gift" size={17} color="#FFFFFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }} numberOfLines={1}>
                                {appliedVoucherForClaim.title || (locale === 'en' ? 'Redeem Voucher' : 'Tebus Baucar')}
                              </Text>
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                                {locale === 'en' ? 'Voucher still available' : 'Baucar masih tersedia'}
                              </Text>
                            </View>
                          </View>

                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: '#FEE2E2',
                            borderWidth: 1,
                            borderColor: '#FCA5A5',
                            paddingHorizontal: 9,
                            paddingVertical: 4,
                            borderRadius: 99,
                          }}>
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B91C1C' }}>
                              {locale === 'en' ? 'Declined' : 'Ditolak'}
                            </Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Try Again Primary Action */}
                  <TouchableOpacity
                    onPress={handleResetToForm}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      backgroundColor: '#0F172A',
                      borderRadius: 14,
                      paddingVertical: 13,
                      marginTop: 14,
                    }}
                  >
                    <Ionicons name="refresh" size={15} color="#FFFFFF" />
                    <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                      {locale === 'en' ? 'Try Again' : 'Cuba Lagi'}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 10 }}>
                    <Ionicons name="information-circle-outline" size={12.5} color="#64748B" />
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                      {locale === 'en' ? 'Think this is a mistake? Ask the cashier.' : 'Rasa ini satu kesilapan? Tanya juruwang.'}
                    </Text>
                  </View>
                </View>
              ) : !isApproved ? (
                <View style={{
                  width: '100%',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: '#F1F5F9',
                  paddingHorizontal: 18,
                  paddingTop: 16,
                  paddingBottom: 18,
                  marginTop: 0,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.08,
                  shadowRadius: 20,
                  elevation: 6,
                  position: 'relative',
                }}>
                  {/* Top-Right Dismiss / Cancel (X) Button */}
                  <TouchableOpacity
                    onPress={handleResetToForm}
                    activeOpacity={0.75}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      zIndex: 10,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={16} color="#0F172A" />
                  </TouchableOpacity>

                  {/* 3D Centerpiece Illustration with Ambient Warm Halo */}
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 10 }}>
                    {/* Soft warm radial halo */}
                    <View
                      style={{
                        position: 'absolute',
                        width: 108,
                        height: 108,
                        borderRadius: 54,
                        backgroundColor: '#FEF08A',
                        opacity: 0.42,
                      }}
                    />
                    {/* Floating 3D clock & hourglass asset */}
                    <Animated.View
                      style={{
                        transform: [
                          {
                            translateY: beaconAnim.interpolate({
                              inputRange: [0.3, 1],
                              outputRange: [0, -3.5],
                            }),
                          },
                          {
                            scale: beaconAnim.interpolate({
                              inputRange: [0.3, 1],
                              outputRange: [0.98, 1.02],
                            }),
                          },
                        ],
                      }}
                    >
                      <Image
                        source={require('../assets/images/waiting_approval_clock.png')}
                        style={{ width: 116, height: 116, resizeMode: 'contain' }}
                      />
                    </Animated.View>
                  </View>

                  {/* Centered Typography: Title & Subtitle */}
                  <Text style={{
                    fontSize: 21,
                    fontFamily: 'PlusJakartaSans_800ExtraBold',
                    color: '#0F172A',
                    textAlign: 'center',
                    letterSpacing: -0.4,
                  }}>
                    {locale === 'en' ? 'Waiting for approval' : 'Menunggu kelulusan'}
                  </Text>
                  <Text style={{
                    fontSize: 12.5,
                    fontFamily: 'PlusJakartaSans_500Medium',
                    color: '#64748B',
                    textAlign: 'center',
                    lineHeight: 17,
                    marginTop: 4,
                    paddingHorizontal: 8,
                  }}>
                    {appliedVoucherForClaim
                      ? (locale === 'en'
                          ? `Stamp & voucher redemption sent to ${merchantName}.`
                          : `Permintaan cop & baucar dihantar ke ${merchantName}.`)
                      : (locale === 'en'
                          ? `Your ${isPointsOnly ? 'point' : 'stamp'} request has been sent to ${merchantName}.`
                          : `Permintaan ${isPointsOnly ? 'mata ganjaran' : 'cop'} anda telah dihantar ke ${merchantName}.`)}
                  </Text>

                  {/* Dual Inset Rows (Dynamic: Stamp + Voucher OR Phone + Status) */}
                  <View style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginTop: 14,
                    gap: 8,
                  }}>
                    {appliedVoucherForClaim ? (
                      <>
                        {/* Row 1: Stamp Collection Request */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 6 }}>
                            <View style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: '#0F172A',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 10,
                            }}>
                              <Ionicons name="ribbon" size={16} color="#FFFFFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                                {locale === 'en'
                                  ? (isPointsOnly ? 'Collect Points' : 'Collect 1 Stamp')
                                  : (isPointsOnly ? 'Kumpul Mata' : 'Kumpul 1 Cop')}
                              </Text>
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                                {locale === 'en' ? 'Awaiting merchant review' : 'Menunggu semakan juruwang'}
                              </Text>
                            </View>
                          </View>

                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: '#FEF9C3',
                            borderWidth: 1,
                            borderColor: '#FDE047',
                            paddingHorizontal: 9,
                            paddingVertical: 4,
                            borderRadius: 99,
                          }}>
                            <Animated.View style={{
                              width: 5.5,
                              height: 5.5,
                              borderRadius: 2.75,
                              backgroundColor: '#D97706',
                              opacity: dot1,
                            }} />
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>
                              {locale === 'en' ? 'Pending' : 'Menunggu'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ height: 1, backgroundColor: '#EDF2F7' }} />

                        {/* Row 2: Customer Voucher Redemption Request */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 6 }}>
                            <View style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: '#D97706',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 10,
                            }}>
                              <Ionicons name="gift" size={17} color="#FFFFFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }} numberOfLines={1}>
                                {appliedVoucherForClaim.title || (locale === 'en' ? 'Redeem Voucher' : 'Tebus Baucar')}
                              </Text>
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309', marginTop: 1 }}>
                                {locale === 'en' ? 'Voucher to redeem' : 'Baucar ditebus di kaunter'}
                              </Text>
                            </View>
                          </View>

                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: '#FEF9C3',
                            borderWidth: 1,
                            borderColor: '#FDE047',
                            paddingHorizontal: 9,
                            paddingVertical: 4,
                            borderRadius: 99,
                          }}>
                            <Animated.View style={{
                              width: 5.5,
                              height: 5.5,
                              borderRadius: 2.75,
                              backgroundColor: '#D97706',
                              opacity: dot2,
                            }} />
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>
                              {locale === 'en' ? 'Pending' : 'Menunggu'}
                            </Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <>
                        {/* Row 1: Phone + Direct Edit Action */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 6 }}>
                            <View style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: '#0F172A',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 10,
                            }}>
                              <Ionicons name="call" size={16} color="#FFFFFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                                {locale === 'en' ? 'Phone Number' : 'Nombor Telefon'}
                              </Text>
                              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginTop: 1 }}>
                                {formatDisplayPhone(phoneInput)}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            onPress={() => {
                              setStep('form');
                              setIsWaitingConfirm(false);
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 3.5,
                              backgroundColor: '#FFFFFF',
                              borderWidth: 1,
                              borderColor: '#CBD5E1',
                              paddingHorizontal: 9,
                              paddingVertical: 4.5,
                              borderRadius: 8,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.04,
                              shadowRadius: 2,
                              elevation: 1,
                            }}
                          >
                            <Ionicons name="create-outline" size={11.5} color="#0F172A" />
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                              {locale === 'en' ? 'Edit' : 'Tukar'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View style={{ height: 1, backgroundColor: '#EDF2F7' }} />

                        {/* Row 2: Status with Pulsing Amber Pill */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 6 }}>
                            <View style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: '#0F172A',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 10,
                            }}>
                              <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                                {locale === 'en'
                                  ? (isPointsOnly ? 'Points Approval' : 'Stamp Approval')
                                  : (isPointsOnly ? 'Kelulusan Mata' : 'Kelulusan Cop')}
                              </Text>
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 }}>
                                {locale === 'en' ? 'Awaiting merchant confirmation' : 'Menunggu kelulusan juruwang'}
                              </Text>
                            </View>
                          </View>

                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: '#FEF9C3',
                            borderWidth: 1,
                            borderColor: '#FDE047',
                            paddingHorizontal: 9,
                            paddingVertical: 4,
                            borderRadius: 99,
                          }}>
                            <Animated.View style={{
                              width: 5.5,
                              height: 5.5,
                              borderRadius: 2.75,
                              backgroundColor: '#D97706',
                              opacity: dot1,
                            }} />
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>
                              {locale === 'en' ? 'Pending' : 'Menunggu'}
                            </Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>

                  {/* If voucher is applied, show phone + edit action in compact bar below */}
                  {appliedVoucherForClaim && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#F8FAFC',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      marginTop: 6,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons name="call" size={12} color="#64748B" />
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>
                          {formatDisplayPhone(phoneInput)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setStep('form');
                          setIsWaitingConfirm(false);
                        }}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                      >
                        <Ionicons name="create-outline" size={11} color="#0F172A" />
                        <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                          {locale === 'en' ? 'Edit' : 'Tukar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Dual Reassurance Footer: Real-Time Sync & Keep Screen Open */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: 12,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="lock-closed" size={11.5} color="#64748B" />
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                        {locale === 'en' ? 'Auto-syncs in real-time' : 'Auto-sinkronisasi'}
                      </Text>
                    </View>

                    <View style={{ width: 1, height: 11, backgroundColor: '#CBD5E1', marginHorizontal: 9 }} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="phone-portrait-outline" size={11.5} color="#64748B" />
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                        {locale === 'en' ? 'Keep screen open' : 'Kekalkan skrin'}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.radarStatusPill}>
                  <View style={[styles.radarStatusDot, { backgroundColor: '#34D399' }]} />
                  <Text style={styles.radarStatusPillText}>
                    {isPointsOnly ? '✨ POINTS APPROVED!' : '🎉 STAMP APPROVED!'}
                  </Text>
                </View>
              )}

              {isApproved && (
                <View style={{ width: '100%', alignItems: 'center', marginTop: 0 }}>
                  {receiptData && (
                    <TouchableOpacity 
                      style={styles.receiptBanner}
                      onPress={() => setShowReceiptModal(true)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={styles.receiptBannerText}>Payment of RM {parseFloat(receiptData.total_amount || 0).toFixed(2)} Successful</Text>
                      </View>
                      <View style={styles.receiptBannerBtn}>
                        <Ionicons name="receipt-outline" size={14} color="#0F172A" />
                        <Text style={styles.receiptBannerBtnText}>Receipt</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {canBookAppointment && bookingSlug ? (
                    <View style={{ width: '100%', maxWidth: 360, marginTop: receiptData ? 8 : 0 }}>
                      <View style={styles.postApprovalBookingCard}>
                        {/* Green Pill Tag matching Image 2 */}
                        <View style={styles.postApprovalBookingTagPill}>
                          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10B981' }} />
                          <Text style={styles.postApprovalBookingTag}>Plan your next visit</Text>
                        </View>

                        {/* Title matching Image 2 */}
                        <Text style={styles.postApprovalBookingTitle}>
                          Loved today's visit? Skip the line next time!
                        </Text>

                        {/* Subtitle matching Image 2 */}
                        <Text style={styles.postApprovalBookingSub}>
                          Book your next appointment seamlessly from your phone.
                        </Text>

                        {/* Primary Button matching Image 2 */}
                        <TouchableOpacity
                          style={styles.postApprovalBookingBtn}
                          onPress={handleNavigateToBooking}
                          activeOpacity={0.85}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="calendar" size={17} color="#000000" />
                            <Text style={styles.postApprovalBookingBtnText}>
                              Book Next Appointment
                            </Text>
                            <Ionicons name="arrow-forward" size={17} color="#000000" />
                          </View>
                        </TouchableOpacity>

                        {/* Secondary Button matching Image 2 Walk-In Booking Style */}
                        <TouchableOpacity
                          style={styles.postApprovalBookingSecondaryBtn}
                          onPress={handleViewStampCard}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="card-outline" size={16} color="#0F172A" />
                          <Text style={styles.postApprovalBookingSecondaryBtnText}>
                            {isPointsOnly ? 'View My Points Balance' : 'View My Stamp Card'}
                          </Text>
                          <Ionicons name="chevron-forward" size={14} color="#64748B" />
                        </TouchableOpacity>

                        {/* Footnote matching Image 2 */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
                          <Ionicons name="lock-closed" size={12} color="#64748B" />
                          <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                            Instant booking confirmation · Skip the queue
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8, width: '100%', maxWidth: 360, marginTop: receiptData ? 8 : 2 }}>
                      <TouchableOpacity
                        style={[styles.radarSuccessBtn, { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginTop: 0, height: 48, borderRadius: 24 }]}
                        onPress={handleViewStampCard}
                        activeOpacity={0.88}
                      >
                        <Ionicons name="card" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.radarSuccessBtnText, { color: '#FFFFFF', fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' }]}>
                          {isPointsOnly ? 'My Points' : 'View My Card'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.radarSuccessBtn, { flex: 1.5, backgroundColor: primaryColor || '#000', marginTop: 0, height: 48, borderRadius: 24 }]}
                        onPress={() => {
                          if (merchant?.slug) router.push(`/b/${merchant.slug}`);
                          else router.push(`/b/${merchant?.id}`);
                        }}
                        activeOpacity={0.88}
                      >
                        <Ionicons name="download-outline" size={18} color={getContrastColor(primaryColor || '#000')} style={{ marginRight: 6 }} />
                        <Text style={[styles.radarSuccessBtnText, { color: getContrastColor(primaryColor || '#000'), fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold' }]}>
                          Download App
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ───────────────────────────────────────────────────────── */}
          {/* STEP 3: 1:1 CUSTOMER VIEW LOYALTY CARD */}
          {/* ───────────────────────────────────────────────────────── */}
          {step === 'card' && (
            <View style={styles.cardSectionWrap}>
              {/* STAMP GRID CARD (1:1 with Customer View) */}
              <View
                style={[
                  styles.largeCardView,
                  {
                    backgroundColor: cardBgColor,
                    overflow: 'hidden',
                  },
                ]}
              >
                {program?.card_background ? (
                  <Image
                    source={{ uri: `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}` }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Card plastic gloss shine reflection */}
                <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="none">
                  {/* Soft wide reflection zone */}
                  <View
                    style={{
                      position: 'absolute',
                      top: -160,
                      left: -80,
                      width: '150%',
                      height: 260,
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      transform: [{ rotate: '-30deg' }],
                    }}
                  />
                  {/* Sharp bright specular highlight line */}
                  <View
                    style={{
                      position: 'absolute',
                      top: -160,
                      left: 25,
                      width: 28,
                      height: 600,
                      backgroundColor: 'rgba(255, 255, 255, 0.16)',
                      transform: [{ rotate: '-30deg' }],
                    }}
                  />
                </View>

                {/* Card Header: Shop Name, Category & Gold Badge */}
                <View style={styles.largeCardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={[
                        styles.largeCardMerchant,
                        { color: cardFontColor },
                      ]}
                      numberOfLines={1}
                    >
                      {merchantName}
                    </Text>
                    <Text
                      style={[
                        styles.shopCategoryText,
                        { color: cardFontColor + 'B3' },
                      ]}
                    >
                      {(merchant?.category || 'store').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.goldBadge}>
                    <Text style={styles.goldBadgeText}>{isPointsOnly ? 'VIP POINTS CARD' : 'LOYALTY CARD'}</Text>
                  </View>
                </View>

                {/* EMV Microchip & Contactless Wifi */}
                <View style={styles.cardMidRow}>
                  <View style={styles.cardChip}>
                    <View style={styles.chipLineHoriz} />
                    <View style={styles.chipLineVert} />
                    <View style={styles.chipCenterPin} />
                  </View>
                  <Ionicons
                    name="wifi"
                    size={18}
                    color={cardFontColor + '66'}
                    style={{ opacity: 0.5 }}
                  />
                </View>

                {/* Card Center: Points Balance or Stamps Grid */}
                {isPointsOnly ? (
                  <View style={{ marginVertical: 14, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: cardFontColor + '80', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                      AVAILABLE POINTS BALANCE
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4, gap: 6 }}>
                      <Text style={{ fontSize: 34, fontWeight: '900', color: cardFontColor, letterSpacing: -1 }}>
                        {currentPoints.toLocaleString()}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#F59E0B', letterSpacing: 0.5 }}>
                        PTS
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: cardFontColor + '12', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                      <Ionicons name="sparkles" size={11} color="#F59E0B" />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: cardFontColor, letterSpacing: 0.5 }}>
                        VIP MEMBER • AUTO EARN ON BILL
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.largeStampsGrid}>
                    {Array.from({ length: stampGoal }).map((_, idx) => {
                      const num = idx + 1;
                      const isEarned = num <= currentStamps;
                      const isRewardPos = num === stampGoal;
                      const milestoneReward = subRewardsList.find((sr: any) => Number(sr.at_stamp) === num);
                      const fontC = cardFontColor;

                      if (isEarned) {
                        return (
                          <View
                            key={num}
                            style={[
                              styles.largeStampEarned,
                              { backgroundColor: stampColor, position: 'relative' },
                            ]}
                          >
                            {renderStampIcon(cardIcon, 16, '#FFFFFF')}
                            {milestoneReward && (
                              <View style={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                backgroundColor: '#FFCC00',
                                borderRadius: 6,
                                paddingHorizontal: 2.5,
                                paddingVertical: 1,
                                borderWidth: 1,
                                borderColor: '#000000',
                              }}>
                                <Text style={{ fontSize: 7, fontWeight: '900', color: '#000000' }}>🎁</Text>
                              </View>
                            )}
                          </View>
                        );
                      } else if (isRewardPos) {
                        return (
                          <View
                            key={num}
                            style={[
                              styles.largeStampGift,
                              { borderColor: fontC + '40' },
                            ]}
                          >
                            <Text style={{ fontSize: 13 }}>🎁</Text>
                          </View>
                        );
                      } else if (milestoneReward) {
                        return (
                          <View
                            key={num}
                            style={[
                              styles.largeStampGift,
                              { 
                                borderColor: '#FFCC00', 
                                backgroundColor: 'rgba(255, 204, 0, 0.15)',
                                position: 'relative',
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 13 }}>🎁</Text>
                            <View style={{
                              position: 'absolute',
                              top: -5,
                              right: -5,
                              backgroundColor: '#FFCC00',
                              borderRadius: 6,
                              paddingHorizontal: 3,
                              paddingVertical: 0.5,
                              borderWidth: 1,
                              borderColor: '#000000',
                            }}>
                              <Text style={{ fontSize: 7, fontWeight: '900', color: '#000000' }}>{num}</Text>
                            </View>
                          </View>
                        );
                      } else {
                        return (
                          <View
                            key={num}
                            style={[
                              styles.largeStampEmpty,
                              { borderColor: fontC + '30' },
                            ]}
                          >
                            {renderStampIcon(cardIcon, 14, fontC + '40')}
                          </View>
                        );
                      }
                    })}
                  </View>
                )}

                {/* Card Footer Row */}
                <View style={styles.largeCardFooter}>
                  <View style={styles.holderCol}>
                    <Text
                      style={[
                        styles.holderLabel,
                        { color: cardFontColor + '80' },
                      ]}
                    >
                      CARD HOLDER
                    </Text>
                    <Text
                      style={[
                        styles.holderValue,
                        { color: cardFontColor },
                      ]}
                      numberOfLines={1}
                    >
                      {(user?.name || 'Valued Customer').toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ width: 45 }}>
                    <Text
                      style={[
                        styles.holderLabel,
                        { color: cardFontColor + '80' },
                      ]}
                    >
                      VALID
                    </Text>
                    <Text
                      style={[
                        styles.holderValue,
                        { color: cardFontColor },
                      ]}
                    >
                      12/30
                    </Text>
                  </View>

                  <View style={{ width: 35 }}>
                    <Text
                      style={[
                        styles.holderLabel,
                        { color: cardFontColor + '80' },
                      ]}
                    >
                      CVV
                    </Text>
                    <Text
                      style={[
                        styles.holderValue,
                        { color: cardFontColor },
                      ]}
                    >
                      888
                    </Text>
                  </View>

                  <View style={styles.brandBadge}>
                    <View style={styles.mastercardBadge}>
                      <View style={[styles.badgeCircle, { backgroundColor: '#EF4444' }]} />
                      <View style={[styles.badgeCircle, { backgroundColor: '#F59E0B', marginLeft: -9, opacity: 0.9 }]} />
                    </View>
                    <Text
                      style={[
                        styles.largeProgressPercentage,
                        { color: cardFontColor + 'CC' },
                      ]}
                    >
                      {isPointsOnly ? `${currentPoints.toLocaleString()} PTS` : `${currentStamps}/${stampGoal} STAMPS`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* NEXT REWARD CARD */}
              <View style={styles.nextRewardCard}>
                <View style={styles.nextRewardHeader}>
                  {rewardImageUrl ? (
                    <Image source={{ uri: rewardImageUrl }} style={styles.nextRewardImage} resizeMode="contain" />
                  ) : (
                    <View style={[styles.nextRewardIconBadge, { backgroundColor: primaryColor + '20' }]}>
                      <Ionicons name={isPointsOnly ? 'sparkles' : 'gift'} size={24} color={primaryColor} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextRewardSublabel}>
                      {isPointsOnly
                        ? 'Points Rewards Catalogue'
                        : stampGoal - currentStamps > 0
                        ? `${stampGoal - currentStamps} more stamps to:`
                        : 'Stamp card completed! 🎉'}
                    </Text>
                    <Text style={styles.nextRewardMainTitle}>
                      {isPointsOnly ? 'Redeem with Points' : rewardTitle}
                    </Text>
                  </View>
                </View>

                {/* Lock / Unlock Status Action Button */}
                <TouchableOpacity
                  style={[
                    styles.unlockBtn,
                    isPointsOnly
                      ? { backgroundColor: '#000000' }
                      : currentStamps >= stampGoal
                      ? { backgroundColor: '#10B981' }
                      : { backgroundColor: '#000000' },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.unlockBtnText, { color: '#FFFFFF' }]}>
                    {isPointsOnly
                      ? `✨ ${currentPoints.toLocaleString()} Points Available`
                      : currentStamps >= stampGoal
                      ? '🎉 Redeem Reward Now'
                      : `Collect ${stampGoal - currentStamps} stamps to unlock`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
    </>
  );

  return (
    <View style={[styles.fullPageContainer, !merchantBgUrl && { backgroundColor: primaryColor }]}>
      <StatusBar style="light" />
      {merchantBgUrl ? (
        <ImageBackground
          source={{ uri: merchantBgUrl }}
          resizeMode="cover"
          style={styles.fullPageBackground}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                isDesktop && styles.desktopScrollContent,
                step === 'form' && { flexGrow: 1, justifyContent: 'space-between' }
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[
                styles.contentCard, 
                isDesktop && (step === 'sent' ? styles.desktopCardGlass : styles.desktopCard),
                step === 'form' && { flex: 1, justifyContent: 'space-between' }
              ]}>
                {renderCardContent()}
              </View>
            </ScrollView>
          </SafeAreaView>
        </ImageBackground>
      ) : (
        <View style={[styles.fullPageBackground, { backgroundColor: primaryColor }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.15)', zIndex: -1 }]} />
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                isDesktop && styles.desktopScrollContent,
                step === 'form' && { flexGrow: 1, justifyContent: 'space-between' }
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[
                styles.contentCard, 
                isDesktop && (step === 'sent' ? styles.desktopCardGlass : styles.desktopCard),
                step === 'form' && { flex: 1, justifyContent: 'space-between' }
              ]}>
                {renderCardContent()}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      )}

      {/* 🌟 VOUCHER REDEMPTION PROMPT SLIDE-UP MODAL */}
      <Modal
        visible={showVoucherPrompt}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDismissVoucherAndProceed}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.65)' }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={handleDismissVoucherAndProceed}
          />
          <View style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 36 : 24,
            maxHeight: '85%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 10,
          }}>
            {/* Drag Handle Bar */}
            <View style={{
              width: 38,
              height: 4.5,
              borderRadius: 2.5,
              backgroundColor: '#CBD5E1',
              alignSelf: 'center',
              marginBottom: 14,
            }} />

            {/* Top Close Button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4 }}>
              <TouchableOpacity
                onPress={handleDismissVoucherAndProceed}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={16} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Modal Heading & Subtitle */}
            <Text style={{
              fontSize: 20,
              fontFamily: 'PlusJakartaSans_800ExtraBold',
              color: '#0F172A',
              letterSpacing: -0.4,
              lineHeight: 25,
            }}>
              {locale === 'en' ? 'Use Your Voucher Today?' : 'Gunakan Baucar Anda Hari Ini?'}
            </Text>
            <Text style={{
              fontSize: 12.5,
              fontFamily: 'PlusJakartaSans_500Medium',
              color: '#64748B',
              lineHeight: 18,
              marginTop: 4,
              marginBottom: 14,
            }}>
              {locale === 'en'
                ? `You have collected voucher(s) at ${merchantName}. Would you like to redeem one at the counter now?`
                : `Anda mempunyai baucar ganjaran sedia ada di ${merchantName}. Mahu gunakan sekarang di kaunter bersama cop anda?`}
            </Text>

            {/* Voucher Cards Selection List */}
            <ScrollView
              style={{ maxHeight: 220, marginBottom: 14 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ gap: 8 }}>
                {availableCustomerVouchers.map((v) => {
                  const isSelected = selectedVoucherToUse?.id === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      onPress={() => setSelectedVoucherToUse(v)}
                      activeOpacity={0.8}
                      style={{
                        backgroundColor: isSelected ? '#FFFDF0' : '#F8FAFC',
                        borderRadius: 16,
                        borderWidth: isSelected ? 1.5 : 1,
                        borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                        padding: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        shadowColor: isSelected ? '#F59E0B' : 'transparent',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isSelected ? 0.12 : 0,
                        shadowRadius: 6,
                        elevation: isSelected ? 2 : 0,
                      }}
                    >
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isSelected ? '#FEF08A' : '#E2E8F0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name="gift" size={20} color={isSelected ? '#B45309' : '#64748B'} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 13.5,
                          fontFamily: 'PlusJakartaSans_800ExtraBold',
                          color: '#0F172A',
                        }} numberOfLines={1}>
                          {v.title}
                        </Text>
                        <Text style={{
                          fontSize: 11.5,
                          fontFamily: 'PlusJakartaSans_500Medium',
                          color: '#64748B',
                          marginTop: 1,
                        }} numberOfLines={1}>
                          {v.description || (locale === 'en' ? 'Redeem at counter' : 'Tebus di kaunter')}
                        </Text>
                        {v.code ? (
                          <Text style={{
                            fontSize: 10,
                            fontFamily: 'PlusJakartaSans_700Bold',
                            color: '#94A3B8',
                            marginTop: 2,
                            letterSpacing: 0.5,
                          }}>
                            {locale === 'en' ? 'CODE' : 'KOD'}: {v.code}
                          </Text>
                        ) : null}
                      </View>

                      <View style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: isSelected ? 0 : 1.5,
                        borderColor: '#CBD5E1',
                        backgroundColor: isSelected ? '#D97706' : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <TouchableOpacity
              style={{
                backgroundColor: '#FFCC00',
                borderRadius: 14,
                height: 48,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                shadowColor: '#FFCC00',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 3,
              }}
              onPress={handleUseVoucherAndProceed}
              activeOpacity={0.85}
            >
              <Ionicons name="gift" size={17} color="#000000" />
              <Text style={{
                fontSize: 14.5,
                fontFamily: 'PlusJakartaSans_800ExtraBold',
                color: '#000000',
              }}>
                {locale === 'en' ? 'Use Voucher at Counter ➔' : 'Gunakan Baucar di Kaunter ➔'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                borderRadius: 14,
                height: 42,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
              }}
              onPress={handleDismissVoucherAndProceed}
              activeOpacity={0.8}
            >
              <Text style={{
                fontSize: 12.5,
                fontFamily: 'PlusJakartaSans_700Bold',
                color: '#64748B',
              }}>
                {locale === 'en' ? 'Keep for Later (Collect Stamp Only)' : 'Simpan Untuk Nanti (Kumpul Cop Sahaja)'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🌟 GOOGLE & STORE REVIEW MODAL */}
      <Modal
        visible={showReviewModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.reviewModalBackdrop}>
          <BlurView intensity={85} tint="dark" style={[styles.reviewModalCard, { paddingVertical: 32 }, isDesktop && { maxWidth: 420 }]}>
            
            {/* Store Avatar Icon & Google Badge */}
            <View style={{ position: 'relative', marginBottom: 24, zIndex: 2 }}>
              <View style={[styles.reviewAvatar, { 
                borderColor: '#334155', marginBottom: 0, width: 64, height: 64, borderRadius: 32,
                shadowColor: '#FBBC04', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 10
              }]}>
                {merchant?.logo ? (
                  <Image 
                    source={{ uri: `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}` }}
                    style={{ width: '100%', height: '100%', borderRadius: 32 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="storefront" size={30} color="#FFC700" />
                )}
              </View>
              {/* Google Badge */}
              <View style={{ 
                position: 'absolute', bottom: -4, right: -6, backgroundColor: '#FFFFFF', borderRadius: 14, 
                width: 28, height: 28, alignItems: 'center', justifyContent: 'center', 
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 5
              }}>
                <Ionicons name="logo-google" size={16} color="#4285F4" />
              </View>
            </View>

            <Text style={[styles.reviewTitle, { fontSize: 22, marginBottom: 8, paddingHorizontal: 0 }]}>
              {reviewSubmitted ? 'Thank you!' : `Congrats on your new stamp! 🎉`}
            </Text>
            
            <Text style={[styles.reviewSubtitle, { color: '#F8FAFC', opacity: 0.85, fontSize: 14, lineHeight: 22, paddingHorizontal: 16 }]}>
              {reviewSubmitted 
                ? 'Your feedback helps us continuously improve our service.'
                : `Support ${merchant?.name || 'us'} on Google with a quick rating.`}
            </Text>

            {!reviewSubmitted && (
              <>
                {/* 5-Star Rating Row */}
                <View style={[styles.reviewStarsRow, { marginTop: 16, gap: 8 }]}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => handleSelectStar(star)}
                      activeOpacity={0.6}
                      style={[styles.reviewStarBtn, { padding: 4 }]}
                    >
                      <Ionicons 
                        name="star" 
                        size={46} 
                        color={star <= reviewRating ? "#FBBC04" : "#475569"} 
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Rating Guide / Caption */}
                {reviewRating > 0 && reviewRating < 5 && (
                  <View style={styles.reviewLowRatingSection}>
                    <Text style={styles.reviewFeedbackPrompt}>
                      What could we do better? (Private)
                    </Text>
                    <TextInput
                      style={styles.reviewFeedbackInput}
                      placeholder="Share your thoughts or suggestions..."
                      placeholderTextColor="#64748B"
                      multiline={true}
                      numberOfLines={3}
                      value={reviewFeedback}
                      onChangeText={setReviewFeedback}
                    />

                    <TouchableOpacity
                      style={[styles.reviewSubmitBtn, isSubmittingReview && { opacity: 0.7 }]}
                      onPress={handleSubmitPrivateFeedback}
                      disabled={isSubmittingReview}
                      activeOpacity={0.85}
                    >
                      {isSubmittingReview ? (
                        <ActivityIndicator size="small" color="#050505" />
                      ) : (
                        <Text style={styles.reviewSubmitBtnText}>Send Private Feedback</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 5-Star Note */}
                {reviewRating === 5 && (
                  <View style={[styles.review5StarRedirecting, { backgroundColor: 'rgba(251, 188, 4, 0.1)', borderColor: 'rgba(251, 188, 4, 0.25)' }]}>
                    <ActivityIndicator size="small" color="#FBBC04" style={{ marginRight: 10 }} />
                    <Text style={[styles.review5StarText, { color: '#FBBC04' }]}>Opening Google Review...</Text>
                  </View>
                )}
              </>
            )}

            {/* Skip Option */}
            {!reviewSubmitted && reviewRating === 0 && (
              <TouchableOpacity 
                style={[styles.reviewSkipBtn, { marginTop: 8 }]} 
                onPress={() => setShowReviewModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewSkipText}>Maybe later</Text>
              </TouchableOpacity>
            )}
          </BlurView>
        </View>
      </Modal>

      {/* Digital Receipt Modal (Bottom Sheet Style) */}
      {receiptData && (
        <Modal
          visible={showReceiptModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowReceiptModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '80%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                  {isEn ? 'Digital Receipt' : 'Resit Digital'}
                </Text>
                <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
                  <Ionicons name="close-circle" size={28} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    <Ionicons name="storefront" size={32} color="#0F172A" />
                  </View>
                  <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A', textAlign: 'center' }}>{merchant?.name}</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4 }}>
                    {isEn ? 'Receipt #:' : 'Resit #:'} {receiptData.receipt_number || receiptData.id}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                    {new Date(receiptData.created).toLocaleString(isEn ? 'en-MY' : 'ms-MY')}
                  </Text>
                </View>

                <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16, marginBottom: 16 }}>
                  {receiptData.line_items && Array.isArray(receiptData.line_items) ? (
                    receiptData.line_items.map((item: any, idx: number) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#1E293B' }}>{item.name}</Text>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>RM {parseFloat(item.price || 0).toFixed(2)}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#1E293B' }}>
                        {isEn ? 'Service Payment' : 'Pembayaran Servis'}
                      </Text>
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>RM {parseFloat(receiptData.total_amount || 0).toFixed(2)}</Text>
                    </View>
                  )}
                </View>

                <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    {isEn ? 'Total Amount' : 'Jumlah Total'}
                  </Text>
                  <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981' }}>RM {parseFloat(receiptData.total_amount || 0).toFixed(2)}</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* 🎁 MILESTONE & CARD COMPLETION REWARD CELEBRATION SLIDE-UP MODAL */}
      <Modal
        visible={showRewardModal && !!unlockedReward}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={handleCloseRewardModal}
      >
        <View style={styles.rewardModalBackdrop}>
          {/* Backdrop Tap to Dismiss (Click outside card to close) */}
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={handleCloseRewardModal} 
          />

          <View style={[styles.rewardModalCard, isDesktop && { maxWidth: 410 }]}>
            {/* Top Close Button (Circular Gray button with dark icon) */}
            <TouchableOpacity
              style={styles.rewardModalCloseBtn}
              onPress={handleCloseRewardModal}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={16} color="#0F172A" />
            </TouchableOpacity>

            <View style={styles.modalSheetHandleBar} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', width: '100%', paddingBottom: 4 }}
              style={{ width: '100%' }}
              bounces={false}
            >
              {/* 🎁 3D CELEBRATION GIFT BOX */}
              <View style={styles.celebrationHeroContainer}>
                <Image
                  source={require('../assets/reward_gift_box.png')}
                  style={[
                    styles.celebrationGiftImg,
                    Platform.OS === 'web' ? ({ mixBlendMode: 'multiply' } as any) : {}
                  ]}
                  resizeMode="contain"
                />
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.celebrationTitle}>
                {unlockedReward?.isMilestone 
                  ? "You've unlocked\na reward!" 
                  : "Card 100%\nCompleted!"}
              </Text>
              <Text style={styles.celebrationSubtitle}>
                {unlockedReward?.isMilestone
                  ? `Amazing! You've collected ${unlockedReward.atStamp || currentStamps || 5} stamps\nat ${merchantName}.`
                  : `Amazing! You've completed all ${stampGoal || 10} stamps\nat ${merchantName}!`}
              </Text>

              {/* 📊 STAMP PROGRESS BOX (Dynamic 100% Completed for Goal Card vs Incremental Milestone) */}
              <View style={styles.stampProgressBarBox}>
                <View style={styles.stampProgressHeaderRow}>
                  <Text style={styles.stampProgressLabel}>
                    {unlockedReward?.isMilestone
                      ? (locale === 'en' ? 'Your stamp progress' : 'Kemajuan setem anda')
                      : (locale === 'en' ? 'Stamp Card Status' : 'Status Kad Setem')}
                  </Text>
                  <Text style={styles.stampProgressRatio}>
                    {unlockedReward?.isMilestone
                      ? `${unlockedReward?.atStamp || currentStamps || 5} / ${stampGoal || 10}`
                      : `${stampGoal || 10} / ${stampGoal || 10} ${locale === 'en' ? '(COMPLETE)' : '(SELESAI)'}`}
                  </Text>
                </View>
                <View style={styles.stampProgressTrackBg}>
                  <View style={[
                    styles.stampProgressTrackFill,
                    {
                      width: unlockedReward?.isMilestone
                        ? `${Math.min(100, Math.max(10, (((unlockedReward?.atStamp || currentStamps || 5) / (stampGoal || 10)) * 100)))}%`
                        : '100%',
                      backgroundColor: '#FFCC00',
                    }
                  ]} />
                </View>
              </View>

              {/* 🎟️ REAL VOUCHER DESIGN (Standardized with Waly Vouchers System) */}
              {(() => {
                const voucherBrandColor = merchant?.onboarding_primary_color || merchant?.pwa_brand_color || merchant?.brand_color || primaryColor || '#050505';
                const isLightBrand = (() => {
                  const hex = (voucherBrandColor || '#050505').replace('#', '');
                  const r = parseInt(hex.substring(0, 2), 16) || 0;
                  const g = parseInt(hex.substring(2, 4), 16) || 0;
                  const b = parseInt(hex.substring(4, 6), 16) || 0;
                  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
                  return yiq >= 160;
                })();
                const brandTextColor = isLightBrand ? '#0F172A' : '#FFFFFF';
                const spineTheme = getVoucherSpineTheme(
                  unlockedReward?.isMilestone ? 'milestone' : (unlockedReward?.snapshotType || 'free_item'),
                  unlockedReward?.title || 'Reward Voucher',
                  voucherBrandColor
                );

                return (
                  <View style={styles.realVoucherCard}>
                    {/* 1. LEFT STUB: Voucher Category Color Spine */}
                    <View style={[styles.realVoucherLeftSpine, { backgroundColor: voucherBrandColor }]}>
                      <View style={styles.realVoucherSpineTextWrapper}>
                        <Text style={[styles.realVoucherSpineText, { color: brandTextColor }]} numberOfLines={1}>
                          {unlockedReward?.isMilestone ? 'MILESTONE REWARD' : 'GRAND REWARD'}
                        </Text>
                        <Text style={[styles.realVoucherSpineSubtext, { color: brandTextColor }]}>
                          EXCLUSIVE PASS
                        </Text>
                      </View>
                    </View>

                    {/* 2. CENTER ZONE: Reward Information on Pure White */}
                    <View style={styles.realVoucherCenterZone}>
                      {/* Top Row: Ready to redeem pill + Discount tag */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{
                          backgroundColor: '#FFFBEB',
                          borderWidth: 1,
                          borderColor: '#FDE68A',
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3.5,
                        }}>
                          <Ionicons name="gift" size={10} color="#B45309" />
                          <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>
                            Ready to redeem
                          </Text>
                        </View>

                        <View style={{
                          backgroundColor: unlockedReward?.discountValue ? '#0F172A' : '#FFCC00',
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 6,
                        }}>
                          <Text style={{
                            fontSize: 8,
                            fontFamily: 'PlusJakartaSans_800ExtraBold',
                            color: unlockedReward?.discountValue ? '#FFFFFF' : '#050505',
                            letterSpacing: 0.5,
                          }}>
                            {unlockedReward?.discountValue ? 'DISCOUNT' : 'FREE ITEM'}
                          </Text>
                        </View>
                      </View>

                      {/* Middle: YOUR REWARD + Title + Subtitle */}
                      <View style={{ marginVertical: 2 }}>
                        <Text style={{ fontSize: 8, fontFamily: 'PlusJakartaSans_700Bold', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 1, textTransform: 'uppercase' }}>
                          YOUR REWARD
                        </Text>
                        <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.2, lineHeight: 18 }} numberOfLines={1}>
                          {unlockedReward?.title || (unlockedReward?.isMilestone ? 'Free Artisan Coffee' : 'Complete Free Meal Voucher')}
                        </Text>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#6B7280', marginTop: 1, lineHeight: 14 }} numberOfLines={1}>
                          {unlockedReward?.description || (unlockedReward?.isMilestone
                            ? (locale === 'en' ? 'Valid for your next visit' : 'Sah untuk kunjungan seterusnya')
                            : (locale === 'en' ? 'Main Stamp Card Reward Completed' : 'Hadiah Utama Lengkap Kad Setem'))}
                        </Text>
                      </View>

                      {/* Bottom Row: Validity + Code Pill */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="time-outline" size={11} color="#64748B" />
                          <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                            {locale === 'en' ? 'Valid 30 Days' : 'Sah 30 Hari'}
                          </Text>
                        </View>

                        {/* Code Badge */}
                        <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: '#E2E8F0', flexShrink: 0 }}>
                          <Ionicons name="barcode-outline" size={10} color="#0F172A" />
                          <Text style={{ fontSize: 8.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                            {unlockedReward?.code || (unlockedReward?.isMilestone ? 'WV-8821' : 'WV-GOAL-9999')}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* 3. PERFORATION COLUMN */}
                    <View style={styles.realVoucherPerforationCol} pointerEvents="none">
                      <View style={[styles.realVoucherPerforationBgRight, { backgroundColor: voucherBrandColor }]} />
                      <View style={styles.realVoucherDashedLine} />
                      <View style={styles.realVoucherNotchTop} />
                      <View style={styles.realVoucherNotchBottom} />
                    </View>

                    {/* 4. RIGHT STUB */}
                    <View style={[styles.realVoucherRightStub, { backgroundColor: voucherBrandColor }]}>
                      <View style={[
                        styles.realVoucherLogoCircle,
                        { borderColor: isLightBrand ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.3)' }
                      ]}>
                        {merchantLogoUrl && !merchantLogoUrl.includes('placeholder') ? (
                          <Image source={{ uri: merchantLogoUrl }} style={styles.realVoucherLogoImg} resizeMode="cover" />
                        ) : (
                          <Text style={{ fontSize: 18 }}>🍦</Text>
                        )}
                      </View>
                      <Text style={[styles.realVoucherStoreName, { color: brandTextColor }]} numberOfLines={2}>
                        {(merchantName || 'STORE').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* 🏆 TEASER BOX: Next Milestone (Incremental) OR New Card Journey (Goal Complete) */}
              {unlockedReward?.isMilestone && stampGoal ? (
                <View style={styles.nextMilestoneCard}>
                  <View style={styles.nextMilestoneIconWrap}>
                    <Ionicons name="trophy" size={16} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextMilestoneTitle}>Next Milestone</Text>
                    <Text style={styles.nextMilestoneDesc}>
                      {`Collect ${Math.max(1, stampGoal - (unlockedReward.atStamp || currentStamps || 5))} more stamps to unlock your next reward!`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#0F172A" />
                </View>
              ) : (
                <View style={[styles.nextMilestoneCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <View style={[styles.nextMilestoneIconWrap, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="refresh" size={16} color="#15803D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.nextMilestoneTitle, { color: '#15803D' }]}>{locale === 'en' ? 'New Card Activated' : 'Kad Baharu Diaktifkan'}</Text>
                    <Text style={[styles.nextMilestoneDesc, { color: '#166534' }]}>
                      {locale === 'en' ? 'Collect stamps again on your next visit for new rewards!' : 'Kumpul setem semula pada lawatan seterusnya untuk ganjaran baharu!'}
                    </Text>
                  </View>
                  <Ionicons name="sparkles" size={16} color="#15803D" />
                </View>
              )}

              {/* 🔘 ACTION BUTTONS */}
              <TouchableOpacity
                style={styles.rewardModalPrimaryBtn}
                onPress={handleClaimVoucherLogin}
                activeOpacity={0.88}
              >
                <Text style={styles.rewardModalPrimaryBtnText}>
                  {user ? (locale === 'en' ? 'View My Voucher' : 'Lihat Baucar') : (locale === 'en' ? 'Save Voucher to Wallet' : 'Simpan Baucar ke Wallet')}
                </Text>
                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rewardModalDismissBtn}
                onPress={handleCloseRewardModal}
                activeOpacity={0.7}
              >
                <Text style={styles.rewardModalDismissText}>
                  Maybe later
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rewardModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
    zIndex: 99999,
    ...(Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as any : {}),
  },
  rewardModalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#F1F5F9',
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 25,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 100000,
  },
  rewardModalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  modalSheetHandleBar: {
    width: 42,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 4,
  },
  celebrationHeroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    marginBottom: 0,
    width: '100%',
    height: 185,
    position: 'relative',
  },
  celebrationGiftImg: {
    width: 240,
    height: 185,
  },
  celebrationTitle: {
    fontSize: 23,
    lineHeight: 27,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: -24,
    marginBottom: 4,
    letterSpacing: -0.5,
    zIndex: 10,
    elevation: 10,
    textShadowColor: 'rgba(255, 255, 255, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  celebrationSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
    paddingHorizontal: 10,
    zIndex: 10,
  },
  stampProgressBarBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 7,
  },
  stampProgressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stampProgressLabel: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  stampProgressRatio: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  stampProgressTrackBg: {
    width: '100%',
    height: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  stampProgressTrackFill: {
    height: '100%',
    borderRadius: 4,
  },
  realVoucherCard: {
    height: 126,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    position: 'relative',
    marginBottom: 8,
  },
  realVoucherLeftSpine: {
    width: 38,
    alignItems: 'center',
    position: 'relative',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    overflow: 'hidden',
  },
  realVoucherSpineTextWrapper: {
    width: 126,
    height: 38,
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -63,
    marginTop: -19,
    transform: [{ rotate: '-90deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  realVoucherSpineText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  realVoucherSpineSubtext: {
    fontSize: 6.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    opacity: 0.85,
    letterSpacing: 1.2,
    marginTop: 1,
  },
  realVoucherCenterZone: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 9,
    paddingHorizontal: 11,
    justifyContent: 'space-between',
  },
  realVoucherPerforationCol: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 3,
  },
  realVoucherPerforationBgRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 8,
  },
  realVoucherDashedLine: {
    width: 1,
    height: '100%',
    borderColor: '#FFFFFF',
    borderWidth: 1,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  realVoucherNotchTop: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    top: -8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 2,
  },
  realVoucherNotchBottom: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    bottom: -8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 2,
  },
  realVoucherRightStub: {
    width: 88,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  realVoucherLogoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 4,
  },
  realVoucherLogoImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  realVoucherStoreName: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textAlign: 'center',
    width: '100%',
    letterSpacing: 0.3,
  },
  nextMilestoneCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  nextMilestoneIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextMilestoneTitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  nextMilestoneDesc: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 1,
  },
  rewardModalPrimaryBtn: {
    width: '100%',
    height: 44,
    backgroundColor: '#000000',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 3,
  },
  rewardModalPrimaryBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  rewardModalDismissBtn: {
    paddingVertical: 3,
    paddingHorizontal: 14,
  },
  rewardModalDismissText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  reviewModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 99999,
  },
  reviewModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121212',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#27272A',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
    position: 'relative',
  },
  reviewCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  reviewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#27272A',
    overflow: 'hidden',
  },
  reviewTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  reviewSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  reviewStarBtn: {
    padding: 4,
  },
  reviewLowRatingSection: {
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
  },
  reviewFeedbackPrompt: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#E2E8F0',
    marginBottom: 8,
    textAlign: 'center',
  },
  reviewFeedbackInput: {
    width: '100%',
    minHeight: 74,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  reviewSubmitBtn: {
    width: '100%',
    height: 44,
    backgroundColor: '#FFC700',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewSubmitBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  review5StarRedirecting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  review5StarText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
  },
  reviewSkipBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  reviewSkipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  fullPageContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fullPageBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
  },
  invalidWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  invalidIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  invalidTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 6,
  },
  invalidSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  desktopScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  contentCard: {
    width: '100%',
  },
  desktopCard: {
    maxWidth: 440,
    borderRadius: 32,
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  portrait916Card: {
    borderRadius: 32,
    overflow: 'hidden',
    padding: 20,
    minHeight: 680,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAF9F6',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Brand Header
  brandHeaderSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandLogoImage: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: 10,
  },
  brandLogoFallback: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandNameText: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Voucher Ticket Preview (Between Card & Form)
  voucherPreviewContainer: {
    width: '100%',
  },
  voucherRibbonTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    marginHorizontal: 14,
    marginBottom: -1,
    zIndex: 2,
  },
  voucherRibbonText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  // Boarding Pass Ticket Styles
  boardingPassCard: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    height: 165,
  },
  boardingPassBrandBand: {
    width: 36,
    alignItems: 'center',
    position: 'relative',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  boardingPassBandTextWrapper: {
    width: 165,
    height: 36,
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -82.5,
    marginTop: -18,
    transform: [{ rotate: '-90deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardingPassBandText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  boardingPassBandSubtext: {
    fontSize: 7,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  boardingPassBandIcon: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
  },
  boardingPassMainBody: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  boardingPassRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boardingPassRouteText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
    letterSpacing: 0.5,
  },
  boardingPassSmallLabel: {
    fontSize: 7.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  boardingPassSection: {
    marginTop: 8,
  },
  boardingPassValueText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
    letterSpacing: 0.5,
  },
  boardingPassDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  boardingPassBarcodeBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    marginTop: 8,
    gap: 2,
  },
  voucherBarcodeLine: {
    height: '100%',
    borderRadius: 1,
  },
  boardingPassPerforationCol: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 3,
  },
  voucherNotchTop: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    top: -9,
  },
  voucherNotchBottom: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    bottom: -9,
  },
  boardingPassRightStub: {
    width: 90,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#FFFFFF',
  },
  boardingPassStubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  boardingPassStubHeaderText: {
    fontSize: 7.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  boardingPassStubBody: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  boardingPassStubRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  boardingPassStubRouteText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  boardingPassSectionStub: {
    marginBottom: 4,
  },
  boardingPassStubValueText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
  },
  boardingPassDetailsRowStub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boardingPassStubSerial: {
    fontSize: 7,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
  voucherDashedLine: {
    width: 1.5,
    height: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  voucherBodyRight: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  voucherBodyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  voucherTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  voucherBadgeLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  voucherWalletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  voucherWalletPillText: {
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#4F46E5',
    letterSpacing: 0.2,
  },
  voucherRewardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginVertical: 3,
  },
  voucherMainTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.3,
    flex: 1,
    textTransform: 'uppercase',
  },
  voucherMainDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    lineHeight: 15,
    marginBottom: 8,
  },
  voucherProgressSection: {
    marginTop: 'auto',
  },
  voucherProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  voucherProgressLabel: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#78350F',
  },
  voucherProgressPercent: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  voucherProgressBarBg: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#FDE68A',
  },
  voucherProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Form Container
  innerFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  nfcBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 14,
  },
  nfcBadgeTitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
    color: '#B45309',
  },
  formWelcomeTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 6,
  },
  formWelcomeSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
  },
  flag: {
    fontSize: 16,
    marginRight: 6,
  },
  prefixCode: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  prefixDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
    marginLeft: 8,
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
    marginBottom: 12,
  },
  primaryActionBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },

  // Sent State
  sentIconWrap: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  sentHeaderTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  sentHeaderDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  liveSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  liveSyncText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },

  // 1:1 Customer View Loyalty Card Styles
  cardSectionWrap: {
    gap: 16,
  },
  largeCardView: {
    borderRadius: 24,
    padding: 24,
    paddingBottom: 24,
    gap: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
    aspectRatio: 1.586,
    width: '100%',
  },
  largeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  largeCardMerchant: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  shopCategoryText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.8,
  },
  goldBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  goldBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    zIndex: 2,
  },
  cardChip: {
    width: 36,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#D97706',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#B45309',
  },
  chipLineHoriz: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#92400E',
  },
  chipLineVert: {
    position: 'absolute',
    left: 17,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#92400E',
  },
  chipCenterPin: {
    position: 'absolute',
    top: 8,
    left: 13,
    width: 10,
    height: 9,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#92400E',
  },
  largeStampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
    width: '100%',
    marginVertical: 4,
  },
  largeStampEarned: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  largeStampGift: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  largeStampEmpty: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 99,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
  },
  holderCol: {
    flex: 1,
    marginRight: 10,
    gap: 2,
  },
  holderLabel: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.5,
  },
  holderValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  brandBadge: {
    alignItems: 'flex-end',
    gap: 2,
  },
  mastercardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  badgeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  largeProgressPercentage: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // Next Reward Card
  nextRewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  nextRewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  nextRewardImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  nextRewardIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextRewardSublabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginBottom: 2,
  },
  nextRewardMainTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  unlockBtn: {
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  unlockBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  nfcBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  fakeTrustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
  },
  fakeTrustText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  fakeRisevLogoPhoneBg: {
    height: 32,
    width: 128,
    alignSelf: 'center',
    marginTop: 50,
    marginBottom: 50,
    tintColor: '#FFFFFF',
  },
  // ─── SMART PAIRING / ONBOARDING STYLES (PURE WHITE APPLE AESTHETIC) ───
  pairingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  pairingScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairingContentCard: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  pairingDesktopCard: {
    maxWidth: 460,
    borderRadius: 32,
    padding: 24,
  },
  pairingHeaderDashboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  pairingLogo: {
    height: 32,
    width: 105,
  },
  pairingTapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pairingTapBadgeText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  pairingHeroContainer: {
    width: '100%',
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  pairingHeroImage: {
    width: '100%',
    height: '100%',
  },
  pairingTitleSection: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  pairingTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  pairingSubtitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19.5,
    maxWidth: 340,
  },
  pairingSpecsCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
  },
  pairingSpecsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pairingSpecsSerialLabel: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  pairingSpecsSerialCode: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.8,
  },
  pairingOfficialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pairingOfficialBadgeText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },
  pairingSpecsDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  pairingSpecsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pairingSpecCol: {
    flex: 1,
    alignItems: 'center',
  },
  pairingSpecColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  pairingSpecColVal: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  pairingSpecColLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    textAlign: 'center',
  },
  pairingSpecColDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  pairingActionWrap: {
    width: '100%',
    gap: 12,
  },
  pairingAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 4,
  },
  pairingAccountAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pairingAccountLabel: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  pairingAccountName: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  pairingSwitchBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pairingSwitchBtnText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  pairingBranchBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
  },
  pairingBranchBoxLabel: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  pairingBranchChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pairingBranchChipSelected: {
    backgroundColor: '#FFCC00',
    borderColor: '#FFCC00',
  },
  pairingBranchChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  pairingBranchChipTextSelected: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pairingAddBranchChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pairingAddBranchChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  pairingBtnPrimary: {
    width: '100%',
    height: 54,
    backgroundColor: '#FFCC00',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFCC00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  pairingBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pairingBtnPrimaryText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.2,
  },
  pairingBtnSecondary: {
    width: '100%',
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairingBtnSecondaryText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  pairingHelpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  pairingHelpLinkText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
  },
  desktopCardGlass: {
    maxWidth: 460,
    borderRadius: 32,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  radarCardWrap: {
    width: '100%',
    marginVertical: 12,
  },
  radarGlassCard: {
    borderRadius: 28,
    overflow: 'hidden',
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  radarStage: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 24,
  },
  radarPulseRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
  },
  radarCenterOrbWrapper: {
    width: 130,
    height: 130,
    borderRadius: 65,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  radarCenterOrb: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  radarLogoWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 6,
  },
  radarLogoImage: {
    width: '100%',
    height: '100%',
  },
  radarBeaconWrap: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarBeaconPing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#34D399',
  },
  radarBeaconCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  radarStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 2,
    marginBottom: 6,
  },
  radarStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 7,
  },
  radarStatusPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#047857',
    letterSpacing: 0.8,
  },
  radarHeading: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  radarSubheading: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: 16,
  },
  radarDotsWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  radarDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  radarInstructionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  radarInstructionText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  radarSuccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  radarSuccessBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  radarChangePhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  radarChangePhoneText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(255, 255, 255, 0.65)',
    textDecorationLine: 'underline',
  },
  nfcBookAppointmentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  nfcBookAppointmentLinkText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textDecorationLine: 'underline',
  },
  receiptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 360,
  },
  receiptBannerText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  receiptBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  receiptBannerBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  postApprovalBookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 8,
    alignItems: 'stretch',
  },
  postApprovalBookingTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    gap: 6,
    marginBottom: 10,
  },
  postApprovalBookingTag: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#047857',
  },
  postApprovalBookingTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.6,
    lineHeight: 25,
    textAlign: 'left',
    marginBottom: 4,
  },
  postApprovalBookingSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'left',
    lineHeight: 18,
    marginBottom: 14,
  },
  postApprovalBookingBtn: {
    backgroundColor: '#FFCC00',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFCC00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  postApprovalBookingBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  postApprovalBookingSecondaryBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  postApprovalBookingSecondaryBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  voucherBookingPillWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  voucherBookingPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  voucherBookingPillText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
  },
  orDividerText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  walkinAppointmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.2,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  walkinBtnIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkinBtnTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    marginBottom: 2,
  },
  walkinBtnSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});
