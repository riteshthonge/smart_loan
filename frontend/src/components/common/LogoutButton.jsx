import { LoaderCircle, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { errorMessage } from '../../services/api'
import { useToast } from './UI'

export default function LogoutButton({ compact = false }) {
  const { logout, loggingOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  async function handleLogout() {
    try {
      await logout()
      navigate('/login', { replace: true })
      toast('You have been logged out.')
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  return <button type="button" className={compact ? 'header-logout btn secondary' : 'logout'} onClick={handleLogout} disabled={loggingOut} aria-label={loggingOut ? 'Logging out' : 'Log out'} aria-busy={loggingOut} title="Log out">
    {loggingOut ? <LoaderCircle size={17} className="spin" /> : <LogOut size={17} />}
    <span>{loggingOut ? 'Logging out…' : 'Log out'}</span>
  </button>
}
