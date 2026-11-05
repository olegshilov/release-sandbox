import { expect, test } from 'vitest';
import { greetAll } from './index.js';

test('greetAll', () => {
  expect(greetAll(['a', 'b'])).toBe('Hello, a! Hello, b!');
});
