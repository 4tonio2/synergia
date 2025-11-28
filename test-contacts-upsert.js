// Script de test pour l'API /api/contacts/upsert
//
// Pré-requis :
// 1. Lancer le serveur en local : npm run dev
// 2. Vérifier que les variables Odoo (ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY)
//    et Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_KEY) sont définies.
//
// Utilisation :
// node test-contacts-upsert.js

const API_URL =
  process.env.TEST_API_URL || 'http://localhost:5000/api/contacts/upsert';

async function main() {
  const person = {
    nom_complet: 'Dr Test Dupont',
    tel: '06 11 22 33 44',
    email: 'dr.dupont@example.com',
    profession_code: 'PROF_TEST',
    type_acteur: 'Professionnels_de_santé_hors_medecins_infirmiers_pharmaciens',
    grande_categorie_acteur: 'Specialistes_geriatrie_et_services',
    sous_categorie_acteur: 'Cardiologues spécialisés seniors',
  };

  console.log("Envoi d'une requête de test à", API_URL);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person }),
    });

    console.log('Statut HTTP :', response.status);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const raw = await response.text();
      console.log('Réponse non-JSON :');
      console.log(raw);
      return;
    }

    const data = await response.json();
    console.log('Réponse JSON formatée :');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(
      "Erreur lors de l'appel à /api/contacts/upsert :",
      error,
    );
  }
}

// Node 18+ dispose de fetch globalement
main();

