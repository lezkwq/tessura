import { Link, useLocation } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth-context';
import { cn } from '@/lib/utils';
export function Header() {
 const {user}=useAuth(); const path=useLocation({select:l=>l.pathname});
 return <header className="app-header"><div className="app-container flex h-full items-center justify-between gap-4"><Link to="/" className="brand">Prospecção<span className="ml-3 hidden text-[11px] font-normal text-muted-foreground sm:inline">USO PESSOAL</span></Link><nav className="flex h-full items-center gap-6 sm:gap-8" aria-label="Navegação principal"><Link to="/" className={cn('nav-item',path==='/'&&'active')}>Busca</Link><Link to="/leads" className={cn('nav-item',path.startsWith('/leads')&&'active')}>Leads</Link>{user&&<Button variant="quiet" size="sm" onClick={()=>void supabase.auth.signOut()}>Sair</Button>}</nav></div></header>;
}
