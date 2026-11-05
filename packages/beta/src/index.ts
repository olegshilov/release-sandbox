import { greet, type Greeting } from '@olegshilov/sandbox-alpha';

/** Greets everyone, through alpha: a runtime dependency. */
export function greetAll(names: readonly string[]): string {
  return names.map((name) => greet(name)).join(' ');
}

/** Greets two people at once. */
export function greetBoth(a: string, b: string): [Greeting, Greeting] {
  return [greet(a), greet(b)];
}
