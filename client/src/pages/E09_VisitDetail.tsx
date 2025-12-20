import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { Volume2, AlertTriangle, Plus, CheckCircle, Trash, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PatientHeader } from "@/components/PatientHeader";
import { Pill } from "@/components/Pill";
import { useAppStore } from "@/lib/appStore";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useCustomToast } from "@/hooks/useToast";

export default function E09_VisitDetail() {
  const [, patientParams] = useRoute('/patients/:patientId/visits/:visitId');
  const [, recordingParams] = useRoute('/recordings/:id');
  const [location, setLocation] = useLocation();
  const { getVisitById, getPatientById, deleteVisit, updateVisit } = useAppStore();
  const { confirm } = useConfirmDialog();
  const toast = useCustomToast();
  
  const visitId = patientParams?.visitId || recordingParams?.id;
  const visit = visitId ? getVisitById(visitId) : undefined;
  const patient = visit?.patientId ? getPatientById(visit.patientId) : null;
  
  const [note, setNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Local editable structured details state
  const initialStructured = visit?.iaData?.structuredDetails || {
    type: '',
    douleur: 0,
    constantes: '',
    alertes: [],
    date: '',
    time: '',
  };

  const [editedStructured, setEditedStructured] = useState(() => ({ ...initialStructured }));

  // timer ref not strictly necessary here but keep pattern
  const mountedRef = useRef(false);

  useEffect(() => {
    // sync when visit changes (but avoid first render double set)
    if (!mountedRef.current) {
      mountedRef.current = true;
      setEditedStructured({ ...initialStructured });
      return;
    }
    setEditedStructured({ ...(visit?.iaData?.structuredDetails || initialStructured) });
  }, [visit?.iaData?.structuredDetails]);

  if (!visit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full">
        <p className="text-gray-500">Visite non trouvée</p>
        <Button onClick={() => setLocation('/dashboard')} className="mt-4">
          Retour au Dashboard
        </Button>
      </div>
    );
  }

  const displayPatient = patient || { id: 'free', name: 'Visite Libre', age: 'N/A' };

  const handleBack = () => {
    if (patient) {
      setLocation(`/patients/${patient.id}/history`);
    } else {
      setLocation('/recordings');
    }
  };

  const handleEditVisit = () => {
    // Activer le mode édition local pour les champs structurés
    setIsEditing(true);
  };

  // Si on est arrivé depuis l'historique avec ?editable=1, permettre l'édition
  // Utiliser URLSearchParams sur window.location.search pour être robuste
  let allowEditFromHistory = false;
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const editable = params.get('editable');
      allowEditFromHistory = editable === '1' || editable === 'true' || location.includes('editable=1') || location.includes('editable=true');
    } else {
      allowEditFromHistory = location.includes('editable=1') || location.includes('editable=true');
    }
  } catch (e) {
    allowEditFromHistory = location.includes('editable=1') || location.includes('editable=true');
  }

  // Si on est sur la route d'un enregistrement non affecté (/recordings/:id), autoriser l'édition aussi
  const isRecordingRoute = Boolean(recordingParams);

  const handleDeleteVisit = async () => {
    const confirmed = await confirm(
      "Êtes-vous sûr de vouloir supprimer cet enregistrement ? Cette action est irréversible.",
      {
        title: "Supprimer la visite",
        variant: "danger",
        confirmText: "Supprimer",
        cancelText: "Annuler"
      }
    );
    
    if (!confirmed) return;
    
    deleteVisit(visit.id);
    toast.success('Visite supprimée avec succès');
    handleBack();
  };

  const handleCancelEdit = () => {
    // Réinitialiser les valeurs éditées depuis la source
    setEditedStructured({ ...(visit?.iaData?.structuredDetails || initialStructured) });
    setIsEditing(false);
    toast.info('Édition annulée');
  };

  const handleSaveEdit = () => {
    // Basic validation
    const douleurVal = Number(editedStructured.douleur) || 0;
    if (isNaN(douleurVal) || douleurVal < 0 || douleurVal > 10) {
      toast.error('La valeur de douleur doit être un nombre entre 0 et 10');
      return;
    }

    const newIAData = {
      summary: visit?.iaData?.summary || '',
      structuredDetails: {
        ...editedStructured,
        douleur: douleurVal,
      },
      transcription: visit?.iaData?.transcription || '',
      riskLevel: visit?.iaData?.riskLevel || '',
      notes: visit?.iaData?.notes,
      audioOriginal: visit?.iaData?.audioOriginal,
      audioSynthesis: visit?.iaData?.audioSynthesis,
    };

    updateVisit(visit.id, { iaData: newIAData });
    setIsEditing(false);
    toast.success('Champs structurés mis à jour');
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <PatientHeader patient={displayPatient as any} onBack={handleBack} />
      
      <div className="p-4 flex-1 pb-4">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Détail de la Visite</h2>
          {visit.validated ? (
            <Pill color="bg-green-100 text-green-700 font-bold flex items-center text-base">
              <CheckCircle size={18} className="mr-1"/> Validée
            </Pill>
          ) : (
            <Pill color="bg-yellow-100 text-yellow-700 font-bold flex items-center text-base">
              <CheckCircle size={18} className="mr-1"/> Brouillon
            </Pill>
          )}
        </div>
        
        {/* Transcription */}
        {visit.iaData?.transcription && (
          <div className="mb-6 p-4 bg-gray-50 rounded-xl shadow-md border-l-4 border-gray-300">
            <h3 className="text-lg font-bold mb-3 flex items-center">
              <FileText size={18} className="mr-2" /> Transcription complète
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-line max-h-48 overflow-y-auto">
              {visit.iaData.transcription}
            </p>
          </div>
        )}

        {/* Résumé IA */}
        {visit.iaData?.summary && (
          <div className="mb-6 p-4 bg-blue-50 rounded-xl shadow-md border-l-4 border-blue-400">
            <h3 className="text-lg font-bold mb-3 text-blue-800">Résumé IA</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{visit.iaData.summary}</p>
          </div>
        )}
        
        {/* Player Audio de la synthèse IA */}
        {visit.iaData?.audioSynthesis && (
          <div className="mb-6 p-4 bg-green-50 rounded-xl shadow-md border-l-4 border-green-500">
            <h3 className="text-lg font-bold mb-3 flex items-center text-green-700">
              <Volume2 size={20} className="mr-2" />
              Synthèse Vocale du Résumé
            </h3>
            <audio 
              controls 
              className="w-full"
              src={`data:audio/mpeg;base64,${visit.iaData.audioSynthesis}`}
            >
              Votre navigateur ne supporte pas la lecture audio.
            </audio>
            <p className="text-xs text-gray-500 mt-2">
              Synthèse vocale générée par l'IA
            </p>
          </div>
        )}
        
        {/* Champs Structurés */}
        {visit.iaData && (
          <div className="mb-6 p-4 bg-white rounded-xl shadow-md grid grid-cols-2 gap-y-3 text-sm">
            <h3 className="col-span-2 text-lg font-bold mb-2">Champs Structurés</h3>

            <p className="text-gray-500">Date</p>
            {isEditing ? (
              <input
                value={editedStructured.date}
                onChange={(e) => setEditedStructured(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
                placeholder="JJ/MM/AAAA"
              />
            ) : (
              <p className="font-medium text-gray-800">{visit.iaData.structuredDetails.date}</p>
            )}

            <p className="text-gray-500">Heure</p>
            {isEditing ? (
              <input
                value={editedStructured.time}
                onChange={(e) => setEditedStructured(prev => ({ ...prev, time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
                placeholder="HH:MM"
              />
            ) : (
              <p className="font-medium text-gray-800">{visit.iaData.structuredDetails.time}</p>
            )}

            <p className="text-gray-500">Type de visite</p>
            {isEditing ? (
              <input
                value={editedStructured.type}
                onChange={(e) => setEditedStructured(prev => ({ ...prev, type: e.target.value }))}
                className="col-span-2 w-full px-3 py-2 border border-gray-200 rounded-md"
                placeholder="Ex: Soins, Contrôle..."
              />
            ) : (
              <p className="font-medium text-gray-800 col-span-2">{visit.iaData.structuredDetails.type}</p>
            )}

            <p className="text-gray-500">Douleur (0-10)</p>
            {isEditing ? (
              <input
                type="number"
                min={0}
                max={10}
                value={String(editedStructured.douleur)}
                onChange={(e) => setEditedStructured(prev => ({ ...prev, douleur: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
              />
            ) : (
              <p className="font-medium text-gray-800">{visit.iaData.structuredDetails.douleur}</p>
            )}

            <p className="text-gray-500">Constantes</p>
            {isEditing ? (
              <Textarea
                value={editedStructured.constantes}
                onChange={(e) => setEditedStructured(prev => ({ ...prev, constantes: e.target.value }))}
                className="col-span-2"
              />
            ) : (
              <p className="font-medium text-gray-800 col-span-2">{visit.iaData.structuredDetails.constantes}</p>
            )}
          </div>
        )}

        {/* Alertes générées */}
        {visit.iaData?.structuredDetails?.alertes && visit.iaData.structuredDetails.alertes.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-200 shadow-md">
            <h3 className="text-lg font-bold text-red-700 flex items-center mb-3">
              <AlertTriangle size={20} className="mr-2" /> 
              Alertes ({visit.iaData.structuredDetails.alertes.length})
            </h3>
            {visit.iaData.structuredDetails.alertes.map((alert) => (
              <div key={alert.id} className="flex justify-between items-center text-sm mb-2">
                <p>• {alert.description}</p>
                <Pill color="bg-yellow-200 text-yellow-800">
                  {alert.level}
                </Pill>
              </div>
            ))}
          </div>
        )}

        {/* Note complémentaire */}
        {visit.iaData?.notes && (
          <div className="mb-6 p-4 bg-gray-50 rounded-xl shadow-md">
            <h3 className="text-lg font-bold mb-2">Notes complémentaires</h3>
            <p className="text-sm text-gray-700">{visit.iaData.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {isEditing ? (
            <div className="flex gap-3">
              <Button className="flex-1 h-12 font-semibold bg-green-600 hover:bg-green-700" onClick={handleSaveEdit}>
                <CheckCircle className="mr-2" size={18} /> Enregistrer
              </Button>
              <Button variant="outline" className="flex-1 h-12" onClick={handleCancelEdit}>
                Annuler
              </Button>
            </div>
          ) : (
            <Button 
              className="w-full h-12 font-semibold"
              onClick={() => setIsEditing(true)}
              // Autoriser l'édition si la visite n'est pas validée, ou si on vient de l'historique,
              // ou si on visualise un enregistrement non affecté (/recordings/:id)
              disabled={visit.validated && !(allowEditFromHistory || isRecordingRoute)}
            >
              {visit.validated ? (
                <><FileText className="mr-2" size={20} /> Modifier le rapport</>
              ) : (
                <><CheckCircle className="mr-2" size={20} /> Reprendre la validation</>
              )}
            </Button>
          )}

          <Button 
            variant="destructive"
            className="w-full h-12 font-semibold"
            onClick={handleDeleteVisit}
          >
            <Trash className="mr-2" size={20} />
            Supprimer l'enregistrement
          </Button>
        </div>
      </div>
    </div>
  );
}
