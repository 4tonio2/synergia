import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RecordingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Enregistrements</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Liste des enregistrements vocaux (à implémenter)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
