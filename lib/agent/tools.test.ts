import { describe, it, expect } from 'vitest';
import { numArg } from './tools';

describe('numArg', () => {
  it('合法数字原样返回', () => {
    expect(numArg(720, 24)).toBe(720);
  });

  it('数字字符串转换', () => {
    expect(numArg('720', 24)).toBe(720);
  });

  it('"0" 不被误吞为默认值（falsy-zero 陷阱：旧实现 Number(x) || fallback 会把 0 吞掉）', () => {
    expect(numArg('0', 24)).toBe(0);
    expect(numArg(0, 24)).toBe(0);
  });

  it('undefined/null/空串 → 默认值', () => {
    expect(numArg(undefined, 24)).toBe(24);
    expect(numArg(null, 24)).toBe(24);
    expect(numArg('', 24)).toBe(24);
  });

  it('NaN/非法值 → 默认值', () => {
    expect(numArg('abc', 24)).toBe(24);
    expect(numArg({}, 24)).toBe(24);
  });
});
