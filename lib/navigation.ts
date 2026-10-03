import { Platform } from 'react-native';

/**
 * Smart back navigation for Expo Router sub-screens.
 * Navigates back in history if available, otherwise falls back to the specified parent route.
 */
export function handleSmartBack(router: any, fallbackRoute: string = '/(merchant)/profile') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.push(fallbackRoute as any);
  }
}
