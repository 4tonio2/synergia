import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient, handleCorsOptions } from '../_helpers';
import formidable from 'formidable';
import fs from 'fs';

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

    // Parse form data with formidable
    const form = formidable({});
    const [fields, files] = await form.parse(req);

    const audioFile = files.audio?.[0];
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('[WHISPER] Transcribing audio file:', {
      originalName: audioFile.originalFilename,
      size: audioFile.size,
      mimetype: audioFile.mimetype
    });

    // Read file from temporary location
    const fileStream = fs.createReadStream(audioFile.filepath);

    // Call OpenAI Whisper API with optimized parameters
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      language: 'fr', // Force French language
      response_format: 'verbose_json', // Get more metadata for quality
      temperature: 0.0, // Lower temperature = more deterministic, less hallucinations
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

    // Clean up temp file
    fs.unlinkSync(audioFile.filepath);

    res.status(200).json({ text: cleanedText });

  } catch (error: any) {
    console.error('[WHISPER] Error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la transcription',
      details: error.message 
    });
  }
}
