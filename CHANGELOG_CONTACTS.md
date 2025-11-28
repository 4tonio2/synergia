# Changelog - Système de Consentement de Contacts

## Version 2.0 - Workflow avec Consentement

### 📋 Changements majeurs

#### 1. Modification du endpoint `POST /api/contacts/search`

**Avant:**
- Retournait `{match: null}` quand l'agent ne trouvait rien
- L'UI devait décider manuellement d'appeler `/api/contacts/upsert`

**Après:**
- Retourne maintenant des propriétés supplémentaires quand `match === null`:
  - `requiresConsent: boolean` - Indique si un consentement est nécessaire
  - `consentAction: string` - État du consentement ("pending", "approved", "rejected")
- L'UI peut maintenant afficher un dialogue de consentement

#### 2. Nouvel endpoint `POST /api/contacts/consent` (NOUVEAU)

**Objectif:** Gérer le consentement de l'utilisateur et déclencher automatiquement l'upsert

**Paramètres:**
- `person`: Objet personne extraite
- `consent`: "approved" ou "rejected"
- `odoo_id` (optionnel): ID Odoo existant si connu

**Comportement:**
- **Si consent = "approved"**:
  1. Crée le contact dans Odoo (si pas d'ID)
  2. Génère l'embedding OpenAI
  3. Upsert dans Supabase
  4. Retourne `{success: true, action: "approved", odoo_id, supabase}`

- **Si consent = "rejected"**:
  1. Aucune création Odoo
  2. Aucun upsert Supabase
  3. Retourne `{success: true, action: "rejected"}`

### 🔄 Flux détaillé

```
User Voice Input (notes de visite)
        ↓
POST /api/contacts/search
        ↓
Extract Persons + Search Odoo
        ↓
┌─────────────────────┐
│ For Each Person     │
└─────────────────────┘
        ↓
   Match found?
   /        \
  YES       NO
  /          \
Match    {requiresConsent: true}
         |
    Show Consent Dialog
         |
    User Decision
      /      \
 Approve   Reject
    |         |
    ├─ POST /api/contacts/consent (approved)
    │         |
    │   Create Odoo + Supabase
    │
    └─ POST /api/contacts/consent (rejected)
              |
          No Database Action
```

### 📝 Types TypeScript modifiés

```typescript
interface ContactSearchResult {
  input: any;
  match: any | null;
  requiresConsent?: boolean;      // NEW
  consentAction?: string;          // NEW: "pending" | "approved" | "rejected"
}
```

### ✅ Tests inclus

**Fichier:** `test-contacts-consent-workflow.js`

Tests le workflow complet:
1. Recherche de contacts
2. Approbation d'un contact
3. Rejet d'un contact

Usage:
```bash
node test-contacts-consent-workflow.js
```

### 📚 Documentation

**Fichier:** `CONTACTS_CONSENT_WORKFLOW.md`

Contient:
- Architecture détaillée
- Exemples de requêtes/réponses
- Flux utilisateur recommandé
- Exemples d'intégration JavaScript
- Guide de migration

### 🔒 Considérations de sécurité

✅ **Consentement explicite** - Aucune création sans approbation
✅ **Validation des entrées** - Les champs obligatoires sont vérifiés
✅ **Gestion d'erreurs** - Tous les appels Odoo/Supabase sont try-catch
✅ **Logs détaillés** - Chaque action est loggée avec [CONTACTS]

### 📊 Statistiques des changements

- **Fichiers modifiés:** 1
  - `server/routes.ts`: +135 lignes (nouvel endpoint `/api/contacts/consent`)

- **Fichiers créés:** 3
  - `test-contacts-consent-workflow.js` - Tests du workflow
  - `CONTACTS_CONSENT_WORKFLOW.md` - Documentation
  - `CHANGELOG_CONTACTS.md` - Ce fichier

### 🚀 Prochaines étapes recommandées

1. **Intégration Frontend:**
   - Créer un composant React pour le dialogue de consentement
   - Appeler `/api/contacts/consent` lors de la décision utilisateur

2. **Tests en environnement:**
   - Exécuter `test-contacts-consent-workflow.js` en dev
   - Tester l'intégration complète en prod

3. **Monitoring:**
   - Ajouter des métriques sur les approbations/rejets
   - Surveiller les erreurs Odoo/Supabase

### ⚠️ Notes importantes

- Le endpoint `/api/contacts/upsert` reste inchangé pour la compatibilité
- Les logs contiennent `[CONTACTS]` pour faciliter le débogage
- Tous les embeddings sont générés via OpenAI (frais API)
- Les opérations Odoo nécessitent les variables d'env ODOO_*
- Les opérations Supabase nécessitent SUPABASE_URL_1 et SUPABASE_KEY_1
