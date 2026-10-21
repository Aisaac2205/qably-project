import type * as Ts from 'typescript';

let loaded: typeof Ts | undefined;

/**
 * The compiler is about 9 MB of JavaScript. Requiring it on the first parse
 * instead of at import keeps it out of the API's boot for every process that
 * never reads a test file.
 */
export function loadTypescript(): typeof Ts {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a static import would load the compiler at boot
  loaded ??= require('typescript') as typeof Ts;
  return loaded;
}
