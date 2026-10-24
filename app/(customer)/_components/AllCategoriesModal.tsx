import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';

export type CategoryItemType = {
  id: string;
  name: string;
  group: string;
  icon: string;
  bg: string;
  color: string;
  merchantCount?: number;
  descEn?: string;
  descMs?: string;
};

export const ALL_CATEGORIES_LIST: CategoryItemType[] = [
  // 💈 Grooming & Beauty
  { 
    id: 'barber', 
    name: 'Barber', 
    group: 'Grooming & Beauty', 
    icon: 'cut', 
    bg: '#FEF9C3', 
    color: '#0F172A', 
    merchantCount: 14,
    descEn: "Haircut, beard trim & men's grooming",
    descMs: "Gunting rambut, janggut & dandanan lelaki",
  },
  { 
    id: 'beauty', 
    name: 'Beauty & Salon', 
    group: 'Grooming & Beauty', 
    icon: 'flower-outline', 
    bg: '#FCE7F3', 
    color: '#DB2777', 
    merchantCount: 18,
    descEn: "Hair styling, facial & manicure",
    descMs: "Salun rambut, rawatan muka & kuku",
  },
  { 
    id: 'spa', 
    name: 'Spa & Massage', 
    group: 'Grooming & Beauty', 
    icon: 'sparkles-outline', 
    bg: '#F3E8FF', 
    color: '#7C3AED', 
    merchantCount: 8,
    descEn: "Body massage & reflexology therapy",
    descMs: "Urutan badan, refleksologi & terapi",
  },
  { 
    id: 'muslimah_spa', 
    name: 'Muslimah Spa', 
    group: 'Grooming & Beauty', 
    icon: 'heart-outline', 
    bg: '#FDF2F8', 
    color: '#BE185D', 
    merchantCount: 6,
    descEn: "Women-only spa & private treatments",
    descMs: "Spa khusus wanita & rawatan privasi",
  },

  // ☕ Food & Drinks
  { 
    id: 'cafe', 
    name: 'Cafe & Bakery', 
    group: 'Food & Drinks', 
    icon: 'cafe', 
    bg: '#FFEDD5', 
    color: '#C2410C', 
    merchantCount: 26,
    descEn: "Coffee, pastry, cakes & all-day brunch",
    descMs: "Kopi, pastri, kek & sarapan santai",
  },
  { 
    id: 'restaurant', 
    name: 'Restaurant', 
    group: 'Food & Drinks', 
    icon: 'restaurant', 
    bg: '#FEE2E2', 
    color: '#DC2626', 
    merchantCount: 32,
    descEn: "Dine-in meals, local & western delights",
    descMs: "Hidangan santapan, masakan tempatan & barat",
  },
  { 
    id: 'dessert', 
    name: 'Dessert & Ice Cream', 
    group: 'Food & Drinks', 
    icon: 'ice-cream-outline', 
    bg: '#FFF7ED', 
    color: '#EA580C', 
    merchantCount: 12,
    descEn: "Ice cream, waffles, boba & sweets",
    descMs: "Aiskrim, wafel, boba & pemanis mulut",
  },
  { 
    id: 'beverage', 
    name: 'Beverage Bar', 
    group: 'Food & Drinks', 
    icon: 'wine-outline', 
    bg: '#ECFDF5', 
    color: '#059669', 
    merchantCount: 9,
    descEn: "Fresh juices, fruit smoothies & tea",
    descMs: "Jus segar, smoothie buah & aneka teh",
  },

  // 🚘 Automotive
  { 
    id: 'carwash', 
    name: 'Car Wash & Detailing', 
    group: 'Automotive', 
    icon: 'car-sport', 
    bg: '#E0F2FE', 
    color: '#0284C7', 
    merchantCount: 15,
    descEn: "Car wash, detailing, wax & coating",
    descMs: "Basuhan kereta, detailing & salutan wax",
  },
  { 
    id: 'workshop', 
    name: 'Workshop & Repair', 
    group: 'Automotive', 
    icon: 'build-outline', 
    bg: '#F1F5F9', 
    color: '#334155', 
    merchantCount: 11,
    descEn: "Vehicle repair, tyre service & parts",
    descMs: "Baiki kenderaan, servis tayar & alat ganti",
  },

  // 🏋️ Fitness & Lifestyle
  { 
    id: 'gym', 
    name: 'Gym & Fitness', 
    group: 'Fitness & Lifestyle', 
    icon: 'barbell-outline', 
    bg: '#E0E7FF', 
    color: '#4338CA', 
    merchantCount: 7,
    descEn: "Gym workout, weights & personal fitness",
    descMs: "Pusat kecergasan, senaman & latihan peribadi",
  },
  { 
    id: 'sports', 
    name: 'Sports Venue', 
    group: 'Fitness & Lifestyle', 
    icon: 'trophy-outline', 
    bg: '#FEF3C7', 
    color: '#B45309', 
    merchantCount: 5,
    descEn: "Badminton, futsal & recreational courts",
    descMs: "Gelanggang badminton, futsal & sukan",
  },
  { 
    id: 'optician', 
    name: 'Optical & Eyewear', 
    group: 'Fitness & Lifestyle', 
    icon: 'glasses-outline', 
    bg: '#F0FDFA', 
    color: '#0D9488', 
    merchantCount: 4,
    descEn: "Eyeglasses, sunglasses & vision test",
    descMs: "Cermin mata, cermin gelap & ujian mata",
  },

  // 🧺 Retail & Services
  { 
    id: 'laundry', 
    name: 'Laundry & Dry Clean', 
    group: 'Retail & Services', 
    icon: 'shirt-outline', 
    bg: '#EFF6FF', 
    color: '#2563EB', 
    merchantCount: 10,
    descEn: "Self-service laundromat & dry cleaning",
    descMs: "Dobi layan diri, cucian kering & gosok",
  },
  { 
    id: 'boutique', 
    name: 'Boutique & Fashion', 
    group: 'Retail & Services', 
    icon: 'bag-handle-outline', 
    bg: '#FAF5FF', 
    color: '#9333EA', 
    merchantCount: 16,
    descEn: "Apparel, clothing, shoes & modest wear",
    descMs: "Pakaian, fesyen, kasut & busana muslimah",
  },
  { 
    id: 'groceries', 
    name: 'Groceries & Mart', 
    group: 'Retail & Services', 
    icon: 'cart-outline', 
    bg: '#FEF2F2', 
    color: '#E11D48', 
    merchantCount: 20,
    descEn: "Mini market, daily essentials & produce",
    descMs: "Pasar mini, barangan dapur & keperluan harian",
  },
  { 
    id: 'florist', 
    name: 'Florist & Gifts', 
    group: 'Retail & Services', 
    icon: 'rose-outline', 
    bg: '#FFF1F2', 
    color: '#E11D48', 
    merchantCount: 6,
    descEn: "Fresh flowers, bouquet gifts & hampers",
    descMs: "Jambangan bunga, gubahan hadiah & hamper",
  },

  // 🛠️ Specialty Services
  { 
    id: 'pet', 
    name: 'Pet Care & Vet', 
    group: 'Specialty Services', 
    icon: 'paw-outline', 
    bg: '#FFFBEB', 
    color: '#D97706', 
    merchantCount: 8,
    descEn: "Pet grooming, vet care & pet supplies",
    descMs: "Dandanan haiwan, klinik veterinar & makanan",
  },
  { 
    id: 'repair', 
    name: 'Gadget & Mobile Repair', 
    group: 'Specialty Services', 
    icon: 'hardware-chip-outline', 
    bg: '#F8FAFC', 
    color: '#475569', 
    merchantCount: 13,
    descEn: "Smartphone, screen & laptop fixing",
    descMs: "Baiki telefon pintar, skrin & komputer riba",
  },
  { 
    id: 'studio', 
    name: 'Studio & Photography', 
    group: 'Specialty Services', 
    icon: 'camera-outline', 
    bg: '#F5F3FF', 
    color: '#6D28D9', 
    merchantCount: 5,
    descEn: "Photo studio, creative media & events",
    descMs: "Studio fotografi, media kreatif & acara",
  },
  { 
    id: 'interior_design', 
    name: 'Interior Design', 
    group: 'Specialty Services', 
    icon: 'home-outline', 
    bg: '#F4F4F5', 
    color: '#18181B', 
    merchantCount: 0,
    descEn: "Space planning, renovation & custom furniture",
    descMs: "Perancangan ruang, ubah suai & perabot tersuai",
  },

  // ✈️ Travel & Tours
  { 
    id: 'travel_agency', 
    name: 'Travel Agency', 
    group: 'Travel & Tours', 
    icon: 'airplane-outline', 
    bg: '#E0F2FE', 
    color: '#0369A1', 
    merchantCount: 0,
    descEn: "Tour packages, flights & holiday planning",
    descMs: "Pakej pelancongan, penerbangan & perancangan percutian",
  },
  { 
    id: 'umrah_hajj', 
    name: 'Umrah & Hajj', 
    group: 'Travel & Tours', 
    icon: 'moon-outline', 
    bg: '#ECFDF5', 
    color: '#047857', 
    merchantCount: 0,
    descEn: "Pilgrimage packages, guides & visa",
    descMs: "Pakej umrah & haji, mutawif & visa",
  },
  { 
    id: 'car_rental', 
    name: 'Car Rental', 
    group: 'Travel & Tours', 
    icon: 'car-outline', 
    bg: '#F1F5F9', 
    color: '#334155', 
    merchantCount: 0,
    descEn: "Self-drive, chauffeur & airport transfer",
    descMs: "Sewa kereta, pemandu & pemindahan lapangan terbang",
  },
  { 
    id: 'attraction', 
    name: 'Attraction & Tickets', 
    group: 'Travel & Tours', 
    icon: 'ticket-outline', 
    bg: '#FEF3C7', 
    color: '#B45309', 
    merchantCount: 0,
    descEn: "Theme parks, entry passes & experiences",
    descMs: "Taman tema, tiket masuk & pengalaman",
  },
];

type AllCategoriesModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void;
  mode?: 'customer' | 'merchant';
  selectedCategoryId?: string;
};

export default function AllCategoriesModal({
  visible,
  onClose,
  onSelectCategory,
  mode = 'customer',
  selectedCategoryId,
}: AllCategoriesModalProps) {
  const { locale } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = ALL_CATEGORIES_LIST.filter((cat) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = cat.name.toLowerCase().includes(query);
    const groupMatch = cat.group.toLowerCase().includes(query);
    const descEnMatch = cat.descEn?.toLowerCase().includes(query) ?? false;
    const descMsMatch = cat.descMs?.toLowerCase().includes(query) ?? false;
    return nameMatch || groupMatch || descEnMatch || descMsMatch;
  });

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
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.headerIconBox}>
                  <Ionicons name="grid" size={15} color="#FFCC00" />
                </View>
                <Text style={styles.headerTitle}>
                  {mode === 'merchant'
                    ? (locale === 'en' ? 'Select Store Category' : 'Pilih Kategori Bisnes')
                    : (locale === 'en' ? 'All Categories' : 'Semua Kategori')}
                </Text>
              </View>
              {mode === 'merchant' && (
                <Text style={styles.headerSubtitle}>
                  {locale === 'en'
                    ? 'Choose your primary store category for customer discovery & perks.'
                    : 'Pilih industri utama premis anda untuk penyesuaian profil & carian pelanggan.'}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Search Category Bar */}
          <View style={styles.searchBarWrap}>
            <Ionicons name="search-outline" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={locale === 'en' ? 'Search category (e.g. Barber, Cafe, Spa)...' : 'Cari kategori (cth. Barber, Kafe, Spa)...'}
              placeholderTextColor="#94A3B8"
              {...Platform.select({
                web: { outlineStyle: 'none' } as any,
              })}
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
                  <View style={styles.groupListCard}>
                    {groupItems.map((cat, index) => {
                      const isSelected = mode === 'merchant' && cat.id === selectedCategoryId;
                      const isLast = index === groupItems.length - 1;
                      return (
                        <React.Fragment key={cat.id}>
                          <TouchableOpacity
                            style={[
                              styles.catCard,
                              isSelected && styles.catCardSelected,
                            ]}
                            onPress={() => {
                              onSelectCategory(cat.id);
                              onClose();
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
                              <Ionicons name={cat.icon as any} size={22} color={cat.color} />
                            </View>

                            <View style={styles.catMetaCol}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[styles.catName, isSelected && styles.catNameSelected]} numberOfLines={1}>
                                  {cat.name}
                                </Text>
                                {isSelected && (
                                  <View style={styles.selectedPillBadge}>
                                    <Text style={styles.selectedPillBadgeText}>
                                      {locale === 'en' ? 'SELECTED' : 'DIPILIH'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.catDesc} numberOfLines={1}>
                                {mode === 'merchant'
                                  ? (locale === 'en' ? cat.descEn : cat.descMs)
                                  : `${cat.merchantCount} merchants`}
                              </Text>
                            </View>

                            {mode === 'merchant' ? (
                              <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                                {isSelected && (
                                  <Ionicons name="checkmark" size={14} color="#FFCC00" />
                                )}
                              </View>
                            ) : (
                              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                            )}
                          </TouchableOpacity>
                          {!isLast && <View style={styles.rowDivider} />}
                        </React.Fragment>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#000000',
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
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginLeft: 10,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
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
    padding: 0,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  groupSection: {
    marginBottom: 18,
  },
  groupTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  groupListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  catCardSelected: {
    backgroundColor: '#FFFDF5',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 68,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
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
  catNameSelected: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  selectedPillBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedPillBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFCC00',
    letterSpacing: 0.4,
  },
  catDesc: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
});
