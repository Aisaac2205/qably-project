import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from './projects.api'
import { apiRequest } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))

const request = vi.mocked(apiRequest)

beforeEach(() => {
  request.mockReset()
  request.mockResolvedValue(undefined)
})

describe('projects api', () => {
  it('lists projects from the collection route', async () => {
    await listProjects()

    expect(request).toHaveBeenCalledWith('/projects', expect.anything())
  })

  it('reads one project by id', async () => {
    await getProject('p1')

    expect(request).toHaveBeenCalledWith('/projects/p1', expect.anything())
  })

  it('posts the payload when creating a project', async () => {
    await createProject({ name: 'Shop', technologies: ['react'] })

    expect(request).toHaveBeenCalledWith('/projects', {
      method: 'POST',
      body: { name: 'Shop', technologies: ['react'] },
    })
  })

  it('patches only the changed fields when updating', async () => {
    await updateProject('p1', { name: 'Renamed' })

    expect(request).toHaveBeenCalledWith('/projects/p1', {
      method: 'PATCH',
      body: { name: 'Renamed' },
    })
  })

  it('deletes a project by id', async () => {
    await deleteProject('p1')

    expect(request).toHaveBeenCalledWith('/projects/p1', { method: 'DELETE' })
  })
})
