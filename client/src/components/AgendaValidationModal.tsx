import React, { useState, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, UserPlus, Calendar, MapPin, Clock, Users, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useCustomToast } from '@/hooks/useToast';

interface AvailabilityCheckResult {
	success: boolean;
	attempts: number;
	start: string;
	stop: string;
	message: string;
}

interface ParticipantMatch {
	input_name: string;
	status: 'matched' | 'unmatched' | 'ambiguous';
	partner_id: number | null;
	matched_name: string | null;
	score: number;
	candidates: Array<{ partner_id: number; name: string; score: number }>;
	needs_contact_creation: boolean;
	proposed_contact: { name: string; email: string | null; phone: string | null };
}

interface AgendaEvent {
	partner_id: number;
	participant_ids: number[];
	start: string;
	stop: string;
	description: string;
	location: string;
	event_id?: number | string;
}

interface AgendaValidationPayload {
	to_validate: boolean;
	intent?: 'create' | 'update' | 'cancel';
	event: AgendaEvent;
	participants: ParticipantMatch[];
	warnings: string[];
	raw_extraction: any;
	event_match?: {
		original_start?: string;
		original_stop?: string;
		keywords?: string[];
		participants?: string[];
	};
	found_event?: any;
}

interface AgendaValidationModalProps {
	isOpen: boolean;
	onClose: () => void;
	payload: AgendaValidationPayload | null;
	onRefreshPayload?: (updatedPayload: AgendaValidationPayload) => void;
}

export function AgendaValidationModal({ isOpen, onClose, payload, onRefreshPayload }: AgendaValidationModalProps) {
	const toast = useCustomToast();
	const [isConfirming, setIsConfirming] = useState(false);
	const [isCreatingContact, setIsCreatingContact] = useState<number | null>(null);
	const [localPayload, setLocalPayload] = useState<AgendaValidationPayload | null>(payload);

	// Availability check state
	const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
	const [availabilityResult, setAvailabilityResult] = useState<AvailabilityCheckResult | null>(null);
	const [showSuggestions, setShowSuggestions] = useState(false);

	// Contact creation form state
	const [contactForm, setContactForm] = useState<{ name: string; email: string; phone: string }>({
		name: '',
		email: '',
		phone: '',
	});
	const [showContactForm, setShowContactForm] = useState<number | null>(null);

	useEffect(() => {
		setLocalPayload(payload);
	}, [payload]);

	if (!isOpen || !localPayload) return null;

	const { event, participants, warnings } = localPayload;

	const matchedCount = participants.filter(p => p.status === 'matched').length;
	const unmatchedCount = participants.filter(p => p.status === 'unmatched').length;
	const ambiguousCount = participants.filter(p => p.status === 'ambiguous').length;

	const handleCreateContact = async (index: number) => {
		const participant = participants[index];
		if (!participant) return;

		setIsCreatingContact(index);

		try {
			const response = await fetch('/api/agenda', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'create-contact',
					name: contactForm.name || participant.proposed_contact.name,
					email: contactForm.email || null,
					phone: contactForm.phone || null,
				}),
			});

			if (!response.ok) {
				throw new Error('Erreur lors de la création du contact');
			}

			const result = await response.json();
			console.log('[AGENDA] Contact created:', result);

			// Update local state - mark participant as matched with new ID
			const newParticipants = [...participants];
			const contactId = result.contact?.id || result.contact?.partner_id;

			if (contactId) {
				newParticipants[index] = {
					...participant,
					status: 'matched',
					partner_id: contactId,
					matched_name: contactForm.name || participant.proposed_contact.name,
					needs_contact_creation: false,
				};

				// Update event participant_ids
				const newEvent = {
					...event,
					participant_ids: [...event.participant_ids, contactId],
				};

				const updatedPayload = {
					...localPayload,
					event: newEvent,
					participants: newParticipants,
				};

				setLocalPayload(updatedPayload);
				onRefreshPayload?.(updatedPayload);
			}

			toast.success(`Contact "${contactForm.name || participant.proposed_contact.name}" créé avec succès`);
			setShowContactForm(null);
			setContactForm({ name: '', email: '', phone: '' });

		} catch (error: any) {
			console.error('[AGENDA] Error creating contact:', error);
			toast.error(error.message || 'Erreur lors de la création du contact');
		} finally {
			setIsCreatingContact(null);
		}
	};

	const handleSelectCandidate = (participantIndex: number, candidate: { partner_id: number; name: string }) => {
		const newParticipants = [...participants];
		newParticipants[participantIndex] = {
			...participants[participantIndex],
			status: 'matched',
			partner_id: candidate.partner_id,
			matched_name: candidate.name,
		};

		const newEvent = {
			...event,
			participant_ids: [...event.participant_ids.filter(id => id !== null), candidate.partner_id],
		};

		const updatedPayload = {
			...localPayload,
			event: newEvent,
			participants: newParticipants,
		};

		setLocalPayload(updatedPayload);
		onRefreshPayload?.(updatedPayload);
	};

	const handleConfirm = async () => {
		// Branch by intent: create (with availability check), update (find + update), cancel (find + delete)
		const intent = localPayload.intent || 'create';

		if (intent === 'create') {
			// First, check availability
			setIsCheckingAvailability(true);
			setAvailabilityResult(null);
			setShowSuggestions(false);

			try {
				// Get all participant IDs (matched ones)
				const contactIds = localPayload.participants
					.filter((p: ParticipantMatch) => p.status === 'matched' && p.partner_id)
					.map((p: ParticipantMatch) => p.partner_id as number);

				// Also include event participant_ids
				const allContactIds = [...new Set([...contactIds, ...localPayload.event.participant_ids])];

				if (allContactIds.length === 0) {
					// No participants to check, proceed directly
					await confirmEvent(false);
					return;
				}

				console.log('[AGENDA] Checking availability for:', {
					contact_ids: allContactIds,
					start: localPayload.event.start,
					stop: localPayload.event.stop
				});

				const response = await fetch('/api/agenda', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'check-availability',
						contact_ids: allContactIds,
						start: localPayload.event.start,
						stop: localPayload.event.stop,
					}),
				});

				if (!response.ok) {
					throw new Error('Erreur lors de la vérification de disponibilité');
				}

				const result: AvailabilityCheckResult = await response.json();
				console.log('[AGENDA] Availability check result:', result);

				const isTimeChanged = result.start !== localPayload.event.start || result.stop !== localPayload.event.stop;

				setAvailabilityResult(result);

				if (result.attempts > 0 || isTimeChanged) {
					setShowSuggestions(true);
					if (result.attempts > 0) {
						toast.warning(`⚠️ ${result.message}`);
					} else {
						toast.info('🕒 Un créneau différent est proposé.');
					}
				} else {
					await confirmEvent(false);
				}
			} catch (error: any) {
				console.error('[AGENDA] Error checking availability:', error);
				toast.error(error.message || 'Erreur lors de la vérification de disponibilité');
				setAvailabilityResult({
					success: false,
					attempts: 0,
					start: localPayload.event.start,
					stop: localPayload.event.stop,
					message: 'Impossible de vérifier la disponibilité',
				});
			} finally {
				setIsCheckingAvailability(false);
			}
			return;
		}

		// For update/cancel: use event_id if available, otherwise find by original_start + participant_ids
		setIsConfirming(true);
		try {
			let eventId: number | string | null = (localPayload.event.event_id as any) ?? (localPayload.found_event?.event_id ?? localPayload.found_event?.id ?? null);
			if (!eventId) {
				const originalStart = localPayload.event_match?.original_start;
				const participantIds = localPayload.event.participant_ids || [];
				if (!originalStart || participantIds.length === 0) {
					throw new Error('Informations insuffisantes pour identifier l\'événement (start ou participants manquants)');
				}

				const findResp = await fetch('/api/agenda', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'find-event',
						original_start: originalStart,
						participant_ids: participantIds,
					}),
				});
				if (!findResp.ok) {
					throw new Error('Erreur lors de l\'identification de l\'événement');
				}
				const findData = await findResp.json();
				eventId = findData?.event_id || findData?.id || null;
			}
			if (!eventId) {
				throw new Error('Événement introuvable');
			}

			if (intent === 'update') {
				const updateResp = await fetch('/api/agenda', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'update-event',
						event_id: eventId,
						name: localPayload.event.description,
						start: localPayload.event.start,
						stop: localPayload.event.stop,
						location: localPayload.event.location,
						description: localPayload.event.description,
					}),
				});
				if (!updateResp.ok) {
					throw new Error('Erreur lors de la mise à jour de l\'événement');
				}
				toast.success('Événement mis à jour avec succès');
				onClose();
				return;
			}

			if (intent === 'cancel') {
				const delResp = await fetch('/api/agenda', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'delete-event', event_id: eventId }),
				});
				if (!delResp.ok) {
					throw new Error('Erreur lors de l\'annulation de l\'événement');
				}
				toast.success('Événement annulé avec succès');
				onClose();
				return;
			}
		} catch (error: any) {
			console.error('[AGENDA] Update/Cancel error:', error);
			toast.error(error.message || 'Erreur lors du traitement de l\'événement');
		} finally {
			setIsConfirming(false);
		}
	};

	const confirmEvent = async (skipAvailabilityCheck: boolean) => {
		setIsConfirming(true);

		try {
			const response = await fetch('/api/agenda', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'confirm',
					event: localPayload.event,
					participants: localPayload.participants,
					skipAvailabilityCheck,
				}),
			});

			if (!response.ok) {
				throw new Error('Erreur lors de la confirmation');
			}

			const result = await response.json();
			console.log('[AGENDA] Event confirmed:', result);

			// Show success popup with summary
			toast.success(
				`✅ Événement créé!\\n📅 ${result.summary?.title || 'Rendez-vous'}\\n🕐 ${result.summary?.start || ''} - ${result.summary?.stop || ''}\\n👥 ${result.summary?.participants || 'Aucun participant'}`
			);

			onClose();

		} catch (error: any) {
			console.error('[AGENDA] Error confirming event:', error);
			toast.error(error.message || 'Erreur lors de la confirmation');
		} finally {
			setIsConfirming(false);
		}
	};

	const handleForceConfirm = async () => {
		// User chose to ignore conflicts and create anyway
		setShowSuggestions(false);
		await confirmEvent(true);
	};

	const handleAcceptProposal = () => {
		if (!availabilityResult) return;

		// Update the event with the suggested time slot
		const updatedEvent = {
			...localPayload.event,
			start: availabilityResult.start,
			stop: availabilityResult.stop,
		};

		const updatedPayload = {
			...localPayload,
			event: updatedEvent,
		};

		setLocalPayload(updatedPayload);
		onRefreshPayload?.(updatedPayload);
		setShowSuggestions(false);
		setAvailabilityResult(null);

		toast.success('📅 Créneau mis à jour. Confirmez pour créer l\'événement.');
	};

	const formatDateTime = (dateStr: string) => {
		if (!dateStr) return 'Non spécifié';
		try {
			const [datePart, timePart] = dateStr.split(' ');
			const [year, month, day] = datePart.split('-');
			const timeFormatted = timePart ? timePart.substring(0, 5) : '';
			return `${day}/${month}/${year} ${timeFormatted}`;
		} catch {
			return dateStr;
		}
	};

	const allMatched = participants.every(p => p.status === 'matched');
	const isUpdate = (localPayload.intent || 'create') === 'update';
	const isCancel = (localPayload.intent || 'create') === 'cancel';

	const originalStartDisplay = localPayload.found_event?.start || localPayload.event_match?.original_start || '';
	const originalStopDisplay = localPayload.found_event?.stop || localPayload.event_match?.original_stop || '';
	const originalDescDisplay = localPayload.found_event?.description || localPayload.found_event?.name || '';
	const originalLocationDisplay = localPayload.found_event?.location || '';

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
			<div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
				{/* Header */}
				<div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
					<div className="flex items-center gap-2">
						<Calendar className="w-5 h-5 text-indigo-600" />
						<h2 className="text-xl font-bold text-gray-800">Valider l'événement</h2>
					</div>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 transition-colors"
					>
						<X className="w-6 h-6" />
					</button>
				</div>

				<div className="px-6 py-4 space-y-4">
					{/* Event Summary with Before/After for update/cancel */}
					<div className="bg-indigo-50 rounded-xl p-4 space-y-2">
						<h3 className="font-semibold text-indigo-800 flex items-center gap-2">
							<Calendar className="w-4 h-4" />
							{isUpdate ? "Modifier l'événement" : isCancel ? "Annuler l'événement" : "Détails de l'événement"}
						</h3>
						{isUpdate || isCancel ? (
							<div className="grid grid-cols-2 gap-3">
								<div className="bg-white rounded-lg border border-indigo-200 p-3">
									<h4 className="text-sm font-semibold text-indigo-700">Avant</h4>
									<div className="mt-1 text-xs text-gray-700 space-y-1">
										<div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span className="font-medium">Début:</span><span>{formatDateTime(originalStartDisplay)}</span></div>
										{originalStopDisplay && <div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span className="font-medium">Fin:</span><span>{formatDateTime(originalStopDisplay)}</span></div>}
										<div className="text-gray-700"><span className="font-medium">Description:</span> {originalDescDisplay || '—'}</div>
										<div className="flex items-center gap-1"><MapPin className="w-3 h-3" /><span className="font-medium">Lieu:</span><span>{originalLocationDisplay || '—'}</span></div>
									</div>
								</div>
								<div className="bg-white rounded-lg border border-green-200 p-3">
									<h4 className="text-sm font-semibold text-green-700">Après</h4>
									<div className="mt-1 text-xs text-gray-700 space-y-1">
										<div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span className="font-medium">Début:</span><span>{formatDateTime(event.start)}</span></div>
										<div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span className="font-medium">Fin:</span><span>{formatDateTime(event.stop)}</span></div>
										<div className="text-gray-700"><span className="font-medium">Description:</span> {event.description || '—'}</div>
										<div className="flex items-center gap-1"><MapPin className="w-3 h-3" /><span className="font-medium">Lieu:</span><span>{event.location || '—'}</span></div>
									</div>
								</div>
							</div>
						) : (
							<div className="space-y-2 text-sm">
								<div className="flex items-center gap-1 text-gray-700">
									<Clock className="w-3 h-3" />
									<span className="font-medium">Début:</span>
									<span>{formatDateTime(event.start)}</span>
								</div>
								<div className="flex items-center gap-1 text-gray-700">
									<Clock className="w-3 h-3" />
									<span className="font-medium">Fin:</span>
									<span>{formatDateTime(event.stop)}</span>
								</div>
								<div className="text-sm text-gray-700">
									<span className="font-medium">Description:</span> {event.description || 'Non spécifiée'}
								</div>
								<div className="flex items-center gap-1 text-sm text-gray-700">
									<MapPin className="w-3 h-3" />
									<span className="font-medium">Lieu:</span>
									<span>{event.location || 'Non spécifié'}</span>
								</div>
							</div>
						)}
					</div>

					{/* Warnings */}
					{warnings.length > 0 && (
						<div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
							<div className="flex items-start gap-2">
								<AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
								<div className="text-sm text-yellow-800">
									{warnings.map((w, i) => (
										<div key={i}>⚠️ {w}</div>
									))}
								</div>
							</div>
						</div>
					)}

					{/* Participants */}
					<div className="space-y-3">
						<h3 className="font-semibold text-gray-800 flex items-center gap-2">
							<Users className="w-4 h-4" />
							Participants ({participants.length})
							{matchedCount > 0 && (
								<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
									{matchedCount} ✓
								</span>
							)}
							{unmatchedCount > 0 && (
								<span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
									{unmatchedCount} à créer
								</span>
							)}
						</h3>

						{participants.length === 0 ? (
							<div className="text-sm text-gray-500 italic">Aucun participant détecté</div>
						) : (
							<div className="space-y-2">
								{participants.map((participant, index) => (
									<div
										key={index}
										className={`border rounded-xl p-3 text-sm ${participant.status === 'matched'
											? 'border-green-200 bg-green-50'
											: participant.status === 'ambiguous'
												? 'border-blue-200 bg-blue-50'
												: 'border-orange-200 bg-orange-50'
											}`}
									>
										<div className="flex justify-between items-start">
											<div>
												<span className="font-medium">
													{participant.input_name}
												</span>
												{participant.status === 'matched' && participant.matched_name && (
													<span className="text-green-600 ml-2">
														✓ {participant.matched_name} (ID: {participant.partner_id})
													</span>
												)}
											</div>
											{participant.status === 'matched' && (
												<Check className="w-4 h-4 text-green-600" />
											)}
										</div>

										{/* Ambiguous - show candidates */}
										{participant.status === 'ambiguous' && participant.candidates.length > 0 && (
											<div className="mt-2 space-y-1">
												<p className="text-xs text-blue-600">Plusieurs correspondances possibles:</p>
												{participant.candidates.map((c, ci) => (
													<button
														key={ci}
														onClick={() => handleSelectCandidate(index, c)}
														className="block w-full text-left px-2 py-1 bg-white border border-blue-200 rounded hover:bg-blue-100 text-xs"
													>
														{c.name} (score: {(c.score * 100).toFixed(0)}%)
													</button>
												))}
											</div>
										)}

										{/* Unmatched - show create form */}
										{participant.status === 'unmatched' && (
											<div className="mt-2">
												{showContactForm === index ? (
													<div className="space-y-2 bg-white p-2 rounded-lg border">
														<Input
															placeholder="Nom"
															value={contactForm.name || participant.proposed_contact.name}
															onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
															className="text-sm h-8"
														/>
														<Input
															placeholder="Email (optionnel)"
															type="email"
															value={contactForm.email}
															onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
															className="text-sm h-8"
														/>
														<Input
															placeholder="Téléphone (optionnel)"
															value={contactForm.phone}
															onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
															className="text-sm h-8"
														/>
														<div className="flex gap-2">
															<Button
																size="sm"
																onClick={() => handleCreateContact(index)}
																disabled={isCreatingContact === index}
																className="flex-1 h-8 text-xs"
															>
																{isCreatingContact === index ? (
																	<Loader2 className="w-3 h-3 animate-spin" />
																) : (
																	<>
																		<UserPlus className="w-3 h-3 mr-1" />
																		Créer
																	</>
																)}
															</Button>
															<Button
																size="sm"
																variant="outline"
																onClick={() => {
																	setShowContactForm(null);
																	setContactForm({ name: '', email: '', phone: '' });
																}}
																className="h-8 text-xs"
															>
																Annuler
															</Button>
														</div>
													</div>
												) : (
													<button
														onClick={() => {
															setContactForm({
																name: participant.proposed_contact.name,
																email: '',
																phone: '',
															});
															setShowContactForm(index);
														}}
														className="flex items-center gap-1 text-xs text-orange-700 hover:text-orange-800 underline"
													>
														<UserPlus className="w-3 h-3" />
														Créer ce contact
													</button>
												)}
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>

					{/* Availability Suggestions Panel */}
					{showSuggestions && availabilityResult && (
						<div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
							<div className="flex items-center gap-2 text-amber-800">
								<RefreshCw className="w-4 h-4" />
								<h4 className="font-semibold">Vérification de disponibilité</h4>
							</div>

							{availabilityResult.attempts > 0 && (
								<p className="text-sm text-red-600 font-medium">
									⚠️ {availabilityResult.message}
								</p>
							)}

							{(availabilityResult.start !== event.start || availabilityResult.stop !== event.stop) ? (
								<div className="space-y-3">
									<p className="text-sm text-amber-700">
										Un autre créneau est disponible :
									</p>
									<div className="flex items-center justify-between bg-white border border-amber-200 rounded-lg p-3">
										<div className="text-sm">
											<span className="font-medium">{formatDateTime(availabilityResult.start)}</span>
											<span className="text-gray-500 mx-2">→</span>
											<span className="font-medium">{formatDateTime(availabilityResult.stop)}</span>
										</div>
										<Button
											size="sm"
											variant="outline"
											onClick={handleAcceptProposal}
											className="text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
										>
											<Check className="w-3 h-3 mr-1" />
											Accepter
										</Button>
									</div>
								</div>
							) : (
								<p className="text-sm text-amber-700">
									Le créneau actuel est indisponible. Veuillez modifier l'heure manuellement ou forcer la création.
								</p>
							)}

							<div className="flex gap-2 pt-2 border-t border-amber-200">
								<Button
									size="sm"
									variant="outline"
									onClick={handleForceConfirm}
									disabled={isConfirming}
									className="flex-1 text-xs text-gray-600 border-gray-300"
								>
									{isConfirming ? (
										<Loader2 className="w-3 h-3 mr-1 animate-spin" />
									) : (
										<AlertCircle className="w-3 h-3 mr-1" />
									)}
									Forcer la création
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setShowSuggestions(false)}
									className="text-xs"
								>
									Annuler
								</Button>
							</div>
						</div>
					)}

					{/* Actions */}
					<div className="flex gap-3 pt-2">
						<Button
							onClick={handleConfirm}
							disabled={isConfirming || (localPayload.intent !== 'create' ? false : (isCheckingAvailability || showSuggestions))}
							className="flex-1 bg-indigo-600 hover:bg-indigo-700"
						>
							{localPayload.intent === 'create' && isCheckingAvailability ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Vérification...
								</>
							) : isConfirming ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									{isUpdate ? 'Mise à jour...' : isCancel ? 'Annulation...' : 'Création...'}
								</>
							) : (
								<>
									<Check className="w-4 h-4 mr-2" />
									{isUpdate ? 'Confirmer la mise à jour' : isCancel ? 'Confirmer l\'annulation' : 'Confirmer'}
								</>
							)}
						</Button>
						<Button
							onClick={onClose}
							variant="outline"
							className="flex-1"
						>
							Annuler
						</Button>
					</div>

					{!allMatched && localPayload.intent === 'create' && (
						<p className="text-xs text-gray-500 text-center">
							💡 Vous pouvez confirmer même si certains participants ne sont pas encore matchés
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
