import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import xmlrpc from 'xmlrpc';

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

const ODOO_URL = process.env.ODOO_URL;
const ODOO_BASE_URL = (ODOO_URL || "").replace(/\/+$/, "");
const ODOO_DB = process.env.ODOO_DB;
const ODOO_LOGIN = process.env.ODOO_LOGIN;
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
      "ODOO_URL, ODOO_DB, ODOO_LOGIN et ODOO_PASSWORD doivent être définies"
    );
  }

  const common = xmlrpc.createClient({ url: `${ODOO_BASE_URL}/xmlrpc/2/common` });
  const uid = await xmlrpcCall<number>(common, "authenticate", [
    ODOO_DB,
    ODOO_LOGIN,
    ODOO_PASSWORD,
    {},
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

  if (person.tel) {
    values.phone = person.tel;
  }
  if (person.email) {
    values.email = person.email;
  }

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

/**
 * POST /api/contacts/consent
 *
 * Handle user consent for a contact that has no match (match is null).
 * If approved, automatically upserts to Odoo and Supabase.
 * If rejected, returns without upserting.
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

    // If approved, proceed with upsert
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
        action: 'approved',
        message: 'Contact approuvé et inséré avec succès',
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
    console.error('[CONTACTS] Unexpected error in /api/contacts/consent:', error);
    res.status(500).json({
      error: 'Erreur interne lors du traitement du consentement',
      details: error.message,
    });
  }
}
