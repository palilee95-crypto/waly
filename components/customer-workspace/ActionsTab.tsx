import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { WorkspaceSnapshot, AudienceCard } from '@/lib/customer-workspace';

type Props = {
  snapshot: WorkspaceSnapshot;
  onOpenAudience: (card: AudienceCard) => void;
  onShareStore: () => void;
};

/**
 * Four cards, not the pack's six: "Encourage rebooking" is a subset of
 * "Bring customers back", and "Fill available slots" has no schedule data to compute.
 * Every card opens the audience first — nothing is sent from here.
 */
export default function ActionsTab({ snapshot, onOpenAudience, onShareStore }: Props) {
  const countFor = (id: 'return' | 'rewards') =>
    snapshot.attention.find((a) => a.id === id)?.count ?? 0;

  const cards: {
    key: string;
    icon: any;
    title: string;
    detail: string;
    count: number | null;
    onPress: () => void;
  }[] = [
    {
      key: 'return',
      icon: 'time-outline',
      title: 'Bring customers back',
      detail: 'Past their usual return window.',
      count: countFor('return'),
      onPress: () => onOpenAudience('return'),
    },
    {
      key: 'rewards',
      icon: 'gift-outline',
      title: 'Rewards ready',
      detail: 'A valid voucher or 1–2 stamps from a reward.',
      count: countFor('rewards'),
      onPress: () => onOpenAudience('rewards'),
    },
    {
      key: 'birthday',
      icon: 'balloon-outline',
      title: 'Birthdays this week',
      detail: 'Rewards are already automated; send a personal nudge.',
      count: snapshot.birthdays,
      onPress: () => onOpenAudience('birthday'),
    },
    {
      key: 'share',
      icon: 'share-outline',
      title: 'Share your store',
      detail: 'Send your join link so new customers can register.',
      count: null,
      onPress: onShareStore,
    },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>
        Review the audience before you message anyone. Each customer opens in your own WhatsApp — nothing is
        sent automatically.
      </Text>

      {cards.map((card) => (
        <TouchableOpacity key={card.key} style={styles.card} activeOpacity={0.85} onPress={card.onPress}>
          <View style={styles.iconBox}>
            <Ionicons name={card.icon} size={17} color={colors.black} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{card.title}</Text>
            <Text style={styles.detail}>{card.detail}</Text>
          </View>
          {card.count !== null ? (
            <Text style={styles.count}>{card.count.toLocaleString('en-MY')}</Text>
          ) : null}
          <Ionicons name="chevron-forward" size={15} color="#686868" />
        </TouchableOpacity>
      ))}

      <Text style={styles.footnote}>
        Push notifications reach only customers who enabled them, so these cards open WhatsApp on your device
        instead.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  intro: {
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
    borderColor: '#E9E9E9',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
  detail: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  count: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  footnote: {
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
    marginTop: 6,
  },
});
