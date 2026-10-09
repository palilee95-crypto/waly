import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type CategoryItemType = {
  id: string;
  name: string;
  group: string;
  icon: string;
  bg: string;
  color: string;
  merchantCount?: number;
};

export const ALL_CATEGORIES_LIST: CategoryItemType[] = [
  // 💈 Grooming & Beauty
  { id: 'barber', name: 'Barber', group: 'Grooming & Beauty', icon: 'cut', bg: '#FEF9C3', color: '#0F172A', merchantCount: 14 },
  { id: 'beauty', name: 'Beauty & Salon', group: 'Grooming & Beauty', icon: 'flower-outline', bg: '#FCE7F3', color: '#DB2777', merchantCount: 18 },
  { id: 'spa', name: 'Spa & Massage', group: 'Grooming & Beauty', icon: 'sparkles-outline', bg: '#F3E8FF', color: '#7C3AED', merchantCount: 8 },
  { id: 'muslimah_spa', name: 'Muslimah Spa', group: 'Grooming & Beauty', icon: 'heart-outline', bg: '#FDF2F8', color: '#BE185D', merchantCount: 6 },

  // ☕ Food & Beverages
  { id: 'cafe', name: 'Cafe & Bakery', group: 'Food & Drinks', icon: 'cafe', bg: '#FFEDD5', color: '#C2410C', merchantCount: 26 },
  { id: 'restaurant', name: 'Restaurant', group: 'Food & Drinks', icon: 'restaurant', bg: '#FEE2E2', color: '#DC2626', merchantCount: 32 },
  { id: 'dessert', name: 'Dessert & Ice Cream', group: 'Food & Drinks', icon: 'ice-cream-outline', bg: '#FFF7ED', color: '#EA580C', merchantCount: 12 },
  { id: 'beverage', name: 'Beverage Bar', group: 'Food & Drinks', icon: 'wine-outline', bg: '#ECFDF5', color: '#059669', merchantCount: 9 },

  // 🚘 Automotive
  { id: 'carwash', name: 'Car Wash & Detailing', group: 'Automotive', icon: 'car-sport', bg: '#E0F2FE', color: '#0284C7', merchantCount: 15 },
  { id: 'workshop', name: 'Workshop & Repair', group: 'Automotive', icon: 'build-outline', bg: '#F1F5F9', color: '#334155', merchantCount: 11 },

  // 🏋️ Fitness & Lifestyle
  { id: 'gym', name: 'Gym & Fitness', group: 'Fitness & Lifestyle', icon: 'barbell-outline', bg: '#E0E7FF', color: '#4338CA', merchantCount: 7 },
  { id: 'sports', name: 'Sports Venue', group: 'Fitness & Lifestyle', icon: 'trophy-outline', bg: '#FEF3C7', color: '#B45309', merchantCount: 5 },
  { id: 'optician', name: 'Optical & Eyewear', group: 'Fitness & Lifestyle', icon: 'glasses-outline', bg: '#F0FDFA', color: '#0D9488', merchantCount: 4 },

  // 🧺 Retail & Laundry
  { id: 'laundry', name: 'Laundry & Dry Clean', group: 'Retail & Services', icon: 'shirt-outline', bg: '#EFF6FF', color: '#2563EB', merchantCount: 10 },
  { id: 'boutique', name: 'Boutique & Fashion', group: 'Retail & Services', icon: 'bag-handle-outline', bg: '#FAF5FF', color: '#9333EA', merchantCount: 16 },
  { id: 'groceries', name: 'Groceries & Mart', group: 'Retail & Services', icon: 'cart-outline', bg: '#FEF2F2', color: '#E11D48', merchantCount: 20 },
  { id: 'florist', name: 'Florist & Gifts', group: 'Retail & Services', icon: 'rose-outline', bg: '#FFF1F2', color: '#E11D48', merchantCount: 6 },

  // 🛠️ Specialty Services
  { id: 'pet', name: 'Pet Care & Vet', group: 'Specialty Services', icon: 'paw-outline', bg: '#FFFBEB', color: '#D97706', merchantCount: 8 },
  { id: 'repair', name: 'Gadget & Mobile Repair', group: 'Specialty Services', icon: 'hardware-chip-outline', bg: '#F8FAFC', color: '#475569', merchantCount: 13 },
  { id: 'studio', name: 'Studio & Photography', group: 'Specialty Services', icon: 'camera-outline', bg: '#F5F3FF', color: '#6D28D9', merchantCount: 5 },
];

type AllCategoriesModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void;
};

export default function AllCategoriesModal({
  visible,
  onClose,
  onSelectCategory,
}: AllCategoriesModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = ALL_CATEGORIES_LIST.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.group.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups = Array.from(new Set(filteredCategories.map((c) => c.group)));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />

        <View style={styles.modalSheet}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="grid-outline" size={22} color="#0F172A" />
              <Text style={styles.headerTitle}>All Categories</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Search Category Bar */}
          <View style={styles.searchBarWrap}>
            <Ionicons name="search-outline" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search category (e.g. Barber, Cafe, Spa)..."
              placeholderTextColor="#94A3B8"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Scrollable Categories List */}
          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {groups.map((group) => {
              const groupItems = filteredCategories.filter((c) => c.group === group);
              return (
                <View key={group} style={styles.groupSection}>
                  <Text style={styles.groupTitle}>{group}</Text>
                  <View style={styles.groupGrid}>
                    {groupItems.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={styles.catCard}
                        onPress={() => {
                          onSelectCategory(cat.id);
                          onClose();
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
                          <Ionicons name={cat.icon as any} size={22} color={cat.color} />
                        </View>
                        <View style={styles.catMetaCol}>
                          <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                          <Text style={styles.catCount}>{cat.merchantCount} merchants</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={15} color="#CBD5E1" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  dragHandle: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0F172A',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  groupSection: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  groupGrid: {
    gap: 10,
  },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catMetaCol: {
    flex: 1,
    gap: 2,
  },
  catName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  catCount: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
});
