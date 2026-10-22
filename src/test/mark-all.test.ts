import { describe, expect, it } from 'vitest';
import { isNoFeedObservation, NO_FEED_OBSERVATION, type Observation } from '@/lib/audit-data';

const obs: Observation[] = [
  { id: '1', text: 'Nota 4,9', checked: false, source: 'Maps' },
  { id: '2', text: 'Fato do print', checked: false, source: 'Print', kind: 'Data' },
  { id: '3', text: 'Cores do feed', checked: false, source: 'Print', kind: 'Visual' },
  { id: '4', text: NO_FEED_OBSERVATION, checked: false, source: 'Print', kind: 'Visual' },
];

/** Same rule as the Auditoria screen buttons. */
const markAllData = (list: Observation[]) => list.map((x) => (x.kind === 'Visual' || isNoFeedObservation(x.text) ? x : { ...x, checked: true }));
const uncheckAll = (list: Observation[]) => list.map((x) => ({ ...x, checked: false }));

describe('Mark all data observations', () => {
  it('checks Maps and Print data, never Visual or the no-feed notice', () => {
    const result = markAllData(obs);
    expect(result.find(o => o.id === '1')?.checked).toBe(true);
    expect(result.find(o => o.id === '2')?.checked).toBe(true);
    expect(result.find(o => o.id === '3')?.checked).toBe(false);
    expect(result.find(o => o.id === '4')?.checked).toBe(false);
  });
  it('unchecks everything', () => {
    expect(uncheckAll(markAllData(obs)).every(o => !o.checked)).toBe(true);
  });
  it('detects the no-feed notice exactly', () => {
    expect(isNoFeedObservation(NO_FEED_OBSERVATION)).toBe(true);
    expect(isNoFeedObservation('O print mostra o feed')).toBe(false);
  });
});
