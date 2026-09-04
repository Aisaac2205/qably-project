import React from "react";
import { motion } from "motion/react";
import { DashboardWindowFrame } from "@/features/dashboard-preview/components/DashboardWindowFrame";
import { MobileDashboardIphone } from "@/features/mobile-dashboard";
import { getDictionary } from "@/features/i18n/get-dictionary";
import { getAuthUrl } from "@/lib/auth-config";
import type { Locale } from "@/features/i18n/types";

// Inline Button Component
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "gradient";
  size?: "default" | "sm" | "lg";
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className = "", children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 cursor-pointer font-sans";
    
    const variants = {
      default: "bg-white text-black hover:bg-zinc-200 active:scale-[0.98] shadow-sm",
      secondary: "bg-zinc-900 text-white hover:bg-zinc-800 border border-white/10 active:scale-[0.98]",
      ghost: "hover:bg-zinc-900 text-zinc-300 hover:text-white active:scale-[0.98]",
      gradient: "bg-white text-black hover:bg-zinc-100 active:scale-[0.98] shadow-lg shadow-white/10"
    };
    
    const sizes = {
      default: "h-9 px-4 text-xs",
      sm: "h-8 px-3 text-xs",
      lg: "h-11 px-6 text-sm font-semibold"
    };
    
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

// Hero Component with motion micro-animations
export const Hero = React.memo(({ locale = 'es' }: { locale?: Locale }) => {
  const dict = getDictionary(locale);
  const hero = dict.hero;
  const dashboard = dict.dashboard;
  const isEn = locale === 'en';
  const authUrl = getAuthUrl('/projects');

  return (
    <section
      id="getting-started"
      className="relative min-h-screen flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 pt-32 pb-20 md:pt-40 md:pb-24 overflow-hidden"
    >
      {/* Subtle white radial aura background */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_70%)] pointer-events-none -z-10" />

      {/* Hero Headline with Motion */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-center max-w-4xl px-4 leading-[1.08] tracking-tight mb-6 font-sans text-white"
        style={{ letterSpacing: "-0.035em" }}
      >
        {hero.headingPart1} <br className="hidden sm:inline" />
        {hero.headingPart2}
      </motion.h1>

      {/* Subtitle with Motion */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-sm sm:text-base md:text-lg text-center max-w-2xl px-4 mb-8 text-zinc-400 font-normal leading-relaxed font-sans"
      >
        {hero.subtitle}
      </motion.p>

      {/* Call to Actions with Motion */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex flex-wrap items-center justify-center gap-3 relative z-10 mb-16 font-sans"
      >
        <a href={authUrl}>
          <Button
            type="button"
            variant="default"
            size="lg"
            className="rounded-lg flex items-center justify-center"
            aria-label="Get started with Qably"
          >
            {hero.ctaPrimary}
          </Button>
        </a>
        <a href={isEn ? "/en/docs" : "/docs"}>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="rounded-lg flex items-center justify-center"
            aria-label="Read documentation"
          >
            {hero.ctaSecondary}
          </Button>
        </a>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="w-full max-w-[1680px] relative pb-10"
      >
        <div className="relative z-10">
          {/* Mobile view (< md): Dedicated iPhone 16 Pro mockup */}
          <div className="block md:hidden">
            <MobileDashboardIphone tDashboard={dashboard} locale={locale} />
          </div>

          {/* Desktop view (>= md): Full Desktop MacBook Window (Direct, no extra card) */}
          <div className="hidden md:block">
            <DashboardWindowFrame tDashboard={dashboard} tHero={hero} locale={locale} />
          </div>
        </div>
      </motion.div>
    </section>
  );
});

Hero.displayName = "Hero";

// Main Component
export default function Component({ locale = 'es' }: { locale?: Locale }) {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      <Hero locale={locale} />
    </main>
  );
}
