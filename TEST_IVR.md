# 🧪 Guide de test IVR en local

## Objectif

Tester le système IVR avec le **vrai serveur Jambonz** sans avoir à déployer sur Vercel.

---

## Architecture de test

```
Navigateur (localhost:3000)
    ↓ WebRTC
Serveur local Express (port 3000)
    ↓ Endpoints API (/api/ivr/*)
Jambonz VPS (31.97.178.44)
    ↓ Webhooks HTTP
Retour au serveur local (via tunnel ngrok)
    ↓ GPT-4
OpenAI API
```

---

## Prérequis

1. ✅ Jambonz installé et configuré sur le VPS (déjà fait)
2. ✅ Clé API OpenAI (dans `.env`)
3. ⚠️ **Tunnel ngrok** pour exposer votre localhost

---

## Installation rapide

### 1. Installer ngrok

```bash
# Via npm
npm install -g ngrok

# Ou télécharger depuis https://ngrok.com/download
```

### 2. Configurer les variables d'environnement

Créer/modifier `.env` :

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
NGROK_AUTH_TOKEN=votre_token_ngrok  # Optionnel mais recommandé
```

---

## Lancer les tests

### Étape 1 : Démarrer le serveur de test

```bash
npm run test-ivr
```

Cela va :
1. Builder l'application React (`npm run build`)
2. Démarrer le serveur Express sur le port 3000
3. Exposer les endpoints API locaux

**Sortie attendue :**
```
╔══════════════════════════════════════════════════════════════╗
║           🧪 SERVEUR DE TEST IVR DÉMARRÉ                     ║
╚══════════════════════════════════════════════════════════════╝

📍 URL de test:        http://localhost:3000/test-ivr
📱 App principale:     http://localhost:3000
🔧 Mode:               RÉEL (avec OpenAI)

💡 Endpoints disponibles:
   POST /api/ivr/start-call
   POST /api/ivr/appointment-webhook
   GET  /api/ivr/last-appointment
```

### Étape 2 : Exposer localhost avec ngrok

**Dans un NOUVEAU terminal :**

```bash
ngrok http 3000
```

**Sortie ngrok :**
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3000
```

**⚠️ IMPORTANT :** Copier l'URL `https://abc123.ngrok-free.app`

### Étape 3 : Configurer le webhook Jambonz

**Option A : Via script automatique**

Éditer `scripts/setup-jambonz-ivr.js` ligne 14 :
```javascript
const WEBHOOK_BASE_URL = 'https://abc123.ngrok-free.app'; // Votre URL ngrok
```

Puis exécuter :
```bash
node scripts/setup-jambonz-ivr.js
```

**Option B : Via l'interface Jambonz**

1. Se connecter à http://31.97.178.44
2. Aller dans **Applications**
3. Trouver "CLAUDIO - Prise de RDV" (ou en créer une)
4. Modifier le **Call Hook URL** :
   ```
   https://abc123.ngrok-free.app/api/ivr/appointment-webhook
   ```
5. Sauvegarder

---

## Tests disponibles

### Test 1 : Page de test automatisée

Ouvrir http://localhost:3000/test-ivr

Cette page permet de tester :
- ✅ Le webhook IVR (simulation conversation)
- ✅ Une conversation complète (4 étapes)
- ✅ La récupération du dernier RDV

**Avantages :**
- Rapide pour tester les endpoints
- Pas besoin de WebRTC
- Logs en temps réel

**Inconvénients :**
- Ne teste pas le flux WebRTC complet
- Ne teste pas la vraie connexion Jambonz

### Test 2 : Test avec l'app React + WebRTC

Ouvrir http://localhost:3000

1. Aller sur une page de visite patient
2. Cliquer sur le bouton **"Agenda"**
3. Cliquer sur le bouton vert pour démarrer l'appel
4. Parler dans le micro

**⚠️ Limitation actuelle :**
Le endpoint `/api/ivr/start-call` génère un SDP simulé. Pour une vraie connexion WebRTC avec Jambonz, vous aurez besoin d'implémenter la connexion native (voir section Limitations).

### Test 3 : Appel téléphonique réel (si numéro SIP configuré)

Si vous avez configuré un numéro de téléphone dans Jambonz :

1. Appeler le numéro depuis votre téléphone
2. Dire "Je veux un rendez-vous"
3. Répondre aux questions
4. Vérifier que le RDV apparaît dans l'app

---

## Logs et debugging

### Logs du serveur local

Le serveur affiche tous les webhooks reçus :

```
📨 [webhook] Reçu: { call_sid: 'abc-123', speech: 'je veux un rdv' }
🧠 [webhook] Appel GPT-4 réel
📊 [webhook] Données extraites: { person: 'Jean Dupont', date: '15 mars' }
✅ [webhook] Rendez-vous complet, fin de l'appel
```

### Logs Jambonz

Dans un autre terminal :

```bash
ssh root@31.97.178.44
cd /opt/jambonz/jambonz-install
docker compose logs -f jambonz-feature-server
```

### Logs ngrok

Ouvrir http://127.0.0.1:4040 pour voir l'interface ngrok avec :
- Toutes les requêtes HTTP reçues
- Request/Response détaillés
- Timeline des appels

---

## Workflow de test recommandé

### Premier test (5 min)
1. `npm run test-ivr`
2. Ouvrir http://localhost:3000/test-ivr
3. Cliquer "Test du webhook"
4. Vérifier que GPT-4 répond

### Deuxième test (10 min)
1. Démarrer ngrok : `ngrok http 3000`
2. Configurer Jambonz avec l'URL ngrok
3. Tester avec la page de test
4. Vérifier les logs

### Troisième test (15 min)
1. Ouvrir l'app React : http://localhost:3000
2. Aller sur une visite patient
3. Cliquer "Agenda"
4. Tester l'interface (micro + modal)

---

## Troubleshooting

### Le serveur ne démarre pas

**Erreur : `Cannot find module 'express'`**

Solution :
```bash
npm install
npm run test-ivr
```

### Ngrok : "Tunnel not found"

Solution :
```bash
# S'authentifier avec ngrok
ngrok config add-authtoken VOTRE_TOKEN

# Relancer
ngrok http 3000
```

### Jambonz ne peut pas atteindre le webhook

**Vérifier :**
1. Ngrok est bien lancé
2. L'URL ngrok est HTTPS (pas HTTP)
3. L'URL est bien configurée dans Jambonz
4. Le pare-feu n'est pas activé

**Tester manuellement :**
```bash
curl https://votre-url.ngrok-free.app/api/ivr/appointment-webhook \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"call_sid":"test","speech":"test","call_status":"in-progress"}'
```

### GPT-4 ne répond pas

**Vérifier :**
1. `OPENAI_API_KEY` est bien définie dans `.env`
2. La clé est valide
3. Vous avez des crédits OpenAI

**Tester :**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### WebRTC ne se connecte pas

**Actuellement :** Le SDP est simulé dans `/api/ivr/start-call`.

Pour une vraie connexion, il faut :
1. Implémenter la connexion native avec Jambonz WebRTC gateway
2. Ou utiliser un numéro SIP et appeler depuis un vrai téléphone

---

## Limitations du mode test local

### ✅ Ce qui fonctionne
- Webhooks IVR
- Reconnaissance vocale (si appel téléphonique réel)
- IA conversationnelle GPT-4
- Extraction des données
- Ajout du RDV à l'agenda

### ⚠️ Ce qui ne fonctionne pas encore
- **WebRTC natif** : Le SDP est simulé
  - Solution : Implémenter la connexion via Jambonz WebRTC gateway
- **Persistance** : Les données sont en mémoire
  - Solution : Utiliser une vraie DB ou Redis

### 🔄 Pour production
- Déployer sur Vercel (pas besoin de ngrok)
- Utiliser Redis/PostgreSQL pour la persistance
- Implémenter WebRTC natif

---

## Passer de test à production

### 1. Arrêter le serveur local
```bash
Ctrl+C (dans le terminal du serveur)
Ctrl+C (dans le terminal ngrok)
```

### 2. Déployer sur Vercel
```bash
vercel --prod
```

### 3. Reconfigurer Jambonz
Mettre à jour le webhook avec l'URL Vercel :
```
https://your-app.vercel.app/api/ivr/appointment-webhook
```

---

## Commandes utiles

```bash
# Démarrer le serveur de test
npm run test-ivr

# Exposer avec ngrok
ngrok http 3000

# Tester le webhook manuellement
curl http://localhost:3000/api/ivr/appointment-webhook \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"call_sid":"test-123","speech":"je veux un rdv","call_status":"in-progress"}'

# Récupérer le dernier RDV
curl http://localhost:3000/api/ivr/last-appointment

# Voir les logs Jambonz
ssh root@31.97.178.44 'cd /opt/jambonz/jambonz-install && docker compose logs -f jambonz-feature-server'
```

---

## Aide rapide

| Problème | Solution |
|----------|----------|
| Port 3000 déjà utilisé | Modifier le port dans `server/test-ivr.js` ligne 10 |
| Ngrok expire | Gratuit = URL change à chaque fois. Payant = URL fixe |
| GPT-4 timeout | Augmenter `max_tokens` ou utiliser GPT-3.5 |
| Webhook 404 | Vérifier l'URL ngrok dans Jambonz |

---

**Prêt pour les tests ! 🚀**

Démarrez avec : `npm run test-ivr` puis ouvrez http://localhost:3000/test-ivr
