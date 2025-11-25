# 🔧 Configuration Supabase pour Vercel

## ⚠️ Problème actuel

Supabase redirige vers `localhost:3000` au lieu de ton URL Vercel après l'authentification Google OAuth.

## ✅ Solution : Configurer les URL de redirection Supabase

### Étape 1 : Aller dans Supabase Dashboard

1. Va sur https://supabase.com/dashboard
2. Sélectionne ton projet : **kzlbpjbqjqclulfbkkzq**
3. Dans le menu de gauche, clique sur **Authentication**
4. Clique sur **URL Configuration**

### Étape 2 : Ajouter ton URL Vercel

Dans **Site URL** :
```
https://ton-app.vercel.app
```
*(Remplace par ton vrai domaine Vercel)*

Dans **Redirect URLs** (ajoute les 3) :
```
https://ton-app.vercel.app
https://ton-app.vercel.app/
http://localhost:5173
```

### Étape 3 : Configurer OAuth Providers

1. Dans le menu **Authentication**, clique sur **Providers**
2. Clique sur **Google**
3. Vérifie que **Authorized redirect URIs** contient :
```
https://kzlbpjbqjqclulfbkkzq.supabase.co/auth/v1/callback
```

### Étape 4 : Sauvegarder

Clique **Save** en bas de la page.

## 🧪 Vérification

1. Retourne sur ton app Vercel
2. Essaie de te connecter avec Google
3. Tu devrais maintenant être redirigé vers ton app Vercel au lieu de localhost

## 📝 Note importante

Les changements dans Supabase sont **instantanés**, pas besoin de redéployer Vercel.

## 🔍 Comment trouver ton URL Vercel

1. Va sur https://vercel.com/dashboard
2. Clique sur ton projet **synergia**
3. Dans l'onglet **Deployments**, copie l'URL (ex: `https://synergia-xxx.vercel.app`)
4. Utilise cette URL dans Supabase

## Alternative : Utiliser un domaine personnalisé

Si tu as un domaine (ex: `synergia.com`) :
1. Configure-le dans Vercel (**Settings** → **Domains**)
2. Utilise ce domaine dans Supabase au lieu de l'URL Vercel
