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
  EventFrequency,
} from '../types'

export const VND_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const FREQUENCY_LABELS: Record<EventFrequency, string> = {
  daily: 'Ngay',
  weekly: 'Tuan',
  monthly: 'Thang',
  yearly: 'Nam',
  custom: 'Custom',
}

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export function formatVnd(value: number) {
  return VND_FORMATTER.format(value)
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

export function formatEventRule(event: CashflowEvent) {
  const amount =
    event.weekendAmount && event.frequency === 'daily'
      ? `${formatVnd(event.amount)} / cuoi tuan ${formatVnd(event.weekendAmount)}`
      : formatVnd(event.amount)

  const multiplier = event.timesPerOccurrence > 1 ? ` x ${event.timesPerOccurrence}` : ''

  switch (event.frequency) {
    case 'daily':
      return `Lap moi ngay tu ${event.startDate}, ${amount}${multiplier}`
    case 'weekly':
      return `Lap hang tuan vao ${formatWeekdays(event.weekDays ?? [])}, ${amount}${multiplier}`
    case 'monthly':
      return `Lap ngay ${event.dayOfMonth ?? 1} hang thang, ${amount}${multiplier}`
    case 'yearly':
      return `Lap ngay ${event.dayOfMonth ?? 1}/${event.monthOfYear ?? 1} moi nam, ${amount}${multiplier}`
    case 'custom':
      return `Lap moi ${event.intervalDays ?? 1} ngay, ${amount}${multiplier}`
    default:
      return `${FREQUENCY_LABELS[event.frequency]}, ${amount}${multiplier}`
  }
}

function occursOnDate(event: CashflowEvent, currentDate: Date) {
  const eventStart = parseDate(event.startDate)

  if (isBefore(currentDate, eventStart)) {
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

function formatWeekdays(days: number[]) {
  if (days.length === 0) {
    return 'khong co ngay'
  }

  return days
    .slice()
    .sort((a, b) => a - b)
    .map((day) => WEEKDAY_LABELS[day] ?? `${day}`)
    .join(', ')
}

export function isFutureDate(dateText: string, referenceDateText: string) {
  return isAfter(parseDate(dateText), parseDate(referenceDateText))
}
