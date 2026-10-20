import { describe, expect, it } from 'vitest';
import { NO_FEED, parsePrintObservations } from '@/lib/print-observations';
describe('Separate print observation groups', () => {
  it('retains eight facts plus six visual items', () => {
    const result = parsePrintObservations([...Array.from({ length: 9 }, (_, i) => `DADO: Fato visível ${i}`), ...Array.from({ length: 7 }, (_, i) => `VISUAL: Paleta observada ${i}`)].join('\n'));
    expect(result.filter(o => o.kind === 'Data')).toHaveLength(8);
    expect(result.filter(o => o.kind === 'Visual')).toHaveLength(6);
  });
  it('preserves the exact no-feed observation', () => expect(parsePrintObservations(`VISUAL: ${NO_FEED}`)).toEqual([{ text: NO_FEED, kind: 'Visual' }]));
  it('deduplicates multiple prints and rejects value judgments', () => expect(parsePrintObservations('VISUAL: Fotos nítidas\nVISUAL: Fotos nítidas\nVISUAL: Feed amador')).toEqual([{ text: 'Fotos nítidas', kind: 'Visual' }]));
});