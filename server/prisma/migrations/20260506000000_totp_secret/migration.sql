-- Add TOTP secret column for Google Authenticator 2FA
ALTER TABLE "users" ADD COLUMN "totpSecret" VARCHAR(64);
