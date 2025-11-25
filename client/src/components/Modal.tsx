import React from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
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
}

export function ActionsRapidesModal({ isOpen, onClose }: ActionsRapidesModalProps) {
  const toast = useCustomToast();
  
  const actions = [
    { label: 'Programmer une visite de contrôle', icon: '📅' },
    { label: 'Marquer comme visite à risque', icon: '⚠️' },
    { label: 'Envoyer une notification au médecin', icon: '📨' }
  ];

  const handleAction = (action: string) => {
    console.log('Action rapide:', action);
    toast.info(`Action "${action}" sera implémentée prochainement`);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Actions rapides">
      <div className="space-y-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => handleAction(action.label)}
            className="w-full p-4 text-left bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all"
          >
            <span className="text-2xl mr-3">{action.icon}</span>
            <span className="text-sm font-medium text-gray-700">{action.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
