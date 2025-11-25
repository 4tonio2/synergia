import { useLocation, useRoute } from "wouter";
import { Volume2, CheckCircle, Filter, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatientHeader } from "@/components/PatientHeader";
import { Pill } from "@/components/Pill";
import { useAppStore } from "@/lib/appStore";

export default function E08_History() {
  const [, params] = useRoute('/patients/:id/history');
  const [, setLocation] = useLocation();
  const { getPatientById, getVisitsByPatientId } = useAppStore();
  
  const patientId = params?.id;
  const patient = patientId ? getPatientById(patientId) : undefined;
  const patientVisits = patientId ? getVisitsByPatientId(patientId).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) : [];

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-gray-500">Patient non trouvé</p>
        <Button onClick={() => setLocation('/dashboard')} className="mt-4">
          Retour au Dashboard
        </Button>
      </div>
    );
  }

  const handleBack = () => {
    setLocation(`/patients/${patient.id}`);
  };

  const handleSelectVisit = (visitId: string) => {
    setLocation(`/patients/${patient.id}/visits/${visitId}`);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <PatientHeader patient={patient as any} onBack={handleBack} />
      
      <div className="p-4 flex-1 overflow-y-auto pb-20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Historique des visites</h2>
          <Button variant="ghost" className="text-sm py-1 px-3">
            <Filter size={16} className="mr-1" />
            Filtrer
          </Button>
        </div>
        
        {patientVisits.length > 0 ? (
          patientVisits.map((visit) => (
            <div
              key={visit.id}
              className="flex p-4 bg-white rounded-xl shadow-md mb-3 cursor-pointer hover:shadow-lg transition duration-200 items-start"
              onClick={() => handleSelectVisit(visit.id)}
            >
              <Volume2 size={24} className="text-blue-500 mt-1 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1 font-medium">
                  {new Date(visit.date).toLocaleDateString('fr-FR')}
                  {visit.iaData?.structuredDetails?.time && ` à ${visit.iaData.structuredDetails.time}`}
                  <span className="ml-2 font-bold text-gray-800">({visit.durationMinSec})</span>
                </p>
                {visit.iaData?.structuredDetails?.type && (
                  <p className="font-semibold text-gray-800 mb-1">{visit.iaData.structuredDetails.type}</p>
                )}
                <p className="text-sm text-gray-600 line-clamp-2">
                  {visit.iaData?.summary || "Enregistrement en cours de traitement..."}
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  {visit.validated ? (
                    <Pill color="bg-green-100 text-green-700 flex items-center">
                      <CheckCircle size={14} className="mr-1"/> Validé
                    </Pill>
                  ) : (
                    <Pill color="bg-yellow-100 text-yellow-700 flex items-center">
                      <Clock size={14} className="mr-1"/> Brouillon
                    </Pill>
                  )}
                  {visit.iaData?.structuredDetails?.alertes && visit.iaData.structuredDetails.alertes.length > 0 && (
                    <Pill color="bg-red-100 text-red-700 flex items-center">
                      <AlertTriangle size={14} className="mr-1"/> Alerte !
                    </Pill>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-8 bg-white rounded-xl shadow-md text-gray-500">
            <Volume2 size={40} className="mx-auto mb-4 text-blue-400" />
            <p>Aucune visite enregistrée pour ce patient.</p>
          </div>
        )}
      </div>
    </div>
  );
}
