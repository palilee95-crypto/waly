import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/theme';
import { formatMoney, relativeDays } from '@/lib/customer-workspace';
import { avatarUrl, type ManageCustomerRow } from '@/lib/customer-management';
import { customerSignal } from '@/lib/customer-outreach';
import { whatsappNumber } from '@/lib/whatsapp';

type Props = { row: ManageCustomerRow; selected?: boolean; visitDate?: string; onPress: () => void; onWhatsApp: () => void };

function initials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) || '')).toUpperCase();
}

export default function CustomerListRow({ row, selected, visitDate, onPress, onWhatsApp }: Props) {
  const last = row.lastVisit ? relativeDays(row.lastVisit) : 'never visited';
  const signal = customerSignal(row);
  const canMessage = !!whatsappNumber(row.phone);

  return (
    <View style={[styles.row, selected && styles.rowSelected]}>
      <TouchableOpacity style={styles.profileTap} activeOpacity={0.78} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${row.name || 'customer'} profile, ${signal.title}`}>
        {row.avatar ? <Image source={{ uri: avatarUrl(row.id, row.avatar) }} style={styles.avatar} /> : (
          <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials(row.name)}</Text></View>
        )}
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>{row.name || 'Customer'}</Text>
          <View style={styles.signalRow}>
            <Ionicons name={signal.icon} size={13} color={colors.primary[700]} />
            <Text style={styles.signal} numberOfLines={1}>{signal.title}</Text>
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {visitDate ? `${row.visitsOnDate} visit${row.visitsOnDate === 1 ? '' : 's'} on this day` : `${row.visits} visit${row.visits === 1 ? '' : 's'} · ${last}`}
            {' · '}{formatMoney(row.spendCents)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.accent[400]} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.messageButton, !canMessage && styles.messageDisabled]} disabled={!canMessage} onPress={onWhatsApp} accessibilityRole="button" accessibilityLabel={canMessage ? `Message ${row.name || 'customer'} on WhatsApp` : `Cannot message ${row.name || 'customer'}: no usable phone number`} accessibilityState={{ disabled: !canMessage }}>
        <Ionicons name="logo-whatsapp" size={19} color={canMessage ? '#128C5E' : colors.accent[400]} />
      </TouchableOpacity>
      {!canMessage ? <Text style={styles.noPhone}>Add phone to message</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1], paddingVertical: spacing[1], paddingHorizontal: spacing[1], borderRadius: radii.lg, borderBottomWidth: 1, borderBottomColor: colors.accent[50] },
  rowSelected: { backgroundColor: colors.primary[50], borderBottomColor: 'transparent' },
  profileTap: { flex: 1, minWidth: 0, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent[100] },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.primary[700] },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: colors.black },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  signal: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: colors.primary[700] },
  meta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: colors.accent[500] },
  messageButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F6EE', alignItems: 'center', justifyContent: 'center', marginLeft: spacing[1] },
  messageDisabled: { backgroundColor: colors.accent[50] },
  noPhone: { width: '100%', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9.5, color: colors.accent[500], textAlign: 'right', paddingRight: spacing[1], marginTop: -4 },
});
