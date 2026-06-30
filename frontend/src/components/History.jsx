import { useState, useEffect } from 'react'
import { formatBSDate, todayBS, BS_MONTHS_EN } from '../utils/nepaliDate'
import './History.css'
import { getAllLogs, deleteLog, createCorrection, getMonthlyStats, addBackdatedLog } from '../api'

function History() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [lang,    setLang]    = useState('en')
  const [correcting,     setCorrecting]     = useState(null) // log id
  const [correctionNote, setCorrectionNote] = useState('')
  const [correctionSent, setCorrectionSent] = useState({})  // { logId: true }

  // ── Missing days (backdated entry) ──────────────────────────────
  const [missingDays,    setMissingDays]    = useState([])
  const [addingFor,      setAddingFor]      = useState(null)   // date string, e.g. '2026-06-15'
  const [backdatedForm,  setBackdatedForm]  = useState({ sign_in: '', lunch_start: '', lunch_end: '', sign_out: '', note: '' })
  const [backdatedError, setBackdatedError] = useState(null)
  const [backdatedSaving, setBackdatedSaving] = useState(false)

  useEffect(() => {
    fetchLogs()
    fetchMissingDays()
  }, [])

  const fetchLogs = async (retries = 2) => {
    try {
      setLoading(true)
      const res = await getAllLogs()
      setLogs(res.data)
    } catch {
      if (retries > 0) {
        setTimeout(() => fetchLogs(retries - 1), 1000)
      } else {
        setError('Failed to load logs. Please refresh.')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchMissingDays = async () => {
    try {
      const { year, month } = todayBS()
      const res = await getMonthlyStats(year, month)
      const todayStr = new Date().toISOString().slice(0, 10)
      const missing = res.data.daily.filter(
        d => d.status === 'no_log' && d.date < todayStr
      )
      setMissingDays(missing)
    } catch {
      // Non-critical — if this fails, history still loads normally
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this log?')) return
    try {
      await deleteLog(id)
      setLogs(prev => prev.filter(l => l.id !== id))
    } catch {
      setError('Failed to delete log. Please try again.')
    }
  }

  const handleCorrectionSubmit = async (log) => {
    if (!correctionNote.trim()) return
    try {
      await createCorrection({
        date: log.date,
        note: correctionNote,
      })
      setCorrecting(null)
      setCorrectionNote('')
      setCorrectionSent(prev => ({ ...prev, [log.id]: true }))
    } catch {
      setError('Failed to send correction request.')
    }
  }

  // ── Backdated entry handlers ─────────────────────────────────────
  const openBackdatedForm = (date) => {
    setAddingFor(date)
    setBackdatedForm({ sign_in: '', lunch_start: '', lunch_end: '', sign_out: '', note: '' })
    setBackdatedError(null)
  }

  const closeBackdatedForm = () => {
    setAddingFor(null)
    setBackdatedError(null)
  }

  const handleBackdatedSubmit = async (date) => {
    setBackdatedError(null)
    setBackdatedSaving(true)
    const payload = { date }
    if (backdatedForm.sign_in)     payload.sign_in     = backdatedForm.sign_in
    if (backdatedForm.lunch_start) payload.lunch_start = backdatedForm.lunch_start
    if (backdatedForm.lunch_end)   payload.lunch_end   = backdatedForm.lunch_end
    if (backdatedForm.sign_out)    payload.sign_out    = backdatedForm.sign_out
    if (backdatedForm.note.trim()) payload.note        = backdatedForm.note.trim()

    try {
      await addBackdatedLog(payload)
      setAddingFor(null)
      setMissingDays(prev => prev.filter(d => d.date !== date))
      fetchLogs()
    } catch (err) {
      setBackdatedError(err.response?.data?.error || 'Failed to add record. Please try again.')
    } finally {
      setBackdatedSaving(false)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────
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

  // ── Group logs by BS month ────────────────────────────────────────
  const groupByBSMonth = (logs) => {
    const groups = {}
    logs.forEach(log => {
      const bsLabel = formatBSDate(log.date, lang)
      const parts   = bsLabel.split(' ')
      const groupKey = lang === 'en'
        ? `${parts[0]} ${parts[2]?.replace(',', '')}`
        : `${parts[0]} ${parts[2]?.replace(',', '')}`

      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(log)
    })
    return groups
  }

  const grouped = groupByBSMonth(logs)

  if (loading) return <div className="loading">Loading history...</div>

  return (
    <div className="history-view">

      {/* Header */}
      <div className="history-header">
        <div>
          <h1 className="history-title">
            {lang === 'np' ? 'इतिहास' : 'History'}
          </h1>
          <p className="history-subtitle">
            {lang === 'np' ? 'सबै दिनका रेकर्डहरू' : 'All your recorded days'}
          </p>
        </div>
        <div className="lang-toggle">
          <button
            className={`lang-btn ${lang === 'en' ? 'lang-active' : ''}`}
            onClick={() => setLang('en')}
          >EN</button>
          <button
            className={`lang-btn ${lang === 'np' ? 'lang-active' : ''}`}
            onClick={() => setLang('np')}
          >नेपाली</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Missing days section */}
      {missingDays.length > 0 && (
        <div className="missing-days-section">
          <div className="missing-days-header">
            <span className="missing-days-title">
              {lang === 'np' ? '⚠️ छुटेका दिनहरू' : '⚠️ Missing Days'}
            </span>
            <span className="missing-days-count">
              {lang === 'np'
                ? `${missingDays.length} दिन`
                : `${missingDays.length} day${missingDays.length > 1 ? 's' : ''}`}
            </span>
          </div>

          {missingDays.map(day => (
            <div key={day.date} className="missing-day-card">
              <div className="missing-day-row">
                <div className="log-date-block">
                  <span className="log-date-bs">{formatBSDate(day.date, lang)}</span>
                  <span className="log-date-ad">
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                </div>
                <button
                  className="btn btn-orange btn-sm"
                  onClick={() => addingFor === day.date ? closeBackdatedForm() : openBackdatedForm(day.date)}
                >
                  {addingFor === day.date
                    ? (lang === 'np' ? 'बन्द' : 'Close')
                    : (lang === 'np' ? '+ रेकर्ड थप्नुस्' : '+ Add Record')}
                </button>
              </div>

              {addingFor === day.date && (
                <div className="backdated-form">
                  {backdatedError && <div className="error">{backdatedError}</div>}

                  <div className="backdated-time-inputs">
                    <div className="backdated-time-field">
                      <label>{lang === 'np' ? '🟢 आउनु' : '🟢 Sign In'}</label>
                      <input
                        type="time"
                        value={backdatedForm.sign_in}
                        onChange={e => setBackdatedForm(f => ({ ...f, sign_in: e.target.value }))}
                      />
                    </div>
                    <div className="backdated-time-field">
                      <label>{lang === 'np' ? '🍽️ खाजा सुरु' : '🍽️ Lunch Start'}</label>
                      <input
                        type="time"
                        value={backdatedForm.lunch_start}
                        onChange={e => setBackdatedForm(f => ({ ...f, lunch_start: e.target.value }))}
                      />
                    </div>
                    <div className="backdated-time-field">
                      <label>{lang === 'np' ? '🍽️ खाजा अन्त्य' : '🍽️ Lunch End'}</label>
                      <input
                        type="time"
                        value={backdatedForm.lunch_end}
                        onChange={e => setBackdatedForm(f => ({ ...f, lunch_end: e.target.value }))}
                      />
                    </div>
                    <div className="backdated-time-field">
                      <label>{lang === 'np' ? '🔴 जानु' : '🔴 Sign Out'}</label>
                      <input
                        type="time"
                        value={backdatedForm.sign_out}
                        onChange={e => setBackdatedForm(f => ({ ...f, sign_out: e.target.value }))}
                      />
                    </div>
                  </div>

                  <textarea
                    className="correction-textarea"
                    rows={2}
                    placeholder={
                      lang === 'np'
                        ? 'किन छुट्यो? (वैकल्पिक)'
                        : 'Why was this missed? (optional)'
                    }
                    value={backdatedForm.note}
                    onChange={e => setBackdatedForm(f => ({ ...f, note: e.target.value }))}
                  />

                  <div className="correction-actions">
                    <button
                      className="btn btn-green btn-sm"
                      onClick={() => handleBackdatedSubmit(day.date)}
                      disabled={backdatedSaving}
                    >
                      {backdatedSaving
                        ? (lang === 'np' ? 'सेव हुँदै...' : 'Saving...')
                        : (lang === 'np' ? 'सेव गर्नुस्' : 'Save Record')}
                    </button>
                    <button
                      className="btn btn-gray btn-sm"
                      onClick={closeBackdatedForm}
                      disabled={backdatedSaving}
                    >
                      {lang === 'np' ? 'रद्द' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {logs.length === 0 ? (
        <div className="card">
          <p className="empty-state">
            {lang === 'np' ? 'कुनै रेकर्ड छैन।' : 'No logs recorded yet.'}
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([monthLabel, monthLogs]) => (
          <div key={monthLabel} className="month-group">
            <div className="month-group-header">
              <span className="month-group-title">{monthLabel}</span>
              <span className="month-group-count">
                {lang === 'np'
                  ? `${monthLogs.length} दिन`
                  : `${monthLogs.length} days`}
              </span>
            </div>

            {monthLogs.map(log => (
              <div key={log.id} className="log-card">

                {/* Card header */}
                <div className="log-card-header">
                  <div className="log-date-block">
                    <span className="log-date-bs">
                      {formatBSDate(log.date, lang)}
                    </span>
                    <span className="log-date-ad">
                      {new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="log-card-actions">
                    {log.is_backdated && (
                      <span className="badge badge-backdated" title={log.backdated_note || ''}>
                        🕓 {lang === 'np' ? 'पछि थपिएको' : 'Backdated'}
                      </span>
                    )}
                    <span className={getBadgeClass(log.status)}>
                      {getStatusLabel(log.status)}
                    </span>
                    <button
                      className="btn btn-orange btn-sm"
                      onClick={() => {
                        setCorrecting(correcting === log.id ? null : log.id)
                        setCorrectionNote('')
                      }}
                    >
                      ✏️ {lang === 'np' ? 'सुधार' : 'Correct'}
                    </button>
                    <button
                      className="btn btn-red btn-sm"
                      onClick={() => handleDelete(log.id)}
                    >🗑️</button>
                  </div>
                </div>

                {/* Time entries row */}
                <div className="log-times">
                  <div className="log-time-item">
                    <span className="log-time-label">
                      {lang === 'np' ? '🟢 आउनु' : '🟢 Sign In'}
                    </span>
                    <span className="time-value">{formatTime(log.sign_in)}</span>
                  </div>
                  <div className="log-time-divider">→</div>
                  <div className="log-time-item">
                    <span className="log-time-label">
                      {lang === 'np' ? '🍽️ खाजा' : '🍽️ Lunch'}
                    </span>
                    <span className="log-time-value">
                      {log.lunch_start && log.lunch_end
                        ? `${formatTime(log.lunch_start)} – ${formatTime(log.lunch_end)}`
                        : log.lunch_start
                        ? `${formatTime(log.lunch_start)} – ongoing`
                        : '—'}
                    </span>
                  </div>
                  <div className="log-time-divider">→</div>
                  <div className="log-time-item">
                    <span className="log-time-label">
                      {lang === 'np' ? '🔴 जानु' : '🔴 Sign Out'}
                    </span>
                    <span className="time-value">{formatTime(log.sign_out)}</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="log-stats">
                  <div className="log-stat">
                    <span className="log-stat-label">
                      {lang === 'np' ? 'काम' : 'Worked'}
                    </span>
                    <span className="log-stat-value">
                      {formatMinutes(log.worked_minutes)}
                    </span>
                  </div>
                  <div className="log-stat">
                    <span className="log-stat-label">
                      {lang === 'np' ? 'आवश्यक' : 'Required'}
                    </span>
                    <span className="log-stat-value">
                      {log.required_hours}h
                    </span>
                  </div>
                  <div className="log-stat">
                    <span className="log-stat-label">
                      {lang === 'np' ? 'बढी/कम' : 'Over/Under'}
                    </span>
                    <span className={`log-stat-value ${getDiffClass(log.difference_minutes)}`}>
                      {log.difference_formatted || '—'}
                    </span>
                  </div>
                </div>

                {/* Correction request form */}
                {correcting === log.id && (
                  <div className="correction-form">
                    {correctionSent[log.id] ? (
                      <p className="correction-sent">
                        ✓ {lang === 'np'
                          ? 'सुधार अनुरोध पठाइयो।'
                          : 'Correction request sent to admin.'}
                      </p>
                    ) : (
                      <>
                        <p className="correction-hint">
                          {lang === 'np'
                            ? 'के गलत छ भनेर admin लाई बताउनुस्।'
                            : 'Describe what needs to be corrected. Admin will update your log.'}
                        </p>
                        <textarea
                          className="correction-textarea"
                          rows={3}
                          placeholder={
                            lang === 'np'
                              ? 'जस्तै: साइन आउट गर्न भुलें, ९:३० मा आएको थिएँ...'
                              : 'e.g. Forgot to sign out, actual sign out was 6:30 PM...'
                          }
                          value={correctionNote}
                          onChange={e => setCorrectionNote(e.target.value)}
                        />
                        <div className="correction-actions">
                          <button
                            className="btn btn-green btn-sm"
                            onClick={() => handleCorrectionSubmit(log)}
                            disabled={!correctionNote.trim()}
                          >
                            {lang === 'np' ? 'पठाउनुस्' : 'Send Request'}
                          </button>
                          <button
                            className="btn btn-gray btn-sm"
                            onClick={() => setCorrecting(null)}
                          >
                            {lang === 'np' ? 'रद्द' : 'Cancel'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

export default History