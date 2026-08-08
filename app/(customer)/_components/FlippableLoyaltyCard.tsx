import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';

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

export default function FlippableLoyaltyCard({ card, user, startFlipped = false, autoFlipDelay }: { card: any, user: any, startFlipped?: boolean, autoFlipDelay?: number }) {
  const flipAnim = useRef(new Animated.Value(startFlipped ? 1 : 0)).current;
  const [isFlipped, setIsFlipped] = useState(startFlipped);
  const userInteracted = useRef(false);

  useEffect(() => {
    flipAnim.setValue(startFlipped ? 1 : 0);
    setIsFlipped(startFlipped);
    userInteracted.current = false;

    if (autoFlipDelay) {
      const timer = setTimeout(() => {
        if (!userInteracted.current) {
          Animated.spring(flipAnim, {
            toValue: startFlipped ? 0 : 1,
            friction: 12,
            tension: 15,
            useNativeDriver: true,
          }).start();
          setIsFlipped(!startFlipped);
        }
      }, autoFlipDelay);
      return () => clearTimeout(timer);
    }
  }, [card, startFlipped, autoFlipDelay, flipAnim]);

  const flipCard = () => {
    userInteracted.current = true;
    if (isFlipped) {
      Animated.spring(flipAnim, {
        toValue: 0,
        friction: 12,
        tension: 15,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(flipAnim, {
        toValue: 1,
        friction: 12,
        tension: 15,
        useNativeDriver: true,
      }).start();
    }
    setIsFlipped(!isFlipped);
  };

  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.51, 1],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.51, 1],
    outputRange: [0, 0, 1, 1],
  });

  const renderMiniStampIcon = (iconId: string, size: number, color: string) => {
    const icon = stampIcons.find(i => i.id === iconId) || stampIcons.find(i => i.id === 'coffee')!;
    if (icon.family === 'Ionicons') return <Ionicons name={icon.name as any} size={size} color={color} />;
    if (icon.family === 'FontAwesome') return <FontAwesome name={icon.name as any} size={size} color={color} />;
    if (icon.family === 'MaterialIcons') return <MaterialIcons name={icon.name as any} size={size} color={color} />;
    return <Ionicons name="cafe" size={size} color={color} />;
  };

  const renderMiniStamps = () => {
    const slots = [];
    for (let i = 1; i <= card.totalStamps; i++) {
      if (i <= card.collectedStamps) {
        slots.push(
          <View key={i} style={[
            styles.miniStampEarned, 
            { backgroundColor: card.stampColor || 'rgba(255,255,255,0.95)' }
          ]}>
            {renderMiniStampIcon(card.cardIcon, 14, card.stampColor ? '#FFFFFF' : '#000000')}
          </View>
        );
      } else {
        slots.push(
          <View key={i} style={styles.miniStampEmpty}>
            {renderMiniStampIcon(card.cardIcon, 14, card.fontColor ? `${card.fontColor}40` : 'rgba(255, 255, 255, 0.3)')}
          </View>
        );
      }
    }
    return slots;
  };

  // Detect if the card background is bright (light color)
  const isColorBright = (hex: string): boolean => {
    try {
      const c = hex.replace('#', '');
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      // Perceived brightness formula
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 155;
    } catch { return false; }
  };

  const bgColor = (card.gradientColors ?? ['#EC4899'])[0];
  const logoTint = isColorBright(bgColor) ? '#000000' : '#FFFFFF';

  const cardStyle = {
    backgroundColor: (card.gradientColors ?? ['#EC4899', '#8B5CF6'])[0],
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    aspectRatio: 1.586,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 14,
  } as any;

  return (
    <View style={{ width: '100%', aspectRatio: 1.586, perspective: 1000 } as any}>
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={flipCard} 
        style={{ flex: 1 }}
      >
        {/* FRONT OF CARD */}
        <Animated.View style={[
          StyleSheet.absoluteFill,
          cardStyle,
          {
            transform: [{ rotateY: frontRotateY as any }],
            backfaceVisibility: 'hidden',
            opacity: frontOpacity as any,
          }
        ]}>
          <View style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: 'hidden' }]}>
            {/* Subtle metallic sheen */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)', zIndex: 1, pointerEvents: 'none' }} />
            <View style={{ position: 'absolute', top: -300, left: '30%', width: '18%', height: 900, backgroundColor: 'rgba(255,255,255,0.07)', transform: [{ rotate: '40deg' }], zIndex: 1, pointerEvents: 'none' }} />
            {card.cardBackground ? (
              <Image source={{ uri: card.cardBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : null}
            
            <View style={styles.cardContentPadding}>
              <View style={styles.largeCardHeader}>
                <View style={styles.shopLogoBg}>
                  {card.logo && !card.logo.includes('placeholder') ? (
                    <Image source={{ uri: card.logo }} style={styles.shopLogo} />
                  ) : (
                    <Ionicons name="storefront" size={20} color="#64748B" />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 0, gap: 2 }}>
                  <Text style={[styles.largeCardMerchant, card.fontColor && { color: card.fontColor }]} numberOfLines={1}>
                    {card.merchantName}
                  </Text>
                  <Text style={[styles.shopCategoryText, card.fontColor && { color: card.fontColor, opacity: 0.65 }]}>
                    {card.category.toUpperCase()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }, card.fontColor && { color: card.fontColor }]}>
                    {card.collectedStamps}/{card.totalStamps}
                  </Text>
                  <Text style={[{ fontSize: 9, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.75)' }, card.fontColor && { color: card.fontColor, opacity: 0.75 }]}>STAMPS</Text>
                </View>
              </View>

              <View style={styles.cardMidRow}>
                <View style={styles.cardChip}>
                  <View style={styles.chipLineHoriz} />
                  <View style={styles.chipLineVert} />
                  <View style={styles.chipCenterPin} />
                </View>
                <Ionicons 
                  name="wifi" 
                  size={22} 
                  color={card.fontColor ? card.fontColor : "rgba(255, 255, 255, 0.35)"} 
                  style={{ opacity: 0.45 }} 
                />
              </View>

              <View style={styles.largeCardFooter}>
                <View style={styles.holderCol}>
                  <Text style={[styles.holderLabel, card.fontColor && { color: card.fontColor, opacity: 0.5 }]}>CARD HOLDER</Text>
                  <Text style={[styles.holderValue, card.fontColor && { color: card.fontColor }]} numberOfLines={1}>
                    {(user?.name || 'Ahmad Fazli').toUpperCase()}
                  </Text>
                </View>
                <View style={{ width: 45 }}>
                  <Text style={[styles.holderLabel, card.fontColor && { color: card.fontColor, opacity: 0.5 }]}>VALID</Text>
                  <Text style={[styles.holderValue, card.fontColor && { color: card.fontColor }]}>{card.validUntil || '12/30'}</Text>
                </View>
                <View style={{ width: 35 }}>
                  <Text style={[styles.holderLabel, card.fontColor && { color: card.fontColor, opacity: 0.5 }]}>CVV</Text>
                  <Text style={[styles.holderValue, card.fontColor && { color: card.fontColor }]}>888</Text>
                </View>
                <View style={styles.brandBadge}>
                  <Image
                    source={require('../../../assets/risev logo.png')}
                    style={{ width: 44, height: 16, resizeMode: 'contain', tintColor: logoTint }}
                  />
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[
          StyleSheet.absoluteFill,
          cardStyle,
          {
            transform: [{ rotateY: backRotateY as any }],
            backfaceVisibility: 'hidden',
            opacity: backOpacity as any,
          }
        ]}>
          <View style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: 'hidden' }]}>
            {/* Subtle metallic sheen (back) */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)', zIndex: 1, pointerEvents: 'none' }} />
            <View style={{ position: 'absolute', top: -300, right: '30%', width: '18%', height: 900, backgroundColor: 'rgba(255,255,255,0.07)', transform: [{ rotate: '-40deg' }], zIndex: 1, pointerEvents: 'none' }} />
            {card.cardBackgroundBack ? (
              <Image source={{ uri: card.cardBackgroundBack }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : null}
            <View style={styles.glossyReflectionBack} />

            {/* Magnetic Stripe */}
            <View style={styles.magneticStripe}>
              <Text style={styles.magneticStripeText} numberOfLines={1}>
                {card.merchantName.toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.cardContentPaddingBack}>
              <View>
                {/* Minimalist Status Header */}
                <View style={styles.minimalBackHeader}>
                  <Text style={[styles.minimalBackLabel, card.fontColor && { color: card.fontColor, opacity: 0.6 }]}>
                    YOUR STAMPS
                  </Text>
                  <Text style={[styles.minimalBackProgress, card.fontColor && { color: card.fontColor }]}>
                    {card.collectedStamps}/{card.totalStamps}
                  </Text>
                </View>

                {/* Stamps grid details */}
                <View style={styles.largeStampsGridWrapper}>
                  {renderMiniStamps()}
                </View>
              </View>

              <View style={{ position: 'absolute', bottom: 16, right: 24 }}>
                <Image
                  source={require('../../../assets/risev logo.png')}
                  style={{ width: 44, height: 16, resizeMode: 'contain', tintColor: logoTint }}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  glossyReflection: {
    display: 'none', // replaced by inline metallic layers
  },
  glossyReflectionBack: {
    display: 'none', // replaced by inline metallic layers
  },
  cardContentPadding: {
    flex: 1,
    padding: 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  cardContentPaddingBack: {
    flex: 1,
    padding: 24,
    paddingTop: 12,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  largeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shopLogoBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  shopLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
  },
  largeCardMerchant: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  shopCategoryText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  goldBadge: {
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 4,
    marginVertical: 10,
  },
  cardChip: {
    width: 32,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F59E0B',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  chipLineHoriz: {
    position: 'absolute',
    top: 11,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: '#B45309',
  },
  chipLineVert: {
    position: 'absolute',
    top: 0,
    left: 15,
    width: 1,
    height: '100%',
    backgroundColor: '#B45309',
  },
  chipCenterPin: {
    position: 'absolute',
    top: 6,
    left: 10,
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FBBF24',
    borderWidth: 1,
    borderColor: '#B45309',
  },
  largeCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  holderCol: {
    gap: 4,
    flex: 1,
    marginRight: 10,
  },
  holderLabel: {
    fontSize: 7,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.5,
  },
  holderValue: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  brandBadge: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  mastercardBadge: {
    flexDirection: 'row',
  },
  badgeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  magneticStripe: {
    width: '100%',
    height: 44,
    backgroundColor: '#111827',
    marginTop: 16,
    opacity: 0.95,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  magneticStripeText: {
    color: 'rgba(255, 255, 255, 0.15)',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    letterSpacing: 6,
  },
  minimalBackHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    marginTop: 0, // Moved up closer to the magnetic stripe
  },
  minimalBackLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  minimalBackProgress: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  largeStampsGridWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    alignContent: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  miniStampEarned: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF', // Default overridden in inline style
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  miniStampEmpty: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 4,
    paddingHorizontal: 8,
  },
  memberIdText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.5,
    opacity: 0.5,
    marginBottom: 4,
  },
  qrCodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 8,
    marginBottom: 2,
    letterSpacing: 0.5,
    opacity: 0.7,
  },
});
