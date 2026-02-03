/**
 * IBAN Validation Utility
 * Supports validation with special focus on Jordanian IBANs (JO prefix)
 */

// IBAN length by country code
const IBAN_LENGTHS: Record<string, number> = {
  JO: 30, // Jordan
  SA: 24, // Saudi Arabia
  AE: 23, // UAE
  BH: 22, // Bahrain
  KW: 30, // Kuwait
  QA: 29, // Qatar
  OM: 23, // Oman
  LB: 28, // Lebanon
  EG: 29, // Egypt
  DE: 22, // Germany
  FR: 27, // France
  GB: 22, // UK
  US: 0,  // US doesn't use IBAN
};

// Jordan IBAN format: JO + 2 check digits + 4 char bank code + 22 digits account
const JORDAN_IBAN_REGEX = /^JO\d{2}[A-Z]{4}\d{22}$/;

/**
 * Validates the structure and checksum of an IBAN
 */
export function validateIBAN(iban: string): {
  isValid: boolean;
  error?: string;
  countryCode?: string;
} {
  if (!iban) {
    return { isValid: false, error: "IBAN is required" };
  }

  // Remove spaces and convert to uppercase
  const cleanIban = iban.replace(/\s/g, "").toUpperCase();

  // Check minimum length
  if (cleanIban.length < 5) {
    return { isValid: false, error: "IBAN is too short" };
  }

  // Extract country code
  const countryCode = cleanIban.substring(0, 2);

  // Check if country code is valid (letters only)
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return { isValid: false, error: "Invalid country code" };
  }

  // Check if we know this country's IBAN length
  const expectedLength = IBAN_LENGTHS[countryCode];
  if (expectedLength && cleanIban.length !== expectedLength) {
    return {
      isValid: false,
      error: `${countryCode} IBAN must be ${expectedLength} characters (got ${cleanIban.length})`,
      countryCode,
    };
  }

  // Special validation for Jordanian IBANs
  if (countryCode === "JO") {
    if (!JORDAN_IBAN_REGEX.test(cleanIban)) {
      return {
        isValid: false,
        error: "Invalid Jordan IBAN format (JO + 2 digits + 4 letters + 22 digits)",
        countryCode,
      };
    }
  }

  // Validate checksum using MOD-97 algorithm
  if (!validateIBANChecksum(cleanIban)) {
    return {
      isValid: false,
      error: "Invalid IBAN checksum",
      countryCode,
    };
  }

  return { isValid: true, countryCode };
}

/**
 * Validates the IBAN checksum using MOD-97 algorithm (ISO 7064)
 */
function validateIBANChecksum(iban: string): boolean {
  // Move first 4 characters to end
  const rearranged = iban.slice(4) + iban.slice(0, 4);

  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  let numericString = "";
  for (const char of rearranged) {
    if (/[A-Z]/.test(char)) {
      numericString += (char.charCodeAt(0) - 55).toString();
    } else {
      numericString += char;
    }
  }

  // Calculate MOD 97 using chunked approach (for large numbers)
  let remainder = 0;
  for (let i = 0; i < numericString.length; i += 7) {
    const chunk = numericString.slice(i, i + 7);
    remainder = parseInt(remainder.toString() + chunk, 10) % 97;
  }

  return remainder === 1;
}

/**
 * Formats an IBAN with spaces for display
 */
export function formatIBAN(iban: string): string {
  const clean = iban.replace(/\s/g, "").toUpperCase();
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Cleans an IBAN for storage (removes spaces, uppercase)
 */
export function cleanIBAN(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase();
}

/**
 * Get a human-readable country name from IBAN
 */
export function getIBANCountry(countryCode: string): string {
  const countries: Record<string, string> = {
    JO: "Jordan",
    SA: "Saudi Arabia",
    AE: "UAE",
    BH: "Bahrain",
    KW: "Kuwait",
    QA: "Qatar",
    OM: "Oman",
    LB: "Lebanon",
    EG: "Egypt",
    DE: "Germany",
    FR: "France",
    GB: "United Kingdom",
  };
  return countries[countryCode] || countryCode;
}
