import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { useCustomToast } from '@/hooks/useToast';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

interface TransmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

export function TransmissionModal({ isOpen, onClose, content }: TransmissionModalProps) {
  const toast = useCustomToast();
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Transmission copiée dans le presse-papier');
    } catch (error) {
      console.error('Erreur de copie:', error);
      toast.error('Impossible de copier le texte');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transmission pour le médecin">
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{content}</p>
        </div>
        
        <div className="flex gap-3">
          <Button onClick={handleCopy} className="flex-1">
            Copier
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface ActionsRapidesModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Callback appelé quand un RDV est programmé depuis le modal
  onCreateRdv?: (rdv: any) => void;
  patientName?: string;
  patientId?: string;
}

export function ActionsRapidesModal({ isOpen, onClose, onCreateRdv, patientName, patientId }: ActionsRapidesModalProps) {
  const toast = useCustomToast();
  const [showScheduler, setShowScheduler] = useState(false);

  // Form state pour la programmation de RDV
  const [title, setTitle] = useState('Visite de contrôle');
  // If there's no patientId (free recording) or patientName indicates a free recording,
  // do not prefill the person field so the user can enter it.
  const initialPerson = (patientId && patientName && !String(patientName).toLowerCase().includes('enregistrement')) ? patientName : '';
  const [person, setPerson] = useState<string>(initialPerson);
  const [email, setEmail] = useState<string>(initialPerson && initialPerson.includes('@') ? initialPerson : '');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  // Leave location empty by default (user will fill). Placeholder gives an example.
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [reminderMinutes, setReminderMinutes] = useState<number>(60);

  const actions = [
    { label: 'Programmer une visite de contrôle', icon: '📅' },
    { label: 'Marquer comme visite à risque', icon: '⚠️' },
    { label: 'Envoyer une notification au médecin', icon: '📨' }
  ];

  const handleStartSchedule = () => {
    setShowScheduler(true);
  };

  const handleCreate = () => {
    if (!date || !time) {
      toast.error('Veuillez choisir une date et une heure pour le rendez-vous');
      return;
    }

    // Construire l'objet RDV
    const datetimeISO = new Date(`${date}T${time}`).toISOString();
    const rdv = {
      id: `rdv-${Date.now()}`,
      title: title || 'Visite de contrôle',
      person: person || null,
      patientId: patientId || null,
      patientName: patientName || null,
      date,
      time,
      heure: time,
      datetimeISO,
      email: email || null,
      durationMinutes: Number(durationMinutes) || 15,
      location,
      notes,
      description: notes || title,
      reminderMinutes: Number(reminderMinutes) || 0,
    };

    try {
      onCreateRdv && onCreateRdv(rdv);
      toast.success('Rendez-vous programmé');
      onClose();
    } catch (error) {
      console.error('Erreur création RDV:', error);
      toast.error('Impossible de créer le rendez-vous');
    }
  };

  const handleAction = (action: string) => {
    const normalized = (action || '').toString().toLowerCase();
    // Ouvrir le scheduler pour toute action qui ressemble à "programmer" / "visite"
    if (normalized.includes('programmer') || normalized.includes('visite')) {
      handleStartSchedule();
      return;
    }

    console.log('Action rapide:', action);
    toast.info(`Action "${action}" sera implémentée prochainement`);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Actions rapides">
      <div className="space-y-3">
        {!showScheduler ? (
          <div className="space-y-2">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleAction(action.label)}
                className="w-full p-4 text-left bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all flex items-center"
              >
                <span className="text-2xl mr-3">{action.icon}</span>
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Créer un rendez-vous de contrôle — vérifiez les informations avant de valider.</p>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500">Titre</label>
                  <Input value={title} onChange={(e:any)=>setTitle(e.target.value)} placeholder="Ex: Visite de contrôle - Pansement" className="mt-1" />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Nom de la personne</label>
                  <Input value={person} onChange={(e:any)=>setPerson(e.target.value)} placeholder="Nom complet (ex: Jean Dupont)" className="mt-1" />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Adresse email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e:any)=>setEmail(e.target.value)}
                    placeholder="ex: jean.dupont@example.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Date</label>
                  <input className="w-full p-2 mt-1 border rounded" type="date" value={date} onChange={(e:any)=>setDate(e.target.value)} />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Heure</label>
                  <input className="w-full p-2 mt-1 border rounded" type="time" value={time} onChange={(e:any)=>setTime(e.target.value)} />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Durée (min)</label>
                  <Input type="number" value={String(durationMinutes)} onChange={(e:any)=>setDurationMinutes(Number(e.target.value))} placeholder="30" className="mt-1" />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Lieu</label>
                  <Input value={location} onChange={(e:any)=>setLocation(e.target.value)} placeholder="Ex: Cabinet ou Domicile (laisser vide si non applicable)" className="mt-1" />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500">Notes supplémentaires</label>
                  <Textarea value={notes} onChange={(e:any)=>setNotes(e.target.value)} placeholder="Ex: Prévoir changement de pansement, confirmer disponibilité" className="mt-1 h-24" />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreate} className="flex-1 bg-blue-600 hover:bg-blue-700">Programmer</Button>
              <Button onClick={onClose} variant="outline" className="flex-1">Annuler</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
