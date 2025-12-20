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
  const [person, setPerson] = useState(patientName || '');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [location, setLocation] = useState<string>('Cabinet');
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
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Créer un rendez-vous de contrôle — toutes les données peuvent être modifiées avant création.</p>
            <div className="grid grid-cols-1 gap-2">
              <Input value={title} onChange={(e:any)=>setTitle(e.target.value)} placeholder="Titre (ex: Visite de contrôle)" />
              <Input value={person} onChange={(e:any)=>setPerson(e.target.value)} placeholder="Personne concernée" />
              <div className="flex gap-2">
                <input className="w-1/2 p-2 border rounded" type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
                <input className="w-1/2 p-2 border rounded" type="time" value={time} onChange={(e)=>setTime(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Input type="number" value={String(durationMinutes)} onChange={(e:any)=>setDurationMinutes(Number(e.target.value))} placeholder="Durée (minutes)" />
                <Input type="number" value={String(reminderMinutes)} onChange={(e:any)=>setReminderMinutes(Number(e.target.value))} placeholder="Rappel (minutes avant)" />
              </div>
              <Input value={location} onChange={(e:any)=>setLocation(e.target.value)} placeholder="Lieu (ex: Cabinet)" />
              <Textarea value={notes} onChange={(e:any)=>setNotes(e.target.value)} placeholder="Notes supplémentaires" />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreate} className="flex-1">Programmer</Button>
              <Button onClick={onClose} variant="outline" className="flex-1">Annuler</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
