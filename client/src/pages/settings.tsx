import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { LogOut } from "lucide-react";
import { useLocation } from "wouter";

export default function SettingsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLocation("/landing");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Paramètres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Informations du compte</h3>
                <p className="text-sm text-gray-600">Email: {user?.email}</p>
                <p className="text-sm text-gray-600">
                  Nom: {user?.firstName} {user?.lastName}
                </p>
                <p className="text-sm text-gray-600">
                  Rôle: {user?.medicalRole}
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  className="w-full"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Se déconnecter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
