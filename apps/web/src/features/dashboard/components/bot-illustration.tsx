'use client'

export function BotIllustration() {
  return (
    <div className="relative w-28 h-28 flex items-center justify-center select-none shrink-0">
      {/* Dashed outer orbit ring */}
      <div 
        className="absolute inset-0 rounded-full border border-dashed border-primary/20 motion-safe:animate-spin" 
        style={{ animationDuration: '40s' }} 
      />

      {/* Outer gradient glow */}
      <div className="absolute w-20 h-20 rounded-full bg-primary/5 blur-xl" />

      {/* Main Bot Head Container */}
      <div className="relative w-20 h-20 rounded-full bg-gradient-to-b from-primary/10 to-primary/20 border border-primary/30 flex items-center justify-center p-1.5 shadow-inner">
        {/* Head Inner Face (Dark glass) */}
        <div className="relative w-full h-full rounded-full bg-sidebar flex flex-col items-center justify-center overflow-hidden border border-border-sidebar shadow-md">
          {/* Subtle scanning line */}
          <div 
            className="absolute inset-x-0 h-[1.5px] bg-primary/40 motion-safe:animate-[scan_3s_ease-in-out_infinite]" 
            style={{ top: '15%' }} 
          />
          
          {/* Eyes */}
          <div className="flex gap-2.5 mb-1 mt-1">
            <div className="w-2 h-2 rounded-full bg-primary motion-safe:animate-pulse shadow-[0_0_8px_var(--primary)]" />
            <div className="w-2 h-2 rounded-full bg-primary motion-safe:animate-pulse shadow-[0_0_8px_var(--primary)]" />
          </div>

          {/* Smile */}
          <svg 
            width="20" 
            height="6" 
            viewBox="0 0 20 6" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg" 
            className="text-primary drop-shadow-[0_0_4px_var(--primary)]"
          >
            <path d="M2 1C4.5 4 15.5 4 18 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Headphones/Ears */}
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2.5 h-7 rounded-full bg-sidebar-hover border border-border-sidebar shadow-sm" />
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-7 rounded-full bg-sidebar-hover border border-border-sidebar shadow-sm" />
        
        {/* Headphone Band */}
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-16 h-3 rounded-t-full border-t-2 border-x border-border-sidebar pointer-events-none" />
      </div>

      {/* Checkmark Badge */}
      <div 
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-pass border-2 border-surface shadow-md flex items-center justify-center text-primary-fg motion-safe:animate-[bounce_2.5s_ease-in-out_infinite]"
      >
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="3.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* Decorative sparkles */}
      <div className="absolute -top-1 left-2 text-primary/40 text-xs motion-safe:animate-pulse" style={{ animationDelay: '0.5s' }}>✦</div>
      <div className="absolute bottom-2 -left-1 text-primary/30 text-xs motion-safe:animate-pulse" style={{ animationDelay: '1.2s' }}>✦</div>
      <div className="absolute bottom-0 right-2 text-primary/50 text-xs motion-safe:animate-pulse" style={{ animationDelay: '0.8s' }}>✦</div>
    </div>
  )
}
