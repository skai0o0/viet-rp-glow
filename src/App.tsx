import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/layouts/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { fetchGlobalSystemPrompt, fetchSamplingParameters } from "@/services/globalSettingsDb";
import { usePageTracking } from "@/hooks/usePageTracking";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

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
const AdminCharGenPage = lazyWithRetry(() => import("@/pages/AdminCharGenPage"));
const AdminAiConfigPage = lazyWithRetry(() => import("@/pages/AdminAiConfigPage"));
const AdminApprovalsPage = lazyWithRetry(() => import("@/pages/AdminApprovalsPage"));
const AdminCreditsPage = lazyWithRetry(() => import("@/pages/AdminCreditsPage"));
const CharacterPage = lazyWithRetry(() => import("@/pages/CharacterPage"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const TermsPage = lazyWithRetry(() => import("@/pages/TermsPage"));

const queryClient = new QueryClient();

// Pre-warm global system prompt & sampling parameters cache
fetchGlobalSystemPrompt();
fetchSamplingParameters();

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center bg-oled-base min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={28} className="animate-spin text-primary" />
      <span className="text-sm text-muted-foreground tracking-wide">Loading System...</span>
    </div>
  </div>
);

const PageTracker = ({ children }: { children: React.ReactNode }) => {
  usePageTracking();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PageTracker>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:characterId" element={<ChatPage />} />
                <Route path="/create" element={<ProtectedRoute><CreatePage /></ProtectedRoute>} />
                <Route path="/edit/:characterId" element={<ProtectedRoute><EditCharacterPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/character/:id" element={<CharacterPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                <Route path="/admin/roadmap" element={<ProtectedRoute><AdminRoadmapPage /></ProtectedRoute>} />
                <Route path="/admin/knowledge" element={<ProtectedRoute><AdminKnowledgePage /></ProtectedRoute>} />
                <Route path="/admin/sql" element={<ProtectedRoute><AdminSqlEditorPage /></ProtectedRoute>} />
                <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
                <Route path="/admin/chargen" element={<ProtectedRoute><AdminCharGenPage /></ProtectedRoute>} />
                <Route path="/admin/api-settings" element={<ProtectedRoute><AdminAiConfigPage /></ProtectedRoute>} />
                <Route path="/admin/approvals" element={<ProtectedRoute><AdminApprovalsPage /></ProtectedRoute>} />
                <Route path="/admin/credits" element={<ProtectedRoute><AdminCreditsPage /></ProtectedRoute>} />
                <Route path="/terms" element={<TermsPage />} />
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
