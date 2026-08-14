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
  useWindowDimensions,
  Platform,
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
    badge: 'HIGH REVENUE',
    icon: 'refresh-circle',
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    defaultDays: 14,
    defaultHours: 0,
    defaultMinutes: 0,
    triggerDescription: 'Triggers automatically after 14 days with no counter visit',
    defaultBody: 'Hi {Customer Name}! 👋\n\nWe haven\'t seen you at {Store Name} in a while. Drop by this week to collect your next stamp and enjoy a special treat on us! ✨',
  },
  {
    id: 'recipe_birthday',
    title: 'Birthday Celebration Treat',
    badge: 'CUSTOMER FAVORITE',
    icon: 'gift',
    iconBg: '#FCE7F3',
    iconColor: '#DB2777',
    defaultDays: 0,
    defaultHours: 9,
    defaultMinutes: 0,
    triggerDescription: 'Sends on the morning of customer\'s birthday',
    defaultBody: 'Happy Birthday, {Customer Name}! 🎂🎉\n\nTo celebrate your special day, enjoy a free birthday reward at {Store Name} this week! 🎁 Show this message to claim.',
  },
  {
    id: 'recipe_almost_reward',
    title: 'Close-to-Reward Reminder',
    badge: 'RETENTION BOOSTER',
    icon: 'trophy',
    iconBg: '#DCFCE7',
    iconColor: '#16A34A',
    defaultDays: 3,
    defaultHours: 0,
    defaultMinutes: 0,
    triggerDescription: 'Triggers 3 days after visit for customers 1–2 stamps away from a reward',
    defaultBody: 'Hi {Customer Name}! 🎯\n\nYou are only a few stamps away from unlocking your free reward at {Store Name}! Drop by soon to claim it. ✨',
  },
  {
    id: 'recipe_thankyou',
    title: 'Post-Visit Gratitude & Review',
    badge: 'RELATIONSHIP BUILDER',
    icon: 'heart',
    iconBg: '#E0E7FF',
    iconColor: '#4F46E5',
    defaultDays: 0,
    defaultHours: 2,
    defaultMinutes: 0,
    triggerDescription: 'Triggers 2 hours after a stamp is collected at counter',
    defaultBody: 'Thank you for visiting {Store Name} today, {Customer Name}! ✨\n\nWe hope you had a great time. Let us know how we did or see you on your next visit!',
  },
];

export default function SmartFollowUp({ styles: s }: Props) {
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [activeTab, setActiveTab] = useState<'autopilot' | 'advanced'>('autopilot');
  const [smartGroups, setSmartGroups] = useState<any[]>([]);
  const [merchantName, setMerchantName] = useState('Your Shop');
  const [isLoading, setIsLoading] = useState(true);
  const [togglingRecipeId, setTogglingRecipeId] = useState<string | null>(null);

  // Customization Modal State
  const [editingRecipe, setEditingRecipe] = useState<AutopilotRecipe | null>(null);
  const [customDays, setCustomDays] = useState('14');
  const [customBody, setCustomBody] = useState('');
  const [isSavingCustom, setIsSavingCustom] = useState(false);

  // Advanced Mode State
  const [queueCount, setQueueCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);

  // Load Merchant Name
  useEffect(() => {
    if (user?.merchant_id) {
      pb.collection('merchants').getOne(user.merchant_id)
        .then(rec => {
          if (rec?.name) setMerchantName(rec.name);
        })
        .catch(() => {});
    }
  }, [user]);

  // Fetch Existing Smart Groups
  const fetchGroups = useCallback(async () => {
    if (!user?.merchant_id) return;
    try {
      setIsLoading(true);
      const records = await pb.collection('follow_up_groups').getFullList({
        filter: `merchant = "${user.merchant_id}"`,
        sort: '-created',
        requestKey: null,
      });
      setSmartGroups(records);

      // Fetch Quick Stats
      try {
        const queueRecs = await pb.collection('follow_up_members').getList(1, 1, {
          filter: `group.merchant = "${user.merchant_id}" && status = "enrolled"`,
          requestKey: null,
        });
        setQueueCount(queueRecs.totalItems);

        const logsRecs = await pb.collection('follow_up_logs').getList(1, 1, {
          filter: `group.merchant = "${user.merchant_id}" && status = "sent"`,
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
          res.status === 'active' ? 'Autopilot Activated! 🚀' : 'Autopilot Paused ⏸️',
          res.status === 'active'
            ? `"${recipe.title}" is now running automatically every 5 minutes.`
            : `"${recipe.title}" has been paused.`
        );
      } else {
        Alert.alert('Notice', res.message || 'Failed to update recipe status.');
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
          filter: `group = "${existingGroup.id}"`,
          sort: 'order',
          requestKey: null,
        });
        if (sequences.length > 0) {
          setCustomDays(String(sequences[0].send_after_days ?? recipe.defaultDays));
          const messages = await pb.collection('follow_up_messages').getFullList({
            filter: `sequence = "${sequences[0].id}"`,
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
        Alert.alert('Saved! ✨', `"${editingRecipe.title}" has been updated.`);
      } else {
        Alert.alert('Notice', res.message || 'Failed to save recipe.');
      }
    } catch (err: any) {
      console.warn('[SmartFollowUp Save Error]:', err);
      Alert.alert('Error', err?.message || 'Failed to save customized recipe.');
    } finally {
      setIsSavingCustom(false);
    }
  };

  // Helper to render preview body
  const getLivePreview = (text: string) => {
    return text
      .replace(/\{Customer Name\}/g, 'Shafiq')
      .replace(/\{Store Name\}/g, merchantName || 'Kopitiam Risev')
      .replace(/\{Stamp Balance\}/g, '8')
      .replace(/\{Reward Item\}/g, 'Free Iced Latte');
  };

  return (
    <View style={styles.container}>
      {/* ── TOP HERO BANNER & STATS ── */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color="#D97706" />
            <Text style={styles.heroBadgeText}>MARKETING AUTOPILOT</Text>
          </View>
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, activeTab === 'autopilot' && styles.modeTabActive]}
              onPress={() => setActiveTab('autopilot')}
              activeOpacity={0.8}
            >
              <Ionicons name="flash" size={13} color={activeTab === 'autopilot' ? '#050505' : '#64748B'} />
              <Text style={[styles.modeTabText, activeTab === 'autopilot' && styles.modeTabTextActive]}>Quick Recipes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, activeTab === 'advanced' && styles.modeTabActive]}
              onPress={() => setActiveTab('advanced')}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={13} color={activeTab === 'advanced' ? '#050505' : '#64748B'} />
              <Text style={[styles.modeTabText, activeTab === 'advanced' && styles.modeTabTextActive]}>Advanced Engine</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.heroTitle}>Automate Your Customer Retention.</Text>
        <Text style={styles.heroSubtitle}>
          Set-and-forget WhatsApp automations that bring customers back automatically. No manual broadcasting required.
        </Text>

        {/* Live Quick Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {smartGroups.filter(g => g.status === 'active').length} / {AUTOPILOT_RECIPES.length}
            </Text>
            <Text style={styles.metricLabel}>Active Autopilots</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{queueCount}</Text>
            <Text style={styles.metricLabel}>Queued Members</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{sentCount}</Text>
            <Text style={styles.metricLabel}>Messages Sent</Text>
          </View>
        </View>
      </View>

      {/* ── AUTOPILOT RECIPES VIEW ── */}
      {activeTab === 'autopilot' ? (
        <View style={styles.recipesSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>1-CLICK AUTOPILOT RECIPES</Text>
            <TouchableOpacity onPress={fetchGroups} style={{ padding: 4 }}>
              <Ionicons name="refresh" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#FFC700" />
              <Text style={styles.loadingText}>Loading smart follow up recipes...</Text>
            </View>
          ) : (
            <View style={[styles.recipeGrid, isDesktop && styles.recipeGridDesktop]}>
              {AUTOPILOT_RECIPES.map((recipe) => {
                const isActive = isRecipeActive(recipe.id);
                const isToggling = togglingRecipeId === recipe.id;

                return (
                  <View key={recipe.id} style={[styles.recipeCard, isActive && styles.recipeCardActive]}>
                    {/* Top Status & Badge */}
                    <View style={styles.recipeTopRow}>
                      <View style={styles.recipeIconWrap}>
                        <View style={[styles.recipeIconBox, { backgroundColor: recipe.iconBg }]}>
                          <Ionicons name={recipe.icon} size={20} color={recipe.iconColor} />
                        </View>
                        <View>
                          <Text style={styles.recipeTitle}>{recipe.title}</Text>
                          <View style={styles.recipeBadgePill}>
                            <Text style={styles.recipeBadgeText}>{recipe.badge}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Switch */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {isToggling ? (
                          <ActivityIndicator size="small" color="#FFC700" />
                        ) : (
                          <Switch
                            value={isActive}
                            onValueChange={() => handleToggleRecipe(recipe)}
                            trackColor={{ false: '#E2E8F0', true: '#22C55E' }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor="#E2E8F0"
                          />
                        )}
                      </View>
                    </View>

                    {/* Trigger Info */}
                    <View style={styles.triggerInfoBox}>
                      <Ionicons name="time-outline" size={14} color="#64748B" />
                      <Text style={styles.triggerInfoText}>{recipe.triggerDescription}</Text>
                    </View>

                    {/* Live WhatsApp Bubble Preview */}
                    <View style={styles.whatsappBubbleCard}>
                      <View style={styles.whatsappBubbleTop}>
                        <Ionicons name="logo-whatsapp" size={12} color="#16A34A" />
                        <Text style={styles.whatsappSenderText}>{merchantName}</Text>
                        <Text style={styles.whatsappTimeText}>Automated</Text>
                      </View>
                      <Text style={styles.whatsappBodyText}>{getLivePreview(recipe.defaultBody)}</Text>
                    </View>

                    {/* Action Bar */}
                    <View style={styles.recipeFooter}>
                      <View style={styles.activeStatusRow}>
                        <View style={[styles.statusDot, { backgroundColor: isActive ? '#22C55E' : '#94A3B8' }]} />
                        <Text style={[styles.statusLabel, { color: isActive ? '#15803D' : '#64748B' }]}>
                          {isActive ? 'Active • Running' : 'Paused'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => handleOpenCustomize(recipe)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="pencil" size={13} color="#0F172A" />
                        <Text style={styles.editBtnText}>Customize</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        /* ── ADVANCED ENGINE VIEW (FOR POWER USERS) ── */
        <View style={styles.advancedSection}>
          <Text style={styles.sectionTitle}>ACTIVE CUSTOM GROUPS & QUEUE</Text>

          {smartGroups.length === 0 ? (
            <View style={styles.emptyAdvancedBox}>
              <Ionicons name="construct-outline" size={36} color="#94A3B8" />
              <Text style={styles.emptyAdvancedTitle}>No Custom Sequences Found</Text>
              <Text style={styles.emptyAdvancedDesc}>
                All your automated follow-ups are managed cleanly through 1-Click Autopilot Recipes above.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {smartGroups.map((grp) => (
                <View key={grp.id} style={styles.advancedGroupCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ gap: 2 }}>
                      <Text style={styles.advancedGroupName}>{grp.name}</Text>
                      <Text style={styles.advancedGroupMeta}>
                        Interval: {grp.interval_minutes || 5} mins • Created: {new Date(grp.created).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={[styles.advStatusPill, { backgroundColor: grp.status === 'active' ? '#DCFCE7' : '#F1F5F9' }]}>
                      <Text style={[styles.advStatusText, { color: grp.status === 'active' ? '#15803D' : '#64748B' }]}>
                        {grp.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── CUSTOMIZE RECIPE MODAL ── */}
      {editingRecipe && (
        <Modal visible={!!editingRecipe} transparent animationType="slide" onRequestClose={() => setEditingRecipe(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, isDesktop && { maxWidth: 520 }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.recipeIconBox, { width: 32, height: 32, backgroundColor: editingRecipe.iconBg }]}>
                    <Ionicons name={editingRecipe.icon} size={18} color={editingRecipe.iconColor} />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>{editingRecipe.title}</Text>
                    <Text style={styles.modalSubtitle}>Customize trigger and message wording</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setEditingRecipe(null)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* Trigger Days Setting */}
                <Text style={styles.inputLabel}>TRIGGER DELAY (DAYS)</Text>
                <View style={styles.daysInputBox}>
                  <TextInput
                    style={[styles.daysInput, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                    value={customDays}
                    onChangeText={setCustomDays}
                    keyboardType="number-pad"
                    placeholder="14"
                  />
                  <Text style={styles.daysInputUnit}>Days with no counter visit</Text>
                </View>

                {/* Message Body */}
                <Text style={[styles.inputLabel, { marginTop: 16 }]}>WHATSAPP MESSAGE TEXT</Text>
                <TextInput
                  style={[styles.messageInput, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                  value={customBody}
                  onChangeText={setCustomBody}
                  multiline
                  numberOfLines={5}
                  placeholder="Enter message..."
                />

                {/* Placeholders Chip Helpers */}
                <Text style={styles.chipsLabel}>INSERT SMART VARIABLES:</Text>
                <View style={styles.chipsRow}>
                  {['{Customer Name}', '{Store Name}', '{Stamp Balance}', '{Reward Item}'].map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.chip}
                      onPress={() => setCustomBody(prev => `${prev} ${tag}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipText}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Live Preview Inside Modal */}
                <Text style={[styles.inputLabel, { marginTop: 16 }]}>LIVE PREVIEW FOR CUSTOMERS</Text>
                <View style={styles.whatsappBubbleCard}>
                  <View style={styles.whatsappBubbleTop}>
                    <Ionicons name="logo-whatsapp" size={12} color="#16A34A" />
                    <Text style={styles.whatsappSenderText}>{merchantName}</Text>
                    <Text style={styles.whatsappTimeText}>Just now</Text>
                  </View>
                  <Text style={styles.whatsappBodyText}>{getLivePreview(customBody)}</Text>
                </View>
              </ScrollView>

              {/* Actions */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditingRecipe(null)}
                  disabled={isSavingCustom}
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
    paddingVertical: 12,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  heroBadgeText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
    letterSpacing: 0.8,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  modeTabTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
    lineHeight: 28,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
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
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.8,
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
  recipeGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    width: '100%',
  },
  recipeCardActive: {
    borderColor: '#FFC700',
    backgroundColor: '#FFFDF5',
  },
  recipeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  recipeIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recipeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  recipeBadgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  recipeBadgeText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    letterSpacing: 0.5,
  },
  triggerInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 12,
  },
  triggerInfoText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  whatsappBubbleCard: {
    backgroundColor: '#DCF8C6',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 14,
  },
  whatsappBubbleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  whatsappSenderText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#166534',
    flex: 1,
  },
  whatsappTimeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#15803D',
  },
  whatsappBodyText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0F172A',
    lineHeight: 18,
  },
  recipeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  activeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editBtnText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  advancedSection: {
    width: '100%',
  },
  emptyAdvancedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyAdvancedTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  emptyAdvancedDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  advancedGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  advancedGroupName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  advancedGroupMeta: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  advStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  advStatusText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  daysInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 48,
  },
  daysInput: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    width: 48,
  },
  daysInputUnit: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  messageInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0F172A',
    lineHeight: 20,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  chipsLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  chipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  modalSaveBtn: {
    flex: 1.6,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modalSaveText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
});
