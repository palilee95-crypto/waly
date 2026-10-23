import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppointmentPassData, passCopy, passStatusLabel, passStatusTone } from '@/lib/appointmentPass';

type Props = {
  pass: AppointmentPassData;
  demo?: boolean;
  /**
   * Colour behind the card. The perforation cut-outs are punched with it, so it
   * must match whatever the sheet sits on (defaults to the dark overlay).
   */
  surfaceColor?: string;
};

const font = {
  heavy: 'PlusJakartaSans_800ExtraBold',
  bold: 'PlusJakartaSans_700Bold',
  medium: 'PlusJakartaSans_500Medium',
} as const;

const RADIUS = 22;

export default function AppointmentTicket({ pass, demo = false, surfaceColor = '#0B0D10' }: Props) {
  const copy = passCopy(pass.locale);
  const status = passStatusLabel(pass.status, pass.locale);
  const tone = passStatusTone(pass.status);
  const inactive = tone === 'negative';
  const arrived = pass.status === 'arrived' || pass.status === 'in_service';
  const footerTitle = pass.status === 'completed'
    ? copy.visitComplete
    : inactive ? copy.inactive : arrived ? copy.youAreIn : copy.soon;

  return (
    <View style={styles.shell}>
      {/* Split around the perforation: each half clips its own corners and the
          cut-outs live in the unclipped band between them, so they keep their
          full circle instead of being cropped by overflow. */}
      <View style={styles.cardTop}>
        <View style={styles.top}>
          <Image source={require('../assets/risev logo.png')} style={styles.risevLogo} resizeMode="contain" accessibilityLabel="Risev" />
          <Text style={styles.eyebrow}>{copy.pass}</Text>
        </View>

        <View style={styles.hero}>
          {pass.merchantCoverUrl ? (
            <Image source={{ uri: pass.merchantCoverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#2B2415', '#121214', '#060607']} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.82)']} style={StyleSheet.absoluteFill} />
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
            <Ionicons name="calendar-outline" size={16} color="#6B7484" />
            <Text style={styles.metaValue}>{pass.bookingDate} · {pass.startTime}</Text>
          </View>
          <View style={styles.rule} />
          <View style={styles.detailRow}>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>{copy.location}</Text>
              <Text style={styles.detailValue} numberOfLines={2}>{pass.branchName}</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>{copy.total}</Text>
              <Text style={styles.detailValue}>RM{Number(pass.total || 0).toFixed(2)}</Text>
            </View>
          </View>
          {pass.staffName && pass.staffName !== 'Any Available' && pass.staffName !== 'Any Provider' ? (
            <View style={styles.providerRow}>
              <Ionicons name="person-outline" size={15} color="#6B7484" />
              <Text style={styles.providerText}>{copy.provider}: {pass.staffName}</Text>
            </View>
          ) : null}
          {pass.customerName ? <Text style={styles.customerText}>{copy.bookedFor} {pass.customerName}</Text> : null}
        </View>
      </View>

      <View style={styles.perforation}>
        <View style={styles.dash} />
        <View pointerEvents="none" style={[styles.cutout, styles.cutoutLeft, { backgroundColor: surfaceColor }]} />
        <View pointerEvents="none" style={[styles.cutout, styles.cutoutRight, { backgroundColor: surfaceColor }]} />
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.qrSection}>
          {demo || !pass.qrUrl ? (
            <View style={styles.qrPlaceholder}><Ionicons name="qr-code-outline" size={50} color="#B4BAC6" /><Text style={styles.qrHint}>{copy.qrUnavailable}</Text></View>
          ) : (
            <Image source={{ uri: pass.qrUrl }} style={styles.qr} resizeMode="contain" accessibilityLabel="Appointment check-in QR code" />
          )}
          <Text style={styles.qrCaption}>{copy.show}</Text>
        </View>
        <View style={styles.footer}>
          <Ionicons name={arrived ? 'checkmark-circle' : inactive ? 'close-circle' : 'sparkles'} size={17} color="#FFC700" />
          <Text style={styles.footerTitle}>{footerTitle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { width: '100%', position: 'relative' },
  cardTop: { backgroundColor: '#FFFFFF', borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, overflow: 'hidden' },
  cardBottom: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: RADIUS, borderBottomRightRadius: RADIUS, overflow: 'hidden' },

  top: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, gap: 7 },
  risevLogo: { width: 80, height: 27 },
  eyebrow: { fontFamily: font.bold, letterSpacing: 3, color: '#8A94A6', fontSize: 9 },

  hero: { height: 144, backgroundColor: '#111214', overflow: 'hidden' },
  heroContent: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 14 },
  merchantLogo: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FFC700', marginBottom: 6 },
  merchantName: { fontFamily: font.heavy, color: '#FFFFFF', fontSize: 20, lineHeight: 24, letterSpacing: -0.2 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  passRef: { color: '#E7E9EE', fontFamily: font.bold, fontSize: 8.5, letterSpacing: 1.6 },
  statusPill: { backgroundColor: '#FFC700', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  inactivePill: { backgroundColor: '#FECACA' },
  arrivedPill: { backgroundColor: '#BBF7D0' },
  statusText: { color: '#111111', fontFamily: font.heavy, fontSize: 9, letterSpacing: 0.4 },

  details: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  service: { fontFamily: font.heavy, color: '#0E1014', fontSize: 21, lineHeight: 26, letterSpacing: -0.3, marginBottom: 10 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaValue: { fontFamily: font.bold, fontSize: 12.5, color: '#3A3F47', flexShrink: 1 },
  rule: { height: 1, backgroundColor: '#EFF1F4', marginVertical: 14 },
  detailRow: { flexDirection: 'row', gap: 12 },
  detailBlock: { flex: 1 },
  detailLabel: { fontFamily: font.bold, color: '#98A1AF', letterSpacing: 1.2, fontSize: 8.5, marginBottom: 4 },
  detailValue: { fontFamily: font.bold, color: '#0E1014', fontSize: 12.5, lineHeight: 17 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  providerText: { fontFamily: font.bold, color: '#3A3F47', fontSize: 12 },
  customerText: { fontFamily: font.medium, color: '#7A8494', fontSize: 10.5, marginTop: 8 },

  perforation: { height: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', position: 'relative', zIndex: 1 },
  dash: { height: 1, marginHorizontal: 20, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#D9DDE4' },
  cutout: { position: 'absolute', top: -2, width: 22, height: 22, borderRadius: 11 },
  cutoutLeft: { left: -11 },
  cutoutRight: { right: -11 },

  qrSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  qr: { width: 148, height: 148 },
  qrPlaceholder: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  qrHint: { fontFamily: font.medium, color: '#98A1AF', fontSize: 10, marginTop: 8 },
  qrCaption: { fontFamily: font.bold, letterSpacing: 1.2, color: '#7A8494', fontSize: 8.5, marginTop: 6 },

  footer: { height: 46, backgroundColor: '#111111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerTitle: { color: '#FFC700', fontFamily: font.heavy, letterSpacing: 1.7, fontSize: 10.5 },
});
