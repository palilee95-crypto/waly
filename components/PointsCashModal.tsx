import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { pb } from '@/lib/pocketbase';

type Props = {
  visible: boolean;
  onClose: () => void;
  merchantId: string;
  merchantName: string;
  balance: number;
  /** points_per_rm — how many points make RM 1.00 */
  rate: number;
  /** min_redeem_points — 0 means no minimum */
  minRedeem: number;
  onConverted?: (balance: number) => void;
};

type Result = { code: string; valueSen: number } | null;

/**
 * Converts points into a fixed-value discount voucher.
 * The rate, the minimum and the balance are all re-checked server-side; this sheet
 * only previews what the server will do.
 */
export default function PointsCashModal({
  visible,
  onClose,
  merchantId,
  merchantName,
  balance,
  rate,
  minRedeem,
  onConverted,
}: Props) {
  const safeRate = rate > 0 ? rate : 100;
  const [points, setPoints] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  const minPoints = Math.max(1, minRedeem || 1);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setResult(null);
    setBusy(false);
    // Default to the smallest valid conversion.
    setPoints(String(Math.min(balance, minPoints)));
  }, [visible, balance, minPoints]);

  const numeric = Math.floor(Number(points) || 0);
  const valueSen = Math.floor((numeric * 100) / safeRate);
  const tooFew = minRedeem > 0 && numeric < minRedeem;
  const tooMany = numeric > balance;
  const tooSmall = numeric > 0 && valueSen < 1;
  const canConvert = numeric > 0 && !tooFew && !tooMany && !tooSmall && !busy;

  const convert = async () => {
    if (!canConvert) return;
    setBusy(true);
    setError(null);
    try {
      const res = await pb.send<any>('/api/risev/customer/points/convert', {
        method: 'POST',
        body: { merchant_id: merchantId, points: numeric },
      });
      setResult({ code: res?.voucher?.code || '', valueSen: res?.voucher?.valueSen || valueSen });
      onConverted?.(Number(res?.balance) || balance - numeric);
    } catch (err: any) {
      setError(
        err?.response?.message ||
          err?.message ||
          'Could not convert those points. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const preset = (value: number) => setPoints(String(Math.max(0, Math.min(balance, Math.floor(value)))));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Use your points</Text>
              <Text style={styles.subtitle}>
                {merchantName} · {safeRate} pts = RM 1.00
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.black} />
            </TouchableOpacity>
          </View>

          {result ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={26} color="#16A34A" />
              <Text style={styles.successTitle}>
                RM {(result.valueSen / 100).toFixed(2)} voucher created
              </Text>
              <Text style={styles.successCode}>{result.code}</Text>
              <Text style={styles.successHint}>
                It is in your Vouchers tab, valid for 30 days. Show the code at the counter.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose} activeOpacity={0.9}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Available</Text>
                <Text style={styles.balanceValue}>{balance.toLocaleString('en-MY')} pts</Text>
              </View>

              <Text style={styles.fieldLabel}>POINTS TO CONVERT</Text>
              <TextInput
                value={points}
                onChangeText={(v) => setPoints(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                {...Platform.select({ web: { outlineStyle: 'none' } as any })}
              />

              <View style={styles.presetRow}>
                {minRedeem > 0 ? (
                  <TouchableOpacity style={styles.preset} onPress={() => preset(minRedeem)} activeOpacity={0.85}>
                    <Text style={styles.presetText}>Min {minRedeem}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.preset} onPress={() => preset(safeRate * 5)} activeOpacity={0.85}>
                  <Text style={styles.presetText}>RM5</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.preset} onPress={() => preset(safeRate * 10)} activeOpacity={0.85}>
                  <Text style={styles.presetText}>RM10</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.preset} onPress={() => preset(balance)} activeOpacity={0.85}>
                  <Text style={styles.presetText}>All</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Worth</Text>
                <Text style={styles.valueAmount}>RM {(Math.max(0, valueSen) / 100).toFixed(2)}</Text>
              </View>

              {tooFew ? (
                <Text style={styles.warn}>
                  This store needs at least {minRedeem} points per redemption.
                </Text>
              ) : null}
              {tooMany ? (
                <Text style={styles.warn}>You only have {balance.toLocaleString('en-MY')} points here.</Text>
              ) : null}
              {tooSmall && !tooFew ? (
                <Text style={styles.warn}>That is worth less than RM 0.01 at this rate.</Text>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Text style={styles.note}>
                Converting points creates a discount voucher for this store. Points leave your balance
                immediately and cannot be reversed.
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, !canConvert && styles.primaryBtnDisabled]}
                onPress={convert}
                disabled={!canConvert}
                activeOpacity={0.9}
              >
                {busy ? (
                  <ActivityIndicator color={colors.black} />
                ) : (
                  <Text style={styles.primaryBtnText}>Convert to voucher</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 22 : 34,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  title: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  subtitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  balanceLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#686868' },
  balanceValue: { fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  fieldLabel: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#686868',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E9E9E9',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  preset: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: '#E9E9E9',
    alignItems: 'center',
  },
  presetText: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors.black },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  valueLabel: { fontSize: 12.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#686868' },
  valueAmount: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  warn: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B45309',
    marginTop: 8,
  },
  error: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B91C1C',
    marginTop: 8,
  },
  note: {
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
    marginTop: 12,
  },
  primaryBtn: {
    height: 49,
    borderRadius: radii.md,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  successBox: { alignItems: 'flex-start', gap: 6, paddingVertical: 8 },
  successTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.black },
  successCode: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 1.5,
  },
  successHint: {
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#686868',
  },
});
