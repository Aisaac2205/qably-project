'use client'

import { useEffect } from 'react'
import type { TestCase, CaseStatus } from '@/lib/mock-data'
import { StatusChip } from './status-chip'

type Verdict = 'pass' | 'fail' | 'skip' | 'blocked'

const KEY_MAP: Record<string, Verdict> = {
  p: 'pass',
  f: 'fail',
  s: 'skip',
  b: 'blocked',
}

interface CaseDetailProps {
  testCase: TestCase
  onVerdict: (verdict: Verdict) => void
}

export function CaseDetail({ testCase, onVerdict }: CaseDetailProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const verdict = KEY_MAP[e.key.toLowerCase()]
      if (verdict) onVerdict(verdict)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onVerdict])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-3 py-2 bg-surface border-b border-border">
        <div className="text-sm font-bold text-default">{testCase.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted">{testCase.suite}</span>
          <StatusChip status={testCase.status} />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2 space-y-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Steps</div>
          <ol className="space-y-1">
            {testCase.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-default">
                <span className="text-muted w-4 shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Expected result</div>
          <p className="text-xs text-muted italic">{testCase.expectedResult}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 bg-surface border-t border-border">
        {(['pass', 'fail', 'skip', 'blocked'] as Verdict[]).map(v => {
          const styles: Record<Verdict, string> = {
            pass:    'bg-pass-bg text-pass',
            fail:    'bg-fail-bg text-fail',
            skip:    'bg-skip-bg text-skip',
            blocked: 'bg-blocked-bg text-blocked',
          }
          const keys: Record<Verdict, string>   = { pass: 'P', fail: 'F', skip: 'S', blocked: 'B' }
          const labels: Record<Verdict, string> = { pass: 'Pass', fail: 'Fail', skip: 'Skip', blocked: 'Block' }
          return (
            <button
              key={v}
              aria-label={labels[v]}
              onClick={() => onVerdict(v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold ${styles[v]}`}
            >
              <kbd className="text-[9px] border border-current/30 rounded px-1 font-mono">{keys[v]}</kbd>
              {labels[v]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
