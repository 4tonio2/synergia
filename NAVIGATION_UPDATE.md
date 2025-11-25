# 🎯 Mise à Jour - Navigation et Fonctionnalités

## ✅ Complété

### 1. Système de Gestion d'État Global (`/client/src/lib/appStore.tsx`)

**Créé un React Context** pour partager les données entre toutes les pages :

- **Patients** : 3 patients fictifs (Claire Martin, Pierre Lefevre, Jeanne Robert)
- **Visits** : 2 visites validées avec données IA complètes
- **Alerts** : 3 alertes système (dont 2 non lues)

**Fonctions disponibles** :
```typescript
const {
  patients,                              // Liste des patients
  visits,                                // Liste des visites
  alerts,                                // Liste des alertes
  
  getPatientById(id),                    // Récupérer un patient
  updatePatientConsent(id, consent),     // Mettre à jour le consentement
  
  addVisit(visit),                       // Ajouter une visite
  updateVisit(visitId, partialVisit),    // Mettre à jour une visite
  deleteVisit(visitId),                  // Supprimer une visite
  getVisitById(id),                      // Récupérer une visite
  getVisitsByPatientId(patientId),       // Visites d'un patient
  
  markAlertAsRead(alertId),              // Marquer alerte comme lue
  addAlert(alert),                       // Ajouter une alerte
  
  resetData(),                           // Reset toutes les données
} = useAppStore();
```

**Persistence** : localStorage (`plode-care-data`)

---

### 2. App.tsx - Intégration du Provider

```tsx
<AppProvider>
  <TooltipProvider>
    <Router />
  </TooltipProvider>
</AppProvider>
```

---

### 3. E02_Dashboard - Mise à Jour

**Changements** :
- ✅ Utilise `useAppStore()` au lieu de MOCK_PATIENTS
- ✅ Stats dynamiques basées sur les vraies données
  - `validatedVisitsCount` : Nombre de visites validées
  - `unreadAlertsCount` : Nombre d'alertes non lues
- ✅ Navigation vers `/alerts` fonctionnelle

**Testé** : ✅ Dashboard affiche les 3 patients

---

### 4. E03_PatientSheet - Mise à Jour

**Changements** :
- ✅ Utilise `getPatientById()` du store
- ✅ Gestion du consentement : demande confirmation si non donné
- ✅ Navigation vers :
  - `/patients/:id/record` (enregistrement)
  - `/patients/:id/history` (historique)
  - `/patients/:id/consent` (consentement)
- ✅ Bouton SHOP avec alert

**Testé** : ✅ Fiche patient affichée correctement

---

## ⏳ Pages à Mettre à Jour

### 5. E04_Consent - À Modifier

**Fichier** : `/client/src/pages/E04_Consent.tsx`

**Modifications nécessaires** :
```tsx
import { useAppStore } from "@/lib/appStore";

const { getPatientById, updatePatientConsent } = useAppStore();
const patient = patientId ? getPatientById(patientId) : undefined;

// Dans handleSave :
updatePatientConsent(patient.id, selectedConsent !== 'refused');
```

---

### 6. E05_VisitFlow - À Modifier

**Fichier** : `/client/src/pages/E05_VisitFlow.tsx`

**Modifications nécessaires** :
```tsx
import { useAppStore, Visit } from "@/lib/appStore";
import { useRoute } from "wouter";

const [, params] = useRoute('/patients/:id/record');
const patientId = params?.id;
const { getPatientById, addVisit, updateVisit, getVisitById } = useAppStore();

const patient = patientId ? getPatientById(patientId) : null;

// Dans handleValidate :
if (finalVisitData.validated) {
  addVisit(finalVisitData); // Ajouter la visite au store
} else {
  updateVisit(finalVisitData.id, finalVisitData); // Sauvegarder le brouillon
}
```

**Props à supprimer** :
- `patient` (récupéré depuis le store via URL param)
- `visitDraft` (géré en interne avec localStorage)
- `onSaveDraft` (utilise `updateVisit` du store)
- `onValidate` (utilise `addVisit` du store)

---

### 7. E08_History - À Modifier

**Fichier** : `/client/src/pages/E08_History.tsx`

**Modifications nécessaires** :
```tsx
import { useAppStore } from "@/lib/appStore";

const { getPatientById, getVisitsByPatientId } = useAppStore();
const patient = patientId ? getPatientById(patientId) : undefined;
const patientVisits = patientId ? getVisitsByPatientId(patientId) : [];

// Navigation vers détail visite
const handleSelectVisit = (visit) => {
  setLocation(`/patients/${patient.id}/visits/${visit.id}`);
};
```

---

### 8. E09_VisitDetail - À Modifier

**Fichier** : `/client/src/pages/E09_VisitDetail.tsx`

**Modifications nécessaires** :
```tsx
import { useAppStore } from "@/lib/appStore";

const [, visitParams] = useRoute('/patients/:patientId/visits/:visitId');
const [, recordingParams] = useRoute('/recordings/:id');

const visitId = visitParams?.visitId || recordingParams?.id;
const patientId = visitParams?.patientId;

const { getVisitById, getPatientById, deleteVisit } = useAppStore();
const visit = visitId ? getVisitById(visitId) : undefined;
const patient = visit?.patientId ? getPatientById(visit.patientId) : null;

// handleEditVisit : naviguer vers E05_VisitFlow avec le visitId
// handleDeleteVisit : deleteVisit(visitId) puis retour
```

---

### 9. E10_Recordings - À Modifier

**Fichier** : `/client/src/pages/E10_Recordings.tsx`

**Modifications nécessaires** :
```tsx
import { useAppStore } from "@/lib/appStore";

const { visits, patients } = useAppStore();

// Enrichir les visites avec les noms des patients
const enrichedVisits = visits.map(v => ({
  ...v,
  patientName: v.patientId ? patients.find(p => p.id === v.patientId)?.name : 'Visite Libre',
  patientAddress: v.patientId ? patients.find(p => p.id === v.patientId)?.address : '',
})).sort((a, b) => new Date(b.date) - new Date(a.date));

// Navigation
const handleSelectVisit = (visit) => {
  if (visit.patientId) {
    setLocation(`/patients/${visit.patientId}/visits/${visit.id}`);
  } else {
    setLocation(`/recordings/${visit.id}`);
  }
};
```

---

## 🚀 Plan de Test

### Flux 1 : Dashboard → Patient → Enregistrement
1. ✅ Dashboard affiche 3 patients
2. Click sur "Claire Martin"
3. → E03_PatientSheet s'ouvre
4. Click "Démarrer un enregistrement"
5. → E05_VisitFlow démarre (recording)
6. Arrêter enregistrement (30s)
7. → Processing (3-4s)
8. → Review avec résumé IA éditable
9. Valider → Visite ajoutée au store
10. → Retour Dashboard

### Flux 2 : Dashboard → Enregistrement Libre
1. Dashboard
2. Click "Enregistrer maintenant (sans patient)"
3. → E05_VisitFlow (mode libre)
4. Enregistrer → Processing → Review → Valider
5. Visite avec `patientId: null` ajoutée

### Flux 3 : Patient → Historique → Détail
1. Dashboard → Patient
2. Click "Voir l'historique complet"
3. → E08_History (liste des visites du patient)
4. Click sur une visite
5. → E09_VisitDetail (audio player, transcription, IA)

### Flux 4 : Enregistrements Globaux
1. Dashboard → NavBar "Enregistrements"
2. → E10_Recordings (tous les enregistrements)
3. Filtre patients vs visites libres
4. Click → E09_VisitDetail

### Flux 5 : Consentement
1. Dashboard → Patient (Pierre Lefevre - consent: false)
2. Click "Démarrer enregistrement"
3. → Confirmation popup
4. → E04_Consent
5. Sélectionner "oral" → Sauvegarder
6. → patient.consent = true dans le store
7. → Retour E03_PatientSheet

---

## 🔄 État Actuel

### ✅ Fonctionnel
- AppStore (Context + localStorage)
- E02_Dashboard
- E03_PatientSheet
- Navigation de base

### ⏳ À Finaliser
- E04_Consent (intégrer store)
- E05_VisitFlow (intégrer store + récupérer patient depuis URL)
- E08_History (intégrer store)
- E09_VisitDetail (intégrer store + routing)
- E10_Recordings (intégrer store)

---

## 📝 Prochaines Étapes

1. **Mettre à jour E04_Consent** → updatePatientConsent()
2. **Mettre à jour E05_VisitFlow** → addVisit(), updateVisit()
3. **Mettre à jour E08_History** → getVisitsByPatientId()
4. **Mettre à jour E09_VisitDetail** → getVisitById(), getPatientById()
5. **Mettre à jour E10_Recordings** → visits[], patients[]
6. **Créer E15_Alerts** (page alertes système)
7. **Tester tous les flux de navigation**

---

## 🎨 Données Fictives

### Patients (3)
- Claire Martin (78 ans, Diabète + AVK, Faible risque, Consent ✅)
- Pierre Lefevre (85 ans, Alzheimer + Risque chute, Modéré, Consent ❌)
- Jeanne Robert (92 ans, Insuffisance Cardiaque, Élevé, Consent ✅)

### Visites (2)
- **visit-1** : Claire Martin, il y a 2 jours, validée ✅
- **visit-2** : Jeanne Robert, hier, validée ✅ (avec alerte douleur 6/10)

### Alertes (3)
- Douleur élevée (Jeanne Robert) - non lue ⚠️
- Consentement manquant (Pierre Lefevre) - non lue ⚠️
- Tension basse récurrente (Pierre Lefevre) - lue ✅

---

## 🛠️ Commandes

```bash
# Démarrer le serveur
npm run dev

# Test l'app
http://localhost:5000

# Reset les données (dans la console navigateur)
useAppStore.getState().resetData()
```

---

## ✨ Améliorations Futures

- [ ] Pagination des listes (visites, enregistrements)
- [ ] Recherche/filtres patients
- [ ] Tri des colonnes dans E10_Recordings
- [ ] Notifications push pour alertes critiques
- [ ] Export PDF des visites validées
- [ ] Graphiques de suivi (douleur, constantes)
- [ ] Intégration calendrier pour planifier visites
