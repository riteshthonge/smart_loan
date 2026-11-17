const { LoanApplication, Document, Notification } = require('../models');
const { fail } = require('../utils');
const { allowedTypes, documentReady, activeException } = require('../services/personalLoanRules');
exports.attach = async(req,res,app)=>{
  if(!['PENDING','UNDER_REVIEW'].includes(app.status))fail(409,'This application has a final decision.');
  if(req.files?.length||!req.body.documentId)fail(400,'Upload through OCR first, then select its document ID.');
  const d=await Document.findOne({_id:req.body.documentId,applicant:req.user._id,loanProduct:app.loanProduct._id,application:null,encryptedOriginal:true});
  if(!d||!allowedTypes(app.manualApplicationData?.employmentType||app.employmentDetails?.employmentType).includes(d.documentType))fail(400,'Eligible draft document not found.');
  const policy=await require('./personalLoan').policyFor(req.user._id);
  if(!documentReady(d)&&!activeException(policy,d.documentType))fail(400,'Complete OCR and applicant confirmation first.');
  if(await Document.exists({application:app._id,documentType:d.documentType}))fail(409,'This application already contains that document category.');
  // One slot per category for new Personal Loan applications, claimed atomically.
  const slot=await LoanApplication.findOneAndUpdate({_id:app._id,status:{$in:['PENDING','UNDER_REVIEW']},supplementalDocumentTypes:{$ne:d.documentType}},{$addToSet:{supplementalDocumentTypes:d.documentType},$inc:{documentRevision:1}},{returnDocument:'after'});
  if(!slot)fail(409,'Application changed. Refresh and retry.');
  const updated=await Document.findOneAndUpdate({_id:d._id,application:null,applicant:req.user._id,updatedAt:d.updatedAt},{$set:{application:app._id}},{returnDocument:'after'});
  if(!updated){await LoanApplication.updateOne({_id:app._id},{$pull:{supplementalDocumentTypes:d.documentType}});fail(409,'Document changed. Retry.');}
  const stillOpen=await LoanApplication.exists({_id:app._id,status:{$in:['PENDING','UNDER_REVIEW']}});
  if(!stillOpen){await Document.updateOne({_id:d._id,application:app._id},{$set:{application:null}});fail(409,'A final decision was recorded.');}
  await Notification.create({user:req.user._id,title:'Document added',message:`${d.documentType} was added to ${app.applicationId} for manual review.`});
  res.status(201).json(require('./documents').serialize(updated));
};
