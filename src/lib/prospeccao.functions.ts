import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { assertOwner, startRun, readRun, readDataset, cleanPlace, baseInput } from './apify.server';
import { states, weightedScore, websiteType, type Business } from './prospeccao';
export const keyStatus=createServerFn({method:'GET'}).handler(()=>({configured:Boolean(process.env['APIFY_TOKEN'])}));
export const latestSearch=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{ const {data,error}=await context.supabase.from('searches').select('*').order('updated_at',{ascending:false}).limit(1).maybeSingle(); if(error)throw new Error('Não foi possível carregar a última busca.');return data; });
const searchSchema=z.object({city:z.string().trim().min(2).max(100),state:z.string().refine(s=>states.includes(s)),niche:z.string().trim().min(2).max(120)});
const idSchema=z.object({id:z.string().uuid()});
export const beginSearch=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>searchSchema.parse(input)).handler(async({data,context})=>{
 const db=context.supabase; await assertOwner(db);
 const normalized={city:data.city.toLocaleLowerCase('pt-BR'),state:data.state,niche:data.niche.toLocaleLowerCase('pt-BR')};
 const existing=await db.from('searches').select('*').match({...normalized,user_id:context.userId}).maybeSingle();
 if(existing.error)throw new Error('Não foi possível carregar a busca.');
 let search=existing.data;
 if(!search) {const created=await db.from('searches').upsert({...normalized,user_id:context.userId},{onConflict:'user_id,city,state,niche',ignoreDuplicates:true}).select().maybeSingle();
  search=created.data??(await db.from('searches').select('*').match({...normalized,user_id:context.userId}).single()).data;
 }
 if(!search)throw new Error('Não foi possível iniciar a busca.');
 if(search.status==='running'||search.status==='exhausted')return {search,batch:[] as Business[]};
 const {data:batch,error}=await db.rpc('take_batch',{p_search:search.id});
 if(error)throw new Error('Não foi possível carregar o lote.');
 if(batch?.length)return {search,batch};
 const claim=await db.from('searches').update({status:'running',run_id:null,dataset_id:null,updated_at:new Date().toISOString()}).eq('id',search.id).in('status',['idle','ready','failed']).select().maybeSingle();
 if(!claim.data) return {search:{...search,status:'running' as const},batch:[] as Business[]};
 try {
  const run=await startRun({...baseInput,searchStringsArray:[data.niche],locationQuery:`${data.city}, ${data.state}, Brasil`,maxCrawledPlacesPerSearch:120,maxReviews:0,maxImages:0,scrapeContacts:false});
  const saved=await db.from('searches').update({run_id:run.id,dataset_id:run.defaultDatasetId}).eq('id',search.id).select().single();
  if(saved.error)throw new Error('Não foi possível guardar o andamento da busca.');
  return {search:saved.data,batch:[] as Business[]};
 }catch(error){await db.from('searches').update({status:'failed'}).eq('id',search.id);throw error;}
});
export const pollSearch=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>idSchema.parse(input)).handler(async({data,context})=>{
 const db=context.supabase;await assertOwner(db);
 const found=await db.from('searches').select('*').eq('id',data.id).single();const search=found.data;
 if(!search)throw new Error('Busca não encontrada.');
 if(search.status!=='running'||!search.run_id)return {search,batch:[] as Business[]};
 const run=await readRun(search.run_id);
 if(['FAILED','ABORTED','TIMED-OUT'].includes(run.status)){await db.from('searches').update({status:'failed'}).eq('id',search.id);throw new Error('O Apify não concluiu esta busca. Tente novamente.');}
 if(run.status!=='SUCCEEDED')return {search,batch:[] as Business[]};
 const rows=await readDataset(run.defaultDatasetId);
 // The row lock held by the import RPC makes polling and batch delivery idempotent.
 const candidates=rows.flatMap(row=>{
  const kind=websiteType(row['website']);
  if(!kind||typeof row['placeId']!=='string')return [];
  return [{place_id:row['placeId'],data:cleanPlace(row),website_type:kind,score:weightedScore(row['totalScore'],row['reviewsCount'])}];
 });
 const imported=await db.rpc('finish_search',{p_search:search.id,p_run:search.run_id,p_places:candidates});
 if(imported.error)throw new Error('Não foi possível guardar os resultados.');
 const fresh=await db.from('searches').select('*').eq('id',search.id).single();
 return {search:fresh.data??search,batch:imported.data??[]};
});
export const listLeads=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await assertOwner(context.supabase);const {data,error}=await context.supabase.from('businesses').select('*').eq('is_lead',true).order('created_at',{ascending:false});
 if(error)throw new Error(`Não foi possível carregar os leads. (${error.message})`);return data;
});
export const getLead=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>idSchema.parse(input)).handler(async({data,context})=>{
 await assertOwner(context.supabase);const {data:lead,error}=await context.supabase.from('businesses').select('*').eq('id',data.id).eq('is_lead',true).single();
 if(error||!lead)throw new Error('Lead não encontrado.');return lead;
});
export const addLead=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>idSchema.parse(input)).handler(async({data,context})=>{
 const db=context.supabase;await assertOwner(db);
 const result=await db.from('businesses').select('*').eq('id',data.id).single();const business=result.data;
 if(!business)throw new Error('Empresa não encontrada.');
 if(['running','ready'].includes(business.enrichment_status))return business;
 const claim=await db.from('businesses').update({is_lead:true,enrichment_status:'running'}).eq('id',business.id).in('enrichment_status',['idle','failed']).select().maybeSingle();
 if(!claim.data)return business;
 try {
  const run=await startRun({...baseInput,searchStringsArray:[`place_id:${business.place_id}`],maxCrawledPlacesPerSearch:1,scrapePlaceDetailPage:true,maxReviews:99999,reviewsSort:'newest',maxImages:100,scrapeContacts:true});
  const saved=await db.from('businesses').update({enrichment_run_id:run.id,enrichment_dataset_id:run.defaultDatasetId}).eq('id',business.id).select().single();
  if(!saved.data)throw new Error('Não foi possível salvar o lead.');return saved.data;
 }catch(error){await db.from('businesses').update({enrichment_status:'failed'}).eq('id',business.id);throw error;}
});
export const pollLead=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>idSchema.parse(input)).handler(async({data,context})=>{
 const db=context.supabase;await assertOwner(db);const found=await db.from('businesses').select('*').eq('id',data.id).eq('is_lead',true).single();const lead=found.data;
 if(!lead)throw new Error('Lead não encontrado.');
 if(lead.enrichment_status!=='running'||!lead.enrichment_run_id)return lead;
 const run=await readRun(lead.enrichment_run_id);
 if(['FAILED','ABORTED','TIMED-OUT'].includes(run.status)){await db.from('businesses').update({enrichment_status:'failed'}).eq('id',lead.id);throw new Error('Não foi possível enriquecer o lead. Tente novamente.');}
 if(run.status!=='SUCCEEDED')return lead;
 const row=(await readDataset(run.defaultDatasetId)).find(r=>r['placeId']===lead.place_id);
 if(!row){await db.from('businesses').update({enrichment_status:'failed'}).eq('id',lead.id);throw new Error('O Apify não devolveu os detalhes desta empresa.');}
 const saved=await db.from('businesses').update({data:cleanPlace(row),enrichment_status:'ready',updated_at:new Date().toISOString()}).eq('id',lead.id).select().single();
 if(!saved.data)throw new Error('Não foi possível salvar os detalhes.');return saved.data;
});
export const discardBusiness=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({placeId:z.string().min(1).max(300)}).parse(input)).handler(async({data,context})=>{
 await assertOwner(context.supabase);const {error}=await context.supabase.rpc('discard_place',{p_place:data.placeId});
 if(error)throw new Error('Não foi possível descartar a empresa.');return {ok:true};
});
export const restoreSearch=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string().uuid().optional()}).parse(input)).handler(async({data,context})=>{
 const db=context.supabase;await assertOwner(db);
 const q=db.from('searches').select('*');
 const found=data.id?await q.eq('id',data.id).maybeSingle():await q.order('updated_at',{ascending:false}).limit(1).maybeSingle();
 if(found.error)throw new Error(`Não foi possível carregar a última busca. (${found.error.message})`);
 if(!found.data)return {search:null,batch:[] as Business[]};
 const rows=await db.from('reserves').select('shown_at,businesses(*)').eq('search_id',found.data.id).not('shown_at','is',null).order('shown_at',{ascending:true});
 if(rows.error)throw new Error(`Não foi possível restaurar os resultados. (${rows.error.message})`);
 const batch=(rows.data??[]).flatMap(r=>r.businesses?[r.businesses as Business]:[]);
 return {search:found.data,batch};
});
