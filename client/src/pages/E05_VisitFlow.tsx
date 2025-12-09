import React, { useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, Sparkles, Send, Zap, Loader2, Search, Pencil, Check, X } from 'lucide-react';
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
  const [contactsResults, setContactsResults] = useState<any[]>([]);
  const [clientFacture, setClientFacture] = useState<any | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [rendezVous, setRendezVous] = useState<any[]>([]);
  
  // État pour l'édition des contacts
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [editingContactData, setEditingContactData] = useState<Record<string, string>>({});
  
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
    setClientFacture(null);
    setProducts([]);
    setRendezVous([]);

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
      const client = data.client_facture || null;
      const prods = Array.isArray(data.products) ? data.products : [];
      const rdvs = Array.isArray(data.rendez_vous) ? data.rendez_vous : [];

      setContactsResults(persons);
      setClientFacture(client);
      setProducts(prods);
      setRendezVous(rdvs);

      if (!persons.length && !client && !prods.length && !rdvs.length) {
        toast.info('Aucune entité détectée dans la transcription');
      } else {
        toast.success(
          `Extraction réussie: ${persons.length} contacts, ${prods.length} produits, ${rdvs.length} RDV`
        );
      }
    } catch (error) {
      console.error('[EXTRACT-ENTITIES] Erreur extraction:', error);
      toast.error('Erreur lors de l\'extraction des entités');
    } finally {
      setIsSearchingContacts(false);
    }
  };

  // Fonctions pour l'édition des contacts
  const handleStartEditContact = (index: number, contactData: Record<string, any>) => {
    // Convertir toutes les valeurs en strings pour l'édition
    const editableData: Record<string, string> = {};
    Object.keys(contactData).forEach(key => {
      if (key !== 'raw' && key !== 'persons') {
        editableData[key] = String(contactData[key] || '');
      }
    });
    setEditingContactIndex(index);
    setEditingContactData(editableData);
  };

  const handleCancelEditContact = () => {
    setEditingContactIndex(null);
    setEditingContactData({});
  };

  const handleSaveEditContact = (index: number) => {
    setContactsResults(prev => {
      const newResults = [...prev];
      newResults[index] = { ...newResults[index], ...editingContactData };
      return newResults;
    });

    setEditingContactIndex(null);
    setEditingContactData({});
    toast.success('Contact modifié avec succès');
  };

  const handleEditFieldChange = (key: string, value: string) => {
    setEditingContactData(prev => ({ ...prev, [key]: value }));
  };

  const handleAddField = () => {
    const newFieldName = prompt('Nom du nouveau champ (ex: adresse, specialite, etc.):');
    if (newFieldName && newFieldName.trim()) {
      const normalizedKey = newFieldName.trim().toLowerCase().replace(/\s+/g, '_');
      setEditingContactData(prev => ({ ...prev, [normalizedKey]: '' }));
    }
  };

  const handleCreateContact = async (person: any, index: number) => {
    try {
      const response = await fetch('/api/contacts/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person: person,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur lors de la création du contact');
      }

      const data = await response.json();
      
      toast.success(`Contact "${person.nom_complet}" créé avec succès dans Odoo (ID: ${data.odoo_id})`);
      
      // Mettre à jour le résultat pour afficher le contact créé
      setContactsResults(prev => {
        const newResults = [...prev];
        newResults[index] = {
          ...newResults[index],
          match: {
            Information: {
              ...person,
              odoo_id: data.odoo_id,
            },
          },
        };
        return newResults;
      });
    } catch (error: any) {
      console.error('[CONTACTS] Erreur création contact:', error);
      toast.error(error.message || 'Erreur lors de la création du contact');
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
          
          <div className="flex flex-col items-center gap-3 pt-4">
            <p className="text-xs font-medium text-gray-600">Type d'enregistrement</p>
            <div className="grid grid-cols-3 gap-3 w-full">
              {/* Bouton CRM - Bleu */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => {/* TODO: Spécifier type CRM */}}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  CRM
                </button>
              </div>

              {/* Bouton Prescription - Orange */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => {/* TODO: Spécifier type Prescription */}}
                  className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Prescription
                </button>
              </div>

              {/* Bouton Observation - Rouge */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => {/* TODO: Spécifier type Observation */}}
                  className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Observation
                </button>
              </div>
            </div>
            
            {/* Bouton vocal original en dessous */}
            <div className="w-full flex justify-center pt-2">
              <VoiceRecorderButton onTranscription={handleTranscription} />
            </div>
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
                Extraction en cours...
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Autofill
              </>
            )}
          </Button>
        </div>

        {/* Loader overlay pendant l'extraction */}
        {isSearchingContacts && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full animate-pulse"></div>
                </div>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-gray-800">
                  Extraction des entités en cours...
                </h3>
                <p className="text-sm text-gray-600">
                  Recherche des contacts, produits et rendez-vous dans vos notes
                </p>

                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Contacts
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Produits
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Rendez-vous
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Client Facturé */}
        {clientFacture && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Client à facturer</h3>
            <div className={`border rounded-xl p-3 text-sm ${
              clientFacture.reconnu ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <p className={`font-semibold ${
                  clientFacture.reconnu ? 'text-green-800' : 'text-orange-800'
                }`}>
                  {clientFacture.nom_complet || 'Client non identifié'}
                  {clientFacture.reconnu && ' ✓'}
                </p>
                {clientFacture.odoo_contact_id && (
                  <span className="text-xs bg-white px-2 py-1 rounded">
                    ID: {clientFacture.odoo_contact_id}
                  </span>
                )}
              </div>
              <div className="space-y-1 text-gray-700">
                {clientFacture.tel && (
                  <p><span className="font-medium">Tél:</span> {clientFacture.tel}</p>
                )}
                {clientFacture.email && (
                  <p><span className="font-medium">Email:</span> {clientFacture.email}</p>
                )}
                {!clientFacture.reconnu && (
                  <p className="text-orange-700 text-xs mt-2">
                    ⚠️ Client non reconnu dans Odoo - Vérifiez les informations avant de créer
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Produits */}
        {products.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Produits détectés ({products.length})
            </h3>
            <div className="space-y-2">
              {products.map((product, index) => (
                <div
                  key={index}
                  className="border border-blue-200 bg-blue-50 rounded-xl p-3 text-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-blue-800">
                        {product.nom_produit || 'Produit sans nom'}
                      </p>
                      <div className="mt-1 space-y-1 text-gray-700">
                        {product.quantite && (
                          <p>
                            <span className="font-medium">Quantité:</span> {product.quantite}
                            {product.unite && ` ${product.unite}`}
                          </p>
                        )}
                        {product.prix_unitaire && (
                          <p>
                            <span className="font-medium">Prix unitaire:</span> {product.prix_unitaire}€
                          </p>
                        )}
                        {product.description && (
                          <p className="text-xs text-gray-600 italic">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rendez-vous */}
        {rendezVous.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Rendez-vous détectés ({rendezVous.length})
            </h3>
            <div className="space-y-2">
              {rendezVous.map((rdv, index) => (
                <div
                  key={index}
                  className="border border-purple-200 bg-purple-50 rounded-xl p-3 text-sm"
                >
                  <p className="font-semibold text-purple-800">
                    RDV {index + 1}
                  </p>
                  <div className="mt-1 space-y-1 text-gray-700">
                    {rdv.date && (
                      <p>
                        <span className="font-medium">Date:</span> {rdv.date}
                      </p>
                    )}
                    {rdv.heure && (
                      <p>
                        <span className="font-medium">Heure:</span> {rdv.heure}
                      </p>
                    )}
                    {rdv.description && (
                      <p className="text-xs text-gray-600">
                        {rdv.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contacts/Personnes */}
        {contactsResults.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Contacts détectés ({contactsResults.length})
            </h3>
            <div className="space-y-3">
              {contactsResults.map((person, index) => {
                const isEditing = editingContactIndex === index;
                const reconnu = person.reconnu === true;

                // Mode édition
                if (isEditing) {
                  return (
                    <div
                      key={index}
                      className={`border rounded-xl p-3 text-sm ${
                        reconnu ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <p className={`font-semibold ${
                          reconnu ? 'text-blue-800' : 'text-orange-800'
                        }`}>
                          Modifier le contact
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEditContact(index)}
                            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                            title="Enregistrer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEditContact}
                            className="p-1.5 bg-gray-400 hover:bg-gray-500 text-white rounded-lg"
                            title="Annuler"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {Object.keys(editingContactData).map((key) => (
                          <div key={key} className="flex gap-2 items-center">
                            <label className="w-1/3 text-xs font-medium text-gray-600 capitalize">
                              {key.replace(/_/g, ' ')}
                            </label>
                            <Input
                              value={editingContactData[key]}
                              onChange={(e) => handleEditFieldChange(key, e.target.value)}
                              className="flex-1 text-sm h-8"
                            />
                          </div>
                        ))}
                        <button
                          onClick={handleAddField}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          + Ajouter un champ
                        </button>
                      </div>
                    </div>
                  );
                }

                // Affichage normal du contact
                return (
                  <div
                    key={index}
                    className={`border rounded-xl p-3 text-sm ${
                      reconnu ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className={`font-semibold ${
                        reconnu ? 'text-green-800' : 'text-orange-800'
                      }`}>
                        {person.nom_complet || 'Contact sans nom'}
                        {reconnu && ' ✓'}
                      </p>
                      <div className="flex gap-2">
                        {person.odoo_contact_id && (
                          <span className="text-xs bg-white px-2 py-1 rounded">
                            ID: {person.odoo_contact_id}
                          </span>
                        )}
                        <button
                          onClick={() => handleStartEditContact(index, person)}
                          className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-gray-700 text-xs">
                      {person.role_brut && (
                        <p><span className="font-medium">Rôle:</span> {person.role_brut}</p>
                      )}
                      {person.tel && (
                        <p><span className="font-medium">Tél:</span> {person.tel}</p>
                      )}
                      {person.email && (
                        <p><span className="font-medium">Email:</span> {person.email}</p>
                      )}
                      {person.type_acteur && (
                        <p><span className="font-medium">Type:</span> {person.type_acteur}</p>
                      )}
                      {person.profession_code && (
                        <p><span className="font-medium">Profession:</span> {person.profession_code}</p>
                      )}
                      {person.is_professional !== undefined && (
                        <p>
                          <span className="font-medium">Professionnel:</span>{' '}
                          {person.is_professional ? 'Oui' : 'Non'}
                        </p>
                      )}
                      {person.is_client !== undefined && (
                        <p>
                          <span className="font-medium">Client:</span>{' '}
                          {person.is_client ? 'Oui' : 'Non'}
                        </p>
                      )}
                      {person.source && (
                        <p><span className="font-medium">Source:</span> {person.source}</p>
                      )}
                    </div>

                    {!reconnu && person.nom_complet && (
                      <div className="mt-3">
                        <button
                          onClick={() => handleCreateContact(person, index)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-xs"
                        >
                          ✅ Créer ce nouveau contact dans Odoo
                        </button>
                      </div>
                    )}
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
