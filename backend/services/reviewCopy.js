const PDFDocument = require('pdfkit');
const { sanitize, maskAadhaar } = require('./documentPrivacy');
module.exports = document => new Promise((resolve, reject) => {
  const pdf = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'SmartLoan - masked document review copy' } });
  const chunks = []; pdf.on('data', c => chunks.push(c)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject);
  pdf.fontSize(20).fillColor('#42378b').text('SmartLoan | Document review');
  pdf.moveDown().fontSize(11).fillColor('#333333').text(document.documentType === 'AADHAAR' ? 'Aadhaar Card - privacy-protected OCR copy' : document.documentType === 'ITR' ? 'Income Tax Return - masked OCR review copy' : 'Latest one-month salary slip - OCR review copy');
  pdf.moveDown().fontSize(9).fillColor('#666666').text('NOT VERIFIED. Text extraction is not proof of authenticity. This is a masked text review copy, not the original document image. Original files are stored encrypted and are never served through this download.');
  pdf.moveDown().fontSize(11).fillColor('#333333').text('OCR-extracted fields');
  const fieldRows = fields => { for (const [key, value] of Object.entries(sanitize(fields || {}))) pdf.fontSize(10).text(`${key.replace(/([A-Z])/g, ' $1')}: ${value ?? '(not readable)'}`); };
  fieldRows(document.extractedFields);
  if (Object.keys(document.correctedFields || {}).length) { pdf.moveDown().fontSize(11).text('Applicant-corrected fields (not independently verified)'); fieldRows(document.correctedFields); }
  pdf.moveDown().fontSize(11).text('Masked extracted text');
  pdf.moveDown(.5).fontSize(9).text(maskAadhaar(document.extractedText || 'No text extracted.').replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '?'), { lineGap: 3 });
  pdf.end();
});
