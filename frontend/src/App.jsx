
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/common/UI'
import ProtectedRoute from './routes/ProtectedRoute'
import Layout from './components/layout/Layout'
import AuthPage from './pages/auth/AuthPage'
const DashboardPage = lazy(() => import('./pages/Dashboard'))
function Dashboard() { return <Suspense fallback={<div className="loading">Loading dashboard…</div>}><DashboardPage /></Suspense> }
import Applications from './pages/Applications'
import ApplicationDetail from './pages/ApplicationDetail'
import Apply from './pages/applicant/Apply'
import InterestRates from './pages/applicant/InterestRates'
import Profile from './pages/applicant/Profile'
import Notifications from './pages/applicant/Notifications'
import Applicants from './pages/admin/Applicants'
import Products from './pages/admin/Products'
function Home() { const { user, loading } = useAuth(); return loading ? <div className="screen-loader">Opening your workspace…</div> : <Navigate to={user ? `/${user.role.toLowerCase()}/dashboard` : '/login'} replace/> }
export default function App() { return <BrowserRouter><AuthProvider><ToastProvider><Routes><Route path="/login" element={<AuthPage/>}/><Route path="/register" element={<AuthPage register/>}/><Route element={<ProtectedRoute role="APPLICANT"/>}><Route path="/applicant" element={<Layout/>}><Route index element={<Navigate to="dashboard" replace/>}/><Route path="dashboard" element={<Dashboard/>}/><Route path="apply" element={<Apply/>}/><Route path="history" element={<Applications/>}/><Route path="history/:id" element={<ApplicationDetail/>}/><Route path="interest-rates" element={<InterestRates/>}/><Route path="profile" element={<Profile/>}/><Route path="notifications" element={<Notifications/>}/></Route></Route><Route element={<ProtectedRoute role="ADMIN"/>}><Route path="/admin" element={<Layout/>}><Route index element={<Navigate to="dashboard" replace/>}/><Route path="dashboard" element={<Dashboard/>}/><Route path="applications" element={<Applications/>}/><Route path="applications/:id" element={<ApplicationDetail/>}/><Route path="applicants" element={<Applicants/>}/><Route path="loan-products" element={<Products/>}/></Route></Route><Route path="*" element={<Home/>}/></Routes></ToastProvider></AuthProvider></BrowserRouter> }
