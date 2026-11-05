/** A greeting, the one thing alpha exports. */
export type Greeting = `Hello, ${string}!`;

export function greet(name: string): Greeting {
  return `Hello, ${name}!`;
}
