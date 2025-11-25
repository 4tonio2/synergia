import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function PatientDetailPage() {
  const [, params] = useRoute("/patients/:id");
  const patientId = params?.id || "unknown";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au dashboard
          </Button>
        </Link>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Fiche Patient</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Détails du patient ID: {patientId} (à implémenter)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
