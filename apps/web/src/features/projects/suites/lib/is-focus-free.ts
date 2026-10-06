export function isFocusFree(...holders: readonly Element[]): boolean {
  const active = document.activeElement

  return active === null || active === document.body || holders.includes(active)
}
