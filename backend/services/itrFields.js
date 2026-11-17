const emptyItr = () => ({ taxpayerName: '', panMasked: '', assessmentYear: '', financialYear: '', itrFormType: '', acknowledgementNumber: '', filingDate: '', grossTotalIncome: null, totalIncome: null, totalTaxPaid: null, refundAmount: null });
const financialKeys = ['grossTotalIncome', 'totalIncome', 'totalTaxPaid', 'refundAmount'];
function parseAmount(value) {
  let text = String(value ?? '').trim().replace(/^(?:INR|Rs\.?|₹)\s*/i, '').replace(/\s*(?:\/-|INR|Rs\.?)$/i, '').trim();
  if (!/^-?\(?\d[\d,]*(?:\.\d{1,2})?\)?$/.test(text)) return null;
  if (text.includes('(') !== text.includes(')') || text.startsWith('-(')) return null;
  const integral = text.replace(/[()\-]/g, '').split('.')[0];
  if (integral.includes(',') && !/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})$/.test(integral)) return null;
  const negative = text.startsWith('(') && text.endsWith(')');
  text = text.replace(/[(),]/g, ''); const n = Number(text);
  return Number.isFinite(n) && Math.abs(n) < 1e13 ? (negative ? -n : n) : null;
}
function dateValue(value) {
  const iso = String(value).match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const numeric = String(value).match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  const written = String(value).match(/\b(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-](\d{4})\b/);
  let y, m, d;
  if (iso) [,y,m,d] = iso;
  else if (numeric) [,d,m,y] = numeric;
  else if (written) { [,d,m,y] = written; const index = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m.slice(0,3).toLowerCase()); if (index < 0) return ''; m = index + 1; }
  else return '';
  const candidate = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, parsed = new Date(candidate);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === candidate ? candidate : '';
}
function extractItr(text) {
  const result = emptyItr(), lines = String(text).split(/[\r\n\f]+/).map(s => s.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const knownLabel = /^(?:PAN|name|assessment|financial|ITR|acknowledg|filing|date|gross|total|refund|tax\s*payable)\b/i;
  const find = (labels, transform = value => value) => {
    for (const pattern of labels) for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(new RegExp(`^(?:\\d+[a-z]?[.)]?\\s+)?(?:${pattern})(?=\\s|:|=|$)\\s*[:=]?\\s*(.*)$`, 'i'));
      if (!match) continue;
      let tail = match[1].trim();
      if (!tail && lines[i + 1] && !knownLabel.test(lines[i + 1])) tail = lines[i + 1];
      const value = transform(tail);
      if (value !== '' && value !== null && value !== undefined) return value;
    }
    return null;
  };
  result.taxpayerName = find(['taxpayer name', 'name of (?:the )?(?:assessee|taxpayer)', 'name(?: and address)?']) || '';
  result.panMasked = text.match(/\b[A-Z]{5}\*{4}[A-Z]\b/i)?.[0]?.toUpperCase() || '';
  const year = value => { const m = value.match(/\b(20\d{2})\s*[-/]\s*(20\d{2}|\d{2})\b/); return m ? `${m[1]}-${m[2].slice(-2)}` : ''; };
  result.assessmentYear = find(['assessment year', 'A\.?Y\.?'], year) || '';
  result.financialYear = find(['financial year', 'F\.?Y\.?', 'previous year'], year) || '';
  const form = value => value.match(/\bITR\s*[-–]?\s*(V|[1-7])\b/i)?.[0]?.toUpperCase().replace(/\s*[-–]?\s*(V|[1-7])$/i, '-$1') || '';
  result.itrFormType = find(['ITR form type', 'form (?:type|name|number|no\.?)'], form) || form(text);
  result.acknowledgementNumber = find(['acknowledg(?:e)?ment (?:number|no\.?)'], value => value.match(/^[A-Z0-9/-]{5,30}\b/i)?.[0] || '') || '';
  result.filingDate = find(['date of filing(?: (?:of )?(?:the )?return)?', 'filing date', 'date of submission'], dateValue) || '';
  const amount = value => {
    const tail = value.replace(/^\([^)]*[A-Za-z+\-][^)]*\)\s*/, '').trim().replace(/^\d{1,2}\s+(?=[\d,]*[,\.])/, '');
    // Parse the entire value, not the last number on a line containing another
    // financial label. Ambiguous/collapsed columns stay missing for correction.
    return parseAmount(tail);
  };
  result.grossTotalIncome = find(['gross total income'], amount);
  result.totalIncome = find(['total income'], amount);
  result.totalTaxPaid = find(['total tax(?:es)? paid', 'tax(?:es)? paid'], amount);
  result.refundAmount = find(['refund amount', 'amount of refund', 'refund'], amount);
  return result;
}
module.exports = { extractItr, emptyItr, financialKeys, parseAmount, dateValue };
