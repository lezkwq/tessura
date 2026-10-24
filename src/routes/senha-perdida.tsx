import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { metadata } from '@/lib/prospeccao';

export const Route = createFileRoute('/senha-perdida')({
  head: () => metadata('Senha perdida', 'Solicite um link para redefinir sua senha.'),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir` });
    } catch { /* Preserve the same response regardless of account existence. */ }
    finally { setSent(true); setBusy(false); }
  }
  return <main className="app-container py-16"><section className="auth-region">
    <h1 className="mb-8 text-2xl font-medium">Senha perdida?</h1>
    <form onSubmit={submit} className="space-y-5">
      <label className="block"><span className="field-label">Email</span><input className="field" type="email" name="email" autoComplete="email" required /></label>
      <Button variant="solid" className="w-full" disabled={busy}>{busy ? 'Aguarde...' : 'Enviar link'}</Button>
    </form>
    {sent && <p role="status" className="mt-5 text-sm text-muted-foreground">Se esse email tiver conta, enviamos um link para redefinir a senha.</p>}
    <Link to="/login" className="mt-5 block text-sm text-muted-foreground underline">Voltar ao login</Link>
  </section></main>;
}