import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getUserFromToken } from "./supabase";
import { updateUserRoleSchema, updateUserProfileSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { logAuthEvent } from "./authLogger";
import multer from "multer";
import OpenAI from "openai";
import fs from "fs";

// Configure multer for file uploads (store in memory)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max (Whisper limit)
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware to verify Supabase JWT token
async function isAuthenticated(req: any, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = await getUserFromToken(token);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply pending medical role after successful authentication
  app.post('/api/auth/apply-pending-role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const pendingRole = req.body.medicalRole;
      
      console.log("[APPLY-PENDING-ROLE] userId:", userId, "pendingRole:", pendingRole);

      if (pendingRole && ["infirmier", "medecin", "kinesitherapeute", "aidant_pro"].includes(pendingRole)) {
        console.log("[APPLY-PENDING-ROLE] Updating user role to:", pendingRole);
        
        // Check if user exists, if not create them
        let user = await storage.getUser(userId);
        
        if (!user) {
          // Extract user data from Supabase metadata
          const metadata = req.user.user_metadata || {};
          const fullName = metadata.full_name || metadata.name || '';
          const nameParts = fullName.split(' ');
          
          // Create user from Supabase data
          await storage.upsertUser({
            id: userId,
            email: req.user.email,
            firstName: metadata.given_name || nameParts[0] || null,
            lastName: metadata.family_name || nameParts.slice(1).join(' ') || null,
            profileImageUrl: metadata.avatar_url || metadata.picture || null,
          });
        }
        
        // Update role
        const updatedUser = await storage.updateUserRole(userId, { medicalRole: pendingRole });
        console.log("[APPLY-PENDING-ROLE] User updated:", updatedUser);
        
        // Log successful login with role
        await logAuthEvent(userId, "login", req, { medicalRole: pendingRole });
        
        return res.json(updatedUser);
      } else {
        console.log("[APPLY-PENDING-ROLE] No pending role or invalid role");
        // Just ensure user exists
        let user = await storage.getUser(userId);
        
        if (!user) {
          // Extract user data from Supabase metadata
          const metadata = req.user.user_metadata || {};
          const fullName = metadata.full_name || metadata.name || '';
          const nameParts = fullName.split(' ');
          
          await storage.upsertUser({
            id: userId,
            email: req.user.email,
            firstName: metadata.given_name || nameParts[0] || null,
            lastName: metadata.family_name || nameParts.slice(1).join(' ') || null,
            profileImageUrl: metadata.avatar_url || metadata.picture || null,
          });
          user = await storage.getUser(userId);
        }
        
        await logAuthEvent(userId, "login", req);
        return res.json(user);
      }
    } catch (error) {
      console.error("[APPLY-PENDING-ROLE] Error:", error);
      res.status(500).json({ message: "Failed to apply role" });
    }
  });

  // Auth routes - Public endpoint that returns user if authenticated, null otherwise
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.json(null);
      }

      const token = authHeader.substring(7);
      const supabaseUser = await getUserFromToken(token);
      
      if (!supabaseUser) {
        return res.json(null);
      }

      const userId = supabaseUser.id;
      let user = await storage.getUser(userId);
      
      // Extract user data from Supabase metadata
      const metadata = supabaseUser.user_metadata || {};
      const fullName = metadata.full_name || metadata.name || '';
      const nameParts = fullName.split(' ');
      const extractedFirstName = metadata.given_name || nameParts[0] || null;
      const extractedLastName = metadata.family_name || nameParts.slice(1).join(' ') || null;
      const extractedProfileUrl = metadata.avatar_url || metadata.picture || null;
      
      // If user doesn't exist in our DB, create them
      if (!user) {
        await storage.upsertUser({
          id: userId,
          email: supabaseUser.email || null,
          firstName: extractedFirstName,
          lastName: extractedLastName,
          profileImageUrl: extractedProfileUrl,
        });
        user = await storage.getUser(userId);
      } else {
        // Update user info if they're missing or different from Google data
        const needsUpdate = 
          (!user.firstName && extractedFirstName) ||
          (!user.lastName && extractedLastName) ||
          (!user.profileImageUrl && extractedProfileUrl) ||
          (extractedProfileUrl && user.profileImageUrl !== extractedProfileUrl);
        
        if (needsUpdate) {
          await storage.updateUserProfile(userId, {
            firstName: extractedFirstName || user.firstName,
            lastName: extractedLastName || user.lastName,
            medicalRole: user.medicalRole as "infirmier" | "medecin" | "kinesitherapeute" | "aidant_pro" | undefined,
          });
          
          // Update profile image separately if needed
          if (extractedProfileUrl && user.profileImageUrl !== extractedProfileUrl) {
            await storage.upsertUser({
              id: userId,
              email: user.email,
              firstName: extractedFirstName || user.firstName,
              lastName: extractedLastName || user.lastName,
              profileImageUrl: extractedProfileUrl,
            });
          }
          
          user = await storage.getUser(userId);
        }
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      // Return null instead of error to allow landing page to render
      res.json(null);
    }
  });

  // Update user medical role
  app.patch('/api/users/role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Validate request body
      const validationResult = updateUserRoleSchema.safeParse(req.body);
      if (!validationResult.success) {
        const validationError = fromZodError(validationResult.error);
        return res.status(400).json({ 
          message: "Invalid role data",
          error: validationError.toString()
        });
      }

      const updatedUser = await storage.updateUserRole(userId, validationResult.data);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user role:", error);
      
      if (error.message === "User not found") {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Update user profile (firstName, lastName, medicalRole)
  app.patch('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const requestedUserId = req.params.id;
      const authenticatedUserId = req.user.id;
      
      // Users can only update their own profile
      if (requestedUserId !== authenticatedUserId) {
        return res.status(403).json({ message: "Forbidden: You can only update your own profile" });
      }
      
      // Validate request body
      const validationResult = updateUserProfileSchema.safeParse(req.body);
      if (!validationResult.success) {
        const validationError = fromZodError(validationResult.error);
        return res.status(400).json({ 
          message: "Invalid profile data",
          error: validationError.toString()
        });
      }

      // Get current user to check for role changes
      const currentUser = await storage.getUser(authenticatedUserId);
      const oldRole = currentUser?.medicalRole;
      const newRole = validationResult.data.medicalRole;

      const updatedUser = await storage.updateUserProfile(authenticatedUserId, validationResult.data);
      
      // Log profile update
      const metadata: Record<string, any> = {};
      if (newRole && newRole !== oldRole) {
        metadata.oldRole = oldRole;
        metadata.newRole = newRole;
        await logAuthEvent(authenticatedUserId, "role_change", req, metadata);
      } else {
        await logAuthEvent(authenticatedUserId, "profile_update", req, validationResult.data);
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      
      if (error.message === "User not found") {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await logAuthEvent(userId, "logout", req);
      res.json({ success: true });
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  // ============================================================
  // AI ACTIONS ROUTES
  // ============================================================
  
  /**
   * POST /api/ai/summary
   * Generate a structured medical summary using GPT-4
   */
  app.post('/api/ai/summary', async (req: Request, res: Response) => {
    try {
      const { patientName, patientAge, visitType, painLevel, notesRaw } = req.body;
      
      // Validation minimale
      if (!notesRaw || notesRaw.trim().length === 0) {
        return res.status(400).json({ 
          error: "Les notes de visite sont requises" 
        });
      }

      console.log('[GPT-4] Generating summary for:', { patientName, visitType });
      
      // Appel à GPT-4 avec prompt médical structuré
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant médical expert qui génère des résumés TRÈS COURTS et CONCIS de visites à domicile.

RÈGLES IMPORTANTES:
- Maximum 4-5 lignes
- Style télégraphique et professionnel
- Uniquement les informations ESSENTIELLES
- Pas de phrases complètes, utilise des virgules

Format attendu (COURT):
**[Type de visite]** - Patient de [âge] ans
Observations: [2-3 points clés]
Actions: [soins réalisés en 1 ligne]
Suivi: [recommandation courte si nécessaire]

Exemple:
**Soins de pansement** - Patient de 78 ans
Observations: Plaie jambe droite en amélioration, bords moins rouges, pas d'écoulement, douleur modérée (3/10)
Actions: Nettoyage, désinfection, nouveau pansement
Suivi: Surveillance évolution, contrôle dans 48h`
          },
          {
            role: "user",
            content: `Patient: ${patientName}, ${patientAge} ans
Type de visite: ${visitType}
Niveau de douleur: ${painLevel}/10

Notes:
${notesRaw}

Génère un résumé TRÈS COURT (4-5 lignes max) de cette visite.`
          }
        ],
        temperature: 0.3,
        max_tokens: 200 // Réduire pour forcer la concision
      });

      const summary = completion.choices[0].message.content || "Erreur: pas de résumé généré";
      console.log('[GPT-4] Summary generated successfully');
      
      res.json({ summary });
      
    } catch (error: any) {
      console.error('[GPT-4] Error generating summary:', error);
      res.status(500).json({ 
        error: 'Erreur lors de la génération du résumé',
        details: error.message 
      });
    }
  });

  /**
   * POST /api/ai/transmission
   * Generate a structured medical transmission for the doctor using GPT-4
   */
  app.post('/api/ai/transmission', async (req: Request, res: Response) => {
    try {
      const { patientName, patientAge, visitType, painLevel, notesRaw, notesSummary } = req.body;
      
      if (!notesRaw || notesRaw.trim().length === 0) {
        return res.status(400).json({ 
          error: "Les notes de visite sont requises" 
        });
      }

      console.log('[GPT-4] Generating transmission for:', { patientName, visitType });
      
      // Appel à GPT-4 avec prompt de transmission médicale
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant médical expert qui aide les infirmiers à générer des transmissions médicales structurées pour les médecins.

Une transmission médicale doit être :
- Précise et factuelle
- Structurée selon le format SBAR (Situation, Background, Assessment, Recommendation)
- Orientée vers l'action médicale
- Rédigée en langage professionnel

Format attendu :
**SITUATION**
[État actuel du patient, raison de la visite]

**CONTEXTE**
[Antécédents pertinents, traitements en cours]

**ÉVALUATION**
[Observations cliniques, constantes, niveau de douleur, évolution]

**RECOMMANDATIONS**
[Actions proposées, surveillance nécessaire, points d'alerte]

**URGENCE**
[Évaluer si intervention médicale urgente nécessaire]`
          },
          {
            role: "user",
            content: `TRANSMISSION MÉDICALE

Patient: ${patientName}, ${patientAge} ans
Type de visite: ${visitType}
Niveau de douleur: ${painLevel}/10
Date: ${new Date().toLocaleDateString('fr-FR')}

Notes de visite:
${notesRaw}

${notesSummary ? `Résumé IA:\n${notesSummary}\n\n` : ''}

Génère une transmission médicale structurée pour le médecin traitant.`
          }
        ],
        temperature: 0.3,
        max_tokens: 1200
      });

      const transmission = completion.choices[0].message.content || "Erreur: pas de transmission générée";
      console.log('[GPT-4] Transmission generated successfully');
      
      res.json({ transmission });
      
    } catch (error: any) {
      console.error('[GPT-4] Error generating transmission:', error);
      res.status(500).json({ 
        error: 'Erreur lors de la génération de la transmission',
        details: error.message 
      });
    }
  });

  /**
   * POST /api/voice/synthesize
   * Generate audio from text using OpenAI TTS
   */
  app.post('/api/voice/synthesize', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Text is required' });
      }

      console.log('[TTS] Generating audio for text length:', text.length);

      // Call OpenAI TTS API
      const mp3Response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova", // Voix féminine claire et professionnelle
        input: text,
        speed: 1.0
      });

      // Convert response to buffer
      const buffer = Buffer.from(await mp3Response.arrayBuffer());
      
      console.log('[TTS] Audio generated successfully, size:', buffer.length);

      // Return audio as base64 for easy storage
      const base64Audio = buffer.toString('base64');
      
      res.json({ 
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
  });

  /**
   * POST /api/voice/transcribe
   * Transcribe audio to text using OpenAI Whisper
   */
  app.post('/api/voice/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      console.log('[WHISPER] Transcribing audio file:', {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // Create a temporary file from buffer
      const tempFilePath = `/tmp/audio-${Date.now()}.webm`;
      fs.writeFileSync(tempFilePath, req.file.buffer);

      try {
        // Call OpenAI Whisper API with optimized parameters
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: 'whisper-1',
          language: 'fr', // Force French language
          response_format: 'verbose_json', // Get more metadata for quality
          temperature: 0.0, // Lower temperature = more deterministic, less hallucinations
          prompt: 'Contexte médical professionnel. Visite à domicile par infirmier ou infirmière. Notes de soins : observations cliniques, constantes vitales (tension, température, saturation, pouls), état du patient, soins réalisés (pansement, injection, prélèvement), traitement médicamenteux, plaie, douleur, glycémie, suivi post-opératoire. Termes médicaux français.' // Prompt détaillé pour guider Whisper
        });

        let cleanedText = transcription.text;
        
        // Nettoyer les hallucinations connues de Whisper
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
        fs.unlinkSync(tempFilePath);

        res.json({ 
          text: cleanedText,
          success: true 
        });

      } catch (whisperError: any) {
        // Clean up temp file on error
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        
        console.error('[WHISPER] Transcription error:', whisperError);
        res.status(500).json({ 
          error: 'Erreur lors de la transcription',
          details: whisperError.message 
        });
      }
      
    } catch (error: any) {
      console.error('[WHISPER] Error:', error);
      res.status(500).json({ 
        error: 'Erreur lors de la transcription',
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
