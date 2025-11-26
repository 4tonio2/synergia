import React, { useState } from 'react';
import { ChevronLeft, Filter, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

interface Alert {
  id: string;
  patientName: string;
  risk: 'élevé' | 'modéré';
  keyword: string;
  description: string;
  timeAgo: string;
}

const AlertCard = ({ alert }: { alert: Alert }) => {
  const riskColor = alert.risk === 'élevé' ? 'border-red-500' : 'border-orange-500';
  const bgColor = alert.risk === 'élevé' ? 'bg-red-50' : 'bg-orange-50';
  const dotColor = alert.risk === 'élevé' ? 'bg-red-500' : 'bg-orange-500';
  const textColor = alert.risk === 'élevé' ? 'text-red-700' : 'text-orange-700';
  const badgeColor = alert.risk === 'élevé' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700';

  return (
    <div className={`flex items-start p-4 ${bgColor} rounded-xl shadow-md mb-3 border-l-4 ${riskColor} transition hover:shadow-lg`}>
      <div className={`w-3 h-3 rounded-full ${dotColor} mr-3 mt-1.5 flex-shrink-0 animate-pulse`}></div>
      <div className="flex-1">
        <div className="flex items-start justify-between mb-2">
          <p className="font-semibold text-lg text-gray-800">{alert.patientName}</p>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${badgeColor}`}>
            Risque {alert.risk}
          </span>
        </div>
        <div className="flex items-center mb-1">
          <AlertTriangle size={14} className={textColor} />
          <p className={`text-sm font-medium ${textColor} ml-1`}>
            Mot-clé: <span className="font-bold">{alert.keyword}</span>
          </p>
        </div>
        <p className="text-gray-700 text-sm mb-2">{alert.description}</p>
        <p className="text-xs text-gray-500 flex items-center">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          Il y a {alert.timeAgo}
        </p>
      </div>
    </div>
  );
};

export default function E15_AlertsConsole() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: 'a1', patientName: 'Paul Durand', risk: 'modéré', keyword: 'hypotension', description: 'Constantes anormales détectées - Tension artérielle basse', timeAgo: '5 min' },
    { id: 'a2', patientName: 'Jeanne Lefevre', risk: 'élevé', keyword: 'confusion', description: 'Symptôme cognitif signalé - Désorientation temporelle', timeAgo: '10 min' },
    { id: 'a3', patientName: 'Henri Dupont', risk: 'modéré', keyword: 'douleur', description: 'Échelle de douleur 8/10 - Membre inférieur gauche', timeAgo: '30 min' },
    { id: 'a4', patientName: 'Odette Roussel', risk: 'élevé', keyword: 'chute', description: 'Chute signalée - Risque élevé de traumatisme', timeAgo: '1h' },
    { id: 'a5', patientName: 'Claire Martin', risk: 'modéré', keyword: 'diabète', description: 'Glycémie élevée - 2,5 g/L à jeun', timeAgo: '2h' },
  ]);

  const [filterActive, setFilterActive] = useState(false);

  const handleBack = () => {
    setLocation('/dashboard');
  };

  const handleFilter = () => {
    setFilterActive(!filterActive);
    toast({
      title: "Filtrage des alertes",
      description: "Fonctionnalité à venir - Filtrage par risque, patient, priorité",
    });
  };

  const highRiskCount = alerts.filter(a => a.risk === 'élevé').length;
  const moderateRiskCount = alerts.filter(a => a.risk === 'modéré').length;

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
          <h1 className="text-2xl font-bold text-gray-800">Alertes</h1>
          <p className="text-xs text-gray-500">
            {highRiskCount} élevé{highRiskCount > 1 ? 's' : ''} • {moderateRiskCount} modéré{moderateRiskCount > 1 ? 's' : ''}
          </p>
        </div>
        <button 
          onClick={handleFilter} 
          className="ml-auto text-blue-600 font-medium flex items-center hover:text-blue-700 transition"
        >
          Filtrer <Filter size={18} className="ml-1" />
        </button>
      </div>

      {/* Stats rapides */}
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex gap-3">
          <div className="flex-1 bg-red-50 rounded-lg p-3 border border-red-200">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              <span className="text-xs text-gray-600">Risque élevé</span>
            </div>
            <p className="text-2xl font-bold text-red-700 mt-1">{highRiskCount}</p>
          </div>
          <div className="flex-1 bg-orange-50 rounded-lg p-3 border border-orange-200">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
              <span className="text-xs text-gray-600">Risque modéré</span>
            </div>
            <p className="text-2xl font-bold text-orange-700 mt-1">{moderateRiskCount}</p>
          </div>
        </div>
      </div>

      {/* Liste des alertes */}
      <div className="p-4 flex-1 overflow-y-auto pb-6">
        {alerts.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-xl shadow-md text-gray-500">
            <ShieldCheck size={48} className="mx-auto mb-4 text-green-400" />
            <p className="font-semibold text-lg text-gray-700">Aucune alerte en cours</p>
            <p className="text-sm mt-2">Tout est sous contrôle !</p>
          </div>
        ) : (
          <div>
            {alerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
