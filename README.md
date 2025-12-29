# Synergia - Application Médicale Professionnelle

## Vue d'ensemble

Synergia est une application d'authentification médicale sécurisée conçue pour les professionnels de santé. Elle permet l'authentification multi-rôles avec support email/password et Google SSO via Replit Auth.

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

## Installation et Démarrage

### Prérequis
- Node.js 20+
- PostgreSQL
- Compte Replit (pour l'authentification)

### Installation
```bash
npm install
```

### Configuration
Copiez le fichier `.env.example` vers `.env` et configurez les variables d'environnement.

### Démarrage en développement
```bash
npm run dev
```

### Build pour production
```bash
npm run build
npm start
```

## Structure du Projet

```
├── client/                  # Frontend React
│   ├── public/
│   ├── src/
│   │   ├── components/      # Composants réutilisables
│   │   ├── hooks/           # Hooks personnalisés
│   │   ├── layouts/         # Layouts de page
│   │   ├── lib/             # Utilitaires et configurations
│   │   ├── pages/           # Pages de l'application
│   │   └── types/           # Types TypeScript
├── server/                  # Backend Express
│   ├── app.ts
│   ├── db.ts                # Configuration Drizzle
│   ├── index-dev.ts
│   ├── index-prod.ts
│   ├── replitAuth.ts        # Configuration Replit Auth
│   ├── routes.ts            # Routes API
│   └── storage.ts           # Couche d'accès aux données
├── api/                     # API serverless (Vercel)
├── shared/                  # Code partagé
│   └── schema.ts            # Schémas Drizzle + Zod
├── db/                      # Migrations et scripts DB
├── docs/                    # Documentation
├── tests/                   # Tests
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── drizzle.config.ts
```

## Tests

Les tests sont situés dans le dossier `tests/`. Pour exécuter les tests :

```bash
# Exécuter un test spécifique
node tests/test-contacts-search.js
```

## Déploiement

### Vercel
Configurez les variables d'environnement dans Vercel et déployez.

### Autres plateformes
Consultez la documentation dans `docs/` pour les instructions spécifiques.

## Contribution

1. Fork le projet
2. Créez une branche pour votre fonctionnalité
3. Commitez vos changements
4. Poussez vers la branche
5. Ouvrez une Pull Request

## Licence

MIT