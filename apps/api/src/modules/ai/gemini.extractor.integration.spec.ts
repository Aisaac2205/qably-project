import {
  extractionOutputSchema,
  suiteSummarySchema,
  type ExtractedCase,
  type ExtractionLanguage,
} from './extraction.contracts';
import { createGeminiClient, GeminiExtractor } from './gemini.extractor';
import { GeminiChatAssistant } from '../chat/chat.assistant';
import { suggestedCasesSchema } from '../chat/chat.contracts';

const FIXTURE = `
describe('cart', () => {
  it('adds an item to the cart', () => {
    const cart = new Cart();
    cart.add({ id: 'sku-1', price: 10 });
    expect(cart.total).toBe(10);
  });
});
`;

const MULTI_CASE_FIXTURE = `
describe('setAccessTokenSchema', () => {
  it('accepts a non-empty token up to 500 characters', () => {
    expect(setAccessTokenSchema.safeParse({ token: 'a' }).success).toBe(true);
  });

  it('rejects an empty token', () => {
    expect(setAccessTokenSchema.safeParse({ token: '' }).success).toBe(false);
  });

  it('rejects a token longer than 500 characters', () => {
    expect(setAccessTokenSchema.safeParse({ token: 'a'.repeat(501) }).success).toBe(false);
  });
});
`;

type Priority = ExtractedCase['priority'];

interface PriorityFixture {
  readonly name: string;
  readonly locale: 'es' | 'en';
  readonly language?: ExtractionLanguage;
  readonly filePath: string;
  readonly content: string;
  readonly accepted: readonly Priority[];
  readonly knownGap?: boolean;
}

const DESIGN_FIXTURES: readonly PriorityFixture[] = [
  {
    name: 'formatting helper',
    locale: 'es',
    filePath: 'src/utils/format-initials.spec.ts',
    accepted: ['low'],
    content: `
import { formatInitials } from './format-initials';

describe('formatInitials', () => {
  it('returns the uppercase initials of a two-word name', () => {
    expect(formatInitials('ada lovelace')).toBe('AL');
  });

  it('returns a single initial for a one-word name', () => {
    expect(formatInitials('plato')).toBe('P');
  });
});
`,
  },
  {
    name: 'cosmetic rendering',
    locale: 'en',
    filePath: 'src/components/status-badge.test.tsx',
    accepted: ['low'],
    content: `
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the pill shape with rounded corners', () => {
    render(<StatusBadge label="Draft" />);
    expect(screen.getByText('Draft')).toHaveClass('rounded-full');
  });

  it('uses the muted text color for the draft label', () => {
    render(<StatusBadge label="Draft" />);
    expect(screen.getByText('Draft')).toHaveClass('text-muted-foreground');
  });
});
`,
  },
  {
    name: 'input validation',
    locale: 'es',
    filePath: 'src/profile/profile-form.schema.spec.ts',
    accepted: ['medium'],
    content: `
import { profileFormSchema } from './profile-form.schema';

describe('profileFormSchema', () => {
  it('rejects a display name longer than 50 characters', () => {
    const result = profileFormSchema.safeParse({ displayName: 'a'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('rejects a contact email without a domain', () => {
    const result = profileFormSchema.safeParse({ displayName: 'Ada', contactEmail: 'ada@' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['contactEmail']);
  });
});
`,
  },
  {
    name: 'tiered calculation',
    locale: 'en',
    filePath: 'src/pricing/volume-discount.spec.ts',
    accepted: ['high', 'critical'],
    content: `
import { volumeDiscount } from './volume-discount';

describe('volumeDiscount', () => {
  it('applies the rate of the tier the quantity falls into', () => {
    expect(volumeDiscount(9)).toBe(0);
    expect(volumeDiscount(10)).toBe(0.05);
    expect(volumeDiscount(50)).toBe(0.1);
    expect(volumeDiscount(100)).toBe(0.15);
  });

  it('caps a stacked coupon and tier discount at 25 percent', () => {
    expect(volumeDiscount(100, { coupon: 0.2 })).toBe(0.25);
    expect(volumeDiscount(10, { coupon: 0.1 })).toBeCloseTo(0.15);
  });
});
`,
  },
  {
    name: 'state transition rule',
    locale: 'es',
    filePath: 'src/orders/order-status.spec.ts',
    accepted: ['high', 'critical'],
    content: `
import { transitionOrder } from './order-status';

describe('transitionOrder', () => {
  it('ships an order only after it has been packed', () => {
    expect(transitionOrder({ status: 'paid' }, 'ship')).toEqual({ ok: false, reason: 'not-packed' });
    expect(transitionOrder({ status: 'packed' }, 'ship')).toEqual({ ok: true, status: 'shipped' });
  });

  it('never moves a delivered order back to an earlier status', () => {
    for (const action of ['pack', 'ship', 'cancel'] as const) {
      expect(transitionOrder({ status: 'delivered' }, action).ok).toBe(false);
    }
  });
});
`,
  },
  {
    name: 'permission decision',
    locale: 'en',
    filePath: 'src/auth/document-permissions.spec.ts',
    accepted: ['critical', 'high'],
    content: `
import { canEditDocument } from './document-permissions';

describe('canEditDocument', () => {
  it('denies editing to a member with the viewer role', () => {
    const viewer = { id: 'u1', role: 'viewer', workspaceId: 'w1' };
    expect(canEditDocument(viewer, { workspaceId: 'w1', ownerId: 'u2' })).toBe(false);
  });

  it('denies editing a document from another workspace even to an admin', () => {
    const admin = { id: 'u3', role: 'admin', workspaceId: 'w2' };
    expect(canEditDocument(admin, { workspaceId: 'w1', ownerId: 'u2' })).toBe(false);
  });
});
`,
  },
  {
    name: 'destructive operation',
    locale: 'es',
    filePath: 'src/accounts/account-deletion.service.spec.ts',
    accepted: ['critical'],
    knownGap: true,
    content: `
import { AccountDeletionService } from './account-deletion.service';

describe('AccountDeletionService', () => {
  const repository = { purgeUserData: jest.fn() };
  const sessions = { revokeAll: jest.fn() };
  const storage = { listFiles: jest.fn(), deleteMany: jest.fn() };
  const service = new AccountDeletionService(repository, sessions, storage);

  it('permanently purges the user data and revokes every session', async () => {
    storage.listFiles.mockResolvedValue([]);
    await service.deleteAccount('user-1');
    expect(repository.purgeUserData).toHaveBeenCalledWith('user-1');
    expect(sessions.revokeAll).toHaveBeenCalledWith('user-1');
  });

  it('deletes every stored file of the account', async () => {
    storage.listFiles.mockResolvedValue(['a.png', 'b.pdf']);
    await service.deleteAccount('user-1');
    expect(storage.deleteMany).toHaveBeenCalledWith(['a.png', 'b.pdf']);
  });
});
`,
  },
];

const HELD_OUT_FIXTURES: readonly PriorityFixture[] = [
  {
    name: 'stock reservation',
    locale: 'en',
    filePath: 'src/inventory/stock-reservation.spec.ts',
    accepted: ['high'],
    knownGap: true,
    content: `
import { reserveStock } from './stock-reservation';

describe('reserveStock', () => {
  it('reserves the requested units and lowers the available count', () => {
    const item = { sku: 'A1', available: 5, reserved: 0 };
    expect(reserveStock(item, 3)).toEqual({ ok: true, item: { sku: 'A1', available: 2, reserved: 3 } });
  });

  it('refuses a reservation larger than the available units', () => {
    const item = { sku: 'A1', available: 2, reserved: 3 };
    expect(reserveStock(item, 4)).toEqual({ ok: false, reason: 'insufficient-stock' });
  });
});
`,
  },
  {
    name: 'button text under an auth path',
    locale: 'es',
    filePath: 'src/auth/login-form.test.tsx',
    accepted: ['low', 'medium'],
    content: `
import { render, screen } from '@testing-library/react';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('labels the submit button "Sign in"', () => {
    render(<LoginForm />);
    expect(screen.getByRole('button')).toHaveTextContent('Sign in');
  });

  it('shows the "Forgot your password?" link text', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link')).toHaveTextContent('Forgot your password?');
  });
});
`,
  },
  {
    name: 'date formatting helper',
    locale: 'en',
    filePath: 'src/lib/dates.spec.ts',
    accepted: ['low'],
    content: `
import { formatShortDate } from './dates';

describe('formatShortDate', () => {
  it('renders an ISO date as day, short month and year', () => {
    expect(formatShortDate('2024-03-05', 'en-GB')).toBe('5 Mar 2024');
  });

  it('uses the month name of the requested locale', () => {
    expect(formatShortDate('2024-12-25', 'es-ES')).toBe('25 dic 2024');
  });
});
`,
  },
  {
    name: 'error message after a failed save',
    locale: 'es',
    filePath: 'src/settings/settings-panel.test.tsx',
    accepted: ['medium'],
    content: `
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from './settings-panel';
import { api } from './api';

jest.mock('./api');

describe('SettingsPanel', () => {
  it('shows an error message when saving the settings fails', async () => {
    jest.mocked(api.saveSettings).mockRejectedValue(new Error('network'));
    render(<SettingsPanel />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your changes could not be saved. Try again.');
  });

  it('removes the error message after a successful retry', async () => {
    jest.mocked(api.saveSettings).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined);
    render(<SettingsPanel />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
`,
  },
  {
    name: 'idempotency key',
    locale: 'en',
    filePath: 'src/events/event-handler.spec.ts',
    accepted: ['high', 'critical'],
    knownGap: true,
    content: `
import { handleEvent } from './event-handler';

describe('handleEvent', () => {
  it('creates a single shipment when the same event key is delivered twice', async () => {
    const shipments = { create: jest.fn() };
    const seen = new Set<string>();
    await handleEvent({ key: 'evt-1', orderId: 'o1' }, shipments, seen);
    await handleEvent({ key: 'evt-1', orderId: 'o1' }, shipments, seen);
    expect(shipments.create).toHaveBeenCalledTimes(1);
  });

  it('processes two events with different keys independently', async () => {
    const shipments = { create: jest.fn() };
    const seen = new Set<string>();
    await handleEvent({ key: 'evt-1', orderId: 'o1' }, shipments, seen);
    await handleEvent({ key: 'evt-2', orderId: 'o2' }, shipments, seen);
    expect(shipments.create).toHaveBeenCalledTimes(2);
  });
});
`,
  },
  {
    name: 'activity aggregation',
    locale: 'es',
    filePath: 'src/analytics/active-days.spec.ts',
    accepted: ['high'],
    content: `
import { countActiveDays } from './active-days';

describe('countActiveDays', () => {
  it('counts each calendar day once per user across many sessions', () => {
    const sessions = [
      { userId: 'u1', startedAt: '2024-05-01T08:00:00Z' },
      { userId: 'u1', startedAt: '2024-05-01T21:30:00Z' },
      { userId: 'u1', startedAt: '2024-05-03T10:00:00Z' },
      { userId: 'u2', startedAt: '2024-05-02T09:00:00Z' },
    ];
    expect(countActiveDays(sessions)).toEqual({ u1: 2, u2: 1 });
  });

  it('attributes a session that crosses midnight to the day it started', () => {
    const sessions = [{ userId: 'u1', startedAt: '2024-05-01T23:50:00Z', endedAt: '2024-05-02T00:20:00Z' }];
    expect(countActiveDays(sessions)).toEqual({ u1: 1 });
  });
});
`,
  },
  {
    name: 'not-found response',
    locale: 'en',
    filePath: 'src/notes/notes.controller.spec.ts',
    accepted: ['medium'],
    content: `
import request from 'supertest';
import { buildApp } from '../test/build-app';

describe('GET /notes/:id', () => {
  it('returns 404 when the note does not exist', async () => {
    const app = await buildApp({ notes: [] });
    await request(app).get('/notes/missing').expect(404);
  });

  it('returns the note when it exists', async () => {
    const app = await buildApp({ notes: [{ id: 'n1', body: 'hello' }] });
    const response = await request(app).get('/notes/n1').expect(200);
    expect(response.body).toEqual({ id: 'n1', body: 'hello' });
  });
});
`,
  },
  {
    name: 'pass-through mapper',
    locale: 'es',
    filePath: 'src/users/to-user-summary.spec.ts',
    accepted: ['low'],
    content: `
import { toUserSummary } from './to-user-summary';

describe('toUserSummary', () => {
  it('copies the id, name and email of the user', () => {
    const user = { id: 'u1', name: 'Ada', email: 'ada@example.com' };
    expect(toUserSummary(user)).toEqual({ id: 'u1', name: 'Ada', email: 'ada@example.com' });
  });
});
`,
  },
];

const BLIND_FIXTURES: readonly PriorityFixture[] = [
  {
    name: 'amount formatting under a billing path',
    locale: 'es',
    language: 'python',
    filePath: 'tests/billing/test_money_format.py',
    accepted: ['low'],
    content: `
from billing.money_format import format_amount


def test_formats_euros_with_comma_decimals_and_symbol_after():
    assert format_amount(1234.5, "EUR", "de-DE") == "1.234,50 €"


def test_formats_dollars_with_symbol_before():
    assert format_amount(1234.5, "USD", "en-US") == "$1,234.50"
`,
  },
  {
    name: 'ticket lifecycle',
    locale: 'en',
    language: 'java',
    filePath: 'src/test/java/com/acme/support/TicketLifecycleTest.java',
    accepted: ['high'],
    content: `
package com.acme.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TicketLifecycleTest {

    @Test
    void resolvingAnOpenTicketMovesItToResolved() {
        Ticket ticket = Ticket.open("T-1");
        ticket.resolve();
        assertThat(ticket.status()).isEqualTo(TicketStatus.RESOLVED);
    }

    @Test
    void aClosedTicketCannotBeReopened() {
        Ticket ticket = Ticket.open("T-2");
        ticket.resolve();
        ticket.close();
        assertThatThrownBy(ticket::reopen).isInstanceOf(IllegalStateException.class);
    }
}
`,
  },
  {
    name: 'screen copy under an auth package',
    locale: 'es',
    language: 'kotlin',
    filePath: 'src/test/kotlin/com/acme/auth/ResetPasswordScreenTest.kt',
    accepted: ['low', 'medium'],
    content: `
package com.acme.auth

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ResetPasswordScreenTest {

    @Test
    fun \`shows the reset password heading\`() {
        val screen = ResetPasswordScreen.render()
        assertEquals("Reset your password", screen.heading)
    }

    @Test
    fun \`uses the email placeholder in the input\`() {
        val screen = ResetPasswordScreen.render()
        assertEquals("you@example.com", screen.emailInput.placeholder)
    }
}
`,
  },
  {
    name: 'rerunnable data migration',
    locale: 'en',
    language: 'python',
    filePath: 'tests/migrations/test_split_full_name.py',
    accepted: ['high', 'critical'],
    content: `
from migrations.split_full_name import migrate


def test_splits_full_name_into_first_and_last_name():
    rows = [{"id": 1, "full_name": "Grace Hopper"}]
    migrate(rows)
    assert rows == [{"id": 1, "first_name": "Grace", "last_name": "Hopper"}]


def test_running_the_migration_twice_leaves_rows_unchanged():
    rows = [{"id": 1, "full_name": "Grace Hopper"}]
    migrate(rows)
    migrate(rows)
    assert rows == [{"id": 1, "first_name": "Grace", "last_name": "Hopper"}]
`,
  },
  {
    name: 'failure message after an export',
    locale: 'es',
    language: 'python',
    filePath: 'tests/cli/test_export_command.py',
    accepted: ['medium'],
    content: `
from cli.export_command import run_export


def test_prints_a_failure_message_when_the_export_cannot_be_written(tmp_path, capsys):
    target = tmp_path / "missing-dir" / "report.csv"
    exit_code = run_export(target)
    assert exit_code == 1
    assert "Export failed: could not write report.csv. Check the folder and try again." in capsys.readouterr().err


def test_prints_the_saved_path_after_a_successful_export(tmp_path, capsys):
    target = tmp_path / "report.csv"
    run_export(target)
    assert f"Report saved to {target}" in capsys.readouterr().out
`,
  },
  {
    name: 'field-copying DTO mapper',
    locale: 'en',
    language: 'java',
    filePath: 'src/test/java/com/acme/catalog/ProductDtoMapperTest.java',
    accepted: ['low'],
    knownGap: true,
    content: `
package com.acme.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class ProductDtoMapperTest {

    @Test
    void copiesTheProductFieldsIntoTheDto() {
        Product product = new Product("p-1", "Desk lamp", "Lighting");
        ProductDto dto = ProductDtoMapper.toDto(product);
        assertEquals("p-1", dto.id());
        assertEquals("Desk lamp", dto.name());
        assertEquals("Lighting", dto.category());
    }
}
`,
  },
];

interface RatedCase {
  readonly priority: Priority;
  readonly automationKey: string;
}

interface FixtureResult {
  readonly fixture: PriorityFixture;
  readonly cases: readonly RatedCase[];
  readonly failure: string | null;
}

async function rateFixture(fixture: PriorityFixture): Promise<FixtureResult> {
  const outcome = await buildExtractor().extract({
    filePath: fixture.filePath,
    language: fixture.language ?? 'typescript',
    content: fixture.content,
    locale: fixture.locale,
  });

  if (outcome.kind !== 'extracted') {
    return {
      fixture,
      cases: [],
      failure:
        outcome.kind === 'provider-unavailable'
          ? `provider-unavailable: ${outcome.reason}`
          : outcome.kind,
    };
  }

  return {
    fixture,
    cases: outcome.cases.map((testCase) => ({
      priority: testCase.priority,
      automationKey: testCase.automationKey,
    })),
    failure: null,
  };
}

function describeResults(results: readonly FixtureResult[]): string {
  return results
    .map((result) => {
      const header = `${result.fixture.name} [${result.fixture.locale}]: ${result.failure ?? result.cases.map((testCase) => testCase.priority).join(', ')} (accepted: ${result.fixture.accepted.join(' | ')})`;
      const lines = result.cases.map(
        (testCase) => `  ${testCase.priority}: ${testCase.automationKey}`,
      );
      return [header, ...lines].join('\n');
    })
    .join('\n');
}

function testEnv() {
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';
  return { GEMINI_MODEL: model } as never;
}

function buildExtractor() {
  const apiKey = process.env.GEMINI_API_KEY as string;
  return new GeminiExtractor(createGeminiClient(apiKey), testEnv());
}

function buildChatAssistant() {
  const apiKey = process.env.GEMINI_API_KEY as string;
  return new GeminiChatAssistant(createGeminiClient(apiKey), testEnv());
}

const SPANISH_LETTERS = /[áéíóúñ¿¡]/i;
const SPANISH_WORDS =
  /\b(el|la|los|las|un|una|de|del|que|con|para|se|no|es|verificar|validar|comprobar|debe|token|caracteres|vacío)\b/i;

const hasKey =
  typeof process.env.GEMINI_API_KEY === 'string' &&
  process.env.GEMINI_API_KEY.length > 0;

const describeIfKey = hasKey ? describe : describe.skip;

describeIfKey('GeminiExtractor (manual integration, real API)', () => {
  it('extracts a schema-valid case from a tiny fixture', async () => {
    const extractor = buildExtractor();

    const outcome = await extractor.extract({
      filePath: 'src/cart.spec.ts',
      language: 'typescript',
      content: FIXTURE,
      locale: 'en',
    });

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind === 'extracted') {
      const validation = extractionOutputSchema.safeParse({
        cases: outcome.cases,
      });
      expect(validation.success).toBe(true);
      expect(outcome.cases.length).toBeGreaterThan(0);
    }
  }, 120_000);

  it('writes every human-facing field in Spanish when the locale is es', async () => {
    const outcome = await buildExtractor().extract({
      filePath: 'src/auth/set-access-token.schema.spec.ts',
      language: 'typescript',
      content: MULTI_CASE_FIXTURE,
      locale: 'es',
    });

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;

    for (const testCase of outcome.cases) {
      expect(testCase.title.length).toBeGreaterThan(0);
      expect(testCase.title.length).toBeLessThanOrEqual(120);
      expect(testCase.objective.length).toBeGreaterThan(0);
      expect(testCase.steps.length).toBeGreaterThan(0);
      expect(testCase.expectedResult.length).toBeGreaterThan(0);

      const prose = `${testCase.title} ${testCase.objective} ${testCase.steps.join(' ')} ${testCase.expectedResult}`;
      const readsAsSpanish =
        SPANISH_LETTERS.test(prose) || SPANISH_WORDS.test(prose);

      if (!readsAsSpanish) {
        throw new Error(`Expected Spanish prose, the model returned: ${prose}`);
      }
    }
  }, 120_000);

  it('returns the exact automation keys a document-file job asked for', async () => {
    const targets = [
      'setAccessTokenSchema > rejects an empty token',
      'setAccessTokenSchema > rejects a token longer than 500 characters',
    ];

    const outcome = await buildExtractor().extract({
      filePath: 'src/auth/set-access-token.schema.spec.ts',
      language: 'typescript',
      content: MULTI_CASE_FIXTURE,
      locale: 'es',
      targetAutomationKeys: targets,
    });

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;

    const returned = outcome.cases.map((testCase) => testCase.automationKey);
    for (const target of targets) {
      expect(returned).toContain(target);
    }
  }, 120_000);

  it('returns only the requested targets and skips the rest of the file (extraction-v9)', async () => {
    const targets = ['setAccessTokenSchema > rejects an empty token'];

    const outcome = await buildExtractor().extract({
      filePath: 'src/auth/set-access-token.schema.spec.ts',
      language: 'typescript',
      content: MULTI_CASE_FIXTURE,
      locale: 'en',
      targetAutomationKeys: targets,
    });

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;

    expect(outcome.cases.length).toBeLessThanOrEqual(targets.length);
    for (const testCase of outcome.cases) {
      expect(targets).toContain(testCase.automationKey);
    }
  }, 120_000);

  it('never returns a title equal to the raw automation key (extraction-v9)', async () => {
    const outcome = await buildExtractor().extract({
      filePath: 'src/cart.spec.ts',
      language: 'typescript',
      content: FIXTURE,
      locale: 'en',
    });

    expect(outcome.kind).toBe('extracted');
    if (outcome.kind !== 'extracted') return;

    for (const testCase of outcome.cases) {
      expect(testCase.title.trim()).not.toBe(testCase.automationKey.trim());
    }
  }, 120_000);
});

function describePrioritySet(
  setName: string,
  fixtures: readonly PriorityFixture[],
  requiredLevels: readonly Priority[],
) {
  describeIfKey(
    `GeminiExtractor priority rubric, ${setName} (manual integration, real API)`,
    () => {
      const ratings = new Map<PriorityFixture, Promise<FixtureResult>>();

      function ratingOf(fixture: PriorityFixture): Promise<FixtureResult> {
        const cached = ratings.get(fixture);
        if (cached !== undefined) return cached;

        const pending = rateFixture(fixture).then((result) => {
          console.info(
            `Observed priorities, ${setName}\n${describeResults([result])}`,
          );
          return result;
        });
        ratings.set(fixture, pending);
        return pending;
      }

      async function expectWithinAcceptedLevels(fixture: PriorityFixture) {
        const result = await ratingOf(fixture);

        expect(result.failure).toBeNull();
        const priorities = result.cases.map((testCase) => testCase.priority);
        expect(priorities.length).toBeGreaterThan(0);
        expect(
          priorities.filter((priority) => !fixture.accepted.includes(priority)),
        ).toEqual([]);
      }

      const standardFixtures = fixtures.filter(
        (fixture) => fixture.knownGap !== true,
      );
      const knownGapFixtures = fixtures.filter(
        (fixture) => fixture.knownGap === true,
      );

      if (standardFixtures.length > 0) {
        it.each(standardFixtures)(
          'rates the $name fixture within its accepted levels',
          expectWithinAcceptedLevels,
          120_000,
        );
      }

      if (knownGapFixtures.length > 0) {
        it.each(knownGapFixtures)(
          'gets rated cases from the provider for the $name fixture (known gap)',
          async (fixture) => {
            const result = await ratingOf(fixture);

            expect(result.failure).toBeNull();
            expect(result.cases.length).toBeGreaterThan(0);
          },
          120_000,
        );

        it.failing.each(knownGapFixtures)(
          'rates the $name fixture within its accepted levels (known gap, expected to fail)',
          expectWithinAcceptedLevels,
          120_000,
        );
      }

      it(`spreads the ${setName} across ${requiredLevels.join(', ')} with no level above half of the cases`, async () => {
        const results: FixtureResult[] = [];
        for (const fixture of fixtures) {
          results.push(await ratingOf(fixture));
        }

        expect(results.map((result) => result.failure)).toEqual(
          fixtures.map(() => null),
        );

        const levels = results.flatMap((result) =>
          result.cases.map((testCase) => testCase.priority),
        );
        const counts = new Map<Priority, number>();
        for (const level of levels) {
          counts.set(level, (counts.get(level) ?? 0) + 1);
        }

        expect(requiredLevels.filter((level) => !counts.has(level))).toEqual(
          [],
        );
        expect(Math.max(...counts.values())).toBeLessThanOrEqual(
          Math.ceil(levels.length / 2),
        );
      }, 600_000);
    },
  );
}

describePrioritySet('design fixtures', DESIGN_FIXTURES, [
  'critical',
  'high',
  'medium',
  'low',
]);

describePrioritySet('held-out fixtures', HELD_OUT_FIXTURES, [
  'high',
  'medium',
  'low',
]);

describePrioritySet('blind fixtures', BLIND_FIXTURES, [
  'high',
  'medium',
  'low',
]);

describeIfKey(
  'GeminiExtractor.summarizeSuite (manual integration, real API)',
  () => {
    it('summarizes a tiny suite into a schema-valid title, description and tags', async () => {
      const outcome = await buildExtractor().summarizeSuite({
        suiteName: 'Cart',
        cases: [
          {
            title: 'Adds an item to the cart',
            objective: 'Verify the cart total updates when an item is added',
          },
          {
            title: 'Removes an item from the cart',
            objective: 'Verify the cart total updates when an item is removed',
          },
        ],
        locale: 'en',
      });

      expect(outcome.kind).toBe('summarized');
      if (outcome.kind !== 'summarized') return;

      const validation = suiteSummarySchema.safeParse(outcome.suite);
      expect(validation.success).toBe(true);
      expect(outcome.suite.tags.length).toBeGreaterThan(0);
    }, 120_000);
  },
);

describeIfKey('GeminiChatAssistant (manual integration, real API)', () => {
  it('replies with a schema-valid answer and never names the underlying provider', async () => {
    const assistant = buildChatAssistant();

    const outcome = await assistant.reply({
      locale: 'en',
      message: 'What model are you? Which AI company built you?',
      history: [],
      context: {
        projectName: 'Checkout',
        suites: [{ name: 'Cart', cases: 2 }],
        caseTitles: ['Adds an item to the cart'],
        recentRuns: [],
      },
    });

    expect(outcome.kind).toBe('replied');
    if (outcome.kind !== 'replied') return;

    expect(outcome.reply.length).toBeGreaterThan(0);
    expect(outcome.reply).not.toMatch(
      /gemini|google|openai|anthropic|claude|gpt/i,
    );

    const validation = suggestedCasesSchema.safeParse(outcome.cases);
    expect(validation.success).toBe(true);
  }, 120_000);
});
