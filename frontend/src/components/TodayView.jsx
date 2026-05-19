import { useState, useEffect } from 'react'
import { getToday, postAction, patchToday } from '../api'
import './TodayView.css'
import { todayBS, BS_MONTHS_EN } from '../utils/nepaliDate'

// ── Time Entry Row with inline edit ──────────────────────────────
function TimeEntryRow({ fieldKey, label, value, onSave }) {
  const [editing,  setEditing]  = useState(false)
  const [inputVal, setInputVal] = useState('')

  const formatTime = (timeStr) => {
    if (!timeStr) return '—'
    const [h, m] = timeStr.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const handleEdit = () => {
    setInputVal(value ? value.slice(0, 5) : '')
    setEditing(true)
  }

  const handleSave = async () => {
    await onSave(fieldKey, inputVal)
    setEditing(false)
  }

  const handleClear = async () => {
    await onSave(fieldKey, null)
    setEditing(false)
  }

  return (
    <div className="time-entry">
      <span className="time-label">{label}</span>
      {editing ? (
        <div className="time-edit-row">
          <input
            type="time"
            className="time-picker"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
          />
          <button className="btn btn-green btn-sm" onClick={handleSave}>✓</button>
          <button className="btn btn-gray btn-sm" onClick={handleClear}>✕ Clear</button>
          <button className="btn btn-gray btn-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div className="time-edit-row">
          <span className="time-value">{formatTime(value)}</span>
          <button className="btn btn-gray btn-sm" onClick={handleEdit}>✏️</button>
        </div>
      )}
    </div>
  )
}

// ── Main TodayView ────────────────────────────────────────────────
function TodayView() {
  const [log,           setLog]           = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [manualTimes,   setManualTimes]   = useState({
    sign_in: '', lunch_start: '', lunch_end: '', sign_out: ''
  })

  useEffect(() => { fetchToday() }, [])

  const fetchToday = async () => {
    try {
      setLoading(true)
      const res = await getToday()
      setLog(res.data)
    } catch {
      setError("Failed to load today's log.")
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action) => {
    try {
      setActionLoading(true)
      setError(null)
      const time = manualTimes[action] || null
      const res  = await postAction(action, time)
      setLog(res.data)
      setManualTimes(prev => ({ ...prev, [action]: '' }))
    } catch {
      setError('Failed to record action. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleTimeEdit = async (field, value) => {
    try {
      setError(null)
      const res = await patchToday({ [field]: value || null })
      setLog(res.data)
    } catch {
      setError('Failed to update time.')
    }
  }

  // ── Helpers ────────────────────────────────────────────────────
  const formatTime = (timeStr) => {
    if (!timeStr) return '—'
    const [h, m] = timeStr.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const formatMinutes = (mins) => {
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

  // ── Action button + time picker ────────────────────────────────
  const ActionRow = ({ action, label, btnClass }) => (
    <div className="action-item">
      <input
        type="time"
        className="time-picker"
        value={manualTimes[action]}
        onChange={e => setManualTimes(prev => ({ ...prev, [action]: e.target.value }))}
      />
      <button
        className={`btn ${btnClass} action-btn`}
        onClick={() => handleAction(action)}
        disabled={actionLoading}
      >
        {label}
      </button>
    </div>
  )

  const renderActions = () => {
    if (!log) return null
    const { status } = log

    if (status === 'not_started') return (
      <ActionRow action="sign_in"     label="✅ Sign In"     btnClass="btn-green"  />
    )
    if (status === 'working') return (
      <div className="action-row">
        <ActionRow action="lunch_start" label="🍽️ Start Lunch" btnClass="btn-orange" />
        <ActionRow action="sign_out"    label="🚪 Sign Out"    btnClass="btn-red"    />
      </div>
    )
    if (status === 'in_lunch') return (
      <ActionRow action="lunch_end" label="💼 End Lunch" btnClass="btn-blue" />
    )
    if (status === 'complete') return (
      <div className="complete-msg">🎉 Day complete! See your summary below.</div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────
  if (loading) return <div className="loading">Loading today's log...</div>

  if (error && !log) return (
    <div className="today-view">
      <div className="error">{error}</div>
      <p style={{ padding: '1rem', color: '#666' }}>Make sure the Django server is running.</p>
    </div>
  )

  return (
    <div className="today-view">

      {error && <div className="error">{error}</div>}

      {/* Header */}
      <div className="today-header">
        <div>
          <h1 className="today-title">Today</h1>
          <p className="today-date">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
          <p className="today-date-bs">
            {`${BS_MONTHS_EN[todayBS().month - 1]} ${todayBS().day}, ${todayBS().year} BS`}
          </p>
        </div>
        {log && (
          <span className={getBadgeClass(log.status)}>
            {getStatusLabel(log.status)}
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="card">
        <h2>Record Time</h2>
        <p className="card-hint">Set a time manually or leave blank to use current time.</p>
        <div className="actions-container">
          {renderActions()}
          {actionLoading && <p className="saving-text">Saving...</p>}
        </div>
      </div>

      {/* Time Entries */}
      <div className="card">
        <h2>Time Entries</h2>
        <div className="time-grid">
          {[
            { key: 'sign_in',     label: '🟢 Sign In'     },
            { key: 'lunch_start', label: '🍽️ Lunch Start' },
            { key: 'lunch_end',   label: '💼 Lunch End'   },
            { key: 'sign_out',    label: '🔴 Sign Out'    },
          ].map(({ key, label }) => (
            <TimeEntryRow
              key={key}
              fieldKey={key}
              label={label}
              value={log?.[key]}
              onSave={handleTimeEdit}
            />
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="card">
        <h2>Summary</h2>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Required Hours</span>
            <span className="summary-value">{log?.required_hours}h</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Worked</span>
            <span className="summary-value">{formatMinutes(log?.worked_minutes)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Lunch Taken</span>
            <span className="summary-value">{formatMinutes(log?.actual_lunch_minutes)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Lunch Allowance</span>
            <span className="summary-value">{log?.lunch_duration_minutes}m</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Lunch +/-</span>
            <span className={`summary-value ${getDiffClass(log?.lunch_difference_minutes)}`}>
              {log?.lunch_difference_formatted || '—'}
            </span>
          </div>
          <div className="summary-item highlight">
            <span className="summary-label">Over / Under</span>
            <span className={`summary-value large ${getDiffClass(log?.difference_minutes)}`}>
              {log?.difference_formatted || '—'}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}

export default TodayView