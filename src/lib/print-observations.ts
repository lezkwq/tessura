import { NO_FEED_OBSERVATION } from './audit-data';
export interface PrintObservation { text: string; kind: 'Data' | 'Visual' }
export const NO_FEED = NO_FEED_OBSERVATION;
/** Separate caps prevent profile facts from truncating the visual reading. */
export function parsePrintObservations(output: string): PrintObservation[] {
  const seen = new Set<string>();
  const counts = { Data: 0, Visual: 0 };
  return output.split('\n').flatMap(line => {
    const match = line.trim().match(/^(DADO|VISUAL)\s*:\s*(.+)$/i);
    if (!match?.[2]) return [];
    const kind = match[1]?.toUpperCase() === 'VISUAL' ? 'Visual' : 'Data';
    const text = match[2].replace(/[—–]/g, ',').trim();
    const key = text.toLocaleLowerCase('pt-BR');
    if (text.length < 4 || text.length > 300 || /\p{Extended_Pictographic}/u.test(text) || /\b(feio|amador|desorganizado|mal feito)\b/i.test(text) || seen.has(key) || counts[kind] >= (kind === 'Data' ? 8 : 6)) return [];
    seen.add(key); counts[kind] += 1;
    return [{ text, kind }];
  });
}