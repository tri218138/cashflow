import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type {
  CashflowEvent,
  ChartPoint,
  DailyCashflowPoint,
} from '../types'
import {
  FREQUENCY_LABELS,
  formatCurrency,
  type Locale,
  translations,
  WEEKDAY_LABELS,
} from '../i18n'

export function formatVnd(value: number, locale: Locale = 'vi') {
  return formatCurrency(value, locale)
}

export function parseDate(dateText: string) {
  return parseISO(dateText)
}

export function buildDailyCashflow(params: {
  initialBalance: number
  startDate: string
  forecastDays: number
  events: CashflowEvent[]
}) {
  const { initialBalance, startDate, forecastDays, events } = params
  const firstDate = parseDate(startDate)
  const points: DailyCashflowPoint[] = []
  let balance = initialBalance

  for (let dayIndex = 0; dayIndex <= forecastDays; dayIndex += 1) {
    const currentDate = addDays(firstDate, dayIndex)
    const occurrences = events
      .filter((event) => event.enabled && occursOnDate(event, currentDate))
      .map((event) => ({
        eventId: event.id,
        name: event.name,
        signedAmount: getSignedAmount(event, currentDate),
      }))

    const delta = occurrences.reduce((sum, occurrence) => sum + occurrence.signedAmount, 0)
    balance += delta

    points.push({
      dayIndex,
      date: format(currentDate, 'yyyy-MM-dd'),
      label: format(currentDate, 'dd/MM'),
      delta,
      balance,
      occurrences,
    })
  }

  return points
}

export function groupChartPoints(
  points: DailyCashflowPoint[],
  mode: 'day' | 'week' | 'month',
) {
  if (mode === 'day') {
    return points.map<ChartPoint>((point) => ({
      key: point.date,
      label: point.label,
      date: point.date,
      delta: point.delta,
      balance: point.balance,
      occurrenceCount: point.occurrences.length,
    }))
  }

  const grouped = new Map<string, DailyCashflowPoint[]>()

  for (const point of points) {
    const date = parseDate(point.date)
    const key =
      mode === 'week'
        ? format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : format(startOfMonth(date), 'yyyy-MM')

    const group = grouped.get(key) ?? []
    group.push(point)
    grouped.set(key, group)
  }

  return Array.from(grouped.entries()).map<ChartPoint>(([key, group]) => {
    const lastPoint = group[group.length - 1]
    const delta = group.reduce((sum, point) => sum + point.delta, 0)
    const occurrenceCount = group.reduce((sum, point) => sum + point.occurrences.length, 0)
    const date = parseDate(lastPoint.date)
    const label =
      mode === 'week'
        ? `${format(startOfWeek(date, { weekStartsOn: 1 }), 'dd/MM')} - ${format(
            addDays(startOfWeek(date, { weekStartsOn: 1 }), 6),
            'dd/MM',
          )}`
        : format(date, 'MM/yyyy')

    return {
      key,
      label,
      date: lastPoint.date,
      delta,
      balance: lastPoint.balance,
      occurrenceCount,
    }
  })
}

export function getScenarioSummary(points: DailyCashflowPoint[]) {
  const balances = points.map((point) => point.balance)
  const endingBalance = balances[balances.length - 1] ?? 0
  const lowestBalance = Math.min(...balances)
  const highestBalance = Math.max(...balances)
  const firstNegativePoint = points.find((point) => point.balance < 0)

  return {
    endingBalance,
    lowestBalance,
    highestBalance,
    firstNegativeDay: firstNegativePoint?.dayIndex ?? null,
  }
}

export function listUpcomingActivity(points: DailyCashflowPoint[], today = new Date()) {
  return points
    .filter((point) => {
      const pointDate = parseDate(point.date)
      return !isBefore(pointDate, today) && point.occurrences.length > 0
    })
    .slice(0, 10)
}

export function formatEventRule(event: CashflowEvent, locale: Locale = 'vi') {
  const t = translations[locale]
  const amount =
    event.weekendAmount && event.frequency === 'daily'
      ? `${formatVnd(event.amount, locale)} / ${t.weekends} ${formatVnd(event.weekendAmount, locale)}`
      : formatVnd(event.amount, locale)

  const multiplier = event.timesPerOccurrence > 1 ? t.multiplier(event.timesPerOccurrence) : ''
  const endDateSuffix = event.endDate ? `, ${t.untilDate} ${event.endDate}` : ''

  switch (event.frequency) {
    case 'daily':
      return `${t.everyDayFrom} ${event.startDate}${endDateSuffix}, ${amount}${multiplier}`
    case 'weekly':
      return `${t.everyWeekOn} ${formatWeekdays(event.weekDays ?? [], locale)}${endDateSuffix}, ${amount}${multiplier}`
    case 'monthly':
      return `${t.everyMonthOn} ${event.dayOfMonth ?? 1} ${t.eachMonth}${endDateSuffix}, ${amount}${multiplier}`
    case 'yearly':
      return `${t.everyYearOn} ${event.dayOfMonth ?? 1}/${event.monthOfYear ?? 1} ${t.everyYearSuffix}${endDateSuffix}, ${amount}${multiplier}`
    case 'custom':
      return `${t.everyCustomDays(event.intervalDays ?? 1)}${endDateSuffix}, ${amount}${multiplier}`
    default:
      return `${FREQUENCY_LABELS[locale][event.frequency]}${endDateSuffix}, ${amount}${multiplier}`
  }
}

function occursOnDate(event: CashflowEvent, currentDate: Date) {
  const eventStart = parseDate(event.startDate)
  const eventEnd = event.endDate ? parseDate(event.endDate) : null

  if (isBefore(currentDate, eventStart)) {
    return false
  }

  if (eventEnd && isAfter(currentDate, eventEnd)) {
    return false
  }

  switch (event.frequency) {
    case 'daily': {
      const interval = Math.max(1, event.intervalDays ?? 1)
      return differenceInCalendarDays(currentDate, eventStart) % interval === 0
    }
    case 'weekly':
      return (event.weekDays ?? []).includes(currentDate.getDay())
    case 'monthly': {
      const targetDay = event.dayOfMonth ?? 1
      const monthEndDay = endOfMonth(currentDate).getDate()
      return currentDate.getDate() === Math.min(targetDay, monthEndDay)
    }
    case 'yearly': {
      const targetMonth = event.monthOfYear ?? 1
      const targetDay = event.dayOfMonth ?? 1
      return currentDate.getMonth() + 1 === targetMonth && currentDate.getDate() === targetDay
    }
    case 'custom': {
      const interval = Math.max(1, event.intervalDays ?? 1)
      return differenceInCalendarDays(currentDate, eventStart) % interval === 0
    }
    default:
      return false
  }
}

function getSignedAmount(event: CashflowEvent, currentDate: Date) {
  const amount =
    event.frequency === 'daily' && event.weekendAmount && isWeekend(currentDate)
      ? event.weekendAmount
      : event.amount

  const total = amount * Math.max(1, event.timesPerOccurrence)
  return event.kind === 'expense' ? -total : total
}

function formatWeekdays(days: number[], locale: Locale) {
  const labels = WEEKDAY_LABELS[locale]
  if (days.length === 0) {
    return translations[locale].noDaysSelected
  }

  return days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => labels[day] ?? `${day}`)
    .join(', ')
}

export function isFutureDate(dateText: string, referenceDateText: string) {
  return isAfter(parseDate(dateText), parseDate(referenceDateText))
}
