import { describe, expect, it } from 'vitest';
import { readSearchSession, writeSearchSession } from '@/lib/search-session';

function tab() {
  const rows = new Map<string, string>();
  return () => ({ getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); }, removeItem: (key: string) => { rows.delete(key); } });
}
const value = { form: { city: 'Cuiabá', state: 'MT', niche: 'açaí' }, searchId: 'dac39712-7bd0-47f3-8dbf-7a373b88e6f5', batchIds: ['023a59d5-e565-41a4-9d13-b23eef77bd48'] };
describe('tab search session', () => {
  it('retains fields and shown batch ids in the same tab', () => { const store = tab(); writeSearchSession(store, value); expect(readSearchSession(store)).toEqual(value); });
  it('starts empty in another tab', () => { writeSearchSession(tab(), value); expect(readSearchSession(tab())).toBeNull(); });
  it('clears the session for Nova busca', () => { const store = tab(); writeSearchSession(store, value); writeSearchSession(store, null); expect(readSearchSession(store)).toBeNull(); });
  it('survives denied storage access', () => { const denied = () => { throw new Error('blocked'); }; expect(readSearchSession(denied)).toBeNull(); expect(() => writeSearchSession(denied, value)).not.toThrow(); });
});