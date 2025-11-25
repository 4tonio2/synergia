# Mise à Jour - E05_VisitFlow Complet

## Résumé des Changements

J'ai implémenté le **E05_VisitFlow** complet qui manquait dans l'implémentation précédente. Ce composant fusionne les écrans E05 (Recording), E06 (Processing), et E07 (Validation) du code Gemini pour créer un flux d'enregistrement médical complet.

## Fichiers Créés

### 1. `/client/src/pages/E05_VisitFlow.tsx` (NOUVEAU)

**Composant principal** avec 3 étapes :

#### Étape 1 : Recording (Enregistrement)
- Timer en temps réel avec auto-stop à 2 minutes
- VU-mètre animé (onde sonore SVG)
- Indicateurs : connectivité, batterie, mode offline
- Cadrage Plode Care (guide conversation)
- Bouton STOP rouge

#### Étape 2 : Processing (Traitement IA)
- Barre de progression animée
- Message "Génération du résumé et structuration..."
- Spinner de chargement
- Délai réaliste basé sur la durée d'enregistrement

#### Étape 3 : Review/Validation
- **Résumé IA éditable** (Textarea)
- **Champs structurés éditables** :
  - Douleur : Slider 0-10
  - Constantes : Input texte
  - Type de soin : Pill
  - Date/Heure : Auto-généré
- **Transcription brute** (read-only, scrollable)
- **Alertes critiques** (si détectées) avec niveau et description
- **Notes additionnelles** (optionnel)
- **2 boutons d'action** :
  - ✅ "Valider et envoyer vers Odoo" (validation finale)
  - 🔄 "Mettre en attente et revenir à la tournée" (sauvegarde brouillon)

### 2. `/E05_VISITFLOW_GUIDE.md` (Documentation)

Guide complet expliquant :
- Architecture du composant
- Flux de navigation
- Gestion des brouillons
- Intégration avec les autres écrans
- TODO pour l'intégration future (Supabase, Web Audio API, IA, Odoo)

## Fichiers Modifiés

### `/client/src/App.tsx`

**Changements :**
```diff
- import E05_RecordingSimple from "@/pages/E05_RecordingSimple";
+ import E05_VisitFlow from "@/pages/E05_VisitFlow";

  <Route path="/patients/:id/record">
    <AuthGuard>
-     <E05_RecordingSimple />
+     <E05_VisitFlow />
    </AuthGuard>
  </Route>

  <Route path="/recordings/new-free">
    <AuthGuard>
-     <E05_RecordingSimple />
+     <E05_VisitFlow />
    </AuthGuard>
  </Route>
```

**Impact :**
- Les routes `/patients/:id/record` et `/recordings/new-free` utilisent maintenant le flux complet
- L'ancien `E05_RecordingSimple` peut être supprimé (obsolète)

## Nouvelles Fonctionnalités

### 1. Traitement IA Simulé (`mockIAProcess`)

```typescript
const mockIAProcess = (recordingDuration: number) => {
  // Délai réaliste : max(3s, durée * 100ms + 1s)
  const time = Math.max(3000, recordingDuration * 100 + 1000);
  
  return Promise<{
    summary: string,              // Résumé narratif
    transcription: string,        // Conversation complète
    structuredDetails: {
      type: string,              // Type de soin
      douleur: number,           // 0-10
      constantes: string,        // Vitaux
      alertes: Alert[],          // Alertes détectées
      date/time: string,         // Timestamp
    },
    riskLevel: string,           // Faible/Modéré/Élevé
  }>;
};
```

### 2. Gestion des Brouillons

**Sauvegarde automatique :**
- Après le traitement IA (étape `processing` → `review`)
- Avant de quitter l'écran (bouton "Mettre en attente")

**Reprise de brouillon :**
- Détection : Si `visitDraft.iaData` existe → démarre en `stage = 'review'`
- Pre-remplissage des champs éditables
- Possibilité de continuer l'édition

**Structure du brouillon :**
```typescript
interface VisitDraft {
  id: string,
  patientId: string | null,    // null = visite libre
  date: string,
  durationSeconds: number,
  durationMinSec: string,      // Format "2'34''"
  iaData: {
    summary: string,
    structuredDetails: {...},
    transcription: string,
    ...
  },
  validated: boolean,          // false = brouillon
}
```

### 3. Édition Complète Avant Validation

**Champs modifiables :**
- ✏️ Résumé/Synthèse (Textarea)
- 🎚️ Douleur (Slider 0-10)
- 📝 Constantes (Input texte)
- 📄 Notes additionnelles (Textarea)

**Champs read-only :**
- 📅 Date & Heure
- 🔊 Transcription brute
- 🏷️ Type de soin
- ⚠️ Alertes détectées

### 4. Validation Finale avec Envoi Odoo

**Workflow :**
1. Utilisateur clique "Valider et envoyer vers Odoo"
2. Création de l'objet `finalVisitData` avec `validated: true`
3. Appel à `onValidate(finalVisitData)`
4. Alert de confirmation : "Visite validée et envoyée vers Odoo (Simulation) !"
5. Redirection vers Dashboard

**Note :** Pour l'instant c'est une simulation. L'intégration réelle Odoo sera implémentée plus tard.

## Comparaison E05_RecordingSimple vs E05_VisitFlow

| Feature | E05_RecordingSimple (Ancien) | E05_VisitFlow (Nouveau) |
|---------|------------------------------|-------------------------|
| Écrans | 1 seul (recording) | 3 fusionnés (recording + processing + validation) |
| Timer | ✅ Oui | ✅ Oui (amélioré) |
| VU-mètre | ✅ Oui | ✅ Oui (identique) |
| Traitement IA | ❌ Alert simple | ✅ Écran de progression + résultats structurés |
| Édition résumé | ❌ Non | ✅ Oui (Textarea) |
| Édition douleur | ❌ Non | ✅ Oui (Slider 0-10) |
| Édition constantes | ❌ Non | ✅ Oui (Input) |
| Transcription | ❌ Non | ✅ Oui (affichée) |
| Alertes | ❌ Non | ✅ Oui (détection + affichage) |
| Brouillons | ❌ Non | ✅ Oui (sauvegarde/reprise) |
| Validation Odoo | ❌ Non | ✅ Oui (bouton final) |
| Notes additionnelles | ❌ Non | ✅ Oui (Textarea) |

## Impact sur les Autres Écrans

### E08_History (Historique patient)
- Affichera maintenant les brouillons avec badge "Brouillon (Attente validation)"
- Click sur un brouillon → reprend E05_VisitFlow en mode `review`

### E09_VisitDetail (Détails visite)
- Bouton "Reprendre la validation" pour les brouillons
- Bouton "Modifier le rapport" pour les visites validées
- Les deux redirigent vers E05_VisitFlow avec le `visitDraft`

### E10_Recordings (Liste globale)
- Affiche tous les enregistrements (patients + libres)
- Distingue validés vs brouillons via badges colorés
- Click → E09_VisitDetail ou E05_VisitFlow selon le statut

## Prochaines Étapes

### Backend (Supabase)
1. ✅ Schema déjà créé dans `supabase_migrations.sql`
2. ⏳ Exécuter le SQL dans Supabase Dashboard
3. ⏳ Créer les fonctions de sauvegarde :
   ```typescript
   // Dans E05_VisitFlow.tsx
   const saveDraft = async (draft: VisitDraft) => {
     const { data, error } = await supabase
       .from('visits')
       .upsert(draft);
   };
   ```

### Web Audio API
```typescript
// Remplacer le mock timer
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream);
recorder.start();

recorder.ondataavailable = (e) => {
  audioChunks.push(e.data);
};

recorder.onstop = async () => {
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  // Upload vers Supabase Storage
  const { data } = await supabase.storage
    .from('recordings')
    .upload(`${visitId}.webm`, audioBlob);
};
```

### IA API
```typescript
// Backend endpoint
app.post('/api/process-audio', async (req, res) => {
  const audioFile = req.file;
  
  // 1. Transcription (Whisper)
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1"
  });
  
  // 2. Analyse (GPT-4)
  const analysis = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "Analyser cette transcription médicale..."
    }, {
      role: "user",
      content: transcription.text
    }]
  });
  
  res.json({
    summary: analysis.choices[0].message.content,
    transcription: transcription.text,
    structuredDetails: extractStructuredData(analysis),
  });
});
```

### Odoo Integration
```typescript
// Backend endpoint
app.post('/api/odoo/visits', async (req, res) => {
  const visitData = req.body;
  
  const odooResponse = await fetch('https://your-odoo.com/api/visits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ODOO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      patient_id: visitData.patientId,
      summary: visitData.iaData.summary,
      pain_level: visitData.iaData.structuredDetails.douleur,
      vitals: visitData.iaData.structuredDetails.constantes,
      ...
    })
  });
  
  res.json({ success: true, odooId: odooResponse.id });
});
```

## Test du Flux

### Scénario 1 : Nouvelle visite patient
1. Dashboard → Click sur patient → "Démarrer un enregistrement"
2. **E05** : Recording démarre, timer compte
3. Click "Arrêter" après 30s
4. **E06** : Barre de progression (3-4s)
5. **E07** : Revue du résumé IA, ajuster douleur à 5/10, ajouter notes
6. Click "Valider et envoyer vers Odoo"
7. Alert "Visite validée !" → Retour Dashboard

### Scénario 2 : Enregistrement libre (sans patient)
1. Dashboard → "Enregistrer maintenant (sans patient)"
2. **E05** : Recording démarre
3. Même flux que scénario 1
4. Visite sauvegardée avec `patientId: null`

### Scénario 3 : Mettre en attente et reprendre
1. Dashboard → Patient → Enregistrer
2. **E05** → **E06** → **E07** (revue)
3. Click "Mettre en attente et revenir à la tournée"
4. Dashboard affiché, brouillon sauvegardé
5. Plus tard : Historique → Click sur visite "Brouillon"
6. **E07** s'ouvre directement avec les données sauvegardées
7. Modifier résumé, valider → Envoi Odoo

## Statut Actuel

✅ **Terminé :**
- [x] E05_VisitFlow créé avec 3 étapes
- [x] mockIAProcess implémenté
- [x] Gestion brouillons (local state)
- [x] Routes mises à jour
- [x] Documentation complète
- [x] Server running (port 5000)

⏳ **En attente :**
- [ ] Exécuter supabase_migrations.sql
- [ ] Connecter Supabase aux écrans
- [ ] Web Audio API
- [ ] IA API (Whisper + GPT-4)
- [ ] Odoo Integration

## Notes Importantes

1. **E05_RecordingSimple.tsx** est maintenant obsolète et peut être supprimé
2. Le flux actuel utilise des **mock data** - parfait pour le développement UI
3. La structure des données est **déjà compatible** avec le schema Supabase
4. L'interface utilisateur suit **exactement** le design du code Gemini
5. Tous les composants réutilisent **shadcn/ui** pour la cohérence

## Questions ?

Si tu as besoin de :
- Tester le flux : va sur http://localhost:5000
- Modifier le délai IA : ajuste `mockIAProcess` line 20-30
- Ajouter des champs : édite la section "Champs Structurés" dans `E05_VisitFlow.tsx`
- Intégrer Supabase : je peux t'aider avec les queries
