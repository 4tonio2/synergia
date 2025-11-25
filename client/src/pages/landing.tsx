import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { MedicalCrossLogo } from "@/components/MedicalCrossLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Heart, Users, Activity, UserPlus, LockKeyhole } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import type { MedicalRole } from "@shared/schema";
import { supabase } from "@/lib/supabase";

const MEDICAL_ROLES: { value: MedicalRole; label: string; icon: typeof Heart }[] = [
  { value: "infirmier", label: "Infirmier", icon: Heart },
  { value: "medecin", label: "Médecin", icon: Activity },
  { value: "kinesitherapeute", label: "Kinésithérapeute", icon: Users },
  { value: "aidant_pro", label: "Aidant pro", icon: UserPlus },
];

export default function Landing() {
  const [selectedRole, setSelectedRole] = useState<MedicalRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [, setLocation] = useLocation();

  // Check for pending role after OAuth redirect
  useEffect(() => {
    const applyRoleAfterOAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await applyPendingRole(session.access_token);
        setLocation("/");
      }
    };
    
    applyRoleAfterOAuth();
  }, [setLocation]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validation
    if (!selectedRole) {
      setError("Veuillez sélectionner votre rôle professionnel");
      setIsLoading(false);
      return;
    }
    if (!email || !email.includes("@")) {
      setError("Veuillez entrer une adresse e-mail valide");
      setIsLoading(false);
      return;
    }
    if (!password || password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      setIsLoading(false);
      return;
    }

    try {
      // Store selected role in localStorage before auth
      localStorage.setItem("pendingMedicalRole", selectedRole);
      
      let result;
      if (isSignUp) {
        // Sign up new user
        result = await supabase.auth.signUp({
          email,
          password,
        });
      } else {
        // Sign in existing user
        result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }

      const { data, error: authError } = result;

      if (authError) {
        setError(authError.message === "Invalid login credentials" 
          ? "Email ou mot de passe incorrect" 
          : authError.message);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Apply the pending role and wait for it
        await applyPendingRole(data.session?.access_token);
        
        // Give a small delay for the database to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Redirect to home
        setLocation("/");
      }
    } catch (err) {
      setError("Erreur lors de la connexion. Veuillez réessayer.");
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!selectedRole) {
      setError("Veuillez sélectionner votre rôle professionnel");
      return;
    }

    try {
      // Store selected role in localStorage before OAuth redirect
      localStorage.setItem("pendingMedicalRole", selectedRole);
      
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (signInError) {
        setError("Erreur lors de la connexion avec Google");
      }
    } catch (error) {
      setError("Erreur lors de la connexion. Veuillez réessayer.");
    }
  };

  const applyPendingRole = async (accessToken?: string) => {
    const pendingRole = localStorage.getItem("pendingMedicalRole");
    
    if (pendingRole && accessToken) {
      try {
        const response = await fetch("/api/auth/apply-pending-role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ medicalRole: pendingRole }),
        });
        
        if (response.ok) {
          localStorage.removeItem("pendingMedicalRole");
          return true;
        } else {
          console.error("Failed to apply pending role:", await response.text());
          return false;
        }
      } catch (error) {
        console.error("Failed to apply pending role:", error);
        return false;
      }
    }
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-8">
      {/* Header with logo and branding */}
      <div className="flex flex-col items-center mb-8">
        <MedicalCrossLogo className="w-12 h-12 mb-3" />
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-app-name">
          Plode Care
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Plateforme médicale sécurisée
        </p>
      </div>

      {/* Main authentication card */}
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-2xl font-bold text-center">
            Se connecter
          </CardTitle>
          <CardDescription className="text-center">
            Accédez à votre espace professionnel sécurisé
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Role selection section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Choisissez votre rôle :
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {MEDICAL_ROLES.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.value;
                
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => {
                      setSelectedRole(role.value);
                      setError(null);
                    }}
                    data-testid={`button-role-${role.value}`}
                    className={`
                      flex flex-col items-center justify-center gap-2 py-4 px-3
                      border-2 rounded-lg transition-all duration-200
                      hover-elevate active-elevate-2
                      ${
                        isSelected
                          ? "border-primary bg-primary/5 font-semibold text-primary"
                          : "border-border bg-card text-card-foreground hover:border-primary/50"
                      }
                    `}
                    aria-pressed={isSelected}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm text-center leading-tight">
                      {role.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive"
              data-testid="text-error-message"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Email/Password form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Adresse e-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="professionnel@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              data-testid="button-login-email"
              disabled={isLoading}
            >
              {isLoading ? "Chargement..." : isSignUp ? "Créer un compte" : "Se connecter"}
            </Button>
          </form>

          {/* Toggle between sign in and sign up */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isSignUp 
                ? "Vous avez déjà un compte ? Se connecter" 
                : "Pas encore de compte ? S'inscrire"}
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              ou
            </span>
          </div>

          {/* Google SSO button */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleGoogleLogin}
            data-testid="button-login-google"
            disabled={isLoading}
          >
            <SiGoogle className="w-4 h-4 mr-2" />
            Se connecter avec Google
          </Button>
        </CardContent>
      </Card>

      {/* Footer compliance badge */}
      <footer className="mt-8 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="w-3.5 h-3.5" />
          <p data-testid="text-compliance-footer">
            Données de santé – conforme RGPD / hébergement HDS
          </p>
        </div>
      </footer>
    </div>
  );
}
