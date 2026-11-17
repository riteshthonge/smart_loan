import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
export default function ProtectedRoute({ role }) { const { user, loading } = useAuth(); if (loading) return <div className="screen-loader">Connecting to SmartLoan…</div>; if (!user) return <Navigate to="/login" replace />; if (user.role !== role) return <Navigate to={`/${user.role.toLowerCase()}/dashboard`} replace />; return <Outlet /> }
