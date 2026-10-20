import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type WorkspaceSnapshot, formatCount } from '@/lib/customer-workspace';
import { colors } from '@/theme';

type Props = {
  snapshot: WorkspaceSnapshot;
  periodLabel: string;
  onOpenAudience: (card: 'rewards') => void;
  onOpenDirectory: () => void;
};

const INK = '#101114';
const MUTED = '#657186';
const LINE = '#E8EDF2';
const YELLOW = '#FFCC00';

export default function LoyaltyReport({ snapshot, periodLabel, onOpenAudience, onOpenDirectory }: Props) {
  const { width } = useWindowDimensions();
  const { loyalty, loyaltyDetail, overview } = snapshot;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const series = loyalty.series;
  const peak = Math.max(1, ...series.map((item) => Math.abs(item.stamps)));
  const defaultBucket = series.reduce<(typeof series)[number] | null>(
    (best, item) => !best || Math.abs(item.stamps) > Math.abs(best.stamps) ? item : best,
    null
  );
  const selectedBucket = series.find((item) => item.date === selectedDate) || defaultBucket;
  const slotWidth = Math.max(40, Math.min(68, Math.floor((width - 62) / Math.max(1, series.length))));
  const hasActivity = series.some((item) => item.stamps !== 0);
  const readyCount = snapshot.attention.find((item) => item.id === 'rewards')?.count
    ?? Math.max(loyalty.nearReward, loyalty.availableVouchers);
  const rate = loyaltyDetail.redemptionRate;
  const hasCohort = loyaltyDetail.issuedRedeemed !== null && rate !== null;
  const branchSelected = Boolean(snapshot.scope.branchId);

  return (
    <View style={styles.body}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}><Ionicons name="gift-outline" size={20} color={INK} /></View>
          <Text style={styles.heroEyebrow}>LOYALTY OPPORTUNITY</Text>
        </View>
        <View style={styles.heroMain}>
          <Text style={styles.heroCount}>{formatCount(loyalty.nearReward)}</Text>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>
              {loyalty.nearReward === 0
                ? 'No customers near a reward yet'
                : loyalty.nearReward === 1
                  ? 'customer is almost at a reward'
                  : 'customers are almost at a reward'}
            </Text>
            <Text style={styles.heroSub}>
              {loyalty.nearReward > 0
                ? 'Only 1–2 stamps away · A reminder could bring them back.'
                : 'You’ll see customers here when their stamp cards are nearly complete.'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.heroAction}
          onPress={() => readyCount > 0 ? onOpenAudience('rewards') : onOpenDirectory()}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={readyCount > 0 ? 'View reward-ready customers' : 'View all customers'}
        >
          <Text style={styles.heroActionText}>{readyCount > 0 ? 'View reward-ready customers' : 'View customers'}</Text>
          <Ionicons name="arrow-forward" size={17} color={colors.white} />
        </TouchableOpacity>
        {readyCount > loyalty.nearReward ? (
          <Text style={styles.heroFoot}>This audience also includes customers with a valid voucher.</Text>
        ) : null}
        {branchSelected ? <Text style={styles.heroFoot}>Reward-ready customers are counted across all branches.</Text> : null}
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle}>Live loyalty status</Text>
          <Text style={styles.sectionSubtitle}>Current balances · all branches</Text>
        </View>
        <Ionicons name="radio-outline" size={18} color="#96A1AF" />
      </View>
      <View style={styles.statusRow}>
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}><Ionicons name="ribbon-outline" size={17} color={INK} /></View>
          <Text style={styles.statusValue}>{formatCount(loyaltyDetail.activeCards)}</Text>
          <Text style={styles.statusLabel}>Active stamp cards</Text>
        </View>
        <View style={styles.statusCard}>
          <View style={[styles.statusIcon, styles.statusIconLight]}><Ionicons name="ticket-outline" size={17} color={INK} /></View>
          <Text style={styles.statusValue}>{formatCount(loyalty.availableVouchers)}</Text>
          <Text style={styles.statusLabel}>Customers with valid vouchers</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.panelTitle}>Reward performance</Text>
            <Text style={styles.panelSubtitle}>{periodLabel}{branchSelected ? ' · selected branch' : ' · all branches'}</Text>
          </View>
          <View style={styles.panelIcon}><Ionicons name="sparkles-outline" size={18} color={INK} /></View>
        </View>
        <View style={styles.performanceRow}>
          <View style={styles.performanceStat}>
            <Text style={styles.performanceValue}>{formatCount(loyaltyDetail.vouchersIssued)}</Text>
            <Text style={styles.performanceLabel}>Vouchers issued</Text>
          </View>
          <View style={styles.performanceDivider} />
          <View style={styles.performanceStat}>
            <Text style={styles.performanceValue}>{formatCount(loyaltyDetail.vouchersUsed)}</Text>
            <Text style={styles.performanceLabel}>Redeemed in period</Text>
          </View>
        </View>
        <View style={styles.rateBox}>
          <View style={styles.rateTop}>
            <Text style={styles.rateLabel}>Issued-voucher conversion</Text>
            <Text style={styles.rateValue}>{hasCohort ? `${rate}%` : 'No data'}</Text>
          </View>
          <View style={styles.rateTrack}>
            <View style={[styles.rateFill, { width: `${Math.min(100, Math.max(0, rate || 0))}%` }]} />
          </View>
          <Text style={styles.rateNote}>
            {hasCohort
              ? `${loyaltyDetail.issuedRedeemed} of ${loyaltyDetail.vouchersIssued} vouchers issued in this period have been used by now.`
              : 'Issue a voucher in this period to start measuring conversion.'}
          </Text>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.panelTitle}>Stamp activity</Text>
            <Text style={styles.panelSubtitle}>{periodLabel} · Net stamps{branchSelected ? ' · selected branch' : ''}</Text>
          </View>
          <Text style={styles.granularity}>By {loyalty.granularity}</Text>
        </View>
        {series.length === 0 ? (
          <Text style={styles.emptyText}>Stamp trend is updating for this period.</Text>
        ) : !hasActivity ? (
          <View style={styles.emptyState}>
            <Ionicons name="stats-chart-outline" size={22} color="#9AA6B5" />
            <Text style={styles.emptyText}>No stamp activity in this period.</Text>
          </View>
        ) : (
          <>
            <View style={styles.selectedReading}>
              <View style={styles.readingDot} />
              <Text style={styles.readingText} numberOfLines={1}>{selectedBucket?.detail}</Text>
              <Text style={styles.readingValue}>{formatCount(selectedBucket?.stamps || 0)} stamps</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
              {series.map((bucket) => {
                const selected = bucket.date === selectedBucket?.date;
                const negative = bucket.stamps < 0;
                const barHeight = Math.max(4, Math.round((Math.abs(bucket.stamps) / peak) * 86));
                return (
                  <TouchableOpacity
                    key={bucket.date}
                    style={[styles.barSlot, { width: slotWidth }]}
                    onPress={() => setSelectedDate(bucket.date)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${bucket.detail}, ${bucket.stamps} net stamps`}
                  >
                    <View style={styles.barArea}>
                      <View style={[
                        styles.bar,
                        { height: barHeight },
                        selected && styles.barSelected,
                        negative && styles.barNegative,
                        bucket.stamps === 0 && styles.barZero,
                      ]} />
                    </View>
                    <Text style={[styles.barLabel, selected && styles.barLabelSelected]} numberOfLines={1}>{bucket.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {series.length > 8 ? <Text style={styles.chartHint}>Swipe to see more · Tap a bar for details</Text> : <Text style={styles.chartHint}>Tap a bar for details</Text>}
          </>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Points & stamps</Text>
        <Text style={styles.panelSubtitle}>{periodLabel}{branchSelected ? ' · selected branch' : ' · all branches'}</Text>
        <MetricRow icon="sparkles-outline" label="Points earned" value={formatCount(overview.pointsEarned)} />
        <MetricRow icon="gift-outline" label="Points spent" value={formatCount(loyaltyDetail.pointsRedeemed)} />
        <MetricRow icon="ribbon-outline" label="Net stamps issued" value={formatCount(overview.stamps)} last />
      </View>
    </View>
  );
}

function MetricRow({ icon, label, value, last = false }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.metricRow, last && styles.metricRowLast]}>
      <View style={styles.metricIcon}><Ionicons name={icon} size={17} color={INK} /></View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 6, paddingBottom: 32, gap: 14 },
  hero: { backgroundColor: '#FFF5CE', borderColor: '#F4DA78', borderWidth: 1, borderRadius: 25, padding: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  heroEyebrow: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#7B5B00', fontSize: 10.5, letterSpacing: 0.8 },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 17, marginBottom: 17 },
  heroCount: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 54, lineHeight: 60 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 16, lineHeight: 21 },
  heroSub: { fontFamily: 'PlusJakartaSans_500Medium', color: '#6B5A36', fontSize: 11.5, lineHeight: 17, marginTop: 5 },
  heroAction: { minHeight: 46, backgroundColor: INK, borderRadius: 14, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroActionText: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.white, fontSize: 12.5 },
  heroFoot: { fontFamily: 'PlusJakartaSans_500Medium', color: '#766646', fontSize: 10.5, lineHeight: 15, marginTop: 9 },
  sectionHeading: { marginTop: 3, paddingHorizontal: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 17 },
  sectionSubtitle: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 11.5, marginTop: 2 },
  statusRow: { flexDirection: 'row', gap: 9 },
  statusCard: { flex: 1, minWidth: 0, minHeight: 125, borderRadius: 20, borderWidth: 1, borderColor: LINE, backgroundColor: colors.white, padding: 13 },
  statusIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#FFF0B8', alignItems: 'center', justifyContent: 'center' },
  statusIconLight: { backgroundColor: '#F0F3F6' },
  statusValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 25, marginTop: 10 },
  statusLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#526076', fontSize: 11, lineHeight: 15, marginTop: 2 },
  panel: { borderRadius: 23, backgroundColor: colors.white, borderWidth: 1, borderColor: LINE, padding: 17, shadowColor: '#142033', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.035, shadowRadius: 12, elevation: 1 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 17 },
  panelSubtitle: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 11, lineHeight: 16, marginTop: 2 },
  panelIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFF4C9', alignItems: 'center', justifyContent: 'center' },
  performanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 19, marginBottom: 18 },
  performanceStat: { flex: 1, minWidth: 0 },
  performanceValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 30, lineHeight: 36 },
  performanceLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#5B687A', fontSize: 11, marginTop: 3 },
  performanceDivider: { width: 1, height: 46, backgroundColor: LINE, marginHorizontal: 16 },
  rateBox: { borderRadius: 15, backgroundColor: '#F6F8FA', padding: 13 },
  rateTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rateLabel: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', color: '#405066', fontSize: 11.5 },
  rateValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 17 },
  rateTrack: { height: 8, borderRadius: 4, backgroundColor: '#E7EBF0', overflow: 'hidden', marginTop: 11 },
  rateFill: { height: 8, borderRadius: 4, backgroundColor: YELLOW },
  rateNote: { fontFamily: 'PlusJakartaSans_500Medium', color: '#637185', fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  granularity: { fontFamily: 'PlusJakartaSans_700Bold', color: '#4D5C70', backgroundColor: '#F4F6F8', overflow: 'hidden', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6, fontSize: 10.5 },
  selectedReading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 17, marginBottom: 4 },
  readingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: YELLOW },
  readingText: { flex: 1, minWidth: 0, fontFamily: 'PlusJakartaSans_600SemiBold', color: MUTED, fontSize: 10.5 },
  readingValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 12 },
  chartScroll: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 4, paddingBottom: 2, flexGrow: 1, justifyContent: 'space-around' },
  barSlot: { height: 118, alignItems: 'center', justifyContent: 'flex-end' },
  barArea: { height: 88, width: '100%', borderBottomWidth: 1, borderBottomColor: '#DDE4EA', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 22, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: YELLOW },
  barSelected: { backgroundColor: INK },
  barNegative: { backgroundColor: '#D85C5C' },
  barZero: { backgroundColor: '#E7EBF0' },
  barLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#98A4B4', fontSize: 9.5, marginTop: 7 },
  barLabelSelected: { color: INK, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  chartHint: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8793A2', fontSize: 10, marginTop: 9 },
  emptyState: { minHeight: 105, alignItems: 'center', justifyContent: 'center', gap: 9 },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 11.5, textAlign: 'center' },
  metricRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#EDF1F5' },
  metricRowLast: { borderBottomWidth: 0 },
  metricIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#F5F7F9', alignItems: 'center', justifyContent: 'center' },
  metricLabel: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#576579', fontSize: 11.5 },
  metricValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 14 },
});
