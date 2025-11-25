# Configuration Supabase pour Synergia

## ✅ Ce qui a été fait

1. ✅ Installation de `@supabase/supabase-js` et `@supabase/ssr`
2. ✅ Création du client Supabase côté client (`client/src/lib/supabase.ts`)
3. ✅ Création du client Supabase côté serveur (`server/supabase.ts`)
4. ✅ Mise à jour du hook `useAuth` pour utiliser Supabase
5. ✅ Adaptation de la page landing pour authentification Email + Google OAuth
6. ✅ Mise à jour des routes serveur pour utiliser Supabase Auth
7. ✅ Configuration des variables d'environnement

## 📋 Ce qu'il vous reste à faire

### 1. Créer les tables dans votre base de données PostgreSQL

Exécutez ce SQL dans votre base de données actuelle (celle dans DATABASE_URL) :

```sql
-- Table users (stocke les profils utilisateurs avec rôles médicaux)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY,
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  medical_role VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table auth_logs (logs RGPD pour traçabilité)
CREATE TABLE IF NOT EXISTS auth_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  action VARCHAR NOT NULL,
  ip_address VARCHAR,
  user_agent VARCHAR,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_timestamp ON auth_logs(timestamp);
```

**OU** si vous préférez utiliser Drizzle :

```bash
npm run db:push
```

### 2. Configurer Google OAuth dans Supabase

1. **Allez dans votre projet Supabase** : https://supabase.com/dashboard
2. Cliquez sur **Authentication** → **Providers**
3. Activez **Google**
4. **Créer un projet OAuth Google** :
   - Allez sur [Google Cloud Console](https://console.cloud.google.com/)
   - Créez un nouveau projet ou sélectionnez un existant
   - Allez dans **APIs & Services** → **Credentials**
   - Cliquez sur **Create Credentials** → **OAuth 2.0 Client ID**
   - Type d'application : **Web application**
   - **Authorized redirect URIs** : Copiez l'URL fournie par Supabase (ressemble à `https://kzlbpjbqjqclulfbkkzq.supabase.co/auth/v1/callback`)
   - Cliquez sur **Create**
   - Copiez le **Client ID** et **Client Secret**
5. **Retournez dans Supabase** et collez ces valeurs dans la configuration Google

### 3. Obtenir votre Service Role Key (optionnel mais recommandé)

1. Dans Supabase, allez dans **Settings** → **API**
2. Copiez la clé **service_role** (attention, gardez-la secrète !)
3. Remplacez `votre_clé_service_role_ici` dans le fichier `.env`

### 4. Configurer votre DATABASE_URL

Vous avez deux options :

**Option A : Utiliser votre base de données actuelle (Neon, etc.)**
- Gardez votre `DATABASE_URL` actuelle
- Les tables `users` et `auth_logs` seront dans cette DB
- Supabase gère uniquement l'authentification

**Option B : Migrer vers Supabase Database**
- Dans Supabase, allez dans **Settings** → **Database**
- Copiez la **Connection string** (URI)
- Remplacez votre `DATABASE_URL` dans `.env` par cette valeur
- Exécutez le SQL ci-dessus dans l'éditeur SQL de Supabase

### 5. Tester l'authentification

1. Démarrez le serveur de développement :
   ```bash
   npm run dev
   ```

2. Testez les fonctionnalités :
   - ✅ Inscription avec email/password
   - ✅ Connexion avec email/password
   - ✅ Connexion avec Google (après configuration OAuth)
   - ✅ Sélection du rôle médical
   - ✅ Redirection vers `/` après authentification

## 🔧 Structure de l'authentification

### Flux Email/Password :
1. Utilisateur sélectionne son rôle médical
2. Utilisateur entre email/password et clique "Se connecter" ou "Créer un compte"
3. Supabase authentifie l'utilisateur
4. Le rôle médical est envoyé à `/api/auth/apply-pending-role`
5. L'utilisateur est créé/mis à jour dans la table `users`
6. Redirection vers la page d'accueil

### Flux Google OAuth :
1. Utilisateur sélectionne son rôle médical
2. Utilisateur clique "Se connecter avec Google"
3. Le rôle est stocké dans `localStorage`
4. Redirection vers Google OAuth
5. Après validation, retour sur l'application
6. Le rôle est récupéré et appliqué
7. Utilisateur créé/mis à jour dans la table `users`

## 📝 Variables d'environnement requises

```bash
# Serveur
SUPABASE_URL=https://kzlbpjbqjqclulfbkkzq.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Optionnel

# Client (préfixe VITE_)
VITE_SUPABASE_URL=https://kzlbpjbqjqclulfbkkzq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Database
DATABASE_URL=postgresql://user:pass@host/db
```

## 🎯 Points importants

- **Sécurité** : La `SUPABASE_ANON_KEY` est publique (elle est dans le client)
- **Service Role** : La `SERVICE_ROLE_KEY` ne doit JAMAIS être exposée côté client
- **Sessions** : Supabase gère les sessions avec JWT stockés dans localStorage
- **RGPD** : Tous les événements d'auth sont loggés dans `auth_logs`

## 🚨 Dépannage

Si l'authentification ne fonctionne pas :

1. Vérifiez que les variables `VITE_*` sont bien présentes dans `.env`
2. Redémarrez le serveur dev après modification de `.env`
3. Vérifiez les logs de la console du navigateur
4. Vérifiez que les tables `users` et `auth_logs` existent dans votre DB
5. Dans Supabase, vérifiez que Email et Google providers sont activés

## 📚 Documentation

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Google OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
