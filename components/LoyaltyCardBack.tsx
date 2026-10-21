import { Image, StyleSheet, Text, View } from 'react-native';
import { FontAwesome, Ionicons, MaterialIcons } from '@expo/vector-icons';

/**
 * The loyalty card as the customer sees it on the NFC page (app/nfc.tsx, back
 * face): magnetic stripe, "YOUR STAMPS", the stamp grid and the Risev mark.
 * Static copy of that markup so merchants can see the real card without the
 * flip animation. Keep the two in sync when the NFC card changes.
 */

/** White or near-black, whichever stays readable on the merchant's card colour. */
export function inkOn(background: string) {
  const hex = String(background || '').replace('#', '');
  if (hex.length < 6) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16) || 0;
  const g = parseInt(hex.slice(2, 4), 16) || 0;
  const b = parseInt(hex.slice(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 >= 160 ? '#0F172A' : '#FFFFFF';
}

const STAMP_ICONS = [
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
] as const;

function stampIcon(iconId: string, size: number, color: string) {
  const icon = STAMP_ICONS.find((entry) => entry.id === iconId) || STAMP_ICONS[3];
  if (icon.family === 'FontAwesome') return <FontAwesome name={icon.name as any} size={size} color={color} />;
  if (icon.family === 'MaterialIcons') return <MaterialIcons name={icon.name as any} size={size} color={color} />;
  return <Ionicons name={icon.name as any} size={size} color={color} />;
}

type Props = {
  merchantName: string;
  cardColor: string;
  fontColor: string;
  cardIcon: string;
  backgroundImage?: string;
  stamps: number;
  goal: number;
  points: number;
  enableStamps: boolean;
  spendPerPoint?: number;
  milestones?: number[];
};

export default function LoyaltyCardBack({
  merchantName,
  cardColor,
  fontColor,
  cardIcon,
  backgroundImage,
  stamps,
  goal,
  points,
  enableStamps,
  spendPerPoint = 1,
  milestones = [],
}: Props) {
  const stampGoal = Math.max(1, goal);
  const bubbleColor = fontColor === '#FFFFFF' ? '#000000' : fontColor;
  const borderColor = `${fontColor}30`;
  const emptyBgColor = `${fontColor}08`;

  const renderBubble = (slot: number) => {
    const earned = slot <= stamps;
    const milestone = milestones.indexOf(slot) >= 0;
    const finalGoal = slot === stampGoal;
    const activeBorder = earned ? 'transparent' : milestone ? '#FFCC00' : borderColor;
    const activeBg = earned ? bubbleColor : milestone ? 'rgba(255, 204, 0, 0.15)' : emptyBgColor;

    return (
      <View style={styles.bubbleWrap}>
        <View
          style={[
            styles.bubble,
            {
              borderWidth: earned ? 0 : 1.5,
              borderColor: activeBorder,
              borderStyle: earned ? 'solid' : 'dashed',
              backgroundColor: activeBg,
            },
          ]}
        >
          {earned ? (
            <>
              {stampIcon(cardIcon, 14, cardColor)}
              {milestone ? (
                <View style={[styles.milestonePill, styles.milestonePillEarned]}>
                  <Text style={styles.milestoneGlyph}>🎁</Text>
                </View>
              ) : null}
            </>
          ) : milestone ? (
            <>
              <Text style={{ fontSize: 13 }}>🎁</Text>
              <View style={[styles.milestonePill, { top: -5, right: -5, paddingHorizontal: 3, paddingVertical: 0.5 }]}>
                <Text style={styles.milestoneNumber}>{slot}</Text>
              </View>
            </>
          ) : finalGoal ? (
            <Ionicons name="ribbon" size={15} color={borderColor} />
          ) : (
            stampIcon(cardIcon, 14, borderColor)
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: cardColor }]}>
      {backgroundImage ? (
        <Image source={{ uri: backgroundImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}

      {/* Card plastic gloss shine reflection */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 5 }]} pointerEvents="none">
        <View style={styles.glossWide} />
        <View style={styles.glossNarrow} />
      </View>

      {/* Magnetic stripe */}
      <View style={styles.stripe}>
        <Text style={styles.stripeText} numberOfLines={1}>
          {merchantName.toUpperCase()}
        </Text>
      </View>

      {enableStamps ? (
        <View style={styles.body}>
          <View style={styles.stampHeading}>
            <Text style={[styles.stampLabel, { color: fontColor }]}>YOUR STAMPS</Text>
            <Text style={[styles.stampCount, { color: fontColor }]}>
              {stamps}/{stampGoal}
            </Text>
          </View>

          <View style={styles.gridWrap}>
            {stampGoal === 10 ? (
              <View style={{ gap: 6, marginVertical: 6 }}>
                <View style={styles.gridRow}>
                  {Array.from({ length: 6 }, (_, index) => (
                    <View key={index} style={styles.gridCell}>
                      {renderBubble(index + 1)}
                    </View>
                  ))}
                </View>
                <View style={styles.gridRow}>
                  {Array.from({ length: 4 }, (_, index) => (
                    <View key={index} style={styles.gridCell}>
                      {renderBubble(index + 7)}
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.gridWrapFlow}>
                {Array.from({ length: stampGoal }, (_, index) => (
                  <View key={index} style={styles.gridCellFlow}>
                    {renderBubble(index + 1)}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.risevMark}>
            <Image source={require('../assets/risev logo.png')} style={[styles.risevLogo, { tintColor: fontColor }]} />
          </View>
        </View>
      ) : (
        <View style={styles.pointsBody}>
          <View style={styles.pointsTop}>
            <View>
              <Text style={[styles.pointsLabel, { color: fontColor }]}>POINTS BALANCE</Text>
              <Text style={styles.pointsValue}>{points.toLocaleString()} PTS</Text>
            </View>
            <View style={styles.vipChip}>
              <Text style={styles.vipText}>VIP MEMBER</Text>
            </View>
          </View>

          <Text style={[styles.pointsHint, { color: fontColor }]}>
            {`Earn 1 point per RM ${Number(spendPerPoint) > 1 ? spendPerPoint : 1} spent at ${merchantName}`}
          </Text>

          <View style={styles.risevMark}>
            <Image source={require('../assets/risev logo.png')} style={[styles.risevLogo, { tintColor: fontColor }]} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
    position: 'relative',
  },
  glossWide: {
    position: 'absolute',
    top: -160,
    left: -80,
    width: '150%',
    height: 260,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    transform: [{ rotate: '-30deg' }],
  },
  glossNarrow: {
    position: 'absolute',
    top: -160,
    left: 25,
    width: 28,
    height: 600,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    transform: [{ rotate: '-30deg' }],
  },
  stripe: {
    width: '100%',
    height: 44,
    backgroundColor: '#111827',
    marginTop: 16,
    opacity: 0.95,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  stripeText: {
    color: 'rgba(255, 255, 255, 0.15)',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    letterSpacing: 6,
  },
  body: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12, flex: 1 },
  stampHeading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, gap: 8 },
  stampLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 0.5, opacity: 0.7 },
  stampCount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16 },
  gridWrap: { flex: 1, justifyContent: 'center' },
  gridWrapFlow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6, justifyContent: 'center' },
  gridRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', width: '100%' },
  gridCell: { width: '13.5%', aspectRatio: 1 },
  gridCellFlow: { width: '17%', aspectRatio: 1 },
  bubbleWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  bubble: { width: '80%', aspectRatio: 1, borderRadius: 99, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  milestonePill: {
    position: 'absolute',
    backgroundColor: '#FFCC00',
    borderRadius: 6,
    paddingHorizontal: 2.5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#000000',
    zIndex: 10,
  },
  milestonePillEarned: { top: -4, right: -4 },
  milestoneGlyph: { fontSize: 7, fontWeight: '900', color: '#000000' },
  milestoneNumber: { fontSize: 7, fontWeight: '900', color: '#000000' },
  risevMark: { position: 'absolute', bottom: 16, right: 24 },
  risevLogo: { width: 44, height: 16, resizeMode: 'contain' },
  pointsBody: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 16, flex: 1, justifyContent: 'center' },
  pointsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pointsLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 0.5, opacity: 0.7 },
  pointsValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: '#FFC700' },
  vipChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 199, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FFC700',
  },
  vipText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, color: '#FFC700', textTransform: 'uppercase' },
  pointsHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, opacity: 0.8, textAlign: 'center', marginTop: 8 },
});
