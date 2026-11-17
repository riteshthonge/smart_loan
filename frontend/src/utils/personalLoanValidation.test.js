import {test} from 'node:test'
import assert from 'node:assert/strict'
import {manualError} from './personalLoanValidation.js'
const product={minAmount:10000,maxAmount:1000000,minTenure:6,maxTenure:60}
const manual=()=>({fullName:'Fictional Applicant',dateOfBirth:'1995-01-01',employmentType:'SALARIED',employerName:'Demo Employer',designation:'Analyst',employmentDurationMonths:0,monthlyGrossIncome:65000,monthlyNetIncome:57000,monthlyDeductions:8000,existingMonthlyEmis:0,otherMonthlyLiabilities:0,additionalMonthlyIncome:'',creditScore:'',previousLoanDefaults:'NO',loanPurpose:'Education expenses',requestedAmount:100000,preferredTenureMonths:12})
test('manual form accepts explicit zero liabilities and optional empty values',()=>assert.equal(manualError(manual(),product),''))
test('manual form catches required missing values, credit score and inconsistent income',()=>{for(const change of [{designation:''},{previousLoanDefaults:''},{creditScore:299},{creditScore:901},{monthlyNetIncome:70000},{otherMonthlyLiabilities:-1},{preferredTenureMonths:1.5},{dateOfBirth:'2020-01-01'}])assert.ok(manualError({...manual(),...change},product))})
