/** A greeting, the one thing alpha exports. */
export type Greeting = `Hello, ${string}!`;

/** Greets `name`. The greeting is plain text, never HTML. */
export function greet(name: string): Greeting {
  return `Hello, ${name}!`;
}
