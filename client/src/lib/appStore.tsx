import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export interface Patient {
  id: string;
  name: string;
  address?: string | null;
  nextVisitTime?: string | null;
  riskLevel?: string | null;
  age?: string | null;
  tags?: string[];
  consent?: boolean;
  lastVisitSummary?: string;
}

export interface Alert {
  id: string;
  level: string;
  description: string;
  actionRequired: boolean;
}

export interface VisitIAData {
  summary: string;
  structuredDetails: {
    type: string;
    douleur: number;
    constantes: string;
    alertes: Alert[];
    date: string;
    time: string;
  };
  transcription: string;
  riskLevel: string;
  notes?: string;
  audioOriginal?: string; // Base64 TTS audio of transcription (MP3)
  audioSynthesis?: string; // Base64 TTS audio of summary (MP3)
}

export interface Visit {
  id: string;
  patientId: string | null;
  date: string;
  durationSeconds: number;
  durationMinSec: string;
  iaData?: VisitIAData;
  validated: boolean;
}

export interface SystemAlert {
  id: string;
  title: string;
  description: string;
  patientName: string;
  patientId?: string;
  read: boolean;
  createdAt: string;
}

// Initial Mock Data
const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pat-1',
    name: 'Claire Martin',
    address: '12, Rue de la Gare',
    nextVisitTime: '09:00',
    riskLevel: 'Faible',
    age: '78',
    tags: ['Diabète', 'AVK'],
    consent: true,
    lastVisitSummary: "Visite de contrôle. RAS, tension OK. Changement de pansement simple.",
  },
  {
    id: 'pat-2',
    name: 'Pierre Lefevre',
    address: '45, Avenue Victor Hugo',
    nextVisitTime: '10:30',
    riskLevel: 'Modéré',
    age: '85',
    tags: ['Alzheimer', 'Risque de chute'],
    consent: false,
    lastVisitSummary: "Le patient était fatigué et désorienté. Tension basse à surveiller.",
  },
  {
    id: 'pat-3',
    name: 'Jeanne Robert',
    address: '23, Place du Marché',
    nextVisitTime: '11:15',
    riskLevel: 'Élevé',
    age: '92',
    tags: ['Insuffisance Cardiaque', 'Oxygène'],
    consent: true,
    lastVisitSummary: "Plainte de douleurs persistantes (6/10) au genou. Ajustement médicamenteux recommandé.",
  },
];

const INITIAL_VISITS: Visit[] = [
  {
    id: 'visit-1',
    patientId: 'pat-1',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    durationSeconds: 180,
    durationMinSec: "3'00''",
    validated: true,
    iaData: {
      summary: "Visite de contrôle hebdomadaire. Patient en bonne forme. Glycémie stable à 1.2g/L. Pansement changé sans complication.",
      structuredDetails: {
        type: 'Contrôle hebdomadaire',
        douleur: 1,
        constantes: 'Tension: 13/8, Saturation: 97%, Glycémie: 1.2g/L',
        alertes: [],
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR'),
        time: '09:15',
      },
      transcription: "Infirmier: Bonjour Madame Martin, comment allez-vous ? Patient: Très bien merci. Infirmier: Parfait, on va vérifier votre glycémie. Patient: D'accord.",
      riskLevel: 'Faible',
    },
  },
  {
    id: 'visit-2',
    patientId: 'pat-3',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    durationSeconds: 240,
    durationMinSec: "4'00''",
    validated: true,
    iaData: {
      summary: "Visite de soins. La patiente se plaint de douleurs au genou gauche (6/10). Oxygène administré. Constantes stables mais douleur à surveiller.",
      structuredDetails: {
        type: 'Soins + Surveillance',
        douleur: 6,
        constantes: 'Tension: 12/7, Saturation: 94% (sous O2), Fréquence cardiaque: 78',
        alertes: [
          {
            id: 'alert-1',
            level: 'Modéré',
            description: 'Douleur persistante au genou (6/10) - Recommandation: consultation médecin',
            actionRequired: true,
          }
        ],
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR'),
        time: '11:20',
      },
      transcription: "Infirmier: Bonjour Madame Robert. Patient: Bonjour. J'ai mal au genou aujourd'hui. Infirmier: Sur une échelle de 0 à 10 ? Patient: Je dirais 6. Infirmier: D'accord, je note. On va vérifier vos constantes.",
      riskLevel: 'Modéré',
    },
  },
];

const INITIAL_ALERTS: SystemAlert[] = [
  {
    id: 'alert-sys-1',
    title: 'Douleur élevée signalée',
    description: 'Patient Jeanne Robert a signalé une douleur 6/10 lors de la dernière visite.',
    patientName: 'Jeanne Robert',
    patientId: 'pat-3',
    read: false,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'alert-sys-2',
    title: 'Consentement non obtenu',
    description: 'Patient Pierre Lefevre n\'a pas encore donné son consentement audio.',
    patientName: 'Pierre Lefevre',
    patientId: 'pat-2',
    read: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'alert-sys-3',
    title: 'Tension basse récurrente',
    description: 'Patient Pierre Lefevre: tension moyenne sous 90/60 sur les 3 dernières visites.',
    patientName: 'Pierre Lefevre',
    patientId: 'pat-2',
    read: true,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Context
interface AppContextType {
  patients: Patient[];
  visits: Visit[];
  alerts: SystemAlert[];
  
  getPatientById: (id: string) => Patient | undefined;
  updatePatientConsent: (patientId: string, consent: boolean) => void;
  
  addVisit: (visit: Visit) => void;
  updateVisit: (visitId: string, visit: Partial<Visit>) => void;
  deleteVisit: (visitId: string) => void;
  getVisitById: (id: string) => Visit | undefined;
  getVisitsByPatientId: (patientId: string) => Visit[];
  
  markAlertAsRead: (alertId: string) => void;
  addAlert: (alert: SystemAlert) => void;
  
  resetData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Load/Save from localStorage
const STORAGE_KEY = 'plode-care-data';

const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
  }
  return null;
};

const saveToStorage = (data: any) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

// Provider
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const stored = loadFromStorage();
  
  const [patients, setPatients] = useState<Patient[]>(stored?.patients || INITIAL_PATIENTS);
  const [visits, setVisits] = useState<Visit[]>(stored?.visits || INITIAL_VISITS);
  const [alerts, setAlerts] = useState<SystemAlert[]>(stored?.alerts || INITIAL_ALERTS);

  // Save to localStorage whenever data changes
  useEffect(() => {
    saveToStorage({ patients, visits, alerts });
  }, [patients, visits, alerts]);

  const getPatientById = (id: string) => {
    return patients.find(p => p.id === id);
  };

  const updatePatientConsent = (patientId: string, consent: boolean) => {
    setPatients(prev => prev.map(p =>
      p.id === patientId ? { ...p, consent } : p
    ));
  };

  const addVisit = (visit: Visit) => {
    setVisits(prev => [...prev, visit]);
  };

  const updateVisit = (visitId: string, visitUpdate: Partial<Visit>) => {
    setVisits(prev => prev.map(v =>
      v.id === visitId ? { ...v, ...visitUpdate } : v
    ));
  };

  const deleteVisit = (visitId: string) => {
    setVisits(prev => prev.filter(v => v.id !== visitId));
  };

  const getVisitById = (id: string) => {
    return visits.find(v => v.id === id);
  };

  const getVisitsByPatientId = (patientId: string) => {
    return visits.filter(v => v.patientId === patientId);
  };

  const markAlertAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, read: true } : a
    ));
  };

  const addAlert = (alert: SystemAlert) => {
    setAlerts(prev => [...prev, alert]);
  };

  const resetData = () => {
    setPatients(INITIAL_PATIENTS);
    setVisits(INITIAL_VISITS);
    setAlerts(INITIAL_ALERTS);
  };

  const value: AppContextType = {
    patients,
    visits,
    alerts,
    getPatientById,
    updatePatientConsent,
    addVisit,
    updateVisit,
    deleteVisit,
    getVisitById,
    getVisitsByPatientId,
    markAlertAsRead,
    addAlert,
    resetData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Hook
export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within AppProvider');
  }
  return context;
};
