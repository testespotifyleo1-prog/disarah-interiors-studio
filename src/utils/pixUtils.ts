/**
 * Generate a PIX EMV-compatible "copia e cola" payload and QR code URL.
 * This follows the simplified BRCode format for static PIX.
 */

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value;
}

function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc = crc << 1;
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

export interface PixPayload {
  pixKey: string;
  merchantName?: string;
  merchantCity?: string;
  amount?: number;
  description?: string;
}

/** Remove accents and non-ASCII chars (BRCode requires ASCII). */
function sanitize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .toUpperCase()
    .trim();
}

export function generatePixPayload(payload: PixPayload): string {
  const { pixKey, merchantName = 'Loja', merchantCity = 'Brasil', amount, description } = payload;

  const cleanKey = pixKey.replace(/\s+/g, '').trim();
  const cleanName = sanitize(merchantName).substring(0, 25) || 'LOJA';
  const cleanCity = sanitize(merchantCity).substring(0, 15) || 'BRASIL';
  const cleanDesc = description ? sanitize(description).substring(0, 25) : '';

  let gui = tlv('00', 'br.gov.bcb.pix');
  gui += tlv('01', cleanKey);
  if (cleanDesc) gui += tlv('02', cleanDesc);

  let emv = '';
  emv += tlv('00', '01'); // Payload Format Indicator
  emv += tlv('01', amount ? '12' : '11'); // Point of Initiation Method (12 = single use, 11 = reusable)
  emv += tlv('26', gui); // Merchant Account Information
  emv += tlv('52', '0000'); // Merchant Category Code
  emv += tlv('53', '986'); // Transaction Currency (BRL)
  if (amount && amount > 0) {
    emv += tlv('54', amount.toFixed(2));
  }
  emv += tlv('58', 'BR'); // Country Code
  emv += tlv('59', cleanName); // Merchant Name (ASCII)
  emv += tlv('60', cleanCity); // Merchant City (ASCII)
  emv += tlv('62', tlv('05', '***')); // Additional Data Field (txid)

  // CRC placeholder then calculate
  emv += '6304';
  const crc = crc16(emv);
  emv = emv.slice(0, -4) + '6304' + crc;

  return emv;
}

export function getPixQrCodeUrl(pixPayload: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(pixPayload)}&format=svg`;
}