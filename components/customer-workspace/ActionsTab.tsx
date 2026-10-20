import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { WorkspaceSnapshot, AudienceCard } from '@/lib/customer-workspace';

type Props = {
  snapshot: WorkspaceSnapshot;
  onOpenAudience: (card: AudienceCard) => void;
  onShareStore: () => void;
  onOpenReports: () => void;
};

type CardSpec = {
  key: string;
  icon: any;
  title: string;
  detail: string;
  chip: string | null;
  chipStyle: { bg: string; fg: string };
  enabled: boolean;
  onPress?: () => void;
};

const CHIP = {
  amber: { bg: '#FEF3C7', fg: '#B45309' },
  blue: { bg: '#DBEAFE', fg: '#1D4ED8' },
  red: { bg: '#FEE2E2', fg: '#B91C1C' },
  purple: { bg: '#EDE9FE', fg: '#6D28D9' },
  grey: { bg: '#F1F5F9', fg: '#475569' },
};

export default function ActionsTab({
  snapshot,
  onOpenAudience,
  onShareStore,
  onOpenReports,
}: Props) {
  const count = (id: 'return' | 'rewards' | 'rebook') =>
    snapshot.attention.find((a) => a.id === id)?.count ?? 0;

  const cards: CardSpec[] = [
    {
      key: 'return',
      icon: 'people-outline',
      title: 'Bring customers back',
      detail: "Customers who haven't visited recently.",
      chip: `${count('return')} customers`,
      chipStyle: CHIP.amber,
      enabled: true,
      onPress: () => onOpenAudience('return'),
    },
    {
      key: 'rewards',
      icon: 'gift-outline',
      title: 'Customers near reward',
      detail: '1-2 stamps away from a reward.',
      chip: `${snapshot.loyalty.nearReward} customers`,
      chipStyle: CHIP.blue,
      enabled: true,
      onPress: () => onOpenAudience('rewards'),
    },
    {
      key: 'rebook',
      icon: 'calendar-outline',
      title: 'Not rebooked yet',
      detail: 'Past their expected return date.',
      chip: `${count('rebook')} customers`,
      chipStyle: CHIP.red,
      enabled: true,
      onPress: () => onOpenAudience('rebook'),
    },
    {
      // No schedule data exists yet, so this card claims nothing.
      key: 'capacity',
      icon: 'time-outline',
      title: 'Fill slow slots',
      detail: 'Needs staff schedules — not connected yet.',
      chip: 'Soon',
      chipStyle: CHIP.grey,
      enabled: false,
    },
    {
      key: 'birthday',
      icon: 'balloon-outline',
      title: 'Upcoming birthdays',
      detail: 'Celebrate with a special treat.',
      chip: `${snapshot.birthdays} customers`,
      chipStyle: CHIP.purple,
      enabled: true,
      onPress: () => onOpenAudience('birthday'),
    },
    {
      key: 'share',
      icon: 'share-outline',
      title: 'Get new customers',
      detail: 'Share your booking link or QR.',
      chip: 'Tools',
      chipStyle: CHIP.grey,
      enabled: true,
      onPress: onShareStore,
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.sparkle}>✨</Text>
          <Text style={styles.title}>Recommended for you</Text>
        </View>
        <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
      </View>
      <Text style={styles.subtitle}>
        Take action to bring back customers and grow your business.
      </Text>

      {cards.map((card) => (
        <TouchableOpacity
          key={card.key}
          style={[styles.card, !card.enabled && styles.cardDisabled]}
          activeOpacity={card.enabled ? 0.85 : 1}
          disabled={!card.enabled}
          onPress={card.onPress}
        >
          <View style={styles.iconTile}>
            <Ionicons name={card.icon} size={18} color="#334155" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDetail}>{card.detail}</Text>
          </View>
          {card.chip ? (
            <View style={[styles.chip, { backgroundColor: card.chipStyle.bg }]}>
              <Text style={[styles.chipText, { color: card.chipStyle.fg }]}>{card.chip}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={15} color={card.enabled ? '#686868' : '#CBD5E1'} />
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.reportsRow} activeOpacity={0.85} onPress={onOpenReports}>
        <View style={styles.iconTile}>
          <Ionicons name="bar-chart-outline" size={18} color="#334155" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>View detailed reports</Text>
          <Text style={styles.cardDetail}>Explore sales, loyalty, bookings and more.</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color="#686868" />
      </TouchableOpacity>

      <Text style={styles.footnote}>
        Every customer opens in your own WhatsApp with the message prefilled. Risev does not send anything and
        cannot confirm delivery.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sparkle: { fontSize: 14 },
  title: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#EEEEF0',
    paddingVertical: 13,
    paddingHorizontal: 13,
  },
  cardDisabled: { backgroundColor: '#FAFAFA' },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
  cardDetail: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.full },
  chipText: { fontSize: 10.5, fontFamily: 'PlusJakartaSans_700Bold' },
  reportsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#EEEEF0',
    paddingVertical: 13,
    paddingHorizontal: 13,
    marginTop: 2,
  },
  footnote: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
    marginTop: 6,
  },
});
