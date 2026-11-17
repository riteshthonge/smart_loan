import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api,{errorMessage} from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { LoadState,useApi,useToast } from '../../components/common/UI'
import PersonalLoanInformation,{initialManual} from '../../components/applications/PersonalLoanInformation'
import PersonalLoanDocuments from '../../components/applications/PersonalLoanDocuments'
import { eligibleDocumentTypes, requiredDocumentTypes, selectedDocumentIds, ocrReady } from '../../utils/documentRequirements'
import { manualError } from '../../utils/personalLoanValidation'
const clientDoc=d=>({...d,uiStatus:d.ocrStatus==='COMPLETED'?'ready':d.ocrStatus==='FAILED'?'failed':'processing',error:d.ocrError,editedFields:{...d.extractedFields,...d.correctedFields}})
export default function PersonalLoanApplication({product,onChangeProduct}) {
  const result=useApi('/applicant/personal-loan/draft?loanProduct='+product._id)
  if(result.loading||result.error)return <LoadState {...result} retry={result.refresh}/>
  return <PersonalForm product={product} initial={result.data} onChangeProduct={onChangeProduct}/>
}
function PersonalForm({product,initial,onChangeProduct}) {
  const {user}=useAuth(),toast=useToast(),navigate=useNavigate()
  const [manual,setManual]=useState(()=>initial.manualApplicationData||initialManual(user)),[documents,setDocuments]=useState(()=>Object.fromEntries(initial.documents.map(d=>[d.documentType,clientDoc(d)]))),[policy,setPolicy]=useState(initial.policy),[step,setStep]=useState(0),[busy,setBusy]=useState(false),[saved,setSaved]=useState(!!initial.savedAt),[draftError,setDraftError]=useState(''),[consent,setConsent]=useState(false)
  const documentKey=Object.values(documents).map(d=>d?._id).filter(Boolean).sort().join('|')
  useEffect(()=>{
    if(!saved)return
    const controller=new AbortController()
    const timer=setTimeout(()=>{api.patch('/applicant/personal-loan/draft/documents',{loanProduct:product._id,documentIds:documentKey?documentKey.split('|'):[]},{signal:controller.signal}).then(()=>setDraftError('')).catch(e=>{if(!controller.signal.aborted)setDraftError(errorMessage(e))})},350)
    return()=>{clearTimeout(timer);controller.abort()}
  },[documentKey,product._id,saved])
  const ready=ocrReady(documents,manual.employmentType,policy)
  async function next(event) {
    event.preventDefault();setBusy(true)
    try {
      if(step===0){const error=manualError(manual,product);if(error){toast(error,'error');return}const r=await api.put('/applicant/personal-loan/draft',{loanProduct:product._id,manualApplicationData:manual});setManual(r.data.manualApplicationData);setPolicy(r.data.policy);setSaved(true);setStep(1);return}
      if(!ready){toast('Complete and confirm the required documents, or request an admin manual-review exception.','error');return}
      if(step===1){
        const updated={...documents}
        for(const type of eligibleDocumentTypes(manual.employmentType)){
          const d=documents[type];if(d?.ocrStatus!=='COMPLETED'||d.confirmationRequired&&!d.applicantConfirmed)continue
          const fields={...d.editedFields};delete fields.maskedAadhaarNumber;delete fields.repoId;delete fields.addressExtractionStatus
          const r=await api.patch('/documents/'+d._id+'/fields',{fields,addressConfirmed:d.addressConfirmed,applicantConfirmed:d.applicantConfirmed});updated[type]=clientDoc(r.data)
        }
        setDocuments(updated);setStep(2);return
      }
      const r=await api.post('/applications',{loanProduct:product._id,manualApplicationData:manual,documentIds:selectedDocumentIds(documents,manual.employmentType,policy)})
      toast('Application '+r.data.applicationId+' submitted for manual review.');navigate('/applicant/history/'+r.data._id)
    }catch(error){toast(errorMessage(error),'error')}
    finally{setBusy(false)}
  }
  return <><div className="page-title"><div><span className="eyebrow">PERSONAL LOAN</span><h1>Your next step, in your words.</h1><p>Manual information stays separate from OCR. {saved?'Your draft is saved in your account.':''}</p></div><button type="button" className="btn secondary" onClick={onChangeProduct}>Change loan product</button></div><div className="stepper personal-stepper">{['Your Information','Upload Documents','Review & Submit'].map((label,i)=><div key={label} className={step===i?'active':step>i?'done':''}><span>{i+1}</span><strong>{label}</strong></div>)}</div>{draftError&&<p className="error-box" role="alert">Document selection could not be saved: {draftError}</p>}<form className="panel" onSubmit={next}><div className="form-body">{step===0&&<PersonalLoanInformation value={manual} onChange={setManual} product={product}/>}{step===1&&<><div className="panel-heading"><div><h2>{manual.employmentType==='SALARIED'?'Salaried applicant documents':'Self-employed applicant documents'}</h2><p>Required: {requiredDocumentTypes(manual.employmentType,policy).join(', ')}. Other categories are optional or not applicable.</p></div><button type="button" className="btn secondary" onClick={async()=>{try{const r=await api.get('/applicant/personal-loan/policy');setPolicy(r.data);toast('Requirements refreshed.')}catch(e){toast(errorMessage(e),'error')}}}>Refresh requirements</button></div><PersonalLoanDocuments loanProduct={product._id} employmentType={manual.employmentType} policy={policy} documents={documents} onChange={(type,value)=>setDocuments(previous=>({...previous,[type]:value}))}/></>}{step===2&&<><h2 className="subheading">Your manually entered information</h2><dl className="detail-grid">{Object.entries(manual).filter(([key])=>key!=='_id').map(([key,value])=><div key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{value===null||value===''?'Not provided':String(value)}</dd></div>)}</dl><h2 className="subheading">Documents included</h2>{eligibleDocumentTypes(manual.employmentType).filter(type=>selectedDocumentIds(documents,manual.employmentType,policy).includes(documents[type]?._id)).map(type=><p key={type} className="file-review">{type}: {documents[type].originalFileName} Â· {documents[type].ocrStatus} Â· NOT_VERIFIED</p>)}{policy.exceptions?.filter(e=>e.enabled).map(e=><div className="info-strip" key={e.documentType}>Admin manual-review exception for {e.documentType}: {e.reason}</div>)}<p className="field-hint">OCR corrections are stored separately and do not replace this manual information. Optional documents that failed OCR or were not confirmed are excluded.</p><label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>I reviewed my manual information and submitted documents. I understand that OCR does not establish authenticity.</span></label></>}</div><div className="form-actions"><button type="button" className="btn secondary" disabled={busy||step===0} onClick={()=>setStep(step-1)}><ArrowLeft size={16}/>Back</button><button className="btn primary" disabled={busy||step>0&&!ready||step===2&&!consent}>{busy?'Savingâ€¦':step===0?'Save & Continue':step===1?'Review application':'Submit application'}<ArrowRight size={16}/></button></div></form></>
}
