import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/AuthGuard";
import { AppProvider } from "@/lib/appStore";
import { ConfirmDialogProvider } from "@/hooks/useConfirmDialog";
import { GlobalNavigation } from "@/components/GlobalNavigation";
import Landing from "@/pages/landing";
import E02_Dashboard from "@/pages/E02_Dashboard";
import E03_PatientSheet from "@/pages/E03_PatientSheet";
import E04_Consent from "@/pages/E04_Consent";
import E05_VisitFlow from "@/pages/E05_VisitFlow";
import E08_History from "@/pages/E08_History";
import E09_VisitDetail from "@/pages/E09_VisitDetail";
import E10_Recordings from "@/pages/E10_Recordings";
import E11_SettingsProfile from "@/pages/E11_SettingsProfile";
import E12_AboutSupport from "@/pages/E12_AboutSupport";
import E13_RecordingDevice from "@/pages/E13_RecordingDevice";
import E14_IASettings from "@/pages/E14_IASettings";
import E15_AlertsConsole from "@/pages/E15_AlertsConsole";
import E16_OfflineMode from "@/pages/E16_OfflineMode";
import E17_InterPatientSynthesis from "@/pages/E17_InterPatientSynthesis";
import E18_TourCoordinator from "@/pages/E18_TourCoordinator";
import E19_ShopView from "@/pages/E19_ShopView";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import FloatingAgendaButton from "@/components/FloatingAgendaButton";

function Router() {
  return (
    <Switch>
      {/* Public route */}
      <Route path="/landing" component={Landing} />
      
      {/* Dashboard - Home */}
      <Route path="/">
        <AuthGuard>
          <E02_Dashboard />
        </AuthGuard>
      </Route>

      <Route path="/dashboard">
        <AuthGuard>
          <E02_Dashboard />
        </AuthGuard>
      </Route>

      {/* Patients List */}
      <Route path="/patients">
        <AuthGuard>
          <E02_Dashboard />
        </AuthGuard>
      </Route>

      {/* Patient Routes */}
      <Route path="/patients/:id/consent">
        <AuthGuard>
          <E04_Consent />
        </AuthGuard>
      </Route>

      <Route path="/patients/:id/record">
        <AuthGuard>
          <E05_VisitFlow />
        </AuthGuard>
      </Route>

      <Route path="/patients/:id/history">
        <AuthGuard>
          <E08_History />
        </AuthGuard>
      </Route>

      <Route path="/patients/:patientId/visits/:visitId">
        <AuthGuard>
          <E09_VisitDetail />
        </AuthGuard>
      </Route>

      <Route path="/patients/:id">
        <AuthGuard>
          <E03_PatientSheet />
        </AuthGuard>
      </Route>

      {/* Recordings */}
      <Route path="/recordings/new-free">
        <AuthGuard>
          <E05_VisitFlow />
        </AuthGuard>
      </Route>

      <Route path="/recordings/:id">
        <AuthGuard>
          <E09_VisitDetail />
        </AuthGuard>
      </Route>

      <Route path="/recordings">
        <AuthGuard>
          <E10_Recordings />
        </AuthGuard>
      </Route>

      {/* Alerts */}
      <Route path="/alerts">
        <AuthGuard>
          <E15_AlertsConsole />
        </AuthGuard>
      </Route>

      {/* Offline Mode */}
      <Route path="/offline">
        <AuthGuard>
          <E16_OfflineMode />
        </AuthGuard>
      </Route>

      {/* Clinical Cockpit - Doctor View */}
      <Route path="/cockpit">
        <AuthGuard>
          <E17_InterPatientSynthesis />
        </AuthGuard>
      </Route>

      {/* Tour Coordinator View */}
      <Route path="/coordinator">
        <AuthGuard>
          <E18_TourCoordinator />
        </AuthGuard>
      </Route>

      {/* Shop / Orders View */}
      <Route path="/shop">
        <AuthGuard>
          <E19_ShopView />
        </AuthGuard>
      </Route>

      {/* Settings */}
      <Route path="/settings">
        <AuthGuard>
          <E11_SettingsProfile />
        </AuthGuard>
      </Route>

      <Route path="/settings/about">
        <AuthGuard>
          <E12_AboutSupport />
        </AuthGuard>
      </Route>

      <Route path="/settings/recording-device">
        <AuthGuard>
          <E13_RecordingDevice />
        </AuthGuard>
      </Route>

      <Route path="/settings/ia">
        <AuthGuard>
          <E14_IASettings />
        </AuthGuard>
      </Route>

      <Route path="/settings/old">
        <AuthGuard>
          <SettingsPage />
        </AuthGuard>
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmDialogProvider>
        <AppProvider>
          <TooltipProvider>
            {/* Container centré comme sur mobile - hauteur fixe à 100vh, pas de scroll navigateur */}
            <div className="mx-auto max-w-md h-screen bg-white shadow-xl flex flex-col overflow-hidden relative">
              <Toaster />
              {/* Zone de contenu scrollable */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
                <Router />
              </div>
              {/* Bouton flottant Agenda (global) */}
              <FloatingAgendaButton />
              {/* Navbar fixe en bas */}
              <GlobalNavigation />
            </div>
          </TooltipProvider>
        </AppProvider>
      </ConfirmDialogProvider>
    </QueryClientProvider>
  );
}

export default App;
