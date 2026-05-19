import NepaliDate from 'nepali-date-converter'

// ── AD → BS conversion ────────────────────────────────────────────
export const adToBS = (adDateStr) => {
  // adDateStr: 'YYYY-MM-DD'
  if (!adDateStr) return null
  try {
    const [y, m, d] = adDateStr.split('-').map(Number)
    const nd = new NepaliDate(new Date(y, m - 1, d))
    return {
      year:  nd.getYear(),
      month: nd.getMonth() + 1, // 1-based
      day:   nd.getDate(),
    }
  } catch {
    return null
  }
}

// ── BS → AD conversion ────────────────────────────────────────────
export const bsToAD = (bsYear, bsMonth, bsDay) => {
  try {
    const nd = new NepaliDate(bsYear, bsMonth - 1, bsDay)
    const ad = nd.toJsDate()
    return {
      year:  ad.getFullYear(),
      month: ad.getMonth() + 1,
      day:   ad.getDate(),
      iso:   ad.toISOString().slice(0, 10),
    }
  } catch {
    return null
  }
}

// ── Get today in BS ───────────────────────────────────────────────
export const todayBS = () => {
  const nd = new NepaliDate()
  return {
    year:  nd.getYear(),
    month: nd.getMonth() + 1,
    day:   nd.getDate(),
  }
}

// ── BS month names ────────────────────────────────────────────────
export const BS_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan',
  'Bhadra',  'Ashwin', 'Kartik', 'Mangsir',
  'Poush',   'Magh',   'Falgun', 'Chaitra',
]

export const BS_MONTHS_NP = [
  'बैशाख', 'जेठ',    'असार',   'साउन',
  'भदौ',   'असोज',  'कार्तिक', 'मंसिर',
  'पुष',   'माघ',   'फागुन',  'चैत',
]

// ── Nepali digits ─────────────────────────────────────────────────
const NP_DIGITS = ['०','१','२','३','४','५','६','७','८','९']

export const toNepaliDigits = (num) =>
  String(num).split('').map(d => NP_DIGITS[d] || d).join('')

// ── Format a BS date for display ──────────────────────────────────
export const formatBSDate = (adDateStr, lang = 'en') => {
  const bs = adToBS(adDateStr)
  if (!bs) return '—'
  const monthName = lang === 'np'
    ? BS_MONTHS_NP[bs.month - 1]
    : BS_MONTHS_EN[bs.month - 1]
  const day  = lang === 'np' ? toNepaliDigits(bs.day)  : bs.day
  const year = lang === 'np' ? toNepaliDigits(bs.year) : bs.year
  return `${monthName} ${day}, ${year}`
}

// ── Format BS month + year for header ────────────────────────────
export const formatBSMonth = (bsYear, bsMonth, lang = 'en') => {
  const monthName = lang === 'np'
    ? BS_MONTHS_NP[bsMonth - 1]
    : BS_MONTHS_EN[bsMonth - 1]
  const year = lang === 'np' ? toNepaliDigits(bsYear) : bsYear
  return { monthName, year }
}

// ── Get AD date range for a BS month ─────────────────────────────
// Returns { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
export const bsMonthToADRange = (bsYear, bsMonth) => {
  const start = bsToAD(bsYear, bsMonth, 1)

  // Find last day of BS month by trying days 32 down to 28
  let lastDay = 32
  while (lastDay > 28) {
    try {
      new NepaliDate(bsYear, bsMonth - 1, lastDay)
      break
    } catch {
      lastDay--
    }
  }
  const end = bsToAD(bsYear, bsMonth, lastDay)
  return { start: start?.iso, end: end?.iso }
}

// ── Get all AD dates in a BS month ────────────────────────────────
export const getDaysInBSMonth = (bsYear, bsMonth) => {
  const days = []
  let d = 1
  while (true) {
    try {
      const nd  = new NepaliDate(bsYear, bsMonth - 1, d)
      const ad  = nd.toJsDate()
      days.push({
        bsDay:  d,
        adDate: ad.toISOString().slice(0, 10),
        weekday: ad.toLocaleDateString('en-US', { weekday: 'short' }),
        jsDate: ad,
      })
      d++
    } catch {
      break
    }
  }
  return days
}