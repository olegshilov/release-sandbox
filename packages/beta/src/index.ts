import { greet } from '@olegshilov/sandbox-alpha';

/** Greets everyone, through alpha: a runtime dependency. */
export function greetAll(names: readonly string[]): string {
  return names.map((name) => greet(name)).join(' ');
}
