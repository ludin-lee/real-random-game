import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Harness guard-rail: the rules engine must stay pure (no DOM, no services, no Math.random
 * for gameplay) so it stays testable, replayable and simulatable. See CLAUDE.md.
 */
const coreDir = join(__dirname, '..', 'src', 'core');

describe('architecture', () => {
  for (const f of readdirSync(coreDir)) {
    it(`src/core/${f} is pure`, () => {
      const src = readFileSync(join(coreDir, f), 'utf8');
      expect(src).not.toMatch(/from ['"]\.\.\/(render|ui|services|meta)/);
      expect(src).not.toMatch(/\b(document|window|localStorage|navigator)\./);
      // Math.random is only allowed to pick a fresh seed in newGame.
      const randomUses = src.match(/Math\.random/g) ?? [];
      expect(randomUses.length).toBeLessThanOrEqual(f === 'game.ts' ? 1 : 0);
    });
  }
});
