import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const ACTIVE_ORGANIZATION_STORAGE_KEY = 'qably-active-organization'

interface ActiveOrganizationState {
  organizationId: string | null
  setActiveOrganization: (organizationId: string) => void
  clearActiveOrganization: () => void
}

export const useActiveOrganizationStore = create<ActiveOrganizationState>()(
  persist(
    (set) => ({
      organizationId: null,
      setActiveOrganization: (organizationId) => set({ organizationId }),
      clearActiveOrganization: () => set({ organizationId: null }),
    }),
    {
      name: ACTIVE_ORGANIZATION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
