import type { Project, ProjectListItem } from '@qably/types'
import { apiRequest } from '@/lib/api-client'

export interface CreateProjectPayload {
  name: string
  description?: string
  connectionId?: string
  technologies: string[]
}

export type UpdateProjectPayload = Partial<{
  name: string
  description: string | null
  connectionId: string | null
  technologies: string[]
}>

export function listProjects(signal?: AbortSignal): Promise<ProjectListItem[]> {
  return apiRequest<ProjectListItem[]>('/projects', { signal })
}

export function getProject(id: string, signal?: AbortSignal): Promise<Project> {
  return apiRequest<Project>(`/projects/${id}`, { signal })
}

export function createProject(payload: CreateProjectPayload): Promise<Project> {
  return apiRequest<Project>('/projects', { method: 'POST', body: payload })
}

export function updateProject(
  id: string,
  payload: UpdateProjectPayload,
): Promise<Project> {
  return apiRequest<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: payload,
  })
}

export function deleteProject(id: string): Promise<void> {
  return apiRequest<void>(`/projects/${id}`, { method: 'DELETE' })
}
