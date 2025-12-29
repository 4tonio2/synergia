/**
 * Test script pour vérifier le nouveau workflow unifié extract-entities-v4
 *
 * Ce script teste:
 * 1. L'appel direct au webhook n8n
 * 2. L'appel via l'endpoint API local
 *
 * Usage: node test-extract-entities.js
 */

const testText = `J'ai une cliente qui est Ursula Loret, 87 ans, et on a un kiné qui est arrivé qui s'appelle Xavier Vassor et on a besoin aussi d'avoir dans la salle de réunion, nous avons aussi un aidant qui s'appelle Laurence Vassor, la prescription va être de 15 couches et 3 piqûres étalées sur une semaine, est-ce que tu peux me faire l'envoi à l'ERP directement`;

console.log('='.repeat(80));
console.log('TEST: Extract Entities V4 Workflow');
console.log('='.repeat(80));
console.log('\nTexte à analyser:');
console.log(testText);
console.log('\n' + '='.repeat(80));

// Test 1: Appel direct au webhook n8n
async function testDirectWebhook() {
  console.log('\n[TEST 1] Appel direct au webhook n8n extract-entities-v4...\n');

  try {
    const response = await fetch('https://treeporteur-n8n.fr/webhook/extract-entities-v4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuery: testText }),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    console.log('✅ Réponse reçue avec succès!\n');
    console.log('Structure de la réponse:');
    console.log('- client_facture:', data.client_facture ? '✓' : '✗');
    console.log('- persons:', Array.isArray(data.persons) ? `✓ (${data.persons.length} contacts)` : '✗');
    console.log('- products:', Array.isArray(data.products) ? `✓ (${data.products.length} produits)` : '✗');
    console.log('- rendez_vous:', Array.isArray(data.rendez_vous) ? `✓ (${data.rendez_vous.length} RDV)` : '✗');

    console.log('\n--- CLIENT FACTURE ---');
    if (data.client_facture) {
      console.log(JSON.stringify(data.client_facture, null, 2));
    } else {
      console.log('(vide)');
    }

    console.log('\n--- PERSONS ---');
    if (data.persons && data.persons.length > 0) {
      data.persons.forEach((person, i) => {
        console.log(`\nPersonne ${i + 1}:`);
        console.log(JSON.stringify(person, null, 2));
      });
    } else {
      console.log('(vide)');
    }

    console.log('\n--- PRODUCTS ---');
    if (data.products && data.products.length > 0) {
      data.products.forEach((product, i) => {
        console.log(`\nProduit ${i + 1}:`);
        console.log(JSON.stringify(product, null, 2));
      });
    } else {
      console.log('(vide)');
    }

    console.log('\n--- RENDEZ-VOUS ---');
    if (data.rendez_vous && data.rendez_vous.length > 0) {
      data.rendez_vous.forEach((rdv, i) => {
        console.log(`\nRDV ${i + 1}:`);
        console.log(JSON.stringify(rdv, null, 2));
      });
    } else {
      console.log('(vide)');
    }

    return data;
  } catch (error) {
    console.error('❌ Erreur lors du test direct webhook:', error.message);
    throw error;
  }
}

// Test 2: Appel via l'endpoint API local (si le serveur tourne)
async function testLocalAPI() {
  console.log('\n' + '='.repeat(80));
  console.log('[TEST 2] Appel via l\'endpoint API local /api/contacts/search...\n');

  try {
    const response = await fetch('http://localhost:5000/api/contacts/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testText }),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    console.log('✅ Réponse API locale reçue avec succès!\n');
    console.log('Structure de la réponse:');
    console.log('- client_facture:', data.client_facture ? '✓' : '✗');
    console.log('- persons:', Array.isArray(data.persons) ? `✓ (${data.persons.length} contacts)` : '✗');
    console.log('- products:', Array.isArray(data.products) ? `✓ (${data.products.length} produits)` : '✗');
    console.log('- rendez_vous:', Array.isArray(data.rendez_vous) ? `✓ (${data.rendez_vous.length} RDV)` : '✗');

    console.log('\nRéponse complète:');
    console.log(JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    console.error('❌ Erreur lors du test API locale:', error.message);
    console.log('ℹ️  Assurez-vous que le serveur local est démarré (npm run dev)');
    throw error;
  }
}

// Fonction de validation
function validateResponse(data) {
  console.log('\n' + '='.repeat(80));
  console.log('[VALIDATION] Vérification de la structure de la réponse...\n');

  const errors = [];

  // Vérifier que client_facture a les bonnes propriétés
  if (data.client_facture) {
    const requiredClientFields = ['nom_complet', 'reconnu'];
    requiredClientFields.forEach(field => {
      if (!(field in data.client_facture)) {
        errors.push(`❌ Champ manquant dans client_facture: ${field}`);
      }
    });

    if (data.client_facture.reconnu && !data.client_facture.odoo_contact_id) {
      errors.push('⚠️  Client reconnu mais sans odoo_contact_id');
    }
  }

  // Vérifier la structure des persons
  if (data.persons && data.persons.length > 0) {
    data.persons.forEach((person, i) => {
      const requiredPersonFields = ['nom_complet', 'reconnu'];
      requiredPersonFields.forEach(field => {
        if (!(field in person)) {
          errors.push(`❌ Champ manquant dans persons[${i}]: ${field}`);
        }
      });

      if (person.reconnu && !person.odoo_contact_id) {
        errors.push(`⚠️  Personne ${i} reconnue mais sans odoo_contact_id`);
      }
    });
  }

  // Vérifier la structure des products
  if (data.products && data.products.length > 0) {
    data.products.forEach((product, i) => {
      if (!product.nom_produit) {
        errors.push(`❌ Produit ${i} sans nom_produit`);
      }
    });
  }

  if (errors.length === 0) {
    console.log('✅ Tous les tests de validation sont passés!');
  } else {
    console.log('Erreurs de validation:');
    errors.forEach(error => console.log(error));
  }

  return errors.length === 0;
}

// Exécution des tests
async function runTests() {
  try {
    // Test 1: Webhook direct
    const webhookData = await testDirectWebhook();
    const isValid = validateResponse(webhookData);

    // Test 2: API locale (optionnel, peut échouer si serveur non démarré)
    try {
      await testLocalAPI();
    } catch (error) {
      // Ignorer si le serveur n'est pas démarré
    }

    console.log('\n' + '='.repeat(80));
    console.log('RÉSUMÉ DES TESTS');
    console.log('='.repeat(80));
    console.log(isValid ? '✅ Tests réussis!' : '⚠️  Tests terminés avec des avertissements');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Erreur fatale lors des tests:', error);
    process.exit(1);
  }
}

// Lancer les tests
runTests();
