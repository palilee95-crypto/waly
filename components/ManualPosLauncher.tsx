import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, DeviceEventEmitter, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import { normalizeManualPosPhone } from '@/lib/manualPosPhone';
export default function ManualPosLauncher() {
  const { user } = useAuth(); const { locale } = useLanguage(); const ms = locale === 'ms';
  const [open, setOpen] = useState(false); const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false); const busyRef = useRef(false); const [error, setError] = useState('');
  const queued = useRef<any>(null);
  const launch = () => { const claim = queued.current; queued.current = null; if (claim) DeviceEventEmitter.emit('OPEN_NFC_CLAIM', { ...claim, manual_pos: true }); };
  useEffect(() => { const sub = DeviceEventEmitter.addListener('OPEN_MANUAL_POS', () => { if (busyRef.current) return; setPhone(''); setError(''); setOpen(true); }); return () => sub.remove(); }, []);
  const normalized = normalizeManualPosPhone(phone);
  const proceed = async () => {
    if (busyRef.current) return;
    if (!normalized || !user?.merchant_id) { setError(ms ? 'Masukkan nombor telefon Malaysia yang sah.' : 'Enter a valid Malaysian mobile number.'); return; }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const response = await pb.send('/api/risev/nfc/request', { method: 'POST', body: { merchant_id: user.merchant_id, phone: normalized, branch_id: user.branch || '', branch_name: user.branch_name || '', manual_pos: true } });
      if (!response.success || !response.claim_id) throw new Error('Unable to start sale');
      const claim = await pb.collection('nfc_claims').getOne(response.claim_id);
      if (normalizeManualPosPhone(claim.customer_phone) !== normalized || claim.merchant !== user.merchant_id || claim.status !== 'pending' || claim.manual_pos !== true) throw new Error('Customer request could not be verified');
      queued.current = claim; setOpen(false);
      if (Platform.OS !== 'ios') launch();
    } catch (err: any) { setError(err?.message || (ms ? 'Tidak dapat membuka POS. Cuba lagi.' : 'Unable to open POS. Please try again.')); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <Modal visible={open} transparent animationType="fade" onDismiss={launch} onRequestClose={() => { if (!busy) setOpen(false); }}><KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.card}>
    <View style={s.row}><Text style={s.title}>POS System</Text><TouchableOpacity accessibilityLabel="Close" disabled={busy} style={s.close} onPress={() => setOpen(false)}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity></View>
    <Text style={s.description}>{ms ? 'Masukkan nombor telefon pelanggan untuk memulakan jualan manual.' : 'Enter the customer’s phone number to start a manual sale.'}</Text>
    <Text style={s.label}>{ms ? 'Nombor telefon pelanggan' : 'Customer phone number'} *</Text>
    <TextInput accessibilityLabel="Customer phone number" autoFocus keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={value => { setPhone(value); setError(''); }} placeholder="01X XXX XXXX" editable={!busy} style={s.input} onSubmitEditing={proceed} />
    <Text style={s.description}>{ms ? 'Format: 01… atau +601…' : 'Format: 01… or +601…'}</Text>
    {!!error && <Text accessibilityLiveRegion="polite" style={{ color: '#DC2626', fontSize: 12 }}>{error}</Text>}
    <TouchableOpacity accessibilityRole="button" disabled={!normalized || busy} onPress={proceed} style={[s.button, (!normalized || busy) && { opacity: 0.45 }]}>{busy ? <ActivityIndicator color="#000000" /> : <Text style={s.label}>{ms ? 'Buka POS' : 'Open POS'} →</Text>}</TouchableOpacity>
  </View></KeyboardAvoidingView></Modal>;
}
const s=StyleSheet.create({overlay:{flex:1,backgroundColor:'rgba(15,23,42,0.4)',justifyContent:'center',padding:20,alignItems:'center'},card:{width:'100%',maxWidth:420,padding:20,borderRadius:24,backgroundColor:'#FFFFFF',gap:12},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontSize:20,fontFamily:'PlusJakartaSans_800ExtraBold',color:'#0F172A'},description:{fontSize:12,lineHeight:18,color:'#64748B',fontFamily:'PlusJakartaSans_500Medium'},label:{fontSize:14,fontFamily:'PlusJakartaSans_700Bold',color:'#0F172A'},input:{height:50,borderWidth:1,borderColor:'#CBD5E1',borderRadius:12,paddingHorizontal:12,fontSize:16},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},button:{minHeight:50,backgroundColor:'#FFCC00',borderRadius:14,justifyContent:'center',alignItems:'center'}});
