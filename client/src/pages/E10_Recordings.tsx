import { useLocation } from "wouter";
import { User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/Pill";
import { useAppStore } from "@/lib/appStore";

export default function E10_Recordings() {
  const [, setLocation] = useLocation();
  const { visits, patients } = useAppStore();

  // Enrichir les visites avec les noms des patients
  const enrichedRecordings = visits
    .map(visit => {
      const patient = visit.patientId ? patients.find(p => p.id === visit.patientId) : null;
      return {
        id: visit.id,
        patientName: patient?.name || 'Non affecté',
        date: new Date(visit.date).toLocaleDateString('fr-FR'),
        time: visit.iaData?.structuredDetails?.time || '--:--',
        duration: visit.durationMinSec,
        status: visit.validated ? 'Validée' : 'À valider',
        patientId: visit.patientId,
        visitId: visit.id,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSelectRecording = (recording: typeof enrichedRecordings[0]) => {
    if (recording.patientId) {
      setLocation(`/patients/${recording.patientId}/visits/${recording.visitId}`);
    } else {
      // Pour les enregistrements non affectés, aller vers un écran de détail générique
      setLocation(`/recordings/${recording.id}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Validée':
        return 'bg-green-100 text-green-700';
      case 'À valider':
        return 'bg-blue-100 text-blue-700';
      case 'En attente':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-red-100 text-red-700';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Sticky Header with Return Button */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="p-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation('/dashboard')}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <ArrowLeft size={18} className="mr-1" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold">Enregistrements</h1>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>
      </div>
      
      <div className="overflow-x-auto flex-1">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {['Patient', 'Date / Heure', 'Durée', 'Statut'].map(header => (
                <th 
                  key={header} 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enrichedRecordings.map(rec => (
              <tr 
                key={rec.id} 
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleSelectRecording(rec)}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {rec.patientName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {rec.date} {rec.time}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {rec.duration}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <Pill color={getStatusColor(rec.status)}>
                    {rec.status}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {enrichedRecordings.length === 0 && (
          <p className="text-center text-gray-500 mt-10 p-4">
            Aucun enregistrement disponible.
          </p>
        )}
      </div>
    </div>
  );
}
