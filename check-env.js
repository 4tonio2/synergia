// Vérification des variables d'environnement - À exécuter dans la console du navigateur

console.log('=== VÉRIFICATION ENVIRONNEMENT VERCEL ===');
console.log('');
console.log('Variables VITE:');
console.log('  VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL || '❌ MANQUANT');
console.log('  VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Défini (caché)' : '❌ MANQUANT');
console.log('');
console.log('Mode:', import.meta.env.MODE);
console.log('Dev:', import.meta.env.DEV);
console.log('Prod:', import.meta.env.PROD);
console.log('');

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.error('');
  console.error('🚨 PROBLÈME DÉTECTÉ! 🚨');
  console.error('');
  console.error('Les variables VITE_SUPABASE_* ne sont pas définies!');
  console.error('');
  console.error('SOLUTION:');
  console.error('1. Va sur Vercel Dashboard → Settings → Environment Variables');
  console.error('2. Ajoute:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - VITE_SUPABASE_ANON_KEY');
  console.error('3. Redéploie le projet');
  console.error('');
} else {
  console.log('✅ Configuration OK!');
}
