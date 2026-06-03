"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth-provider";
import { RegisterView } from "@/app/register/register-view";

export default function RegisterPage() {
  const router = useRouter();
  const { registerUser } = useAuth();

  const [username,        setUsername       ] = useState("");
  const [email,           setEmail          ] = useState("");
  const [phone,           setPhone          ] = useState("");
  const [password,        setPassword       ] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error,           setError          ] = useState("");
  const [isSubmitting,    setIsSubmitting   ] = useState(false);

  // After successful registration, hold the TOTP setup info so we can show the QR code.
  const [totpQr,     setTotpQr    ] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const result = await registerUser({ username, password, email, phone });

    if (!result.ok) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    // If the server returned TOTP setup info, show the QR code step.
    if (result.totpQr) {
      setTotpQr(result.totpQr);
      setTotpSecret(result.totpSecret ?? null);
      setIsSubmitting(false);
      return;
    }

    router.push("/browse");
  }

  // TOTP setup step: user scans QR code and clicks Continue.
  if (totpQr) {
    return (
      <RegisterView
        totpQr={totpQr}
        totpSecret={totpSecret ?? ""}
        onTotpDone={() => router.push("/browse")}
      />
    );
  }

  return (
    <RegisterView
      username={username}
      email={email}
      phone={phone}
      password={password}
      confirmPassword={confirmPassword}
      error={error}
      isSubmitting={isSubmitting}
      onUsernameChange={setUsername}
      onEmailChange={setEmail}
      onPhoneChange={setPhone}
      onPasswordChange={setPassword}
      onConfirmPasswordChange={setConfirmPassword}
      onSubmit={handleSubmit}
    />
  );
}
