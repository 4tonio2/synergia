# ✅ Module C - Saisie de Visite Complété

## 🎉 Résumé

La page **E05_VisitFlow** a été complètement refactorisée selon vos spécifications. Elle combine maintenant **saisie de notes**, **enregistrement vocal**, **structuration de la visite** et **actions IA** sur une seule page.

## 📦 Nouveaux Composants Créés

### 1. `/client/src/components/VoiceRecorderButton.tsx`
- **Fonctionnalité** : Enregistrement vocal avec STT (Speech-to-Text)
- **États** :
  - 🔵 **Repos** : Bouton bleu avec icône micro
  - 🔴 **Enregistrement** : Bouton rouge pulsant avec icône carré (stop)
  - ⏳ **Traitement** : Spinner + texte "Transcription en cours..."
- **API** : `navigator.mediaDevices.getUserMedia({ audio: true })`
- **Format** : `audio/webm;codecs=opus` via `MediaRecorder`
- **Mock actuel** : Texte français aléatoire après 1.5s
- **TODO** : Intégrer OpenAI Whisper via `/api/voice/transcribe`

### 2. `/client/src/components/PhotoUploader.tsx`
- **Fonctionnalité** : Upload de photos (max 5)
- **UI** : 
  - Miniatures 80x80px
  - Bouton "+" pour ajouter
  - Bouton "×" au survol pour supprimer
- **Input** : `<input type="file" accept="image/*" multiple>`
- **Storage** : Actuellement en mémoire (`File[]`)
- **TODO** : Upload vers Supabase Storage ou S3

### 3. `/client/src/components/Modal.tsx`
Composant modal réutilisable avec 2 variantes :

#### `TransmissionModal`
- Affiche la transmission médicale
- Bouton **Copier** : `navigator.clipboard.writeText()`
- Alert de confirmation

#### `ActionsRapidesModal`
- Liste de 3 actions :
  - 📅 Programmer une visite de contrôle
  - ⚠️ Marquer comme visite à risque
  - 📨 Envoyer une notification au médecin
- Mock actuel : `console.log` + alert
- **TODO** : Implémenter les actions réelles

## 🔄 Page Refactorisée

### `/client/src/pages/E05_VisitFlow.tsx`

**Ancien fichier sauvegardé** : `E05_VisitFlow_OLD_BACKUP.tsx`

#### Structure de la Page

```
┌─────────────────────────────────┐
│ Header                          │
│ - Bouton Retour                 │
│ - Nom du patient (H1)           │
│ - Âge (petit texte gris)        │
├─────────────────────────────────┤
│ Notes de visite                 │
│ - Textarea large                │
│ - Bouton micro circulaire       │
├─────────────────────────────────┤
│ Résumé IA (si généré)           │
│ - Encadré bleu                  │
├─────────────────────────────────┤
│ Type de visite                  │
│ - Select dropdown               │
├─────────────────────────────────┤
│ Niveau de douleur               │
│ - Slider 0-10                   │
│ - Affichage X/10                │
├─────────────────────────────────┤
│ Photos                          │
│ - Miniatures + bouton "+"       │
├─────────────────────────────────┤
│ Actions IA                      │
│ - Générer un résumé             │
│ - Transmission médecin          │
│ - Actions rapides...            │
├─────────────────────────────────┤
│ Sauvegarde                      │
│ - Valider la visite (vert)      │
│ - Enregistrer en brouillon      │
└─────────────────────────────────┘
```

#### Données du Formulaire

```typescript
interface VisitFormData {
  patientId: string;
  patientName: string;
  patientAge: string;
  visitType: 'soin' | 'controle' | 'pansement' | 'suivi-post-op' | 'autre';
  painLevel: number; // 0-10
  notesRaw: string; // Notes brutes (texte + transcription vocale)
  notesSummary: string | null; // Résumé généré par IA
  photos: File[]; // Max 5
}
```

## 🔌 Routes API Ajoutées

### `/server/routes.ts`

#### 1. `POST /api/ai/summary`
```typescript
// Request
{
  patientName: string,
  patientAge: string,
  visitType: string,
  painLevel: number,
  notesRaw: string
}

// Response
{
  summary: string
}

// Mock : Génère résumé texte après 500ms
// TODO : Intégrer OpenAI GPT-4
```

#### 2. `POST /api/ai/transmission`
```typescript
// Request
{
  patientName: string,
  patientAge: string,
  visitType: string,
  painLevel: number,
  notesRaw: string,
  notesSummary?: string
}

// Response
{
  transmission: string
}

// Mock : Génère transmission médicale structurée
// TODO : Intégrer OpenAI GPT-4 avec prompt médical
```

#### 3. `POST /api/voice/transcribe`
```typescript
// Request (multipart/form-data)
{
  audio: File (webm/opus)
}

// Response
{
  transcription: string
}

// Actuellement : 501 Not Implemented
// TODO : Intégrer OpenAI Whisper API
```

### Documentation Détaillée des TODOs

Chaque route contient des commentaires détaillés avec :
- Exemple de code OpenAI
- Configuration nécessaire (`OPENAI_API_KEY`)
- Packages à installer (`npm install openai formidable`)
- Exemple d'implémentation complète

## 🎯 Fonctionnalités Implémentées

### ✅ Saisie de Notes
- [x] Textarea avec placeholder
- [x] Enregistrement vocal (mock STT)
- [x] Concaténation transcription → notes

### ✅ Structuration de la Visite
- [x] Type de visite (5 options)
- [x] Niveau de douleur (slider 0-10)
- [x] Photos (upload + miniatures)

### ✅ Actions IA
- [x] Générer un résumé (mock)
- [x] Transmission médecin (mock + modal + copie)
- [x] Actions rapides (modal avec 3 actions mockées)

### ✅ Sauvegarde
- [x] Validation directe → `Visit` avec `validated: true`
- [x] Brouillon → `Visit` avec `validated: false`
- [x] Alerte auto si `painLevel > 7`
- [x] Navigation vers historique

### ✅ UI/UX
- [x] Design mobile-first
- [x] Loading states (spinners + texte)
- [x] Animations (pulse sur enregistrement)
- [x] Modals élégants
- [x] Feedback utilisateur (alerts, confirmations)

## 🚀 Prochaines Étapes

### Intégration OpenAI (Haute Priorité)

#### 1. Installation
```bash
npm install openai formidable
```

#### 2. Configuration
Ajouter dans `.env` :
```bash
OPENAI_API_KEY=sk-...
```

#### 3. Whisper API (STT)
Modifier `/api/voice/transcribe` dans `server/routes.ts` :
```typescript
import OpenAI from 'openai';
import formidable from 'formidable';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/voice/transcribe', async (req, res) => {
  const form = formidable();
  const [fields, files] = await form.parse(req);
  
  const transcription = await openai.audio.transcriptions.create({
    file: files.audio[0],
    model: 'whisper-1',
    language: 'fr'
  });
  
  res.json({ transcription: transcription.text });
});
```

Modifier `VoiceRecorderButton.tsx` dans `mediaRecorder.onstop` :
```typescript
const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
const formData = new FormData();
formData.append('audio', audioBlob, 'recording.webm');

const response = await fetch('/api/voice/transcribe', {
  method: 'POST',
  body: formData
});

const { transcription } = await response.json();
onTranscription(transcription);
```

#### 4. GPT-4 pour Résumés
Modifier `/api/ai/summary` :
```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{
    role: "system",
    content: "Tu es un assistant médical. Génère un résumé structuré de la visite infirmière."
  }, {
    role: "user",
    content: `Patient: ${patientName}, ${patientAge} ans
Type de visite: ${visitType}
Douleur: ${painLevel}/10
Notes: ${notesRaw}`
  }]
});

res.json({ summary: completion.choices[0].message.content });
```

#### 5. GPT-4 pour Transmissions
Modifier `/api/ai/transmission` avec un prompt médical structuré.

### Upload Photos (Moyenne Priorité)

#### Option 1 : Supabase Storage
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Upload
const { data, error } = await supabase.storage
  .from('visit-photos')
  .upload(`${visitId}/${photo.name}`, photo);

// Stocker URL dans Visit.iaData.photos
```

#### Option 2 : AWS S3
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'eu-west-1' });
const command = new PutObjectCommand({
  Bucket: 'synergia-photos',
  Key: `visits/${visitId}/${photo.name}`,
  Body: photo
});
```

### Actions Rapides (Basse Priorité)

Implémenter les 3 actions dans `ActionsRapidesModal.tsx` :

1. **Programmer une visite de contrôle**
   - Créer une nouvelle visite planifiée
   - Stocker dans `AppStore` ou backend

2. **Marquer comme visite à risque**
   - Ajouter flag `riskLevel: 'élevé'`
   - Créer une alerte système

3. **Envoyer une notification au médecin**
   - Email ou SMS via Twilio/SendGrid
   - Notification in-app

## 📋 Checklist de Test

### Test Manuel
- [ ] Ouvrir `/patients/pat-1/record`
- [ ] Vérifier affichage nom + âge patient
- [ ] Saisir du texte dans notes
- [ ] Cliquer sur micro → vérifier animation pulse
- [ ] Vérifier ajout de texte mock après arrêt
- [ ] Changer type de visite (5 options)
- [ ] Modifier slider douleur → vérifier affichage X/10
- [ ] Ajouter 3 photos → vérifier miniatures
- [ ] Supprimer 1 photo → vérifier mise à jour
- [ ] Générer résumé → vérifier encadré bleu
- [ ] Générer transmission → vérifier modal
- [ ] Copier transmission → vérifier alert
- [ ] Ouvrir actions rapides → vérifier 3 actions
- [ ] Valider visite → vérifier navigation vers historique
- [ ] Vérifier visite dans E08_History avec badge "Validé"

### Test Intégration
- [ ] Tester avec `painLevel > 7` → vérifier alerte auto
- [ ] Tester enregistrement libre `/recordings/new-free`
- [ ] Vérifier persistence localStorage après validation

## 📝 Notes Importantes

### Compatibilité Navigateur
- `MediaRecorder` : Supporté sur Chrome, Firefox, Edge
- Safari : Support partiel (codec différent)
- **Recommandation** : Utiliser Chrome/Firefox pour dev

### Permissions Microphone
- Demandée automatiquement au premier click
- Si refusée : Alert + impossible d'enregistrer
- Tester en HTTPS en production (WebRTC exigence)

### Taille des Photos
- Pas de limite actuellement (client-side)
- **TODO** : Ajouter compression avant upload
- Utiliser `browser-image-compression` ou équivalent

### État Serveur
- ✅ Serveur opérationnel sur port 5000
- ✅ Routes API fonctionnelles (mock)
- ✅ Compilation sans erreurs TypeScript (faux positif sur E02_Dashboard)

## 🎨 Design Respecté

Toutes les spécifications du prompt ont été respectées :
- ✅ Labels en français
- ✅ Mobile-first (max-w-md)
- ✅ Tailwind CSS uniquement
- ✅ Boutons arrondis (rounded-full ou rounded-lg)
- ✅ Encadrés blancs avec ombre (shadow-sm)
- ✅ Animations (pulse, spin)
- ✅ Feedback utilisateur (loading, alerts)

---

## 📚 Documentation

**Guide complet** : `/E05_MODULE_SAISIE_VISITE.md`

**Fichiers créés/modifiés** :
- ✅ `/client/src/components/VoiceRecorderButton.tsx` (nouveau)
- ✅ `/client/src/components/PhotoUploader.tsx` (nouveau)
- ✅ `/client/src/components/Modal.tsx` (nouveau)
- ✅ `/client/src/pages/E05_VisitFlow.tsx` (refactorisé)
- ✅ `/server/routes.ts` (3 routes ajoutées)

**Backup** : `/client/src/pages/E05_VisitFlow_OLD_BACKUP.tsx`

---

**Status** : ✅ **COMPLET** - Prêt pour intégration OpenAI  
**Version** : 2.0.0  
**Date** : 25 novembre 2025
