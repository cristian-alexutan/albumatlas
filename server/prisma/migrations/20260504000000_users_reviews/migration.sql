-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateTable: users
CREATE TABLE "users" (
    "id"        TEXT         NOT NULL,
    "username"  VARCHAR(100) NOT NULL,
    "email"     VARCHAR(200),
    "password"  VARCHAR(200) NOT NULL,
    "role"      "Role"       NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: permissions
CREATE TABLE "permissions" (
    "id"          TEXT         NOT NULL,
    "name"        VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: role_permissions  (junction – no non-key attributes → 3NF trivially)
CREATE TABLE "role_permissions" (
    "role"         "Role" NOT NULL,
    "permissionId" TEXT   NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role", "permissionId")
);

-- CreateTable: reviews
CREATE TABLE "reviews" (
    "id"        TEXT         NOT NULL,
    "albumId"   TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "rating"    INTEGER      NOT NULL,
    "comment"   TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "users_username_key"      ON "users"("username");
CREATE UNIQUE INDEX "users_email_key"         ON "users"("email");
CREATE UNIQUE INDEX "permissions_name_key"    ON "permissions"("name");
CREATE UNIQUE INDEX "reviews_albumId_userId_key" ON "reviews"("albumId", "userId");

-- Performance indexes
CREATE INDEX "reviews_albumId_idx" ON "reviews"("albumId");
CREATE INDEX "reviews_userId_idx"  ON "reviews"("userId");

-- Foreign keys
ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "permissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reviews"
    ADD CONSTRAINT "reviews_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "albums"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reviews"
    ADD CONSTRAINT "reviews_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
