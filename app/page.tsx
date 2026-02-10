'use client'

import { useState, useEffect } from 'react'
import { callAIAgent, extractText } from '@/lib/aiAgent'
import {
  getSchedule,
  getScheduleLogs,
  pauseSchedule,
  resumeSchedule,
  triggerScheduleNow,
  cronToHuman,
  type Schedule,
  type ExecutionLog,
} from '@/lib/scheduler'
import { IoAdd, IoSettingsSharp, IoTrash, IoRefresh, IoTime, IoTrendingUp, IoCheckmark, IoSend, IoChevronDown, IoChevronUp, IoAlertCircle, IoSearch, IoPlay, IoEye } from 'react-icons/io5'
import { HiOutlineChartBar, HiOutlineLightningBolt } from 'react-icons/hi'
import { MdSchedule } from 'react-icons/md'
import { CgSpinner } from 'react-icons/cg'
import { VscPulse } from 'react-icons/vsc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const AGENT_ID = '698b62de08cfa4d9edb130ee'
const SCHEDULE_ID = '698b62f0ebe6fd87d1dcc0cd'

// Theme is applied via globals.css — Dashboard Pro theme

const COMMON_TICKERS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']

const SAMPLE_STOCKS = ['AAPL', 'MSFT', 'GOOGL']

const SAMPLE_ANALYSIS = `# Morning Stock Digest Analysis - Sample

## Portfolio Overview

| Stock | Current Price | Change | Status |
|-------|---------------|--------|--------|
| AAPL | $278.12 | +0.80% | Slight Strength |
| MSFT | $401.14 | +0.45% | Stable |
| GOOGL | $324.32 | +0.39% | Stable |

---

## Individual Stock Analysis

### **Apple Inc. (AAPL)**

**Current Metrics:**
- **Price:** $278.12
- **Day Range:** $275.50-$280.00
- **52-Week Range:** $164.08-$283.00

**Recommendation: HOLD** -- Strong fundamentals with moderate upside potential.

---

### **Microsoft Corp. (MSFT)**

**Current Metrics:**
- **Price:** $401.14
- **Day Range:** $398.00-$404.50

**Recommendation: HOLD** -- Solid position with cloud growth momentum.

---

### **Alphabet Inc. (GOOGL)**

**Current Metrics:**
- **Price:** $324.32
- **Day Range:** $317.26-$327.70

**Recommendation: HOLD** -- Strong ROE of 36.02% supports valuation.`

function renderMarkdown(md: string): React.ReactNode {
  if (!md) return null
  const lines = md.split('\n')
  const elements: React.ReactNode[] = []
  let inTable = false
  let tableRows: string[][] = []
  let tableHeader: string[] = []
  let listItems: string[] = []
  let inList = false

  const flushTable = () => {
    if (tableRows.length === 0 && tableHeader.length === 0) return
    elements.push(
      <div key={`table-${elements.length}`} className="overflow-x-auto my-3">
        <table className="w-full text-sm border-collapse">
          {tableHeader.length > 0 && (
            <thead>
              <tr className="border-b border-border">
                {tableHeader.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-foreground bg-muted/50">{h.trim()}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri} className="border-b border-border/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-muted-foreground">{renderInline(cell.trim())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    tableRows = []
    tableHeader = []
    inTable = false
  }

  const flushList = () => {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`list-${elements.length}`} className="my-2 space-y-1 pl-4">
        {listItems.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    )
    listItems = []
    inList = false
  }

  function renderInline(text: string): React.ReactNode {
    if (!text) return text
    const parts: React.ReactNode[] = []
    let remaining = text
    let idx = 0
    const regex = /\*\*(.+?)\*\*/g
    let match
    let lastIndex = 0
    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push(remaining.slice(lastIndex, match.index))
      }
      parts.push(<strong key={idx++} className="font-semibold text-foreground">{match[1]}</strong>)
      lastIndex = regex.lastIndex
    }
    if (lastIndex < remaining.length) {
      parts.push(remaining.slice(lastIndex))
    }
    return parts.length > 0 ? parts : text
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (inList) flushList()
      const segments = trimmed.split('|')
      const cells = segments.filter((_, ci) => ci > 0 && ci < segments.length - 1)
      if (cells.every(c => /^[\s\-:]+$/.test(c))) {
        continue
      }
      if (!inTable) {
        inTable = true
        tableHeader = cells
      } else {
        tableRows.push(cells)
      }
      continue
    } else if (inTable) {
      flushTable()
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (inTable) flushTable()
      inList = true
      listItems.push(trimmed.slice(2))
      continue
    } else if (inList) {
      flushList()
    }

    if (trimmed === '---' || trimmed === '***') {
      elements.push(<Separator key={`sep-${i}`} className="my-4" />)
      continue
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-base font-semibold text-foreground mt-4 mb-1 tracking-tight">{renderInline(trimmed.slice(4))}</h3>
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg font-semibold text-foreground mt-5 mb-2 tracking-tight">{renderInline(trimmed.slice(3))}</h2>
      )
      continue
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-xl font-bold text-foreground mt-3 mb-3 tracking-tight">{renderInline(trimmed.slice(2))}</h1>
      )
      continue
    }

    if (trimmed === '') {
      continue
    }

    elements.push(
      <p key={`p-${i}`} className="text-sm text-muted-foreground leading-relaxed my-1">{renderInline(trimmed)}</p>
    )
  }

  if (inTable) flushTable()
  if (inList) flushList()

  return <div className="space-y-0">{elements}</div>
}

export default function Home() {
  const [stocks, setStocks] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('07:00')
  const [userTimezone, setUserTimezone] = useState('')

  const [showSettings, setShowSettings] = useState(false)
  const [showAddStock, setShowAddStock] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [tickerInput, setTickerInput] = useState('')

  const [analysisResult, setAnalysisResult] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [execLogs, setExecLogs] = useState<ExecutionLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [scheduleActionLoading, setScheduleActionLoading] = useState(false)

  const [sampleMode, setSampleMode] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('stock_watchlist')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setStocks(parsed)
      }
      const savedEmail = localStorage.getItem('stock_email')
      if (savedEmail) setEmail(savedEmail)
      const savedTime = localStorage.getItem('stock_delivery_time')
      if (savedTime) setDeliveryTime(savedTime)
    } catch {
      // ignore parse errors
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('stock_watchlist', JSON.stringify(stocks))
    } catch {
      // ignore
    }
  }, [stocks])

  useEffect(() => {
    fetchScheduleData()
  }, [])

  const fetchScheduleData = async () => {
    setScheduleLoading(true)
    setScheduleError('')
    try {
      const result = await getSchedule(SCHEDULE_ID)
      if (result.success && result.schedule) {
        setSchedule(result.schedule)
      } else {
        setScheduleError(result.error ?? 'Failed to fetch schedule')
      }
    } catch {
      setScheduleError('Failed to load schedule')
    }
    setScheduleLoading(false)
  }

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      const result = await getScheduleLogs(SCHEDULE_ID, { limit: 10 })
      if (result.success) {
        setExecLogs(Array.isArray(result.executions) ? result.executions : [])
      }
    } catch {
      // ignore
    }
    setLogsLoading(false)
  }

  const handleToggleSchedule = async () => {
    if (!schedule) return
    setScheduleActionLoading(true)
    try {
      const result = schedule.is_active
        ? await pauseSchedule(SCHEDULE_ID)
        : await resumeSchedule(SCHEDULE_ID)
      if (result.success) {
        setSchedule(prev => prev ? { ...prev, is_active: !prev.is_active } : prev)
        setStatusMsg(schedule.is_active ? 'Schedule paused' : 'Schedule resumed')
        setTimeout(() => setStatusMsg(''), 3000)
      }
    } catch {
      setStatusMsg('Failed to toggle schedule')
      setTimeout(() => setStatusMsg(''), 3000)
    }
    setScheduleActionLoading(false)
  }

  const handleTriggerNow = async () => {
    setScheduleActionLoading(true)
    try {
      const result = await triggerScheduleNow(SCHEDULE_ID)
      if (result.success) {
        setStatusMsg('Schedule triggered successfully')
      } else {
        setStatusMsg('Failed to trigger schedule')
      }
    } catch {
      setStatusMsg('Trigger failed')
    }
    setTimeout(() => setStatusMsg(''), 3000)
    setScheduleActionLoading(false)
  }

  const addStock = (ticker: string) => {
    const clean = ticker.trim().toUpperCase()
    if (clean && !stocks.includes(clean)) {
      setStocks(prev => [...prev, clean])
    }
    setTickerInput('')
  }

  const removeStock = (ticker: string) => {
    setStocks(prev => prev.filter(s => s !== ticker))
  }

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('stock_email', email)
      localStorage.setItem('stock_delivery_time', deliveryTime)
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleTestDigest = async () => {
    const activeStocks = sampleMode ? SAMPLE_STOCKS : stocks
    if (activeStocks.length === 0) {
      setAnalysisError('Add stocks to your watchlist first.')
      setShowAnalysis(true)
      return
    }
    setAnalysisLoading(true)
    setAnalysisError('')
    setAnalysisResult('')
    setShowAnalysis(true)
    setActiveAgentId(AGENT_ID)

    const message = `Analyze the following stocks and provide a morning digest summary: ${activeStocks.join(', ')}. Include current price movements, technical indicators, news sentiment, and buy/hold/sell recommendations for each. Do NOT send any email, just provide the analysis.`

    try {
      const result = await callAIAgent(message, AGENT_ID)
      if (result.success) {
        let text = ''
        const r = result?.response?.result
        const msg = result?.response?.message
        if (typeof msg === 'string' && msg.length > 0) {
          text = msg
        } else if (typeof r === 'string') {
          text = r
        } else if (r?.response && typeof r.response === 'string') {
          text = r.response
        } else if (r?.text && typeof r.text === 'string') {
          text = r.text
        } else if (r?.raw_text && typeof r.raw_text === 'string') {
          text = r.raw_text
        } else {
          text = extractText(result.response) || ''
        }
        // Last resort: try parsing raw_response if we still have no text
        if (!text && result.raw_response) {
          try {
            const rawParsed = typeof result.raw_response === 'string' ? JSON.parse(result.raw_response) : result.raw_response
            if (typeof rawParsed?.response === 'string') {
              text = rawParsed.response
            } else if (typeof rawParsed === 'string') {
              text = rawParsed
            }
          } catch {
            if (typeof result.raw_response === 'string') {
              text = result.raw_response
            }
          }
        }
        if (text) {
          setAnalysisResult(text)
        } else {
          setAnalysisError('Received empty analysis from agent. Please try again.')
        }
      } else {
        setAnalysisError(result?.error ?? 'Failed to get analysis from agent.')
      }
    } catch {
      setAnalysisError('Network error. Please try again.')
    }
    setAnalysisLoading(false)
    setActiveAgentId(null)
  }

  const displayStocks = sampleMode ? SAMPLE_STOCKS : stocks
  const displayAnalysis = sampleMode && !analysisResult ? SAMPLE_ANALYSIS : analysisResult

  const timeOptions = [
    '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00'
  ]

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <HiOutlineChartBar className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight leading-none">Stock Analysis Morning Digest</h1>
              <p className="text-xs text-muted-foreground mt-0.5">AI-powered daily market analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Sample Data</Label>
              <Switch id="sample-toggle" checked={sampleMode} onCheckedChange={setSampleMode} />
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowSettings(true)}>
              <IoSettingsSharp className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Status message */}
      {statusMsg && (
        <div className="max-w-5xl mx-auto px-4 mt-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 text-sm text-primary">
            <IoCheckmark className="w-4 h-4" />
            {statusMsg}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-4">
        <Tabs defaultValue="watchlist" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="watchlist" className="text-sm gap-1.5">
              <IoTrendingUp className="w-3.5 h-3.5" />
              Watchlist
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-sm gap-1.5">
              <MdSchedule className="w-3.5 h-3.5" />
              Schedule
            </TabsTrigger>
          </TabsList>

          {/* Watchlist Tab */}
          <TabsContent value="watchlist" className="mt-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Your Watchlist</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{displayStocks.length} stock{displayStocks.length !== 1 ? 's' : ''} tracked</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={handleTestDigest} disabled={analysisLoading || displayStocks.length === 0}>
                  {analysisLoading ? <CgSpinner className="w-3.5 h-3.5 animate-spin" /> : <HiOutlineLightningBolt className="w-3.5 h-3.5" />}
                  Run Analysis
                </Button>
                <Button size="sm" className="text-xs h-8 gap-1.5" onClick={() => setShowAddStock(true)}>
                  <IoAdd className="w-3.5 h-3.5" />
                  Add Stock
                </Button>
              </div>
            </div>

            {displayStocks.length === 0 ? (
              <Card className="border border-border shadow-none">
                <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center mb-3">
                    <HiOutlineChartBar className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Add your first stock</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mb-4">Build your watchlist to receive AI-powered morning digest analysis with price movements, technical indicators, and recommendations.</p>
                  <Button size="sm" className="text-xs h-8 gap-1.5" onClick={() => setShowAddStock(true)}>
                    <IoAdd className="w-3.5 h-3.5" />
                    Add Stock
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayStocks.map(ticker => (
                  <Card key={ticker} className="border border-border shadow-none group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-mono font-semibold text-sm px-2.5 py-0.5">{ticker}</Badge>
                        <div className="w-2 h-2 rounded-full bg-accent" title="Active" />
                      </div>
                      {!sampleMode && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive" onClick={() => removeStock(ticker)}>
                          <IoTrash className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Analysis result inline (if available) */}
            {displayAnalysis && !showAnalysis && (
              <Card className="mt-4 border border-border shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <VscPulse className="w-4 h-4 text-primary" />
                      Latest Analysis
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowAnalysis(true)}>
                      <IoEye className="w-3.5 h-3.5" />
                      Expand
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-hidden relative">
                    {renderMarkdown(displayAnalysis)}
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent" />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="mt-0">
            <div className="space-y-4">
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <IoTime className="w-4 h-4 text-primary" />
                    Schedule Configuration
                  </CardTitle>
                  <CardDescription className="text-xs">Automated daily stock analysis delivery</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {scheduleLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CgSpinner className="w-4 h-4 animate-spin" />
                      Loading schedule...
                    </div>
                  ) : scheduleError ? (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <IoAlertCircle className="w-4 h-4" />
                      {scheduleError}
                      <Button variant="ghost" size="sm" className="text-xs h-7 ml-2" onClick={fetchScheduleData}>
                        <IoRefresh className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <div className="flex items-center gap-3">
                            <Switch checked={schedule?.is_active ?? false} onCheckedChange={handleToggleSchedule} disabled={scheduleActionLoading} />
                            <Badge variant={schedule?.is_active ? 'default' : 'secondary'} className="text-xs">
                              {schedule?.is_active ? 'Active' : 'Paused'}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Frequency</Label>
                          <p className="text-sm font-medium text-foreground">{cronToHuman(schedule?.cron_expression ?? '0 7 * * *')}</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Timezone</Label>
                          <p className="text-sm text-foreground">{schedule?.timezone ?? 'America/New_York'}</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Next Run</Label>
                          <p className="text-sm text-foreground">{schedule?.next_run_time ? new Date(schedule.next_run_time).toLocaleString() : 'N/A'}</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Last Run</Label>
                          <p className="text-sm text-foreground">{schedule?.last_run_at ? new Date(schedule.last_run_at).toLocaleString() : 'Never'}</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Last Run Status</Label>
                          {schedule?.last_run_success === null ? (
                            <p className="text-sm text-muted-foreground">N/A</p>
                          ) : (
                            <Badge variant={schedule?.last_run_success ? 'default' : 'destructive'} className="text-xs">
                              {schedule?.last_run_success ? 'Success' : 'Failed'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Separator />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={handleTriggerNow} disabled={scheduleActionLoading}>
                          {scheduleActionLoading ? <CgSpinner className="w-3.5 h-3.5 animate-spin" /> : <IoPlay className="w-3.5 h-3.5" />}
                          Run Now
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={fetchScheduleData} disabled={scheduleLoading}>
                          <IoRefresh className="w-3.5 h-3.5" />
                          Refresh
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Execution Logs */}
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <VscPulse className="w-4 h-4 text-primary" />
                      Execution History
                    </CardTitle>
                    <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => { setShowLogs(!showLogs); if (!showLogs) fetchLogs(); }}>
                      {showLogs ? <IoChevronUp className="w-3.5 h-3.5" /> : <IoChevronDown className="w-3.5 h-3.5" />}
                      {showLogs ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </CardHeader>
                {showLogs && (
                  <CardContent>
                    {logsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <CgSpinner className="w-4 h-4 animate-spin" />
                        Loading logs...
                      </div>
                    ) : execLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No execution logs found.</p>
                    ) : (
                      <ScrollArea className="max-h-64">
                        <div className="space-y-2">
                          {execLogs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 border border-border/50 text-xs">
                              <div className="flex items-center gap-3">
                                <Badge variant={log.success ? 'default' : 'destructive'} className="text-xs px-1.5 py-0">
                                  {log.success ? 'OK' : 'FAIL'}
                                </Badge>
                                <span className="text-muted-foreground">{new Date(log.executed_at).toLocaleString()}</span>
                              </div>
                              <span className="text-muted-foreground">Attempt {log.attempt}/{log.max_attempts}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Agent Info */}
        <Card className="mt-6 border border-border shadow-none">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-xs font-medium text-foreground">Stock Analysis Agent</span>
                <span className="text-xs text-muted-foreground">(Perplexity sonar-reasoning-pro)</span>
              </div>
              <div className="flex items-center gap-2">
                {activeAgentId === AGENT_ID && (
                  <Badge variant="outline" className="text-xs gap-1 animate-pulse">
                    <CgSpinner className="w-3 h-3 animate-spin" />
                    Processing
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground font-mono">{AGENT_ID.slice(0, 12)}...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Floating Add Button (mobile) */}
      <button className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity sm:hidden z-50" onClick={() => setShowAddStock(true)}>
        <IoAdd className="w-5 h-5" />
      </button>

      {/* Add Stock Dialog */}
      <Dialog open={showAddStock} onOpenChange={setShowAddStock}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add Stock</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Enter a ticker symbol or choose from popular stocks.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <IoSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9 text-sm h-9" placeholder="Enter ticker symbol (e.g., AAPL)" value={tickerInput} onChange={(e) => setTickerInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter' && tickerInput.trim()) { addStock(tickerInput); setShowAddStock(false); } }} />
              </div>
              <Button size="sm" className="h-9 text-xs" disabled={!tickerInput.trim()} onClick={() => { addStock(tickerInput); setShowAddStock(false); }}>
                Add
              </Button>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Popular Tickers</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_TICKERS.map(ticker => {
                  const alreadyAdded = stocks.includes(ticker)
                  return (
                    <Button key={ticker} variant={alreadyAdded ? 'secondary' : 'outline'} size="sm" className="text-xs h-7 font-mono" disabled={alreadyAdded} onClick={() => { addStock(ticker); }}>
                      {ticker}
                      {alreadyAdded && <IoCheckmark className="w-3 h-3 ml-1" />}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Settings</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Configure your digest delivery preferences.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="email-input" className="text-xs font-medium">Recipient Email</Label>
              <Input id="email-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="text-sm h-9" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Delivery Time</Label>
              <Select value={deliveryTime} onValueChange={setDeliveryTime}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map(t => (
                    <SelectItem key={t} value={t} className="text-sm">{t.replace(':', ':')} {parseInt(t) < 12 ? 'AM' : 'PM'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Timezone</Label>
              <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 border border-border">{userTimezone || 'Detecting...'}</p>
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button size="sm" className="text-xs h-8 flex-1 gap-1.5" onClick={handleSaveSettings}>
                {settingsSaved ? <IoCheckmark className="w-3.5 h-3.5" /> : null}
                {settingsSaved ? 'Saved' : 'Save Preferences'}
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-8 flex-1 gap-1.5" onClick={() => { setShowSettings(false); handleTestDigest(); }} disabled={analysisLoading}>
                {analysisLoading ? <CgSpinner className="w-3.5 h-3.5 animate-spin" /> : <IoSend className="w-3.5 h-3.5" />}
                Send Test Digest
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analysis Results Dialog */}
      <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <HiOutlineChartBar className="w-4 h-4 text-primary" />
              Stock Analysis Results
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {analysisLoading ? 'Generating analysis...' : 'AI-powered stock analysis and recommendations'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-y-auto pr-2">
            {analysisLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <CgSpinner className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analyzing stocks with AI...</p>
                <p className="text-xs text-muted-foreground">This may take a moment</p>
              </div>
            ) : analysisError ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <IoAlertCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-destructive">{analysisError}</p>
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={handleTestDigest}>
                  <IoRefresh className="w-3.5 h-3.5" />
                  Retry
                </Button>
              </div>
            ) : displayAnalysis ? (
              <div className="pb-4">
                {renderMarkdown(displayAnalysis)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No analysis results yet.</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
