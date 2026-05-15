// CPF/CNPJ validation utilities (digit-verifier algorithm)

export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

export function isValidCPF(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;
  // Reject all-equal digits (e.g., 111.111.111-11)
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (slice: string, factor: number) => {
    let total = 0;
    for (let i = 0; i < slice.length; i++) {
      total += parseInt(slice[i], 10) * (factor - i);
    }
    const mod = (total * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calc(digits.substring(0, 9), 10);
  if (d1 !== parseInt(digits[9], 10)) return false;
  const d2 = calc(digits.substring(0, 10), 11);
  if (d2 !== parseInt(digits[10], 10)) return false;

  return true;
}

export function isValidCNPJ(cnpj: string): boolean {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (slice: string) => {
    const factors = slice.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let total = 0;
    for (let i = 0; i < slice.length; i++) {
      total += parseInt(slice[i], 10) * factors[i];
    }
    const mod = total % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(digits.substring(0, 12));
  if (d1 !== parseInt(digits[12], 10)) return false;
  const d2 = calc(digits.substring(0, 13));
  if (d2 !== parseInt(digits[13], 10)) return false;

  return true;
}

/**
 * Validates a Brazilian document. Accepts CPF (11 digits) or CNPJ (14 digits).
 * Returns { valid, type, message }.
 */
export function validateDocument(value: string): { valid: boolean; type: 'cpf' | 'cnpj' | 'unknown'; message?: string } {
  const digits = onlyDigits(value);
  if (digits.length === 0) return { valid: true, type: 'unknown' }; // empty allowed (optional field)
  if (digits.length === 11) {
    return isValidCPF(digits)
      ? { valid: true, type: 'cpf' }
      : { valid: false, type: 'cpf', message: 'CPF inválido. Verifique os dígitos digitados.' };
  }
  if (digits.length === 14) {
    return isValidCNPJ(digits)
      ? { valid: true, type: 'cnpj' }
      : { valid: false, type: 'cnpj', message: 'CNPJ inválido. Verifique os dígitos digitados.' };
  }
  return { valid: false, type: 'unknown', message: 'Documento incompleto. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' };
}
