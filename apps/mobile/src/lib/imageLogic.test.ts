import { describe, expect, it } from 'vitest';
import { base64ToBytes, fitWithin } from './imageLogic';

describe('préparation des photos', () => {
  it('réduit en conservant le ratio, sans jamais agrandir', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1200, 4800, 1600)).toEqual({ width: 400, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('décode le base64 (vecteurs de référence RFC 4648 et en-tête JPEG)', () => {
    const vectors: [string, number[]][] = [
      ['', []],
      ['YQ==', [97]],
      ['YWI=', [97, 98]],
      ['YWJj', [97, 98, 99]],
      ['VGFtdXJ0', [84, 97, 109, 117, 114, 116]],
      ['+/8=', [0xfb, 0xff]],
      ['/9j/4AAQ', [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]],
    ];
    for (const [encoded, bytes] of vectors) {
      expect(Array.from(base64ToBytes(encoded))).toEqual(bytes);
    }
    // Les sauts de ligne éventuels (base64 MIME) sont ignorés.
    expect(Array.from(base64ToBytes('VGFt\ndXJ0'))).toEqual([84, 97, 109, 117, 114, 116]);
  });
});
