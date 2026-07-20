import { expect, test, type Page } from "@playwright/test";

test.setTimeout(45_000);

async function startGame(page: Page) {
  const board = page.locator(".board");
  await page.getByRole("button", { name: /play now/i }).click();
  await expect(board).toHaveAttribute("data-status", "playing", { timeout: 10_000 });
  return board;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.app-shell")).toHaveAttribute("data-client-ready", "true");
});

test("keyboard play covers movement, rotation, hold, pause, focus loss, game over, and restart", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop keyboard path");
  const board = await startGame(page);

  const initialX = Number(await board.getAttribute("data-active-x"));
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => Number(await board.getAttribute("data-active-x"))).toBeLessThan(initialX);

  if (await board.getAttribute("data-active") === "O") await page.keyboard.press("Space");
  const initialRotation = Number(await board.getAttribute("data-rotation"));
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => Number(await board.getAttribute("data-rotation"))).not.toBe(initialRotation);

  const heldType = await board.getAttribute("data-active");
  await page.keyboard.press("KeyC");
  await expect(board).toHaveAttribute("data-hold", heldType ?? "");

  await page.keyboard.press("KeyP");
  await expect(board).toHaveAttribute("data-status", "paused");
  await page.keyboard.press("KeyP");
  await expect(board).toHaveAttribute("data-status", "playing");

  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(165);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const releasedX = await board.getAttribute("data-active-x");
  await page.waitForTimeout(260);
  await expect(board).toHaveAttribute("data-active-x", releasedX ?? "");
  await page.keyboard.up("ArrowLeft");

  for (let index = 0; index < 80 && await board.getAttribute("data-status") !== "over"; index += 1) {
    await page.keyboard.press("Space");
  }
  await expect(board).toHaveAttribute("data-status", "over");
  await page.getByRole("button", { name: /run it back/i }).click();
  await expect(board).toHaveAttribute("data-status", "playing", { timeout: 6_000 });
});

test("mobile controls survive resize and orientation changes", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch path");
  const board = await startGame(page);
  await page.getByRole("button", { name: "Rotate" }).click();
  const activeType = await board.getAttribute("data-active");
  await page.getByRole("button", { name: "Hold" }).click();
  await expect(board).toHaveAttribute("data-hold", activeType ?? "");
  await page.getByRole("button", { name: "Drop" }).click();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator(".board-frame")).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Pause game" })).toBeVisible();
});

test("remapped controls and independent volume persist", async ({ page }) => {
  await page.getByRole("button", { name: "Open controls and help" }).click();
  const remap = page.locator(".binding-row").filter({ hasText: "Rotate clockwise" });
  await remap.click();
  await page.keyboard.press("q");
  await expect(remap).toContainText("Q");
  await page.locator("#effects-volume").fill("0.35");
  await expect(page.locator(".volume-setting output")).toHaveText("35%");
  await page.getByRole("button", { name: "Back to the board" }).click();
  await expect.poll(async () => await page.evaluate(() => window.localStorage.getItem("blockline:tetris:v1")))
    .toContain('"rotateClockwise":"KeyQ"');

  await page.reload();
  await page.getByRole("button", { name: "Open controls and help" }).click();
  await expect(page.locator(".binding-row").filter({ hasText: "Rotate clockwise" })).toContainText("Q");
  await expect(page.locator("#effects-volume")).toHaveValue("0.35");
  await page.getByRole("button", { name: "Sound effects" }).click();
  await expect(page.getByRole("button", { name: "Sound effects" })).toHaveAttribute("aria-pressed", "false");
});

test("visibility suspension pauses and reduced motion removes animated timing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const board = await startGame(page);
  const animationDuration = await page.locator(".ambient").first().evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(animationDuration)).toBeLessThanOrEqual(0.01);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(board).toHaveAttribute("data-status", "paused");
});

test("four-times CPU throttling stays inside the input and frame budgets", async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || isMobile, "Chromium desktop performance budget");
  const board = await startGame(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const inputStart = await page.evaluate(() => performance.now());
  const initialX = await board.getAttribute("data-active-x");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => await board.getAttribute("data-active-x")).not.toBe(initialX);
  const inputLatency = await page.evaluate((start) => performance.now() - start, inputStart);
  expect(inputLatency).toBeLessThan(250);

  const deltas = await page.evaluate(async () => await new Promise<number[]>((resolve) => {
    const samples: number[] = [];
    let previous = performance.now();
    const sample = (now: number) => {
      samples.push(now - previous);
      previous = now;
      if (samples.length >= 90) resolve(samples.slice(5));
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  deltas.sort((left, right) => left - right);
  const p95 = deltas[Math.floor(deltas.length * 0.95)];
  expect(p95).toBeLessThan(80);
  expect(Math.max(...deltas)).toBeLessThan(250);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});
