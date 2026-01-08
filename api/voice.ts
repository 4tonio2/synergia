import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient, handleCorsOptions } from './_helpers';
// @ts-ignore - busboy types not installed
import Busboy from 'busboy';
import { Readable } from 'stream';

// Disable body parser for file uploads
export const config = {
    api: {
        bodyParser: false,
    },
};

// ============================================================
// Action Handlers
// ============================================================

async function handleTranscribe(req: VercelRequest, res: VercelResponse) {
    const openai = getOpenAIClient();

    // Parse multipart/form-data with busboy
    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        let fileBuffer: Buffer | null = null;

        busboy.on('file', (_fieldname: string, file: NodeJS.ReadableStream, _info: { filename: string; encoding: string; mimeType: string }) => {
            const chunks: Buffer[] = [];

            file.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            file.on('end', () => {
                fileBuffer = Buffer.concat(chunks);
            });
        });

        busboy.on('finish', () => {
            if (!fileBuffer) {
                reject(new Error('No file uploaded'));
            } else {
                resolve(fileBuffer);
            }
        });

        busboy.on('error', (error: Error) => {
            reject(error);
        });

        // Convert Vercel request to stream and pipe to busboy
        if (req.body) {
            const stream = Readable.from(Buffer.from(req.body as any));
            stream.pipe(busboy);
        } else {
            (req as any).pipe(busboy);
        }
    });

    if (!audioBuffer || audioBuffer.length === 0) {
        return res.status(400).json({ error: 'No audio data provided' });
    }

    console.log('[WHISPER] Transcribing audio, size:', audioBuffer.length);

    // Create a File object from buffer for OpenAI
    const audioFile = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

    // Call OpenAI Whisper API with optimized parameters
    const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
        temperature: 0.0,
        prompt: 'Contexte médical professionnel. Visite à domicile par infirmier ou infirmière. Notes de soins : observations cliniques, constantes vitales (tension, température, saturation, pouls), état du patient, soins réalisés (pansement, injection, prélèvement), traitement médicamenteux, plaie, douleur, glycémie, suivi post-opératoire. Termes médicaux français.'
    });

    let cleanedText = transcription.text;

    // Clean known Whisper hallucinations
    const hallucinations = [
        /sous-titres?\s+(réalisés?\s+)?par(a)?\s+la\s+communauté\s+d'?amara\.org/gi,
        /merci\s+(de\s+)?d'?avoir\s+regardé/gi,
        /n'?oubliez\s+pas\s+de\s+(vous\s+)?abonner/gi,
        /likez?\s+et\s+partagez/gi,
        /la\s+vidéo/gi,
        /cette\s+vidéo/gi,
    ];

    hallucinations.forEach(pattern => {
        cleanedText = cleanedText.replace(pattern, '').trim();
    });

    console.log('[WHISPER] Transcription successful:', cleanedText);

    res.status(200).json({ text: cleanedText });
}

async function handleSynthesize(req: VercelRequest, res: VercelResponse) {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required' });
    }

    const openai = getOpenAIClient();

    console.log('[TTS] Generating audio for text:', text.substring(0, 100));

    // Generate audio with OpenAI TTS
    const mp3Response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: text,
        response_format: 'mp3'
    });

    // Convert response to buffer
    const buffer = Buffer.from(await mp3Response.arrayBuffer());

    console.log('[TTS] Audio generated successfully, size:', buffer.length);

    // Return audio as base64 for easy storage
    const base64Audio = buffer.toString('base64');

    res.status(200).json({
        audio: base64Audio,
        mimeType: 'audio/mpeg',
        success: true
    });
}

// ============================================================
// Main Handler
// ============================================================

/**
 * POST /api/voice?action=transcribe|synthesize
 * Consolidated endpoint for voice operations
 * - transcribe: multipart/form-data with audio file
 * - synthesize: JSON body with { text: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleCorsOptions(req, res)) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get action from query (for multipart requests) or body
        const action = (req.query.action as string) || (req.body?.action as string);

        if (!action) {
            return res.status(400).json({
                error: 'Action requise (via query param ?action=)',
                availableActions: ['transcribe', 'synthesize']
            });
        }

        switch (action) {
            case 'transcribe':
                return await handleTranscribe(req, res);

            case 'synthesize':
                return await handleSynthesize(req, res);

            default:
                return res.status(400).json({
                    error: `Action inconnue: ${action}`,
                    availableActions: ['transcribe', 'synthesize']
                });
        }
    } catch (error: any) {
        console.error('[VOICE] Error:', error);
        res.status(500).json({
            error: 'Erreur lors du traitement vocal',
            details: error.message
        });
    }
}
