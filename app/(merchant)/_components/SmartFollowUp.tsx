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
          <TouchableOpacity onPress={fetchGroups} style={{ padding: 6 }}>
            <Ionicons name="refresh" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroTitle}>Automate Your Customer Retention.</Text>
        <Text style={styles.heroSubtitle}>
          Set-and-forget WhatsApp automations that bring customers back automatically. No manual broadcasting required.
        </Text>

        {/* iOS-Style Full-Width Segmented Tab Navigation */}
        <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 2, borderRadius: 12, marginBottom: 18 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: activeTab === 'autopilot' ? '#FFFFFF' : 'transparent',
              shadowColor: activeTab === 'autopilot' ? '#000000' : 'transparent',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 2,
              elevation: activeTab === 'autopilot' ? 1.5 : 0
            }}
            onPress={() => setActiveTab('autopilot')}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={13} color={activeTab === 'autopilot' ? '#050505' : '#64748B'} />
            <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: activeTab === 'autopilot' ? '#050505' : '#64748B' }}>Quick Recipes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: activeTab === 'advanced' ? '#FFFFFF' : 'transparent',
              shadowColor: activeTab === 'advanced' ? '#000000' : 'transparent',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 2,
              elevation: activeTab === 'advanced' ? 1.5 : 0
            }}
            onPress={() => setActiveTab('advanced')}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={13} color={activeTab === 'advanced' ? '#050505' : '#64748B'} />
            <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: activeTab === 'advanced' ? '#050505' : '#64748B' }}>Advanced Engine</Text>
          </TouchableOpacity>
        </View>

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
                  <View 
                    key={recipe.id} 
                    style={[
                      styles.recipeCard, 
                      { 
                        borderRadius: 22, 
                        borderWidth: 1.5, 
                        borderColor: isActive ? '#FFC700' : '#F1F5F9',
                        padding: 16
                      }
                    ]}
                  >
                    {/* Top Status & Badge */}
                    <View style={styles.recipeTopRow}>
                      <View style={styles.recipeIconWrap}>
                        <View style={[styles.recipeIconBox, { backgroundColor: recipe.iconBg, width: 36, height: 36, borderRadius: 18 }]}>
                          <Ionicons name={recipe.icon} size={18} color={recipe.iconColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.recipeTitle, { fontSize: 13.5, fontFamily: 'PlusJakartaSans_800ExtraBold' }]} numberOfLines={1}>{recipe.title}</Text>
                          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 3 }}>
                            <View style={[styles.recipeBadgePill, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                              <Text style={[styles.recipeBadgeText, { color: '#475569', fontSize: 8 }]}>{recipe.badge}</Text>
                            </View>
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
                            trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor="#E2E8F0"
                          />
                        )}
                      </View>
                    </View>

                    {/* Trigger Info */}
                    <View style={[styles.triggerInfoBox, { backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginVertical: 12 }]}>
                      <Ionicons name="time-outline" size={13} color="#64748B" />
                      <Text style={[styles.triggerInfoText, { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginLeft: 6 }]}>{recipe.triggerDescription}</Text>
                    </View>

                    {/* High-Fidelity WhatsApp Device Message Preview Mockup */}
                    <View style={{ 
                      backgroundColor: '#E5DDD5', 
                      borderRadius: 14, 
                      borderWidth: 1, 
                      borderColor: '#E2E8F0',
                      overflow: 'hidden',
                      marginBottom: 12
                    }}>
                      {/* WhatsApp Mockup Phone Top Header */}
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        backgroundColor: '#075E54', 
                        paddingHorizontal: 10, 
                        paddingVertical: 6 
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="arrow-back" size={12} color="#FFFFFF" />
                          {/* Circle avatar */}
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#128C7E', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 8, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                              {(merchantName || 'K').substring(0, 1).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ gap: 0.5 }}>
                            <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }} numberOfLines={1}>
                              {merchantName || 'Kedai Kami'}
                            </Text>
                            <Text style={{ fontSize: 6.5, color: '#A7F3D0', fontFamily: 'PlusJakartaSans_600SemiBold' }}>online</Text>
                          </View>
                        </View>
                        <Ionicons name="ellipsis-vertical" size={12} color="#FFFFFF" />
                      </View>

                      {/* Mockup Chat Body */}
                      <View style={{ padding: 8 }}>
                        <View style={{ 
                          backgroundColor: '#DCF8C6', 
                          borderRadius: 8, 
                          padding: 8, 
                          maxWidth: '85%', 
                          alignSelf: 'flex-start', 
                          shadowColor: '#000000', 
                          shadowOffset: { width: 0, height: 1 }, 
                          shadowOpacity: 0.05, 
                          shadowRadius: 0.5, 
                          elevation: 0.5 
                        }}>
                          <Text style={{ fontSize: 10.5, color: '#0F172A', lineHeight: 14, fontFamily: 'PlusJakartaSans_500Medium' }}>
                            {getLivePreview(recipe.defaultBody)}
                          </Text>
                          {/* Time tick inside bubble */}
                          <View style={{ flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 2, marginTop: 3 }}>
                            <Text style={{ fontSize: 7, color: '#738A75', fontFamily: 'PlusJakartaSans_500Medium' }}>Automated</Text>
                            <Ionicons name="checkmark-done" size={9} color="#34B7F1" />
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Action Bar */}
                    <View style={styles.recipeFooter}>
                      <View style={styles.activeStatusRow}>
                        <View style={[styles.statusDot, { backgroundColor: isActive ? '#10B981' : '#94A3B8' }]} />
                        <Text style={[styles.statusLabel, { color: isActive ? '#059669' : '#64748B', fontFamily: 'PlusJakartaSans_700Bold' }]}>
                          {isActive ? 'Active' : 'Paused'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.editBtn, { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 }]}
                        onPress={() => handleOpenCustomize(recipe)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="pencil-outline" size={12} color="#0F172A" />
                        <Text style={[styles.editBtnText, { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold' }]}>Customize</Text>
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
            <View style={{ gap: 12 }}>
              {smartGroups.map((grp) => (
                <View 
                  key={grp.id} 
                  style={[
                    styles.advancedGroupCard, 
                    { 
                      borderRadius: 16, 
                      borderWidth: 1, 
                      borderColor: grp.status === 'active' ? '#FFC700' : '#E2E8F0',
                      padding: 14,
                      backgroundColor: '#FFFFFF'
                    }
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ gap: 4, flex: 1, marginRight: 12 }}>
                      <Text style={[styles.advancedGroupName, { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }]}>{grp.name}</Text>
                      <Text style={[styles.advancedGroupMeta, { fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }]}>
                        Interval: {grp.interval_minutes || 5} mins • Created: {new Date(grp.created).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={[
                      styles.advStatusPill, 
                      { 
                        backgroundColor: grp.status === 'active' ? '#D1FAE5' : '#F1F5F9',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8
                      }
                    ]}>
                      <Text style={[
                        styles.advStatusText, 
                        { 
                          color: grp.status === 'active' ? '#065F46' : '#64748B', 
                          fontSize: 9, 
                          fontFamily: 'PlusJakartaSans_800ExtraBold' 
                        }
                      ]}>
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
            <View style={[styles.modalCard, isDesktop && { maxWidth: 520 }, { borderRadius: 24, padding: 20 }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={[styles.recipeIconBox, { width: 36, height: 36, borderRadius: 18, backgroundColor: editingRecipe.iconBg }]}>
                    <Ionicons name={editingRecipe.icon} size={18} color={editingRecipe.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }]} numberOfLines={1}>{editingRecipe.title}</Text>
                    <Text style={[styles.modalSubtitle, { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }]}>Customize trigger and message wording</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setEditingRecipe(null)} style={[styles.modalCloseBtn, { backgroundColor: '#F1F5F9', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="close" size={16} color="#475569" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* Trigger Days Setting */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="time-outline" size={14} color="#64748B" />
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569' }}>TRIGGER DELAY (DAYS)</Text>
                  </View>
                  <View style={[styles.daysInputBox, { height: 48, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12 }]}>
                    <TextInput
                      style={[styles.daysInput, { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A', flex: 0, minWidth: 40 }, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                      value={customDays}
                      onChangeText={setCustomDays}
                      keyboardType="number-pad"
                      placeholder="14"
                    />
                    <Text style={[styles.daysInputUnit, { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }]}>Days with no counter visit</Text>
                  </View>
                </View>

                {/* Message Body */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color="#64748B" />
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569' }}>WHATSAPP MESSAGE TEXT</Text>
                  </View>
                  <TextInput
                    style={[styles.messageInput, { minHeight: 100, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#0F172A' }, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                    value={customBody}
                    onChangeText={setCustomBody}
                    multiline
                    numberOfLines={5}
                    placeholder="Enter message..."
                  />
                </View>

                {/* Placeholders Chip Helpers */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 8 }}>INSERT VARIABLE TAG:</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {['{Customer Name}', '{Store Name}', '{Stamp Balance}', '{Reward Item}'].map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={{ 
                          backgroundColor: '#F1F5F9', 
                          paddingHorizontal: 10, 
                          paddingVertical: 5, 
                          borderRadius: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                        onPress={() => setCustomBody(prev => `${prev} ${tag}`)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={11} color="#475569" style={{ marginRight: 2 }} />
                        <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#475569' }}>{tag.replace(/[\{\}]/g, '')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Live Preview Inside Modal Mockup */}
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 10 }}>LIVE CUSTOMER PREVIEW</Text>
                <View style={{ 
                  backgroundColor: '#E5DDD5', 
                  borderRadius: 16, 
                  borderWidth: 1, 
                  borderColor: '#E2E8F0',
                  overflow: 'hidden',
                  marginBottom: 16
                }}>
                  {/* WhatsApp Mockup Phone Top Header */}
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    backgroundColor: '#075E54', 
                    paddingHorizontal: 10, 
                    paddingVertical: 6 
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="arrow-back" size={12} color="#FFFFFF" />
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#128C7E', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 8, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                          {(merchantName || 'K').substring(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ gap: 0.5 }}>
                        <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }} numberOfLines={1}>
                          {merchantName || 'Kedai Kami'}
                        </Text>
                        <Text style={{ fontSize: 6.5, color: '#A7F3D0', fontFamily: 'PlusJakartaSans_600SemiBold' }}>online</Text>
                      </View>
                    </View>
                    <Ionicons name="ellipsis-vertical" size={12} color="#FFFFFF" />
                  </View>

                  {/* Mockup Chat Body */}
                  <View style={{ padding: 10 }}>
                    <View style={{ 
                      backgroundColor: '#DCF8C6', 
                      borderRadius: 8, 
                      padding: 8, 
                      maxWidth: '85%', 
                      alignSelf: 'flex-start', 
                      shadowColor: '#000000', 
                      shadowOffset: { width: 0, height: 1 }, 
                      shadowOpacity: 0.05, 
                      shadowRadius: 0.5, 
                      elevation: 0.5 
                    }}>
                      <Text style={{ fontSize: 11, color: '#0F172A', lineHeight: 15, fontFamily: 'PlusJakartaSans_500Medium' }}>
                        {getLivePreview(customBody)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 2, marginTop: 3 }}>
                        <Text style={{ fontSize: 7.5, color: '#738A75', fontFamily: 'PlusJakartaSans_500Medium' }}>Automated</Text>
                        <Ionicons name="checkmark-done" size={10} color="#34B7F1" />
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Actions */}
              <View style={[styles.modalFooter, { borderTopWidth: 0, paddingTop: 10 }]}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 12 }]}
                  onPress={() => setEditingRecipe(null)}
                  disabled={isSavingCustom}
                >
                  <Text style={[styles.modalCancelText, { color: '#475569', fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSaveBtn, { backgroundColor: '#FFC700', borderRadius: 12, paddingVertical: 12 }]}
                  onPress={handleSaveCustomize}
                  disabled={isSavingCustom}
                  activeOpacity={0.85}
                >
                  {isSavingCustom ? (
                    <ActivityIndicator size="small" color="#0F172A" />
                  ) : (
                    <Text style={[styles.modalSaveText, { color: '#0F172A', fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold' }]}>Save & Update</Text>
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
