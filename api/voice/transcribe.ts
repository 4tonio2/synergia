import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient, handleCorsOptions } from '../_helpers';
import Busboy from 'busboy';
import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const openai = getOpenAIClient();

    // Parse multipart/form-data with busboy
    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });
      let fileBuffer: Buffer | null = null;

      busboy.on('file', (fieldname, file, info) => {
        const chunks: Buffer[] = [];
        
        file.on('data', (chunk) => {
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

      busboy.on('error', (error) => {
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

  } catch (error: any) {
    console.error('[WHISPER] Error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la transcription',
      details: error.message 
    });
  }
}
