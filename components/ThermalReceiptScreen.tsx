import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { pb } from '@/lib/pocketbase';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { colors, iconSizes, shadows, spacing } from '@/theme';
import {
  PaidReceipt,
  mountPaidReceiptPrintSheet,
  preloadPaidReceiptLogo,
  receiptDate,
  receiptLines,
  receiptMerchant,
  receiptMoney,
  receiptPaymentMethod,
  receiptTransactionRef,
  savePaidReceiptPdf,
  sharePaidReceiptPdf,
} from '@/lib/paidReceipt';

type Props = {
  visible: boolean;
  receipt: PaidReceipt | null;
  mode: 'merchant' | 'customer';
  animate?: boolean;
  onClose: () => void;
};

function merchantInitials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'R';
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) || '')).toUpperCase();
}

function TornEdge() {
  const teeth = 22;
  let d = 'M0 0';
  for (let i = 0; i < teeth; i++) {
    const mid = (i + 0.5) * (100 / teeth);
    const end = (i + 1) * (100 / teeth);
    d += ` L${mid} 8 L${end} 0`;
  }
  d += ' L100 8 L0 8 Z';
  return (
    <Svg width="100%" height={8} viewBox="0 0 100 8" preserveAspectRatio="none">
      <Path d={d} fill={colors.white} />
    </Svg>
  );
}

export default function ThermalReceiptScreen({ visible, receipt, mode, animate = false, onClose }: Props) {
  const [stage, setStage] = useState<'preparing' | 'printing' | 'ready'>(animate ? 'preparing' : 'ready');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [showLinkFallback, setShowLinkFallback] = useState(false);
  const paper = useRef(new Animated.Value(animate ? -900 : 0)).current;
  const paperHeight = useRef(0);
  const animatedReceiptId = useRef<string | null>(null);
  const [reward, setReward] = useState<{ balance: number; goal: number; name: string } | null>(null);

  useEffect(() => {
    if (visible && receipt) void preloadPaidReceiptLogo(receipt);
  }, [visible, receipt?.id]);

  useEffect(() => {
    if (!visible || !receipt) return;
    // Passing the resolved card snapshot means the print sheet repaints with the
    // same dots the screen shows; older receipts have no stored balance/goal.
    return mountPaidReceiptPrintSheet(receipt, reward);
  }, [visible, receipt, reward]);

  useEffect(() => {
    setReward(null);
    if (!visible || !receipt?.transaction) return;
    if (receipt.stamps_balance != null && receipt.stamp_goal != null) return;
    let active = true;
    pb.collection('transactions')
      .getOne<any>(receipt.transaction, { expand: 'loyalty_card.program', requestKey: null })
      .then((tx) => {
        if (!active) return;
        const card = tx?.expand?.loyalty_card;
        if (!card) return;
        const program = card.expand?.program;
        setReward({
          balance: Math.max(0, Number(card.stamps_collected) || 0),
          goal: Math.max(1, Number(program?.stamp_goal) || 10),
          name: String(program?.name || ''),
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [visible, receipt?.id, receipt?.transaction, receipt?.stamps_balance, receipt?.stamp_goal]);

  useEffect(() => {
    if (!visible || !receipt) {
      return;
    }
    setNotice('');
    setShowLinkFallback(false);
    if (!animate || animatedReceiptId.current === receipt.id) {
      setStage('ready');
      paper.setValue(0);
      return;
    }
    animatedReceiptId.current = receipt.id;
    setStage('preparing');
    paper.setValue(-900);
    const start = setTimeout(() => {
      paper.setValue(-Math.max(paperHeight.current, 900));
      setStage('printing');
      Animated.timing(paper, {
        toValue: 0,
        duration: 1750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => { if (finished) setStage('ready'); });
    }, 420);
    const finish = setTimeout(() => {
      paper.setValue(0);
      setStage('ready');
    }, 420 + 1750 + 160);
    return () => {
      clearTimeout(start);
      clearTimeout(finish);
      paper.stopAnimation();
    };
  }, [visible, receipt?.id, animate]);

  if (!receipt) return null;

  const merchant = receipt.expand?.merchant;
  const logo = merchant?.logo && merchant.id ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}` : '';
  const isPaid = receipt.payment_status === 'paid';
  const webOrigin = Platform.OS === 'web' && typeof window !== 'undefined' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? window.location.origin
    : 'https://risev.app';
  const link = `${webOrigin}/b/receipt/${receipt.id}`;
  const earned = Math.max(0, Number(receipt.stamps_earned) || 0);
  const stampGoal = Math.max(1, Math.min(50, Number(reward?.goal || receipt.stamp_goal) || 10));
  const balanceValue = Number(reward?.balance ?? receipt.stamps_balance);
  const stampsBalance = Number.isFinite(balanceValue) ? Math.max(0, balanceValue) : earned;
  const filledStamps = Math.min(stampGoal, stampsBalance);
  const rewardName = String(reward?.name || receipt.reward_name || '').trim();
  const statusText = stage === 'preparing'
    ? 'Preparing your receipt…'
    : stage === 'printing'
      ? 'Printing your receipt…'
      : isPaid
        ? `Payment successful · ${receiptMoney(receipt.total_amount)}`
        : 'Your receipt is ready';

  const handlePdf = async () => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      if (mode === 'merchant') {
        const result = await sharePaidReceiptPdf(receipt, reward);
        if (result === 'downloaded') {
          setNotice('PDF downloaded. Attach it in WhatsApp, or share the receipt link below.');
          setShowLinkFallback(true);
        } else {
          setNotice('Share sheet opened. Choose WhatsApp and send the PDF there.');
        }
      } else {
        await savePaidReceiptPdf(receipt, reward);
        setNotice(Platform.OS === 'web' ? 'Receipt PDF downloaded.' : 'Choose where to save your receipt PDF.');
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') setNotice('Could not prepare the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleLink = async () => {
    const wa = buildWhatsAppLink(receipt.customer_phone, `Your receipt from ${receiptMerchant(receipt)}: ${link}`);
    if (!wa) {
      setNotice('This customer does not have a valid phone number.');
      return;
    }
    try {
      await Linking.openURL(wa);
      setNotice('WhatsApp opened with a receipt link. Please review and send it there.');
    } catch {
      setNotice('Could not open WhatsApp on this device.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Close receipt"
          >
            <Ionicons name="arrow-back" size={iconSizes.lg} color={colors.black} />
          </TouchableOpacity>
          <Image source={require('../assets/risev logo.png')} style={styles.brandLogo} resizeMode="contain" accessibilityLabel="risev" />
          <View style={styles.back} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <Text style={styles.title}>{mode === 'merchant' ? 'Customer Receipt' : 'Your Receipt'}</Text>
            <Text style={styles.subtitle}>{statusText}</Text>
          </View>

          <View style={styles.printerSlot} accessibilityElementsHidden>
            <View style={styles.printerInner} />
          </View>

          <View style={styles.paperWindow}>
            <Animated.View
              style={[styles.paper, { opacity: stage === 'preparing' ? 0 : 1, transform: [{ translateY: paper }] }]}
              onLayout={(event) => {
                paperHeight.current = event.nativeEvent.layout.height;
              }}
            >
              <View style={styles.receipt}>
                <View style={styles.merchantMark}>
                  {logo ? (
                    <Image source={{ uri: logo }} style={styles.logo} resizeMode="cover" />
                  ) : (
                    <Text style={styles.merchantInitials}>{merchantInitials(receiptMerchant(receipt))}</Text>
                  )}
                </View>
                <Text style={styles.merchantName}>{receiptMerchant(receipt)}</Text>
                <Text style={styles.merchantSubtitle}>
                  {(receipt.branch_name || 'Digital receipt').toUpperCase()}
                </Text>

                <View style={styles.rule} />

                <Detail label="Receipt no." value={receipt.receipt_number} />
                {receipt.transaction ? <Detail label="Transaction" value={receiptTransactionRef(receipt)} /> : null}
                <Detail label="Date & time" value={receiptDate(receipt)} />
                <Detail label="Customer" value={receipt.customer_name || 'Customer'} />
                {receipt.staff_name ? <Detail label="Staff" value={receipt.staff_name} /> : null}

                <View style={styles.rule} />

                {receiptLines(receipt).length === 0 ? (
                  <Text style={styles.emptyLine}>Counter payment</Text>
                ) : (
                  receiptLines(receipt).map((item, index) => (
                    <View key={`${index}-${item.name}`} style={styles.item}>
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemName}>{item.name || 'Item'}</Text>
                        <Text style={styles.itemMeta}>
                          {Number(item.qty) || 1} × {receiptMoney(item.price)}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>
                        {receiptMoney((Number(item.price) || 0) * (Number(item.qty) || 1))}
                      </Text>
                    </View>
                  ))
                )}

                <View style={styles.rule} />

                <Detail label="Subtotal" value={receiptMoney(receipt.subtotal || receipt.total_amount)} />
                {Number(receipt.discount_amount) > 0 ? (
                  <Detail label="Voucher discount" value={`−${receiptMoney(receipt.discount_amount)}`} />
                ) : null}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{isPaid ? 'Total paid' : 'Total recorded'}</Text>
                  <Text style={styles.totalAmount}>{receiptMoney(receipt.total_amount)}</Text>
                </View>

                <View style={styles.rule} />

                <Detail label={isPaid ? 'Payment method' : 'Entry method'} value={receiptPaymentMethod(receipt)} />
                {receipt.payment_reference ? <Detail label="Payment ref." value={receipt.payment_reference} /> : null}
                <View style={styles.detail}>
                  <Text style={styles.label}>{isPaid ? 'Payment status' : 'Transaction status'}</Text>
                  <View style={styles.paidLabel}>
                    <View style={[styles.paidDot, !isPaid && styles.recordedDot]}>
                      <Ionicons name={isPaid ? 'checkmark' : 'time-outline'} size={9} color={colors.black} />
                    </View>
                    <Text style={[styles.paidText, !isPaid && styles.recordedText]}>{isPaid ? 'PAID' : 'RECORDED'}</Text>
                  </View>
                </View>

                {earned > 0 ? (
                  <View style={styles.reward}>
                    <View style={styles.rewardTop}>
                      <View style={styles.rewardLabel}>
                        <Ionicons name="gift-outline" size={15} color={colors.black} />
                        <Text style={styles.rewardTitle}>Rewards earned</Text>
                      </View>
                      <Text style={styles.rewardValue}>+{earned} Stamp{earned === 1 ? '' : 's'}</Text>
                    </View>
                    <Text style={styles.rewardDetail}>
                      {earned} stamp{earned === 1 ? '' : 's'} added · {filledStamps}/{stampGoal} collected{rewardName ? ` · ${rewardName}` : ''}
                    </Text>
                    <View style={styles.stampRow}>
                      {Array.from({ length: stampGoal }).map((_, index) => (
                        <View key={index} style={[styles.stampDot, index < filledStamps && styles.stampDotEarned]} />
                      ))}
                    </View>
                  </View>
                ) : null}

                <Text style={styles.thanks}>Thank you for visiting!</Text>

                <View style={styles.barcode} accessibilityElementsHidden>
                  {Array.from({ length: 34 }).map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.bar,
                        {
                          width: index % 3 === 0 ? 2.5 : 1.5,
                          height: index % 5 === 0 ? 27 : 21,
                          marginRight: index % 4 === 0 ? 3 : 1.5,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.paperCode}>{receipt.receipt_number.replace(/-/g, '')}</Text>

                <View style={styles.powered}>
                  <Text style={styles.poweredLabel}>Powered by</Text>
                  <Image
                    source={require('../assets/risev logo.png')}
                    style={styles.poweredLogo}
                    resizeMode="contain"
                    accessibilityLabel="Risev"
                  />
                </View>
              </View>
              <TornEdge />
            </Animated.View>
          </View>

          {stage === 'preparing' ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary[400]} />
              <Text style={styles.loadingText}>Preparing…</Text>
            </View>
          ) : null}

        </ScrollView>

        {stage === 'ready' ? (
          <View style={styles.actions}>
            <View style={styles.actionsInner}>
              <TouchableOpacity style={styles.primary} onPress={handlePdf} disabled={busy} accessibilityRole="button">
                <Ionicons
                  name={mode === 'merchant' ? 'logo-whatsapp' : 'download-outline'}
                  size={iconSizes.md}
                  color={colors.white}
                />
                <Text style={styles.primaryText}>
                  {busy
                    ? 'Preparing PDF…'
                    : mode === 'merchant'
                      ? 'Send receipt PDF to customer'
                      : 'Download receipt'}
                </Text>
              </TouchableOpacity>
              {showLinkFallback && mode === 'merchant' ? (
                <TouchableOpacity style={styles.linkAction} onPress={handleLink}>
                  <Text style={styles.linkText}>Share receipt link in WhatsApp</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.secondary} onPress={onClose} accessibilityRole="button">
                <Text style={styles.secondaryText}>Done</Text>
              </TouchableOpacity>
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              {mode === 'customer' ? (
                <Text style={styles.historyNote}>This receipt is also available in your transaction history.</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
  },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  brandLogo: { width: 92, height: 26 },
  scrollView: { flex: 1 },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  intro: { alignItems: 'center', marginBottom: spacing[4] },
  title: {
    fontSize: 25,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -1,
    color: colors.black,
  },
  subtitle: {
    marginTop: spacing[1],
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[500],
  },

  printerSlot: {
    width: '100%',
    maxWidth: 300,
    height: 28,
    borderRadius: 11,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: colors.accent[700],
    paddingTop: 10,
    paddingHorizontal: 13,
    zIndex: 3,
    marginBottom: -6,
    ...shadows.sm,
  },
  printerInner: {
    height: 8,
    borderRadius: 5,
    backgroundColor: colors.black,
  },

  paperWindow: {
    width: '100%',
    maxWidth: 300,
    overflow: 'hidden',
    alignSelf: 'center',
    ...shadows.sm,
  },
  paper: {
    width: '100%',
    backgroundColor: colors.white,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.accent[100],
  },
  receipt: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
    paddingBottom: spacing[3],
    backgroundColor: colors.white,
  },

  merchantMark: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.primary[400],
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 44, height: 44 },
  merchantInitials: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -1,
    color: colors.black,
  },
  merchantName: {
    textAlign: 'center',
    marginTop: spacing[2],
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.6,
    color: colors.black,
  },
  merchantSubtitle: {
    textAlign: 'center',
    marginTop: 2,
    marginBottom: spacing[4],
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.2,
    color: colors.accent[400],
  },
  rule: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent[200],
    marginVertical: spacing[3],
  },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: 2,
  },
  label: {
    fontSize: 9.5,
    lineHeight: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[500],
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 9.5,
    lineHeight: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.black,
  },

  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[2],
    marginVertical: spacing[2],
  },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.black,
  },
  itemMeta: {
    marginTop: 3,
    fontSize: 8.8,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[400],
  },
  itemTotal: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.black,
  },
  emptyLine: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[400],
    paddingVertical: spacing[1],
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    marginTop: spacing[1],
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
  totalAmount: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -1,
    color: colors.black,
  },

  paidLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  paidDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordedDot: { backgroundColor: colors.accent[200] },
  paidText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.success.dark,
  },
  recordedText: { color: colors.accent[500] },

  reward: {
    marginTop: spacing[4],
    padding: spacing[2.5],
    borderRadius: 11,
    backgroundColor: colors.primary[400],
  },
  rewardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  rewardLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rewardTitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
  rewardValue: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.black,
  },
  rewardDetail: {
    marginTop: spacing[2],
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.black,
  },
  stampRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing[2],
  },
  stampDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.black,
  },
  stampDotEarned: { backgroundColor: colors.black },

  thanks: {
    marginTop: spacing[4],
    marginBottom: spacing[2],
    textAlign: 'center',
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.black,
  },
  barcode: {
    width: 152,
    height: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: spacing[2],
    overflow: 'hidden',
  },
  bar: { backgroundColor: colors.black, borderRadius: 1 },
  paperCode: {
    textAlign: 'center',
    marginTop: 5,
    fontSize: 8,
    letterSpacing: 0.7,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[500],
  },
  powered: {
    marginTop: spacing[3],
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  poweredLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[400],
  },
  poweredLogo: { width: 37, height: 11 },

  loading: { marginTop: spacing[4], alignItems: 'center', gap: spacing[2] },
  loadingText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[500],
  },
  actions: {
    width: '100%',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.accent[100],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  actionsInner: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    gap: spacing[2],
  },
  primary: {
    minHeight: 54,
    borderRadius: 13,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  primaryText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  secondary: {
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.accent[200],
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.black,
  },
  linkAction: { alignItems: 'center', padding: spacing[2] },
  linkText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.accent[700],
    textDecorationLine: 'underline',
  },
  notice: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[500],
  },
  historyNote: {
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.accent[400],
  },
});
