export function manualError(m,product) {
  if(['fullName','employerName','designation','loanPurpose'].some(k=>typeof m[k]!=='string'||!m[k].trim()))return 'Complete all required personal, employment and purpose fields.'
  if(!['fullName','dateOfBirth','employmentType','employerName','designation','employmentDurationMonths','monthlyGrossIncome','monthlyNetIncome','monthlyDeductions','existingMonthlyEmis','otherMonthlyLiabilities','previousLoanDefaults','loanPurpose','requestedAmount','preferredTenureMonths'].every(k=>m[k]!==''&&m[k]!==null&&m[k]!==undefined))return 'Complete every required field. Zero is allowed for EMIs and liabilities.'
  if(!['SALARIED','SELF_EMPLOYED'].includes(m.employmentType))return 'Choose Salaried or Self-employed.'
  if(!['YES','NO'].includes(m.previousLoanDefaults))return 'Select Yes or No for previous defaults.'
  const dob=new Date(m.dateOfBirth),age=(Date.now()-dob.getTime())/31557600000
  if(!Number.isFinite(age)||age<18||age>110||dob.toISOString().slice(0,10)!==m.dateOfBirth)return 'Enter a valid date of birth for an adult applicant.'
  for(const k of ['monthlyGrossIncome','monthlyNetIncome','monthlyDeductions','existingMonthlyEmis','otherMonthlyLiabilities','additionalMonthlyIncome'])if(m[k]!==''&&m[k]!=null&&(!Number.isFinite(Number(m[k]))||Number(m[k])<0||Number(m[k])>1e10))return 'Financial amounts must be non-negative numbers.'
  if(Number(m.monthlyNetIncome)>Number(m.monthlyGrossIncome)||Number(m.monthlyDeductions)>Number(m.monthlyGrossIncome))return 'Net income and deductions cannot exceed gross income.'
  if(!Number.isInteger(Number(m.employmentDurationMonths))||Number(m.employmentDurationMonths)<0||Number(m.employmentDurationMonths)>1320)return 'Enter a whole number of months for employment duration.'
  if(m.creditScore!==''&&m.creditScore!=null&&(!Number.isInteger(Number(m.creditScore))||Number(m.creditScore)<300||Number(m.creditScore)>900))return 'Credit score must be 300–900 if provided.'
  if(!Number.isFinite(Number(m.requestedAmount))||Number(m.requestedAmount)<product.minAmount||Number(m.requestedAmount)>product.maxAmount)return 'Choose an amount within the product limits.'
  if(!Number.isInteger(Number(m.preferredTenureMonths))||Number(m.preferredTenureMonths)<product.minTenure||Number(m.preferredTenureMonths)>product.maxTenure)return 'Choose a whole-month tenure within the product limits.'
  return ''
}
