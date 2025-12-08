import { useLocation, useRoute } from "wouter";
import { Volume2, ShieldCheck, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatientHeader } from "@/components/PatientHeader";
import { Pill } from "@/components/Pill";
import { useAppStore } from "@/lib/appStore";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useCustomToast } from "@/hooks/useToast";

export default function E03_PatientSheet() {
  const [, params] = useRoute('/patients/:id');
  const [, setLocation] = useLocation();
  const { getPatientById } = useAppStore();
  const { confirm } = useConfirmDialog();
  const toast = useCustomToast();
  
  const patientId = params?.id;
  const patient = patientId ? getPatientById(patientId) : undefined;

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full">
        <p className="text-gray-500">Patient non trouvé</p>
        <Button onClick={() => setLocation('/dashboard')} className="mt-4">
          Retour au Dashboard
        </Button>
      </div>
    );
  }

  const handleBack = () => {
    setLocation('/dashboard');
  };

  const handleStartRecording = async () => {
    if (!patient.consent) {
      // Proposer d'abord le consentement
      const confirmed = await confirm(
        `Le patient ${patient.name} n'a pas encore donné son consentement audio. Voulez-vous gérer le consentement maintenant ?`,
        {
          title: "Consentement requis",
          confirmText: "Gérer le consentement",
          cancelText: "Annuler"
        }
      );
      
      if (confirmed) {
        setLocation(`/patients/${patient.id}/consent`);
      }
      return;
    }
    setLocation(`/patients/${patient.id}/record`);
  };

  const handleShowHistory = () => {
    setLocation(`/patients/${patient.id}/history`);
  };

  const handleManageConsent = () => {
    setLocation(`/patients/${patient.id}/consent`);
  };

  const handleOrderMaterial = () => {
    setLocation('/shop');
  };

  return (
    <div className="flex flex-col min-h-full bg-white">
      <PatientHeader patient={patient as any} onBack={handleBack} />
      
      <div className="p-4 flex-1 pb-4">
        {/* Tags médicaux */}
        {patient.tags && patient.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {patient.tags.map(tag => (
              <Pill key={tag} color="bg-red-100 text-red-700">{tag}</Pill>
            ))}
          </div>
        )}

        {/* Bloc Dernière visite */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl shadow-inner">
          <h3 className="text-md font-bold mb-2 text-gray-700">Dernière visite (IA)</h3>
          <p className="text-sm text-gray-600 mb-3">
            {patient.lastVisitSummary || "Aucune visite enregistrée pour le moment."}
          </p>
          <div className="flex items-center text-sm font-semibold">
            <ShieldCheck 
              size={18} 
              className={`mr-2 ${patient.consent ? 'text-green-600' : 'text-red-600'}`} 
            />
            Consentement à l'audio: 
            <span className={`ml-1 ${patient.consent ? 'text-green-600' : 'text-red-600'}`}>
              {patient.consent ? 'Donné' : 'Refusé'}
            </span>
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-4">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg font-semibold shadow-lg"
            onClick={handleStartRecording}
          >
            <Volume2 className="mr-2" size={20} />
            Démarrer un enregistrement pour ce patient
          </Button>
          
          <Button 
            variant="outline"
            className="w-full h-12 text-base font-semibold border-2"
            onClick={handleShowHistory}
          >
            Voir l'historique complet
          </Button>
          
          <Button 
            variant="ghost"
            className="w-full h-12 text-base"
            onClick={handleManageConsent}
          >
            Mettre à jour le consentement
          </Button>
          
          <Button 
            variant="outline"
            className="w-full h-12 text-base font-semibold bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-300 text-yellow-800"
            onClick={handleOrderMaterial}
          >
            <List className="mr-2" size={20} />
            Commander du matériel (SHOP)
          </Button>
        </div>
      </div>
    </div>
  );
}
