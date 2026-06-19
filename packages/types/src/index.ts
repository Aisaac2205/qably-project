export enum TestStatus {
    PASS = 'pass',
    FAIL = 'fail',
    SKIPPED = 'skipped',
    BLOCKED = 'blocked',
}

export enum TestPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

export enum RunSource {
    MANUAL = 'manual',
    API = 'api',
    GITHUB_ACTIONS = 'github_actions',
}

export enum UserRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    MEMBER = 'member',
}

export interface BaseEntity {
    id: string
    createdAt: Date
    updatedAt: Date
}

export interface Organization extends BaseEntity {
    name: string
    slug: string
    plan: 'free' | 'pro' | 'agency'
}

export interface Project extends BaseEntity {
    name: string
    description?: string
    organizationId: string
}

export interface TestSuite extends BaseEntity {
    name: string
    projectId: string
}

export interface TestCase extends BaseEntity {
    title: string
    steps: string
    expectedResult: string
    priority: TestPriority
    suiteId: string
}

export interface TestRun extends BaseEntity {
    name: string
    source: RunSource
    branch?: string
    commitSha?: string
    projectId: string
}

export interface TestResult extends BaseEntity {
    status: TestStatus
    comment?: string
    duration?: number
    runId: string
    caseId: string
}