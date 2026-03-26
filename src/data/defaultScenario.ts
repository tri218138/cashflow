import type { CashflowEvent } from '../types'

export const DEFAULT_START_DATE = '2026-01-01'

export const DEFAULT_INITIAL_BALANCE = 5_000_000

export const DEFAULT_FORECAST_DAYS = 365

export const DEFAULT_EVENTS: CashflowEvent[] = [
  {
    id: 'food-daily',
    name: 'Tien an',
    kind: 'expense',
    frequency: 'daily',
    amount: 50_000,
    weekendAmount: 100_000,
    startDate: DEFAULT_START_DATE,
    enabled: true,
    timesPerOccurrence: 3,
  },
  {
    id: 'salary-monthly',
    name: 'Luong',
    kind: 'income',
    frequency: 'monthly',
    amount: 20_000_000,
    startDate: DEFAULT_START_DATE,
    enabled: true,
    timesPerOccurrence: 1,
    dayOfMonth: 1,
  },
  {
    id: 'family-support-monthly',
    name: 'Gui ve gia dinh',
    kind: 'expense',
    frequency: 'monthly',
    amount: 2_000_000,
    startDate: DEFAULT_START_DATE,
    enabled: true,
    timesPerOccurrence: 1,
    dayOfMonth: 1,
  },
  {
    id: 'rent-monthly',
    name: 'Tien tro',
    kind: 'expense',
    frequency: 'monthly',
    amount: 2_500_000,
    startDate: DEFAULT_START_DATE,
    enabled: true,
    timesPerOccurrence: 1,
    dayOfMonth: 2,
  },
  {
    id: 'birthday-march',
    name: 'Sinh nhat 28/3',
    kind: 'expense',
    frequency: 'yearly',
    amount: 2_000_000,
    startDate: DEFAULT_START_DATE,
    enabled: true,
    timesPerOccurrence: 1,
    monthOfYear: 3,
    dayOfMonth: 28,
  },
]
