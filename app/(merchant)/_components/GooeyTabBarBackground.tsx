import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function GooeyTabBarBackground({ width, height, color = '#0D0E10' }: { width: number; height: number; color?: string }) {
  if (!width || width <= 80) return null;

  const cx = width / 2;
  const shoulder = 20;
  const corner = 44;

  // Full-width bar with rounded shoulders and a raised cradle for the QR action.
  const path = `
    M 0 ${height}
    L 0 ${shoulder + corner}
    C 0 ${shoulder + 15}, 15 ${shoulder}, ${corner} ${shoulder}
    L ${cx - 52} ${shoulder}
    C ${cx - 27} ${shoulder}, ${cx - 30} 0, ${cx} 0
    C ${cx + 30} 0, ${cx + 27} ${shoulder}, ${cx + 52} ${shoulder}
    L ${width - corner} ${shoulder}
    C ${width - 15} ${shoulder}, ${width} ${shoulder + 15}, ${width} ${shoulder + corner}
    L ${width} ${height}
    Z
  `;

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Path d={path} fill={color} />
    </Svg>
  );
}
