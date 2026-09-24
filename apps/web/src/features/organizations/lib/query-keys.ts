export const organizationKeys = {
  all: ['organizations'] as const,
  usage: ['organizations', 'current', 'usage'] as const,
}

export const memberKeys = {
  all: ['organizations', 'current', 'members'] as const,
}

export const inviteKeys = {
  all: ['organizations', 'current', 'invites'] as const,
}
