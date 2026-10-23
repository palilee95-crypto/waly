import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReceiptData } from './DigitalStampReceiptModal';
import LoyaltyCardBack from './LoyaltyCardBack';

type Props = {
  visible: boolean;
  receipt: ReceiptData | null;
  cardDesign?: {
    backgroundImage?: string;
    color: string;
    fontColor: string;
    icon: string;
    milestones: number[];
    spendPerPoint: number;
  };
  onReceipt: () => void;
  receiptBusy?: boolean;
  receiptError?: string;
  onAnother: () => void;
  onDone: () => void;
};

export default function StampIssueSuccessModal({ visible, receipt, cardDesign, onReceipt, receiptBusy = false, receiptError, onAnother, onDone }: Props) {
  const reveal = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!visible) { reveal.setValue(0); return; }
    if (reduceMotion) { reveal.setValue(1); return; }
    Animated.spring(reveal, { toValue: 1, damping: 14, stiffness: 130, useNativeDriver: true }).start();
  }, [visible, reveal, reduceMotion]);

  if (!receipt) return null;
  const pointsOnly = !!receipt.isPointsOnly;
  const goal = Math.max(1, Number(receipt.stampGoal) || 10);
  const balance = Math.max(0, Number(receipt.currentStamps) || 0);
  const earned = Math.max(0, Number(receipt.stampsEarned) || 0);
  const customer = receipt.customerName || 'Customer';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onDone}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.close} onPress={onDone} accessibilityRole="button" accessibilityLabel="Close confirmation">
            <Ionicons name="close" size={23} color="#17202B" />
          </TouchableOpacity>
          <Animated.View style={[styles.hero, { opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) }] }]}>
            <View style={[styles.confetti, { top: 7, left: 25, backgroundColor: '#FF8B3D', transform: [{ rotate: '28deg' }] }]} />
            <View style={[styles.confetti, { top: 46, right: 30, backgroundColor: '#FFC700', transform: [{ rotate: '-22deg' }] }]} />
            <View style={[styles.confetti, { bottom: 22, left: 40, backgroundColor: '#E9A400', transform: [{ rotate: '-35deg' }] }]} />
            <Ionicons name="sparkles" size={20} color="#EAB000" style={{ position: 'absolute', right: 33, top: 5 }} />
            <Ionicons name="sparkles" size={16} color="#FFC700" style={{ position: 'absolute', left: 27, bottom: 31 }} />
            <View style={styles.stampShadow}>
              <View style={styles.stampOuter}>
                <Ionicons name={pointsOnly ? 'sparkles' : 'ribbon'} size={47} color="#AA7200" />
              </View>
            </View>
          </Animated.View>
          <Text style={styles.title}>{pointsOnly ? 'Points Awarded!' : earned === 1 ? 'Stamp Issued!' : 'Stamps Issued!'}</Text>
          <Text style={styles.subtitle}>
            {pointsOnly
              ? `${Number(receipt.pointsEarned) || 0} points have been added to ${customer}'s account.`
              : `${earned} stamp${earned === 1 ? '' : 's'} added to ${customer}'s account.`}
          </Text>

          <View style={styles.cardFrame}>
            <View style={styles.progressHeading}>
              <Text style={styles.progressHeadingText}>UPDATED LOYALTY CARD</Text>
              <Text style={styles.progressCount}>{pointsOnly ? `+${Number(receipt.pointsEarned) || 0} pts` : `${balance}/${goal}`}</Text>
            </View>
            <LoyaltyCardBack
              merchantName={receipt.storeName}
              cardColor={cardDesign?.color || '#FFCC00'}
              fontColor={cardDesign?.fontColor || '#111111'}
              cardIcon={cardDesign?.icon || 'coffee'}
              backgroundImage={cardDesign?.backgroundImage}
              stamps={balance}
              goal={goal}
              points={Math.max(0, Number(receipt.currentPoints) || 0)}
              enableStamps={!pointsOnly}
              spendPerPoint={cardDesign?.spendPerPoint}
              milestones={cardDesign?.milestones}
            />
            <Text style={styles.progressFine}>
              {pointsOnly
                ? `${Math.max(0, Number(receipt.currentPoints) || 0).toLocaleString()} points available now`
                : `${earned} new stamp${earned === 1 ? '' : 's'} · ${balance} of ${goal} collected`}
            </Text>
          </View>

          {!!receipt.nextRewardName && !pointsOnly ? (
            <View style={styles.rewardCard}>
              <View style={styles.rewardIcon}><Ionicons name="gift" size={20} color="#111111" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rewardEyebrow}>YOUR NEXT REWARD</Text>
                <Text style={styles.rewardName}>{receipt.nextRewardName}</Text>
              </View>
            </View>
          ) : null}

        </ScrollView>
          <View style={styles.actions}>
            {!!receipt.receiptId && (
              <TouchableOpacity onPress={onReceipt} style={styles.lightAction} accessibilityRole="button" disabled={receiptBusy}>
                <Ionicons name="receipt-outline" size={20} color="#17202B" />
                <Text style={styles.lightActionText}>{receiptBusy ? 'Loading receipt…' : 'View / Send Receipt'}</Text>
                <Ionicons name="chevron-forward" size={18} color="#778395" />
              </TouchableOpacity>
            )}
            {!receipt.receiptId && !!receipt.id ? <Text style={styles.receiptError}>Stamp saved. Receipt is temporarily unavailable.</Text> : null}
            {receiptError ? <Text style={styles.receiptError}>{receiptError}</Text> : null}
            <TouchableOpacity onPress={onAnother} style={styles.lightAction} accessibilityRole="button">
              <Ionicons name="refresh-outline" size={20} color="#17202B" />
              <Text style={styles.lightActionText}>{pointsOnly ? 'Award More Points' : 'Issue Another Stamp'}</Text>
              <Ionicons name="chevron-forward" size={18} color="#778395" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDone} style={styles.done} accessibilityRole="button">
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20, paddingBottom: 16, alignItems: 'center' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F5F8', alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  hero: { width: 165, height: 128, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  confetti: { position: 'absolute', width: 10, height: 25, borderRadius: 3 },
  stampShadow: { width: 106, height: 106, borderRadius: 53, backgroundColor: '#FFF6D5', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-15deg' }] },
  stampOuter: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#FFCC20', borderWidth: 5, borderColor: '#FFE78F', alignItems: 'center', justifyContent: 'center', shadowColor: '#A97700', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 10, elevation: 7 },
  title: { fontSize: 27, letterSpacing: -1, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111318', textAlign: 'center' },
  subtitle: { marginTop: 8, maxWidth: 310, fontSize: 13, lineHeight: 20, fontFamily: 'PlusJakartaSans_500Medium', color: '#69778B', textAlign: 'center' },
  cardFrame: { width: '100%', marginTop: 17 },
  progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  progressHeadingText: { fontSize: 10, letterSpacing: 1, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#748196' },
  progressCount: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#101114' },
  progressFine: { marginTop: 11, fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#738095' },
  rewardCard: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, padding: 14, borderRadius: 18, backgroundColor: '#FFF6D6' },
  rewardIcon: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#FFE490', alignItems: 'center', justifyContent: 'center' },
  rewardEyebrow: { fontSize: 9, letterSpacing: 0.6, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#A36800' },
  rewardName: { marginTop: 2, fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#29313E' },
  actions: { width: '100%', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 8, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EFF1F5' },
  lightAction: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E4E8EF', borderRadius: 14, backgroundColor: '#FFFFFF' },
  lightActionText: { flex: 1, fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#1B2533' },
  receiptError: { fontSize: 11, lineHeight: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309', textAlign: 'center' },
  done: { height: 52, marginTop: 2, borderRadius: 14, backgroundColor: '#101114', alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold' },
});
