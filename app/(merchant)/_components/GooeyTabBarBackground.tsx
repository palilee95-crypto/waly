import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function GooeyTabBarBackground({ width, color = '#121214' }: { width: number; color?: string }) {
  if (!width || width <= 80) return null;

  const H = 56; // Reduced height of the tab bar body for a sleeker look
  const pillR = 28; // Reduced radius of the pill
  const cx = width / 2;
  const pillY = 12; // Adjusted offset for top hump
  
  // Custom path: flat bottom with rounded corners, organic top hump in the center
  const path = `
    M ${pillR} ${pillY}
    L ${cx - 40} ${pillY}
    C ${cx - 20} ${pillY}, ${cx - 28} 0, ${cx} 0
    C ${cx + 28} 0, ${cx + 20} ${pillY}, ${cx + 40} ${pillY}
    L ${width - pillR} ${pillY}
    A ${pillR} ${pillR} 0 0 1 ${width} ${pillY + pillR}
    L ${width} ${pillY + H - pillR}
    A ${pillR} ${pillR} 0 0 1 ${width - pillR} ${pillY + H}
    L ${pillR} ${pillY + H}
    A ${pillR} ${pillR} 0 0 1 0 ${pillY + H - pillR}
    L 0 ${pillY + pillR}
    A ${pillR} ${pillR} 0 0 1 ${pillR} ${pillY}
    Z
  `;

  return (
    <Svg width={width} height={H + 32} style={{ position: 'absolute', top: -12, left: 0 }}>
      <Path d={path} fill={color} />
    </Svg>
  );
}
