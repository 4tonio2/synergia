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
import xmlrpc from "xmlrpc";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Configure multer for file uploads (store in memory)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max (Whisper limit)
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supabase dédié à l'ingestion / embeddings (2ᵉ projet Supabase)
const SUPABASE_URL_1 = process.env.SUPABASE_URL_1;
const SUPABASE_KEY_1 = process.env.SUPABASE_KEY_1;
const SUPABASE_INGESTION_TABLE =
  process.env.SUPABASE_TABLE_1 ||
  process.env.SUPABASE_TABLE ||
  "contact_embeddings";

const supabaseIngestion =
  SUPABASE_URL_1 && SUPABASE_KEY_1
    ? createSupabaseClient(SUPABASE_URL_1, SUPABASE_KEY_1)
    : null;
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const MAX_EMBEDDING_CHARS = parseInt(process.env.MAX_EMBEDDING_CHARS || "8000", 10);

const ODOO_URL = process.env.ODOO_URL;
const ODOO_BASE_URL = (ODOO_URL || "").replace(/\/+$/, "");
const ODOO_DB = process.env.ODOO_DB;
const ODOO_LOGIN = process.env.ODOO_LOGIN;
// On accepte soit ODOO_PASSWORD, soit ODOO_API_KEY (compatibilité ingestion.py)
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || process.env.ODOO_API_KEY;
const ODOO_MODEL = process.env.ODOO_MODEL || "res.partner";

let odooUid: number | null = null;
let odooModelsClient: any | null = null;

async function xmlrpcCall<T>(client: any, method: string, params: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err: any, value: T) => {
      if (err) return reject(err);
      resolve(value);
    });
  });
}

async function getOdooModels() {
  if (odooUid && odooModelsClient) {
    return { uid: odooUid, models: odooModelsClient };
  }

  if (!ODOO_BASE_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_PASSWORD) {
    throw new Error(
      "ODOO_URL, ODOO_DB, ODOO_LOGIN et ODOO_PASSWORD (ou ODOO_API_KEY) doivent être définies pour créer des contacts Odoo",
    );
  }

  const common = xmlrpc.createClient({ url: `${ODOO_BASE_URL}/xmlrpc/2/common` });
  // Odoo 17.0 SaaS requires user_agent_env as 4th parameter (can be empty dict)
  const uid = await xmlrpcCall<number>(common, "authenticate", [
    ODOO_DB,
    ODOO_LOGIN,
    ODOO_PASSWORD,
    {}, // user_agent_env - required for Odoo 17.0
  ]);

  if (!uid) {
    throw new Error("Authentification Odoo échouée");
  }

  const models = xmlrpc.createClient({ url: `${ODOO_BASE_URL}/xmlrpc/2/object` });
  odooUid = uid;
  odooModelsClient = models;

  return { uid, models };
}

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0)
      .join(", ");
  }
  return String(value).trim();
}

function buildContentFromPerson(person: any): string {
  const lines: string[] = [];

  const name = normalizeString(person.nom_complet);
  if (name) lines.push(name);

  const tel = normalizeString(person.tel);
  const email = normalizeString(person.email);
  if (tel) lines.push(`Téléphone: ${tel}`);
  if (email) lines.push(`Email: ${email}`);

  const profession = normalizeString(person.profession_code);
  const actorType = normalizeString(person.type_acteur);
  const majorCategories = normalizeString(person.grande_categorie_acteur);
  const subcategories = normalizeString(person.sous_categorie_acteur);

  if (profession) lines.push(`Profession: ${profession}`);
  if (actorType) lines.push(`Type d'acteur: ${actorType}`);
  if (majorCategories) lines.push(`Catégories: ${majorCategories}`);
  if (subcategories) lines.push(`Sous-catégories: ${subcategories}`);

  return lines.join("\n").trim();
}

function truncateForEmbedding(text: string): string {
  if (text.length <= MAX_EMBEDDING_CHARS) return text;
  return text.slice(0, MAX_EMBEDDING_CHARS);
}

async function generateEmbeddingVector(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding as unknown as number[];
}

async function createOdooContactFromPerson(person: any): Promise<number> {
  const { uid, models } = await getOdooModels();

  const values: any = {
    name: person.nom_complet,
  };

  // Use standard fields for phone and email (not custom x_phone, x_email)
  if (person.tel) {
    values.phone = person.tel;
  }
  if (person.email) {
    values.email = person.email;
  }

  // Use custom fields for professional information
  if (person.profession_code) {
    values.x_studio_profession_code = person.profession_code;
  }
  if (person.type_acteur) {
    values.x_studio_type_actor = person.type_acteur;
  }
  if (person.grande_categorie_acteur) {
    values.x_studio_major_categories = person.grande_categorie_acteur;
  }
  if (person.sous_categorie_acteur) {
    values.x_studio_subcategories = person.sous_categorie_acteur;
  }

  const createdId = await xmlrpcCall<number>(models, "execute_kw", [
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    ODOO_MODEL,
    "create",
    [values],
  ]);

  if (!createdId) {
    throw new Error("Échec de la création du contact dans Odoo");
  }

  return createdId;
}

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

  /**
   * POST /api/contacts/search
   * Orchestrate n8n workflows to search contacts in Odoo based on visit notes.
   *
   * Expected body:
   * { text: string }
   *
   * Assumes the first webhook (extract-contacts) returns JSON:
   * { persons: Array<{ nom_complet?: string; tel?: string; email?: string; profession_code?: string;
   *                    type_acteur?: string; grande_categorie_acteur?: string; sous_categorie_acteur?: string; }> }
   *
   * The second webhook (Agent-contacts) is called once per person with at least one non-empty field.
   * If it returns a payload containing "[NONE]", we consider that no contact was found.
   */
  app.post('/api/contacts/search', async (req: Request, res: Response) => {
    try {
      const { text } = req.body as { text?: string };

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Le texte de visite est requis' });
      }

      console.log('[CONTACTS] Calling n8n extract-contacts webhook...');

      const extractResponse = await fetch(
        'https://treeporteur-n8n.fr/webhook/extract-contacts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userQuery: text.trim() }),
        },
      );

      if (!extractResponse.ok) {
        const body = await extractResponse.text().catch(() => '');
        console.error('[CONTACTS] extract-contacts error:', extractResponse.status, body);
        return res.status(502).json({
          error: 'Erreur lors de la détection des personnes (extract-contacts)',
        });
      }

      const contentType = extractResponse.headers.get('content-type') || '';

      let persons: any[] = [];

      if (contentType.includes('application/json')) {
        // Cas où le workflow renvoie déjà du JSON structuré
        const extractData: any = await extractResponse.json();
        persons =
          extractData.persons ||
          extractData.Personnes ||
          extractData.contacts ||
          [];
      } else {
        // Cas actuel : réponse texte au format:
        // Personne 1:
        // - nom_complet: ...
        // - tel: ...
        // ...
        const raw = await extractResponse.text();
        console.log(
          '[CONTACTS] Text response from extract-contacts, attempting to parse:',
        );
        console.log(raw);

        const blocks = raw
          .split(/Personne\s+\d+\s*:/i)
          .map((b) => b.trim())
          .filter((b) => b.length > 0);

        persons = blocks.map((block) => {
          const person: any = {};
          const lines = block.split('\n');

          for (const line of lines) {
            const match = line.match(/^\s*-\s*([^:]+):\s*(.*)$/);
            if (!match) continue;

            const rawKey = match[1].trim();
            const value = match[2].trim();

            // Normaliser les clés vers le format attendu
            const key = rawKey
              .toLowerCase()
              .replace(/\s+/g, '_')
              .replace(/[^\w_]/g, '');

            switch (key) {
              case 'nom_complet':
              case 'tel':
              case 'email':
              case 'profession_code':
              case 'type_acteur':
              case 'grande_categorie_acteur':
              case 'sous_categorie_acteur':
                person[key] = value;
                break;
              default:
                // On garde quand même au cas où
                person[key] = value;
            }
          }

          return person;
        });
      }

      if (!Array.isArray(persons) || persons.length === 0) {
        console.log('[CONTACTS] No persons detected by extract-contacts');
        return res.json({ persons: [] });
      }

      const fields = [
        'nom_complet',
        'tel',
        'email',
        'profession_code',
        'type_acteur',
        'grande_categorie_acteur',
        'sous_categorie_acteur',
      ];

      const results: Array<{
        input: any;
        match: any | null;
        requiresConsent?: boolean;
        consentAction?: string;
      }> = [];

      for (const person of persons) {
        const hasAnyField = fields.some((key) => {
          const value = person?.[key];
          return typeof value === 'string' ? value.trim().length > 0 : !!value;
        });

        if (!hasAnyField) {
          results.push({
            input: person,
            match: null,
          });
          continue;
        }

        console.log(
          '[CONTACTS] Calling n8n Agent-contacts for person:',
          person?.nom_complet || '(sans nom)',
        );

        // Construire une userQuery textuelle à partir des champs de la personne
        const personLines: string[] = [];
        if (person.nom_complet) personLines.push(`nom_complet: ${person.nom_complet}`);
        if (person.tel) personLines.push(`tel: ${person.tel}`);
        if (person.email) personLines.push(`email: ${person.email}`);
        if (person.profession_code) personLines.push(`profession_code: ${person.profession_code}`);
        if (person.type_acteur) personLines.push(`type_acteur: ${person.type_acteur}`);
        if (person.grande_categorie_acteur) {
          personLines.push(
            `grande_categorie_acteur: ${person.grande_categorie_acteur}`,
          );
        }
        if (person.sous_categorie_acteur) {
          personLines.push(`sous_categorie_acteur: ${person.sous_categorie_acteur}`);
        }

        const agentPayload = {
          userQuery:
            personLines.length > 0
              ? personLines.join('\n')
              : JSON.stringify(person),
        };

        const agentResponse = await fetch(
          'https://treeporteur-n8n.fr/webhook/Agent-contacts',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentPayload),
          },
        );

        if (!agentResponse.ok) {
          const body = await agentResponse.text().catch(() => '');
          console.error('[CONTACTS] Agent-contacts error:', agentResponse.status, body);
          results.push({
            input: person,
            match: null,
          });
          continue;
        }

        const agentText = await agentResponse.text();

        if (agentText.includes('[NONE]')) {
          // Match is null - require user consent before upserting
          console.log('[CONTACTS] No match found for person:', person?.nom_complet);
          results.push({
            input: person,
            match: null,
            requiresConsent: true,
            consentAction: 'pending', // pending | approved | rejected
          });
          continue;
        }

        let parsedMatch: any = null;
        try {
          parsedMatch = JSON.parse(agentText);
        } catch {
          parsedMatch = { raw: agentText };
        }

        results.push({
          input: person,
          match: parsedMatch,
        });
      }

      res.json({ persons: results });
    } catch (error: any) {
      console.error('[CONTACTS] Unexpected error:', error);
      res.status(500).json({
        error: 'Erreur interne lors de la recherche de contacts',
        details: error.message,
      });
    }
  });

  /**
   * POST /api/contacts/consent
   *
   * Handle user consent for a contact that has no match (match is null).
   * If approved, automatically upserts to Odoo and Supabase.
   * If rejected, returns without upserting.
   *
   * Body attendu:
   * {
   *   "person": { ... },
   *   "consent": "approved" | "rejected",
   *   "odoo_id": number | null (optional)
   * }
   */
  app.post('/api/contacts/consent', async (req: Request, res: Response) => {
    try {
      const body = req.body as { person?: any; consent?: string; odoo_id?: number | null };
      const person = body.person || body;
      const consent = body.consent?.toLowerCase();

      if (!person || typeof person !== 'object') {
        return res.status(400).json({
          error: 'Le corps de la requête doit contenir un objet "person"',
        });
      }

      if (!consent || !['approved', 'rejected'].includes(consent)) {
        return res.status(400).json({
          error: 'Le consentement doit être "approved" ou "rejected"',
        });
      }

      const name = normalizeString(person.nom_complet);
      if (!name) {
        return res.status(400).json({
          error: 'nom_complet est requis',
        });
      }

      // If rejected, just return success without upserting
      if (consent === 'rejected') {
        console.log('[CONTACTS] User rejected contact:', name);
        return res.json({
          success: true,
          action: 'rejected',
          message: 'Contact rejeté - aucun upsert effectué',
        });
      }

      // If approved, proceed with upsert (reuse the upsert logic)
      console.log('[CONTACTS] User approved contact:', name, '- proceeding with upsert');

      let odooId = body.odoo_id ?? person.odoo_id;

      // 1. Création dans Odoo si besoin
      if (!odooId) {
        console.log('[CONTACTS] Création du contact dans Odoo pour', name);
        try {
          odooId = await createOdooContactFromPerson(person);
          console.log('[CONTACTS] Contact créé dans Odoo avec id', odooId);
        } catch (odooError: any) {
          console.error('[CONTACTS] Erreur création Odoo:', odooError);
          return res.status(502).json({
            error: 'Erreur lors de la création du contact dans Odoo',
            details: odooError.message,
          });
        }
      }

      // 2. Préparation du payload pour Supabase
      const content = buildContentFromPerson(person);
      const metadata = {
        ...person,
        odoo_id: odooId,
      };

      const payload = {
        odoo_id: odooId,
        contact_name: person.nom_complet,
        phone: person.tel || null,
        mobile: null,
        email: person.email || null,
        profession_code: person.profession_code || null,
        major_categories: person.grande_categorie_acteur || null,
        actor_type: person.type_acteur || null,
        subcategories: person.sous_categorie_acteur || null,
        content,
        metadata,
      };

      // 3. Génération de l'embedding
      let embedding: number[];
      try {
        const embeddingText = truncateForEmbedding(content);
        embedding = await generateEmbeddingVector(embeddingText);
      } catch (embError: any) {
        console.error('[CONTACTS] Erreur génération embedding:', embError);
        return res.status(502).json({
          error: 'Erreur lors de la génération de l\'embedding OpenAI',
          details: embError.message,
        });
      }

      // 4. Upsert dans Supabase
      try {
        if (!supabaseIngestion) {
          console.error(
            "[CONTACTS] supabaseIngestion non configuré. Définir SUPABASE_URL_1 et SUPABASE_KEY_1 dans l'environnement.",
          );
          return res.status(500).json({
            error:
              "Client Supabase d'ingestion non configuré. Vérifiez SUPABASE_URL_1 et SUPABASE_KEY_1.",
          });
        }

        const { data, error } = await supabaseIngestion
          .from(SUPABASE_INGESTION_TABLE)
          .upsert({ ...payload, embedding })
          .select()
          .maybeSingle();

        if (error) {
          console.error('[CONTACTS] Erreur Supabase upsert:', error);
          return res.status(502).json({
            error: 'Erreur lors de l\'upsert dans Supabase',
            details: error.message,
          });
        }

        return res.json({
          success: true,
          action: 'approved',
          message: 'Contact approuvé et inséré avec succès',
          odoo_id: odooId,
          supabase: data,
        });
      } catch (dbError: any) {
        console.error('[CONTACTS] Exception Supabase upsert:', dbError);
        return res.status(502).json({
          error: 'Erreur lors de l\'upsert dans Supabase',
          details: dbError.message,
        });
      }
    } catch (error: any) {
      console.error('[CONTACTS] Unexpected error in /api/contacts/consent:', error);
      res.status(500).json({
        error: 'Erreur interne lors du traitement du consentement',
        details: error.message,
      });
    }
  });

  /**
   * POST /api/contacts/upsert
   *
   * Crée un contact dans Odoo (si odoo_id absent) et l'upsert dans Supabase
   * dans la table d'embeddings (par défaut "contact_embeddings").
   *
   * Body attendu:
   * {
   *   "person": {
   *     "nom_complet": "...",
   *     "tel": "...",
   *     "email": "...",
   *     "profession_code": "...",
   *     "type_acteur": "...",
   *     "grande_categorie_acteur": "...",
   *     "sous_categorie_acteur": "..."
   *   },
   *   "odoo_id": number | null
   * }
   */
  app.post('/api/contacts/upsert', async (req: Request, res: Response) => {
    try {
      const body = req.body as { person?: any; odoo_id?: number | null };
      const person = body.person || body;

      if (!person || typeof person !== 'object') {
        return res.status(400).json({
          error: 'Le corps de la requête doit contenir un objet "person"',
        });
      }

      const name = normalizeString(person.nom_complet);
      if (!name) {
        return res.status(400).json({
          error: 'nom_complet est requis pour créer un contact',
        });
      }

      let odooId = body.odoo_id ?? person.odoo_id;

      // 1. Création dans Odoo si besoin
      if (!odooId) {
        console.log('[CONTACTS] Création du contact dans Odoo pour', name);
        try {
          odooId = await createOdooContactFromPerson(person);
          console.log('[CONTACTS] Contact créé dans Odoo avec id', odooId);
        } catch (odooError: any) {
          console.error('[CONTACTS] Erreur création Odoo:', odooError);
          return res.status(502).json({
            error: 'Erreur lors de la création du contact dans Odoo',
            details: odooError.message,
          });
        }
      }

      // 2. Préparation du payload pour Supabase
      const content = buildContentFromPerson(person);
      const metadata = {
        ...person,
        odoo_id: odooId,
      };

      const payload = {
        odoo_id: odooId,
        contact_name: person.nom_complet,
        phone: person.tel || null,
        mobile: null,
        email: person.email || null,
        profession_code: person.profession_code || null,
        major_categories: person.grande_categorie_acteur || null,
        actor_type: person.type_acteur || null,
        subcategories: person.sous_categorie_acteur || null,
        content,
        metadata,
      };

      // 3. Génération de l'embedding
      let embedding: number[];
      try {
        const embeddingText = truncateForEmbedding(content);
        embedding = await generateEmbeddingVector(embeddingText);
      } catch (embError: any) {
        console.error('[CONTACTS] Erreur génération embedding:', embError);
        return res.status(502).json({
          error: 'Erreur lors de la génération de l\'embedding OpenAI',
          details: embError.message,
        });
      }

      // 4. Upsert dans Supabase
      try {
        if (!supabaseIngestion) {
          console.error(
            "[CONTACTS] supabaseIngestion non configuré. Définir SUPABASE_URL_1 et SUPABASE_KEY_1 dans l'environnement.",
          );
          return res.status(500).json({
            error:
              "Client Supabase d'ingestion non configuré. Vérifiez SUPABASE_URL_1 et SUPABASE_KEY_1.",
          });
        }

        const { data, error } = await supabaseIngestion
          .from(SUPABASE_INGESTION_TABLE)
          .upsert({ ...payload, embedding })
          .select()
          .maybeSingle();

        if (error) {
          console.error('[CONTACTS] Erreur Supabase upsert:', error);
          return res.status(502).json({
            error: 'Erreur lors de l\'upsert dans Supabase',
            details: error.message,
          });
        }

        return res.json({
          odoo_id: odooId,
          supabase: data,
        });
      } catch (dbError: any) {
        console.error('[CONTACTS] Exception Supabase upsert:', dbError);
        return res.status(502).json({
          error: 'Erreur lors de l\'upsert dans Supabase',
          details: dbError.message,
        });
      }
    } catch (error: any) {
      console.error('[CONTACTS] Unexpected error in /api/contacts/upsert:', error);
      res.status(500).json({
        error: 'Erreur interne lors de la création / ingestion du contact',
        details: error.message,
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
