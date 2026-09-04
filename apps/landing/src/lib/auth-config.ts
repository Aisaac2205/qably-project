/**
 * Configuración dinámica de URL para autenticación hacia apps/web.
 * En desarrollo local: http://localhost:3000 (o configurado mediante PUBLIC_WEB_URL)
 * En producción: configurado mediante la variable de entorno PUBLIC_WEB_URL o PUBLIC_APP_URL.
 *
 * Tanto Iniciar Sesión como Registrarse / Comenzar Gratis utilizan la misma ruta unificada de login:
 * `/login?next=%2Fprojects`
 */

export function getWebBaseUrl(): string {
  const raw =
    (typeof import.meta !== 'undefined' ? import.meta.env?.PUBLIC_WEB_URL : undefined) ??
    (typeof process !== 'undefined' ? process.env?.PUBLIC_WEB_URL : undefined);

  if (!raw) {
    throw new Error(
      'PUBLIC_WEB_URL is not set: point it at the Qably app origin, for example https://app.qably.dev',
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`PUBLIC_WEB_URL is not a url: received "${raw}"`);
  }

  if (parsed.origin === 'null') {
    throw new Error(`PUBLIC_WEB_URL has no comparable origin: received "${raw}"`);
  }

  return parsed.origin;
}

export function getAuthUrl(nextPath = '/projects'): string {
  const baseUrl = getWebBaseUrl().replace(/\/$/, '');
  const encodedNext = encodeURIComponent(nextPath);
  return `${baseUrl}/login?next=${encodedNext}`;
}
