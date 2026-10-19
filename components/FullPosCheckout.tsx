import React, { useMemo, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type CartItem = {
  id: string;
  name: string;
  price: number;
  qty?: number;
  item_type?: string;
  isBooking?: boolean;
};

type Props = {
  name: string;
  phone?: string;
  locale: string;
  catalog: any[];
  items: CartItem[];
  setItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  imageFor: (item: any) => string | null;
  onAdd: (item: any) => void;
  onBack: () => void;
  onPay: () => void;
  total: number;
  subtotal: number;
  discount: number;
  vouchers: any[];
  voucher: any;
  onVoucher: (voucher: any) => void;
  stamps: string;
  onStamps: (value: string) => void;
  points: number;
};

const isService = (item: any) =>
  item?.item_type === 'service' || item?.category === 'service';

const parseVoucherMeta = (voucher: any) => {
  try {
    return typeof voucher?.metadata === 'string' ? JSON.parse(voucher.metadata) : (voucher?.metadata || {});
  } catch (e) {
    return {};
  }
};

export default function FullPosCheckout({
  name,
  phone,
  locale,
  catalog,
  items,
  setItems,
  imageFor,
  onAdd,
  onBack,
  onPay,
  total,
  subtotal,
  discount,
  vouchers,
  voucher,
  onVoucher,
  stamps,
  onStamps,
  points,
}: Props) {
  const ms = locale === 'ms';
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'services' | 'addons'>('all');
  const [showVouchers, setShowVouchers] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const columns = width >= 900 ? 4 : width >= 620 ? 3 : 2;
  const stampCount = Math.max(0, parseInt(stamps, 10) || 0);

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog || []).filter((item: any) => {
      const matchesSearch = !q || String(item?.name || '').toLowerCase().includes(q);
      const matchesCategory =
        category === 'all' ||
        (category === 'services' && isService(item)) ||
        (category === 'addons' && !isService(item));
      return matchesSearch && matchesCategory;
    });
  }, [catalog, query, category]);

  const qtyById = useMemo(() => {
    const map: Record<string, number> = {};
    (items || []).forEach((item) => {
      map[item.id] = (map[item.id] || 0) + (item.qty || 1);
    });
    return map;
  }, [items]);

  const changeQty = (index: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      const qty = (current.qty || 1) + delta;
      if (qty <= 0) return next.filter((_, i) => i !== index);
      next[index] = { ...current, qty };
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addCustomAmount = () => {
    const price = Number.parseFloat(customAmount);
    if (!Number.isFinite(price) || price <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: ms ? 'Jumlah manual' : 'Custom amount',
        price,
        qty: 1,
        item_type: 'custom',
      },
    ]);
    setCustomAmount('');
  };

  const money = (value: number) =>
    `RM ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.headerBack} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
          <Text style={styles.headerBackText}>{ms ? 'Kembali' : 'Back'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>{ms ? 'POS Penuh' : 'Full POS'}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {[name, phone].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="cart-outline" size={13} color="#050505" />
          <Text style={styles.headerBadgeText}>{items.reduce((sum, item) => sum + (item.qty || 1), 0)}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#86868B" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={ms ? 'Cari produk atau servis…' : 'Search products or services…'}
            placeholderTextColor="#86868B"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color="#86868B" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.categoryRow}>
        {([
          ['all', ms ? 'Semua' : 'All'],
          ['services', ms ? 'Servis' : 'Services'],
          ['addons', ms ? 'Tambahan' : 'Add-ons'],
        ] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setCategory(key)}
            style={[styles.categoryPill, category === key && styles.categoryPillActive]}
            activeOpacity={0.75}
          >
            <Text style={[styles.categoryText, category === key && styles.categoryTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{ms ? 'Katalog' : 'Catalog'}</Text>
        {filteredCatalog.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={22} color="#94A3B8" />
            <Text style={styles.emptyText}>{ms ? 'Tiada item sepadan.' : 'No matching items.'}</Text>
          </View>
        ) : (
          <View style={styles.catalogGrid}>
            {filteredCatalog.map((item: any) => {
              const uri = imageFor(item);
              const qty = qtyById[item.id] || 0;
              const price = Number(item.price) || 0;
              return (
                <TouchableOpacity
                  key={item.id || item.name}
                  style={[styles.catalogCard, { width: `${100 / columns - 2}%` }]}
                  activeOpacity={0.8}
                  onPress={() => onAdd(item)}
                >
                  <View style={styles.catalogImageWrap}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.catalogImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name={isService(item) ? 'construct-outline' : 'pricetag-outline'} size={22} color="#94A3B8" />
                    )}
                    {qty > 0 ? (
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyBadgeText}>{qty}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.catalogName} numberOfLines={2}>{item.name}</Text>
                  <View style={styles.catalogFooter}>
                    <Text style={styles.catalogPrice}>{money(price)}</Text>
                    <View style={styles.addCircle}>
                      <Ionicons name="add" size={14} color="#050505" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>{ms ? 'Pesanan' : 'Order'}</Text>
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={22} color="#94A3B8" />
            <Text style={styles.emptyText}>{ms ? 'Tiada item dalam pesanan.' : 'No items in the order yet.'}</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {items.map((item, index) => (
              <View key={`${item.id}-${index}`} style={styles.cartRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cartName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.cartMeta}>
                    {money((Number(item.price) || 0) * (item.qty || 1))}
                    {item.isBooking ? ` · ${ms ? 'Tempahan' : 'Booking'}` : ''}
                  </Text>
                </View>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => changeQty(index, -1)} accessibilityRole="button" accessibilityLabel="Decrease quantity">
                    <Ionicons name="remove" size={16} color="#0F172A" />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{item.qty || 1}</Text>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => changeQty(index, 1)} accessibilityRole="button" accessibilityLabel="Increase quantity">
                    <Ionicons name="add" size={16} color="#0F172A" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeBtn} accessibilityRole="button" accessibilityLabel="Remove item">
                  <Ionicons name="trash-outline" size={17} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            value={customAmount}
            onChangeText={setCustomAmount}
            keyboardType="decimal-pad"
            placeholder={ms ? 'Jumlah manual (RM)' : 'Custom amount (RM)'}
            placeholderTextColor="#86868B"
          />
          <TouchableOpacity style={styles.customAddBtn} onPress={addCustomAmount} activeOpacity={0.8}>
            <Ionicons name="add" size={15} color="#050505" />
            <Text style={styles.customAddText}>{ms ? 'Tambah' : 'Add'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionCard}>
          <TouchableOpacity style={styles.optionRow} onPress={() => setShowVouchers((v) => !v)} activeOpacity={0.75}>
            <View style={styles.optionIcon}>
              <Ionicons name="ticket-outline" size={17} color="#B45309" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.optionLabel}>{ms ? 'Baucar' : 'Voucher'}</Text>
              <Text style={styles.optionValue} numberOfLines={1}>
                {voucher
                  ? (voucher.expand?.reward?.name || parseVoucherMeta(voucher).snapshot_title || voucher.code)
                  : `${vouchers.length} ${ms ? 'tersedia' : 'available'}`}
              </Text>
            </View>
            {voucher ? (
              <TouchableOpacity onPress={() => onVoucher(null)} accessibilityRole="button" accessibilityLabel="Remove voucher">
                <Ionicons name="close-circle-outline" size={20} color="#64748B" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down" size={17} color="#64748B" />
            )}
          </TouchableOpacity>

          {showVouchers ? (
            <View style={styles.voucherList}>
              {vouchers.length === 0 ? (
                <Text style={styles.optionValue}>{ms ? 'Tiada baucar tersedia.' : 'No vouchers available.'}</Text>
              ) : (
                vouchers.map((v: any) => {
                  const meta = parseVoucherMeta(v);
                  const selected = voucher?.id === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.voucherOption, selected && styles.voucherOptionSelected]}
                      onPress={() => { onVoucher(selected ? null : v); setShowVouchers(false); }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.cartName} numberOfLines={1}>{meta.snapshot_title || v.expand?.reward?.name || v.code}</Text>
                        <Text style={styles.optionValue} numberOfLines={1}>
                          {meta.discount_type === 'percentage'
                            ? `${meta.discount_value}% OFF`
                            : meta.discount_type === 'fixed_amount'
                              ? `RM${meta.discount_value} OFF`
                              : (ms ? 'Item percuma' : 'Free item')}
                        </Text>
                      </View>
                      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color="#0F172A" />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ) : null}

          <View style={styles.optionDivider} />

          <View style={styles.optionRow}>
            <View style={styles.optionIcon}>
              <Ionicons name="ribbon-outline" size={17} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>{ms ? 'Setem' : 'Stamps'}</Text>
              <Text style={styles.optionValue}>{points} {ms ? 'mata akan diperoleh' : 'points will be earned'}</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => onStamps(String(Math.max(0, stampCount - 1)))} accessibilityRole="button" accessibilityLabel="Decrease stamps">
                <Ionicons name="remove" size={16} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{stampCount}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => onStamps(String(Math.min(99, stampCount + 1)))} accessibilityRole="button" accessibilityLabel="Increase stamps">
                <Ionicons name="add" size={16} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerTotals}>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>{ms ? 'Subtotal' : 'Subtotal'}</Text>
            <Text style={styles.footerValue}>{money(subtotal)}</Text>
          </View>
          {discount > 0 ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>{ms ? 'Diskaun' : 'Discount'}</Text>
              <Text style={[styles.footerValue, { color: '#059669' }]}>− {money(discount)}</Text>
            </View>
          ) : null}
          <View style={styles.footerRow}>
            <Text style={styles.footerTotalLabel}>{ms ? 'Jumlah' : 'Total'}</Text>
            <Text style={styles.footerTotalValue}>{money(total)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.payButton, items.length === 0 && styles.payButtonDisabled]}
          onPress={onPay}
          disabled={items.length === 0}
          activeOpacity={0.85}
        >
          <Ionicons name="card-outline" size={18} color="#050505" />
          <Text style={styles.payButtonText}>{ms ? 'Bayar' : 'Pay'} · {money(total)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10 },
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  headerBackText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFCC00', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  headerBadgeText: { fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 11, minHeight: 42 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#0F172A', paddingVertical: Platform.OS === 'web' ? 8 : 4 },
  categoryRow: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  categoryPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F1F5F9' },
  categoryPillActive: { backgroundColor: '#0F172A' },
  categoryText: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' },
  categoryTextActive: { color: '#FFCC00' },
  scrollContent: { paddingBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  catalogGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catalogCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9EEF2', borderRadius: 14, padding: 8, gap: 6 },
  catalogImageWrap: { height: 78, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  catalogImage: { width: '100%', height: '100%' },
  qtyBadge: { position: 'absolute', top: 5, right: 5, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#FFCC00', alignItems: 'center', justifyContent: 'center' },
  qtyBadgeText: { fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' },
  catalogName: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A', lineHeight: 15 },
  catalogFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catalogPrice: { fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' },
  addCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFCC00', alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', gap: 6, paddingVertical: 18, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#EEF0F3' },
  emptyText: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  customInput: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#F1F5F9', paddingHorizontal: 11, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#0F172A' },
  customAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 42, paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#FFCC00' },
  customAddText: { fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' },
  cartName: { fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' },
  cartMeta: { fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderRadius: 9, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 4, paddingVertical: 2 },
  stepperBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { minWidth: 18, textAlign: 'center', fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' },
  removeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  optionCard: { marginTop: 14, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#EEF0F3', paddingHorizontal: 10, paddingVertical: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  optionIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' },
  optionValue: { fontSize: 10.5, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 1 },
  optionDivider: { height: 1, backgroundColor: '#E8ECF1', marginVertical: 4 },
  voucherList: { paddingVertical: 4, gap: 6 },
  voucherOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  voucherOptionSelected: { borderColor: '#FFCC00', backgroundColor: '#FFFBEA' },
  footer: { borderTopWidth: 1, borderTopColor: '#E8ECF1', paddingTop: 10, paddingBottom: 14, backgroundColor: '#FFFFFF' },
  footerTotals: { gap: 3, marginBottom: 8 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' },
  footerValue: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' },
  footerTotalLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' },
  footerTotalValue: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' },
  payButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#FFCC00', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  payButtonDisabled: { opacity: 0.5 },
  payButtonText: { fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' },
});
