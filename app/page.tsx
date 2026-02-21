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
  stocks: string[]
  forex: string[]
  commodities: string[]
  email: string
}

// Legacy settings for migration
interface LegacySettings {
  tickers?: string[]
  email?: string
}

// ---------------------------------------------------------------------------
// Asset Category Detection
// ---------------------------------------------------------------------------

function getAssetCategory(ticker: string): 'stock' | 'forex' | 'commodity' {
  if (ticker.includes('/')) return 'forex'
  const commodities = ['GOLD', 'SILVER', 'OIL', 'WTI', 'BRENT', 'XAU', 'XAG', 'NATURAL_GAS', 'NATGAS', 'COPPER', 'PLATINUM', 'PALLADIUM']
  if (commodities.includes(ticker.toUpperCase())) return 'commodity'
  return 'stock'
}

function getCategoryColor(category: 'stock' | 'forex' | 'commodity'): string {
  switch (category) {
    case 'stock': return '#3b82f6'
    case 'forex': return '#10b981'
    case 'commodity': return '#f59e0b'
  }
}

function getCategoryLabel(category: 'stock' | 'forex' | 'commodity'): string {
  switch (category) {
    case 'stock': return 'Stock'
    case 'forex': return 'Forex'
    case 'commodity': return 'Commodity'
  }
}

// ---------------------------------------------------------------------------
// Sample Data (2026 dates, multi-asset)
// ---------------------------------------------------------------------------

const SAMPLE_RESULT: AnalysisResult = {
  analysis_date: '2026-02-21',
  stocks_analyzed: [
    {
      ticker: 'AAPL',
      company_name: 'Apple Inc.',
      current_price: '$242.80',
      daily_change: '+1.45%',
      weekly_change: '+3.20%',
      key_news: [
        'Apple Vision Pro 2 launch drives strong pre-order demand worldwide',
        'Services revenue reaches record $28.4B in latest quarterly report',
        'M5 chip architecture leaks suggest major performance improvements',
      ],
      analyst_sentiment: 'Bullish',
      notable_events: 'Q1 2026 earnings report on February 28',
      summary: 'Apple continues to demonstrate strong momentum across hardware and services. The Vision Pro 2 launch is generating significant consumer interest, while the services business maintains its exceptional growth trajectory with record revenue.',
    },
    {
      ticker: 'TSLA',
      company_name: 'Tesla Inc.',
      current_price: '$385.50',
      daily_change: '-0.72%',
      weekly_change: '+5.14%',
      key_news: [
        'Model 2 compact vehicle enters mass production at Gigafactory Texas',
        'Robotaxi service launches in Austin and Miami markets',
        'Energy storage division revenue surges 62% year-over-year',
      ],
      analyst_sentiment: 'Neutral',
      notable_events: 'FSD v15 wide release expected in March 2026',
      summary: 'Tesla presents a mixed picture with the Model 2 ramp showing promise offset by margin compression in core auto business. The robotaxi launch and energy storage growth represent significant long-term catalysts.',
    },
    {
      ticker: 'EUR/USD',
      company_name: 'Euro / US Dollar',
      current_price: '1.0892',
      daily_change: '+0.18%',
      weekly_change: '-0.45%',
      key_news: [
        'ECB signals potential rate pause at March meeting amid mixed data',
        'US Dollar strengthens on better-than-expected jobs report',
        'Eurozone manufacturing PMI contracts for second consecutive month',
      ],
      analyst_sentiment: 'Bearish',
      notable_events: 'ECB rate decision scheduled for March 6, 2026',
      summary: 'EUR/USD faces downward pressure as diverging monetary policy expectations between the ECB and Fed weigh on the pair. Weak Eurozone manufacturing data contrasts with resilient US employment figures, suggesting further dollar strength near-term.',
    },
    {
      ticker: 'GOLD',
      company_name: 'Gold (XAU/USD)',
      current_price: '$2,945.30',
      daily_change: '+0.85%',
      weekly_change: '+2.10%',
      key_news: [
        'Central bank gold purchases reach record levels in Q1 2026',
        'Geopolitical tensions in Eastern Europe drive safe-haven demand',
        'Gold ETF inflows surge to highest level since 2020',
      ],
      analyst_sentiment: 'Bullish',
      notable_events: 'US CPI release on February 25 may impact gold trajectory',
      summary: 'Gold continues its bullish run toward the psychological $3,000 level, driven by strong central bank demand and geopolitical uncertainty. Record ETF inflows suggest broad institutional participation in the rally.',
    },
  ],
  email_sent: true,
  recipient: 'investor@example.com',
  overall_summary: 'The portfolio shows mixed signals across asset classes. Equities demonstrate selective strength with Apple outperforming while Tesla consolidates. The forex market signals dollar strength ahead of key economic data releases. Gold remains the standout performer, approaching record highs on strong institutional demand. Recommend maintaining diversified exposure with attention to upcoming central bank decisions and earnings reports.',
}

const SAMPLE_LOGS: ExecutionLog[] = [
  {
    id: 'log-001',
    schedule_id: SCHEDULE_ID,
    agent_id: MANAGER_AGENT_ID,
    user_id: 'user-1',
    session_id: 'sess-1',
    executed_at: '2026-02-21T13:00:00Z',
    attempt: 1,
    max_attempts: 3,
    success: true,
    payload_message: 'Analyze AAPL, TSLA, EUR/USD, GOLD',
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
    executed_at: '2026-02-20T13:00:00Z',
    attempt: 1,
    max_attempts: 3,
    success: true,
    payload_message: 'Analyze AAPL, TSLA, EUR/USD, GOLD',
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
    executed_at: '2026-02-19T13:00:00Z',
    attempt: 1,
    max_attempts: 3,
    success: false,
    payload_message: 'Analyze AAPL, TSLA, EUR/USD, GOLD',
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
      <strong key={i} className="font-semibold text-foreground">
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
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm leading-relaxed text-muted-foreground">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm leading-relaxed text-muted-foreground">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SVG Icons
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

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )
}

function IconDiamond({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z" />
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
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
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

function getSentimentColor(sentiment: string): { bg: string; text: string; dot: string } {
  const s = (sentiment ?? '').toLowerCase()
  if (s.includes('bullish')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' }
  if (s.includes('bearish')) return { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' }
  return { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' }
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

function TickerChip({ ticker, onRemove, category }: { ticker: string; onRemove: () => void; category: 'stock' | 'forex' | 'commodity' }) {
  const color = getCategoryColor(category)
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-md text-xs tracking-wide uppercase font-medium transition-all duration-200 hover:border-primary/30" style={{ borderLeftWidth: '3px', borderLeftColor: color }}>
      {ticker}
      <button onClick={onRemove} className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors" aria-label={`Remove ${ticker}`}>
        <IconX />
      </button>
    </span>
  )
}

function AssetCard({ stock }: { stock: StockAnalysis }) {
  const dailyDir = getChangeDirection(stock?.daily_change ?? '')
  const weeklyDir = getChangeDirection(stock?.weekly_change ?? '')
  const newsItems = Array.isArray(stock?.key_news) ? stock.key_news : []
  const sentiment = getSentimentColor(stock?.analyst_sentiment ?? '')
  const category = getAssetCategory(stock?.ticker ?? '')
  const catColor = getCategoryColor(category)
  const catLabel = getCategoryLabel(category)

  return (
    <Card className="border border-border bg-card rounded-md transition-all duration-300 hover:border-primary/20" style={{ borderTopWidth: '2px', borderTopColor: catColor }}>
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-base font-semibold tracking-wide">{stock?.ticker ?? 'N/A'}</CardTitle>
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: catColor + '20', color: catColor }}>
                {catLabel}
              </span>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">{stock?.company_name ?? ''}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tracking-tight text-foreground">{stock?.current_price ?? '--'}</p>
            <div className={`flex items-center gap-1 justify-end mt-0.5 ${sentiment.text}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${sentiment.dot}`} />
              <span className="text-[10px] font-medium uppercase tracking-wider">{stock?.analyst_sentiment ?? 'N/A'}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            {dailyDir === 'up' ? <IconTrendingUp className="text-emerald-400 w-3.5 h-3.5" /> : dailyDir === 'down' ? <IconTrendingDown className="text-red-400 w-3.5 h-3.5" /> : <IconActivity className="text-muted-foreground w-3.5 h-3.5" />}
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Day</span>
            <span className={`text-xs font-medium ${dailyDir === 'up' ? 'text-emerald-400' : dailyDir === 'down' ? 'text-red-400' : 'text-foreground'}`}>
              {stock?.daily_change ?? '--'}
            </span>
          </div>
          <div className="w-px bg-border" />
          <div className="flex items-center gap-1.5">
            {weeklyDir === 'up' ? <IconTrendingUp className="text-emerald-400 w-3.5 h-3.5" /> : weeklyDir === 'down' ? <IconTrendingDown className="text-red-400 w-3.5 h-3.5" /> : <IconActivity className="text-muted-foreground w-3.5 h-3.5" />}
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Week</span>
            <span className={`text-xs font-medium ${weeklyDir === 'up' ? 'text-emerald-400' : weeklyDir === 'down' ? 'text-red-400' : 'text-foreground'}`}>
              {stock?.weekly_change ?? '--'}
            </span>
          </div>
        </div>

        <Separator className="bg-border" />

        {newsItems.length > 0 && (
          <div>
            <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-medium flex items-center gap-1.5">
              <IconNewspaper className="w-3 h-3" />
              Key News
            </h4>
            <ul className="space-y-1.5">
              {newsItems.map((news, idx) => (
                <li key={idx} className="text-xs leading-relaxed text-secondary-foreground pl-3 border-l-2 border-border">
                  {news}
                </li>
              ))}
            </ul>
          </div>
        )}

        {stock?.notable_events && (
          <div>
            <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-medium flex items-center gap-1.5">
              <IconCalendar className="w-3 h-3" />
              Notable Events
            </h4>
            <p className="text-xs leading-relaxed text-secondary-foreground">{stock.notable_events}</p>
          </div>
        )}

        {stock?.summary && (
          <div className="bg-muted/50 p-3.5 rounded-md border border-border">
            <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-medium">Summary</h4>
            <div className="text-xs leading-relaxed text-secondary-foreground">{renderMarkdown(stock.summary)}</div>
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
    <Card className="border border-border bg-card rounded-md transition-all duration-300 hover:border-primary/30">
      <button onClick={onToggle} className="w-full text-left px-5 py-4 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconCalendar className="w-3.5 h-3.5" />
            <span className="text-xs tracking-wide font-medium">{report?.date ?? 'Unknown date'}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {tickers.map((t) => {
              const cat = getAssetCategory(t)
              const catCol = getCategoryColor(cat)
              return (
                <span key={t} className="text-[10px] tracking-wider uppercase font-medium px-2 py-0.5 rounded border border-border" style={{ borderLeftWidth: '2px', borderLeftColor: catCol }}>
                  {t}
                </span>
              )
            })}
          </div>
          {report?.result?.email_sent && (
            <Badge variant="secondary" className="text-[10px] tracking-wider font-medium flex items-center gap-1 rounded-md">
              <IconMail className="w-3 h-3" />
              Sent
            </Badge>
          )}
        </div>
        <div className="ml-4 flex-shrink-0 text-muted-foreground">
          {report?.expanded ? <IconChevronUp /> : <IconChevronDown />}
        </div>
      </button>
      {report?.expanded && (
        <div className="px-5 pb-5 space-y-5">
          <Separator className="bg-border" />
          {report?.result?.overall_summary && (
            <div className="bg-muted/30 p-4 rounded-md border border-border">
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-medium">Overall Summary</h4>
              <div className="text-sm leading-relaxed text-secondary-foreground">{renderMarkdown(report.result.overall_summary)}</div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stocks.map((stock, idx) => (
              <AssetCard key={stock?.ticker ?? idx} stock={stock} />
            ))}
          </div>
          {report?.result?.recipient && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
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
    <Card className="border border-border bg-card rounded-md">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <IconClock className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold tracking-wide uppercase">Daily Schedule</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px] tracking-wider uppercase font-medium rounded-md">
              {isActive ? 'Active' : 'Paused'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground tracking-wide">
              {cronExpr ? cronToHuman(cronExpr) : 'No schedule'} (ET)
            </p>
            {schedule?.next_run_time && (
              <p className="text-xs text-muted-foreground">
                Next run: {new Date(schedule.next_run_time).toLocaleString()}
              </p>
            )}
          </div>
          <Button
            variant={isActive ? 'outline' : 'default'}
            size="sm"
            onClick={onToggleSchedule}
            disabled={scheduleLoading}
            className="text-xs tracking-wide uppercase font-medium rounded-md"
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

        <Separator className="bg-border" />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Run History</h4>
            <button onClick={onRefreshLogs} disabled={logsLoading} className="text-muted-foreground hover:text-primary transition-colors">
              <IconRefresh className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {displayLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No execution history yet.</p>
          ) : (
            <div className="space-y-1.5">
              {displayLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    {log.success ? <IconCheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <IconXCircle className="w-3.5 h-3.5 text-red-400" />}
                    <span className="text-xs text-secondary-foreground">
                      {new Date(log.executed_at).toLocaleString()}
                    </span>
                  </div>
                  <Badge variant={log.success ? 'secondary' : 'destructive'} className="text-[10px] tracking-wider font-medium rounded-md">
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

// Loading progress steps
function AnalysisProgress({ activeAgentId }: { activeAgentId: string | null }) {
  const steps = [
    { id: MANAGER_AGENT_ID, label: 'Manager Agent', desc: 'Orchestrating analysis' },
    { id: RESEARCH_AGENT_ID, label: 'Market Research', desc: 'Fetching market data' },
    { id: EMAIL_AGENT_ID, label: 'Email Composer', desc: 'Composing report' },
  ]
  return (
    <div className="mt-4 p-4 bg-muted/30 rounded-md border border-border">
      <div className="flex items-center gap-3 mb-3">
        <IconLoader className="w-4 h-4 text-primary" />
        <p className="text-xs font-medium text-foreground tracking-wide">Analyzing your portfolio...</p>
      </div>
      <div className="space-y-2">
        {steps.map((step) => {
          const isActive = activeAgentId === step.id
          return (
            <div key={step.id} className={`flex items-center gap-3 py-1.5 px-3 rounded transition-all duration-300 ${isActive ? 'bg-primary/10 border border-primary/20' : ''}`}>
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isActive ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`} />
              <div>
                <span className={`text-xs font-medium tracking-wide ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{step.label}</span>
                {isActive && <p className="text-[10px] text-muted-foreground">{step.desc}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function Page() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard')
  const [useSampleData, setUseSampleData] = useState(false)

  // Settings
  const [settings, setSettings] = useState<AppSettings>({ stocks: [], forex: [], commodities: [], email: '' })
  const [tickerInput, setTickerInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [settingsMsg, setSettingsMsg] = useState('')
  const [assetTab, setAssetTab] = useState<'stocks' | 'forex' | 'commodities'>('stocks')

  // Reports
  const [reports, setReports] = useState<SavedReport[]>([])

  // Analysis
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [latestResult, setLatestResult] = useState<AnalysisResult | null>(null)

  // Category filter for results
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'stock' | 'forex' | 'commodity'>('all')

  // Schedule
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [scheduleLogs, setScheduleLogs] = useState<ExecutionLog[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)

  const [mounted, setMounted] = useState(false)

  // Total instruments count
  const totalInstruments = settings.stocks.length + settings.forex.length + settings.commodities.length

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const savedSettings = localStorage.getItem(LS_SETTINGS_KEY)
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        // Migration: if old format with `tickers` key, migrate
        if (parsed && Array.isArray((parsed as LegacySettings).tickers)) {
          const legacy = parsed as LegacySettings
          const migrated: AppSettings = {
            stocks: legacy.tickers ?? [],
            forex: [],
            commodities: [],
            email: legacy.email ?? '',
          }
          setSettings(migrated)
          setEmailInput(migrated.email)
          localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(migrated))
        } else {
          const s = parsed as AppSettings
          setSettings({
            stocks: Array.isArray(s?.stocks) ? s.stocks : [],
            forex: Array.isArray(s?.forex) ? s.forex : [],
            commodities: Array.isArray(s?.commodities) ? s.commodities : [],
            email: s?.email ?? '',
          })
          setEmailInput(s?.email ?? '')
        }
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
    const currentList = settings[assetTab]
    if (Array.isArray(currentList) && currentList.includes(val)) {
      setTickerInput('')
      return
    }
    setSettings((prev) => ({ ...prev, [assetTab]: [...(Array.isArray(prev[assetTab]) ? prev[assetTab] : []), val] }))
    setTickerInput('')
  }, [tickerInput, settings, assetTab])

  const removeTicker = useCallback((ticker: string, category: 'stocks' | 'forex' | 'commodities') => {
    setSettings((prev) => ({
      ...prev,
      [category]: Array.isArray(prev[category]) ? prev[category].filter((t) => t !== ticker) : [],
    }))
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
    const allAssets = [...settings.stocks, ...settings.forex, ...settings.commodities]
    const email = settings.email

    if (allAssets.length === 0) {
      setAnalysisError('Please add instruments in Settings first.')
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
      const todayStr = new Date().toISOString().split('T')[0]
      const message = `Today's date is ${todayStr}. Analyze the following instruments: ${allAssets.join(', ')}. These include stocks, forex pairs, and commodities. After completing the research, compose a professional analysis email and send it via Gmail to the recipient email address: ${email}. The email subject should be "StockPulse Daily Analysis - ${todayStr}". Make sure the Email Composer Agent sends the email to exactly this address: ${email}. Use today's date ${todayStr} for the analysis_date field.`
      const result = await callAIAgent(message, MANAGER_AGENT_ID)

      setActiveAgentId(null)

      if (result.success) {
        const data = result?.response?.result as unknown as AnalysisResult | undefined
        if (data) {
          // Always use today's actual date to avoid stale/wrong dates from agent
          const todayDate = new Date().toISOString().split('T')[0]
          const reportDate = data.analysis_date && data.analysis_date.startsWith('202') ? data.analysis_date : todayDate
          const fixedData = { ...data, analysis_date: reportDate }

          setLatestResult(fixedData)

          const newReport: SavedReport = {
            id: `report-${Date.now()}`,
            date: reportDate,
            result: fixedData,
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

          // Warn if email was not sent
          if (!fixedData.email_sent) {
            setAnalysisError('Analysis completed but the email may not have been delivered. Check your inbox or try running the analysis again.')
          }
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

  // Filter stocks_analyzed by category
  const filteredAssets = Array.isArray(displayResult?.stocks_analyzed)
    ? displayResult.stocks_analyzed.filter((s) => {
        if (categoryFilter === 'all') return true
        return getAssetCategory(s?.ticker ?? '') === categoryFilter
      })
    : []

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <IconLoader className="w-6 h-6 text-primary" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        {/* Header with gold top accent */}
        <div className="h-0.5 bg-primary" />
        <header className="border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-wider text-foreground">STOCKPULSE</h1>
                <p className="text-xs text-muted-foreground tracking-widest mt-0.5 uppercase">Multi-Asset Intelligence Terminal</p>
              </div>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sample-toggle" className="text-xs tracking-wide text-muted-foreground cursor-pointer">
                    Sample Data
                  </Label>
                  <Switch id="sample-toggle" checked={useSampleData} onCheckedChange={setUseSampleData} />
                </div>
                <nav className="flex">
                  {(['dashboard', 'settings'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-xs tracking-widest uppercase font-medium transition-all duration-200 border-b-2 ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                      {tab === 'settings' ? (
                        <span className="flex items-center gap-1.5">
                          <IconSettings className="w-3 h-3" />
                          Settings
                        </span>
                      ) : (
                        'Dashboard'
                      )}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-6">
          {/* ============================================================== */}
          {/* DASHBOARD TAB                                                  */}
          {/* ============================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Portfolio Summary Bar - horizontal with dividers */}
              <Card className="border border-border bg-card rounded-md">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
                    <div className="flex-1 px-5 py-4 flex items-center gap-3">
                      <IconBarChart className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Instruments</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-foreground">{useSampleData ? 4 : totalInstruments}</span>
                          {(useSampleData || totalInstruments > 0) && (
                            <div className="flex gap-1">
                              {(useSampleData ? 2 : settings.stocks.length) > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#3b82f620', color: '#3b82f6' }}>
                                  {useSampleData ? 2 : settings.stocks.length}S
                                </span>
                              )}
                              {(useSampleData ? 1 : settings.forex.length) > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>
                                  {useSampleData ? 1 : settings.forex.length}F
                                </span>
                              )}
                              {(useSampleData ? 1 : settings.commodities.length) > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}>
                                  {useSampleData ? 1 : settings.commodities.length}C
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 px-5 py-4 flex items-center gap-3">
                      <IconClock className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Last Analysis</p>
                        <p className="text-sm font-medium text-foreground">
                          {useSampleData ? '2026-02-21' : reports.length > 0 ? (reports[0]?.date ?? 'N/A') : 'Never'}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 px-5 py-4 flex items-center gap-3">
                      <IconCalendar className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Scheduler</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(schedule?.is_active ?? false) && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                          )}
                          <Badge variant={schedule?.is_active ? 'default' : 'secondary'} className="text-[10px] tracking-wider font-medium rounded-md">
                            {schedule?.is_active ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Run Analysis CTA or Empty State */}
              {totalInstruments === 0 && !useSampleData ? (
                <Card className="border border-border bg-card rounded-md">
                  <CardContent className="p-10 text-center">
                    <IconBarChart className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-base font-semibold mb-2 text-foreground">Add instruments to get started</h3>
                    <p className="text-xs text-muted-foreground mb-6 max-w-md mx-auto">
                      Configure your stocks, forex pairs, and commodities in settings to begin receiving multi-asset analysis.
                    </p>
                    <Button onClick={() => setActiveTab('settings')} className="text-xs tracking-wider uppercase font-medium px-6 rounded-md">
                      <IconSettings className="w-3.5 h-3.5 mr-2" />
                      Go to Settings
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-border bg-card rounded-md">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold tracking-wide uppercase mb-1 text-foreground">On-Demand Analysis</h3>
                        <p className="text-xs text-muted-foreground">
                          {useSampleData
                            ? 'Analyze AAPL, TSLA, EUR/USD, GOLD and send report to investor@example.com'
                            : `Analyze ${[...settings.stocks, ...settings.forex, ...settings.commodities].join(', ') || 'your instruments'} and deliver to ${settings.email || 'your email'}`}
                        </p>
                      </div>
                      <Button
                        onClick={runAnalysis}
                        disabled={analysisLoading || useSampleData}
                        className="text-xs tracking-wider uppercase font-medium px-6 rounded-md"
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
                            Run Analysis
                          </>
                        )}
                      </Button>
                    </div>
                    {analysisLoading && <AnalysisProgress activeAgentId={activeAgentId} />}
                    {analysisError && (
                      <div className="mt-4 p-4 bg-red-500/5 rounded-md border border-red-500/20">
                        <div className="flex items-start gap-3">
                          <IconAlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-red-400">{analysisError}</p>
                            <button onClick={runAnalysis} className="text-xs text-primary underline mt-2 font-medium">
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
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-sm font-semibold tracking-wider uppercase text-foreground">Latest Analysis</h2>
                      <Badge variant="outline" className="text-[10px] tracking-wider font-medium rounded-md">
                        {displayResult?.analysis_date ?? ''}
                      </Badge>
                      {displayResult?.email_sent && (
                        <Badge variant="secondary" className="text-[10px] tracking-wider font-medium flex items-center gap-1 rounded-md">
                          <IconCheckCircle className="w-3 h-3 text-emerald-400" />
                          Email Delivered
                        </Badge>
                      )}
                    </div>
                    {/* Category filter tabs */}
                    <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
                      {([
                        { key: 'all' as const, label: 'All' },
                        { key: 'stock' as const, label: 'Stocks' },
                        { key: 'forex' as const, label: 'Forex' },
                        { key: 'commodity' as const, label: 'Commodities' },
                      ]).map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setCategoryFilter(f.key)}
                          className={`px-3 py-1 text-[10px] tracking-wider uppercase font-medium rounded transition-all duration-200 ${categoryFilter === f.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {displayResult?.overall_summary && (
                    <Card className="border border-border bg-card rounded-md">
                      <CardContent className="p-5">
                        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-medium">Portfolio Overview</h4>
                        <div className="text-sm leading-relaxed text-secondary-foreground">{renderMarkdown(displayResult.overall_summary)}</div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredAssets.map((stock, idx) => (
                      <AssetCard key={stock?.ticker ?? idx} stock={stock} />
                    ))}
                  </div>

                  {filteredAssets.length === 0 && (
                    <Card className="border border-border bg-card rounded-md">
                      <CardContent className="p-8 text-center">
                        <p className="text-xs text-muted-foreground">No assets match the selected category filter.</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Email delivery status */}
                  {displayResult?.email_sent ? (
                    <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-md">
                      <IconCheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-xs text-emerald-400 font-medium">
                        Analysis email delivered to {displayResult.recipient || 'recipient'}
                      </p>
                    </div>
                  ) : displayResult?.recipient ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-md">
                      <IconAlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <p className="text-xs text-amber-400 font-medium">
                        Email delivery to {displayResult.recipient} could not be confirmed. Check your inbox or run analysis again.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Schedule Management */}
              <div>
                <h2 className="text-sm font-semibold tracking-wider uppercase mb-4 text-foreground">Schedule Management</h2>
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold tracking-wider uppercase text-foreground">Report History</h2>
                  {reports.length > 0 && !useSampleData && (
                    <button
                      onClick={() => {
                        setReports([])
                        setLatestResult(null)
                        try { localStorage.removeItem(LS_REPORTS_KEY) } catch { /* ignore */ }
                      }}
                      className="text-[10px] tracking-wider uppercase font-medium text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1.5"
                    >
                      <IconX className="w-3 h-3" />
                      Clear History
                    </button>
                  )}
                </div>
                {displayReports.length === 0 ? (
                  <Card className="border border-border bg-card rounded-md">
                    <CardContent className="p-10 text-center">
                      <IconNewspaper className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">
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
              <Card className="border border-border bg-card rounded-md">
                <CardContent className="p-5">
                  <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-medium">System Agents</h4>
                  <div className="space-y-1">
                    {[
                      { id: MANAGER_AGENT_ID, name: 'Portfolio Analysis Manager', role: 'Orchestrator' },
                      { id: RESEARCH_AGENT_ID, name: 'Market Research Agent', role: 'Sub-agent' },
                      { id: EMAIL_AGENT_ID, name: 'Email Composer Agent', role: 'Sub-agent' },
                    ].map((agent) => (
                      <div key={agent.id} className={`flex items-center justify-between py-2 px-3 rounded transition-all duration-300 ${activeAgentId === agent.id ? 'bg-primary/5 border border-primary/20' : ''}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${activeAgentId === agent.id ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`} />
                          <span className="text-xs font-medium tracking-wide text-foreground">{agent.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground tracking-wider font-medium">{agent.role}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============================================================== */}
          {/* SETTINGS TAB                                                   */}
          {/* ============================================================== */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-lg font-bold tracking-wider mb-1 text-foreground">Configuration</h2>
                <p className="text-xs text-muted-foreground">
                  Manage your tracked instruments, delivery email, and daily schedule.
                </p>
              </div>

              {/* Multi-Asset Input */}
              <Card className="border border-border bg-card rounded-md">
                <CardHeader className="pb-3 pt-5 px-5">
                  <CardTitle className="text-sm font-semibold tracking-wide uppercase">Instruments</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Add stocks, forex pairs, and commodities to track.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {/* Asset category tabs */}
                  <div className="flex gap-0.5 bg-muted rounded-md p-0.5 mb-4">
                    {([
                      { key: 'stocks' as const, label: 'Stocks', icon: IconBarChart, color: '#3b82f6', placeholder: 'e.g. AAPL, TSLA' },
                      { key: 'forex' as const, label: 'Forex', icon: IconGlobe, color: '#10b981', placeholder: 'e.g. EUR/USD' },
                      { key: 'commodities' as const, label: 'Commodities', icon: IconDiamond, color: '#f59e0b', placeholder: 'e.g. GOLD' },
                    ]).map((t) => (
                      <button
                        key={t.key}
                        onClick={() => { setAssetTab(t.key); setTickerInput('') }}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] tracking-wider uppercase font-medium rounded transition-all duration-200 ${assetTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <t.icon className="w-3 h-3" />
                        {t.label}
                        {(Array.isArray(settings[t.key]) ? settings[t.key].length : 0) > 0 && (
                          <span className="text-[9px] px-1 py-0 rounded-full font-bold" style={{ backgroundColor: t.color + '20', color: t.color }}>
                            {Array.isArray(settings[t.key]) ? settings[t.key].length : 0}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder={assetTab === 'stocks' ? 'e.g. AAPL' : assetTab === 'forex' ? 'e.g. EUR/USD' : 'e.g. GOLD'}
                      value={tickerInput}
                      onChange={(e) => setTickerInput(assetTab === 'forex' ? e.target.value.toUpperCase() : e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTicker()
                        }
                      }}
                      className="flex-1 text-xs tracking-wide uppercase font-medium bg-background rounded-md"
                    />
                    <Button onClick={addTicker} variant="outline" size="sm" className="text-xs tracking-wide uppercase font-medium rounded-md" disabled={!tickerInput.trim()}>
                      <IconPlus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  </div>

                  {/* Display all tickers grouped by current tab */}
                  {(() => {
                    const currentList = Array.isArray(settings[assetTab]) ? settings[assetTab] : []
                    if (currentList.length > 0) {
                      return (
                        <div className="flex flex-wrap gap-2">
                          {currentList.map((ticker) => (
                            <TickerChip key={ticker} ticker={ticker} category={assetTab === 'stocks' ? 'stock' : assetTab === 'forex' ? 'forex' : 'commodity'} onRemove={() => removeTicker(ticker, assetTab)} />
                          ))}
                        </div>
                      )
                    }
                    return (
                      <p className="text-xs text-muted-foreground">
                        No {assetTab} added yet. Type a symbol above and press Enter.
                      </p>
                    )
                  })()}

                  {/* Show summary of all categories */}
                  {totalInstruments > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-2">All Tracked Instruments</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(settings.stocks) && settings.stocks.map((t) => (
                          <span key={`s-${t}`} className="text-[10px] px-2 py-0.5 rounded border border-border font-medium" style={{ borderLeftWidth: '2px', borderLeftColor: '#3b82f6' }}>{t}</span>
                        ))}
                        {Array.isArray(settings.forex) && settings.forex.map((t) => (
                          <span key={`f-${t}`} className="text-[10px] px-2 py-0.5 rounded border border-border font-medium" style={{ borderLeftWidth: '2px', borderLeftColor: '#10b981' }}>{t}</span>
                        ))}
                        {Array.isArray(settings.commodities) && settings.commodities.map((t) => (
                          <span key={`c-${t}`} className="text-[10px] px-2 py-0.5 rounded border border-border font-medium" style={{ borderLeftWidth: '2px', borderLeftColor: '#f59e0b' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email */}
              <Card className="border border-border bg-card rounded-md">
                <CardHeader className="pb-3 pt-5 px-5">
                  <CardTitle className="text-sm font-semibold tracking-wide uppercase">Recipient Email</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Analysis reports will be delivered to this email address.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="flex items-center gap-2">
                    <IconMail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="flex-1 text-xs font-medium bg-background rounded-md"
                    />
                  </div>
                  {emailInput && !isValidEmail(emailInput) && (
                    <p className="text-xs text-red-400 font-medium mt-2">
                      Please enter a valid email address.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Schedule Configuration */}
              <Card className="border border-border bg-card rounded-md">
                <CardHeader className="pb-3 pt-5 px-5">
                  <CardTitle className="text-sm font-semibold tracking-wide uppercase">Daily Schedule</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Automated analysis runs daily at 8:00 AM Eastern Time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-foreground font-medium">
                        {schedule?.cron_expression ? cronToHuman(schedule.cron_expression) : 'Every day at 8:00'} (America/New_York)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: {schedule?.is_active ? 'Active' : 'Paused'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="schedule-toggle" className="text-xs text-muted-foreground">
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
                  className="text-xs tracking-wider uppercase font-medium px-8 rounded-md"
                  disabled={!!(emailInput && !isValidEmail(emailInput))}
                >
                  Save Settings
                </Button>
                {settingsMsg && (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                    <IconCheckCircle className="w-3.5 h-3.5" />
                    {settingsMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border mt-12">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <p className="text-[10px] text-muted-foreground tracking-widest text-center uppercase">
              StockPulse -- Multi-Asset Intelligence Terminal
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
