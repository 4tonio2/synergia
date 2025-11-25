import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MedicalCrossLogo } from "@/components/MedicalCrossLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Heart, Users, Activity, UserPlus, CheckCircle2, AlertCircle, User as UserIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { MedicalRole } from "@shared/schema";

const ROLE_LABELS: Record<MedicalRole, string> = {
  infirmier: "Infirmier",
  medecin: "Médecin",
  kinesitherapeute: "Kinésithérapeute",
  aidant_pro: "Aidant professionnel",
};

const ROLE_ICONS: Record<MedicalRole, typeof Heart> = {
  infirmier: Heart,
  medecin: Activity,
  kinesitherapeute: Users,
  aidant_pro: UserPlus,
};

function DashboardContent({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const { toast } = useToast();
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Apply pending medical role after successful login
  useEffect(() => {
    const applyPendingRole = async () => {
      if (user && !user.medicalRole && !isSubmittingRole) {
        setIsSubmittingRole(true);
        setRoleError(null);
        
        try {
          // Get role from sessionStorage as fallback
          const storedRole = sessionStorage.getItem("selectedMedicalRole");
          
          // Try to apply role from server session, with sessionStorage fallback in body
          let response = await fetch("/api/auth/apply-pending-role", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ medicalRole: storedRole }),
          });
          
          // Retry once if 401 (session cookie might not be set yet)
          if (response.status === 401) {
            await new Promise(resolve => setTimeout(resolve, 500));
            response = await fetch("/api/auth/apply-pending-role", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({ medicalRole: storedRole }),
            });
          }
          
          if (response.ok) {
            const updatedUser = await response.json();
            if (updatedUser.medicalRole) {
              sessionStorage.removeItem("selectedMedicalRole");
              toast({
                title: "Authentification réussie",
                description: `Bienvenue en tant que ${ROLE_LABELS[updatedUser.medicalRole as MedicalRole]}`,
              });
            }
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          } else {
            setRoleError("Impossible d'appliquer votre rôle professionnel.");
            toast({
              title: "Erreur de configuration",
              description: "Votre rôle professionnel n'a pas pu être enregistré.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Failed to apply role:", error);
          setRoleError("Erreur de connexion. Veuillez rafraîchir la page.");
          toast({
            title: "Erreur réseau",
            description: "Impossible de communiquer avec le serveur.",
            variant: "destructive",
          });
        } finally {
          setIsSubmittingRole(false);
        }
      }
    };

    if (user && !user.medicalRole) {
      applyPendingRole();
    }
  }, [user, isSubmittingRole, toast]);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const RoleIcon = user.medicalRole ? ROLE_ICONS[user.medicalRole as MedicalRole] : Heart;
  const roleLabel = user.medicalRole ? ROLE_LABELS[user.medicalRole as MedicalRole] : "Non défini";

  // Get user initials for avatar fallback
  const initials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((name) => name?.[0])
    .join("")
    .toUpperCase() || user.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MedicalCrossLogo className="w-10 h-10" />
              <div>
                <h1 className="text-xl font-bold text-foreground">Plode Care</h1>
                <p className="text-xs text-muted-foreground">Espace professionnel</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={user.profileImageUrl || undefined} alt={`${user.firstName} ${user.lastName}`} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground" data-testid="text-user-name">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.email}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-user-email">
                    {user.email}
                  </p>
                </div>
              </div>
              
              <Link href="/profile">
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="button-profile"
                  title="Mon profil"
                >
                  <UserIcon className="w-4 h-4" />
                </Button>
              </Link>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                data-testid="button-logout"
                title="Se déconnecter"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Welcome section */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl">
                    Bienvenue {user.firstName || ""}
                  </CardTitle>
                  <CardDescription>
                    Votre espace professionnel sécurisé
                  </CardDescription>
                </div>
                {user.medicalRole && (
                  <Badge variant="secondary" className="gap-2 py-1.5 px-3" data-testid={`badge-role-${user.medicalRole}`}>
                    <RoleIcon className="w-4 h-4" />
                    {roleLabel}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {roleError ? (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                      Erreur de configuration du rôle
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {roleError}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.location.reload()}
                    >
                      Rafraîchir la page
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Authentification réussie
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Vous êtes connecté en tant que{" "}
                      <span className="font-medium text-foreground">{roleLabel}</span>.
                      Vos données sont sécurisées et conformes aux normes RGPD et HDS.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile information */}
          <Card>
            <CardHeader>
              <CardTitle>Informations du profil</CardTitle>
              <CardDescription>
                Vos informations professionnelles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Nom complet</p>
                  <p className="text-base text-foreground">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : "Non renseigné"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Adresse e-mail</p>
                  <p className="text-base text-foreground">{user.email || "Non renseigné"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Rôle professionnel</p>
                  <div className="flex items-center gap-2">
                    <RoleIcon className="w-4 h-4 text-primary" />
                    <p className="text-base text-foreground">{roleLabel}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Identifiant</p>
                  <p className="text-base text-foreground font-mono text-xs">{user.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role-specific dashboard content */}
          {!user.medicalRole && (
            <Card>
              <CardHeader>
                <CardTitle>Configuration en cours</CardTitle>
                <CardDescription>Votre rôle professionnel est en cours d'attribution</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Veuillez patienter pendant que nous configurons votre espace professionnel.
                  Si ce message persiste, essayez de vous déconnecter et de vous reconnecter.
                </p>
              </CardContent>
            </Card>
          )}

          {user.medicalRole === "infirmier" && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card data-testid="card-stat-patients">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Patients suivis</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Aucun patient assigné</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-soins">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Soins aujourd'hui</CardTitle>
                    <Heart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Planning vide</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-urgences">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Urgences</CardTitle>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Aucune urgence</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Planning de soins</CardTitle>
                  <CardDescription>Gestion de vos interventions quotidiennes</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Fonctionnalité en cours de développement</p>
                </CardContent>
              </Card>
            </>
          )}

          {user.medicalRole === "medecin" && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card data-testid="card-stat-consultations">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Consultations du jour</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Agenda vide</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-prescriptions">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Prescriptions</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Aucune prescription</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-dossiers">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Dossiers médicaux</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Aucun dossier</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Agenda médical</CardTitle>
                  <CardDescription>Vos consultations et rendez-vous</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Fonctionnalité en cours de développement</p>
                </CardContent>
              </Card>
            </>
          )}

          {user.medicalRole === "kinesitherapeute" && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card data-testid="card-stat-seances">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Séances du jour</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Planning vide</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-reeducation">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Rééducations actives</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Aucune rééducation</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-bilans">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Bilans à réaliser</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Aucun bilan</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Planning de rééducation</CardTitle>
                  <CardDescription>Gestion de vos séances et bilans</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Fonctionnalité en cours de développement</p>
                </CardContent>
              </Card>
            </>
          )}

          {user.medicalRole === "aidant_pro" && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card data-testid="card-stat-interventions">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Interventions du jour</CardTitle>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Planning vide</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-personnes">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Personnes accompagnées</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Aucune personne</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-taches">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tâches à réaliser</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Aucune tâche</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Planning d'accompagnement</CardTitle>
                  <CardDescription>Vos interventions et suivis quotidiens</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Fonctionnalité en cours de développement</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Loading state - show skeleton
  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
        <Card className="w-full max-w-2xl mx-4">
          <CardHeader>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render full dashboard
  return <DashboardContent user={user} />;
}
