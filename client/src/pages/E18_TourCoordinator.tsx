import React from 'react';
import { User, AlertTriangle, Clock, MapPin, Truck, CalendarCheck, ChevronsRight, ChevronRight, ChevronLeft } from 'lucide-react';
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

interface VisitCardProps {
  time: string;
  patientName: string;
  age: number;
  address: string;
  risk: 'faible' | 'modéré';
  presenceStatus: 'confirmed' | 'absent' | 'pending';
}

const PresenceStatusBadge = ({ status }: { status: 'confirmed' | 'absent' | 'pending' }) => {
  const statusConfig = {
    confirmed: {
      label: 'Confirmé',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      dotColor: 'bg-green-500',
    },
    absent: {
      label: 'Absent',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      dotColor: 'bg-red-500',
    },
    pending: {
      label: 'En attente...',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-500',
      dotColor: 'bg-gray-400',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center px-2 py-1 rounded-full ${config.bgColor}`}>
      <div className={`w-2 h-2 rounded-full ${config.dotColor} mr-1.5`}></div>
      <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
    </div>
  );
};

const VisitCard = ({ time, patientName, age, address, risk, presenceStatus }: VisitCardProps) => {
  const isAlert = risk === 'modéré';
  const riskColor = isAlert ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white';
  const riskDot = isAlert ? <div className="w-2 h-2 rounded-full bg-orange-500 mr-2 flex-shrink-0 animate-pulse"></div> : null;

  return (
    <div className={`flex items-start p-4 mb-3 rounded-xl shadow-sm border-l-4 ${riskColor} transition duration-150 hover:shadow-md cursor-pointer`}>
      <div className="flex-shrink-0 w-16 text-center pt-1">
        <p className="text-lg font-bold text-gray-800">{time}</p>
      </div>
      <div className="ml-4 flex-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            {riskDot}
            <p className="text-md font-semibold text-gray-800">{patientName}, {age} ans</p>
          </div>
          <PresenceStatusBadge status={presenceStatus} />
        </div>

        {isAlert && <p className="text-sm text-orange-600 font-medium">Risque Modéré — Confusion observée</p>}

        <div className="flex items-center text-sm text-gray-500 mt-1">
          <MapPin size={14} className="mr-1 text-gray-400" />
          <span>{address}</span>
        </div>
      </div>
      <ChevronRight size={20} className="text-gray-400 flex-shrink-0 ml-2 mt-1" />
    </div>
  );
};

export default function E18_TourCoordinator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const primaryAlert = {
    patientName: 'Françoise Dupont',
    age: 78,
    time: '14:30',
    riskType: 'Douleur Extrême',
    recommendation: 'Réévaluation urgente nécessaire (selon score EVA 10/10 détecté)',
    initials: 'FD',
    imageUrl: 'https://placehold.co/48x48/DC2626/FFFFFF?text=FD',
  };

  const todayVisits: VisitCardProps[] = [
    { time: '09:00', patientName: 'Françoise Dupont', age: 78, address: '12 rue des Écoles', risk: 'faible', presenceStatus: 'confirmed' },
    { time: '10:00', patientName: 'Clémence Bernard', age: 85, address: '5 avenue Victor Hugo', risk: 'modéré', presenceStatus: 'pending' },
    { time: '11:00', patientName: 'Pierre Lefèvre', age: 90, address: '33 boulevard de la Gare', risk: 'faible', presenceStatus: 'absent' },
    { time: '14:00', patientName: 'Brigitte Marchand', age: 79, address: '17 rue Pasteur', risk: 'faible', presenceStatus: 'confirmed' },
  ];

  const handleBack = () => {
    setLocation('/dashboard');
  };

  const handleAction = (action: string) => {
    toast({
      title: `Action: ${action}`,
      description: `Action ${action} déclenchée pour ${primaryAlert.patientName}`,
    });
  };

  const handleReorganize = () => {
    toast({
      title: "Réorganisation",
      description: "Fonctionnalité de tri/réorganisation à venir",
    });
  };

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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Vue Coordinateur</h1>
          <p className="text-xs text-gray-500">Gestion de tournée en temps réel</p>
        </div>
        <CalendarCheck size={24} className="text-blue-600" />
      </div>

      <div className="p-4 flex-1 pb-4">
        {/* Alerte Prioritaire (Rouge) */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-red-600 mb-3 flex items-center">
            <AlertTriangle size={20} className="mr-2 animate-pulse" /> 
            Urgence clinique
          </h2>
          <div className="bg-white border-l-4 border-red-600 rounded-xl shadow-lg p-4 transition duration-300 hover:shadow-xl">
            <div className="flex items-center mb-3">
              <PatientAvatar 
                initials={primaryAlert.initials} 
                imageUrl={primaryAlert.imageUrl} 
              />
              <div>
                <p className="text-xl font-bold text-gray-800">
                  {primaryAlert.patientName}, {primaryAlert.age} ans
                </p>
                <p className="text-sm font-medium text-red-600 flex items-center">
                  <Clock size={14} className="mr-1" /> 
                  {primaryAlert.time}
                </p>
              </div>
            </div>

            <p className="text-gray-700 font-medium">
              Type de risque: <span className="text-red-700 font-bold">{primaryAlert.riskType}</span>
            </p>
            <p className="text-sm text-gray-600 italic mt-1">
              Recommandation IA: {primaryAlert.recommendation}
            </p>

            {/* Actions rapides */}
            <div className="mt-4 flex space-x-2">
              <button 
                onClick={() => handleAction('Réassignation')} 
                className="flex-1 text-xs bg-red-100 text-red-800 py-2 rounded-lg font-semibold hover:bg-red-200 transition"
              >
                Réassigner
              </button>
              <button 
                onClick={() => handleAction('Appel')} 
                className="flex-1 text-xs bg-red-100 text-red-800 py-2 rounded-lg font-semibold hover:bg-red-200 transition"
              >
                Appeler l'infirmier
              </button>
              <button 
                onClick={() => handleAction('Visite')} 
                className="flex-1 text-xs bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition"
              >
                Visite urgente
              </button>
            </div>
          </div>
        </div>

        {/* Planning des Visites du Jour */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <Truck size={20} className="mr-2 text-blue-600" /> 
            Visites du jour (Tournée)
          </h2>
          <div className="space-y-2">
            {todayVisits.map((visit, index) => (
              <VisitCard key={index} {...visit} />
            ))}
          </div>
          <Button
            onClick={handleReorganize}
            variant="outline"
            className="w-full mt-4 flex items-center justify-center space-x-2 py-3 text-blue-600 font-semibold hover:bg-blue-50 rounded-xl border-2 border-blue-200"
          >
            <span>Trier / Réorganiser la tournée</span>
            <ChevronsRight size={20} />
          </Button>
        </div>

        {/* Info coordinateurs */}
        <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-200">
          <p className="text-xs text-purple-800 font-medium">
            👔 Vue réservée aux cadres de santé, coordinateurs SSIAD, responsables HAD et superviseurs
          </p>
        </div>
      </div>
    </div>
  );
}
