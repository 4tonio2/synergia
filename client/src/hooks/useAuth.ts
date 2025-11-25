import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User, MedicalRole } from "@shared/schema";

export function useAuth() {
  const [user, setUser] = useState<User | undefined>(undefined);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch user profile from our database
        const response = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      }
      
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSupabaseUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch user profile from our database
        const response = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } else {
        setUser(undefined);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    try {
      // Appeler l'API backend pour nettoyer la session côté serveur
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Erreur lors de l\'appel API logout:', error);
    }
    
    // Déconnecter de Supabase
    await supabase.auth.signOut();
    
    // Rediriger vers la page de connexion
    window.location.href = '/';
  };

  return {
    user,
    supabaseUser,
    isLoading,
    isAuthenticated: !!supabaseUser,
    logout,
  };
}
