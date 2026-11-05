// A type-only import: alpha is an optional peer, so gamma must not need it at
// runtime. The shape mirrors server-client's optional peer on mock-core.
import type { Greeting } from '@olegshilov/sandbox-alpha';

/** Shouts a greeting produced by alpha, or any string. */
export function shout(text: Greeting | string): string {
  return `${text.toUpperCase()}!`;
}

// Gamma reads alpha through its optional peer.
