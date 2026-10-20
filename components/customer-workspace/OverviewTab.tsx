import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { colors, radii } from '@/theme';
import { WorkspaceSnapshot, pctChange, formatDayLabel } from '@/lib/customer-workspace';

type Props = {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenReport: (report: 'customers' | 'bookings') => void;
  onOpenDirectory: () => void;
};

export default function OverviewTab({
  snapshot,
  periodLabel,
  onOpenReport,
  onOpenDirectory,
}: Props) {
  const { overview, trend, bookings, loyalty } = snapshot;
  const change = pctChange(overview.visited, overview.previous.visited);
  const busiest = trend.reduce(
    (best, d) => (d.visits > best.visits ? d : best),
    trend[0] || { date: '', visits: 0 }
  );

  return (
    <View style={styles.wrap}>
      {/* ── Customer visits ── */}
      <View style={styles.sectionHead}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Customer Visits</Text>
          <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
        </View>
        <Text style={styles.sectionMeta}>{periodLabel}</Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroNumber}>{overview.visited.toLocaleString('en-MY')}</Text>
        <Text style={styles.heroLabel}>customers visited</Text>
        {change !== null ? (
          <View style={[styles.deltaPill, change < 0 && styles.deltaPillNegative]}>
            <Ionicons
              name={change < 0 ? 'trending-down' : 'trending-up'}
              size={12}
              color={change < 0 ? '#B91C1C' : '#16A34A'}
            />
            <Text style={[styles.deltaText, change < 0 && { color: '#B91C1C' }]}>
              {change > 0 ? '+' : ''}
              {change}%
            </Text>
            <Text style={styles.deltaMeta}>vs last month</Text>
          </View>
        ) : (
          <Text style={styles.deltaMeta}>No previous period to compare</Text>
        )}
      </View>

      <View style={styles.splitRow}>
        <View style={[styles.splitCard, { backgroundColor: '#FFFBEA', borderColor: '#FDE68A' }]}>
          <View style={[styles.splitIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="person" size={15} color="#B45309" />
          </View>
          <Text style={styles.splitValue}>{overview.newCount.toLocaleString('en-MY')}</Text>
          <Text style={styles.splitLabel}>New customers</Text>
          <Text style={styles.splitCaption}>First visit this month</Text>
        </View>

        <View style={[styles.splitCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
          <View style={[styles.splitIcon, { backgroundColor: '#EEF2F7' }]}>
            <Ionicons name="people" size={15} color="#334155" />
          </View>
          <Text style={styles.splitValue}>{overview.returningCount.toLocaleString('en-MY')}</Text>
          <Text style={styles.splitLabel}>Returning customers</Text>
          <Text style={styles.splitCaption}>Came back again</Text>
        </View>
      </View>

      {/* ── Visit trend ── */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Visit Trend</Text>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>Last 7 days</Text>
          <Ionicons name="chevron-down" size={11} color="#686868" />
        </View>
      </View>

      <View style={styles.card}>
        <TrendChart data={trend} />
      </View>

      {busiest.visits > 0 ? (
        <TouchableOpacity
          style={styles.insight}
          activeOpacity={0.85}
          onPress={onOpenDirectory}
        >
          <View style={styles.insightIcon}>
            <Ionicons name="bulb-outline" size={16} color="#B45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.insightTitle}>
              {new Date(`${busiest.date}T00:00:00+08:00`).toLocaleDateString('en-MY', {
                weekday: 'long',
              })}{' '}
              was your busiest day
            </Text>
            <Text style={styles.insightBody}>
              {busiest.visits} visit{busiest.visits === 1 ? '' : 's'} recorded
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color="#686868" />
        </TouchableOpacity>
      ) : null}

      {/* ── Smart booking ── */}
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onOpenReport('bookings')}>
        <View style={styles.rowBetween}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}>
              <Ionicons name="calendar-outline" size={17} color={colors.black} />
            </View>
            <View>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.rowTitle}>Smart Booking</Text>
                <Ionicons name="information-circle-outline" size={13} color="#9CA3AF" />
              </View>
              <Text style={styles.rowCaption}>
                {bookings.completed} completed appointment{bookings.completed === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#686868" />
        </View>
        <Text style={styles.footnote}>
          {bookings.nextBookingCustomers} customer
          {bookings.nextBookingCustomers === 1 ? '' : 's'} with a future booking · {loyalty.nearReward}{' '}
          near a reward
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function TrendChart({ data }: { data: { date: string; visits: number }[] }) {
  const [width, setWidth] = useState(0);
  const height = 116;
  const padTop = 22;
  const padBottom = 8;
  const max = Math.max(1, ...data.map((d) => d.visits));
  const inner = height - padTop - padBottom;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * width : width / 2;
    const y = padTop + inner - (d.visits / max) * inner;
    return { x, y, value: d.visits };
  });

  return (
    <View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line
              x1={0}
              y1={padTop + inner}
              x2={width}
              y2={padTop + inner}
              stroke="#F1F5F9"
              strokeWidth={1}
            />
            {points.length > 1 ? (
              <Polyline
                points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#FFCC00"
                strokeWidth={2.4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={3.4} fill="#FFFFFF" stroke="#FFCC00" strokeWidth={2} />
            ))}
          </Svg>
        ) : null}

        {points.map((p, i) => (
          <Text
            key={`v${i}`}
            style={[styles.pointValue, { left: Math.max(0, p.x - 12), top: Math.max(0, p.y - 18) }]}
          >
            {p.value}
          </Text>
        ))}
      </View>

      <View style={styles.dayRow}>
        {data.map((d, i) => (
          <Text key={i} style={styles.dayLabel}>
            {formatDayLabel(d.date)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
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
  sectionMeta: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#9CA3AF' },
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
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#EEEEF0',
    padding: 18,
  },
  heroNumber: {
    fontSize: 46,
    lineHeight: 50,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -1.8,
  },
  heroLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#686868',
    marginTop: 2,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: 10,
  },
  deltaPillNegative: { backgroundColor: '#FEF2F2' },
  deltaText: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#16A34A' },
  deltaMeta: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginLeft: 4,
  },
  splitRow: { flexDirection: 'row', gap: 10 },
  splitCard: { flex: 1, borderRadius: radii.lg, borderWidth: 1, padding: 14 },
  splitIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  splitValue: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.6,
  },
  splitLabel: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.black,
    marginTop: 2,
  },
  splitCaption: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#EEEEF0',
    padding: 16,
    gap: 10,
  },
  pointValue: {
    position: 'absolute',
    width: 24,
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#686868',
  },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEA',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#111111' },
  insightBody: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
  rowCaption: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  footnote: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
    borderTopWidth: 1,
    borderTopColor: '#F6F6F6',
    paddingTop: 8,
  },
});
