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
  const [identifier, setIdentifier] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = challenge
      ? await completePasswordRecovery(challenge.challengeId, emailCode, smsCode, newPassword)
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
                    Enter the email code sent to {challenge.emailHint ?? "your email"} and the SMS code sent to {challenge.phoneHint ?? "your phone"}.
                  </p>

                  {challenge.devEmailCode && challenge.devSmsCode ? (
                    <p className="text-sm text-zinc-600">
                      Dev codes: email {challenge.devEmailCode}, SMS {challenge.devSmsCode}
                    </p>
                  ) : null}

                  <label className="block">
                    <span className={labelClassName}>Email code</span>
                    <input inputMode="numeric" value={emailCode} onChange={(event) => setEmailCode(event.target.value)} className={inputClassName} />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>SMS code</span>
                    <input inputMode="numeric" value={smsCode} onChange={(event) => setSmsCode(event.target.value)} className={inputClassName} />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>New password</span>
                    <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClassName} />
                  </label>
                </>
              )}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full bg-zinc-700 text-lg font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
              >
                {isSubmitting ? "Working..." : challenge ? "Reset password" : "Send codes"}
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
