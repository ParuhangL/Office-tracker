import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import TodayView from './components/TodayView'
import History from './components/History'
import AdminDashboard from './components/AdminDashboard'
import MonthlySummary from './components/MonthlySummary'
import ProfilePage from './components/ProfilePage'
import LoginPage from './components/LoginPage'
import './App.css'

function App() {
  const [auth,     setAuth]     = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token    = localStorage.getItem('token')
    const username = localStorage.getItem('username')
    const is_staff = localStorage.getItem('is_staff') === 'true'
    if (token) setAuth({ token, username, is_staff })
    setChecking(false)
  }, [])

  const handleLogin = (data) => {
    localStorage.setItem('token',    data.token)
    localStorage.setItem('username', data.username)
    localStorage.setItem('is_staff', data.is_staff)
    setAuth({ token: data.token, username: data.username, is_staff: data.is_staff })
  }

  const handleLogout = () => {
    localStorage.clear()
    setAuth(null)
  }

  if (checking) return null
  if (!auth)    return <LoginPage onLogin={handleLogin} />

  return (
    <BrowserRouter>
      <div className="app">
        <Navbar auth={auth} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/"         element={<Navigate to="/today" replace />} />
            <Route path="/today"    element={<TodayView />} />
            <Route path="/history"  element={<History />} />
            <Route path="/monthly"  element={<MonthlySummary />} />
            <Route path="/profile"  element={<ProfilePage />} />
            {auth.is_staff && (
              <Route path="/admin"  element={<AdminDashboard />} />
            )}
            <Route path="*"         element={<Navigate to="/today" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App