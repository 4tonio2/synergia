# Extract Entities V4 - Documentation

## Vue d'ensemble

Le workflow **extract-entities-v4** est un workflow n8n unifié qui remplace les 2 webhooks précédents (`extract-contacts` et `Agent-contacts`). Il permet d'extraire et de rechercher en une seule requête :
- Les **contacts** (personnes mentionnées)
- Les **produits** (articles, quantités)
- Les **rendez-vous** (dates, heures)
- Le **client à facturer**

## Endpoint

### Webhook n8n
**URL:** `https://treeporteur-n8n.fr/webhook/extract-entities-v4`

**Méthode:** `POST`

**Body:**
```json
{
  "userQuery": "Texte à analyser..."
}
```

### API Vercel
**URL:** `/api/contacts/search`

**Méthode:** `POST`

**Body:**
```json
{
  "text": "Texte à analyser..."
}
```

## Structure de la réponse

```json
{
  "client_facture": {
    "nom_complet": "Ursula Loret",
    "tel": "",
    "email": "",
    "reconnu": true,
    "odoo_contact_id": "1072"
  },
  "persons": [
    {
      "nom_complet": "Ursula Loret",
      "tel": "",
      "email": "",
      "role_brut": "cliente",
      "is_professional": false,
      "is_client": true,
      "profession_code": "",
      "type_acteur": "Aidant/Proche",
      "grande_categorie_acteur": "Aidant/Proche",
      "sous_categorie_acteur": "Aidant/Proche",
      "reconnu": true,
      "odoo_contact_id": "1072",
      "source": "existant"
    }
  ],
  "products": [
    {
      "nom_produit": "couches",
      "quantite": 15,
      "prix_unitaire": null,
      "description": "",
      "unite": ""
    }
  ],
  "rendez_vous": [
    {
      "date": "2025-12-05",
      "heure": "14:00",
      "description": "Visite de contrôle"
    }
  ]
}
```

## Champs détaillés

### `client_facture`
Le client principal à qui facturer la prestation.

| Champ | Type | Description |
|-------|------|-------------|
| `nom_complet` | string | Nom complet du client |
| `tel` | string | Numéro de téléphone |
| `email` | string | Adresse email |
| `reconnu` | boolean | `true` si trouvé dans Odoo, `false` sinon |
| `odoo_contact_id` | string | ID Odoo du contact (si reconnu) |

**Note:** `client_facture` peut être `null` si aucun client n'est identifié.

### `persons`
Liste de toutes les personnes mentionnées dans le texte.

| Champ | Type | Description |
|-------|------|-------------|
| `nom_complet` | string | Nom complet de la personne |
| `tel` | string | Numéro de téléphone |
| `email` | string | Adresse email |
| `role_brut` | string | Rôle tel que mentionné (ex: "kiné", "aidant") |
| `is_professional` | boolean | `true` si professionnel de santé |
| `is_client` | boolean | `true` si c'est un client |
| `profession_code` | string | Code de la profession |
| `type_acteur` | string | Type d'acteur normalisé |
| `grande_categorie_acteur` | string | Grande catégorie |
| `sous_categorie_acteur` | string | Sous-catégorie |
| `reconnu` | boolean | `true` si trouvé dans Odoo |
| `odoo_contact_id` | string | ID Odoo (si reconnu) |
| `source` | string | "existant" ou "nouveau" |

**Note:** `persons` est un tableau vide `[]` si aucune personne n'est détectée.

### `products`
Liste des produits/articles mentionnés.

| Champ | Type | Description |
|-------|------|-------------|
| `nom_produit` | string | Nom du produit |
| `quantite` | number | Quantité demandée |
| `prix_unitaire` | number\|null | Prix unitaire (si disponible) |
| `description` | string | Description complémentaire |
| `unite` | string | Unité de mesure |

**Note:** `products` est un tableau vide `[]` si aucun produit n'est détecté.

### `rendez_vous`
Liste des rendez-vous mentionnés.

| Champ | Type | Description |
|-------|------|-------------|
| `date` | string | Date du RDV (format ISO ou texte) |
| `heure` | string | Heure du RDV |
| `description` | string | Description du RDV |

**Note:** `rendez_vous` est un tableau vide `[]` si aucun RDV n'est détecté.

## Exemple d'utilisation

### Frontend React

```tsx
const handleSearchContacts = async () => {
  const response = await fetch('/api/contacts/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: formData.notesRaw }),
  });

  const data = await response.json();

  setClientFacture(data.client_facture);
  setContactsResults(data.persons);
  setProducts(data.products);
  setRendezVous(data.rendez_vous);
};
```

### Backend API

```typescript
const extractResponse = await fetch(
  'https://treeporteur-n8n.fr/webhook/extract-entities-v4',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: text.trim() }),
  }
);

const data = await extractResponse.json();
// data contient: { client_facture, persons, products, rendez_vous }
```

## Test

Un script de test est disponible : `test-extract-entities.js`

```bash
node test-extract-entities.js
```

Ce script teste :
1. L'appel direct au webhook n8n
2. L'appel via l'endpoint API local
3. La validation de la structure des données

## Fichiers modifiés

- **API Backend:** `/api/contacts/search.ts` - Appelle le webhook unifié
- **Frontend:** `/client/src/pages/E05_VisitFlow.tsx` - Affiche les 4 types d'entités
- **Test:** `/test-extract-entities.js` - Script de test

## Migration depuis l'ancienne version

### Avant (2 webhooks)
```javascript
// 1. Extraction
fetch('https://treeporteur-n8n.fr/webhook/extract-contacts', ...)
// 2. Recherche pour chaque personne
fetch('https://treeporteur-n8n.fr/webhook/Agent-contacts', ...)
```

### Après (1 webhook unifié)
```javascript
// Tout en une seule requête
fetch('https://treeporteur-n8n.fr/webhook/extract-entities-v4', ...)
```

## Avantages

✅ **Performance:** 1 seul appel au lieu de N+1
✅ **Simplicité:** Structure unifiée et cohérente
✅ **Complet:** Contacts + Produits + RDV + Client facturé
✅ **Fiabilité:** Recherche Odoo intégrée dans le workflow

## Notes importantes

- Si `client_facture` est `null`, aucun client principal n'a été identifié
- Si `persons` est vide `[]`, aucune personne n'a été détectée
- Si `products` est vide `[]`, aucun produit n'a été détecté
- Si `rendez_vous` est vide `[]`, aucun RDV n'a été détecté
- Les contacts avec `reconnu: false` nécessitent une validation utilisateur avant création dans Odoo
