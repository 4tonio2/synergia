import React, { useState } from 'react';
import { ChevronLeft, Bluetooth, BatteryCharging, HardDrive } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function E13_RecordingDevice() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isConnected, setIsConnected] = useState(true);
  const [bluetoothConnected, setBluetoothConnected] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState(80);
  const [firmwareVersion, setFirmwareVersion] = useState('1.0.3');
  const [updateAvailable, setUpdateAvailable] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleBack = () => {
    setLocation('/settings');
  };

  const handlePairBluetooth = () => {
    toast({
      title: "Appairage Bluetooth",
      description: "Tentative de connexion au dictaphone...",
    });
    
    // Simuler une connexion réussie après 1 seconde
    setTimeout(() => {
      setBluetoothConnected(true);
      setIsConnected(true);
      toast({
        title: "Connecté !",
        description: "Dictaphone appairé avec succès",
      });
    }, 1000);
  };

  const handleUpdateFirmware = () => {
    setIsUpdating(true);
    toast({
      title: "Mise à jour du firmware",
      description: "Installation en cours...",
    });
    
    // Simuler le temps de mise à jour
    setTimeout(() => {
      setFirmwareVersion('1.0.4');
      setUpdateAvailable(false);
      setIsUpdating(false);
      toast({
        title: "Mise à jour réussie !",
        description: `Firmware mis à jour vers la version 1.0.4`,
      });
    }, 2000);
  };

  // Composant pour l'icône de la batterie personnalisée
  const BatteryIcon = ({ level }: { level: number }) => {
    let fillWidth;
    if (level > 75) {
      fillWidth = 16;
    } else if (level > 50) {
      fillWidth = 12;
    } else if (level > 25) {
      fillWidth = 8;
    } else {
      fillWidth = 4;
    }

    const colorClass = level > 20 ? 'text-green-600' : 'text-red-600';

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={colorClass}
      >
        {/* Contour de la batterie */}
        <rect x="2" y="7" width="18" height="10" rx="1" />
        <path d="M22 10h-2v4h2" />
        {/* Remplissage de la batterie */}
        <rect x="4" y="9" width={fillWidth} height="6" rx="0.5" fill="currentColor" />
      </svg>
    );
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <button 
          onClick={handleBack} 
          className="text-gray-600 hover:text-gray-800 mr-4 transition"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Appareil d'enregistrement</h1>
      </div>

      <div className="p-4 flex-1 pb-6">
        {/* Statut du dictaphone */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-5">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center mr-4 shadow-sm">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="text-gray-600"
              >
                <rect width="12" height="10" x="6" y="2" rx="2"/>
                <path d="M12 17v4"/>
                <path d="M8 21h8"/>
                <path d="M10 22h4"/>
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">Dictaphone</p>
              <div className="flex items-center mt-1">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <p className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'Connecté' : 'Non connecté'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bluetooth */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <Bluetooth size={20} className="mr-2 text-blue-500" /> 
            Bluetooth
          </h2>
          <div className="flex items-center justify-between py-2">
            <p className="text-gray-700">État</p>
            {bluetoothConnected ? (
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span className="font-medium text-green-600">Connecté</span>
              </div>
            ) : (
              <Button 
                onClick={handlePairBluetooth} 
                variant="outline"
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                Appairer
              </Button>
            )}
          </div>
        </div>

        {/* Batterie */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <BatteryCharging size={20} className="mr-2 text-green-500" /> 
            Batterie
          </h2>
          <div className="flex items-center justify-between py-2">
            <p className="text-gray-700">Niveau</p>
            <div className="flex items-center space-x-2">
              <span className={`font-semibold ${batteryLevel > 20 ? 'text-green-600' : 'text-red-600'}`}>
                {batteryLevel}%
              </span>
              <BatteryIcon level={batteryLevel} />
            </div>
          </div>
          {/* Barre de progression */}
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${batteryLevel > 20 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${batteryLevel}%` }}
            ></div>
          </div>
        </div>

        {/* Firmware */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <HardDrive size={20} className="mr-2 text-gray-700" /> 
            Firmware
          </h2>
          <div className="flex items-center justify-between py-2">
            <p className="text-gray-700">Version</p>
            <span className="font-medium text-gray-800">{firmwareVersion}</span>
          </div>
          {updateAvailable && (
            <Button
              onClick={handleUpdateFirmware}
              disabled={isUpdating}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {isUpdating ? 'Mise à jour en cours...' : 'Mettre à jour'}
            </Button>
          )}
          {!updateAvailable && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-sm text-green-700 font-medium">
                ✓ Firmware à jour
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
