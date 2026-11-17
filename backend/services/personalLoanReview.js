const { requiredTypes, activeException, documentReady } = require('./personalLoanRules');
const present = value => value !== '' && value !== null && value !== undefined;
const normalize = value => typeof value === 'number' ? value : String(value).normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
function comparison(manual, extracted) { if (!present(manual) || !present(extracted)) return 'NOT_AVAILABLE'; if (typeof manual === 'number' && Number.isFinite(Number(extracted))) return Math.abs(manual-Number(extracted)) < .01 ? 'MATCH' : 'MISMATCH'; return normalize(manual) === normalize(extracted) ? 'MATCH' : 'MISMATCH'; }
function review(application, documents, policy = {}) {
  const manual = application.manualApplicationData;
  const employment = manual?.employmentType || application.employmentDetails?.employmentType;
  const required = requiredTypes(employment,policy);
  const warnings = required.flatMap(type => {
    const d = documents.find(d=>d.documentType===type), exception = activeException(policy,type);
    if (documentReady(d)) return [];
    return [{ documentType:type, issue: !d ? 'MISSING_DOCUMENT' : d.ocrStatus !== 'COMPLETED' ? 'OCR_NOT_COMPLETED' : 'APPLICANT_CONFIRMATION_REQUIRED', manualReviewException: !!exception, exceptionReason: exception?.reason || '' }];
  });
  const rows = [];
  if (manual) for (const [key,label,type,field] of [['fullName','Name on Aadhaar','AADHAAR','name'],['dateOfBirth','Date of birth','AADHAAR','dateOfBirth'],['fullName','Employee name','SALARY_SLIP','employeeName'],['employerName','Employer / business name','SALARY_SLIP','employerName'],['monthlyGrossIncome','Monthly gross income','SALARY_SLIP','grossSalary'],['monthlyNetIncome','Monthly net income','SALARY_SLIP','netSalary'],['monthlyDeductions','Monthly deductions','SALARY_SLIP','deductions'],['fullName','ITR taxpayer name','ITR','taxpayerName']]) {
    const doc=documents.find(d=>d.documentType===type), original=doc?.extractedFields?.[field], corrected=doc?.correctedFields?.[field];
    rows.push({ field:key,label,documentType:type,manualValue:manual[key],extractedValue:original ?? null,correctedValue:corrected ?? null,status:comparison(manual[key],original),correctedStatus:comparison(manual[key],corrected) });
  }
  const itr=documents.find(d=>d.documentType==='ITR');
  return { requiredDocuments:required, missingDocumentWarnings:warnings, comparisons:rows, salaryNetSalary:documents.find(d=>d.documentType==='SALARY_SLIP')?.extractedFields?.netSalary ?? null, itrTotalIncome:itr?.extractedFields?.totalIncome ?? null, note:'Comparisons check consistency only. They do not establish document authenticity. Annual ITR income is not compared directly with monthly income.' };
}
module.exports = { review, comparison };
