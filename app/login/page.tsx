"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type LoginChallenge } from "@/app/components/auth-provider";
import { LoginView } from "@/app/login/login-view";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, verifyLogin } = useAuth();

  const [username,     setUsername    ] = useState("");
  const [password,     setPassword    ] = useState("");
  const [emailCode,    setEmailCode   ] = useState("");
  const [totpCode,     setTotpCode    ] = useState("");
  const [challenge,    setChallenge   ] = useState<LoginChallenge | null>(null);
  const [error,        setError       ] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = challenge
      ? await verifyLogin(challenge.challengeId, emailCode, totpCode)
      : await signIn(username, password);

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

    router.push("/browse");
  }

  return (
    <LoginView
      username={username}
      password={password}
      emailCode={emailCode}
      totpCode={totpCode}
      challenge={challenge}
      error={error}
      isSubmitting={isSubmitting}
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onEmailCodeChange={setEmailCode}
      onTotpCodeChange={setTotpCode}
      onSubmit={handleSubmit}
    />
  );
}
