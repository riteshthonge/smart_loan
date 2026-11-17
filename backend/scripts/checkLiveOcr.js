// Uses a temporary fictional applicant and deletes only records/files it creates.
require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const { User, Document } = require('../models');
const { fixtures } = require('./generateOcrDemo');
const email = `ocr-check-${crypto.randomUUID()}@example.invalid`;
const origin = process.env.FRONTEND_URL || 'http://localhost:5173';
const base = `http://localhost:${process.env.PORT || 5000}/api`;
let userId;
(async () => {
  const response = await fetch(`${base}/auth/register`, { method: 'POST', headers: { Origin: origin, 'X-Requested-With': 'SmartLoan', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Fictional OCR Check', email, password: crypto.randomBytes(24).toString('hex') }) });
  if (!response.ok) throw new Error('REGISTER');
  const account = await response.json(); userId = account.user._id;
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const products = await (await fetch(`${base}/loan-products`, { headers: { Cookie: cookie } })).json();
  const product = products.find(p => p.name === 'Personal Loan');
  if (!product) throw new Error('PRODUCT');
  const demo = await fixtures(); const itr = await require('./generateItrDemo').fixtures(); demo.itrV=itr.itrV; demo.itrScanned=itr.scanned; demo.itrImage=itr.png;
  for (const [type, key, filename, mime] of [['SALARY_SLIP', 'salaryPdf', 'fictional-salary.pdf', 'application/pdf'], ['AADHAAR', 'scannedAadhaarPdf', 'fictional-scan.pdf', 'application/pdf'], ['SALARY_SLIP', 'salaryJpg', 'fictional-salary.jpg', 'image/jpeg'], ['AADHAAR', 'aadhaarPng', 'fictional-aadhaar.png', 'image/png'], ['ITR', 'itrV', 'fictional-itr.pdf', 'application/pdf'], ['ITR', 'itrScanned', 'fictional-itr-scanned.pdf', 'application/pdf'], ['ITR', 'itrImage', 'fictional-itr.png', 'image/png']]) {
    const body = new FormData(); body.append('documentType', type); body.append('loanProduct', product._id); body.append('document', new Blob([demo[key]], { type: mime }), filename);
    const r = await fetch(`${base}/documents/ocr`, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'X-Requested-With': 'SmartLoan' }, body });
    const d = await r.json();
    console.log(JSON.stringify({ fixture: key, httpStatus: r.status, documentType: d.documentType, ocrStatus: d.ocrStatus, verificationStatus: d.verificationStatus, errorCode: d.ocrErrorCode || null }));
    if (d.ocrStatus !== 'COMPLETED' || d.documentType !== type || !d.extractedText || /(?<!\d)1234[\s-]*5678[\s-]*9012(?!\d)/.test(d.extractedText) || /ABCDE1234F/.test(d.extractedText)) throw new Error('EXTRACTION');
  }
})().catch(error => { console.error('Live OCR check did not pass:', JSON.stringify({stage:['REGISTER','PRODUCT','EXTRACTION'].includes(error.message)?error.message:'CONNECTION', errorName:['TypeError','SyntaxError','Error'].includes(error.name)?error.name:'Error', networkCode: /^[A-Z_]{3,40}$/.test(error.cause?.code || '') ? error.cause.code : null})); process.exitCode = 1; }).finally(async () => {
  await require('../config/db')();
  const user = await User.findOne(userId ? { _id: userId, email } : { email });
  if (user) {
    for (const d of await Document.find({ applicant: user._id })) {
      if (/^[a-f0-9-]{36}$/.test(d.storagePath)) await fs.unlink(path.join(require('../middleware/upload').directory, d.storagePath)).catch(() => {});
      await Document.deleteOne({ _id: d._id, applicant: user._id });
    }
    await User.deleteOne({ _id: user._id, email });
    console.log('Temporary fictional applicant and its uploads removed.');
  }
  await mongoose.disconnect();
});
