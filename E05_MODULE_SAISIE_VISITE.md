# 📝 Module C - Saisie de Visite (E05_VisitFlow)

## Vue d'ensemble

La page **E05_VisitFlow** est le module principal de saisie de visite pour Synergia Senior. Elle permet aux infirmiers de :
- Enregistrer des notes par **saisie texte** ou **dictée vocale**
- Structurer la visite (type, douleur, photos)
- Utiliser l'**IA** pour générer résumés et transmissions médicales
- Sauvegarder en brouillon ou valider directement

## 🎯 Fonctionnalités

### 1. Informations Patient
- **Nom** : Affiché en haut de page
- **Âge** : Affiché sous le nom
- **Source** : Récupéré depuis AppStore via URL params (`/patients/:id/record`)

### 2. Notes de Visite

#### Saisie Texte
- Grande zone de texte (`<Textarea>`)
- Placeholder : "Dicter ou saisir les observations de la visite…"
- Hauteur minimum : 128px (8rem)

#### Enregistrement Vocal (STT - Speech-to-Text)
- **Composant** : `VoiceRecorderButton`
- **Bouton circulaire** avec icône microphone
- **États** :
  - Repos : Bleu, icône micro
  - En enregistrement : Rouge pulsant, icône carré (stop)
  - En traitement : Bleu, spinner de chargement
- **Fonctionnement** :
  1. Click → démarre `navigator.mediaDevices.getUserMedia({ audio: true })`
  2. Enregistrement via `MediaRecorder` (format webm/opus)
  3. Click stop → arrêt et envoi vers API (actuellement mock)
  4. Transcription concaténée aux notes existantes

### 3. Type de Visite
- **Select dropdown** avec 5 options :
  - Soin
  - Contrôle
  - Pansement
  - Suivi post-op
  - Autre

### 4. Niveau de Douleur
- **Slider** de 0 à 10
- Affichage en temps réel : "X/10" (grande taille, bleu)
- Labels : "Aucune" (0) | "Modérée" (5) | "Extrême" (10)
- **Alerte automatique** si douleur > 7 lors de la validation

### 5. Photos
- **Composant** : `PhotoUploader`
- Maximum : **5 photos**
- Affichage en miniatures (80x80px)
- Bouton "+" pour ajouter (ouvre sélecteur de fichiers)
- Bouton "×" au survol pour supprimer
- Format : `<input type="file" accept="image/*" multiple>`

### 6. Actions IA

#### 6.1 Générer un Résumé
- **Bouton** : Bleu avec icône ✨ Sparkles
- **Endpoint** : `POST /api/ai/summary`
- **Body** :
  ```json
  {
    "patientName": "Claire Martin",
    "patientAge": "78",
    "visitType": "soin",
    "painLevel": 3,
    "notesRaw": "Le patient présente..."
  }
  ```
- **Réponse** : `{ "summary": "..." }`
- **Affichage** : Encadré bleu avec bordure gauche bleue, titre "Résumé IA"
- **État** : Loading spinner pendant génération (2s mock)

#### 6.2 Transmission Médecin
- **Bouton** : Outline avec icône 📤 Send
- **Endpoint** : `POST /api/ai/transmission`
- **Body** : Même que résumé + `notesSummary`
- **Réponse** : `{ "transmission": "..." }`
- **Affichage** : Modal avec titre "Transmission pour le médecin"
- **Actions modal** :
  - **Copier** : `navigator.clipboard.writeText(content)`
  - **Fermer** : Ferme le modal

#### 6.3 Actions Rapides
- **Bouton** : Outline avec icône ⚡ Zap
- **Affichage** : Modal "Actions rapides"
- **Contenu** : 3 actions mockées
  - 📅 Programmer une visite de contrôle
  - ⚠️ Marquer comme visite à risque
  - 📨 Envoyer une notification au médecin
- **Comportement** : `console.log` + alert (placeholder)

### 7. Sauvegarde

#### 7.1 Valider la Visite
- **Bouton** : Vert, pleine largeur, arrondi
- **Comportement** :
  - Crée une `Visit` avec `validated: true`
  - Génère automatiquement une alerte si `painLevel > 7`
  - Sauvegarde dans AppStore via `addVisit()`
  - Navigation → `/patients/:id/history` ou `/recordings`

#### 7.2 Enregistrer en Brouillon
- **Bouton** : Outline, pleine largeur
- **Comportement** :
  - Crée une `Visit` avec `validated: false`
  - Sauvegarde dans AppStore
  - Navigation → `/patients/:id/history` ou `/recordings`

## 🔌 Intégrations API

### API Routes (Backend)

#### `/api/ai/summary` (POST)
```typescript
// Body
{
  patientName: string,
  patientAge: string,
  visitType: VisitType,
  painLevel: number,
  notesRaw: string
}

// Response
{
  summary: string
}
```

**TODO OpenAI** :
```typescript
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{
    role: "system",
    content: "Tu es un assistant médical. Génère un résumé structuré de la visite."
  }, {
    role: "user",
    content: `Patient: ${patientName}, ${patientAge} ans. Notes: ${notesRaw}`
  }]
});

const summary = completion.choices[0].message.content;
```

#### `/api/ai/transmission` (POST)
```typescript
// Body (même que summary + notesSummary)
{
  patientName: string,
  patientAge: string,
  visitType: VisitType,
  painLevel: number,
  notesRaw: string,
  notesSummary?: string
}

// Response
{
  transmission: string
}
```

**TODO OpenAI** : Similaire à `/summary` avec prompt médical structuré

#### `/api/voice/transcribe` (POST)
```typescript
// Body: multipart/form-data
{
  audio: File (webm/opus)
}

// Response
{
  transcription: string
}
```

**TODO OpenAI Whisper** :
```typescript
import OpenAI from 'openai';
import formidable from 'formidable';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Parser multipart/form-data
const form = formidable();
const [fields, files] = await form.parse(req);

const transcription = await openai.audio.transcriptions.create({
  file: files.audio[0],
  model: 'whisper-1',
  language: 'fr'
});

res.json({ transcription: transcription.text });
```

### Frontend Integration

**VoiceRecorderButton.tsx** :
```typescript
// Dans mediaRecorder.onstop
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

## 📦 Structure des Données

### VisitFormData (Frontend State)
```typescript
interface VisitFormData {
  patientId: string;
  patientName: string;
  patientAge: string;
  visitType: VisitType; // 'soin' | 'controle' | 'pansement' | 'suivi-post-op' | 'autre'
  painLevel: number; // 0-10
  notesRaw: string;
  notesSummary: string | null;
  photos: File[]; // Max 5, client-side only
}
```

### Visit (AppStore)
```typescript
interface Visit {
  id: string;
  patientId: string | null;
  date: string; // ISO string
  durationSeconds: number;
  durationMinSec: string;
  iaData: {
    summary: string;
    transcription: string;
    riskLevel: string; // 'faible' | 'élevé'
    structuredDetails: {
      type: string;
      douleur: number;
      constantes: string;
      alertes: Alert[];
      date: string;
      time: string;
    };
  };
  validated: boolean;
}
```

## 🎨 Design & UX

### Layout
- **Background** : `bg-gray-50`
- **Container** : Centré, max-width 448px (md)
- **Cards** : Blanc, `rounded-2xl`, `shadow-sm`, padding 16px
- **Espacement** : `space-y-4` entre sections

### Mobile-First
- Toutes les sections sont empilées verticalement
- Boutons pleine largeur (`w-full`)
- Input/Select avec bonne taille tactile (h-12)

### Accessibility
- Labels clairs et visibles
- Placeholder informatifs
- États disabled visuellement distincts
- Focus states sur tous les inputs

### Feedback Utilisateur
- **Loading states** : Spinners avec texte "Génération en cours..."
- **Animations** : Pulse sur bouton d'enregistrement
- **Alerts** : Via `alert()` pour actions rapides (temporaire)
- **Clipboard** : Confirmation "Transmission copiée !"

## 🔄 Navigation

### Entrées
- `/patients/:id/record` → Visite patient
- `/recordings/new-free` → Enregistrement libre

### Sorties
- **Retour** (ArrowLeft) → `/patients/:id` ou `/`
- **Validation/Brouillon** → `/patients/:id/history` ou `/recordings`

## 📝 Notes Techniques

### Permissions Micro
Le composant `VoiceRecorderButton` demande la permission via :
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

**Gestion d'erreur** : Alert si permission refusée

### MediaRecorder API
- **MimeType** : `audio/webm;codecs=opus`
- **Start** : `mediaRecorder.start()`
- **Stop** : `mediaRecorder.stop()`
- **Cleanup** : `stream.getTracks().forEach(track => track.stop())`

### Photos en Mémoire
Les photos sont stockées dans le state React (`File[]`) mais **pas envoyées** au backend pour l'instant.

**TODO** : Upload vers storage (Supabase Storage ou S3)

## 🚀 Prochaines Étapes

### 1. Intégration OpenAI
- [ ] Installer `npm install openai`
- [ ] Configurer `OPENAI_API_KEY` dans `.env`
- [ ] Remplacer mocks dans `/api/ai/summary`
- [ ] Remplacer mocks dans `/api/ai/transmission`
- [ ] Implémenter `/api/voice/transcribe` avec Whisper

### 2. Upload Photos
- [ ] Intégrer Supabase Storage ou équivalent
- [ ] Upload lors de la validation
- [ ] Stocker URLs dans `Visit.iaData.photos`

### 3. Constantes Vitales
- [ ] Ajouter champs : Tension, FC, Saturation, Température
- [ ] Afficher dans la section "Niveau de douleur"
- [ ] Intégrer dans le résumé IA

### 4. Actions Rapides Réelles
- [ ] Implémenter "Programmer une visite de contrôle"
- [ ] Implémenter "Marquer comme visite à risque"
- [ ] Implémenter "Envoyer une notification au médecin"

## 🐛 Debug

### Logs Importants
- `VoiceRecorderButton` : "Erreur d'accès au microphone"
- Routes API : "Error generating summary/transmission"
- Navigation : Vérifier `patientId` dans console

### Tests Manuels
1. Ouvrir `/patients/pat-1/record`
2. Saisir du texte dans notes
3. Cliquer sur micro → vérifier pulse + ajout texte mock
4. Changer type de visite et douleur
5. Générer résumé → vérifier encadré bleu
6. Générer transmission → vérifier modal + copie
7. Valider → vérifier navigation vers historique

---

**Version** : 1.0.0  
**Auteur** : Antonio (avec Claude)  
**Date** : 25 novembre 2025
