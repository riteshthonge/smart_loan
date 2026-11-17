// QA helper: renders a masked fictional review PDF for visual inspection.
const fs = require('fs/promises');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { aadhaarLines } = require('./generateOcrDemo');
const { maskAadhaar } = require('../services/documentPrivacy');
const { extractFields } = require('../services/extractFields');
(async () => {
  const dir = path.resolve(__dirname, '../../tmp/pdfs'); await fs.mkdir(dir, { recursive: true });
  const text = maskAadhaar(aadhaarLines.join('\n'));
  const pdf = await require('../services/reviewCopy')({ documentType: 'AADHAAR', extractedText: text, extractedFields: extractFields(text, 'AADHAAR'), correctedFields: { name: 'Asha Demo' } });
  await fs.writeFile(path.join(dir, 'fictional-masked-review.pdf'), pdf);
  const parser = new PDFParse({ data: new Uint8Array(pdf) });
  try { const pages = await parser.getScreenshot({ desiredWidth: 1100 }); await fs.writeFile(path.join(dir, 'fictional-masked-review.png'), pages.pages[0].data); console.log('Fictional review copy rendered in tmp/pdfs.'); } finally { await parser.destroy(); }
})().catch(() => { console.error('Review-copy rendering failed.'); process.exitCode = 1; });
