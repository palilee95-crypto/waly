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
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match] || match));
const browserLogos = new Map<string, HTMLImageElement>();

function receiptLogoUrl(receipt: PaidReceipt): string {
  const merchant = receipt.expand?.merchant;
  return merchant?.id && merchant.logo
    ? `${pb.baseUrl}/api/files/merchants/${encodeURIComponent(merchant.id)}/${encodeURIComponent(merchant.logo)}`
    : '';
}

export function preloadPaidReceiptLogo(receipt: PaidReceipt): void {
  if (Platform.OS !== 'web' || typeof Image === 'undefined') return;
  const url = receiptLogoUrl(receipt);
  if (!url || browserLogos.has(url)) return;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => browserLogos.set(url, image);
  image.src = url;
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

// Browser PDF is drawn from receipt data, never captured from the animation.
// A JPEG-backed single-page PDF is supported by iOS and Android browsers.
function browserPdf(receipt: PaidReceipt): Blob {
  const isPaid = receipt.payment_status === 'paid';
  const rewardGoal = Math.max(1, Number(receipt.stamp_goal) || 10);
  const rewardBalance = Number(receipt.stamps_balance);
  const rewardProgress = Number.isFinite(rewardBalance) ? `${Math.max(0, Math.min(rewardGoal, rewardBalance))}/${rewardGoal}` : '';
  const canvas = document.createElement('canvas');
  const width = 640;
  const lineHeight = 34;
  const extraRows = Number(!!receipt.transaction) + Number(!!receipt.staff_name) + Number(!!receipt.payment_reference) + Number(Number(receipt.discount_amount) > 0);
  const height = 690 + receiptLines(receipt).length * 76 + extraRows * 34 + (Number(receipt.stamps_earned) > 0 ? 94 : 0);
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF rendering is not available on this device.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  const left = 48, right = width - 48;
  const label = (text: string, y: number, bold = false, size = 22, align: CanvasTextAlign = 'left', color = '#111') => {
    ctx.fillStyle = color; ctx.font = `${bold ? 700 : 400} ${size}px Arial`; ctx.textAlign = align;
    ctx.fillText(text, align === 'right' ? right : align === 'center' ? width / 2 : left, y, width - 96);
  };
  const rule = (y: number) => { ctx.strokeStyle = '#b6b6b6'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); ctx.setLineDash([]); };
  ctx.fillStyle = '#ffcc00'; ctx.fillRect(width / 2 - 25, 36, 50, 50);
  const logo = browserLogos.get(receiptLogoUrl(receipt));
  if (logo) ctx.drawImage(logo, width / 2 - 25, 36, 50, 50);
  else label('R', 72, true, 29, 'center');
  label(receiptMerchant(receipt), 126, true, 31, 'center');
  label(receipt.branch_name || '', 153, false, 18, 'center', '#666');
  rule(180);
  let y = 220;
  const row = (name: string, value: string, bold = false) => { label(name, y, bold, 20, 'left', bold ? '#111' : '#666'); label(value, y, true, 20, 'right'); y += lineHeight; };
  row('Receipt no.', receipt.receipt_number); if (receipt.transaction) row('Transaction', receipt.transaction.toUpperCase()); row('Date', receiptDate(receipt)); row('Customer', receipt.customer_name || 'Customer');
  if (receipt.staff_name) row('Staff', receipt.staff_name);
  rule(y + 6); y += 48;
  for (const item of receiptLines(receipt)) {
    label(item.name || 'Item', y, true, 21);
    label(receiptMoney((Number(item.price) || 0) * (Number(item.qty) || 1)), y, true, 21, 'right');
    y += 28; label(`${Number(item.qty) || 1} × ${receiptMoney(item.price)}`, y, false, 18, 'left', '#666'); y += 48;
  }
  rule(y); y += 42;
  row('Subtotal', receiptMoney(receipt.subtotal || receipt.total_amount));
  if (Number(receipt.discount_amount) > 0) row('Voucher discount', `-${receiptMoney(receipt.discount_amount)}`);
  y += 10; label(isPaid ? 'Total paid' : 'Total recorded', y, true, 29); label(receiptMoney(receipt.total_amount), y, true, 29, 'right'); y += 32;
  rule(y); y += 42;
  row(isPaid ? 'Payment method' : 'Entry method', receiptPaymentMethod(receipt)); if (receipt.payment_reference) row('Payment ref.', receipt.payment_reference); row(isPaid ? 'Payment status' : 'Transaction status', isPaid ? 'PAID' : 'RECORDED');
  if (Number(receipt.stamps_earned) > 0) {
    ctx.fillStyle = '#ffeb84'; ctx.fillRect(left, y + 7, right - left, 60);
    label(`★  +${Number(receipt.stamps_earned)} stamp${Number(receipt.stamps_earned) === 1 ? '' : 's'} earned${rewardProgress ? ` · ${rewardProgress} collected` : ''}`, y + 45, true, 21);
    y += 90;
  }
  label('Thank you for visiting!', Math.min(height - 70, y + 20), false, 20, 'center');
  label('Powered by risev', Math.min(height - 34, y + 55), true, 18, 'center', '#555');

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
  const pageWidth = 240, pageHeight = Math.round(height / width * pageWidth);
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = bytes; push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream\nendobj\n');
  const stream = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`;
  object(5, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  const xref = bytes; push('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export async function savePaidReceiptPdf(receipt: PaidReceipt): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = browserPdf(receipt);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${receipt.receipt_number || 'risev-receipt'}.pdf`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: receiptHtml(receipt) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save receipt PDF' });
}

export async function sharePaidReceiptPdf(receipt: PaidReceipt): Promise<'shared' | 'downloaded'> {
  if (Platform.OS === 'web') {
    const shareNav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (typeof File !== 'undefined' && shareNav.share && shareNav.canShare) {
      const blob = browserPdf(receipt);
      const file = new File([blob], `${receipt.receipt_number || 'risev-receipt'}.pdf`, { type: 'application/pdf' });
      if (shareNav.canShare({ files: [file] })) {
        await shareNav.share({ files: [file], title: 'Risev receipt' });
        return 'shared';
      }
    }
    await savePaidReceiptPdf(receipt);
    return 'downloaded';
  }
  await savePaidReceiptPdf(receipt);
  return 'shared';
}
