import React, { useState } from 'react';
import { ChevronRight, User, Shield, Mic, Settings, Book, LogOut, ArrowLeft, Info, Wifi } from 'lucide-react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function E11_SettingsProfile() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [anonymizeLogs, setAnonymizeLogs] = useState(true);

  const handleBack = () => {
    setLocation('/dashboard');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt !",
      });
      setLocation('/landing');
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de se déconnecter",
        variant: "destructive",
      });
    }
  };

  const handleManageRecordingDevice = () => {
    setLocation('/settings/recording-device');
  };

  const handleManageIASettings = () => {
    setLocation('/settings/ia');
  };

  // Générer les initiales du nom
  const getInitials = () => {
    if (!user) return 'U';
    const firstName = user.firstName || user.email?.charAt(0) || 'U';
    const lastName = user.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0) || ''}`.toUpperCase();
  };

  // Afficher le nom complet
  const getFullName = () => {
    if (!user) return 'Utilisateur';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || 'Utilisateur';
  };

  // Traduire le rôle médical
  const getMedicalRoleLabel = () => {
    const role = user?.medicalRole;
    const roleLabels: Record<string, string> = {
      'infirmier': 'Infirmier(ère)',
      'medecin': 'Médecin',
      'aide_soignant': 'Aide-soignant(e)',
      'kine': 'Kinésithérapeute',
      'autre': 'Autre professionnel de santé',
    };
    return roleLabels[role || ''] || role || 'Non défini';
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <button 
          onClick={handleBack} 
          className="text-gray-600 hover:text-gray-800 mr-4 transition"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Paramètres</h1>
      </div>

      <div className="p-4 flex-1 pb-6">
        {/* Section Profil */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <User size={20} className="mr-2 text-blue-600" /> 
            Profil Professionnel
          </h2>
          <div className="flex items-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold mr-4 shadow-lg">
              {getInitials()}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">{getFullName()}</p>
              <p className="text-sm text-gray-600">{user?.email}</p>
              <p className="text-sm text-gray-500 mt-1">{getMedicalRoleLabel()}</p>
            </div>
          </div>
        </div>

        {/* Niveau d'anonymisation */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <Shield size={20} className="mr-2 text-green-600" /> 
            Niveau d'anonymisation
          </h2>
          <div className="flex items-center justify-between py-2">
            <p className="text-gray-700 text-sm flex-1 mr-4">
              Masquer les noms des patients affichés dans les logs de traitement IA
            </p>
            <label htmlFor="anonymize-toggle" className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  id="anonymize-toggle"
                  className="sr-only"
                  checked={anonymizeLogs}
                  onChange={() => setAnonymizeLogs(!anonymizeLogs)}
                />
                <div className={`block w-14 h-8 rounded-full transition-colors ${anonymizeLogs ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${anonymizeLogs ? 'translate-x-6' : ''}`}></div>
              </div>
            </label>
          </div>
        </div>

        {/* Appareil d'enregistrement */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <Mic size={20} className="mr-2 text-purple-600" /> 
            Appareil d'enregistrement
          </h2>
          <button 
            onClick={handleManageRecordingDevice} 
            className="flex items-center justify-between w-full py-2 text-blue-600 font-medium hover:text-blue-800 transition"
          >
            Gérer l'appareil
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Paramètres d'IA */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <Settings size={20} className="mr-2 text-orange-600" /> 
            Paramètres d'IA
          </h2>
          <button 
            onClick={handleManageIASettings} 
            className="flex items-center justify-between w-full py-2 text-gray-700 hover:bg-gray-50 px-2 rounded-lg transition"
          >
            <span>Style du résumé</span>
            <div className="flex items-center text-gray-500">
              <span className="text-sm">Court</span>
              <ChevronRight size={20} className="ml-2" />
            </div>
          </button>
          <button 
            onClick={handleManageIASettings} 
            className="flex items-center justify-between w-full py-2 text-gray-700 hover:bg-gray-50 px-2 rounded-lg mt-2 transition"
          >
            <span>Langue principale</span>
            <div className="flex items-center text-gray-500">
              <span className="text-sm">Français</span>
              <ChevronRight size={20} className="ml-2" />
            </div>
          </button>
        </div>

        {/* Mentions légales */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <Book size={20} className="mr-2 text-gray-600" /> 
            Mentions légales
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Conforme RGPD - Protection des données personnelles</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Hébergement HDS (Hébergeur de Données de Santé)</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">📧</span>
              <span>Contact DPO : dpo@synergia-health.fr</span>
            </li>
          </ul>
        </div>

        {/* À propos & Support */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <button 
            onClick={() => setLocation('/settings/about')}
            className="flex items-center justify-between w-full py-2 text-gray-700 hover:bg-gray-50 px-2 rounded-lg transition"
          >
            <span className="flex items-center">
              <Info size={20} className="mr-2 text-indigo-600" />
              <span className="font-medium">À propos & Support</span>
            </span>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Mode hors ligne */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <button 
            onClick={() => setLocation('/offline')}
            className="flex items-center justify-between w-full py-2 text-gray-700 hover:bg-gray-50 px-2 rounded-lg transition"
          >
            <span className="flex items-center">
              <Wifi size={20} className="mr-2 text-blue-600" />
              <span className="font-medium">Mode hors ligne & Synchronisation</span>
            </span>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
        </div>
        
        {/* Bouton de déconnexion */}
        <div className="mt-8">
          <Button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-6 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white transition duration-200 shadow-lg"
          >
            <LogOut size={20} />
            <span>Déconnexion</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
