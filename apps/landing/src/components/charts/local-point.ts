export interface PointType {
  x: number;
  y: number;
}

export function localPoint(
  nodeOrEvent: Element | React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent,
  maybeEvent?: MouseEvent | TouchEvent
): PointType | null {
  if (!nodeOrEvent) return null;

  let node: Element | null = null;
  let event: MouseEvent | TouchEvent | null = null;

  if (maybeEvent) {
    node = nodeOrEvent as Element;
    event = maybeEvent;
  } else if ('target' in nodeOrEvent) {
    event = nodeOrEvent as unknown as MouseEvent;
    node = (event.target as Element) || null;
  }

  if (!node || !event) return null;

  // Resolve client coordinates from mouse or touch event
  const isTouch = 'touches' in event;
  const touch = isTouch ? (event as TouchEvent).touches[0] || (event as TouchEvent).changedTouches[0] : null;
  const clientX = touch ? touch.clientX : (event as MouseEvent).clientX;
  const clientY = touch ? touch.clientY : (event as MouseEvent).clientY;

  if (clientX == null || clientY == null) return null;

  // Find topmost SVG
  const svg = 'ownerSVGElement' in node && (node as SVGElement).ownerSVGElement
    ? (node as SVGElement).ownerSVGElement
    : node instanceof SVGSVGElement
    ? node
    : null;

  if (svg && 'getScreenCTM' in svg) {
    const screenCTM = svg.getScreenCTM();
    if (screenCTM) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const transformed = point.matrixTransform(screenCTM.inverse());
      return { x: transformed.x, y: transformed.y };
    }
  }

  // Fallback to bounding client rect
  const rect = node.getBoundingClientRect();
  return {
    x: clientX - rect.left - (node.clientLeft || 0),
    y: clientY - rect.top - (node.clientTop || 0),
  };
}
