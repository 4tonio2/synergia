# Workflow de Recherche et Consentement de Contacts

## Vue d'ensemble

Ce document décrit le nouveau flux de gestion des contacts lorsqu'aucune correspondance n'est trouvée dans Odoo.

## Architecture avant (ancien flux)

```
POST /api/contacts/search
    ↓
n8n webhook: extract-contacts
    ↓
Pour chaque personne:
    ↓
n8n webhook: Agent-contacts
    ↓
Si match null: Retourne simplement {match: null}
Si match trouvé: Retourne {match: {...}}
    ↓
[Fin - L'UI doit décider manuellement d'appeler /api/contacts/upsert]
```

## Architecture après (nouveau flux avec consentement)

```
POST /api/contacts/search
    ↓
n8n webhook: extract-contacts
    ↓
Pour chaque personne:
    ↓
n8n webhook: Agent-contacts
    ↓
Si match null:
    ↓ Retourne {
        input: person,
        match: null,
        requiresConsent: true,
        consentAction: "pending"
      }
    ↓
[UI affiche la personne et demande le consentement]
    ↓
Utilisateur répond:
    ├─ "J'approuve" → POST /api/contacts/consent (consent: "approved")
    │                      ↓
    │                  Crée dans Odoo + Upsert Supabase
    │                      ↓
    │                  Retourne {success: true, action: "approved", ...}
    │
    └─ "Je rejette" → POST /api/contacts/consent (consent: "rejected")
                           ↓
                       Pas de création Odoo
                       Pas d'upsert Supabase
                           ↓
                       Retourne {success: true, action: "rejected", ...}
```

## Endpoints détaillés

### 1. POST `/api/contacts/search`

**Request:**
```json
{
  "text": "Visite infirmière... Dr Dupont, cardiologue..."
}
```

**Response (cas avec requiresConsent):**
```json
{
  "persons": [
    {
      "input": {
        "nom_complet": "Dr Jean Dupont",
        "tel": "06 12 34 56 78",
        "email": "jean.dupont@example.com",
        "profession_code": "CARDIO",
        "type_acteur": "Medecin",
        "grande_categorie_acteur": "Specialistes",
        "sous_categorie_acteur": "Cardiologues"
      },
      "match": null,
      "requiresConsent": true,
      "consentAction": "pending"
    }
  ]
}
```

**Statuts possibles:**
- `match: null` + `requiresConsent: true` → L'agent n'a rien trouvé, demander consentement
- `match: {...}` → L'agent a trouvé une correspondance existante
- `match: null` + `requiresConsent: false` → Pas assez de données pour rechercher

### 2. POST `/api/contacts/consent` (NOUVEAU)

Gère le consentement de l'utilisateur pour une personne sans match.

**Request (approbation):**
```json
{
  "person": {
    "nom_complet": "Dr Jean Dupont",
    "tel": "06 12 34 56 78",
    "email": "jean.dupont@example.com",
    "profession_code": "CARDIO",
    "type_acteur": "Medecin",
    "grande_categorie_acteur": "Specialistes",
    "sous_categorie_acteur": "Cardiologues"
  },
  "consent": "approved",
  "odoo_id": null
}
```

**Response (approbation):**
```json
{
  "success": true,
  "action": "approved",
  "message": "Contact approuvé et inséré avec succès",
  "odoo_id": 12345,
  "supabase": {
    "odoo_id": 12345,
    "contact_name": "Dr Jean Dupont",
    "phone": "06 12 34 56 78",
    "email": "jean.dupont@example.com",
    ...
  }
}
```

**Request (rejet):**
```json
{
  "person": {
    "nom_complet": "Dr Jean Dupont",
    ...
  },
  "consent": "rejected"
}
```

**Response (rejet):**
```json
{
  "success": true,
  "action": "rejected",
  "message": "Contact rejeté - aucun upsert effectué"
}
```

## Flux utilisateur recommandé

1. **Recherche initiale** → Appeler `POST /api/contacts/search`
2. **Affichage des résultats** → Dans l'UI:
   - Si `match !== null` → Afficher le match trouvé ✓
   - Si `match === null && requiresConsent === true` → **Afficher un dialogue de consentement**
     - Montrer les données extraites de la visite
     - Boutons: "Approuver" et "Rejeter"
   - Si `match === null && requiresConsent === false` → Données insuffisantes
3. **Traitement du consentement** → Appeler `POST /api/contacts/consent` avec la réponse
4. **Afficher le résultat** → Montrer un message de succès ou d'erreur

## Exemple complet d'intégration

```javascript
// 1. Recherche
const searchResponse = await fetch('/api/contacts/search', {
  method: 'POST',
  body: JSON.stringify({ text: notesDeVisite })
});

const { persons } = await searchResponse.json();

// 2. Traiter chaque personne
for (const person of persons) {
  if (person.match !== null) {
    // Contact trouvé dans Odoo
    console.log('Contact existant:', person.match);
  } else if (person.requiresConsent) {
    // Contact nouveau - demander consentement
    const userApproves = await showConsentDialog(person.input);

    // 3. Envoyer le consentement
    const consentResponse = await fetch('/api/contacts/consent', {
      method: 'POST',
      body: JSON.stringify({
        person: person.input,
        consent: userApproves ? 'approved' : 'rejected'
      })
    });

    const result = await consentResponse.json();
    console.log('Consentement traité:', result);
  }
}
```

## Avantages du nouveau système

✅ **Flux plus intuitif**: L'utilisateur voit immédiatement s'il y a un match ou non
✅ **Contrôle utilisateur**: Consentement explicite avant création de contact
✅ **Moins d'appels API**: Un seul appel à `/contacts/search` (au lieu de search + upsert séparés)
✅ **Sécurité**: Pas de création de contact accidentelle
✅ **Audit**: Chaque décision (approved/rejected) est tracée

## Migration depuis l'ancien flux

Si tu as des appels à `/api/contacts/upsert` dans ton code:

**Ancien code:**
```javascript
// Appel manuel d'upsert après recherche
const result = await fetch('/api/contacts/upsert', {
  method: 'POST',
  body: JSON.stringify({ person: data })
});
```

**Nouveau code:**
```javascript
// Utiliser /contacts/consent à la place
const result = await fetch('/api/contacts/consent', {
  method: 'POST',
  body: JSON.stringify({
    person: data,
    consent: 'approved' // ou 'rejected'
  })
});
```

## Testing

Utilise le script de test fourni:

```bash
node test-contacts-consent-workflow.js
```

Ce script teste:
1. La recherche de contacts (identifie ceux nécessitant un consentement)
2. L'approbation d'un contact (création Odoo + upsert Supabase)
3. Le rejet d'un contact (pas de création)
