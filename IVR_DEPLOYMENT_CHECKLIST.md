# 📋 Checklist de déploiement IVR

## Pré-déploiement

### 1. Variables d'environnement

- [ ] Obtenir une clé API OpenAI avec accès GPT-4
  - Se connecter sur https://platform.openai.com/
  - Aller dans API Keys
  - Créer une nouvelle clé
  - La sauvegarder en sécurité

- [ ] Configurer `.env` localement
  ```bash
  OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
  WEBHOOK_URL=https://your-app.vercel.app  # À mettre à jour après déploiement
  ```

- [ ] Vérifier que `.env` est bien dans `.gitignore`
  ```bash
  grep ".env" .gitignore
  ```

### 2. Build local

- [ ] Installer les dépendances
  ```bash
  npm install
  ```

- [ ] Vérifier que le build fonctionne
  ```bash
  npm run build
  ```

- [ ] Tester l'app en local (sans appel réel)
  ```bash
  npm run dev
  ```
  - Ouvrir http://localhost:5173
  - Aller sur une page de visite patient
  - Vérifier que le bouton "Agenda" apparaît

### 3. Code review

- [ ] Vérifier les imports dans E05_VisitFlow.tsx
- [ ] Vérifier que AgendaCallModal.tsx n'a pas d'erreurs TypeScript
- [ ] Vérifier les 3 endpoints API (start-call, appointment-webhook, last-appointment)
- [ ] Vérifier le script setup-jambonz-ivr.js

---

## Déploiement sur Vercel

### 1. Connexion Vercel

- [ ] Installer Vercel CLI
  ```bash
  npm i -g vercel
  ```

- [ ] Se connecter à Vercel
  ```bash
  vercel login
  ```

### 2. Configuration projet

- [ ] Lier le projet Vercel
  ```bash
  vercel link
  ```

- [ ] Configurer les variables d'environnement sur Vercel
  ```bash
  vercel env add OPENAI_API_KEY production
  # Entrer : sk-proj-xxxxxxxxxxxxx

  vercel env add WEBHOOK_URL production
  # Entrer : https://your-app.vercel.app (sera mis à jour après)
  ```

### 3. Déploiement

- [ ] Déployer en production
  ```bash
  vercel --prod
  ```

- [ ] Noter l'URL de production (ex: https://synergia-abc123.vercel.app)

- [ ] Mettre à jour la variable WEBHOOK_URL
  ```bash
  vercel env rm WEBHOOK_URL production
  vercel env add WEBHOOK_URL production
  # Entrer : https://synergia-abc123.vercel.app
  ```

- [ ] Re-déployer pour appliquer la nouvelle variable
  ```bash
  vercel --prod
  ```

### 4. Vérification déploiement

- [ ] Tester l'URL de production
- [ ] Vérifier que le frontend charge correctement
- [ ] Vérifier les endpoints API :
  ```bash
  curl https://your-app.vercel.app/api/ivr/last-appointment
  # Devrait retourner 404 (normal, pas encore d'appel)
  ```

---

## Configuration Jambonz

### 1. Préparation

- [ ] S'assurer d'avoir accès SSH au VPS
  ```bash
  ssh root@31.97.178.44
  ```

- [ ] Vérifier que Jambonz est actif
  ```bash
  cd /opt/jambonz/jambonz-install
  docker compose ps
  # Tous les services doivent être "Up"
  ```

### 2. Configuration automatique

- [ ] Éditer le script setup-jambonz-ivr.js
  - Ligne 14 : Vérifier WEBHOOK_URL
  ```javascript
  const WEBHOOK_BASE_URL = 'https://your-app.vercel.app';
  ```

- [ ] Exécuter le script
  ```bash
  node scripts/setup-jambonz-ivr.js
  ```

- [ ] Vérifier la sortie :
  ```
  ✅ Connexion réussie
  ✅ Account SID: xxx
  ✅ Application créée avec succès!
  ```

- [ ] Noter l'Application SID retourné

### 3. Configuration manuelle (si script échoue)

- [ ] Se connecter à l'interface Jambonz
  - URL : http://31.97.178.44
  - Username : Treeporteur
  - Password : Treeporteursas2025#

- [ ] Créer une application
  - Aller dans Applications > Add Application
  - Name : CLAUDIO - Prise de RDV
  - Call Hook URL : https://your-app.vercel.app/api/ivr/appointment-webhook
  - Call Hook Method : POST
  - Speech Synthesis Vendor : Google
  - Speech Synthesis Language : fr-FR
  - Speech Synthesis Voice : fr-FR-Standard-A
  - Speech Recognition Vendor : Google
  - Speech Recognition Language : fr-FR

- [ ] Sauvegarder l'application

### 4. Optionnel : Associer un numéro

Si vous voulez recevoir de vrais appels téléphoniques :

- [ ] Obtenir un numéro SIP (via votre carrier)
- [ ] Configurer un trunk dans Jambonz
  - Carriers > Add Carrier
  - Entrer les infos SIP de votre carrier

- [ ] Ajouter le numéro
  - Phone Numbers > Add Number
  - Number : +33xxxxxxxxx
  - Application : CLAUDIO - Prise de RDV

---

## Tests

### 1. Test de l'interface

- [ ] Ouvrir l'application en production
- [ ] Se connecter (si authentification)
- [ ] Aller sur une page de visite patient
- [ ] Vérifier que le bouton "Agenda" est visible
- [ ] Cliquer sur "Agenda"
- [ ] Le modal s'ouvre avec le bouton d'appel vert

### 2. Test des permissions

- [ ] Cliquer sur le bouton d'appel
- [ ] Le navigateur demande l'accès au micro
- [ ] Autoriser l'accès
- [ ] Le bouton change d'état (connexion en cours)

### 3. Test de l'appel (WebRTC)

⚠️ **Note** : Le WebRTC actuellement utilise un SDP simulé. Pour un test réel, il faut :
- Soit appeler depuis un vrai téléphone (si numéro SIP configuré)
- Soit implémenter la connexion WebRTC native via Jambonz

Pour tester le webhook sans WebRTC :

- [ ] Tester le webhook manuellement
  ```bash
  curl -X POST https://your-app.vercel.app/api/ivr/appointment-webhook \
    -H "Content-Type: application/json" \
    -d '{
      "call_sid": "test-123",
      "speech": "je veux un rendez-vous le 15 mars avec le docteur Martin pour Jean Dupont",
      "call_status": "in-progress",
      "from": "+33612345678",
      "to": "+33987654321"
    }'
  ```

- [ ] Vérifier la réponse (devrait contenir des verbs Jambonz)

- [ ] Vérifier les logs Vercel
  ```bash
  vercel logs --follow
  ```

### 4. Test de l'extraction

- [ ] Appeler le webhook plusieurs fois avec différentes phrases
- [ ] Vérifier que GPT-4 extrait correctement :
  - Nom du patient
  - Date du rendez-vous
  - Docteur (si mentionné)

- [ ] Vérifier le JSON final
  ```bash
  curl https://your-app.vercel.app/api/ivr/last-appointment
  ```

### 5. Test de l'intégration

- [ ] Simuler un appel complet (via curl ou Postman)
- [ ] Vérifier que le RDV s'affiche dans le modal
- [ ] Vérifier que le RDV est ajouté à l'agenda
- [ ] Vérifier le toast de confirmation

---

## Monitoring

### 1. Logs Vercel

- [ ] Configurer les alertes Vercel
  - Project Settings > Alerts
  - Activer Error Rate Alerts

- [ ] Suivre les logs en temps réel
  ```bash
  vercel logs --follow
  ```

### 2. Logs Jambonz

- [ ] Se connecter au VPS
  ```bash
  ssh root@31.97.178.44
  cd /opt/jambonz/jambonz-install
  ```

- [ ] Suivre les logs du feature-server
  ```bash
  docker compose logs -f jambonz-feature-server
  ```

### 3. Monitoring OpenAI

- [ ] Vérifier l'utilisation OpenAI
  - https://platform.openai.com/usage
  - Surveiller le nombre de tokens utilisés
  - Vérifier les coûts

- [ ] Configurer des limites de budget
  - Settings > Limits
  - Définir un soft limit (ex: $50/mois)

---

## Troubleshooting

### Le bouton "Agenda" n'apparaît pas

- [ ] Vérifier que vous êtes bien sur E05_VisitFlow
- [ ] Vérifier la console navigateur (erreurs ?)
- [ ] Rebuild et redéployer
  ```bash
  npm run build
  vercel --prod
  ```

### L'appel ne se connecte pas

- [ ] Vérifier que le micro est autorisé
- [ ] Vérifier que HTTPS est activé (WebRTC nécessite HTTPS)
- [ ] Vérifier les logs Vercel
- [ ] Tester le webhook manuellement

### GPT-4 ne comprend pas

- [ ] Vérifier OPENAI_API_KEY
- [ ] Vérifier les crédits OpenAI
- [ ] Vérifier les logs (erreur 429 = rate limit)
- [ ] Améliorer le system prompt si besoin

### Le RDV n'est pas extrait

- [ ] Vérifier les logs du webhook
- [ ] Vérifier le JSON retourné par GPT-4
- [ ] Ajuster le prompt d'extraction
- [ ] Tester avec des phrases plus simples

### Erreur "conversationStore is not defined"

⚠️ **Important** : Le store en mémoire ne fonctionne pas sur Vercel (serverless).

Solutions :
- [ ] Implémenter Redis (Upstash, Redis Labs)
- [ ] Utiliser Vercel KV
- [ ] Utiliser une base de données (Supabase, PostgreSQL)

---

## Améliorations post-déploiement

### Court terme (semaine 1)

- [ ] Implémenter le stockage persistant (Redis)
- [ ] Ajouter la gestion d'erreurs complète
- [ ] Améliorer les messages d'erreur utilisateur
- [ ] Ajouter des analytics (nombre d'appels, durée, etc.)

### Moyen terme (mois 1)

- [ ] Implémenter WebRTC natif avec Jambonz
- [ ] Ajouter la confirmation par SMS/email
- [ ] Intégrer Google Calendar
- [ ] Améliorer le system prompt GPT-4

### Long terme (3+ mois)

- [ ] Multi-langue (anglais, espagnol)
- [ ] Fine-tuning GPT-4 sur vos données
- [ ] Dashboard analytics IVR
- [ ] Voice biometrics

---

## Checklist finale

Avant de marquer le projet comme terminé :

- [ ] ✅ Code déployé en production
- [ ] ✅ Variables d'environnement configurées
- [ ] ✅ Application Jambonz créée
- [ ] ✅ Webhook fonctionnel
- [ ] ✅ GPT-4 extraction testée
- [ ] ✅ Documentation complète
- [ ] ✅ Monitoring configuré
- [ ] ✅ Tests passent avec succès
- [ ] ✅ Équipe formée sur l'utilisation

---

**Date de déploiement : ________________**

**Déployé par : ________________**

**URL de production : ________________**

**Application Jambonz SID : ________________**

**Notes additionnelles :**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
