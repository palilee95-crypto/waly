import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkspaceSnapshot } from '@/lib/customer-workspace';
import { colors, radii } from '@/theme';

type Props = {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  scopeLabel: string;
  onOpenCustomers: () => void;
  onOpenReport: (report: 'customers' | 'bookings') => void;
};

export default function OverviewTab({
  snapshot,
  periodLabel,
  scopeLabel,
  onOpenCustomers,
  onOpenReport,
}: Props) {
  const { overview, attention, bookings } = snapshot;
  // The pack caps attention at two actionable rows — more than that is noise.
  const visibleAttention = attention.filter((a) => (a.count ?? 0) > 0).slice(0, 2);

  return (
    <View style={styles.wrap}>
      {/* Headline: one number + the mutually exclusive split */}
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{scopeLabel.toUpperCase()} · {periodLabel.toUpperCase()}</Text>
        <Text style={styles.heroNumber}>{overview.visited.toLocaleString('en-MY')}</Text>
        <Text style={styles.heroLabel}>Customers who visited</Text>

        <View style={styles.splitRow}>
          <View style={styles.splitItem}>
            <Text style={styles.splitValue}>{overview.newCount.toLocaleString('en-MY')}</Text>
            <Text style={styles.splitLabel}>New</Text>
          </View>
          <View style={styles.splitDivider} />
          <View style={styles.splitItem}>
            <Text style={styles.splitValue}>{overview.returningCount.toLocaleString('en-MY')}</Text>
            <Text style={styles.splitLabel}>Returning</Text>
          </View>
        </View>
        <Text style={styles.footnote}>
          New = first recorded visit this period. Returning = visited before it. They do not overlap.
        </Text>
      </View>

      {/* Needs attention — max two */}
      <Text style={styles.sectionTitle}>Needs attention</Text>
      {visibleAttention.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Nothing overdue or waiting right now.</Text>
        </View>
      ) : (
        visibleAttention.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.row}
            activeOpacity={0.85}
            onPress={onOpenCustomers}
          >
            <View style={styles.rowIcon}>
              <Ionicons
                name={item.id === 'return' ? 'time-outline' : 'gift-outline'}
                size={17}
                color={colors.black}
              />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowDetail}>{item.detail}</Text>
            </View>
            <Text style={styles.rowCount}>{(item.count ?? 0).toLocaleString('en-MY')}</Text>
            <Ionicons name="chevron-forward" size={15} color="#686868" />
          </TouchableOpacity>
        ))
      )}

      {/* Appointments */}
      <Text style={styles.sectionTitle}>Appointments</Text>
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onOpenReport('bookings')}>
        <View style={styles.bookRow}>
          <View style={styles.bookStat}>
            <Text style={styles.bookValue}>{bookings.completed.toLocaleString('en-MY')}</Text>
            <Text style={styles.bookLabel}>Completed</Text>
          </View>
          <View style={styles.bookStat}>
            <Text style={styles.bookValue}>{bookings.upcoming.toLocaleString('en-MY')}</Text>
            <Text style={styles.bookLabel}>Upcoming</Text>
          </View>
          <View style={styles.bookStat}>
            <Text style={styles.bookValue}>{bookings.noShow.toLocaleString('en-MY')}</Text>
            <Text style={styles.bookLabel}>No-show</Text>
          </View>
        </View>
        <Text style={styles.footnote}>
          {bookings.nextBookingCustomers} customer
          {bookings.nextBookingCustomers === 1 ? '' : 's'} with a future booking. A scheduled booking is not a
          completed return.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9E9E9',
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#686868',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  heroNumber: {
    fontSize: 44,
    lineHeight: 48,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -1.4,
  },
  heroLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#686868',
    marginTop: 2,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E9E9E9',
  },
  splitItem: { flex: 1 },
  splitValue: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
  splitLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  splitDivider: { width: 1, height: 30, backgroundColor: '#E9E9E9' },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    marginTop: 6,
    marginLeft: 2,
  },
  row: {
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
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.black,
  },
  rowDetail: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  rowCount: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
  emptyCard: {
    backgroundColor: '#F6F6F6',
    borderRadius: radii.lg,
    padding: 16,
  },
  emptyText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
  },
  bookRow: { flexDirection: 'row', gap: 12 },
  bookStat: { flex: 1 },
  bookValue: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
  bookLabel: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
});
