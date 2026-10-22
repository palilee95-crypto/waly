import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { pb } from '@/lib/pocketbase';

export type PaidReceipt = {
  id: string;
  receipt_number: string;
  transaction?: string;
  created: string;
  merchant: string;
  customer_phone?: string;
  customer_name?: string;
  staff_name?: string;
  branch_name?: string;
  line_items?: Array<{ name?: string; qty?: number; price?: number }>;
  subtotal?: number;
  discount_amount?: number;
  total_amount: number;
  payment_method?: string;
  payment_reference?: string;
  payment_status?: string;
  stamps_earned?: number;
  stamps_before?: number;
  stamps_balance?: number;
  stamp_goal?: number;
  reward_name?: string;
  // Unguessable token behind the public receipt link (the record id is private).
  share_token?: string;
  expand?: { merchant?: { name?: string; store_name?: string; logo?: string; collectionName?: string; id?: string } };
};

export const receiptMoney = (value: unknown) => `RM${(Number(value) || 0).toFixed(2)}`;
export const receiptMerchant = (receipt: PaidReceipt) => receipt.expand?.merchant?.name || receipt.expand?.merchant?.store_name || 'Risev merchant';
export const receiptPaymentMethod = (receipt: PaidReceipt) => ({ qr: 'QR payment', card: 'Card payment', cash: 'Cash', transfer: 'Bank transfer' }[String(receipt.payment_method || '').toLowerCase()] || receipt.payment_method || 'Counter');
export const receiptDate = (receipt: PaidReceipt) => new Date(String(receipt.created || '').replace(' ', 'T')).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
export const receiptLines = (receipt: PaidReceipt) => Array.isArray(receipt.line_items) ? receipt.line_items : [];

// The ledger id is internal; the slip prints a short display reference. The
// public route sends that reference instead of the relation, so both slips show
// the same row without exposing the record id.
export const receiptTransactionRef = (receipt: PaidReceipt) =>
  String(receipt.transaction || '').replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();

// Older receipts have no reward snapshot stored on the record. The screen
// resolves the card's current balance/goal and must hand those to the PDF and
// print sheet, otherwise they fall back to a 10-dot default.
export type ReceiptRewardSnapshot = { balance?: number; goal?: number; name?: string };

function withResolvedReward(receipt: PaidReceipt, reward?: ReceiptRewardSnapshot | null): PaidReceipt {
  if (!reward) return receipt;
  return {
    ...receipt,
    stamps_balance: reward.balance ?? receipt.stamps_balance,
    stamp_goal: reward.goal ?? receipt.stamp_goal,
    reward_name: reward.name || receipt.reward_name,
  };
}

// One mapping for every token/public receipt read. The merchant slip is built
// from the digital_receipts record; the customer's slip was being built field by
// field with pieces missing (no logo, no transaction, no payment reference), so
// the two PDFs drifted apart. Both now come through here.
export function receiptFromPublicPayload(payload: Record<string, any> | null | undefined, token = ''): PaidReceipt | null {
  if (!payload) return null;
  const numberOrUndefined = (value: unknown) => (
    value === null || value === undefined || value === '' ? undefined : Number(value)
  );
  const merchantId = String(payload.merchant_id || '');
  return {
    id: String(token || ''),
    receipt_number: String(payload.receipt_number || ''),
    transaction: String(payload.transaction_reference || ''),
    created: String(payload.created || ''),
    merchant: merchantId,
    customer_name: String(payload.customer_name || ''),
    staff_name: String(payload.staff_name || ''),
    branch_name: String(payload.branch_name || ''),
    line_items: Array.isArray(payload.line_items) ? payload.line_items : [],
    subtotal: Number(payload.subtotal) || 0,
    discount_amount: Number(payload.discount_amount) || 0,
    total_amount: Number(payload.total_amount) || 0,
    payment_method: String(payload.payment_method || ''),
    payment_reference: String(payload.payment_reference || ''),
    payment_status: String(payload.payment_status || ''),
    stamps_earned: Number(payload.stamps_earned) || 0,
    stamps_before: numberOrUndefined(payload.stamps_before),
    stamps_balance: numberOrUndefined(payload.stamps_balance),
    stamp_goal: numberOrUndefined(payload.stamp_goal),
    reward_name: String(payload.reward_name || ''),
    expand: {
      merchant: {
        id: merchantId,
        name: String(payload.merchant_name || ''),
        logo: String(payload.merchant_logo || ''),
      },
    },
  };
}
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match] || match));
const browserLogos = new Map<string, HTMLImageElement>();
const logoLoads = new Map<string, Promise<HTMLImageElement | null>>();

function receiptLogoUrl(receipt: PaidReceipt): string {
  const merchant = receipt.expand?.merchant;
  return merchant?.id && merchant.logo
    ? `${pb.baseUrl}/api/files/merchants/${encodeURIComponent(merchant.id)}/${encodeURIComponent(merchant.logo)}`
    : '';
}

// Resolves when the logo is available (or definitively not): the receipt falls
// back to the brand tile while loading, and anything that drew that fallback
// needs a signal to redraw.
export function preloadPaidReceiptLogo(receipt: PaidReceipt): Promise<HTMLImageElement | null> {
  if (Platform.OS !== 'web' || typeof Image === 'undefined') return Promise.resolve(null);
  const url = receiptLogoUrl(receipt);
  if (!url) return Promise.resolve(null);
  const cached = browserLogos.get(url);
  if (cached) return Promise.resolve(cached);
  const inFlight = logoLoads.get(url);
  if (inFlight) return inFlight;
  const load = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => { browserLogos.set(url, image); resolve(image); };
    image.onerror = () => resolve(null);
    image.src = url;
  }).finally(() => logoLoads.delete(url));
  logoLoads.set(url, load);
  return load;
}

// The slip is drawn with the app's webfont and the merchant logo, so both must
// be settled before the canvas is baked.
async function prepareBrowserReceipt(receipt: PaidReceipt): Promise<void> {
  const fonts = typeof document !== 'undefined' ? (document as Document & { fonts?: FontFaceSet }).fonts?.ready : undefined;
  await Promise.all([preloadPaidReceiptLogo(receipt), fonts || Promise.resolve()]);
}

function receiptHtml(receipt: PaidReceipt): string {
  const lines = receiptLines(receipt).map((item) => `<div class="item"><div><b>${escapeHtml(item.name || 'Item')}</b><small>${Number(item.qty) || 1} × ${receiptMoney(item.price)}</small></div><b>${receiptMoney((Number(item.price) || 0) * (Number(item.qty) || 1))}</b></div>`).join('');
  const merchant = receiptMerchant(receipt);
  const isPaid = receipt.payment_status === 'paid';
  const logoUrl = receiptLogoUrl(receipt);
  const rewardGoal = Math.max(1, Number(receipt.stamp_goal) || 10);
  const rewardBalance = Number(receipt.stamps_balance);
  const rewardProgress = Number.isFinite(rewardBalance) ? `${Math.max(0, Math.min(rewardGoal, rewardBalance))}/${rewardGoal}` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(receipt.receipt_number)}</title><style>
  @page{size:80mm auto;margin:5mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#111;margin:0;background:white;font-size:11px}.paper{padding:16px;width:100%;max-width:370px;margin:auto}.logo{display:inline-flex;background:#ffcc00;border-radius:10px;width:40px;height:40px;align-items:center;justify-content:center;font-size:20px;font-weight:900}.logo img{width:40px;height:40px;object-fit:cover;border-radius:10px}.head{text-align:center}.head h1{font-size:19px;margin:8px 0 2px}.sub{color:#666;font-size:10px}.rule{border-top:1px dashed #aaa;margin:16px 0}.row,.item{display:flex;justify-content:space-between;gap:12px;margin:6px 0}.row span:first-child{color:#666}.item small{display:block;color:#777;margin-top:3px}.total{font-size:18px;font-weight:900}.paid{font-weight:800;color:#167440}.reward{background:#ffec92;border-radius:10px;padding:11px;margin-top:16px;font-weight:700}.foot{text-align:center;margin-top:20px;color:#666}
  </style></head><body><div class="paper"><div class="head"><div class="logo">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="">` : 'R'}</div><h1>${escapeHtml(merchant)}</h1><div class="sub">${escapeHtml(receipt.branch_name || '')}</div></div><div class="rule"></div><div class="row"><span>Receipt no.</span><b>${escapeHtml(receipt.receipt_number)}</b></div>${receipt.transaction ? `<div class="row"><span>Transaction</span><b>${escapeHtml(receipt.transaction.toUpperCase())}</b></div>` : ''}<div class="row"><span>Date</span><b>${escapeHtml(receiptDate(receipt))}</b></div><div class="row"><span>Customer</span><b>${escapeHtml(receipt.customer_name || 'Customer')}</b></div>${receipt.staff_name ? `<div class="row"><span>Staff</span><b>${escapeHtml(receipt.staff_name)}</b></div>` : ''}<div class="rule"></div>${lines}<div class="rule"></div><div class="row"><span>Subtotal</span><b>${receiptMoney(receipt.subtotal || receipt.total_amount)}</b></div>${Number(receipt.discount_amount) > 0 ? `<div class="row"><span>Voucher discount</span><b>−${receiptMoney(receipt.discount_amount)}</b></div>` : ''}<div class="row total"><span>${isPaid ? 'Total paid' : 'Total recorded'}</span><b>${receiptMoney(receipt.total_amount)}</b></div><div class="rule"></div><div class="row"><span>${isPaid ? 'Payment method' : 'Entry method'}</span><b>${escapeHtml(receiptPaymentMethod(receipt))}</b></div>${receipt.payment_reference ? `<div class="row"><span>Payment ref.</span><b>${escapeHtml(receipt.payment_reference)}</b></div>` : ''}<div class="row"><span>${isPaid ? 'Payment status' : 'Transaction status'}</span><b class="paid">${isPaid ? 'PAID' : 'RECORDED'}</b></div>${Number(receipt.stamps_earned) > 0 ? `<div class="reward">★ +${Number(receipt.stamps_earned)} stamp${Number(receipt.stamps_earned) === 1 ? '' : 's'} earned${rewardProgress ? ` · ${rewardProgress} collected` : ''}</div>` : ''}<div class="foot">Thank you for visiting!<br>Powered by <b>risev</b></div></div></body></html>`;
}

const SLIP_WIDTH = 300; // the on-screen paper width; every size below mirrors ThermalReceiptScreen
const SLIP_SCALE = 2;
const INK = '#000000';
const MUTED = '#64748B';
const FAINT = '#94A3B8';
const LINE = '#E2E8F0';
const BRAND = '#FFC700';
const PAID_INK = '#15803D';
const STAMP_DOT_STEP = 18; // 12px dot + 6px gap
const STAMP_DOT_ROW_STEP = 14;

// Browser PDF is drawn from receipt data, never captured from the animation.
// It mirrors the on-screen receipt, so the file and the screen agree.
//
// The layout runs twice: once against a measuring context to learn how tall the
// slip needs to be, then against a canvas allocated to exactly that height.
// Variable text wraps (merchant name, rows, item names, reward line) and stamp
// dots wrap into rows, so a long receipt or a large stamp goal is never clipped
// and never loses its totals or payment block.
function browserReceiptCanvas(receipt: PaidReceipt): HTMLCanvasElement {
  const isPaid = receipt.payment_status === 'paid';
  const earned = Math.max(0, Number(receipt.stamps_earned) || 0);
  const goal = Math.max(1, Math.min(50, Number(receipt.stamp_goal) || 10));
  const balanceRaw = Number(receipt.stamps_balance);
  const balance = Number.isFinite(balanceRaw) ? Math.max(0, balanceRaw) : earned;
  const filled = Math.min(goal, balance);
  const rewardName = String(receipt.reward_name || '').trim();

  const metrics = document.createElement('canvas').getContext('2d');
  if (!metrics) throw new Error('PDF rendering is not available on this device.');

  const padX = 16;
  const left = padX;
  const right = SLIP_WIDTH - padX;
  const cx = SLIP_WIDTH / 2;
  const contentWidth = right - left;
  const fontFor = (weight: number, size: number) =>
    `${weight} ${size}px "PlusJakartaSans_${weight >= 800 ? '800ExtraBold' : weight >= 700 ? '700Bold' : '500Medium'}", -apple-system, Arial`;

  const measure = (value: string, size: number, weight: number, spacing = 0) => {
    metrics.font = fontFor(weight, size);
    let total = 0;
    for (const char of value) total += metrics.measureText(char).width + spacing;
    return value ? total - spacing : 0;
  };

  // Greedy word wrap. A single word wider than the line breaks by character, so
  // a long name can never run under the price column or off the paper.
  const wrapText = (value: unknown, maxWidth: number, size: number, weight: number, spacing = 0): string[] => {
    const string = String(value ?? '').replace(/\s+/g, ' ').trim();
    const limit = Math.max(12, maxWidth);
    if (!string) return [];
    const lines: string[] = [];
    let line = '';
    for (const word of string.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size, weight, spacing) <= limit) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      if (measure(word, size, weight, spacing) <= limit) { line = word; continue; }
      let chunk = '';
      for (const char of word) {
        if (chunk && measure(chunk + char, size, weight, spacing) > limit) { lines.push(chunk); chunk = char; }
        else chunk += char;
      }
      line = chunk;
    }
    if (line) lines.push(line);
    return lines;
  };

  // Draws the slip and returns its height. With a null context it only
  // measures, using the same code path so both passes agree exactly.
  const layout = (ctx: CanvasRenderingContext2D | null): number => {
    const text = (value: unknown, x: number, baseline: number, options: { size?: number; weight?: number; color?: string; align?: 'left' | 'right' | 'center'; spacing?: number } = {}): number => {
      const { size = 10, weight = 500, color = INK, align = 'left', spacing = 0 } = options;
      const string = String(value ?? '');
      if (!string) return 0;
      const width = measure(string, size, weight, spacing);
      if (!ctx) return width;
      ctx.font = fontFor(weight, size);
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      let x0 = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
      if (spacing) {
        for (const char of string) {
          ctx.fillText(char, x0, baseline);
          x0 += ctx.measureText(char).width + spacing;
        }
      } else {
        ctx.fillText(string, x0, baseline);
      }
      return width;
    };
    const paragraph = (value: unknown, x: number, firstBaseline: number, options: { maxWidth: number; lineHeight: number; size?: number; weight?: number; color?: string; align?: 'left' | 'right' | 'center'; spacing?: number }): number => {
      const lines = wrapText(value, options.maxWidth, options.size ?? 10, options.weight ?? 500, options.spacing ?? 0);
      lines.forEach((line, index) => text(line, x, firstBaseline + index * options.lineHeight, options));
      return lines.length;
    };
    const roundRect = (x: number, top: number, w: number, h: number, r: number) => {
      if (!ctx) return;
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, top);
      ctx.arcTo(x + w, top, x + w, top + h, radius);
      ctx.arcTo(x + w, top + h, x, top + h, radius);
      ctx.arcTo(x, top + h, x, top, radius);
      ctx.arcTo(x, top, x + w, top, radius);
      ctx.closePath();
    };
    const rule = (top: number) => {
      if (!ctx) return;
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, top);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    let y = 24;

    // Merchant mark: the same yellow tile, with the logo when it has loaded.
    const tile = 44;
    const logo = browserLogos.get(receiptLogoUrl(receipt));
    if (ctx) {
      ctx.fillStyle = BRAND;
      roundRect(cx - tile / 2, y, tile, tile, 13);
      ctx.fill();
      if (logo) {
        ctx.save();
        roundRect(cx - tile / 2, y, tile, tile, 13);
        ctx.clip();
        ctx.drawImage(logo, cx - tile / 2, y, tile, tile);
        ctx.restore();
      }
    }
    if (!logo) {
      const merchantName = receiptMerchant(receipt);
      const parts = merchantName.trim().split(/\s+/).filter(Boolean);
      const initials = parts.length ? (parts[0].charAt(0) + (parts[1]?.charAt(0) || '')).toUpperCase() : 'R';
      text(initials, cx, y + tile / 2 + 7, { size: 20, weight: 800, align: 'center', spacing: -1 });
    }
    y += tile + 8;

    y += paragraph(receiptMerchant(receipt), cx, y + 14, { size: 17, weight: 800, align: 'center', spacing: -0.6, maxWidth: contentWidth, lineHeight: 20 }) * 20 + 2;
    y += paragraph((receipt.branch_name || 'Digital receipt').toUpperCase(), cx, y + 8, { size: 9, weight: 700, color: FAINT, align: 'center', spacing: 1.2, maxWidth: contentWidth, lineHeight: 12 }) * 12 + 4;

    rule(y);
    y += 12;

    // Label and value keep separate columns; either side may wrap.
    const row = (label: string, value: string) => {
      const labelMax = contentWidth * 0.42;
      const labelLines = wrapText(label, labelMax, 9.5, 500);
      const valueLines = wrapText(value, contentWidth - labelMax - 8, 9.5, 700);
      const lines = Math.max(1, labelLines.length, valueLines.length);
      for (let index = 0; index < lines; index += 1) {
        if (labelLines[index]) text(labelLines[index], left, y + 9 + index * 12, { size: 9.5, color: MUTED });
        if (valueLines[index]) text(valueLines[index], right, y + 9 + index * 12, { size: 9.5, weight: 700, align: 'right' });
      }
      y += lines * 12 + 5;
    };
    row('Receipt no.', receipt.receipt_number);
    if (receipt.transaction) row('Transaction', receiptTransactionRef(receipt));
    row('Date & time', receiptDate(receipt));
    row('Customer', receipt.customer_name || 'Customer');
    if (receipt.staff_name) row('Staff', receipt.staff_name);

    rule(y);
    y += 12;

    const items = receiptLines(receipt);
    if (!items.length) {
      text('Counter payment', left, y + 10, { size: 10, color: FAINT });
      y += 20;
    }
    for (const item of items) {
      const qty = Number(item.qty) || 1;
      const price = Number(item.price) || 0;
      const priceLabel = receiptMoney(price * qty);
      // The price keeps its own column; the name wraps inside what is left.
      const nameMax = Math.max(40, contentWidth - measure(priceLabel, 10, 700) - 10);
      const nameLines = wrapText(item.name || 'Item', nameMax, 10, 700);
      const qtyLines = wrapText(`${qty} × ${receiptMoney(price)}`, contentWidth, 8.8, 500);
      nameLines.forEach((line, index) => text(line, left, y + 10 + index * 12, { size: 10, weight: 700 }));
      text(priceLabel, right, y + 10, { size: 10, weight: 700, align: 'right' });
      qtyLines.forEach((line, index) => text(line, left, y + 10 + nameLines.length * 12 + index * 11, { size: 8.8, color: FAINT }));
      y += nameLines.length * 12 + 4 + qtyLines.length * 11 + 3;
    }

    rule(y);
    y += 12;

    row('Subtotal', receiptMoney(receipt.subtotal || receipt.total_amount));
    if (Number(receipt.discount_amount) > 0) row('Voucher discount', `−${receiptMoney(receipt.discount_amount)}`);
    y += 4;
    const totalLabel = isPaid ? 'Total paid' : 'Total recorded';
    const totalAmount = receiptMoney(receipt.total_amount);
    const totalLabelLines = wrapText(totalLabel, Math.max(60, contentWidth - measure(totalAmount, 22, 800, -1) - 10), 12, 800);
    totalLabelLines.forEach((line, index) => text(line, left, y + 16 + index * 14, { size: 12, weight: 800 }));
    text(totalAmount, right, y + 16, { size: 22, weight: 800, align: 'right', spacing: -1 });
    y += 24 + (Math.max(1, totalLabelLines.length) - 1) * 14;

    rule(y);
    y += 12;

    row(isPaid ? 'Payment method' : 'Entry method', receiptPaymentMethod(receipt));
    if (receipt.payment_reference) row('Payment ref.', receipt.payment_reference);

    const statusLabel = isPaid ? 'PAID' : 'RECORDED';
    const statusWidth = measure(statusLabel, 10, 800);
    const dotCx = right - statusWidth - 5 - 7;
    if (ctx) {
      ctx.fillStyle = isPaid ? BRAND : LINE;
      ctx.beginPath();
      ctx.arc(dotCx, y + 4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isPaid ? INK : MUTED;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (isPaid) {
        ctx.moveTo(dotCx - 3.4, y + 4);
        ctx.lineTo(dotCx - 0.8, y + 6.6);
        ctx.lineTo(dotCx + 4, y + 1.4);
      } else {
        ctx.arc(dotCx, y + 4, 3, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    text(isPaid ? 'Payment status' : 'Transaction status', left, y + 9, { size: 9.5, color: MUTED });
    text(statusLabel, right, y + 9, { size: 10, weight: 800, align: 'right', color: isPaid ? PAID_INK : MUTED });
    y += 17;

    if (earned > 0) {
      y += 6;
      const cardTop = y;
      const innerLeft = left + 10;
      const innerWidth = contentWidth - 20;
      const titleRight = `+${earned} Stamp${earned === 1 ? '' : 's'}`;
      const titleRightWidth = measure(titleRight, 10, 800);
      const titleLines = wrapText('Rewards earned', innerWidth - 15 - 5 - titleRightWidth, 10, 800);
      const subtitle = `${earned} stamp${earned === 1 ? '' : 's'} added · ${filled}/${goal} collected${rewardName ? ` · ${rewardName}` : ''}`;
      const subtitleLines = wrapText(subtitle, innerWidth, 9, 500);
      // Dots keep an 18px pitch and wrap into rows instead of leaving the card.
      const dotsPerRow = Math.max(1, Math.floor(innerWidth / STAMP_DOT_STEP));
      const dotRows = Math.ceil(goal / dotsPerRow);
      const subtitleTop = cardTop + 18 + (Math.max(1, titleLines.length) - 1) * 12 + 14;
      const dotsTop = subtitleTop + (Math.max(1, subtitleLines.length) - 1) * 11 + 12;
      const cardHeight = dotsTop - cardTop + (dotRows - 1) * STAMP_DOT_ROW_STEP + 12;

      if (ctx) {
        ctx.fillStyle = BRAND;
        roundRect(left, cardTop, contentWidth, cardHeight, 11);
        ctx.fill();

        // Small gift glyph, matching the card's icon.
        const giftX = innerLeft;
        const giftY = cardTop + 9;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1;
        ctx.strokeRect(giftX + 1, giftY + 3, 9, 7);
        ctx.beginPath();
        ctx.moveTo(giftX, giftY + 3);
        ctx.lineTo(giftX + 11, giftY + 3);
        ctx.moveTo(giftX + 5.5, giftY + 3);
        ctx.lineTo(giftX + 5.5, giftY + 10);
        ctx.stroke();
      }

      titleLines.forEach((line, index) => text(line, innerLeft + 15, cardTop + 18 + index * 12, { size: 10, weight: 800 }));
      text(titleRight, right - 10, cardTop + 18, { size: 10, weight: 800, align: 'right' });
      subtitleLines.forEach((line, index) => text(line, innerLeft, subtitleTop + index * 11, { size: 9, weight: 500 }));

      for (let index = 0; index < goal; index += 1) {
        if (!ctx) continue;
        const dotRow = Math.floor(index / dotsPerRow);
        const dotCol = index % dotsPerRow;
        const dotX = innerLeft + 6 + dotCol * STAMP_DOT_STEP;
        const dotY = dotsTop + dotRow * STAMP_DOT_ROW_STEP;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
        if (index < filled) {
          ctx.fillStyle = INK;
          ctx.fill();
        } else {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      y += cardHeight;
    }

    y += 16;
    text('Thank you for visiting!', cx, y + 8, { size: 10.5, weight: 700, align: 'center' });
    y += 16;

    // The barcode mirrors the on-screen bar pattern so both renders look alike.
    const bars = Array.from({ length: 34 }, (_, index) => ({
      width: index % 3 === 0 ? 2.5 : 1.5,
      height: index % 5 === 0 ? 27 : 21,
      gap: index % 4 === 0 ? 3 : 1.5,
    }));
    const barcodeWidth = bars.reduce((total, bar) => total + bar.width + bar.gap, 0);
    if (ctx) {
      let barX = cx - barcodeWidth / 2;
      ctx.fillStyle = INK;
      for (const bar of bars) {
        ctx.fillRect(barX, y + (27 - bar.height), bar.width, bar.height);
        barX += bar.width + bar.gap;
      }
    }
    y += 27;
    y += paragraph(receipt.receipt_number.replace(/-/g, ''), cx, y + 11, { size: 8, color: MUTED, align: 'center', spacing: 0.7, maxWidth: contentWidth, lineHeight: 11 }) * 11 + 5;

    const poweredLabel = 'Powered by';
    const wordmark = 'risev';
    const poweredWidth = measure(poweredLabel, 9, 500) + 4 + measure(wordmark, 13, 800, -0.8);
    let poweredX = cx - poweredWidth / 2;
    poweredX += text(poweredLabel, poweredX, y + 10, { size: 9, color: FAINT }) + 4;
    text(wordmark, poweredX, y + 11, { size: 13, weight: 800, spacing: -0.8 });
    y += 20;

    return y;
  };

  // Measure first, then allocate: the canvas is exactly as tall as the laid-out
  // slip, so no fixed height can clip a long receipt and no final crop is needed.
  const contentHeight = Math.max(1, Math.ceil(layout(null)));
  const canvas = document.createElement('canvas');
  canvas.width = SLIP_WIDTH * SLIP_SCALE;
  canvas.height = contentHeight * SLIP_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF rendering is not available on this device.');
  ctx.scale(SLIP_SCALE, SLIP_SCALE);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, SLIP_WIDTH, contentHeight);
  layout(ctx);
  return canvas;
}

function browserPdf(receipt: PaidReceipt): Blob {
  const canvas = browserReceiptCanvas(receipt);
  const width = canvas.width;
  const height = canvas.height;
  const encoded = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
  const binary = atob(encoded);
  const jpg = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const offsets: number[] = [0];
  const push = (data: string | Uint8Array) => { const chunk = typeof data === 'string' ? encoder.encode(data) : data; chunks.push(chunk); bytes += chunk.length; };
  const object = (id: number, content: string | Uint8Array, suffix = '') => { offsets[id] = bytes; push(`${id} 0 obj\n`); push(content); push(`${suffix}\nendobj\n`); };
  push('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  // Same 80 mm slip the print path uses, so both files share one shape.
  const pageWidth = Math.round((80 / 25.4) * 72);
  const pageHeight = Math.round((height / width) * pageWidth);
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = bytes; push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream\nendobj\n');
  const stream = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`;
  object(5, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  const xref = bytes; push('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

const PRINT_STYLE_ID = 'risev-receipt-print-style';
const PRINT_SHEET_CLASS = 'risev-print-sheet';
const PRINT_ACTIVE_CLASS = 'risev-print-sheet-active';
const PRINT_SLIP_MM = 80;

type PrintSheet = { sheet: HTMLDivElement; image: HTMLImageElement; slipHeightMm: number };
// Receipt screens can stack (a receipt modal over the receipt page), so sheets
// live in mount order: only the top one — the one in front — is printable, and
// the one underneath takes over when it closes.
const printSheets: PrintSheet[] = [];
let printStyle: HTMLStyleElement | null = null;

function syncPrintSheets(): void {
  const top = printSheets[printSheets.length - 1];
  printSheets.forEach((entry) => {
    entry.sheet.classList.toggle(PRINT_ACTIVE_CLASS, entry === top);
  });
  if (!top) {
    printStyle?.remove();
    printStyle = null;
    return;
  }
  if (!printStyle || !printStyle.isConnected) {
    printStyle = document.createElement('style');
    printStyle.id = PRINT_STYLE_ID;
    document.head.appendChild(printStyle);
  }
  // The page height belongs to the active slip, so it is rebuilt per top sheet.
  printStyle.textContent = `.${PRINT_SHEET_CLASS}{display:none}@media print{@page{size:${PRINT_SLIP_MM}mm ${top.slipHeightMm}mm;margin:0}html,body{margin:0!important;padding:0!important;background:#fff!important}body>*:not(.${PRINT_ACTIVE_CLASS}){display:none!important}.${PRINT_ACTIVE_CLASS}{display:block!important;width:${PRINT_SLIP_MM}mm;margin:0}.${PRINT_ACTIVE_CLASS} img{display:block;width:${PRINT_SLIP_MM}mm;height:${top.slipHeightMm}mm}}`;
}

// Browsers print the page, not the receipt — iOS Share → Print → Save to PDF
// captured the animated screen (logo, barcode, action bar and all). Mounting
// the same image the downloaded PDF carries, visible only under @media print,
// makes every print path produce the designed receipt.
export function mountPaidReceiptPrintSheet(receipt: PaidReceipt, reward?: ReceiptRewardSnapshot | null): () => void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {};
  const rendered = withResolvedReward(receipt, reward);
  const logoUrl = receiptLogoUrl(rendered);
  const paint = (canvas: HTMLCanvasElement) => canvas.toDataURL('image/jpeg', 0.92);
  const first = browserReceiptCanvas(rendered);
  const sheet = document.createElement('div');
  sheet.className = PRINT_SHEET_CLASS;
  const image = document.createElement('img');
  image.alt = `Receipt ${rendered.receipt_number || ''}`.trim();
  image.src = paint(first);
  sheet.appendChild(image);
  document.body.appendChild(sheet);

  const entry: PrintSheet = {
    sheet,
    image,
    slipHeightMm: Math.round(PRINT_SLIP_MM * (first.height / first.width) * 10) / 10,
  };
  printSheets.push(entry);
  syncPrintSheets();

  // The first draw carries the brand tile when the logo is still in flight and
  // the fallback font before the webfont settles; repaint once both land so
  // print never keeps either. A disposed sheet must stay dead, so the callback
  // checks before touching it.
  let disposed = false;
  const fontsPending = typeof document !== 'undefined' && (document as Document & { fonts?: FontFaceSet }).fonts?.status !== 'loaded';
  if ((logoUrl && !browserLogos.get(logoUrl)) || fontsPending) {
    void prepareBrowserReceipt(rendered).then(() => {
      if (disposed || !sheet.isConnected) return;
      // A taller slip is possible once the webfont wraps text differently, so
      // the page height has to follow the repaint or print would squash it.
      const repainted = browserReceiptCanvas(rendered);
      image.src = paint(repainted);
      entry.slipHeightMm = Math.round(PRINT_SLIP_MM * (repainted.height / repainted.width) * 10) / 10;
      syncPrintSheets();
    });
  }

  return () => {
    disposed = true;
    sheet.remove();
    const index = printSheets.indexOf(entry);
    if (index >= 0) printSheets.splice(index, 1);
    syncPrintSheets();
  };
}

export async function savePaidReceiptPdf(receipt: PaidReceipt, reward?: ReceiptRewardSnapshot | null): Promise<void> {
  const rendered = withResolvedReward(receipt, reward);
  if (Platform.OS === 'web') {
    await prepareBrowserReceipt(rendered);
    const blob = browserPdf(rendered);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${rendered.receipt_number || 'risev-receipt'}.pdf`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: receiptHtml(rendered) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save receipt PDF' });
}

export async function sharePaidReceiptPdf(receipt: PaidReceipt, reward?: ReceiptRewardSnapshot | null): Promise<'shared' | 'downloaded'> {
  const rendered = withResolvedReward(receipt, reward);
  if (Platform.OS === 'web') {
    const shareNav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (typeof File !== 'undefined' && shareNav.share && shareNav.canShare) {
      await prepareBrowserReceipt(rendered);
      const blob = browserPdf(rendered);
      const file = new File([blob], `${rendered.receipt_number || 'risev-receipt'}.pdf`, { type: 'application/pdf' });
      if (shareNav.canShare({ files: [file] })) {
        await shareNav.share({ files: [file], title: 'Risev receipt' });
        return 'shared';
      }
    }
    await savePaidReceiptPdf(rendered);
    return 'downloaded';
  }
  await savePaidReceiptPdf(rendered);
  return 'shared';
}
