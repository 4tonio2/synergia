import { useLocation, useRoute } from "wouter";
import { Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatientHeader } from "@/components/PatientHeader";
import { useState, useEffect } from "react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useCustomToast } from "@/hooks/useToast";

// Mock data
const MOCK_PATIENTS = {
  'pat-1': { id: 'pat-1', name: 'Claire Martin', age: '78' },
  'pat-2': { id: 'pat-2', name: 'Pierre Lefevre', age: '85' },
  'pat-3': { id: 'pat-3', name: 'Jeanne Robert', age: '92' },
};

export default function E05_RecordingSimple() {
  const [location] = useLocation();
  const [, params] = useRoute('/patients/:id/record');
  const [, setLocation] = useLocation();
  const { confirm } = useConfirmDialog();
  const toast = useCustomToast();
  
  // Déterminer si c'est un enregistrement libre ou pour un patient
  const isFreeRecording = location === '/recordings/new-free';
  const patientId = !isFreeRecording ? (params?.id as keyof typeof MOCK_PATIENTS) : null;
  const patient = patientId ? MOCK_PATIENTS[patientId] : null;

  const [isRecording, setIsRecording] = useState(true);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setTimer(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleStop = () => {
    setIsRecording(false);
    // Simuler un délai pour "traitement IA"
    setTimeout(() => {
      toast.info(`Enregistrement terminé (${formatTime(timer)}). Traitement IA à venir...`);
      if (isFreeRecording) {
        setLocation('/dashboard');
      } else {
        setLocation(`/patients/${patient?.id}`);
      }
    }, 1000);
  };

  const handleBack = async () => {
    const confirmed = await confirm(
      'Voulez-vous vraiment arrêter l\'enregistrement ?',
      {
        title: "Arrêter l'enregistrement",
        variant: "danger",
        confirmText: "Arrêter",
        cancelText: "Continuer"
      }
    );
    
    if (confirmed) {
      if (isFreeRecording) {
        setLocation('/dashboard');
      } else {
        setLocation(`/patients/${patient?.id}`);
      }
    }
  };

  // Pour les enregistrements libres, créer un patient fictif pour l'affichage
  const displayPatient = patient || { id: 'free', name: 'Visite Libre', age: 'N/A' };

  return (
    <div className="flex flex-col h-screen bg-white">
      <PatientHeader patient={displayPatient} onBack={handleBack} />
      
      <div className="flex flex-col flex-1 justify-between items-center text-center p-6">
        <div className="w-full">
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            {isFreeRecording ? 'Enregistrement Libre' : patient?.name}
          </h2>
          
          <div className="p-2 bg-blue-100 text-blue-800 rounded-xl mb-6 text-sm">
            <Volume2 size={18} className="inline mr-2" />
            Enregistrement en cours...
          </div>

          {/* Mock VU-mètre / Onde sonore animée */}
          <div className="relative mb-10">
            <svg viewBox="0 0 400 100" className="w-full h-24">
              <path 
                d="M 0 50 C 50 20, 100 80, 150 50 S 250 20, 300 80 S 350 20, 400 50" 
                fill="none" 
                stroke="#3B82F6" 
                strokeWidth="4" 
                className="animate-pulse"
              />
            </svg>
            <p className="text-6xl font-extrabold text-gray-800 my-4">{formatTime(timer)}</p>
          </div>
          
          <div className="flex flex-col items-center">
            <button 
              className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition duration-200 shadow-xl ring-8 ring-red-100"
              onClick={handleStop}
            >
              <Square className="w-8 h-8 text-white" fill="white" />
            </button>
            <p className="mt-2 font-medium text-red-600">Arrêter l'enregistrement</p>
          </div>
        </div>
        
        <div className="mt-10 p-4 bg-gray-100 rounded-xl w-full">
          <p className="text-sm font-semibold text-gray-700 mb-1">Cadrage Plode Care :</p>
          <ul className="text-xs text-gray-500 list-disc list-inside space-y-0.5 text-left">
            <li>Type de soin, douleur (0–10), tension, incidents.</li>
            <li>Le patient a-t-il donné son consentement ?</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
