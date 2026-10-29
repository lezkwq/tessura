-- Run against the owner's existing hamburgueria reserve. Everything rolls back.
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"04e9e08d-06b2-4846-ba54-818edf17650b","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '04e9e08d-06b2-4846-ba54-818edf17650b', true);
DO $$
DECLARE
 search_id uuid := '1f80eae4-4d1f-433c-9750-51e62bdf06aa';
 lead_id uuid; blocked_id uuid; first_ids uuid[]; repeated_ids uuid[]; imported_ids uuid[];
BEGIN
 SELECT array_agg(id ORDER BY score DESC,place_id) INTO first_ids FROM public.take_all(search_id);
 IF cardinality(first_ids) <> 74 THEN RAISE EXCEPTION 'Expected 74 existing eligible companies'; END IF;
 SELECT array_agg(id ORDER BY score DESC,place_id) INTO repeated_ids FROM public.take_all(search_id);
 IF first_ids IS DISTINCT FROM repeated_ids THEN RAISE EXCEPTION 'Repeat changed identities or order'; END IF;
 lead_id := first_ids[1]; blocked_id := first_ids[2];
 UPDATE public.businesses SET is_lead=true WHERE id=lead_id;
 INSERT INTO public.blocked_places(place_id) SELECT place_id FROM public.businesses WHERE id=blocked_id;
 SELECT array_agg(id ORDER BY score DESC,place_id) INTO repeated_ids FROM public.take_all(search_id);
 IF cardinality(repeated_ids) <> 72 OR lead_id=ANY(repeated_ids) OR blocked_id=ANY(repeated_ids) THEN
  RAISE EXCEPTION 'Lead or blocked business was returned';
 END IF;
 UPDATE public.searches SET status='running' WHERE id=search_id;
 SELECT array_agg(id ORDER BY score DESC,place_id) INTO imported_ids
 FROM public.finish_search(search_id,'zRVKWLrPcEl9c9TXK','[]'::jsonb);
 IF imported_ids IS DISTINCT FROM repeated_ids THEN RAISE EXCEPTION 'finish_search excluded shown companies or included blocked/lead companies'; END IF;
 IF (SELECT status FROM public.searches WHERE id=search_id) <> 'ready' THEN RAISE EXCEPTION 'Eligible reserve incorrectly exhausted'; END IF;
END $$;
ROLLBACK;