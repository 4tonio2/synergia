import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { PatientHeader } from "@/components/PatientHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/lib/appStore";
import { useCustomToast } from "@/hooks/useToast";

export default function E04_Consent() {
  const [, params] = useRoute('/patients/:id/consent');
  const [, setLocation] = useLocation();
  const { getPatientById, updatePatientConsent } = useAppStore();
  const toast = useCustomToast();
  
  const patientId = params?.id;
  const patient = patientId ? getPatientById(patientId) : undefined;

  const [selectedConsent, setSelectedConsent] = useState<'oral' | 'written' | 'refused'>(
    patient?.consent ? 'oral' : 'refused'
  );
  const [isRecordingLegal, setIsRecordingLegal] = useState(false);

  if (!patient) {
    return null;
  }

  const handleBack = () => {
    setLocation(`/patients/${patient.id}`);
  };

  const handleSave = () => {
    if (!patient) return;
    
    const newConsent = selectedConsent !== 'refused';
    updatePatientConsent(patient.id, newConsent);
    
    console.log(`Consentement enregistré pour ${patient.name}: ${selectedConsent}`);
    toast.success(`Consentement "${selectedConsent}" enregistré pour ${patient.name}`);
    setLocation(`/patients/${patient.id}`);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <PatientHeader patient={patient as any} onBack={handleBack} />
      
      <div className="p-6 flex-1 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Consentement</h2>
        <p className="text-gray-600 mb-6">
          Vous pouvez enregistrer les conversations lors des visites de patients. 
          L'IA de Plode Care est utilisée après pour créer un résumé médical.
        </p>

        <div className="space-y-4 mb-8">
          {/* Consentement Oral */}
          <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
            <input 
              type="radio" 
              name="consent" 
              value="oral" 
              checked={selectedConsent === 'oral'} 
              onChange={() => setSelectedConsent('oral')} 
              className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500" 
            />
            <span className="font-medium text-gray-700">Consentement donné (oral)</span>
          </label>

          {/* Consentement Écrit */}
          <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
            <input 
              type="radio" 
              name="consent" 
              value="written" 
              checked={selectedConsent === 'written'} 
              onChange={() => setSelectedConsent('written')} 
              className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500" 
            />
            <span className="font-medium text-gray-700">Consentement donné (écrit signé)</span>
          </label>

          {/* Consentement Refusé */}
          <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
            <input 
              type="radio" 
              name="consent" 
              value="refused" 
              checked={selectedConsent === 'refused'} 
              onChange={() => setSelectedConsent('refused')} 
              className="h-5 w-5 text-red-600 border-gray-300 focus:ring-red-500" 
            />
            <span className="font-medium text-red-600">Consentement refusé</span>
          </label>
          
          {/* Checkbox phrase légale */}
          <div className="flex items-start space-x-3 mt-6 p-3 bg-blue-50 rounded-xl">
            <Checkbox 
              id="legal-phrase"
              checked={isRecordingLegal} 
              onCheckedChange={(checked) => setIsRecordingLegal(checked as boolean)} 
              className="mt-1"
            />
            <label htmlFor="legal-phrase" className="font-medium text-gray-700 text-sm cursor-pointer">
              Je lis à voix haute la phrase légale et je l'enregistre
            </label>
          </div>
        </div>

        <Button 
          className="w-full h-14 text-lg font-semibold"
          onClick={handleSave}
        >
          Enregistrer le consentement
        </Button>
      </div>
    </div>
  );
}
