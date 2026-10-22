import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  mode: 'voucher' | 'stamps';
  onPress: () => void;
};

export default function RisevRewardBanner({ mode, onPress }: Props) {
  const isVoucher = mode === 'voucher';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={isVoucher ? 'Open voucher scanner' : 'Give stamps to a customer'}
      style={styles.banner}
    >
      <LinearGradient colors={['#FFF9DF', '#FFF0AD', '#FFC700']} locations={[0, 0.52, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.orbit} pointerEvents="none" />
      <View style={styles.copy} pointerEvents="none">
        <View style={styles.eyebrow}>
          <Ionicons name={isVoucher ? 'gift-outline' : 'ribbon-outline'} size={12} color="#855D00" />
          <Text style={styles.eyebrowText}>RISEV REWARDS</Text>
        </View>
        <Text style={styles.title}>{isVoucher ? 'Scan & Redeem Voucher' : 'Give Stamps'}</Text>
        <Text style={styles.description}>
          {isVoucher ? 'Scan a customer QR or enter a voucher code.' : 'Find a customer and make every visit count.'}
        </Text>
        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={17} color="#111111" />
        </View>
      </View>
      <View style={styles.art} pointerEvents="none">
        <Ionicons name="sparkles" size={18} color="#F4B600" style={styles.sparkleTop} />
        <Ionicons name="sparkles" size={13} color="#FFFFFF" style={styles.sparkleBottom} />
        <View style={styles.backTicket}>
          <Ionicons name={isVoucher ? 'gift' : 'star'} size={31} color="#FFFFFF" />
        </View>
        <View style={styles.frontTicket}>
          <Image source={require('../assets/risev logo.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.ticketIcon}>
            <Ionicons name={isVoucher ? 'qr-code' : 'ribbon'} size={35} color="#111111" />
          </View>
          <View style={styles.ticketRule} />
          <Text style={styles.ticketLabel}>{isVoucher ? 'REDEEM' : 'REWARD'}</Text>
        </View>
        <View style={styles.coin}>
          <Ionicons name={isVoucher ? 'flash' : 'checkmark'} size={19} color="#111111" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { height: 174, borderRadius: 22, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#FFE38F', shadowColor: '#AA7700', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 },
  orbit: { position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: 'rgba(255,255,255,0.62)', right: -60, top: -26 },
  copy: { width: '51%', paddingLeft: 18, paddingTop: 20, zIndex: 2 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  eyebrowText: { fontSize: 9, letterSpacing: 1.2, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#855D00' },
  title: { fontSize: 18, lineHeight: 21, letterSpacing: -0.7, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#101114' },
  description: { marginTop: 7, fontSize: 10.5, lineHeight: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#4E5664' },
  arrow: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  art: { position: 'absolute', right: 0, top: 0, width: '52%', height: '100%' },
  sparkleTop: { position: 'absolute', right: 21, top: 11 },
  sparkleBottom: { position: 'absolute', left: 4, bottom: 16 },
  backTicket: { position: 'absolute', width: 94, height: 115, top: 22, right: 65, borderRadius: 15, backgroundColor: '#E8A900', transform: [{ rotate: '-17deg' }], alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFD967' },
  frontTicket: { position: 'absolute', width: 98, height: 128, top: 24, right: 25, borderRadius: 15, backgroundColor: '#FFFFFF', transform: [{ rotate: '12deg' }], alignItems: 'center', paddingTop: 12, shadowColor: '#8B6400', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 7 },
  logo: { width: 43, height: 14 },
  ticketIcon: { width: 58, height: 58, marginTop: 10, borderRadius: 13, backgroundColor: '#FFF3B8', alignItems: 'center', justifyContent: 'center' },
  ticketRule: { width: 68, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#D9DEE6', marginTop: 9 },
  ticketLabel: { fontSize: 8, letterSpacing: 1.1, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#616B7A', marginTop: 4 },
  coin: { position: 'absolute', right: 5, bottom: 19, width: 35, height: 35, borderRadius: 18, backgroundColor: '#FFC700', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#8B6400', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 4 },
});
