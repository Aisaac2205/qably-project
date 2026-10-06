import { screen } from '@testing-library/react'
import type { SuiteSummariesPage } from '@qably/types'
import type { ListSuiteSummariesParams } from '@/features/projects/suites/api/suites.api'
import { summary } from './suite-summaries-test-data'

export function rowIds(): string[] {
  return screen
    .getAllByTestId(/^suite-row-/)
    .map((row) => (row.getAttribute('data-testid') ?? '').replace('suite-row-', ''))
}

export function rowsFrom(start: number, end: number) {
  return Array.from({ length: end - start }, (_, index) =>
    summary(`s${start + index}`, { name: `Suite ${start + index}` }),
  )
}

export function later<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 0))
}

export function pagedBy(total: number, pageSize: number) {
  return (params: ListSuiteSummariesParams): Promise<SuiteSummariesPage> => {
    const start = params.cursor === undefined ? 0 : Number(params.cursor)
    const end = Math.min(start + pageSize, total)

    return later({
      items: rowsFrom(start, end),
      nextCursor: end < total ? String(end) : null,
    })
  }
}
