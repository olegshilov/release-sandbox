import { expect, test } from 'vitest';
import { shout } from './index.js';

test('shout', () => {
  expect(shout('Hello, gamma!')).toBe('HELLO, GAMMA!!');
});
