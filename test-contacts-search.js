// Script de test pour l'API /api/contacts/search
//
// Pré-requis :
// 1. Lancer le serveur en local : npm run dev
// 2. Vérifier que les webhooks n8n sont accessibles depuis ta machine
//
// Utilisation :
// node test-contacts-search.js

const API_URL = process.env.TEST_API_URL || 'http://localhost:5000/api/contacts/search';

async function main() {
  const sampleText = `
Visite infirmière à domicile.
J'ai rencontré le Dr Dupont, cardiologue, joignable au 06 12 34 56 78.
Nous avons aussi échangé avec Dr Faniry.
`;

  console.log('Envoi d\'une requête de test à', API_URL);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sampleText }),
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
    console.error('Erreur lors de l\'appel à /api/contacts/search :', error);
  }
}

// Node 18+ dispose de fetch globalement
main();

