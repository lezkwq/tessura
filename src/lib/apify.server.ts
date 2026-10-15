import type { Json } from '@/integrations/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
export type AppClient = SupabaseClient<Database>;
export async function assertOwner(db: AppClient) {
 const {data,error}=await db.rpc('is_owner');
 if(error||!data) throw new Error('Acesso restrito ao proprietário.');
}
export async function apify<T>(path: string, input?: Record<string, unknown>): Promise<T> {
 const key=process.env['APIFY_API_KEY']; const projectKey=process.env['LOVABLE_API_KEY'];
 if(!key||!projectKey)throw new Error('Configure a chave do Apify nos conectores do projeto.');
 const response=await fetch(`https://connector-gateway.lovable.dev/apify${path}`,{method:input?'POST':'GET',headers:{Authorization:`Bearer ${projectKey}`,'X-Connection-Api-Key':key,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined,signal:AbortSignal.timeout(25000)});
 if(!response.ok) {
  // Do not return or log provider bodies: upstream errors can contain credentials.
  throw new Error(`O Apify retornou um erro (${response.status}). Verifique a conexão e o saldo da sua conta.`);
 }
 return await response.json() as T;
}
export interface ActorRun {id:string;status:string;defaultDatasetId:string;}
export async function startRun(input: Record<string,unknown>) { return (await apify<{data:ActorRun}>('/acts/compass~crawler-google-places/runs',input)).data; }
export async function readRun(id:string) { return (await apify<{data:ActorRun}>(`/actor-runs/${encodeURIComponent(id)}`)).data; }
export async function readDataset(id:string) {
 const result: Record<string,Json>[]=[];
 for(let offset=0;;offset+=100) {
  const rows=await apify<Record<string,Json>[]>(`/datasets/${encodeURIComponent(id)}/items?clean=true&limit=100&offset=${offset}`);
  result.push(...rows);
  if(rows.length<100)break;
  if(offset>=10000)throw new Error('O conjunto de resultados excedeu o limite de leitura.');
 }
 return result;
}
export function cleanPlace(row: Record<string,Json>): Json {
 const allowed=['placeId','title','categoryName','categories','address','street','city','state','postalCode','countryCode','phone','phoneUnformatted','totalScore','reviewsCount','website','url','openingHours','reviews','imageUrls','imageUrl','images','facebooks','instagrams','twitters','youtubes','tiktoks','linkedIns','emails','socialMedia','additionalInfo'];
 return Object.fromEntries(allowed.filter(k=>row[k]!==undefined).map(k=>[k,row[k]]));
}
export const baseInput={language:'pt-BR',skipClosedPlaces:true,scrapeSocialMediaProfiles:{facebooks:false,instagrams:false,youtubes:false,tiktoks:false,twitters:false}};
