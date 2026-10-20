import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, iconSizes, radii, shadows, spacing } from '@/theme';
import {
  WorkspaceSnapshot,
  LedgerRow,
  LedgerType,
  AudienceCard,
  fetchTransactions,
  formatCount,
  formatDayLabel,
  formatShortDateFromIso,
} from '@/lib/customer-workspace';
import CustomerSnapshotCard from './CustomerSnapshotCard';
import PeriodPill from './PeriodPill';

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
  onOpenPeriod?: () => void;
  onOpenCustomer: (row: { id: string; name: string }) => void;
};

const TRANSACTION_FILTERS: { id: LedgerType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'earn', label: 'Earned' },
  { id: 'redeem', label: 'Redeemed' },
  { id: 'adjust', label: 'Adjustments' },
];

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
  onOpenPeriod,
  onOpenCustomer,
}: Props) {
  const { trend, bookings, periodInsight } = snapshot;
  const [recent, setRecent] = useState<LedgerRow[]>([]);
  const [recentTotal, setRecentTotal] = useState(0);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentFilter, setRecentFilter] = useState<LedgerType>('all');
  const [recentQuery, setRecentQuery] = useState('');

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
        perPage: 6,
        type: recentFilter,
        q: recentQuery,
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
  }, [branchId, from, to, recentFilter, recentQuery]);

  return (
    <View style={styles.wrap}>
      <CustomerSnapshotCard
        snapshot={snapshot}
        periodLabel={periodLabel}
        onOpenAudience={onOpenAudience}
        onOpenDirectory={onOpenDirectory}
        onOpenPeriod={onOpenPeriod}
      />

      <VisitTrendCard
        data={trend}
        periodLabel={periodLabel}
        insight={periodInsight}
        onOpenPeriod={onOpenPeriod}
        onOpenLedger={onOpenLedger}
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
        <View style={styles.recentSearch}>
          <Ionicons name="search" size={iconSizes.sm} color={colors.accent[400]} />
          <TextInput
            value={recentQuery}
            onChangeText={setRecentQuery}
            placeholder="Search customer or phone"
            placeholderTextColor={colors.accent[400]}
            style={styles.recentSearchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {recentQuery ? (
            <TouchableOpacity
              onPress={() => setRecentQuery('')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={iconSizes.sm} color={colors.accent[400]} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentFilters}
        >
          {TRANSACTION_FILTERS.map((filter) => {
            const active = recentFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[styles.recentFilter, active && styles.recentFilterActive]}
                activeOpacity={0.75}
                onPress={() => setRecentFilter(filter.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
              >
                <Text style={[styles.recentFilterText, active && styles.recentFilterTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View>
          {recent.length === 0 ? (
            <Text style={styles.recentEmpty}>
              {recentQuery || recentFilter !== 'all'
                ? 'No transactions match this view.'
                : `No transactions recorded in ${periodLabel.toLowerCase()}.`}
            </Text>
          ) : (
            recent.map((row, index) => {
              const isRedeem = row.type === 'redeem';
              const isAdjust = row.type === 'adjust';
              const isLatest = index === 0 && recentFilter === 'all' && !recentQuery.trim();
              return (
              <TouchableOpacity
                key={row.id}
                style={[
                  styles.txnRow,
                  isLatest && styles.txnRowLatest,
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
                  {row.billCents > 0 ? `RM ${(row.billCents / 100).toFixed(2)}` : '—'}
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
  onOpenPeriod,
  onOpenLedger,
}: {
  data: WorkspaceSnapshot['trend'];
  periodLabel: string;
  insight: WorkspaceSnapshot['periodInsight'];
  onOpenPeriod?: () => void;
  onOpenLedger: () => void;
}) {
  const copy = insight ? getTrendInsight(insight) : null;

  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHead}>
        <View style={styles.trendHeadCopy}>
          <Text style={styles.trendTitle}>Visit Trend</Text>
          <Text style={styles.trendSubtitle}>Customer visits over time</Text>
        </View>
        <PeriodPill label={periodLabel} onPress={onOpenPeriod} />
      </View>

      {data.length > 0 ? (
        <TrendChart data={data} />
      ) : (
        <Text style={styles.trendEmpty}>No visits recorded in this period.</Text>
      )}

      {copy ? (
        <TouchableOpacity
          style={styles.trendInsight}
          activeOpacity={0.78}
          onPress={onOpenLedger}
          accessibilityRole="button"
          accessibilityLabel={`${copy.title}. ${copy.detail}`}
        >
          <View style={styles.trendInsightIcon}>
            <Ionicons name="bar-chart" size={iconSizes.md} color={colors.primary[700]} />
          </View>
          <View style={styles.trendInsightCopy}>
            <Text style={styles.trendInsightTitle}>{copy.title}</Text>
            <Text style={styles.trendInsightDetail}>{copy.detail}</Text>
          </View>
          <Ionicons name="chevron-forward" size={iconSizes.sm} color={colors.accent[500]} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function getTrendInsight(insight: NonNullable<WorkspaceSnapshot['periodInsight']>) {
  const detail = `${formatCount(insight.visits)} visit${insight.visits === 1 ? '' : 's'} recorded`;
  if (insight.unit === 'hour') {
    return { title: `${insight.label} was your busiest hour`, detail };
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
    return { title: `${label} was your busiest day`, detail };
  }
  if (insight.unit === 'week') {
    return { title: `${insight.label} was your strongest week`, detail };
  }
  const label = /^\d{4}-\d{2}-\d{2}$/.test(insight.label)
    ? new Date(`${insight.label}T00:00:00+08:00`).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
    : insight.label;
  return { title: `${label} brought your most visits`, detail };
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
  const tooltipLeft = peakPoint
    ? Math.min(Math.max(peakPoint.x - 52, padLeft), Math.max(padLeft, width - 104))
    : 0;

  return (
    <View style={{ height: totalHeight }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
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
            return (
              <Text key={`xlab-${index}`} style={[styles.xLabel, { left: point.x - 20 }]}>
                {point.label !== undefined ? point.label : formatDayLabel(point.date)}
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

      {width > 0 && hasData && peakPoint ? (
        <View style={[styles.tooltip, { left: tooltipLeft, top: Math.max(2, peakPoint.y - 54) }]}>
          <View style={styles.tooltipDot} />
          <View>
            <Text style={styles.tooltipDate}>{formatTrendDate(peakPoint.date, peakPoint.label)}</Text>
            <Text style={styles.tooltipValue}>{formatCount(peakPoint.value)} visits</Text>
          </View>
        </View>
      ) : null}
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
  const { width } = useWindowDimensions();
  const compact = width < 560;
  const openBookings = () => onOpenReport('bookings');
  const upcomingCopy = bookings.upcoming > 0
    ? `${bookings.upcoming} upcoming appointment${bookings.upcoming === 1 ? '' : 's'}`
    : 'No upcoming appointments';

  return (
    <View style={styles.bookingCard}>
      <TouchableOpacity
        style={styles.bookingHead}
        activeOpacity={0.8}
        onPress={openBookings}
        accessibilityRole="button"
        accessibilityLabel="Smart Booking, appointment overview"
      >
        <View style={styles.bookingHeadIcon}>
          <Ionicons name="calendar" size={iconSizes.lg} color={colors.black} />
        </View>
        <View style={styles.bookingHeadCopy}>
          <View style={styles.bookingTitleRow}>
            <Text style={styles.bookingTitle}>Smart Booking</Text>
            <Ionicons
              name="information-circle-outline"
              size={iconSizes.sm}
              color={colors.accent[400]}
            />
          </View>
          <Text style={styles.bookingSubtitle}>Appointment overview</Text>
        </View>
        <Ionicons name="chevron-forward" size={iconSizes.md} color={colors.accent[500]} />
      </TouchableOpacity>

      <View style={styles.bookingStats}>
        <BookingMini
          value={bookings.completed}
          label={compact ? 'Completed' : 'Completed appointments'}
          icon="calendar"
          tone="primary"
          onPress={openBookings}
        />
        <BookingMini
          value={bookings.upcoming}
          label={compact ? 'Upcoming' : 'Upcoming appointments'}
          icon="calendar-outline"
          tone="neutral"
          onPress={openBookings}
        />
      </View>

      <TouchableOpacity
        style={styles.bookingFooter}
        activeOpacity={0.75}
        onPress={openBookings}
        accessibilityRole="button"
        accessibilityLabel={`${upcomingCopy}. View bookings`}
      >
        <View style={styles.bookingFooterLeft}>
          <Ionicons name="calendar-outline" size={iconSizes.sm} color={colors.accent[400]} />
          <Text style={styles.bookingFooterText} numberOfLines={1}>
            {upcomingCopy}
          </Text>
        </View>
        <View style={styles.bookingFooterAction}>
          <Text style={styles.bookingFooterActionText}>View bookings</Text>
          <Ionicons name="arrow-forward" size={iconSizes.sm} color={colors.black} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

function BookingMini({
  value,
  label,
  icon,
  tone,
  onPress,
}: {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'primary' | 'neutral';
  onPress: () => void;
}) {
  const primary = tone === 'primary';
  return (
    <TouchableOpacity
      style={[styles.bookingMini, primary ? styles.bookingMiniPrimary : styles.bookingMiniNeutral]}
      activeOpacity={0.78}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      <View
        style={[
          styles.bookingMiniIcon,
          primary ? styles.bookingMiniIconPrimary : styles.bookingMiniIconNeutral,
        ]}
      >
        <Ionicons
          name={icon}
          size={iconSizes.md}
          color={primary ? colors.primary[700] : colors.accent[700]}
        />
      </View>
      <View style={styles.bookingMiniCopy}>
        <Text style={styles.bookingMiniValue}>{value}</Text>
        <Text style={styles.bookingMiniLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={iconSizes.sm} color={colors.accent[500]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
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
    bottom: 0,
    width: 36,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
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

  bookingCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accent[100],
    padding: spacing[4],
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
  },
});
