import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected to login for app pages", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: /evo logistics sign in/i })
  ).toBeVisible();
});

test("unauthenticated API requests return JSON 401", async ({ page }) => {
  const response = await page.request.get("/api/settings");
  expect(response.status()).toBe(401);

  const payload = await response.json();
  expect(payload).toMatchObject({ error: "Unauthorized" });
});
