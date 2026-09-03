import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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

// Icons
export const Menu = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

export const X = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

// Navigation Component
export const Navigation = React.memo(({ locale = 'es' }: { locale?: Locale }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dict = getDictionary(locale);
  const nav = dict.nav;
  const isEn = locale === 'en';
  const authUrl = getAuthUrl('/projects');

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-200 ${
        mobileMenuOpen
          ? 'h-dvh bg-black flex flex-col justify-between overflow-y-auto'
          : 'border-b border-white/[0.08] bg-black/85 backdrop-blur-xl'
      }`}
    >
      <nav className="max-w-7xl w-full mx-auto px-6 py-3.5 flex items-center justify-between shrink-0">
        {/* Official Brand Logo inverted to white */}
        <a href={isEn ? "/en" : "/"} className="flex items-center gap-2 group" aria-label="Qably Home">
          <img
            src="/qably-icon.svg"
            alt="Qably"
            className="h-6 w-auto brightness-0 invert object-contain transition-opacity group-hover:opacity-90"
          />
        </a>
        
        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <a href="#getting-started" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors font-sans">
            {nav.gettingStarted}
          </a>
          <a href="#features" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors font-sans">
            {nav.features}
          </a>
          <a href={isEn ? "/en/docs" : "/docs"} className="text-xs font-medium text-zinc-400 hover:text-white transition-colors font-sans">
            {nav.documentation}
          </a>
          <a href="#pricing" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors font-sans">
            {nav.pricing}
          </a>
        </div>

        {/* Desktop Auth and Clean Language Switcher (No card wrapper) */}
        <div className="hidden md:flex items-center gap-2">
          <a
            href={isEn ? "/" : "/en"}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer select-none"
            title={isEn ? "Cambiar a Español" : "Switch to English"}
            aria-label={isEn ? "Cambiar a Español" : "Switch to English"}
          >
            <img src="/traducir.png" alt="Traducir" className="size-4 brightness-0 invert object-contain" />
            <span className="font-medium text-[11px]">{isEn ? "ES" : "EN"}</span>
          </a>

          {/* Both login and register redirect to the unified auth route */}
          <a href={authUrl} rel="noopener noreferrer">
            <Button type="button" variant="ghost" size="sm">
              {nav.signIn}
            </Button>
          </a>

          <a href={authUrl} rel="noopener noreferrer">
            <Button type="button" variant="default" size="sm">
              {nav.signUp}
            </Button>
          </a>
        </div>

        {/* Mobile Controls: Language Toggle (No card wrapper) + Hamburger Button */}
        <div className="flex md:hidden items-center gap-1">
          <a
            href={isEn ? "/" : "/en"}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer select-none"
            title={isEn ? "Cambiar a Español" : "Switch to English"}
            aria-label={isEn ? "Cambiar a Español" : "Switch to English"}
          >
            <img src="/traducir.png" alt="Traducir" className="size-4 brightness-0 invert object-contain" />
            <span className="font-medium text-[11px]">{isEn ? "ES" : "EN"}</span>
          </a>

          <button
            type="button"
            className="flex items-center justify-center p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Body when Open */}
      {mobileMenuOpen && (
        <div className="flex-1 flex flex-col justify-between p-6 md:hidden overflow-y-auto animate-fade-in">
          <div className="flex flex-col gap-4 font-sans text-left pt-2">
            <a
              href="#getting-started"
              className="text-xl font-medium text-zinc-200 hover:text-white transition-colors py-3 border-b border-white/[0.08]"
              onClick={() => setMobileMenuOpen(false)}
            >
              {nav.gettingStarted}
            </a>
            <a
              href="#features"
              className="text-xl font-medium text-zinc-200 hover:text-white transition-colors py-3 border-b border-white/[0.08]"
              onClick={() => setMobileMenuOpen(false)}
            >
              {nav.features}
            </a>
            <a
              href={isEn ? "/en/docs" : "/docs"}
              className="text-xl font-medium text-zinc-200 hover:text-white transition-colors py-3 border-b border-white/[0.08]"
              onClick={() => setMobileMenuOpen(false)}
            >
              {nav.documentation}
            </a>
            <a
              href="#pricing"
              className="text-xl font-medium text-zinc-200 hover:text-white transition-colors py-3 border-b border-white/[0.08]"
              onClick={() => setMobileMenuOpen(false)}
            >
              {nav.pricing}
            </a>
          </div>

          <div className="flex flex-col gap-3 pt-6 pb-6">
            <a href={authUrl} className="w-full">
              <Button type="button" variant="secondary" size="lg" className="w-full justify-center text-sm py-3">
                {nav.signIn}
              </Button>
            </a>
            <a href={authUrl} className="w-full">
              <Button type="button" variant="default" size="lg" className="w-full justify-center text-sm py-3">
                {nav.signUp}
              </Button>
            </a>
          </div>
        </div>
      )}
    </header>
  );
});

Navigation.displayName = "Navigation";

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
            <MobileDashboardIphone tDashboard={dashboard} />
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
      <Navigation locale={locale} />
      <Hero locale={locale} />
    </main>
  );
}
