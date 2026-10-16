import { useState } from "react";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import {
  useLoginMutation,
  useResendVerificationCodeMutation,
  useVerifyEmailMutation,
} from "../store/apiSlice";

import { setAuthToken } from "../services/secureStorage";

interface LoginScreenProps {
  onLoginSuccess: (token: string) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const [loginApi, { isLoading }] = useLoginMutation();
  const [verifyEmail, { isLoading: isVerifying }] = useVerifyEmailMutation();
  const [resendCode, { isLoading: isResending }] =
    useResendVerificationCodeMutation();

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
        await setAuthToken(result.token);
        onLoginSuccess(result.token);
      }
    } catch (err: any) {
      const code = err?.data?.code;
      const msg = err?.data?.message || "Login failed. Check your credentials.";

      if (code === "EMAIL_NOT_VERIFIED") {
        setVerificationStep(true);
        setVerificationCode("");
        setError(null);
        setVerificationMessage(
          "We sent a 6-digit verification code to " + email.trim() + ".",
        );
      } else {
        setError(msg);
      }
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerificationMessage(null);
    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    try {
      const result = await verifyEmail({
        email: email.trim(),
        code: verificationCode,
      }).unwrap();
      await setAuthToken(result.token);
      onLoginSuccess(result.token);
    } catch (err: any) {
      setError(
        err?.data?.message ||
          "That code is invalid or expired. Request a new code and try again.",
      );
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setVerificationMessage(null);
    try {
      const result = await resendCode({ email: email.trim() }).unwrap();
      setVerificationMessage(
        result.message ||
          "A new code was sent. Check your inbox and spam folder.",
      );
    } catch (err: any) {
      setError(
        err?.data?.message || "Could not resend the code. Try again later.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background gradient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-150 h-150 bg-sky-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-100 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-emerald-400 shadow-2xl shadow-sky-500/30 mb-4">
            <img
              src="/kanitt-mark.svg"
              alt="Kanitt"
              className="h-12 w-12 rounded-xl"
            />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            KANITT POS
          </h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">
            Desktop Pro — Sign in to your workspace
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <form
            onSubmit={verificationStep ? handleVerifyEmail : handleLogin}
            className="space-y-5"
          >
            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {verificationStep ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-200">
                  Enter the 6-digit code sent to <strong>{email.trim()}</strong>
                  .
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={verificationCode}
                    onChange={(event) =>
                      setVerificationCode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    placeholder="000000"
                    maxLength={6}
                    required
                    autoFocus
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-center font-mono text-xl tracking-[0.5em] text-white placeholder-slate-700 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                {verificationMessage && (
                  <p role="status" className="text-xs text-emerald-300">
                    {verificationMessage}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationStep(false);
                      setVerificationMessage(null);
                      setError(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    Back to sign in
                  </button>
                  <button
                    type="button"
                    disabled={isResending}
                    onClick={() => void handleResendCode()}
                    className="font-semibold text-sky-300 hover:text-sky-200 disabled:opacity-50"
                  >
                    {isResending ? "Sending…" : "Resend code"}
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Organization Code (Always visible like 2nd image) */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-sky-400 block mb-1.5">
                    Organization Code
                  </label>
                  <input
                    type="text"
                    value={tenantCode}
                    onChange={(e) =>
                      setTenantCode(e.target.value.toUpperCase())
                    }
                    placeholder="e.g. TNT-ABC123"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors font-mono tracking-wider"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Found in Settings → Store Information in your web dashboard
                  </p>
                </div>
              </>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || isVerifying}
              className="w-full mt-2 bg-linear-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading || isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {verificationStep ? "Verifying…" : "Signing in..."}
                </>
              ) : verificationStep ? (
                "Verify email & sign in"
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
