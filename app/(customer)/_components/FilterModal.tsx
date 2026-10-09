import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';

export type FilterState = {
  category: string;
  location: string;
  distanceKm: number;
  priceRange: string;
  rating: string;
  availableToday: boolean;
  instantBooking: boolean;
  earnRewards: boolean;
  petFriendly: boolean;
};

export const DEFAULT_FILTER_STATE: FilterState = {
  category: 'Barber',
  location: 'Jitra, Kedah',
  distanceKm: 5,
  priceRange: 'All',
  rating: 'All',
  availableToday: true,
  instantBooking: false,
  earnRewards: true,
  petFriendly: false,
};

type FilterModalProps = {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters?: Partial<FilterState>;
  totalResultsCount?: number;
};

const CATEGORIES = [
  { id: 'All', name: 'All', icon: 'apps', family: 'Ionicons' },
  { id: 'Barber', name: 'Barber', icon: 'scissors-sharp', family: 'Ionicons' },
  { id: 'Beauty', name: 'Beauty', icon: 'flower-outline', family: 'Ionicons' },
  { id: 'Car Wash', name: 'Car Wash', icon: 'car-sport', family: 'Ionicons' },
  { id: 'Cafe', name: 'Cafe', icon: 'cafe', family: 'Ionicons' },
  { id: 'Restaurant', name: 'Restaurant', icon: 'restaurant', family: 'Ionicons' },
  { id: 'Fitness', name: 'Fitness', icon: 'barbell-outline', family: 'Ionicons' },
  { id: 'Others', name: 'Others', icon: 'ellipsis-horizontal', family: 'Ionicons' },
];

const PRICE_RANGES = ['All', 'Under RM20', 'RM20 - RM50', 'RM50+'];
const RATINGS = ['All', '⭐ 4.0+', '⭐ 4.5+', '⭐ 4.8+'];

export default function FilterModal({
  visible,
  onClose,
  onApply,
  initialFilters,
  totalResultsCount = 28,
}: FilterModalProps) {
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTER_STATE,
    ...initialFilters,
  });

  useEffect(() => {
    if (visible) {
      setFilters({
        ...DEFAULT_FILTER_STATE,
        ...initialFilters,
      });
    }
  }, [visible, initialFilters]);

  const handleReset = () => {
    setFilters(DEFAULT_FILTER_STATE);
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const calculateCount = () => {
    let count = totalResultsCount;
    if (filters.category !== 'All') count = Math.max(8, Math.round(count * 0.65));
    if (filters.distanceKm < 10) count = Math.max(4, Math.round(count * 0.75));
    if (filters.priceRange !== 'All') count = Math.max(3, Math.round(count * 0.8));
    if (filters.rating !== 'All') count = Math.max(2, Math.round(count * 0.85));
    if (filters.availableToday) count = Math.max(2, Math.round(count * 0.9));
    if (filters.earnRewards) count = Math.max(1, Math.round(count * 0.95));
    return count;
  };

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
          {/* Drag Indicator Handle */}
          <View style={styles.dragHandle} />

          {/* Header Row */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Filter</Text>
            <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* 1. Service Category */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Service category</Text>
              <View style={styles.categoriesGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = filters.category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        isSelected ? styles.categoryChipSelected : styles.categoryChipUnselected,
                      ]}
                      onPress={() => setFilters((prev) => ({ ...prev, category: cat.id }))}
                      activeOpacity={0.8}
                    >
                      {cat.id !== 'All' && (
                        <Ionicons
                          name={cat.icon as any}
                          size={18}
                          color={isSelected ? '#0F172A' : (cat.id === 'Beauty' ? '#DB2777' : (cat.id === 'Car Wash' ? '#0284C7' : (cat.id === 'Cafe' ? '#C2410C' : (cat.id === 'Restaurant' ? '#DC2626' : (cat.id === 'Fitness' ? '#0F172A' : '#475569')))))}
                        />
                      )}
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected ? styles.categoryChipTextSelected : styles.categoryChipTextUnselected,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Location & Distance */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <TouchableOpacity style={styles.locationBox} activeOpacity={0.8}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="location-outline" size={18} color="#0F172A" />
                  <Text style={styles.locationBoxText}>{filters.location}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>

              {/* Distance Slider Selector */}
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.subLabel}>Distance</Text>
                  <Text style={styles.distanceValueText}>Within {filters.distanceKm} km</Text>
                </View>
                
                {/* Distance Selector Buttons */}
                <View style={styles.distanceBarRow}>
                  {[1, 5, 10, 25, 50].map((dist) => {
                    const isSel = filters.distanceKm === dist;
                    return (
                      <TouchableOpacity
                        key={dist}
                        style={[styles.distPill, isSel && styles.distPillSelected]}
                        onPress={() => setFilters((prev) => ({ ...prev, distanceKm: dist }))}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.distPillText, isSel && styles.distPillTextSelected]}>
                          {dist}km
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 3. Price Range */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Price range</Text>
              <View style={styles.chipsRow}>
                {PRICE_RANGES.map((pr) => {
                  const isSelected = filters.priceRange === pr;
                  return (
                    <TouchableOpacity
                      key={pr}
                      style={[
                        styles.chipPill,
                        isSelected ? styles.chipPillSelected : styles.chipPillUnselected,
                      ]}
                      onPress={() => setFilters((prev) => ({ ...prev, priceRange: pr }))}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.chipPillText,
                          isSelected ? styles.chipPillTextSelected : styles.chipPillTextUnselected,
                        ]}
                      >
                        {pr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Rating */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rating</Text>
              <View style={styles.chipsRow}>
                {RATINGS.map((rt) => {
                  const isSelected = filters.rating === rt;
                  return (
                    <TouchableOpacity
                      key={rt}
                      style={[
                        styles.chipPill,
                        isSelected ? styles.chipPillSelected : styles.chipPillUnselected,
                      ]}
                      onPress={() => setFilters((prev) => ({ ...prev, rating: rt }))}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.chipPillText,
                          isSelected ? styles.chipPillTextSelected : styles.chipPillTextUnselected,
                        ]}
                      >
                        {rt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 5. Availability */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Ionicons name="calendar-outline" size={18} color="#0F172A" />
                  <Text style={styles.toggleLabel}>Available today</Text>
                </View>
                <Switch
                  value={filters.availableToday}
                  onValueChange={(val) => setFilters((prev) => ({ ...prev, availableToday: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#FFC700' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Ionicons name="flash-outline" size={18} color="#0F172A" />
                  <Text style={styles.toggleLabel}>Instant booking</Text>
                </View>
                <Switch
                  value={filters.instantBooking}
                  onValueChange={(val) => setFilters((prev) => ({ ...prev, instantBooking: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#FFC700' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* 6. Features */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Features</Text>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Ionicons name="gift-outline" size={18} color="#0F172A" />
                  <Text style={styles.toggleLabel}>Earn Risev rewards</Text>
                </View>
                <Switch
                  value={filters.earnRewards}
                  onValueChange={(val) => setFilters((prev) => ({ ...prev, earnRewards: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#FFC700' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Ionicons name="people-outline" size={18} color="#0F172A" />
                  <Text style={styles.toggleLabel}>Pet friendly</Text>
                </View>
                <Switch
                  value={filters.petFriendly}
                  onValueChange={(val) => setFilters((prev) => ({ ...prev, petFriendly: val }))}
                  trackColor={{ false: '#E2E8F0', true: '#FFC700' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Bottom Fixed Action Button */}
          <View style={styles.bottomCtaWrap}>
            <TouchableOpacity style={styles.showResultsBtn} onPress={handleApply} activeOpacity={0.88}>
              <Text style={styles.showResultsBtnText}>Show {calculateCount()} results</Text>
            </TouchableOpacity>
          </View>
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
    maxHeight: '90%',
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
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  resetBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  distanceValueText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    width: '23%',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  categoryChipSelected: {
    backgroundColor: '#FFC700',
  },
  categoryChipUnselected: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  categoryChipText: {
    fontSize: 11,
    textAlign: 'center',
  },
  categoryChipTextSelected: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  categoryChipTextUnselected: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationBoxText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  distanceBarRow: {
    flexDirection: 'row',
    gap: 8,
  },
  distPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  distPillSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  distPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  distPillTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chipPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  chipPillSelected: {
    backgroundColor: '#FFC700',
  },
  chipPillUnselected: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipPillText: {
    fontSize: 12.5,
  },
  chipPillTextSelected: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  chipPillTextUnselected: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleLabel: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  bottomCtaWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  showResultsBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  showResultsBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
