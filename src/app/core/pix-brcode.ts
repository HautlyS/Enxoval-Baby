import {PixKeyType} from './models';

/**
 * Normalizes text for EMV QR Code (BR Code) per Banco Central do Brasil spec:
 * strips diacritics, converts to uppercase, removes disallowed characters, trims to maxLen.
 */
export function normalizeEmvText(input: string, maxLen: number): string {
  const clean = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 .,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return (clean || 'ENXOVAL BABY').slice(0, maxLen);
}

/**
 * Sanitizes Pix key according to Bacen DICT formatting rules (strict ASCII for exact EMV TLV byte length).
 */
export function sanitizePixKey(rawKey: string, keyType: PixKeyType): string {
  const trimmed = rawKey
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
  if (!trimmed) return '';

  switch (keyType) {
    case 'cpf':
    case 'cnpj':
      return trimmed.replace(/\D/g, '');
    case 'telefone': {
      const digits = trimmed.replace(/\D/g, '');
      if (!digits) return '';
      if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        return `+${digits}`;
      }
      if (digits.length === 10 || digits.length === 11) {
        return `+55${digits}`;
      }
      return `+${digits}`;
    }
    case 'email':
      return trimmed.toLowerCase().slice(0, 77);
    case 'aleatoria':
    default:
      return trimmed.toLowerCase().slice(0, 77);
  }
}

export interface PixKeyValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

/**
 * Validates Pix key according to Banco Central DICT rules by key type.
 */
export function validatePixKey(rawKey: string, keyType: PixKeyType): PixKeyValidationResult {
  const normalized = sanitizePixKey(rawKey, keyType);
  if (!normalized) {
    return {valid: false, normalized: '', error: 'Informe uma Chave Pix válida.'};
  }

  switch (keyType) {
    case 'cpf':
      if (!/^\d{11}$/.test(normalized) || /^(\d)\1{10}$/.test(normalized)) {
        return {valid: false, normalized, error: 'CPF Pix deve conter exatamente 11 dígitos válidos.'};
      }
      return {valid: true, normalized};
    case 'cnpj':
      if (!/^\d{14}$/.test(normalized) || /^(\d)\1{13}$/.test(normalized)) {
        return {valid: false, normalized, error: 'CNPJ Pix deve conter exatamente 14 dígitos válidos.'};
      }
      return {valid: true, normalized};
    case 'telefone':
      if (!/^\+55\d{10,11}$/.test(normalized)) {
        return {
          valid: false,
          normalized,
          error: 'Telefone Pix deve incluir DDD + número (ex.: (11) 99999-8888).',
        };
      }
      return {valid: true, normalized};
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized) || normalized.length > 77) {
        return {
          valid: false,
          normalized,
          error: 'E-mail Pix deve ser um endereço válido com até 77 caracteres.',
        };
      }
      return {valid: true, normalized};
    case 'aleatoria':
    default:
      if (normalized.length < 16 || normalized.length > 77 || /\s/.test(normalized)) {
        return {
          valid: false,
          normalized,
          error: 'Chave aleatória (EVP) deve conter o código UUID sem espaços.',
        };
      }
      return {valid: true, normalized};
  }
}

/**
 * Computes CRC-16/CCITT-FALSE checksum:
 * Polynomial: 0x1021, Initial Value: 0xFFFF, No reflection, Final XOR: 0x0000
 */
export function computeCrc16CcittFalse(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

export interface PixBrCodeParams {
  pixKey: string;
  pixKeyType: PixKeyType;
  merchantName: string;
  merchantCity: string;
  amountBrl?: number;
  txid?: string;
  description?: string;
}

/**
 * Generates an official EMV QRCPS-MPM (BR Code) static Pix payload
 * accepted by all Brazilian banking apps (Nubank, Itaú, Bradesco, Inter, BB, Caixa, etc.).
 */
export function generatePixBrCode(params: PixBrCodeParams): string {
  const validation = validatePixKey(params.pixKey, params.pixKeyType);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Chave Pix inválida ou não configurada.');
  }
  const key = validation.normalized;

  const merchantName = normalizeEmvText(params.merchantName, 25);
  const merchantCity = normalizeEmvText(params.merchantCity, 15);

  const rawTxid = (params.txid ?? 'ENXOVALBABY')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 25);
  const txid = rawTxid || '***';

  // Tag 26: Merchant Account Information (GUI br.gov.bcb.pix + Pix Key + optional info)
  const guiSub = tlv('00', 'br.gov.bcb.pix');
  const keySub = tlv('01', key);
  let descSub = '';
  if (params.description) {
    const cleanDesc = normalizeEmvText(params.description, 40);
    // Respect Tag 26 max inner length of 99 chars
    const maxDescLen = Math.max(0, 99 - guiSub.length - keySub.length - 4);
    if (maxDescLen >= 4 && cleanDesc.length > 0) {
      descSub = tlv('02', cleanDesc.slice(0, maxDescLen));
    }
  }
  const tag26 = tlv('26', `${guiSub}${keySub}${descSub}`);

  // Tag 54: Transaction Amount (optional, formatted with dot and 2 decimals)
  let tag54 = '';
  if (typeof params.amountBrl === 'number' && Number.isFinite(params.amountBrl) && params.amountBrl > 0) {
    tag54 = tlv('54', params.amountBrl.toFixed(2));
  }

  // Tag 62: Additional Data Field Template (Sub-tag 05 = txid)
  const tag62 = tlv('62', tlv('05', txid));

  const payloadWithoutCrc =
    tlv('00', '01') +
    tlv('01', '11') +
    tag26 +
    tlv('52', '0000') +
    tlv('53', '986') +
    tag54 +
    tlv('58', 'BR') +
    tlv('59', merchantName) +
    tlv('60', merchantCity) +
    tag62 +
    '6304';

  const crc = computeCrc16CcittFalse(payloadWithoutCrc);
  return `${payloadWithoutCrc}${crc}`;
}
