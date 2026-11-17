const { fail, text, number } = require('../utils');
const { sanitize } = require('./documentPrivacy');
const types = ['AADHAAR', 'SALARY_SLIP', 'ITR'];
function requiredTypes(employmentType, policy = {}) { return employmentType === 'SELF_EMPLOYED' ? ['AADHAAR', 'ITR'] : ['AADHAAR', 'SALARY_SLIP', ...(policy.itrRequired ? ['ITR'] : [])]; }
function allowedTypes(employmentType) { return employmentType === 'SELF_EMPLOYED' ? ['AADHAAR', 'ITR'] : types; }
function activeException(policy, type) { return policy?.exceptions?.find(e => e.documentType === type && e.enabled && e.reason && e.grantedBy); }
function documentReady(document) { return document?.ocrStatus === 'COMPLETED' && (document.documentType !== 'AADHAAR' || !document.addressConfirmationRequired || document.addressConfirmed) && (!document.confirmationRequired || document.applicantConfirmed); }
function validateManual(input, product) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Provide manualApplicationData.');
  const numeric=(value,label,min,max)=>{if(!['string','number'].includes(typeof value)||typeof value==='string'&&!value.trim())fail(400,`${label} is required as a number.`);return number(value,label,min,max);};
  const m = {}, integer = (value, label, min, max) => { const n = numeric(value, label, min, max); if (!Number.isInteger(n)) fail(400, `${label} must be a whole number.`); return n; };
  for (const [key, label, max] of [['fullName','Full name',100],['employerName','Employer / business name',150],['designation','Designation / occupation',150],['loanPurpose','Loan purpose',1000]]) m[key] = text(input[key],label,max);
  if (typeof input.dateOfBirth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth)) fail(400,'Enter a valid date of birth.');
  const dob = new Date(input.dateOfBirth), age = (Date.now() - dob.getTime()) / 31557600000;
  if (!Number.isFinite(age) || dob.toISOString().slice(0,10) !== input.dateOfBirth || age < 18 || age > 110) fail(400,'Applicant must be 18 or older with a valid date of birth.');
  m.dateOfBirth = input.dateOfBirth;
  if (!['SALARIED','SELF_EMPLOYED'].includes(input.employmentType)) fail(400,'Choose Salaried or Self-employed.');
  m.employmentType = input.employmentType;
  m.employmentDurationMonths = integer(input.employmentDurationMonths,'Employment / business duration',0,1320);
  for (const [key,label] of [['monthlyGrossIncome','Monthly gross income'],['monthlyNetIncome','Monthly net income'],['monthlyDeductions','Monthly deductions'],['existingMonthlyEmis','Existing monthly EMIs'],['otherMonthlyLiabilities','Other monthly liabilities']]) m[key] = numeric(input[key],label,0,1e10);
  if (m.monthlyNetIncome > m.monthlyGrossIncome || m.monthlyDeductions > m.monthlyGrossIncome) fail(400,'Net income and deductions cannot exceed gross income.');
  m.additionalMonthlyIncome = input.additionalMonthlyIncome === '' || input.additionalMonthlyIncome == null ? null : numeric(input.additionalMonthlyIncome,'Additional monthly income',0,1e10);
  m.creditScore = input.creditScore === '' || input.creditScore == null ? null : integer(input.creditScore,'Credit score',300,900);
  if (!['YES','NO'].includes(input.previousLoanDefaults)) fail(400,'Select Yes or No for previous loan defaults.');
  m.previousLoanDefaults = input.previousLoanDefaults;
  m.requestedAmount = numeric(input.requestedAmount,'Requested loan amount',product.minAmount,product.maxAmount);
  m.preferredTenureMonths = integer(input.preferredTenureMonths,'Preferred tenure',product.minTenure,product.maxTenure);
  return sanitize(m);
}
module.exports = { types, requiredTypes, allowedTypes, activeException, documentReady, validateManual };
