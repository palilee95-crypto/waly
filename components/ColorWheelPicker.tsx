import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  value: string;
  onChange: (hex: string) => void;
  locale?: string;
};

const WHEEL_SEGMENTS = 72;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function normalizeHex(value: string): string | null {
  const raw = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return '#' + raw.split('').map((c) => c + c).join('').toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return '#' + raw.toUpperCase();
  return null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return ('#' + to(r) + to(g) + to(b)).toUpperCase();
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const val = clamp01(v);
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsv(rgb.r, rgb.g, rgb.b) : null;
}

/**
 * HSV colour wheel + brightness slider.
 * Pure RN primitives (SVG, gradients, PanResponder) so it works on web/PWA and
 * native without any DOM-only APIs.
 */
export default function ColorWheelPicker({ value, onChange, locale = 'en' }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const size = Math.min(240, Math.max(180, windowWidth - 140));
  const radius = size / 2;
  const rim = radius - 12;

  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(1);
  const [val, setVal] = useState(1);
  const [sliderWidth, setSliderWidth] = useState(220);

  const hsvRef = useRef({ h: 0, s: 1, v: 1 });
  const touchHandlerRef = useRef<(x: number, y: number) => void>(() => {});
  const sliderHandlerRef = useRef<(x: number) => void>(() => {});
  const wheelRef = useRef<any>(null);
  const sliderRef = useRef<any>(null);

  useEffect(() => {
    hsvRef.current = { h: hue, s: sat, v: val };
  }, [hue, sat, val]);

  // Sync only when the parent value genuinely differs (preset click / hex input).
  useEffect(() => {
    const normalized = normalizeHex(value);
    if (!normalized) return;
    const current = hsvToHex(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v);
    if (current === normalized) return;
    const hsv = hexToHsv(normalized);
    if (!hsv) return;
    setHue(hsv.h);
    setSat(hsv.s);
    setVal(hsv.v);
  }, [value]);

  const commit = (h: number, s: number, v: number) => {
    onChange(hsvToHex(h, s, v));
  };

  const handleWheelTouch = (x: number, y: number) => {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    const dx = x - radius;
    const dy = y - radius;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const nextSat = clamp01(distance / rim);
    const nextHue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    setHue(nextHue);
    setSat(nextSat);
    commit(nextHue, nextSat, val);
  };

  touchHandlerRef.current = handleWheelTouch;

  const handleSliderTouch = (x: number) => {
    if (typeof x !== 'number') return;
    const nextVal = clamp01(x / Math.max(1, sliderWidth));
    setVal(nextVal);
    commit(hue, sat, nextVal);
  };

  sliderHandlerRef.current = handleSliderTouch;

  const pointFromEvent = (evt: any, ref: React.MutableRefObject<any>) => {
    const ne = evt?.nativeEvent || {};
    // React Native Web (and native) expose locationX/locationY relative to the
    // responder view. This is measured per event against the CURRENT rect, so
    // it stays correct while the modal slides open.
    if (typeof ne.locationX === 'number' && typeof ne.locationY === 'number') {
      return { x: ne.locationX, y: ne.locationY };
    }
    // Fallbacks for platforms that do not provide locationX/locationY.
    if (Platform.OS === 'web') {
      const node = ref.current;
      const rect = typeof node?.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
      if (rect) {
        const touch = ne.touches && ne.touches[0] ? ne.touches[0] : null;
        const clientX =
          typeof ne.clientX === 'number' ? ne.clientX : touch && typeof touch.clientX === 'number' ? touch.clientX : null;
        const clientY =
          typeof ne.clientY === 'number' ? ne.clientY : touch && typeof touch.clientY === 'number' ? touch.clientY : null;
        if (typeof clientX === 'number' && typeof clientY === 'number') {
          return { x: clientX - rect.left, y: clientY - rect.top };
        }
        if (typeof ne.pageX === 'number') {
          const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
          const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
          return { x: ne.pageX - scrollX - rect.left, y: ne.pageY - scrollY - rect.top };
        }
      }
    }
    if (typeof ne.pageX === 'number') {
      return { x: ne.pageX, y: ne.pageY };
    }
    return { x: ne.offsetX, y: ne.offsetY };
  };

  const wheelResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const { x, y } = pointFromEvent(evt, wheelRef);
        touchHandlerRef.current(x, y);
      },
      onPanResponderMove: (evt) => {
        const { x, y } = pointFromEvent(evt, wheelRef);
        touchHandlerRef.current(x, y);
      },
    })
  ).current;

  const sliderResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const { x } = pointFromEvent(evt, sliderRef);
        sliderHandlerRef.current(x);
      },
      onPanResponderMove: (evt) => {
        const { x } = pointFromEvent(evt, sliderRef);
        sliderHandlerRef.current(x);
      },
    })
  ).current;

  const wedges = useMemo(() => {
    const items: { d: string; fill: string }[] = [];
    for (let i = 0; i < WHEEL_SEGMENTS; i++) {
      const a0 = (i / WHEEL_SEGMENTS) * Math.PI * 2;
      const a1 = ((i + 1) / WHEEL_SEGMENTS) * Math.PI * 2;
      const x0 = radius + rim * Math.cos(a0);
      const y0 = radius + rim * Math.sin(a0);
      const x1 = radius + rim * Math.cos(a1);
      const y1 = radius + rim * Math.sin(a1);
      items.push({
        d: `M ${radius} ${radius} L ${x0} ${y0} A ${rim} ${rim} 0 0 1 ${x1} ${y1} Z`,
        fill: hsvToHex(((i + 0.5) / WHEEL_SEGMENTS) * 360, 1, 1),
      });
    }
    return items;
  }, [radius, rim]);

  const currentHex = hsvToHex(hue, sat, val);
  const radians = (hue * Math.PI) / 180;
  const markerX = radius + Math.cos(radians) * sat * rim;
  const markerY = radius + Math.sin(radians) * sat * rim;
  const brightnessColor = hsvToHex(hue, 1, 1);
  const isMs = locale === 'ms';

  return (
    <View style={styles.root}>
      <View
        ref={wheelRef}
        style={{ width: size, height: size, alignSelf: 'center' }}
        {...wheelResponder.panHandlers}
        accessible
        accessibilityLabel={isMs ? `Roda warna, warna semasa ${currentHex}` : `Colour wheel, current ${currentHex}`}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="colorWheelSat" cx={radius} cy={radius} r={rim} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.55" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {wedges.map((wedge, index) => (
            <Path key={index} d={wedge.d} fill={wedge.fill} />
          ))}
          <Circle cx={radius} cy={radius} r={rim} fill="url(#colorWheelSat)" />
          <Circle cx={radius} cy={radius} r={rim - 0.5} fill="none" stroke="#E2E8F0" strokeWidth={1} />
          <Circle cx={markerX} cy={markerY} r={10} fill={currentHex} stroke="#FFFFFF" strokeWidth={3} />
          <Circle cx={markerX} cy={markerY} r={11.5} fill="none" stroke="rgba(15,23,42,0.25)" strokeWidth={1} />
        </Svg>
      </View>

      <View style={styles.brightnessRow}>
        <Text style={styles.label}>{isMs ? 'Kecerahan' : 'Brightness'}</Text>
        <View
          ref={sliderRef}
          style={styles.sliderTrack}
          onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
          {...sliderResponder.panHandlers}
        >
          <LinearGradient
            colors={['#000000', brightnessColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.sliderThumb,
              { left: Math.max(0, Math.min(sliderWidth - 18, val * sliderWidth - 9)), backgroundColor: currentHex },
            ]}
          />
        </View>
        <Text style={styles.valueText}>{Math.round(val * 100)}%</Text>
      </View>

      <View style={styles.readout}>
        <View style={[styles.swatch, { backgroundColor: currentHex }]} />
        <Text style={styles.hexText}>{currentHex}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  brightnessRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' },
  sliderTrack: {
    flex: 1,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sliderThumb: {
    position: 'absolute',
    top: 2,
    width: 18,
    height: 24,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  valueText: {
    width: 38,
    textAlign: 'right',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  readout: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  hexText: { fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', letterSpacing: 0.3 },
});
