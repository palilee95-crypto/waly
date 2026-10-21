import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, radii } from '@/theme';
import {
  WorkspaceSnapshot,
  AudienceCard,
  type LedgerFocus,
  formatMoney,
  formatCount,
  formatShortDateFromIso,
} from '@/lib/customer-workspace';
import CustomerSnapshotCard from './CustomerSnapshotCard';
import SalesReport from './SalesReport';
import LoyaltyReport from './LoyaltyReport';
import ReviewsReport from './ReviewsReport';

export type ReportId = 'customers' | 'bookings' | 'sales' | 'loyalty' | 'reviews';

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
  report: ReportId;
  onSelectReport: (report: ReportId) => void;
  onOpenAnalytics: () => void;
  onOpenLedger: (focus?: LedgerFocus) => void;
  onOpenCustomer: (row: { id: string; name: string }) => void;
  onOpenBookings: (filter?: { status?: string; date?: string }) => void;
};

export default function ReportsTab({
  snapshot,
  periodLabel,
  onOpenDirectory,
  onOpenAudience,
  report,
  onSelectReport,
  onOpenAnalytics,
  onOpenLedger,
  onOpenCustomer,
  onOpenBookings,
}: Props) {
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
              onPress={() => onSelectReport(r.id)}
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
          onOpenBookings={onOpenBookings}
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
  onOpenCustomer,
}: {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenDirectory: () => void;
  onOpenAudience: (card: AudienceCard) => void;
  onOpenCustomer: (row: { id: string; name: string }) => void;
}) {
  const { topCustomers, inactive, customers } = snapshot;
  const [selectedFrequency, setSelectedFrequency] = useState<string | null>(null);
  const frequency = customers.frequency;
  const frequencyTotal = frequency.reduce((sum, item) => sum + item.count, 0);
  const leadingBucket = frequency.reduce((best, item) => item.count > best.count ? item : best, frequency[0]);
  const activeFrequency = frequency.find((item) => item.bucket === selectedFrequency) || leadingBucket;
  const activeCount = activeFrequency?.count || 0;

  return (
    <View style={styles.body}>
      <CustomerSnapshotCard
        snapshot={snapshot}
        periodLabel={periodLabel}
        onOpenAudience={onOpenAudience}
        onOpenDirectory={onOpenDirectory}
      />

      <View style={styles.reportPanel}>
        <View style={styles.reportHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Visit frequency</Text>
            <Text style={styles.reportSubtitle}>{periodLabel} · {frequencyTotal} customer{frequencyTotal === 1 ? '' : 's'} tracked</Text>
          </View>
          <View style={styles.reportHeaderIcon}><Ionicons name="repeat-outline" size={19} color={colors.black} /></View>
        </View>
        <View style={styles.frequencyBody}>
          <View style={styles.wheelWrap}>
            <FrequencyWheel data={frequency} total={frequencyTotal} />
            <View style={styles.wheelCenter} pointerEvents="none">
              <Text style={styles.wheelCount}>{activeCount}</Text>
              <Text style={styles.wheelCaption}>customer{activeCount === 1 ? '' : 's'}</Text>
            </View>
          </View>
          <View style={styles.frequencyLegend}>
            {frequency.map((item, index) => {
              const selected = item.bucket === activeFrequency?.bucket;
              return (
                <TouchableOpacity
                  key={item.bucket}
                  style={[styles.frequencyChoice, selected && styles.frequencyChoiceActive]}
                  onPress={() => setSelectedFrequency(item.bucket)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${item.bucket}, ${item.count} customers`}
                >
                  <View style={[styles.frequencyDot, { backgroundColor: frequencyColor(index, frequency.length) }]} />
                  <Text style={[styles.frequencyChoiceLabel, selected && styles.frequencyChoiceLabelActive]} numberOfLines={1}>{item.bucket}</Text>
                  <Text style={styles.frequencyChoiceCount}>{item.count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.frequencyInsight}>
          <Ionicons name="sparkles-outline" size={16} color="#8A6500" />
          <Text style={styles.frequencyInsightText}>
            {frequencyTotal === 0
              ? 'Visit habits will appear after customers check in.'
              : `${activeCount} of ${frequencyTotal} customers made ${activeFrequency?.bucket || 'visits'} during ${periodLabel.toLowerCase()}.`}
          </Text>
        </View>
      </View>

      <View style={styles.reportPanel}>
        <ReportPanelHeader title="Top customers" subtitle={`By recorded spend · ${periodLabel}`} onPress={() => onOpenAudience('top')} />
        {topCustomers.length === 0 ? (
          <Text style={styles.empty}>No customer activity in this period.</Text>
        ) : (
          topCustomers.map((c, i) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.topCustomerRow, i === 0 && styles.topCustomerFirst, i === topCustomers.length - 1 && styles.topCustomerLast]}
              activeOpacity={0.75}
              onPress={() => onOpenCustomer({ id: c.id, name: c.name })}
              accessibilityRole="button"
              accessibilityLabel={`View ${c.name || 'customer'}, ranked ${i + 1}, recorded spend ${formatMoney(c.spendCents)}`}
            >
              <View style={[styles.placeBadge, i === 0 && styles.placeBadgeFirst]}><Text style={styles.placeText}>#{i + 1}</Text></View>
              <View style={styles.topCustomerCopy}>
                <Text style={styles.topCustomerName} numberOfLines={1}>{c.name || 'Customer'}</Text>
                <Text style={styles.topCustomerMeta} numberOfLines={1}>
                  {shortCustomerId(c.phone, c.id)} · {c.visits} visit{c.visits === 1 ? '' : 's'} · last {formatShortDateFromIso(c.lastVisit)}
                </Text>
              </View>
              <Text style={styles.topCustomerSpend} numberOfLines={1}>{formatMoney(c.spendCents)}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.reportPanel}>
        <ReportPanelHeader title="Inactive customers" subtitle="Customers who have been away" onPress={() => onOpenAudience('inactive')} />
        {inactive.length === 0 ? (
          <Text style={styles.empty}>No customers need a check-in right now.</Text>
        ) : (
          <>
            <View style={styles.reconnectPrompt}>
              <View style={styles.reconnectIcon}><Ionicons name="chatbubble-ellipses-outline" size={18} color="#8A6500" /></View>
              <Text style={styles.reconnectText}>A personal check-in could bring them back.</Text>
            </View>
            {inactive.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.inactiveRow, i === inactive.length - 1 && styles.topCustomerLast]}
                activeOpacity={0.75}
                onPress={() => onOpenCustomer({ id: c.id, name: c.name })}
                accessibilityRole="button"
                accessibilityLabel={`View ${c.name || 'customer'}, last visit ${c.daysIdle === null ? 'not recorded' : `${c.daysIdle} days ago`}`}
              >
                <View style={styles.inactiveAvatar}><Text style={styles.inactiveInitial}>{customerInitials(c.name)}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.topCustomerName} numberOfLines={1}>{c.name || 'Customer'}</Text>
                  <Text style={styles.topCustomerMeta}>{c.daysIdle === null ? 'No recorded visit' : `${c.daysIdle} days since last visit`}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

// ── Bookings, Sales, Loyalty, Reviews ────────────────────────────────────────

function BookingsReport({
  snapshot,
  periodLabel,
  onOpenBookings,
}: {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenBookings: (filter?: { status?: string; date?: string }) => void;
}) {
  const { bookings, bookingDetail } = snapshot;
  const next7Total = bookingDetail.next7.reduce((sum, day) => sum + day.count, 0);
  const nextDate = bookingDetail.nextUpcomingDate;
  const scheduleReady = nextDate !== undefined;

  return (
    <View style={styles.body}>
      <View style={styles.bookingHero}>
        <View style={styles.bookingHeroTop}>
          <View style={styles.bookingHeroIcon}><Ionicons name="calendar-outline" size={22} color={colors.black} /></View>
          <Text style={styles.bookingHeroEyebrow}>BOOKINGS · {periodLabel.toUpperCase()}</Text>
        </View>
        <View style={styles.bookingHeroCountRow}>
          <Text style={styles.bookingHeroCount}>{formatCount(bookings.upcoming)}</Text>
          <View style={styles.bookingHeroCountCopy}>
            <Text style={styles.bookingHeroTitle}>Upcoming bookings</Text>
            <Text style={styles.bookingHeroNote}>Not yet served in {periodLabel.toLowerCase()}</Text>
          </View>
        </View>
        <View style={styles.bookingHeroFooter}>
          <View style={styles.bookingNextDate}>
            <Ionicons name="time-outline" size={16} color="#8A6500" />
            <Text style={styles.bookingNextDateText} numberOfLines={1}>
              {!scheduleReady ? 'Open calendar for the latest schedule' : nextDate ? `Next scheduled · ${formatShortDateFromIso(nextDate)}` : 'No future appointment scheduled'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bookingHeroAction}
            onPress={() => onOpenBookings({ status: 'upcoming' })}
            accessibilityRole="button"
            accessibilityLabel="View upcoming bookings"
          >
            <Text style={styles.bookingHeroActionText}>View bookings</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.black} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bookingSummaryRow}>
        {[
          { label: 'Completed', value: formatCount(bookings.completed), status: 'completed', icon: 'checkmark-circle-outline' as const },
          { label: 'Cancelled', value: formatCount(bookings.cancelled), status: 'cancelled', icon: 'close-circle-outline' as const },
          { label: 'No-show', value: bookingDetail.noShowRate === null ? '—' : `${bookingDetail.noShowRate}%`, status: 'no_show', icon: 'alert-circle-outline' as const },
        ].map((item) => (
          <TouchableOpacity
            key={item.status}
            style={styles.bookingSummaryCard}
            activeOpacity={0.75}
            onPress={() => onOpenBookings({ status: item.status })}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.label.toLowerCase()} bookings`}
          >
            <Ionicons name={item.icon} size={19} color="#8795A7" />
            <Text style={styles.bookingSummaryValue}>{item.value}</Text>
            <Text style={styles.bookingSummaryLabel}>{item.label}</Text>
            {item.status === 'no_show' && <Text style={styles.bookingSummaryFoot}>{bookings.noShow} missed</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.reportPanel}>
        <View style={styles.bookingValueHeader}>
          <View style={styles.bookingValueIcon}><Ionicons name="wallet-outline" size={20} color={colors.black} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Recorded booking value</Text>
            <Text style={styles.reportSubtitle}>Prices attached to active and completed bookings</Text>
          </View>
        </View>
        <Text style={styles.bookingValueTotal}>{formatMoney(bookingDetail.revenueCents)}</Text>
        {bookingDetail.completedValueCents !== null && bookingDetail.upcomingValueCents !== null && <View style={styles.bookingValueSplit}>
          <View style={styles.bookingValueSplitItem}>
            <View style={[styles.bookingValueDot, { backgroundColor: colors.black }]} />
            <View>
              <Text style={styles.bookingValueSplitLabel}>Completed</Text>
              <Text style={styles.bookingValueSplitAmount}>{formatMoney(bookingDetail.completedValueCents)}</Text>
            </View>
          </View>
          <View style={styles.bookingValueSplitItem}>
            <View style={[styles.bookingValueDot, { backgroundColor: '#FFCA05' }]} />
            <View>
              <Text style={styles.bookingValueSplitLabel}>Upcoming</Text>
              <Text style={styles.bookingValueSplitAmount}>{formatMoney(bookingDetail.upcomingValueCents)}</Text>
            </View>
          </View>
        </View>}
        <Text style={styles.bookingValueDisclaimer}>For {periodLabel.toLowerCase()}. Booking prices are not confirmed payments.</Text>
      </View>

      <View style={styles.reportPanel}>
        <View style={styles.reportHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Next 7 days</Text>
            <Text style={styles.reportSubtitle}>{scheduleReady ? `${next7Total} scheduled booking${next7Total === 1 ? '' : 's'} across all seven days` : 'Open your calendar for the latest schedule'}</Text>
          </View>
          <TouchableOpacity style={styles.reportViewAll} onPress={() => onOpenBookings()} accessibilityRole="button">
            <Text style={styles.reportViewAllText}>Calendar</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.black} />
          </TouchableOpacity>
        </View>
        {scheduleReady && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookingDayStrip}>
          {bookingDetail.next7.map((day, index) => {
            const date = new Date(`${day.date}T00:00:00`);
            return (
              <TouchableOpacity
                key={day.date}
                style={[styles.bookingDay, day.count > 0 && styles.bookingDayActive]}
                onPress={() => onOpenBookings({ date: day.date })}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`View bookings for ${formatShortDateFromIso(day.date)}, ${day.count} scheduled`}
              >
                <Text style={[styles.bookingDayName, day.count > 0 && styles.bookingDayTextActive]}>{index === 0 ? 'Today' : date.toLocaleDateString('en-MY', { weekday: 'short' })}</Text>
                <Text style={[styles.bookingDayNumber, day.count > 0 && styles.bookingDayTextActive]}>{date.getDate()}</Text>
                <View style={[styles.bookingDayDot, day.count > 0 && styles.bookingDayDotActive]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>}
        {!scheduleReady ? null : next7Total === 0 ? (
          <View style={styles.bookingEmptyState}>
            <View style={styles.bookingEmptyIcon}><Ionicons name="calendar-clear-outline" size={19} color="#8A6500" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookingEmptyTitle}>No bookings in the next 7 days</Text>
              <Text style={styles.bookingEmptyCopy}>{nextDate ? `Your next scheduled booking is ${formatShortDateFromIso(nextDate)}.` : 'Your calendar is open for new appointments.'}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.bookingScheduleHint}>
            <Ionicons name="hand-left-outline" size={15} color="#8A6500" />
            <Text style={styles.bookingScheduleHintText}>Tap a day to open its appointment schedule.</Text>
          </View>
        )}
      </View>

      <View style={styles.reportPanel}>
        <View style={styles.reportHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Top services</Text>
            <Text style={styles.reportSubtitle}>Most booked in {periodLabel.toLowerCase()}</Text>
          </View>
          <View style={styles.reportHeaderIcon}><Ionicons name="sparkles-outline" size={18} color={colors.black} /></View>
        </View>
        {bookingDetail.topServices.length === 0 ? (
          <Text style={styles.empty}>No services booked in this period.</Text>
        ) : bookingDetail.topServices.map((service, index) => (
          <View key={service.name} style={[styles.bookingServiceRow, index === bookingDetail.topServices.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={styles.bookingServiceRank}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rankName} numberOfLines={1}>{service.name}</Text>
              <Text style={styles.rankMeta}>{service.count} booking{service.count === 1 ? '' : 's'}</Text>
            </View>
            <Text style={styles.rankValue}>{formatMoney(service.revenueCents)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function OtherReport({
  report,
  snapshot,
  periodLabel,
  onOpenDirectory,
  onOpenAudience,
  onOpenAnalytics,
  onOpenLedger,
  onOpenBookings,
}: {
  report: ReportId;
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenDirectory: () => void;
  onOpenAudience: (id: 'return' | 'rewards' | 'rebook') => void;
  onOpenAnalytics: () => void;
  onOpenLedger: (focus?: LedgerFocus) => void;
  onOpenBookings: (filter?: { status?: string; date?: string }) => void;
}) {
  if (report === 'bookings') {
    return <BookingsReport snapshot={snapshot} periodLabel={periodLabel} onOpenBookings={onOpenBookings} />;
  }

  if (report === 'sales') {
    return <SalesReport snapshot={snapshot} periodLabel={periodLabel} onOpenLedger={onOpenLedger} onOpenDirectory={onOpenDirectory} onOpenAnalytics={onOpenAnalytics} />;
  }

  if (report === 'loyalty') {
    return <LoyaltyReport snapshot={snapshot} periodLabel={periodLabel} onOpenAudience={onOpenAudience} onOpenDirectory={onOpenDirectory} />;
  }

  return <ReviewsReport snapshot={snapshot} periodLabel={periodLabel} />;
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function frequencyColor(index: number, count: number): string {
  if (index === count - 1) return colors.primary[400];
  if (index === 0) return '#AAB4C3';
  return '#20242B';
}

function FrequencyWheel({ data, total }: { data: { bucket: string; count: number }[]; total: number }) {
  const radius = 51;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <Svg width={132} height={132} accessibilityLabel={`Visit frequency for ${total} customers`}>
      <Circle cx={66} cy={66} r={radius} fill="none" stroke="#EEF1F5" strokeWidth={14} />
      <G transform="rotate(-90 66 66)">
        {total > 0 ? data.map((item, index) => {
          const length = (item.count / total) * circumference;
          const segmentOffset = offset;
          offset += length;
          if (item.count === 0) return null;
          return (
            <Circle
              key={item.bucket}
              cx={66}
              cy={66}
              r={radius}
              fill="none"
              stroke={frequencyColor(index, data.length)}
              strokeWidth={14}
              strokeDasharray={`${Math.max(0, length - 3)} ${circumference}`}
              strokeDashoffset={-segmentOffset}
            />
          );
        }) : null}
      </G>
    </Svg>
  );
}

function customerInitials(name: string): string {
  return (name || 'Customer').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}

function shortCustomerId(phone: string | undefined, id: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `••• ${digits.slice(-4)}` : `ID ${id.slice(-4).toUpperCase()}`;
}

function ReportPanelHeader({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <View style={styles.reportHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.reportTitle}>{title}</Text>
        <Text style={styles.reportSubtitle}>{subtitle}</Text>
      </View>
      <TouchableOpacity
        style={styles.reportViewAll}
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`View all ${title.toLowerCase()}`}
      >
        <Text style={styles.reportViewAllText}>View all</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.black} />
      </TouchableOpacity>
    </View>
  );
}

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
  reportPanel: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9EDF3',
    padding: 16,
    shadowColor: '#142033',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.035,
    shadowRadius: 12,
    elevation: 1,
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  reportTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: colors.black },
  reportSubtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, lineHeight: 17, color: '#64748B', marginTop: 3 },
  reportHeaderIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary[100], alignItems: 'center', justifyContent: 'center' },
  reportViewAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 3 },
  reportViewAllText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.black },
  frequencyBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wheelWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  wheelCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  wheelCount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 29, color: colors.black, lineHeight: 35 },
  wheelCaption: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10.5, color: '#64748B' },
  frequencyLegend: { flex: 1, minWidth: 0, gap: 3 },
  frequencyChoice: { minHeight: 44, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8 },
  frequencyChoiceActive: { backgroundColor: '#FFF9E8' },
  frequencyDot: { width: 9, height: 9, borderRadius: 5 },
  frequencyChoiceLabel: { flex: 1, minWidth: 0, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: '#475569' },
  frequencyChoiceLabelActive: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  frequencyChoiceCount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: colors.black },
  frequencyInsight: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 13, backgroundColor: '#FFF9E8', padding: 11, marginTop: 12 },
  frequencyInsightText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, lineHeight: 17, color: '#554323' },
  topCustomerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  topCustomerFirst: { backgroundColor: '#FFF9E8', borderRadius: 15, paddingHorizontal: 10, marginBottom: 2, borderBottomWidth: 0 },
  topCustomerLast: { borderBottomWidth: 0 },
  placeBadge: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EEF1F5', alignItems: 'center', justifyContent: 'center' },
  placeBadgeFirst: { backgroundColor: colors.primary[400] },
  placeText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, color: colors.black },
  topCustomerCopy: { flex: 1, minWidth: 0 },
  topCustomerName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: colors.black },
  topCustomerMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, lineHeight: 16, color: '#64748B', marginTop: 3 },
  topCustomerSpend: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: colors.black, maxWidth: 112, textAlign: 'right' },
  reconnectPrompt: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, backgroundColor: '#FFF9E8', padding: 10, marginBottom: 4 },
  reconnectIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primary[100], alignItems: 'center', justifyContent: 'center' },
  reconnectText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, lineHeight: 17, color: '#554323' },
  inactiveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  inactiveAvatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  inactiveInitial: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, color: '#475569' },
  bookingHero: { backgroundColor: '#111214', borderRadius: 24, padding: 18, overflow: 'hidden' },
  bookingHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookingHeroIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFCA05', alignItems: 'center', justifyContent: 'center' },
  bookingHeroEyebrow: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.8, color: '#B8C0CC' },
  bookingHeroCountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 13, marginTop: 15, marginBottom: 18 },
  bookingHeroCount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 52, lineHeight: 58, color: colors.white },
  bookingHeroCountCopy: { flex: 1, paddingBottom: 4 },
  bookingHeroTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.white },
  bookingHeroNote: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: '#AFB9C7', marginTop: 3 },
  bookingHeroFooter: { gap: 10 },
  bookingNextDate: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 28 },
  bookingNextDateText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: '#FFE18B' },
  bookingHeroAction: { minHeight: 44, borderRadius: 13, backgroundColor: '#FFCA05', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bookingHeroActionText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: colors.black },
  bookingSummaryRow: { flexDirection: 'row', gap: 9 },
  bookingSummaryCard: { flex: 1, minWidth: 0, minHeight: 116, padding: 12, borderRadius: 19, borderWidth: 1, borderColor: '#E9EDF3', backgroundColor: colors.white },
  bookingSummaryValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 21, color: colors.black, marginTop: 7 },
  bookingSummaryLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: '#485569', marginTop: 1 },
  bookingSummaryFoot: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9.5, color: '#94A3B8', marginTop: 1 },
  bookingValueHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  bookingValueIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#F1F3F6', alignItems: 'center', justifyContent: 'center' },
  bookingValueTotal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 27, lineHeight: 35, color: colors.black, marginTop: 16 },
  bookingValueSplit: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#EEF1F5', marginTop: 14, paddingTop: 14 },
  bookingValueSplitItem: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  bookingValueDot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  bookingValueSplitLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: '#64748B' },
  bookingValueSplitAmount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: colors.black, marginTop: 2 },
  bookingValueDisclaimer: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, lineHeight: 15, color: '#8795A7', marginTop: 15 },
  bookingDayStrip: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  bookingDay: { width: 47, minHeight: 72, borderRadius: 14, backgroundColor: '#F5F7F9', borderWidth: 1, borderColor: '#EFF2F5', alignItems: 'center', justifyContent: 'center', gap: 3 },
  bookingDayActive: { backgroundColor: '#FFCA05', borderColor: '#FFCA05' },
  bookingDayName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 9.5, color: '#7D8796' },
  bookingDayNumber: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: colors.black },
  bookingDayTextActive: { color: colors.black },
  bookingDayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#C9D1DB' },
  bookingDayDotActive: { backgroundColor: colors.black },
  bookingEmptyState: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 15, backgroundColor: '#FFF9E8', marginTop: 14 },
  bookingEmptyIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: '#FFF0BE', alignItems: 'center', justifyContent: 'center' },
  bookingEmptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.black },
  bookingEmptyCopy: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, lineHeight: 15, color: '#746241', marginTop: 2 },
  bookingScheduleHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  bookingScheduleHintText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: '#746241' },
  bookingServiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  bookingServiceRank: { width: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, color: '#A4AFBE' },
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
});

