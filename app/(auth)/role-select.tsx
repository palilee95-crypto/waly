import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, radii } from '@/theme';

type RoleOption = {
  id: 'customer' | 'merchant';
  emoji: string;
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  features: string[];
};

const roles: RoleOption[] = [
  {
    id: 'customer',
    emoji: '🛍️',
    title: 'Saya Pelanggan',
    subtitle: 'Kumpul stamp & point, tebus reward dari kedai-kedai kegemaran saya.',
    tag: 'Popular',
    tagColor: '#5C3BCC',
    tagBg: '#F0EBFF',
    features: [
      'Kumpul stamp & point automatik',
      'Tukar reward & voucher',
      'Referral bonus untuk kawan',
      'Notifikasi WhatsApp & Push',
    ],
  },
  {
    id: 'merchant',
    emoji: '🏪',
    title: 'Saya Peniaga',
    subtitle: 'Bina program loyalty dan tarik pelanggan setia untuk bisnes saya.',
    tag: 'Bisnes',
    tagColor: '#D97706',
    tagBg: '#FEF3C7',
    features: [
      'Beri stamp & point kepada pelanggan',
      'Dashboard & analitik jualan',
      'Campaign marketing & voucher',
      'Profil pelanggan & health score',
    ],
  },
];

export default function RoleSelectScreen() {
  const router = useRouter();
  const { setUserRole, user } = useAuth();
  const [selected, setSelected] = useState<'customer' | 'merchant' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;
    setIsLoading(true);
    try {
      await setUserRole(selected);
    } catch {}
    if (selected === 'merchant') {
      router.replace('/(merchant)');
    } else {
      router.replace('/(customer)');
    }
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Selamat Datang{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
          </Text>
          <Text style={styles.title}>Kamu Guna RISEV Sebagai?</Text>
          <Text style={styles.subtitle}>
            Pilih peranan utama kamu. Kamu boleh menukar peranan pada bila-bila masa.
          </Text>
        </View>

        {/* Role cards */}
        <View style={styles.cards}>
          {roles.map((role) => {
            const isSelected = selected === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(role.id)}
                activeOpacity={0.85}
              >
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <View style={styles.emojiWrap}>
                      <Text style={styles.emoji}>{role.emoji}</Text>
                    </View>
                    <View>
                      <View style={[styles.tag, { backgroundColor: role.tagBg }]}>
                        <Text style={[styles.tagText, { color: role.tagColor }]}>{role.tag}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Radio */}
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </View>

                <Text style={styles.cardTitle}>{role.title}</Text>
                <Text style={styles.cardSubtitle}>{role.subtitle}</Text>

                {/* Divider */}
                <View style={styles.cardDivider} />

                {/* Features */}
                <View style={styles.features}>
                  {role.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                        <Text style={[styles.checkMark, isSelected && styles.checkMarkActive]}>✓</Text>
                      </View>
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dual role note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteEmoji}>💡</Text>
          <Text style={styles.noteText}>
            Ada kedai sendiri? Kamu boleh guna kedua-dua mode Customer dan Merchant dalam satu akaun.
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.btn, !selected && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!selected || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              Teruskan sebagai {selected === 'merchant' ? 'Peniaga' : selected === 'customer' ? 'Pelanggan' : '...'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 24,
  },
  header: { gap: 8 },
  greeting: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.accent.DEFAULT,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#111827',
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#6B7280',
    lineHeight: 22,
  },
  cards: { gap: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  cardSelected: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: '#FAFBFF',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emojiWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emoji: { fontSize: 26 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  tagText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.3,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary.DEFAULT },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.DEFAULT,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  features: { gap: 8 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: '#DCFCE7',
  },
  checkMark: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9CA3AF',
  },
  checkMarkActive: {
    color: '#16A34A',
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#374151',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0EBFF',
    borderRadius: radii.lg,
    padding: 14,
    gap: 10,
  },
  noteEmoji: { fontSize: 16, marginTop: 1 },
  noteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#4A2EA8',
    lineHeight: 20,
  },
  btn: {
    height: 54,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { backgroundColor: '#C4B5FD' },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
