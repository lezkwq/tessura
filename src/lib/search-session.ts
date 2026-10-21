import { z } from 'zod';

export const SEARCH_SESSION_KEY = 'prospeccao:busca-sessao';
const schema = z.object({
  form: z.object({ city: z.string(), state: z.string(), niche: z.string() }),
  searchId: z.string().uuid().nullable(),
  batchIds: z.array(z.string().uuid()),
});
export type SearchSession = z.infer<typeof schema>;
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Access itself can throw when browser storage is blocked. */
export function readSearchSession(access: StorageAccess): SearchSession | null {
  try {
    const raw = access().getItem(SEARCH_SESSION_KEY);
    if (!raw) return null;
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}
export function writeSearchSession(access: StorageAccess, value: SearchSession | null): void {
  try {
    if (value) access().setItem(SEARCH_SESSION_KEY, JSON.stringify(value));
    else access().removeItem(SEARCH_SESSION_KEY);
  } catch { /* The current screen remains usable without persistence. */ }
}