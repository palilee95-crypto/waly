/** Shared catalog vocabulary. Merchant categories suggest a setup; they never restrict item types. */
export type CatalogItemType = 'product' | 'service' | 'addon' | 'automotive' | 'facility' | 'lodging' | 'dining' | 'catering' | 'class';
export type PricingUnit = 'unit' | 'kg' | 'pax' | 'hour' | 'night';
export type CatalogAvailability = 'stock' | 'time' | 'capacity';

export interface CatalogItemTypeConfig {
  label: string;
  icon: string;
  allowedPricingUnits: readonly PricingUnit[];
  availability: CatalogAvailability;
  supportsStock: boolean;
  supportsBooking: boolean;
  description: string;
}

export const CATALOG_ITEM_TYPES: readonly CatalogItemType[] = [
  'product', 'service', 'addon', 'automotive', 'facility', 'lodging', 'dining', 'catering', 'class',
];

export const ITEM_TYPE_CONFIG: Record<CatalogItemType, CatalogItemTypeConfig> = {
  product: { label: 'Product', icon: 'cube-outline', allowedPricingUnits: ['unit', 'kg'], availability: 'stock', supportsStock: true, supportsBooking: false, description: 'Physical goods, with optional stock tracking and variants.' },
  service: { label: 'Service', icon: 'cut-outline', allowedPricingUnits: ['unit', 'kg', 'hour'], availability: 'time', supportsStock: false, supportsBooking: true, description: 'Work or treatment, priced per service, weight or hour.' },
  addon: { label: 'Add-on', icon: 'add-circle-outline', allowedPricingUnits: ['unit', 'kg', 'pax', 'hour', 'night'], availability: 'stock', supportsStock: true, supportsBooking: false, description: 'An optional extra. Only enable stock tracking for physical goods.' },
  automotive: { label: 'Automotive service', icon: 'car-sport-outline', allowedPricingUnits: ['unit', 'hour'], availability: 'time', supportsStock: false, supportsBooking: true, description: 'Vehicle work scheduled against staff or work bays.' },
  facility: { label: 'Facility / resource', icon: 'football-outline', allowedPricingUnits: ['unit', 'hour'], availability: 'time', supportsStock: false, supportsBooking: true, description: 'Courts, studios or equipment reserved for a time slot; not consumable stock.' },
  lodging: { label: 'Lodging', icon: 'home-outline', allowedPricingUnits: ['night'], availability: 'time', supportsStock: false, supportsBooking: true, description: 'Rooms or accommodation reserved for a stay.' },
  dining: { label: 'Dining reservation', icon: 'restaurant-outline', allowedPricingUnits: ['unit', 'pax'], availability: 'capacity', supportsStock: false, supportsBooking: true, description: 'Tables and guest capacity reserved for a dining slot.' },
  catering: { label: 'Catering / event package', icon: 'fast-food-outline', allowedPricingUnits: ['unit', 'pax'], availability: 'capacity', supportsStock: false, supportsBooking: true, description: 'A fixed package or per-person event with serving capacity.' },
  class: { label: 'Class / session', icon: 'people-outline', allowedPricingUnits: ['unit', 'pax', 'hour'], availability: 'capacity', supportsStock: false, supportsBooking: true, description: 'Scheduled classes or sessions with participant capacity.' },
};

export interface MerchantCatalogConfig {
  suggestedItemTypes: readonly CatalogItemType[];
  suggestedCategories: readonly string[];
}

export const MERCHANT_CATALOG_CONFIG: Record<string, MerchantCatalogConfig> = {
  barber: { suggestedItemTypes: ['service', 'product', 'addon'], suggestedCategories: ['Haircuts', 'Beard care', 'Hair products'] },
  beauty: { suggestedItemTypes: ['service', 'product', 'addon'], suggestedCategories: ['Hair services', 'Facials', 'Nails', 'Beauty products'] },
  spa: { suggestedItemTypes: ['service', 'product', 'addon'], suggestedCategories: ['Massage', 'Body treatments', 'Wellness products'] },
  muslimah_spa: { suggestedItemTypes: ['service', 'product', 'addon'], suggestedCategories: ['Private treatments', 'Massage', 'Skincare'] },
  cafe: { suggestedItemTypes: ['product', 'addon', 'dining', 'catering'], suggestedCategories: ['Coffee', 'Pastries', 'Cakes', 'Meals'] },
  restaurant: { suggestedItemTypes: ['product', 'addon', 'dining', 'catering'], suggestedCategories: ['Main dishes', 'Sides', 'Drinks', 'Set meals'] },
  dessert: { suggestedItemTypes: ['product', 'catering', 'addon'], suggestedCategories: ['Ice cream', 'Desserts', 'Drinks', 'Catering', 'Toppings'] },
  beverage: { suggestedItemTypes: ['product', 'addon', 'catering'], suggestedCategories: ['Tea', 'Juices', 'Smoothies', 'Extras'] },
  carwash: { suggestedItemTypes: ['automotive', 'product', 'addon'], suggestedCategories: ['Car wash', 'Detailing', 'Coating', 'Car care'] },
  workshop: { suggestedItemTypes: ['automotive', 'product', 'addon'], suggestedCategories: ['Maintenance', 'Repairs', 'Tyres', 'Parts'] },
  gym: { suggestedItemTypes: ['class', 'service', 'product'], suggestedCategories: ['Classes', 'Personal training', 'Passes', 'Merchandise'] },
  sports: { suggestedItemTypes: ['facility', 'class', 'product', 'addon'], suggestedCategories: ['Courts', 'Coaching', 'Equipment rental', 'Accessories'] },
  optician: { suggestedItemTypes: ['product', 'service', 'addon'], suggestedCategories: ['Frames', 'Lenses', 'Accessories', 'Eye examinations'] },
  laundry: { suggestedItemTypes: ['service', 'addon', 'product'], suggestedCategories: ['Wash & fold', 'Dry cleaning', 'Ironing', 'Special care'] },
  boutique: { suggestedItemTypes: ['product', 'service'], suggestedCategories: ['Clothing', 'Accessories', 'Footwear', 'Alterations'] },
  groceries: { suggestedItemTypes: ['product', 'addon'], suggestedCategories: ['Fresh produce', 'Pantry', 'Drinks', 'Household'] },
  florist: { suggestedItemTypes: ['product', 'service', 'catering', 'addon'], suggestedCategories: ['Bouquets', 'Gifts', 'Custom arrangements', 'Events'] },
  pet: { suggestedItemTypes: ['service', 'product', 'addon'], suggestedCategories: ['Grooming', 'Consultations', 'Pet food', 'Accessories'] },
  repair: { suggestedItemTypes: ['service', 'product', 'addon'], suggestedCategories: ['Repairs', 'Spare parts', 'Accessories', 'Devices'] },
  studio: { suggestedItemTypes: ['service', 'facility', 'product', 'addon'], suggestedCategories: ['Photography', 'Session packages', 'Studio rental', 'Prints'] },
  interior_design: { suggestedItemTypes: ['service', 'product', 'addon'], suggestedCategories: ['Design consultation', 'Space planning', 'Renovation', 'Custom furniture'] },
  // Existing booking models remain available without adding or locking merchant categories.
  catering: { suggestedItemTypes: ['catering', 'product', 'addon'], suggestedCategories: ['Packages', 'Food stations', 'Event setup', 'Extra pax'] },
  lodging: { suggestedItemTypes: ['lodging', 'addon', 'product'], suggestedCategories: ['Rooms', 'Homestays', 'Chalets', 'Extras'] },
  travel_agency: { suggestedItemTypes: ['service', 'product', 'addon'], suggestedCategories: ['Tour packages', 'Flights & transfers', 'Travel insurance'] },
  umrah_hajj: { suggestedItemTypes: ['service', 'product', 'addon'], suggestedCategories: ['Umrah packages', 'Hajj packages', 'Visa & documents'] },
  car_rental: { suggestedItemTypes: ['facility', 'service', 'addon'], suggestedCategories: ['Self-drive', 'With driver', 'Airport transfer'] },
  attraction: { suggestedItemTypes: ['facility', 'product', 'addon'], suggestedCategories: ['Entry tickets', 'Ride passes', 'Season passes'] },
};

const DEFAULT_CONFIG: MerchantCatalogConfig = {
  suggestedItemTypes: ['product', 'service', 'addon'],
  suggestedCategories: ['Products', 'Services', 'Extras'],
};

/** Legacy onboarding used gadget while the public category ID is repair. */
export function normalizeMerchantCategory(category?: string | null): string {
  const normalized = (category || '').trim().toLowerCase();
  return normalized === 'gadget' ? 'repair' : normalized;
}

export function getMerchantCatalogConfig(category?: string | null): MerchantCatalogConfig {
  return MERCHANT_CATALOG_CONFIG[normalizeMerchantCategory(category)] || DEFAULT_CONFIG;
}

/** Suggestions first, followed by every other supported type for mixed businesses. */
export function getCatalogItemTypes(category?: string | null): CatalogItemType[] {
  return [...new Set([...getMerchantCatalogConfig(category).suggestedItemTypes, ...CATALOG_ITEM_TYPES])];
}

export function isCatalogItemType(value: unknown): value is CatalogItemType {
  return typeof value === 'string' && CATALOG_ITEM_TYPES.includes(value as CatalogItemType);
}

export function supportsPhysicalStock(type: CatalogItemType): boolean {
  return ITEM_TYPE_CONFIG[type].supportsStock;
}

export function getDefaultPricingUnit(type: CatalogItemType): PricingUnit {
  return ITEM_TYPE_CONFIG[type].allowedPricingUnits[0];
}
