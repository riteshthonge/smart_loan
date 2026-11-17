const fs = require('fs/promises');
const path = require('path');
const { Document } = require('../models');
const { fail } = require('../utils');
const { decrypt, sanitize } = require('../services/documentPrivacy');
const ocr = require('../services/ocr');
exports.reprocess = async (req,res) => {
  const filter={_id:req.params.id,documentType:'AADHAAR'};
  if(req.user.role==='ADMIN') filter.application={$ne:null}; else filter.applicant=req.user._id;
  const document=await Document.findOne(filter);
  if(!document)fail(404,'Aadhaar document not found.');
  if(document.ocrStatus==='PROCESSING')fail(409,'Wait for the current OCR operation to finish.');
  const sources=document.sourceFiles?.length?document.sourceFiles:[{storagePath:document.storagePath,mimeType:document.mimeType,side:'combined'}];
  const files=[];
  try {
    for(const source of sources){
      if(!/^[a-f0-9-]{36}$/.test(source.storagePath))fail(400,'Invalid document storage reference.');
      const bytes=await fs.readFile(path.join(require('../middleware/upload').directory,source.storagePath));
      files.push({buffer:document.encryptedOriginal?decrypt(bytes):bytes,mimeType:source.mimeType,side:source.side||'combined'});
    }
  }catch(error){if(error.status)throw error;fail(409,'Stored original is unavailable or cannot be decrypted. No OCR fields were changed.');}
  let result;
  try { result=await ocr.extract(files[0].buffer,files[0].mimeType,'AADHAAR',{side:files[0].side,additionalFiles:files.slice(1)}); }
  catch(error){const detail=error.ocrDiagnostic||require('../services/ocrErrors').diagnostic(error);console.error('[Aadhaar reprocess failed]',JSON.stringify(detail));fail(error.status||422,detail.message);}
  const update={$set:{'extractedFields.repoId':require('../services/repositoryId').normalizeRepoId(result.extractedFields.repoId),repoIdReprocessedAt:new Date()}};
  if(document.ocrStatus!=='COMPLETED'){
    update.$set={...update.$set,extractedFields:sanitize(result.extractedFields),extractedText:result.extractedText,ocrStatus:'COMPLETED',processingStatus:'OCR_COMPLETED',addressSource:result.addressSource,addressDebug:result.addressDebug,addressConfirmed:false,applicantConfirmed:false};
    delete update.$set['extractedFields.repoId'];
    update.$unset={ocrError:'',ocrErrorCode:'',ocrErrorStage:''};
  }
  const updated=await Document.findOneAndUpdate({...filter,updatedAt:document.updatedAt,ocrStatus:document.ocrStatus},update,{returnDocument:'after',runValidators:true});
  if(!updated)fail(409,'Document changed during reprocessing. Reload and retry.');
  res.json(require('./documents').serialize(updated));
};
