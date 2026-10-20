import { z } from 'zod';
export const observationSchema = z.object({ id: z.string(), text: z.string().max(300), checked: z.boolean(), source: z.enum(['Maps', 'Print']), kind: z.enum(['Data', 'Visual']).optional() });
export const notesSchema = z.object({ complement: z.string().max(300).default(''), observations: z.array(observationSchema).max(30).default([]) });
export type Observation = z.infer<typeof observationSchema>;
export type AuditNotes = z.infer<typeof notesSchema>;
export function parseNotes(value: unknown): AuditNotes { const parsed = notesSchema.safeParse(value); return parsed.success ? parsed.data : { complement: '', observations: [] }; }
export function confirmedSources(observations: string[], complement: string): string[] { return [...observations, ...(complement.trim() ? [complement.trim()] : [])]; }
export function photoCount(data: Record<string, unknown>): number | null {
  const count = data['imagesCount'];
  return typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null;
}