import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  REWARD_VISUAL_REGISTRY,
  REWARD_VISUAL_CATEGORIES,
  RewardVisualItem,
  getRecommendedVisuals,
} from '../lib/rewardVisuals';

interface RewardVisualPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedVisualId?: string | null;
  onSelectVisual: (visualId: string | null) => void;
  merchantCategory?: string;
  rewardType?: string;
  rewardTitle?: string;
  discountType?: string;
  discountValue?: number | string;
}

export const RewardVisualPickerModal: React.FC<RewardVisualPickerModalProps> = ({
  visible,
  onClose,
  selectedVisualId,
  onSelectVisual,
  merchantCategory = '',
  rewardType = 'free_item',
  rewardTitle = '',
  discountType = 'none',
  discountValue = 0,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('recommended');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Calculate recommended list dynamically
  const recommendedVisuals = useMemo(() => {
    return getRecommendedVisuals({
      merchantCategory,
      rewardType,
      title: rewardTitle,
      discountType,
      discountValue,
    });
  }, [merchantCategory, rewardType, rewardTitle, discountType, discountValue]);

  // Filter visuals based on active category & search query
  const filteredVisuals = useMemo(() => {
    let list: RewardVisualItem[] = [];

    if (activeCategory === 'recommended') {
      list = recommendedVisuals;
    } else if (activeCategory === 'no_visual') {
      list = [];
    } else {
      list = REWARD_VISUAL_REGISTRY.filter((item) => item.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return REWARD_VISUAL_REGISTRY.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activeCategory, searchQuery, recommendedVisuals]);

  const handleSelect = (visualId: string | null) => {
    onSelectVisual(visualId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.headerIconCircle}>
                  <Ionicons name="images-outline" size={18} color="#D97706" />
                </View>
                <Text style={styles.headerTitle}>Choose Reward Visual</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Select a visual that represents this reward for your customers.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchWrapper}>
            <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search visual or category..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Category Chips Scroll */}
          {!searchQuery && (
            <View style={{ marginBottom: 12 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChipsContainer}
              >
                {REWARD_VISUAL_CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chipButton, isActive && styles.chipButtonActive]}
                      onPress={() => setActiveCategory(cat.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Visual Grid / Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContainer}
          >
            {/* "No Visual" Choice Option Card */}
            {(activeCategory === 'no_visual' || !searchQuery) && (
              <TouchableOpacity
                style={[
                  styles.visualCard,
                  !selectedVisualId && styles.visualCardSelected,
                  { width: '100%', marginBottom: 14, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
                ]}
                onPress={() => handleSelect(null)}
                activeOpacity={0.85}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="ban-outline" size={22} color="#64748B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                    No visual (Default Graphic)
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                    Keep voucher safe zone without custom photo
                  </Text>
                </View>
                {!selectedVisualId && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={14} color="#000000" />
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* 2-Column Visual Grid */}
            <View style={styles.twoColumnGrid}>
              {filteredVisuals.map((item) => {
                const isSelected = selectedVisualId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.visualCard, isSelected && styles.visualCardSelected]}
                    onPress={() => handleSelect(item.id)}
                    activeOpacity={0.85}
                  >
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={14} color="#000000" />
                      </View>
                    )}
                    <View style={styles.imageBox}>
                      <Image
                        source={{ uri: item.asset_url }}
                        style={styles.visualImage}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={styles.visualName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {filteredVisuals.length === 0 && activeCategory !== 'no_visual' && (
              <View style={styles.emptyBox}>
                <Ionicons name="images-outline" size={36} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Visuals Found</Text>
                <Text style={styles.emptySubtitle}>Try searching another keyword or selecting a category.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '88%',
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  categoryChipsContainer: {
    gap: 8,
    paddingRight: 10,
  },
  chipButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  chipTextActive: {
    color: '#92400E',
  },
  gridContainer: {
    paddingBottom: 20,
  },
  twoColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  visualCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  visualCardSelected: {
    borderColor: '#FFC700',
    backgroundColor: '#FFFDF0',
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  imageBox: {
    width: '100%',
    height: 105,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  visualImage: {
    width: '100%',
    height: '100%',
  },
  visualName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
});
