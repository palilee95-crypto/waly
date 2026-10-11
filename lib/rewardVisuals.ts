import { pb } from './pocketbase';

export interface RewardVisualItem {
  id: string;
  name: string;
  category: 'dessert' | 'food_drinks' | 'beauty' | 'automotive' | 'fitness' | 'retail' | 'universal' | 'no_visual';
  asset_url: string;
  thumbnail_url?: string;
  tags: string[];
  reward_types: ('free_item' | 'discount')[];
  discount_match?: { type: 'percentage' | 'fixed_amount'; value: number };
  is_active: boolean;
  sort_order: number;
}

export interface RewardVisualCategory {
  id: string;
  label: string;
  icon: string;
}

export const REWARD_VISUAL_CATEGORIES: RewardVisualCategory[] = [
  { id: 'recommended', label: '⭐ Recommended', icon: 'sparkles' },
  { id: 'dessert', label: 'Dessert & Ice Cream', icon: 'ice-cream' },
  { id: 'food_drinks', label: 'Food & Drinks', icon: 'fast-food' },
  { id: 'beauty', label: 'Grooming & Beauty', icon: 'cut' },
  { id: 'automotive', label: 'Automotive', icon: 'car-sport' },
  { id: 'fitness', label: 'Fitness & Lifestyle', icon: 'fitness' },
  { id: 'retail', label: 'Retail & Services', icon: 'shirt' },
  { id: 'universal', label: 'Universal & Badges', icon: 'gift' },
  { id: 'no_visual', label: 'No Visual', icon: 'ban' },
];

function makeTransparentSvgUri(svgString: string): string {
  const cleanSvg = svgString.trim();
  let base64 = '';
  if (typeof btoa !== 'undefined') {
    try {
      base64 = btoa(unescape(encodeURIComponent(cleanSvg)));
    } catch (e) {}
  }
  if (!base64 && typeof (globalThis as any).Buffer !== 'undefined') {
    try {
      base64 = (globalThis as any).Buffer.from(cleanSvg).toString('base64');
    } catch (e) {}
  }
  if (base64) {
    return `data:image/svg+xml;base64,${base64}`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
}

// ── 100% TRANSPARENT 3D PRODUCT CUTOUTS & BADGES ──
const SVGS = {
  // 1. 3 Scoop Cup
  scoop3Cup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 20)">
      <!-- Chocolate Scoop Left -->
      <circle cx="210" cy="190" r="75" fill="#5C3A21" />
      <circle cx="190" cy="170" r="25" fill="#7A4E2C" opacity="0.6" />
      <!-- Vanilla Scoop Right -->
      <circle cx="302" cy="190" r="75" fill="#FFF3D1" />
      <circle cx="320" cy="170" r="25" fill="#FFFFFF" opacity="0.8" />
      <!-- Strawberry Scoop Center Top -->
      <circle cx="256" cy="140" r="85" fill="#FF4D79" />
      <circle cx="230" cy="115" r="30" fill="#FF809F" opacity="0.7" />
      <!-- Chocolate Drizzle -->
      <path d="M 210,105 Q 230,135 240,115 T 270,125 T 300,105" fill="none" stroke="#3D2314" stroke-width="12" stroke-linecap="round" />
      <!-- Sprinkles & Toppings -->
      <rect x="230" y="90" width="12" height="6" rx="3" fill="#FFD700" transform="rotate(25 230 90)" />
      <rect x="270" y="95" width="12" height="6" rx="3" fill="#00E5FF" transform="rotate(-15 270 95)" />
      <rect x="250" y="75" width="12" height="6" rx="3" fill="#FFFFFF" transform="rotate(45 250 75)" />
      <!-- Waffle Stick -->
      <rect x="310" y="50" width="24" height="140" rx="8" fill="#D9822B" transform="rotate(30 310 50)" />
      <line x1="318" y1="50" x2="318" y2="180" stroke="#B36214" stroke-width="4" stroke-dasharray="8 8" transform="rotate(30 310 50)" />
      <!-- Cherry on top -->
      <circle cx="256" cy="60" r="22" fill="#E60039" />
      <circle cx="248" cy="52" r="7" fill="#FF6688" />
      <path d="M 256,40 Q 280,20 290,10" fill="none" stroke="#7A1C00" stroke-width="4" stroke-linecap="round" />
      <!-- Pink 3D Cup -->
      <path d="M 130,220 L 160,420 Q 256,450 352,420 L 382,220 Z" fill="#FF2A75" />
      <ellipse cx="256" cy="220" rx="126" ry="25" fill="#FF5294" />
      <!-- Cup Rim Highlight -->
      <path d="M 130,220 Q 256,245 382,220" fill="none" stroke="#FFA6C5" stroke-width="8" />
      <!-- Cup Logo Badge -->
      <ellipse cx="256" cy="320" rx="60" ry="38" fill="#FFD700" />
      <text x="256" y="326" font-family="sans-serif" font-weight="900" font-size="20" fill="#1A1400" text-anchor="middle">scoop</text>
    </g>
  </svg>`,

  // 2. Ice Cream Cone
  iceCreamCone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 15)">
      <!-- Golden Waffle Cone -->
      <path d="M 176,230 L 256,470 L 336,230 Z" fill="#E5983B" />
      <!-- Waffle Crosshatch Pattern -->
      <path d="M 195,280 L 317,280 M 215,340 L 297,340 M 235,400 L 277,400" stroke="#C47920" stroke-width="6" />
      <path d="M 185,250 L 285,420 M 327,250 L 227,420" stroke="#C47920" stroke-width="6" />
      <!-- Bottom Ice Cream Scoop (Vanilla) -->
      <circle cx="256" cy="210" r="85" fill="#FFF8E7" />
      <!-- Top Ice Cream Scoop (Strawberry Pink) -->
      <circle cx="256" cy="140" r="95" fill="#FF477E" />
      <circle cx="225" cy="110" r="32" fill="#FF7CA3" opacity="0.7" />
      <!-- Colorful Sprinkles -->
      <rect x="220" y="90" width="14" height="6" rx="3" fill="#FFD166" transform="rotate(30 220 90)" />
      <rect x="270" y="85" width="14" height="6" rx="3" fill="#06D6A0" transform="rotate(-20 270 85)" />
      <rect x="290" y="120" width="14" height="6" rx="3" fill="#118AB2" transform="rotate(45 290 120)" />
      <rect x="210" y="140" width="14" height="6" rx="3" fill="#FFFFFF" transform="rotate(-35 210 140)" />
      <rect x="250" y="150" width="14" height="6" rx="3" fill="#FFD166" transform="rotate(15 250 150)" />
      <!-- Strawberry Cap -->
      <path d="M 256,45 C 230,45 220,70 256,90 C 292,70 282,45 256,45 Z" fill="#D90429" />
      <path d="M 245,40 Q 256,30 267,40 Q 256,48 245,40 Z" fill="#2EC4B6" />
    </g>
  </svg>`,

  // 3. Sundae Glass
  sundaeGlass: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 15)">
      <!-- Glass Cup Base & Stem -->
      <ellipse cx="256" cy="450" rx="80" ry="18" fill="#E2E8F0" opacity="0.9" />
      <rect x="246" y="370" width="20" height="80" rx="10" fill="#CBD5E1" opacity="0.8" />
      <!-- Glass Bowl Body -->
      <path d="M 160,180 L 190,370 Q 256,400 322,370 L 352,180 Z" fill="#F1F5F9" opacity="0.75" />
      <!-- Layer 1: Chocolate Fudge Bottom -->
      <path d="M 185,340 Q 256,370 327,340 L 322,370 Q 256,400 190,370 Z" fill="#4A2511" />
      <!-- Layer 2: Vanilla Ice Cream -->
      <ellipse cx="256" cy="260" rx="82" ry="50" fill="#FFFDF0" />
      <!-- Layer 3: Chocolate Layer -->
      <ellipse cx="256" cy="200" rx="92" ry="40" fill="#6B3E26" />
      <!-- Whipped Cream Peak -->
      <path d="M 180,180 Q 256,120 256,70 Q 256,120 332,180 Z" fill="#FFFFFF" />
      <circle cx="256" cy="110" r="35" fill="#FFFFFF" />
      <!-- Chocolate Drizzle -->
      <path d="M 210,150 C 230,190 250,130 270,170 C 290,130 300,160 310,150" fill="none" stroke="#3D2314" stroke-width="10" stroke-linecap="round" />
      <!-- Cherry on Top -->
      <circle cx="256" cy="55" r="22" fill="#E60039" />
      <circle cx="248" cy="47" r="7" fill="#FF6688" />
      <path d="M 256,35 Q 285,15 295,5" fill="none" stroke="#7A1C00" stroke-width="4" stroke-linecap="round" />
    </g>
  </svg>`,

  // 4. Strawberry Shake
  strawberryShake: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 15)">
      <!-- Straw -->
      <rect x="290" y="20" width="18" height="220" rx="9" fill="#FF477E" transform="rotate(18 290 20)" />
      <line x1="290" y1="40" x2="310" y2="40" stroke="#FFFFFF" stroke-width="8" transform="rotate(18 290 20)" />
      <line x1="290" y1="80" x2="310" y2="80" stroke="#FFFFFF" stroke-width="8" transform="rotate(18 290 20)" />
      <!-- Glass Cup Base -->
      <ellipse cx="256" cy="450" rx="70" ry="16" fill="#CBD5E1" opacity="0.6" />
      <!-- Glass Body -->
      <path d="M 166,160 L 186,450 Z" fill="none" stroke="#CBD5E1" stroke-width="6" />
      <path d="M 346,160 L 326,450 Z" fill="none" stroke="#CBD5E1" stroke-width="6" />
      <path d="M 166,160 L 186,450 Q 256,470 326,450 L 346,160 Z" fill="#FF85A2" />
      <!-- Shake Texture Highlights -->
      <path d="M 180,220 Q 256,240 332,220 L 326,450 Q 256,470 186,450 Z" fill="#FF5C8A" />
      <!-- Whipped Cream Top -->
      <path d="M 156,160 Q 256,90 356,160 Z" fill="#FFFFFF" />
      <circle cx="256" cy="130" r="50" fill="#FFFFFF" />
      <circle cx="220" cy="140" r="35" fill="#FFF0F5" />
      <circle cx="292" cy="140" r="35" fill="#FFF0F5" />
      <!-- Strawberry Slice -->
      <path d="M 210,110 C 190,110 180,130 210,150 C 240,130 230,110 210,110 Z" fill="#FF0054" transform="rotate(-20 210 110)" />
    </g>
  </svg>`,

  // 5. Boba Milk Tea
  bobaMilkTea: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 15)">
      <!-- Straw -->
      <rect x="244" y="20" width="24" height="240" rx="12" fill="#FFB703" />
      <!-- Transparent Cup Body -->
      <path d="M 160,140 L 185,440 Q 256,465 327,440 L 352,140 Z" fill="#D4A373" />
      <path d="M 160,140 L 185,440 Q 256,465 327,440 L 352,140 Z" fill="#FAEDCD" opacity="0.4" />
      <!-- Milk Tea Level -->
      <ellipse cx="256" cy="140" rx="96" ry="20" fill="#C68B59" />
      <!-- Boba Pearls -->
      <circle cx="200" cy="410" r="16" fill="#1A1423" />
      <circle cx="240" cy="425" r="16" fill="#1A1423" />
      <circle cx="280" cy="415" r="16" fill="#1A1423" />
      <circle cx="310" cy="395" r="16" fill="#1A1423" />
      <circle cx="220" cy="385" r="16" fill="#1A1423" />
      <circle cx="260" cy="390" r="16" fill="#1A1423" />
      <circle cx="190" cy="375" r="16" fill="#1A1423" />
      <!-- Dome Lid -->
      <path d="M 145,140 Q 256,60 367,140 Z" fill="#FFFFFF" opacity="0.8" />
      <ellipse cx="256" cy="140" rx="111" ry="22" fill="#E9ECEF" />
    </g>
  </svg>`,

  // 6. Gourmet Burger
  gourmetBurger: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 25)">
      <!-- Top Bun -->
      <path d="M 120,230 C 120,110 392,110 392,230 Z" fill="#E89838" />
      <ellipse cx="256" cy="230" rx="136" ry="25" fill="#F4A261" />
      <!-- Sesame Seeds -->
      <ellipse cx="200" cy="160" rx="7" ry="4" fill="#FFFDF0" transform="rotate(-15 200 160)" />
      <ellipse cx="260" cy="140" rx="7" ry="4" fill="#FFFDF0" transform="rotate(20 260 140)" />
      <ellipse cx="310" cy="170" rx="7" ry="4" fill="#FFFDF0" transform="rotate(10 310 170)" />
      <!-- Lettuce Wave -->
      <path d="M 110,240 Q 140,270 170,240 Q 200,270 230,240 Q 260,270 290,240 Q 320,270 350,240 Q 380,270 402,240 L 392,265 L 120,265 Z" fill="#2EC4B6" />
      <!-- Tomato Slices -->
      <rect x="130" y="260" width="110" height="20" rx="10" fill="#E63946" />
      <rect x="270" y="260" width="110" height="20" rx="10" fill="#E63946" />
      <!-- Melted Cheese -->
      <polygon points="115,280 397,280 370,320 320,295 260,335 200,290 150,325" fill="#FFB703" />
      <!-- Beef Patty -->
      <rect x="110" y="315" width="292" height="45" rx="22" fill="#4A2810" />
      <rect x="130" y="325" width="252" height="10" rx="5" fill="#5C3317" />
      <!-- Bottom Bun -->
      <path d="M 125,360 L 140,420 Q 256,445 372,420 L 387,360 Z" fill="#E89838" />
      <ellipse cx="256" cy="360" rx="131" ry="20" fill="#F4A261" />
    </g>
  </svg>`,

  // 7. Coffee Cup
  icedCoffee: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 20)">
      <!-- Straw -->
      <rect x="290" y="20" width="20" height="240" rx="10" fill="#00F0FF" transform="rotate(15 290 20)" />
      <!-- Cup Body -->
      <path d="M 150,150 L 180,440 Q 256,465 332,440 L 362,150 Z" fill="#6F4E37" />
      <path d="M 150,150 L 180,440 Q 256,465 332,440 L 362,150 Z" fill="#A67B5B" opacity="0.5" />
      <!-- Ice Cubes -->
      <rect x="210" y="200" width="45" height="45" rx="10" fill="#FFFFFF" opacity="0.6" transform="rotate(15 210 200)" />
      <rect x="260" y="240" width="45" height="45" rx="10" fill="#FFFFFF" opacity="0.6" transform="rotate(-20 260 240)" />
      <!-- Coffee Cap / Whipped Cream -->
      <ellipse cx="256" cy="150" rx="106" ry="22" fill="#FFFDD0" />
      <!-- Dome Lid -->
      <path d="M 140,150 Q 256,70 372,150 Z" fill="#FFFFFF" opacity="0.75" />
    </g>
  </svg>`,

  // 8. Barber Scissors & Comb
  barberCut: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 10)">
      <!-- Scissors Blade 1 -->
      <path d="M 170,100 L 340,360" stroke="#CBD5E1" stroke-width="28" stroke-linecap="round" />
      <path d="M 170,100 L 340,360" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" />
      <!-- Scissors Blade 2 -->
      <path d="M 340,100 L 170,360" stroke="#CBD5E1" stroke-width="28" stroke-linecap="round" />
      <path d="M 340,100 L 170,360" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" />
      <!-- Pivot Screw -->
      <circle cx="256" cy="230" r="16" fill="#FFC700" />
      <circle cx="256" cy="230" r="8" fill="#0F172A" />
      <!-- Finger Loops -->
      <circle cx="365" cy="400" r="45" fill="none" stroke="#FFC700" stroke-width="22" />
      <circle cx="147" cy="400" r="45" fill="none" stroke="#FFC700" stroke-width="22" />
      <!-- Comb Overlay -->
      <g transform="translate(110, 180) rotate(-40)">
        <rect x="0" y="0" width="260" height="45" rx="10" fill="#0F172A" />
        <line x1="20" y1="45" x2="20" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="40" y1="45" x2="40" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="60" y1="45" x2="60" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="80" y1="45" x2="80" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="100" y1="45" x2="100" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="120" y1="45" x2="120" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="140" y1="45" x2="140" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="160" y1="45" x2="160" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="180" y1="45" x2="180" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="200" y1="45" x2="200" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="220" y1="45" x2="220" y2="90" stroke="#0F172A" stroke-width="8" />
        <line x1="240" y1="45" x2="240" y2="90" stroke="#0F172A" stroke-width="8" />
      </g>
    </g>
  </svg>`,

  // 9. Car Wash Foam
  snowWash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 15)">
      <!-- Bucket -->
      <path d="M 150,220 L 180,440 Q 256,470 332,440 L 362,220 Z" fill="#2563EB" />
      <ellipse cx="256" cy="220" rx="106" ry="24" fill="#3B82F6" />
      <!-- Foam Bubbles Floating Top -->
      <circle cx="210" cy="190" r="45" fill="#FFFFFF" />
      <circle cx="260" cy="170" r="55" fill="#FFFFFF" />
      <circle cx="310" cy="190" r="45" fill="#FFFFFF" />
      <circle cx="170" cy="210" r="35" fill="#E2E8F0" />
      <circle cx="340" cy="210" r="35" fill="#E2E8F0" />
      <!-- Water Droplets -->
      <circle cx="256" cy="100" r="18" fill="#00F0FF" />
      <circle cx="190" cy="130" r="14" fill="#00F0FF" />
      <circle cx="320" cy="120" r="16" fill="#00F0FF" />
      <!-- Sparkle Highlights -->
      <polygon points="256,30 264,50 284,58 264,66 256,86 248,66 228,58 248,50" fill="#FFD700" />
    </g>
  </svg>`,

  // 10. 10% OFF 3D Badge
  disc10: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 20)">
      <!-- 3D Shadow Backdrop -->
      <text x="262" y="272" font-family="sans-serif" font-weight="900" font-size="110" fill="#8B0032" text-anchor="middle">10%</text>
      <text x="262" y="372" font-family="sans-serif" font-weight="900" font-size="80" fill="#8B0032" text-anchor="middle">OFF</text>
      <!-- Main Text -->
      <text x="256" y="260" font-family="sans-serif" font-weight="900" font-size="110" fill="#FF2A75" text-anchor="middle">10%</text>
      <text x="256" y="360" font-family="sans-serif" font-weight="900" font-size="80" fill="#FFC700" text-anchor="middle">OFF</text>
      <!-- Sparkle Burst -->
      <polygon points="120,120 130,145 155,155 130,165 120,190 110,165 85,155 110,145" fill="#FFC700" />
      <polygon points="390,100 398,120 418,128 398,136 390,156 382,136 362,128 382,120" fill="#00F0FF" />
    </g>
  </svg>`,

  // 11. 20% OFF 3D Badge
  disc20: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 20)">
      <!-- 3D Shadow Backdrop -->
      <text x="262" y="272" font-family="sans-serif" font-weight="900" font-size="110" fill="#8B0032" text-anchor="middle">20%</text>
      <text x="262" y="372" font-family="sans-serif" font-weight="900" font-size="80" fill="#8B0032" text-anchor="middle">OFF</text>
      <!-- Main Text -->
      <text x="256" y="260" font-family="sans-serif" font-weight="900" font-size="110" fill="#FF2A75" text-anchor="middle">20%</text>
      <text x="256" y="360" font-family="sans-serif" font-weight="900" font-size="80" fill="#FFC700" text-anchor="middle">OFF</text>
      <!-- Sparkle Burst -->
      <polygon points="110,110 120,135 145,145 120,155 110,180 100,155 75,145 100,135" fill="#FFC700" />
      <polygon points="400,110 408,130 428,138 408,146 400,166 392,146 372,138 392,130" fill="#00E5FF" />
    </g>
  </svg>`,

  // 12. 50% OFF 3D Badge
  disc50: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 20)">
      <!-- 3D Shadow Backdrop -->
      <text x="262" y="272" font-family="sans-serif" font-weight="900" font-size="110" fill="#4A00E0" text-anchor="middle">50%</text>
      <text x="262" y="372" font-family="sans-serif" font-weight="900" font-size="80" fill="#4A00E0" text-anchor="middle">OFF</text>
      <!-- Main Text -->
      <text x="256" y="260" font-family="sans-serif" font-weight="900" font-size="110" fill="#8E2DE2" text-anchor="middle">50%</text>
      <text x="256" y="360" font-family="sans-serif" font-weight="900" font-size="80" fill="#FFC700" text-anchor="middle">OFF</text>
      <!-- Sparkle Burst -->
      <polygon points="120,100 130,125 155,135 130,145 120,170 110,145 85,135 110,125" fill="#FFD700" />
      <polygon points="380,120 388,140 408,148 388,156 380,176 372,156 352,148 372,140" fill="#FF2A75" />
    </g>
  </svg>`,

  // 13. RM5 OFF Badge
  discRm5: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 20)">
      <text x="262" y="272" font-family="sans-serif" font-weight="900" font-size="95" fill="#1E3A8A" text-anchor="middle">RM5</text>
      <text x="262" y="372" font-family="sans-serif" font-weight="900" font-size="80" fill="#1E3A8A" text-anchor="middle">OFF</text>
      <text x="256" y="260" font-family="sans-serif" font-weight="900" font-size="95" fill="#2563EB" text-anchor="middle">RM5</text>
      <text x="256" y="360" font-family="sans-serif" font-weight="900" font-size="80" fill="#FFC700" text-anchor="middle">OFF</text>
      <polygon points="110,110 120,135 145,145 120,155 110,180 100,155 75,145 100,135" fill="#FFC700" />
    </g>
  </svg>`,

  // 14. RM10 OFF Badge
  discRm10: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 20)">
      <text x="262" y="272" font-family="sans-serif" font-weight="900" font-size="90" fill="#064E3B" text-anchor="middle">RM10</text>
      <text x="262" y="372" font-family="sans-serif" font-weight="900" font-size="80" fill="#064E3B" text-anchor="middle">OFF</text>
      <text x="256" y="260" font-family="sans-serif" font-weight="900" font-size="90" fill="#10B981" text-anchor="middle">RM10</text>
      <text x="256" y="360" font-family="sans-serif" font-weight="900" font-size="80" fill="#FFC700" text-anchor="middle">OFF</text>
      <polygon points="390,100 398,120 418,128 398,136 390,156 382,136 362,128 382,120" fill="#FFD700" />
    </g>
  </svg>`,

  // 15. Pink Gift Box
  giftBoxPink: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 25)">
      <!-- 3D Gift Box Body -->
      <rect x="136" y="200" width="240" height="220" rx="24" fill="#FF2A75" />
      <path d="M 136,200 L 256,240 L 376,200 L 256,160 Z" fill="#FF5294" />
      <!-- Lid -->
      <rect x="120" y="160" width="272" height="50" rx="14" fill="#FF337C" />
      <!-- Golden Ribbons Vertical -->
      <rect x="236" y="160" width="40" height="260" fill="#FFD700" />
      <!-- Golden Ribbons Horizontal -->
      <rect x="120" y="170" width="272" height="30" fill="#FFD700" />
      <!-- 3D Ribbon Bow Top -->
      <ellipse cx="216" cy="130" rx="45" ry="30" fill="#FFC700" transform="rotate(-25 216 130)" />
      <ellipse cx="296" cy="130" rx="45" ry="30" fill="#FFC700" transform="rotate(25 296 130)" />
      <circle cx="256" cy="140" r="22" fill="#E6B800" />
    </g>
  </svg>`,

  // 16. Golden Star Reward
  starReward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(0, 15)">
      <polygon points="256,40 320,170 460,190 358,290 382,430 256,360 130,430 154,290 52,190 192,170" fill="#FFC700" />
      <polygon points="256,70 310,180 430,196 342,282 362,402 256,342 150,402 170,282 82,196 202,180" fill="#FFE57F" />
      <circle cx="220" cy="170" r="25" fill="#FFFFFF" opacity="0.6" />
    </g>
  </svg>`,
};

export const REWARD_VISUAL_REGISTRY: RewardVisualItem[] = [
  // ── Dessert & Ice Cream ──
  {
    id: 'ice-cream-scoop-3d',
    name: '3 Scoop Cup',
    category: 'dessert',
    asset_url: makeTransparentSvgUri(SVGS.scoop3Cup),
    tags: ['ice cream', 'scoop', 'dessert', 'free_item', '3 scoop', 'cup'],
    reward_types: ['free_item'],
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'ice-cream-cone-3d',
    name: 'Ice Cream Cone',
    category: 'dessert',
    asset_url: makeTransparentSvgUri(SVGS.iceCreamCone),
    tags: ['ice cream', 'cone', 'waffle', 'dessert', 'free_item'],
    reward_types: ['free_item'],
    is_active: true,
    sort_order: 2,
  },
  {
    id: 'sundae-glass-3d',
    name: 'Sundae Glass',
    category: 'dessert',
    asset_url: makeTransparentSvgUri(SVGS.sundaeGlass),
    tags: ['sundae', 'dessert', 'cherry', 'chocolate', 'free_item'],
    reward_types: ['free_item'],
    is_active: true,
    sort_order: 3,
  },
  {
    id: 'milkshake-strawberry-3d',
    name: 'Strawberry Shake',
    category: 'dessert',
    asset_url: makeTransparentSvgUri(SVGS.strawberryShake),
    tags: ['milkshake', 'shake', 'strawberry', 'drink', 'dessert'],
    reward_types: ['free_item'],
    is_active: true,
    sort_order: 4,
  },
  {
    id: 'boba-milk-tea-3d',
    name: 'Boba Milk Tea',
    category: 'dessert',
    asset_url: makeTransparentSvgUri(SVGS.bobaMilkTea),
    tags: ['boba', 'bubble tea', 'milk tea', 'drink', 'dessert'],
    reward_types: ['free_item'],
    is_active: true,
    sort_order: 5,
  },

  // ── Food & Drinks ──
  {
    id: 'gourmet-burger-3d',
    name: 'Gourmet Burger',
    category: 'food_drinks',
    asset_url: makeTransparentSvgUri(SVGS.gourmetBurger),
    tags: ['burger', 'food', 'beef', 'cheeseburger'],
    reward_types: ['free_item'],
    is_active: true,
    sort_order: 6,
  },
  {
    id: 'iced-latte-coffee-3d',
    name: 'Iced Coffee Latte',
    category: 'food_drinks',
    asset_url: makeTransparentSvgUri(SVGS.icedCoffee),
    tags: ['coffee', 'latte', 'iced coffee', 'cafe', 'drink'],
    reward_types: ['free_item'],
    is_active: true,
    sort_order: 7,
  },

  // ── Grooming & Beauty ──
  {
    id: 'barber-haircut-3d',
    name: 'Premium Haircut',
    category: 'beauty',
    asset_url: makeTransparentSvgUri(SVGS.barberCut),
    tags: ['haircut', 'barber', 'scissors', 'grooming', 'salon'],
    reward_types: ['free_item', 'discount'],
    is_active: true,
    sort_order: 8,
  },

  // ── Automotive ──
  {
    id: 'car-wash-shampoo-3d',
    name: 'Snow Wash',
    category: 'automotive',
    asset_url: makeTransparentSvgUri(SVGS.snowWash),
    tags: ['car wash', 'wash', 'snow wash', 'automotive'],
    reward_types: ['free_item', 'discount'],
    is_active: true,
    sort_order: 9,
  },

  // ── Universal & Discount Badges ──
  {
    id: 'disc-10-off-3d',
    name: '10% OFF',
    category: 'universal',
    asset_url: makeTransparentSvgUri(SVGS.disc10),
    tags: ['10%', '10% off', 'discount', 'percentage'],
    reward_types: ['discount'],
    discount_match: { type: 'percentage', value: 10 },
    is_active: true,
    sort_order: 10,
  },
  {
    id: 'disc-20-off-3d',
    name: '20% OFF',
    category: 'universal',
    asset_url: makeTransparentSvgUri(SVGS.disc20),
    tags: ['20%', '20% off', 'discount', 'percentage'],
    reward_types: ['discount'],
    discount_match: { type: 'percentage', value: 20 },
    is_active: true,
    sort_order: 11,
  },
  {
    id: 'disc-50-off-3d',
    name: '50% OFF',
    category: 'universal',
    asset_url: makeTransparentSvgUri(SVGS.disc50),
    tags: ['50%', '50% off', 'discount', 'percentage', 'half price'],
    reward_types: ['discount'],
    discount_match: { type: 'percentage', value: 50 },
    is_active: true,
    sort_order: 12,
  },
  {
    id: 'disc-rm5-off-3d',
    name: 'RM5 OFF',
    category: 'universal',
    asset_url: makeTransparentSvgUri(SVGS.discRm5),
    tags: ['rm5', 'rm5 off', 'discount', 'fixed_amount', 'cash rebate'],
    reward_types: ['discount'],
    discount_match: { type: 'fixed_amount', value: 5 },
    is_active: true,
    sort_order: 13,
  },
  {
    id: 'disc-rm10-off-3d',
    name: 'RM10 OFF',
    category: 'universal',
    asset_url: makeTransparentSvgUri(SVGS.discRm10),
    tags: ['rm10', 'rm10 off', 'discount', 'fixed_amount', 'cash rebate'],
    reward_types: ['discount'],
    discount_match: { type: 'fixed_amount', value: 10 },
    is_active: true,
    sort_order: 14,
  },
  {
    id: 'gift-box-pink-3d',
    name: 'Gift Box',
    category: 'universal',
    asset_url: makeTransparentSvgUri(SVGS.giftBoxPink),
    tags: ['gift', 'gift box', 'present', 'free_item', 'special'],
    reward_types: ['free_item', 'discount'],
    is_active: true,
    sort_order: 15,
  },
  {
    id: 'star-reward-3d',
    name: 'Star Reward',
    category: 'universal',
    asset_url: makeTransparentSvgUri(SVGS.starReward),
    tags: ['star', 'vip', 'reward', 'points'],
    reward_types: ['free_item', 'discount'],
    is_active: true,
    sort_order: 16,
  },
];

/**
 * Get visual item by ID
 */
export function getRewardVisualById(id?: string | null): RewardVisualItem | null {
  if (!id || id === 'no_visual') return null;
  return REWARD_VISUAL_REGISTRY.find((v) => v.id === id) || null;
}

/**
 * Resolves final image URL for a reward record:
 * 1. Checks curated reward_visual_id
 * 2. Fallback to legacy custom image file
 * 3. Returns null if "No visual" or empty
 */
export function getRewardVisualUrl(rewardRecord?: any): string | null {
  if (!rewardRecord) return null;

  // 1. Curated visual selection
  if (rewardRecord.reward_visual_id) {
    const visual = getRewardVisualById(rewardRecord.reward_visual_id);
    if (visual) return visual.asset_url;
  }

  // 2. Backwards compatibility for legacy uploads
  if (rewardRecord.image) {
    return `${pb.baseUrl}/api/files/rewards/${rewardRecord.id}/${rewardRecord.image}`;
  }

  return null;
}

/**
 * Smart recommendation engine that scores & ranks visuals
 */
export function getRecommendedVisuals(params: {
  merchantCategory?: string;
  rewardType?: 'free_item' | 'discount' | string;
  title?: string;
  discountType?: 'percentage' | 'fixed_amount' | 'none' | string;
  discountValue?: number | string;
}): RewardVisualItem[] {
  const { merchantCategory = '', rewardType = 'free_item', title = '', discountType, discountValue } = params;

  const normalizedCategory = merchantCategory.toLowerCase();
  const normalizedTitle = title.toLowerCase();
  const parsedVal = typeof discountValue === 'string' ? parseFloat(discountValue) : discountValue;

  return REWARD_VISUAL_REGISTRY.slice().sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    // 1. Exact discount match
    if (discountType && parsedVal && parsedVal > 0) {
      if (a.discount_match?.type === discountType && a.discount_match?.value === parsedVal) scoreA += 50;
      if (b.discount_match?.type === discountType && b.discount_match?.value === parsedVal) scoreB += 50;
    }

    // 2. Reward Type Match
    if (a.reward_types.includes(rewardType as any)) scoreA += 15;
    if (b.reward_types.includes(rewardType as any)) scoreB += 15;

    // 3. Category Match
    if (normalizedCategory.includes(a.category)) scoreA += 25;
    if (normalizedCategory.includes(b.category)) scoreB += 25;

    // Special category alias matching
    if ((normalizedCategory.includes('ice cream') || normalizedCategory.includes('dessert') || normalizedCategory.includes('cafe')) && a.category === 'dessert') scoreA += 30;
    if ((normalizedCategory.includes('ice cream') || normalizedCategory.includes('dessert') || normalizedCategory.includes('cafe')) && b.category === 'dessert') scoreB += 30;

    if ((normalizedCategory.includes('barber') || normalizedCategory.includes('salon') || normalizedCategory.includes('beauty')) && a.category === 'beauty') scoreA += 30;
    if ((normalizedCategory.includes('barber') || normalizedCategory.includes('salon') || normalizedCategory.includes('beauty')) && b.category === 'beauty') scoreB += 30;

    if ((normalizedCategory.includes('wash') || normalizedCategory.includes('auto') || normalizedCategory.includes('car')) && a.category === 'automotive') scoreA += 30;
    if ((normalizedCategory.includes('wash') || normalizedCategory.includes('auto') || normalizedCategory.includes('car')) && b.category === 'automotive') scoreB += 30;

    // 4. Keyword Match in Title
    a.tags.forEach((tag) => {
      if (normalizedTitle.includes(tag.toLowerCase())) scoreA += 20;
    });
    b.tags.forEach((tag) => {
      if (normalizedTitle.includes(tag.toLowerCase())) scoreB += 20;
    });

    return scoreB - scoreA;
  });
}
