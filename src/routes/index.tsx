import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { metadata } from '@/lib/prospeccao';

export const Route = createFileRoute('/')({
  ssr: false,
  head: () => metadata('Prospecção', 'Sua ferramenta privada de prospecção.'),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? '/dashboard' : '/login', replace: true });
  },
  component: () => null,
});