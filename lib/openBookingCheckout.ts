import { DeviceEventEmitter } from 'react-native';
import { pb } from '@/lib/pocketbase';

// Opens the shared Quick POS modal for a booking. The modal resolves the pass
// payload, fills the cart from the booked services and sends `booking_id` on
// checkout, so the booking engine writes the single transaction and receipt.
export async function openBookingCheckout(bookingId: string) {
  const res = await pb.send<{ booking: any }>('/api/risev/merchant/booking-pass', {
    method: 'POST',
    body: { booking_id: bookingId },
    requestKey: null,
  });
  const booking = res?.booking;
  if (!booking) throw new Error('Booking not found.');

  DeviceEventEmitter.emit('OPEN_NFC_CLAIM', {
    id: '',
    merchant: booking.merchant_id,
    status: 'pending',
    manual_pos: true,
    _local_pos_draft: true,
    customer_name: booking.customer_name || '',
    customer_phone: booking.customer_phone || '',
    booking_id: booking.id,
    created: new Date().toISOString(),
  });
  return booking;
}
