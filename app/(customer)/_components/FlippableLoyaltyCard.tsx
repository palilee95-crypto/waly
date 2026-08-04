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

  const cardStyle = {
    backgroundColor: (card.gradientColors ?? ['#EC4899', '#8B5CF6'])[0],
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    aspectRatio: 1.586,
    width: '100%',
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
            <View style={styles.glossyReflection} />
            {card.cardBackground ? (
              <Image source={{ uri: card.cardBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : null}
            
            <View style={styles.cardContentPadding}>
              <View style={styles.largeCardHeader}>
                <View style={styles.shopLogoBg}>
                  <Image source={{ uri: card.logo }} style={styles.shopLogo} />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.largeCardMerchant, card.fontColor && { color: card.fontColor }]} numberOfLines={1}>
                    {card.merchantName}
                  </Text>
                  <Text style={[styles.shopCategoryText, card.fontColor && { color: card.fontColor, opacity: 0.65 }]}>
                    {card.category.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.goldBadge}>
                  <Text style={styles.goldBadgeText}>LOYALTY CARD</Text>
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
                  <Text style={[styles.holderValue, card.fontColor && { color: card.fontColor }]}>12/30</Text>
                </View>
                <View style={{ width: 35 }}>
                  <Text style={[styles.holderLabel, card.fontColor && { color: card.fontColor, opacity: 0.5 }]}>CVV</Text>
                  <Text style={[styles.holderValue, card.fontColor && { color: card.fontColor }]}>888</Text>
                </View>
                <View style={styles.brandBadge}>
                  <View style={styles.mastercardBadge}>
                    <View style={[styles.badgeCircle, { backgroundColor: '#EF4444' }]} />
                    <View style={[styles.badgeCircle, { backgroundColor: '#F59E0B', marginLeft: -9, opacity: 0.9 }]} />
                  </View>
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
            {card.cardBackground ? (
              <Image source={{ uri: card.cardBackground }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : null}
            <View style={styles.glossyReflectionBack} />

            {/* Magnetic Stripe */}
            <View style={styles.magneticStripe}>
              <Text style={styles.magneticStripeText} numberOfLines={1}>
                {card.merchantName.toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.cardContentPaddingBack}>
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

              <View style={styles.backFooter}>
                <Text style={[styles.memberIdText, card.fontColor && { color: card.fontColor }]}>
                  {(user?.name || 'Ahmad Fazli').toUpperCase()}
                </Text>
                <View style={styles.qrCodeWrapper}>
                  <Text style={[styles.qrLabel, card.fontColor && { color: card.fontColor }]}>SCAN</Text>
                  <Ionicons name="qr-code" size={24} color={card.fontColor || '#FFFFFF'} style={{ opacity: 0.9 }} />
                </View>
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
    position: 'absolute',
    top: -200,
    left: '20%',
    width: 140,
    height: 800,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ rotate: '40deg' }],
    pointerEvents: 'none',
    zIndex: 1,
  },
  glossyReflectionBack: {
    position: 'absolute',
    top: -200,
    right: '20%',
    width: 140,
    height: 800,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ rotate: '-40deg' }],
    pointerEvents: 'none',
    zIndex: 1,
  },
  cardContentPadding: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  cardContentPaddingBack: {
    flex: 1,
    padding: 16,
    paddingTop: 4,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  largeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shopLogoBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  shopLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  largeCardMerchant: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  shopCategoryText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginTop: 2,
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
    width: 44,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#EAB308',
    borderWidth: 1.2,
    borderColor: '#CA8A04',
    position: 'relative',
    overflow: 'hidden',
  },
  chipLineHoriz: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 15,
    height: 1,
    backgroundColor: '#854D0E',
  },
  chipLineVert: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 14,
    width: 1,
    backgroundColor: '#854D0E',
  },
  chipCenterPin: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 20,
    width: 1,
    backgroundColor: '#854D0E',
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
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 0.5,
  },
  holderValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  brandBadge: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 30,
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
    marginTop: 20,
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    alignContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 8, // Added margin to push stamps down away from the text
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
