import React, { useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, Sparkles, Send, Zap, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { VoiceRecorderButton } from '@/components/VoiceRecorderButton';
import { PhotoUploader } from '@/components/PhotoUploader';
import { TransmissionModal, ActionsRapidesModal } from '@/components/Modal';
import { useAppStore } from '@/lib/appStore';
import { useCustomToast } from '@/hooks/useToast';

type VisitType = 'soin' | 'controle' | 'pansement' | 'suivi-post-op' | 'autre';

interface VisitFormData {
  patientId: string;
  patientName: string;
  patientAge: string;
  visitType: VisitType;
  painLevel: number;
  notesRaw: string;
  notesSummary: string | null;
  photos: File[];
  audioSynthesis?: string; // Base64 audio TTS du résumé
  audioOriginal?: string; // Base64 audio TTS de la transcription
}

export default function E05_VisitFlow() {
  const [, setLocation] = useLocation();
  const [, patientParams] = useRoute('/patients/:id/record');
  const [, freeParams] = useRoute('/recordings/new-free');
  
  const { getPatientById, addVisit, updateVisit } = useAppStore();
  const toast = useCustomToast();
  
  // Déterminer si c'est un enregistrement patient ou libre
  const patientId = patientParams?.id || null;
  const isFreeRecording = !!freeParams;
  const patient = patientId ? getPatientById(patientId) : null;
  
  // État du formulaire
  const [formData, setFormData] = useState<VisitFormData>({
    patientId: patientId || '',
    patientName: patient?.name || 'Enregistrement libre',
    patientAge: patient?.age || 'N/A',
    visitType: 'soin',
    painLevel: 0,
    notesRaw: '',
    notesSummary: null,
    photos: []
  });
  
  // États UI
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingTransmission, setIsGeneratingTransmission] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [transmissionContent, setTransmissionContent] = useState('');
  const [showTransmissionModal, setShowTransmissionModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [contactsResults, setContactsResults] = useState<
    Array<{ input: any; match: any | null }>
  >([]);
  
  const handleBack = () => {
    if (patientId) {
      setLocation(`/patients/${patientId}`);
    } else {
      setLocation('/');
    }
  };
  
  const handleTranscription = async (text: string, audioBlob?: Blob) => {
    // Concaténer la transcription aux notes existantes
    setFormData(prev => ({
      ...prev,
      notesRaw: prev.notesRaw + text
    }));
  };
  
  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    
    try {
      // 1. Générer le TTS de la transcription complète (toutes les notes)
      let audioOriginal = undefined;
      if (formData.notesRaw && formData.notesRaw.trim().length > 0) {
        console.log('[TTS] Génération audio de la transcription complète...');
        const ttsTranscriptionResponse = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: formData.notesRaw.trim() })
        });
        
        if (ttsTranscriptionResponse.ok) {
          const { audio } = await ttsTranscriptionResponse.json();
          audioOriginal = audio;
          console.log('[TTS] Audio de la transcription généré');
        }
      }
      
      // 2. Appel API pour générer le résumé avec GPT-4
      const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: formData.patientName,
          patientAge: formData.patientAge,
          visitType: formData.visitType,
          painLevel: formData.painLevel,
          notesRaw: formData.notesRaw
        })
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la génération du résumé');
      }
      
      const { summary } = await response.json();
      
      // 3. Générer le TTS du résumé
      console.log('[TTS] Génération audio du résumé...');
      const ttsResponse = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summary })
      });
      
      let audioSynthesis = undefined;
      if (ttsResponse.ok) {
        const { audio } = await ttsResponse.json();
        audioSynthesis = audio;
        console.log('[TTS] Audio du résumé généré');
      }
      
      setFormData(prev => ({
        ...prev,
        notesSummary: summary,
        audioOriginal: audioOriginal, // Audio TTS de la transcription
        audioSynthesis: audioSynthesis // Audio TTS du résumé
      }));
      
    } catch (error) {
      console.error('Erreur génération résumé:', error);
      toast.error('Erreur lors de la génération du résumé');
    } finally {
      setIsGeneratingSummary(false);
    }
  };
  
  const handleGenerateTransmission = async () => {
    setIsGeneratingTransmission(true);
    
    try {
      // Appel API pour générer la transmission avec GPT-4
      const response = await fetch('/api/ai/transmission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: formData.patientName,
          patientAge: formData.patientAge,
          visitType: formData.visitType,
          painLevel: formData.painLevel,
          notesRaw: formData.notesRaw,
          notesSummary: formData.notesSummary
        })
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la génération de la transmission');
      }
      
      const { transmission } = await response.json();
      
      setTransmissionContent(transmission);
      setShowTransmissionModal(true);
      
    } catch (error) {
      console.error('Erreur génération transmission:', error);
      toast.error('Erreur lors de la génération de la transmission');
    } finally {
      setIsGeneratingTransmission(false);
    }
  };

  const handleSearchContacts = async () => {
    if (!formData.notesRaw || !formData.notesRaw.trim()) {
      toast.error('Veuillez d\'abord saisir ou dicter des notes de visite');
      return;
    }

    setIsSearchingContacts(true);
    setContactsResults([]);

    try {
      const response = await fetch('/api/contacts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: formData.notesRaw }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la recherche de contacts');
      }

      const data = await response.json();
      const persons = Array.isArray(data.persons) ? data.persons : [];
      setContactsResults(persons);

      if (!persons.length) {
        toast.info('Aucun contact détecté dans la transcription');
      }
    } catch (error) {
      console.error('[CONTACTS] Erreur recherche contacts:', error);
      toast.error('Erreur lors de la recherche de contacts dans Odoo');
    } finally {
      setIsSearchingContacts(false);
    }
  };
  
  const handleSaveDraft = () => {
    // Créer une nouvelle visite en brouillon
    const now = new Date();
    const visitId = `visit-${Date.now()}`;
    
    const newVisit = {
      id: visitId,
      patientId: patientId,
      date: now.toISOString(),
      durationSeconds: 0,
      durationMinSec: '00:00',
      iaData: {
        summary: formData.notesSummary || formData.notesRaw.slice(0, 200),
        transcription: formData.notesRaw,
        riskLevel: 'faible',
        structuredDetails: {
          type: formData.visitType,
          douleur: formData.painLevel,
          constantes: '',
          alertes: [],
          date: now.toLocaleDateString('fr-FR'),
          time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        }
      },
      validated: false
    };
    
    addVisit(newVisit);
    
    if (patientId) {
      setLocation(`/patients/${patientId}/history`);
    } else {
      setLocation('/recordings');
    }
  };
  
  const handleValidate = async () => {
    setIsValidating(true);
    
    try {
      // Créer et valider directement la visite
      const now = new Date();
      const visitId = `visit-${Date.now()}`;
      
      // Si l'audio de la transcription n'existe pas, le générer maintenant
      let audioOriginal = formData.audioOriginal;
      if (!audioOriginal && formData.notesRaw && formData.notesRaw.trim().length > 0) {
        try {
          console.log('[TTS] Génération audio de la transcription avant validation...');
          const ttsResponse = await fetch('/api/voice/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: formData.notesRaw.trim() })
          });
          
          if (ttsResponse.ok) {
            const { audio } = await ttsResponse.json();
            audioOriginal = audio;
            console.log('[TTS] Audio de la transcription généré');
          }
        } catch (error) {
          console.error('[TTS] Erreur génération audio:', error);
        }
      }
      
      const newVisit = {
        id: visitId,
        patientId: patientId,
        date: now.toISOString(),
        durationSeconds: 0,
        durationMinSec: '00:00',
        iaData: {
          summary: formData.notesSummary || formData.notesRaw.slice(0, 200),
          transcription: formData.notesRaw,
          riskLevel: formData.painLevel > 7 ? 'élevé' : 'faible',
          audioOriginal: audioOriginal, // Audio TTS de la transcription
          audioSynthesis: formData.audioSynthesis, // Audio TTS du résumé
          structuredDetails: {
            type: formData.visitType,
            douleur: formData.painLevel,
            constantes: '',
            alertes: formData.painLevel > 7 ? [{
              id: `alert-${Date.now()}`,
              level: 'haute',
              description: `Douleur élevée (${formData.painLevel}/10)`,
              actionRequired: true
            }] : [],
            date: now.toLocaleDateString('fr-FR'),
            time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          }
        },
        validated: true
      };
      
      addVisit(newVisit);
      
      if (patientId) {
        setLocation(`/patients/${patientId}/history`);
      } else {
        setLocation('/recordings');
      }
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header fixe avec bouton retour visible */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <button
          onClick={handleBack}
          className="flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Retour
        </button>
      </div>
      
      <div className="flex justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-4">
          {/* Info patient */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h1 className="text-2xl font-bold text-gray-800">{formData.patientName}</h1>
            <p className="text-sm text-gray-500">{formData.patientAge} ans</p>
          </div>
        
          {/* Notes de visite */}
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Notes de visite</h2>
          
          <Textarea
            value={formData.notesRaw}
            onChange={(e) => setFormData(prev => ({ ...prev, notesRaw: e.target.value }))}
            placeholder="Dicter ou saisir les observations de la visite…"
            className="min-h-32 resize-none"
          />
          
          <div className="flex flex-col items-center gap-2 pt-2">
            <VoiceRecorderButton onTranscription={handleTranscription} />
          </div>
        </div>
        
        {/* Résumé IA (si généré) */}
        {formData.notesSummary && (
          <div className="bg-blue-50 rounded-2xl shadow-sm p-4 border-l-4 border-blue-400">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Résumé IA</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{formData.notesSummary}</p>
          </div>
        )}
        
        {/* Type de visite */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <label className="text-sm font-semibold text-gray-700">Type de visite</label>
          <select
            value={formData.visitType}
            onChange={(e) => setFormData(prev => ({ ...prev, visitType: e.target.value as VisitType }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="soin">Soin</option>
            <option value="controle">Contrôle</option>
            <option value="pansement">Pansement</option>
            <option value="suivi-post-op">Suivi post-op</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        
        {/* Niveau de douleur */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-700">Niveau de douleur</label>
            <span className="text-2xl font-bold text-blue-600">{formData.painLevel}/10</span>
          </div>
          
          <input
            type="range"
            min="0"
            max="10"
            value={formData.painLevel}
            onChange={(e) => setFormData(prev => ({ ...prev, painLevel: parseInt(e.target.value) }))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>Aucune</span>
            <span>Modérée</span>
            <span>Extrême</span>
          </div>
        </div>
        
        {/* Photos */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <label className="text-sm font-semibold text-gray-700">Photos</label>
          <PhotoUploader
            photos={formData.photos}
            onPhotosChange={(photos) => setFormData(prev => ({ ...prev, photos }))}
          />
        </div>
        
        {/* Actions IA */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Actions IA</h3>
          
          <Button
            onClick={handleGenerateSummary}
            disabled={isGeneratingSummary || !formData.notesRaw}
            className="w-full h-12 rounded-full"
          >
            {isGeneratingSummary ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Génération résumé + audios...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Générer un résumé
              </>
            )}
          </Button>
          
          <Button
            onClick={handleGenerateTransmission}
            disabled={isGeneratingTransmission || !formData.notesRaw}
            variant="outline"
            className="w-full h-12 rounded-full"
          >
            {isGeneratingTransmission ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Transmission médecin
              </>
            )}
          </Button>
          
          <Button
            onClick={() => setShowActionsModal(true)}
            variant="outline"
            className="w-full h-12 rounded-full"
          >
            <Zap className="w-5 h-5 mr-2" />
            Actions rapides...
          </Button>

          <Button
            onClick={handleSearchContacts}
            disabled={isSearchingContacts || !formData.notesRaw}
            variant="outline"
            className="w-full h-12 rounded-full"
          >
            {isSearchingContacts ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Recherche des contacts Odoo...
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Rechercher les contacts dans Odoo
              </>
            )}
          </Button>
        </div>

        {contactsResults.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Résultats contacts Odoo
            </h3>
            <div className="space-y-3">
              {contactsResults.map((item, index) => {
                const match = item.match;
                const input = item.input || {};

                if (!match) {
                  return (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-xl p-3 text-sm text-gray-600"
                    >
                      <p className="font-semibold">
                        Personne {index + 1}{' '}
                        {input.nom_complet ? `- ${input.nom_complet}` : ''}
                      </p>
                      <p className="text-gray-500">
                        Désolé, aucun contact correspondant n&apos;a été trouvé
                        dans Odoo pour cette personne.
                      </p>
                    </div>
                  );
                }

                const info = match.Information || match.information || match;

                return (
                  <div
                    key={index}
                    className="border border-blue-100 bg-blue-50 rounded-xl p-3 text-sm text-gray-700"
                  >
                    <p className="font-semibold text-blue-800">
                      Personne {index + 1}{' '}
                      {info.nom_complet ? `- ${info.nom_complet}` : ''}
                    </p>
                    <div className="mt-1 space-y-1">
                      {info.tel && <p>Téléphone : {info.tel}</p>}
                      {info.email && <p>Email : {info.email}</p>}
                      {info.profession_code && (
                        <p>Profession : {info.profession_code}</p>
                      )}
                      {info.type_acteur && (
                        <p>Type d&apos;acteur : {info.type_acteur}</p>
                      )}
                      {info.grande_categorie_acteur && (
                        <p>
                          Grande catégorie : {info.grande_categorie_acteur}
                        </p>
                      )}
                      {info.sous_categorie_acteur && (
                        <p>
                          Sous-catégorie : {info.sous_categorie_acteur}
                        </p>
                      )}
                      {!info.tel &&
                        !info.email &&
                        !info.profession_code &&
                        !info.type_acteur &&
                        !info.grande_categorie_acteur &&
                        !info.sous_categorie_acteur && (
                          <p className="text-gray-500">
                            Contact trouvé, mais aucune information détaillée
                            n&apos;a été renvoyée.
                          </p>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Boutons de sauvegarde */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <Button
            onClick={handleValidate}
            disabled={!formData.notesRaw || isValidating}
            className="w-full h-12 rounded-full bg-green-600 hover:bg-green-700"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Validation en cours...
              </>
            ) : (
              'Valider la visite'
            )}
          </Button>
          
          <Button
            onClick={handleSaveDraft}
            disabled={!formData.notesRaw}
            variant="outline"
            className="w-full h-12 rounded-full"
          >
            Enregistrer en brouillon
          </Button>
        </div>
        </div>
      </div>
      
      {/* Modals */}
      <TransmissionModal
        isOpen={showTransmissionModal}
        onClose={() => setShowTransmissionModal(false)}
        content={transmissionContent}
      />
      
      <ActionsRapidesModal
        isOpen={showActionsModal}
        onClose={() => setShowActionsModal(false)}
      />
    </div>
  );
}
