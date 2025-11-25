import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { 
  Volume2, 
  BatteryCharging, 
  CloudOff, 
  CheckCircle, 
  AlertTriangle, 
  LogOut,
  FileText,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PatientHeader } from '@/components/PatientHeader';
import { Pill } from '@/components/Pill';
import { useAppStore, type Visit } from '@/lib/appStore';

// Mock IA Processing Function
const mockIAProcess = (recordingDuration: number): Promise<{
  summary: string;
  structuredDetails: {
    type: string;
    douleur: number;
    constantes: string;
    alertes: Array<{
      id: string;
      level: string;
      description: string;
      actionRequired: boolean;
    }>;
    date: string;
    time: string;
  };
  transcription: string;
  riskLevel: string;
}> => {
  return new Promise((resolve) => {
    // Simuler un temps de traitement réaliste
    const time = Math.max(3000, recordingDuration * 100 + 1000);
    setTimeout(() => {
      resolve({
        summary: "Visite de surveillance. Le patient a mentionné une légère douleur (3/10) après le pansement. Constantes OK. Recommandation : vérifier l'état du pansement demain.",
        structuredDetails: {
          type: 'Surveillance',
          douleur: 3,
          constantes: 'Tension normale, Saturation 98%',
          alertes: [
            { 
              id: 'al-1', 
              level: 'Modéré', 
              description: 'Douleur signalée (3/10) - à suivre', 
              actionRequired: true 
            }
          ],
          date: new Date().toLocaleDateString('fr-FR'),
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        },
        transcription: "Infirmier: Bonjour, comment allez-vous aujourd'hui ? Patient: Ça va. J'ai juste un peu mal après le pansement. Infirmier: D'accord, sur une échelle de 0 à 10 ? Patient: Trois. Infirmier: Je vois. Je vais vérifier votre tension et votre saturation. Patient: D'accord, merci.",
        riskLevel: 'Modéré'
      });
    }, time);
  });
};

interface Patient {
  id: string;
  name: string;
  address?: string | null;
  age?: string | null;
}

type Stage = 'recording' | 'processing' | 'review';

const E05_VisitFlow: React.FC = () => {
  const [, setLocation] = useLocation();
  const [, patientParams] = useRoute('/patients/:id/record');
  const [, freeParams] = useRoute('/recordings/new-free');
  
  const { getPatientById, addVisit, updateVisit } = useAppStore();
  
  const patientId = patientParams?.id;
  const patient = patientId ? getPatientById(patientId) : null;
  const isFreeRecording = !patientId;
  
  // Determine initial stage
  const [stage, setStage] = useState<Stage>('recording');
  const [timer, setTimer] = useState(0);
  const [isRecording, setIsRecording] = useState(stage === 'recording');
  const [isOffline, setIsOffline] = useState(Math.random() > 0.8);
  const [battery, setBattery] = useState(80);
  
  const [iaData, setIaData] = useState<any>(null);
  
  // Editable fields for validation stage
  const [summary, setSummary] = useState('');
  const [douleur, setDouleur] = useState(0);
  const [constantes, setConstantes] = useState('');
  const [notes, setNotes] = useState('');
  
  // Visit ID for tracking
  const [visitId] = useState(crypto.randomUUID());

  // Timer effect for recording
  useEffect(() => {
    if (!isRecording || stage !== 'recording') return;

    const interval = setInterval(() => {
      setTimer(t => {
        const newTime = t + 1;
        if (newTime > 120) { // Safety stop after 2 minutes
          handleStopRecording(newTime);
          clearInterval(interval);
        }
        return newTime;
      });
    }, 1000);

    const batteryInterval = setInterval(() => {
      setBattery(b => Math.max(0, b - 1));
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(batteryInterval);
    };
  }, [isRecording, stage]);

  // Sync editable fields when iaData changes
  useEffect(() => {
    if (iaData) {
      setSummary(iaData.summary);
      setDouleur(iaData.structuredDetails.douleur);
      setConstantes(iaData.structuredDetails.constantes);
    }
  }, [iaData]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const formatDurationMinSec = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}'${secs < 10 ? '0' : ''}${secs}''`;
  };

  const handleStopRecording = async (finalDuration: number) => {
    if (stage !== 'recording') return;

    setIsRecording(false);
    setStage('processing');
    console.log(`Recording stopped. Duration: ${finalDuration}s. Starting IA process...`);

    try {
      const result = await mockIAProcess(finalDuration);
      
      const newVisit: Visit = {
        id: visitId,
        patientId: patient?.id || null,
        date: new Date().toISOString(),
        durationSeconds: finalDuration,
        durationMinSec: formatDurationMinSec(finalDuration),
        iaData: result,
        validated: false,
      };

      setIaData(result);
      setStage('review');
      
      // Save draft to store
      addVisit(newVisit);
      
    } catch (error) {
      console.error("IA Processing failed:", error);
      setStage('review');
    }
  };

  const handleValidate = () => {
    const finalVisitData: Visit = {
      id: visitId,
      patientId: patient?.id || null,
      date: new Date().toISOString(),
      durationSeconds: timer,
      durationMinSec: formatDurationMinSec(timer),
      iaData: {
        ...iaData,
        summary,
        structuredDetails: {
          ...iaData.structuredDetails,
          douleur,
          constantes,
        },
        notes,
      },
      validated: true,
    };

    // Update visit in store with validated status
    updateVisit(visitId, finalVisitData);
    
    alert("Visite validée et envoyée vers Odoo (Simulation) !");
    setLocation('/');
  };

  const handleBackToDashboard = () => {
    // Save current state as draft before leaving
    if (iaData) {
      const draft: Visit = {
        id: visitId,
        patientId: patient?.id || null,
        date: new Date().toISOString(),
        durationSeconds: timer,
        durationMinSec: formatDurationMinSec(timer),
        iaData: {
          ...iaData,
          summary,
          structuredDetails: {
            ...iaData.structuredDetails,
            douleur,
            constantes,
          },
        },
        validated: false,
      };
      updateVisit(visitId, draft);
    }
    setLocation('/');
  };

  const displayPatient = patient || { name: 'Enregistrement Libre', id: 'free', age: undefined };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <PatientHeader patient={displayPatient as any} onBack={handleBackToDashboard} />
      
      <div className="flex-1 overflow-y-auto p-4">
        {/* RECORDING STAGE */}
        {stage === 'recording' && (
          <div className="flex flex-col h-full justify-between items-center text-center">
            <div className="w-full">
              <h2 className="text-xl font-bold text-gray-700">{displayPatient.name}</h2>
              {patient?.address && <p className="text-sm text-gray-500 mb-6">{patient.address}</p>}
              
              {isOffline && (
                <div className="p-2 bg-yellow-100 text-yellow-800 rounded-xl mb-4 flex items-center justify-center">
                  <CloudOff size={18} className="mr-2" />
                  Hors ligne – synchronisation post-visite.
                </div>
              )}

              <div className="flex justify-center space-x-4 mb-10 text-gray-600">
                <div className="flex items-center">
                  <Volume2 size={20} className="mr-1" /> Connecté
                </div>
                <div className="flex items-center">
                  <BatteryCharging size={20} className="mr-1" /> {battery}%
                </div>
              </div>

              <div className="relative mb-10">
                {/* VU-mètre / Onde sonore animée */}
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
                  onClick={() => handleStopRecording(timer)}
                >
                  <div className="w-8 h-8 bg-white rounded-md"></div>
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
        )}

        {/* PROCESSING STAGE */}
        {stage === 'processing' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl mb-4 shadow-md bg-blue-100">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-blue-700">
                  Traitement IA en cours...
                </h3>
                <Pill color="bg-gray-200 text-gray-800">{formatDurationMinSec(timer)} enregistré</Pill>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{ width: '75%' }}></div>
              </div>
              <p className="text-sm text-blue-600 mt-2">Génération du résumé et structuration...</p>
            </div>

            <div className="text-center p-8 bg-white rounded-xl shadow-md">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Analyse en cours...</p>
            </div>
          </div>
        )}

        {/* REVIEW/VALIDATION STAGE */}
        {stage === 'review' && iaData && (
          <div className="space-y-4 pb-20">
            {/* Status Bar */}
            <div className="p-4 rounded-xl mb-4 shadow-md bg-green-50">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-green-700">
                  Revue de la Visite (Draft IA)
                </h3>
                <Pill color="bg-gray-200 text-gray-800">{formatDurationMinSec(timer)} enregistré</Pill>
              </div>
              
              <div className="flex items-center text-sm text-green-700 font-semibold">
                <CheckCircle size={18} className="mr-2" /> 
                Analyse IA terminée. Prêt pour validation.
              </div>
            </div>

            {/* Résumé IA (Editable) */}
            <div className="p-4 bg-white rounded-xl shadow-md border-l-4 border-blue-400">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-bold text-gray-800">Résumé/Synthèse de la Visite</h3>
                <Pill color="bg-blue-100 text-blue-800">IA</Pill>
              </div>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Résumé généré par l'IA..."
                className="w-full h-24 text-sm"
              />
            </div>

            {/* Détails structurés (Editable) */}
            <div className="p-4 bg-white rounded-xl shadow-md space-y-4">
              <h3 className="text-md font-bold text-gray-800 mb-3">Champs Structurés (Critique)</h3>
              
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Date & Heure:</p>
                <Pill color="bg-gray-100 text-gray-700">
                  {iaData.structuredDetails.date}, {iaData.structuredDetails.time}
                </Pill>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Douleur (0-10): <span className="font-bold text-blue-600">{douleur}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={douleur}
                  onChange={(e) => setDouleur(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Constantes / Observations (IA)
                </label>
                <Input 
                  value={constantes} 
                  onChange={(e) => setConstantes(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de soin
                </label>
                <Pill color="bg-gray-100 text-gray-700">{iaData.structuredDetails.type}</Pill>
              </div>
            </div>
            
            {/* Transcription */}
            <div className="p-4 bg-white rounded-xl shadow-md border-l-4 border-gray-300">
              <h3 className="text-md font-bold mb-2 text-gray-800 flex items-center">
                <FileText size={18} className="mr-2"/> Transcription brute
              </h3>
              <p className="text-xs text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {iaData.transcription}
              </p>
            </div>

            {/* Alertes détectées */}
            {iaData.structuredDetails.alertes.length > 0 && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-200 shadow-md">
                <h3 className="text-md font-bold text-red-700 flex items-center mb-3">
                  <AlertTriangle size={20} className="mr-2" /> 
                  Alertes critiques ({iaData.structuredDetails.alertes.length})
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                  {iaData.structuredDetails.alertes.map((alert: any, index: number) => (
                    <li key={index}>
                      {alert.description} 
                      <Pill color="bg-red-200 text-red-800 text-xs py-0.5 ml-1">{alert.level}</Pill>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes additionnelles */}
            <div className="p-4 bg-white rounded-xl shadow-md">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes additionnelles (optionnel)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajoutez des notes complémentaires..."
                className="w-full h-20 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA for validation or return */}
      {stage === 'review' && (
        <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200 shadow-lg">
          <Button 
            className="w-full mb-2 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleValidate}
          >
            <CheckCircle className="mr-2 h-5 w-5" />
            Valider et envoyer vers Odoo
          </Button>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={handleBackToDashboard}
          >
            <LogOut className="mr-2 h-5 w-5" />
            Mettre en attente et revenir à la tournée
          </Button>
        </div>
      )}
    </div>
  );
};

export default E05_VisitFlow;
