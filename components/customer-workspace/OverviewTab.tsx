import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, iconSizes, radii, shadows, spacing } from '@/theme';
import {
  WorkspaceSnapshot,
  LedgerRow,
  AudienceCard,
  fetchTransactions,
  formatCount,
  formatDayLabel,
  formatLedgerImpact,
  formatShortDateFromIso,
} from '@/lib/customer-workspace';
import CustomerSnapshotCard from './CustomerSnapshotCard';

type Props = {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  branchId: string;
  from: string;
  to: string;
  onOpenReport: (report: 'customers' | 'bookings') => void;
  onOpenDirectory: () => void;
  onOpenLedger: () => void;
  onOpenAudience: (card: AudienceCard) => void;
  onOpenCustomer: (row: { id: string; name: string }) => void;
};

const TYPE_LABEL: Record<string, string> = {
  earn: 'Earned',
  redeem: 'Redeemed',
  expire: 'Expired',
  adjust: 'Adjusted',
};

export default function OverviewTab({
  snapshot,
  periodLabel,
  branchId,
  from,
  to,
  onOpenReport,
  onOpenDirectory,
  onOpenLedger,
  onOpenAudience,
  onOpenCustomer,
}: Props) {
  const { trend, bookings, periodInsight } = snapshot;
  const returnCount = snapshot.attention.find((item) => item.id === 'return')?.count ?? 0;
  const [recent, setRecent] = useState<LedgerRow[]>([]);
  const [recentTotal, setRecentTotal] = useState(0);
  const [recentLoading, setRecentLoading] = useState(true);

  // The ledger endpoint is the single source of truth for what happened, so the
  // Overview list is the same rows the Transactions sheet shows, just shorter.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      setRecentLoading(true);
      fetchTransactions({
        branchId,
        from,
        to,
        page: 1,
        perPage: 4,
        type: 'all',
      })
        .then((res) => {
          if (cancelled) return;
          setRecent(res.items);
          setRecentTotal(res.total);
        })
        .catch(() => {
          if (!cancelled) {
            setRecent([]);
            setRecentTotal(0);
          }
        })
        .finally(() => {
          if (!cancelled) setRecentLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [branchId, from, to]);

  return (
    <View style={styles.wrap}>
      <CustomerSnapshotCard
        snapshot={snapshot}
        periodLabel={periodLabel}
        onOpenAudience={onOpenAudience}
        onOpenDirectory={onOpenDirectory}
      />

      {returnCount > 0 ? (
        <TouchableOpacity
          style={styles.returnPrompt}
          activeOpacity={0.76}
          onPress={() => onOpenAudience('return')}
          accessibilityRole="button"
          accessibilityLabel={`${returnCount} customers have not visited recently. View customers to bring back.`}
        >
          <View style={styles.returnPromptIcon}>
            <Ionicons name="people-outline" size={iconSizes.md} color={colors.black} />
          </View>
          <View style={styles.returnPromptCopy}>
            <Text style={styles.returnPromptTitle}>Bring customers back</Text>
            <Text style={styles.returnPromptDetail}>
              {formatCount(returnCount)} customers haven’t visited recently
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={iconSizes.sm} color={colors.black} />
        </TouchableOpacity>
      ) : null}

      <VisitTrendCard
        data={trend}
        periodLabel={periodLabel}
        insight={periodInsight}
      />

      <SmartBookingCard bookings={bookings} onOpenReport={onOpenReport} />

      {/* ── Recent transactions ── */}
      <View style={styles.recentHead}>
        <View style={styles.recentHeadCopy}>
          <Text style={styles.recentTitle}>Recent Transactions</Text>
          <Text style={styles.recentSubtitle}>
            {recentLoading
              ? 'Loading…'
              : `${recentTotal.toLocaleString('en-MY')} recorded · ${periodLabel}`}
          </Text>
        </View>
        {recentLoading ? (
          <ActivityIndicator size="small" color={colors.accent[400]} />
        ) : null}
      </View>

      <View style={styles.recentCard}>
        <View>
          {recent.length === 0 ? (
            <Text style={styles.recentEmpty}>
              {recentLoading ? 'Loading recent activity…' : `No transactions recorded in ${periodLabel.toLowerCase()}.`}
            </Text>
          ) : (
            recent.map((row, index) => {
              const isRedeem = row.type === 'redeem';
              const isAdjust = row.type === 'adjust';
              return (
              <TouchableOpacity
                key={row.id}
                style={[
                  styles.txnRow,
                  index === recent.length - 1 && styles.txnRowLast,
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (row.customerId) {
                    onOpenCustomer({ id: row.customerId, name: row.customerName });
                  } else {
                    onOpenLedger();
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`${row.customerName}, ${TYPE_LABEL[row.type] || row.type}`}
              >
                <View style={styles.txnMain}>
                  <Text style={styles.txnName} numberOfLines={1}>
                    {row.customerName}
                  </Text>
                  <View style={styles.txnMetaRow}>
                    <View
                      style={[
                        styles.txnTag,
                        isRedeem && styles.txnTagRedeem,
                        isAdjust && styles.txnTagAdjust,
                      ]}
                    >
                      <Text
                        style={[
                          styles.txnTagText,
                          isRedeem && styles.txnTagTextRedeem,
                          isAdjust && styles.txnTagTextAdjust,
                        ]}
                      >
                        {TYPE_LABEL[row.type] || row.type}
                      </Text>
                    </View>
                    <Text style={styles.txnMeta} numberOfLines={1}>
                      {formatShortDateFromIso(row.created)} · {row.created.slice(11, 16)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.txnAmount}>
                  {formatLedgerImpact(row)}
                </Text>
                <Ionicons name="chevron-forward" size={iconSizes.sm} color={colors.accent[400]} />
              </TouchableOpacity>
            );
          })
        )}
        </View>

        <TouchableOpacity
          style={styles.recentFooter}
          activeOpacity={0.75}
          onPress={onOpenLedger}
          accessibilityRole="button"
          accessibilityLabel="View all transactions"
        >
          <Text style={styles.recentFooterText}>View all transactions</Text>
          <Ionicons name="arrow-forward" size={iconSizes.sm} color={colors.black} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Visit trend ──────────────────────────────────────────────────────────────

function VisitTrendCard({
  data,
  periodLabel,
  insight,
}: {
  data: WorkspaceSnapshot['trend'];
  periodLabel: string;
  insight: WorkspaceSnapshot['periodInsight'];
}) {
  const copy = insight ? getTrendInsight(insight) : null;

  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHead}>
        <View style={styles.trendHeadCopy}>
          <Text style={styles.trendTitle}>Visit Trend</Text>
          <Text style={styles.trendSubtitle}>Customer visits over time · {periodLabel}</Text>
        </View>
      </View>

      {data.length > 0 ? (
        <TrendChart data={data} />
      ) : (
        <Text style={styles.trendEmpty}>No visits recorded in this period.</Text>
      )}

      {copy ? (
        <View
          style={styles.trendInsight}
        >
          <View style={styles.trendInsightIcon}>
            <Ionicons name="bar-chart" size={iconSizes.md} color={colors.primary[700]} />
          </View>
          <View style={styles.trendInsightCopy}>
            <Text style={styles.trendInsightTitle}>{copy.title}</Text>
            <Text style={styles.trendInsightDetail}>{copy.detail}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function getTrendInsight(insight: NonNullable<WorkspaceSnapshot['periodInsight']>) {
  const detail = `${formatCount(insight.visits)} visit${insight.visits === 1 ? '' : 's'} recorded`;
  if (insight.unit === 'hour') {
    return { title: `Most customers visited at ${insight.label}`, detail };
  }
  if (insight.unit === 'day') {
    const shortDay = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/.test(insight.label);
    const dayNames: Record<string, string> = {
      Sun: 'Sunday',
      Mon: 'Monday',
      Tue: 'Tuesday',
      Wed: 'Wednesday',
      Thu: 'Thursday',
      Fri: 'Friday',
      Sat: 'Saturday',
    };
    const label = shortDay
      ? dayNames[insight.label]
      : /^\d{4}-\d{2}-\d{2}$/.test(insight.label)
        ? new Date(`${insight.label}T00:00:00+08:00`).toLocaleDateString('en-MY', { weekday: 'long' })
        : insight.label;
    return { title: `${label} brought your most visits`, detail };
  }
  if (insight.unit === 'week') {
    return { title: `${insight.label} was your strongest week`, detail };
  }
  const label = /^\d{4}-\d{2}-\d{2}$/.test(insight.label)
    ? new Date(`${insight.label}T00:00:00+08:00`).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
    : insight.label;
  return { title: `${label} brought your most visits`, detail };
}

/** Axis labels must fit on one line: a weekly range collapses to its first day. */
function compactAxisLabel(label?: string, date?: string) {
  if (label !== undefined && label !== null) {
    const raw = String(label).trim();
    if (!raw) return '';
    const range = raw.match(/^(\d{2}-\d{2})\s*[–-]\s*\d{2}-\d{2}$/);
    return range ? range[1] : raw;
  }
  return formatDayLabel(date || '');
}

function formatTrendDate(date: string, label?: string) {
  if (label) return label;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-MY', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
  return date;
}

function TrendChart({ data }: { data: WorkspaceSnapshot['trend'] }) {
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const padTop = 60;
  const padBottom = 22;
  const padLeft = 30;
  const padRight = 10;
  const plotHeight = 132;
  const totalHeight = padTop + plotHeight + padBottom;
  const plotWidth = Math.max(1, width - padLeft - padRight);

  const rawMax = Math.max(1, ...data.map((item) => item.visits));
  const step = rawMax <= 5 ? 1 : rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : rawMax <= 100 ? 10 : Math.ceil(rawMax / 50) * 10;
  const niceMax = Math.max(step, Math.ceil(rawMax / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= niceMax; value += step) ticks.push(value);

  const points = data.map((item, index) => ({
    x: padLeft + (data.length > 1 ? (index / (data.length - 1)) * plotWidth : plotWidth / 2),
    y: padTop + plotHeight - (item.visits / niceMax) * plotHeight,
    value: item.visits,
    date: item.date,
    label: item.label,
  }));

  const hasData = points.length > 0 && points.some((point) => point.value > 0);
  const peakIndex = points.length > 0
    ? points.reduce((best, point, index) => (point.value > points[best].value ? index : best), 0)
    : 0;
  const peakPoint = points[peakIndex];
  const baseline = padTop + plotHeight;
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length > 0
    ? `M ${points[0].x} ${baseline} ${points.map((point) => `L ${point.x} ${point.y}`).join(' ')} L ${points[points.length - 1].x} ${baseline} Z`
    : '';
  const selectedPoint = selectedIndex !== null ? points[selectedIndex] : null;

  return (
    <View
      style={{ height: totalHeight + 34 }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderRelease={(event) => {
        if (!points.length) return;
        const touchX = event.nativeEvent.locationX;
        const nearest = points.reduce((best, point, index) =>
          Math.abs(point.x - touchX) < Math.abs(points[best].x - touchX) ? index : best, 0);
        setSelectedIndex(nearest);
      }}
      accessibilityLabel="Visit trend chart. Tap to inspect a data point."
    >
      {width > 0 ? (
        <Svg width={width} height={totalHeight}>
          <Defs>
            <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary[400]} stopOpacity="0.3" />
              <Stop offset="1" stopColor={colors.primary[400]} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {ticks.map((tick) => {
            const y = padTop + plotHeight - (tick / niceMax) * plotHeight;
            return (
              <Line
                key={`grid-${tick}`}
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke={colors.accent[100]}
                strokeWidth={1}
                strokeDasharray="4 5"
              />
            );
          })}

          {hasData ? (
            <>
              <Path d={areaPath} fill="url(#trendFill)" />
              <Path
                d={linePath}
                fill="none"
                stroke={colors.primary[400]}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point, index) => (
                <Circle
                  key={`dot-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={4.5}
                  fill={colors.white}
                  stroke={colors.primary[400]}
                  strokeWidth={2}
                />
              ))}
              {peakPoint ? (
                <Line
                  x1={peakPoint.x}
                  y1={peakPoint.y + 8}
                  x2={peakPoint.x}
                  y2={baseline}
                  stroke={colors.accent[200]}
                  strokeWidth={1}
                  strokeDasharray="4 5"
                />
              ) : null}
            </>
          ) : null}
        </Svg>
      ) : null}

      {width > 0
        ? ticks.map((tick) => {
            const y = padTop + plotHeight - (tick / niceMax) * plotHeight;
            return (
              <Text key={`ylab-${tick}`} style={[styles.yLabel, { top: y - 7 }]}>
                {tick}
              </Text>
            );
          })
        : null}

      {width > 0
        ? points.map((point, index) => {
            if (index % labelEvery !== 0 && index !== points.length - 1) return null;
            const labelWidth = 52;
            const left = Math.max(0, Math.min(point.x - labelWidth / 2, Math.max(0, width - labelWidth)));
            return (
              <Text
                key={`xlab-${index}`}
                style={[styles.xLabel, { left, width: labelWidth }]}
                numberOfLines={1}
              >
                {compactAxisLabel(point.label, point.date)}
              </Text>
            );
          })
        : null}

      {width > 0 && data.length <= 14
        ? points.map((point, index) => (
            <Text
              key={`val-${index}`}
              style={[styles.pointValue, { left: point.x - 14, top: Math.max(0, point.y - 20) }]}
            >
              {point.value}
            </Text>
          ))
        : null}

      <View style={styles.chartReadout}>
        {selectedPoint ? (
          <>
            <View style={styles.tooltipDot} />
            <Text style={styles.chartReadoutDate}>{formatTrendDate(selectedPoint.date, selectedPoint.label)}</Text>
            <Text style={styles.chartReadoutValue}>{formatCount(selectedPoint.value)} visits</Text>
          </>
        ) : (
          <Text style={styles.chartHint}>Tap the chart to inspect visits</Text>
        )}
      </View>
    </View>
  );
}

// ── Smart booking ────────────────────────────────────────────────────────────

function SmartBookingCard({
  bookings,
  onOpenReport,
}: {
  bookings: WorkspaceSnapshot['bookings'];
  onOpenReport: (report: 'customers' | 'bookings') => void;
}) {
  const openBookings = () => onOpenReport('bookings');

  return (
    <TouchableOpacity
      style={styles.bookingCard}
      activeOpacity={0.76}
      onPress={openBookings}
      accessibilityRole="button"
      accessibilityLabel={`Smart Booking. ${bookings.completed} completed, ${bookings.upcoming} upcoming. View bookings`}
    >
      <View style={styles.bookingHeadIcon}>
        <Ionicons name="calendar-outline" size={iconSizes.lg} color={colors.black} />
      </View>
      <View style={styles.bookingHeadCopy}>
        <Text style={styles.bookingTitle}>Smart Booking</Text>
        <Text style={styles.bookingSubtitle}>
          <Text style={styles.bookingCount}>{bookings.completed}</Text> completed · <Text style={styles.bookingCount}>{bookings.upcoming}</Text> upcoming
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={iconSizes.sm} color={colors.accent[500]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  returnPrompt: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  returnPromptIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primary[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnPromptCopy: { flex: 1, minWidth: 0 },
  returnPromptTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.black },
  returnPromptDetail: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: colors.accent[700], marginTop: 2 },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginTop: 4,
  },
  recentHeadCopy: { flex: 1, minWidth: 0 },
  recentTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    letterSpacing: -0.3,
  },
  recentSubtitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[500],
    marginTop: 2,
  },
  recentCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent[100],
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.sm,
  },
  recentSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: 40,
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  recentSearchInput: {
    flex: 1,
    height: 40,
    paddingVertical: 0,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
    color: colors.black,
  },
  recentFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 1,
  },
  recentFilter: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.full,
    backgroundColor: colors.accent[50],
  },
  recentFilterActive: { backgroundColor: colors.black },
  recentFilterText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11.5,
    color: colors.accent[700],
  },
  recentFilterTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.white,
  },
  recentEmpty: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: colors.accent[400],
    paddingVertical: spacing[3],
    textAlign: 'center',
  },
  recentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accent[50],
    marginTop: spacing[1],
  },
  recentFooterText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: colors.black,
  },

  yLabel: {
    position: 'absolute',
    left: 0,
    width: 24,
    textAlign: 'right',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 9.5,
    color: colors.accent[400],
  },
  xLabel: {
    position: 'absolute',
    bottom: 34,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 9.5,
    color: colors.accent[400],
  },
  pointValue: {
    position: 'absolute',
    width: 24,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: colors.accent[500],
  },
  tooltip: {
    position: 'absolute',
    width: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent[100],
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[1],
    ...shadows.sm,
  },
  tooltipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary[400],
  },
  tooltipDate: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 9,
    color: colors.accent[500],
  },
  tooltipValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    color: colors.black,
  },

  trendCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent[100],
    padding: spacing[4],
    ...shadows.sm,
  },
  trendHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  trendHeadCopy: { flex: 1, minWidth: 0 },
  trendTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.5,
    color: colors.black,
  },
  trendSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: colors.accent[500],
    marginTop: 2,
  },
  trendEmpty: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: colors.accent[400],
    paddingVertical: spacing[4],
    textAlign: 'center',
  },
  trendInsight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary[50],
    borderRadius: radii.lg,
    padding: spacing[2.5],
    marginTop: spacing[3],
  },
  trendInsightIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendInsightCopy: { flex: 1, minWidth: 0 },
  trendInsightTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: colors.black,
  },
  trendInsightDetail: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: colors.accent[500],
    marginTop: 1,
  },
  chartReadout: {
    position: 'absolute',
    bottom: 0,
    left: 28,
    right: 10,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  chartReadoutDate: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: colors.accent[700],
  },
  chartReadoutValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    color: colors.black,
    marginLeft: 'auto',
  },
  chartHint: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: colors.accent[500],
  },

  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent[100],
    padding: spacing[3],
    ...shadows.sm,
  },
  bookingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  bookingHeadIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.accent[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingHeadCopy: { flex: 1, minWidth: 0 },
  bookingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  bookingTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.black,
  },
  bookingSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: colors.accent[500],
    marginTop: 2,
  },
  bookingCount: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  bookingStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  bookingMini: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2.5],
    borderRadius: radii.lg,
  },
  bookingMiniPrimary: { backgroundColor: colors.primary[50] },
  bookingMiniNeutral: { backgroundColor: colors.accent[50] },
  bookingMiniIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingMiniIconPrimary: { backgroundColor: colors.primary[100] },
  bookingMiniIconNeutral: { backgroundColor: colors.accent[100] },
  bookingMiniCopy: { flex: 1, minWidth: 0 },
  bookingMiniValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: colors.black,
  },
  bookingMiniLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: colors.black,
    marginTop: -1,
  },
  bookingFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.accent[100],
    marginTop: spacing[3],
    paddingTop: spacing[2],
  },
  bookingFooterLeft: {
    flex: 1,
    minWidth: 170,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  bookingFooterText: {
    flexShrink: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: colors.accent[500],
  },
  bookingFooterAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginLeft: 'auto',
  },
  bookingFooterActionText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: colors.black,
  },

  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[2],
    marginHorizontal: -spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.accent[50],
  },
  txnRowLatest: {
    backgroundColor: colors.primary[50],
    borderRadius: radii.md,
    borderBottomWidth: 0,
  },
  txnRowLast: { borderBottomWidth: 0 },
  txnMain: { flex: 1, minWidth: 0 },
  txnName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.black,
  },
  txnMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  txnTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.accent[100],
  },
  txnTagRedeem: { backgroundColor: colors.primary[50] },
  txnTagAdjust: { backgroundColor: colors.error.light },
  txnTagText: { fontSize: 9.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors.accent[700] },
  txnTagTextRedeem: { color: colors.warning.dark },
  txnTagTextAdjust: { color: colors.error.dark },
  txnMeta: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[400],
    flexShrink: 1,
  },
  txnAmount: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
    maxWidth: 110,
    textAlign: 'right',
  },
});
