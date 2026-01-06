# 🚀 Quick Start - IVR Agenda

## Ce qui a été ajouté

✅ **Bouton "Agenda"** dans la page d'enregistrement de visite
✅ **Modal WebRTC** pour passer un appel téléphonique
✅ **Webhook IVR** avec IA conversationnelle GPT-4
✅ **Extraction automatique** du nom, date et docteur
✅ **Script de configuration** Jambonz automatisé

---

## Démarrage rapide (5 minutes)

### 1. Configuration des variables d'environnement

Ajouter dans votre fichier `.env` :

```bash
# Clé API OpenAI (nécessaire pour l'IA conversationnelle)
OPENAI_API_KEY=sk-proj-...

# URL publique de votre application (pour les webhooks Jambonz)
WEBHOOK_URL=https://votre-app.vercel.app
```

### 2. Déployer l'application

```bash
# Build local
npm run build

# Ou déployer sur Vercel
vercel --prod
```

### 3. Configurer Jambonz

**Option rapide** (script automatique) :

```bash
# Éditer le WEBHOOK_URL dans le script si nécessaire
node scripts/setup-jambonz-ivr.js
```

**Option manuelle** :

1. Se connecter à http://31.97.178.44
2. Créer une application "CLAUDIO - Prise de RDV"
3. Configurer le webhook : `https://votre-app.vercel.app/api/ivr/appointment-webhook`
4. Sélectionner Google TTS/STT en français

### 4. Tester

1. Ouvrir l'application web
2. Aller sur une page de visite patient
3. Cliquer sur le bouton **Agenda** (icône calendrier)
4. Cliquer sur le bouton vert pour démarrer l'appel
5. Dire : *"Je voudrais prendre un rendez-vous"*
6. Répondre aux questions de l'IA
7. Le rendez-vous s'ajoute automatiquement !

---

## Comment ça marche ?

```
1. User clique "Agenda"
   ↓
2. Modal WebRTC s'ouvre
   ↓
3. Connexion à Jambonz via /api/ivr/start-call
   ↓
4. Jambonz dit : "Bienvenue sur services CLAUDIO"
   ↓
5. User parle → Speech-to-Text
   ↓
6. Webhook /api/ivr/appointment-webhook reçoit le texte
   ↓
7. GPT-4 analyse et répond de manière conversationnelle
   ↓
8. Text-to-Speech → User entend la réponse
   ↓
9. Répéter 5-8 jusqu'à avoir : nom, date, docteur
   ↓
10. Appel terminé → JSON retourné au frontend
   ↓
11. Rendez-vous ajouté automatiquement à l'agenda
```

---

## Fichiers créés

### Frontend
- `client/src/components/AgendaCallModal.tsx` - Modal WebRTC avec interface d'appel

### Backend (API Vercel)
- `api/ivr/appointment-webhook.ts` - Webhook principal avec IA GPT-4
- `api/ivr/start-call.ts` - Initialisation de l'appel WebRTC
- `api/ivr/last-appointment.ts` - Récupération du dernier RDV créé

### Scripts
- `scripts/setup-jambonz-ivr.js` - Configuration automatique de Jambonz

### Documentation
- `IVR_SETUP.md` - Documentation complète
- `QUICKSTART_IVR.md` - Ce guide de démarrage rapide

---

## Troubleshooting

### Le bouton "Agenda" n'apparaît pas
- Vérifier que vous êtes sur la page E05_VisitFlow (enregistrement de visite)
- Rebuild : `npm run build`

### L'appel ne se connecte pas
- Vérifier que le WEBHOOK_URL est accessible publiquement
- Vérifier les logs : `vercel logs`
- S'assurer que le micro est autorisé dans le navigateur

### L'IA ne comprend pas
- Vérifier que OPENAI_API_KEY est bien configurée
- Vérifier les crédits OpenAI
- Parler clairement et dire "rendez-vous"

### Le RDV n'est pas extrait
- Vérifier les logs du webhook
- Tester manuellement : voir `IVR_SETUP.md` section Debugging

---

## Prochaines étapes

### Fonctionnalités recommandées

1. **Confirmation par email/SMS** après prise de RDV
2. **Intégration Google Calendar** pour sync automatique
3. **Historique des appels** pour audit
4. **Multi-langue** (anglais, espagnol, etc.)

### Améliorations techniques

1. **WebRTC réel** via FreeSWITCH (actuellement SDP simulé)
2. **Redis** pour stockage persistant des conversations
3. **Gestion multi-appels** simultanés
4. **Retry logic** en cas d'erreur GPT-4

---

## Support

- Documentation complète : `IVR_SETUP.md`
- Documentation Jambonz : https://docs.jambonz.org/
- Verbs Jambonz : https://docs.jambonz.org/webhooks/overview/

---

**Bon développement ! 🎉**
