import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const ACTIVE_ORGANIZATION_STORAGE_KEY = 'qably-active-organization'

interface ActiveOrganizationState {
  organizationId: string | null
  userId: string | null
  setActiveOrganization: (organizationId: string, userId: string) => void
  clearActiveOrganization: () => void
}

export const useActiveOrganizationStore = create<ActiveOrganizationState>()(
  persist(
    (set) => ({
      organizationId: null,
      userId: null,
      setActiveOrganization: (organizationId, userId) => set({ organizationId, userId }),
      clearActiveOrganization: () => set({ organizationId: null, userId: null }),
    }),
    {
      name: ACTIVE_ORGANIZATION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
