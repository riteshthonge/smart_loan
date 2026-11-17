export const personalDocumentTypes = [['AADHAAR','Aadhaar card'],['SALARY_SLIP','Latest month salary slip'],['ITR','Upload ITR Document']]
export const requiredDocumentTypes = (employmentType='SALARIED',policy={}) => employmentType==='SELF_EMPLOYED' ? ['AADHAAR','ITR'] : ['AADHAAR','SALARY_SLIP',...(policy.itrRequired?['ITR']:[])]
export const eligibleDocumentTypes = employmentType => employmentType==='SELF_EMPLOYED'?['AADHAAR','ITR']:['AADHAAR','SALARY_SLIP','ITR']
export const hasException = (policy,type) => policy?.exceptions?.some(e=>e.documentType===type&&e.enabled&&e.reason&&e.grantedBy)
export const documentAccepted = (d,type,policy={}) => hasException(policy,type) || d?.ocrStatus==='COMPLETED' && d?.uiStatus==='ready' && (!d.confirmationRequired||d.applicantConfirmed) && (type!=='AADHAAR'||!d.addressConfirmationRequired||d.addressConfirmed)
export const ocrReady = (documents,employmentType='SALARIED',policy={}) => !eligibleDocumentTypes(employmentType).some(type=>['uploading','processing'].includes(documents[type]?.uiStatus)) && requiredDocumentTypes(employmentType,policy).every(type=>documentAccepted(documents[type],type,policy))
export const selectedDocumentIds = (documents,employmentType,policy={}) => eligibleDocumentTypes(employmentType).filter(type=>documents[type]?._id&&documentAccepted(documents[type],type,policy)).map(type=>documents[type]._id)
