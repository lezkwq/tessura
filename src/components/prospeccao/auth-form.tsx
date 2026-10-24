import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PasswordField } from './password-field';

export function AuthForm() {
 const navigate=useNavigate();
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();setBusy(true);setMessage('');
  const form=new FormData(e.currentTarget);
  try {
   const {data,error}=await supabase.auth.signInWithPassword({email:String(form.get('email')??'').trim(),password:String(form.get('password')??'')});
   if(error||!data.session) {setMessage('Email ou senha incorretos');return;}
   await navigate({to:'/dashboard',replace:true});
  } catch {setMessage('Email ou senha incorretos');} finally {setBusy(false);}
 }
 return <section className="auth-region"><div className="mb-8"><p className="eyebrow mb-3">ACESSO PRIVADO</p><h1 className="text-2xl font-medium">Entre na sua conta</h1><p className="mt-3 text-muted-foreground">Seu espaço de busca e seus leads.</p></div><form onSubmit={submit} className="space-y-5"><label className="block"><span className="field-label">Email</span><input className="field" type="email" name="email" autoComplete="email" placeholder="seu@email.com" required /></label><PasswordField/><Link to="/senha-perdida" className="block text-sm text-muted-foreground underline">Senha perdida?</Link><Button variant="solid" className="w-full" disabled={busy}>{busy?'Aguarde...':'Entrar'}</Button>{message&&<p role="alert" className="text-sm text-muted-foreground">{message}</p>}</form></section>;
}
