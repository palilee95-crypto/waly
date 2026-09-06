/**
 * Email validation and common domain typo detection/correction.
 */

const COMMON_TYPOS: Record<string, string> = {
  // Gmail typos
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gmai.con': 'gmail.com',
  'gamil.con': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',

  // iCloud typos
  'icloud.con': 'icloud.com',
  'icloud.cmo': 'icloud.com',
  'icloud.cm': 'icloud.com',
  'iclud.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'icluod.com': 'icloud.com',
  'icloud.co': 'icloud.com',

  // Yahoo typos
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yaho.con': 'yahoo.com',
  'ymail.con': 'ymail.com',

  // Hotmail typos
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmial.con': 'hotmail.com',

  // Outlook typos
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.con': 'outlook.com',
};

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestedEmail?: string;
}

export function validateEmailWithTypoCheck(rawEmail: string): EmailValidationResult {
  const email = (rawEmail || '').trim().toLowerCase();

  if (!email) {
    return { isValid: false, error: 'Email address is required.' };
  }

  const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email format (e.g. user@gmail.com).' };
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Please enter a valid email address.' };
  }

  const [username, domain] = parts;

  if (domain.endsWith('@risev.app') || domain === 'risev.app') {
    return { isValid: false, error: 'Please use your personal email address.' };
  }

  // 1. Direct typo domain check
  if (COMMON_TYPOS[domain]) {
    const suggested = `${username}@${COMMON_TYPOS[domain]}`;
    return {
      isValid: false,
      error: `Did you mean @${COMMON_TYPOS[domain]}?`,
      suggestedEmail: suggested,
    };
  }

  // 2. Misspelled TLD check (e.g. .con, .cmo, .coom, .comm)
  const dotIndex = domain.lastIndexOf('.');
  if (dotIndex !== -1) {
    const tld = domain.slice(dotIndex + 1);
    const domainPrefix = domain.slice(0, dotIndex);

    if (tld === 'con' || tld === 'cmo' || tld === 'coom' || tld === 'comm' || tld === 'cpm' || tld === 'xom') {
      const suggested = `${username}@${domainPrefix}.com`;
      return {
        isValid: false,
        error: `Did you mean @${domainPrefix}.com instead of .${tld}?`,
        suggestedEmail: suggested,
      };
    }
  }

  return { isValid: true };
}

export interface BirthdayValidationResult {
  isValid: boolean;
  isoDate?: string; // "YYYY-MM-DD"
  error?: string;
}

export function parseAndNormalizeBirthday(raw: string): BirthdayValidationResult {
  if (!raw || !raw.trim()) {
    return { isValid: false, error: 'Birthday is required.' };
  }

  const cleaned = raw.trim().replace(/\//g, '-');
  const parts = cleaned.split('-');

  let day = 0;
  let month = 0;
  let year = 0;

  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      // DD-MM-YYYY or D-M-YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
  } else {
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 8) {
      day = parseInt(digits.slice(0, 2), 10);
      month = parseInt(digits.slice(2, 4), 10);
      year = parseInt(digits.slice(4, 8), 10);
    } else {
      return { isValid: false, error: 'Please enter birthday in DD-MM-YYYY format (e.g. 01-09-2000).' };
    }
  }

  const currentYear = new Date().getFullYear();
  if (isNaN(year) || year < 1920 || year > currentYear) {
    return { isValid: false, error: `Year must be between 1920 and ${currentYear}.` };
  }
  if (isNaN(month) || month < 1 || month > 12) {
    return { isValid: false, error: 'Month must be between 1 and 12.' };
  }
  if (isNaN(day) || day < 1 || day > 31) {
    return { isValid: false, error: 'Day must be between 1 and 31.' };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return { isValid: false, error: `Invalid day for month (${daysInMonth} days in this month).` };
  }

  const formattedDay = String(day).padStart(2, '0');
  const formattedMonth = String(month).padStart(2, '0');
  const formattedYear = String(year);

  return {
    isValid: true,
    isoDate: `${formattedYear}-${formattedMonth}-${formattedDay}`,
  };
}

