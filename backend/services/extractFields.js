const { maskAadhaar } = require('./documentPrivacy');
function capture(text, patterns) { for (const regex of patterns) { const found = text.match(regex); if (found) return found[1].trim().replace(/\s+/g, ' '); } return ''; }
const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
function salaryMonth(value) {
  const numeric = value.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  if (numeric) return `${numeric[1]}-${numeric[2].padStart(2, '0')}`;
  const reversed = value.match(/\b(0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (reversed) return `${reversed[2]}-${reversed[1].padStart(2, '0')}`;
  const written = value.match(/\b([A-Za-z]{3,9})[\s,-]+(20\d{2})\b/);
  if (written) { const index = months.findIndex(m => m.startsWith(written[1].toLowerCase())); if (index >= 0) return `${written[2]}-${String(index + 1).padStart(2, '0')}`; }
  return '';
}
function extractFields(raw, type, languageHint = 'auto') {
  const text = maskAadhaar(raw);
  if (type === 'ITR') return require('./itrFields').extractItr(text);
  if (type === 'AADHAAR') {
    const dob = capture(text, [/(?:date\s*of\s*birth|d\.?o\.?b\.?)\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}-\d{2}-\d{2})/i]);
    let dateOfBirth = '';
    if (/^\d{4}-/.test(dob)) dateOfBirth = dob;
    else if (dob) { const [d,m,y] = dob.split(/[/.-]/); dateOfBirth = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
    let name = capture(text, [/^\s*(?:applicant\s*name|name)\s*[:\-]\s*([^\n]+)/im]);
    if (!name) { const lines = text.split('\n').map(l => l.trim()).filter(Boolean); const i = lines.findIndex(l => /(?:date\s*of\s*birth|\bDOB\b)/i.test(l)); if (i > 0 && /^[A-Za-z .'-]{3,100}$/.test(lines[i - 1]) && !/government|india|authority/i.test(lines[i-1])) name = lines[i - 1]; }
    const address = require('./aadhaarAddress').parseAddress(text, languageHint).fields;
    return { name, dateOfBirth, ...address, repoId: require('./repositoryId').extractRepoId(raw), maskedAadhaarNumber: text.match(/XXXX XXXX \d{4}/)?.[0] || '' };
  }
  const amount = label => { const found = capture(text, [new RegExp(`(?:${label})\\s*[:=-]?\\s*(?:INR|Rs\\.?|₹)?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, 'i')]); const n = Number(found.replace(/,/g, '')); return found && Number.isFinite(n) && n < 1e10 ? n : null; };
  const month = capture(text, [/(?:salary\s*month|pay\s*(?:period|month)|month)\s*[:\-]\s*([^\n]+)/i, /(?:salary\s*slip|payslip)\s*(?:for)?\s*[:\-]?\s*([^\n]+)/i]);
  return {
    employeeName: capture(text, [/(?:employee\s*name|name\s*of\s*(?:the\s*)?employee)\s*[:\-]\s*([^\n]+)/i]),
    employeeId: capture(text, [/(?:employee\s*(?:id|code|number|no\.?)|emp\.?\s*(?:id|code|no\.?))\s*[:\-]\s*([^\n]+)/i]),
    employerName: capture(text, [/(?:employer(?:\s*name)?|company(?:\s*name)?)\s*[:\-]\s*([^\n]+)/i]),
    salaryMonth: salaryMonth(month || text), grossSalary: amount('gross\\s*(?:salary|pay|earnings)'), netSalary: amount('net\\s*(?:salary|pay)|take[ -]?home(?:\\s*pay)?'), deductions: amount('(?:total\\s*)?deductions'),
  };
}
module.exports = { extractFields, salaryMonth };
