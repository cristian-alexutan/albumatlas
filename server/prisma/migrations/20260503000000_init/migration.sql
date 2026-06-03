-- Migration: 20260503000000_init
-- Generated from Prisma schema (prisma migrate dev --name init)
-- Database: PostgreSQL

-- CreateTable: albums (3NF – every non-key attribute depends only on id)
CREATE TABLE "albums" (
    "id"          TEXT          NOT NULL,
    "title"       VARCHAR(200)  NOT NULL,
    "artist"      VARCHAR(200)  NOT NULL,
    "year"        INTEGER       NOT NULL,
    "genre"       VARCHAR(80)   NOT NULL,
    "coverUrl"    VARCHAR(2048) NOT NULL,
    "description" TEXT          NOT NULL DEFAULT '',
    "rating"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "featured"    BOOLEAN       NOT NULL DEFAULT false,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tracks (3NF – every non-key attribute depends only on id)
CREATE TABLE "tracks" (
    "id"          TEXT         NOT NULL,
    "albumId"     TEXT         NOT NULL,
    "title"       VARCHAR(200) NOT NULL,
    "position"    INTEGER      NOT NULL,
    "durationSec" INTEGER      NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: fast lookups by genre for filter queries
CREATE INDEX "albums_genre_idx" ON "albums"("genre");

-- CreateIndex: fast lookups by year for decade statistics
CREATE INDEX "albums_year_idx" ON "albums"("year");

-- CreateIndex: fast lookups of tracks by album
CREATE INDEX "tracks_albumId_idx" ON "tracks"("albumId");

-- AddForeignKey: tracks.albumId → albums.id (CASCADE delete)
ALTER TABLE "tracks"
    ADD CONSTRAINT "tracks_albumId_fkey"
    FOREIGN KEY ("albumId")
    REFERENCES "albums"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
