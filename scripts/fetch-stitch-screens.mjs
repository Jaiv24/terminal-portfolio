#!/usr/bin/env node
/**
 * Lists screens in a Stitch project via @google/stitch-sdk, then downloads
 * each HTML bundle and screenshot using curl -L.
 *
 * API key: STITCH_API_KEY env, or .cursor/mcp.json (stitch.headers).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Stitch, StitchToolClient } from "@google/stitch-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "stitch-export");

const PROJECT_ID = "2522649813461582868";

/** Stable filenames for known screen IDs (your Stitch brief). */
const SLUG_BY_ID = {
  "267a5dd4124242ec959fcda7988a0f19": "02-landing-page",
  "6f62b236f32d496bbf5d6a2925384fa3": "03-projects-gallery",
  "1833488600384a219a745e11528d88df": "04-about-contact",
  "fb160f80a42e4fdfb6a2c3f25a77b6b4": "06-projects-gallery-modern",
};

/** Design-system asset stub IDs from your brief — not returned by list_screens for this project. */
const UNRESOLVED_STUBS = [
  { title: "Design System", id: "asset-stub-assets-210d5d0298be4eff859fa18da94343d9-1774144781862" },
  { title: "Design System", id: "asset-stub-assets-cf09f6240888415b9010c612d9d790e0-1774145050769" },
];

function loadApiKey() {
  if (process.env.STITCH_API_KEY?.trim()) return process.env.STITCH_API_KEY.trim();
  try {
    const mcpPath = join(ROOT, ".cursor", "mcp.json");
    const raw = JSON.parse(readFileSync(mcpPath, "utf8"));
    const k = raw?.mcpServers?.stitch?.headers?.["X-Goog-Api-Key"];
    if (k?.trim()) return k.trim();
  } catch {
    /* ignore */
  }
  console.error("Missing STITCH_API_KEY (or .cursor/mcp.json stitch header).");
  process.exit(1);
}

function curlDownload(url, dest) {
  execFileSync("curl", ["-fsSL", "-L", "--retry", "2", "-o", dest, url], {
    stdio: "inherit",
  });
}

function safeSlug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

const apiKey = loadApiKey();
mkdirSync(OUT, { recursive: true });

const client = new StitchToolClient({
  apiKey,
  baseUrl: "https://stitch.googleapis.com/mcp",
});
const stitch = new Stitch(client);
const project = stitch.project(PROJECT_ID);

const manifest = {
  projectId: PROJECT_ID,
  fetchedAt: new Date().toISOString(),
  note:
    "Design System screens with asset-stub-assets-* IDs are not listed under this project via list_screens / get_screen (404). Export those from Stitch UI or link them to this project if they live elsewhere.",
  unresolvedStubs: UNRESOLVED_STUBS,
  screens: [],
};

try {
  const screens = await project.screens();
  console.error(`Found ${screens.length} screen(s) in project ${PROJECT_ID}\n`);

  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];
    const id = screen.screenId;
    const title = screen.data?.title || "untitled";
    const base =
      SLUG_BY_ID[id] ||
      `${String(i + 1).padStart(2, "0")}-${safeSlug(title)}-${id.slice(0, 8)}`;

    const htmlUrl = await screen.getHtml();
    const imageUrl = await screen.getImage();

    const htmlPath = join(OUT, `${base}.html`);
    const imgPath = join(OUT, `${base}.png`);

    console.error(`→ ${title} (${id})`);

    if (htmlUrl) {
      console.error(`  curl HTML → ${base}.html`);
      curlDownload(htmlUrl, htmlPath);
    } else {
      console.error("  (no HTML URL)");
    }

    if (imageUrl) {
      console.error(`  curl screenshot → ${base}.png`);
      curlDownload(imageUrl, imgPath);
    } else {
      console.error("  (no screenshot URL)");
    }

    manifest.screens.push({
      title,
      screenId: id,
      slug: base,
      htmlDownloadUrl: htmlUrl || null,
      screenshotDownloadUrl: imageUrl || null,
      savedHtml: htmlUrl ? `${base}.html` : null,
      savedScreenshot: imageUrl ? `${base}.png` : null,
    });
  }
} finally {
  await client.close();
}

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.error(`\nDone. Output directory: ${OUT}`);
