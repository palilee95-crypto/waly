import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import {
  WorkspaceSnapshot,
  AudienceCard,
  formatMoney,
  formatCount,
  formatShortDateFromIso,
} from '@/lib/customer-workspace';
import CustomerSnapshotCard from './CustomerSnapshotCard';

type ReportId = 'customers' | 'bookings' | 'sales' | 'loyalty' | 'reviews';

const REPORTS: { id: ReportId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'customers', label: 'Customers', icon: 'person' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar-outline' },
  { id: 'sales', label: 'Sales', icon: 'wallet-outline' },
  { id: 'loyalty', label: 'Loyalty', icon: 'gift-outline' },
  { id: 'reviews', label: 'Reviews', icon: 'star-outline' },
];

type Props = {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenDirectory: () => void;
  onOpenAudience: (card: AudienceCard) => void;
  onOpenPeriod?: () => void;
  onOpenAnalytics: () => void;
  onOpenLedger: () => void;
  onOpenCustomer: (row: { id: string; name: string }) => void;
};

export default function ReportsTab({
  snapshot,
  periodLabel,
  onOpenDirectory,
  onOpenAudience,
  onOpenPeriod,
  onOpenAnalytics,
  onOpenLedger,
  onOpenCustomer,
}: Props) {
  const [report, setReport] = useState<ReportId>('customers');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {REPORTS.map((r) => {
          const active = report === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setReport(r.id)}
            >
              <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                <Ionicons name={r.icon} size={18} color={active ? colors.black : '#94A3B8'} />
              </View>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={[styles.tabLabel, active && styles.tabLabelActive]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {report === 'customers' ? (
        <CustomersReport
          snapshot={snapshot}
          periodLabel={periodLabel}
          onOpenDirectory={onOpenDirectory}
          onOpenAudience={onOpenAudience}
          onOpenPeriod={onOpenPeriod}
          onOpenCustomer={onOpenCustomer}
        />
      ) : (
        <OtherReport
          report={report}
          snapshot={snapshot}
          periodLabel={periodLabel}
          onOpenDirectory={onOpenDirectory}
          onOpenAudience={onOpenAudience}
          onOpenAnalytics={onOpenAnalytics}
          onOpenLedger={onOpenLedger}
        />
      )}
    </View>
  );
}

// ── Customers ────────────────────────────────────────────────────────────────

function CustomersReport({
  snapshot,
  periodLabel,
  onOpenDirectory,
  onOpenAudience,
  onOpenPeriod,
  onOpenCustomer,
}: {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenDirectory: () => void;
  onOpenAudience: (card: AudienceCard) => void;
  onOpenPeriod?: () => void;
  onOpenCustomer: (row: { id: string; name: string }) => void;
}) {
  const { topCustomers, inactive, customers } = snapshot;

  return (
    <View style={styles.body}>
      <CustomerSnapshotCard
        snapshot={snapshot}
        periodLabel={periodLabel}
        onOpenAudience={onOpenAudience}
        onOpenDirectory={onOpenDirectory}
        onOpenPeriod={onOpenPeriod}
      />

      <Card>
        <View style={styles.cardHeaderLine}><View><Text style={styles.cardTitle}>Visit frequency</Text><Text style={styles.cardNote}>How often customers visited in {periodLabel}.</Text></View><Ionicons name="repeat-outline" size={19} color="#9AA3B2" /></View>
        {customers.frequency.map((f) => {
          const max = Math.max(1, ...customers.frequency.map((x) => x.count));
          return (
            <View key={f.bucket} style={styles.freqRow}>
              <Text style={styles.freqLabel}>{f.bucket}</Text>
              <View style={styles.freqTrack}>
                <View style={[styles.freqFill, { width: `${(f.count / max) * 100}%` }]} />
              </View>
              <Text style={styles.freqCount}>{f.count}</Text>
            </View>
          );
        })}
      </Card>

      <Section title={`Top customers · ${periodLabel}`} action="View all" onPress={onOpenDirectory}>
        {topCustomers.length === 0 ? (
          <Text style={styles.empty}>No recorded spend in this period.</Text>
        ) : (
          topCustomers.map((c, i) => (
            <TouchableOpacity
              key={c.id}
              style={styles.rankRow}
              activeOpacity={0.7}
              onPress={() => onOpenCustomer({ id: c.id, name: c.name })}
            >
              <Text style={styles.rank}>#{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rankName} numberOfLines={1}>
                  {c.name || 'Customer'}
                </Text>
                <Text style={styles.rankMeta}>
                  {c.visits} visit{c.visits === 1 ? '' : 's'} · last {formatShortDateFromIso(c.lastVisit)}
                </Text>
              </View>
              <Text style={styles.rankValue}>{formatMoney(c.spendCents)}</Text>
            </TouchableOpacity>
          ))
        )}
      </Section>

      <Section title="Inactive customers" action="View all" onPress={onOpenDirectory}>
        {inactive.length === 0 ? (
          <Text style={styles.empty}>Everyone has visited recently.</Text>
        ) : (
          inactive.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.rankRow}
              activeOpacity={0.7}
              onPress={() => onOpenCustomer({ id: c.id, name: c.name })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rankName} numberOfLines={1}>
                  {c.name || 'Customer'}
                </Text>
                <Text style={styles.rankMeta}>
                  {c.daysIdle === null ? 'No recorded visit' : `${c.daysIdle} days ago`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
            </TouchableOpacity>
          ))
        )}
      </Section>
    </View>
  );
}

// ── Bookings, Sales, Loyalty, Reviews ────────────────────────────────────────

function OtherReport({
  report,
  snapshot,
  periodLabel,
  onOpenDirectory,
  onOpenAudience,
  onOpenAnalytics,
  onOpenLedger,
}: {
  report: ReportId;
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenDirectory: () => void;
  onOpenAudience: (id: 'return' | 'rewards' | 'rebook') => void;
  onOpenAnalytics: () => void;
  onOpenLedger: () => void;
}) {
  const { overview, bookings, bookingDetail, loyalty, loyaltyDetail, feedback, reviews, sales } =
    snapshot;

  if (report === 'bookings') {
    return (
    <View style={styles.body}>
        <View style={styles.kpiGrid}>
          <Kpi label="Completed" value={formatCount(bookings.completed)} sub={periodLabel} />
          <Kpi label="Upcoming" value={formatCount(bookings.upcoming)} sub="Not yet served" />
          <Kpi label="Cancelled" value={formatCount(bookings.cancelled)} sub="By the customer" />
          <Kpi
            label="No-show rate"
            value={bookingDetail.noShowRate === null ? 'No data' : `${bookingDetail.noShowRate}%`}
            sub={`${bookings.noShow} no-shows`}
          />
        </View>

        <Card>
          <Text style={styles.cardTitle}>Booking value</Text>
          <Text style={styles.bigValue}>{formatMoney(bookingDetail.revenueCents)}</Text>
          <Text style={styles.cardNote}>
            Total price of bookings that were not cancelled or missed, in {periodLabel}.
          </Text>
        </Card>

        <Section title="Next 7 days">
          {bookingDetail.next7.map((d) => (
            <View key={d.date} style={styles.rankRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rankName}>{formatShortDateFromIso(d.date)}</Text>
                <Text style={styles.rankMeta}>
                  {d.count} booking{d.count === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.rankValue}>
                {d.revenueCents > 0 ? formatMoney(d.revenueCents) : '—'}
              </Text>
            </View>
          ))}
        </Section>

        <Section title="Top services">
          {bookingDetail.topServices.length === 0 ? (
            <Text style={styles.empty}>No services booked in this period.</Text>
          ) : (
            bookingDetail.topServices.map((s) => (
              <View key={s.name} style={styles.rankRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.rankMeta}>
                    {s.count} booking{s.count === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={styles.rankValue}>{formatMoney(s.revenueCents)}</Text>
              </View>
            ))
          )}
        </Section>
      </View>
    );
  }

  if (report === 'sales') {
    const peak = Math.max(1, ...sales.series.map((s) => s.salesCents));
    const hourPeak = sales.hours.reduce(
      (best, count, hour) => (count > best.count ? { hour, count } : best),
      { hour: 0, count: 0 }
    );
    const maxHour = Math.max(1, ...sales.hours);

    return (
    <View style={styles.body}>
        <View style={styles.kpiGrid}>
          <Kpi label="Recorded sales" value={formatMoney(overview.salesCents)} sub={periodLabel} />
          <Kpi label="Orders" value={formatCount(overview.orders)} sub="Bills above zero" />
          <Kpi
            label="Average order"
            value={overview.avgOrderCents === null ? 'No data' : formatMoney(overview.avgOrderCents)}
            sub="Sales ÷ orders"
          />
          <Kpi label="Vouchers used" value={formatCount(overview.vouchersRedeemed)} sub="Redeemed" />
        </View>

        <Card>
          <Text style={styles.cardTitle}>
            Sales by {sales.granularity === 'month' ? 'month' : 'day'}
          </Text>
          <View style={styles.chart}>
            {sales.series.map((s) => (
              <View key={s.date} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(2, (s.salesCents / peak) * 96) },
                    s.orders === 0 && styles.barEmpty,
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.axisRow}>
            <Text style={styles.axisLabel}>
              {sales.series[0] ? labelFor(sales.series[0].date, sales.granularity) : ''}
            </Text>
            <Text style={styles.axisLabel}>Peak {formatMoney(peak)}</Text>
            <Text style={styles.axisLabel}>
              {sales.series.length
                ? labelFor(sales.series[sales.series.length - 1].date, sales.granularity)
                : ''}
            </Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Busiest hours</Text>
          <Text style={styles.cardNote}>
            {hourPeak.count > 0
              ? `Most orders land at ${hourLabel(hourPeak.hour)} — ${hourPeak.count} in ${periodLabel}.`
              : 'No orders recorded in this period.'}
          </Text>
          <View style={styles.chart}>
            {sales.hours.map((count, hour) => (
              <View key={hour} style={styles.hourSlot}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(2, (count / maxHour) * 70) },
                    count === 0 && styles.barEmpty,
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.axisRow}>
            <Text style={styles.axisLabel}>12am</Text>
            <Text style={styles.axisLabel}>12pm</Text>
            <Text style={styles.axisLabel}>11pm</Text>
          </View>
        </Card>

        {sales.outlets.length > 0 ? (
          <Section title="By outlet">
            {sales.outlets.map((o) => {
              const share = overview.salesCents ? Math.round((o.salesCents / overview.salesCents) * 100) : 0;
              return (
                <View key={o.id || 'hq'} style={styles.rankRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rankName} numberOfLines={1}>
                      {o.name}
                    </Text>
                    <Text style={styles.rankMeta}>
                      {o.orders} order{o.orders === 1 ? '' : 's'} · {share}% of sales
                    </Text>
                  </View>
                  <Text style={styles.rankValue}>{formatMoney(o.salesCents)}</Text>
                </View>
              );
            })}
          </Section>
        ) : null}

        <Section title="Staff performance">
          {sales.staff.length === 0 ? (
            <Text style={styles.empty}>No staff attributed in this period.</Text>
          ) : (
            sales.staff.map((s) => (
              <View key={s.id || 'none'} style={styles.rankRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.rankMeta}>
                    {s.orders} order{s.orders === 1 ? '' : 's'} · {s.stamps} stamp
                    {s.stamps === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={styles.rankValue}>{formatMoney(s.salesCents)}</Text>
              </View>
            ))
          )}
        </Section>

        <View style={styles.rowsCard}>
          <Row
            title="All transactions"
            detail="Every recorded sale, redemption and correction."
            icon="receipt-outline"
            onPress={onOpenLedger}
          />
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
      </View>
    );
  }

  if (report === 'loyalty') {
    const stampPeak = Math.max(1, ...loyalty.daily.map((d) => d.stamps));
    return (
    <View style={styles.body}>
        <View style={styles.kpiGrid}>
          <Kpi label="Near reward" value={formatCount(loyalty.nearReward)} sub="1–2 stamps away" />
          <Kpi label="Vouchers live" value={formatCount(loyalty.availableVouchers)} sub="Unused and valid" />
          <Kpi label="Issued" value={formatCount(loyaltyDetail.vouchersIssued)} sub={periodLabel} />
          <Kpi
            label="Redemption rate"
            value={loyaltyDetail.redemptionRate === null ? 'No data' : `${loyaltyDetail.redemptionRate}%`}
            sub={`${loyaltyDetail.vouchersUsed} used`}
          />
        </View>

        <View style={styles.kpiGrid}>
          <Kpi label="Points earned" value={formatCount(overview.pointsEarned)} sub={periodLabel} />
          <Kpi label="Points spent" value={formatCount(loyaltyDetail.pointsRedeemed)} sub={`${loyaltyDetail.redemptions} redeems`} />
          <Kpi label="Active cards" value={formatCount(loyaltyDetail.activeCards)} sub="Being collected" />
          <Kpi label="Stamps issued" value={formatCount(overview.stamps)} sub="Net events" />
        </View>

        <Card>
          <Text style={styles.cardTitle}>Stamps · last 7 days</Text>
          <View style={styles.chart}>
            {loyalty.daily.map((d) => (
              <View key={d.date} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(2, (d.stamps / stampPeak) * 80) },
                    d.stamps === 0 && styles.barEmpty,
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.axisRow}>
            {loyalty.daily.map((d) => (
              <Text key={d.date} style={styles.axisLabel}>
                {d.date.slice(8)}
              </Text>
            ))}
          </View>
        </Card>

        <View style={styles.rowsCard}>
          <Row
            title="Customers near a reward"
            detail="One or two stamps left on an active card."
            value={formatCount(loyalty.nearReward)}
            icon="gift-outline"
            onPress={() => onOpenAudience('rewards')}
          />
        </View>
      </View>
    );
  }

  // reviews
  const maxStars = Math.max(1, ...reviews.distribution.map((d) => d.count));
  return (
    <View style={styles.body}>
      <View style={styles.kpiGrid}>
        <Kpi label="Responses" value={formatCount(feedback.responses)} sub={periodLabel} />
        <Kpi
          label="Average rating"
          value={feedback.avgRating === null ? 'No data' : feedback.avgRating.toFixed(1)}
          sub={`Out of 5 stars`}
        />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Rating breakdown</Text>
        {feedback.responses === 0 ? (
          <Text style={styles.empty}>No feedback in this period.</Text>
        ) : (
          reviews.distribution.map((d) => (
            <View key={d.stars} style={styles.starRow}>
              <Text style={styles.starLabel}>{d.stars}★</Text>
              <View style={styles.freqTrack}>
                <View style={[styles.freqFill, { width: `${(d.count / maxStars) * 100}%` }]} />
              </View>
              <Text style={styles.freqCount}>{d.count}</Text>
            </View>
          ))
        )}
      </Card>

      <Section title="Recent feedback">
        {reviews.recent.length === 0 ? (
          <Text style={styles.empty}>No feedback in this period.</Text>
        ) : (
          reviews.recent.map((r, i) => (
            <View key={`${r.createdAt}-${i}`} style={styles.reviewRow}>
              <View style={styles.reviewHead}>
                <Text style={styles.rankName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.stars}>{'★'.repeat(r.stars)}</Text>
              </View>
              {r.feedback ? <Text style={styles.reviewText}>{r.feedback}</Text> : null}
              <Text style={styles.rankMeta}>{formatShortDateFromIso(r.createdAt)}</Text>
            </View>
          ))
        )}
      </Section>
    </View>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function labelFor(date: string, granularity: 'day' | 'month') {
  if (granularity === 'month') {
    const [y, m] = date.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[Number(m) - 1] || m} ${y.slice(2)}`;
  }
  return formatShortDateFromIso(date);
}

function hourLabel(hour: number) {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue} numberOfLines={1}>
        {value}
      </Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Section({
  title,
  action,
  onPress,
  children,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action ? (
          <TouchableOpacity style={styles.sectionAction} onPress={onPress} activeOpacity={0.7}>
            <Text style={styles.viewAll}>{action}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
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
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.black} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={15} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    width: '100%',
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 0,
    paddingHorizontal: 6,
    paddingBottom: 12,
    paddingTop: 4,
  },
  tab: {
    flex: 1,
    maxWidth: 78,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexDirection: 'column',
    gap: 5,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  tabActive: { backgroundColor: 'transparent', borderColor: 'transparent' },
  tabIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: { backgroundColor: '#FFCC00' },
  tabLabel: {
    width: '100%',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: '#667085',
  },
  tabLabelActive: { color: colors.black, fontFamily: 'PlusJakartaSans_700Bold' },

  body: { paddingTop: 6, paddingBottom: 32, gap: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 0 },
  kpi: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    padding: 15,
  },
  kpiLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#94A3B8',
  },
  kpiValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 21,
    color: colors.black,
    marginTop: 3,
  },
  kpiSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: '#64748B', marginTop: 3 },

  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    padding: 16,
    marginBottom: 0,
    shadowColor: '#142033',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.035,
    shadowRadius: 12,
    elevation: 1,
  },
  cardTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.black, letterSpacing: -0.2 },
  cardNote: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 17,
    color: '#94A3B8',
    marginTop: 3,
  },
  bigValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 25,
    color: colors.black,
    marginTop: 6,
  },

  cardHeaderLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },

  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 2,
    marginTop: 12,
  },
  barSlot: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-end', height: 96 },
  hourSlot: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-end', height: 72 },
  barStack: { borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-end' },
  bar: { backgroundColor: colors.black, borderRadius: 2, width: '100%' },
  barEmpty: { backgroundColor: '#E2E8F0' },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9.5, color: '#94A3B8' },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#64748B' },

  freqRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  freqLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#475569',
    width: 76,
  },
  freqTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  freqFill: { height: 8, borderRadius: 4, backgroundColor: colors.black },
  freqCount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: colors.black,
    width: 26,
    textAlign: 'right',
  },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  starLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#B45309',
    width: 26,
  },

  section: { marginBottom: 0 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: colors.black },
  sectionAction: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 4 },
  viewAll: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#686868' },
  sectionBody: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    paddingHorizontal: 14,
    paddingVertical: 5,
  },

  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  rank: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    color: '#94A3B8',
    width: 22,
  },
  rankName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: colors.black },
  rankMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: '#7D8796', marginTop: 2 },
  rankValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: colors.black },

  rowsCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    paddingHorizontal: 14,
    marginBottom: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, minHeight: 60 },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.black },
  rowDetail: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: '#94A3B8', marginTop: 1 },
  rowValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: colors.black },

  empty: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: '#94A3B8',
    paddingVertical: 12,
  },
  reviewRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stars: { color: '#F59E0B', fontSize: 11 },
  reviewText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    lineHeight: 16,
    color: '#475569',
    marginTop: 3,
  },
});

