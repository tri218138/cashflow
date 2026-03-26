export type EventKind = 'income' | 'expense'

export type EventFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export type GroupMode = 'day' | 'week' | 'month'

export interface CashflowEvent {
  id: string
  name: string
  kind: EventKind
  frequency: EventFrequency
  amount: number
  startDate: string
  endDate?: string
  enabled: boolean
  timesPerOccurrence: number
  weekendAmount?: number
  intervalDays?: number
  weekDays?: number[]
  dayOfMonth?: number
  monthOfYear?: number
}

export interface CashflowOccurrence {
  eventId: string
  name: string
  signedAmount: number
}

export interface DailyCashflowPoint {
  dayIndex: number
  date: string
  label: string
  delta: number
  balance: number
  occurrences: CashflowOccurrence[]
}

export interface ChartPoint {
  key: string
  label: string
  date: string
  delta: number
  balance: number
  occurrenceCount: number
  occurrences: CashflowOccurrence[]
}
