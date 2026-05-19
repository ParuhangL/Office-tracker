import { useState } from 'react'
import { signup } from '../api'
import './LoginPage.css'

function SignupPage({ onLogin, onBackToLogin }) {
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [error,     setError]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [gender, setGender] = useState('M')

  const handleSubmit = async () => {
    setError(null)

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.')
      return
    }
    if (password !== password2) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }

    setLoading(true)
    try {
      const res = await signup({ username, password, gender })
      onLogin(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.')
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
          <p className="login-subtitle">Create a new account</p>
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
              placeholder="Choose a username"
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
              placeholder="Min 4 characters"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              className="form-input"
              type="password"
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              placeholder="Repeat your password"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Gender</label>
            <select
                className="form-input"
                value={gender}
                onChange={e => setGender(e.target.value)}
            >
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
            </select>
           </div>

          <button
            className="btn btn-green login-btn"
            onClick={handleSubmit}
            disabled={loading || !username || !password || !password2}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <button
            className="btn btn-gray login-btn"
            onClick={onBackToLogin}
            disabled={loading}
          >
            ← Back to Sign In
          </button>
        </div>

        <p className="login-footer">
          Already have an account? Sign in above.
        </p>

      </div>
    </div>
  )
}

export default SignupPage