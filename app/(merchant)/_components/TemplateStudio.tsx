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
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

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
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
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
              <ActivityIndicator size="small" color="#050505" />
            ) : (
              <>
                <Ionicons name="sync" size={16} color="#050505" style={{ marginRight: 6 }} />
                <Text style={styles.refreshBtnText}>Sync Status</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => handleOpenCreateModal()}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#050505" style={{ marginRight: 4 }} />
            <Text style={styles.createBtnText}>New Template</Text>
          </TouchableOpacity>
        </View>
      </View>

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
                <Ionicons name="sparkles" size={14} color="#FFC700" />
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
          {templates.map((tpl, idx) => (
            <View key={tpl.id || tpl.name || idx} style={styles.templateCard}>
              <View style={styles.templateCardHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.templateCardName}>{tpl.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
                    <Text style={styles.templateCategory}>{tpl.category}</Text>
                    <Text style={styles.templateCategory}>• {tpl.language}</Text>
                  </View>
                </View>
                {getStatusBadge(tpl.status)}
              </View>

              {tpl.headerText ? (
                <Text style={styles.templatePreviewHeader} numberOfLines={1}>
                  {tpl.headerText}
                </Text>
              ) : null}

              <Text style={styles.templatePreviewBody} numberOfLines={4}>
                {tpl.bodyText}
              </Text>

              {tpl.footerText ? (
                <Text style={styles.templatePreviewFooter} numberOfLines={1}>
                  {tpl.footerText}
                </Text>
              ) : null}

              {tpl.rejectedReason && (
                <View style={styles.rejectionBox}>
                  <Ionicons name="alert-circle" size={14} color="#DC2626" />
                  <Text style={styles.rejectionText}>{tpl.rejectedReason}</Text>
                </View>
              )}

              {/* Template Card Footer */}
              <View style={styles.templateCardFooter}>
                {onSelectTemplateForBroadcast && tpl.status === 'APPROVED' ? (
                  <TouchableOpacity
                    style={styles.useInBlastBtn}
                    onPress={() => onSelectTemplateForBroadcast(tpl)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="paper-plane-outline" size={14} color="#050505" style={{ marginRight: 4 }} />
                    <Text style={styles.useInBlastBtnText}>Use in Broadcast</Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteTemplate(tpl.name)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── CREATE / EDIT TEMPLATE MODAL ── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDesktop && { maxWidth: 980, maxHeight: '90%' }]}>
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

            {formError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            ) : null}

            {/* Split Content: Left Editor | Right Live WhatsApp Bubble */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC700',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  createBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  presetsSection: {
    marginBottom: 24,
  },
  presetSectionTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 10,
  },
  presetsScroll: {
    gap: 12,
  },
  presetCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  presetTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  presetDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 10,
  },
  presetUseRow: {
    marginTop: 'auto',
  },
  presetUseText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  templateCard: {
    flex: 1,
    minWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  templateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  templatePreviewHeader: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  templatePreviewBody: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
  },
  templatePreviewFooter: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginBottom: 12,
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
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 'auto',
  },
  useInBlastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  useInBlastBtnText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
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
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  textAreaField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0F172A',
    minHeight: 120,
  },
  charCounter: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  categoryToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  togglePillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  togglePillText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  togglePillTextActive: {
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  variableChipsRow: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  chipsLabel: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
    marginBottom: 6,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  chipBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancelText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC700',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  modalSubmitText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
});
