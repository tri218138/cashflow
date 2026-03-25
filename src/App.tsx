import { useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import ReactECharts from 'echarts-for-react'
import './App.css'
import {
  DEFAULT_EVENTS,
  DEFAULT_FORECAST_DAYS,
  DEFAULT_INITIAL_BALANCE,
  DEFAULT_START_DATE,
} from './data/defaultScenario'
import {
  buildDailyCashflow,
  formatEventRule,
  formatVnd,
  getScenarioSummary,
  groupChartPoints,
  listUpcomingActivity,
} from './lib/cashflow'
import {
  FREQUENCY_LABELS,
  formatCurrency,
  formatNumericInput,
  getEventDisplayName,
  GROUP_LABELS,
  KIND_LABELS,
  LOCALE_OPTIONS,
  STORAGE_LOCALE_KEY,
  translations,
  type Locale,
  WEEKDAY_LABELS,
} from './i18n'
import type { CashflowEvent, EventFrequency, EventKind, GroupMode } from './types'

const STORAGE_KEY = 'richman-cashflow-scenario-v1'

type ScenarioState = {
  initialBalance: number
  startDate: string
  forecastDays: number
  events: CashflowEvent[]
}

type EventFormState = {
  name: string
  kind: EventKind
  frequency: EventFrequency
  amount: number
  weekendAmount: string
  startDate: string
  timesPerOccurrence: number
  intervalDays: number
  dayOfMonth: number
  monthOfYear: number
  weekDays: number[]
}

function createDefaultScenario(): ScenarioState {
  return {
    initialBalance: DEFAULT_INITIAL_BALANCE,
    startDate: DEFAULT_START_DATE,
    forecastDays: DEFAULT_FORECAST_DAYS,
    events: DEFAULT_EVENTS,
  }
}

function createDefaultForm(startDate: string): EventFormState {
  return {
    name: '',
    kind: 'expense',
    frequency: 'daily',
    amount: 100_000,
    weekendAmount: '',
    startDate,
    timesPerOccurrence: 1,
    intervalDays: 7,
    dayOfMonth: 1,
    monthOfYear: 1,
    weekDays: [1],
  }
}

function loadScenario() {
  const fallback = createDefaultScenario()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw) as ScenarioState
    return {
      ...fallback,
      ...parsed,
      events: Array.isArray(parsed.events) ? parsed.events : fallback.events,
    }
  } catch {
    return fallback
  }
}

function loadLocale(): Locale {
  const raw = window.localStorage.getItem(STORAGE_LOCALE_KEY)
  return raw === 'en' ? 'en' : 'vi'
}

function formatCompactVnd(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function parseDigits(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  return digitsOnly === '' ? 0 : Number(digitsOnly)
}

function App() {
  const [locale, setLocale] = useState<Locale>(() => loadLocale())
  const [scenario, setScenario] = useState<ScenarioState>(() => loadScenario())
  const [groupMode, setGroupMode] = useState<GroupMode>('day')
  const [form, setForm] = useState<EventFormState>(() => createDefaultForm(DEFAULT_START_DATE))
  const t = translations[locale]
  const weekdayOptions = WEEKDAY_LABELS[locale].map((label, index) => ({
    value: index === 0 ? 0 : index,
    label,
  }))
  const groupOptions: Array<{ value: GroupMode; label: string }> = [
    { value: 'day', label: GROUP_LABELS[locale].day },
    { value: 'week', label: GROUP_LABELS[locale].week },
    { value: 'month', label: GROUP_LABELS[locale].month },
  ]

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario))
  }, [scenario])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_LOCALE_KEY, locale)
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    setForm((current) => ({
      ...current,
      startDate: current.startDate || scenario.startDate,
    }))
  }, [scenario.startDate])

  const dailyPoints = useMemo(
    () =>
      buildDailyCashflow({
        initialBalance: scenario.initialBalance,
        startDate: scenario.startDate,
        forecastDays: scenario.forecastDays,
        events: scenario.events,
      }),
    [scenario],
  )

  const summary = useMemo(() => getScenarioSummary(dailyPoints), [dailyPoints])

  const chartPoints = useMemo(
    () => groupChartPoints(dailyPoints, groupMode),
    [dailyPoints, groupMode],
  )

  const upcomingPoints = useMemo(() => {
    const future = listUpcomingActivity(dailyPoints)
    return future.length > 0 ? future : dailyPoints.filter((point) => point.occurrences.length > 0).slice(0, 10)
  }, [dailyPoints])

  const netChange = summary.endingBalance - scenario.initialBalance

  const chartOption = useMemo<EChartsOption>(() => {
    const seriesData = chartPoints.map((point) => ({
      value: point.balance,
      displayLabel: point.label,
      date: point.date,
      delta: point.delta,
      occurrenceCount: point.occurrenceCount,
    }))

    return {
      backgroundColor: 'transparent',
      animationDuration: 500,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172acc',
        borderWidth: 0,
        textStyle: {
          color: '#e2e8f0',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        formatter: (rawParams) => {
          const param = Array.isArray(rawParams) ? rawParams[0] : rawParams
          const data = param?.data as
            | {
                value: number
                displayLabel: string
                date: string
                delta: number
                occurrenceCount: number
              }
            | undefined

          if (!data) {
            return ''
          }

          return [
            `<div style="min-width:180px">`,
            `<div style="font-size:12px;color:#94a3b8">${data.date}</div>`,
            `<div style="font-size:16px;font-weight:700;margin-top:4px">${formatVnd(data.value, locale)}</div>`,
            `<div style="margin-top:6px">${t.tooltipNetChange}: ${formatVnd(data.delta, locale)}</div>`,
            `<div style="margin-top:2px">${t.tooltipEvents}: ${data.occurrenceCount}</div>`,
            `</div>`,
          ].join('')
        },
      },
      grid: {
        left: 12,
        right: 12,
        top: 24,
        bottom: 88,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: chartPoints.map((point) => point.label),
        axisLabel: {
          color: '#64748b',
        },
        axisLine: {
          lineStyle: {
            color: '#cbd5e1',
          },
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b',
          formatter: (value: number) => formatCompactVnd(value, locale),
        },
        splitLine: {
          lineStyle: {
            color: '#e2e8f0',
          },
        },
      },
      dataZoom: [
        {
          type: 'inside',
          zoomLock: false,
          minValueSpan: 3,
        },
        {
          type: 'slider',
          height: 24,
          bottom: 26,
          brushSelect: false,
        },
      ],
      series: [
        {
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 4,
            color: '#2563eb',
          },
          areaStyle: {
            color: 'rgba(37, 99, 235, 0.12)',
          },
          emphasis: {
            focus: 'series',
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#f97316',
              type: 'dashed',
            },
            data: [{ yAxis: 0 }],
          },
          data: seriesData,
        },
      ],
    }
  }, [chartPoints, locale, t.tooltipEvents, t.tooltipNetChange])

  function updateForm<K extends keyof EventFormState>(key: K, value: EventFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleWeekday(day: number) {
    setForm((current) => {
      const exists = current.weekDays.includes(day)
      return {
        ...current,
        weekDays: exists
          ? current.weekDays.filter((item) => item !== day)
          : [...current.weekDays, day].sort((a, b) => a - b),
      }
    })
  }

  function addEvent() {
    const name = form.name.trim() || t.newEvent
    const event: CashflowEvent = {
      id: crypto.randomUUID(),
      name,
      kind: form.kind,
      frequency: form.frequency,
      amount: Math.max(0, form.amount),
      startDate: form.startDate,
      enabled: true,
      timesPerOccurrence: Math.max(1, form.timesPerOccurrence),
    }

    if (form.frequency === 'daily' && form.weekendAmount) {
      event.weekendAmount = Math.max(0, Number(form.weekendAmount))
    }

    if (form.frequency === 'weekly') {
      event.weekDays = form.weekDays.length > 0 ? form.weekDays : [1]
    }

    if (form.frequency === 'monthly' || form.frequency === 'yearly') {
      event.dayOfMonth = form.dayOfMonth
    }

    if (form.frequency === 'yearly') {
      event.monthOfYear = form.monthOfYear
    }

    if (form.frequency === 'custom') {
      event.intervalDays = Math.max(1, form.intervalDays)
    }

    setScenario((current) => ({
      ...current,
      events: [event, ...current.events],
    }))
    setForm(createDefaultForm(scenario.startDate))
  }

  function toggleEvent(eventId: string) {
    setScenario((current) => ({
      ...current,
      events: current.events.map((event) =>
        event.id === eventId ? { ...event, enabled: !event.enabled } : event,
      ),
    }))
  }

  function removeEvent(eventId: string) {
    setScenario((current) => ({
      ...current,
      events: current.events.filter((event) => event.id !== eventId),
    }))
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <div className="hero-topline">
            <span className="eyebrow">{t.heroEyebrow}</span>
            <div className="segment segment-compact">
              {LOCALE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={option.value === locale ? 'is-active' : ''}
                  onClick={() => setLocale(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <h1>{t.heroTitle}</h1>
          <p className="hero-copy">{t.heroDescription(formatCurrency(scenario.initialBalance, locale))}</p>
        </div>

        <div className="hero-metrics">
          <article className="metric-card">
            <span>{t.endingBalance}</span>
            <strong>{formatVnd(summary.endingBalance, locale)}</strong>
            <small>
              {netChange >= 0 ? t.increase : t.decrease}{' '}
              {formatVnd(Math.abs(netChange), locale)}
            </small>
          </article>
          <article className="metric-card">
            <span>{t.lowestPoint}</span>
            <strong>{formatVnd(summary.lowestBalance, locale)}</strong>
            <small>
              {summary.firstNegativeDay === null
                ? t.notNegativeYet
                : t.negativeFromDay(summary.firstNegativeDay)}
            </small>
          </article>
          <article className="metric-card">
            <span>{t.forecastHorizon}</span>
            <strong>
              {scenario.forecastDays} {t.days}
            </strong>
            <small>{t.activeEvents(scenario.events.filter((event) => event.enabled).length)}</small>
          </article>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="stack">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>{t.scenario}</h2>
                <p>{t.scenarioDescription}</p>
              </div>
            </div>

            <div className="control-grid">
              <label className="field">
                <span>{t.startDate}</span>
                <input
                  type="date"
                  value={scenario.startDate}
                  onChange={(event) =>
                    setScenario((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>{t.initialBalance}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumericInput(scenario.initialBalance, locale)}
                  onChange={(event) =>
                    setScenario((current) => ({
                      ...current,
                      initialBalance: parseDigits(event.target.value),
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>{t.forecastDays}</span>
                <input
                  type="number"
                  min="30"
                  max="1825"
                  step="30"
                  value={scenario.forecastDays}
                  onChange={(event) =>
                    setScenario((current) => ({
                      ...current,
                      forecastDays: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>{t.cashflowChart}</h2>
                <p>{t.chartDescription}</p>
              </div>

              <div className="segment">
                {groupOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={option.value === groupMode ? 'is-active' : ''}
                    onClick={() => setGroupMode(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <ReactECharts className="chart" option={chartOption} notMerge opts={{ renderer: 'svg' }} />
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>{t.upcomingActivity}</h2>
                <p>{t.upcomingDescription}</p>
              </div>
            </div>

            <div className="timeline">
              {upcomingPoints.length === 0 ? (
                <div className="timeline-item">
                  <p>{t.noUpcomingActivity}</p>
                </div>
              ) : (
                upcomingPoints.map((point) => (
                  <div key={point.date} className="timeline-item">
                    <div>
                      <strong>{point.date}</strong>
                      <p>
                        {point.occurrences
                          .map((occurrence) =>
                            getEventDisplayName(occurrence.eventId, occurrence.name, locale),
                          )
                          .join(', ')}
                      </p>
                    </div>
                    <div className={point.delta >= 0 ? 'delta positive' : 'delta negative'}>
                      {formatVnd(point.delta, locale)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <div className="stack">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>{t.addEvent}</h2>
                <p>{t.addEventDescription}</p>
              </div>
            </div>

            <div className="form-grid">
              <label className="field field-span-2">
                <span>{t.eventName}</span>
                <input
                  type="text"
                  placeholder={t.eventNamePlaceholder}
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                />
              </label>

              <label className="field">
                <span>{t.type}</span>
                <select
                  value={form.kind}
                  onChange={(event) => updateForm('kind', event.target.value as EventKind)}
                >
                  <option value="expense">{KIND_LABELS[locale].expense}</option>
                  <option value="income">{KIND_LABELS[locale].income}</option>
                </select>
              </label>

              <label className="field">
                <span>{t.frequency}</span>
                <select
                  value={form.frequency}
                  onChange={(event) =>
                    updateForm('frequency', event.target.value as EventFrequency)
                  }
                >
                  <option value="daily">{FREQUENCY_LABELS[locale].daily}</option>
                  <option value="weekly">{FREQUENCY_LABELS[locale].weekly}</option>
                  <option value="monthly">{FREQUENCY_LABELS[locale].monthly}</option>
                  <option value="yearly">{FREQUENCY_LABELS[locale].yearly}</option>
                  <option value="custom">{FREQUENCY_LABELS[locale].custom}</option>
                </select>
              </label>

              <label className="field">
                <span>{t.amountPerOccurrence}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumericInput(form.amount, locale)}
                  onChange={(event) => updateForm('amount', parseDigits(event.target.value))}
                />
              </label>

              <label className="field">
                <span>{t.startDate}</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => updateForm('startDate', event.target.value)}
                />
              </label>

              <label className="field">
                <span>{t.timesPerOccurrence}</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.timesPerOccurrence}
                  onChange={(event) =>
                    updateForm('timesPerOccurrence', Number(event.target.value))
                  }
                />
              </label>

              {form.frequency === 'daily' && (
                <label className="field">
                  <span>{t.weekendAmountOptional}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={t.differentFromWeekdayAmount}
                    value={formatNumericInput(form.weekendAmount, locale)}
                    onChange={(event) =>
                      updateForm('weekendAmount', event.target.value.replace(/\D/g, ''))
                    }
                  />
                </label>
              )}

              {form.frequency === 'weekly' && (
                <div className="field field-span-2">
                  <span>{t.weekdays}</span>
                  <div className="weekday-picker">
                    {weekdayOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={form.weekDays.includes(option.value) ? 'is-active' : ''}
                        onClick={() => toggleWeekday(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {form.frequency === 'custom' && (
                <label className="field">
                  <span>{t.everyNDays}</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.intervalDays}
                    onChange={(event) => updateForm('intervalDays', Number(event.target.value))}
                  />
                </label>
              )}

              {(form.frequency === 'monthly' || form.frequency === 'yearly') && (
                <label className="field">
                  <span>{t.dayOfMonth}</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={form.dayOfMonth}
                    onChange={(event) => updateForm('dayOfMonth', Number(event.target.value))}
                  />
                </label>
              )}

              {form.frequency === 'yearly' && (
                <label className="field">
                  <span>{t.month}</span>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="1"
                    value={form.monthOfYear}
                    onChange={(event) => updateForm('monthOfYear', Number(event.target.value))}
                  />
                </label>
              )}
            </div>

            <button type="button" className="primary-button" onClick={addEvent}>
              {t.addToScenario}
            </button>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>{t.activeEventsTitle}</h2>
                <p>{t.defaultEventsDescription}</p>
              </div>
            </div>

            <div className="event-list">
              {scenario.events.map((event) => (
                <article key={event.id} className={`event-card ${event.enabled ? '' : 'is-disabled'}`}>
                  <div className="event-topline">
                    <div>
                      <h3>{getEventDisplayName(event.id, event.name, locale)}</h3>
                      <p>{formatEventRule(event, locale)}</p>
                    </div>
                    <span className={event.kind === 'income' ? 'pill income' : 'pill expense'}>
                      {KIND_LABELS[locale][event.kind]}
                    </span>
                  </div>

                  <div className="event-actions">
                    <button type="button" onClick={() => toggleEvent(event.id)}>
                      {event.enabled ? t.disable : t.enable}
                    </button>
                    <button type="button" className="ghost-danger" onClick={() => removeEvent(event.id)}>
                      {t.delete}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}

export default App
