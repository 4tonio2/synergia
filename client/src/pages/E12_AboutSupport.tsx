import React from 'react';
import { ChevronRight, HelpCircle, MessageSquare, AlertCircle, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

export default function E12_AboutSupport() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleBack = () => {
    setLocation('/settings');
  };

  const handleHelpCenter = () => {
    toast({
      title: "Centre d'assistance",
      description: "Fonctionnalité à venir - Documentation et tutoriels",
    });
  };

  const handleSendFeedback = () => {
    toast({
      title: "Envoyer un commentaire",
      description: "Votre avis nous intéresse ! Fonction bientôt disponible.",
    });
  };

  const handleReportIssue = () => {
    toast({
      title: "Signaler un problème",
      description: "Support technique - Fonctionnalité à venir",
    });
  };

  // Version de l'application
  const APP_VERSION = "1.2.1";
  const BUILD_NUMBER = "310";
  const APP_NAME = "Synergia Care";

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <button 
          onClick={handleBack} 
          className="text-gray-600 hover:text-gray-800 mr-4 transition"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">À propos</h1>
      </div>

      <div className="p-4 flex-1 overflow-y-auto pb-6">
        {/* Informations de version */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md mb-6 p-6 text-center border border-blue-200">
          <div className="mb-3">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">S</span>
            </div>
          </div>
          <p className="text-xl font-bold text-gray-800 mb-1">{APP_NAME}</p>
          <p className="text-sm text-gray-600">Version {APP_VERSION}</p>
          <p className="text-xs text-gray-500 mt-1">Build {BUILD_NUMBER}</p>
        </div>

        {/* Options de support */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <button 
            onClick={handleHelpCenter}
            className="flex items-center justify-between w-full py-4 px-4 border-b border-gray-200 text-gray-700 hover:bg-gray-50 transition"
          >
            <span className="flex items-center">
              <HelpCircle size={20} className="mr-3 text-blue-600" /> 
              Centre d'assistance
            </span>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
          
          <button 
            onClick={handleSendFeedback}
            className="flex items-center justify-between w-full py-4 px-4 border-b border-gray-200 text-gray-700 hover:bg-gray-50 transition"
          >
            <span className="flex items-center">
              <MessageSquare size={20} className="mr-3 text-green-600" /> 
              Envoyer un commentaire
            </span>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
          
          <button 
            onClick={handleReportIssue}
            className="flex items-center justify-between w-full py-4 px-4 text-gray-700 hover:bg-gray-50 transition"
          >
            <span className="flex items-center">
              <AlertCircle size={20} className="mr-3 text-red-600" /> 
              Signaler un problème
            </span>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Informations supplémentaires */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            © 2025 Synergia Health. Tous droits réservés.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Hébergement certifié HDS • Conforme RGPD
          </p>
        </div>
      </div>
    </div>
  );
}
