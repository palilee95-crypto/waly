import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppointmentPassData, passStatusLabel } from '@/lib/appointmentPass';

type Props = { pass: AppointmentPassData; demo?: boolean };

const font = {
  heavy: 'PlusJakartaSans_800ExtraBold',
  bold: 'PlusJakartaSans_700Bold',
  medium: 'PlusJakartaSans_500Medium',
} as const;

export default function AppointmentTicket({ pass, demo = false }: Props) {
  const status = passStatusLabel(pass.status);
  const inactive = status === 'CANCELLED' || status === 'NO SHOW' || status === 'SLOT PASSED';
  const arrived = status === 'CHECKED IN';
  const footerTitle = inactive ? 'PASS INACTIVE' : arrived ? 'YOU’RE CHECKED IN' : status === 'COMPLETED' ? 'VISIT COMPLETE' : 'SEE YOU SOON';

  return (
    <View style={styles.ticket}>
      <View style={styles.top}>
        <Image source={require('../assets/risev logo.png')} style={styles.risevLogo} resizeMode="contain" accessibilityLabel="Risev" />
        <Text style={styles.eyebrow}>APPOINTMENT PASS</Text>
      </View>

      <View style={styles.hero}>
        {pass.merchantCoverUrl ? (
          <Image source={{ uri: pass.merchantCoverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#302400', '#141414', '#050505']} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.86)']} style={StyleSheet.absoluteFill} />
        <View style={styles.heroContent}>
          {pass.merchantLogoUrl ? <Image source={{ uri: pass.merchantLogoUrl }} style={styles.merchantLogo} resizeMode="cover" /> : null}
          <Text style={styles.merchantName} numberOfLines={2}>{pass.merchantName}</Text>
          <View style={styles.heroBottom}>
            <Text style={styles.passRef}>PASS #{pass.shortRef || 'DEMO'}</Text>
            <View style={[styles.statusPill, inactive && styles.inactivePill, arrived && styles.arrivedPill]}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.service} numberOfLines={3}>{pass.serviceText}</Text>
        <View style={styles.metaLine}>
          <Ionicons name="calendar-outline" size={17} color="#111111" />
          <Text style={styles.metaValue}>{pass.bookingDate} · {pass.startTime}</Text>
        </View>
        <View style={styles.rule} />
        <View style={styles.detailRow}>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>LOCATION</Text>
            <Text style={styles.detailValue} numberOfLines={2}>{pass.branchName}</Text>
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>TOTAL</Text>
            <Text style={styles.detailValue}>RM{Number(pass.total || 0).toFixed(2)}</Text>
          </View>
        </View>
        {pass.staffName && pass.staffName !== 'Any Available' && pass.staffName !== 'Any Provider' ? (
          <View style={styles.providerRow}>
            <Ionicons name="person-outline" size={17} color="#111111" />
            <Text style={styles.providerText}>{pass.staffName}</Text>
          </View>
        ) : null}
        {pass.customerName ? <Text style={styles.customerText}>Booked for {pass.customerName}</Text> : null}
      </View>

      <View style={styles.perforation}>
        <View style={styles.leftNotch} /><View style={styles.dash} /><View style={styles.rightNotch} />
      </View>
      <View style={styles.qrSection}>
        {demo || !pass.qrUrl ? (
          <View style={styles.qrPlaceholder}><Ionicons name="qr-code-outline" size={52} color="#A6ADBA" /><Text style={styles.qrHint}>{demo ? 'Demo pass · QR unavailable' : 'QR unavailable'}</Text></View>
        ) : (
          <Image source={{ uri: pass.qrUrl }} style={styles.qr} resizeMode="contain" accessibilityLabel="Appointment check-in QR code" />
        )}
        <Text style={styles.qrCaption}>SHOW THIS CODE AT THE COUNTER</Text>
      </View>
      <View style={styles.footer}>
        <Ionicons name={arrived ? 'checkmark-circle' : inactive ? 'close-circle' : 'sparkles'} size={19} color="#FFC700" />
        <Text style={styles.footerTitle}>{footerTitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: '#E7E7E7' },
  top: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, gap: 9 },
  risevLogo: { width: 83, height: 29 },
  eyebrow: { fontFamily: font.bold, letterSpacing: 3.2, color: '#667085', fontSize: 10 },
  hero: { height: 148, backgroundColor: '#141414', overflow: 'hidden' },
  heroContent: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 19, paddingBottom: 15 },
  merchantLogo: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFC700', marginBottom: 5 },
  merchantName: { fontFamily: font.heavy, color: '#FFFFFF', fontSize: 21, lineHeight: 25 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  passRef: { color: '#E4E4E7', fontFamily: font.bold, fontSize: 9, letterSpacing: 1.4 },
  statusPill: { backgroundColor: '#FFC700', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  inactivePill: { backgroundColor: '#FECACA' },
  arrivedPill: { backgroundColor: '#BBF7D0' },
  statusText: { color: '#111111', fontFamily: font.heavy, fontSize: 9, letterSpacing: 0.5 },
  details: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  service: { fontFamily: font.heavy, color: '#111111', fontSize: 22, lineHeight: 27, marginBottom: 10 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaValue: { fontFamily: font.bold, fontSize: 13, color: '#30343B', flexShrink: 1 },
  rule: { height: 1, backgroundColor: '#E6E8EC', marginVertical: 14 },
  detailRow: { flexDirection: 'row', gap: 12 },
  detailBlock: { flex: 1 },
  detailLabel: { fontFamily: font.bold, color: '#818A9B', letterSpacing: 1, fontSize: 9, marginBottom: 5 },
  detailValue: { fontFamily: font.bold, color: '#111111', fontSize: 12.5, lineHeight: 17 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 },
  providerText: { fontFamily: font.bold, color: '#30343B', fontSize: 12 },
  customerText: { fontFamily: font.medium, color: '#667085', fontSize: 11, marginTop: 11 },
  perforation: { flexDirection: 'row', alignItems: 'center', height: 16 },
  leftNotch: { width: 13, height: 26, borderTopRightRadius: 13, borderBottomRightRadius: 13, backgroundColor: '#111111', marginLeft: -1 },
  rightNotch: { width: 13, height: 26, borderTopLeftRadius: 13, borderBottomLeftRadius: 13, backgroundColor: '#111111', marginRight: -1 },
  dash: { flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#CBD0D9', marginHorizontal: 5 },
  qrSection: { alignItems: 'center', paddingTop: 7, paddingBottom: 18 },
  qr: { width: 150, height: 150 },
  qrPlaceholder: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  qrHint: { fontFamily: font.medium, color: '#818A9B', fontSize: 10, marginTop: 8 },
  qrCaption: { fontFamily: font.bold, letterSpacing: 1.1, color: '#667085', fontSize: 9, marginTop: 5 },
  footer: { height: 51, backgroundColor: '#111111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  footerTitle: { color: '#FFC700', fontFamily: font.heavy, letterSpacing: 1.8, fontSize: 11 },
});
