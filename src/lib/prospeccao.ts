import type { Database, Json } from '@/integrations/supabase/types';
export type Business = Database['public']['Tables']['businesses']['Row'];
export type Search = Database['public']['Tables']['searches']['Row'];
export type PlaceData = Record<string, Json | undefined>;
export const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export function websiteType(website: unknown): Business['website_type'] | null {
 if (website === undefined || website === null || website === '') return 'sem site';
 if (typeof website !== 'string') return null;
 if (!website.trim()) return 'sem site';
 try {
  const url = new URL(/^[a-z]+:\/\//i.test(website) ? website : `https://${website}`);
  if (!['http:','https:'].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./,'');
  const matches = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (matches('instagram.com')) return 'só Instagram';
  if (matches('facebook.com')) return 'só Facebook';
  if (['wa.me','api.whatsapp.com'].some(matches)) return 'só WhatsApp';
  if (['linktr.ee','beacons.ai','bio.link','taplink.cc'].some(matches)) return 'só link na bio';
 } catch { return null; }
 return null;
}
export function weightedScore(rating: unknown, count: unknown): number {
 return typeof rating === 'number' && rating >= 0 && rating <= 5 && typeof count === 'number' && count > 0 ? (rating * count + 40) / (count + 10) : -1;
}
export function placeData(value: Json): PlaceData { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
export function text(value: unknown): string { return typeof value === 'string' && value.trim() ? value : typeof value === 'number' ? String(value) : 'não informado'; }
export function safeUrl(value: unknown): string | undefined { if (typeof value !== 'string') return undefined; try { const u = new URL(value); if (['http:','https:'].includes(u.protocol)) return u.href; } catch { return undefined; } return undefined; }
export function mapsUrl(b: Business): string { const d=placeData(b.data); return safeUrl(d['url']) ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.place_id)}&query_place_id=${encodeURIComponent(b.place_id)}`; }
export function metadata(title: string, description: string) { return { meta: [{title: `${title} | Prospecção`},{name:'description',content:description},{property:'og:title',content:`${title} | Prospecção`},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}] }; }
