import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pb } from '@/lib/pocketbase';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { PaidReceipt, receiptDate, receiptLines, receiptMerchant, receiptMoney, receiptPaymentMethod, savePaidReceiptPdf, sharePaidReceiptPdf } from '@/lib/paidReceipt';

type Props = { visible: boolean; receipt: PaidReceipt | null; mode: 'merchant' | 'customer'; animate?: boolean; onClose: () => void };

export default function ThermalReceiptScreen({ visible, receipt, mode, animate = false, onClose }: Props) {
  const [stage, setStage] = useState<'preparing' | 'printing' | 'ready'>(animate ? 'preparing' : 'ready');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [showLinkFallback, setShowLinkFallback] = useState(false);
  const paper = useRef(new Animated.Value(animate ? -280 : 0)).current;

  useEffect(() => {
    if (!visible || !receipt) return;
    setNotice(''); setShowLinkFallback(false);
    if (!animate) { setStage('ready'); paper.setValue(0); return; }
    setStage('preparing'); paper.setValue(-280);
    const start = setTimeout(() => {
      setStage('printing');
      Animated.timing(paper, { toValue: 0, duration: 1650, useNativeDriver: true }).start(() => setStage('ready'));
    }, 600);
    return () => { clearTimeout(start); paper.stopAnimation(); };
  }, [visible, receipt?.id, animate]);

  if (!receipt) return null;
  const merchant = receipt.expand?.merchant;
  const logo = merchant?.logo && merchant.id ? `${pb.baseUrl}/api/files/merchants/${merchant.id}/${merchant.logo}` : '';
  const isPaid = receipt.payment_status === 'paid';
  const link = Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/b/receipt/${receipt.id}`
    : `https://risev.app/b/receipt/${receipt.id}`;

  const handlePdf = async () => {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      if (mode === 'merchant') {
        const result = await sharePaidReceiptPdf(receipt);
        if (result === 'downloaded') {
          setNotice('PDF downloaded. Attach it in WhatsApp, or share the receipt link below.');
          setShowLinkFallback(true);
        } else {
          setNotice('Share sheet opened. Choose WhatsApp and send the PDF there.');
        }
      } else {
        await savePaidReceiptPdf(receipt);
        setNotice(Platform.OS === 'web' ? 'Receipt PDF downloaded.' : 'Choose where to save your receipt PDF.');
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') setNotice('Could not prepare the PDF. Please try again.');
    } finally { setBusy(false); }
  };

  const handleLink = async () => {
    const wa = buildWhatsAppLink(receipt.customer_phone, `Your receipt from ${receiptMerchant(receipt)}: ${link}`);
    if (!wa) { setNotice('This customer does not have a valid phone number.'); return; }
    try { await Linking.openURL(wa); setNotice('WhatsApp opened with a receipt link. Please review and send it there.'); }
    catch { setNotice('Could not open WhatsApp on this device.'); }
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.back} accessibilityRole="button" accessibilityLabel="Close receipt"><Ionicons name="arrow-back" size={22} color="#111" /></TouchableOpacity>
        <Text style={styles.brand}>risev</Text><View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{stage === 'ready' ? (isPaid ? 'Payment recorded' : 'Your receipt') : 'Your receipt'}</Text>
        <Text style={styles.subtitle}>{stage === 'preparing' ? 'Preparing your receipt…' : stage === 'printing' ? 'Almost ready…' : 'Your receipt is ready'}</Text>
        {stage !== 'ready' && <View style={styles.printerSlot}><View style={styles.printerInner} /></View>}
        <Animated.View style={[styles.paper, stage !== 'ready' && { transform: [{ translateY: paper }] }]}>
          <View style={styles.paperTop} />
          <View style={styles.paperContent}>
            <View style={styles.merchantMark}>{logo ? <Image source={{ uri: logo }} style={styles.logo} resizeMode="cover" /> : <Text style={styles.merchantInitial}>{receiptMerchant(receipt).slice(0, 1).toUpperCase()}</Text>}</View>
            <Text style={styles.merchantName}>{receiptMerchant(receipt)}</Text>
            {!!receipt.branch_name && <Text style={styles.merchantBranch}>{receipt.branch_name}</Text>}
            <View style={styles.rule} />
            <Detail label="Receipt no." value={receipt.receipt_number} />
            {!!receipt.transaction && <Detail label="Transaction" value={receipt.transaction.toUpperCase()} />}
            <Detail label="Date" value={receiptDate(receipt)} />
            <Detail label="Customer" value={receipt.customer_name || 'Customer'} />
            {!!receipt.staff_name && <Detail label="Staff" value={receipt.staff_name} />}
            <View style={styles.rule} />
            {receiptLines(receipt).map((item, index) => <View key={`${index}-${item.name}`} style={styles.item}>
              <View style={{ flex: 1 }}><Text style={styles.itemName}>{item.name || 'Item'}</Text><Text style={styles.itemQty}>{Number(item.qty) || 1} × {receiptMoney(item.price)}</Text></View>
              <Text style={styles.itemPrice}>{receiptMoney((Number(item.price) || 0) * (Number(item.qty) || 1))}</Text>
            </View>)}
            <View style={styles.rule} />
            <Detail label="Subtotal" value={receiptMoney(receipt.subtotal || receipt.total_amount)} />
            {Number(receipt.discount_amount) > 0 && <Detail label="Voucher discount" value={`−${receiptMoney(receipt.discount_amount)}`} />}
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Total paid</Text><Text style={styles.totalAmount}>{receiptMoney(receipt.total_amount)}</Text></View>
            <View style={styles.rule} />
            <Detail label="Payment method" value={receiptPaymentMethod(receipt)} />
            {!!receipt.payment_reference && <Detail label="Payment ref." value={receipt.payment_reference} />}
            <View style={styles.detail}><Text style={styles.detailLabel}>Payment status</Text><Text style={isPaid ? styles.paid : styles.detailValue}>{isPaid ? '● PAID' : 'Recorded'}</Text></View>
            {Number(receipt.stamps_earned) > 0 && <View style={styles.reward}><Ionicons name="gift-outline" size={20} color="#111" /><Text style={styles.rewardText}>Rewards earned</Text><Text style={styles.rewardValue}>+{receipt.stamps_earned} stamp{Number(receipt.stamps_earned) === 1 ? '' : 's'}</Text></View>}
            <Text style={styles.thanks}>Thank you for visiting!</Text><Text style={styles.powered}>Powered by <Text style={styles.poweredBrand}>risev</Text></Text>
          </View><View style={styles.paperBottom} />
        </Animated.View>
        {stage === 'preparing' && <View style={styles.loading}><ActivityIndicator color="#FFCC00" /><Text style={styles.loadingText}>Preparing…</Text></View>}
        {stage === 'ready' && <View style={styles.actions}>
          <TouchableOpacity style={styles.primary} onPress={handlePdf} disabled={busy} accessibilityRole="button"><Ionicons name={mode === 'merchant' ? 'logo-whatsapp' : 'download-outline'} size={19} color="#fff" /><Text style={styles.primaryText}>{busy ? 'Preparing PDF…' : mode === 'merchant' ? 'Share PDF to WhatsApp' : 'Download PDF receipt'}</Text></TouchableOpacity>
          {showLinkFallback && mode === 'merchant' && <TouchableOpacity style={styles.linkAction} onPress={handleLink}><Text style={styles.linkText}>Share receipt link in WhatsApp</Text></TouchableOpacity>}
          <TouchableOpacity style={styles.secondary} onPress={onClose} accessibilityRole="button"><Text style={styles.secondaryText}>Done</Text></TouchableOpacity>
          {!!notice && <Text style={styles.notice}>{notice}</Text>}
          {mode === 'customer' && <Text style={styles.historyNote}>This receipt is also available in your transaction history.</Text>}
        </View>}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }, back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, brand: { fontSize: 24, fontWeight: '900', letterSpacing: -1.5, color: '#050505' },
  scroll: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 26, paddingBottom: 38 }, title: { fontSize: 27, fontWeight: '800', color: '#080808', letterSpacing: -.8 }, subtitle: { fontSize: 14, color: '#666', marginTop: 6, marginBottom: 25 },
  printerSlot: { width: 250, height: 27, backgroundColor: '#151515', borderRadius: 15, padding: 7, zIndex: 2, marginBottom: -3, shadowColor: '#000', shadowOpacity: .2, shadowRadius: 6 }, printerInner: { flex: 1, backgroundColor: '#050505', borderRadius: 8 },
  paper: { width: '100%', maxWidth: 360, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: .13, shadowRadius: 15, elevation: 5, overflow: 'hidden' }, paperTop: { height: 7, backgroundColor: '#f3f3f3' }, paperBottom: { height: 8, backgroundColor: '#efefef' }, paperContent: { padding: 23, paddingTop: 22 },
  merchantMark: { width: 48, height: 48, backgroundColor: '#FFCC00', borderRadius: 10, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, logo: { width: 48, height: 48 }, merchantInitial: { fontSize: 24, fontWeight: '900' }, merchantName: { textAlign: 'center', fontSize: 17, fontWeight: '800', color: '#111', marginTop: 9 }, merchantBranch: { textAlign: 'center', color: '#666', marginTop: 3, fontSize: 11 }, rule: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#bbb', marginVertical: 15 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 3 }, detailLabel: { fontSize: 12, color: '#696969' }, detailValue: { fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 1, color: '#111' }, item: { flexDirection: 'row', gap: 12, marginVertical: 6 }, itemName: { fontSize: 12, fontWeight: '700', color: '#111' }, itemQty: { fontSize: 11, color: '#777', marginTop: 3 }, itemPrice: { fontSize: 12, fontWeight: '700', color: '#111' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, totalLabel: { fontSize: 17, fontWeight: '800' }, totalAmount: { fontSize: 18, fontWeight: '900' }, paid: { fontSize: 12, fontWeight: '800', color: '#148042' }, reward: { backgroundColor: '#FFE77B', padding: 12, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 }, rewardText: { flex: 1, fontSize: 11, fontWeight: '700' }, rewardValue: { fontSize: 12, fontWeight: '800' }, thanks: { textAlign: 'center', fontSize: 12, fontWeight: '700', marginTop: 24 }, powered: { textAlign: 'center', color: '#777', fontSize: 11, marginTop: 22 }, poweredBrand: { color: '#111', fontWeight: '900' },
  loading: { marginTop: 22, alignItems: 'center', gap: 8 }, loadingText: { color: '#666', fontSize: 12 }, actions: { width: '100%', maxWidth: 360, marginTop: 24, gap: 10 }, primary: { backgroundColor: '#080808', minHeight: 54, borderRadius: 13, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 }, secondary: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' }, secondaryText: { fontWeight: '700', color: '#111' }, linkAction: { alignItems: 'center', padding: 10 }, linkText: { fontWeight: '700', color: '#303030', textDecorationLine: 'underline' }, notice: { textAlign: 'center', fontSize: 12, color: '#5d6470' }, historyNote: { textAlign: 'center', fontSize: 11, color: '#888' },
});
