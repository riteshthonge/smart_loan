const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { Document, LoanProduct } = require('../models');
const { fail } = require('../utils');
const upload = require('../middleware/upload');
const { encrypt, sanitize, maskAadhaar } = require('../services/documentPrivacy');
const ocr = require('../services/ocr');
// Serialize without recursively converting ObjectIds/dates through sanitize().
exports.serialize = d => {
  const value = d.toObject({ virtuals: true });
  delete value.storagePath; delete value.encryptedOriginal;
  value.sourceFiles = (value.sourceFiles || []).map(({ storagePath, ...file }) => ({ ...file, originalFileName: maskAadhaar(file.originalFileName) }));
  value.extractedText = maskAadhaar(value.extractedText);
  value.extractedFields = sanitize(value.extractedFields);
  if (d.documentType === 'AADHAAR') value.extractedFields = { ...value.extractedFields, repoId: require('../services/repositoryId').normalizeRepoId(value.extractedFields?.repoId) };
  value.correctedFields = sanitize(value.correctedFields);
  value.originalFileName = maskAadhaar(value.originalFileName);
  return value;
};
exports.uploadOcr = async (req, res) => {
  const type = req.body.documentType;
  if (!['AADHAAR', 'SALARY_SLIP', 'ITR'].includes(type)) fail(400, 'Personal Loans accept only AADHAAR, SALARY_SLIP and ITR.');
  const single = req.files?.document || (req.file ? [req.file] : []), front = req.files?.front || [], back = req.files?.back || [];
  const separate = front.length === 1 && back.length === 1 && single.length === 0;
  if (!(single.length === 1 && !front.length && !back.length) && !(type === 'AADHAAR' && separate)) fail(400, 'Upload one file, or Aadhaar front and back images together.');
  const files = separate ? [{ file: front[0], side: 'front' }, { file: back[0], side: 'back' }] : [{ file: single[0], side: 'combined' }];
  if (separate && files.some(({ file }) => !['image/jpeg', 'image/png'].includes(file.mimetype))) fail(400, 'Separate front/back uploads must be JPG or PNG. For a two-sided PDF use the single-file option.');
  const languageHint = req.body.languageHint || 'auto';
  if (!['auto', 'en', 'hi', 'mr'].includes(languageHint)) fail(400, 'Invalid address language preference.');
  upload.validate(files.map(f => f.file));
  const product = await LoanProduct.findOne({ _id: req.body.loanProduct, name: 'Personal Loan', isActive: true });
  if (!product) fail(400, 'OCR is available for Personal Loan only.');
  // Store encrypted originals before text extraction. Only safe review copies can be downloaded.
  await fs.mkdir(upload.directory, { recursive: true });
  const stored = [];
  let document;
  try {
    for (const { file, side } of files) {
      const storagePath = crypto.randomUUID();
      await fs.writeFile(path.join(upload.directory, storagePath), encrypt(file.buffer), { flag: 'wx', mode: 0o600 });
      stored.push({ side, storagePath, originalFileName: maskAadhaar(path.basename(file.originalname).slice(0, 200)), mimeType: file.mimetype, fileSize: file.size });
    }
    document = await Document.create({ applicant: req.user._id, loanProduct: product._id, documentType: type, ...stored[0], sourceFiles: stored, encryptedOriginal: true, ocrStatus: 'PROCESSING', verificationStatus: 'NOT_VERIFIED', addressConfirmationRequired: type === 'AADHAAR', confirmationRequired: true, extractedFields: type === 'AADHAAR' ? { name: '', dateOfBirth: '', address: '', postalCode: '', repoId: null, addressLanguage: '', addressExtractionStatus: 'PENDING' } : type === 'ITR' ? require('../services/itrFields').emptyItr() : {} });
  } catch (e) { for (const file of stored) await fs.unlink(path.join(upload.directory, file.storagePath)).catch(() => {}); throw e; }
  try {
    const result = await ocr.extract(files[0].file.buffer, files[0].file.mimetype, type, { side: files[0].side, languageHint, additionalFiles: files.slice(1).map(({ file, side }) => ({ buffer: file.buffer, mimeType: file.mimetype, side })) });
    document.extractedText = result.extractedText;
    document.extractedFields = result.extractedFields;
    document.ocrStatus = 'COMPLETED';
    document.processingStatus = 'OCR_COMPLETED';
    document.addressSource = result.addressSource;
    document.addressDebug = result.addressDebug;
    if (type === 'AADHAAR' && process.env.OCR_DEBUG_ADDRESS === 'true') console.info('[Aadhaar address structure]', JSON.stringify(result.addressDebug));
  } catch (error) {
    const detail = error.ocrDiagnostic || require('../services/ocrErrors').diagnostic(error);
    // Deliberately omit source filenames, OCR output, arbitrary exceptions and stacks.
    console.error('[OCR extraction failed]', JSON.stringify(detail));
    document.ocrStatus = 'FAILED';
    document.ocrError = detail.message;
    document.ocrErrorCode = detail.code;
    document.ocrErrorStage = detail.stage;
  }
  await document.save();
  res.status(201).json(exports.serialize(document));
};
exports.get = async (req, res) => {
  const filter = { _id: req.params.id };
  if (req.user.role !== 'ADMIN') filter.applicant = req.user._id;
  // Admin can inspect submitted records, not an applicant's abandoned draft uploads.
  else filter.application = { $ne: null };
  const d = await Document.findOne(filter);
  if (!d) fail(404, 'Document not found.');
  res.json(exports.serialize(d));
};
const keys = {
  AADHAAR: ['name', 'dateOfBirth', 'address', 'postalCode', 'addressLanguage'],
  SALARY_SLIP: ['employeeName', 'employeeId', 'employerName', 'salaryMonth', 'grossSalary', 'netSalary', 'deductions'],
  ITR: Object.keys(require('../services/itrFields').emptyItr()),
};
exports.correct = async (req, res) => {
  const fields = req.body.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) fail(400, 'Provide the corrected fields.');
  const d = await Document.findOne({ _id: req.params.id, applicant: req.user._id, application: null, ocrStatus: 'COMPLETED' });
  if (!d) fail(404, 'Completed draft document not found.');
  const result = {};
  for (const [k, value] of Object.entries(fields)) {
    if (!keys[d.documentType]?.includes(k)) fail(400, 'That extracted field cannot be edited.');
    if (['grossSalary', 'netSalary', 'deductions', ...require('../services/itrFields').financialKeys].includes(k)) {
      if (value === '' || value === null) result[k] = null;
      else if (!Number.isFinite(Number(value)) || Number(value) < (['grossTotalIncome', 'totalIncome'].includes(k) ? -1e12 : 0) || Number(value) >= 1e12) fail(400, 'Enter a valid financial amount.');
      else result[k] = Number(value);
    } else {
      if (typeof value !== 'string' || value.length > (k === 'address' ? 2000 : 150)) fail(400, 'Invalid extracted field.');
      if (k === 'salaryMonth' && value && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) fail(400, 'Salary month must use YYYY-MM.');
      if (k === 'dateOfBirth' && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)))) fail(400, 'Date of birth must use YYYY-MM-DD.');
      if (k === 'filingDate' && value && require('../services/itrFields').dateValue(value) !== value) fail(400, 'Filing date must be a valid YYYY-MM-DD date.');
      if (['assessmentYear', 'financialYear'].includes(k) && value && !/^20\d{2}-\d{2}$/.test(value)) fail(400, 'Use YYYY-YY for assessment/financial year.');
      if (k === 'postalCode' && value && !/^[1-9]\d{5}$/.test(value)) fail(400, 'Enter a six-digit PIN code.');
      if (k === 'addressLanguage' && !['', 'en', 'hi', 'mr', 'und-Deva'].includes(value)) fail(400, 'Invalid address language.');
      result[k] = maskAadhaar(value.trim());
    }
  }
  // Conditional update also prevents corrections racing with submission/claiming.
  const corrected = sanitize({ ...d.correctedFields, ...result });
  const changes = { correctedFields: corrected, applicantConfirmed: req.body.applicantConfirmed === true };
  if (d.documentType === 'AADHAAR') {
    const merged = { ...d.extractedFields, ...corrected };
    const complete = Boolean(merged.address?.trim().length >= 10 && /^[1-9]\d{5}$/.test(merged.postalCode || ''));
    corrected.addressExtractionStatus = complete ? 'ADDRESS_EXTRACTED' : merged.address ? 'ADDRESS_INCOMPLETE' : 'MANUAL_REVIEW_REQUIRED';
    if (req.body.addressConfirmed === true && !complete) fail(400, 'Correct the full address and six-digit PIN code before confirming.');
    changes.addressConfirmed = req.body.addressConfirmed === true && complete;
  }
  const updated = await Document.findOneAndUpdate({ _id: d._id, applicant: req.user._id, application: null, ocrStatus: 'COMPLETED' }, { $set: changes }, { returnDocument: 'after' });
  if (!updated) fail(409, 'The application was submitted. Corrections are now locked.');
  res.json(exports.serialize(updated));
};
