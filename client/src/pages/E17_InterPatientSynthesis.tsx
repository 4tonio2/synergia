import React from 'react';
import { User, AlertTriangle, Filter, ChevronRight, Clock, Activity, ChevronLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface PatientAvatarProps {
  initials: string;
  imageUrl?: string;
}

const PatientAvatar = ({ initials, imageUrl }: PatientAvatarProps) => (
  <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-blue-100 text-blue-700 font-semibold flex-shrink-0 mr-3">
    {imageUrl ? (
      <img 
        src={imageUrl} 
        alt="Patient" 
        className="w-full h-full object-cover"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.onerror = null;
          target.src = `https://placehold.co/48x48/CCCCCC/333333?text=${initials.substring(0, 2)}`;
        }}
      />
    ) : (
      initials
    )}
  </div>
);

interface PriorityAlert {
  patientName: string;
  age: number;
  risk: 'élevé' | 'modéré';
  keyword: string;
  time: string;
  summary: string;
  initials: string;
  imageUrl?: string;
}

interface RecentPatient {
  name: string;
  age: number;
  event: string;
  timeAgo: string;
  initials: string;
  imageUrl?: string;
}

export default function E17_InterPatientSynthesis() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const primaryAlert: PriorityAlert = {
    patientName: 'Françoise Dupont',
    age: 78,
    risk: 'élevé',
    keyword: 'Chute, Confusion',
    time: '14:30',
    summary: 'L\'IA a détecté une confusion sévère durant la visite de l\'infirmière, suite à une chute non traumatique ce matin. Nécessite une réévaluation neurologique urgente.',
    initials: 'FD',
    imageUrl: 'https://placehold.co/48x48/E53E3E/FFFFFF?text=FD',
  };

  const recentPatients: RecentPatient[] = [
    { 
      name: 'Pierre Lefèvre', 
      age: 90, 
      event: 'Hypertension détectée', 
      timeAgo: '15 min', 
      initials: 'PL', 
      imageUrl: 'https://placehold.co/48x48/38A169/FFFFFF?text=PL' 
    },
    { 
      name: 'Clémence Bernard', 
      age: 85, 
      event: 'Confusion observée (risque modéré)', 
      timeAgo: '2h', 
      initials: 'CB', 
      imageUrl: 'https://placehold.co/48x48/3182CE/FFFFFF?text=CB' 
    },
    { 
      name: 'Brigitte Marchand', 
      age: 79, 
      event: 'Douleur chronique accrue', 
      timeAgo: '4h', 
      initials: 'BM', 
      imageUrl: 'https://placehold.co/48x48/D69E2E/FFFFFF?text=BM' 
    },
    { 
      name: 'Robert Martin', 
      age: 88, 
      event: 'Demande de renouvellement ordonnance', 
      timeAgo: 'Hier', 
      initials: 'RM', 
      imageUrl: 'https://placehold.co/48x48/5A67D8/FFFFFF?text=RM' 
    },
  ];

  const handleBack = () => {
    setLocation('/dashboard');
  };

  const handleViewPatient = (patientName: string) => {
    toast({
      title: "Dossier patient",
      description: `Ouverture du dossier de ${patientName}`,
    });
  };

  const handleFilter = () => {
    toast({
      title: "Filtrage",
      description: "Fonctionnalité de filtrage à venir",
    });
  };

  const getRiskColor = (risk: 'élevé' | 'modéré') => {
    switch (risk) {
      case 'élevé': 
        return 'bg-red-600 text-red-50';
      case 'modéré': 
        return 'bg-orange-500 text-orange-50';
      default: 
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <button 
          onClick={handleBack} 
          className="text-gray-600 hover:text-gray-800 mr-4 transition"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Cockpit Clinique</h1>
          <p className="text-xs text-gray-500">Vue médecin - Synthèse inter-patients</p>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto pb-6">
        {/* Section Alerte Prioritaire (Rouge) */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-red-600 mb-3 flex items-center">
            <AlertTriangle size={20} className="mr-2 animate-pulse" /> 
            Alerte Prioritaire
          </h2>
          <div className="bg-white border-l-4 border-red-600 rounded-xl shadow-lg p-4 transition duration-300 hover:shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <PatientAvatar 
                  initials={primaryAlert.initials} 
                  imageUrl={primaryAlert.imageUrl} 
                />
                <div>
                  <p className="text-xl font-bold text-gray-800">
                    {primaryAlert.patientName}, {primaryAlert.age} ans
                  </p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getRiskColor(primaryAlert.risk)}`}>
                    Risque {primaryAlert.risk}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-red-600 flex items-center">
                  <Clock size={16} className="mr-1" /> 
                  {primaryAlert.time}
                </p>
              </div>
            </div>
            
            <p className="text-gray-700 font-medium mt-2">
              Mot-clé: <span className="text-red-700 font-bold">{primaryAlert.keyword}</span>
            </p>
            
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <h3 className="text-sm font-semibold text-red-800 mb-1">Synthèse IA :</h3>
              <p className="text-sm text-gray-700 italic leading-relaxed">
                {primaryAlert.summary}
              </p>
            </div>

            <Button
              onClick={() => handleViewPatient(primaryAlert.patientName)}
              className="mt-4 w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition-colors shadow-md"
            >
              Consulter le Dossier Patient
            </Button>
          </div>
        </div>

        {/* Bouton Filtrer (Bleu) */}
        <div className="mb-6">
          <Button
            onClick={handleFilter}
            className="w-full flex items-center justify-center space-x-2 py-6 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white transition duration-200 shadow-lg"
          >
            <Filter size={20} />
            <span>Filtrer les patients et les événements</span>
          </Button>
        </div>

        {/* Section Patients Récents (Vert/Gris) */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <Activity size={20} className="mr-2 text-green-600" /> 
            Événements Récents
          </h2>
          <div className="space-y-3">
            {recentPatients.map((patient, index) => (
              <div 
                key={index} 
                onClick={() => handleViewPatient(patient.name)}
                className="flex items-center justify-between bg-white rounded-xl shadow-md p-3 transition duration-150 hover:bg-gray-50 hover:shadow-lg cursor-pointer"
              >
                <div className="flex items-center flex-1">
                  <PatientAvatar 
                    initials={patient.initials} 
                    imageUrl={patient.imageUrl} 
                  />
                  <div className="flex-1">
                    <p className="text-md font-semibold text-gray-800">
                      {patient.name}, {patient.age} ans
                    </p>
                    <p className="text-sm text-gray-600">{patient.event}</p>
                  </div>
                </div>
                <div className="text-right flex items-center">
                  <p className="text-xs text-gray-500 mr-2">{patient.timeAgo}</p>
                  <ChevronRight size={20} className="text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info pour médecins */}
        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-xs text-blue-800 font-medium">
            👨‍⚕️ Vue réservée aux médecins traitants, gériatres, coordonnateurs cliniques et IPA
          </p>
        </div>
      </div>
    </div>
  );
}
