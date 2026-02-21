'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { getSchedule, getScheduleLogs, pauseSchedule, resumeSchedule, listSchedules, cronToHuman } from '@/lib/scheduler'
import type { Schedule, ExecutionLog } from '@/lib/scheduler'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MANAGER_AGENT_ID = '6999be50a8fd90224a4a0be2'
const RESEARCH_AGENT_ID = '6999be3155533a893b08f90c'
const EMAIL_AGENT_ID = '6999be4055533a893b08f913'
const SCHEDULE_ID = '6999be56399dfadeac37f243'
const LS_SETTINGS_KEY = 'stockpulse_settings'
const LS_REPORTS_KEY = 'stockpulse_reports'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface StockAnalysis {
  ticker: string
  company_name: string
  current_price: string
  daily_change: string
  weekly_change: string
  key_news: string[]
  analyst_sentiment: string
  notable_events: string
  summary: string
}

interface AnalysisResult {
  analysis_date: string
  stocks_analyzed: StockAnalysis[]
  email_sent: boolean
  recipient: string
  overall_summary: string
}

interface SavedReport {
  id: string
  date: string
  result: AnalysisResult
  expanded: boolean
}

interface AppSettings {
  tickers: string[]
  email: string
}

// ---------------------------------------------------------------------------
// Sample Data
// ---------------------------------------------------------------------------

const SAMPLE_RESULT: AnalysisResult = {
  analysis_date: '2025-01-15',
  stocks_analyzed: [
    {
      ticker: 'AAPL',
      company_name: 'Apple Inc.',
      current_price: '$198.45',
      daily_change: '+1.23%',
      weekly_change: '+3.87%',
      key_news: [
        'Apple Vision Pro pre-orders exceed expectations',
        'Services revenue hits new quarterly record at $23.1B',
        'New M4 chip lineup announced for MacBook Pro refresh',
      ],
      analyst_sentiment: 'Bullish',
      notable_events: 'Q1 2025 earnings report on January 30',
      summary: 'Apple continues to show strong momentum across hardware and services segments. The Vision Pro launch is generating significant consumer interest, while the services business maintains its growth trajectory.',
    },
    {
      ticker: 'MSFT',
      company_name: 'Microsoft Corp.',
      current_price: '$415.20',
      daily_change: '+0.85%',
      weekly_change: '+2.14%',
      key_news: [
        'Azure cloud revenue growth accelerates to 31% YoY',
        'Copilot AI integration drives Office 365 upgrades',
        'Strategic partnership with OpenAI expanded',
      ],
      analyst_sentiment: 'Bullish',
      notable_events: 'AI developer conference scheduled for February',
      summary: 'Microsoft remains a dominant force in enterprise cloud and AI. Azure growth reacceleration and Copilot adoption signal strong demand for AI-powered enterprise solutions.',
    },
    {
      ticker: 'TSLA',
      company_name: 'Tesla Inc.',
      current_price: '$245.80',
      daily_change: '-0.42%',
      weekly_change: '-1.65%',
      key_news: [
        'Cybertruck deliveries ramp to 5,000 units per week',
        'Price cuts in China to maintain market share',
        'FSD v13 rollout begins in select markets',
      ],
      analyst_sentiment: 'Neutral',
      notable_events: 'Annual shareholder meeting in March',
      summary: 'Tesla faces mixed signals with Cybertruck production gains offset by competitive pricing pressure in China. The FSD rollout could be a significant catalyst if adoption accelerates.',
    },
  ],
  email_sent: true,
  recipient: 'investor@example.com',
  overall_summary: 'The portfolio shows positive momentum overall, with technology sector leaders Apple and Microsoft demonstrating strength in AI and cloud computing. Tesla presents a more cautious outlook amid competitive dynamics. Recommended to maintain current positions with attention to upcoming earnings reports.',
}

const SAMPLE_LOGS: ExecutionLog[] = [
  {
    id: 'log-001',
    schedule_id: SCHEDULE_ID,
    agent_id: MANAGER_AGENT_ID,
    user_id: 'user-1',
    session_id: 'sess-1',
    executed_at: '2025-01-14T13:00:00Z',
    attempt: 1,
    max_attempts: 3,
    success: true,
    payload_message: 'Analyze AAPL, MSFT, TSLA',
    response_status: 200,
    response_output: 'Analysis complete',
    error_message: null,
  },
  {
    id: 'log-002',
    schedule_id: SCHEDULE_ID,
    agent_id: MANAGER_AGENT_ID,
    user_id: 'user-1',
    session_id: 'sess-2',
    executed_at: '2025-01-13T13:00:00Z',
    attempt: 1,
    max_attempts: 3,
    success: true,
    payload_message: 'Analyze AAPL, MSFT, TSLA',
    response_status: 200,
    response_output: 'Analysis complete',
    error_message: null,
  },
  {
    id: 'log-003',
    schedule_id: SCHEDULE_ID,
    agent_id: MANAGER_AGENT_ID,
    user_id: 'user-1',
    session_id: 'sess-3',
    executed_at: '2025-01-12T13:00:00Z',
    attempt: 1,
    max_attempts: 3,
    success: false,
    payload_message: 'Analyze AAPL, MSFT, TSLA',
    response_status: 500,
    response_output: '',
    error_message: 'Timeout',
  },
]

// ---------------------------------------------------------------------------
// Markdown Renderer
// ---------------------------------------------------------------------------

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-medium">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-medium text-sm mt-3 mb-1 tracking-[0.1em]">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-medium text-base mt-3 mb-1 tracking-[0.1em]">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-medium text-lg mt-4 mb-2 tracking-[0.1em]">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm font-light leading-[1.8]">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm font-light leading-[1.8]">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm font-light leading-[1.8]">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SVG Icons (inline to avoid external dependencies)
// ---------------------------------------------------------------------------

function IconActivity({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function IconTrendingUp({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function IconTrendingDown({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  )
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function IconPause({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="4" height="16" x="6" y="4" />
      <rect width="4" height="16" x="14" y="4" />
    </svg>
  )
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconX({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function IconChevronUp({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function IconXCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}

function IconBarChart({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  )
}

function IconNewspaper({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8V6Z" />
    </svg>
  )
}

function IconLoader({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`animate-spin ${className ?? ''}`}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-medium mb-2 tracking-[0.1em]">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm font-light">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm tracking-[0.1em]"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSentimentStyle(sentiment: string): string {
  const s = (sentiment ?? '').toLowerCase()
  if (s.includes('bullish')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (s.includes('bearish')) return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

function getChangeDirection(change: string): 'up' | 'down' | 'neutral' {
  if (!change) return 'neutral'
  if (change.startsWith('+')) return 'up'
  if (change.startsWith('-')) return 'down'
  return 'neutral'
}

function isValidEmail(email: string): boolean {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function TickerChip({ ticker, onRemove }: { ticker: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 border border-border bg-secondary text-secondary-foreground text-xs tracking-[0.15em] uppercase font-normal">
      {ticker}
      <button onClick={onRemove} className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors" aria-label={`Remove ${ticker}`}>
        <IconX />
      </button>
    </span>
  )
}

function StockCard({ stock }: { stock: StockAnalysis }) {
  const dailyDir = getChangeDirection(stock?.daily_change ?? '')
  const weeklyDir = getChangeDirection(stock?.weekly_change ?? '')
  const newsItems = Array.isArray(stock?.key_news) ? stock.key_news : []

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3 pt-6 px-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-medium tracking-[0.1em] font-serif">{stock?.ticker ?? 'N/A'}</CardTitle>
              <Badge variant="outline" className={`text-[10px] tracking-[0.15em] uppercase font-normal border ${getSentimentStyle(stock?.analyst_sentiment ?? '')}`}>
                {stock?.analyst_sentiment ?? 'N/A'}
              </Badge>
            </div>
            <CardDescription className="text-xs tracking-[0.1em] font-light mt-1">{stock?.company_name ?? ''}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xl font-normal tracking-[0.05em] font-serif">{stock?.current_price ?? '--'}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-5">
        <div className="flex gap-6">
          <div className="flex items-center gap-1.5 text-sm">
            {dailyDir === 'up' ? <IconTrendingUp className="text-emerald-600" /> : dailyDir === 'down' ? <IconTrendingDown className="text-red-600" /> : <IconActivity className="text-muted-foreground" />}
            <span className="text-muted-foreground font-light tracking-[0.05em] text-xs">Daily</span>
            <span className={`font-normal text-xs tracking-[0.05em] ${dailyDir === 'up' ? 'text-emerald-700' : dailyDir === 'down' ? 'text-red-700' : 'text-foreground'}`}>
              {stock?.daily_change ?? '--'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            {weeklyDir === 'up' ? <IconTrendingUp className="text-emerald-600" /> : weeklyDir === 'down' ? <IconTrendingDown className="text-red-600" /> : <IconActivity className="text-muted-foreground" />}
            <span className="text-muted-foreground font-light tracking-[0.05em] text-xs">Weekly</span>
            <span className={`font-normal text-xs tracking-[0.05em] ${weeklyDir === 'up' ? 'text-emerald-700' : weeklyDir === 'down' ? 'text-red-700' : 'text-foreground'}`}>
              {stock?.weekly_change ?? '--'}
            </span>
          </div>
        </div>

        <Separator />

        {newsItems.length > 0 && (
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2 font-normal flex items-center gap-1.5">
              <IconNewspaper className="w-3 h-3" />
              Key News
            </h4>
            <ul className="space-y-1">
              {newsItems.map((news, idx) => (
                <li key={idx} className="text-xs font-light leading-[1.8] text-foreground pl-3 border-l border-border">
                  {news}
                </li>
              ))}
            </ul>
          </div>
        )}

        {stock?.notable_events && (
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5 font-normal flex items-center gap-1.5">
              <IconCalendar className="w-3 h-3" />
              Notable Events
            </h4>
            <p className="text-xs font-light leading-[1.8] text-foreground">{stock.notable_events}</p>
          </div>
        )}

        {stock?.summary && (
          <div className="bg-secondary/50 p-4 border border-border">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5 font-normal">Summary</h4>
            <div className="text-xs font-light leading-[1.8] text-foreground">{renderMarkdown(stock.summary)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReportCard({ report, onToggle }: { report: SavedReport; onToggle: () => void }) {
  const stocks = Array.isArray(report?.result?.stocks_analyzed) ? report.result.stocks_analyzed : []
  const tickers = stocks.map((s) => s?.ticker ?? '').filter(Boolean)

  return (
    <Card className="border border-border shadow-sm">
      <button onClick={onToggle} className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconCalendar className="w-3.5 h-3.5" />
            <span className="text-xs tracking-[0.1em] font-light">{report?.date ?? 'Unknown date'}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {tickers.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] tracking-[0.15em] uppercase font-normal">
                {t}
              </Badge>
            ))}
          </div>
          {report?.result?.email_sent && (
            <Badge variant="secondary" className="text-[10px] tracking-[0.12em] font-normal flex items-center gap-1">
              <IconMail className="w-3 h-3" />
              Sent
            </Badge>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          {report?.expanded ? <IconChevronUp /> : <IconChevronDown />}
        </div>
      </button>
      {report?.expanded && (
        <div className="px-6 pb-6 space-y-6">
          <Separator />
          {report?.result?.overall_summary && (
            <div className="bg-secondary/40 p-4 border border-border">
              <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2 font-normal">Overall Summary</h4>
              <div className="text-sm font-light leading-[1.8]">{renderMarkdown(report.result.overall_summary)}</div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stocks.map((stock, idx) => (
              <StockCard key={stock?.ticker ?? idx} stock={stock} />
            ))}
          </div>
          {report?.result?.recipient && (
            <p className="text-xs text-muted-foreground font-light tracking-[0.1em] flex items-center gap-1.5">
              <IconMail className="w-3 h-3" />
              Delivered to {report.result.recipient}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function SchedulePanel({
  schedule,
  logs,
  logsLoading,
  scheduleLoading,
  onToggleSchedule,
  onRefreshLogs,
  useSampleData,
}: {
  schedule: Schedule | null
  logs: ExecutionLog[]
  logsLoading: boolean
  scheduleLoading: boolean
  onToggleSchedule: () => void
  onRefreshLogs: () => void
  useSampleData: boolean
}) {
  const displayLogs = useSampleData ? SAMPLE_LOGS : logs
  const isActive = schedule?.is_active ?? false
  const cronExpr = schedule?.cron_expression ?? '0 8 * * *'

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3 pt-6 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconClock className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium tracking-[0.1em] uppercase">Daily Schedule</CardTitle>
          </div>
          <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px] tracking-[0.15em] uppercase font-normal">
            {isActive ? 'Active' : 'Paused'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-light tracking-[0.1em]">
              {cronExpr ? cronToHuman(cronExpr) : 'No schedule'} (ET)
            </p>
            {schedule?.next_run_time && (
              <p className="text-xs text-muted-foreground font-light tracking-[0.05em]">
                Next run: {new Date(schedule.next_run_time).toLocaleString()}
              </p>
            )}
          </div>
          <Button
            variant={isActive ? 'outline' : 'default'}
            size="sm"
            onClick={onToggleSchedule}
            disabled={scheduleLoading}
            className="text-xs tracking-[0.1em] uppercase font-normal"
          >
            {scheduleLoading ? (
              <IconLoader className="w-3.5 h-3.5" />
            ) : isActive ? (
              <>
                <IconPause className="w-3.5 h-3.5 mr-1.5" />
                Pause
              </>
            ) : (
              <>
                <IconPlay className="w-3.5 h-3.5 mr-1.5" />
                Resume
              </>
            )}
          </Button>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-normal">Run History</h4>
            <button onClick={onRefreshLogs} disabled={logsLoading} className="text-muted-foreground hover:text-foreground transition-colors">
              <IconRefresh className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {displayLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground font-light tracking-[0.1em]">No execution history yet.</p>
          ) : (
            <div className="space-y-2">
              {displayLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    {log.success ? <IconCheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <IconXCircle className="w-3.5 h-3.5 text-red-500" />}
                    <span className="text-xs font-light tracking-[0.05em]">
                      {new Date(log.executed_at).toLocaleString()}
                    </span>
                  </div>
                  <Badge variant={log.success ? 'secondary' : 'destructive'} className="text-[10px] tracking-[0.1em] font-normal">
                    {log.success ? 'Success' : 'Failed'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function Page() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard')
  const [useSampleData, setUseSampleData] = useState(false)

  // Settings
  const [settings, setSettings] = useState<AppSettings>({ tickers: [], email: '' })
  const [tickerInput, setTickerInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [settingsMsg, setSettingsMsg] = useState('')

  // Reports
  const [reports, setReports] = useState<SavedReport[]>([])

  // Analysis
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [latestResult, setLatestResult] = useState<AnalysisResult | null>(null)

  // Schedule
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [scheduleLogs, setScheduleLogs] = useState<ExecutionLog[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)

  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const savedSettings = localStorage.getItem(LS_SETTINGS_KEY)
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings) as AppSettings
        setSettings(parsed)
        setEmailInput(parsed.email ?? '')
      }
    } catch {
      // ignore
    }
    try {
      const savedReports = localStorage.getItem(LS_REPORTS_KEY)
      if (savedReports) {
        const parsed = JSON.parse(savedReports) as SavedReport[]
        if (Array.isArray(parsed)) {
          setReports(parsed.map((r) => ({ ...r, expanded: false })))
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // Load schedule on mount
  useEffect(() => {
    async function loadSchedule() {
      setScheduleLoading(true)
      try {
        const result = await getSchedule(SCHEDULE_ID)
        if (result.success && result.schedule) {
          setSchedule(result.schedule)
        }
      } catch {
        // ignore
      }
      setScheduleLoading(false)
    }
    loadSchedule()
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const result = await getScheduleLogs(SCHEDULE_ID, { limit: 5 })
      if (result.success) {
        setScheduleLogs(result.executions)
      }
    } catch {
      // ignore
    }
    setLogsLoading(false)
  }, [])

  const refreshScheduleState = useCallback(async () => {
    try {
      const result = await listSchedules()
      if (result.success && Array.isArray(result.schedules)) {
        const found = result.schedules.find((s) => s.id === SCHEDULE_ID)
        if (found) {
          setSchedule(found)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const handleToggleSchedule = useCallback(async () => {
    if (!schedule) return
    setScheduleLoading(true)
    try {
      if (schedule.is_active) {
        await pauseSchedule(SCHEDULE_ID)
      } else {
        await resumeSchedule(SCHEDULE_ID)
      }
      await refreshScheduleState()
    } catch {
      // ignore
    }
    setScheduleLoading(false)
  }, [schedule, refreshScheduleState])

  const addTicker = useCallback(() => {
    const val = tickerInput.trim().toUpperCase()
    if (!val) return
    if (settings.tickers.includes(val)) {
      setTickerInput('')
      return
    }
    setSettings((prev) => ({ ...prev, tickers: [...prev.tickers, val] }))
    setTickerInput('')
  }, [tickerInput, settings.tickers])

  const removeTicker = useCallback((ticker: string) => {
    setSettings((prev) => ({ ...prev, tickers: prev.tickers.filter((t) => t !== ticker) }))
  }, [])

  const saveSettings = useCallback(() => {
    const updated = { ...settings, email: emailInput }
    setSettings(updated)
    try {
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(updated))
    } catch {
      // ignore
    }
    setSettingsMsg('Settings saved')
    const timer = setTimeout(() => setSettingsMsg(''), 3000)
    return () => clearTimeout(timer)
  }, [settings, emailInput])

  const runAnalysis = useCallback(async () => {
    const tickers = settings.tickers
    const email = settings.email

    if (tickers.length === 0) {
      setAnalysisError('Please add stock tickers in Settings first.')
      return
    }
    if (!email || !isValidEmail(email)) {
      setAnalysisError('Please enter a valid email address in Settings first.')
      return
    }

    setAnalysisLoading(true)
    setAnalysisError('')
    setLatestResult(null)
    setActiveAgentId(MANAGER_AGENT_ID)

    try {
      const message = `Analyze the following stocks: ${tickers.join(', ')}. Send the analysis email to ${email}.`
      const result = await callAIAgent(message, MANAGER_AGENT_ID)

      setActiveAgentId(null)

      if (result.success) {
        const data = result?.response?.result as unknown as AnalysisResult | undefined
        if (data) {
          setLatestResult(data)

          const newReport: SavedReport = {
            id: `report-${Date.now()}`,
            date: data.analysis_date ?? new Date().toISOString().split('T')[0],
            result: data,
            expanded: false,
          }

          setReports((prev) => {
            const updated = [newReport, ...prev]
            try {
              localStorage.setItem(LS_REPORTS_KEY, JSON.stringify(updated))
            } catch {
              // ignore
            }
            return updated
          })
        } else {
          setAnalysisError('Received an empty response from the agent.')
        }
      } else {
        setAnalysisError(result?.error ?? 'Analysis failed. Please try again.')
      }
    } catch {
      setAnalysisError('Network error. Please check your connection and try again.')
      setActiveAgentId(null)
    }
    setAnalysisLoading(false)
  }, [settings])

  const toggleReport = useCallback((id: string) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r)))
  }, [])

  // Sample data toggle for report history
  const [sampleExpanded, setSampleExpanded] = useState(false)

  const displayReports: SavedReport[] = useSampleData
    ? [
        {
          id: 'sample-1',
          date: SAMPLE_RESULT.analysis_date,
          result: SAMPLE_RESULT,
          expanded: sampleExpanded,
        },
      ]
    : reports

  const displayResult = useSampleData ? SAMPLE_RESULT : latestResult

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <IconLoader className="w-6 h-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-medium tracking-[0.15em] font-serif text-foreground">STOCKPULSE</h1>
                <p className="text-xs text-muted-foreground font-light tracking-[0.15em] mt-1">Portfolio Intelligence Platform</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sample-toggle" className="text-xs tracking-[0.1em] font-light text-muted-foreground cursor-pointer">
                    Sample Data
                  </Label>
                  <Switch id="sample-toggle" checked={useSampleData} onCheckedChange={setUseSampleData} />
                </div>
                <nav className="flex border border-border">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-5 py-2 text-xs tracking-[0.15em] uppercase font-normal transition-colors ${activeTab === 'dashboard' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-5 py-2 text-xs tracking-[0.15em] uppercase font-normal transition-colors border-l border-border ${activeTab === 'settings' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <IconSettings className="w-3 h-3" />
                      Settings
                    </span>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-6 py-8">
          {/* ============================================================== */}
          {/* DASHBOARD TAB                                                  */}
          {/* ============================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Portfolio Summary Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-5 flex items-center gap-3">
                    <IconBarChart className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-normal">Tracked Stocks</p>
                      <p className="text-xl font-normal font-serif tracking-[0.05em]">{settings.tickers.length}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border shadow-sm">
                  <CardContent className="p-5 flex items-center gap-3">
                    <IconClock className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-normal">Last Analysis</p>
                      <p className="text-sm font-light tracking-[0.05em]">
                        {reports.length > 0 ? (reports[0]?.date ?? 'N/A') : 'Never'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border shadow-sm">
                  <CardContent className="p-5 flex items-center gap-3">
                    <IconCalendar className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-normal">Scheduler</p>
                      <Badge variant={schedule?.is_active ? 'default' : 'secondary'} className="text-[10px] tracking-[0.12em] font-normal mt-0.5">
                        {schedule?.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Run Analysis CTA or Empty State */}
              {settings.tickers.length === 0 && !useSampleData ? (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-10 text-center">
                    <IconBarChart className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-base font-medium tracking-[0.1em] font-serif mb-2">Add stocks to get started</h3>
                    <p className="text-xs text-muted-foreground font-light tracking-[0.1em] mb-6">
                      Configure your portfolio tickers and email in settings to begin receiving daily analysis.
                    </p>
                    <Button onClick={() => setActiveTab('settings')} className="text-xs tracking-[0.15em] uppercase font-normal px-6">
                      <IconSettings className="w-3.5 h-3.5 mr-2" />
                      Go to Settings
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-medium tracking-[0.1em] uppercase mb-1">On-Demand Analysis</h3>
                        <p className="text-xs text-muted-foreground font-light tracking-[0.05em]">
                          {useSampleData
                            ? 'Analyze AAPL, MSFT, TSLA and send report to investor@example.com'
                            : `Analyze ${settings.tickers.join(', ')} and send report to ${settings.email || 'your email'}`}
                        </p>
                      </div>
                      <Button
                        onClick={runAnalysis}
                        disabled={analysisLoading || useSampleData}
                        className="text-xs tracking-[0.15em] uppercase font-normal px-6"
                        size="lg"
                      >
                        {analysisLoading ? (
                          <>
                            <IconLoader className="w-3.5 h-3.5 mr-2" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <IconPlay className="w-3.5 h-3.5 mr-2" />
                            Run Analysis Now
                          </>
                        )}
                      </Button>
                    </div>
                    {analysisLoading && (
                      <div className="mt-4 p-4 bg-secondary/40 border border-border">
                        <div className="flex items-center gap-3">
                          <IconLoader className="w-4 h-4 text-primary" />
                          <p className="text-xs font-light tracking-[0.1em] text-muted-foreground">
                            Analyzing your portfolio -- the manager agent is coordinating stock research and email delivery...
                          </p>
                        </div>
                      </div>
                    )}
                    {analysisError && (
                      <div className="mt-4 p-4 bg-destructive/5 border border-destructive/20">
                        <div className="flex items-start gap-3">
                          <IconAlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-normal text-destructive tracking-[0.05em]">{analysisError}</p>
                            <button onClick={runAnalysis} className="text-xs text-primary underline mt-2 tracking-[0.05em] font-light">
                              Retry analysis
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Latest Result */}
              {displayResult && !analysisLoading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-sm font-medium tracking-[0.15em] uppercase">Latest Analysis</h2>
                    <Badge variant="outline" className="text-[10px] tracking-[0.1em] font-normal">
                      {displayResult?.analysis_date ?? ''}
                    </Badge>
                    {displayResult?.email_sent && (
                      <Badge variant="secondary" className="text-[10px] tracking-[0.1em] font-normal flex items-center gap-1">
                        <IconCheckCircle className="w-3 h-3 text-emerald-600" />
                        Email Delivered
                      </Badge>
                    )}
                  </div>

                  {displayResult?.overall_summary && (
                    <Card className="border border-border shadow-sm">
                      <CardContent className="p-6">
                        <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-normal">Portfolio Overview</h4>
                        <div className="text-sm font-light leading-[1.8]">{renderMarkdown(displayResult.overall_summary)}</div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Array.isArray(displayResult?.stocks_analyzed) &&
                      displayResult.stocks_analyzed.map((stock, idx) => (
                        <StockCard key={stock?.ticker ?? idx} stock={stock} />
                      ))}
                  </div>

                  {displayResult?.recipient && (
                    <p className="text-xs text-muted-foreground font-light tracking-[0.1em] flex items-center gap-1.5">
                      <IconMail className="w-3 h-3" />
                      Report delivered to {displayResult.recipient}
                    </p>
                  )}
                </div>
              )}

              {/* Schedule Management */}
              <div>
                <h2 className="text-sm font-medium tracking-[0.15em] uppercase mb-4">Schedule Management</h2>
                <SchedulePanel
                  schedule={schedule}
                  logs={scheduleLogs}
                  logsLoading={logsLoading}
                  scheduleLoading={scheduleLoading}
                  onToggleSchedule={handleToggleSchedule}
                  onRefreshLogs={loadLogs}
                  useSampleData={useSampleData}
                />
              </div>

              {/* Report History */}
              <div>
                <h2 className="text-sm font-medium tracking-[0.15em] uppercase mb-4">Report History</h2>
                {displayReports.length === 0 ? (
                  <Card className="border border-border shadow-sm">
                    <CardContent className="p-10 text-center">
                      <IconNewspaper className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm font-light tracking-[0.1em] text-muted-foreground">
                        No analysis reports yet. Run your first analysis!
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {displayReports.map((report) => (
                      <ReportCard
                        key={report.id}
                        report={report}
                        onToggle={() => {
                          if (useSampleData) {
                            setSampleExpanded((prev) => !prev)
                          } else {
                            toggleReport(report.id)
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Agent Info */}
              <Card className="border border-border shadow-sm">
                <CardContent className="p-5">
                  <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-normal">System Agents</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${activeAgentId === MANAGER_AGENT_ID ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                        <span className="text-xs font-light tracking-[0.1em]">Portfolio Analysis Manager</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground tracking-[0.1em] font-light">Orchestrator</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${activeAgentId === RESEARCH_AGENT_ID ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                        <span className="text-xs font-light tracking-[0.1em]">Stock Research Agent</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground tracking-[0.1em] font-light">Sub-agent</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${activeAgentId === EMAIL_AGENT_ID ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                        <span className="text-xs font-light tracking-[0.1em]">Email Composer Agent</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground tracking-[0.1em] font-light">Sub-agent</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============================================================== */}
          {/* SETTINGS TAB                                                   */}
          {/* ============================================================== */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-8">
              <div>
                <h2 className="text-lg font-medium tracking-[0.15em] font-serif mb-1">Configuration</h2>
                <p className="text-xs text-muted-foreground font-light tracking-[0.1em]">
                  Manage your portfolio tickers, delivery email, and daily schedule.
                </p>
              </div>

              {/* Stock Ticker Input */}
              <Card className="border border-border shadow-sm">
                <CardHeader className="pb-3 pt-6 px-6">
                  <CardTitle className="text-sm font-medium tracking-[0.1em] uppercase">Stock Tickers</CardTitle>
                  <CardDescription className="text-xs font-light tracking-[0.05em]">
                    Add the stock symbols you want to track. Press Enter or click Add.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="e.g. AAPL"
                      value={tickerInput}
                      onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTicker()
                        }
                      }}
                      className="flex-1 text-xs tracking-[0.1em] uppercase font-light"
                    />
                    <Button onClick={addTicker} variant="outline" size="sm" className="text-xs tracking-[0.1em] uppercase font-normal" disabled={!tickerInput.trim()}>
                      <IconPlus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                  {settings.tickers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {settings.tickers.map((ticker) => (
                        <TickerChip key={ticker} ticker={ticker} onRemove={() => removeTicker(ticker)} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground font-light tracking-[0.1em]">
                      No tickers added yet. Type a symbol above and press Enter.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Email */}
              <Card className="border border-border shadow-sm">
                <CardHeader className="pb-3 pt-6 px-6">
                  <CardTitle className="text-sm font-medium tracking-[0.1em] uppercase">Recipient Email</CardTitle>
                  <CardDescription className="text-xs font-light tracking-[0.05em]">
                    Analysis reports will be delivered to this email address.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="flex items-center gap-2">
                    <IconMail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="flex-1 text-xs tracking-[0.1em] font-light"
                    />
                  </div>
                  {emailInput && !isValidEmail(emailInput) && (
                    <p className="text-xs text-destructive font-light tracking-[0.05em] mt-2">
                      Please enter a valid email address.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Schedule Configuration */}
              <Card className="border border-border shadow-sm">
                <CardHeader className="pb-3 pt-6 px-6">
                  <CardTitle className="text-sm font-medium tracking-[0.1em] uppercase">Daily Schedule</CardTitle>
                  <CardDescription className="text-xs font-light tracking-[0.05em]">
                    Automated analysis runs daily at 8:00 AM Eastern Time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-light tracking-[0.1em]">
                        {schedule?.cron_expression ? cronToHuman(schedule.cron_expression) : 'Every day at 8:00'} (America/New_York)
                      </p>
                      <p className="text-xs text-muted-foreground font-light tracking-[0.05em]">
                        Status: {schedule?.is_active ? 'Active' : 'Paused'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="schedule-toggle" className="text-xs font-light tracking-[0.1em] text-muted-foreground">
                        {schedule?.is_active ? 'Active' : 'Paused'}
                      </Label>
                      <Switch
                        id="schedule-toggle"
                        checked={schedule?.is_active ?? false}
                        onCheckedChange={handleToggleSchedule}
                        disabled={scheduleLoading}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={saveSettings}
                  className="text-xs tracking-[0.15em] uppercase font-normal px-8"
                  disabled={!!(emailInput && !isValidEmail(emailInput))}
                >
                  Save Settings
                </Button>
                {settingsMsg && (
                  <span className="text-xs text-emerald-600 font-light tracking-[0.1em] flex items-center gap-1.5">
                    <IconCheckCircle className="w-3.5 h-3.5" />
                    {settingsMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border mt-16">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <p className="text-[10px] text-muted-foreground font-light tracking-[0.15em] text-center uppercase">
              StockPulse -- Portfolio Intelligence Platform
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
