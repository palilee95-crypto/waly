import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

type Props = {
  customerCount: number;
  quotaLimit: number;
  isPro: boolean;
  loading: boolean;
  locale: string;
  cohorts: { newCustomers: number; repeatCustomers: number; churnCustomers: number };
  onUpgrade: () => void;
};

export default function CustomerOverviewCards({ customerCount, quotaLimit, isPro, loading, locale, cohorts, onUpgrade }: Props) {
  const [width, setWidth] = useState(340);
  const ms = locale === 'ms';
  const scale = Math.min(1.25, width / 760);
  const size = (value: number, minimum = 0) => Math.max(minimum, value * scale);
  const ratio = isPro || quotaLimit <= 0 ? 0 : Math.max(0, Math.min(1, customerCount / quotaLimit));
  // 220-degree arc: a wider opening and deeper bowl, as in the reference.
  const arcLength = 84 * Math.PI * 220 / 180;
  const arc = 'M 21.07 136.73 A 84 84 0 1 1 178.93 136.73';
  const muted = '#7B8395';
  const titleStyle = { fontSize: size(20, 9), lineHeight: size(26, 13) };
  const detailStyle = { fontSize: size(16, 9), color: muted };
  const cardStyle = { padding: size(22, 10), borderRadius: size(32, 22), minHeight: size(334, 208) };
  const badge = (name: React.ComponentProps<typeof Ionicons>['name'], header = false) => (
    <View style={[styles.badge, { width: size(header ? 56 : 52, header ? 27 : 25), height: size(header ? 56 : 52, header ? 27 : 25), borderRadius: size(18, 9) }]}>
      <Ionicons name={name} size={size(header ? 28 : 26, 14)} color="#000000" />
    </View>
  );
  const header = (name: React.ComponentProps<typeof Ionicons>['name'], title: string, subtitle: string) => (
    <View style={[styles.header, { gap: size(15, 6), marginBottom: size(20, 12) }]}>
      {badge(name, true)}
      <View style={styles.textColumn}>
        <Text style={[styles.bold, titleStyle]}>{title}</Text>
        <Text style={[styles.medium, detailStyle, { marginTop: size(4, 2) }]}>{subtitle}</Text>
      </View>
    </View>
  );
  const rows = [
    { icon: 'person-add' as const, label: ms ? 'PELANGGAN BARU' : 'NEW CUSTOMER', value: cohorts.newCustomers },
    { icon: 'repeat' as const, label: ms ? 'BERULANG' : 'REPEAT CUSTOMER', value: cohorts.repeatCustomers },
    { icon: 'time-outline' as const, label: ms ? 'BERISIKO' : 'CHURN CUSTOMER', value: cohorts.churnCustomers },
  ];
  return (
    <View style={[styles.row, { gap: size(18, 10) }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View style={[styles.card, cardStyle]}>
        {header('people', ms ? 'KUOTA PELANGGAN' : 'CUSTOMER QUOTA', ms ? 'Kuota seumur hidup' : 'Lifetime quota')}
        <View style={[styles.quotaBody, { gap: size(16, 6) }]}>
          <View style={styles.gauge} accessible accessibilityLabel={isPro ? `${customerCount} ${ms ? 'pelanggan, tanpa had' : 'customers, unlimited quota'}` : `${customerCount} / ${quotaLimit}, ${(ratio * 100).toFixed(1)}%`}>
            <Svg width="100%" height="100%" viewBox="0 0 200 160">
              <Path d={arc} stroke="#E9EEF2" strokeWidth={15} strokeLinecap="round" fill="none" />
              {!isPro && customerCount > 0 && <Path d={arc} stroke="#FFCC00" strokeWidth={15} strokeLinecap="round" fill="none" strokeDasharray={`${arcLength} ${arcLength}`} strokeDashoffset={arcLength * (1 - ratio)} />}
            </Svg>
            <View style={styles.gaugeCopy}>
              <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.bold, { fontSize: size(48, 23), lineHeight: size(54, 29) }]}>{customerCount.toLocaleString()}</Text>
              <Text style={[styles.medium, detailStyle]}>{ms ? 'pelanggan' : 'customers'}</Text>
              <Text style={[styles.medium, { color: muted, fontSize: size(14, 8), marginTop: size(9, 5) }]}>{isPro ? (ms ? 'Tanpa had' : 'Unlimited') : `${(ratio * 100).toFixed(1)}% ${ms ? 'daripada' : 'of'} ${quotaLimit.toLocaleString()}`}</Text>
            </View>
          </View>
          <View style={[styles.totals, { paddingLeft: size(16, 6), gap: size(14, 8) }]}>
            <View>
              <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.bold, { fontSize: size(34, 12) }]}>{isPro ? '∞' : quotaLimit.toLocaleString()}</Text>
              <Text style={[styles.medium, detailStyle]}>{ms ? 'Jumlah kuota' : 'Total quota'}</Text>
            </View>
            <View style={styles.divider} />
            <View>
              <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.bold, { fontSize: size(34, 12) }]}>{isPro ? '∞' : Math.max(0, quotaLimit - customerCount).toLocaleString()}</Text>
              <Text style={[styles.medium, detailStyle]}>{ms ? 'Baki' : 'Remaining'}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onUpgrade} activeOpacity={0.75} style={[styles.upgrade, { minHeight: size(52, 44), marginTop: size(24, 12), gap: size(18, 10) }]}>
          <Text style={[styles.bold, { fontSize: size(23, 13) }]}>{isPro ? (ms ? 'Urus pelan' : 'Manage plan') : (ms ? 'Naik taraf' : 'Upgrade')}</Text>
          <Ionicons name="arrow-forward" size={size(28, 18)} color="#000000" />
        </TouchableOpacity>
      </View>
      <View style={[styles.card, cardStyle]}>
        {header('pie-chart', ms ? 'STATUS PELANGGAN' : 'CUSTOMER HEALTH', ms ? 'Aktiviti pelanggan' : 'Customer activity')}
        <View style={styles.healthRows}>
          {rows.map((row, index) => (
            <React.Fragment key={row.icon}>
              {index > 0 && <View style={styles.divider} />}
              <View style={[styles.healthRow, { gap: size(17, 7), paddingVertical: size(12, 7) }]}>
                {badge(row.icon)}
                <View style={styles.textColumn}>
                  <Text style={[styles.medium, { fontSize: size(16, 9), color: muted }]}>{row.label}</Text>
                  <View style={[styles.valueRow, { gap: size(9, 4) }]}>
                    <Text style={[styles.bold, { fontSize: size(34, 20), lineHeight: size(42, 26) }]}>{loading ? '…' : row.value.toLocaleString()}</Text>
                    <Text style={[styles.medium, detailStyle]}>{ms ? 'orang' : 'users'}</Text>
                  </View>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', marginTop: 16 },
  card: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F3', shadowColor: '#64748B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 20, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'center' },
  badge: { backgroundColor: '#FFF8CE', alignItems: 'center', justifyContent: 'center' },
  textColumn: { flex: 1, minWidth: 0 },
  bold: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' },
  medium: { fontFamily: 'PlusJakartaSans_500Medium' },
  quotaBody: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  gauge: { flex: 1.5, aspectRatio: 1.25, position: 'relative' },
  gaugeCopy: { position: 'absolute', left: '8%', right: '8%', top: '34%', alignItems: 'center' },
  totals: { flex: 1.2, minWidth: 0, borderLeftWidth: 1, borderLeftColor: '#E8ECF1' },
  divider: { height: 1, backgroundColor: '#EDF0F4' },
  upgrade: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#FFCC00' },
  healthRows: { flex: 1, justifyContent: 'space-between' },
  healthRow: { flexDirection: 'row', alignItems: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
});
