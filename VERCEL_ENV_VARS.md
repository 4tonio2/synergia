# ⚠️ IMPORTANT: Variables d'environnement Vercel

## Configuration requise sur Vercel Dashboard

Allez dans **Settings → Environment Variables** de votre projet Vercel et ajoutez :

### Variables Backend (API Routes)
```
SUPABASE_URL=https://kzlbpjbqjqclulfbkkzq.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres.kzlbpjbqjqclulfbkkzq:Doxa.Bis1510.@...
SESSION_SECRET=votre-secret-aleatoire
OPENAI_API_KEY=sk-proj-...
```

### ⚡ Variables Frontend (VITE_* - OBLIGATOIRES!)
**CRITIQUE**: Ces variables doivent être préfixées par `VITE_` pour être accessibles dans le code frontend!

```
VITE_SUPABASE_URL=https://kzlbpjbqjqclulfbkkzq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Comment ajouter sur Vercel

1. Va sur https://vercel.com/dashboard
2. Sélectionne ton projet "synergia"
3. Clique sur **Settings** → **Environment Variables**
4. Pour chaque variable:
   - Clique **Add New**
   - Entre le nom (ex: `VITE_SUPABASE_URL`)
   - Entre la valeur
   - Sélectionne **Production, Preview, Development**
   - Clique **Save**

## Après avoir ajouté les variables

1. Va dans **Deployments**
2. Clique sur les 3 points (...) du dernier deployment
3. Clique **Redeploy**
4. Attends que le build termine

## Vérification

Une fois déployé, ouvre la console du navigateur sur ton app Vercel:
- Si tu vois `Missing Supabase environment variables` → Les variables VITE_* ne sont pas configurées
- Si l'auth fonctionne → Tout est bon! ✅

## Note importante

Les variables `VITE_*` sont **injectées au moment du build**, pas au runtime!
Si tu ajoutes/modifies une variable `VITE_*`, tu DOIS redéployer.
