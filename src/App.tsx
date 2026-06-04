import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/layouts/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { fetchAllPrompts, fetchSamplingParameters } from "@/services/globalSettingsDb";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { useSafeArea } from "@/hooks/useSafeArea";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { initWasm } from "@/utils/tokenizer";
import { initNsfwWasm } from "@/utils/nsfwFilter";

// Lazy-loaded pages with retry for stale chunk errors
const HomePage = lazyWithRetry(() => import("@/pages/HomePage"));
const ChatPage = lazyWithRetry(() => import("@/pages/ChatPage"));
const CreatePage = lazyWithRetry(() => import("@/pages/CreatePage"));
const EditCharacterPage = lazyWithRetry(() => import("@/pages/EditCharacterPage"));
const SettingsPage = lazyWithRetry(() => import("@/pages/SettingsPage"));
const ProfilePage = lazyWithRetry(() => import("@/pages/ProfilePage"));
const AuthPage = lazyWithRetry(() => import("@/pages/AuthPage"));
const AdminPage = lazyWithRetry(() => import("@/pages/AdminPage"));
const AdminRoadmapPage = lazyWithRetry(() => import("@/pages/AdminRoadmapPage"));
const AdminKnowledgePage = lazyWithRetry(() => import("@/pages/AdminKnowledgePage"));
const AdminSqlEditorPage = lazyWithRetry(() => import("@/pages/AdminSqlEditorPage"));
const AdminDashboardPage = lazyWithRetry(() => import("@/pages/AdminDashboardPage"));
const AdminAiConfigPage = lazyWithRetry(() => import("@/pages/AdminAiConfigPage"));
const AdminApprovalsPage = lazyWithRetry(() => import("@/pages/AdminApprovalsPage"));
const AdminCreditsPage = lazyWithRetry(() => import("@/pages/AdminCreditsPage"));
const CreditsPage = lazyWithRetry(() => import("@/pages/CreditsPage"));
const CharacterPage = lazyWithRetry(() => import("@/pages/CharacterPage"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const TermsPage = lazyWithRetry(() => import("@/pages/TermsPage"));
const ComponentShowcase = lazyWithRetry(() => import("@/pages/ComponentShowcase"));

const queryClient = new QueryClient();

// Pre-warm global system prompt & sampling parameters cache
fetchAllPrompts();
fetchSamplingParameters();

// Initialize WASM modules (tokenizer + NSFW filter) — fire-and-forget
initWasm();
initNsfwWasm();

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center bg-oled-base min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={28} className="animate-spin text-primary" />
      <span className="text-sm text-muted-foreground tracking-wide">Loading System...</span>
    </div>
  </div>
);

const PageTracker = ({ children }: { children: React.ReactNode }) => {
  useSafeArea();
  usePageTracking();
  useVisibilityRefresh();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <PageTracker>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/chat" element={<ErrorBoundary name="chat"><ChatPage /></ErrorBoundary>} />
                <Route path="/chat/:characterId" element={<ErrorBoundary name="chat"><ChatPage /></ErrorBoundary>} />
                <Route path="/create" element={<ProtectedRoute><CreatePage /></ProtectedRoute>} />
                <Route path="/edit/:characterId" element={<ProtectedRoute><EditCharacterPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/credits" element={<ProtectedRoute><CreditsPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/character/:id" element={<CharacterPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/admin" element={<ProtectedRoute><ErrorBoundary name="admin"><AdminPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/roadmap" element={<ProtectedRoute><ErrorBoundary name="admin"><AdminRoadmapPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/knowledge" element={<ProtectedRoute><ErrorBoundary name="admin"><AdminKnowledgePage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/sql" element={<ProtectedRoute><ErrorBoundary name="admin"><AdminSqlEditorPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/dashboard" element={<ProtectedRoute><ErrorBoundary name="admin"><AdminDashboardPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/chargen" element={<Navigate to="/create?tab=ai" replace />} />
                <Route path="/admin/api-settings" element={<ProtectedRoute><ErrorBoundary name="admin"><AdminAiConfigPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/approvals" element={<ProtectedRoute><ErrorBoundary name="admin"><AdminApprovalsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/admin/credits" element={<ProtectedRoute><ErrorBoundary name="admin"><AdminCreditsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/components" element={<ComponentShowcase />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
          </PageTracker>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
