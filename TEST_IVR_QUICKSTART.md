# 🚀 Test IVR - Guide rapide

## En 3 étapes

### 1️⃣ Démarrer le serveur de test

```bash
npm run test-ivr
```

**Ce qui se lance :**
- Build de l'app React
- Serveur Express sur port 3000
- Endpoints API IVR simulés localement

### 2️⃣ Exposer avec ngrok

**Dans un NOUVEAU terminal :**

```bash
ngrok http 3000
```

**Copier l'URL** affichée (exemple: `https://abc123.ngrok-free.app`)

### 3️⃣ Configurer Jambonz

**Option rapide** - Via script :

```bash
# Éditer scripts/setup-jambonz-ivr.js ligne 14
# Remplacer par votre URL ngrok

node scripts/setup-jambonz-ivr.js
```

**Option manuelle** - Via interface web :

1. Ouvrir http://31.97.178.44
2. Login : Treeporteur / Treeporteursas2025#
3. Applications → "CLAUDIO - Prise de RDV"
4. Call Hook URL : `https://VOTRE-URL.ngrok-free.app/api/ivr/appointment-webhook`
5. Sauvegarder

---

## 🧪 Tester

### Test 1 : Page de test automatisée

**URL :** http://localhost:3000/test-ivr

Cliquer sur les boutons :
- Test webhook
- Conversation complète
- Récupérer le RDV

### Test 2 : App React avec bouton Agenda

**URL :** http://localhost:3000

1. Aller sur une page de visite patient
2. Cliquer "Agenda"
3. Cliquer le bouton vert
4. Parler !

### Test 3 : Appel téléphonique réel (optionnel)

Si vous avez configuré un numéro SIP dans Jambonz :

1. Appeler le numéro
2. Dire "Je veux un rendez-vous"
3. Répondre aux questions de l'IA
4. Vérifier que le RDV apparaît dans l'app

---

## 📊 Suivre les logs

**Terminal 1** (serveur local) :
```
📨 [webhook] Reçu: { call_sid: 'abc', speech: 'je veux un rdv' }
🧠 [webhook] Appel GPT-4 réel
📊 [webhook] Données extraites: { person: 'Jean Dupont', date: '15 mars' }
✅ [webhook] Rendez-vous complet
```

**Terminal 2** (ngrok) :
Ouvrir http://127.0.0.1:4040 pour voir toutes les requêtes HTTP

**Terminal 3** (optionnel - logs Jambonz) :
```bash
ssh root@31.97.178.44
cd /opt/jambonz/jambonz-install
docker compose logs -f jambonz-feature-server
```

---

## ⚙️ Configuration

### Variables d'environnement (.env)

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

**Important :** Le serveur de test vérifie que `OPENAI_API_KEY` est définie au démarrage.

---

## ❌ Troubleshooting rapide

| Problème | Solution |
|----------|----------|
| "OPENAI_API_KEY manquante" | Créer `.env` avec la clé |
| Port 3000 déjà utilisé | Modifier le port dans `server/test-ivr.js` ligne 10 |
| Ngrok "Tunnel not found" | S'authentifier : `ngrok config add-authtoken TOKEN` |
| Jambonz n'atteint pas le webhook | Vérifier que l'URL ngrok est HTTPS |
| GPT-4 timeout | Vérifier les crédits OpenAI |

---

## 📝 Commandes utiles

```bash
# Tester le webhook manuellement
curl http://localhost:3000/api/ivr/appointment-webhook \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"call_sid":"test","speech":"je veux un rdv","call_status":"in-progress"}'

# Récupérer le dernier RDV
curl http://localhost:3000/api/ivr/last-appointment
```

---

## 🎯 Flux de test recommandé

1. **Premier lancement** (5 min)
   - `npm run test-ivr`
   - Ouvrir http://localhost:3000/test-ivr
   - Tester les 3 boutons

2. **Test avec ngrok** (10 min)
   - Lancer ngrok
   - Configurer Jambonz
   - Re-tester via /test-ivr

3. **Test app complète** (5 min)
   - Ouvrir http://localhost:3000
   - Bouton "Agenda"
   - Interface complète

---

**Documentation complète :** [TEST_IVR.md](TEST_IVR.md)
