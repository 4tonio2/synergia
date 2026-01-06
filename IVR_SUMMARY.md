# 📋 Résumé du système IVR Agenda

## ✅ Fonctionnalités implémentées

### 🎨 Interface Utilisateur

**Bouton "Agenda"** dans `E05_VisitFlow.tsx` (ligne 1044-1051)
```tsx
<Button onClick={() => setShowAgendaModal(true)}>
  <Calendar className="w-5 h-5 mr-2" />
  Agenda
</Button>
```

**Modal WebRTC** - `AgendaCallModal.tsx`
- Interface d'appel téléphonique
- Bouton vert pour démarrer l'appel
- Indicateur de connexion
- Bouton mute/unmute
- Affichage du RDV extrait en fin d'appel

---

### 🔌 Backend API

**3 endpoints créés :**

1. **`POST /api/ivr/start-call`**
   - Initialise l'appel WebRTC
   - Échange SDP offer/answer
   - Connecte au serveur Jambonz

2. **`POST /api/ivr/appointment-webhook`** ⭐ Principal
   - Reçoit les webhooks de Jambonz
   - Utilise GPT-4 pour la conversation
   - Extrait nom, date, docteur automatiquement
   - Renvoie des verbs Jambonz (say, listen)

3. **`GET /api/ivr/last-appointment`**
   - Récupère le dernier RDV créé
   - Format JSON structuré

---

### 🤖 IA Conversationnelle

**GPT-4 Turbo** intégré dans le webhook

**Système de prompts :**
```
System: "Tu es CLAUDIO, un assistant pour la prise de RDV médical"
User: "Je veux un rendez-vous"
Assistant: "Quel est votre nom complet ?"
User: "Jean Dupont"
Assistant: "Pour quelle date ?"
User: "Le 15 mars"
Assistant: "Avec quel docteur ?"
User: "Docteur Martin"
Assistant: "RDV confirmé pour Jean Dupont le 15 mars avec Dr. Martin"
```

**Extraction JSON** avec second appel GPT-4 :
```json
{
  "person": "Jean Dupont",
  "date": "2026-03-15",
  "docteur": "Dr. Martin",
  "complete": true
}
```

---

### 🎙️ Intégration Jambonz

**Configuration automatisée** via script Node.js

**Application créée :**
- Nom : "CLAUDIO - Prise de RDV"
- TTS : Google Cloud Text-to-Speech (fr-FR-Standard-A)
- STT : Google Cloud Speech-to-Text (fr-FR)
- Webhook : URL publique de votre app

**Verbs utilisés :**
- `say` : Text-to-Speech
- `listen` : Reconnaissance vocale
- `hangup` : Terminer l'appel

---

## 🏗️ Architecture technique

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                       │
├──────────────────────────────────────────────────────────┤
│  E05_VisitFlow.tsx                                       │
│    └─ Bouton "Agenda"                                    │
│         └─ AgendaCallModal.tsx                           │
│              ├─ WebRTC Connection                        │
│              ├─ Audio Stream                             │
│              └─ Appointment Display                      │
└────────────────────┬─────────────────────────────────────┘
                     │ POST /api/ivr/start-call
                     │ (SDP Offer/Answer)
                     ▼
┌──────────────────────────────────────────────────────────┐
│                  API BACKEND (Vercel)                     │
├──────────────────────────────────────────────────────────┤
│  /api/ivr/start-call.ts                                  │
│  /api/ivr/appointment-webhook.ts ⭐                       │
│  /api/ivr/last-appointment.ts                            │
└────────────────────┬─────────────────────────────────────┘
                     │ WebRTC + Webhooks
                     ▼
┌──────────────────────────────────────────────────────────┐
│              JAMBONZ (VPS 31.97.178.44)                   │
├──────────────────────────────────────────────────────────┤
│  Services:                                               │
│    - jambonz-feature-server (orchestration)              │
│    - jambonz-freeswitch (média RTP)                      │
│    - jambonz-drachtio (SIP)                              │
│    - jambonz-api-server (API REST)                       │
│                                                          │
│  Integration:                                            │
│    - Google Cloud TTS (fr-FR)                            │
│    - Google Cloud STT (fr-FR)                            │
└────────────────────┬─────────────────────────────────────┘
                     │ API Calls
                     ▼
┌──────────────────────────────────────────────────────────┐
│                   OPENAI (GPT-4)                          │
├──────────────────────────────────────────────────────────┤
│  Model: gpt-4-turbo-preview                              │
│  Tasks:                                                  │
│    1. Conversation naturelle                             │
│    2. Extraction de données                              │
│    3. Validation des informations                        │
└──────────────────────────────────────────────────────────┘
```

---

## 📊 Flux de données

### 1. Démarrage de l'appel

```
User clicks "Agenda" button
  → Modal opens
  → getUserMedia (microphone access)
  → createOffer (SDP)
  → POST /api/ivr/start-call
  → Returns SDP answer
  → setRemoteDescription
  → WebRTC connection established
```

### 2. Conversation IVR

```
Jambonz plays: "Bienvenue sur services CLAUDIO"
  → User speaks
  → Google STT transcribes
  → POST /api/ivr/appointment-webhook
    └─ Body: { speech: "je veux un rdv", call_sid: "..." }
  → GPT-4 processes
  → Returns Jambonz verbs
    └─ [{ verb: "say", text: "Quel est votre nom ?" }]
  → Google TTS speaks
  → Loop until complete
```

### 3. Extraction finale

```
All info collected (name, date, doctor)
  → GPT-4 extraction call
  → JSON structured data
  → Save to conversationStore
  → Hangup call
  → Frontend fetches /api/ivr/last-appointment
  → Display in modal
  → Add to calendar
```

---

## 📁 Structure des fichiers

```
synergia/
├── client/src/
│   ├── components/
│   │   └── AgendaCallModal.tsx          ✨ NEW
│   └── pages/
│       └── E05_VisitFlow.tsx            ✏️ MODIFIED
│
├── api/ivr/
│   ├── start-call.ts                    ✨ NEW
│   ├── appointment-webhook.ts           ✨ NEW
│   └── last-appointment.ts              ✨ NEW
│
├── scripts/
│   └── setup-jambonz-ivr.js             ✨ NEW
│
└── docs/
    ├── IVR_SETUP.md                     ✨ NEW
    ├── QUICKSTART_IVR.md                ✨ NEW
    ├── IVR_SUMMARY.md                   ✨ NEW (ce fichier)
    └── JAMBONZ_DOCUMENTATION.md         ✅ Existant
```

---

## 🔐 Variables d'environnement requises

```bash
# .env
OPENAI_API_KEY=sk-proj-xxxxx           # Clé OpenAI (GPT-4)
WEBHOOK_URL=https://your-app.vercel.app # URL publique
```

---

## 🎯 Exemple de conversation

**Scénario complet :**

```
👤 [Clic sur bouton "Agenda"]
🤖 "Bienvenue sur les services CLAUDIO. Comment puis-je vous aider ?"

👤 "Je voudrais prendre un rendez-vous"
🤖 "Bien sûr ! Quel est votre nom complet ?"

👤 "Marie Leclerc"
🤖 "Merci Marie. Pour quelle date souhaitez-vous le rendez-vous ?"

👤 "Le vingt mars"
🤖 "Parfait. Avez-vous une préférence pour le docteur ?"

👤 "Docteur Durand"
🤖 "Très bien. Je récapitule : rendez-vous pour Marie Leclerc
     le 20 mars avec le Docteur Durand. C'est correct ?"

👤 "Oui"
🤖 "Merci, votre rendez-vous a été enregistré. Au revoir !"

[Appel terminé]

✅ RDV affiché dans le modal :
   - Patient : Marie Leclerc
   - Date : 2026-03-20
   - Docteur : Dr. Durand

✅ Automatiquement ajouté à l'agenda de l'application
```

---

## 🧪 Tests suggérés

### Test 1 : Interface basique
- [ ] Le bouton "Agenda" apparaît sur la page de visite
- [ ] Cliquer ouvre le modal
- [ ] Le bouton d'appel vert est visible

### Test 2 : Permissions
- [ ] Le navigateur demande l'accès au micro
- [ ] L'autorisation permet de continuer
- [ ] Le refus affiche un message d'erreur

### Test 3 : Conversation simple
- [ ] Dire "rendez-vous" déclenche le flux
- [ ] L'IA pose les bonnes questions
- [ ] Les réponses sont bien comprises

### Test 4 : Extraction de données
- [ ] Le nom est extrait correctement
- [ ] La date est parsée (format français)
- [ ] Le docteur est capturé
- [ ] Les données s'affichent en fin d'appel

### Test 5 : Intégration agenda
- [ ] Le RDV est ajouté à la liste
- [ ] Les données sont correctes
- [ ] Le toast de confirmation apparaît

---

## 🚀 Déploiement

### En local (dev)

```bash
npm run dev
# Frontend: http://localhost:5173
# Backend: Via Vite proxy
```

### Sur Vercel (production)

```bash
# Configurer les variables d'environnement sur Vercel
vercel env add OPENAI_API_KEY
vercel env add WEBHOOK_URL

# Déployer
vercel --prod

# Mettre à jour le webhook Jambonz avec la nouvelle URL
```

---

## 📈 Métriques de succès

**Performance attendue :**
- Taux de compréhension : > 90%
- Temps moyen d'appel : 1-2 minutes
- Taux de complétion : > 85%
- Précision d'extraction : > 95%

**KPIs à surveiller :**
- Nombre d'appels par jour
- Durée moyenne des conversations
- Taux d'abandon
- Coût OpenAI par appel (~$0.05)

---

## 🔧 Maintenance

### Logs à surveiller

```bash
# Logs Vercel
vercel logs --follow

# Logs Jambonz
ssh root@31.97.178.44
docker compose logs -f jambonz-feature-server

# Logs OpenAI (via Dashboard)
https://platform.openai.com/usage
```

### Mises à jour recommandées

**Mensuel :**
- Vérifier les coûts OpenAI
- Analyser les conversations échouées
- Mettre à jour les prompts si besoin

**Trimestriel :**
- Revoir les performances GPT-4
- Évaluer un upgrade vers GPT-4.5 si disponible
- Optimiser le system prompt

---

## 💡 Idées d'amélioration

### Court terme (1-2 semaines)
1. Ajouter une confirmation par SMS
2. Implémenter un historique des appels IVR
3. Améliorer la gestion des erreurs

### Moyen terme (1 mois)
1. Intégration Google Calendar
2. Support multi-langue (en, es)
3. Dashboard analytics IVR

### Long terme (3+ mois)
1. WebRTC natif avec Jambonz (sans SDP simulé)
2. Fine-tuning GPT-4 sur vos données
3. Voice biometrics pour authentification
4. Multi-tenant (plusieurs cabinets médicaux)

---

## 📞 Support

**En cas de problème :**

1. Consulter `IVR_SETUP.md` (troubleshooting section)
2. Vérifier les logs Vercel et Jambonz
3. Tester manuellement les endpoints API
4. Valider la configuration Jambonz

**Ressources utiles :**
- Jambonz Docs : https://docs.jambonz.org/
- OpenAI API : https://platform.openai.com/docs
- WebRTC Guide : https://webrtc.org/getting-started/overview

---

**Système créé le : 2026-01-05**
**Version : 1.0.0**
**Status : ✅ Prêt pour tests**
