const mongoose = require('mongoose');
const { Document, LoanApplication, Notification, PersonalLoanDraft } = require('../models');
const { fail, applicationId } = require('../utils');
const { validateManual, requiredTypes, allowedTypes, activeException, documentReady } = require('./personalLoanRules');
function recentMonths(now = new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  const year=Number(parts.year),month=Number(parts.month);
  return [`${year}-${String(month).padStart(2,'0')}`,`${month===1?year-1:year}-${String(month===1?12:month-1).padStart(2,'0')}`];
}
exports.recentMonths=recentMonths;
exports.create=async(req,res,product)=>{
  if(req.files?.length||req.body.documentTypes)fail(400,'Upload documents through OCR before submitting.');
  const manual=validateManual(req.body.manualApplicationData,product);
  const policy=await require('../controllers/personalLoan').policyFor(req.user._id);
  const required=requiredTypes(manual.employmentType,policy), allowed=allowedTypes(manual.employmentType);
  let ids=req.body.documentIds;
  if(!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!mongoose.isValidObjectId(id)))fail(400,'Select valid, unique document IDs.');
  const docs=await Document.find({_id:{$in:ids},applicant:req.user._id,loanProduct:product._id,encryptedOriginal:true});
  if(docs.length!==ids.length||new Set(docs.map(d=>d.documentType)).size!==docs.length||docs.some(d=>!allowed.includes(d.documentType)))fail(400,'Select only your own eligible documents, one per category.');
  if(docs.some(d=>d.application))fail(409,'Documents were already submitted. Upload new copies.');
  const exceptions=[];
  for(const type of new Set([...required,...docs.map(d=>d.documentType)])) {
    const doc=docs.find(d=>d.documentType===type), exception=activeException(policy,type);
    if(!documentReady(doc)) {
      if(!exception)fail(400,`${type} must be uploaded, complete OCR and be confirmed, or have an admin manual-review exception.`);
      exceptions.push({documentType:type,reason:exception.reason,grantedBy:exception.grantedBy,grantedAt:exception.grantedAt});
    }
    if(type==='SALARY_SLIP'&&doc?.ocrStatus==='COMPLETED'&&!exception) {
      const fields={...doc.extractedFields,...doc.correctedFields};
      if(!recentMonths().includes(fields.salaryMonth))fail(400,'Confirm a salary month from the current or previous calendar month, or ask the admin for a manual-review exception.');
    }
  }
  // These compatibility fields derive ONLY from manual data, never OCR output.
  const app=new LoanApplication({applicationId:applicationId(),applicant:req.user._id,loanProduct:product._id,manualApplicationData:manual,
    requestedAmount:manual.requestedAmount,tenure:manual.preferredTenureMonths,personalDetails:{fullName:manual.fullName,dateOfBirth:manual.dateOfBirth},employmentDetails:{employmentType:manual.employmentType,employerName:manual.employerName},
    monthlyIncome:manual.monthlyNetIncome,existingLiabilities:manual.existingMonthlyEmis+manual.otherMonthlyLiabilities,interestRateSnapshot:product.interestRate,documentRequirementsVersion:4,
    documentPolicySnapshot:{itrRequired:!!policy.itrRequired,requiredDocuments:required,policyUpdatedAt:policy.updatedAt||null},manualReviewExceptions:exceptions});
  const claimed=[];
  try {
    for(const d of docs) {
      const updated=await Document.findOneAndUpdate({_id:d._id,applicant:req.user._id,application:null,updatedAt:d.updatedAt},{$set:{application:app._id}},{returnDocument:'after'});
      if(!updated)fail(409,'Documents changed or were submitted. Refresh and retry.');claimed.push(d._id);
    }
    const latest=await require('../controllers/personalLoan').policyFor(req.user._id);
    if(String(latest.updatedAt||'')!==String(policy.updatedAt||''))fail(409,'Admin document requirements changed. Refresh and review them.');
    await app.save();
  }catch(error){await Document.updateMany({_id:{$in:claimed},application:app._id},{$set:{application:null}});throw error;}
  await PersonalLoanDraft.deleteOne({applicant:req.user._id,loanProduct:product._id});
  await Notification.create({user:req.user._id,title:'Application submitted',message:`${app.applicationId} was received for manual review. OCR does not verify authenticity.`});
  res.status(201).json(app);
};
