# Guide E05_VisitFlow - Flux Complet d'Enregistrement

## Vue d'ensemble

Le composant **E05_VisitFlow** fusionne les 3 écrans E05, E06, et E07 du code Gemini pour créer un flux complet d'enregistrement vocal médical :

```
E05 (Recording) → E06 (Processing) → E07 (Validation) → Envoi Odoo
```

## Architecture du Composant

### États Principaux

```typescript
type Stage = 'recording' | 'processing' | 'review';
```

1. **recording** : Enregistrement vocal en cours
2. **processing** : Traitement IA (analyse + structuration)
3. **review** : Revue et édition du draft IA avant validation finale

### Props

```typescript
interface E05VisitFlowProps {
  patient?: Patient | null;           // Patient associé (null = enregistrement libre)
  visitDraft?: VisitDraft | null;     // Brouillon existant (pour reprendre)
  onSaveDraft?: (draft: VisitDraft) => void;  // Sauvegarde brouillon
  onValidate?: (visit: VisitDraft) => void;   // Validation finale
}
```

## Flux de Navigation

### 1️⃣ Écran E05 - Recording (Enregistrement)

**Fonctionnalités :**
- Timer en temps réel (auto-stop à 2 minutes)
- VU-mètre animé (onde sonore SVG)
- Indicateurs : connectivité, batterie, mode offline
- Cadrage Plode Care (guide pour l'infirmier)
- Bouton STOP rouge pour arrêter l'enregistrement

**Actions disponibles :**
- `handleStopRecording()` → Lance le traitement IA et passe à l'étape suivante

### 2️⃣ Écran E06 - Processing (Traitement IA)

**Fonctionnalités :**
- Barre de progression animée (75% pour simulation)
- Message "Génération du résumé et structuration..."
- Spinner de chargement
- Durée d'enregistrement affichée

**Traitement IA (mockIAProcess) :**
```javascript
// Délai : max(3s, durée_enregistrement * 100ms + 1s)
const time = Math.max(3000, recordingDuration * 100 + 1000);

// Génère automatiquement :
- summary (résumé narratif)
- transcription (conversation brute)
- structuredDetails (type de soin, douleur 0-10, constantes, date/heure)
- alertes (tableau d'alertes critiques avec niveau + description)
- riskLevel (Faible/Modéré/Élevé)
```

**Actions automatiques :**
- Sauvegarde du brouillon via `onSaveDraft()`
- Passage automatique à l'étape `review`

### 3️⃣ Écran E07 - Validation (Revue & Édition)

**Sections éditables :**

1. **Résumé/Synthèse de la Visite** (Textarea)
   - Généré par l'IA
   - Éditable par l'infirmier
   - Badge "IA" pour indiquer l'origine

2. **Champs Structurés (Critique)**
   - **Date & Heure** : Pill non-éditable (auto-généré)
   - **Douleur (0-10)** : Slider interactif
   - **Constantes** : Input texte (ex: "Tension normale, Saturation 98%")
   - **Type de soin** : Pill (ex: "Surveillance", "Pansement")

3. **Transcription brute** (Read-only)
   - Conversation complète infirmier ↔ patient
   - Scrollable (max-height: 40)
   - Border gris à gauche

4. **Alertes critiques** (Si détectées)
   - Bloc rouge avec icône AlertTriangle
   - Liste des alertes avec niveau (badge)
   - Exemple : "Douleur signalée (3/10) - à suivre [Modéré]"

5. **Notes additionnelles** (Optionnel)
   - Textarea libre
   - Permet d'ajouter des observations complémentaires

**Actions disponibles :**

- **✅ Valider et envoyer vers Odoo** (Bouton principal)
  - Sauvegarde finale avec `validated: true`
  - Alert de confirmation
  - Redirection vers Dashboard

- **🔄 Mettre en attente et revenir à la tournée** (Bouton secondaire)
  - Sauvegarde du brouillon (état édité)
  - Retour au Dashboard
  - Reprise possible depuis E08_History ou E10_Recordings

## Gestion des Brouillons

### Sauvegarde automatique
```typescript
const draft: VisitDraft = {
  id: crypto.randomUUID(),           // ID unique
  patientId: patient?.id || null,    // null = visite libre
  date: new Date().toISOString(),
  durationSeconds: timer,
  durationMinSec: "2'34''",          // Format affiché
  iaData: { summary, structuredDetails, ... },
  validated: false                   // Brouillon
};
```

### Reprise d'un brouillon
- Détection : Si `visitDraft.iaData` existe → `stage = 'review'`
- Pre-remplissage des champs éditables
- Possibilité de continuer l'édition et valider

## Intégration avec les Autres Écrans

### Depuis E02_Dashboard
```tsx
// Bouton "Enregistrer maintenant (sans patient)"
<Button onClick={() => navigate('/recordings/new-free')}>
  <Volume2 /> Enregistrer maintenant
</Button>
```

### Depuis E03_PatientSheet
```tsx
// CTA principal
<Button onClick={() => navigate(`/patients/${patient.id}/record`)}>
  Démarrer un enregistrement pour ce patient
</Button>
```

### Depuis E08_History (Reprendre un brouillon)
```tsx
// Affichage des brouillons avec badge "En attente validation"
{visit.validated ? (
  <Pill color="green">Validé</Pill>
) : (
  <Pill color="yellow">Brouillon (Attente validation)</Pill>
)}
```

### Depuis E09_VisitDetail (Édition)
```tsx
// Bouton "Reprendre la validation" pour les brouillons
<Button onClick={() => onEditVisit(visit)}>
  {visit.validated ? 'Modifier le rapport' : 'Reprendre la validation'}
</Button>
```

## Routes

```tsx
// Patient associé
<Route path="/patients/:id/record">
  <E05_VisitFlow />
</Route>

// Enregistrement libre
<Route path="/recordings/new-free">
  <E05_VisitFlow />
</Route>
```

## TODO : Intégration Future

### Backend Supabase
```sql
-- Table visits déjà créée dans supabase_migrations.sql
CREATE TABLE visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  nurse_id uuid REFERENCES auth.users(id) NOT NULL,
  date timestamptz DEFAULT now(),
  duration_seconds integer NOT NULL,
  audio_url text,                    -- Supabase Storage URL
  transcription text,
  ai_summary text,
  pain_level integer CHECK (pain_level BETWEEN 0 AND 10),
  vitals jsonb,                      -- { tension, saturation, etc. }
  alerts jsonb DEFAULT '[]'::jsonb,  -- Alertes détectées
  notes text,
  validated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Web Audio API
```typescript
// Remplacer le mock timer par un vrai enregistrement
const recorder = new MediaRecorder(stream);
recorder.start();
recorder.ondataavailable = (e) => {
  audioChunks.push(e.data);
};
```

### IA Real API
```typescript
// Remplacer mockIAProcess par :
const aiResult = await fetch('/api/process-audio', {
  method: 'POST',
  body: formData,  // Audio blob
});
// API backend → Whisper (transcription) → GPT-4 (analyse)
```

### Odoo Integration
```typescript
// Envoyer les données validées vers Odoo
await fetch('/api/odoo/visits', {
  method: 'POST',
  body: JSON.stringify(finalVisitData)
});
```

## Différences avec E05_RecordingSimple

| Feature | E05_RecordingSimple | E05_VisitFlow |
|---------|---------------------|---------------|
| Écrans | 1 seul (recording) | 3 fusionnés (recording + processing + validation) |
| Traitement IA | Alert simple | Écran de progression + résultats structurés |
| Édition | ❌ Non | ✅ Oui (résumé, douleur, constantes, notes) |
| Brouillons | ❌ Non | ✅ Oui (sauvegarde/reprise) |
| Transcription | ❌ Non | ✅ Oui (affichée en read-only) |
| Alertes | ❌ Non | ✅ Oui (détection + affichage) |
| Validation Odoo | ❌ Non | ✅ Oui (bouton final) |

## Statut Actuel

✅ **Implémenté :**
- [x] Écran E05 (Recording) avec timer et VU-mètre
- [x] Écran E06 (Processing) avec barre de progression
- [x] Écran E07 (Validation) avec champs éditables
- [x] mockIAProcess avec résultats réalistes
- [x] Gestion des brouillons (sauvegarde/reprise)
- [x] Navigation multi-étapes
- [x] Support patient + visite libre
- [x] Routes configurées dans App.tsx

⏳ **À faire :**
- [ ] Connexion Supabase pour sauvegarder les brouillons
- [ ] Web Audio API pour enregistrement réel
- [ ] Supabase Storage pour fichiers audio
- [ ] Intégration API IA (Whisper + GPT-4)
- [ ] Envoi réel vers Odoo
- [ ] Notifications push pour alertes critiques
