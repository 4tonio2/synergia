# Plan d'Implémentation - Plode Care (Synergia)

## 📋 Vue d'ensemble

Ce document détaille la migration du code Gemini (Firebase) vers notre stack Supabase + Express + React, avec optimisations et corrections.

## 🔄 Changements principaux

### 1. **Architecture**
- ❌ Firebase Firestore → ✅ Supabase PostgreSQL
- ❌ Firebase Auth → ✅ Supabase Auth (déjà configuré)
- ❌ Composants UI custom → ✅ shadcn/ui (déjà installé)
- ❌ Mock IA → ✅ Vraie intégration IA (à définir: OpenAI Whisper + GPT-4)
- ❌ État local React → ✅ React Query + Supabase Realtime

### 2. **Structure des écrans**

#### E01 - Authentification ✅
- **Fichier**: `/client/src/pages/landing.tsx` (déjà existe)
- **Status**: Déjà implémenté avec Supabase Auth
- **Changements**: Garder la sélection de rôle médical existante

#### E02 - Dashboard / Tournée ✅
- **Fichier**: `/client/src/pages/E02_Dashboard.tsx` (déjà existe)
- **Améliorations**:
  - Charger les patients depuis Supabase
  - Afficher la tournée triée par `next_visit_time`
  - Stats réelles: nombre de visites, alertes non lues
  - Bottom navigation fonctionnelle

#### E03 - Fiche Patient (NOUVEAU)
- **Fichier**: `/client/src/pages/E03_PatientSheet.tsx`
- **Fonctionnalités**:
  - Afficher les tags médicaux
  - Résumé de la dernière visite (IA)
  - État du consentement audio
  - CTA: Enregistrement, Historique, Consentement, Shop

#### E04 - Consentement Audio (NOUVEAU)
- **Fichier**: `/client/src/pages/E04_Consent.tsx`
- **Fonctionnalités**:
  - Radio buttons: Oral, Écrit, Refusé
  - Checkbox: Lecture phrase légale enregistrée
  - Mise à jour dans Supabase

#### E05 - Flux d'Enregistrement (NOUVEAU - Fusionné E05/E06/E07)
- **Fichier**: `/client/src/pages/E05_VisitFlow.tsx`
- **États**:
  1. **Recording**: Timer, VU-mètre, bouton stop
  2. **Processing**: Barre de progression IA
  3. **Review**: Édition résumé, champs structurés, validation
- **Intégrations**:
  - Web Audio API pour enregistrement
  - Upload audio vers Supabase Storage
  - API IA pour transcription + analyse
  - Sauvegarde dans table `visits`

#### E08 - Historique Patient (NOUVEAU)
- **Fichier**: `/client/src/pages/E08_History.tsx`
- **Fonctionnalités**:
  - Liste chronologique des visites
  - Filtres par date, type, risque
  - Navigation vers E09 (détail)

#### E09 - Détail de Visite (NOUVEAU)
- **Fichier**: `/client/src/pages/E09_VisitDetail.tsx`
- **Fonctionnalités**:
  - Player audio avec contrôles
  - Transcription complète
  - Résumé IA éditable
  - Champs structurés
  - Alertes détectées
  - Notes complémentaires

#### E10 - Liste Globale Enregistrements (NOUVEAU)
- **Fichier**: `/client/src/pages/E10_Recordings.tsx`
- **Fonctionnalités**:
  - Tableau: Patient, Date/Heure, Durée, Statut
  - Filtres: Patient, Statut (Validée, À valider, En attente)
  - Navigation vers E09 ou E05 selon statut

## 🗄️ Schéma de Base de Données

### Tables créées (voir `supabase_migrations.sql`)

1. **patients**
   - `id`, `user_id`, `name`, `age`, `address`
   - `medical_tags` (JSONB)
   - `risk_level`, `audio_consent`, `next_visit_time`
   
2. **visits**
   - `id`, `user_id`, `patient_id`
   - `visit_date`, `duration_seconds`
   - `audio_file_url`, `transcription`, `ai_summary`
   - `visit_type`, `pain_level`, `vital_signs`
   - `alerts` (JSONB), `risk_level`
   - `validated`, `processing`, `notes`

3. **alerts**
   - `id`, `user_id`, `patient_id`, `visit_id`
   - `level`, `description`, `action_required`, `is_read`

### RLS (Row Level Security)
- ✅ Policies configurées pour accès utilisateur uniquement
- ✅ Auth via `auth.uid()` Supabase

## 🛠️ Intégrations Techniques

### 1. Enregistrement Audio
```typescript
// Web Audio API
const mediaRecorder = new MediaRecorder(stream);
// Upload vers Supabase Storage
const { data } = await supabase.storage
  .from('audio-recordings')
  .upload(`${userId}/${visitId}.webm`, audioBlob);
```

### 2. Traitement IA
**API à intégrer** (options):
- **OpenAI Whisper**: Transcription audio → texte
- **OpenAI GPT-4**: Analyse → résumé + champs structurés + alertes
- **Alternative**: Assembly AI, Deepgram

**Endpoint serveur**: `/api/visits/process-ia`

### 3. Supabase Realtime
```typescript
// Écoute des nouvelles alertes
supabase
  .channel('alerts')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'alerts' },
    (payload) => queryClient.invalidateQueries(['alerts'])
  )
  .subscribe();
```

## 📂 Structure des Fichiers

```
client/src/
├── pages/
│   ├── landing.tsx (E01) ✅ Existe
│   ├── E02_Dashboard.tsx ✅ Existe
│   ├── E03_PatientSheet.tsx (À créer)
│   ├── E04_Consent.tsx (À créer)
│   ├── E05_VisitFlow.tsx (À créer)
│   ├── E08_History.tsx (À créer)
│   ├── E09_VisitDetail.tsx (À créer)
│   ├── E10_Recordings.tsx (À créer)
│   ├── patients.tsx → Renommer/Rediriger vers E03
│   └── recordings.tsx → Renommer/Rediriger vers E10
├── hooks/
│   ├── useAuth.ts ✅ Existe
│   ├── usePatients.ts (À créer)
│   ├── useVisits.ts (À créer)
│   ├── useAudioRecorder.ts (À créer)
│   └── useAlerts.ts (À créer)
├── lib/
│   ├── supabase.ts ✅ Existe
│   └── ia-processor.ts (À créer)
└── components/
    ├── PatientCard.tsx (À créer)
    ├── VisitCard.tsx (À créer)
    ├── AudioPlayer.tsx (À créer)
    └── AlertBadge.tsx (À créer)

server/
├── routes.ts (À étendre)
├── supabase.ts ✅ Existe
├── storage.ts (À étendre avec patients/visits)
└── ia/
    └── processor.ts (À créer)
```

## ✅ Checklist d'Implémentation

### Phase 1: Base de données (30 min)
- [x] Créer le schéma SQL (`supabase_migrations.sql`)
- [ ] Exécuter le SQL dans Supabase SQL Editor
- [ ] Vérifier les tables et RLS policies
- [ ] Ajouter des données de test (3 patients mock)

### Phase 2: Backend API (1h)
- [ ] Étendre `storage.ts` avec:
  - `getPatients()`, `createPatient()`, `updatePatient()`
  - `getVisits()`, `createVisit()`, `updateVisit()`
  - `getAlerts()`, `createAlert()`, `markAlertAsRead()`
- [ ] Routes API dans `routes.ts`:
  - `GET /api/patients`
  - `POST /api/patients`
  - `GET /api/visits`
  - `POST /api/visits`
  - `POST /api/visits/:id/process` (IA)
  - `GET /api/alerts`
- [ ] Mock IA processor pour tests

### Phase 3: Hooks React Query (1h)
- [ ] `usePatients()`: Fetch + cache patients
- [ ] `useVisits()`: Fetch + cache visits
- [ ] `useAudioRecorder()`: Gestion enregistrement audio
- [ ] `useAlerts()`: Fetch + realtime alerts

### Phase 4: Composants UI (2h)
- [ ] `PatientCard.tsx`
- [ ] `VisitCard.tsx`
- [ ] `AudioPlayer.tsx`
- [ ] `AlertBadge.tsx`
- [ ] `ConsentRadioGroup.tsx`

### Phase 5: Écrans (4h)
- [ ] E03_PatientSheet
- [ ] E04_Consent
- [ ] E05_VisitFlow (recording + processing + review)
- [ ] E08_History
- [ ] E09_VisitDetail
- [ ] E10_Recordings

### Phase 6: Intégrations (2h)
- [ ] Supabase Storage pour audio
- [ ] API IA (Whisper + GPT-4)
- [ ] Supabase Realtime pour alertes

### Phase 7: Refactoring Dashboard (1h)
- [ ] Charger données réelles
- [ ] Navigation bottom fonctionnelle
- [ ] Stats temps réel

### Phase 8: Tests & Polish (1h)
- [ ] Tester le flux complet
- [ ] Gérer les erreurs
- [ ] Loading states
- [ ] Mode hors ligne (optionnel)

## 🚀 Ordre d'Exécution

1. **Maintenant**: Créer les tables Supabase
2. **Ensuite**: Backend API + Storage
3. **Puis**: Hooks React Query
4. **Après**: Composants UI réutilisables
5. **Enfin**: Écrans E03-E10 un par un

## 🔧 Optimisations vs Code Gemini

| Problème Gemini | Solution Optimisée |
|----------------|-------------------|
| Firebase | Supabase (déjà configuré) |
| Composants UI custom | shadcn/ui (déjà installé) |
| État local complexe | React Query + cache |
| Mock IA naïf | Vraie API avec retry/fallback |
| Pas de RLS | Sécurité RLS Supabase |
| Pas de TypeScript strict | Types complets avec Zod |
| Firestore nested collections | PostgreSQL relationnel optimisé |
| Pas de mode hors ligne | Supabase offline-first |

## 📝 Notes Importantes

1. **RGPD/HDS**: Données médicales sensibles
   - Chiffrement en transit (HTTPS)
   - Chiffrement au repos (Supabase)
   - Logs d'accès (table `auth_logs`)
   - Consentement audio obligatoire

2. **Performance**:
   - Index sur `next_visit_time`, `visit_date`
   - Pagination pour liste enregistrements
   - Lazy loading des transcriptions

3. **UX**:
   - Spinner pendant traitement IA
   - Mode hors ligne avec sync
   - Notifications pour alertes

4. **Sécurité**:
   - RLS sur toutes les tables
   - Validation côté serveur (Zod)
   - Upload audio avec signatures
