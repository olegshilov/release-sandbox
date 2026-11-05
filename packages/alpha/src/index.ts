/** A greeting, the one thing alpha exports. */
export type Greeting = `Hello, ${string}!`;

/** Greets `name`. The greeting is plain text, never HTML. */
export function greet(name: string): Greeting {
  return `Hello, ${name}!`;
}

/** Says goodbye to `name`, politely, once. */
export function farewell(name: string): string {
  return `Goodbye, ${name}!`;
}

/** Waves at `name`. */
export function wave(name: string): string {
  return `👋 ${name}`;
}
