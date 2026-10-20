import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import {
  WorkspaceSnapshot,
  formatMoney,
  formatCount,
  formatDayLabel,
} from '@/lib/customer-workspace';

type ReportId = 'customers' | 'sales' | 'loyalty' | 'bookings' | 'feedback' | 'results';

const REPORTS: { id: ReportId; label: string }[] = [
  { id: 'customers', label: 'Customers' },
  { id: 'sales', label: 'Sales' },
  { id: 'loyalty', label: 'Loyalty' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'results', label: 'Campaign results' },
];

type Props = {
  snapshot: WorkspaceSnapshot;
  entitled: boolean;
  onUpgrade: () => void;
  onOpenActivity: () => void;
  onOpenAnalytics: () => void;
};

export default function ReportsTab({
  snapshot,
  entitled,
  onUpgrade,
  onOpenActivity,
  onOpenAnalytics,
}: Props) {
  const [report, setReport] = useState<ReportId>('customers');

  if (!entitled) {
    return (
      <View style={styles.lockedCard}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed" size={18} color={colors.black} />
        </View>
        <Text style={styles.lockedTitle}>Reports are a PRO feature</Text>
        <Text style={styles.lockedBody}>
          Detailed customer, sales, loyalty and booking reports are included with PRO. Overview and the
          attention list stay available on your current plan.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={onUpgrade}>
          <Text style={styles.primaryBtnText}>See PRO plans</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {REPORTS.map((r) => {
          const active = r.id === report;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setReport(r.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ReportBody
        report={report}
        snapshot={snapshot}
        onOpenActivity={onOpenActivity}
        onOpenAnalytics={onOpenAnalytics}
      />
    </View>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function Row({
  title,
  detail,
  value,
  icon,
  onPress,
}: {
  title: string;
  detail: string;
  value?: string;
  icon: any;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={onPress ? 0.85 : 1} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.black} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={15} color="#686868" /> : null}
    </TouchableOpacity>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

function ReportBody({
  report,
  snapshot,
  onOpenActivity,
  onOpenAnalytics,
}: {
  report: ReportId;
  snapshot: WorkspaceSnapshot;
  onOpenActivity: () => void;
  onOpenAnalytics: () => void;
}) {
  const { overview, loyalty, bookings, feedback, unavailable } = snapshot;

  if (report === 'customers') {
    return (
      <View style={styles.card}>
        <View style={styles.metricRow}>
          <Metric label="Visited" value={formatCount(overview.visited)} />
          <Metric label="New" value={formatCount(overview.newCount)} />
          <Metric label="Returning" value={formatCount(overview.returningCount)} />
        </View>
        <Note>First recorded visits versus customers with earlier visits. The two groups never overlap.</Note>
        <Row
          title="All customers"
          detail="Search profiles and recorded visits."
          icon="people-outline"
          onPress={onOpenActivity}
        />
        <Row
          title="Activity history"
          detail="Purchases, stamps and voucher redemptions."
          icon="time-outline"
          onPress={onOpenActivity}
        />
      </View>
    );
  }

  if (report === 'sales') {
    return (
      <View style={styles.card}>
        <View style={styles.metricRow}>
          <Metric label="Recorded sales" value={formatMoney(overview.salesCents)} />
          <Metric label="Orders" value={formatCount(overview.orders)} />
          <Metric label="Average order" value={formatMoney(overview.avgOrderCents)} />
        </View>
        <Note>
          Recorded eligible sales, not all store revenue. Average order value divides sales by orders, never
          by customers.
        </Note>
        <Row
          title="Transaction activity"
          detail="Inspect the records behind these numbers."
          icon="receipt-outline"
          onPress={onOpenActivity}
        />
        <Row
          title="Open full analytics"
          detail="Outlet comparison and deeper breakdowns."
          icon="bar-chart-outline"
          onPress={onOpenAnalytics}
        />
      </View>
    );
  }

  if (report === 'loyalty') {
    const max = Math.max(1, ...loyalty.daily.map((d) => d.stamps));
    return (
      <View style={styles.card}>
        <View style={styles.metricRow}>
          <Metric label="Stamps given" value={formatCount(overview.stamps)} />
          <Metric label="Points earned" value={formatCount(overview.pointsEarned)} />
          <Metric label="Vouchers used" value={formatCount(overview.vouchersRedeemed)} />
        </View>
        <View style={styles.chart}>
          {loyalty.daily.map((d) => (
            <View key={d.date} style={styles.barSlot}>
              <Text style={styles.barValue}>{d.stamps}</Text>
              <View style={[styles.bar, { height: Math.max(3, (d.stamps / max) * 54) }]} />
              <Text style={styles.barLabel}>{formatDayLabel(d.date)}</Text>
            </View>
          ))}
        </View>
        <Note>
          Bars are stamp events, not customers or visits. {formatCount(loyalty.nearReward)} customers are 1–2
          stamps from a reward; a completed card is not near a reward.
        </Note>
        <Row
          title="Customers near a reward"
          detail="One or two stamps left on an active card."
          icon="gift-outline"
          value={formatCount(loyalty.nearReward)}
          onPress={onOpenActivity}
        />
        <Row
          title="Valid vouchers"
          detail="Current wallet state, not the report period."
          icon="ticket-outline"
          value={formatCount(loyalty.availableVouchers)}
        />
      </View>
    );
  }

  if (report === 'bookings') {
    return (
      <View style={styles.card}>
        <View style={styles.metricRow}>
          <Metric label="Completed" value={formatCount(bookings.completed)} />
          <Metric label="Upcoming" value={formatCount(bookings.upcoming)} />
        </View>
        <View style={styles.metricRow}>
          <Metric label="Cancelled" value={formatCount(bookings.cancelled)} />
          <Metric label="No-show" value={formatCount(bookings.noShow)} />
        </View>
        <Note>
          {bookings.total} appointment{bookings.total === 1 ? '' : 's'} in this period. Statuses are not
          interchangeable, and a scheduled booking is not a completed return.
        </Note>
        <Row
          title="Customers with a future booking"
          detail="Booked or in service after today."
          icon="calendar-outline"
          value={formatCount(bookings.nextBookingCustomers)}
        />
        <Row
          title="Available slots"
          detail={unavailable.availableSlots ? 'Needs staff and resource schedules to compute.' : ''}
          icon="time-outline"
          value="Unavailable"
        />
      </View>
    );
  }

  if (report === 'feedback') {
    return (
      <View style={styles.card}>
        <View style={styles.metricRow}>
          <Metric
            label="Risev rating"
            value={feedback.avgRating === null ? 'No ratings' : `${feedback.avgRating.toFixed(1)}/5`}
          />
          <Metric label="Responses" value={formatCount(feedback.responses)} />
          <Metric label="Google link opens" value={unavailable.googleReviewOpens ? 'Unavailable' : '—'} />
        </View>
        <Note>
          Ratings are collected inside Risev. Opening a Google review link is not proof of a published
          review{unavailable.branchFeedback ? ', and feedback is recorded per store rather than per outlet' : ''}.
        </Note>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.lockIcon}>
        <Ionicons name="analytics-outline" size={18} color={colors.black} />
      </View>
      <Text style={styles.lockedTitle}>Campaign results not connected</Text>
      <Text style={styles.lockedBody}>
        Delivery, attributed returns and voucher use are not tracked yet. A return after a message is an
        observation, not proof of incremental revenue.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  chipRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: '#FFCC00', borderColor: '#FFCC00' },
  chipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#686868',
  },
  chipTextActive: { color: colors.black, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    padding: 18,
    gap: 12,
  },
  metricRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1 },
  metricValue: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.3,
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 3,
  },
  metricSub: { fontSize: 10, color: '#686868', marginTop: 2 },
  note: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F6F6F6',
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
  rowDetail: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  rowValue: { fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 92,
    paddingTop: 6,
  },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: 16, borderRadius: 4, backgroundColor: '#FFCC00' },
  barValue: { fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: '#686868' },
  barLabel: { fontSize: 9, fontFamily: 'PlusJakartaSans_500Medium', color: '#686868' },
  lockedCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    padding: 22,
    alignItems: 'flex-start',
    gap: 10,
  },
  lockIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
  lockedBody: {
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
  },
  primaryBtn: {
    height: 49,
    borderRadius: radii.md,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
});
