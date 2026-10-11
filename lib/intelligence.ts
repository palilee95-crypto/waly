// lib/intelligence.ts
// Risev Intelligence Engine — Client Service for Expo / React Native
import pb from './pocketbase';

export interface RecommendedMerchant {
  id: string;
  name: string;
  store_name: string;
  slug: string;
  category: string;
  city: string;
  address: string;
  rating: number;
  reviews_count: number;
  banner?: string;
  logo?: string;
  cover_url?: string;
  is_pro?: boolean;
  distance_km: number;
  recommendation_score: number;
  recommendation_reason: string;
  badge_type: 'almost_unlocked' | 'frequent' | 'nearby' | 'popular' | 'featured';
  stamps_count?: number;
}

export interface PrioritizedRewardsResponse {
  ready_to_redeem: any[];
  almost_unlocked: any[];
  active_cards: any[];
}

export interface NextVisitPrediction {
  has_sufficient_history: boolean;
  typical_interval_days: number;
  last_visit_date?: string;
  estimated_next_visit_date?: string;
  confidence_score?: number;
  prediction_text?: string;
}

/**
 * Log customer behavioral events asynchronously to the Intelligence Engine.
 */
export async function trackIntelligenceEvent(
  eventType: string,
  merchantId?: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const customerId = pb.authStore.record?.id || null;
    await pb.send('/api/risev/events', {
      method: 'POST',
      body: {
        event_type: eventType,
        customer_id: customerId,
        merchant_id: merchantId || null,
        metadata: metadata || {},
        event_source: 'mobile_expo',
      },
    });
  } catch (err) {
    // Non-blocking telemetry
    console.debug('[TRACK_EVENT_DEBUG]', eventType, err);
  }
}

/**
 * Fetch personalized "For You" merchant recommendations.
 */
export async function getForYouRecommendations(
  lat: number = 6.268,
  lng: number = 100.411,
  limit: number = 10
): Promise<RecommendedMerchant[]> {
  try {
    const response = await pb.send<{ success: boolean; data: RecommendedMerchant[] }>(
      `/api/risev/recommendations/for-you?lat=${lat}&lng=${lng}&limit=${limit}`,
      { method: 'GET' }
    );
    if (response && response.data && Array.isArray(response.data)) {
      return response.data;
    }
  } catch (err) {
    console.debug('[GET_FOR_YOU_ERR] Falling back to default records', err);
  }

  // Graceful Offline / Unreachable Fallback: Fetch top active merchants directly
  try {
    const records = await pb.collection('merchants').getList(1, limit, {
      sort: '-created',
    });
    return records.items.map((m: any) => {
      let resolvedCover = '';
      if (m.banner && typeof m.banner === 'string' && m.banner.trim().length > 0) {
        resolvedCover = `${pb.baseUrl}/api/files/merchants/${m.id}/${m.banner}`;
      } else if (m.background_image && typeof m.background_image === 'string' && m.background_image.trim().length > 0) {
        resolvedCover = `${pb.baseUrl}/api/files/merchants/${m.id}/${m.background_image}`;
      } else if (m.logo && typeof m.logo === 'string' && m.logo.trim().length > 0) {
        resolvedCover = `${pb.baseUrl}/api/files/merchants/${m.id}/${m.logo}`;
      }

      return {
        id: m.id,
        name: m.store_name || m.name || 'Merchant',
        store_name: m.store_name || m.name || 'Merchant',
        slug: m.slug || m.pwa_slug || m.id,
        category: m.category || 'Services',
        city: m.city || 'Kedah',
        address: m.address || '',
        rating: typeof m.rating === 'number' ? m.rating : 5.0,
        reviews_count: typeof m.reviews_count === 'number' ? m.reviews_count : 10,
        banner: m.banner,
        logo: m.logo,
        cover_url: resolvedCover || m.cover_url,
        is_pro: !!m.has_booking_addon || !!m.is_verified,
        distance_km: 1.5,
        recommendation_score: 85.0,
        recommendation_reason: 'Top match based on your preferences',
        badge_type: 'popular',
      };
    });
  } catch (fallbackErr) {
    return [];
  }
}

/**
 * Fetch prioritized rewards for the current customer.
 */
export async function getPrioritizedRewards(): Promise<PrioritizedRewardsResponse | null> {
  try {
    if (!pb.authStore.isValid) return null;
    const res = await pb.send<{ success: boolean; data: PrioritizedRewardsResponse }>(
      '/api/risev/rewards/prioritized',
      { method: 'GET' }
    );
    return res.data || null;
  } catch (err) {
    console.debug('[GET_REWARDS_ERR]', err);
    return null;
  }
}

/**
 * Fetch Next Visit return prediction.
 */
export async function getNextVisitPrediction(
  merchantId?: string
): Promise<NextVisitPrediction | null> {
  try {
    if (!pb.authStore.isValid) return null;
    const url = merchantId
      ? `/api/risev/visits/next-prediction?merchant_id=${merchantId}`
      : '/api/risev/visits/next-prediction';
    const res = await pb.send<{ success: boolean; data: NextVisitPrediction }>(url, {
      method: 'GET',
    });
    return res.data || null;
  } catch (err) {
    console.debug('[PREDICTION_ERR]', err);
    return null;
  }
}

/**
 * Fetch Merchant Customer Intelligence.
 */
export async function getMerchantInsights(merchantId: string): Promise<any | null> {
  try {
    const res = await pb.send<{ success: boolean; data: any }>(
      `/api/risev/merchant/insights?merchant_id=${merchantId}`,
      { method: 'GET' }
    );
    return res.data || null;
  } catch (err) {
    console.debug('[MERCHANT_INSIGHTS_ERR]', err);
    return null;
  }
}
