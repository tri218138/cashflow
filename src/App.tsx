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
import type { CashflowEvent, EventFrequency, EventKind, GroupMode } from './types'

const STORAGE_KEY = 'richman-cashflow-scenario-v1'

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
]

const GROUP_OPTIONS: Array<{ value: GroupMode; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

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

function formatCompactVnd(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`
  }
  return `${value}`
}

function parseDigits(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  return digitsOnly === '' ? 0 : Number(digitsOnly)
}

function formatInputNumber(value: number | string) {
  const digitsOnly = `${value}`.replace(/\D/g, '')
  if (digitsOnly === '') {
    return ''
  }

  return new Intl.NumberFormat('vi-VN').format(Number(digitsOnly))
}

function App() {
  const [scenario, setScenario] = useState<ScenarioState>(() => loadScenario())
  const [groupMode, setGroupMode] = useState<GroupMode>('day')
  const [form, setForm] = useState<EventFormState>(() => createDefaultForm(DEFAULT_START_DATE))

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario))
  }, [scenario])

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
            `<div style="font-size:16px;font-weight:700;margin-top:4px">${formatVnd(data.value)}</div>`,
            `<div style="margin-top:6px">Net change: ${formatVnd(data.delta)}</div>`,
            `<div style="margin-top:2px">Events: ${data.occurrenceCount}</div>`,
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
          formatter: (value: number) => formatCompactVnd(value),
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
  }, [chartPoints])

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
    const name = form.name.trim() || 'New event'
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
          <span className="eyebrow">Static React + TypeScript UI</span>
          <h1>Cashflow forecast day-by-day</h1>
          <p className="hero-copy">
            Day 0 bat dau voi {formatVnd(scenario.initialBalance)}. Mỗi event se duoc lap theo
            recurrence rule, tinh lai balance moi ngay va ve thanh 1 line chart co zoom.
          </p>
        </div>

        <div className="hero-metrics">
          <article className="metric-card">
            <span>Ending balance</span>
            <strong>{formatVnd(summary.endingBalance)}</strong>
            <small>{netChange >= 0 ? 'Tang' : 'Giam'} {formatVnd(Math.abs(netChange))}</small>
          </article>
          <article className="metric-card">
            <span>Lowest point</span>
            <strong>{formatVnd(summary.lowestBalance)}</strong>
            <small>{summary.firstNegativeDay === null ? 'Chua am tien' : `Am tien tu day ${summary.firstNegativeDay}`}</small>
          </article>
          <article className="metric-card">
            <span>Forecast horizon</span>
            <strong>{scenario.forecastDays} days</strong>
            <small>{scenario.events.filter((event) => event.enabled).length} active events</small>
          </article>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="stack">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Scenario</h2>
                <p>Tinh theo ngay, hien thi theo day/week/month.</p>
              </div>
            </div>

            <div className="control-grid">
              <label className="field">
                <span>Start date</span>
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
                <span>Initial balance</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatInputNumber(scenario.initialBalance)}
                  onChange={(event) =>
                    setScenario((current) => ({
                      ...current,
                      initialBalance: parseDigits(event.target.value),
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Forecast days</span>
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
                <h2>Cashflow chart</h2>
                <p>Zoom in/out bang mousewheel, pinch, hoac slider ben duoi.</p>
              </div>

              <div className="segment">
                {GROUP_OPTIONS.map((option) => (
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
                <h2>Upcoming activity</h2>
                <p>Cac ngay co event se duoc tong hop nhanh o day.</p>
              </div>
            </div>

            <div className="timeline">
              {upcomingPoints.map((point) => (
                <div key={point.date} className="timeline-item">
                  <div>
                    <strong>{point.date}</strong>
                    <p>{point.occurrences.map((occurrence) => occurrence.name).join(', ')}</p>
                  </div>
                  <div className={point.delta >= 0 ? 'delta positive' : 'delta negative'}>
                    {formatVnd(point.delta)}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="stack">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Add event</h2>
                <p>Ho tro daily, weekly, monthly, yearly va custom interval.</p>
              </div>
            </div>

            <div className="form-grid">
              <label className="field field-span-2">
                <span>Event name</span>
                <input
                  type="text"
                  placeholder="Vi du: Cafe, tien nha, freelance"
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                />
              </label>

              <label className="field">
                <span>Type</span>
                <select
                  value={form.kind}
                  onChange={(event) => updateForm('kind', event.target.value as EventKind)}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>

              <label className="field">
                <span>Frequency</span>
                <select
                  value={form.frequency}
                  onChange={(event) =>
                    updateForm('frequency', event.target.value as EventFrequency)
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              <label className="field">
                <span>Amount / occurrence</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatInputNumber(form.amount)}
                  onChange={(event) => updateForm('amount', parseDigits(event.target.value))}
                />
              </label>

              <label className="field">
                <span>Start date</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => updateForm('startDate', event.target.value)}
                />
              </label>

              <label className="field">
                <span>Times / occurrence</span>
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
                  <span>Weekend amount (optional)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Khac amount thuong"
                    value={formatInputNumber(form.weekendAmount)}
                    onChange={(event) =>
                      updateForm('weekendAmount', event.target.value.replace(/\D/g, ''))
                    }
                  />
                </label>
              )}

              {form.frequency === 'weekly' && (
                <div className="field field-span-2">
                  <span>Weekdays</span>
                  <div className="weekday-picker">
                    {WEEKDAY_OPTIONS.map((option) => (
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
                  <span>Every N days</span>
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
                  <span>Day of month</span>
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
                  <span>Month</span>
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
              Add to scenario
            </button>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Active events</h2>
                <p>Mau du lieu mac dinh da gom tien an, luong va 2 moc sinh nhat.</p>
              </div>
            </div>

            <div className="event-list">
              {scenario.events.map((event) => (
                <article key={event.id} className={`event-card ${event.enabled ? '' : 'is-disabled'}`}>
                  <div className="event-topline">
                    <div>
                      <h3>{event.name}</h3>
                      <p>{formatEventRule(event)}</p>
                    </div>
                    <span className={event.kind === 'income' ? 'pill income' : 'pill expense'}>
                      {event.kind}
                    </span>
                  </div>

                  <div className="event-actions">
                    <button type="button" onClick={() => toggleEvent(event.id)}>
                      {event.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" className="ghost-danger" onClick={() => removeEvent(event.id)}>
                      Delete
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
