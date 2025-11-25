import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";

export default function NewRecordingPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Nouvel Enregistrement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Mic className="w-16 h-16 mx-auto mb-4 text-primary" />
              <p className="text-gray-600 mb-6">
                Enregistrement vocal libre (à implémenter)
              </p>
              <Button size="lg">
                <Mic className="w-5 h-5 mr-2" />
                Démarrer l'enregistrement
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
