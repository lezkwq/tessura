import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/prospeccao/password-field';
import { metadata } from '@/lib/prospeccao';

export const Route = createFileRoute('/redefinir')({
  head: () => metadata('Redefinir senha', 'Defina uma nova senha para seu acesso privado.'),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const recovery = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
    if (!recovery) { setError('Abra o link de redefinição recebido por email.'); return; }
    void supabase.auth.getUser().then(({ data, error }) => {
      setValid(Boolean(data.user && !error));
      if (error || !data.user) setError('O link expirou ou é inválido. Peça outro link.');
    }).catch(() => setError('Não foi possível validar o link. Peça outro link.'));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!valid) return;
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    setBusy(true); setError('');
    try {
      const result = await supabase.auth.updateUser({ password });
      if (result.error) { setError('Não foi possível salvar a senha. Use pelo menos 8 caracteres e tente novamente.'); return; }
      await supabase.auth.signOut();
      await navigate({ to: '/login', replace: true });
    } catch { setError('Não foi possível salvar a senha. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <main className="app-container py-16"><section className="auth-region">
    <h1 className="mb-8 text-2xl font-medium">Redefinir senha</h1>
    <form onSubmit={submit} className="space-y-5"><PasswordField label="Nova senha" autoComplete="new-password" />
      <Button variant="solid" className="w-full" disabled={!valid || busy}>{busy ? 'Aguarde...' : 'Salvar senha'}</Button>
    </form>
    {error && <p role="alert" className="mt-5 text-sm text-muted-foreground">{error}</p>}
    <Link to="/senha-perdida" className="mt-5 block text-sm text-muted-foreground underline">Pedir outro link</Link>
  </section></main>;
}