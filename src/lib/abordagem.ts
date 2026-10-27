import type { Database } from '@/integrations/supabase/types';
import { placeData, type Business } from './prospeccao';
import { unsupportedNumbers } from './message-numbers';
import { displayCity, displayName, formatRating } from './format';
import { photoCount } from './audit-data';
import { isBrazil } from './search-input';
export type Rules = Database['public']['Tables']['message_rules']['Row'];
export type Audit = Database['public']['Tables']['audits']['Row'];

export function wordCount(message: string): number {
  return message.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function norm(s: string) {
  return s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '');
}

/** Facts the model may cite. Numbers in the message must appear here. */
export function leadFacts(b: Business): string[] {
  const d = placeData(b.data);
  const facts: string[] = [];
  if (typeof d['title'] === 'string') facts.push(`Empresa: ${displayName(d['title'])}`);
  if (typeof d['categoryName'] === 'string') facts.push(`Categoria: ${d['categoryName']}`);
  facts.push(`Cidade: ${displayCity(b.city)}/${b.state}`);
  if (typeof d['totalScore'] === 'number') facts.push(`Nota no Google: ${formatRating(d['totalScore'])}`);
  if (typeof d['reviewsCount'] === 'number') facts.push(`Avaliações no Google: ${d['reviewsCount']}`);
  facts.push(`Site no Maps: ${b.website_type}`);
  const count = photoCount(d); if (count !== null) facts.push(`Fotos no Google Maps: ${count}`);
  return facts;
}

/** Selectable observations derived only from the saved Maps data. */
export function mapsObservations(b: Business): string[] {
  const d = placeData(b.data);
  const out: string[] = [];
  if (typeof d['totalScore'] === 'number') {
    const n = typeof d['reviewsCount'] === 'number' ? d['reviewsCount'] : null;
    out.push(n !== null ? `A nota no Google é ${formatRating(d['totalScore'])} com ${n} avaliações` : `A nota no Google é ${formatRating(d['totalScore'])}`);
  }
  const site: Record<string, string> = {
    'sem site': 'O Maps não mostra nenhum site da empresa',
    'só Instagram': 'O campo de site do Maps leva ao Instagram',
    'só Facebook': 'O campo de site do Maps leva ao Facebook',
    'só WhatsApp': 'O campo de site do Maps leva ao WhatsApp',
    'só link na bio': 'O campo de site do Maps leva a uma página de link na bio',
  };
  const siteObs = site[b.website_type]; if (siteObs) out.push(siteObs);
  if (Array.isArray(d['openingHours']) && d['openingHours'].length) out.push('Os horários de funcionamento estão publicados no Maps');
  else out.push('O Maps não mostra horários de funcionamento');
  const photos = Array.isArray(d['imageUrls']) ? d['imageUrls'].length : 0;
  if (photos) out.push('O perfil no Maps tem fotos publicadas');
  const count = photoCount(d); if (count !== null) out.push(`O Maps informa ${count} fotos`);
  return out;
}

export function validateMessage(message: string, rules: Rules, sources: string[]): string[] {
  const errors: string[] = [];
  const m = message.trim();
  const words = wordCount(m);
  if (!norm(m).startsWith(norm(rules.opening))) errors.push(`não começa com "${rules.opening}"`);
  if (words < rules.min_words || words > rules.max_words) errors.push(`tem ${words} palavras, fora do intervalo de ${rules.min_words} a ${rules.max_words}`);
  if (/\p{Extended_Pictographic}/u.test(m)) errors.push('contém emoji');
  if (/https?:\/\/|www\.|\b[\w-]+\.(com|br|net|org|me|ee|ai|cc|link)\b/i.test(m)) errors.push('contém link');
  if (/R\$|\breais\b|\d+,\d{2}\b/i.test(m)) errors.push('contém preço');
  if (/[—–]/.test(m)) errors.push('contém travessão');
  if (!norm(m).includes(norm(rules.signer))) errors.push(`não menciona ${rules.signer}`);
  const nm = norm(m);
  const banned = rules.banned_words.filter((w) => w.trim() && nm.includes(norm(w.trim())));
  if (banned.length) errors.push(`usa palavras proibidas: ${banned.join(', ')}`);
  const invented = unsupportedNumbers(m, sources);
  if (invented.length) errors.push(`cita números que não estão nos dados: ${invented.join(', ')}`);
  return errors;
}

/** Never infer a foreign dialing code or insert a subscriber digit. */
export function whatsappNumber(phone: unknown, country = 'Brasil'): { number: string | null; reason: string } {
  if (typeof phone !== 'string' || !phone.trim()) return { number: null, reason: 'O Maps não informou telefone.' };
  let digits = phone.replace(/\D/g, '');
  if (!isBrazil(country)) {
    if (!/^\+\s*[1-9]/.test(phone.trim())) return { number: null, reason: 'Número sem código do país, confira antes de enviar' };
    if (digits.length < 7 || digits.length > 15) return { number: null, reason: 'O telefone não tem código do país e número completos.' };
    return { number: digits, reason: '' };
  }
  if (phone.trim().startsWith('+') || digits.length > 11) {
    if (!digits.startsWith('55')) return { number: null, reason: 'O telefone não é do Brasil.' };
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10 && digits.length !== 11) return { number: null, reason: 'O telefone não tem DDD e número completos.' };
  return { number: `55${digits}`, reason: '' };
}

export function whatsappLink(number: string, message: string) {
  return `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`;
}
