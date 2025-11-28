import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SUPABASE_URL_1 = process.env.SUPABASE_URL_1;
const SUPABASE_KEY_1 = process.env.SUPABASE_KEY_1;
const SUPABASE_INGESTION_TABLE = process.env.SUPABASE_TABLE_1 || "contact_embeddings";

const supabaseIngestion =
  SUPABASE_URL_1 && SUPABASE_KEY_1
    ? createSupabaseClient(SUPABASE_URL_1, SUPABASE_KEY_1)
    : null;

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const MAX_EMBEDDING_CHARS = parseInt(process.env.MAX_EMBEDDING_CHARS || "8000", 10);

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

async function createOdooContactViaWebhook(person: any): Promise<number> {
  console.log('[ODOO] Creating contact via Odoo JSON-RPC for:', person.nom_complet);
  
  const ODOO_URL = process.env.ODOO_URL;
  const ODOO_DB = process.env.ODOO_DB;
  const ODOO_LOGIN = process.env.ODOO_LOGIN;
  const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

  if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_PASSWORD) {
    throw new Error('Configuration Odoo manquante (ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_PASSWORD)');
  }

  const baseUrl = ODOO_URL.replace(/\/+$/, '');

  // 1. Authenticate
  console.log('[ODOO] Authenticating...');
  const authResponse = await fetch(`${baseUrl}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_LOGIN,
        password: ODOO_PASSWORD,
      },
    }),
  });

  if (!authResponse.ok) {
    throw new Error(`Authentification Odoo échouée: ${authResponse.status}`);
  }

  const authData = await authResponse.json() as any;
  
  if (authData.error) {
    throw new Error(`Erreur auth Odoo: ${authData.error.data?.message || authData.error.message}`);
  }

  console.log('[ODOO] Authenticated successfully');

  // Extract session cookies
  const cookies = authResponse.headers.get('set-cookie') || '';

  // 2. Create contact
  console.log('[ODOO] Creating contact...');
  
  const contactData: any = {
    name: person.nom_complet,
  };

  if (person.tel) contactData.phone = person.tel;
  if (person.email) contactData.email = person.email;
  if (person.profession_code) contactData.x_studio_profession_code = person.profession_code;
  if (person.type_acteur) contactData.x_studio_type_actor = person.type_acteur;
  if (person.grande_categorie_acteur) contactData.x_studio_major_categories = person.grande_categorie_acteur;
  if (person.sous_categorie_acteur) contactData.x_studio_subcategories = person.sous_categorie_acteur;

  const createResponse = await fetch(`${baseUrl}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'res.partner',
        method: 'create',
        args: [contactData],
        kwargs: {},
      },
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Création contact Odoo échouée: ${createResponse.status}`);
  }

  const createData = await createResponse.json() as any;
  
  if (createData.error) {
    throw new Error(`Erreur création Odoo: ${createData.error.data?.message || createData.error.message}`);
  }

  const odooId = createData.result;
  
  if (!odooId) {
    console.error('[ODOO] No ID in response:', createData);
    throw new Error('Odoo n\'a pas retourné d\'ID');
  }

  console.log('[ODOO] Contact created with ID:', odooId);
  return odooId;
}

/**
 * POST /api/contacts/upsert
 * Creates contact in Odoo using JSON-RPC API and stores in Supabase with embeddings
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    // 1. Création dans Odoo via webhook n8n si besoin
    if (!odooId) {
      console.log('[CONTACTS] Création du contact dans Odoo pour', name);
      try {
        odooId = await createOdooContactViaWebhook(person);
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
        error: "Erreur lors de la génération de l'embedding OpenAI",
        details: embError.message,
      });
    }

    // 4. Upsert dans Supabase
    try {
      if (!supabaseIngestion) {
        console.error(
          "[CONTACTS] supabaseIngestion non configuré. Définir SUPABASE_URL_1 et SUPABASE_KEY_1"
        );
        return res.status(500).json({
          error: "Client Supabase d'ingestion non configuré",
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
          error: "Erreur lors de l'upsert dans Supabase",
          details: error.message,
        });
      }

      return res.json({
        success: true,
        message: 'Contact créé et inséré avec succès',
        odoo_id: odooId,
        supabase: data,
      });
    } catch (dbError: any) {
      console.error('[CONTACTS] Exception Supabase upsert:', dbError);
      return res.status(502).json({
        error: "Erreur lors de l'upsert dans Supabase",
        details: dbError.message,
      });
    }
  } catch (error: any) {
    console.error('[CONTACTS] Unexpected error in /api/contacts/upsert:', error);
    res.status(500).json({
      error: 'Erreur interne lors de la création du contact',
      details: error.message,
    });
  }
}
