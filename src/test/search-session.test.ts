import { describe, expect, it } from 'vitest';
import { readSearchSession, writeSearchSession } from '@/lib/search-session';

function tab() {
  const rows = new Map<string, string>();
  return () => ({ getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); }, removeItem: (key: string) => { rows.delete(key); } });
}
const value = { form: { country: 'Brasil', location: 'Cuiabá, MT', niche: 'açaí' }, searchId: 'dac39712-7bd0-47f3-8dbf-7a373b88e6f5', batchIds: ['023a59d5-e565-41a4-9d13-b23eef77bd48'] };
describe('tab search session', () => {
  it('retains fields and shown batch ids in the same tab', () => { const store = tab(); writeSearchSession(store, value); expect(readSearchSession(store)).toEqual(value); });
  it('starts empty in another tab', () => { writeSearchSession(tab(), value); expect(readSearchSession(tab())).toBeNull(); });
  it('clears the session for Nova busca', () => { const store = tab(); writeSearchSession(store, value); writeSearchSession(store, null); expect(readSearchSession(store)).toBeNull(); });
  it('survives denied storage access', () => { const denied = () => { throw new Error('blocked'); }; expect(readSearchSession(denied)).toBeNull(); expect(() => writeSearchSession(denied, value)).not.toThrow(); });
  it('reports a full tab store without changing the previous session', () => { const store = tab(); writeSearchSession(store, value); const full = () => ({ ...store(), setItem: () => { throw new Error('QuotaExceededError'); } }); expect(writeSearchSession(full, { ...value, form: { ...value.form, country: 'Portugal' } })).toBe(false); expect(readSearchSession(store)).toEqual(value); });
  it('retains a foreign country and free-form location', () => { const store = tab(); const foreign = { ...value, form: { country: 'Portugal', location: 'Lisboa', niche: 'açaí' } }; writeSearchSession(store, foreign); expect(readSearchSession(store)).toEqual(foreign); });
});