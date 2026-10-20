import { type Business, mapsUrl, placeData, safeUrl, weightedScore } from './prospeccao';
import { type Audit } from './abordagem';
import { parseNotes, photoCount, type AuditNotes } from './audit-data';
import { displayName, displayCity, formatPhone, formatRating, formatHours } from './format';
import { whatsappNumber } from './abordagem';

export function leadFilename(name: string): string {
  return `${name.toLocaleLowerCase('pt-BR').replace(/[\\/:*?"<>|]/g, '').replace(/[. ]+$/, '')}.md`;
}
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v.trim()) : typeof value === 'string' && value.trim() ? [value] : []; }
/** Allowlisted fields only: never serialize raw actor data or credentials. */
export function leadMarkdown(business: Business, audit: Audit | null, notes: AuditNotes): string {
  const d = placeData(business.data);
  const lines: string[] = [];
  const missing: string[] = [];
  if (business.enrichment_status !== 'ready') lines.push('Aviso: os detalhes da Apify ainda não foram carregados por completo.', '');
  lines.push(`# ${displayName(typeof d['title'] === 'string' ? d['title'] : '')}`, '');
  if (typeof d['categoryName'] === 'string') lines.push(`Categoria: ${d['categoryName']}`);
  if (business.city || business.state) lines.push(`Cidade: ${displayCity(business.city)} / ${business.state}`);
  lines.push('', '## Contatos');
  function contact(label: string, values: string[]) {
    const unique = [...new Set(values.filter(Boolean))];
    if (unique.length) unique.forEach(v => lines.push(`- ${label}: ${v}`)); else missing.push(label);
  }
  const rawPhone = d['phoneUnformatted'] ?? d['phone'];
  contact('Telefone', typeof rawPhone === 'string' ? [formatPhone(rawPhone)] : []);
  const phone = whatsappNumber(rawPhone);
  contact('WhatsApp', phone.number ? [`https://web.whatsapp.com/send?phone=${phone.number}`] : []);
  const website = safeUrl(d['website']);
  contact('Site no Maps', website ? [website] : []);
  const socials = [...strings(d['instagrams']), ...strings(d['facebooks']), ...strings(d['linkedIns']), ...strings(d['twitters']), ...strings(d['youtubes']), ...strings(d['tiktoks'])];
  const instagram = [...strings(d['instagrams']), ...(website?.includes('instagram.com/') ? [website] : [])];
  const facebook = [...strings(d['facebooks']), ...(website?.includes('facebook.com/') ? [website] : [])];
  contact('Rede social', [...socials, ...instagram, ...facebook]);
  contact('Instagram', instagram); contact('Facebook', facebook);
  contact('E-mail', strings(d['emails']));
  const other = [...strings(d['links']), ...strings(d['otherLinks']), ...strings(d['websites']), ...strings(d['linkedIns']), ...strings(d['twitters']), ...strings(d['youtubes']), ...strings(d['tiktoks'])];
  if (other.length) contact('Outros links', other);
  lines.push('', '## Google Maps');
  for (const [label, key] of [['Endereço', 'address'], ['Avaliações', 'reviewsCount']] as const) {
    const v = d[key]; if (typeof v === 'string' || typeof v === 'number') lines.push(`- ${label}: ${v}`);
  }
  if (typeof d['totalScore'] === 'number') lines.push(`- Nota: ${formatRating(d['totalScore'])}`);
  const score = weightedScore(d['totalScore'], d['reviewsCount']);
  if (score >= 0) lines.push(`- Nota ponderada: ${score.toFixed(4).replace('.', ',')}`);
  if (Array.isArray(d['openingHours'])) {
    const hours = d['openingHours'].flatMap(row => {
      if (typeof row === 'string') return [formatHours(row)];
      if (row && typeof row === 'object' && !Array.isArray(row) && typeof row['day'] === 'string' && typeof row['hours'] === 'string') return [`${row['day']}: ${formatHours(row['hours'])}`];
      return [];
    });
    if (hours.length) lines.push('- Horários:', ...hours.map(h => `  - ${h}`));
  }
  const count = photoCount(d); if (count !== null) lines.push(`- Quantidade de fotos: ${count}`);
  strings(d['imageUrls']).forEach(url => lines.push(`- Foto: ${url}`));
  lines.push(`- Link do Maps: ${mapsUrl(business)}`, `- placeId: ${business.place_id}`, '', '## O que eu adicionei');
  if (notes.complement) lines.push('', '### Complemento', notes.complement);
  const observations = notes.observations.length ? notes.observations : parseNotes({ observations: audit?.observation_state }).observations;
  function observationGroup(title: string, selected: typeof observations) {
    if (!selected.length) return;
    lines.push('', `### ${title}`, ...selected.map(o => `- [${o.checked ? 'x' : ' '}] ${o.text} (${o.source}, ${o.checked ? 'marcada' : 'não marcada'})`));
  }
  observationGroup('Observações', observations.filter(o => o.kind !== 'Visual'));
  observationGroup('Texto lido dos prints', observations.filter(o => o.source === 'Print' && o.kind !== 'Visual'));
  observationGroup('Linguagem visual (do print)', observations.filter(o => o.kind === 'Visual'));
  if (audit) {
    lines.push('', '### Mensagem atual', audit.message, '', `Status: ${audit.status}`, `Data: ${audit.created_at}`);
    if (audit.sent_at) lines.push(`Enviada em: ${audit.sent_at}`);
    if (audit.complement && audit.complement !== notes.complement) lines.push('', 'Complemento usado na mensagem:', audit.complement);
    if (audit.observations.length) lines.push('', 'Observações usadas na mensagem:', ...audit.observations.map(o => `- ${o}`));
  }
  if (missing.length) lines.push('', '## Não encontrado', ...missing.map(s => `- ${s}`));
  return `${lines.join('\n')}\n`;
}

export function downloadLeadMarkdown(business: Business, audit: Audit | null, notes: AuditNotes): void {
  const d = placeData(business.data);
  if (typeof d['title'] !== 'string' || !d['title'].trim()) throw new Error('O nome da empresa ainda não foi carregado.');
  const blob = new Blob([leadMarkdown(business, audit, notes)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = leadFilename(d['title']);
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}