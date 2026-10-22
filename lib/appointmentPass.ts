import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { downloadBlob, jpegPdfBlob } from '@/lib/pdfFromCanvas';

// Everything the appointment pass needs, independent of the booking record
// shape, so the sheet, the PDF and the print sheet render the same values.
export type AppointmentPassData = {
  bookingId: string;
  shortRef: string;
  status: string;
  merchantName: string;
  merchantLogoUrl?: string | null;
  passUrl: string;
  qrUrl: string;
  bookingDate: string;
  startTime: string;
  serviceText: string;
  branchName: string;
  staffName: string;
  total: number;
  customerName?: string;
  customerPhone?: string;
};

const PASS_WIDTH = 360;
const PASS_HEIGHT = 620;
const PASS_SCALE = 2;
const INK = '#111111';
const MUTED = '#64748B';
const FAINT = '#94A3B8';
const LINE = '#E2E8F0';
const BRAND = '#FFC700';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (match) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match] || match
));

const passStatusLabel = (status: string) => {
  if (status === 'completed') return 'COMPLETED';
  if (status === 'arrived' || status === 'in_service') return 'CHECKED IN';
  if (status === 'cancelled' || status === 'no_show') return status.toUpperCase().replace('_', ' ');
  return 'CONFIRMED';
};

const passDate = (pass: AppointmentPassData) => `${pass.bookingDate} @ ${pass.startTime || '—'}`;

function loadImage(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url || Platform.OS !== 'web' || typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function renderPassCanvas(pass: AppointmentPassData, assets: { qr?: HTMLImageElement | null; logo?: HTMLImageElement | null }): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PASS_WIDTH * PASS_SCALE;
  canvas.height = PASS_HEIGHT * PASS_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Pass rendering is not available on this device.');
  ctx.scale(PASS_SCALE, PASS_SCALE);
  ctx.textBaseline = 'alphabetic';

  const fontFor = (weight: number, size: number) =>
    `${weight} ${size}px "PlusJakartaSans_${weight >= 800 ? '800ExtraBold' : weight >= 700 ? '700Bold' : '500Medium'}", -apple-system, Arial`;
  const measure = (value: string, size: number, weight: number, spacing = 0) => {
    ctx.font = fontFor(weight, size);
    return value ? ctx.measureText(value).width + spacing * Math.max(0, value.length - 1) : 0;
  };
  const text = (value: unknown, x: number, baseline: number, options: { size?: number; weight?: number; color?: string; align?: 'left' | 'right' | 'center'; spacing?: number } = {}) => {
    const { size = 10, weight = 500, color = INK, align = 'left', spacing = 0 } = options;
    const string = String(value ?? '');
    if (!string) return 0;
    ctx.font = fontFor(weight, size);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    const width = measure(string, size, weight, spacing);
    const x0 = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
    if (spacing) {
      let cursor = x0;
      for (const char of string) {
        ctx.fillText(char, cursor, baseline);
        cursor += ctx.measureText(char).width + spacing;
      }
    } else {
      ctx.fillText(string, x0, baseline);
    }
    return width;
  };
  // One line, clipped with an ellipsis so a long service name cannot run under
  // the value column or off the card.
  const fit = (value: unknown, maxWidth: number, size: number, weight: number) => {
    const string = String(value ?? '');
    if (measure(string, size, weight) <= maxWidth) return string;
    let out = '';
    for (const char of string) {
      if (measure(out + char + '…', size, weight) > maxWidth) break;
      out += char;
    }
    return out ? `${out}…` : string.slice(0, 1);
  };
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };
  const rule = (y: number) => {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(PASS_WIDTH - pad, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const pad = 24;
  const right = PASS_WIDTH - pad;
  const contentWidth = right - pad;

  // Paper
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PASS_WIDTH, PASS_HEIGHT);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  roundRect(0.5, 0.5, PASS_WIDTH - 1, PASS_HEIGHT - 1, 22);
  ctx.stroke();

  text('APPOINTMENT PASS', pad, 34, { size: 9, weight: 800, color: FAINT, spacing: 1.6 });

  // Merchant tile + name
  const tile = 44;
  const tileY = 46;
  ctx.fillStyle = BRAND;
  roundRect(pad, tileY, tile, tile, 13);
  ctx.fill();
  if (assets.logo) {
    ctx.save();
    roundRect(pad, tileY, tile, tile, 13);
    ctx.clip();
    ctx.drawImage(assets.logo, pad, tileY, tile, tile);
    ctx.restore();
  } else {
    const parts = (pass.merchantName || 'Risev').trim().split(/\s+/).filter(Boolean);
    const initials = parts.length ? (parts[0].charAt(0) + (parts[1]?.charAt(0) || '')).toUpperCase() : 'R';
    text(initials, pad + tile / 2, tileY + 29, { size: 18, weight: 800, align: 'center', spacing: -0.5 });
  }
  text(fit(pass.merchantName, contentWidth - 76 - 92, 16, 800), pad + tile + 12, tileY + 20, { size: 16, weight: 800, spacing: -0.4 });
  text(`#${pass.shortRef}`, pad + tile + 12, tileY + 36, { size: 10, weight: 700, color: MUTED, spacing: 0.6 });

  // Status pill (top right)
  const statusLabel = passStatusLabel(pass.status);
  ctx.font = fontFor(800, 9);
  const statusWidth = ctx.measureText(statusLabel).width;
  const pillWidth = statusWidth + 26;
  const pillX = right - pillWidth;
  ctx.fillStyle = statusLabel === 'CHECKED IN' || statusLabel === 'COMPLETED' ? '#DCFCE7' : '#FEF9C3';
  roundRect(pillX, 52, pillWidth, 22, 11);
  ctx.fill();
  ctx.fillStyle = statusLabel === 'CHECKED IN' || statusLabel === 'COMPLETED' ? '#16A34A' : '#CA8A04';
  ctx.beginPath();
  ctx.arc(pillX + 11, 63, 3, 0, Math.PI * 2);
  ctx.fill();
  text(statusLabel, pillX + 18, 66, { size: 9, weight: 800, color: INK, spacing: 0.4 });

  rule(104);

  // QR card
  const qrCard = 224;
  const qrCardX = (PASS_WIDTH - qrCard) / 2;
  const qrCardY = 120;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = LINE;
  roundRect(qrCardX, qrCardY, qrCard, qrCard, 20);
  ctx.fill();
  ctx.stroke();
  if (assets.qr) {
    ctx.drawImage(assets.qr, qrCardX + 14, qrCardY + 14, qrCard - 28, qrCard - 28);
  } else {
    ctx.strokeStyle = '#CBD5E1';
    ctx.setLineDash([4, 4]);
    roundRect(qrCardX + 24, qrCardY + 24, qrCard - 48, qrCard - 48, 12);
    ctx.stroke();
    ctx.setLineDash([]);
    text('Scan at the counter', PASS_WIDTH / 2, qrCardY + qrCard / 2 - 4, { size: 11, weight: 700, color: MUTED, align: 'center' });
    text('or show the pass link', PASS_WIDTH / 2, qrCardY + qrCard / 2 + 12, { size: 9.5, weight: 500, color: FAINT, align: 'center' });
  }
  text('Show this at the counter', PASS_WIDTH / 2, qrCardY + qrCard + 20, { size: 10.5, weight: 600, color: MUTED, align: 'center' });

  rule(382);

  // Details
  const rows: Array<{ label: string; value: string }> = [
    { label: 'SERVICE', value: pass.serviceText },
    { label: 'SLOT', value: passDate(pass) },
    { label: 'LOCATION', value: pass.branchName },
    { label: 'PROVIDER', value: pass.staffName },
    { label: 'TOTAL', value: `RM${Number(pass.total || 0).toFixed(2)}` },
  ];
  if (pass.customerName) rows.push({ label: 'CUSTOMER', value: pass.customerName });
  let rowY = 402;
  for (const row of rows) {
    text(row.label, pad, rowY, { size: 8.5, weight: 800, color: FAINT, spacing: 1 });
    text(fit(row.value, contentWidth, 12, 800), pad, rowY + 15, { size: 12, weight: 800 });
    rowY += 34;
  }

  // Footer
  const poweredWidth = measure('Powered by', 9, 500) + 4 + measure('risev', 12, 800, -0.6);
  let poweredX = PASS_WIDTH / 2 - poweredWidth / 2;
  poweredX += text('Powered by', poweredX, PASS_HEIGHT - 22, { size: 9, color: FAINT }) + 4;
  text('risev', poweredX, PASS_HEIGHT - 21, { size: 12, weight: 800, spacing: -0.6 });

  return canvas;
}

function passHtml(pass: AppointmentPassData): string {
  const rows: Array<[string, string]> = [
    ['SERVICE', pass.serviceText],
    ['SLOT', passDate(pass)],
    ['LOCATION', pass.branchName],
    ['PROVIDER', pass.staffName],
    ['TOTAL', `RM${Number(pass.total || 0).toFixed(2)}`],
  ];
  if (pass.customerName) rows.push(['CUSTOMER', pass.customerName]);
  const detailRows = rows.map(([label, value]) => `<div class="row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('');
  const logo = pass.merchantLogoUrl
    ? `<img class="logo" src="${escapeHtml(pass.merchantLogoUrl)}" alt="">`
    : `<div class="logo fallback">${escapeHtml((pass.merchantName || 'Risev').slice(0, 1).toUpperCase())}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Appointment pass ${escapeHtml(pass.shortRef)}</title><style>
  @page{size:80mm auto;margin:0}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#111;background:#fff}
  .card{width:80mm;padding:6mm;border:1px solid #E2E8F0;border-radius:6mm}
  .eyebrow{font-size:8px;font-weight:800;color:#94A3B8;letter-spacing:1.6px}
  .brand{display:flex;align-items:center;gap:3mm;margin-top:3mm}
  .logo{width:11mm;height:11mm;border-radius:3mm;object-fit:cover;background:#FFC700}
  .fallback{display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px}
  .name{font-size:14px;font-weight:800}.ref{font-size:9px;color:#64748B;font-weight:700;margin-top:1mm}
  .pill{display:inline-block;margin-top:3mm;background:#FEF9C3;border-radius:99px;padding:1mm 3mm;font-size:8px;font-weight:800;letter-spacing:.4px}
  .rule{border-top:1px dashed #E2E8F0;margin:4mm 0}
  .qrbox{border:1px solid #E2E8F0;border-radius:5mm;padding:3mm;text-align:center}
  .qrbox img{width:48mm;height:48mm}
  .hint{font-size:8.5px;color:#64748B;margin-top:2mm}
  .row{display:flex;justify-content:space-between;gap:4mm;padding:1.6mm 0}
  .row span{font-size:7.5px;font-weight:800;color:#94A3B8;letter-spacing:1px}
  .row b{font-size:10px;font-weight:800;text-align:right}
  .foot{text-align:center;font-size:8px;color:#94A3B8;margin-top:4mm}
  </style></head><body><div class="card">
  <div class="eyebrow">APPOINTMENT PASS</div>
  <div class="brand">${logo}<div><div class="name">${escapeHtml(pass.merchantName)}</div><div class="ref">#${escapeHtml(pass.shortRef)}</div></div></div>
  <div class="pill">${escapeHtml(passStatusLabel(pass.status))}</div>
  <div class="rule"></div>
  <div class="qrbox"><img src="${escapeHtml(pass.qrUrl)}" alt="Appointment pass QR"><div class="hint">Show this at the counter</div></div>
  <div class="rule"></div>
  ${detailRows}
  <div class="foot">Powered by <b>risev</b></div>
  </div></body></html>`;
}

export async function saveAppointmentPass(pass: AppointmentPassData): Promise<void> {
  if (Platform.OS === 'web') {
    const [qr, logo] = await Promise.all([loadImage(pass.qrUrl), loadImage(pass.merchantLogoUrl)]);
    const canvas = renderPassCanvas(pass, { qr, logo });
    downloadBlob(jpegPdfBlob(canvas, Math.round((80 / 25.4) * 72)), `risev-pass-${pass.shortRef || pass.bookingId}.pdf`);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: passHtml(pass) });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Save appointment pass',
  });
}

export async function shareAppointmentPass(pass: AppointmentPassData): Promise<'shared' | 'copied'> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      try {
        await nav.share({ title: 'Appointment pass', text: `${pass.merchantName} appointment pass`, url: pass.passUrl });
        return 'shared';
      } catch (err: any) {
        if (err?.name === 'AbortError') return 'shared';
      }
    }
    await Clipboard.setStringAsync(pass.passUrl);
    return 'copied';
  }
  await Share.share({ message: `Your ${pass.merchantName} appointment pass:\n${pass.passUrl}`, url: pass.passUrl });
  return 'shared';
}
