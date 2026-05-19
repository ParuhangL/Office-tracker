import { useState, useEffect } from 'react'
import { getMonthlyStats, createLeave, deleteLeave } from '../api'
import {
  todayBS, formatBSDate, formatBSMonth,
  BS_MONTHS_EN, BS_MONTHS_NP, toNepaliDigits,
} from '../utils/nepaliDate'
import './MonthlySummary.css'

function MonthlySummary() {
  const today   = todayBS()
  const [bsYear,  setBsYear]  = useState(today.year)
  const [bsMonth, setBsMonth] = useState(today.month)
  const [lang,    setLang]    = useState('en') // 'en' | 'np'
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  

  // ── Leave form ───────────────────────────────────────────────────
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm,     setLeaveForm]     = useState({
    date: '', leave_type: 'paid', hours: 8, note: ''
  })
  const [leaveError,   setLeaveError]   = useState(null)
  const [leaveLoading, setLeaveLoading] = useState(false)

  useEffect(() => { fetchStats() }, [bsYear, bsMonth])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getMonthlyStats(bsYear, bsMonth)
      setData(res.data)
    } catch {
      setError('Failed to load monthly stats.')
    } finally {
      setLoading(false)
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
    if (lang === 'np') return `${toNepaliDigits(h)}घ ${toNepaliDigits(String(m).padStart(2,'0'))}म`
    return `${h}h ${String(m).padStart(2, '0')}m`
  }

  const getDiffClass = (mins) => {
    if (mins === null || mins === undefined) return ''
    if (mins > 0) return 'text-over'
    if (mins < 0) return 'text-under'
    return 'text-exact'
  }

  const prevMonth = () => {
    if (bsMonth === 1) { setBsYear(y => y - 1); setBsMonth(12) }
    else setBsMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (bsMonth === 12) { setBsYear(y => y + 1); setBsMonth(1) }
    else setBsMonth(m => m + 1)
  }

  const isCurrentMonth =
    bsYear === today.year && bsMonth === today.month

  const { monthName, year: displayYear } = formatBSMonth(bsYear, bsMonth, lang)

  // ── Day label ────────────────────────────────────────────────────
  const formatDayLabel = (day) => {
    const bsDay = lang === 'np' ? toNepaliDigits(day.bs_day) : day.bs_day
    const monthNames = lang === 'np' ? BS_MONTHS_NP : BS_MONTHS_EN
    const bsMonthName = monthNames[bsMonth - 1]
    const adFmt = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    })
    return { bsLabel: `${bsMonthName} ${bsDay}`, adFmt }
  }

  // ── Leave handlers ───────────────────────────────────────────────
  const handleAddLeave = async () => {
    setLeaveError(null)
    if (!leaveForm.date) {
      setLeaveError('Please select a date.')
      return
    }
    setLeaveLoading(true)
    try {
      await createLeave(leaveForm)
      setShowLeaveForm(false)
      setLeaveForm({ date: '', leave_type: 'paid', hours: 8, note: '' })
      fetchStats()
    } catch (err) {
      setLeaveError(err.response?.data?.error || 'Failed to add leave.')
    } finally {
      setLeaveLoading(false)
    }
  }

  const handleDeleteLeave = async (leaveId) => {
    if (!window.confirm('Remove this leave entry?')) return
    try {
      await deleteLeave(leaveId)
      fetchStats()
    } catch {
      setError('Failed to delete leave.')
    }
  }

  // ── Status badge ─────────────────────────────────────────────────
  const STATUS_LABELS = {
    en: {
      not_started:  'No Log',
      working:      'Working',
      in_lunch:     'In Lunch',
      complete:     'Complete',
      weekend:      'Weekend',
      holiday:      'Holiday',
      paid_leave:   'Paid Leave',
      unpaid_leave: 'Unpaid Leave',
      no_log:       'No Log',
    },
    np: {
      not_started:  'लग छैन',
      working:      'काममा',
      in_lunch:     'खाजामा',
      complete:     'सम्पन्न',
      weekend:      'विदा',
      holiday:      'बिदा',
      paid_leave:   'पेड बिदा',
      unpaid_leave: 'अनपेड बिदा',
      no_log:       'लग छैन',
    }
  }

  const STATUS_CLASSES = {
    not_started:  'badge-not-started',
    working:      'badge-working',
    in_lunch:     'badge-in-lunch',
    complete:     'badge-complete',
    weekend:      'badge-weekend',
    holiday:      'badge-holiday',
    paid_leave:   'badge-paid-leave',
    unpaid_leave: 'badge-unpaid-leave',
    no_log:       'badge-not-started',
  }

  const StatusBadge = ({ day }) => {
    const cls   = STATUS_CLASSES[day.status] || 'badge-not-started'
    const label = STATUS_LABELS[lang][day.status] || day.status
    const title = day.holiday_name || ''
    return <span className={`badge ${cls}`} title={title}>{label}</span>
  }

  // ── Today's AD date string for row highlight ──────────────────────
  const todayAD = new Date().toISOString().slice(0, 10)

  return (
    <div className="monthly-view">

      {/* Header */}
      <div className="monthly-header">
        <div>
          <h1 className="monthly-title">
            {lang === 'np' ? 'मासिक सारांश' : 'Monthly Summary'}
          </h1>
          <p className="monthly-subtitle">
            {lang === 'np' ? 'महिनाको घण्टा विवरण' : 'Your hours overview by month'}
          </p>
        </div>
        <div className="monthly-header-actions">
          {/* Language toggle */}
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
          <button
            className="btn btn-green btn-sm"
            onClick={() => setShowLeaveForm(!showLeaveForm)}
          >
            {showLeaveForm
              ? (lang === 'np' ? '✕ रद्द' : '✕ Cancel')
              : (lang === 'np' ? '＋ बिदा थप्नुस्' : '＋ Add Leave')}
          </button>
        </div>
      </div>

      {/* Leave Form */}
      {showLeaveForm && (
        <div className="card">
          <h2>{lang === 'np' ? 'बिदा थप्नुस्' : 'Add Leave'}</h2>
          {leaveError && <div className="error">{leaveError}</div>}
          <div className="leave-form-grid">
            <div className="form-group">
              <label className="form-label">
                {lang === 'np' ? 'मिति (AD)' : 'Date (AD)'}
              </label>
              <input
                type="date"
                className="form-input"
                value={leaveForm.date}
                min={data?.ad_start}
                max={data?.ad_end}
                onChange={e => setLeaveForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                {lang === 'np' ? 'बिदाको प्रकार' : 'Leave Type'}
              </label>
              <select
                className="form-input"
                value={leaveForm.leave_type}
                onChange={e => setLeaveForm(p => ({ ...p, leave_type: e.target.value }))}
              >
                <option value="paid">
                  {lang === 'np' ? 'पेड बिदा' : 'Paid Leave'}
                </option>
                <option value="unpaid">
                  {lang === 'np' ? 'अनपेड बिदा' : 'Unpaid Leave'}
                </option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                {lang === 'np' ? 'घण्टा' : 'Hours'}
              </label>
              <input
                type="number"
                className="form-input"
                step="0.5"
                min="0.5"
                value={leaveForm.hours}
                onChange={e => setLeaveForm(p => ({ ...p, hours: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                {lang === 'np' ? 'टिप्पणी' : 'Note (optional)'}
              </label>
              <input
                type="text"
                className="form-input"
                placeholder={lang === 'np' ? 'जस्तै: डाक्टर' : 'e.g. Doctor appointment'}
                value={leaveForm.note}
                onChange={e => setLeaveForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button
              className="btn btn-green"
              onClick={handleAddLeave}
              disabled={leaveLoading}
            >
              {leaveLoading
                ? (lang === 'np' ? 'सेभ हुँदैछ...' : 'Saving...')
                : (lang === 'np' ? 'सेभ गर्नुस्' : 'Save Leave')}
            </button>
          </div>
        </div>
      )}

      {/* Month Picker */}
      <div className="month-picker">
        <button className="btn btn-gray" onClick={prevMonth}>←</button>
        <div className="month-label">
          <span className="month-name">{monthName}</span>
          <span className="month-year">{displayYear}</span>
          {data && (
            <span className="month-ad-range">
              {new Date(data.ad_start + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short', day: 'numeric'
              })}
              {' – '}
              {new Date(data.ad_end + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
              })}
            </span>
          )}
        </div>
        <button
          className="btn btn-gray"
          onClick={nextMonth}
          disabled={isCurrentMonth}
        >→</button>
      </div>

      {error   && <div className="error">{error}</div>}
      {loading && <div className="loading">
        {lang === 'np' ? 'लोड हुँदैछ...' : 'Loading...'}
      </div>}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div className="stat-cards">
            <div className="stat-card">
              <span className="stat-card-label">
                {lang === 'np' ? 'कार्य दिन' : 'Work Days'}
              </span>
              <span className="stat-card-value">
                {lang === 'np' ? toNepaliDigits(data.total_workdays) : data.total_workdays}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">
                {lang === 'np' ? 'आवश्यक' : 'Required'}
              </span>
              <span className="stat-card-value">
                {formatMinutes(data.total_required_minutes)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">
                {lang === 'np' ? 'काम गरेको' : 'Worked'}
              </span>
              <span className="stat-card-value">
                {formatMinutes(data.total_worked_minutes)}
              </span>
            </div>
            <div className={`stat-card ${data.total_diff_minutes >= 0 ? 'stat-card-green' : 'stat-card-red'}`}>
              <span className="stat-card-label">
                {lang === 'np' ? 'कुल बढी/कम' : 'Net Over / Under'}
              </span>
              <span className={`stat-card-value ${getDiffClass(data.total_diff_minutes)}`}>
                {data.total_diff_formatted || '—'}
              </span>
            </div>
            {data.total_paid_leave_days > 0 && (
              <div className="stat-card">
                <span className="stat-card-label">
                  {lang === 'np' ? 'पेड बिदा दिन' : 'Paid Leave Days'}
                </span>
                <span className="stat-card-value">
                  {lang === 'np'
                    ? toNepaliDigits(data.total_paid_leave_days)
                    : data.total_paid_leave_days}
                </span>
              </div>
            )}
            {data.total_unpaid_leave_days > 0 && (
              <div className="stat-card stat-card-red">
                <span className="stat-card-label">
                  {lang === 'np' ? 'अनपेड बिदा दिन' : 'Unpaid Leave Days'}
                </span>
                <span className="stat-card-value">
                  {lang === 'np'
                    ? toNepaliDigits(data.total_unpaid_leave_days)
                    : data.total_unpaid_leave_days}
                </span>
              </div>
            )}
          </div>

          {/* Daily Breakdown */}
          <div className="card">
            <h2>{lang === 'np' ? 'दैनिक विवरण' : 'Daily Breakdown'}</h2>
            <div className="table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>{lang === 'np' ? 'मिति (BS)' : 'Date (BS)'}</th>
                    <th>{lang === 'np' ? 'AD मिति' : 'Date (AD)'}</th>
                    <th>{lang === 'np' ? 'बार' : 'Day'}</th>
                    <th>{lang === 'np' ? 'आउनु' : 'Sign In'}</th>
                    <th>{lang === 'np' ? 'जानु' : 'Sign Out'}</th>
                    <th>{lang === 'np' ? 'काम' : 'Worked'}</th>
                    <th>{lang === 'np' ? 'आवश्यक' : 'Required'}</th>
                    <th>{lang === 'np' ? 'बढी/कम' : 'Over/Under'}</th>
                    <th>{lang === 'np' ? 'स्थिति' : 'Status'}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((day) => {
                    const { bsLabel, adFmt } = formatDayLabel(day)
                    return (
                      <tr
                        key={day.date}
                        className={
                          day.is_weekend             ? 'row-weekend'      :
                          day.is_holiday             ? 'row-holiday'      :
                          day.status === 'paid_leave'   ? 'row-paid-leave'   :
                          day.status === 'unpaid_leave' ? 'row-unpaid-leave' :
                          day.date === todayAD       ? 'row-today'        : ''
                        }
                      >
                        <td className="td-date">
                          <strong>{bsLabel}</strong>
                        </td>
                        <td className="td-date-ad">{adFmt}</td>
                        <td>{day.weekday}</td>
                        <td>{formatTime(day.sign_in)}</td>
                        <td>{formatTime(day.sign_out)}</td>
                        <td>{formatMinutes(day.worked_minutes)}</td>
                        <td>{formatMinutes(day.required_minutes)}</td>
                        <td className={getDiffClass(day.difference_minutes)}>
                          {day.difference_formatted || '—'}
                        </td>
                        <td>
                          <StatusBadge day={day} />
                          {day.is_holiday && day.holiday_name && (
                            <div className="holiday-name">{day.holiday_name}</div>
                          )}
                          {day.leave_note && (
                            <div className="leave-note">{day.leave_note}</div>
                          )}
                        </td>
                        <td>
                          {day.leave_id && (
                            <button
                              className="btn btn-red btn-sm"
                              onClick={() => handleDeleteLeave(day.leave_id)}
                            >✕</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default MonthlySummary