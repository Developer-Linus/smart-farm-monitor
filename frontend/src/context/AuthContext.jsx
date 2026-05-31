import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// Single auth probe on app load. All components read from this context —
// no component ever calls /api/auth/me independently.
export function AuthProvider({ children }) {
  // undefined = still checking, null = unauthenticated, object = authenticated user
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setUser(data))
      .catch(() => setUser(null))
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
