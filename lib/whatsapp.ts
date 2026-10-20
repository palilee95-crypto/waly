import { formatMalaysianPhone } from './emailValidator';

/**
 * `wa.me` click-to-chat links.
 *
 * This is a device-level deep link: it opens the merchant's own WhatsApp with the
 * message prefilled. Risev does not send anything and cannot confirm delivery, so
 * nothing here may be reported as a delivery or campaign metric.
 */

/** '60131671227' | null. Uses the app's existing Malaysian normaliser. */
export function whatsappNumber(phone?: string | null): string | null {
  const local = formatMalaysianPhone(String(phone || ''));
  // formatMalaysianPhone strips the leading 0 and caps at 10 digits.
  if (!local || local.length < 8) return null;
  return `60${local}`;
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  const number = whatsappNumber(phone);
  if (!number) return null;
  const text = message && message.trim() ? `?text=${encodeURIComponent(message.trim())}` : '';
  return `https://wa.me/${number}${text}`;
}

export type TemplateVars = Record<string, string | number | null | undefined>;

/** Replaces {{name}}, {{merchant}}, {{days}}, {{reward}}, {{expiry}}. Unknown keys become ''. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return String(template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

export type ActionCardId = 'return' | 'rewards' | 'birthday';

export const DEFAULT_ACTION_TEMPLATES: Record<ActionCardId, string> = {
  return:
    "Hi {{name}}, we miss you at {{merchant}}! It's been {{days}} days since your last visit — come by this week and we'll add a stamp on us.",
  rewards:
    'Hi {{name}}, you have {{reward}} waiting at {{merchant}}. Want me to keep it for your next visit?',
  birthday:
    'Happy birthday month, {{name}}! {{merchant}} has a little something for you — drop by any time this month.',
};
