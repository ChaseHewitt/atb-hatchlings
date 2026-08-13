// Publishes a sprite folder to Firestore as a theme roster.
//
//   npm run publish-theme -- "Gen 1 Pokemon"
//   npm run publish-theme -- --all
//
// The roster is the single source of truth both the website and the iOS app
// read: the site renders from it, the app rolls a species from it. That is the
// whole point — a hardcoded list in either codebase is how they drifted apart
// and hatched Classic pets under a Pokemon theme.
//
// Needs a service-account key (Firebase console -> Project settings ->
// Service accounts -> Generate new private key), saved as serviceAccount.json
// in the repo root. It is gitignored. The Admin SDK bypasses security rules,
// so appConfig stays write-protected for every real client.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const spritesDir = join(root, "public", "sprites");
const keyPath = join(root, "serviceAccount.json");

if (!existsSync(keyPath)) {
  console.error("Missing serviceAccount.json in the repo root.");
  console.error("Firebase console -> Project settings -> Service accounts -> Generate new private key.");
  process.exit(1);
}

const STRIP_DEFAULT_FRAMES = 25;
const STRIP_DEFAULT_FPS = 12;

/**
 * Builds a roster from the files in a theme folder. A manifest.json in the
 * folder wins when present, so a pack with irregular naming or odd strip
 * layouts can be described by hand; otherwise the convention is
 * "Name_anything.ext" -> id "name", display name "Name".
 */
function rosterFor(theme) {
  const dir = join(spritesDir, theme);
  const manifestPath = join(dir, "manifest.json");
  if (existsSync(manifestPath)) {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (Array.isArray(parsed.creatures) && parsed.creatures.length > 0) {
      return parsed.creatures;
    }
  }

  return readdirSync(dir)
    .filter((file) => [".gif", ".png"].includes(extname(file).toLowerCase()))
    .sort()
    .map((file) => {
      const stem = basename(file, extname(file));
      const name = stem.split("_")[0];
      const isGif = extname(file).toLowerCase() === ".gif";
      return {
        id: name.toLowerCase(),
        name,
        file,
        format: isGif ? "gif" : "strip",
        ...(isGif ? {} : { frames: STRIP_DEFAULT_FRAMES, fps: STRIP_DEFAULT_FPS }),
      };
    });
}

function themeFolders() {
  return readdirSync(spritesDir).filter((entry) =>
    statSync(join(spritesDir, entry)).isDirectory()
  );
}

const args = process.argv.slice(2);
const themes = args.includes("--all") ? themeFolders() : args.filter((a) => !a.startsWith("--"));

if (themes.length === 0) {
  console.error('Usage: npm run publish-theme -- "Theme Name"   (or --all)');
  console.error("Folders found: " + themeFolders().join(", "));
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const db = getFirestore();

for (const theme of themes) {
  if (!existsSync(join(spritesDir, theme))) {
    console.error(`✗ ${theme}: no folder at public/sprites/${theme}`);
    process.exitCode = 1;
    continue;
  }

  const creatures = rosterFor(theme);
  if (creatures.length === 0) {
    console.error(`✗ ${theme}: no sprite files found`);
    process.exitCode = 1;
    continue;
  }

  await db.doc(`appConfig/hatchlings/themes/${theme}`).set({
    creatures,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Keep the picker list in step so a published theme is immediately
  // selectable in the iOS app.
  await db.doc("appConfig/hatchlings").set(
    { themes: FieldValue.arrayUnion(theme) },
    { merge: true }
  );

  const gifs = creatures.filter((c) => c.format === "gif").length;
  console.log(`✓ ${theme}: ${creatures.length} creatures (${gifs} gif, ${creatures.length - gifs} strip)`);
}

console.log("Done.");
process.exit(0);
