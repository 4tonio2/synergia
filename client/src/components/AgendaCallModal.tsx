import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Loader2, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AppointmentData {
  person: string;
  date: string;
  docteur?: string;
  phone?: string;
  notes?: string;
}

interface AgendaCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppointmentCreated: (appointment: AppointmentData) => void;
}

export function AgendaCallModal({ isOpen, onClose, onAppointmentCreated }: AgendaCallModalProps) {
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'connected' | 'ended'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<AppointmentData | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Nettoyer les ressources WebRTC
  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  // Démarrer l'appel WebRTC
  const startCall = async () => {
    try {
      setCallState('connecting');

      // Obtenir le flux audio local (micro)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // Créer la connexion WebRTC
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      pcRef.current = pc;

      // Ajouter le flux local
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Gérer le flux distant
      pc.ontrack = (event) => {
        console.log('[WebRTC] Received remote track');
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play();
        }
      };

      // Gérer les candidats ICE
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[WebRTC] ICE candidate:', event.candidate);
          // Envoyer le candidat au serveur Jambonz
          // TODO: Implémenter l'envoi via WebSocket ou API
        }
      };

      // Gérer l'état de connexion
      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallState('connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          endCall();
        }
      };

      // Créer une offre SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Envoyer l'offre au serveur Jambonz pour initier l'appel IVR
      const response = await fetch('/api/ivr/start-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: offer.sdp,
          type: offer.type
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start call');
      }

      const { sdp: answerSdp } = await response.json();

      // Définir la réponse SDP du serveur
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

      setCallState('connected');
    } catch (error) {
      console.error('[WebRTC] Error starting call:', error);
      alert('Erreur lors du démarrage de l\'appel. Vérifiez vos permissions micro.');
      setCallState('idle');
      cleanup();
    }
  };

  // Terminer l'appel
  const endCall = () => {
    setCallState('ended');
    cleanup();

    // Récupérer les données extraites depuis le backend
    fetchExtractedAppointment();
  };

  // Récupérer les données du rendez-vous depuis le webhook
  const fetchExtractedAppointment = async () => {
    try {
      const response = await fetch('/api/ivr/last-appointment');
      if (response.ok) {
        const data = await response.json();
        setExtractedData(data);
        if (data.person && data.date) {
          onAppointmentCreated(data);
        }
      }
    } catch (error) {
      console.error('[IVR] Error fetching appointment:', error);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Nettoyer à la fermeture
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setCallState('idle');
      setTranscript([]);
      setExtractedData(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Prise de rendez-vous téléphonique</DialogTitle>
          <DialogDescription>
            {callState === 'idle' && 'Appelez le service CLAUDIO pour prendre un rendez-vous'}
            {callState === 'connecting' && 'Connexion en cours...'}
            {callState === 'connected' && 'Appel en cours - Parlez maintenant'}
            {callState === 'ended' && 'Appel terminé'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* État de l'appel */}
          <div className="flex flex-col items-center justify-center py-8">
            {callState === 'idle' && (
              <Button
                onClick={startCall}
                size="lg"
                className="h-20 w-20 rounded-full bg-green-600 hover:bg-green-700"
              >
                <Phone className="h-8 w-8" />
              </Button>
            )}

            {callState === 'connecting' && (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600">Connexion au service...</p>
              </div>
            )}

            {callState === 'connected' && (
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center">
                    <Phone className="h-12 w-12 text-green-600 animate-pulse" />
                  </div>
                  <div className="absolute -bottom-2 -right-2">
                    <Button
                      size="sm"
                      variant={isMuted ? "destructive" : "outline"}
                      onClick={toggleMute}
                      className="h-10 w-10 rounded-full"
                    >
                      {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <p className="text-sm font-medium text-green-600">En ligne avec CLAUDIO</p>

                <Button
                  onClick={endCall}
                  size="lg"
                  variant="destructive"
                  className="h-16 w-16 rounded-full"
                >
                  <PhoneOff className="h-8 w-8" />
                </Button>
              </div>
            )}

            {callState === 'ended' && extractedData && (
              <div className="w-full space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold text-green-900">Rendez-vous extrait :</h3>
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium">Patient :</span> {extractedData.person}</p>
                    <p><span className="font-medium">Date :</span> {extractedData.date}</p>
                    {extractedData.docteur && (
                      <p><span className="font-medium">Docteur :</span> {extractedData.docteur}</p>
                    )}
                    {extractedData.notes && (
                      <p className="text-gray-600 mt-2">{extractedData.notes}</p>
                    )}
                  </div>
                </div>
                <Button onClick={onClose} className="w-full">
                  Fermer
                </Button>
              </div>
            )}
          </div>

          {/* Transcription en temps réel */}
          {transcript.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-gray-500 mb-2">Transcription :</p>
              {transcript.map((line, index) => (
                <p key={index} className="text-sm text-gray-700 mb-1">{line}</p>
              ))}
            </div>
          )}
        </div>

        {/* Élément audio pour le flux distant */}
        <audio ref={remoteAudioRef} autoPlay playsInline />
      </DialogContent>
    </Dialog>
  );
}
