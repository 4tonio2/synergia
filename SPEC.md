# SPEC - Synergia

Version: 1.0
Auteur: Equipe 43
Date: 30 décembre 2025

## 1. Résumé exécutif

Synergia est une application web professionnelle destinée aux soignants (infirmiers, médecins, kinésithérapeutes, aidants professionnels). Elle permet l'enregistrement et la gestion des visites à domicile, la capture audio (enregistrement/transcription), l'assistance IA (résumés, transmissions), la gestion des patients et des alertes, et l'intégration d'un annuaire/prospection via Odoo + embeddings Supabase.

Cette spécification formalise les objectifs produit, le périmètre, l'architecture, les modèles de données, les API, les exigences non-fonctionnelles (sécurité, conformité RGPD/HDS), la stratégie de tests, la CI/CD et une roadmap de livraison.

---

## 2. Objectifs & succès

Objectif principal
- Fournir une application sûre et robuste qui aide les professionnels de santé à documenter efficacement les visites à domicile, avec des résumés IA et une transcription fiable.

Succès mesurable
- Temps moyen pour documenter une visite < 5 min (cible UX).
- Précision de transcription utile pour l'assistant IA (qualité humaine augmentée).
- Conformité RGPD (consentement stockage, logs d'accès).
- 99.9% disponibilité de l'API en production (SLA interne).

---

## 3. Périmètre fonctionnel

Inclus
- Authentification via OpenID (Replit Auth / Supabase token usage côté serveur).
- Gestion multi-rôles (infirmier, medecin, kinesitherapeute, aidant_pro).
- CRUD utilisateurs (profil et rôle), patients, visites/enregistrements.
- Capture audio -> transcription (Whisper) et synthèse vocale (OpenAI TTS).
- Résumés et transmissions par IA (GPT-4 style prompts).
- Recherche/extraction d'entités via webhook n8n + ingestion dans Supabase embeddings.
- Upsert/consentement de contacts vers Odoo et Supabase ingestion.

Hors périmètre (phase 1)
- Paiement/monétisation.
- Module complet de planning/agenda avancé.

---

## 4. Utilisateurs et personas

- Infirmier(ère): capture visites, enregistrements, demande résumés IA, gère consentements patients.
- Médecin: consulte transmissions, priorise alertes graves.
- Kinésithérapeute / Aidant: usages proches de l'infirmier mais flux métier spécifiques.
- Admin / Product Owner: gestion des utilisateurs, supervision.

---

## 5. Contexte technique & stack

- Frontend: React, Wouter (routing), TailwindCSS, Shadcn UI. Code sous `client/src` (ex: `client/src/App.tsx`, `client/src/main.tsx`). React Query (`@tanstack/react-query`) pour data fetching.
- Backend: Node.js + Express (fichiers principaux `server/app.ts`, `server/routes.ts`).
- DB: PostgreSQL, Drizzle ORM (`shared/schema.ts`).
- Stockage/ingestion HNLP: Supabase (ingestion embeddings) + table configurable via env.
- IA: OpenAI (embeddings, chat completions, audio speech / whisper).
- Intégrations: Odoo via XML-RPC, n8n webhook pour extraction d'entités, SMTP via nodemailer.
- Déploiement: Vercel (front) / Node server (serverless ou conteneur). Le projet a `vite` pour build.

Fichiers clefs à consulter:
- Backend routes: `server/routes.ts`
- Schéma DB + types: `shared/schema.ts`
- Front routes/pages: `client/src/App.tsx` (liste des pages)
- Entrée server: `server/app.ts`

---

## 6. Architecture logique

1. Frontend SPA <-> API Express `/api/*`
2. API: Auth middleware vérifie Bearer token (Supabase JWT via `getUserFromToken`) puis accès `storage` (couche d'accès DB) pour manipuler `users`, `patients`, `visits`, `alerts`.
3. IA: certaines routes appellent OpenAI (chat, embedding, audio.speech, audio.transcriptions).
4. Enrichissements: appel webhook n8n pour extraction d'entités puis ingestion embedding en Supabase.
5. Synchronisation annuaire: création/upsert vers Odoo (XML-RPC) et ingestion Supabase (table `contact_embeddings`).

Flux de données (exemples):
- Enregistrement audio -> `/api/voice/transcribe` (whisper) -> transcription -> `visits` creation -> `/api/ai/summary` pour résumé -> store `aiSummary` dans `visits`.
- Notes texte -> `/api/contacts/search` -> n8n extraction -> UI propose consentement -> `/api/contacts/consent` pour upsert Odoo+Supabase.

---

## 7. Modèle de données (résumé)

Basé sur `shared/schema.ts` (source de vérité):
- `users`: id, email, firstName, lastName, profileImageUrl, medicalRole, createdAt, updatedAt
- `sessions`: sid, sess, expire
- `auth_logs`: logs d'authentification (action, ip, userAgent, metadata, timestamp)
- `patients`: id, userId, name, age, address, phoneNumber, medicalTags (jsonb), riskLevel, audioConsent, audioConsentDate, nextVisitTime, profileImageUrl
- `visits`: id, userId, patientId, visitDate, durationSeconds, audioFileUrl, transcription, aiSummary, visitType, painLevel, vitalSigns, alerts (jsonb), riskLevel, validated, processing, notes
- `alerts`: id, userId, patientId, visitId, level, description, actionRequired, isRead

Conseil: utiliser les Zod schemas déjà fournis (`createInsertSchema`, `updateUserProfileSchema`, etc.) comme source de validation pour contracts API.

---

## 8. Endpoints API (inventaire & contrat minimal)

Résumé des endpoints principaux (voir implémentation complète dans `server/routes.ts`):

- POST /api/auth/apply-pending-role
  - Auth: OUI (middleware `isAuthenticated`)
  - Payload: { medicalRole }
  - Action: upsert user si absent, appliquer rôle, log auth event

- GET /api/auth/user
  - Auth: optional (Bearer accepted)
  - Retour: l'objet `user` depuis DB ou null

- PATCH /api/users/role
  - Auth: OUI
  - Payload: { medicalRole }
  - Action: change role, retourne user

- PATCH /api/users/:id
  - Auth: OUI (user ne peut éditer que son profil)
  - Payload: { firstName?, lastName?, medicalRole? }

- POST /api/auth/logout
  - Auth: OUI
  - Action: log out event

- POST /api/ai/summary
  - Auth: non strict (peut être public) — valide body
  - Payload: { patientName, patientAge, visitType, painLevel, notesRaw }
  - Action: appelle OpenAI chat completions (prompt médical) -> return { summary }

- POST /api/ai/transmission
  - Payload: { patientName, patientAge, visitType, painLevel, notesRaw, notesSummary? }
  - Action: GPT SBAR -> return { transmission }

- POST /api/voice/synthesize
  - Payload: { text }
  - Action: OpenAI TTS -> base64 audio

- POST /api/voice/transcribe
  - Payload: multipart form with file field `audio`
  - Action: Whisper transcription (language fr), return { text }

- POST /api/contacts/search
  - Payload: { text }
  - Action: appelle webhook n8n -> renvoie structure extraites (client_facture, persons, products, rendez_vous)

- POST /api/contacts/consent
  - Payload: { person, consent: 'approved'|'rejected', odoo_id? }
  - Action: si approved -> éventuellement create contact Odoo -> generate embedding -> upsert Supabase

- POST /api/contacts/upsert
  - Payload: { person, odoo_id? }
  - Action: create Odoo if needed + upsert embedding Supabase

- POST /api/notifications/send-email
  - Payload: { to, subject, text, html, from? }
  - Action: envoie via nodemailer (mode dev autorise non-authenticated)

Conseils API
- Documenter schémas request/response (OpenAPI/YAML ou Postman collection minimal).
- Standardiser erreurs: { error: string, details?: any } et codes 4xx/5xx.

---

## 9. Auth & sécurité

- Auth middleware: vérifie JWT Bearer, récupère user via `getUserFromToken` (Supabase). Toujours vérifier côté serveur (ne pas se fier au client).
- Permissions: endpoints sensibles (`/api/users/:id`, `/api/users/role`, notifications en production) doivent être restreints.
- Logs d'audit: `auth_logs` déjà présent pour login/logout/role_change/profile_update — conserver immuabilité et temps UTC.
- Données de santé: appliquer chiffrement au repos sur la base de données si hébergée par un tiers. Restreindre accès aux backups.
- Consentement audio: champ `audioConsent` et `audioConsentDate` sur patient — UI doit forcer la collecte du consentement avant stockage audio.
- Sanitize inputs: use zod schemas from `shared/schema.ts` pour valider et assainir body des requêtes.
- Limitation de taux: appliquer rate-limiting sur endpoints IA & upload audio pour éviter abus.
- Secrets: stocker OPENAI_API_KEY, SUPABASE_KEY_1, ODOO_* dans secret manager (Vercel env ou vault). Ne pas exposer dans logs.

Conformité
- RGPD: droits d'accès, droit à l'oubli (procédure pour suppression), logs d'accès utilisateur.
- HDS: si requis, hébergement certifié et chiffrage fort. Prévoir évaluation si le produit opèrera sur données sensibles à grande échelle.

---

## 10. Non-fonctionnel (NFR)

- Performance: 95% des requêtes API < 300ms hors IA. IA/transcription des fichiers seront plus lentes (Whisper/E/IO bound).
- Disponibilité: dorénavant viser 99.9% pour API critique.
- Stockage audio: max 25MB uploads indiqué dans `routes.ts` (multer limit) — conserver ce réglage.
- Scalabilité: découpler ingestion embeddings et processing IA (workers / queues) si volume augmente.

---

## 11. Stratégie de tests

Types tests recommandés
1. Unit tests: fonctions utilitaires, validateurs Zod. (Jest / Vitest)
2. Integration tests (API): supertest + in-memory DB or test Postgres container (ou test db) pour routes critiques (`/api/auth/*`, `/api/voice/*`, `/api/contacts/*`).
3. E2E: Playwright/Cypress pour parcours clé: login, enregistrement visite, transcription, résumé IA, consentement contact.
4. Contract tests: vérifier schéma request/response (OpenAPI contract tests)

Tests prioritaires
- `/api/voice/transcribe` (upload + error cases)
- `/api/ai/summary` & `/api/ai/transmission` (réponses formatées et erreurs gérées)
- Consent flow `/api/contacts/consent` (approved + rejected)

Scripts recommandés
- Ajouter `test:unit`, `test:integration`, `test:e2e` dans `package.json`.

---

## 12. CI/CD

Pipeline (GitHub Actions recommandée)
- On pull_request / push main:
  - checkout
  - install dependencies (npm ci)
  - run lint (tsc & eslint si configuré)
  - run unit tests
  - build client (vite)
  - run integration tests (optionnel sur DB test)
  - on success: deploy to staging (Vercel / environment preview)

Productions
- Déploiement production automatisé sur push tag / merge main -> Vercel (front) + container/Serverless function pour API.
- Gérer les migrations Drizzle via `drizzle-kit` (`npm run db:push`).

---

## 13. Déploiement & variables d'environnement

Variables essentielles (non-exhaustif, à enrichir depuis code):
- OPENAI_API_KEY
- OPENAI_EMBEDDING_MODEL (optionnel)
- SUPABASE_URL_1, SUPABASE_KEY_1
- SUPABASE_TABLE_1 (default contact_embeddings)
- ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_PASSWORD (ou ODOO_API_KEY), ODOO_MODEL
- NODE_ENV, PORT
- SMTP configs (pour nodemailer)

Procédure
- Configurer secrets via Vercel/Cloud provider
- Appliquer `drizzle-kit push` pour migrations

---

## 14. Observabilité

- Logging: centraliser logs structurés (JSON) pour API (ajout d'un transportage vers un service ou fichier si nécessaire).
- Monitoring: endpoints health (`/api/health` si non présent -> ajouter) + Uptime check.
- Traces: envisager OpenTelemetry pour suivre appels IA/Whisper coûteux.

---

## 15. Roadmap & jalons (proposition)

Phase 0 - Stabilisation (2-3 semaines)
- Hardening auth & sessions, tests unitaires, docs d'installation
- Acceptance: build prod réussi, tests unitaires > 80%

Phase 1 - Core (3-4 semaines)
- Enregistrement visite audio -> transcription -> stockage `visits`
- IA résumé & transmission endpoints
- Consentement contacts + ingestion Supabase
- Acceptance: end-to-end pour visite (audio -> transcription -> summary) success

Phase 2 - Scalabilité & Sécurité (3 semaines)
- Worker queue pour embedding + rate limiting
- Audit sécurité & RGPD

Phase 3 - UX & polish (2-3 semaines)
- Amélioration UI, offline mode, tests E2E

Estimation totale: ~10-12 semaines pour 1.0 (équipe 2 devs full-time)

---

## 16. Critères d'acceptation (exemples)

- Feature: Transcription audio
  - Given: Un audio upload correct (<=25MB)
  - When: POST `/api/voice/transcribe` avec fichier `audio`
  - Then: 200 OK + JSON { text } and `text.length > 0`

- Feature: Résumé IA
  - Given: notes de visite textuelles
  - When: POST `/api/ai/summary`
  - Then: 200 OK + { summary } contenant 2-5 lignes au maximum

- Sécurité: Auth
  - Given: requête sans Bearer token sur endpoint protégé
  - Then: 401 Unauthorized

---

## 17. Risques & mitigations

- Dépendance aux APIs externes (OpenAI, Supabase, Odoo, n8n) -> Mitigation: retries, circuits breakers, fallbacks (dégradation gracefull)
- Données sensibles -> Mitigation: chiffrement au repos, audits, logs d'accès, politiques de rétention
- Coûts IA -> Mitigation: batch embeddings, quotas, prétraitement pour réduire tokens

---

## 18. Checklist de livraison (PR produit)

- [ ] SPEC.md ajouté
- [ ] Tests unitaires ajoutés / modifiés
- [ ] Scripts CI minimal
- [ ] Migrations Drizzle à jour (si schema modifié)
- [ ] Variables d'env listées dans `.env.example`
- [ ] Documenter endpoints critiques (OpenAPI ou Postman)


Fin de la spec.
