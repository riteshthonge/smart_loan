import { useState } from 'react'
import PersonalLoanDocuments from './PersonalLoanDocuments'
import api,{errorMessage} from '../../services/api'
import { documentAccepted } from '../../utils/documentRequirements'
import { useApi,LoadState,useToast } from '../common/UI'
export default function PersonalLoanSupplement({application,onChanged}) {
  const result=useApi('/applicant/personal-loan/policy'),[documents,setDocuments]=useState({}),[busy,setBusy]=useState(false),toast=useToast()
  const missing=application.personalLoanReview?.missingDocumentWarnings.filter(w=>w.issue==='MISSING_DOCUMENT').map(w=>w.documentType)||[]
  if(!missing.length||!['PENDING','UNDER_REVIEW'].includes(application.status))return null
  async function attach(type){setBusy(true);try{let d=documents[type];if(d.ocrStatus==='COMPLETED'){const fields={...d.editedFields};delete fields.maskedAadhaarNumber;delete fields.repoId;delete fields.addressExtractionStatus;d=(await api.patch('/documents/'+d._id+'/fields',{fields,applicantConfirmed:d.applicantConfirmed,addressConfirmed:d.addressConfirmed})).data}await api.post('/applications/'+application._id+'/documents',{documentId:d._id});toast('Document added for manual review.');onChanged()}catch(e){toast(errorMessage(e),'error')}finally{setBusy(false)}}
  return <section className="panel"><div className="panel-heading"><h2>Requested documents</h2></div><div className="form-body"><LoadState {...result} retry={result.refresh}/>{result.data&&<><PersonalLoanDocuments loanProduct={application.loanProduct._id} employmentType={application.manualApplicationData?.employmentType||application.employmentDetails?.employmentType} policy={result.data} visibleTypes={missing} documents={documents} onChange={(type,value)=>setDocuments(p=>({...p,[type]:value}))}/>{missing.map(type=><button key={type} className="btn primary" disabled={busy||!documents[type]?._id||!documentAccepted(documents[type],type,result.data)} onClick={()=>attach(type)}>Attach {type} to this application</button>)}</>}</div></section>
}
