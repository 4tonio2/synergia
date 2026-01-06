# Configuration IVR - Prise de rendez-vous téléphonique

## Vue d'ensemble

Ce système permet aux utilisateurs de prendre des rendez-vous médicaux par téléphone via un IVR (Interactive Voice Response) intelligent alimenté par GPT-4.

### Fonctionnalités

- **Accueil vocal** : "Bienvenue sur les services CLAUDIO"
- **Reconnaissance vocale** : Speech-to-Text en français
- **IA conversationnelle** : GPT-4 pour extraire les informations
- **Extraction automatique** : Nom du patient, date du RDV, docteur
- **Interface WebRTC** : Appel directement depuis le navigateur
- **Format JSON** : Données structurées pour intégration

---

## Architecture

```
┌─────────────────┐
│  Navigateur     │
│  (WebRTC)       │
└────────┬────────┘
         │ SDP Offer
         ▼
┌─────────────────┐
│  /api/ivr/      │
│  start-call     │
└────────┬────────┘
         │ SDP Answer
         ▼
┌─────────────────┐
│   Jambonz       │
│   FreeSWITCH    │
│   Drachtio      │
└────────┬────────┘
         │ Webhook POST
         ▼
┌─────────────────┐
│  /api/ivr/      │
│  appointment-   │
│  webhook        │
└────────┬────────┘
         │ GPT-4
         ▼
┌─────────────────┐
│  OpenAI API     │
│  (GPT-4)        │
└────────┬────────┘
         │ JSON
         ▼
┌─────────────────┐
│  Frontend       │
│  (Agenda Modal) │
└─────────────────┘
```

---

## Installation

### 1. Prérequis

- Node.js 18+
- Compte Jambonz configuré (voir `JAMBONZ_DOCUMENTATION.md`)
- Clé API OpenAI (GPT-4 access)
- Domaine public pour les webhooks (ngrok, Vercel, etc.)

### 2. Variables d'environnement

Ajouter dans `.env` :

```bash
# OpenAI API
OPENAI_API_KEY=sk-...

# Webhook URL (domaine public)
WEBHOOK_URL=https://votre-app.vercel.app

# Jambonz (optionnel si configuration manuelle)
JAMBONZ_API_URL=http://31.97.178.44:3001/v1
JAMBONZ_USERNAME=Treeporteur
JAMBONZ_PASSWORD=Treeporteursas2025#
```

### 3. Configuration Jambonz

#### Option A : Script automatique

```bash
cd scripts
node setup-jambonz-ivr.js
```

#### Option B : Configuration manuelle

1. Connectez-vous à l'interface Jambonz : `http://31.97.178.44`
2. Allez dans **Applications > Add Application**
3. Remplissez :
   - **Name** : CLAUDIO - Prise de RDV
   - **Call Hook** :
     - URL : `https://votre-app.vercel.app/api/ivr/appointment-webhook`
     - Method : POST
   - **Speech Synthesis** :
     - Vendor : Google
     - Language : fr-FR
     - Voice : fr-FR-Standard-A
   - **Speech Recognition** :
     - Vendor : Google
     - Language : fr-FR
4. Cliquez sur **Create**

### 4. Associer un numéro (optionnel)

Si vous voulez recevoir des appels téléphoniques réels :

1. Allez dans **Phone Numbers > Add Number**
2. Entrez le numéro (format E.164 : +33...)
3. Sélectionnez l'application **CLAUDIO - Prise de RDV**
4. Cliquez sur **Save**

---

## Utilisation

### Depuis l'interface web

1. Ouvrir une visite patient (page E05_VisitFlow)
2. Cliquer sur le bouton **Agenda** (icône calendrier)
3. Une modale s'ouvre avec un bouton d'appel vert
4. Cliquer sur le bouton pour démarrer l'appel
5. Dire "rendez-vous" ou "je veux prendre un rendez-vous"
6. L'IA vous pose des questions :
   - Quel est votre nom ?
   - Pour quelle date souhaitez-vous le rendez-vous ?
   - Avec quel docteur ?
7. Confirmer les informations
8. L'appel se termine et le RDV est automatiquement ajouté

### Flux conversationnel

**Exemple de conversation :**

```
🤖 Bienvenue sur les services CLAUDIO. Comment puis-je vous aider ?
👤 Je voudrais prendre un rendez-vous

🤖 Bien sûr ! Quel est votre nom complet ?
👤 Jean Dupont

🤖 Merci Jean. Pour quelle date souhaitez-vous le rendez-vous ?
👤 Le 15 mars prochain

🤖 Parfait. Avez-vous une préférence pour le docteur ?
👤 Docteur Martin

🤖 Très bien. Je récapitule : rendez-vous pour Jean Dupont le 15 mars avec le Docteur Martin. C'est correct ?
👤 Oui

🤖 Merci, votre rendez-vous a été enregistré. Au revoir !
```

---

## API Endpoints

### POST `/api/ivr/start-call`

Démarre un appel WebRTC.

**Request :**
```json
{
  "sdp": "v=0...",
  "type": "offer"
}
```

**Response :**
```json
{
  "sdp": "v=0...",
  "type": "answer"
}
```

### POST `/api/ivr/appointment-webhook`

Webhook appelé par Jambonz lors de l'appel.

**Request (Jambonz) :**
```json
{
  "call_sid": "uuid-...",
  "speech": "je veux un rendez-vous",
  "from": "+33123456789",
  "to": "+33987654321",
  "call_status": "in-progress"
}
```

**Response (Verbs Jambonz) :**
```json
[
  {
    "verb": "say",
    "text": "Quel est votre nom complet ?",
    "voice": "Google.fr-FR-Standard-A"
  },
  {
    "verb": "listen",
    "actionHook": "/api/ivr/appointment-webhook",
    "transcribe": {
      "language": "fr-FR"
    }
  }
]
```

### GET `/api/ivr/last-appointment`

Récupère le dernier rendez-vous créé.

**Response :**
```json
{
  "person": "Jean Dupont",
  "date": "2026-03-15",
  "docteur": "Dr. Martin",
  "phone": "+33123456789",
  "callSid": "uuid-...",
  "createdAt": "2026-01-05T10:30:00.000Z"
}
```

---

## Composants Frontend

### `AgendaCallModal.tsx`

Composant React pour l'interface WebRTC.

**Props :**
- `isOpen: boolean` - État d'ouverture du modal
- `onClose: () => void` - Callback de fermeture
- `onAppointmentCreated: (appointment) => void` - Callback avec le RDV extrait

**États de l'appel :**
- `idle` : En attente
- `connecting` : Connexion en cours
- `connected` : Appel en ligne
- `ended` : Appel terminé

---

## Customisation

### Modifier le message d'accueil

Éditer `/api/ivr/appointment-webhook.ts` ligne ~40 :

```typescript
{
  verb: 'say',
  text: 'Bienvenue sur les services CLAUDIO. Comment puis-je vous aider ?',
  voice: 'Google.fr-FR-Standard-A'
}
```

### Changer la voix

Voix Google disponibles pour le français :
- `fr-FR-Standard-A` : Voix féminine (par défaut)
- `fr-FR-Standard-B` : Voix masculine
- `fr-FR-Standard-C` : Voix féminine
- `fr-FR-Standard-D` : Voix masculine
- `fr-FR-Wavenet-A` : Voix féminine (meilleure qualité)
- `fr-FR-Wavenet-B` : Voix masculine (meilleure qualité)

### Modifier les questions de l'IA

Éditer le `systemPrompt` dans `/api/ivr/appointment-webhook.ts` ligne ~68 :

```typescript
const systemPrompt = `Tu es CLAUDIO, un assistant téléphonique pour la prise de rendez-vous médical.
Ta mission est de collecter de manière naturelle et conversationnelle :
1. Le nom complet du patient
2. La date souhaitée du rendez-vous
3. Le docteur demandé (optionnel)

Sois chaleureux, professionnel et pose UNE question à la fois.`;
```

### Ajouter des champs supplémentaires

1. Modifier l'interface `extractedData` dans `/api/ivr/appointment-webhook.ts`
2. Ajouter les champs dans le prompt d'extraction GPT-4
3. Mettre à jour l'interface `AppointmentData` dans `AgendaCallModal.tsx`

---

## Debugging

### Vérifier les logs Jambonz

```bash
ssh root@31.97.178.44
cd /opt/jambonz/jambonz-install
docker compose logs -f jambonz-feature-server
```

### Tester le webhook manuellement

```bash
curl -X POST http://31.97.178.44:3001/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"Treeporteur","password":"Treeporteursas2025#"}'

# Utiliser le token retourné pour tester l'application
```

### Tester l'extraction GPT-4

```bash
curl -X POST https://votre-app.vercel.app/api/ivr/appointment-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "call_sid": "test-123",
    "speech": "je veux un rendez-vous le 15 mars avec le docteur Martin pour Jean Dupont",
    "call_status": "in-progress"
  }'
```

---

## Limitations actuelles

1. **WebRTC** : Le endpoint `/api/ivr/start-call` génère un SDP simulé. Pour une vraie connexion, il faut router via FreeSWITCH/Drachtio de Jambonz.

2. **Storage** : Les conversations sont stockées en mémoire. En production, utiliser Redis ou PostgreSQL.

3. **Concurrence** : Seul le dernier rendez-vous est accessible via `/last-appointment`. Implémenter un système de sessions pour gérer plusieurs appels simultanés.

4. **Timeout** : L'appel se termine après 10 secondes sans réponse. Ajustable dans le verb `listen`.

---

## Améliorations futures

- [ ] Intégration WebRTC réelle avec Jambonz
- [ ] Stockage persistant (Redis/PostgreSQL)
- [ ] Gestion multi-appels simultanés
- [ ] Confirmation par SMS après le RDV
- [ ] Calendar sync (Google Calendar, Outlook)
- [ ] Historique des appels IVR
- [ ] Metrics et analytics
- [ ] Support multi-langues (en, es, etc.)
- [ ] Authentification des appelants

---

## Support

Pour toute question :

1. Consulter la documentation Jambonz : https://docs.jambonz.org/
2. Voir les verbs disponibles : https://docs.jambonz.org/webhooks/overview/
3. API Jambonz : https://api.jambonz.org/

---

*Dernière mise à jour : 2026-01-05*
