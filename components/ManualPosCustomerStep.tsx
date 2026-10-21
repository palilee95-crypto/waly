import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { normalizeManualPosPhone } from '@/lib/manualPosPhone';

type Props = {
  locale: string;
  phone: string;
  onPhoneChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
  busy: boolean;
  error: string;
  total: number;
  itemCount: number;
};

export default function ManualPosCustomerStep({ locale, phone, onPhoneChange, onBack, onContinue, busy, error, total, itemCount }: Props) {
  const ms = locale === 'ms';
  const valid = !!normalizeManualPosPhone(phone);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={onBack} disabled={busy} accessibilityRole="button" accessibilityLabel={ms ? 'Kembali ke pesanan' : 'Back to order'}>
          <Ionicons name="chevron-back" size={21} color="#111111" />
          <Text style={styles.backText}>{ms ? 'Pesanan' : 'Order'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{ms ? 'Pelanggan' : 'Customer'}</Text>
        <View style={{ width: 75 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.stepBadge}><Ionicons name="person-outline" size={20} color="#111111" /></View>
        <Text style={styles.title}>{ms ? 'Siapa pelanggan ini?' : 'Who is this sale for?'}</Text>
        <Text style={styles.description}>{ms ? 'Masukkan nombor telefon sebelum pembayaran. Baucar dan ganjaran pelanggan akan tersedia selepas ini.' : 'Enter a customer phone number before payment. We’ll then show their available vouchers and rewards.'}</Text>
        <Text style={styles.label}>{ms ? 'Nombor telefon pelanggan' : 'Customer phone number'} *</Text>
        <TextInput
          style={[styles.input, !!error && styles.inputError]}
          value={phone}
          onChangeText={onPhoneChange}
          keyboardType="phone-pad"
          autoComplete="tel"
          autoFocus
          editable={!busy}
          onSubmitEditing={valid && !busy ? onContinue : undefined}
          placeholder="01X XXX XXXX"
          placeholderTextColor="#94A3B8"
          accessibilityLabel={ms ? 'Nombor telefon pelanggan' : 'Customer phone number'}
        />
        <Text style={styles.hint}>{ms ? 'Format: 01… atau +601…' : 'Format: 01… or +601…'}</Text>
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        <View style={styles.summary}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{ms ? 'Item' : 'Items'}</Text><Text style={styles.summaryValue}>{itemCount}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{ms ? 'Jumlah pesanan' : 'Order total'}</Text><Text style={styles.summaryTotal}>RM {total.toFixed(2)}</Text></View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, (!valid || busy) && styles.buttonDisabled]} onPress={onContinue} disabled={!valid || busy} accessibilityRole="button" accessibilityState={{ disabled: !valid || busy }}>
          {busy ? <ActivityIndicator color="#111111" /> : <><Text style={styles.buttonText}>{ms ? 'Teruskan ke semakan' : 'Continue to review'}</Text><Ionicons name="arrow-forward" size={18} color="#111111" /></>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingTop: 12 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { minWidth: 75, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#111111' },
  headerTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: '#111111' },
  content: { flexGrow: 1, paddingTop: 26, paddingBottom: 24 },
  stepBadge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1C5', marginBottom: 18 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, letterSpacing: -0.6, color: '#111111' },
  description: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, lineHeight: 20, color: '#64748B', marginTop: 8, marginBottom: 28 },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#111111', marginBottom: 8 },
  input: { minHeight: 54, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingHorizontal: 14, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 17, color: '#111111' },
  inputError: { borderColor: '#DC2626' },
  hint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#64748B', marginTop: 8 },
  error: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#B91C1C', marginTop: 10 },
  summary: { marginTop: 30, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, gap: 12, backgroundColor: '#F8FAFC' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#64748B' },
  summaryValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#111111' },
  summaryTotal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: '#111111' },
  footer: { paddingTop: 12, paddingBottom: 18, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: '#FFC700', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: '#111111' },
});
