import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MedicalCrossLogo } from "@/components/MedicalCrossLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Heart, Users, Activity, UserPlus, Save } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

export default function Profile() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [medicalRole, setMedicalRole] = useState<MedicalRole | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  // Sync form state with user data when user loads
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setMedicalRole(user.medicalRole as MedicalRole | undefined);
    }
  }, [user]);

  if (isAuthLoading || !user) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Check if anything actually changed
      const hasChanges = 
        firstName !== (user.firstName || "") ||
        lastName !== (user.lastName || "") ||
        medicalRole !== user.medicalRole;

      if (!hasChanges) {
        toast({
          title: "Aucune modification",
          description: "Aucun changement n'a été détecté.",
        });
        setIsSaving(false);
        return;
      }

      await apiRequest("PATCH", `/api/users/${user.id}`, {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        medicalRole: medicalRole || undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées avec succès.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour votre profil.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const initials = [firstName || user.firstName, lastName || user.lastName]
    .filter(Boolean)
    .map((name) => name?.[0])
    .join("")
    .toUpperCase() || user.email?.[0]?.toUpperCase() || "U";

  const RoleIcon = medicalRole ? ROLE_ICONS[medicalRole] : Heart;
  const roleLabel = medicalRole ? ROLE_LABELS[medicalRole] : "Non défini";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back-home">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <MedicalCrossLogo className="w-8 h-8" />
                <div>
                  <h1 className="text-lg font-bold text-foreground">Mon Profil</h1>
                  <p className="text-xs text-muted-foreground">Plode Care</p>
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="gap-2">
              <RoleIcon className="w-3 h-3" />
              {roleLabel}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Profile overview */}
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
              <CardDescription>
                Consultez et modifiez vos informations de profil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={user.profileImageUrl || undefined} alt={`${user.firstName} ${user.lastName}`} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : "Profil incomplet"}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">ID: {user.id}</p>
                </div>
              </div>

              <Separator className="my-6" />

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      data-testid="input-first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Votre prénom"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom de famille</Label>
                    <Input
                      id="lastName"
                      data-testid="input-last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Votre nom"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Adresse e-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    L'adresse e-mail ne peut pas être modifiée
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medicalRole">Rôle professionnel</Label>
                  <Select
                    value={medicalRole}
                    onValueChange={(value) => setMedicalRole(value as MedicalRole)}
                  >
                    <SelectTrigger id="medicalRole" data-testid="select-medical-role">
                      <SelectValue placeholder="Sélectionnez votre rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="infirmier" data-testid="option-role-infirmier">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4" />
                          <span>Infirmier</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="medecin" data-testid="option-role-medecin">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          <span>Médecin</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="kinesitherapeute" data-testid="option-role-kinesitherapeute">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Kinésithérapeute</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="aidant_pro" data-testid="option-role-aidant-pro">
                        <div className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          <span>Aidant professionnel</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Changer de rôle modifiera votre tableau de bord
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/")}
                    data-testid="button-cancel"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    data-testid="button-save-profile"
                  >
                    {isSaving ? (
                      "Enregistrement..."
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Enregistrer
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security info */}
          <Card>
            <CardHeader>
              <CardTitle>Sécurité et conformité</CardTitle>
              <CardDescription>
                Informations sur la protection de vos données
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Vos données personnelles sont stockées de manière sécurisée et conforme aux normes RGPD.
              </p>
              <p className="text-sm text-muted-foreground">
                L'hébergement de vos données de santé respecte les exigences HDS (Hébergement de Données de Santé).
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
