import { expect, test } from 'vitest';
import { greet } from './index.js';

test('greet', () => {
  expect(greet('alpha')).toBe('Hello, alpha!');
});
