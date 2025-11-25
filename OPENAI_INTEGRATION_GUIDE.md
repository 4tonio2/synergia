# 🔌 Guide d'Intégration OpenAI - Synergia Senior

## Vue d'ensemble

Ce guide décrit comment intégrer OpenAI (Whisper pour STT et GPT-4 pour résumés/transmissions) dans le module de saisie de visite (E05_VisitFlow).

## Prérequis

### 1. Compte OpenAI
- Créer un compte sur https://platform.openai.com
- Générer une clé API dans "API Keys"
- **Important** : Cette clé est secrète, ne jamais la commiter

### 2. Installation
```bash
npm install openai formidable
npm install --save-dev @types/formidable
```

### 3. Configuration
Ajouter dans `/home/tonio/Projects/Synergia-Claude/.env` :
```bash
OPENAI_API_KEY=sk-proj-...votre-clé...
```

## 🎤 Intégration Whisper (Speech-to-Text)

### Backend : `/server/routes.ts`

Remplacer la route mock par :

```typescript
import OpenAI from 'openai';
import formidable from 'formidable';
import fs from 'fs';

// Initialiser OpenAI (en haut du fichier)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Route STT
app.post('/api/voice/transcribe', async (req: Request, res: Response) => {
  try {
    // Parser le multipart/form-data
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB max
      keepExtensions: true
    });
    
    const [fields, files] = await form.parse(req);
    
    // Vérifier qu'on a bien un fichier audio
    if (!files.audio || files.audio.length === 0) {
      return res.status(400).json({ 
        error: 'Aucun fichier audio fourni' 
      });
    }
    
    const audioFile = files.audio[0];
    
    // Appeler Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFile.filepath),
      model: 'whisper-1',
      language: 'fr', // Français
      response_format: 'text'
    });
    
    // Nettoyer le fichier temporaire
    fs.unlinkSync(audioFile.filepath);
    
    res.json({ transcription });
    
  } catch (error) {
    console.error('Erreur transcription Whisper:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la transcription',
      details: error.message 
    });
  }
});
```

### Frontend : `/client/src/components/VoiceRecorderButton.tsx`

Remplacer la section `onstop` par :

```typescript
mediaRecorder.onstop = async () => {
  // Arrêter tous les tracks du stream
  stream.getTracks().forEach(track => track.stop());
  
  setIsProcessing(true);
  
  try {
    // Créer le blob audio
    const audioBlob = new Blob(chunksRef.current, { 
      type: 'audio/webm;codecs=opus' 
    });
    
    // Préparer FormData
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    
    // Envoyer vers l'API
    const response = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const { transcription } = await response.json();
    
    // Callback avec le texte transcrit
    onTranscription(transcription);
    
  } catch (error) {
    console.error('Erreur de transcription:', error);
    alert('Erreur lors de la transcription. Vérifiez votre connexion.');
  } finally {
    setIsProcessing(false);
  }
};
```

### Test
1. Ouvrir `/patients/pat-1/record`
2. Cliquer sur le bouton micro (autoriser permission)
3. Parler en français : "Le patient présente une douleur au genou gauche."
4. Cliquer sur stop
5. Vérifier que le texte apparaît dans la zone de notes

## 🤖 Intégration GPT-4 (Résumés IA)

### Backend : `/server/routes.ts`

Remplacer la route `/api/ai/summary` par :

```typescript
app.post('/api/ai/summary', async (req: Request, res: Response) => {
  try {
    const { patientName, patientAge, visitType, painLevel, notesRaw } = req.body;
    
    // Validation
    if (!notesRaw || notesRaw.trim().length === 0) {
      return res.status(400).json({ 
        error: "Les notes de visite sont requises" 
      });
    }
    
    // Prompt système optimisé pour résumés médicaux
    const systemPrompt = `Tu es un assistant médical IA spécialisé dans la rédaction de résumés de visites infirmières à domicile.

Ton rôle :
- Synthétiser les observations de l'infirmier(ère)
- Identifier les points clés médicaux
- Structurer de manière claire et concise
- Mettre en évidence les éléments nécessitant une attention particulière

Format du résumé :
1. Contexte patient (âge, pathologies si mentionnées)
2. Observations principales
3. Constantes vitales si présentes
4. Douleur et symptômes
5. Actions réalisées
6. Recommandations`;

    const userPrompt = `Visite infirmière à domicile

PATIENT
- Nom : ${patientName}
- Âge : ${patientAge} ans

VISITE
- Type : ${visitType}
- Niveau de douleur : ${painLevel}/10

NOTES DE L'INFIRMIER(ÈRE)
${notesRaw}

Génère un résumé professionnel et structuré de cette visite.`;

    // Appel GPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // ou "gpt-4" selon ton quota
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3, // Peu de créativité, plus factuel
      max_tokens: 500
    });
    
    const summary = completion.choices[0].message.content;
    
    res.json({ summary });
    
  } catch (error) {
    console.error('Erreur génération résumé:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la génération du résumé',
      details: error.message
    });
  }
});
```

### Test
1. Saisir des notes : "Le patient se plaint de douleurs au genou. Pansement refait. TA 13/8."
2. Sélectionner "Pansement" comme type
3. Régler douleur à 5/10
4. Cliquer sur "Générer un résumé"
5. Vérifier le résumé structuré dans l'encadré bleu

## 📨 Intégration GPT-4 (Transmissions Médicales)

### Backend : `/server/routes.ts`

Remplacer la route `/api/ai/transmission` par :

```typescript
app.post('/api/ai/transmission', async (req: Request, res: Response) => {
  try {
    const { 
      patientName, 
      patientAge, 
      visitType, 
      painLevel, 
      notesRaw, 
      notesSummary 
    } = req.body;
    
    if (!notesRaw || notesRaw.trim().length === 0) {
      return res.status(400).json({ 
        error: "Les notes de visite sont requises" 
      });
    }
    
    const systemPrompt = `Tu es un assistant médical IA spécialisé dans la rédaction de transmissions médicales pour les médecins traitants.

Ton rôle :
- Rédiger une transmission formelle et professionnelle
- Utiliser la terminologie médicale appropriée
- Structurer selon les normes SOAP (Subjectif, Objectif, Analyse, Plan) si pertinent
- Mettre en évidence les éléments nécessitant une décision médicale

Format de la transmission :
- En-tête avec date et identité du patient
- Motif de la visite
- Observations et constantes
- Évaluation infirmière
- Actions réalisées
- Points d'attention pour le médecin
- Recommandations de suivi`;

    const userPrompt = `Transmission pour le Dr. [Médecin traitant]

PATIENT
- Nom : ${patientName}
- Âge : ${patientAge} ans

VISITE INFIRMIÈRE
- Date : ${new Date().toLocaleDateString('fr-FR')}
- Type : ${visitType}
- Douleur évaluée : ${painLevel}/10

NOTES INFIRMIÈRES
${notesRaw}

${notesSummary ? `RÉSUMÉ IA\n${notesSummary}\n` : ''}

Rédige une transmission médicale complète et professionnelle pour le médecin traitant.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2, // Très factuel
      max_tokens: 800
    });
    
    const transmission = completion.choices[0].message.content;
    
    res.json({ transmission });
    
  } catch (error) {
    console.error('Erreur génération transmission:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la génération de la transmission',
      details: error.message
    });
  }
});
```

### Test
1. Après avoir saisi des notes et généré un résumé
2. Cliquer sur "Transmission médecin"
3. Vérifier le modal avec transmission formelle
4. Tester le bouton "Copier"
5. Coller dans un éditeur de texte pour vérifier

## 🎯 Optimisations Recommandées

### 1. Cache des Résumés
Pour éviter de régénérer le même résumé :

```typescript
// Dans E05_VisitFlow.tsx
const [cachedSummary, setCachedSummary] = useState<string | null>(null);

const handleGenerateSummary = async () => {
  // Vérifier si les notes ont changé
  const notesHash = hashString(formData.notesRaw);
  
  if (cachedSummary && lastNotesHash === notesHash) {
    // Utiliser le cache
    setFormData(prev => ({ ...prev, notesSummary: cachedSummary }));
    return;
  }
  
  // Sinon, appeler l'API...
};
```

### 2. Streaming (Réponse Progressive)
Pour afficher le résumé au fur et à mesure :

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4-turbo-preview",
  messages: [...],
  stream: true
});

for await (const chunk of completion) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    // Envoyer via Server-Sent Events (SSE)
    res.write(`data: ${JSON.stringify({ content })}\n\n`);
  }
}
```

### 3. Gestion des Erreurs Côté Client

```typescript
// Dans E05_VisitFlow.tsx
const handleGenerateSummary = async () => {
  setIsGeneratingSummary(true);
  
  try {
    const response = await fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientName: formData.patientName,
        patientAge: formData.patientAge,
        visitType: formData.visitType,
        painLevel: formData.painLevel,
        notesRaw: formData.notesRaw
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur inconnue');
    }
    
    const { summary } = await response.json();
    
    setFormData(prev => ({
      ...prev,
      notesSummary: summary
    }));
    
  } catch (error) {
    console.error('Erreur génération résumé:', error);
    alert(`Erreur : ${error.message}\nVeuillez réessayer.`);
  } finally {
    setIsGeneratingSummary(false);
  }
};
```

## 💰 Coûts OpenAI

### Whisper API
- **Prix** : ~$0.006 par minute d'audio
- **Exemple** : 100 enregistrements de 2 min = $1.20

### GPT-4 Turbo
- **Input** : $0.01 / 1K tokens
- **Output** : $0.03 / 1K tokens
- **Exemple** : 100 résumés (500 tokens chacun) = ~$2.00

### Limite de Débit (Rate Limits)
- **Whisper** : 50 requêtes/min
- **GPT-4** : 10,000 tokens/min (Tier 1)

**Conseil** : Surveiller l'usage sur https://platform.openai.com/usage

## 🔒 Sécurité

### 1. Jamais exposer la clé API côté client
❌ **Mauvais** :
```typescript
// VoiceRecorderButton.tsx
const openai = new OpenAI({ apiKey: 'sk-...' }); // DANGER !
```

✅ **Bon** :
```typescript
// server/routes.ts (backend uniquement)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

### 2. Validation des données
```typescript
// Limiter la taille des notes pour éviter abus
if (notesRaw.length > 10000) {
  return res.status(400).json({ 
    error: 'Notes trop longues (max 10000 caractères)' 
  });
}
```

### 3. Authentification
Ajouter `isAuthenticated` middleware :
```typescript
app.post('/api/ai/summary', isAuthenticated, async (req, res) => {
  // Seulement les utilisateurs authentifiés peuvent appeler
});
```

## 🧪 Tests

### Test Whisper
```bash
# Enregistrer un fichier audio test
curl -X POST http://localhost:5000/api/voice/transcribe \
  -F "audio=@test-audio.webm"
```

### Test GPT-4 Résumé
```bash
curl -X POST http://localhost:5000/api/ai/summary \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Claire Martin",
    "patientAge": "78",
    "visitType": "soin",
    "painLevel": 3,
    "notesRaw": "Le patient se plaint de douleurs au genou gauche. Pansement refait. TA 13/8."
  }'
```

## 📚 Ressources

- [OpenAI Whisper API Docs](https://platform.openai.com/docs/guides/speech-to-text)
- [OpenAI GPT-4 API Docs](https://platform.openai.com/docs/guides/gpt)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
- [Formidable Docs](https://github.com/node-formidable/formidable)

## ✅ Checklist d'Intégration

- [ ] Créer compte OpenAI
- [ ] Générer clé API
- [ ] Ajouter `OPENAI_API_KEY` dans `.env`
- [ ] `npm install openai formidable`
- [ ] Modifier `/server/routes.ts` (3 routes)
- [ ] Modifier `/client/src/components/VoiceRecorderButton.tsx`
- [ ] Tester STT avec enregistrement vocal
- [ ] Tester génération résumé
- [ ] Tester génération transmission
- [ ] Vérifier gestion d'erreurs
- [ ] Surveiller usage OpenAI

---

**Note** : Pour l'instant, les mocks fonctionnent parfaitement. L'intégration OpenAI peut se faire **progressivement** :
1. D'abord GPT-4 pour les résumés (plus simple)
2. Ensuite Whisper pour le STT (nécessite gestion fichiers)
3. Enfin, optimisations (cache, streaming)

Bonne intégration ! 🚀
