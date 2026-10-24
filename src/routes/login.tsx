import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { AuthForm } from '@/components/prospeccao/auth-form';
import { metadata } from '@/lib/prospeccao';

export const Route = createFileRoute('/login')({
  ssr: false,
  head: () => metadata('Login', 'Acesso privado à Prospecção.'),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: '/dashboard', replace: true });
  },
  component: () => <main className="app-container py-16"><AuthForm /></main>,
});