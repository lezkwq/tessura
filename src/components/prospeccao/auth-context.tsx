import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
const AuthContext = createContext<{user: User | null; loading: boolean}>({user:null,loading:true});
export function AuthProvider({children}: {children: ReactNode}) {
 const [user,setUser] = useState<User | null>(null);
 const [loading,setLoading] = useState(true);
 const queryClient = useQueryClient(); const router = useRouter();
 useEffect(() => {
  let active=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session) => {
   if (!['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)) return;
   if(active) {setUser(session?.user ?? null);setLoading(false);}
   if(event==='SIGNED_OUT') queryClient.clear();
   else void queryClient.invalidateQueries();
   void router.invalidate();
  });
  void supabase.auth.getUser().then(({data})=>{if(active){setUser(data.user);setLoading(false);}}).catch(()=>{if(active)setLoading(false);});
  return ()=>{active=false;subscription.unsubscribe();};
 },[queryClient,router]);
 return <AuthContext.Provider value={{user,loading}}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
