import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from || "/";

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    const result = isLogin
      ? await login(email, password)
      : await register(email, password);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else if (isLogin) {
      toast.success("Đăng nhập thành công!");
      navigate(from, { replace: true });
    } else {
      toast.success("Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.");
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error("Đăng nhập Google thất bại.");
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-oled-base p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-2xl border border-gray-border bg-oled-surface p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center mx-auto">
              {isLogin ? <LogIn className="text-neon-blue" size={22} /> : <UserPlus className="text-neon-blue" size={22} />}
            </div>
            <h1 className="text-lg font-bold text-foreground">
              {isLogin ? "Đăng nhập" : "Đăng ký"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isLogin ? "Chào mừng trở lại VietRP" : "Tạo tài khoản VietRP mới"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-oled-base border-gray-border text-foreground placeholder:text-muted-foreground focus:border-neon-blue focus:ring-neon-blue/30"
                required
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground">Mật khẩu</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-oled-base border-gray-border text-foreground placeholder:text-muted-foreground focus:border-neon-blue focus:ring-neon-blue/30"
                required
                minLength={6}
              />
            </div>
            {!isLogin && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 accent-neon-blue"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  Tôi đã đọc và đồng ý với{" "}
                  <Link to="/terms" target="_blank" className="text-neon-blue hover:underline">
                    Điều khoản sử dụng & Miễn trừ trách nhiệm
                  </Link>
                </span>
              </label>
            )}
            <Button
              type="submit"
              disabled={loading || (!isLogin && !agreedTerms)}
              className="w-full bg-neon-blue hover:bg-neon-blue/80 text-black font-semibold shadow-[0_0_12px_rgba(0,240,255,0.3)] hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all"
            >
              {loading && <Loader2 size={16} className="animate-spin mr-2" />}
              {isLogin ? "Đăng nhập" : "Đăng ký"}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-border" />
            <span className="text-xs text-muted-foreground">Hoặc</span>
            <div className="flex-1 h-px bg-gray-border" />
          </div>

          {/* Google */}
          <Button
            variant="outline"
            onClick={handleGoogleLogin}
            className="w-full border-gray-border text-foreground hover:border-neon-blue/50 hover:bg-oled-elevated"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Đăng nhập bằng Google
          </Button>

          {/* Toggle */}
          <p className="text-xs text-center text-muted-foreground">
            {isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-neon-blue hover:underline font-medium"
            >
              {isLogin ? "Đăng ký ngay" : "Đăng nhập"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
