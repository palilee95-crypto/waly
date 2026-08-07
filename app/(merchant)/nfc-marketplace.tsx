import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Modal, 
  TextInput, 
  Alert,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface StandProduct {
  id: string;
  name: string;
  tagline: string;
  price: string;
  originalPrice?: string;
  description: string;
  material: string;
  dimensions: string;
  colors: { name: string; hex: string; previewBg: string }[];
  icon: string;
  gradient: string[];
  discountTag?: string;
  badge?: string;
}

const PRODUCTS: StandProduct[] = [
  {
    id: 'acrylic',
    name: 'The Classic Acrylic',
    tagline: 'VIP Countertop Stand',
    price: 'RM 39',
    originalPrice: 'RM 59',
    discountTag: '33% OFF',
    badge: '🏆 BEST SELLER',
    description: 'High-gloss acrylic stand with a weighted base. Sleek, waterproof, and perfect for high-traffic cashier counters.',
    material: 'Premium Acrylic & Brass Plate',
    dimensions: '85 x 120 x 45 mm',
    colors: [
      { name: 'Piano Black', hex: '#050505', previewBg: '#050505' },
      { name: 'Crystal Clear', hex: '#FFFFFF', previewBg: '#E2E8F0' }
    ],
    icon: 'flash-outline',
    gradient: ['#050505', '#1E293B']
  },
  {
    id: 'walnut',
    name: 'The Walnut Minimalist',
    tagline: 'Eco Wood Stand',
    price: 'RM 49',
    originalPrice: 'RM 69',
    discountTag: '28% OFF',
    badge: '🌿 ECO-FRIENDLY',
    description: 'Crafted from sustainable dark walnut wood. Features laser-engraved gold detailing. Best for modern cafes and upscale brands.',
    material: 'Natural Walnut Wood & Gold Foil',
    dimensions: '90 x 110 x 50 mm',
    colors: [
      { name: 'Dark Walnut', hex: '#5C4033', previewBg: '#5C4033' },
      { name: 'Classic Oak', hex: '#C19A6B', previewBg: '#C19A6B' }
    ],
    icon: 'leaf-outline',
    gradient: ['#451A03', '#78350F']
  },
  {
    id: 'alloy',
    name: 'The Metal Pro',
    tagline: 'Space Alloy Stand',
    price: 'RM 69',
    originalPrice: 'RM 99',
    discountTag: '30% OFF',
    badge: '⚡ HEAVY DUTY',
    description: 'Brushed anodized aluminum stand. Weighted with non-slip silicone feet. Beautiful metallic finish that stands out.',
    material: 'Anodized Space-Grade Aluminum',
    dimensions: '80 x 130 x 40 mm',
    colors: [
      { name: 'Space Gray', hex: '#4B5563', previewBg: '#4B5563' },
      { name: 'Nordic Silver', hex: '#9CA3AF', previewBg: '#D1D5DB' },
      { name: 'Champagne Gold', hex: '#D97706', previewBg: '#FCD34D' }
    ],
    icon: 'cube-outline',
    gradient: ['#1F2937', '#4B5563']
  }
];

export default function NfcMarketplaceScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('All Stands');
  const [selectedColor, setSelectedColor] = useState<{ [key: string]: string }>({
    acrylic: 'Piano Black',
    walnut: 'Dark Walnut',
    alloy: 'Space Gray'
  });
  const [selectedProduct, setSelectedProduct] = useState<StandProduct | null>(null);
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);

  const handleOrder = (product: StandProduct) => {
    setSelectedProduct(product);
  };

  const submitOrder = () => {
    if (!shippingAddress.trim() || !shippingPhone.trim()) {
      Alert.alert('Error', 'Please fill in your address and phone number.');
      return;
    }
    setIsOrdering(true);
    setTimeout(() => {
      setIsOrdering(false);
      setSelectedProduct(null);
      setShippingAddress('');
      setShippingPhone('');
      Alert.alert(
        'Order Received!',
        'Thank you! Your custom NFC stand order has been placed successfully. Track delivery under notifications.',
        [{ text: 'Great!' }]
      );
    }, 1500);
  };

  return (
    <View style={styles.container}>
      {/* Sticky Dark Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>NFC Marketplace</Text>
        </View>
        <Image
          source={require('../../assets/risev logo.png')}
          style={{ width: 80, height: 26, resizeMode: 'contain', tintColor: '#FFFFFF' }}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Premium NFC Stands</Text>

        {/* Horizontal Category Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContent}
        >
          {['All Stands', 'Acrylic', 'Eco Wood', 'Premium Metal'].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Product Cards Stack */}
        {PRODUCTS.filter(prod => {
          if (activeTab === 'All Stands') return true;
          if (activeTab === 'Acrylic') return prod.id === 'acrylic';
          if (activeTab === 'Eco Wood') return prod.id === 'walnut';
          if (activeTab === 'Premium Metal') return prod.id === 'alloy';
          return true;
        }).map((prod) => {
          const activeColorName = selectedColor[prod.id];
          const activeColor = prod.colors.find(c => c.name === activeColorName) || prod.colors[0];

          return (
            <View key={prod.id} style={styles.productCard}>
              {/* Product Visual Frame */}
              <View style={[styles.visualFrame, { backgroundColor: activeColor.previewBg }]}>
                {/* Product Badge */}
                {prod.badge && (
                  <View style={styles.productBadgeContainer}>
                    <Text style={styles.productBadgeText}>{prod.badge}</Text>
                  </View>
                )}

                {/* 3D-Like Stand representation with CSS */}
                <View style={[styles.mockupStand, { backgroundColor: prod.id === 'walnut' ? '#5C4033' : prod.id === 'alloy' ? '#4B5563' : '#050505' }]}>
                  {/* Stand Brass Plate / Logo Badge */}
                  <View style={styles.mockupEmblem}>
                    <Ionicons name="wifi" size={14} color="#FFC700" style={{ transform: [{ rotate: '90deg' }] }} />
                    <Text style={styles.mockupEmblemText}>TAP HERE</Text>
                  </View>
                </View>
                
                {/* Visual Accent Badge */}
                <View style={styles.visualBadge}>
                  <Text style={styles.visualBadgeText}>{activeColor.name}</Text>
                </View>
              </View>

              {/* Product Metadata */}
              <View style={styles.productInfo}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{prod.name}</Text>
                    <Text style={styles.productTagline}>{prod.tagline}</Text>
                  </View>
                  <View style={styles.priceColumn}>
                    <Text style={styles.productPrice}>{prod.price}</Text>
                    {prod.originalPrice && (
                      <Text style={styles.productOriginalPrice}>{prod.originalPrice}</Text>
                    )}
                    {prod.discountTag && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>{prod.discountTag}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.productDesc}>{prod.description}</Text>

                {/* Specs */}
                <View style={styles.specsContainer}>
                  <View style={styles.specRow}>
                    <Ionicons name="hammer-outline" size={12} color="#64748B" />
                    <Text style={styles.specText}>{prod.material}</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Ionicons name="resize-outline" size={12} color="#64748B" />
                    <Text style={styles.specText}>{prod.dimensions}</Text>
                  </View>
                </View>

                {/* Color Selector */}
                <View style={styles.colorSelectorRow}>
                  <Text style={styles.colorLabel}>Color:</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {prod.colors.map((c) => {
                      const isActive = selectedColor[prod.id] === c.name;
                      return (
                        <TouchableOpacity
                          key={c.name}
                          style={[
                            styles.colorDotOutline,
                            isActive && { borderColor: '#FFC700' }
                          ]}
                          onPress={() => setSelectedColor(prev => ({ ...prev, [prod.id]: c.name }))}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.colorDot, { backgroundColor: c.hex === '#FFFFFF' ? '#F8FAFC' : c.hex }]} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Buy Button */}
                <TouchableOpacity
                  style={styles.orderBtn}
                  onPress={() => handleOrder(prod)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.orderBtnText}>Order {prod.name}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Shipping address Confirmation Modal */}
      <Modal
        visible={selectedProduct !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Order</Text>
              <TouchableOpacity onPress={() => setSelectedProduct(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedProduct && (
              <View style={styles.modalProductBrief}>
                <View style={styles.briefText}>
                  <Text style={styles.briefName}>{selectedProduct.name}</Text>
                  <Text style={styles.briefColor}>Color: {selectedColor[selectedProduct.id]}</Text>
                </View>
                <Text style={styles.briefPrice}>{selectedProduct.price}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Delivery Address</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                value={shippingAddress}
                onChangeText={setShippingAddress}
                placeholder="Enter complete shipping address"
                placeholderTextColor="#94A3B8"
                multiline={true}
                numberOfLines={3}
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Recipient Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={shippingPhone}
                onChangeText={setShippingPhone}
                placeholder="e.g. +60123456789"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={submitOrder}
              disabled={isOrdering}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>
                {isOrdering ? 'Processing...' : 'Confirm & Purchase'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollHeaderBg: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    height: 210,
    backgroundColor: '#050505',
    zIndex: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#050505',
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
  },
  promoBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    zIndex: 1,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  promoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promoTextColumn: {
    flex: 1,
    marginRight: 12,
  },
  freeBadge: {
    backgroundColor: '#FFC700',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  freeBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  promoTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  promoDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 15,
  },
  promoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,199,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 16,
    marginTop: 8,
    zIndex: 1,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  visualFrame: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  mockupStand: {
    width: 76,
    height: 105,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
    transform: [{ perspective: 350 }, { rotateX: '15deg' }, { rotateY: '-12deg' }],
  },
  mockupEmblem: {
    width: 54,
    height: 72,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mockupEmblemText: {
    fontSize: 7.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginTop: 4,
  },
  visualBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(5, 5, 5, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 20,
  },
  visualBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  productInfo: {
    padding: 18,
  },
  productName: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  productTagline: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
  },
  tabsContainer: {
    marginBottom: 20,
    marginTop: -4,
    zIndex: 1,
  },
  tabsContent: {
    gap: 10,
    paddingRight: 20,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
  },
  tabBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#050505',
  },
  productBadgeContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FFC700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  priceColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productPrice: {
    fontSize: 19,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  productOriginalPrice: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#15803D',
  },
  productDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    marginTop: 10,
    lineHeight: 18,
  },
  specsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  colorSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  colorLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
  },
  colorDotOutline: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  orderBtn: {
    backgroundColor: '#050505',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  orderBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  modalProductBrief: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  briefText: {
    flex: 1,
  },
  briefName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  briefColor: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 1,
  },
  briefPrice: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  inputContainer: {
    marginBottom: 16,
    width: '100%',
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
    backgroundColor: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: '#FFC700',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
});
