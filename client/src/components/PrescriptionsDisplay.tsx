import React, { useState } from 'react';
import { Check, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PrescriptionsResponse } from '@/types/webhook-responses';

interface PrescriptionsDisplayProps {
  data: PrescriptionsResponse;
  onValidate?: (prescriptionId: string, matchId: string) => void;
}

export function PrescriptionsDisplay({ data, onValidate }: PrescriptionsDisplayProps) {
  const [validatedItems, setValidatedItems] = useState<Set<string>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);

  // Fonction pour nettoyer le texte des instructions de l'agent IA
  const cleanPrescriptionText = (text: string): string => {
    if (!text) return '';
    
    // Supprimer les instructions de l'agent (commence par "INSTRUCTIONS AGENT" ou contient du JSON structuré)
    if (text.includes('INSTRUCTIONS AGENT') || text.includes('tool match_prescription')) {
      return ''; // Ne rien afficher si c'est uniquement des instructions
    }
    
    // Supprimer les blocs JSON si présents
    let cleaned = text.replace(/\{[\s\S]*"prescription"[\s\S]*\}/g, '').trim();
    
    return cleaned;
  };

  const handleValidate = (prescriptionText: string, matchId: string) => {
    const key = `${prescriptionText}-${matchId}`;
    setValidatedItems(prev => new Set([...prev, key]));
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    
    if (onValidate) {
      onValidate(prescriptionText, matchId);
    }
  };

  const isValidated = (prescriptionText: string, matchId: string) => {
    return validatedItems.has(`${prescriptionText}-${matchId}`);
  };

  return (
    <div className="space-y-4">
      {/* Popup de succès */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Prescription validée avec succès !</span>
        </div>
      )}

      {data.prescriptions.map((prescription, idx) => {
        const cleanedText = cleanPrescriptionText(prescription.prescription);
        
        // Ne pas afficher la prescription si elle ne contient que des instructions
        if (!cleanedText) return null;
        
        return (
          <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 text-lg">
                  {cleanedText}
                </h3>
              </div>
            </div>

          {prescription.matches.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 font-medium">
                {prescription.matches.length} correspondance{prescription.matches.length > 1 ? 's' : ''} trouvée{prescription.matches.length > 1 ? 's' : ''} :
              </p>
              
              {prescription.matches.map((match) => {
                const validated = isValidated(prescription.prescription, match.id);
                
                return (
                  <div
                    key={match.id}
                    className={`border rounded-lg p-3 transition-all ${
                      match.polarity === 'forbidden'
                        ? 'bg-red-50 border-red-300'
                        : 'bg-blue-50 border-blue-300'
                    } ${validated ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <p className="text-sm text-gray-800">{match.content}</p>
                        
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs px-2 py-1 bg-white rounded-full text-gray-700 font-medium">
                            {match.category}
                          </span>
                          
                          {match.tags.map((tag, tagIdx) => (
                            <span
                              key={tagIdx}
                              className="text-xs px-2 py-1 bg-gray-200 rounded-full text-gray-700"
                            >
                              {tag}
                            </span>
                          ))}
                          
                          {match.polarity === 'forbidden' && (
                            <span className="text-xs px-2 py-1 bg-red-500 text-white rounded-full font-medium flex items-center gap-1">
                              <X className="w-3 h-3" />
                              Interdit
                            </span>
                          )}
                          {match.polarity === 'authorized' && (
                            <span className="text-xs px-2 py-1 bg-green-500 text-white rounded-full font-medium flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Autorisé
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleValidate(prescription.prescription, match.id)}
                        disabled={validated}
                        className={validated ? 'bg-green-500 hover:bg-green-500' : ''}
                      >
                        {validated ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Validé
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Valider
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500 text-sm p-3 bg-gray-50 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span>Aucune correspondance trouvée</span>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
