import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOpenAIClient, handleCorsOptions } from '../_helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCorsOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

  } catch (error: any) {
    console.error('[TTS] Error generating audio:', error);
    res.status(500).json({
      error: 'Erreur lors de la synthèse vocale',
      details: error.message
    });
  }
}
