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
  const [validationError, setValidationError] = useState('');

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
    setValidationError('');
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
    if (!smartGroupName.trim()) { setValidationError('Group name is required.'); return; }
    if (smartSequences.length === 0) { setValidationError('Add at least one sequence.'); return; }
    if (smartMembers.length === 0) { setValidationError('Add at least one member.'); return; }

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
      <View style={[s.campHeaderRow, { marginBottom: 20 }]}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text style={s.campTitle}>Smart Follow Up</Text>
          <Text style={s.campSubtitle}>Create multi-step automated follow-up sequences with smart triggers.</Text>
        </View>
        <TouchableOpacity 
          style={s.createCampBtn} 
          onPress={() => setShowSmartWizard(true)} 
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={s.createCampBtnText}>New Group</Text>
        </TouchableOpacity>
      </View>

      {loadingSmartGroups ? (
        <ActivityIndicator size="large" color="#000000" style={{ marginVertical: 30 }} />
      ) : smartGroups.length === 0 ? (
        <View style={s.campEmptyState}>
          <Ionicons name="git-branch-outline" size={48} color="#94A3B8" />
          <Text style={s.campEmptyTitle}>No Smart Follow Up Groups</Text>
          <Text style={s.campEmptySub}>Create your first multi-step follow-up sequence to engage customers automatically.</Text>
          <TouchableOpacity 
            style={s.campEmptyBtn}
            onPress={() => setShowSmartWizard(true)}
            activeOpacity={0.8}
          >
            <Text style={s.campEmptyBtnText}>Create Smart Follow Up</Text>
          </TouchableOpacity>
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
                      <View 
                        style={[
                          s.statusDotBadge, 
                          group.status === 'active' && { backgroundColor: '#ECFDF5' },
                          group.status === 'paused' && { backgroundColor: '#FFFBEB' },
                          group.status === 'draft' && { backgroundColor: '#F1F5F9' },
                          group.status === 'archived' && { backgroundColor: '#F1F5F9' }
                        ]}
                      >
                        <View 
                          style={[
                            s.statusDot, 
                            { 
                              backgroundColor: group.status === 'active' 
                                ? '#10B981' 
                                : group.status === 'paused' 
                                ? '#F59E0B' 
                                : '#64748B' 
                            }
                          ]} 
                        />
                        <Text 
                          style={[
                            s.statusDotText,
                            { 
                              color: group.status === 'active' 
                                ? '#047857' 
                                : group.status === 'paused' 
                                ? '#B45309' 
                                : '#475569' 
                            }
                          ]}
                        >
                          {group.status.toUpperCase()}
                        </Text>
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
                    <TouchableOpacity 
                      style={[
                        btnStyles.btn, 
                        { 
                          flex: 1, 
                          backgroundColor: group.status === 'active' ? '#FFF7ED' : '#F0FDF4',
                          borderWidth: 1,
                          borderColor: group.status === 'active' ? '#FFEDD5' : '#DCFCE7'
                        }
                      ]} 
                      onPress={() => toggleSmartGroupStatus(group)}
                      activeOpacity={0.8}
                    >
                      <Text style={[btnStyles.btnText, { color: group.status === 'active' ? '#D97706' : '#16A34A' }]}>
                        {group.status === 'active' ? 'Pause' : 'Activate'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[
                        btnStyles.btn, 
                        { 
                          flex: 1, 
                          backgroundColor: '#FEF2F2',
                          borderWidth: 1,
                          borderColor: '#FEE2E2'
                        }
                      ]} 
                      onPress={() => deleteSmartGroup(group.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[btnStyles.btnText, { color: '#EF4444' }]}>Delete</Text>
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
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={modalStyles.title}>Create Smart Follow Up</Text>
              <TouchableOpacity onPress={resetSmartWizard} style={{ padding: 4 }} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Premium Step Progress Indicator */}
            <View style={{ flexDirection: 'row', marginBottom: 28, gap: 16, alignItems: 'center', paddingHorizontal: 4 }}>
              {[1, 2, 3].map((step) => {
                const isCompleted = step < smartWizardStep;
                const isActive = step === smartWizardStep;
                
                return (
                  <View key={step} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <View 
                        style={{ 
                          width: 36, 
                          height: 36, 
                          borderRadius: 18, 
                          backgroundColor: isCompleted ? '#ECFDF5' : isActive ? '#000000' : '#F1F5F9', 
                          borderWidth: isActive ? 0 : 1,
                          borderColor: isCompleted ? '#A7F3D0' : '#E2E8F0',
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          marginBottom: 6,
                          shadowColor: isActive ? '#000000' : '#000',
                          shadowOffset: { width: 0, height: isActive ? 3 : 0 },
                          shadowOpacity: isActive ? 0.2 : 0,
                          shadowRadius: isActive ? 5 : 0,
                          elevation: isActive ? 4 : 0
                        }}
                      >
                        {isCompleted ? (
                          <Ionicons name="checkmark" size={18} color="#10B981" />
                        ) : (
                          <Text style={{ color: isActive ? '#FFFFFF' : '#64748B', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' }}>
                            {step}
                          </Text>
                        )}
                      </View>
                      <Text style={{ 
                        fontSize: 11, 
                        color: isActive ? '#0F172A' : '#64748B', 
                        fontFamily: isActive ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium' 
                      }}>
                        {step === 1 ? 'Group Info' : step === 2 ? 'Sequences' : 'Members'}
                      </Text>
                    </View>
                    
                    {step < 3 && (
                      <View style={{ 
                        width: '100%', 
                        height: 2, 
                        backgroundColor: isCompleted ? '#10B981' : '#E2E8F0',
                        position: 'absolute',
                        left: '70%',
                        top: 18,
                        zIndex: -1
                      }} />
                    )}
                  </View>
                );
              })}
            </View>

            {validationError ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#FEE2E2', marginBottom: 16, gap: 8 }}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={{ flex: 1, fontSize: 12, color: '#EF4444', fontFamily: 'PlusJakartaSans_600SemiBold' }}>{validationError}</Text>
                <TouchableOpacity onPress={() => setValidationError('')} activeOpacity={0.7} style={{ padding: 2 }}>
                  <Ionicons name="close" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Scrollable Container */}
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* STEP 1: GROUP INFO */}
              {smartWizardStep === 1 && (
                <View style={{ gap: 20 }}>
                  <View>
                    <Text style={inputStyles.label}>
                      Group Name <Text style={{ color: '#EF4444' }}>*</Text>
                    </Text>
                    <TextInput 
                      style={inputStyles.input} 
                      value={smartGroupName} 
                      onChangeText={(v) => {
                        setSmartGroupName(v);
                        if (validationError) setValidationError('');
                      }} 
                      placeholder="e.g. 7-Day Winback Campaign" 
                      placeholderTextColor="#BEC6E0" 
                    />
                  </View>
                  
                  <View style={s.switchRow}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={s.switchLabel}>Active Status</Text>
                      <Text style={s.switchDesc}>Start sending messages immediately after creation</Text>
                    </View>
                    <Switch 
                      value={smartActive} 
                      onValueChange={setSmartActive} 
                      trackColor={{ false: '#E2E8F0', true: '#10B981' }} 
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  
                  <View style={s.switchRow}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={s.switchLabel}>Archive After Complete</Text>
                      <Text style={s.switchDesc}>Auto-archive the group when all members finish the sequence</Text>
                    </View>
                    <Switch 
                      value={smartArchiveAfter} 
                      onValueChange={setSmartArchiveAfter} 
                      trackColor={{ false: '#E2E8F0', true: '#000000' }} 
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  
                  <View>
                    <Text style={inputStyles.label}>Interval Between Contacts (minutes)</Text>
                    <TextInput 
                      style={inputStyles.input} 
                      value={smartInterval} 
                      onChangeText={setSmartInterval} 
                      keyboardType="numeric" 
                      placeholder="5" 
                      placeholderTextColor="#BEC6E0" 
                    />
                  </View>
                </View>
              )}

              {/* STEP 2: SEQUENCES */}
              {smartWizardStep === 2 && (
                <View style={{ gap: 16 }}>
                  <Text style={[s.cardSectionDesc, { marginBottom: 4 }]}>
                    Build your automated funnel. Sequences will execute in order based on the set delay.
                  </Text>
                  
                  {smartSequences.length === 0 ? (
                    <View style={{ padding: 24, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 8 }}>
                      <Ionicons name="git-commit-outline" size={32} color="#94A3B8" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>No sequences added yet</Text>
                      <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', maxWidth: 240 }}>Add a sequence step to start drafting automated messages.</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {smartSequences.map((seq, i) => (
                        <View key={i} style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF2F6', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="git-commit-outline" size={20} color="#475569" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>{seq.title || 'Untitled Sequence'}</Text>
                            <Text style={{ fontSize: 11, color: '#64748B', fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 }}>
                              Sends after: {seq.send_after_days}d {seq.send_after_hours}h {seq.send_after_minutes}m · {(seq.messages || []).length} message{(seq.messages || []).length !== 1 ? 's' : ''}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={() => openSeqModal(i)} style={{ padding: 4 }} activeOpacity={0.7}>
                              <Feather name="edit-2" size={16} color="#475569" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeSequence(i)} style={{ padding: 4 }} activeOpacity={0.7}>
                              <Feather name="trash-2" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  <TouchableOpacity 
                    style={[btnStyles.btn, { alignSelf: 'center', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', width: '100%', marginTop: 8 }]} 
                    onPress={() => openSeqModal(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={18} color="#0F172A" style={{ marginRight: 6 }} />
                    <Text style={[btnStyles.btnText, { color: '#0F172A' }]}>Add Sequence Step</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 3: MEMBERS */}
              {smartWizardStep === 3 && (
                <View style={{ gap: 16 }}>
                  <Text style={s.cardSectionDesc}>Choose which customers should be enrolled in this follow-up loop.</Text>
                  
                  {/* Segmented Controller Tab Bar */}
                  <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 4, gap: 4, marginBottom: 8 }}>
                    {(['all', 'customer', 'phone'] as const).map((m) => {
                      const isActive = memberMethod === m;
                      return (
                        <TouchableOpacity 
                          key={m} 
                          style={{ 
                            flex: 1, 
                            paddingVertical: 8, 
                            borderRadius: 10, 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            backgroundColor: isActive ? '#000000' : 'transparent',
                          }} 
                          onPress={() => setMemberMethod(m)}
                          activeOpacity={0.8}
                        >
                          <Text style={{ 
                            fontSize: 12, 
                            fontFamily: 'PlusJakartaSans_700Bold', 
                            color: isActive ? '#FFFFFF' : '#64748B' 
                          }}>
                            {m === 'all' ? 'All Holders' : m === 'customer' ? 'Search' : 'By Phone'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {memberMethod === 'all' && (
                    <TouchableOpacity 
                      style={[btnStyles.btn, { width: '100%', backgroundColor: '#000000' }]} 
                      onPress={addAllMembers}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="people-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={btnStyles.btnText}>Load All Loyalty Card Holders</Text>
                    </TouchableOpacity>
                  )}

                  {memberMethod === 'customer' && (
                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput 
                          style={[inputStyles.input, { flex: 1 }]} 
                          value={memberSearch} 
                          onChangeText={setMemberSearch} 
                          placeholder="Search by name or phone..." 
                          placeholderTextColor="#BEC6E0" 
                        />
                        <TouchableOpacity 
                          style={[btnStyles.btn, { paddingHorizontal: 16 }]} 
                          onPress={searchCustomers}
                          activeOpacity={0.8}
                        >
                          <Text style={btnStyles.btnText}>Search</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {memberResults.map((cust) => (
                        <TouchableOpacity 
                          key={cust.id} 
                          style={{ flexDirection: 'row', padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'space-between', alignItems: 'center' }}
                          onPress={() => { if (!smartMembers.find(m => m.id === cust.id)) setSmartMembers([...smartMembers, cust]); }}
                          activeOpacity={0.7}
                        >
                          <View style={{ gap: 2 }}>
                            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>{cust.name || 'Unnamed Customer'}</Text>
                            <Text style={{ fontSize: 11, color: '#64748B', fontFamily: 'PlusJakartaSans_500Medium' }}>{cust.phone}</Text>
                          </View>
                          <Ionicons name="add-circle" size={20} color="#5C3BCC" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {memberMethod === 'phone' && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput 
                        style={[inputStyles.input, { flex: 1 }]} 
                        value={memberPhone} 
                        onChangeText={setMemberPhone} 
                        placeholder="+60123456789" 
                        placeholderTextColor="#BEC6E0" 
                        keyboardType="phone-pad" 
                      />
                      <TouchableOpacity 
                        style={[btnStyles.btn, { paddingHorizontal: 20 }]} 
                        onPress={addMemberByPhone}
                        activeOpacity={0.8}
                      >
                        <Text style={btnStyles.btnText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {smartMembers.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 6 }}>
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                          Selected Target List ({smartMembers.length})
                        </Text>
                        <TouchableOpacity onPress={() => setSmartMembers([])}>
                          <Text style={{ fontSize: 11, color: '#EF4444', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Clear All</Text>
                        </TouchableOpacity>
                      </View>
                      
                      <View style={{ gap: 6 }}>
                        {smartMembers.slice(0, 10).map((m) => (
                          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderRadius: 8, gap: 8 }}>
                            <Text style={{ flex: 1, fontSize: 12, color: '#334155', fontFamily: 'PlusJakartaSans_500Medium' }}>{m.name || m.phone}</Text>
                            <TouchableOpacity onPress={() => setSmartMembers(smartMembers.filter(x => x.id !== m.id))} activeOpacity={0.7}>
                              <Ionicons name="close-circle" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                        {smartMembers.length > 10 && (
                          <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 4 }}>
                            + {smartMembers.length - 10} more customers...
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Bottom Actions Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              {smartWizardStep > 1 && (
                <TouchableOpacity 
                  style={[
                    btnStyles.btn, 
                    { 
                      flex: 1, 
                      backgroundColor: '#FFFFFF', 
                      borderWidth: 1.5, 
                      borderColor: '#E2E8F0' 
                    }
                  ]} 
                  onPress={() => setSmartWizardStep(smartWizardStep - 1)}
                  activeOpacity={0.8}
                >
                  <Text style={[btnStyles.btnText, { color: '#475569' }]}>Back</Text>
                </TouchableOpacity>
              )}
              {smartWizardStep < 3 ? (
                <TouchableOpacity 
                  style={[btnStyles.btn, { flex: 1 }]} 
                  onPress={() => {
                    setValidationError('');
                    if (smartWizardStep === 1) {
                      if (!smartGroupName.trim()) {
                        setValidationError('Please enter a Group Name before proceeding.');
                        return;
                      }
                    } else if (smartWizardStep === 2) {
                      if (smartSequences.length === 0) {
                        setValidationError('Please add at least one Sequence step before proceeding.');
                        return;
                      }
                    }
                    setSmartWizardStep(smartWizardStep + 1);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={btnStyles.btnText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[btnStyles.btn, { flex: 1, backgroundColor: '#5C3BCC' }]} 
                  onPress={handleSaveSmartGroup} 
                  disabled={isSavingSmart}
                  activeOpacity={0.8}
                >
                  <Text style={btnStyles.btnText}>
                    {isSavingSmart ? 'Saving...' : 'Create Group'}
                  </Text>
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
              <Text style={modalStyles.title}>{editingSeqIndex !== null ? 'Edit Sequence Step' : 'New Sequence Step'}</Text>
              <TouchableOpacity onPress={() => setShowSeqModal(false)} style={{ padding: 4 }} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 16 }}>
                <View>
                  <Text style={inputStyles.label}>Step Title <Text style={{ color: '#EF4444' }}>*</Text></Text>
                  <TextInput 
                    style={inputStyles.input} 
                    value={seqTitle} 
                    onChangeText={setSeqTitle} 
                    placeholder="e.g. Day 1 — We Miss You" 
                    placeholderTextColor="#BEC6E0" 
                  />
                </View>
                
                <View>
                  <Text style={inputStyles.label}>Step Status</Text>
                  <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 3, gap: 4 }}>
                    {['active', 'inactive'].map((st) => {
                      const isActive = seqStatus === st;
                      return (
                        <TouchableOpacity 
                          key={st} 
                          style={{ 
                            flex: 1, 
                            paddingVertical: 8, 
                            borderRadius: 9, 
                            alignItems: 'center', 
                            backgroundColor: isActive ? '#000000' : 'transparent' 
                          }} 
                          onPress={() => setSeqStatus(st)}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: isActive ? '#FFFFFF' : '#64748B' }}>
                            {st === 'active' ? 'Active' : 'Paused/Inactive'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                
                <View>
                  <Text style={inputStyles.label}>Delay Trigger Delay</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[{ label: 'Days', val: seqDays, set: setSeqDays }, { label: 'Hours', val: seqHours, set: setSeqHours }, { label: 'Minutes', val: seqMinutes, set: setSeqMinutes }].map((f) => (
                      <View key={f.label} style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#64748B', fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 4 }}>{f.label}</Text>
                        <TextInput 
                          style={inputStyles.input} 
                          value={f.val} 
                          onChangeText={f.set} 
                          keyboardType="numeric" 
                          placeholder="0" 
                          placeholderTextColor="#BEC6E0" 
                        />
                      </View>
                    ))}
                  </View>
                </View>
                
                <View>
                  <Text style={inputStyles.label}>Start Timeline From</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { v: 'last_sequence', l: 'Last Sequence Step' }, 
                      { v: 'last_conversation', l: 'Last Active Chat' }, 
                      { v: 'last_merchant_msg', l: 'Last Merchant Broadcast' }, 
                      { v: 'last_customer_msg', l: 'Last Customer Visit' }
                    ].map((ct) => {
                      const isActive = seqConvType === ct.v;
                      return (
                        <TouchableOpacity 
                          key={ct.v} 
                          style={{ 
                            paddingHorizontal: 12, 
                            paddingVertical: 8, 
                            borderRadius: 10, 
                            borderWidth: 1, 
                            borderColor: isActive ? '#000000' : '#E2E8F0', 
                            backgroundColor: isActive ? '#000000' : '#FFFFFF',
                            marginBottom: 4
                          }} 
                          onPress={() => setSeqConvType(ct.v)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: isActive ? '#FFFFFF' : '#475569' }}>
                            {ct.l}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={inputStyles.label}>Messages ({seqMessages.length})</Text>
                    <TouchableOpacity onPress={() => openMsgModal(null)}>
                      <Text style={{ fontSize: 12, color: '#000000', fontFamily: 'PlusJakartaSans_700Bold' }}>+ Add Message</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {seqMessages.length === 0 ? (
                    <View style={{ padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E2E8F0', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginVertical: 4 }}>
                      <Text style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'PlusJakartaSans_500Medium' }}>Create a template message for this sequence step.</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {seqMessages.map((msg, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                          <Text style={{ flex: 1, fontSize: 12, color: '#334155', fontFamily: 'PlusJakartaSans_500Medium' }} numberOfLines={1}>
                            {msg.message_body}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 10, marginLeft: 8 }}>
                            <TouchableOpacity onPress={() => openMsgModal(i)} activeOpacity={0.7}>
                              <Feather name="edit-2" size={14} color="#475569" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeMessage(i)} activeOpacity={0.7}>
                              <Feather name="trash-2" size={14} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
            
            <TouchableOpacity 
              style={[btnStyles.btn, { marginTop: 20, backgroundColor: '#000000' }]} 
              onPress={saveSequence}
              activeOpacity={0.8}
            >
              <Text style={btnStyles.btnText}>Save Sequence Step</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Message Editor Modal ── */}
      <Modal visible={showMsgModal} transparent animationType="slide" onRequestClose={() => setShowMsgModal(false)}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={modalStyles.title}>{editingMsgIndex !== null ? 'Edit Message Details' : 'New Message Details'}</Text>
              <TouchableOpacity onPress={() => setShowMsgModal(false)} style={{ padding: 4 }} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 16 }}>
                <View>
                  <Text style={inputStyles.label}>Insert Variables</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {['name', 'stamps', 'points', 'points_expiry', 'login_link'].map((v) => (
                      <TouchableOpacity 
                        key={v} 
                        style={{ 
                          backgroundColor: '#F1F5F9', 
                          borderRadius: 8, 
                          paddingHorizontal: 10, 
                          paddingVertical: 5,
                          borderWidth: 1,
                          borderColor: '#E2E8F0'
                        }} 
                        onPress={() => insertVariable(v)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>{`{{${v}}}`}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                <View>
                  <Text style={inputStyles.label}>Message Template Body <Text style={{ color: '#EF4444' }}>*</Text></Text>
                  <TextInput 
                    style={[inputStyles.input, { height: 110, textAlignVertical: 'top' }]} 
                    multiline 
                    value={msgBody} 
                    onChangeText={setMsgBody} 
                    placeholder="Type your message body here..." 
                    placeholderTextColor="#BEC6E0" 
                  />
                </View>
                
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={inputStyles.label}>Interactive Action Buttons ({msgButtons.length}/3)</Text>
                    {msgButtons.length < 3 && (
                      <TouchableOpacity onPress={addActionButton}>
                        <Text style={{ fontSize: 12, color: '#000000', fontFamily: 'PlusJakartaSans_700Bold' }}>+ Add Button</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {msgButtons.map((btn, i) => (
                    <View key={i} style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12, gap: 8, position: 'relative' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 4 }}>Button Label</Text>
                        <TextInput 
                          style={inputStyles.input} 
                          value={btn.label} 
                          onChangeText={(v) => updateActionButton(i, 'label', v)} 
                          placeholder="Button label" 
                          placeholderTextColor="#BEC6E0" 
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 4 }}>URL (optional)</Text>
                        <TextInput 
                          style={inputStyles.input} 
                          value={btn.url} 
                          onChangeText={(v) => updateActionButton(i, 'url', v)} 
                          placeholder="URL (optional)" 
                          placeholderTextColor="#BEC6E0" 
                        />
                      </View>
                      <TouchableOpacity 
                        style={{ position: 'absolute', top: 12, right: 12, padding: 4 }} 
                        onPress={() => removeActionButton(i)} 
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
            
            <TouchableOpacity 
              style={[btnStyles.btn, { marginTop: 20, backgroundColor: '#000000' }]} 
              onPress={saveMessage}
              activeOpacity={0.8}
            >
              <Text style={btnStyles.btnText}>Save Message Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const btnStyles = StyleSheet.create({
  btn: { 
    backgroundColor: '#000000', 
    borderRadius: 12, 
    paddingHorizontal: 18, 
    height: 38, 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  btnText: { 
    fontSize: 13, 
    fontFamily: 'PlusJakartaSans_700Bold', 
    color: '#FFFFFF' 
  },
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
