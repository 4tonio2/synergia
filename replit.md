# Plode Care - Application Médicale Professionnelle

## Vue d'ensemble

Plode Care est une application d'authentification médicale sécurisée conçue pour les professionnels de santé. Elle permet l'authentification multi-rôles avec support email/password et Google SSO via Replit Auth.

## Fonctionnalités Principales

### Authentification Sécurisée
- **Replit Auth (OpenID Connect)** : Email/password + Google SSO
- **Gestion de session PostgreSQL** : Sessions persistantes et sécurisées
- **Protection des routes** : Middleware `isAuthenticated` pour les endpoints protégés

### Rôles Médicaux
- **Infirmier** : Personnel infirmier
- **Médecin** : Médecins et docteurs
- **Kinésithérapeute** : Professionnels de la rééducation
- **Aidant professionnel** : Personnel d'aide et d'accompagnement

### Conformité RGPD/HDS
- Messages de conformité affichés
- Données de santé hébergées de manière sécurisée
- Sessions PostgreSQL pour la sécurité

## Architecture Technique

### Frontend
- **Framework** : React SPA avec Wouter pour le routing
- **Styling** : TailwindCSS + Shadcn UI
- **State Management** : TanStack Query (React Query v5)
- **Formulaires** : React Hook Form avec validation Zod inline

### Backend
- **Serveur** : Express.js sur Node.js
- **Base de données** : PostgreSQL avec Drizzle ORM
- **Authentification** : Replit Auth (OpenID Connect)
- **Sessions** : PostgreSQL sessions avec connect-pg-simple

### Design System
- **Couleurs principales** : Cyan (#06B6D4) et Navy (#1E40AF)
- **Typographie** : Inter (Google Fonts)
- **Composants** : Shadcn UI pour consistance visuelle
- **Logo** : Croix médicale SVG avec dégradé cyan/navy

## Structure du Projet

```
├── client/                  # Frontend React
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/         # Composants Shadcn UI
│   │   │   └── MedicalCrossLogo.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts  # Hook d'authentification
│   │   ├── lib/
│   │   │   ├── queryClient.ts
│   │   │   └── authUtils.ts
│   │   ├── pages/
│   │   │   ├── landing.tsx # Page d'authentification
│   │   │   ├── home.tsx    # Dashboard
│   │   │   └── not-found.tsx
│   │   ├── App.tsx
│   │   ├── index.css       # Styles globaux
│   │   └── main.tsx
│   └── index.html
├── server/                  # Backend Express
│   ├── app.ts
│   ├── db.ts               # Configuration Drizzle
│   ├── index-dev.ts
│   ├── index-prod.ts
│   ├── replitAuth.ts       # Configuration Replit Auth
│   ├── routes.ts           # Routes API
│   └── storage.ts          # Couche d'accès aux données
├── shared/
│   └── schema.ts           # Schémas Drizzle + Zod
├── design_guidelines.md    # Guidelines de design
├── drizzle.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

## Schéma de Base de Données

### Table `users`
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  medical_role VARCHAR,  -- 'infirmier', 'medecin', 'kinesitherapeute', 'aidant_pro'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table `sessions`
```sql
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);
```

## Flux d'Authentification

1. **Landing Page** : Utilisateur non authentifié arrive sur `/`
2. **Sélection du rôle** : Choix obligatoire parmi les 4 rôles médicaux
3. **Stockage du rôle** : POST `/api/auth/set-pending-role` stocke le rôle dans la session + sessionStorage
4. **Redirection Auth** : GET `/api/login` initie le flux Replit Auth
5. **Callback Auth** : GET `/api/callback` après authentification réussie
6. **Retour Dashboard** : Redirection vers `/`
7. **Application du rôle** : POST `/api/auth/apply-pending-role` applique le rôle à l'utilisateur
8. **Affichage Dashboard** : Dashboard avec rôle médical affiché

## Endpoints API

### Publics
- `GET /api/auth/user` : Retourne l'utilisateur connecté ou null
- `POST /api/auth/set-pending-role` : Stocke le rôle médical en session
- `GET /api/login` : Initie le flux d'authentification
- `GET /api/callback` : Callback OAuth
- `GET /api/logout` : Déconnexion

### Protégés (require isAuthenticated)
- `POST /api/auth/apply-pending-role` : Applique le rôle en attente
- `PATCH /api/users/role` : Met à jour le rôle médical

## Variables d'Environnement

### Automatiques (Replit)
- `DATABASE_URL` : Connection string PostgreSQL
- `REPL_ID` : ID du Repl
- `SESSION_SECRET` : Secret pour les sessions
- `ISSUER_URL` : URL de l'émetteur OIDC (défaut: https://replit.com/oidc)

### Development
- `NODE_ENV` : `development` ou `production`

## Commandes Utiles

```bash
# Développement
npm run dev                 # Démarre frontend + backend

# Base de données
npm run db:push             # Applique le schéma à la DB
npm run db:push -- --force  # Force l'application du schéma
```

## Sécurité

- **HTTPS** : Toutes les connexions sécurisées
- **Cookies sécurisés** : httpOnly, secure, sameSite
- **Sessions PostgreSQL** : Pas de mémoire volatile
- **Tokens JWT** : Refresh automatique via Replit Auth
- **CORS** : Configuration sécurisée
- **Validation Zod** : Toutes les entrées validées

## Conformité Médicale

- **RGPD** : Messages de conformité affichés
- **HDS (Hébergement Données de Santé)** : Mentionné pour conformité
- **Audit trail** : Logs de connexion et modifications

## Prochaines Phases

Les fonctionnalités suivantes sont planifiées :

1. **Gestion des patients** : CRUD patients avec dossiers médicaux
2. **Planification** : Calendrier et rendez-vous
3. **Messagerie sécurisée** : Communication entre professionnels
4. **Dossiers médicaux** : Historique et suivi patients
5. **Rapports et analytics** : Statistiques pour professionnels

## Notes de Développement

### Hooks React
- Toujours appeler les hooks en haut du composant
- Pas de hooks conditionnels (early returns après les hooks)
- Le composant `Home` gère l'affichage Landing si non authentifié

### Sessions
- Sessions stockées en PostgreSQL pour persistance
- TTL de 7 jours
- Cookie sécurisé avec HTTPS uniquement

### Migrations DB
- **IMPORTANT** : Utiliser `npm run db:push` pour les migrations
- Ne jamais écrire de SQL manuel pour les migrations
- Utiliser `--force` si warnings de perte de données

## Support

Pour toute question sur le projet, consulter :
- Design guidelines : `design_guidelines.md`
- Schéma de données : `shared/schema.ts`
- Documentation Replit Auth : Voir `server/replitAuth.ts`
