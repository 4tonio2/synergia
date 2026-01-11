import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, Sparkles, Send, Zap, Loader2, Search, Pencil, Check, X, Mic, Square, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { PhotoUploader } from '@/components/PhotoUploader';
import { TransmissionModal, ActionsRapidesModal } from '@/components/Modal';
import { AgendaValidationModal } from '@/components/AgendaValidationModal';
import { useAppStore } from '@/lib/appStore';
import { useCustomToast } from '@/hooks/useToast';
import { PrescriptionsResponse, ObservationsResponse } from '@/types/webhook-responses';
import { PrescriptionsDisplay } from '@/components/PrescriptionsDisplay';
import { ObservationsDisplay } from '@/components/ObservationsDisplay';

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

	const { getPatientById, addVisit, updateVisit, addRendezVous } = useAppStore();
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
	const [actionsSuggestions, setActionsSuggestions] = useState<any | null>(null);
	const [isPreparingActions, setIsPreparingActions] = useState(false);
	const [contactsResults, setContactsResults] = useState<any[]>([]);
	const [clientFacture, setClientFacture] = useState<any | null>(null);
	const [products, setProducts] = useState<any[]>([]);
	const [rendezVous, setRendezVous] = useState<any[]>([]);

	// État pour Agenda
	const [isPreparingAgenda, setIsPreparingAgenda] = useState(false);
	const [showAgendaModal, setShowAgendaModal] = useState(false);
	const [agendaPayload, setAgendaPayload] = useState<any | null>(null);

	// État pour l'édition des contacts
	const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
	const [editingContactData, setEditingContactData] = useState<Record<string, string>>({});
	// Dernier contact retiré (pour permettre un undo temporaire)
	const [lastRemovedContact, setLastRemovedContact] = useState<{ contact: any; index: number } | null>(null);
	const removalTimerRef = useRef<number | null>(null);

	// États pour l'enregistrement vocal
	const [isRecording, setIsRecording] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [recordingType, setRecordingType] = useState<'agenda' | 'prescription' | 'observation' | null>(null);
	const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
	const chunksRef = React.useRef<Blob[]>([]);
	const recordingTypeRef = React.useRef<'agenda' | 'prescription' | 'observation' | null>(null);

	// États pour les résultats des webhooks
	const [prescriptionsResults, setPrescriptionsResults] = useState<PrescriptionsResponse | null>(null);
	const [observationsResults, setObservationsResults] = useState<ObservationsResponse | null>(null);
	const [isLoadingWebhook, setIsLoadingWebhook] = useState(false);

	// DEBUG: Tracer les changements d'état
	useEffect(() => {
		console.log('[DEBUG] prescriptionsResults changé:', prescriptionsResults);
	}, [prescriptionsResults]);

	useEffect(() => {
		console.log('[DEBUG] observationsResults changé:', observationsResults);
	}, [observationsResults]);

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

	const startRecording = async (type: 'agenda' | 'prescription' | 'observation') => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus'
			});

			mediaRecorderRef.current = mediaRecorder;
			chunksRef.current = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					chunksRef.current.push(event.data);
				}
			};

			mediaRecorder.onstop = async () => {
				stream.getTracks().forEach(track => track.stop());

				setIsProcessing(true);

				// Utiliser la ref pour obtenir le type d'enregistrement
				const currentRecordingType = recordingTypeRef.current;
				const existingText = formData.notesRaw;

				console.log('[VOICE] Type d\'enregistrement capturé:', currentRecordingType);

				try {
					const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
					const uploadFormData = new FormData();
					uploadFormData.append('audio', audioBlob, 'recording.webm');

					const response = await fetch('/api/voice?action=transcribe', {
						method: 'POST',
						body: uploadFormData
					});

					if (!response.ok) {
						const error = await response.json();
						throw new Error(error.error || 'Erreur de transcription');
					}

					let { text } = await response.json();

					// Nettoyer le texte de la transcription (enlever les artefacts)
					text = text
						.replace(/❤️\s*par\s+SousTitreur\.com/gi, '')  // Enlever "❤️ par SousTitreur.com"
						.replace(/Sous-titré\s+par\s+.+?\.com/gi, '')   // Enlever "Sous-titré par ..."
						.replace(/\[BLANC\]/gi, '')                      // Enlever [BLANC]
						.replace(/\[Musique\]/gi, '')                    // Enlever [Musique]
						.replace(/\[Applaudissements\]/gi, '')           // Enlever [Applaudissements]
						.trim();

					// Traitement spécifique selon le type
					if (currentRecordingType === 'agenda') {
						// Pour l'agenda: ne pas ajouter de préfixe, et CONCATÉNER la transcription aux notes existantes
						console.log('[AGENDA] Transcription reçue:', text);
						setFormData(prev => ({
							...prev,
							notesRaw: (prev.notesRaw || '') + text
						}));

						// Lancer la préparation de l'agenda
						setIsPreparingAgenda(true);
						// Ouvrir la modale immédiatement avec un payload de chargement
						setAgendaPayload({
							to_validate: true,
							intent: 'create',
							event: {
								partner_id: 3,
								participant_ids: [],
								start: '',
								stop: '',
								name: 'Préparation de l\'événement...',
								description: '',
								location: '',
							},
							participants: [],
							warnings: [],
							raw_extraction: null,
							loading: true,
						});
						setShowAgendaModal(true);

						try {
							const resp = await fetch('/api/agenda', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								// Envoyer le texte COMPLET (notes existantes + transcription agenda)
								body: JSON.stringify({ action: 'prepare', text: existingText + text })
							});
							if (!resp.ok) {
								throw new Error('Erreur lors de la préparation de l\'agenda');
							}
							const payload = await resp.json();
							setAgendaPayload({ ...payload, loading: false });
						} catch (err: any) {
							console.error('[AGENDA] Erreur:', err);
							toast.error(err.message || 'Erreur Agenda');
						} finally {
							setIsPreparingAgenda(false);
						}

					} else {
						// Autres types: concaténer aux notes
						// Ajouter un préfixe selon le type
						let prefix = '';
						// if (currentRecordingType === 'crm') prefix = '[CRM] '; // Removed
						if (currentRecordingType === 'prescription') prefix = '[PRESCRIPTION] ';
						if (currentRecordingType === 'observation') prefix = '[OBSERVATION] ';

						handleTranscription(prefix + text, audioBlob);

						// Créer le texte complet pour le webhook (existant + nouveau)
						const fullText = existingText + prefix + text;

						// Webhooks
						if (currentRecordingType === 'prescription') {
							// ... existing preservation logic ...
							setIsLoadingWebhook(true);
							try {
								console.log('[WEBHOOK] Envoi vers webhook prescriptions avec le texte complet:', fullText);
								const webhookResponse = await fetch('https://treeporteur-n8n.fr/webhook/prescriptions-v1', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ raw_text: fullText })
								});

								if (webhookResponse.ok) {
									const data: PrescriptionsResponse = await webhookResponse.json();
									setPrescriptionsResults(data);
									toast.success('Prescriptions analysées avec succès !');
								} else {
									throw new Error('Erreur lors de l\'analyse des prescriptions');
								}
							} catch (webhookError) {
								console.error('[WEBHOOK] Erreur prescriptions:', webhookError);
								toast.error('Erreur lors de l\'analyse des prescriptions');
							} finally {
								setIsLoadingWebhook(false);
							}
						} else if (currentRecordingType === 'observation') {
							setIsLoadingWebhook(true);
							try {
								console.log('[WEBHOOK] Envoi vers webhook observations avec le texte complet:', fullText);
								const webhookResponse = await fetch('https://treeporteur-n8n.fr/webhook/search-observations-v1', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ raw_text: fullText })
								});

								if (webhookResponse.ok) {
									const data: ObservationsResponse = await webhookResponse.json();
									setObservationsResults(data);
									toast.success('Observations analysées avec succès !');
								} else {
									throw new Error('Erreur lors de l\'analyse des observations');
								}
							} catch (webhookError) {
								console.error('[WEBHOOK] Erreur observations:', webhookError);
								toast.error('Erreur lors de l\'analyse des observations');
							} finally {
								setIsLoadingWebhook(false);
							}
						}
					}

					setIsProcessing(false);
					setRecordingType(null);
					recordingTypeRef.current = null;  // Réinitialiser la ref

				} catch (error) {
					console.error('[VOICE] Erreur de transcription:', error);
					toast.error('Erreur lors de la transcription. Veuillez réessayer.');
					setIsProcessing(false);
					setRecordingType(null);
					recordingTypeRef.current = null;  // Réinitialiser la ref en cas d'erreur
				}
			};

			mediaRecorder.start();
			setIsRecording(true);
			setRecordingType(type);
			recordingTypeRef.current = type;  // Stocker dans la ref pour la closure

			console.log('[VOICE] Enregistrement démarré, type:', type);

		} catch (error) {
			console.error('Erreur d\'accès au microphone:', error);
			toast.error('Impossible d\'accéder au microphone. Vérifiez les permissions.');
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}
	};

	const handleGenerateSummary = async () => {
		setIsGeneratingSummary(true);

		try {
			// 1. Générer le TTS de la transcription complète (toutes les notes)
			let audioOriginal = undefined;
			if (formData.notesRaw && formData.notesRaw.trim().length > 0) {
				console.log('[TTS] Génération audio de la transcription complète...');
				const ttsTranscriptionResponse = await fetch('/api/voice?action=synthesize', {
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
			const response = await fetch('/api/ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'summary',
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
			const ttsResponse = await fetch('/api/voice?action=synthesize', {
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
			const response = await fetch('/api/ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'transmission',
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
			const response = await fetch('/api/contacts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'search', text: formData.notesRaw }),
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

	// Retirer un contact de la vue (non-destructif côté serveur)
	const handleRemoveContact = (index: number) => {
		const toRemove = contactsResults[index];
		if (!toRemove) return;

		// Petite confirmation pour éviter les clics accidentels
		if (!window.confirm('Retirer ce contact de la vue ? (action non destructive, vous pouvez annuler)')) {
			return;
		}

		setContactsResults(prev => prev.filter((_, i) => i !== index));
		setLastRemovedContact({ contact: toRemove, index });
		toast.success('Contact retiré de la vue');

		// Nettoyage automatique du banner d'annulation après 8s
		if (removalTimerRef.current) {
			window.clearTimeout(removalTimerRef.current);
		}
		removalTimerRef.current = window.setTimeout(() => {
			setLastRemovedContact(null);
			removalTimerRef.current = null;
		}, 8000) as unknown as number;
	};

	const handleUndoRemove = () => {
		if (!lastRemovedContact) return;
		setContactsResults(prev => {
			const newArr = [...prev];
			// Réinsérer à l'index d'origine (ou à la fin si l'index est trop grand)
			const insertIndex = Math.min(Math.max(0, lastRemovedContact.index), newArr.length);
			newArr.splice(insertIndex, 0, lastRemovedContact.contact);
			return newArr;
		});
		setLastRemovedContact(null);
		if (removalTimerRef.current) {
			window.clearTimeout(removalTimerRef.current);
			removalTimerRef.current = null;
		}
		toast.success('Contact rétabli');
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
			const response = await fetch('/api/contacts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'upsert',
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
					const ttsResponse = await fetch('/api/voice?action=synthesize', {
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
								{/* Bouton Agenda (remplace CRM) - Bleu */}
								<div className="flex flex-col items-center">
									<button
										onClick={() => isRecording && recordingType === 'agenda' ? stopRecording() : !isRecording && startRecording('agenda')}
										disabled={isProcessing || (isRecording && recordingType !== 'agenda')}
										className={`w-full py-3 px-4 text-white font-semibold rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${isRecording && recordingType === 'agenda'
											? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
											: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:scale-105 active:scale-95'
											} ${(isProcessing || (isRecording && recordingType !== 'agenda')) && 'opacity-50 cursor-not-allowed'}`}
									>
										{isRecording && recordingType === 'agenda' ? (
											<><Square className="w-4 h-4" /> Stop</>
										) : (
											<><Calendar className="w-4 h-4" /> Agenda</>
										)}
									</button>
								</div>

								{/* Bouton Prescription - Orange */}
								<div className="flex flex-col items-center">
									<button
										onClick={() => isRecording && recordingType === 'prescription' ? stopRecording() : !isRecording && startRecording('prescription')}
										disabled={isProcessing || (isRecording && recordingType !== 'prescription')}
										className={`w-full py-3 px-4 text-white font-semibold rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${isRecording && recordingType === 'prescription'
											? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
											: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:scale-105 active:scale-95'
											} ${(isProcessing || (isRecording && recordingType !== 'prescription')) && 'opacity-50 cursor-not-allowed'}`}
									>
										{isRecording && recordingType === 'prescription' ? (
											<><Square className="w-4 h-4" /> Stop</>
										) : (
											<><Mic className="w-4 h-4" /> Presc.</>
										)}
									</button>
								</div>

								{/* Bouton Observation - Rouge */}
								<div className="flex flex-col items-center">
									<button
										onClick={() => isRecording && recordingType === 'observation' ? stopRecording() : !isRecording && startRecording('observation')}
										disabled={isProcessing || (isRecording && recordingType !== 'observation')}
										className={`w-full py-3 px-4 text-white font-semibold rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${isRecording && recordingType === 'observation'
											? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
											: 'bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 hover:scale-105 active:scale-95'
											} ${(isProcessing || (isRecording && recordingType !== 'observation')) && 'opacity-50 cursor-not-allowed'}`}
									>
										{isRecording && recordingType === 'observation' ? (
											<><Square className="w-4 h-4" /> Stop</>
										) : (
											<><Mic className="w-4 h-4" /> Obs.</>
										)}
									</button>
								</div>
							</div>

							{/* Messages d'état */}
							{isRecording && (
								<p className="text-sm text-red-600 font-medium animate-pulse">
									🔴 Enregistrement en cours...
								</p>
							)}
							{isProcessing && (
								<p className="text-sm text-blue-600 font-medium flex items-center gap-2">
									<Loader2 className="w-4 h-4 animate-spin" />
									Transcription en cours...
								</p>
							)}
							{isLoadingWebhook && (
								<p className="text-sm text-purple-600 font-medium flex items-center gap-2">
									<Loader2 className="w-4 h-4 animate-spin" />
									Analyse en cours...
								</p>
							)}
						</div>
					</div>

					{/* Résultats des prescriptions */}
					{prescriptionsResults && (
						<div className="bg-orange-50 rounded-2xl shadow-sm p-4 border-l-4 border-orange-400">
							<h3 className="text-sm font-semibold text-orange-800 mb-3">Résultats des Prescriptions</h3>
							<PrescriptionsDisplay
								data={prescriptionsResults}
								onValidate={(prescriptionId, matchId) => {
									console.log('Prescription validée:', prescriptionId, matchId);
								}}
							/>
						</div>
					)}

					{/* Résultats des observations */}
					{observationsResults && (
						<div className="bg-red-50 rounded-2xl shadow-sm p-4 border-l-4 border-red-400">
							<h3 className="text-sm font-semibold text-red-800 mb-3">Résultats des Observations</h3>
							<ObservationsDisplay
								data={observationsResults}
								onValidate={(observationId, matchId) => {
									console.log('Observation validée:', observationId, matchId);
								}}
							/>
						</div>
					)}

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
							onClick={async () => {
								setIsPreparingActions(true);
								// Prepare suggestions from notes before opening modal
								if (formData.notesRaw && formData.notesRaw.trim()) {
									try {
										const resp = await fetch('/api/contacts', {
											method: 'POST',
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify({ action: 'search', text: formData.notesRaw })
										});
										if (resp.ok) {
											const data = await resp.json();
											const persons = Array.isArray(data.persons) ? data.persons : [];
											const rdvs = Array.isArray(data.rendez_vous) ? data.rendez_vous : [];

											const sugg: any = {};

											// Prefer structured RDV if present
											if (rdvs.length) {
												const r = rdvs[0];
												// map common fields
												sugg.title = r.description || r.title || '';
												sugg.date = r.date || r.jour || '';
												sugg.time = r.heure || r.time || r.hour || '';
												sugg.notes = r.description || '';
											}

											if (persons.length) {
												const p = persons[0];
												sugg.person = p.nom_complet || p.name || '';
												sugg.email = p.email || p.mail || '';
											}

											// Lightweight heuristic: infer type from raw notes if not present
											if (!sugg.title) {
												const raw = formData.notesRaw.toLowerCase();
												if (/panseme?n?t|pansement|panser/i.test(raw)) sugg.title = 'Pansement';
												else if (/contr[oô]le|suivi/i.test(raw)) sugg.title = 'Visite de contrôle';
												else if (/consult/i.test(raw)) sugg.title = 'Consultation';
											}

											// Normalize date/time to HTML inputs if possible
											const normalizeDate = (d: string) => {
												if (!d) return '';
												// try ISO parse
												const parsed = Date.parse(d);
												if (!isNaN(parsed)) {
													const dt = new Date(parsed);
													const yyyy = dt.getFullYear();
													const mm = String(dt.getMonth() + 1).padStart(2, '0');
													const dd = String(dt.getDate()).padStart(2, '0');
													return `${yyyy}-${mm}-${dd}`;
												}
												// french month names
												const months: Record<string, number> = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
												const m = d.toLowerCase().match(/(\d{1,2})\s*(?:er)?\s*(?:de)?\s*([a-zéûô]+)\s*(\d{4})?/i);
												if (m) {
													const day = Number(m[1]);
													const monthName = m[2].toLowerCase();
													const year = m[3] ? Number(m[3]) : (new Date()).getFullYear();
													const monthNum = months[monthName] || NaN;
													if (!isNaN(monthNum)) {
														const yyyy = year;
														const mm = String(monthNum).padStart(2, '0');
														const dd = String(day).padStart(2, '0');
														return `${yyyy}-${mm}-${dd}`;
													}
												}
												// fallback: dd/mm/yyyy
												const m2 = d.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
												if (m2) {
													const day = String(Number(m2[1])).padStart(2, '0');
													const month = String(Number(m2[2])).padStart(2, '0');
													const year = m2[3] ? (m2[3].length === 2 ? `20${m2[3]}` : m2[3]) : String(new Date().getFullYear());
													return `${year}-${month}-${day}`;
												}
												return '';
											};

											const normalizeTime = (t: string) => {
												if (!t) return '';
												const m = t.match(/(\d{1,2})(?:[:hH\s](\d{2}))?/);
												if (m) {
													const hh = String(Number(m[1])).padStart(2, '0');
													const mm = m[2] ? String(Number(m[2])).padStart(2, '0') : '00';
													return `${hh}:${mm}`;
												}
												return '';
											};

											if (sugg.date) sugg.date = normalizeDate(sugg.date);
											if (sugg.time) sugg.time = normalizeTime(sugg.time);

											setActionsSuggestions(sugg);
										}
									} catch (error) {
										console.error('Erreur extraction suggestions:', error);
										setActionsSuggestions(null);
									}
								} else {
									setActionsSuggestions(null);
								}

								setShowActionsModal(true);
								setIsPreparingActions(false);
							}}
							variant="outline"
							className="w-full h-12 rounded-full"
							disabled={isPreparingActions}
						>
							{isPreparingActions ? (
								<>
									<Loader2 className="w-5 h-5 mr-2 animate-spin" />
									Préparation...
								</>
							) : (
								<>
									<Zap className="w-5 h-5 mr-2" />
									Actions rapides...
								</>
							)}
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
							<div className={`border rounded-xl p-3 text-sm ${clientFacture.reconnu ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
								}`}>
								<div className="flex justify-between items-start mb-2">
									<p className={`font-semibold ${clientFacture.reconnu ? 'text-green-800' : 'text-orange-800'
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
								{lastRemovedContact && (
									<div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-1 flex items-center justify-between">
										<div className="text-sm text-yellow-800">Contact retiré de la vue</div>
										<div className="flex items-center gap-2">
											<button
												onClick={handleUndoRemove}
												className="text-sm px-3 py-1 bg-white border border-yellow-200 rounded-md text-yellow-800"
											>
												Annuler
											</button>
											<button
												onClick={() => setLastRemovedContact(null)}
												className="text-sm px-3 py-1 bg-transparent text-gray-600"
											>
												Fermer
											</button>
										</div>
									</div>
								)}

								{contactsResults.map((person, index) => {
									const isEditing = editingContactIndex === index;
									const reconnu = person.reconnu === true;

									// Mode édition
									if (isEditing) {
										return (
											<div
												key={index}
												className={`border rounded-xl p-3 text-sm ${reconnu ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'
													}`}
											>
												<div className="flex justify-between items-center mb-3">
													<p className={`font-semibold ${reconnu ? 'text-blue-800' : 'text-orange-800'
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
											className={`border rounded-xl p-3 text-sm ${reconnu ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
												}`}
										>
											<div className="flex justify-between items-start mb-2">
												<p className={`font-semibold ${reconnu ? 'text-green-800' : 'text-orange-800'
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

													{/* Bouton Retirer (UI only) */}
													<button
														onClick={() => handleRemoveContact(index)}
														className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg"
														title="Retirer de la vue"
													>
														<X className="w-4 h-4" />
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

			{/* Prepare suggestions from extracted rendez-vous or contacts */}
			{(() => {
				// Prefer explicit extracted rendez-vous
				const rdvSuggestion = Array.isArray(rendezVous) && rendezVous.length > 0 ? rendezVous[0] : null;
				const contactSuggestion = Array.isArray(contactsResults) && contactsResults.length > 0 ? contactsResults[0] : null;

				const suggestions: any = {
					notes: formData.notesRaw || ''
				};

				if (rdvSuggestion) {
					suggestions.title = rdvSuggestion.description || rdvSuggestion.title || 'Visite de contrôle';
					suggestions.person = rdvSuggestion.person || rdvSuggestion.nom || rdvSuggestion.nom_complet || '';
					suggestions.email = rdvSuggestion.email || '';
					suggestions.date = rdvSuggestion.date || rdvSuggestion.date_rdv || '';
					suggestions.time = rdvSuggestion.heure || rdvSuggestion.time || '';
					suggestions.durationMinutes = rdvSuggestion.durationMinutes || rdvSuggestion.duree || '';
					suggestions.location = rdvSuggestion.location || rdvSuggestion.lieu || '';
				} else if (contactSuggestion) {
					suggestions.person = contactSuggestion.nom_complet || contactSuggestion.name || '';
					suggestions.email = contactSuggestion.email || '';
				} else {
					// try to find an email inside notes as fallback
					const emailMatch = (formData.notesRaw || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
					if (emailMatch) suggestions.email = emailMatch[0];
				}

				return (
					<ActionsRapidesModal
						isOpen={showActionsModal}
						onClose={() => setShowActionsModal(false)}
						onCreateRdv={async (rdv) => {
							// Persist RDV to global store and keep local list for immediate UI
							try {
								addRendezVous(rdv);
							} catch (e) {
								console.warn('addRendezVous failed', e);
							}
							setRendezVous(prev => [rdv, ...prev]);

							// If an email is provided, try to send a confirmation
							if (rdv.email) {
								toast.info('Envoi du mail de confirmation…');
								try {
									// Get Supabase session token to authorize the server endpoint
									const sessionResp = await fetch('/api/auth?action=user', { method: 'GET' });
									// Try to get access token from Supabase client if available
									let accessToken: string | null = null;
									try {
										// dynamic import of supabase client to avoid top-level import noise
										const { supabase } = await import('@/lib/supabase');
										const { data } = await supabase.auth.getSession();
										accessToken = data.session?.access_token ?? null;
									} catch (e) {
										console.warn('Impossible de récupérer le token Supabase localement:', e);
									}

									const headers: Record<string, string> = { 'Content-Type': 'application/json' };
									if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

									const resp = await fetch('/api/notifications/send-email', {
										method: 'POST',
										headers,
										body: JSON.stringify({
											to: rdv.email,
											subject: `Confirmation de rendez-vous — ${rdv.title}`,
											text: `Bonjour ${rdv.person || ''},\n\nVotre rendez-vous "${rdv.title}" est programmé le ${rdv.date} à ${rdv.time}.\nLieu: ${rdv.location || 'À préciser'}.\nDurée: ${rdv.durationMinutes} minutes.\n\nNotes: ${rdv.notes || '-'}\n\nCordialement,\nL'équipe`,
											html: `<p>Bonjour ${rdv.person || ''},</p><p>Votre rendez-vous "<strong>${rdv.title}</strong>" est programmé le <strong>${rdv.date}</strong> à <strong>${rdv.time}</strong>.</p><p><strong>Lieu:</strong> ${rdv.location || 'À préciser'}<br/><strong>Durée:</strong> ${rdv.durationMinutes} minutes</p><p><strong>Notes:</strong> ${rdv.notes || '-'}</p><p>Cordialement,<br/>L'équipe</p>`
										})
									});

									if (resp.ok) {
										const json = await resp.json().catch(() => ({}));
										toast.success('Email de confirmation envoyé');
										console.log('Send-email response:', json);
									} else {
										const err = await resp.json().catch(() => ({}));
										toast.error('Impossible d\'envoyer l\'email de confirmation');
										console.error('Send-email failed', resp.status, err);
									}
								} catch (error) {
									toast.error('Erreur lors de l\'envoi de l\'email');
									console.error('Error sending confirmation email:', error);
								}
							}
							// already shown toasts above for email; show general success for RDV
							toast.success('Rendez-vous programmé');
						}}
						patientName={formData.patientName}
						patientId={formData.patientId}
						suggestions={actionsSuggestions || suggestions}
					/>
				);
			})()}
			{/* Agenda Validation Modal */}
			<AgendaValidationModal
				isOpen={showAgendaModal}
				onClose={() => setShowAgendaModal(false)}
				payload={agendaPayload}
				onRefreshPayload={(updated) => setAgendaPayload(updated)}
			/>
		</div>
	);
}
