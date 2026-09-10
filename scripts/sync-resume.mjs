#!/usr/bin/env node
/**
 * Regenerates the resume PDF from career-ops (sibling project) and copies it
 * into this repo as Jaiv_sde_Res.pdf, so the site's download button always
 * serves the latest version of the resume.
 *
 * career-ops (../career-ops relative to this repo) is the source of truth:
 * cv.md holds the canonical experience/skills, and
 * output/cv-jaiv-shah-portfolio.html is the general (non-JD-tailored) resume
 * used for the portfolio site. Run this after editing either file.
 *
 * Usage: node scripts/sync-resume.mjs
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_ROOT = join(__dirname, "..");
const CAREER_OPS_ROOT = join(PORTFOLIO_ROOT, "..", "career-ops");

const RESUME_HTML = join(CAREER_OPS_ROOT, "output", "cv-jaiv-shah-portfolio.html");
const RESUME_PDF = join(CAREER_OPS_ROOT, "output", "cv-jaiv-shah-portfolio.pdf");
const DEST_PDF = join(PORTFOLIO_ROOT, "Jaiv_sde_Res.pdf");

if (!existsSync(CAREER_OPS_ROOT)) {
  console.error(`career-ops repo not found at ${CAREER_OPS_ROOT}`);
  process.exit(1);
}
if (!existsSync(RESUME_HTML)) {
  console.error(`Resume source HTML not found: ${RESUME_HTML}`);
  process.exit(1);
}

console.log("Rendering resume PDF from career-ops...");
execFileSync(
  "node",
  ["generate-pdf.mjs", "output/cv-jaiv-shah-portfolio.html", "output/cv-jaiv-shah-portfolio.pdf", "--format=letter"],
  { cwd: CAREER_OPS_ROOT, stdio: "inherit" }
);

copyFileSync(RESUME_PDF, DEST_PDF);
console.log(`Copied resume -> ${DEST_PDF}`);
