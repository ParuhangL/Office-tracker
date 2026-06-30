import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

// ── Attach token to every request ────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Token ${token}`
  }
  return config
})

// ── If 401, clear storage and reload to login ─────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear()
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────────────
export const login  = (data) => api.post('/auth/login/', data)
export const logout = ()     => api.post('/auth/logout/')
export const signup = (data) => api.post('/auth/signup/', data)

// ── Profile ───────────────────────────────────────────────────────
export const getProfile   = ()     => api.get('/profile/')
export const patchProfile = (data) => api.patch('/profile/', data)

// ── Today / Action ────────────────────────────────────────────────
export const getToday   = ()           => api.get('/today/')
export const patchToday = (data)       => api.patch('/today/', data)
export const postAction = (action, time = null) =>
  api.post('/action/', { action, ...(time && { time }) })

// ── Logs ──────────────────────────────────────────────────────────
export const getAllLogs = ()          => api.get('/logs/')
export const deleteLog = (id)        => api.delete(`/logs/${id}/`)
export const patchLog  = (id, data)  => api.patch(`/logs/${id}/`, data)

// ── Monthly ───────────────────────────────────────────────────────
export const getMonthlyStats = (bsYear, bsMonth) =>
  api.get(`/monthly/?bs_year=${bsYear}&bs_month=${bsMonth}`)

// ── Leave ─────────────────────────────────────────────────────────
export const getLeaves   = (year, month) =>
  api.get(`/leave/?year=${year}&month=${month}`)
export const createLeave = (data)        => api.post('/leave/', data)
export const deleteLeave = (id)          => api.delete(`/leave/${id}/`)

// ── Holidays ──────────────────────────────────────────────────────
export const getHolidays        = (year)       => api.get(`/holidays/?year=${year}`)
export const getAdminHolidays   = (year)       => api.get(`/admin/holidays/?year=${year}`)
export const createHoliday      = (data)       => api.post('/admin/holidays/', data)
export const updateHoliday      = (id, data)   => api.patch(`/admin/holidays/${id}/`, data)
export const deleteHoliday      = (id)         => api.delete(`/admin/holidays/${id}/`)
export const fetchHolidaysFromAPI = (year)     =>
  api.post('/admin/holidays/fetch/', { year })

// ── Admin ─────────────────────────────────────────────────────────
export const getAdminStats  = ()           => api.get('/admin/stats/')
export const getAdminUsers  = ()           => api.get('/admin/users/')
export const createUser     = (data)       => api.post('/admin/users/', data)
export const patchUser      = (id, data)   => api.patch(`/admin/users/${id}/`, data)
export const deleteUser     = (id)         => api.delete(`/admin/users/${id}/`)
export const getUserLogs    = (id)         => api.get(`/admin/users/${id}/logs/`)
export const exportCSV      = (userId = null) => {
  const url = userId ? `/admin/export/?user_id=${userId}` : '/admin/export/'
  return api.get(url, { responseType: 'blob' })
}

// ── Correction Requests ───────────────────────────────────────────
export const getMyCorrections    = ()       => api.get('/corrections/')
export const createCorrection    = (data)   => api.post('/corrections/', data)

// ── Admin corrections ─────────────────────────────────────────────
export const getAdminCorrections = (status = 'pending') =>
  api.get(`/admin/corrections/?status=${status}`)
export const resolveCorrection   = (id, data) =>
  api.patch(`/admin/corrections/${id}/`, data)

// ── Admin edit any user log ───────────────────────────────────────
export const adminEditLog = (data) => api.post('/admin/logs/edit/', data)
// ── Admin settings (org-wide weekend default) ─────────────────────
export const getAdminSettings    = ()     => api.get('/admin/settings/')
export const updateAdminSettings = (data) => api.patch('/admin/settings/', data)

export const addBackdatedLog = (data) => api.post('/backdated/', data)