import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished Blockline game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Blockline — Professional Tetris<\/title>/i);
  assert.match(html, /BLOCK\/\/LINE/);
  assert.match(html, /Make space\./i);
  assert.match(html, /Tournament mode/i);
  assert.match(html, /Touch controls/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("removes starter-only assets and keeps deployment configuration intact", async () => {
  const [page, layout, packageJson, hosting] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
  ]);
  assert.match(page, /from "\.\/game\/engine"/);
  assert.match(page, /addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(page, /addEventListener\("keyup", onKeyUp\)/);
  assert.match(page, /addEventListener\("blur", releaseHeldControls\)/);
  assert.doesNotMatch(page, /addEventListener\("blur", autoPause\)/);
  assert.match(page, /const closeHelp = useCallback/);
  assert.match(page, /role="group" aria-label=\{boardLabel\}/);
  assert.match(layout, /Blockline — Professional Tetris/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  const hostingConfig = JSON.parse(hosting);
  assert.match(hostingConfig.project_id, /^appgprj_/);
  assert.equal(hostingConfig.d1, null);
  assert.equal(hostingConfig.r2, null);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
