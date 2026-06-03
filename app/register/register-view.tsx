import type { FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/app/components/site-header";

const inputClassName = "h-12 w-full border border-zinc-300 bg-white px-4 text-base text-zinc-800";
const labelClassName = "mb-2 block text-lg font-medium text-zinc-800";

// ── TOTP-setup step ───────────────────────────────────────────────────────────

type TotpSetupProps = {
  totpQr: string;
  totpSecret: string;
  onTotpDone: () => void;
};

// ── Registration form step ────────────────────────────────────────────────────

type RegisterFormProps = {
  totpQr?: undefined;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  error: string;
  isSubmitting: boolean;
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type RegisterViewProps = TotpSetupProps | RegisterFormProps;

export function RegisterView(props: RegisterViewProps) {
  // ── TOTP setup screen ────────────────────────────────────────────────────────
  if ("totpQr" in props && props.totpQr) {
    const { totpQr, totpSecret, onTotpDone } = props;
    return (
      <div className="min-h-screen bg-zinc-100">
        <SiteHeader />

        <main className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[680px]">
            <section className="border border-zinc-300 bg-zinc-100 p-8">
              <h1 className="text-center text-3xl font-semibold text-zinc-900">
                Set up two-factor authentication
              </h1>

              <p className="mt-4 text-center text-base text-zinc-600">
                Scan this QR code with <strong>Google Authenticator</strong> (or any TOTP app).
                You will need the 6-digit code from the app every time you log in.
              </p>

              <div className="mt-6 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={totpQr}
                  alt="TOTP QR code"
                  width={220}
                  height={220}
                  className="rounded border border-zinc-300 bg-white p-2"
                />
              </div>

              <p className="mt-4 text-center text-sm text-zinc-500">
                Can&apos;t scan? Enter this secret manually:
              </p>
              <p className="mt-1 break-all text-center font-mono text-sm font-semibold text-zinc-800">
                {totpSecret}
              </p>

              <button
                onClick={onTotpDone}
                className="mt-8 h-12 w-full bg-zinc-700 text-lg font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
              >
                I&apos;ve scanned the QR code — Continue
              </button>
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

  // ── Registration form ────────────────────────────────────────────────────────
  const {
    username,
    email,
    phone,
    password,
    confirmPassword,
    error,
    isSubmitting,
    onUsernameChange,
    onEmailChange,
    onPhoneChange,
    onPasswordChange,
    onConfirmPasswordChange,
    onSubmit,
  } = props as RegisterFormProps;

  return (
    <div className="min-h-screen bg-zinc-100">
      <SiteHeader />

      <main className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[680px]">
          <section className="border border-zinc-300 bg-zinc-100 p-8">
            <h1 className="text-center text-3xl font-semibold text-zinc-900">Register</h1>

            <form onSubmit={onSubmit} className="mt-8 space-y-6">
              <label className="block">
                <span className={labelClassName}>Username</span>
                <input value={username} onChange={(event) => onUsernameChange(event.target.value)} className={inputClassName} />
              </label>

              <label className="block">
                <span className={labelClassName}>Email</span>
                <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} className={inputClassName} />
              </label>

              <label className="block">
                <span className={labelClassName}>Phone</span>
                <input type="tel" value={phone} onChange={(event) => onPhoneChange(event.target.value)} className={inputClassName} />
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

              <label className="block">
                <span className={labelClassName}>Confirm Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => onConfirmPasswordChange(event.target.value)}
                  className={inputClassName}
                />
              </label>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full bg-zinc-700 text-lg font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
              >
                {isSubmitting ? "Creating account..." : "Register"}
              </button>
            </form>

            <p className="mt-6 text-center text-base text-zinc-600">
              Already have an account?{" "}
              <Link href="/login" className="hover:underline">
                Login here
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
