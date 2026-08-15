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
  Image,
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
  headerFormat?: 'TEXT' | 'IMAGE';
  headerImageUrl?: string;
  footerText?: string;
  buttons?: Array<{ type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY'; text: string; url?: string; phoneNumber?: string }>;
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
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

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
    if (preset) {
      router.push({
        pathname: '/(merchant)/create-template',
        params: {
          presetName: preset.name,
          presetCategory: preset.category,
          presetHeader: preset.header,
          presetBody: preset.body,
          presetFooter: preset.footer,
        },
      });
    } else {
      router.push('/(merchant)/create-template');
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

  const getLivePreviewBody = (bodyText?: string) => {
    let preview = bodyText || 'Your message will appear here...';
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
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.templateCardName} numberOfLines={1}>{tpl.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                      <View style={styles.tagPill}>
                        <Text style={styles.tagPillText}>🏷️ {tpl.category}</Text>
                      </View>
                      <View style={styles.tagPill}>
                        <Text style={styles.tagPillText}>🌐 {tpl.language}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {getStatusBadge(tpl.status)}
                    <View style={[styles.chevronBox, isExpanded && styles.chevronBoxExpanded]}>
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={14} 
                        color={isExpanded ? "#050505" : "#64748B"} 
                      />
                    </View>
                  </View>
                </View>

                {isExpanded ? (
                  <View style={styles.expandedContent}>
                    {tpl.rejectedReason ? (
                      <View style={styles.rejectionBox}>
                        <Ionicons name="alert-circle" size={14} color="#DC2626" />
                        <Text style={styles.rejectionText}>{tpl.rejectedReason}</Text>
                      </View>
                    ) : null}

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
                          {(tpl.headerFormat === 'IMAGE' || tpl.headerImageUrl) ? (
                            <Image
                              source={{ uri: tpl.headerImageUrl || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=600' }}
                              style={{ width: '100%', height: 120, borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
                              resizeMode="cover"
                            />
                          ) : tpl.headerText ? (
                            <Text style={styles.whatsappBubbleHeader}>{tpl.headerText}</Text>
                          ) : null}
                          <View style={{ padding: 10 }}>
                            <Text style={styles.whatsappBubbleText}>
                              {getLivePreviewBody(tpl.bodyText)}
                            </Text>
                            {tpl.footerText ? (
                              <Text style={styles.whatsappBubbleFooter}>{tpl.footerText}</Text>
                            ) : null}
                            <View style={styles.whatsappTimestampRow}>
                              <Text style={styles.whatsappTimestamp}>12:00 PM</Text>
                              <Ionicons name="checkmark-done" size={12} color="#34B7F1" style={{ marginLeft: 3 }} />
                            </View>
                          </View>
                        </View>

                        {/* Interactive Buttons */}
                        {tpl.buttons && tpl.buttons.length > 0 ? (
                          <View style={{ marginTop: 4, gap: 4 }}>
                            {tpl.buttons.map((b, bIdx) => (
                              <View
                                key={bIdx}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#FFFFFF',
                                  borderRadius: 8,
                                  paddingVertical: 8,
                                  paddingHorizontal: 10,
                                  borderWidth: 1,
                                  borderColor: '#E2E8F0',
                                }}
                              >
                                {b.type === 'URL' && <Ionicons name="open-outline" size={12} color="#0284C7" style={{ marginRight: 5 }} />}
                                {b.type === 'PHONE_NUMBER' && <Ionicons name="call-outline" size={12} color="#0284C7" style={{ marginRight: 5 }} />}
                                {b.type === 'QUICK_REPLY' && <Ionicons name="return-up-back-outline" size={12} color="#0284C7" style={{ marginRight: 5 }} />}
                                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#0284C7' }}>
                                  {b.text}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
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

                      {onSelectTemplateForBroadcast && tpl.status === 'APPROVED' ? (
                        <TouchableOpacity
                          style={styles.useInBlastBtn}
                          onPress={() => onSelectTemplateForBroadcast(tpl)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="paper-plane" size={14} color="#050505" style={{ marginRight: 4 }} />
                          <Text style={styles.useInBlastBtnText}>Use for Broadcast</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 16,
    paddingBottom: 160,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    backgroundColor: '#FFC700',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  notConnectedIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notConnectedTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 2,
  },
  notConnectedDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    opacity: 0.85,
    lineHeight: 16,
  },
  connectMetaBtn: {
    backgroundColor: '#050505',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    flexShrink: 0,
  },
  connectMetaBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
  },
  presetSectionSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
  },
  presetsScroll: {
    gap: 12,
  },
  presetCard: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    justifyContent: 'space-between',
  },
  presetCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  presetIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetCategoryBadge: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetCategoryText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  presetTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  presetDesc: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 12,
  },
  presetUseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FDE68A',
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
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  templateCardExpanded: {
    borderColor: '#FFC700',
    backgroundColor: '#FFFDF5',
    shadowColor: '#FFC700',
    shadowOpacity: 0.1,
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
    letterSpacing: -0.2,
  },
  tagPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagPillText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronBoxExpanded: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
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
    shadowOpacity: 0.05,
    shadowRadius: 3,
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
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
    shadowOpacity: 0.1,
    shadowRadius: 10,
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
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
