import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { colors, radii } from '@/theme';
import { pb } from '@/lib/pocketbase';
import {
  WorkspaceSnapshot,
  formatMoney,
  formatCount,
  formatDayLabel,
  pctChange,
  relativeDays,
} from '@/lib/customer-workspace';

type ReportId = 'customers' | 'bookings' | 'sales' | 'loyalty' | 'reviews';

const REPORTS: { id: ReportId; label: string; icon: any }[] = [
  { id: 'customers', label: 'Customers', icon: 'person-outline' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar-outline' },
  { id: 'sales', label: 'Sales', icon: 'wallet-outline' },
  { id: 'loyalty', label: 'Loyalty', icon: 'ribbon-outline' },
  { id: 'reviews', label: 'Reviews', icon: 'star-outline' },
];

type Props = {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenDirectory: () => void;
  onOpenAudience: (id: 'return' | 'rewards' | 'rebook') => void;
  onOpenAnalytics: () => void;
};

export default function ReportsTab({
  snapshot,
  periodLabel,
  onOpenDirectory,
  onOpenAudience,
  onOpenAnalytics,
}: Props) {
  const [report, setReport] = useState<ReportId>('customers');

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconTabs}>
        {REPORTS.map((r) => {
          const active = r.id === report;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.iconTab, active && styles.iconTabActive]}
              onPress={() => setReport(r.id)}
              activeOpacity={0.85}
            >
              <Ionicons name={r.icon} size={15} color={active ? '#FFCC00' : '#686868'} />
              <Text style={[styles.iconTabText, active && styles.iconTabTextActive]}>{r.label}</Text>
              {active ? <View style={styles.activeUnderline} /> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {report === 'customers' ? (
        <CustomersReport
          snapshot={snapshot}
          periodLabel={periodLabel}
          onOpenDirectory={onOpenDirectory}
        />
      ) : (
        <OtherReport
          report={report}
          snapshot={snapshot}
          onOpenDirectory={onOpenDirectory}
          onOpenAudience={onOpenAudience}
          onOpenAnalytics={onOpenAnalytics}
        />
      )}
    </View>
  );
}

function CustomersReport({
  snapshot,
  periodLabel,
  onOpenDirectory,
}: {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenDirectory: () => void;
}) {
  const { overview, topCustomers, inactive } = snapshot;
  const total = overview.visited;
  const newPct = total ? Math.round((overview.newCount / total) * 100) : 0;
  const returningPct = total ? Math.round((overview.returningCount / total) * 100) : 0;
  const returnDelta = pctChange(overview.returningCount, overview.previous.returningCount);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Customer Retention</Text>
          <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>{periodLabel}</Text>
          <Ionicons name="chevron-down" size={11} color="#686868" />
        </View>
      </View>

      <View style={styles.retentionRow}>
        <View style={styles.donutCard}>
          <Donut total={total} newPct={newPct} />
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FFCC00' }]} />
              <View>
                <Text style={styles.legendLabel}>New</Text>
                <Text style={styles.legendMeta}>
                  {overview.newCount} ({newPct}%)
                </Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#111111' }]} />
              <View>
                <Text style={styles.legendLabel}>Returning</Text>
                <Text style={styles.legendMeta}>
                  {overview.returningCount} ({returningPct}%)
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.returnedCard}>
          <Text style={styles.returnedPct}>{returningPct}%</Text>
          <Text style={styles.returnedLabel}>returned this month</Text>
          {returnDelta !== null ? (
            <View style={styles.returnedDelta}>
              <Ionicons
                name={returnDelta < 0 ? 'trending-down' : 'trending-up'}
                size={11}
                color={returnDelta < 0 ? '#B91C1C' : '#16A34A'}
              />
              <Text
                style={[styles.returnedDeltaText, returnDelta < 0 && { color: '#B91C1C' }]}
              >
                {returnDelta > 0 ? '+' : ''}
                {returnDelta}%
              </Text>
            </View>
          ) : null}
          <Text style={styles.returnedMeta}>vs last month</Text>
        </View>
      </View>

      <View style={styles.sectionHead}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trophy" size={13} color="#B45309" />
          <Text style={styles.sectionTitle}>Top Customers</Text>
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>By Spend</Text>
          <Ionicons name="chevron-down" size={11} color="#686868" />
        </View>
      </View>

      <View style={styles.listCard}>
        {topCustomers.length === 0 ? (
          <Text style={styles.emptyText}>No recorded spend in this period.</Text>
        ) : (
          topCustomers.map((c, i) => (
            <View key={c.id} style={[styles.topRow, i > 0 && styles.rowDivider]}>
              <Text style={styles.rank}>{i + 1}</Text>
              <Avatar id={c.id} avatar={c.avatar} name={c.name} size={34} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.topName} numberOfLines={1}>
                    {c.name || 'Customer'}
                  </Text>
                  {i === 0 ? (
                    <View style={styles.vipBadge}>
                      <Text style={styles.vipText}>TOP</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.topMeta} numberOfLines={1}>
                  {c.visits} visit{c.visits === 1 ? '' : 's'} · Last visit {relativeDays(c.lastVisit)}
                </Text>
              </View>
              <Text style={styles.topSpend}>{formatMoney(c.spendCents)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Inactive Customers (&gt; {snapshot.bookings ? 30 : 30} days)</Text>
        <TouchableOpacity onPress={onOpenDirectory} activeOpacity={0.7}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inactiveRow}>
        {inactive.length === 0 ? (
          <Text style={styles.emptyText}>Every customer has visited recently.</Text>
        ) : (
          inactive.slice(0, 5).map((c) => (
            <View key={c.id} style={styles.inactiveCard}>
              <Avatar id={c.id} avatar={c.avatar} name={c.name} size={34} />
              <Text style={styles.inactiveName} numberOfLines={1}>
                {c.name || 'Customer'}
              </Text>
              <Text style={styles.inactiveDays}>{c.daysIdle ?? '?'} days idle</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function OtherReport({
  report,
  snapshot,
  onOpenDirectory,
  onOpenAudience,
  onOpenAnalytics,
}: {
  report: ReportId;
  snapshot: WorkspaceSnapshot;
  onOpenDirectory: () => void;
  onOpenAudience: (id: 'return' | 'rewards' | 'rebook') => void;
  onOpenAnalytics: () => void;
}) {
  const { overview, bookings, loyalty, feedback, unavailable } = snapshot;

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
        <Text style={styles.note}>
          {bookings.total} appointment{bookings.total === 1 ? '' : 's'} in this period. Statuses are not
          interchangeable, and a scheduled booking is not a completed return.
        </Text>
        <Row
          title="Customers with a future booking"
          detail="Booked or in service after today."
          value={formatCount(bookings.nextBookingCustomers)}
          icon="calendar-outline"
        />
        <Row
          title="Available slots"
          detail={unavailable.availableSlots ? 'Needs staff and resource schedules to compute.' : ''}
          value="Unavailable"
          icon="time-outline"
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
        </View>
        <View style={styles.metricRow}>
          <Metric label="Average order" value={formatMoney(overview.avgOrderCents)} />
          <Metric label="Vouchers used" value={formatCount(overview.vouchersRedeemed)} />
        </View>
        <Text style={styles.note}>
          Recorded eligible sales, not all store revenue. Average order value divides sales by orders, never
          by customers.
        </Text>
        <Row
          title="Customer directory"
          detail="Every customer at this store, newest visit first."
          icon="people-outline"
          onPress={onOpenDirectory}
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
        <Text style={styles.note}>
          Bars are stamp events, not customers or visits. {loyalty.nearReward} customers are 1–2 stamps from
          a reward; a completed card is not near a reward.
        </Text>
        <Row
          title="Customers near a reward"
          detail="One or two stamps left on an active card."
          value={formatCount(loyalty.nearReward)}
          icon="gift-outline"
          onPress={() => onOpenAudience('rewards')}
        />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.metricRow}>
        <Metric
          label="Risev rating"
          value={feedback.avgRating === null ? 'No ratings' : `${feedback.avgRating.toFixed(1)}/5`}
        />
        <Metric label="Responses" value={formatCount(feedback.responses)} />
      </View>
      <Text style={styles.note}>
        Ratings are collected inside Risev. Opening a Google review link is not proof of a published review
        {unavailable.googleReviewOpens ? ', and link opens are not tracked yet' : ''}.
      </Text>
    </View>
  );
}

function Donut({ total, newPct }: { total: number; newPct: number }) {
  const size = 96;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const newLen = (Math.max(0, Math.min(100, newPct)) / 100) * c;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#111111" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#FFCC00"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${newLen} ${c - newLen}`}
          strokeLinecap="butt"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutTotal}>{total}</Text>
        <Text style={styles.donutLabel}>total{'\n'}customers</Text>
      </View>
    </View>
  );
}

function Avatar({
  id,
  avatar,
  name,
  size,
}: {
  id: string;
  avatar: string;
  name: string;
  size: number;
}) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  if (avatar) {
    return (
      <Image
        source={{ uri: `${pb.baseUrl}/api/files/_pb_users_auth_/${id}/${avatar}` }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F1F5F9' }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#475569' }}>
        {initials}
      </Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  iconTabs: { gap: 6, paddingVertical: 2, paddingRight: 8 },
  iconTab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.md,
    minWidth: 68,
  },
  iconTabActive: { backgroundColor: '#111111' },
  iconTabText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#686868',
  },
  iconTabTextActive: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold' },
  activeUnderline: {
    position: 'absolute',
    bottom: 4,
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFCC00',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F6F6F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  metaChipText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#686868' },
  retentionRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  donutCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#EEEEF0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutTotal: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.6,
  },
  donutLabel: {
    fontSize: 8.5,
    lineHeight: 11,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
  },
  legend: { flex: 1, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  legendLabel: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
  legendMeta: { fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#686868' },
  returnedCard: {
    width: 118,
    backgroundColor: '#ECFDF5',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 14,
    justifyContent: 'center',
  },
  returnedPct: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#047857',
    letterSpacing: -0.8,
  },
  returnedLabel: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#047857',
    marginTop: 1,
  },
  returnedDelta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  returnedDeltaText: { fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#16A34A' },
  returnedMeta: { fontSize: 9.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#16A34A' },
  listCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#EEEEF0',
    paddingHorizontal: 14,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#F6F6F6' },
  rank: {
    width: 14,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topName: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.black, flexShrink: 1 },
  vipBadge: {
    backgroundColor: '#FFCC00',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  vipText: { fontSize: 8, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111111' },
  topMeta: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  topSpend: { fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  viewAll: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#DC2626' },
  inactiveRow: { gap: 10, paddingRight: 8 },
  inactiveCard: {
    width: 108,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#EEEEF0',
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  inactiveName: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
  inactiveDays: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#DC2626' },
  emptyText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    paddingVertical: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#EEEEF0',
    padding: 16,
    gap: 12,
  },
  metricRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1 },
  metricValue: {
    fontSize: 18,
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
});
