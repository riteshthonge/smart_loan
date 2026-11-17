import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge } from '../common/UI'
export default function ApplicationTracker({ application }) {
  if (!application) return null
  const final = ['APPROVED', 'REJECTED'].includes(application.status)
  return <section className="panel recent-panel"><div className="panel-heading"><div><h2>Your latest application</h2><p>{application.applicationId} · {application.loanProduct?.name}</p></div><Badge status={application.status}/></div><div className="status-track">{['Submitted', 'Under review', 'Decision'].map((label, i) => <div key={label} className={i === 0 || i === 1 && application.status !== 'PENDING' || i === 2 && final ? 'complete' : ''}><span>{i + 1}</span><strong>{label}</strong></div>)}</div><div className="form-actions"><span className="field-hint">{final ? 'Your review is complete. Open your application for the decision details.' : 'Our team will notify you when your application moves forward.'}</span><Link className="text-link" to={`/applicant/history/${application._id}`}>View details <ArrowRight size={15}/></Link></div></section>
}
