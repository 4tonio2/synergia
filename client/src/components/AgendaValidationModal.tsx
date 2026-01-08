import React, { useState, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, UserPlus, Calendar, MapPin, Clock, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useCustomToast } from '@/hooks/useToast';

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
}

interface AgendaValidationPayload {
    to_validate: boolean;
    event: AgendaEvent;
    participants: ParticipantMatch[];
    warnings: string[];
    raw_extraction: any;
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
            const response = await fetch('/api/agenda/create-contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
        setIsConfirming(true);

        try {
            const response = await fetch('/api/agenda/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: localPayload.event,
                    participants: localPayload.participants,
                }),
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la confirmation');
            }

            const result = await response.json();
            console.log('[AGENDA] Event confirmed:', result);

            // Show success popup with summary
            toast.success(
                `✅ Événement préparé!\n📅 ${result.summary?.title || 'Rendez-vous'}\n🕐 ${result.summary?.start || ''} - ${result.summary?.stop || ''}\n👥 ${result.summary?.participants || 'Aucun participant'}`
            );

            onClose();

        } catch (error: any) {
            console.error('[AGENDA] Error confirming event:', error);
            toast.error(error.message || 'Erreur lors de la confirmation');
        } finally {
            setIsConfirming(false);
        }
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
                    {/* Event Summary */}
                    <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                        <h3 className="font-semibold text-indigo-800 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Détails de l'événement
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
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

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            onClick={handleConfirm}
                            disabled={isConfirming}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                        >
                            {isConfirming ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Confirmation...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Confirmer
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

                    {!allMatched && (
                        <p className="text-xs text-gray-500 text-center">
                            💡 Vous pouvez confirmer même si certains participants ne sont pas encore matchés
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
