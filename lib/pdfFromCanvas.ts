// A single-page PDF that wraps one JPEG canvas. This is the web-only writer
// shared by the receipt and appointment-pass downloads: both draw their layout
// to a canvas and hand it here, so the downloaded file matches the screen.

export function jpegPdfBlob(canvas: HTMLCanvasElement, pageWidthPt: number, quality = 0.92): Blob {
  const width = canvas.width;
  const height = canvas.height;
  const encoded = canvas.toDataURL('image/jpeg', quality).split(',')[1];
  const binary = atob(encoded);
  const jpg = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const offsets: number[] = [0];
  const push = (data: string | Uint8Array) => {
    const chunk = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(chunk);
    bytes += chunk.length;
  };
  const object = (id: number, content: string | Uint8Array, suffix = '') => {
    offsets[id] = bytes;
    push(`${id} 0 obj\n`);
    push(content);
    push(`${suffix}\nendobj\n`);
  };

  push('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  const pageHeight = Math.round((height / width) * pageWidthPt);
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = bytes;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
  push(jpg);
  push('\nendstream\nendobj\n');
  const stream = `q ${pageWidthPt} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`;
  object(5, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  const xref = bytes;
  push('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
