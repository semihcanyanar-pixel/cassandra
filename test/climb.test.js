import { describe, it, expect } from 'vitest';
import { trailAt, stepFraction, climberAt, climbText, SUMMIT, TRAIL } from '../src/lib/climb.js';

describe('Tırmanış geometrisi', () => {
  it('iz dağın eteğinden zirveye gider', () => {
    expect(trailAt(0)).toMatchObject({ x: TRAIL[0][0], y: TRAIL[0][1] });
    expect(trailAt(1)).toMatchObject({ x: SUMMIT[0], y: SUMMIT[1] });
    expect(trailAt(0.5).y).toBeLessThan(trailAt(0.2).y); // higher up means smaller y
  });
  it('ayak izleri zirveyi boş bırakır ve yukarı doğru sıralanır', () => {
    const ys = [0, 1, 2, 3].map((i) => trailAt(stepFraction(i, 4)).y);
    expect(ys).toEqual([...ys].sort((a, b) => b - a));
    expect(stepFraction(3, 4)).toBeLessThan(1);
  });
  it('tırmanıcı yapılan sayıya göre durur', () => {
    expect(climberAt(0, 4).pose).toBe('walk');
    expect(climberAt(2, 4)).toMatchObject({ pose: 'climb', ...trailAt(stepFraction(1, 4)) });
    expect(climberAt(4, 4)).toMatchObject({ pose: 'cheer', x: SUMMIT[0], y: SUMMIT[1] });
    expect(climberAt(1, 1).pose).toBe('cheer');
  });
  it('metinler', () => {
    expect(climbText(4, 4)).toBe('Zirvedesin!');
    expect(climbText(0, 4)).toBe('Yola çıkalım');
    expect(climbText(1, 4)).toBe('zirveye 3 adım kaldı');
  });
});
