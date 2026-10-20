import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { type LedgerFocus, type WorkspaceSnapshot, formatMoney, formatShortDateFromIso } from '@/lib/customer-workspace';

type Metric = 'sales' | 'orders' | 'buyers';
type Daypart = 0 | 1 | 2 | 3;
const INK = '#111214';
const MUTED = '#708096';
const LINE = '#E9EEF4';
const YELLOW = '#FFCA05';
const DAYPARTS: { label: string; range: string; start: number }[] = [
  { label: 'Overnight', range: '12am–6am', start: 0 },
  { label: 'Morning', range: '6am–12pm', start: 6 },
  { label: 'Afternoon', range: '12pm–6pm', start: 12 },
  { label: 'Evening', range: '6pm–12am', start: 18 },
];

function nextBucket(date: string, granularity: 'day' | 'month') {
  const [year, month, day] = date.split('-').map(Number);
  const next = granularity === 'month' ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

function bucketFrom(date: string, granularity: 'day' | 'month') {
  return granularity === 'month' ? `${date}-01` : date;
}

function bucketLabel(date: string, granularity: 'day' | 'month') {
  if (granularity === 'month') return new Date(`${date}-01T00:00:00Z`).toLocaleString('en-MY', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return formatShortDateFromIso(date);
}

function hourLabel(hour: number) {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function shareText(amount: number, total: number) {
  if (total <= 0) return '0%';
  const percentage = (amount / total) * 100;
  if (percentage > 0 && percentage < 1) return '<1%';
  if (percentage > 99 && percentage < 100) return `${percentage.toFixed(1)}%`;
  return `${Math.round(percentage)}%`;
}

function Header({ icon, title, detail }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }) {
  return <View style={s.sectionHeader}>
    <View style={s.headerIcon}><Ionicons name={icon} size={18} color={INK} /></View>
    <View style={{ flex: 1 }}><Text style={s.sectionTitle}>{title}</Text><Text style={s.sectionDetail}>{detail}</Text></View>
  </View>;
}

export default function SalesReport({ snapshot, periodLabel, onOpenLedger, onOpenDirectory, onOpenAnalytics }: {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenLedger: (focus?: LedgerFocus) => void;
  onOpenDirectory: () => void;
  onOpenAnalytics: () => void;
}) {
  const { overview, sales } = snapshot;
  const [metric, setMetric] = useState<Metric>('sales');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [typicalScale, setTypicalScale] = useState(false);
  const [daypart, setDaypart] = useState<Daypart>(0);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const series = sales.series;
  const peak = series.reduce((best, item) => item.salesCents > (best?.salesCents ?? -1) ? item : best, series[0]);
  const selected = series.find((item) => item.date === selectedDate) || peak;
  const peakShare = peak && overview.salesCents > 0 ? peak.salesCents / overview.salesCents : 0;
  const previous = overview.previous.salesCents;
  const delta = previous > 0 ? Math.round(((overview.salesCents - previous) / previous) * 100) : null;
  const second = [...series].sort((a, b) => b.salesCents - a.salesCents)[1]?.salesCents || 0;
  const hasOutlier = !!peak && second > 0 && peak.salesCents >= second * 2.5;
  const metricValue = (item: typeof series[number]) => metric === 'sales' ? item.salesCents : metric === 'orders' ? item.orders : item.buyers ?? 0;
  const maxMetric = Math.max(1, ...series.map(metricValue));
  const secondMetric = [...series.map(metricValue)].sort((a, b) => b - a)[1] || 0;
  const cap = metric === 'sales' && typicalScale && hasOutlier ? Math.max(1, secondMetric * 1.2) : maxMetric;
  const part = DAYPARTS[daypart];
  const partHours = sales.hours.slice(part.start, part.start + 6);
  const partTotal = partHours.reduce((sum, count) => sum + count, 0);
  const topHour = sales.hours.reduce((best, count, hour) => count > best.count ? { hour, count } : best, { hour: 0, count: 0 });
  const displayHour = selectedHour !== null && selectedHour >= part.start && selectedHour < part.start + 6 ? selectedHour : (partHours.indexOf(Math.max(...partHours)) + part.start);
  const focusedHourCount = sales.hours[displayHour] || 0;
  const buyerDetailAvailable = sales.buyerCount !== null;
  const trackedSales = (sales.newSalesCents ?? 0) + (sales.returningSalesCents ?? 0) + (sales.unattributedSalesCents ?? 0);
  const knownSales = (sales.newSalesCents ?? 0) + (sales.returningSalesCents ?? 0);
  const unassigned = sales.staff.find((item) => !item.id && item.salesCents > 0);

  const openBucket = (date: string) => onOpenLedger({
    from: bucketFrom(date, sales.granularity), to: nextBucket(date, sales.granularity), salesOnly: true,
    title: `${bucketLabel(date, sales.granularity)} sales`,
  });

  return <View style={s.body}>
    <View style={s.hero}>
      <View style={s.heroTop}><View><Text style={s.heroEyebrow}>SALES PULSE · {periodLabel.toUpperCase()}</Text><Text style={s.heroTitle}>Recorded sales</Text></View><View style={s.heroIcon}><Ionicons name="trending-up" size={22} color={INK} /></View></View>
      <Text style={s.heroValue} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(overview.salesCents)}</Text>
      <View style={s.heroDeltaRow}>
        <Text style={[s.delta, delta !== null && delta < 0 && s.deltaDown]}>{delta === null ? 'No previous sales' : `${delta > 0 ? '+' : ''}${delta}%`}</Text>
        <Text style={s.heroDeltaNote}>{delta === null ? 'Comparison available after another period' : `vs previous period · ${formatMoney(previous)}`}</Text>
      </View>
      <View style={s.heroRule} />
      <View style={s.heroStats}>
        <View style={s.heroStat}><Text style={s.heroStatValue}>{overview.orders.toLocaleString('en-MY')}</Text><Text style={s.heroStatLabel}>Paid orders</Text></View>
        <View style={s.heroStatDivider} />
        <View style={s.heroStat}><Text style={s.heroStatValue}>{overview.avgOrderCents === null ? '—' : formatMoney(overview.avgOrderCents)}</Text><Text style={s.heroStatLabel}>Average order</Text></View>
        <View style={s.heroStatDivider} />
        <View style={s.heroStat}><Text style={s.heroStatValue}>{overview.vouchersRedeemed}</Text><Text style={s.heroStatLabel}>Vouchers used</Text></View>
      </View>
    </View>

    {peak && overview.salesCents > 0 && series.length > 1 ? <TouchableOpacity style={s.insight} onPress={() => openBucket(peak.date)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Open recorded sales for ${bucketLabel(peak.date, sales.granularity)}`}>
      <View style={s.insightIcon}><Ionicons name={peakShare >= 0.5 ? 'flash' : 'sparkles'} size={21} color="#8A5C00" /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.insightTitle}>{peakShare >= 0.5 ? 'A standout sales period' : 'Your strongest sales period'}</Text>
        <Text style={s.insightCopy}>{bucketLabel(peak.date, sales.granularity)} brought in {formatMoney(peak.salesCents)} · {shareText(peak.salesCents, overview.salesCents)} of recorded sales. Tap to inspect the orders.</Text>
      </View><Ionicons name="arrow-forward" size={17} color={INK} />
    </TouchableOpacity> : null}

    <View style={s.panel}>
      <Header icon="bar-chart-outline" title="Sales over time" detail={`Explore each ${sales.granularity === 'month' ? 'month' : 'day'} in ${periodLabel.toLowerCase()}`} />
      <View style={s.segment}>
        {(['sales', 'orders', 'buyers'] as Metric[]).map((item) => <TouchableOpacity key={item} style={[s.segmentItem, metric === item && s.segmentActive]} onPress={() => setMetric(item)} disabled={item === 'buyers' && !buyerDetailAvailable} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: metric === item, disabled: item === 'buyers' && !buyerDetailAvailable }}><Text style={[s.segmentText, metric === item && s.segmentTextActive, item === 'buyers' && !buyerDetailAvailable && s.segmentDisabled]}>{item === 'sales' ? 'Revenue' : item === 'orders' ? 'Orders' : 'Buyers'}</Text></TouchableOpacity>)}
      </View>
      {hasOutlier && metric === 'sales' ? <TouchableOpacity style={s.scaleButton} onPress={() => setTypicalScale((value) => !value)} accessibilityRole="button" accessibilityState={{ selected: typicalScale }}><Ionicons name={typicalScale ? 'checkbox' : 'square-outline'} size={16} color={INK} /><Text style={s.scaleText}>Show typical days clearly</Text></TouchableOpacity> : null}
      {series.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: Math.max(0, series.findIndex((item) => item.date === peak?.date) * (series.length > 14 ? 29 : 38) - 125), y: 0 }} contentContainerStyle={[s.chartContent, { minWidth: Math.max(306, series.length * (series.length > 14 ? 29 : 38)) }]}>
        {series.map((item, index) => {
          const value = metricValue(item);
          const active = item.date === selected?.date;
          const clipped = value > cap;
          return <TouchableOpacity key={item.date} style={s.chartBucket} onPress={() => setSelectedDate(item.date)} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${bucketLabel(item.date, sales.granularity)}, ${metric === 'sales' ? formatMoney(value) : `${value} ${metric}`}`}>
            <View style={s.chartBarArea}>
              {clipped ? <Text style={s.chartBreak}>⌃</Text> : null}
              <View style={[s.chartBar, { height: value === 0 ? 3 : Math.max(8, Math.min(110, (value / cap) * 110)), backgroundColor: active ? YELLOW : value === 0 ? '#E8EDF3' : INK }]} />
            </View>
            <Text style={[s.chartAxis, active && s.chartAxisActive]} numberOfLines={1}>{series.length > 16 && index % 3 !== 0 && !active ? '·' : bucketLabel(item.date, sales.granularity).replace(/\s\d{4}$/, '')}</Text>
          </TouchableOpacity>;
        })}
      </ScrollView> : <Text style={s.empty}>No paid orders in this period.</Text>}
      {typicalScale && metric === 'sales' && hasOutlier ? <Text style={s.chartNote}>Bars above the typical range are capped and marked ⌃. The figures below are exact.</Text> : null}
      {selected ? <View style={s.selectedDetail}><View style={{ flex: 1 }}><Text style={s.selectedDate}>{bucketLabel(selected.date, sales.granularity)}</Text><Text style={s.selectedMeta}>{selected.orders} order{selected.orders === 1 ? '' : 's'}{buyerDetailAvailable ? ` · ${selected.buyers ?? 0} paying customer${selected.buyers === 1 ? '' : 's'}` : ''}</Text></View><Text style={s.selectedAmount}>{formatMoney(selected.salesCents)}</Text></View> : null}
      {selected && selected.orders > 0 ? <TouchableOpacity style={s.textAction} onPress={() => openBucket(selected.date)} accessibilityRole="button"><Text style={s.textActionLabel}>View these transactions</Text><Ionicons name="arrow-forward" size={16} color={INK} /></TouchableOpacity> : null}
    </View>

    <View style={s.panel}>
      <Header icon="time-outline" title="When orders happen" detail={`${overview.orders} paid orders · local store time`} />
      {topHour.count > 0 ? <View style={s.timeInsight}><Ionicons name="sunny-outline" size={17} color="#9A6500" /><Text style={s.timeInsightText}>Most orders landed around {hourLabel(topHour.hour)} ({topHour.count}). Check opening hours if this looks unexpected.</Text></View> : null}
      <View style={s.daypartGrid}>{DAYPARTS.map((item, index) => {
        const count = sales.hours.slice(item.start, item.start + 6).reduce((sum, value) => sum + value, 0);
        const active = daypart === index;
        return <TouchableOpacity key={item.label} style={[s.daypartCard, active && s.daypartCardActive]} onPress={() => { setDaypart(index as Daypart); setSelectedHour(null); }} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: active }}><Text style={s.daypartName}>{item.label}</Text><Text style={s.daypartCount}>{count}</Text><Text style={s.daypartRange}>{item.range}</Text></TouchableOpacity>;
      })}</View>
      <View style={s.hourHeader}><Text style={s.hourTitle}>{part.label} · {partTotal} orders</Text><Text style={s.hourHint}>Tap an hour</Text></View>
      <View style={s.hours}>{partHours.map((count, index) => {
        const hour = part.start + index;
        const max = Math.max(1, ...partHours);
        return <TouchableOpacity key={hour} style={s.hourCol} onPress={() => setSelectedHour(hour)} accessibilityRole="button" accessibilityState={{ selected: displayHour === hour }} accessibilityLabel={`${hourLabel(hour)}, ${count} order${count === 1 ? '' : 's'}`}><Text style={s.hourValue}>{count}</Text><View style={s.hourTrack}><View style={[s.hourBar, { height: count ? Math.max(7, (count / max) * 62) : 3, backgroundColor: displayHour === hour ? YELLOW : count ? INK : '#E8EDF3' }]} /></View><Text style={[s.hourAxis, displayHour === hour && s.chartAxisActive]}>{hourLabel(hour)}</Text></TouchableOpacity>;
      })}</View>
      {focusedHourCount > 0 ? <TouchableOpacity style={s.textAction} onPress={() => onOpenLedger({ hour: displayHour, salesOnly: true, title: `${hourLabel(displayHour)} orders` })} accessibilityRole="button"><Text style={s.textActionLabel}>View {focusedHourCount} order{focusedHourCount === 1 ? '' : 's'} at {hourLabel(displayHour)}</Text><Ionicons name="arrow-forward" size={16} color={INK} /></TouchableOpacity> : null}
    </View>

    <View style={s.panel}>
      <Header icon="people-outline" title="Who drives sales" detail={buyerDetailAvailable ? `${sales.buyerCount} distinct paying customer${sales.buyerCount === 1 ? '' : 's'}` : 'Purchase history by customer'} />
      {knownSales > 0 ? <>
        <View style={s.mixLine}><View style={{ flex: 1 }}><Text style={s.mixName}>First purchase in period</Text><Text style={s.mixNote}>New paying customers</Text></View><Text style={s.mixValue}>{formatMoney(sales.newSalesCents ?? 0)}</Text></View>
        <View style={s.mixTrack}><View style={[s.mixFill, { width: `${Math.min(100, (sales.newSalesCents ?? 0) / knownSales * 100)}%`, backgroundColor: YELLOW }]} /></View>
        <View style={s.mixLine}><View style={{ flex: 1 }}><Text style={s.mixName}>Purchased before period</Text><Text style={s.mixNote}>Returning paying customers</Text></View><Text style={s.mixValue}>{formatMoney(sales.returningSalesCents ?? 0)}</Text></View>
        <View style={s.mixTrack}><View style={[s.mixFill, { width: `${Math.min(100, (sales.returningSalesCents ?? 0) / knownSales * 100)}%`, backgroundColor: INK }]} /></View>
      </> : <Text style={s.empty}>{buyerDetailAvailable ? 'No linked customer purchases in this period.' : 'Customer purchase breakdown is unavailable from the current data service.'}</Text>}
      {(sales.unattributedSalesCents ?? 0) > 0 ? <Text style={s.mixCaveat}>{formatMoney(sales.unattributedSalesCents ?? 0)} has no linked customer and is excluded from the mix.</Text> : null}
      {trackedSales > 0 ? <Text style={s.mixCaveat}>Based on first recorded purchase history, not a measure of campaign impact.</Text> : null}
      <TouchableOpacity style={s.textAction} onPress={onOpenDirectory} accessibilityRole="button"><Text style={s.textActionLabel}>Explore customers</Text><Ionicons name="arrow-forward" size={16} color={INK} /></TouchableOpacity>
    </View>

    {sales.outlets.length > 0 ? <View style={s.panel}><Header icon="business-outline" title="By outlet" detail="Tap an outlet to inspect its sales" />{sales.outlets.map((item) => <TouchableOpacity key={item.id || 'unassigned'} style={s.rankRow} onPress={() => onOpenLedger({ branchId: item.id || undefined, unassignedOutlet: !item.id, salesOnly: true, title: `${item.name} sales` })} activeOpacity={0.8} accessibilityRole="button"><View style={{ flex: 1 }}><Text style={s.rankName}>{item.name}</Text><Text style={s.rankMeta}>{item.orders} paid orders · {shareText(item.salesCents, overview.salesCents)} of sales</Text></View><Text style={s.rankValue}>{formatMoney(item.salesCents)}</Text><Ionicons name="chevron-forward" size={15} color="#9AA6B5" /></TouchableOpacity>)}</View> : null}

    <View style={s.panel}><Header icon="people-circle-outline" title="Staff attribution" detail="Recorded sales linked to a team member" />
      {unassigned ? <TouchableOpacity style={s.attributionNotice} onPress={() => onOpenLedger({ unassignedStaff: true, salesOnly: true, title: 'Unassigned staff sales' })} activeOpacity={0.8} accessibilityRole="button"><Ionicons name="information-circle-outline" size={20} color="#8A5C00" /><View style={{ flex: 1 }}><Text style={s.attributionTitle}>{shareText(unassigned.salesCents, overview.salesCents)} of sales have no staff assigned</Text><Text style={s.attributionText}>Open these orders to review attribution.</Text></View><Ionicons name="arrow-forward" size={16} color={INK} /></TouchableOpacity> : null}
      {sales.staff.length === 0 ? <Text style={s.empty}>No paid orders with staff attribution in this period.</Text> : sales.staff.map((item) => <TouchableOpacity key={item.id || 'unassigned'} style={s.rankRow} onPress={() => onOpenLedger({ staffId: item.id || undefined, unassignedStaff: !item.id, salesOnly: true, title: `${item.name} sales` })} activeOpacity={0.8} accessibilityRole="button"><View style={{ flex: 1 }}><Text style={s.rankName}>{item.name}</Text><Text style={s.rankMeta}>{item.orders} paid orders · {item.stamps} stamps</Text></View><Text style={s.rankValue}>{formatMoney(item.salesCents)}</Text><Ionicons name="chevron-forward" size={15} color="#9AA6B5" /></TouchableOpacity>)}
    </View>

    <View style={s.footerActions}><TouchableOpacity style={s.footerPrimary} onPress={() => onOpenLedger()} accessibilityRole="button"><Ionicons name="receipt-outline" size={17} color={INK} /><Text style={s.footerPrimaryText}>All transactions</Text><Ionicons name="arrow-forward" size={16} color={INK} /></TouchableOpacity><TouchableOpacity style={s.footerSecondary} onPress={onOpenAnalytics} accessibilityRole="button"><Text style={s.footerSecondaryText}>Open full analytics</Text><Ionicons name="arrow-forward" size={15} color={INK} /></TouchableOpacity></View>
  </View>;
}

const s = StyleSheet.create({
  body: { paddingTop: 6, paddingBottom: 32, gap: 12 },
  hero: { backgroundColor: INK, borderRadius: 23, padding: 19, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEyebrow: { fontFamily: 'PlusJakartaSans_700Bold', color: '#B7C0CC', fontSize: 10, letterSpacing: 1.2 },
  heroTitle: { fontFamily: 'PlusJakartaSans_700Bold', color: colors.white, fontSize: 16, marginTop: 5 },
  heroIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  heroValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 34, lineHeight: 43, color: colors.white, marginTop: 14 },
  heroDeltaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 5 },
  delta: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, color: '#52D4A2', backgroundColor: '#183B31', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  deltaDown: { color: '#FFC4C4', backgroundColor: '#402424' },
  heroDeltaNote: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#B7C0CC' },
  heroRule: { height: 1, backgroundColor: '#34383C', marginVertical: 17 },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroStat: { flex: 1, minWidth: 0 },
  heroStatValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.white },
  heroStatLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9.5, color: '#B7C0CC', marginTop: 3 },
  heroStatDivider: { height: 31, width: 1, backgroundColor: '#34383C' },
  insight: { minHeight: 88, borderRadius: 20, backgroundColor: '#FFF8E2', borderWidth: 1, borderColor: '#FDE6A6', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  insightIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFE9A2', alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: INK },
  insightCopy: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, lineHeight: 16, color: '#665B40', marginTop: 4 },
  panel: { backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: LINE, padding: 16, shadowColor: '#142033', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.035, shadowRadius: 12, elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  headerIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  sectionTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: INK },
  sectionDetail: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: MUTED, marginTop: 3 },
  segment: { flexDirection: 'row', backgroundColor: '#F1F3F6', borderRadius: 13, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 39, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: INK },
  segmentText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#617084' },
  segmentTextActive: { color: colors.white },
  segmentDisabled: { color: '#B0BAC7' },
  scaleButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 7 },
  scaleText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10.5, color: '#46546A' },
  chartContent: { height: 151, alignItems: 'flex-end', paddingTop: 14, paddingBottom: 2, marginTop: 10 },
  chartBucket: { flex: 1, minWidth: 26, height: 135, alignItems: 'center', justifyContent: 'flex-end' },
  chartBarArea: { height: 112, width: '58%', justifyContent: 'flex-end', alignItems: 'center' },
  chartBar: { width: '100%', borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  chartBreak: { position: 'absolute', zIndex: 1, top: -10, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: INK },
  chartAxis: { width: '100%', textAlign: 'center', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 9, color: '#9AA6B5', marginTop: 5 },
  chartAxisActive: { color: INK, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  chartNote: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: MUTED, marginTop: 6 },
  selectedDetail: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#FFF9E9', borderRadius: 13, marginTop: 11 },
  selectedDate: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: INK },
  selectedMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: '#6B788B', marginTop: 3 },
  selectedAmount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: INK },
  textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LINE, marginTop: 12, paddingTop: 9 },
  textActionLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: INK },
  empty: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: MUTED, paddingVertical: 12 },
  timeInsight: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFF9E9', borderRadius: 12, padding: 11, marginBottom: 12 },
  timeInsightText: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, lineHeight: 15, color: '#665B40' },
  daypartGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  daypartCard: { width: '48%', flexGrow: 1, minHeight: 84, padding: 11, borderRadius: 15, backgroundColor: '#F6F8FA', borderWidth: 1, borderColor: '#EFF2F5' },
  daypartCardActive: { backgroundColor: '#FFF7DB', borderColor: '#FFD756' },
  daypartName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#485569' },
  daypartCount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 21, color: INK, marginTop: 4 },
  daypartRange: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9.5, color: MUTED },
  hourHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  hourTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: INK },
  hourHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: MUTED },
  hours: { flexDirection: 'row', height: 113, marginTop: 6 },
  hourCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  hourValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: INK },
  hourTrack: { height: 66, width: '45%', justifyContent: 'flex-end', marginTop: 4 },
  hourBar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  hourAxis: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 9, color: MUTED, marginTop: 5 },
  mixLine: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  mixName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: INK },
  mixNote: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: MUTED, marginTop: 2 },
  mixValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: INK },
  mixTrack: { height: 9, borderRadius: 5, backgroundColor: '#EDF1F5', marginTop: 7, marginBottom: 8, overflow: 'hidden' },
  mixFill: { height: 9, borderRadius: 5 },
  mixCaveat: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, lineHeight: 14, color: MUTED, marginTop: 7 },
  rankRow: { flexDirection: 'row', alignItems: 'center', minHeight: 62, borderTopWidth: 1, borderTopColor: LINE, gap: 8 },
  rankName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: INK },
  rankMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: MUTED, marginTop: 3 },
  rankValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11.5, color: INK },
  attributionNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF9E9', padding: 11, borderRadius: 13, marginBottom: 8 },
  attributionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: INK },
  attributionText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: '#665B40', marginTop: 3 },
  footerActions: { gap: 8 },
  footerPrimary: { minHeight: 50, backgroundColor: YELLOW, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerPrimaryText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: INK },
  footerSecondary: { minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  footerSecondaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: INK },
});
