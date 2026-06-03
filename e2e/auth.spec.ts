import { test, expect, type Page } from "@playwright/test";

async function submitMfaCodes(page: Page) {
  await expect(page.getByText(/Dev codes:/)).toBeVisible();
  const text = await page.getByText(/Dev codes:/).textContent();
  const match = text?.match(/email (\d{6}), SMS (\d{6})/);
  expect(match).not.toBeNull();
  await page.getByLabel("Email code").fill(match?.[1] ?? "");
  await page.getByLabel("SMS code").fill(match?.[2] ?? "");
  await page.locator('button[type="submit"]').click();
}

test.describe("Authentication", () => {
  test("should login with valid admin credentials and show username in header", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input").first().fill("admin");
    await page.locator('input[type="password"]').fill("admin");
    await page.locator('button[type="submit"]').click();
    await submitMfaCodes(page);

    await expect(page).toHaveURL(/\/browse/);
    await expect(page.locator("header")).toContainText("admin");
    await expect(page.locator("header")).toContainText("Logout");
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input").first().fill("wrong");
    await page.locator('input[type="password"]').fill("wrong");
    await page.locator('button[type="submit"]').click();

    await expect(page.locator("text=Invalid")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("should logout and return to unauthenticated state", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.locator("input").first().fill("admin");
    await page.locator('input[type="password"]').fill("admin");
    await page.locator('button[type="submit"]').click();
    await submitMfaCodes(page);
    await expect(page).toHaveURL(/\/browse/);

    // Logout
    await page.getByText("Logout").click();

    await expect(page.locator("header")).toContainText("Login");
    await expect(page.locator("header")).not.toContainText("Logout");
  });

  test("should login as regular user and not see admin controls", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input").first().fill("user");
    await page.locator('input[type="password"]').fill("user");
    await page.locator('button[type="submit"]').click();
    await submitMfaCodes(page);

    await expect(page).toHaveURL(/\/browse/);
    await expect(page.locator("header")).toContainText("user");
    await expect(page.getByText("Add Album")).not.toBeVisible();
  });
});
