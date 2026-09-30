interface AddressedRequest {
  ip?: string;
}

export function addressTracker(request: AddressedRequest): string {
  return `ip:${request.ip ?? 'unknown'}`;
}
