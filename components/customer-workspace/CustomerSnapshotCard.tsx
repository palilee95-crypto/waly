import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, iconSizes, radii, shadows, spacing } from '@/theme';
import {
  WorkspaceSnapshot,
  AudienceCard,
  formatCount,
  pctChange,
} from '@/lib/customer-workspace';

type Props = {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenAudience: (card: AudienceCard) => void;
  onOpenDirectory?: () => void;
};

export default function CustomerSnapshotCard({
  snapshot,
  periodLabel,
  onOpenDirectory,
}: Props) {
  const { overview } = snapshot;
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const stackFooter = width < 350;

  const visited = overview.visited;
  const returningCount = overview.returningCount;
  const newCount = overview.newCount;
  const returningShare = visited > 0 ? Math.round((returningCount / visited) * 100) : 0;
  const change = pctChange(visited, overview.previous.visited);
  const newCaption =
    periodLabel.toLowerCase() === 'this month'
      ? 'First visit this month'
      : `First visit · ${periodLabel}`;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text style={styles.eyebrow}>CUSTOMER ACTIVITY</Text>
          <Text style={[styles.title, compact && styles.titleCompact]}>Your customers</Text>
        </View>

        <Text style={styles.periodLabel}>{periodLabel}</Text>
      </View>

      <View style={styles.visitedRow}>
        <Text style={[styles.visitedValue, compact && styles.visitedValueCompact]}>
          {formatCount(visited)}
        </Text>
        <View style={styles.visitedCopy}>
          <Text style={styles.visitedLabel} numberOfLines={1}>
            customers visited
          </Text>

          {change === null ? (
            <Text style={styles.deltaMuted}>No previous period</Text>
          ) : (
            <View style={[styles.deltaPill, change < 0 && styles.deltaPillDown]}>
              <Ionicons
                name={change < 0 ? 'trending-down' : 'trending-up'}
                size={iconSizes.micro}
                color={change < 0 ? colors.error.dark : colors.success.dark}
              />
              <Text style={[styles.deltaText, change < 0 && styles.deltaTextDown]}>
                {change > 0 ? '+' : ''}
                {change}%
              </Text>
              <Text style={styles.deltaCaption}>vs previous</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.footerRow, stackFooter && styles.footerRowStack]}>
        <View
          style={[styles.mini, stackFooter ? styles.miniStacked : styles.miniFlex]}
        >
          <View style={[styles.miniIcon, styles.miniIconNew]}>
            <Ionicons name="person-add" size={iconSizes.md} color={colors.primary[600]} />
          </View>
          <View style={styles.miniCopy}>
            <Text style={styles.miniValue}>{formatCount(newCount)}</Text>
            <Text style={styles.miniLabel}>New customers</Text>
            <Text style={styles.miniCaption}>{newCaption}</Text>
          </View>
        </View>

        <View style={[styles.footerDivider, stackFooter && styles.footerDividerStack]} />

        <View
          style={[styles.mini, stackFooter ? styles.miniStacked : styles.miniFlex]}
        >
          <View style={[styles.miniIcon, styles.miniIconReturning]}>
            <Ionicons name="people" size={iconSizes.md} color={colors.black} />
          </View>
          <View style={styles.miniCopy}>
            <Text style={styles.miniValue}>{formatCount(returningCount)}</Text>
            <Text style={styles.miniLabel}>Returning</Text>
            <Text style={styles.miniCaption}>
              Came back again{visited > 0 ? ` · ${returningShare}%` : ''}
            </Text>
          </View>
        </View>
      </View>
      {onOpenDirectory ? (
        <TouchableOpacity
          style={styles.directoryLink}
          onPress={onOpenDirectory}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Manage customers"
        >
          <Text style={styles.directoryText}>Manage customers</Text>
          <Ionicons name="arrow-forward" size={iconSizes.sm} color={colors.black} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent[100],
    padding: spacing[5],
    ...shadows.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  headCopy: { flex: 1, minWidth: 0 },
  periodLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: colors.accent[500],
    marginTop: 3,
  },
  eyebrow: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.accent[400],
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: colors.black,
    marginTop: 2,
  },
  titleCompact: { fontSize: 23, lineHeight: 28 },
  visitedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginTop: spacing[3],
    paddingBottom: spacing[3],
  },
  visitedCopy: { flex: 1, minWidth: 0 },
  visitedValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2,
    color: colors.black,
  },
  visitedValueCompact: { fontSize: 46, lineHeight: 50 },
  visitedLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: colors.black,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    backgroundColor: colors.success.light,
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    marginTop: spacing[2],
  },
  deltaPillDown: { backgroundColor: colors.error.light },
  deltaText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 12,
    color: colors.success.dark,
  },
  deltaTextDown: { color: colors.error.dark },
  deltaCaption: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10.5,
    color: colors.accent[500],
  },
  deltaMuted: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: colors.accent[400],
    marginTop: spacing[2],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: colors.accent[100],
    paddingTop: spacing[3],
  },
  footerRowStack: { flexDirection: 'column', alignItems: 'stretch' },
  mini: {
    minWidth: 0,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  miniFlex: { flex: 1 },
  miniStacked: { width: '100%', paddingVertical: spacing[2] },
  miniIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniIconNew: { backgroundColor: colors.primary[50] },
  miniIconReturning: { backgroundColor: colors.accent[50] },
  miniCopy: { flex: 1, minWidth: 0 },
  miniValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: colors.black,
  },
  miniLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: colors.black,
    marginTop: -1,
  },
  miniCaption: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: colors.accent[400],
    marginTop: 1,
  },
  footerDivider: {
    width: 1,
    backgroundColor: colors.accent[100],
    marginHorizontal: spacing[3],
  },
  footerDividerStack: {
    width: '100%',
    height: 1,
    marginHorizontal: 0,
    marginVertical: spacing[2],
  },
  directoryLink: {
    minHeight: 44,
    marginTop: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radii.md,
    backgroundColor: colors.accent[50],
  },
  directoryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: colors.black,
  },
});
