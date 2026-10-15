import type { ReactNode } from 'react';
import { useAuth } from './auth-context';
import { AuthForm } from './auth-form';
export function Gate({children}:{children:ReactNode}) {
 const {user,loading}=useAuth();
 if(loading) return <div className="app-container py-24"><p className="loading-text text-muted-foreground">Carregando...</p></div>;
 if(!user) return <div className="app-container py-16"><AuthForm/></div>;
 return <>{children}</>;
}
