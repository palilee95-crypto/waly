import { Image as NativeImage, Linking, Platform, Share } from 'react-native';
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
  merchantCoverUrl?: string | null;
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
  locale?: string;
};

const PASS_WIDTH = 360;
const PASS_HEIGHT = 710;
const PASS_SCALE = 2;
// Shared with the on-screen ticket so both renderings keep the same silhouette.
// The surface itself differs by medium (dark sheet vs printed page), so each
// renderer owns its own.
export const PASS_CARD_RADIUS = 22;
const PASS_SURFACE = '#F3F4F6';
const INK = '#111111';
const MUTED = '#667085';
const YELLOW = '#FFC700';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (match) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match] || match
));

// The pass is rendered outside React (canvas and expo-print HTML), so its copy
// cannot come from LanguageContext. Keep the handful of strings here, in both
// locales the app ships.
const PASS_COPY = {
  en: {
    pass: 'APPOINTMENT PASS',
    show: 'SHOW THIS CODE AT THE COUNTER',
    location: 'LOCATION',
    total: 'TOTAL',
    provider: 'Provider',
    bookedFor: 'Booked for',
    qrUnavailable: 'QR UNAVAILABLE',
    confirmed: 'CONFIRMED',
    checkedIn: 'CHECKED IN',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
    noShow: 'NO SHOW',
    slotPassed: 'SLOT PASSED',
    soon: 'SEE YOU SOON',
    youAreIn: 'YOU’RE CHECKED IN',
    visitComplete: 'VISIT COMPLETE',
    inactive: 'PASS INACTIVE',
  },
  ms: {
    pass: 'PAS TEMUJANJI',
    show: 'TUNJUKKAN KOD INI DI KAUNTER',
    location: 'LOKASI',
    total: 'JUMLAH',
    provider: 'Penyedia',
    bookedFor: 'Tempahan untuk',
    qrUnavailable: 'KOD QR TIADA',
    confirmed: 'DISAHKAN',
    checkedIn: 'SUDAH CHECK-IN',
    completed: 'SELESAI',
    cancelled: 'DIBATALKAN',
    noShow: 'TIDAK HADIR',
    slotPassed: 'MASA TAMAT',
    soon: 'JUMPA SEGERA',
    youAreIn: 'ANDA SUDAH CHECK-IN',
    visitComplete: 'LAWATAN SELESAI',
    inactive: 'PAS TIDAK AKTIF',
  },
};

export const passCopy = (locale?: string) => (locale === 'ms' ? PASS_COPY.ms : PASS_COPY.en);

export const passStatusTone = (status: string): 'positive' | 'negative' | 'neutral' => {
  if (status === 'arrived' || status === 'in_service' || status === 'completed') return 'positive';
  if (status === 'cancelled' || status === 'no_show' || status === 'slot_passed') return 'negative';
  return 'neutral';
};

export const passStatusLabel = (status: string, locale?: string) => {
  const copy = passCopy(locale);
  if (status === 'slot_passed') return copy.slotPassed;
  if (status === 'completed') return copy.completed;
  if (status === 'arrived' || status === 'in_service') return copy.checkedIn;
  if (status === 'cancelled') return copy.cancelled;
  if (status === 'no_show') return copy.noShow;
  return copy.confirmed;
};

const footerLabel = (status: string, locale?: string) => {
  const copy = passCopy(locale);
  const tone = passStatusTone(status);
  if (status === 'completed') return copy.visitComplete;
  if (tone === 'negative') return copy.inactive;
  if (status === 'arrived' || status === 'in_service') return copy.youAreIn;
  return copy.soon;
};

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

function renderPassCanvas(pass: AppointmentPassData, assets: { qr?: HTMLImageElement | null; logo?: HTMLImageElement | null; cover?: HTMLImageElement | null; risev?: HTMLImageElement | null }): HTMLCanvasElement {
  const copy = passCopy(pass.locale);
  const canvas = document.createElement('canvas');
  canvas.width = PASS_WIDTH * PASS_SCALE;
  canvas.height = PASS_HEIGHT * PASS_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Pass rendering is not available on this device.');
  ctx.scale(PASS_SCALE, PASS_SCALE);
  const t = (value: unknown, x: number, y: number, size: number, weight = 700, color = INK) => {
    ctx.font = `${weight} ${size}px "PlusJakartaSans_${weight >= 800 ? '800ExtraBold' : '700Bold'}", Arial`;
    ctx.fillStyle = color;
    ctx.fillText(String(value ?? ''), x, y);
  };
  const fitted = (value: unknown, width: number, size: number, weight = 700) => {
    const full = String(value ?? '');
    ctx.font = `${weight} ${size}px Arial`;
    if (ctx.measureText(full).width <= width) return full;
    let out = '';
    for (const char of full) {
      if (ctx.measureText(out + char + '…').width > width) break;
      out += char;
    }
    return out + '…';
  };
  const serviceLines = (() => {
    ctx.font = '800 21px Arial';
    const words = String(pass.serviceText || 'Appointment').split(/\s+/);
    const lines: string[] = [''];
    for (const word of words) {
      const current = lines[lines.length - 1];
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= 306) lines[lines.length - 1] = candidate;
      else if (lines.length < 2) lines.push(word);
      else { lines[1] = fitted(`${lines[1]} ${word}`, 306, 21, 800); break; }
    }
    return lines;
  })();
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  ctx.fillStyle = PASS_SURFACE;
  ctx.fillRect(0, 0, PASS_WIDTH, PASS_HEIGHT);
  ctx.fillStyle = '#FFFFFF';
  round(8, 8, 344, 702, PASS_CARD_RADIUS);
  ctx.fill();
  if (assets.risev) ctx.drawImage(assets.risev, 28, 25, 80, 27);
  else t('risev', 28, 46, 25, 800);
  t('A P P O I N T M E N T   P A S S', 28, 69, 9, 700, MUTED);

  // Merchant photograph with a dark scrim; full-bleed to the card edges, like
  // the on-screen ticket, with the branded fallback kept deliberate.
  ctx.save();
  ctx.beginPath();
  ctx.rect(8, 84, 344, 145);
  ctx.clip();
  if (assets.cover) {
    const ratio = Math.max(344 / assets.cover.width, 145 / assets.cover.height);
    const w = assets.cover.width * ratio;
    const h = assets.cover.height * ratio;
    ctx.drawImage(assets.cover, 8 + (344 - w) / 2, 84 + (145 - h) / 2, w, h);
  } else {
    const fallback = ctx.createLinearGradient(8, 84, 352, 229);
    fallback.addColorStop(0, '#4C3C0A');
    fallback.addColorStop(0.5, '#171717');
    fallback.addColorStop(1, '#050505');
    ctx.fillStyle = fallback;
    ctx.fillRect(8, 84, 344, 145);
  }
  const scrim = ctx.createLinearGradient(0, 84, 0, 229);
  scrim.addColorStop(0, 'rgba(0,0,0,0.08)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.90)');
  ctx.fillStyle = scrim;
  ctx.fillRect(8, 84, 344, 145);
  if (assets.logo) {
    ctx.save();
    round(27, 147, 30, 30, 7);
    ctx.clip();
    ctx.drawImage(assets.logo, 27, 147, 30, 30);
    ctx.restore();
  }
  t(fitted(pass.merchantName, 285, 20, 800), 27, 197, 20, 800, '#FFFFFF');
  t(`PASS #${pass.shortRef}`, 27, 214, 9, 800, '#E4E4E7');
  const status = passStatusLabel(pass.status, pass.locale);
  const tone = passStatusTone(pass.status);
  ctx.fillStyle = tone === 'positive' ? '#BBF7D0' : tone === 'negative' ? '#FECACA' : YELLOW;
  round(253, 202, 83, 20, 10);
  ctx.fill();
  t(status, 260, 215, 8.5, 800);
  ctx.restore();

  serviceLines.forEach((line, index) => t(fitted(line, 306, 21, 800), 27, 263 + index * 24, 21, 800));
  t(fitted(`${pass.bookingDate} · ${pass.startTime}`, 309, 12, 700), 27, 311, 12, 700, '#30343B');
  ctx.fillStyle = '#E6E8EC'; ctx.fillRect(27, 328, 306, 1);
  t(copy.location, 27, 349, 8.5, 700, '#818A9B');
  t(fitted(pass.branchName, 165, 12), 27, 369, 12);
  t(copy.total, 225, 349, 8.5, 700, '#818A9B');
  t(`RM${Number(pass.total || 0).toFixed(2)}`, 225, 369, 12);
  const provider = pass.staffName && !['Any Available', 'Any Provider'].includes(pass.staffName) ? pass.staffName : '';
  if (provider) t(fitted(`${copy.provider}: ${provider}`, 306, 11), 27, 393, 11);
  if (pass.customerName) t(fitted(`${copy.bookedFor} ${pass.customerName}`, 306, 10), 27, provider ? 411 : 394, 10, 700, MUTED);

  // Perforation and QR retain a white quiet zone for reliable scanning.
  ctx.strokeStyle = '#CBD0D9'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(21, 427); ctx.lineTo(339, 427); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = PASS_SURFACE;
  ctx.beginPath(); ctx.arc(8, 427, 12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(352, 427, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(79, 439, 202, 202);
  if (assets.qr) {
    ctx.drawImage(assets.qr, 89, 449, 182, 182);
  } else {
    // A missing QR must degrade: the pass still carries the booking details and
    // its sealed footer, so printing it beats failing the download outright.
    ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
    round(94, 454, 172, 172, 12); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = MUTED; ctx.font = '700 10px Arial'; ctx.textAlign = 'center';
    ctx.fillText(copy.qrUnavailable, 180, 545);
    ctx.textAlign = 'left';
  }
  t(copy.show, 81, 652, 8.5, 700, MUTED);
  // Clip the footer to the card silhouette so its bottom corners stay rounded,
  // exactly like the on-screen ticket instead of squaring off the card.
  ctx.save();
  round(8, 8, 344, 702, PASS_CARD_RADIUS);
  ctx.clip();
  ctx.fillStyle = INK; ctx.fillRect(8, 664, 344, 46);
  ctx.restore();
  t(footerLabel(pass.status, pass.locale), 105, 695, 10.5, 800, YELLOW);
  return canvas;
}

function passHtml(pass: AppointmentPassData): string {
  const copy = passCopy(pass.locale);
  const logo = pass.merchantLogoUrl ? `<img class="merchant-logo" src="${escapeHtml(pass.merchantLogoUrl)}" alt="">` : '';
  const cover = pass.merchantCoverUrl ? `<img class="cover" src="${escapeHtml(pass.merchantCoverUrl)}" alt="">` : '';
  const provider = pass.staffName && !['Any Available', 'Any Provider'].includes(pass.staffName)
    ? `<div class="subline">${escapeHtml(copy.provider)}: ${escapeHtml(pass.staffName)}</div>` : '';
  const qr = pass.qrUrl
    ? `<img src="${escapeHtml(pass.qrUrl)}" alt="Check-in QR">`
    : `<div class="qr-fallback">${escapeHtml(copy.qrUnavailable)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Appointment pass ${escapeHtml(pass.shortRef)}</title><style>
    @page{size:80mm 150mm;margin:0}*{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:#111;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif}
    .ticket{width:80mm;height:150mm;margin:auto;background:#fff;overflow:hidden;border-radius:5mm}
    .top{height:18mm;padding:4mm}.wordmark{font-size:21px;font-weight:900;letter-spacing:-1.5px}.eyebrow{color:#667085;font-size:7px;letter-spacing:2px;font-weight:700;margin-top:1mm}
    .hero{height:32mm;position:relative;background:linear-gradient(120deg,#4c3c0a,#111);overflow:hidden}.cover{width:100%;height:100%;object-fit:cover}.shade{position:absolute;inset:0;background:linear-gradient(transparent,rgba(0,0,0,.9))}.hero-text{position:absolute;bottom:3mm;left:4mm;right:4mm;color:#fff}.merchant-logo{width:7mm;height:7mm;object-fit:cover;border-radius:2mm}.merchant-name{font-size:17px;font-weight:900}.hero-bottom{display:flex;justify-content:space-between;align-items:center;font-size:7px;letter-spacing:.8px;margin-top:1mm}.status{background:#ffc700;color:#111;border-radius:99px;padding:1mm 2.5mm;font-weight:900}
    .details{height:43mm;padding:4mm}.service{font-weight:900;font-size:17px;line-height:1.2;max-height:14mm;overflow:hidden}.date{font-size:10px;font-weight:700;margin-top:2mm}.rule{border-top:1px solid #e6e8ec;margin:3mm 0}.cols{display:flex}.col{width:50%}.label{font-size:7px;font-weight:700;letter-spacing:1px;color:#818a9b}.value{font-size:10px;font-weight:700;margin-top:1mm}.subline{font-size:8px;margin-top:2mm;color:#667085}
    .tear{position:relative;border-top:1px dashed #cbd0d9;margin:0 4mm}.tear:before,.tear:after{content:'';position:absolute;top:-2mm;background:#f3f4f6;width:4mm;height:4mm;border-radius:50%}.tear:before{left:-6mm}.tear:after{right:-6mm}
    .qr{height:43mm;text-align:center;padding-top:2mm}.qr img{width:37mm;height:37mm}.qr p{font-size:7px;letter-spacing:1px;color:#667085;font-weight:700;margin:0}
    .qr-fallback{width:37mm;height:37mm;margin:0 auto;display:flex;align-items:center;justify-content:center;border:1px dashed #cbd0d9;border-radius:3mm;color:#667085;font-size:7px;font-weight:700;letter-spacing:1px}
    .foot{height:13mm;background:#111;color:#ffc700;text-align:center;padding-top:4mm;font-size:9px;font-weight:900;letter-spacing:1.4px}
  </style></head><body><div class="ticket"><div class="top"><div class="wordmark">risev</div><div class="eyebrow">${escapeHtml(copy.pass)}</div></div>
    <div class="hero">${cover}<div class="shade"></div><div class="hero-text">${logo}<div class="merchant-name">${escapeHtml(pass.merchantName)}</div><div class="hero-bottom"><span>PASS #${escapeHtml(pass.shortRef)}</span><span class="status">${escapeHtml(passStatusLabel(pass.status, pass.locale))}</span></div></div></div>
    <div class="details"><div class="service">${escapeHtml(pass.serviceText)}</div><div class="date">${escapeHtml(pass.bookingDate)} · ${escapeHtml(pass.startTime)}</div><div class="rule"></div><div class="cols"><div class="col"><div class="label">${escapeHtml(copy.location)}</div><div class="value">${escapeHtml(pass.branchName)}</div></div><div class="col"><div class="label">${escapeHtml(copy.total)}</div><div class="value">RM${Number(pass.total || 0).toFixed(2)}</div></div></div>${provider}${pass.customerName ? `<div class="subline">${escapeHtml(copy.bookedFor)} ${escapeHtml(pass.customerName)}</div>` : ''}</div>
    <div class="tear"></div><div class="qr">${qr}<p>${escapeHtml(copy.show)}</p></div><div class="foot">${escapeHtml(footerLabel(pass.status, pass.locale))}</div></div></body></html>`;
}

export async function saveAppointmentPass(pass: AppointmentPassData): Promise<void> {
  if (Platform.OS === 'web') {
    const risevUrl = NativeImage.resolveAssetSource(require('../assets/risev logo.png'))?.uri;
    const [qr, logo, cover, risev] = await Promise.all([loadImage(pass.qrUrl), loadImage(pass.merchantLogoUrl), loadImage(pass.merchantCoverUrl), loadImage(risevUrl)]);
    const canvas = renderPassCanvas(pass, { qr, logo, cover, risev });
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

// WhatsApp is the product's channel, but it must not be the only way out: a
// device without it still needs the pass link. Fall back to the native share
// sheet (or the clipboard on web) and report which path ran.
export async function shareAppointmentPass(pass: AppointmentPassData): Promise<'opened' | 'copied'> {
  if (!pass.passUrl) throw new Error('Appointment pass link is unavailable.');
  const message = `Appointment pass for ${pass.merchantName}\n${pass.serviceText}\n${pass.bookingDate} · ${pass.startTime}\nPass #${pass.shortRef}\n${pass.passUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

  if (Platform.OS === 'web') {
    const opened = typeof window !== 'undefined' && window.open ? window.open(whatsappUrl, '_blank') : null;
    if (opened) return 'opened';
    await Clipboard.setStringAsync(message);
    return 'copied';
  }

  try {
    await Linking.openURL(whatsappUrl);
    return 'opened';
  } catch (err) {
    await Share.share({ message, url: pass.passUrl });
    return 'opened';
  }
}
