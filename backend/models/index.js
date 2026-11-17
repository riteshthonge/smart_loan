const mongoose = require("mongoose");
const { Schema } = mongoose;
const ref = (model) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required: true,
});
const model = (name, fields, options = {}) =>
  mongoose.model(name, new Schema(fields, { timestamps: true, ...options }));
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["ADMIN", "APPLICANT"], default: "APPLICANT" },
    phone: String,
    address: String,
    dateOfBirth: Date,
  },
  { timestamps: true },
);
userSchema.index(
  { role: 1 },
  { unique: true, partialFilterExpression: { role: "ADMIN" } },
);
exports.User = mongoose.model("User", userSchema);
exports.LoanProduct = model("LoanProduct", {
  name: {
    type: String,
    unique: true,
    enum: ["Personal Loan", "Gold Loan", "Property Loan", "Business Loan"],
    required: true,
  },
  interestRate: Number,
  minAmount: Number,
  maxAmount: Number,
  minTenure: Number,
  maxTenure: Number,
  processingFee: Number,
  eligibility: String,
  isActive: { type: Boolean, default: true },
});

const manualApplicationSchema = new Schema({
  fullName:String, dateOfBirth:String, employmentType:{type:String,enum:['SALARIED','SELF_EMPLOYED']}, employerName:String, designation:String, employmentDurationMonths:Number,
  monthlyGrossIncome:Number, monthlyNetIncome:Number, monthlyDeductions:Number, existingMonthlyEmis:Number, otherMonthlyLiabilities:Number, additionalMonthlyIncome:{type:Number,default:null}, creditScore:{type:Number,default:null}, previousLoanDefaults:{type:String,enum:['YES','NO']}, loanPurpose:String, requestedAmount:Number, preferredTenureMonths:Number
}, {_id:false});
const draftSchema = new Schema({ applicant:ref('User'), loanProduct:ref('LoanProduct'), manualApplicationData:manualApplicationSchema, documentIds:[{type:Schema.Types.ObjectId,ref:'Document'}] },{timestamps:true});
draftSchema.index({applicant:1,loanProduct:1},{unique:true});
exports.PersonalLoanDraft = mongoose.model('PersonalLoanDraft',draftSchema);
const policySchema = new Schema({applicant:{...ref('User'),unique:true},itrRequired:{type:Boolean,default:false},itrRequestReason:String,updatedBy:{type:Schema.Types.ObjectId,ref:'User'},exceptions:[{documentType:{type:String,enum:['AADHAAR','SALARY_SLIP','ITR']},enabled:Boolean,reason:String,grantedBy:{type:Schema.Types.ObjectId,ref:'User'},grantedAt:Date}],auditTrail:[{action:String,documentType:String,reason:String,actor:{type:Schema.Types.ObjectId,ref:'User'},at:Date}]},{timestamps:true,optimisticConcurrency:true});
exports.PersonalLoanPolicy = mongoose.model('PersonalLoanPolicy',policySchema);

exports.LoanApplication = model("LoanApplication", {
  applicationId: { type: String, unique: true },
  applicant: ref("User"),
  loanProduct: ref("LoanProduct"),
  requestedAmount: Number,
  tenure: Number,
  manualApplicationData: manualApplicationSchema,
  documentPolicySnapshot: Schema.Types.Mixed,
  manualReviewExceptions: [Schema.Types.Mixed],
  documentRevision: {type:Number,default:0},
  supplementalDocumentTypes: [String],
  personalDetails: {
    fullName: String,
    dateOfBirth: Date,
    phone: String,
    address: String,
    postalCode: String,
    addressLanguage: String,
  },
  employmentDetails: { employmentType: String, employerName: String },
  monthlyIncome: Number,
  existingLiabilities: Number,
  status: {
    type: String,
    enum: ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"],
    default: "PENDING",
  },
  rejectionReason: String,
  approvedAmount: Number,
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewedAt: Date,
  interestRateSnapshot: Number,
  documentRequirementsVersion: { type: Number, default: 1 },
});
const documentSchema = new Schema({
  application: { type: Schema.Types.ObjectId, ref: 'LoanApplication', default: null, alias: 'applicationId' },
  applicant: { ...ref('User'), alias: 'applicantId' },
  documentType: { type: String, enum: ['AADHAAR', 'SALARY_SLIP', 'ITR', 'IDENTITY', 'COLLATERAL', 'BUSINESS_PROOF', 'OTHER'], required: true },
  originalFileName: String,
  storagePath: String,
  mimeType: String,
  fileSize: Number,
  loanProduct: { type: Schema.Types.ObjectId, ref: 'LoanProduct' },
  encryptedOriginal: { type: Boolean, default: false },
  sourceFiles: [{ side: String, originalFileName: String, storagePath: String, mimeType: String, fileSize: Number }],
  processingStatus: { type: String, enum: ['PENDING', 'OCR_COMPLETED'], default: 'PENDING' },
  addressSource: String,
  addressDebug: Schema.Types.Mixed,
  addressConfirmed: { type: Boolean, default: false },
  addressConfirmationRequired: { type: Boolean, default: false },
  ocrStatus: { type: String, enum: ['NOT_REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'NOT_REQUESTED' },
  extractedText: { type: String, default: '' },
  extractedFields: { type: Schema.Types.Mixed, default: {} },
  correctedFields: { type: Schema.Types.Mixed, default: {} },
  applicantConfirmed: {type:Boolean,default:false},
  confirmationRequired: {type:Boolean,default:false},
  ocrError: String,
  ocrErrorCode: String,
  ocrErrorStage: String,
  verificationStatus: { type: String, enum: ['NOT_VERIFIED'], default: 'NOT_VERIFIED' },
  uploadedAt: { type: Date, default: Date.now },
  repoIdReprocessedAt: Date,
}, { timestamps: true });
documentSchema.pre('validate', function () {
  const { sanitize, maskAadhaar } = require('../services/documentPrivacy');
  this.extractedText = maskAadhaar(this.extractedText);
  this.extractedFields = sanitize(this.extractedFields);
  if (this.documentType === 'AADHAAR') this.extractedFields = { ...this.extractedFields, repoId: require('../services/repositoryId').normalizeRepoId(this.extractedFields?.repoId) };
  this.correctedFields = sanitize(this.correctedFields);
  this.originalFileName = maskAadhaar(this.originalFileName);
  for (const file of this.sourceFiles || []) file.originalFileName = maskAadhaar(file.originalFileName);
});
exports.Document = mongoose.model('Document', documentSchema);
exports.Notification = model("Notification", {
  user: ref("User"),
  title: String,
  message: String,
  isRead: { type: Boolean, default: false },
});
exports.Loan = model("Loan", {
  applicant: ref("User"),
  application: { ...ref("LoanApplication"), unique: true },
  sanctionedAmount: Number,
  interestRate: Number,
  tenure: Number,
  outstandingBalance: Number,
  disbursementStatus: {
    type: String,
    enum: ["PENDING", "DISBURSED"],
    default: "PENDING",
  },
});
exports.EMIPayment = model("EMIPayment", {
  loan: ref("Loan"),
  dueDate: Date,
  amount: Number,
  principalComponent: Number,
  interestComponent: Number,
  paymentStatus: {
    type: String,
    enum: ["PENDING", "PAID", "OVERDUE"],
    default: "PENDING",
  },
  paidAt: Date,
});
