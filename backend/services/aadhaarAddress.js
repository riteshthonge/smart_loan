const { maskAadhaar } = require('./documentPrivacy');
const label = /^\s*(Address|पत्ता|पता)\s*[:：-]?\s*/i;
const care = /^\s*(?:[SCDW]\s*[/\\]\s*O|[SDCW]\s*\.\s*O\.?|द्वारा|मार्फत)\s*[:：-]?/i;
const boundary = /^(?:repo[ _-]*id\b|XXXX|aadhaar\b|uid\b|vid\b|enrol|enroll|date\s*of\s*birth|dob\b|name\s*:|gender|male\b|female\b|government|unique\s*identification|download\s*date|issue\s*date|help|www\.|https?:|1947\b|qr\b|\-\-\s*\d+\s*of|माझे\s*आधार|माझी\s*ओळख|मेरा\s*आधार|मेरी\s*पहचान|जन्म|नाव\s*:|नाम\s*:|लिंग|भारत\s*सरकार|भारतीय\s*विशिष्ट|सूचना)/i;
const pin = /(?<!\d)([1-9]\d{5})(?!\d)/;
function script(line) { const dev = (line.match(/[\u0900-\u097f]/g) || []).length, latin = (line.match(/[a-z]/gi) || []).length; return dev > latin ? 'dev' : latin ? 'latin' : ''; }
function language(text, heading, hint) {
  if (script(text) === 'latin') return 'en';
  if (heading === 'पत्ता' || /तालुका|जिल्हा|गाव|घर\s*क्रमांक|रस्ता/.test(text) && heading !== 'पता') return 'mr';
  if (heading === 'पता' || /मोहल्ला|जिला|डाकघर|उत्तर\s*प्रदेश|ग्राम/.test(text)) return 'hi';
  return ['hi', 'mr'].includes(hint) ? hint : 'und-Deva';
}
function parseAddress(raw, hint = 'auto') {
  const text = maskAadhaar(raw).replace(/\r/g, '').replace(/\b([1-9]\d{2})[ \t]+(\d{3})\b/g, '$1$2').replace(/(Address\s*[:：]|पत्ता\s*[:：]|पता\s*[:：])/gi, '\n$1');
  const lines = text.split(/\n|\f/).map(l => l.trim());
  const candidates = [];
  for (let index = 0; index < lines.length; index++) {
    const start = lines[index], match = start.match(label);
    if (!match && !care.test(start)) continue;
    const heading = match?.[1] || '', selected = [], indexes = [];
    let blockScript = '';
    for (let i = index; i < Math.min(lines.length, index + 18); i++) {
      let line = lines[i];
      if (!line) { if (selected.length && selected.some(l => pin.test(l))) break; continue; }
      if (i > index && (label.test(line) || boundary.test(line))) break;
      if (i === index && match) line = line.replace(label, '').trim();
      if (!line) continue;
      line = line.replace(/\s*(?:XXXX\s+XXXX\s+\d{4}|\bVID\b.*|https?:.*|www\..*)$/i, '').trim();
      if (!line || boundary.test(line)) break;
      const currentScript = care.test(line) || /^(?:PIN(?:\s*code)?\s*[:：-]?\s*)?[1-9]\d{5}$/i.test(line) ? '' : script(line);
      // Separate language blocks rather than joining translations into one address.
      if (blockScript && currentScript && currentScript !== blockScript) break;
      blockScript ||= currentScript;
      selected.push(line); indexes.push(i);
      if (pin.test(line)) break;
    }
    const address = selected.join('\n').trim(), postalCode = address.match(pin)?.[1] || '';
    if (!address || !/[\p{L}]/u.test(address)) continue;
    const complete = Boolean(postalCode && address.replace(/\s/g, '').length >= 15);
    candidates.push({ address, postalCode, addressLanguage: language(address, heading, hint), addressExtractionStatus: complete ? 'ADDRESS_EXTRACTED' : 'ADDRESS_INCOMPLETE', indexes, labelFound: !!match });
  }
  // Prefer a complete block. When both translations are present, keep English
  // unless the applicant explicitly requested the available Hindi/Marathi block.
  const rank = c => (c.addressExtractionStatus === 'ADDRESS_EXTRACTED' ? 1000 : 0) + (c.addressLanguage === hint ? 100 : c.addressLanguage === 'en' ? 50 : 0) + Math.min(c.address.length, 400) / 10 + (c.labelFound ? 10 : 0);
  candidates.sort((a, b) => rank(b) - rank(a));
  const chosen = candidates[0];
  const fields = chosen ? { address: chosen.address, postalCode: chosen.postalCode, addressLanguage: chosen.addressLanguage, addressExtractionStatus: chosen.addressExtractionStatus } : { address: '', postalCode: '', addressLanguage: '', addressExtractionStatus: 'MANUAL_REVIEW_REQUIRED' };
  // These structural diagnostics deliberately contain NO recognized line text.
  const debug = { candidateCount: candidates.length, labelFound: !!chosen?.labelFound, selectedLineIndexes: chosen?.indexes || [], selectedLineCharacterCounts: chosen ? chosen.address.split('\n').map(l => l.length) : [], postalCodeFound: !!fields.postalCode, language: fields.addressLanguage, status: fields.addressExtractionStatus };
  return { fields, debug };
}
module.exports = { parseAddress };
