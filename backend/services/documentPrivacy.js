const crypto = require('crypto');
// Apply before any OCR content, corrections or client filenames reach MongoDB/API.
function maskAadhaar(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/[\u0966-\u096f]/g, c => String(c.charCodeAt(0) - 0x966))
    .replace(/(?<![\dX])(?:\d[\s./:-]*){11,}\d(?!\d)/g, match => {
      const digits = match.replace(/\D/g, '');
      // ITR acknowledgement numbers are 15 digits, not Aadhaar numbers.
      return digits.length === 15 && /^\d{15}$/.test(match) ? match : `XXXX XXXX ${digits.slice(-4)}`;
    })
    .replace(/(?<![A-Z0-9])([A-Z]{5})[\s-]*\d{4}[\s-]*([A-Z])(?![A-Z0-9])/gi, (_, prefix, suffix) => `${prefix.toUpperCase()}****${suffix.toUpperCase()}`)
    .replace(/(?<!\w)([\dOoIl]{4})[\s-]+([\dOoIl]{4})[\s-]+([\dOoIl]{4})(?!\w)/g, (_, a, b, c) => `XXXX XXXX ${c.replace(/[Oo]/g, '0').replace(/[Il]/g, '1')}`);
}
function sanitize(value, fieldName) {
  if (value instanceof Date) return value;
  if (fieldName === 'repoId') return require('./repositoryId').normalizeRepoId(value);
  if (typeof value === 'string') return maskAadhaar(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v, k)]));
  return value;
}
function key() {
  const value = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!/^[a-fA-F0-9]{64}$/.test(value || '')) { const e = new Error('Document storage is not configured. Set DOCUMENT_ENCRYPTION_KEY to 64 random hex characters.'); e.status = 503; throw e; }
  return Buffer.from(value, 'hex');
}
function encrypt(buffer) { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(), iv); const data = Buffer.concat([cipher.update(buffer), cipher.final()]); return Buffer.concat([Buffer.from('SLD1'), iv, cipher.getAuthTag(), data]); }
function decrypt(buffer) {
  if (buffer.length < 32 || buffer.subarray(0,4).toString() !== 'SLD1') throw new Error('Invalid encrypted document.');
  const decipher = crypto.createDecipheriv('aes-256-gcm',key(),buffer.subarray(4,16));
  decipher.setAuthTag(buffer.subarray(16,32));
  return Buffer.concat([decipher.update(buffer.subarray(32)),decipher.final()]);
}
module.exports = { maskAadhaar, sanitize, encrypt, decrypt };
