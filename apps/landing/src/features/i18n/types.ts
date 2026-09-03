/**
 * Type definitions for internationalization dictionary
 * Strict typing with TypeScript mapped types
 */

export type Locale = 'es' | 'en';

export interface NavTranslations {
  gettingStarted: string;
  features: string;
  documentation: string;
  pricing: string;
  signIn: string;
  signUp: string;
}

export interface HeroTranslations {
  badgeText: string;
  badgeLink: string;
  headingPart1: string;
  headingPart2: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  dashboardTabs: {
    overview: string;
    traceability: string;
    qualityRisk: string;
  };
}

export interface DashboardTranslations {
  navDashboard: string;
  navProjects: string;
  navReviewInbox: string;
  navNotifications: string;
  navSettings: string;
  toggleSidebar: string;
  accountRole: string;
  runsKpi: string;
  passRateKpi: string;
  pendingAiKpi: string;
  coverageGapsKpi: string;
  vsPrior7d: string;
  viewDetails: string;
  traceabilityHeading: string;
  traceabilityEventsShort: string;
  allStages: string;
  projectHealth: string;
  viewAll: string;
  thProject: string;
  thHealth: string;
  thLastRun: string;
  thSuites: string;
  thAiPending: string;
  passRateTrend: string;
  trendPeriod: string;
  recentRuns: string;
  recentPipelines: string;
  pendingProposals: string;
  pendingProposalsCount: string;
  pendingProposalsSubtitle: string;
  reviewAction: string;
  statusPass: string;
  statusFail: string;
  statusRunning: string;
}

export interface FeaturesTranslations {
  sectionBadge: string;
  title: string;
  subtitle: string;
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  feature4Title: string;
  feature4Desc: string;
  feature5Title: string;
  feature5Desc: string;
}

export interface DocumentationTranslations {
  sectionBadge: string;
  title: string;
  subtitle: string;
  tabRest: string;
  tabGithubAction: string;
  tabPlaywright: string;
  copyCode: string;
  copied: string;
}

export interface PricingTranslations {
  sectionBadge: string;
  title: string;
  subtitle: string;
  monthly: string;
  annual: string;
  save20: string;
  planStarterTitle: string;
  planStarterDesc: string;
  planStarterPrice: string;
  planStarterCta: string;
  planStarterFeatures: string[];
  planProTitle: string;
  planProDesc: string;
  planProPriceMonthly: string;
  planProPriceAnnual: string;
  planProCta: string;
  planProBadge: string;
  planProFeatures: string[];
  planEnterpriseTitle: string;
  planEnterpriseDesc: string;
  planEnterprisePrice: string;
  planEnterpriseCta: string;
  planEnterpriseFeatures: string[];
}

export interface FooterTranslations {
  tagline: string;
  systemsOperational: string;
  product: string;
  resources: string;
  company: string;
  legal: string;
  rightsReserved: string;
  productLinks: {
    aiPrompt: string;
    reviewInbox: string;
    runsTelemetry: string;
    traceabilityGraph: string;
  };
  resourceLinks: {
    docs: string;
    apiKeys: string;
    githubActions: string;
    githubRepo: string;
  };
}

export interface Dictionary {
  nav: NavTranslations;
  hero: HeroTranslations;
  dashboard: DashboardTranslations;
  features: FeaturesTranslations;
  docs: DocumentationTranslations;
  pricing: PricingTranslations;
  footer: FooterTranslations;
}
