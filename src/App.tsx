import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/layouts/AppLayout";
import HomePage from "@/pages/HomePage";
import ChatPage from "@/pages/ChatPage";
import CreatePage from "@/pages/CreatePage";
import EditCharacterPage from "@/pages/EditCharacterPage";
import SettingsPage from "@/pages/SettingsPage";
import ProfilePage from "@/pages/ProfilePage";
import AuthPage from "@/pages/AuthPage";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminPage from "@/pages/AdminPage";
import AdminRoadmapPage from "@/pages/AdminRoadmapPage";
import AdminChatSettingsPage from "@/pages/AdminChatSettingsPage";
import NotFound from "./pages/NotFound";
import TermsPage from "@/pages/TermsPage";
import { fetchGlobalSystemPrompt } from "@/services/globalSettingsDb";

const queryClient = new QueryClient();

// Pre-warm global system prompt cache
fetchGlobalSystemPrompt();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/chat/:characterId" element={<ChatPage />} />
              <Route path="/create" element={<ProtectedRoute><CreatePage /></ProtectedRoute>} />
              <Route path="/edit/:characterId" element={<ProtectedRoute><EditCharacterPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="/admin/roadmap" element={<ProtectedRoute><AdminRoadmapPage /></ProtectedRoute>} />
              <Route path="/admin/chatSettings" element={<ProtectedRoute><AdminChatSettingsPage /></ProtectedRoute>} />
              <Route path="/terms" element={<TermsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
