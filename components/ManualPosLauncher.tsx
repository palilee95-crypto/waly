import { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useAuth } from '@/context/AuthContext';

// The cart is a local draft. A phone-linked claim is created at checkout,
// after the cashier has entered the customer number.
export default function ManualPosLauncher() {
  const { user } = useAuth();

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OPEN_MANUAL_POS', () => {
      if (!user?.merchant_id) return;
      DeviceEventEmitter.emit('OPEN_NFC_CLAIM', {
        id: '',
        merchant: user.merchant_id,
        status: 'pending',
        manual_pos: true,
        _local_pos_draft: true,
        customer_name: '',
        customer_phone: '',
        created: new Date().toISOString(),
      });
    });
    return () => sub.remove();
  }, [user?.merchant_id]);

  return null;
}
