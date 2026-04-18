import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppLayout from "@/components/app-layout";
import LoginPage from "@/pages/login";
import PulsePage from "@/pages/pulse";
import RocksPage from "@/pages/rocks";
import IssuesPage from "@/pages/issues";
import PipelinePage from "@/pages/pipeline";
import MoneyPage from "@/pages/money";
import AgentsPage from "@/pages/agents";
import IntelPage from "@/pages/intel";
import ArchitectPage from "@/pages/architect";
import AppsPage from "@/pages/apps";
import SubscribersPage from "@/pages/subscribers";
import APPage from "@/pages/ap";
import CroPage from "@/pages/cro";
import NotFound from "@/pages/not-found";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-darkest)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</span>
      </div>
    </div>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session) return <LoginPage />;

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={PulsePage} />
        <Route path="/rocks" component={RocksPage} />
        <Route path="/issues" component={IssuesPage} />
        <Route path="/pipeline" component={PipelinePage} />
        <Route path="/money" component={MoneyPage} />
        <Route path="/agents" component={AgentsPage} />
        <Route path="/intel" component={IntelPage} />
        <Route path="/architect" component={ArchitectPage} />
        <Route path="/apps" component={AppsPage} />
        <Route path="/subscribers" component={SubscribersPage} />
        <Route path="/ap" component={APPage} />
        <Route path="/cro" component={CroPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <Router hook={useHashLocation}>
            <AuthGate />
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
