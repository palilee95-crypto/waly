import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';

export interface WhatsAppTemplate {
  id?: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  bodyText: string;
  headerText?: string;
  footerText?: string;
  rejectedReason?: string | null;
}

interface TemplateStudioProps {
  onSelectTemplateForBroadcast?: (template: WhatsAppTemplate) => void;
}

const STARTER_PRESETS = [
  {
    id: 'winback',
    title: 'Win-Back Regulars',
    desc: 'Invite customers who haven\'t visited recently with double stamps.',
    name: 'winback_loyalty_promo',
    category: 'MARKETING' as const,
    header: 'We Miss You! ❤️',
    body: 'Hi {Customer Name}! 👋\n\nWe haven\'t seen you in a while at {Store Name}. You currently have {Stamp Balance} stamps on your card.\n\nVisit us this week and get DOUBLE stamps on your next order! 🎁',
    footer: 'Reply STOP to opt out',
  },
  {
    id: 'weekend_2x',
    title: 'Weekend 2x Stamps',
    desc: 'Flash promotion to boost weekend foot traffic.',
    name: 'weekend_double_stamps',
    category: 'MARKETING' as const,
    header: 'Weekend Flash Promo! ⚡',
    body: 'Hey {Customer Name}! ✨\n\nThis Saturday & Sunday only: Collect 2X stamps for every visit at {Store Name}.\n\nYou are only a few stamps away from unlocking {Reward Item}!',
    footer: 'Terms & conditions apply',
  },
  {
    id: 'birthday',
    title: 'Birthday Surprise',
    desc: 'Send special birthday greetings with a free gift.',
    name: 'birthday_reward_gift',
    category: 'MARKETING' as const,
    header: 'Happy Birthday! 🎂',
    body: 'Happy Birthday {Customer Name}! 🎉\n\n{Store Name} wants to celebrate with you. Come by this month and claim your special birthday gift: {Reward Item} on us!',
    footer: 'Show this message at counter',
  },
  {
    id: 'milestone',
    title: 'Stamp Milestone Alert',
    desc: 'Alert customer when they are 1 stamp away from reward.',
    name: 'stamp_reward_near',
    category: 'UTILITY' as const,
    header: 'Almost There! 🎁',
    body: 'Hi {Customer Name}, you now have {Stamp Balance} stamps at {Store Name}!\n\nJust 1 more stamp to claim your free {Reward Item}. Drop by soon!',
    footer: '',
  },
];

export default function TemplateStudio({ onSelectTemplateForBroadcast }: TemplateStudioProps) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [formLanguage, setFormLanguage] = useState<'en_US' | 'ms'>('en_US');
  const [formHeader, setFormHeader] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formFooter, setFormFooter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Sample values for live preview
  const sampleData: Record<string, string> = {
    '{Customer Name}': 'Shafiq',
    '{Stamp Balance}': '8',
    '{Store Name}': 'Kopitiam Risev',
    '{Reward Item}': 'Free Iced Latte',
  };

  const fetchTemplates = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await pb.send<{ templates: WhatsAppTemplate[]; connected?: boolean; sandbox?: boolean }>(
        '/api/risev/merchant/whatsapp/templates',
        { method: 'GET', requestKey: null }
      );
      setTemplates(res.templates || []);
      setIsConnected(res.connected !== false);
    } catch (err: any) {
      console.warn('[TemplateStudio] Failed to load templates:', err?.message || err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleOpenCreateModal = (preset?: typeof STARTER_PRESETS[0]) => {
    setFormError('');
    if (preset) {
      setFormName(preset.name);
      setFormCategory(preset.category);
      setFormHeader(preset.header);
      setFormBody(preset.body);
      setFormFooter(preset.footer);
    } else {
      setFormName('');
      setFormCategory('MARKETING');
      setFormLanguage('en_US');
      setFormHeader('');
      setFormBody('Hi {Customer Name}! 👋\n\nWe have an exclusive update for you from {Store Name}. You currently have {Stamp Balance} stamps!\n\nVisit us today to claim {Reward Item}. ✨');
      setFormFooter('Reply STOP to opt out');
    }
    setModalVisible(true);
  };

  const insertVariable = (variableKey: string) => {
    setFormBody((prev) => prev + variableKey + ' ');
  };

  // Convert friendly {Customer Name} placeholders into Meta {{1}}, {{2}} & samples
  const compileTemplatePayload = () => {
    let transformedBody = formBody;
    const variableOrder: string[] = [];
    const sampleValues: string[] = [];

    const chipKeys = Object.keys(sampleData);
    const regex = new RegExp(chipKeys.map(k => k.replace(/[{}]/g, '\\$&')).join('|'), 'g');
    
    let varIndex = 1;
    const replacedMap: Record<string, string> = {};

    transformedBody = transformedBody.replace(regex, (match) => {
      if (!replacedMap[match]) {
        replacedMap[match] = `{{${varIndex}}}`;
        variableOrder.push(match);
        sampleValues.push(sampleData[match] || 'Sample');
        varIndex++;
      }
      return replacedMap[match];
    });

    return {
      name: formName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      category: formCategory,
      language: formLanguage,
      headerText: formHeader.trim() || undefined,
      bodyText: transformedBody.trim(),
      footerText: formFooter.trim() || undefined,
      sampleValues: sampleValues,
    };
  };

  const handleCreateTemplate = async () => {
    if (!formName.trim()) {
      setFormError('Please enter a template name.');
      return;
    }
    if (!formBody.trim()) {
      setFormError('Please enter the message body text.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = compileTemplatePayload();
      const res = await pb.send<{ success: boolean; message: string; template?: any }>(
        '/api/risev/merchant/whatsapp/templates/create',
        {
          method: 'POST',
          body: payload,
          requestKey: null,
        }
      );

      if (res.success) {
        Alert.alert(
          'Template Submitted! 🚀',
          'Your template has been submitted to Meta AI for automated review. It is usually approved and ready to use in 1–2 minutes.',
          [{ text: 'OK' }]
        );
        setModalVisible(false);
        fetchTemplates();
      } else {
        setFormError(res.message || 'Failed to submit template to Meta.');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Error submitting template.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (templateName: string) => {
    Alert.alert(
      'Delete Template?',
      `Are you sure you want to delete "${templateName}" from WhatsApp? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await pb.send<{ success: boolean; message: string }>(
                '/api/risev/merchant/whatsapp/templates/delete',
                {
                  method: 'POST',
                  body: { name: templateName },
                  requestKey: null,
                }
              );
              if (res.success) {
                fetchTemplates();
              } else {
                Alert.alert('Error', res.message || 'Failed to delete template.');
              }
            } catch (delErr: any) {
              Alert.alert('Error', delErr?.message || 'Failed to delete template.');
            }
          },
        },
      ]
    );
  };

  const getLivePreviewBody = () => {
    let preview = formBody || 'Your message will appear here...';
    Object.keys(sampleData).forEach((key) => {
      preview = preview.split(key).join(sampleData[key]);
    });
    preview = preview.replace(/\{\{1\}\}/g, 'Shafiq');
    preview = preview.replace(/\{\{2\}\}/g, '8');
    preview = preview.replace(/\{\{3\}\}/g, 'Kopitiam Risev');
    preview = preview.replace(/\{\{4\}\}/g, 'Free Iced Latte');
    return preview;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
            <Text style={[styles.statusText, { color: '#15803D' }]}>APPROVED</Text>
          </View>
        );
      case 'PENDING':
        return (
          <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#D97706' }]} />
            <Text style={[styles.statusText, { color: '#B45309' }]}>UNDER REVIEW</Text>
          </View>
        );
      case 'REJECTED':
        return (
          <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#DC2626' }]} />
            <Text style={[styles.statusText, { color: '#B91C1C' }]}>REJECTED</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.statusBadge, { backgroundColor: '#F1F5F9' }]}>
            <Text style={[styles.statusText, { color: '#64748B' }]}>{status}</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER & ACTIONS ── */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.sectionTitle}>WhatsApp Template Studio</Text>
          <Text style={styles.sectionSub}>
            Create and manage approved broadcast templates directly without logging into Meta.
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => fetchTemplates(true)}
            disabled={isRefreshing}
            activeOpacity={0.8}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#64748B" />
            ) : (
              <Ionicons name="sync" size={16} color="#64748B" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => handleOpenCreateModal()}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#050505" style={{ marginRight: 4 }} />
            <Text style={styles.createBtnText}>New Template</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── NOT CONNECTED WARNING BANNER ── */}
      {!isConnected && (
        <View style={styles.notConnectedBanner}>
          <View style={styles.notConnectedLeft}>
            <View style={styles.notConnectedIconBox}>
              <Ionicons name="warning" size={16} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notConnectedTitle}>WhatsApp Business Not Connected</Text>
              <Text style={styles.notConnectedDesc}>
                Connect your WhatsApp Business number in Settings to submit templates for instant 1–2 min Meta approval.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.connectMetaBtn}
            onPress={() => router.push('/(merchant)/profile')}
            activeOpacity={0.85}
          >
            <Ionicons name="logo-whatsapp" size={14} color="#050505" />
            <Text style={styles.connectMetaBtnText}>Connect Number</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── STARTER PRESETS BANNER ── */}
      <View style={styles.presetsSection}>
        <Text style={styles.presetSectionTitle}>1-CLICK STARTER PRESETS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsScroll}>
          {STARTER_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.id}
              style={styles.presetCard}
              onPress={() => handleOpenCreateModal(preset)}
              activeOpacity={0.85}
            >
              <View style={styles.presetHeader}>
                <Ionicons name="sparkles" size={14} color="#F59E0B" />
                <Text style={styles.presetTitle}>{preset.title}</Text>
              </View>
              <Text style={styles.presetDesc} numberOfLines={2}>
                {preset.desc}
              </Text>
              <View style={styles.presetUseRow}>
                <Text style={styles.presetUseText}>Use Preset →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── TEMPLATES LIST ── */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFC700" />
          <Text style={styles.loadingText}>Fetching templates from Meta...</Text>
        </View>
      ) : templates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="chatbubbles-outline" size={32} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No WhatsApp Templates Yet</Text>
          <Text style={styles.emptyDesc}>
            Create custom broadcast templates or pick from presets above. Meta AI approves them in 1–2 minutes!
          </Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => handleOpenCreateModal()} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#050505" style={{ marginRight: 4 }} />
            <Text style={styles.createBtnText}>Create First Template</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.templateGrid}>
          {templates.map((tpl, idx) => {
            const isExpanded = expandedTemplateId === (tpl.id || tpl.name || String(idx));
            return (
              <TouchableOpacity
                key={tpl.id || tpl.name || idx}
                activeOpacity={0.9}
                onPress={() => setExpandedTemplateId(isExpanded ? null : (tpl.id || tpl.name || String(idx)))}
                style={[
                  styles.templateCard,
                  isExpanded && styles.templateCardExpanded
                ]}
              >
                <View style={styles.templateCardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.templateCardName}>{tpl.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <Text style={styles.templateCategory}>{tpl.category}</Text>
                      <Text style={styles.templateCategory}>• {tpl.language}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {getStatusBadge(tpl.status)}
                    <View style={styles.chevronBox}>
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color="#94A3B8" 
                      />
                    </View>
                  </View>
                </View>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {tpl.rejectedReason && (
                      <View style={styles.rejectionBox}>
                        <Ionicons name="alert-circle" size={14} color="#DC2626" />
                        <Text style={styles.rejectionText}>{tpl.rejectedReason}</Text>
                      </View>
                    )}

                    {/* WhatsApp Mockup Preview */}
                    <View style={styles.whatsappMockupContainer}>
                      <View style={styles.whatsappMockupHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={styles.whatsappAvatar}>
                            <Text style={styles.whatsappAvatarText}>R</Text>
                          </View>
                          <Text style={styles.whatsappNameText}>Risev Merchant</Text>
                          <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                        </View>
                      </View>
                      <View style={styles.whatsappMockupBody}>
                        <View style={styles.whatsappChatBubble}>
                          {tpl.headerText && (
                            <Text style={styles.whatsappBubbleHeader}>{tpl.headerText}</Text>
                          )}
                          <Text style={styles.whatsappBubbleText}>
                            {tpl.bodyText}
                          </Text>
                          {tpl.footerText && (
                            <Text style={styles.whatsappBubbleFooter}>{tpl.footerText}</Text>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Footer Actions */}
                    <View style={styles.templateCardFooter}>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteTemplate(tpl.name)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        <Text style={styles.deleteBtnText}>Delete Template</Text>
                      </TouchableOpacity>

                      {onSelectTemplateForBroadcast && tpl.status === 'APPROVED' && (
                        <TouchableOpacity
                          style={styles.useInBlastBtn}
                          onPress={() => onSelectTemplateForBroadcast(tpl)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="paper-plane" size={14} color="#050505" style={{ marginRight: 4 }} />
                          <Text style={styles.useInBlastBtnText}>Use for Broadcast</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── CREATE / EDIT TEMPLATE MODAL ── */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDesktop && { maxWidth: 980 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.modalIconBg}>
                  <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Create WhatsApp Template</Text>
                  <Text style={styles.modalSub}>Submitted to Meta AI for instant 1-2 min approval</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Not connected notice in modal */}
            {!isConnected && (
              <View style={styles.modalNotConnectedNotice}>
                <Ionicons name="alert-circle" size={16} color="#B45309" />
                <Text style={styles.modalNotConnectedText}>
                  WhatsApp is not connected yet. Connect your number in Settings to submit this template to Meta AI.
                </Text>
              </View>
            )}

            {formError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            ) : null}

            {/* Split Content: Left Editor | Right Live WhatsApp Bubble */}
            <ScrollView 
              style={{ flex: 1 }} 
              showsVerticalScrollIndicator={true} 
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 20, paddingBottom: 60, flexGrow: 1 }}
            >
              <View style={[styles.splitEditorLayout, isDesktop && { flexDirection: 'row', gap: 24 }]}>
                {/* ── LEFT: FORM INPUTS ── */}
                <View style={[styles.editorColumn, isDesktop && { flex: 1.2 }]}>
                  {/* Template Name */}
                  <Text style={styles.inputLabel}>TEMPLATE NAME (LOWERCASE & UNDERSCORES)</Text>
                  <TextInput
                    style={[styles.inputField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                    placeholder="e.g. weekend_flash_sale"
                    placeholderTextColor="#94A3B8"
                    value={formName}
                    onChangeText={(t) => setFormName(t.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    autoCapitalize="none"
                  />

                  {/* Category & Language */}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>CATEGORY</Text>
                      <View style={styles.categoryToggleRow}>
                        <TouchableOpacity
                          style={[styles.togglePill, formCategory === 'MARKETING' && styles.togglePillActive]}
                          onPress={() => setFormCategory('MARKETING')}
                        >
                          <Text style={[styles.togglePillText, formCategory === 'MARKETING' && styles.togglePillTextActive]}>
                            Marketing
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.togglePill, formCategory === 'UTILITY' && styles.togglePillActive]}
                          onPress={() => setFormCategory('UTILITY')}
                        >
                          <Text style={[styles.togglePillText, formCategory === 'UTILITY' && styles.togglePillTextActive]}>
                            Utility
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>LANGUAGE</Text>
                      <View style={styles.categoryToggleRow}>
                        <TouchableOpacity
                          style={[styles.togglePill, formLanguage === 'en_US' && styles.togglePillActive]}
                          onPress={() => setFormLanguage('en_US')}
                        >
                          <Text style={[styles.togglePillText, formLanguage === 'en_US' && styles.togglePillTextActive]}>
                            English (en)
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.togglePill, formLanguage === 'ms' && styles.togglePillActive]}
                          onPress={() => setFormLanguage('ms')}
                        >
                          <Text style={[styles.togglePillText, formLanguage === 'ms' && styles.togglePillTextActive]}>
                            Melayu (ms)
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Header (Optional) */}
                  <Text style={[styles.inputLabel, { marginTop: 14 }]}>HEADER TEXT (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.inputField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                    placeholder="e.g. Special Weekend Announcement 📣"
                    placeholderTextColor="#94A3B8"
                    value={formHeader}
                    onChangeText={setFormHeader}
                  />

                  {/* Body Text & Dynamic Variable Inserter */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <Text style={styles.inputLabel}>MESSAGE BODY</Text>
                    <Text style={styles.charCounter}>{formBody.length}/1024</Text>
                  </View>

                  {/* Quick Variable Inserter Chips */}
                  <View style={styles.variableChipsRow}>
                    <Text style={styles.chipsLabel}>Tap to insert variable:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {Object.keys(sampleData).map((chip) => (
                        <TouchableOpacity
                          key={chip}
                          style={styles.chipBtn}
                          onPress={() => insertVariable(chip)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add-circle" size={13} color="#D97706" style={{ marginRight: 3 }} />
                          <Text style={styles.chipBtnText}>{chip}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <TextInput
                    style={[
                      styles.textAreaField,
                      Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null,
                    ]}
                    multiline
                    numberOfLines={6}
                    placeholder="Write your template message body..."
                    placeholderTextColor="#94A3B8"
                    value={formBody}
                    onChangeText={setFormBody}
                    textAlignVertical="top"
                  />

                  {/* Footer Text (Optional) */}
                  <Text style={[styles.inputLabel, { marginTop: 14 }]}>FOOTER TEXT (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.inputField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                    placeholder="e.g. Reply STOP to unsubscribe"
                    placeholderTextColor="#94A3B8"
                    value={formFooter}
                    onChangeText={setFormFooter}
                  />
                </View>

                {/* ── RIGHT: REALISTIC LIVE WHATSAPP CHAT PREVIEW ── */}
                <View style={[styles.previewColumn, isDesktop && { flex: 0.95 }]}>
                  <Text style={styles.inputLabel}>REAL-TIME WHATSAPP PREVIEW</Text>
                  <View style={styles.whatsappPhoneMock}>
                    {/* WhatsApp Chat Header */}
                    <View style={styles.whatsappChatHeader}>
                      <View style={styles.whatsappAvatar}>
                        <Ionicons name="storefront" size={14} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.whatsappHeaderName}>Your Store</Text>
                        <Text style={styles.whatsappHeaderStatus}>Official WhatsApp Business</Text>
                      </View>
                      <Ionicons name="shield-checkmark" size={16} color="#22C55E" />
                    </View>

                    {/* Chat Bubble Area */}
                    <View style={styles.chatAreaBackground}>
                      <View style={styles.datePill}>
                        <Text style={styles.datePillText}>TODAY</Text>
                      </View>

                      {/* Green Inbound WhatsApp Bubble */}
                      <View style={styles.whatsappMessageBubble}>
                        {formHeader.trim() ? (
                          <Text style={styles.whatsappBubbleHeader}>{formHeader.trim()}</Text>
                        ) : null}

                        <Text style={styles.whatsappBubbleText}>{getLivePreviewBody()}</Text>

                        {formFooter.trim() ? (
                          <Text style={styles.whatsappBubbleFooter}>{formFooter.trim()}</Text>
                        ) : null}

                        <View style={styles.whatsappTimestampRow}>
                          <Text style={styles.whatsappTimestamp}>
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Ionicons name="checkmark-done" size={14} color="#38BDF8" style={{ marginLeft: 3 }} />
                        </View>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.previewCaption}>
                    ✨ Variable placeholders automatically populate with each customer's real name and stamp count when sent.
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreateTemplate}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#050505" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={16} color="#050505" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSubmitText}>Submit for Instant Approval</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 16,
  },
  headerContainer: {
    width: '100%',
    marginBottom: 20,
    gap: 14,
  },
  headerTextWrap: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 6,
    lineHeight: 19,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  refreshBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  createBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFC700',
    height: 48,
    borderRadius: 14,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  createBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  notConnectedBanner: {
    backgroundColor: '#050505',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 14,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  notConnectedLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notConnectedIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notConnectedTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  notConnectedDesc: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 18,
  },
  connectMetaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFC700',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  connectMetaBtnText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  modalNotConnectedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  modalNotConnectedText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
    lineHeight: 16,
  },
  presetsSection: {
    marginBottom: 24,
  },
  presetSectionTitle: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 2,
  },
  presetsScroll: {
    gap: 12,
  },
  presetCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F8FAFC',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  presetTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  presetDesc: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 12,
  },
  presetUseRow: {
    marginTop: 'auto',
  },
  presetUseText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 12,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 380,
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  templateGrid: {
    gap: 14,
    marginTop: 8,
  },
  templateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  templateCardExpanded: {
    borderColor: '#FFC700',
    backgroundColor: '#FFFDF5',
  },
  templateCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateCardName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  templateCategory: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  chevronBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#FEE685',
    paddingTop: 16,
  },
  whatsappMockupContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  whatsappMockupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#050505',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  whatsappAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  whatsappAvatarText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  whatsappNameText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  whatsappMockupBody: {
    padding: 10,
  },
  whatsappChatBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    maxWidth: '90%',
    alignSelf: 'flex-start',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  whatsappBubbleHeader: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  whatsappBubbleText: {
    fontSize: 11.5,
    color: '#0F172A',
    lineHeight: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  whatsappBubbleFooter: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_500Medium',
    marginTop: 4,
  },
  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  rejectionText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#DC2626',
    flex: 1,
  },
  templateCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#FEE685',
    paddingTop: 12,
  },
  useInBlastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC700',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  useInBlastBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  deleteBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#EF4444',
  },

  /* ── MODAL STYLES ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    height: '88%',
    maxHeight: '90%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  modalSub: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNotConnectedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#050505',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  modalNotConnectedText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 10,
  },
  errorBannerText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#DC2626',
    flex: 1,
  },
  splitEditorLayout: {},
  editorColumn: {},
  previewColumn: {
    marginTop: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  textAreaField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#050505',
    minHeight: 120,
  },
  charCounter: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  categoryToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
    gap: 4,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  togglePillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  togglePillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  togglePillTextActive: {
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  variableChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  chipsLabel: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
    marginBottom: 8,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE38F',
  },
  chipBtnText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },

  /* WhatsApp Phone Mock */
  whatsappPhoneMock: {
    backgroundColor: '#ECE5DD',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  whatsappChatHeader: {
    backgroundColor: '#075E54',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  whatsappAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappHeaderName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  whatsappHeaderStatus: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#A7F3D0',
  },
  chatAreaBackground: {
    padding: 16,
    minHeight: 200,
  },
  datePill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  datePillText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  whatsappMessageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#E7FFDB',
    borderRadius: 14,
    borderTopLeftRadius: 3,
    padding: 12,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  whatsappBubbleHeader: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 6,
  },
  whatsappBubbleText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1E293B',
    lineHeight: 18,
  },
  whatsappBubbleFooter: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 6,
  },
  whatsappTimestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  whatsappTimestamp: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  previewCaption: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 8,
    lineHeight: 16,
  },

  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFC700',
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modalSubmitText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
});
