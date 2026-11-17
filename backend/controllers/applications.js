const path = require('path');
const fs = require('fs/promises');
const { LoanApplication, LoanProduct, Document, Notification } = require('../models');
const { fail, number, text, personal, applicationId } = require('../utils');
const upload = require('../middleware/upload');
const documentTypes = ['SALARY_SLIP', 'IDENTITY', 'COLLATERAL', 'BUSINESS_PROOF', 'OTHER'];
const scoped = req => req.user.role === 'ADMIN' ? {} : { applicant: req.user._id };
const types = req => { let values; try { values = JSON.parse(req.body.documentTypes || '[]'); } catch { fail(400, 'Invalid document types.'); } if (!Array.isArray(values) || values.length !== (req.files || []).length || values.some(v => !documentTypes.includes(v))) fail(400, 'Choose a document type for each uploaded file.'); return values; };
const saveDocuments = async (req, app, values) => { const saved = []; try { for (let i = 0; i < (req.files || []).length; i++) saved.push(await upload.persist(req.files[i], app._id, req.user._id, values[i])); return saved; } catch (e) { for (const d of saved) { await fs.unlink(path.join(upload.directory, d.storagePath)).catch(() => {}); await Document.deleteOne({ _id: d._id }); } throw e; } };
const createLegacy = async (req, res) => { upload.validate(req.files); const dt = types(req); const product = await LoanProduct.findOne({ _id: req.body.loanProduct, isActive: true }); if (!product) fail(400, 'Choose an active loan product.'); const requestedAmount = number(req.body.requestedAmount, 'Requested amount', product.minAmount, product.maxAmount); const tenure = number(req.body.tenure, 'Tenure', product.minTenure, product.maxTenure); if (!Number.isInteger(tenure)) fail(400, 'Tenure must be a whole number of months.'); const required = ['SALARY_SLIP', 'IDENTITY']; if (['Gold Loan', 'Property Loan'].includes(product.name)) required.push('COLLATERAL'); if (product.name === 'Business Loan') required.push('BUSINESS_PROOF'); if (required.some(t => !dt.includes(t))) fail(400, `Required documents: ${required.join(', ')}.`); const employmentType = text(req.body.employmentType, 'Employment type', 50); if (!['SALARIED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'OTHER'].includes(employmentType)) fail(400, 'Invalid employment type.'); const app = await LoanApplication.create({ applicationId: applicationId(), applicant: req.user._id, loanProduct: product._id, requestedAmount, tenure, personalDetails: personal(req.body), employmentDetails: { employmentType, employerName: text(req.body.employerName, 'Employer / business', 150) }, monthlyIncome: number(req.body.monthlyIncome, 'Monthly income', 1), existingLiabilities: number(req.body.existingLiabilities, 'Existing liabilities'), interestRateSnapshot: product.interestRate }); try { await saveDocuments(req, app, dt); } catch (e) { await LoanApplication.deleteOne({ _id: app._id }); throw e; } await Notification.create({ user: req.user._id, title: 'Application submitted', message: `${app.applicationId} has been received and is awaiting review.` }); res.status(201).json(app); };
exports.list = async (req, res) => { const filter = scoped(req); if (req.query.status) filter.status = String(req.query.status); res.json(await LoanApplication.find(filter).populate('loanProduct applicant', 'name email').sort({ createdAt: -1 })); };
exports.details = async (req, res) => { const app = await LoanApplication.findOne({ _id: req.params.id, ...scoped(req) }).populate('loanProduct applicant', 'name email phone'); if (!app) fail(404, 'Application not found.'); const docs = await Document.find({ application: app._id }); res.json({ ...app.toObject(), documents: docs.map(require('./documents').serialize), ...(app.loanProduct?.name === 'Personal Loan' ? { personalLoanReview: require('../services/personalLoanReview').review(app, docs, await require('./personalLoan').policyFor(app.applicant._id)) } : {}) }); };
const attachLegacy = async (req, res) => { const app = await LoanApplication.findOne({ _id: req.params.id, applicant: req.user._id, status: { $in: ['PENDING', 'UNDER_REVIEW'] } }); if (!app) fail(404, 'Open application not found.'); if (!req.files?.length) fail(400, 'Select at least one document.'); upload.validate(req.files); const values = types(req); if (await Document.countDocuments({ application: app._id }) + req.files.length > 10) fail(400, 'An application can contain at most 10 documents.'); const docs = await saveDocuments(req, app, values); res.status(201).json(docs.map(d => { const o = d.toObject(); delete o.storagePath; return o; })); };

exports.create = async (req, res) => {
  const product = await LoanProduct.findOne({ _id: req.body.loanProduct, isActive: true });
  if (!product) fail(400, 'Choose an active loan product.');
  if (product.name === 'Personal Loan') return require('../services/personalSubmission').create(req, res, product);
  return createLegacy(req, res);
};
exports.attach = async (req, res) => {
  const app = await LoanApplication.findOne({ _id: req.params.id, applicant: req.user._id }).populate('loanProduct');
  if (!app) fail(404, 'Open application not found.');
  if (app.loanProduct?.name === 'Personal Loan') return require('./personalLoanAttachments').attach(req,res,app);
  return attachLegacy(req, res);
};
exports.download = async (req, res) => {
  const filter = { _id: req.params.id, ...scoped(req) };
  if (req.user.role === 'ADMIN') filter.application = { $ne: null };
  const d = await Document.findOne(filter);
  if (!d) fail(404, 'Document not found.');
  const app = d.application ? await LoanApplication.findById(d.application).populate('loanProduct') : null;
  if (d.encryptedOriginal || d.documentType === 'AADHAAR' || app?.loanProduct?.name === 'Personal Loan') {
    if (d.ocrStatus !== 'COMPLETED') fail(409, 'A privacy-safe review copy is unavailable. The original cannot be downloaded.');
    const buffer = await require('../services/reviewCopy')(d);
    res.type('application/pdf').attachment(d.documentType.toLowerCase() + '-masked-review.pdf').send(buffer);
    return;
  }
  if (!/^[a-f0-9-]{36}$/.test(d.storagePath)) fail(400, 'Invalid document path.');
  res.set('Content-Type', d.mimeType); res.set('Cache-Control', 'no-store');
  res.download(path.join(upload.directory, d.storagePath), d.originalFileName);
};
