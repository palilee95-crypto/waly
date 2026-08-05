import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function GooeyTabBarBackground({ width, color = '#050505' }: { width: number; color?: string }) {
  const H = 56; // height of the pill body (thinner)
  const pillR = 28; // radius of the pill
  const cx = width / 2;
  const pillY = 16; // offset to allow the top bulge to fit within the SVG viewBox
  
  // SVG Path for a pill that has a gooey bulge in the center
  const path = `
    M ${pillR} ${pillY}
    L ${cx - 42} ${pillY}
    C ${cx - 18} ${pillY}, ${cx - 26} 0, ${cx} 0
    C ${cx + 26} 0, ${cx + 18} ${pillY}, ${cx + 42} ${pillY}
    L ${width - pillR} ${pillY}
    A ${pillR} ${pillR} 0 0 1 ${width} ${pillY + pillR}
    A ${pillR} ${pillR} 0 0 1 ${width - pillR} ${pillY + H}
    L ${cx + 42} ${pillY + H}
    C ${cx + 18} ${pillY + H}, ${cx + 26} ${pillY + H + 16}, ${cx} ${pillY + H + 16}
    C ${cx - 26} ${pillY + H + 16}, ${cx - 18} ${pillY + H}, ${cx - 42} ${pillY + H}
    L ${pillR} ${pillY + H}
    A ${pillR} ${pillR} 0 0 1 0 ${pillY + pillR}
    A ${pillR} ${pillR} 0 0 1 ${pillR} ${pillY}
    Z
  `;

  return (
    <Svg width={width} height={H + 32} style={{ position: 'absolute', top: -16, left: 0 }}>
      <Path d={path} fill={color} />
    </Svg>
  );
}
