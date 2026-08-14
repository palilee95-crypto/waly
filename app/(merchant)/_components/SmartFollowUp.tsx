import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';

type Props = {
  styles?: any;
  Alert?: any;
};

interface AutopilotRecipe {
  id: string;
  title: string;
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  defaultDays: number;
  defaultHours: number;
  defaultMinutes: number;
  triggerDescription: string;
  defaultBody: string;
}

const AUTOPILOT_RECIPES: AutopilotRecipe[] = [
  {
    id: 'recipe_winback',
    title: '14-Day Customer Win-Back',
    badge: 'WIN-BACK',
    icon: 'refresh',
    iconBg: '#FFFBEB',
    iconColor: '#D97706',
    defaultDays: 14,
    defaultHours: 0,
    defaultMinutes: 0,
    triggerDescription: 'Auto-sends 14 days after last visit',
    defaultBody: `Hi {Customer Name}! 👋\n\nWe haven't seen you at {Store Name} in a while. Drop by this week to collect your next stamp and enjoy a special treat on us! ✨`,
  },
  {
    id: 'recipe_birthday',
    title: 'Birthday Reward Treat',
    badge: 'BIRTHDAY',
    icon: 'gift',
    iconBg: '#FDF2F8',
    iconColor: '#DB2777',
    defaultDays: 0,
    defaultHours: 9,
    defaultMinutes: 0,
    triggerDescription: 'Sends on morning of customer birthday',
    defaultBody: `Happy Birthday, {Customer Name}! 🎂🎉\n\nTo celebrate your special day, enjoy a free birthday reward at {Store Name} this week! 🎁 Show this message to claim.`,
  },
  {
    id: 'recipe_almost_reward',
    title: 'Close-to-Reward Reminder',
    badge: 'MILESTONE',
    icon: 'trophy',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    defaultDays: 3,
    defaultHours: 0,
    defaultMinutes: 0,
    triggerDescription: 'Auto-sends 3 days after visit for near-reward customers',
    defaultBody: `Hi {Customer Name}! 🎯\n\nYou are only a few stamps away from unlocking your free reward at {Store Name}! Drop by soon to claim it. ✨`,
  },
  {
    id: 'recipe_thankyou',
    title: 'Post-Visit Gratitude & Review',
    badge: 'THANK YOU',
    icon: 'heart',
    iconBg: '#EEF2FF',
    iconColor: '#4F46E5',
    defaultDays: 0,
    defaultHours: 2,
    defaultMinutes: 0,
    triggerDescription: 'Auto-sends 2 hours after counter stamp collection',
    defaultBody: `Thank you for visiting {Store Name} today, {Customer Name}! ✨\n\nWe hope you had a great time. Let us know how we did or see you on your next visit!`,
  },
];

export default function SmartFollowUp({ styles: s }: Props) {
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [smartGroups, setSmartGroups] = useState<any[]>([]);
  const [merchant, setMerchant] = useState<any>(null);
  const [merchantName, setMerchantName] = useState('Your Shop');
  const [isLoading, setIsLoading] = useState(true);
  const [togglingRecipeId, setTogglingRecipeId] = useState<string | null>(null);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  // Customization Modal State
  const [editingRecipe, setEditingRecipe] = useState<AutopilotRecipe | null>(null);
  const [customDays, setCustomDays] = useState('14');
  const [customBody, setCustomBody] = useState('');
  const [isSavingCustom, setIsSavingCustom] = useState(false);

  // Stats
  const [queueCount, setQueueCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);

  // Load Merchant
  useEffect(() => {
    if (user?.merchant_id) {
      pb.collection('merchants').getOne(user.merchant_id)
        .then(rec => {
          if (rec) {
            setMerchant(rec);
            if (rec.name) setMerchantName(rec.name);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const merchantLogo = merchant?.logo
    ? pb.files.getURL(merchant, merchant.logo)
    : null;

  // Fetch Existing Smart Groups
  const fetchGroups = useCallback(async () => {
    if (!user?.merchant_id) return;
    try {
      setIsLoading(true);
      const records = await pb.collection('follow_up_groups').getFullList({
        filter: 'merchant = "' + user.merchant_id + '"',
        sort: '-created',
        requestKey: null,
      });
      setSmartGroups(records);

      try {
        const queueRecs = await pb.collection('follow_up_members').getList(1, 1, {
          filter: 'group.merchant = "' + user.merchant_id + '" && status = "enrolled"',
          requestKey: null,
        });
        setQueueCount(queueRecs.totalItems);

        const logsRecs = await pb.collection('follow_up_logs').getList(1, 1, {
          filter: 'group.merchant = "' + user.merchant_id + '" && status = "sent"',
          requestKey: null,
        });
        setSentCount(logsRecs.totalItems);
      } catch (_) {}
    } catch (err) {
      console.warn('[SmartFollowUp] Failed to fetch groups:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Find associated group record for a recipe
  const getRecipeGroup = (recipeId: string) => {
    const r = AUTOPILOT_RECIPES.find(x => x.id === recipeId);
    return smartGroups.find(g => g.name === r?.title);
  };

  // Is Recipe currently Active?
  const isRecipeActive = (recipeId: string) => {
    const grp = getRecipeGroup(recipeId);
    return grp ? grp.status === 'active' : false;
  };

  // Toggle Recipe ON/OFF
  const handleToggleRecipe = async (recipe: AutopilotRecipe) => {
    setTogglingRecipeId(recipe.id);

    try {
      const res = await pb.send<{ success: boolean; status: string; message: string }>(
        '/api/risev/merchant/smart-follow-up/toggle',
        {
          method: 'POST',
          body: {
            recipeId: recipe.id,
            title: recipe.title,
            defaultDays: recipe.defaultDays,
            defaultHours: recipe.defaultHours,
            defaultMinutes: recipe.defaultMinutes,
            defaultBody: recipe.defaultBody,
          },
          requestKey: null,
        }
      );

      if (res.success) {
        await fetchGroups();
        Alert.alert(
          res.status === 'active' ? 'Follow-Up Activated ✨' : 'Follow-Up Paused ⏸️',
          res.status === 'active'
            ? '"' + recipe.title + '" is now sending automatically.'
            : '"' + recipe.title + '" has been paused.'
        );
      } else {
        Alert.alert('Notice', res.message || 'Failed to update follow-up status.');
      }
    } catch (err: any) {
      console.warn('[SmartFollowUp Toggle Error]:', err);
      Alert.alert('Error', err?.message || 'Failed to update automation status.');
    } finally {
      setTogglingRecipeId(null);
    }
  };

  // Open Customize Modal
  const handleOpenCustomize = async (recipe: AutopilotRecipe) => {
    setEditingRecipe(recipe);
    const existingGroup = getRecipeGroup(recipe.id);

    if (existingGroup) {
      try {
        const sequences = await pb.collection('follow_up_sequences').getFullList({
          filter: 'group = "' + existingGroup.id + '"',
          sort: 'order',
          requestKey: null,
        });
        if (sequences.length > 0) {
          setCustomDays(String(sequences[0].send_after_days ?? recipe.defaultDays));
          const messages = await pb.collection('follow_up_messages').getFullList({
            filter: 'sequence = "' + sequences[0].id + '"',
            requestKey: null,
          });
          if (messages.length > 0 && messages[0].message_body) {
            setCustomBody(messages[0].message_body);
            return;
          }
        }
      } catch (_) {}
    }

    setCustomDays(String(recipe.defaultDays));
    setCustomBody(recipe.defaultBody);
  };

  // Save Customization
  const handleSaveCustomize = async () => {
    if (!editingRecipe) return;
    setIsSavingCustom(true);

    try {
      const daysNum = Math.max(0, parseInt(customDays, 10) || editingRecipe.defaultDays);
      const res = await pb.send<{ success: boolean; message: string }>(
        '/api/risev/merchant/smart-follow-up/save',
        {
          method: 'POST',
          body: {
            recipeId: editingRecipe.id,
            title: editingRecipe.title,
            days: daysNum,
            body: customBody.trim(),
            defaultHours: editingRecipe.defaultHours,
            defaultMinutes: editingRecipe.defaultMinutes,
          },
          requestKey: null,
        }
      );

      if (res.success) {
        await fetchGroups();
        setEditingRecipe(null);
        Alert.alert('Saved! ✨', '"' + editingRecipe.title + '" has been updated.');
      } else {
        Alert.alert('Notice', res.message || 'Failed to save follow-up.');
      }
    } catch (err: any) {
      console.warn('[SmartFollowUp Save Error]:', err);
      Alert.alert('Error', err?.message || 'Failed to save customized message.');
    } finally {
      setIsSavingCustom(false);
    }
  };

  const insertVariable = (tag: string) => {
    setCustomBody(prev => prev + tag);
  };

  // Helper to render preview body
  const getLivePreview = (text: string) => {
    return (text || '')
      .replace(/\{Customer Name\}/g, 'Hashiff')
      .replace(/\{Store Name\}/g, merchantName || 'Risev Coffee')
      .replace(/\{Stamp Balance\}/g, '8')
      .replace(/\{Reward Item\}/g, 'Free Iced Latte');
  };

  return (
    <View style={styles.container}>
      {/* ── TOP HERO BANNER & METRICS ── */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color="#FFC700" />
            <Text style={styles.heroBadgeText}>AUTO-PILOT</Text>
          </View>
          <TouchableOpacity onPress={fetchGroups} style={styles.refreshBtn} activeOpacity={0.7}>
            <Ionicons name="refresh" size={14} color="#FFC700" />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroTitle}>Automated Follow-Ups</Text>
        <Text style={styles.heroSubtitle}>
          Engage customers on WhatsApp automatically after visits, milestones & birthdays.
        </Text>

        {/* Live Metrics Grid */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {smartGroups.filter(g => g.status === 'active').length} / {AUTOPILOT_RECIPES.length}
            </Text>
            <Text style={styles.metricLabel}>Active Rules</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{queueCount}</Text>
            <Text style={styles.metricLabel}>Queued</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{sentCount}</Text>
            <Text style={styles.metricLabel}>Sent</Text>
          </View>
        </View>
      </View>

      {/* ── RECIPES LIST ── */}
      <View style={styles.recipesSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>FOLLOW-UP RULES</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FFC700" />
            <Text style={styles.loadingText}>Loading follow-up rules...</Text>
          </View>
        ) : (
          <View style={styles.recipeGrid}>
            {AUTOPILOT_RECIPES.map((recipe) => {
              const isActive = isRecipeActive(recipe.id);
              const isToggling = togglingRecipeId === recipe.id;
              const isExpanded = expandedRecipeId === recipe.id;

              return (
                <TouchableOpacity 
                  key={recipe.id} 
                  activeOpacity={0.9}
                  onPress={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}
                  style={[
                    styles.recipeCard, 
                    isExpanded && styles.recipeCardExpanded
                  ]}
                >
                  {/* Top Header Row: Icon + Title + Switch */}
                  <View style={styles.recipeTopRow}>
                    <View style={styles.recipeIconWrap}>
                      <View style={[styles.recipeIconBox, { backgroundColor: recipe.iconBg }]}>
                        <Ionicons name={recipe.icon} size={20} color={recipe.iconColor} />
                      </View>
                      <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                        <Text style={styles.triggerInfoTextSmall} numberOfLines={1}>
                          {recipe.triggerDescription}
                        </Text>
                      </View>
                    </View>

                    {/* Right side: Switch + Chevron */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ transform: [{ scale: 0.8 }] }}>
                        {isToggling ? (
                          <ActivityIndicator size="small" color="#FFC700" />
                        ) : (
                          <Switch
                            value={isActive}
                            onValueChange={() => handleToggleRecipe(recipe)}
                            trackColor={{ false: '#E2E8F0', true: '#FFC700' }}
                            thumbColor={isActive ? '#050505' : '#FFFFFF'}
                            ios_backgroundColor="#E2E8F0"
                          />
                        )}
                      </View>
                      <View style={[styles.chevronBox, { opacity: 0.5 }]}>
                        <Ionicons 
                          name={isExpanded ? "chevron-up" : "chevron-down"} 
                          size={18} 
                          color="#94A3B8" 
                        />
                      </View>
                    </View>
                  </View>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {/* Trigger Info Box */}
                      <View style={styles.triggerInfoBox}>
                        <Ionicons name="flash" size={13} color="#D97706" />
                        <Text style={styles.triggerInfoText}>{recipe.triggerDescription}</Text>
                      </View>

                      {/* WhatsApp Device Mockup Container */}
                      <View style={styles.whatsappMockupContainer}>
                        {/* Header: Dark Risev Style */}
                        <View style={styles.whatsappMockupHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Ionicons name="arrow-back" size={14} color="#FFFFFF" />
                            <View style={styles.whatsappAvatar}>
                              {merchantLogo ? (
                                <Image source={{ uri: merchantLogo }} style={{ width: 22, height: 22, borderRadius: 11 }} resizeMode="cover" />
                              ) : (
                                <Text style={styles.whatsappAvatarText}>
                                  {(merchantName || 'R').substring(0, 1).toUpperCase()}
                                </Text>
                              )}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                              <Text style={styles.whatsappNameText} numberOfLines={1}>
                                {merchantName || 'Risev Merchant'}
                              </Text>
                              <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                            </View>
                          </View>
                          <Ionicons name="ellipsis-vertical" size={14} color="#FFFFFF" />
                        </View>

                        {/* Chat Bubble Body */}
                        <View style={styles.whatsappMockupBody}>
                          <View style={styles.whatsappChatBubble}>
                            <Text style={styles.whatsappBubbleText}>
                              {getLivePreview(recipe.defaultBody)}
                            </Text>
                            <View style={styles.whatsappBubbleFooter}>
                              <Text style={styles.whatsappBubbleTime}>
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                              <Ionicons name="checkmark-done" size={12} color="#0EA5E9" />
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Action Bar Footer */}
                      <View style={[styles.recipeFooter, { justifyContent: 'flex-end', paddingTop: 16 }]}>

                        <TouchableOpacity
                          style={styles.customizeBtn}
                          onPress={() => handleOpenCustomize(recipe)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="create-outline" size={13} color="#050505" />
                          <Text style={styles.customizeBtnText}>Edit Msg & Delay</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* ── CUSTOMIZE RECIPE MODAL ── */}
      {editingRecipe && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setEditingRecipe(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{editingRecipe.title}</Text>
                  <Text style={styles.modalSubtitle}>Customize trigger delay & WhatsApp message template</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditingRecipe(null)}
                  style={styles.modalCloseBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color="#050505" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Delay setting */}
                <Text style={styles.inputLabel}>TRIGGER DELAY (DAYS)</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="time-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={customDays}
                    onChangeText={setCustomDays}
                    keyboardType="numeric"
                    placeholder="e.g. 14"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>Days after visit</Text>
                </View>

                {/* Message Body */}
                <Text style={[styles.inputLabel, { marginTop: 16 }]}>WHATSAPP MESSAGE</Text>
                <TextInput
                  style={styles.textArea}
                  value={customBody}
                  onChangeText={setCustomBody}
                  multiline
                  numberOfLines={4}
                  placeholder="Write your follow-up message..."
                  placeholderTextColor="#94A3B8"
                />

                {/* Variable Tags */}
                <Text style={styles.tagHelperLabel}>Tap to insert variable:</Text>
                <View style={styles.tagsRow}>
                  {['{Customer Name}', '{Store Name}', '{Stamp Balance}', '{Reward Item}'].map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => insertVariable(tag)}
                      style={styles.tagPill}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.tagPillText}>+ {tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Live Preview Box */}
                <Text style={[styles.inputLabel, { marginTop: 18 }]}>LIVE PREVIEW</Text>
                <View style={styles.whatsappMockupContainer}>
                  <View style={styles.whatsappMockupHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={styles.whatsappAvatar}>
                        {merchantLogo ? (
                          <Image source={{ uri: merchantLogo }} style={{ width: 20, height: 20, borderRadius: 10 }} resizeMode="cover" />
                        ) : (
                          <Text style={styles.whatsappAvatarText}>
                            {(merchantName || 'R').substring(0, 1).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.whatsappNameText}>{merchantName || 'Risev Merchant'}</Text>
                      <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                    </View>
                  </View>
                  <View style={styles.whatsappMockupBody}>
                    <View style={styles.whatsappChatBubble}>
                      <Text style={styles.whatsappBubbleText}>
                        {getLivePreview(customBody)}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Modal Actions */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditingRecipe(null)}
                  disabled={isSavingCustom}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveCustomize}
                  disabled={isSavingCustom}
                  activeOpacity={0.85}
                >
                  {isSavingCustom ? (
                    <ActivityIndicator size="small" color="#050505" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save & Update</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 24,
  },
  heroCard: {
    backgroundColor: '#FFC700',
    borderRadius: 24,
    padding: 20,
    borderWidth: 0,
    marginBottom: 20,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#050505',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
    letterSpacing: 0.5,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#050505',
    borderWidth: 0,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#422006',
    lineHeight: 20,
    marginBottom: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  recipesSection: {
    width: '100%',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  recipeGrid: {
    gap: 14,
  },
  recipeCard: {
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
  recipeCardExpanded: {
    borderColor: '#FFC700',
    backgroundColor: '#FFFDF5',
  },
  recipeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  recipeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeTitle: {
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  recipeBadgePill: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recipeBadgeText: {
    fontSize: 8.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#D97706',
    letterSpacing: 0.4,
  },
  triggerInfoTextSmall: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  chevronBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#FEE685',
    paddingTop: 16,
  },
  triggerInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEE685',
  },
  triggerInfoText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },

  // Risev WhatsApp Mockup
  whatsappMockupContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 20,
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
  whatsappBubbleText: {
    fontSize: 11.5,
    color: '#0F172A',
    lineHeight: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  whatsappBubbleFooter: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  whatsappBubbleTime: {
    fontSize: 8.5,
    color: '#94A3B8',
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  // Footer & Actions
  recipeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  activeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  customizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFC700',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  customizeBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    maxHeight: 450,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#050505',
    minHeight: 110,
    textAlignVertical: 'top',
  },
  tagHelperLabel: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
    marginTop: 10,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE38F',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagPillText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
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
  },
  modalCancelText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: '#FFC700',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
});
