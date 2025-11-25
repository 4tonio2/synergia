import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useCustomToast } from '@/hooks/useToast';

interface VoiceRecorderButtonProps {
  onTranscription: (text: string, audioBlob?: Blob) => void;
  isDisabled?: boolean;
}

/**
 * Composant d'enregistrement vocal pour la dictée de notes.
 * 
 * TODO - INTÉGRATION WEBRTC + OPENAI REALTIME AUDIO:
 * 
 * 1. WEBRTC STREAMING:
 *    - Remplacer navigator.mediaDevices.getUserMedia par un WebRTC RTCPeerConnection
 *    - Envoyer le flux audio en temps réel vers le serveur
 *    - Gérer la latence et la compression audio
 * 
 * 2. OPENAI REALTIME AUDIO API:
 *    - Endpoint: POST /api/voice/transcribe
 *    - Utiliser OpenAI Whisper API pour STT (Speech-to-Text)
 *    - Format audio recommandé: webm/opus ou mp3
 *    - Streaming en chunks pour transcription en temps réel
 * 
 * 3. EXEMPLE D'INTÉGRATION:
 *    ```typescript
 *    const mediaRecorder = new MediaRecorder(stream, {
 *      mimeType: 'audio/webm;codecs=opus'
 *    });
 *    
 *    mediaRecorder.ondataavailable = async (event) => {
 *      const formData = new FormData();
 *      formData.append('audio', event.data, 'recording.webm');
 *      
 *      const response = await fetch('/api/voice/transcribe', {
 *        method: 'POST',
 *        body: formData
 *      });
 *      
 *      const { transcription } = await response.json();
 *      onTranscription(transcription);
 *    };
 *    ```
 * 
 * 4. BACKEND (server/routes.ts):
 *    - Installer: npm install openai formidable
 *    - Utiliser formidable pour parser le multipart/form-data
 *    - Appeler OpenAI Whisper:
 *    ```typescript
 *    import OpenAI from 'openai';
 *    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *    
 *    const transcription = await openai.audio.transcriptions.create({
 *      file: audioFile,
 *      model: 'whisper-1',
 *      language: 'fr'
 *    });
 *    ```
 */
export function VoiceRecorderButton({ onTranscription, isDisabled = false }: VoiceRecorderButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const toast = useCustomToast();

  const startRecording = async () => {
    try {
      // Demander l'accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Créer le MediaRecorder
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
        // Arrêter tous les tracks du stream
        stream.getTracks().forEach(track => track.stop());
        
        // Envoyer l'audio vers OpenAI Whisper
        setIsProcessing(true);
        
        try {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          
          console.log('[VOICE] Envoi de l\'audio vers Whisper...', {
            size: audioBlob.size,
            type: audioBlob.type
          });
          
          const response = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erreur de transcription');
          }
          
          const { text } = await response.json();
          console.log('[VOICE] Transcription reçue:', text);
          
          // Passer à la fois le texte ET le blob audio original
          onTranscription(text, audioBlob);
          setIsProcessing(false);
          
        } catch (error) {
          console.error('[VOICE] Erreur de transcription:', error);
          toast.error('Erreur lors de la transcription. Veuillez réessayer.');
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      
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

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        disabled={isDisabled || isProcessing}
        className={`
          w-16 h-16 rounded-full flex items-center justify-center
          transition-all duration-300 shadow-lg
          ${isRecording 
            ? 'bg-red-500' 
            : 'bg-blue-600 hover:bg-blue-700'
          }
          ${(isDisabled || isProcessing) && 'opacity-50 cursor-not-allowed'}
        `}
      >
        {isProcessing ? (
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        ) : isRecording ? (
          <Square className="w-7 h-7 text-white" />
        ) : (
          <Mic className="w-7 h-7 text-white" />
        )}
      </button>
      
      {isRecording && (
        <p className="text-sm text-red-600 font-medium">
          Enregistrement en cours...
        </p>
      )}
      
      {isProcessing && (
        <p className="text-sm text-blue-600 font-medium">
          Transcription en cours...
        </p>
      )}
    </div>
  );
}
