import { useState } from 'react'
import { login } from '../api'
import SignupPage from './SignupPage'
import './LoginPage.css'

function LoginPage({ onLogin }) {
  const [showSignup, setShowSignup] = useState(false)
  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState(null)
  const [loading,    setLoading]    = useState(false)

  if (showSignup) {
    return (
      <SignupPage
        onLogin={onLogin}
        onBackToLogin={() => setShowSignup(false)}
      />
    )
  }

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await login({ username, password })
      onLogin(res.data)
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-header">
          <div className="login-logo">🕐</div>
          <h1 className="login-title">Office Tracker</h1>
          <p className="login-subtitle">Sign in to your account</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="login-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <button
            className="btn btn-green login-btn"
            onClick={handleSubmit}
            disabled={loading || !username || !password}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <p className="login-footer">
          Don't have an account?{' '}
          <span
            className="signup-link"
            onClick={() => setShowSignup(true)}
          >
            Create one
          </span>
        </p>

      </div>
    </div>
  )
}

export default LoginPage