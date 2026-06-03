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

    router.push("/browse");
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
