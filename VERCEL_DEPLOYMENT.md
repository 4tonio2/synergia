# Déploiement Vercel - Synergia

## 📋 Prérequis

1. Compte Vercel (gratuit sur vercel.com)
2. Compte Supabase avec projet créé
3. Clé API OpenAI

## 🚀 Instructions de déploiement

### 1. Préparer le repository

```bash
# Assurez-vous que .env n'est pas commité
git status
git add .
git commit -m "Prepare for Vercel deployment"
git push
```

### 2. Importer sur Vercel

1. Allez sur [vercel.com](https://vercel.com)
2. Cliquez sur "New Project"
3. Importez votre repository GitHub `4tonio2/synergia`
4. Vercel détectera automatiquement la configuration

### 3. Configurer les variables d'environnement

Dans les paramètres du projet Vercel, ajoutez ces variables d'environnement :

```
SUPABASE_URL=votre_url_supabase
SUPABASE_ANON_KEY=votre_cle_anon_supabase
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role_supabase
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase
DATABASE_URL=votre_connection_string_postgres
SESSION_SECRET=votre_secret_aleatoire
OPENAI_API_KEY=votre_cle_openai
```

### 4. Déployer

Vercel déploiera automatiquement. Le processus prend environ 2-3 minutes.

## 🔧 Configuration technique

### Architecture Serverless

- **Frontend**: React + Vite (Static)
- **API Routes**: `/api/*` → Fonctions serverless Node.js
- **Auth**: Supabase Auth (JWT)
- **Storage**: localStorage (client) + Supabase Database

### Routes API disponibles

- `POST /api/auth/login` - Connexion Supabase
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/user` - Récupérer utilisateur actuel
- `POST /api/voice/transcribe` - Whisper STT
- `POST /api/voice/synthesize` - OpenAI TTS
- `POST /api/ai/summary` - Générer résumé GPT-4
- `POST /api/ai/transmission` - Générer transmission GPT-4

## 📝 Notes importantes

### Migration de l'authentification

L'app utilise maintenant **Supabase Auth** au lieu d'express-session :

- Les sessions sont gérées côté client avec JWT
- Le token est stocké dans localStorage
- Chaque requête API inclut le token dans `Authorization: Bearer <token>`

### Limitations Vercel

- **Timeout**: 30 secondes max par fonction serverless
- **Upload**: 4.5MB max par requête
- **Cold starts**: Premières requêtes peuvent être lentes

### Performances

- Build optimisé automatiquement
- Cache CDN global
- HTTPS automatique
- Domaine personnalisé disponible

## 🐛 Debugging

### Logs en temps réel

```bash
# Installer Vercel CLI
npm i -g vercel

# Login
vercel login

# Voir les logs
vercel logs
```

### Test local avec Vercel

```bash
# Installer dependencies
npm install

# Dev local avec Vercel runtime
vercel dev
```

## 🔄 Redéploiement automatique

Chaque `git push` sur la branche `main` déclenche un nouveau déploiement automatiquement.

## 📞 Support

- Documentation Vercel: https://vercel.com/docs
- Documentation Supabase: https://supabase.com/docs
- OpenAI API: https://platform.openai.com/docs
