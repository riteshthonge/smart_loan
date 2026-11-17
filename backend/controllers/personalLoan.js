const mongoose = require('mongoose');
const { User, LoanProduct, PersonalLoanDraft, PersonalLoanPolicy, Document, Notification } = require('../models');
const { fail, text } = require('../utils');
const { validateManual, types } = require('../services/personalLoanRules');
const { sanitize } = require('../services/documentPrivacy');
const serialize = require('./documents').serialize;
const productFor = async id => { const p=await LoanProduct.findOne({_id:id,name:'Personal Loan',isActive:true});if(!p)fail(400,'Choose an active Personal Loan product.');return p; };
exports.policyFor = async applicant => await PersonalLoanPolicy.findOne({applicant}).lean() || {itrRequired:false,exceptions:[]};
exports.policy = async (req,res) => res.json(await exports.policyFor(req.user._id));
exports.getDraft = async (req,res) => {
  const product=await productFor(req.query.loanProduct), draft=await PersonalLoanDraft.findOne({applicant:req.user._id,loanProduct:product._id});
  const documents=draft ? await Document.find({_id:{$in:draft.documentIds},applicant:req.user._id,application:null}) : [];
  res.json({manualApplicationData:draft?.manualApplicationData || null,documents:documents.map(serialize),savedAt:draft?.updatedAt || null,policy:await exports.policyFor(req.user._id)});
};
exports.saveDraft = async (req,res) => {
  const product=await productFor(req.body.loanProduct), manual=validateManual(req.body.manualApplicationData,product);
  const draft=await PersonalLoanDraft.findOneAndUpdate({applicant:req.user._id,loanProduct:product._id},{$set:{manualApplicationData:manual},$setOnInsert:{documentIds:[]}},{upsert:true,returnDocument:'after',runValidators:true});
  res.json({manualApplicationData:draft.manualApplicationData,savedAt:draft.updatedAt,policy:await exports.policyFor(req.user._id)});
};
exports.saveDocuments = async (req,res) => {
  const product=await productFor(req.body.loanProduct), ids=req.body.documentIds;
  if(!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!mongoose.isValidObjectId(id)))fail(400,'Invalid document selection.');
  const docs=await Document.find({_id:{$in:ids},applicant:req.user._id,loanProduct:product._id,application:null});
  if(docs.length!==ids.length||new Set(docs.map(d=>d.documentType)).size!==docs.length||docs.some(d=>!types.includes(d.documentType)))fail(400,'Select only your own draft documents, one per category.');
  const draft=await PersonalLoanDraft.findOneAndUpdate({applicant:req.user._id,loanProduct:product._id},{$set:{documentIds:ids}},{returnDocument:'after'});
  if(!draft)fail(400,'Save your information first.');res.json({savedAt:draft.updatedAt});
};
exports.adminPolicy = async (req,res) => { const user=await User.findOne({_id:req.params.id,role:'APPLICANT'});if(!user)fail(404,'Applicant not found.');res.json(await exports.policyFor(user._id)); };
exports.updatePolicy = async (req,res) => {
  const user=await User.findOne({_id:req.params.id,role:'APPLICANT'});if(!user)fail(404,'Applicant not found.');
  let policy=await PersonalLoanPolicy.findOne({applicant:user._id}) || new PersonalLoanPolicy({applicant:user._id});
  const reason=sanitize(text(req.body.reason,'Reason',2000)), now=new Date(); let event;
  if(typeof req.body.itrRequired==='boolean' && !req.body.exception) {
    policy.itrRequired=req.body.itrRequired;policy.itrRequestReason=reason;event={action:req.body.itrRequired?'REQUEST_ITR':'REMOVE_ITR_REQUEST',documentType:'ITR'};
  } else if(req.body.exception && types.includes(req.body.exception.documentType)&&typeof req.body.exception.enabled==='boolean'&&req.body.itrRequired===undefined) {
    const value={documentType:req.body.exception.documentType,enabled:req.body.exception.enabled,reason,grantedBy:req.user._id,grantedAt:now};
    const index=policy.exceptions.findIndex(e=>e.documentType===value.documentType);if(index<0)policy.exceptions.push(value);else policy.exceptions.set(index,value);
    event={action:value.enabled?'GRANT_MANUAL_REVIEW_EXCEPTION':'REVOKE_MANUAL_REVIEW_EXCEPTION',documentType:value.documentType};
  } else fail(400,'Choose an ITR requirement or a document exception.');
  policy.updatedBy=req.user._id;policy.auditTrail.push({...event,reason,actor:req.user._id,at:now});
  try{await policy.save();}catch(error){if(error.name==='VersionError'||error.code===11000)fail(409,'Policy changed. Reload and retry.');throw error;}
  await Notification.create({user:user._id,title:'Personal Loan document requirements updated',message:`${event.action.replaceAll('_',' ')}: ${reason}`});
  res.json(policy);
};
