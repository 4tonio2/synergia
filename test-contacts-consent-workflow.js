// Script de test pour le flux complet de recherche et consentement de contacts
//
// Pré-requis :
// 1. Lancer le serveur en local : npm run dev
// 2. Vérifier que :
//    - Les webhooks n8n sont accessibles depuis ta machine
//    - Les variables Odoo (ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY)
//    - Les variables Supabase (SUPABASE_URL_1, SUPABASE_KEY_1)
//
// Utilisation :
// node test-contacts-consent-workflow.js
//
// Ce script teste :
// 1. La recherche de contacts avec le nouveau système de consentement
// 2. L'approbation d'un contact (upsert automatique)
// 3. Le rejet d'un contact (pas d'upsert)

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';

// Couleurs pour l'affichage en console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(color, ...args) {
  console.log(`${color}`, ...args, colors.reset);
}

async function step(description) {
  log(colors.cyan, `\n▶ ${description}`);
}

async function success(message) {
  log(colors.green, `✓ ${message}`);
}

async function error(message) {
  log(colors.red, `✗ ${message}`);
}

async function testContactSearch() {
  await step('Test 1: Recherche de contacts (sans match)');

  const sampleText = `
Visite infirmière à domicile.
J'ai rencontré le Dr Jean Dupont, cardiologue, joignable au 06 12 34 56 78, email: jean.dupont@example.com.
Nous avons aussi parlé avec Mme Marie Martin, infirmière libérale, 05 23 45 67 89.
`;

  try {
    const response = await fetch(`${API_BASE_URL}/contacts/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sampleText }),
    });

    if (!response.ok) {
      error(`Erreur HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));

    // Filtrer les résultats pour trouver ceux qui nécessitent un consentement
    const personsNeedingConsent = data.persons.filter(
      (p) => p.match === null && p.requiresConsent === true,
    );

    if (personsNeedingConsent.length > 0) {
      success(
        `${personsNeedingConsent.length} contact(s) trouvé(s) nécessitant un consentement`,
      );
      return personsNeedingConsent;
    } else {
      error('Aucun contact nécessitant un consentement trouvé');
      return [];
    }
  } catch (err) {
    error(`Exception lors de la recherche: ${err.message}`);
    return null;
  }
}

async function testConsentApproved(person) {
  await step(`Test 2a: Approbation d'un contact - ${person.input.nom_complet}`);

  try {
    const response = await fetch(`${API_BASE_URL}/contacts/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person: person.input,
        consent: 'approved',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      error(`Erreur HTTP ${response.status}: ${JSON.stringify(errorBody)}`);
      return null;
    }

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));

    if (data.success && data.action === 'approved') {
      success(
        `Contact approuvé et inséré avec odoo_id: ${data.odoo_id}`,
      );
      return data;
    } else {
      error('Réponse inattendue lors de l\'approbation');
      return null;
    }
  } catch (err) {
    error(`Exception lors de l'approbation: ${err.message}`);
    return null;
  }
}

async function testConsentRejected(person) {
  await step(`Test 2b: Rejet d'un contact - ${person.input.nom_complet}`);

  try {
    const response = await fetch(`${API_BASE_URL}/contacts/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person: person.input,
        consent: 'rejected',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      error(`Erreur HTTP ${response.status}: ${JSON.stringify(errorBody)}`);
      return null;
    }

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));

    if (data.success && data.action === 'rejected') {
      success('Contact rejeté avec succès (aucun upsert effectué)');
      return data;
    } else {
      error('Réponse inattendue lors du rejet');
      return null;
    }
  } catch (err) {
    error(`Exception lors du rejet: ${err.message}`);
    return null;
  }
}

async function main() {
  log(colors.bright, '\n========================================');
  log(colors.bright, '  Test Workflow: Recherche + Consentement');
  log(colors.bright, '========================================\n');

  // Test 1: Recherche de contacts
  const contactsNeedingConsent = await testContactSearch();

  if (!contactsNeedingConsent || contactsNeedingConsent.length === 0) {
    log(
      colors.yellow,
      '\n⚠ Aucun contact nécessitant un consentement pour continuer les tests',
    );
    return;
  }

  // Test 2a: Approbation du premier contact (s'il existe)
  if (contactsNeedingConsent.length > 0) {
    await testConsentApproved(contactsNeedingConsent[0]);
  }

  // Test 2b: Rejet du deuxième contact (s'il existe)
  if (contactsNeedingConsent.length > 1) {
    await testConsentRejected(contactsNeedingConsent[1]);
  } else if (contactsNeedingConsent.length === 1) {
    log(colors.yellow, '\n⚠ Un seul contact trouvé, test de rejet ignoré');
  }

  log(colors.bright, '\n========================================');
  log(colors.bright, '  Tests complétés');
  log(colors.bright, '========================================\n');
}

// Node 18+ dispose de fetch globalement
main().catch((err) => {
  error(`Erreur générale: ${err.message}`);
  process.exit(1);
});
