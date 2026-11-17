const fs = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');
const { pdf } = require('./generateOcrDemo');
const lines = ['FICTIONAL ITR-V - NOT A FILED RETURN', 'Name of Assessee: Asha Demo', 'PAN: ABCDE1234F', 'Assessment Year: 2025-26', 'Financial Year: 2024-25', 'Acknowledgement Number: 123456789012345', 'Date of Filing: 31/07/2025', 'Gross Total Income: INR 9,60,000.00', 'Total Income: INR 8,80,000', 'Tax Payable: INR 40,000', 'Total Tax Paid: INR 45,000', 'Refund Amount: INR 5,000'];
async function fixtures() {
  // A taller canvas preserves all rows for image/scanned-document fixtures.
  const { createCanvas } = require('@napi-rs/canvas'); const canvas = createCanvas(1800, 1550), ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0,0,1800,1550); ctx.fillStyle = '#111'; ctx.font = '30px Arial'; lines.forEach((line,i) => ctx.fillText(line,70,80+i*110));
  const fullPng = canvas.toBuffer('image/png'), jpg = canvas.toBuffer('image/jpeg');
  const filed = await new Promise(resolve => { const d = new PDFDocument(), chunks = []; d.on('data',c=>chunks.push(c)); d.on('end',()=>resolve(Buffer.concat(chunks))); d.text('FICTIONAL FILED ITR FORM - NOT FILED\nForm Name: ITR-2\nName: Asha Demo\nPAN: ABCDE1234F\nAssessment Year: 2025-26'); for (let i=0;i<4;i++) d.addPage().text('FICTIONAL FORM DETAIL PAGE '+(i+2)); d.addPage().text('Gross Total Income: 12,00,000\nTotal Income: 10,50,000\nTax Payable: 70,000\nTotal Tax Paid: 75,000\nRefund: 5,000'); d.end(); });
  return { itrV: await pdf(lines), filed, png: fullPng, jpg, scanned: await pdf([], fullPng), sparse: await pdf(['FICTIONAL ITR-V - NOT FILED', 'Name: Asha Demo', 'Tax Payable: INR 20,000']) };
}
module.exports = { fixtures, lines };
if (require.main === module) (async()=>{ const dir=path.resolve(__dirname,'../demo-documents'); await fs.mkdir(dir,{recursive:true}); const data=await fixtures(); for(const [key,file] of Object.entries({itrV:'fictional-itr-v.pdf',filed:'fictional-filed-itr.pdf',png:'fictional-itr.png',jpg:'fictional-itr.jpg',scanned:'fictional-scanned-itr.pdf',sparse:'fictional-itr-missing-fields.pdf'})) await fs.writeFile(path.join(dir,file),data[key]); console.log('Six clearly fictional ITR fixtures generated.'); })().catch(()=>{console.error('Unable to generate ITR fixtures.');process.exitCode=1});
