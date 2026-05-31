import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null       // auth probe still in flight
  if (!user)  return <Navigate to="/" replace />
  return children
}
