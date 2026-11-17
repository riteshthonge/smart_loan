/* oxlint-disable react/only-export-components -- The auth context intentionally exports its consuming hook. */
import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [loggingOut, setLoggingOut] = useState(false)
  useEffect(() => { api.get('/auth/me').then(r => setUser(r.data.user)).catch(() => setUser(null)).finally(() => setLoading(false)) }, [])
  const authenticate = async (kind, data) => { const r = await api.post(`/auth/${kind}`, data); setUser(r.data.user); return r.data.user }
  const logout = async () => {
    setLoggingOut(true)
    try { await api.post('/auth/logout'); setUser(null) }
    finally { setLoggingOut(false) }
  }
  return <AuthContext.Provider value={{ user, setUser, loading, loggingOut, authenticate, logout }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
