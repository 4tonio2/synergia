// Test direct de la création de contact Odoo comme le fait le serveur
import xmlrpc from "xmlrpc";
import "dotenv/config";

const ODOO_URL = process.env.ODOO_URL;
const ODOO_BASE_URL = (ODOO_URL || "").replace(/\/+$/, "");
const ODOO_DB = process.env.ODOO_DB;
const ODOO_LOGIN = process.env.ODOO_LOGIN;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || process.env.ODOO_API_KEY;
const ODOO_MODEL = process.env.ODOO_MODEL || "res.partner";

async function xmlrpcCall(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, value) => {
      if (err) return reject(err);
      resolve(value);
    });
  });
}

async function testCreateContact() {
  console.log("=== Test Contact Creation ===\n");
  console.log("Configuration:");
  console.log("  ODOO_BASE_URL:", ODOO_BASE_URL);
  console.log("  ODOO_DB:", ODOO_DB);
  console.log("  ODOO_LOGIN:", ODOO_LOGIN);
  console.log("  ODOO_MODEL:", ODOO_MODEL);
  console.log();

  try {
    // Step 1: Authenticate
    console.log("Step 1: Authenticating...");
    const common = xmlrpc.createClient({
      url: `${ODOO_BASE_URL}/xmlrpc/2/common`
    });

    const uid = await xmlrpcCall(common, "authenticate", [
      ODOO_DB,
      ODOO_LOGIN,
      ODOO_PASSWORD,
      {}, // user_agent_env
    ]);

    if (!uid) {
      console.error("❌ Authentication failed!");
      return;
    }

    console.log("✅ Authentication successful, UID:", uid);
    console.log();

    // Step 2: Create contact
    console.log("Step 2: Creating contact...");
    const models = xmlrpc.createClient({
      url: `${ODOO_BASE_URL}/xmlrpc/2/object`
    });

    const person = {
      nom_complet: "Dr Test Dupont",
      tel: "01 23 45 67 89",
      email: "test@example.com",
      profession_code: "DOCTOR",
      type_acteur: "Medical",
      grande_categorie_acteur: "Healthcare",
      sous_categorie_acteur: "Physician"
    };

    const values = {
      name: person.nom_complet,
    };

    if (person.tel) {
      values.phone = person.tel;
    }
    if (person.email) {
      values.email = person.email;
    }

    // Add custom fields
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

    console.log("  Payload:", JSON.stringify(values, null, 2));
    console.log();

    const createdId = await xmlrpcCall(models, "execute_kw", [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      ODOO_MODEL,
      "create",
      [values],
    ]);

    console.log("✅ Contact created successfully!");
    console.log("  Contact ID:", createdId);

  } catch (err) {
    console.error("❌ Error:", err.message);
    if (err.faultString) {
      console.error("Fault:", err.faultString);
    }
  }
}

testCreateContact();
