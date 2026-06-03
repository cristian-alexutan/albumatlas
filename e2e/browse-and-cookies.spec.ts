import { test, expect } from "@playwright/test";

test.describe("Browse & Search", () => {
  test("should display featured albums section", async ({ page }) => {
    await page.goto("/browse");

    await expect(page.getByText("Featured Albums")).toBeVisible();
    // Seed data has 3 featured albums
    const featuredCards = page.locator("text=Featured Albums").locator("..").locator("article");
    await expect(featuredCards).toHaveCount(3);
  });

  test("should display album table with pagination", async ({ page }) => {
    await page.goto("/browse");

    await expect(page.locator("table")).toBeVisible();
    // Seed data has 16 albums, 10 per page, so first page shows 10
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(10);

    // Pagination should show "Showing 1 to 10 of 15 albums"
    await expect(page.locator("text=Showing 1 to 10 of 15")).toBeVisible();
  });

  test("should search and filter albums by artist name", async ({ page }) => {
    await page.goto("/browse");

    await page.locator('input[name="q"]').fill("Pink Floyd");
    await page.locator('input[name="q"]').press("Enter");

    await expect(page).toHaveURL(/q=Pink/);
    await expect(page.locator("table")).toContainText("Pink Floyd");
    // Filtered results should be fewer than the full list
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeLessThanOrEqual(5);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("should search and filter albums by album title", async ({ page }) => {
    await page.goto("/browse");

    await page.locator('input[name="q"]').fill("Abbey Road");
    await page.locator('input[name="q"]').press("Enter");

    await expect(page.locator("table")).toContainText("Abbey Road");
  });

  test("should navigate to album detail from browse table", async ({ page }) => {
    await page.goto("/browse");

    // Click the first album link in the table
    await page.locator("table tbody tr").first().locator("a").click();

    await expect(page).toHaveURL(/\/albums\//);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("should navigate between pages using pagination", async ({ page }) => {
    await page.goto("/browse");

    await expect(page.locator("text=Showing 1 to 10")).toBeVisible();

    // Click page 2
    await page.locator('a:has-text("2")').last().click();

    await expect(page.locator("text=Showing 11 to")).toBeVisible();
  });
});

test.describe("Cookie: Statistics Mode Preference", () => {
  test("should default to visual mode on first visit", async ({ page }) => {
    await page.goto("/statistics");

    // The Visual button should be active (has the dark background class)
    const visualButton = page.locator('button:has-text("Visual")');
    await expect(visualButton).toHaveClass(/bg-zinc-700/);
  });

  test("should persist tabular mode preference in cookie across visits", async ({ page }) => {
    await page.goto("/statistics");

    // Switch to tabular mode
    await page.locator('button:has-text("Tabular")').click();

    // Verify tabular mode is active
    const tabularButton = page.locator('button:has-text("Tabular")');
    await expect(tabularButton).toHaveClass(/bg-zinc-700/);

    // Verify the cookie was set
    const cookies = await page.context().cookies();
    const modeCookie = cookies.find((c) => c.name === "stats_view_mode");
    expect(modeCookie).toBeDefined();
    expect(modeCookie!.value).toBe("tabular");

    // Navigate away and come back
    await page.goto("/browse");
    await page.goto("/statistics");

    // Should still be in tabular mode (cookie persisted)
    await expect(tabularButton).toHaveClass(/bg-zinc-700/);
  });

  test("should persist visual mode preference in cookie", async ({ page }) => {
    // Set tabular first
    await page.goto("/statistics");
    await page.locator('button:has-text("Tabular")').click();

    // Switch back to visual
    await page.locator('button:has-text("Visual")').click();

    const cookies = await page.context().cookies();
    const modeCookie = cookies.find((c) => c.name === "stats_view_mode");
    expect(modeCookie).toBeDefined();
    expect(modeCookie!.value).toBe("visual");

    // Revisit — should stay visual
    await page.goto("/browse");
    await page.goto("/statistics");
    const visualButton = page.locator('button:has-text("Visual")');
    await expect(visualButton).toHaveClass(/bg-zinc-700/);
  });
});

test.describe("Cookie: Music Map Click Tracking", () => {
  test("should track genre node clicks in cookie", async ({ page }) => {
    await page.goto("/music-map");

    // Click the Rock node
    await page.locator('button[data-node-id="rock"]').click();

    // Verify the cookie was set
    let cookies = await page.context().cookies();
    let clicksCookie = cookies.find((c) => c.name === "music_map_clicks");
    expect(clicksCookie).toBeDefined();
    let clickData = JSON.parse(decodeURIComponent(clicksCookie!.value));
    expect(clickData.rock).toBe(1);

    // Click Rock again
    await page.locator('button[data-node-id="rock"]').click();
    cookies = await page.context().cookies();
    clicksCookie = cookies.find((c) => c.name === "music_map_clicks");
    clickData = JSON.parse(decodeURIComponent(clicksCookie!.value));
    expect(clickData.rock).toBe(2);

    // Click a different node
    await page.locator('button[data-node-id="jazz"]').click();
    cookies = await page.context().cookies();
    clicksCookie = cookies.find((c) => c.name === "music_map_clicks");
    clickData = JSON.parse(decodeURIComponent(clicksCookie!.value));
    expect(clickData.rock).toBe(2);
    expect(clickData.jazz).toBe(1);
  });

  test("should display click count badges on genre nodes", async ({ page }) => {
    await page.goto("/music-map");

    // Initially no badges
    await expect(page.locator('[data-testid="click-count-rock"]')).not.toBeVisible();

    // Click Rock
    await page.locator('button[data-node-id="rock"]').click();

    // Badge should appear with count 1
    await expect(page.locator('[data-testid="click-count-rock"]')).toContainText("1");

    // Click Rock again
    await page.locator('button[data-node-id="rock"]').click();
    await expect(page.locator('[data-testid="click-count-rock"]')).toContainText("2");
  });

  test("should show activity summary section after clicking nodes", async ({ page }) => {
    await page.goto("/music-map");

    // Activity summary should not exist initially
    await expect(page.locator('[data-testid="activity-summary"]')).not.toBeVisible();

    // Click a node
    await page.locator('button[data-node-id="metal"]').click();

    // Activity summary should appear
    await expect(page.locator('[data-testid="activity-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="activity-metal"]')).toContainText("1 clicks");
  });

  test("should persist click counts across page navigations", async ({ page }) => {
    await page.goto("/music-map");

    // Click some nodes
    await page.locator('button[data-node-id="rock"]').click();
    await page.locator('button[data-node-id="jazz"]').click();
    await page.locator('button[data-node-id="rock"]').click();

    // Navigate away
    await page.goto("/browse");

    // Come back
    await page.goto("/music-map");

    // Click counts should be restored from cookie
    await expect(page.locator('[data-testid="click-count-rock"]')).toContainText("2");
    await expect(page.locator('[data-testid="click-count-jazz"]')).toContainText("1");

    // Activity summary should show persisted data
    await expect(page.locator('[data-testid="activity-summary"]')).toBeVisible();
  });
});
