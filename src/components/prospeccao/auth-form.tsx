import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
export function AuthForm() {
 const navigate=useNavigate();
 const [signup,setSignup]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();setBusy(true);setMessage('');
  const form=new FormData(e.currentTarget); const email=String(form.get('email')??'').trim(); const password=String(form.get('password')??'');
  try {
   const result=signup?await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}}):await supabase.auth.signInWithPassword({email,password});
   if(result.error) {setMessage(signup?'Não foi possível criar a conta. O cadastro é exclusivo para o proprietário.':'Email ou senha inválidos. Tente novamente.');return;}
   if(result.data.session) await navigate({to:'/dashboard',replace:true});
    if(signup&&!result.data.session)setMessage('Confira seu email para confirmar a conta antes de entrar.');
  } catch {setMessage('Não foi possível conectar. Tente novamente.');} finally {setBusy(false);}
 }
 return <section className="auth-region"><div className="mb-8"><p className="eyebrow mb-3">ACESSO PRIVADO</p><h2 className="text-2xl font-medium">{signup?'Criar meu acesso':'Entre na sua conta'}</h2><p className="mt-3 text-muted-foreground">{signup?'Um único acesso para a sua Prospecção.':'Seu espaço de busca e seus leads.'}</p></div><form onSubmit={submit} className="space-y-5"><label className="block"><span className="field-label">Email</span><input className="field" type="email" name="email" autoComplete="email" placeholder="seu@email.com" required /></label><label className="block"><span className="field-label">Senha</span><input className="field" type="password" name="password" autoComplete={signup?'new-password':'current-password'} minLength={8} required placeholder="Sua senha" /></label><Button variant="solid" className="w-full" disabled={busy}>{busy?'Aguarde...':signup?'Criar acesso':'Entrar'}</Button>{message&&<p role="status" className="text-sm text-muted-foreground">{message}</p>}</form><Button variant="quiet" className="mt-5 w-full" onClick={()=>{setSignup(!signup);setMessage('');}}>{signup?'Já tenho acesso':'Primeiro acesso'}</Button></section>;
}
