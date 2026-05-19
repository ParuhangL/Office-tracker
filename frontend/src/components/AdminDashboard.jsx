import { useState, useEffect } from 'react'
import {
  getAdminStats, getAdminUsers, createUser,
  patchUser, deleteUser, getUserLogs, exportCSV,
  getAdminHolidays, createHoliday, updateHoliday,
  deleteHoliday, fetchHolidaysFromAPI,
  getAdminCorrections, resolveCorrection, adminEditLog,
} from '../api'
import './AdminDashboard.css'

function AdminDashboard() {
  const [stats,        setStats]        = useState([])
  const [users,        setUsers]        = useState([])
  const [holidays,     setHolidays]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [activeTab,    setActiveTab]    = useState('overview')
  const [selectedUser, setSelectedUser] = useState(null)
  const [userLogs,     setUserLogs]     = useState([])
  const [logsLoading,  setLogsLoading]  = useState(false)

  // ── Holiday state ────────────────────────────────────────────────
  const currentYear = new Date().getFullYear()
  const [holidayYear,    setHolidayYear]    = useState(currentYear)
  const [fetchingAPI,    setFetchingAPI]    = useState(false)
  const [fetchResult,    setFetchResult]    = useState(null)
  const [showHolidayForm, setShowHolidayForm] = useState(false)
  const [holidayForm,    setHolidayForm]    = useState({
    date: '', name: '', women_only: false
  })
  const [holidayError,   setHolidayError]   = useState(null)
  const [editingHoliday, setEditingHoliday] = useState(null)

  // ── Create user form ─────────────────────────────────────────────
  const [showCreate,  setShowCreate]  = useState(false)
  const [newUser,     setNewUser]     = useState({
    username: '', password: '', required_hours: 8, is_staff: false, gender: 'M'
  })
  const [createError, setCreateError] = useState(null)
  const [creating,    setCreating]    = useState(false)

  // ── Edit required hours inline ───────────────────────────────────
  const [editingHours, setEditingHours] = useState({})

  // ── Corrections state ────────────────────────────────────────────
  const [corrections,      setCorrections]      = useState([])
  const [correctionFilter, setCorrectionFilter] = useState('pending')
  const [correctionsLoading, setCorrectionsLoading] = useState(false)

  // ── Edit log form ────────────────────────────────────────────────
  const [editLogForm,    setEditLogForm]    = useState(null) // { user_id, username, date, sign_in, lunch_start, lunch_end, sign_out }
  const [editLogError,   setEditLogError]   = useState(null)
  const [editLogSaving,  setEditLogSaving]  = useState(false)
  const [editLogSuccess, setEditLogSuccess] = useState(null)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => {
    if (activeTab === 'holidays') fetchHolidays()
  }, [activeTab, holidayYear])

  useEffect(() => {
    if (activeTab === 'corrections') fetchCorrections()
  }, [activeTab, correctionFilter])

  const fetchAll = async () => {
    try {
      setLoading(true)
      const [statsRes, usersRes] = await Promise.all([getAdminStats(), getAdminUsers()])
      setStats(statsRes.data)
      setUsers(usersRes.data)
    } catch {
      setError('Failed to load admin data.')
    } finally {
      setLoading(false)
    }
  }

  const fetchHolidays = async () => {
    try {
      const res = await getAdminHolidays(holidayYear)
      setHolidays(res.data)
    } catch {
      setError('Failed to load holidays.')
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────
  const fmt = (mins) => {
    if (mins === null || mins === undefined) return '—'
    const h = Math.floor(Math.abs(mins) / 60)
    const m = Math.floor(Math.abs(mins) % 60)
    return `${h}h ${String(m).padStart(2, '0')}m`
  }

  const getDiffClass = (mins) => {
    if (mins === null || mins === undefined) return ''
    if (mins > 0) return 'text-over'
    if (mins < 0) return 'text-under'
    return 'text-exact'
  }

  const getBadgeClass = (status) => {
    const map = {
      not_started: 'badge-not-started',
      working:     'badge-working',
      in_lunch:    'badge-in-lunch',
      complete:    'badge-complete',
    }
    return `badge ${map[status] || 'badge-not-started'}`
  }

  const getStatusLabel = (status) => {
    const map = {
      not_started: 'Not Started',
      working:     'Working',
      in_lunch:    'In Lunch',
      complete:    'Complete',
    }
    return map[status] || status
  }

  const formatDate = (dateStr) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })

  const formatTime = (timeStr) => {
    if (!timeStr) return '—'
    const [h, m] = timeStr.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  }

  // ── Create user ──────────────────────────────────────────────────
  const handleCreateUser = async () => {
    setCreateError(null)
    setCreating(true)
    try {
      await createUser(newUser)
      setNewUser({ username: '', password: '', required_hours: 8, is_staff: false, gender: 'M' })
      setShowCreate(false)
      fetchAll()
    } catch (err) {
      setCreateError(err.response?.data?.username?.[0] || 'Failed to create user.')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (user) => {
    await patchUser(user.id, { is_active_profile: !user.is_active_profile })
    fetchAll()
  }

  const handleSaveHours = async (userId) => {
    const val = editingHours[userId]
    if (!val) return
    await patchUser(userId, { required_hours: val })
    setEditingHours(prev => { const n = { ...prev }; delete n[userId]; return n })
    fetchAll()
  }

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete user "${user.username}"? This removes all their logs too.`)) return
    await deleteUser(user.id)
    fetchAll()
  }

  const handleViewLogs = async (user) => {
    setSelectedUser(user)
    setActiveTab('logs')
    setLogsLoading(true)
    try {
      const res = await getUserLogs(user.id)
      setUserLogs(res.data)
    } catch {
      setUserLogs([])
    } finally {
      setLogsLoading(false)
    }
  }

  const handleExport = async (userId = null) => {
    const res = await exportCSV(userId)
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a   = document.createElement('a')
    a.href    = url
    a.download = userId ? `user_${userId}_logs.csv` : 'all_logs.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // ── Holiday handlers ─────────────────────────────────────────────
  const handleFetchFromAPI = async () => {
    setFetchingAPI(true)
    setFetchResult(null)
    setHolidayError(null)
    try {
      const res = await fetchHolidaysFromAPI(holidayYear)
      setFetchResult(res.data)
      fetchHolidays()
    } catch (err) {
      setHolidayError(err.response?.data?.error || 'Failed to fetch holidays from API.')
    } finally {
      setFetchingAPI(false)
    }
  }

  const handleAddHoliday = async () => {
    setHolidayError(null)
    if (!holidayForm.date || !holidayForm.name) {
      setHolidayError('Date and name are required.')
      return
    }
    try {
      await createHoliday(holidayForm)
      setShowHolidayForm(false)
      setHolidayForm({ date: '', name: '', women_only: false })
      fetchHolidays()
    } catch (err) {
      setHolidayError(err.response?.data?.non_field_errors?.[0] || 'Failed to add holiday.')
    }
  }

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Delete this holiday?')) return
    await deleteHoliday(id)
    fetchHolidays()
  }

  const handleSaveHolidayEdit = async (id) => {
    await updateHoliday(id, editingHoliday)
    setEditingHoliday(null)
    fetchHolidays()
  }

  // ── Corrections ──────────────────────────────────────────────────
  const fetchCorrections = async () => {
    setCorrectionsLoading(true)
    try {
      const res = await getAdminCorrections(correctionFilter)
      setCorrections(res.data)
    } catch {
      setError('Failed to load corrections.')
    } finally {
      setCorrectionsLoading(false)
    }
  }

  const handleResolve = async (id, action, adminNote = '') => {
    try {
      await resolveCorrection(id, { action, admin_note: adminNote })
      fetchCorrections()
    } catch {
      setError('Failed to update correction.')
    }
  }

  const handleEditLogSubmit = async () => {
    setEditLogError(null)
    setEditLogSaving(true)
    try {
      const res = await adminEditLog(editLogForm)
      setEditLogSuccess(
        `${editLogForm.username}'s log for ${editLogForm.date} updated successfully.`
      )
      setEditLogForm(null)
      setTimeout(() => setEditLogSuccess(null), 4000)
    } catch (err) {
      setEditLogError(err.response?.data?.error || 'Failed to update log.')
    } finally {
      setEditLogSaving(false)
    }
  }

  const openEditLog = (correction) => {
    setEditLogForm({
      user_id:     correction.user_id || null,
      username:    correction.username,
      date:        correction.date,
      sign_in:     '',
      lunch_start: '',
      lunch_end:   '',
      sign_out:    '',
    })
    setEditLogError(null)
  }

  // ── Totals ───────────────────────────────────────────────────────
  const totalDays      = stats.reduce((s, u) => s + u.total_logs, 0)
  const totalCompleted = stats.reduce((s, u) => s + u.completed_days, 0)
  const totalOvertime  = stats.reduce((s, u) => s + u.overtime_days, 0)
  const totalUndertime = stats.reduce((s, u) => s + u.undertime_days, 0)

  if (loading) return <div className="loading">Loading admin data...</div>

  return (
    <div className="admin-view">

      {/* Header */}
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Admin Dashboard</h1>
          <p className="admin-subtitle">Manage users and oversee all office hours</p>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-gray" onClick={fetchAll}>🔄 Refresh</button>
          <button className="btn btn-green" onClick={() => handleExport()}>⬇️ Export All CSV</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview'  ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >📊 Overview</button>
        <button
          className={`tab-btn ${activeTab === 'users'     ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('users')}
        >👥 Users</button>
        <button
          className={`tab-btn ${activeTab === 'holidays'  ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('holidays')}
        >🗓️ Holidays</button>
        <button
          className={`tab-btn ${activeTab === 'corrections' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('corrections')}
        >
          ✏️ Corrections
          {corrections.length > 0 && correctionFilter === 'pending' && (
            <span className="tab-badge">{corrections.length}</span>
          )}
        </button>
        {activeTab === 'logs' && selectedUser && (
          <button className="tab-btn tab-active">
            📋 {selectedUser.username}'s Logs
          </button>
        
        )}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          <div className="stat-cards">
            <div className="stat-card">
              <span className="stat-card-label">Total Days Logged</span>
              <span className="stat-card-value">{totalDays}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Completed Days</span>
              <span className="stat-card-value">{totalCompleted}</span>
            </div>
            <div className="stat-card stat-card-green">
              <span className="stat-card-label">Overtime Days</span>
              <span className="stat-card-value">{totalOvertime}</span>
            </div>
            <div className="stat-card stat-card-red">
              <span className="stat-card-label">Undertime Days</span>
              <span className="stat-card-value">{totalUndertime}</span>
            </div>
          </div>

          <div className="card">
            <h2>Per-User Summary</h2>
            <div className="table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Gender</th>
                    <th>Required Hrs</th>
                    <th>Total Logs</th>
                    <th>Completed</th>
                    <th>Overtime</th>
                    <th>Undertime</th>
                    <th>Avg Diff</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((u) => (
                    <tr key={u.user_id}>
                      <td><strong>{u.username}</strong></td>
                      <td>{{ M: 'Male', F: 'Female', O: 'Other' }[u.gender] || '—'}</td>
                      <td>{u.required_hours}h</td>
                      <td>{u.total_logs}</td>
                      <td>{u.completed_days}</td>
                      <td className="text-over">{u.overtime_days}</td>
                      <td className="text-under">{u.undertime_days}</td>
                      <td className={getDiffClass(u.avg_difference)}>{u.avg_diff_fmt}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-blue btn-sm"
                            onClick={() => handleViewLogs({ id: u.user_id, username: u.username })}
                          >Logs</button>
                          <button
                            className="btn btn-gray btn-sm"
                            onClick={() => handleExport(u.user_id)}
                          >CSV</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── USERS TAB ────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="card-header-row">
            <h2>All Users</h2>
            <button
              className="btn btn-green btn-sm"
              onClick={() => setShowCreate(!showCreate)}
            >
              {showCreate ? '✕ Cancel' : '＋ New User'}
            </button>
          </div>

          {showCreate && (
            <div className="create-form">
              {createError && <div className="login-error">{createError}</div>}
              <div className="create-form-grid">
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    className="form-input"
                    value={newUser.username}
                    onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
                    placeholder="john_doe"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    className="form-input"
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                    placeholder="Min 4 characters"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Required Hours</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.5"
                    value={newUser.required_hours}
                    onChange={e => setNewUser(p => ({ ...p, required_hours: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-input"
                    value={newUser.gender}
                    onChange={e => setNewUser(p => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
                </div>
                <div className="form-group form-group-check">
                  <label className="form-label">
                    <input
                      type="checkbox"
                      checked={newUser.is_staff}
                      onChange={e => setNewUser(p => ({ ...p, is_staff: e.target.checked }))}
                    />
                    {' '}Admin user
                  </label>
                </div>
              </div>
              <button
                className="btn btn-green"
                onClick={handleCreateUser}
                disabled={creating || !newUser.username || !newUser.password}
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          )}

          <div className="table-wrap">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Gender</th>
                  <th>Required Hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td>
                      {u.is_staff
                        ? <span className="navbar-badge">Admin</span>
                        : <span style={{ color: 'var(--text-muted)' }}>User</span>}
                    </td>
                    <td>{{ M: 'Male', F: 'Female', O: 'Other' }[u.gender] || '—'}</td>
                    <td>
                      {editingHours[u.id] !== undefined ? (
                        <div className="inline-edit">
                          <input
                            className="form-input inline-input"
                            type="number"
                            step="0.5"
                            value={editingHours[u.id]}
                            onChange={e =>
                              setEditingHours(p => ({ ...p, [u.id]: e.target.value }))
                            }
                          />
                          <button
                            className="btn btn-green btn-sm"
                            onClick={() => handleSaveHours(u.id)}
                          >✓</button>
                          <button
                            className="btn btn-gray btn-sm"
                            onClick={() =>
                              setEditingHours(p => { const n = { ...p }; delete n[u.id]; return n })
                            }
                          >✕</button>
                        </div>
                      ) : (
                        <span
                          className="editable-hours"
                          onClick={() =>
                            setEditingHours(p => ({ ...p, [u.id]: u.required_hours }))
                          }
                        >
                          {u.required_hours}h ✏️
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={u.is_active_profile ? 'text-over' : 'text-under'}>
                        {u.is_active_profile ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-blue btn-sm"
                          onClick={() => handleViewLogs(u)}
                        >Logs</button>
                        <button
                          className={`btn btn-sm ${u.is_active_profile ? 'btn-orange' : 'btn-green'}`}
                          onClick={() => handleToggleActive(u)}
                        >
                          {u.is_active_profile ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-red btn-sm"
                          onClick={() => handleDeleteUser(u)}
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── HOLIDAYS TAB ─────────────────────────────────────────── */}
      {activeTab === 'holidays' && (
        <div className="card">
          <div className="card-header-row">
            <h2>Public Holidays</h2>
            <div className="table-actions">
              {/* Year picker */}
              <div className="inline-edit">
                <button
                  className="btn btn-gray btn-sm"
                  onClick={() => setHolidayYear(y => y - 1)}
                >←</button>
                <span style={{ fontWeight: 700, minWidth: 50, textAlign: 'center' }}>
                  {holidayYear}
                </span>
                <button
                  className="btn btn-gray btn-sm"
                  onClick={() => setHolidayYear(y => y + 1)}
                >→</button>
              </div>
              <button
                className="btn btn-blue btn-sm"
                onClick={handleFetchFromAPI}
                disabled={fetchingAPI}
              >
                {fetchingAPI ? 'Fetching...' : '🌐 Fetch from API'}
              </button>
              <button
                className="btn btn-green btn-sm"
                onClick={() => setShowHolidayForm(!showHolidayForm)}
              >
                {showHolidayForm ? '✕ Cancel' : '＋ Add Manual'}
              </button>
            </div>
          </div>

          {/* Fetch result message */}
          {fetchResult && (
            <div className="success-msg">
              ✓ Fetched {fetchResult.year}: {fetchResult.created} added,{' '}
              {fetchResult.skipped} skipped (manual holidays protected).
            </div>
          )}

          {holidayError && <div className="error">{holidayError}</div>}

          {/* Manual holiday form */}
          {showHolidayForm && (
            <div className="create-form">
              <div className="create-form-grid" style={{ gridTemplateColumns: '1fr 2fr auto' }}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={holidayForm.date}
                    onChange={e => setHolidayForm(p => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Holiday Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Company Foundation Day"
                    value={holidayForm.name}
                    onChange={e => setHolidayForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="form-group form-group-check">
                  <label className="form-label">
                    <input
                      type="checkbox"
                      checked={holidayForm.women_only}
                      onChange={e => setHolidayForm(p => ({ ...p, women_only: e.target.checked }))}
                    />
                    {' '}Women only
                  </label>
                </div>
              </div>
              <button className="btn btn-green" onClick={handleAddHoliday}>
                Add Holiday
              </button>
            </div>
          )}

          {/* Holidays table */}
          {holidays.length === 0 ? (
            <div className="empty-state">
              No holidays for {holidayYear}. Click "Fetch from API" to load them.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Holiday</th>
                    <th>Women Only</th>
                    <th>Source</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h.id}>
                      {editingHoliday?.id === h.id ? (
                        <>
                          <td>
                            <input
                              type="date"
                              className="form-input inline-input"
                              style={{ width: 140 }}
                              value={editingHoliday.date}
                              onChange={e =>
                                setEditingHoliday(p => ({ ...p, date: e.target.value }))
                              }
                            />
                          </td>
                          <td>—</td>
                          <td>
                            <input
                              type="text"
                              className="form-input"
                              value={editingHoliday.name}
                              onChange={e =>
                                setEditingHoliday(p => ({ ...p, name: e.target.value }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={editingHoliday.women_only}
                              onChange={e =>
                                setEditingHoliday(p => ({ ...p, women_only: e.target.checked }))
                              }
                            />
                          </td>
                          <td>{h.source}</td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="btn btn-green btn-sm"
                                onClick={() => handleSaveHolidayEdit(h.id)}
                              >✓ Save</button>
                              <button
                                className="btn btn-gray btn-sm"
                                onClick={() => setEditingHoliday(null)}
                              >✕</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="td-date">
                            {new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric',
                            })}
                          </td>
                          <td>
                            {new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'short'
                            })}
                          </td>
                          <td>{h.name}</td>
                          <td>{h.women_only ? '👩 Yes' : '—'}</td>
                          <td>
                            <span className={h.is_manual ? 'badge badge-working' : 'badge badge-not-started'}>
                              {h.is_manual ? 'Manual' : 'API'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="btn btn-blue btn-sm"
                                onClick={() => setEditingHoliday({ ...h })}
                              >✏️ Edit</button>
                              <button
                                className="btn btn-red btn-sm"
                                onClick={() => handleDeleteHoliday(h.id)}
                              >Delete</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CORRECTIONS TAB ──────────────────────────────────────── */}
      {activeTab === 'corrections' && (
        <div className="card">
          <div className="card-header-row">
            <h2>Correction Requests</h2>
            <div className="table-actions">
              {['pending', 'resolved', 'rejected', 'all'].map(f => (
                <button
                  key={f}
                  className={`btn btn-sm ${correctionFilter === f ? 'btn-blue' : 'btn-gray'}`}
                  onClick={() => setCorrectionFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {editLogSuccess && (
            <div className="success-msg">{editLogSuccess}</div>
          )}

          {/* Edit log form */}
          {editLogForm && (
            <div className="create-form">
              <h3 style={{ marginBottom: '1rem' }}>
                Editing log for <strong>{editLogForm.username}</strong> on{' '}
                <strong>{editLogForm.date}</strong>
              </h3>
              {editLogError && <div className="error">{editLogError}</div>}
              <div className="create-form-grid">
                {[
                  { key: 'sign_in',     label: 'Sign In'     },
                  { key: 'lunch_start', label: 'Lunch Start' },
                  { key: 'lunch_end',   label: 'Lunch End'   },
                  { key: 'sign_out',    label: 'Sign Out'    },
                ].map(({ key, label }) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <input
                      type="time"
                      className="form-input"
                      value={editLogForm[key]}
                      onChange={e =>
                        setEditLogForm(p => ({ ...p, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="table-actions" style={{ marginTop: '1rem' }}>
                <button
                  className="btn btn-green"
                  onClick={handleEditLogSubmit}
                  disabled={editLogSaving}
                >
                  {editLogSaving ? 'Saving...' : '✓ Save Log'}
                </button>
                <button
                  className="btn btn-gray"
                  onClick={() => setEditLogForm(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {correctionsLoading ? (
            <div className="loading">Loading corrections...</div>
          ) : corrections.length === 0 ? (
            <p className="empty-state">
              No {correctionFilter === 'all' ? '' : correctionFilter} correction requests.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Date</th>
                    <th>Note</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {corrections.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.username}</strong></td>
                      <td className="td-date">{formatDate(c.date)}</td>
                      <td className="correction-note-cell">{c.note}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {new Date(c.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <span className={
                          c.status === 'pending'  ? 'badge badge-in-lunch' :
                          c.status === 'resolved' ? 'badge badge-complete' :
                          'badge badge-not-started'
                        }>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {c.status === 'pending' && (
                          <div className="table-actions">
                            <button
                              className="btn btn-green btn-sm"
                              onClick={() => openEditLog(c)}
                            >
                              ✏️ Edit Log
                            </button>
                            <button
                              className="btn btn-blue btn-sm"
                              onClick={() => handleResolve(c.id, 'resolve', 'Resolved by admin.')}
                            >
                              ✓ Resolve
                            </button>
                            <button
                              className="btn btn-red btn-sm"
                              onClick={() => handleResolve(c.id, 'reject', 'Rejected by admin.')}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        )}
                        {c.status !== 'pending' && c.admin_note && (
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {c.admin_note}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* ── LOGS TAB ─────────────────────────────────────────────── */}
      {activeTab === 'logs' && selectedUser && (
        <div className="card">
          <div className="card-header-row">
            <h2>{selectedUser.username}'s Logs</h2>
            <div className="table-actions">
              <button
                className="btn btn-gray btn-sm"
                onClick={() => handleExport(selectedUser.id)}
              >⬇️ CSV</button>
              <button
                className="btn btn-gray btn-sm"
                onClick={() => setActiveTab('overview')}
              >← Back</button>
            </div>
          </div>

          {logsLoading ? (
            <div className="loading">Loading logs...</div>
          ) : userLogs.length === 0 ? (
            <p className="empty-state">No logs found for this user.</p>
          ) : (
            <div className="table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sign In</th>
                    <th>Lunch</th>
                    <th>Sign Out</th>
                    <th>Worked</th>
                    <th>Lunch +/-</th>
                    <th>Over / Under</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {userLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="td-date">{formatDate(log.date)}</td>
                      <td>{formatTime(log.sign_in)}</td>
                      <td>
                        {log.lunch_start && log.lunch_end
                          ? `${formatTime(log.lunch_start)} – ${formatTime(log.lunch_end)}`
                          : '—'}
                      </td>
                      <td>{formatTime(log.sign_out)}</td>
                      <td>{fmt(log.worked_minutes)}</td>
                      <td className={getDiffClass(log.lunch_difference_minutes)}>
                        {log.lunch_difference_formatted || '—'}
                      </td>
                      <td className={getDiffClass(log.difference_minutes)}>
                        {log.difference_formatted || '—'}
                      </td>
                      <td>
                        <span className={getBadgeClass(log.status)}>
                          {getStatusLabel(log.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

export default AdminDashboard