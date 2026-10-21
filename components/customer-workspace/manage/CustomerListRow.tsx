import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, iconSizes, radii, spacing } from '@/theme';
import { formatMoney, relativeDays } from '@/lib/customer-workspace';
import { avatarUrl, type ManageCustomerRow } from '@/lib/customer-management';

type Props = {
  row: ManageCustomerRow;
  selected?: boolean;
  onPress: () => void;
};

function initials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) || '')).toUpperCase();
}

export default function CustomerListRow({ row, selected, onPress }: Props) {
  const last = row.lastVisit ? relativeDays(row.lastVisit) : 'never visited';

  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      activeOpacity={0.78}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.visits} visits, ${last}`}
    >
      {row.avatar ? (
        <Image source={{ uri: avatarUrl(row.id, row.avatar) }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{initials(row.name)}</Text>
        </View>
      )}

      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>
          {row.name || 'Customer'}
        </Text>
        <Text style={styles.phone} numberOfLines={1}>
          {row.phone || 'No phone on file'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {row.visits} visit{row.visits === 1 ? '' : 's'} · {last}
        </Text>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Ionicons name="ribbon-outline" size={10} color={colors.accent[500]} />
            <Text style={styles.chipText}>
              {row.stamps}/{row.stampGoal}
            </Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="sparkles-outline" size={10} color={colors.accent[500]} />
            <Text style={styles.chipText}>{row.points} pts</Text>
          </View>
          {row.activeVouchers > 0 ? (
            <View style={styles.chip}>
              <Ionicons name="gift-outline" size={10} color={colors.accent[500]} />
              <Text style={styles.chipText}>{row.activeVouchers}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.spend}>{formatMoney(row.spendCents)}</Text>
        <Ionicons name="chevron-forward" size={iconSizes.sm} color={colors.accent[400]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[2],
    borderRadius: radii.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent[50],
  },
  rowSelected: {
    backgroundColor: colors.primary[50],
    borderBottomColor: 'transparent',
  },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent[100] },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14,
    color: colors.primary[700],
  },
  copy: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13.5,
    color: colors.black,
  },
  phone: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10.5,
    color: colors.accent[400],
    marginTop: 1,
  },
  meta: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10.5,
    color: colors.accent[500],
    marginTop: 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1.5] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing[1.5],
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: colors.accent[50],
  },
  chipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 9,
    color: colors.accent[700],
  },
  right: { alignItems: 'flex-end', gap: spacing[2] },
  spend: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 12,
    color: colors.black,
  },
});
