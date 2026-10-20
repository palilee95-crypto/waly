import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, iconSizes, radii, spacing } from '@/theme';

type Props = {
  label: string;
  onPress?: () => void;
};

export default function PeriodPill({ label, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.pill}
      activeOpacity={0.75}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Period: ${label}`}
    >
      <Text style={styles.text}>{label}</Text>
      <Ionicons name="chevron-down" size={iconSizes.sm} color={colors.accent[400]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  text: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: colors.accent[700],
  },
});
