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
  headerSubtitle: string;
  periodLabel: string;
  period7d: string;
  period30d: string;
  period90d: string;
  kpiPassRate: string;
  kpiRuns: string;
  kpiFailedCases: string;
  kpiAvgDuration: string;
  kpiDeltaVsPeriod: string;
  heroTitle: string;
  heroSeriesCurrent: string;
  heroSeriesPrevious: string;
  heroTrendText: string;
  heroTrendSubtitle: string;
  projectsTitle: string;
  thProject: string;
  thSuites: string;
  thCases: string;
  thPassRate: string;
  casesTitle: string;
  casesGaugeLabel: string;
  casesPassedOf: string;
  casesFailed: string;
  casesSkipped: string;
  casesBlocked: string;
  channelsTitle: string;
  channelsDeliveryLabel: string;
  channelsSentCount: string;
  channelsFailedCount: string;
  channelsUnreadCount: string;
  activityTitle: string;
  activityPassedOf: string;
  statusPass: string;
  statusFail: string;
  statusRunning: string;
  statusBlocked: string;
  runsKpi?: string;
  passRateKpi?: string;
  pendingAiKpi?: string;
  coverageGapsKpi?: string;
  vsPrior7d?: string;
  viewDetails?: string;
  traceabilityHeading?: string;
  traceabilityEventsShort?: string;
  allStages?: string;
  projectStatus?: string;
  viewAll?: string;
  thLastRun?: string;
  thAiPending?: string;
  passRateTrend?: string;
  trendPeriod?: string;
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
  codeCardLabel: string;
  codeCardConfidence: string;
  cardStatusApproved: string;
  cardIngestionSpeedLabel: string;
  cardFlakyBadge: string;
  cardTraceabilityRequirements: string;
  cardTraceabilityCoverage: string;
}

export interface DocumentationTranslations {
  sectionBadge: string;
  title: string;
  subtitle: string;
  tabJunit: string;
  tabGithubAction: string;
  tabRest: string;
  copyCode: string;
  copied: string;
}

export interface PricingTierCopy {
  name: string;
  description: string;
  cta: string;
}

export interface PricingTranslations {
  sectionBadge: string;
  title: string;
  subtitle: string;
  perMonth: string;
  mostPopularBadge: string;
  membersFeature: string;
  projectsFeatureOne: string;
  projectsFeatureOther: string;
  projectsFeatureUnlimited: string;
  creditsFeature: string;
  teamReviewFeature: string;
  sharedFeatures: string[];
  tiers: {
    gratuito: PricingTierCopy;
    equipo: PricingTierCopy;
    empresa: PricingTierCopy;
  };
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
  companyLinks: {
    pricing: string;
    terms: string;
    privacy: string;
    security: string;
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
