import { useState, useEffect } from 'react'
import { getProfile, patchProfile } from '../api'
import './ProfilePage.css'

function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(false)
  const [gender,  setGender]  = useState('M')

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await getProfile()
      setProfile(res.data)
      setGender(res.data.profile?.gender || 'M')
    } catch {
      setError('Failed to load profile.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)
      const res = await patchProfile({ gender })
      setProfile(res.data)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const genderLabel = (g) => ({ M: 'Male', F: 'Female', O: 'Other' }[g] || g)

  if (loading) return <div className="loading">Loading profile...</div>

  return (
    <div className="profile-view">

      <div className="profile-header">
        <h1 className="profile-title">My Profile</h1>
        <p className="profile-subtitle">Manage your account settings</p>
      </div>

      {error   && <div className="error">{error}</div>}
      {success && <div className="success">Profile saved successfully.</div>}

      {/* Account Info */}
      <div className="card">
        <h2>Account Info</h2>
        <div className="profile-grid">

          <div className="profile-item">
            <span className="profile-label">Username</span>
            <span className="profile-value">{profile?.username}</span>
          </div>

          <div className="profile-item">
            <span className="profile-label">Role</span>
            <span className="profile-value">
              {profile?.is_staff
                ? <span className="navbar-badge">Admin</span>
                : 'User'}
            </span>
          </div>

          <div className="profile-item">
            <span className="profile-label">Required Hours / Day</span>
            <span className="profile-value">{profile?.required_hours}h</span>
          </div>

        </div>
      </div>

      {/* Gender Setting */}
      <div className="card">
        <h2>Personal Settings</h2>
        <p className="card-hint">
            Contact your administrator to update your gender setting.
        </p>
        <div className="profile-grid">
            <div className="profile-item">
            <span className="profile-label">Gender</span>
            <span className="profile-value">
                {{ M: '👨 Male', F: '👩 Female', O: '🧑 Other' }[gender] || '—'}
            </span>
            </div>
        </div>
      </div>

      {/* Holiday Info */}
      <div className="card">
        <h2>Your Holiday Settings</h2>
        <div className="profile-grid">
          <div className="profile-item">
            <span className="profile-label">Weekend Days</span>
            <span className="profile-value">Friday & Saturday</span>
          </div>
          <div className="profile-item">
            <span className="profile-label">Gender</span>
            <span className="profile-value">{genderLabel(gender)}</span>
          </div>
          <div className="profile-item">
            <span className="profile-label">Women-only Holidays</span>
            <span className="profile-value">
              {gender === 'F'
                ? <span className="text-over">✓ Included</span>
                : <span className="text-under">✗ Not applicable</span>}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}

export default ProfilePage