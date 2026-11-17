/* oxlint-disable react/only-export-components -- This module intentionally bundles reusable UI and its hooks. */
import { createContext, useContext, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Inbox, LoaderCircle, X } from 'lucide-react'
import api, { errorMessage } from '../../services/api'
const ToastContext = createContext(null)
export function ToastProvider({ children }) { const [toast, setToast] = useState(null); useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 5500); return () => clearTimeout(t) } }, [toast]); return <ToastContext.Provider value={(message, type = 'success') => setToast({ message, type })}>{children}{toast && <div className={`toast ${toast.type}`} role="status">{toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={16} /></button></div>}</ToastContext.Provider> }
export const useToast = () => useContext(ToastContext)
export function useApi(url) {
  const [revision, setRevision] = useState(0), [state, setState] = useState({ url: null, revision: -1, data: null, error: '' })
  useEffect(() => { let active = true; api.get(url).then(r => { if (active) setState({ url, revision, data: r.data, error: '' }) }).catch(e => { if (active) setState({ url, revision, data: null, error: errorMessage(e) }) }); return () => { active = false } }, [url, revision])
  const current = state.url === url && state.revision === revision
  return { data: current ? state.data : null, error: current ? state.error : '', loading: !current, refresh: () => setRevision(v => v + 1) }
}
export function LoadState({ loading, error, retry }) { if (loading) return <div className="loading"><LoaderCircle className="spin" size={22} /> Loading your information…</div>; if (error) return <div className="error-box" role="alert"><AlertCircle size={20} />{error}{retry && <button className="btn secondary" onClick={retry}>Try again</button>}</div>; return null }
export function Empty({ title = 'Nothing here yet', children }) { return <div className="empty"><span><Inbox size={28} /></span><h3>{title}</h3><p>{children}</p></div> }
export function Badge({ status }) { return <span className={`badge ${status?.toLowerCase()}`}><i />{status?.replaceAll('_', ' ')}</span> }
export function Field({ label, children, ...props }) { return <label className="field"><span>{label}</span>{children || <input {...props} />}</label> }
export function Modal({ title, onClose, children }) { useEffect(() => { const h = e => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', h); const before = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', h); document.body.style.overflow = before } }, [onClose]); return <div className="modal-shade" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}><div className="panel-heading"><h2>{title}</h2><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X /></button></div>{children}</section></div> }
