import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/AuthGuard";
import { AppProvider } from "@/lib/appStore";
import { ConfirmDialogProvider } from "@/hooks/useConfirmDialog";
import Landing from "@/pages/landing";
import E02_Dashboard from "@/pages/E02_Dashboard";
import E03_PatientSheet from "@/pages/E03_PatientSheet";
import E04_Consent from "@/pages/E04_Consent";
import E05_VisitFlow from "@/pages/E05_VisitFlow";
import E08_History from "@/pages/E08_History";
import E09_VisitDetail from "@/pages/E09_VisitDetail";
import E10_Recordings from "@/pages/E10_Recordings";
import E11_SettingsProfile from "@/pages/E11_SettingsProfile";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

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

      {/* Settings */}
      <Route path="/settings">
        <AuthGuard>
          <E11_SettingsProfile />
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
            {/* Container centré comme sur mobile */}
            <div className="mx-auto max-w-md min-h-screen bg-white shadow-xl">
              <Toaster />
              <Router />
            </div>
          </TooltipProvider>
        </AppProvider>
      </ConfirmDialogProvider>
    </QueryClientProvider>
  );
}

export default App;
