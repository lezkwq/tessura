GRANT SELECT, INSERT, UPDATE, DELETE ON public.searches, public.businesses, public.reserves, public.blocked_places TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.searches, public.businesses, public.reserves, public.blocked_places, public.user_roles TO service_role;