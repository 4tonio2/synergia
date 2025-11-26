import React, { useState, useEffect } from 'react';
import { CloudOff, RefreshCw, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function E16_OfflineMode() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Écouter les changements de statut réseau
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Connexion rétablie",
        description: "Vous êtes de nouveau en ligne",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Mode hors ligne",
        description: "Vous travaillez actuellement hors ligne",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  const handleBack = () => {
    setLocation('/dashboard');
  };

  const handleSynchronize = async () => {
    if (!isOnline) {
      toast({
        title: "Synchronisation impossible",
        description: "Aucune connexion réseau détectée",
        variant: "destructive",
      });
      return;
    }

    setIsSynchronizing(true);
    toast({
      title: "Synchronisation en cours",
      description: "Envoi des données locales...",
    });

    // Simuler le processus de synchronisation
    setTimeout(() => {
      setIsSynchronizing(false);
      setLastSyncTime(new Date());
      toast({
        title: "Synchronisation réussie !",
        description: "Toutes vos données ont été sauvegardées",
      });
    }, 2000);
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return null;
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000);
    
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    return `Il y a ${Math.floor(diff / 3600)}h`;
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Card principale */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
          {/* Icône et statut */}
          <div className="mb-6 text-center">
            {isOnline ? (
              <div className="relative inline-block">
                <Wifi size={80} className="mx-auto text-green-500 mb-4" />
                <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1">
                  <CheckCircle size={24} className="text-white" />
                </div>
              </div>
            ) : (
              <div className="relative inline-block">
                <WifiOff size={80} className="mx-auto text-orange-500 mb-4" />
                <CloudOff size={32} className="absolute -bottom-1 -right-1 text-orange-600" />
              </div>
            )}
            
            <h1 className="text-3xl font-bold text-gray-800 mb-3">
              {isOnline ? 'En ligne' : 'Mode hors ligne'}
            </h1>
            
            {isOnline ? (
              <div>
                <p className="text-green-600 text-lg font-medium mb-2">
                  Connexion active
                </p>
                <p className="text-gray-500 text-sm">
                  Vos données sont synchronisées en temps réel
                </p>
              </div>
            ) : (
              <div>
                <p className="text-orange-600 text-lg font-medium mb-2">
                  Vous êtes actuellement hors ligne
                </p>
                <p className="text-gray-500 text-sm">
                  La synchronisation se fera automatiquement une fois en ligne
                </p>
              </div>
            )}
          </div>

          {/* Informations de synchronisation */}
          {lastSyncTime && (
            <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-center text-green-700">
                <CheckCircle size={16} className="mr-2" />
                <span className="text-sm font-medium">
                  Dernière synchronisation : {formatLastSync()}
                </span>
              </div>
            </div>
          )}

          {/* Bouton de synchronisation */}
          <Button
            onClick={handleSynchronize}
            disabled={!isOnline || isSynchronizing}
            className={`w-full py-6 rounded-xl shadow-lg font-semibold text-lg transition-all ${
              isOnline 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <RefreshCw size={20} className={`mr-2 ${isSynchronizing ? 'animate-spin' : ''}`} />
            <span>
              {isSynchronizing ? 'Synchronisation...' : 'Synchroniser maintenant'}
            </span>
          </Button>
        </div>

        {/* Informations complémentaires */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2 text-sm">
            💡 Mode hors ligne - Utilité
          </h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>✓ Enregistrement sans réseau (zones rurales)</li>
            <li>✓ Audio stocké localement</li>
            <li>✓ Synchronisation automatique au retour réseau</li>
            <li>✓ Transcription IA différée</li>
            <li>✓ Visites et alertes sauvegardées</li>
          </ul>
        </div>

        {/* Bouton retour */}
        <Button
          onClick={handleBack}
          variant="outline"
          className="w-full mt-4 py-3 rounded-xl border-2"
        >
          Retour au Dashboard
        </Button>
      </div>
    </div>
  );
}
