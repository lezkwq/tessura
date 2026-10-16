import { Link, useLocation } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth-context';
import { cn } from '@/lib/utils';
import { List } from '@phosphor-icons/react';
import { ActionIcon } from './action-icon';
import { useState } from 'react';
export function Header() {
 const {user}=useAuth(); const path=useLocation({select:l=>l.pathname});
 const [open,setOpen]=useState(false);
 return <header className="app-header relative z-10"><div className="app-container grid h-full grid-cols-[1fr_auto] items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
 <Link to="/" className="brand w-fit">Prospecção</Link>
 <Button variant="quiet" className="h-auto p-0 sm:hidden" aria-expanded={open} onClick={()=>setOpen(!open)}><ActionIcon icon={List}/>Menu</Button>
 <nav className={cn('pill-bar bg-card! max-sm:absolute max-sm:left-4 max-sm:right-4 max-sm:top-[72px] max-sm:flex-wrap max-sm:justify-center',!open&&'max-sm:hidden')} aria-label="Navegação principal">
 {([{to:'/',label:'Busca',active:path==='/'},{to:'/leads',label:'Leads',active:path.startsWith('/leads')},{to:'/auditorias',label:'Auditorias',active:path==='/auditorias'},{to:'/regras',label:'Regras',active:path==='/regras'}] as const).map(item=><Link key={item.to} to={item.to} onClick={()=>setOpen(false)} aria-current={item.active?'page':undefined} className={cn('nav-item text-foreground! hover:bg-muted! active:scale-[0.98] motion-reduce:transform-none',item.active&&'bg-primary! text-primary-foreground! hover:bg-primary/90!')}>{item.label}</Link>)}
 {user&&<Button variant="quiet" size="sm" className="sm:hidden" onClick={()=>void supabase.auth.signOut()}>Sair</Button>}</nav>
 {user&&<Button variant="quiet" size="sm" className="hidden justify-self-end lg:block" onClick={()=>void supabase.auth.signOut()}>Sair</Button>}
 </div></header>;
}
