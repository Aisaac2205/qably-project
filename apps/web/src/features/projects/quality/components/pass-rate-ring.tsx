import { TONE_TEXT_CLASSES, toneForPassRatePercent } from '../lib/tone'

interface PassRateRingProps {
  /** Whole-percent pass rate (0-100), the same rounded value shown in the KPI card. */
  percent: number
  label: string
}

const SIZE = 96
const CENTER = SIZE / 2
const RADIUS = 40
const STROKE_WIDTH = 8
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * A radial "current state" gauge for the pass rate: a single value read
 * instantly, next to (not instead of) the historical trend line. The
 * percentage is real, visible text — the ring itself is decorative and
 * hidden from assistive tech.
 */
export function PassRateRing({ percent, label }: PassRateRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const tone = toneForPassRatePercent(clamped)
  const offset = CIRCUMFERENCE * (1 - clamped / 100)

  return (
    <div className="relative flex size-24 shrink-0 items-center justify-center sm:size-28">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          className="stroke-border"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          stroke="currentColor"
          className={TONE_TEXT_CLASSES[tone]}
          strokeDasharray={CIRCUMFERENCE.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-default">
          {clamped}%
        </span>
        <span className="text-[11px] text-muted">{label}</span>
      </div>
    </div>
  )
}
