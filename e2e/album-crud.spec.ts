import { test, expect } from "@playwright/test";

/** Helper: log in as admin before each test. */
async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator("input").first().fill("admin");
  await page.locator('input[type="password"]').fill("admin");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/browse/);
}

test.describe("Album CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should create a new album and see it on the detail page", async ({ page }) => {
    await page.getByText("Add Album").click();
    await expect(page).toHaveURL(/\/albums\/new/);

    // Fill in the form
    await page.locator('input').nth(0).fill("Test Album");
    await page.locator('input').nth(1).fill("Test Artist");
    await page.locator('input[type="number"]').fill("2024");
    await page.locator('input').nth(3).fill("Rock");
    await page.locator('input[type="url"]').fill("https://example.com/cover.jpg");
    await page.locator("textarea").fill("A great test album description.");

    await page.locator('button[type="submit"]').click();

    // Should redirect to the album detail page
    await expect(page).toHaveURL(/\/albums\//);
    await expect(page.locator("h1")).toContainText("Test Album");
    await expect(page.locator("text=Test Artist")).toBeVisible();
    await expect(page.locator("text=2024")).toBeVisible();
    await expect(page.locator("text=A great test album description.")).toBeVisible();
  });

  test("should edit an existing album", async ({ page }) => {
    // Navigate to the first album in the browse table
    await page.locator("table tbody tr").first().locator("a").click();
    await expect(page).toHaveURL(/\/albums\//);

    const originalTitle = await page.locator("h1").textContent();

    // Click edit
    await page.getByText("Edit Album").click();
    await expect(page).toHaveURL(/\/edit/);

    // Change the description
    const descriptionField = page.locator("textarea");
    await descriptionField.clear();
    await descriptionField.fill("Updated description via E2E test.");
    await page.locator('button[type="submit"]').click();

    // Should redirect back to detail page with updated content
    await expect(page).toHaveURL(/\/albums\//);
    await expect(page.locator("h1")).toContainText(originalTitle!);
    await expect(page.locator("text=Updated description via E2E test.")).toBeVisible();
  });

  test("should show Add Album button only for admin users", async ({ page }) => {
    // Already logged in as admin — button should be visible
    await expect(page.getByText("Add Album")).toBeVisible();

    // Logout
    await page.getByText("Logout").click();

    // Login as regular user
    await page.goto("/login");
    await page.locator("input").first().fill("user");
    await page.locator('input[type="password"]').fill("user");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/browse/);

    // Add Album button should NOT be visible
    await expect(page.getByText("Add Album")).not.toBeVisible();
  });

});
