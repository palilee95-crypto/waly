import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Switch, ActivityIndicator, Modal, Alert as RNAlert, Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';

type Props = {
  styles: any;
  Alert: any;
};

export default function SmartFollowUp({ styles: s, Alert }: Props) {
  const { user } = useAuth();

  const [smartGroups, setSmartGroups] = useState<any[]>([]);
  const [loadingSmartGroups, setLoadingSmartGroups] = useState(false);
  const [showSmartWizard, setShowSmartWizard] = useState(false);
  const [smartWizardStep, setSmartWizardStep] = useState(1);
  const [smartGroupName, setSmartGroupName] = useState('');
  const [smartArchiveAfter, setSmartArchiveAfter] = useState(false);
  const [smartActive, setSmartActive] = useState(true);
  const [smartInterval, setSmartInterval] = useState('5');
  const [smartSequences, setSmartSequences] = useState<any[]>([]);
  const [editingSeqIndex, setEditingSeqIndex] = useState<number | null>(null);
  const [showSeqModal, setShowSeqModal] = useState(false);
  const [seqTitle, setSeqTitle] = useState('');
  const [seqStatus, setSeqStatus] = useState('active');
  const [seqDays, setSeqDays] = useState('0');
  const [seqHours, setSeqHours] = useState('0');
  const [seqMinutes, setSeqMinutes] = useState('0');
  const [seqConvType, setSeqConvType] = useState('last_sequence');
  const [seqMessages, setSeqMessages] = useState<any[]>([]);
  const [editingMsgIndex, setEditingMsgIndex] = useState<number | null>(null);
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgBody, setMsgBody] = useState('');
  const [msgButtons, setMsgButtons] = useState<any[]>([]);
  const [smartMembers, setSmartMembers] = useState<any[]>([]);
  const [memberMethod, setMemberMethod] = useState<'all' | 'customer' | 'phone'>('all');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [isSavingSmart, setIsSavingSmart] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchSmartGroups();
  }, [user]);

  const fetchSmartGroups = async () => {
    if (!user || !user.merchant_id) return;
    try {
      setLoadingSmartGroups(true);
      const records = await pb.collection('follow_up_groups').getFullList({
        filter: `merchant = '${user.merchant_id}'`,
        sort: '-created',
      });
      setSmartGroups(records);
    } catch (err) {
      console.warn('Failed to fetch smart follow up groups:', err);
    } finally {
      setLoadingSmartGroups(false);
    }
  };

  const resetSmartWizard = () => {
    setSmartGroupName('');
    setSmartArchiveAfter(false);
    setSmartActive(true);
    setSmartInterval('5');
    setSmartSequences([]);
    setSmartMembers([]);
    setSmartWizardStep(1);
    setShowSmartWizard(false);
  };

  const openSeqModal = (index: number | null) => {
    if (index !== null) {
      const seq = smartSequences[index];
      setSeqTitle(seq.title);
      setSeqStatus(seq.status);
      setSeqDays(String(seq.send_after_days));
      setSeqHours(String(seq.send_after_hours));
      setSeqMinutes(String(seq.send_after_minutes));
      setSeqConvType(seq.conversation_type);
      setSeqMessages(seq.messages || []);
      setEditingSeqIndex(index);
    } else {
      setSeqTitle('');
      setSeqStatus('active');
      setSeqDays('0');
      setSeqHours('0');
      setSeqMinutes('0');
      setSeqConvType('last_sequence');
      setSeqMessages([]);
      setEditingSeqIndex(null);
    }
    setShowSeqModal(true);
  };

  const saveSequence = () => {
    if (!seqTitle.trim()) return;
    const seq = {
      title: seqTitle.trim(),
      status: seqStatus,
      send_after_days: parseInt(seqDays, 10) || 0,
      send_after_hours: parseInt(seqHours, 10) || 0,
      send_after_minutes: parseInt(seqMinutes, 10) || 0,
      conversation_type: seqConvType,
      messages: seqMessages,
    };
    if (editingSeqIndex !== null) {
      const updated = [...smartSequences];
      updated[editingSeqIndex] = seq;
      setSmartSequences(updated);
    } else {
      setSmartSequences([...smartSequences, seq]);
    }
    setShowSeqModal(false);
  };

  const removeSequence = (index: number) => {
    setSmartSequences(smartSequences.filter((_, i) => i !== index));
  };

  const openMsgModal = (index: number | null) => {
    if (index !== null) {
      const msg = seqMessages[index];
      setMsgBody(msg.message_body);
      setMsgButtons(msg.action_buttons || []);
      setEditingMsgIndex(index);
    } else {
      setMsgBody('');
      setMsgButtons([]);
      setEditingMsgIndex(null);
    }
    setShowMsgModal(true);
  };

  const saveMessage = () => {
    if (!msgBody.trim()) return;
    const msg = { message_body: msgBody.trim(), action_buttons: msgButtons };
    if (editingMsgIndex !== null) {
      const updated = [...seqMessages];
      updated[editingMsgIndex] = msg;
      setSeqMessages(updated);
    } else {
      setSeqMessages([...seqMessages, msg]);
    }
    setShowMsgModal(false);
  };

  const removeMessage = (index: number) => {
    setSeqMessages(seqMessages.filter((_, i) => i !== index));
  };

  const addActionButton = () => {
    if (msgButtons.length >= 4) return;
    setMsgButtons([...msgButtons, { type: 'url', label: '', url: '' }]);
  };

  const updateActionButton = (index: number, field: string, value: string) => {
    const updated = [...msgButtons];
    updated[index] = { ...updated[index], [field]: value };
    setMsgButtons(updated);
  };

  const removeActionButton = (index: number) => {
    setMsgButtons(msgButtons.filter((_, i) => i !== index));
  };

  const insertVariable = (variable: string) => {
    setMsgBody(msgBody + ` {{${variable}}}`);
  };

  const searchCustomers = async () => {
    if (!memberSearch.trim()) return;
    try {
      const records = await pb.collection('users').getList(1, 20, {
        filter: `(name ~ "${memberSearch}" || phone ~ "${memberSearch}")`,
      });
      setMemberResults(records.items);
    } catch (err) {
      console.warn('Customer search failed:', err);
    }
  };

  const addMemberByPhone = async () => {
    if (!memberPhone.trim()) return;
    try {
      const record = await pb.collection('users').getFirstListItem(`phone ~ "${memberPhone}"`);
      if (record && !smartMembers.find(m => m.id === record.id)) {
        setSmartMembers([...smartMembers, record]);
      }
      setMemberPhone('');
    } catch (err) {
      Alert.alert('Not Found', 'No customer found with that phone number.');
    }
  };

  const addAllMembers = async () => {
    if (!user || !user.merchant_id) return;
    try {
      const cards = await pb.collection('loyalty_cards').getFullList({
        filter: `merchant = '${user.merchant_id}'`,
        expand: 'customer',
      });
      const customers = cards.map(c => c.expand?.customer).filter(Boolean);
      const unique = customers.filter((c: any, i: number, arr: any[]) => arr.findIndex(x => x.id === c.id) === i);
      setSmartMembers(unique);
    } catch (err) {
      console.warn('Failed to load all members:', err);
    }
  };

  const handleSaveSmartGroup = async () => {
    if (!user || !user.merchant_id) return;
    if (!smartGroupName.trim()) { Alert.alert('Validation', 'Group name is required.'); return; }
    if (smartSequences.length === 0) { Alert.alert('Validation', 'Add at least one sequence.'); return; }
    if (smartMembers.length === 0) { Alert.alert('Validation', 'Add at least one member.'); return; }

    setIsSavingSmart(true);
    try {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const genId = () => { let id = ''; for (let i = 0; i < 15; i++) id += chars.charAt(Math.floor(Math.random() * chars.length)); return id; };
      const groupId = genId();

      await pb.collection('follow_up_groups').create({
        id: groupId, merchant: user.merchant_id, name: smartGroupName.trim(),
        status: smartActive ? 'active' : 'draft', archive_after_send: smartArchiveAfter,
        interval_minutes: parseInt(smartInterval, 10) || 5,
        member_count: smartMembers.length, sequence_count: smartSequences.length,
      });

      for (let i = 0; i < smartSequences.length; i++) {
        const seq = smartSequences[i];
        const seqId = genId();
        await pb.collection('follow_up_sequences').create({
          id: seqId, group: groupId, title: seq.title, status: seq.status,
          send_after_days: seq.send_after_days, send_after_hours: seq.send_after_hours,
          send_after_minutes: seq.send_after_minutes, conversation_type: seq.conversation_type, order: i + 1,
        });
        for (let k = 0; k < (seq.messages || []).length; k++) {
          const msg = seq.messages[k];
          await pb.collection('follow_up_messages').create({
            id: genId(), sequence: seqId, message_body: msg.message_body,
            action_buttons: msg.action_buttons || [], order: k + 1,
          });
        }
      }

      for (const member of smartMembers) {
        await pb.collection('follow_up_members').create({
          id: genId(), group: groupId, customer: member.id, status: 'enrolled', sequence_completed: 0,
        });
      }

      Alert.alert('Success', 'Smart Follow Up group created!');
      resetSmartWizard();
      fetchSmartGroups();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create group.');
    } finally {
      setIsSavingSmart(false);
    }
  };

  const toggleSmartGroupStatus = async (group: any) => {
    const newStatus = group.status === 'active' ? 'paused' : 'active';
    try {
      await pb.collection('follow_up_groups').update(group.id, { status: newStatus });
      fetchSmartGroups();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update group.');
    }
  };

  const deleteSmartGroup = async (groupId: string) => {
    Alert.alert('Confirm Delete', 'Delete this follow up group and all its sequences?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await pb.collection('follow_up_groups').delete(groupId); fetchSmartGroups(); }
        catch (err: any) { Alert.alert('Error', err.message || 'Failed to delete group.'); }
      }},
    ]);
  };

  return (
    <View style={{ width: '100%' }}>
      <View style={s.configCard}>
        <Text style={s.cardSectionTitle}>Smart Follow Up</Text>
        <Text style={s.cardSectionDesc}>Create multi-step automated follow-up sequences with smart triggers.</Text>
        <TouchableOpacity style={[btnStyles.btn, { alignSelf: 'flex-start', marginTop: 12 }]} onPress={() => setShowSmartWizard(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={btnStyles.btnText}>Create Smart Follow Up</Text>
        </TouchableOpacity>
      </View>

      {loadingSmartGroups ? (
        <ActivityIndicator size="large" color="#000000" style={{ marginVertical: 30 }} />
      ) : smartGroups.length === 0 ? (
        <View style={s.campEmptyState}>
          <Ionicons name="git-branch-outline" size={40} color="#94A3B8" />
          <Text style={s.campEmptyTitle}>No Smart Follow Up Groups</Text>
          <Text style={s.campEmptySub}>Create your first multi-step follow-up sequence to engage customers automatically.</Text>
        </View>
      ) : (
        <View style={s.campList}>
          {smartGroups.map((group) => (
            <View key={group.id} style={[s.campCard, group.status !== 'active' && { opacity: 0.7 }]}>
              <TouchableOpacity onPress={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)} activeOpacity={0.8}>
                <View style={s.campCardHeader}>
                  <View style={{ gap: 4, flex: 1 }}>
                    <Text style={s.campCardName}>{group.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <View style={[badgeStyles.badge, { backgroundColor: group.status === 'active' ? '#22C55E' : group.status === 'paused' ? '#F59E0B' : '#6B7280' }]}>
                        <Text style={badgeStyles.text}>{group.status.toUpperCase()}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#6B7280', fontFamily: 'PlusJakartaSans_500Medium' }}>
                        {group.member_count} members · {group.sequence_count} sequences
                      </Text>
                    </View>
                  </View>
                  <Ionicons name={expandedGroup === group.id ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                </View>
              </TouchableOpacity>
              {expandedGroup === group.id && (
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[btnStyles.btn, { flex: 1, backgroundColor: group.status === 'active' ? '#F59E0B' : '#22C55E' }]} onPress={() => toggleSmartGroupStatus(group)}>
                      <Text style={btnStyles.btnText}>{group.status === 'active' ? 'Pause' : 'Activate'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[btnStyles.btn, { flex: 1, backgroundColor: '#EF4444' }]} onPress={() => deleteSmartGroup(group.id)}>
                      <Text style={btnStyles.btnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── Wizard Modal ── */}
      <Modal visible={showSmartWizard} transparent animationType="slide" onRequestClose={resetSmartWizard}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={modalStyles.title}>Create Smart Follow Up</Text>
              <TouchableOpacity onPress={resetSmartWizard}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 24, gap: 8 }}>
              {[1, 2, 3].map((step) => (
                <View key={step} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: smartWizardStep >= step ? '#1C1340' : '#E4E0F5', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                    <Text style={{ color: smartWizardStep >= step ? '#FFFFFF' : '#6B7280', fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' }}>{step}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: '#6B7280', fontFamily: 'PlusJakartaSans_500Medium' }}>{step === 1 ? 'Group Info' : step === 2 ? 'Sequences' : 'Members'}</Text>
                </View>
              ))}
            </View>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {smartWizardStep === 1 && (
                <View style={{ gap: 16 }}>
                  <View>
                    <Text style={inputStyles.label}>Group Name</Text>
                    <TextInput style={inputStyles.input} value={smartGroupName} onChangeText={setSmartGroupName} placeholder="e.g. 7-Day Winback Campaign" placeholderTextColor="#BEC6E0" />
                  </View>
                  <View style={s.switchRow}>
                    <View style={{ flex: 1 }}><Text style={s.switchLabel}>Active</Text><Text style={s.switchDesc}>Start sending immediately after creation</Text></View>
                    <Switch value={smartActive} onValueChange={setSmartActive} trackColor={{ false: '#E2E8F0', true: '#000000' }} />
                  </View>
                  <View style={s.switchRow}>
                    <View style={{ flex: 1 }}><Text style={s.switchLabel}>Archive After Complete</Text><Text style={s.switchDesc}>Auto-archive when all members finish</Text></View>
                    <Switch value={smartArchiveAfter} onValueChange={setSmartArchiveAfter} trackColor={{ false: '#E2E8F0', true: '#000000' }} />
                  </View>
                  <View>
                    <Text style={inputStyles.label}>Interval Between Contacts (minutes)</Text>
                    <TextInput style={inputStyles.input} value={smartInterval} onChangeText={setSmartInterval} keyboardType="numeric" placeholder="5" placeholderTextColor="#BEC6E0" />
                  </View>
                </View>
              )}
              {smartWizardStep === 2 && (
                <View style={{ gap: 12 }}>
                  <Text style={s.cardSectionDesc}>Add sequences sent in order. Each can contain multiple messages.</Text>
                  {smartSequences.map((seq, i) => (
                    <View key={i} style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E4E0F5' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827' }}>{seq.title || 'Untitled'}</Text>
                          <Text style={{ fontSize: 11, color: '#6B7280' }}>After {seq.send_after_days}d {seq.send_after_hours}h {seq.send_after_minutes}m · {(seq.messages || []).length} msgs</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={() => openSeqModal(i)}><Feather name="edit-2" size={14} color="#475569" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => removeSequence(i)}><Feather name="trash-2" size={14} color="#EF4444" /></TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={[btnStyles.btn, { alignSelf: 'center' }]} onPress={() => openSeqModal(null)}>
                    <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} /><Text style={btnStyles.btnText}>Add Sequence</Text>
                  </TouchableOpacity>
                </View>
              )}
              {smartWizardStep === 3 && (
                <View style={{ gap: 12 }}>
                  <Text style={s.cardSectionDesc}>Choose how to add members.</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {(['all', 'customer', 'phone'] as const).map((m) => (
                      <TouchableOpacity key={m} style={[s.triggerDayBtn, memberMethod === m && s.triggerDayBtnActive]} onPress={() => setMemberMethod(m)}>
                        <Text style={[s.triggerDayBtnText, memberMethod === m && s.triggerDayBtnTextActive]}>{m === 'all' ? 'All Members' : m === 'customer' ? 'By Customer' : 'By Phone'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {memberMethod === 'all' && (
                    <TouchableOpacity style={[btnStyles.btn, { alignSelf: 'center' }]} onPress={addAllMembers}><Text style={btnStyles.btnText}>Load All Loyalty Card Holders</Text></TouchableOpacity>
                  )}
                  {memberMethod === 'customer' && (
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput style={[inputStyles.input, { flex: 1 }]} value={memberSearch} onChangeText={setMemberSearch} placeholder="Search by name or phone" placeholderTextColor="#BEC6E0" />
                        <TouchableOpacity style={btnStyles.btn} onPress={searchCustomers}><Text style={btnStyles.btnText}>Search</Text></TouchableOpacity>
                      </View>
                      {memberResults.map((cust) => (
                        <TouchableOpacity key={cust.id} style={{ flexDirection: 'row', padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E4E0F5' }}
                          onPress={() => { if (!smartMembers.find(m => m.id === cust.id)) setSmartMembers([...smartMembers, cust]); }}>
                          <Text style={{ flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#111827' }}>{cust.name || cust.phone}</Text>
                          <Text style={{ fontSize: 11, color: '#6B7280' }}>{cust.phone}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {memberMethod === 'phone' && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput style={[inputStyles.input, { flex: 1 }]} value={memberPhone} onChangeText={setMemberPhone} placeholder="+60..." placeholderTextColor="#BEC6E0" keyboardType="phone-pad" />
                      <TouchableOpacity style={btnStyles.btn} onPress={addMemberByPhone}><Text style={btnStyles.btnText}>Add</Text></TouchableOpacity>
                    </View>
                  )}
                  {smartMembers.length > 0 && (
                    <View>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827', marginBottom: 8 }}>{smartMembers.length} member{smartMembers.length !== 1 ? 's' : ''} selected</Text>
                      {smartMembers.slice(0, 10).map((m) => (
                        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 6, gap: 8 }}>
                          <Text style={{ flex: 1, fontSize: 12, color: '#374151' }}>{m.name || m.phone}</Text>
                          <TouchableOpacity onPress={() => setSmartMembers(smartMembers.filter(x => x.id !== m.id))}><Ionicons name="close-circle" size={16} color="#EF4444" /></TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              {smartWizardStep > 1 && (
                <TouchableOpacity style={[btnStyles.btn, { flex: 1, backgroundColor: '#E4E0F5' }]} onPress={() => setSmartWizardStep(smartWizardStep - 1)}>
                  <Text style={[btnStyles.btnText, { color: '#111827' }]}>Back</Text>
                </TouchableOpacity>
              )}
              {smartWizardStep < 3 ? (
                <TouchableOpacity style={[btnStyles.btn, { flex: 1 }]} onPress={() => setSmartWizardStep(smartWizardStep + 1)}>
                  <Text style={btnStyles.btnText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[btnStyles.btn, { flex: 1 }]} onPress={handleSaveSmartGroup} disabled={isSavingSmart}>
                  <Text style={btnStyles.btnText}>{isSavingSmart ? 'Saving...' : 'Create Group'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Sequence Editor Modal ── */}
      <Modal visible={showSeqModal} transparent animationType="slide" onRequestClose={() => setShowSeqModal(false)}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={modalStyles.title}>{editingSeqIndex !== null ? 'Edit Sequence' : 'New Sequence'}</Text>
              <TouchableOpacity onPress={() => setShowSeqModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={{ gap: 16 }}>
                <View><Text style={inputStyles.label}>Title</Text><TextInput style={inputStyles.input} value={seqTitle} onChangeText={setSeqTitle} placeholder="e.g. Day 1 — We Miss You" placeholderTextColor="#BEC6E0" /></View>
                <View>
                  <Text style={inputStyles.label}>Status</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['active', 'inactive'].map((st) => (
                      <TouchableOpacity key={st} style={[s.triggerDayBtn, seqStatus === st && s.triggerDayBtnActive]} onPress={() => setSeqStatus(st)}>
                        <Text style={[s.triggerDayBtnText, seqStatus === st && s.triggerDayBtnTextActive]}>{st.charAt(0).toUpperCase() + st.slice(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View>
                  <Text style={inputStyles.label}>Send After</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[{ label: 'Days', val: seqDays, set: setSeqDays }, { label: 'Hours', val: seqHours, set: setSeqHours }, { label: 'Minutes', val: seqMinutes, set: setSeqMinutes }].map((f) => (
                      <View key={f.label} style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#6B7280', marginBottom: 4 }}>{f.label}</Text>
                        <TextInput style={inputStyles.input} value={f.val} onChangeText={f.set} keyboardType="numeric" placeholder="0" placeholderTextColor="#BEC6E0" />
                      </View>
                    ))}
                  </View>
                </View>
                <View>
                  <Text style={inputStyles.label}>Conversation Type</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {[{ v: 'last_sequence', l: 'Last Sequence' }, { v: 'last_conversation', l: 'Last Conversation' }, { v: 'last_merchant_msg', l: 'Last Merchant Msg' }, { v: 'last_customer_msg', l: 'Last Customer Msg' }].map((ct) => (
                      <TouchableOpacity key={ct.v} style={[s.triggerDayBtn, seqConvType === ct.v && s.triggerDayBtnActive]} onPress={() => setSeqConvType(ct.v)}>
                        <Text style={[s.triggerDayBtnText, seqConvType === ct.v && s.triggerDayBtnTextActive]}>{ct.l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View>
                  <Text style={inputStyles.label}>Messages ({seqMessages.length})</Text>
                  {seqMessages.map((msg, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#F8FAFC', borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#E4E0F5' }}>
                      <Text style={{ flex: 1, fontSize: 12, color: '#374151' }} numberOfLines={1}>{msg.message_body}</Text>
                      <TouchableOpacity onPress={() => openMsgModal(i)} style={{ marginRight: 8 }}><Feather name="edit-2" size={13} color="#475569" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => removeMessage(i)}><Feather name="trash-2" size={13} color="#EF4444" /></TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={[btnStyles.btn, { alignSelf: 'center', marginTop: 8 }]} onPress={() => openMsgModal(null)}>
                    <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} /><Text style={btnStyles.btnText}>Add Message</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity style={[btnStyles.btn, { marginTop: 16 }]} onPress={saveSequence}><Text style={btnStyles.btnText}>Save Sequence</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Message Editor Modal ── */}
      <Modal visible={showMsgModal} transparent animationType="slide" onRequestClose={() => setShowMsgModal(false)}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={modalStyles.title}>{editingMsgIndex !== null ? 'Edit Message' : 'New Message'}</Text>
              <TouchableOpacity onPress={() => setShowMsgModal(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={{ gap: 16 }}>
                <View>
                  <Text style={inputStyles.label}>Insert Variable</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {['name', 'stamps', 'points', 'points_expiry', 'login_link'].map((v) => (
                      <TouchableOpacity key={v} style={{ backgroundColor: '#F0EBFF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }} onPress={() => insertVariable(v)}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#5C3BCC' }}>{`{{${v}}}`}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View>
                  <Text style={inputStyles.label}>Message Body</Text>
                  <TextInput style={[inputStyles.input, { height: 100, textAlignVertical: 'top' }]} multiline value={msgBody} onChangeText={setMsgBody} placeholder="Type your message..." placeholderTextColor="#BEC6E0" />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={inputStyles.label}>Action Buttons ({msgButtons.length}/4)</Text>
                    {msgButtons.length < 4 && <TouchableOpacity onPress={addActionButton}><Text style={{ fontSize: 12, color: '#5C3BCC', fontFamily: 'PlusJakartaSans_600SemiBold' }}>+ Add Button</Text></TouchableOpacity>}
                  </View>
                  {msgButtons.map((btn, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                      <TextInput style={[inputStyles.input, { flex: 1 }]} value={btn.label} onChangeText={(v) => updateActionButton(i, 'label', v)} placeholder="Button label" placeholderTextColor="#BEC6E0" />
                      <TextInput style={[inputStyles.input, { flex: 1 }]} value={btn.url} onChangeText={(v) => updateActionButton(i, 'url', v)} placeholder="URL" placeholderTextColor="#BEC6E0" />
                      <TouchableOpacity onPress={() => removeActionButton(i)}><Ionicons name="close-circle" size={20} color="#EF4444" /></TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity style={[btnStyles.btn, { marginTop: 16 }]} onPress={saveMessage}><Text style={btnStyles.btnText}>Save Message</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const btnStyles = StyleSheet.create({
  btn: { backgroundColor: '#1C1340', borderRadius: 10, paddingHorizontal: 18, height: 36, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' },
});

const badgeStyles = StyleSheet.create({
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF', letterSpacing: 0.5 },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 500, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  title: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' },
});

const inputStyles = StyleSheet.create({
  label: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#0F172A', backgroundColor: '#F8FAFC' },
});
