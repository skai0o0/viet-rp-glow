import { lazy, Suspense } from "react";
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

// Lazy-loaded pages
const HomePage = lazy(() => import("@/pages/HomePage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const CreatePage = lazy(() => import("@/pages/CreatePage"));
const EditCharacterPage = lazy(() => import("@/pages/EditCharacterPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const AdminRoadmapPage = lazy(() => import("@/pages/AdminRoadmapPage"));
const AdminChatSettingsPage = lazy(() => import("@/pages/AdminChatSettingsPage"));
const AdminKnowledgePage = lazy(() => import("@/pages/AdminKnowledgePage"));
const AdminSqlEditorPage = lazy(() => import("@/pages/AdminSqlEditorPage"));
const AdminDashboardPage = lazy(() => import("@/pages/AdminDashboardPage"));
const AdminCharGenPage = lazy(() => import("@/pages/AdminCharGenPage"));
const AdminApiSettingsPage = lazy(() => import("@/pages/AdminApiSettingsPage"));
const AdminApprovalsPage = lazy(() => import("@/pages/AdminApprovalsPage"));
const AdminPlatformKeysPage = lazy(() => import("@/pages/AdminPlatformKeysPage"));
const CharacterPage = lazy(() => import("@/pages/CharacterPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));

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
                <Route path="/admin/chatSettings" element={<ProtectedRoute><AdminChatSettingsPage /></ProtectedRoute>} />
                <Route path="/admin/knowledge" element={<ProtectedRoute><AdminKnowledgePage /></ProtectedRoute>} />
                <Route path="/admin/sql" element={<ProtectedRoute><AdminSqlEditorPage /></ProtectedRoute>} />
                <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
                <Route path="/admin/chargen" element={<ProtectedRoute><AdminCharGenPage /></ProtectedRoute>} />
                <Route path="/admin/api-settings" element={<ProtectedRoute><AdminApiSettingsPage /></ProtectedRoute>} />
                <Route path="/admin/approvals" element={<ProtectedRoute><AdminApprovalsPage /></ProtectedRoute>} />
                <Route path="/admin/platform-keys" element={<ProtectedRoute><AdminPlatformKeysPage /></ProtectedRoute>} />
                <Route path="/terms" element={<TermsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </PageTracker>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
