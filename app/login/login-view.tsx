import type { FormEvent } from "react";
import Link from "next/link";
import { SiteHeader } from "@/app/components/site-header";
import type { LoginChallenge } from "@/app/components/auth-provider";

const inputClassName = "h-12 w-full border border-zinc-300 bg-white px-4 text-base text-zinc-800";
const labelClassName = "mb-2 block text-lg font-medium text-zinc-800";

type LoginViewProps = {
  username: string;
  password: string;
  emailCode: string;
  totpCode: string;
  challenge: LoginChallenge | null;
  error: string;
  isSubmitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onEmailCodeChange: (value: string) => void;
  onTotpCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function LoginView({
  username,
  password,
  emailCode,
  totpCode,
  challenge,
  error,
  isSubmitting,
  onUsernameChange,
  onPasswordChange,
  onEmailCodeChange,
  onTotpCodeChange,
  onSubmit,
}: LoginViewProps) {
  return (
    <div className="min-h-screen bg-zinc-100">
      <SiteHeader />

      <main className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[680px]">
          <section className="border border-zinc-300 bg-zinc-100 p-8">
            <h1 className="text-center text-3xl font-semibold text-zinc-900">Login</h1>

            <form onSubmit={onSubmit} className="mt-8 space-y-6">
              {!challenge ? (
                <>
                  <label className="block">
                    <span className={labelClassName}>Username</span>
                    <input value={username} onChange={(event) => onUsernameChange(event.target.value)} className={inputClassName} />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Password</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => onPasswordChange(event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                </>
              ) : (
                <>
                  <p className="text-sm text-zinc-600">
                    A verification code has been sent to {challenge.emailHint ?? "your email"}.
                    Open your authenticator app for the second code.
                  </p>

                  {challenge.devEmailCode ? (
                    <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <strong>Dev mode</strong> — email code: <code>{challenge.devEmailCode}</code>
                    </p>
                  ) : null}

                  <label className="block">
                    <span className={labelClassName}>Email code</span>
                    <input
                      inputMode="numeric"
                      value={emailCode}
                      onChange={(event) => onEmailCodeChange(event.target.value)}
                      className={inputClassName}
                      placeholder="6-digit code from your email"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Authenticator code</span>
                    <input
                      inputMode="numeric"
                      value={totpCode}
                      onChange={(event) => onTotpCodeChange(event.target.value)}
                      className={inputClassName}
                      placeholder="6-digit code from Google Authenticator"
                    />
                  </label>
                </>
              )}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full bg-zinc-700 text-lg font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
              >
                {isSubmitting ? "Logging in..." : challenge ? "Verify login" : "Login"}
              </button>
            </form>

            <p className="mt-6 text-center text-base text-zinc-600">
              <Link href="/recover" className="hover:underline">
                Forgot password?
              </Link>
              {" | "}
              Don&apos;t have an account?{" "}
              <Link href="/register" className="hover:underline">
                Register here
              </Link>
            </p>
          </section>

          <p className="mt-8 text-center text-base text-zinc-600">
            <Link href="/" className="hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
