import { useState } from "react";
import { Eye, EyeOff, Store, Loader2, AlertCircle } from "lucide-react";
import { useLoginMutation } from "../store/apiSlice";

interface LoginScreenProps {
  onLoginSuccess: (token: string) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showTenantCode, setShowTenantCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginApi, { isLoading }] = useLoginMutation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await loginApi({
        email: email.trim(),
        password,
        tenantCode: tenantCode.trim() || undefined,
      }).unwrap();

      if (result.token) {
        localStorage.setItem("kanitt_token", result.token);
        onLoginSuccess(result.token);
      }
    } catch (err: any) {
      const code = err?.data?.code;
      const msg = err?.data?.message || "Login failed. Check your credentials.";

      if (code === "TENANT_CODE_REQUIRED") {
        setShowTenantCode(true);
        setError("Multiple accounts found. Please enter your Organization Code.");
      } else {
        setError(msg);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background gradient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-sky-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-emerald-400 shadow-2xl shadow-sky-500/30 mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">KANITT POS</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Desktop Pro — Sign in to your workspace</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Tenant Code (shown on demand) */}
            {showTenantCode && (
              <div className="animate-in slide-in-from-top-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-sky-400 block mb-1.5">
                  Organization Code
                </label>
                <input
                  type="text"
                  value={tenantCode}
                  onChange={(e) => setTenantCode(e.target.value.toUpperCase())}
                  placeholder="e.g. TNT-ABC123"
                  className="w-full bg-slate-950 border border-sky-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors font-mono tracking-wider"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Found in Settings → Store Information in your web dashboard
                </p>
              </div>
            )}

            {/* Toggle tenant code manually */}
            {!showTenantCode && (
              <button
                type="button"
                onClick={() => setShowTenantCode(true)}
                className="text-xs text-slate-500 hover:text-sky-400 transition-colors"
              >
                Have an organization code? →
              </button>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In to POS"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          KANITT POS Desktop v2.1 · Tenant Workspace
        </p>
      </div>
    </div>
  );
}
