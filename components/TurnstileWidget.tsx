import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Platform, StyleSheet } from 'react-native';

export interface TurnstileWidgetRef {
  reset: () => void;
}

interface TurnstileWidgetProps {
  siteKey?: string;
  action?: string;
  onVerify: (token: string) => void;
  onError?: (error?: any) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  style?: any;
}

const DEFAULT_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAE5w7xWdnEOCuoHl';

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(({
  siteKey = DEFAULT_SITE_KEY,
  action = 'login',
  onVerify,
  onError,
  onExpire,
  theme = 'dark',
  style,
}, ref) => {
  if (Platform.OS !== 'web') {
    return null;
  }

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (typeof window !== 'undefined' && (window as any).turnstile && widgetIdRef.current) {
        try {
          (window as any).turnstile.reset(widgetIdRef.current);
        } catch (e) {
          console.warn('[Turnstile] Failed to reset widget:', e);
        }
      }
    },
  }));

  useEffect(() => {
    let isMounted = true;

    const renderWidget = () => {
      if (!isMounted || !containerRef.current) return;
      if (typeof window === 'undefined') return;

      const turnstile = (window as any).turnstile;
      if (!turnstile) {
        // Retry shortly if script is still loading
        setTimeout(renderWidget, 100);
        return;
      }

      // If already rendered, don't duplicate
      if (widgetIdRef.current) return;

      try {
        const id = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme,
          callback: (token: string) => {
            if (isMounted) onVerify(token);
          },
          'error-callback': (err: any) => {
            if (isMounted && onError) onError(err);
          },
          'expired-callback': () => {
            if (isMounted && onExpire) onExpire();
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.warn('[Turnstile] Render error:', err);
      }
    };

    renderWidget();

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined' && (window as any).turnstile && widgetIdRef.current) {
        try {
          (window as any).turnstile.remove(widgetIdRef.current);
        } catch (e) {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action, theme]);

  return (
    <View style={[styles.wrapper, style]}>
      {/* @ts-ignore Web-only DOM container */}
      <div ref={containerRef} style={{ display: 'inline-block', margin: '0 auto' }} />
    </View>
  );
});

TurnstileWidget.displayName = 'TurnstileWidget';

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    minHeight: 65,
  },
});
