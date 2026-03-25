import en from './locales/en.json'
import vi from './locales/vi.json'
import type { EventFrequency, EventKind, GroupMode } from './types'

export type Locale = 'vi' | 'en'

export const STORAGE_LOCALE_KEY = 'richman-locale'

export const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: 'vi', label: 'VI' },
  { value: 'en', label: 'EN' },
]

type RawTranslation = {
  heroTitle: string
  heroDescription: string
  endingBalance: string
  increase: string
  decrease: string
  lowestPoint: string
  notNegativeYet: string
  negativeFromDay: string
  forecastHorizon: string
  activeEvents: string
  days: string
  scenario: string
  scenarioDescription: string
  startDate: string
  endDate: string
  initialBalance: string
  forecastDays: string
  cashflowChart: string
  chartDescription: string
  tooltipNetChange: string
  tooltipEvents: string
  upcomingActivity: string
  upcomingDescription: string
  addEvent: string
  addEventDescription: string
  eventName: string
  eventNamePlaceholder: string
  type: string
  frequency: string
  amountPerOccurrence: string
  timesPerOccurrence: string
  weekendAmountOptional: string
  differentFromWeekdayAmount: string
  weekdays: string
  everyNDays: string
  dayOfMonth: string
  month: string
  addToScenario: string
  editEvent: string
  editEventDescription: string
  activeEventsTitle: string
  defaultEventsDescription: string
  clickEventToEdit: string
  disable: string
  enable: string
  delete: string
  cancel: string
  saveChanges: string
  newEvent: string
  noUpcomingActivity: string
  noDaysSelected: string
  weekends: string
  everyDayFrom: string
  everyWeekOn: string
  everyMonthOn: string
  eachMonth: string
  everyYearOn: string
  everyYearSuffix: string
  untilDate: string
  everyCustomDays: string
  multiplier: string
  groupLabels: Record<GroupMode, string>
  weekdayLabels: string[]
  frequencyLabels: Record<EventFrequency, string>
  kindLabels: Record<EventKind, string>
  eventDisplayNames: Record<string, string>
}

export type Translation = Omit<
  RawTranslation,
  'heroDescription' | 'negativeFromDay' | 'activeEvents' | 'everyCustomDays' | 'multiplier'
> & {
  heroDescription: (initialBalance: string) => string
  negativeFromDay: (day: number) => string
  activeEvents: (count: number) => string
  everyCustomDays: (days: number) => string
  multiplier: (count: number) => string
}

const rawTranslations: Record<Locale, RawTranslation> = {
  vi,
  en,
}

function interpolate(template: string, variables: Record<string, string | number>) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template,
  )
}

export const translations: Record<Locale, Translation> = {
  vi: buildTranslation(rawTranslations.vi),
  en: buildTranslation(rawTranslations.en),
}

export const GROUP_LABELS: Record<Locale, Record<GroupMode, string>> = {
  vi: rawTranslations.vi.groupLabels,
  en: rawTranslations.en.groupLabels,
}

export const WEEKDAY_LABELS: Record<Locale, string[]> = {
  vi: rawTranslations.vi.weekdayLabels,
  en: rawTranslations.en.weekdayLabels,
}

export const FREQUENCY_LABELS: Record<Locale, Record<EventFrequency, string>> = {
  vi: rawTranslations.vi.frequencyLabels,
  en: rawTranslations.en.frequencyLabels,
}

export const KIND_LABELS: Record<Locale, Record<EventKind, string>> = {
  vi: rawTranslations.vi.kindLabels,
  en: rawTranslations.en.kindLabels,
}

function buildTranslation(raw: RawTranslation): Translation {
  return {
    ...raw,
    heroDescription: (initialBalance) =>
      interpolate(raw.heroDescription, { initialBalance }),
    negativeFromDay: (day) => interpolate(raw.negativeFromDay, { day }),
    activeEvents: (count) => interpolate(raw.activeEvents, { count }),
    everyCustomDays: (days) => interpolate(raw.everyCustomDays, { days }),
    multiplier: (count) => interpolate(raw.multiplier, { count }),
  }
}

export function getEventDisplayName(eventId: string, fallback: string, locale: Locale) {
  const localizedNames = rawTranslations[locale].eventDisplayNames

  return localizedNames[eventId] ?? fallback
}

export function formatCurrency(value: number, locale: Locale) {
  const formatter = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  })
  return formatter.format(value)
}

export function formatNumericInput(value: number | string, locale: Locale) {
  const digitsOnly = `${value}`.replace(/\D/g, '')
  if (digitsOnly === '') {
    return ''
  }

  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(Number(digitsOnly))
}
