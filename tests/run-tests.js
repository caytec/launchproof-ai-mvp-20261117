"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "index.html",
  "privacy.html",
  "terms.html",
  "css/style.css",
  "js/app.js",
  "api/generate.js",
  "vercel.json",
  "package.json",
  ".env.example",
  ".gitignore",
  ".nojekyll",
  "robots.txt",
  "sitemap.xml",
  "og-image.svg",
  "favicon.svg",
  "README.md"
];

for (const file of requiredFiles) {
  assert.equal(
    fs.existsSync(path.join(root, file)),
    true,
    `Missing required file: ${file}`
  );
}

const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const api = fs.readFileSync(path.join(root, "api/generate.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const env = fs.readFileSync(path.join(root, ".env.example"), "utf8");
const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");

assert.match(app, /window\.LAUNCHPROOF_API_URL/);
assert.match(app, /function validClientReport/);
assert.match(app, /function statusClass/);
assert.match(app, /aria-busy/);

assert.match(api, /MAX_BODY_BYTES/);
assert.match(api, /Content-Type must be application\/json/);
assert.match(api, /Cache-Control/);
assert.match(api, /ALLOWED_STATUS/);
assert.match(api, /function validReport/);
assert.match(api, /response\.text\(\)/);

assert.match(index, /class="skip-link"/);
assert.match(index, /id="main-content"/);
assert.match(index, /twitter:card/);
assert.match(index, /og:image:alt/);
assert.match(index, /type="application\/ld\+json"/);
assert.match(index, /<noscript>/);

assert.match(env, /AI_PROVIDER=none/);
assert.doesNotMatch(env, /NEXT_PUBLIC|VITE_/);

assert.match(robots, /Sitemap: \/sitemap\.xml/);
assert.match(sitemap, /<urlset/);
assert.match(sitemap, /<loc>\.\/<\/loc>/);

console.log(`Passed ${requiredFiles.length} repository integrity checks.`);
