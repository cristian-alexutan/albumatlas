"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/app/components/site-header";
import { useAuth, type LoginChallenge } from "@/app/components/auth-provider";

const inputClassName = "h-12 w-full border border-zinc-300 bg-white px-4 text-base text-zinc-800";
const labelClassName = "mb-2 block text-lg font-medium text-zinc-800";

export default function RecoverPage() {
  const router = useRouter();
  const { startPasswordRecovery, completePasswordRecovery } = useAuth();
  const [identifier,   setIdentifier  ] = useState("");
  const [emailCode,    setEmailCode   ] = useState("");
  const [totpCode,     setTotpCode    ] = useState("");
  const [newPassword,  setNewPassword ] = useState("");
  const [challenge,    setChallenge   ] = useState<LoginChallenge | null>(null);
  const [error,        setError       ] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = challenge
      ? await completePasswordRecovery(challenge.challengeId, emailCode, totpCode, newPassword)
      : await startPasswordRecovery(identifier);

    if (!result.ok && "mfaRequired" in result) {
      setChallenge(result.challenge);
      setIsSubmitting(false);
      return;
    }

    if (!result.ok) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <SiteHeader />

      <main className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[680px]">
          <section className="border border-zinc-300 bg-zinc-100 p-8">
            <h1 className="text-center text-3xl font-semibold text-zinc-900">Recover password</h1>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {!challenge ? (
                <label className="block">
                  <span className={labelClassName}>Username or email</span>
                  <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} className={inputClassName} />
                </label>
              ) : (
                <>
                  <p className="text-sm text-zinc-600">
                    A verification code has been sent to {challenge.emailHint ?? "your email"}.
                    Also open your authenticator app for the second code.
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
                      onChange={(event) => setEmailCode(event.target.value)}
                      className={inputClassName}
                      placeholder="6-digit code from your email"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Authenticator code</span>
                    <input
                      inputMode="numeric"
                      value={totpCode}
                      onChange={(event) => setTotpCode(event.target.value)}
                      className={inputClassName}
                      placeholder="6-digit code from Google Authenticator"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>New password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className={inputClassName}
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
                {isSubmitting ? "Working..." : challenge ? "Reset password" : "Send code"}
              </button>
            </form>
          </section>

          <p className="mt-8 text-center text-base text-zinc-600">
            <Link href="/login" className="hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
