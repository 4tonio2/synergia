import React, { useState } from 'react';
import { ChevronLeft, Save, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function E14_IASettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [summaryStyle, setSummaryStyle] = useState('Standard'); // Court, Standard, Détaillé
  const [clinicalTone, setClinicalTone] = useState('Neutre'); // Neutre, Professionnel médical, Grand public / aidant
  const [mainLanguage, setMainLanguage] = useState('Français');
  const [freeInput, setFreeInput] = useState(true);
  const [structuredFields, setStructuredFields] = useState(true);
  const [alertExtraction, setAlertExtraction] = useState(true);
  const [confidentialMode, setConfidentialMode] = useState(true); // Masquer les noms des patients

  const handleBack = () => {
    setLocation('/settings');
  };

  const handleSave = () => {
    const settings = {
      summaryStyle,
      clinicalTone,
      mainLanguage,
      freeInput,
      structuredFields,
      alertExtraction,
      confidentialMode,
    };
    
    console.log('Paramètres IA sauvegardés:', settings);
    
    toast({
      title: "Paramètres sauvegardés !",
      description: `Style: ${summaryStyle}, Ton: ${clinicalTone}`,
    });
    
    // Retour aux paramètres après sauvegarde
    setTimeout(() => {
      handleBack();
    }, 1000);
  };

  const handleLanguageSelect = () => {
    toast({
      title: "Sélection de langue",
      description: "Fonctionnalité à venir - Français actuellement sélectionné",
    });
  };

  const ToggleSwitch = ({ id, label, checked, onChange }: { 
    id: string; 
    label: string; 
    checked: boolean; 
    onChange: () => void;
  }) => (
    <div className="flex items-center justify-between py-2">
      <label htmlFor={id} className="text-gray-700 text-sm flex-1">{label}</label>
      <label htmlFor={id} className="flex items-center cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            id={id}
            className="sr-only"
            checked={checked}
            onChange={onChange}
          />
          <div className={`block w-14 h-8 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${checked ? 'translate-x-6' : ''}`}></div>
        </div>
      </label>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200 bg-white shadow-sm">
        <button 
          onClick={handleBack} 
          className="text-gray-600 hover:text-gray-800 mr-4 transition"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Paramètres IA</h1>
      </div>

      <div className="p-4 flex-1 pb-4">
        {/* Style du résumé IA */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Style du résumé IA</h2>
          <div className="flex justify-around space-x-2">
            {['Court', 'Standard', 'Détaillé'].map(style => (
              <label 
                key={style} 
                className="flex items-center space-x-2 cursor-pointer p-3 rounded-lg hover:bg-gray-50 flex-1 border-2 transition"
                style={{
                  borderColor: summaryStyle === style ? '#2563eb' : '#e5e7eb'
                }}
              >
                <input
                  type="radio"
                  name="summaryStyle"
                  value={style}
                  checked={summaryStyle === style}
                  onChange={() => setSummaryStyle(style)}
                  className="form-radio h-5 w-5 text-blue-600"
                />
                <span className={`text-sm ${summaryStyle === style ? 'font-semibold text-blue-600' : 'text-gray-700'}`}>
                  {style}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Ton clinique */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Ton clinique</h2>
          <div className="space-y-2">
            {['Neutre', 'Professionnel médical', 'Grand public / aidant'].map(tone => (
              <label 
                key={tone} 
                className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition border-2"
                style={{
                  borderColor: clinicalTone === tone ? '#2563eb' : '#f3f4f6'
                }}
              >
                <input
                  type="radio"
                  name="clinicalTone"
                  value={tone}
                  checked={clinicalTone === tone}
                  onChange={() => setClinicalTone(tone)}
                  className="form-radio h-5 w-5 text-blue-600"
                />
                <span className={`text-sm ${clinicalTone === tone ? 'font-semibold text-blue-600' : 'text-gray-700'}`}>
                  {tone}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Langue principale */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Langue principale</h2>
          <button 
            onClick={handleLanguageSelect}
            className="flex items-center justify-between w-full py-3 text-gray-700 hover:bg-gray-50 px-3 rounded-lg border border-gray-200 transition"
          >
            <span className="font-medium">{mainLanguage}</span>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Mode de structuration automatique */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Mode de structuration automatique</h2>
          <ToggleSwitch 
            id="free-input" 
            label="Saisie libre" 
            checked={freeInput} 
            onChange={() => setFreeInput(!freeInput)} 
          />
          <div className="border-t border-gray-100 my-2"></div>
          <ToggleSwitch 
            id="structured-fields" 
            label="Structuration en champs (Douleur, Constantes, Actes…)" 
            checked={structuredFields} 
            onChange={() => setStructuredFields(!structuredFields)} 
          />
          <div className="border-t border-gray-100 my-2"></div>
          <ToggleSwitch 
            id="alert-extraction" 
            label="Extraction des alertes" 
            checked={alertExtraction} 
            onChange={() => setAlertExtraction(!alertExtraction)} 
          />
        </div>

        {/* Mode confidentiel */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Mode confidentiel</h2>
          <ToggleSwitch 
            id="confidential-mode" 
            label="Masquer les noms des patients" 
            checked={confidentialMode} 
            onChange={() => setConfidentialMode(!confidentialMode)} 
          />
          <p className="text-xs text-gray-500 mt-2">
            Les noms seront anonymisés dans les logs de traitement IA
          </p>
        </div>
      </div>

      {/* CTA - Fixed at bottom */}
      <div className="p-4 bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 max-w-md mx-auto shadow-lg">
        <Button
          onClick={handleSave}
          className="w-full flex items-center justify-center space-x-2 py-6 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white transition duration-200 shadow-lg"
        >
          <Save size={20} />
          <span>Enregistrer les paramètres IA</span>
        </Button>
      </div>
    </div>
  );
}
