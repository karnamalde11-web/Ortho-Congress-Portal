import { test, expect, type Page } from "@playwright/test";
async function chooseProduct(page: Page, code = "SMOKE-001") {
  await page.getByLabel("Search products").fill(code);
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByLabel("Quantity to reserve").fill("1");
}
async function customer(page: Page, name: string) {
  await page.getByLabel("Name *", { exact: true }).fill(name);
  await page
    .getByLabel("Specialty *", { exact: true })
    .selectOption("Orthopaedic Surgeon");
  await page
    .getByLabel("Hospital / Clinic *", { exact: true })
    .fill("Smoke test clinic");
  await page.getByLabel("City *", { exact: true }).fill("Dakar");
  // Keep Senegal as the customer's country; this fictional WhatsApp number
  // deliberately overrides the suggested country code.
  await page.getByLabel("WhatsApp country code *", { exact: true }).fill("1");
  await page
    .getByLabel("WhatsApp phone number *", { exact: true })
    .fill("2025550123");
}
test("quantity starts blank, types cleanly, steps natively and excludes blank/zero reservations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Search products").fill("SMOKE-001");
  const quantity = page.getByLabel("Quantity to reserve");
  const summary = page.locator("#pre-booking");
  await expect(quantity).toHaveValue("");
  await expect(quantity).toHaveAttribute("inputmode", "numeric");
  await quantity.pressSequentially("2");
  await expect(quantity).toHaveValue("2");
  await expect(summary).toContainText("Test orthopaedic instrument × 2");
  await quantity.fill("002");
  await expect(quantity).toHaveValue("2");
  await quantity.press("ArrowUp");
  await expect(quantity).toHaveValue("3");
  await quantity.press("ArrowDown");
  await expect(quantity).toHaveValue("2");
  await quantity.press("-");
  await expect(quantity).toHaveValue("2");
  await expect(
    page.getByText("Please enter a whole number from 0 to 100."),
  ).toBeVisible();
  await quantity.fill("2");
  await quantity.press(".");
  await expect(quantity).toHaveValue("2");
  await quantity.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text", "invalid");
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(quantity).toHaveValue("2");
  await quantity.fill("0");
  await expect(quantity).toHaveValue("0");
  await expect(summary).not.toContainText("Test orthopaedic instrument ×");
  await quantity.fill("");
  await expect(quantity).toHaveValue("");
  await expect(summary).not.toContainText("Test orthopaedic instrument ×");
  await expect(
    page.getByText("Please select at least one product."),
  ).toBeVisible();
});
test("country dropdown defaults to Senegal and suggests codes again after a manual override", async ({
  page,
}) => {
  await page.goto("/");
  const country = page.getByLabel("Country *", { exact: true });
  const code = page.getByLabel("WhatsApp country code *", { exact: true });
  await expect(country).toHaveValue("Senegal");
  await expect(country.locator("option")).toHaveCount(251);
  await expect(code).toHaveValue("221");
  await expect(code.locator("..").locator("span")).toHaveText("+");
  expect(
    await code.evaluate((element) =>
      parseFloat(getComputedStyle(element).paddingLeft),
    ),
  ).toBeGreaterThanOrEqual(28);
  for (const [name, prefix] of [
    ["India", "91"],
    ["Côte d’Ivoire", "225"],
    ["Mali", "223"],
    ["Ghana", "233"],
    ["Cameroon", "237"],
    ["DR Congo", "243"],
    ["Benin", "229"],
    ["Mauritania", "222"],
    ["Guinea", "224"],
    ["Liberia", "231"],
    ["Senegal", "221"],
  ]) {
    await country.selectOption(name);
    await expect(code).toHaveValue(prefix);
  }
  await code.fill("91");
  await expect(country).toHaveValue("Senegal");
  await expect(code).toHaveValue("91");
  await country.selectOption("Ghana");
  await expect(code).toHaveValue("233");
  await country.selectOption("Antarctica");
  await expect(code).toHaveValue("");
  await expect(
    page.getByText(/This location has no single phone code/),
  ).toBeVisible();
  await country.selectOption("Senegal");
  await customer(page, "Dr UX Country");
  await chooseProduct(page);
  await expect(
    page.getByRole("button", { name: "Submit pre-booking" }),
  ).toBeEnabled();
});
test("idle disabled form has no loading indicator and invalid fields explain the correction", async ({
  page,
}) => {
  await page.goto("/");
  const submit = page.getByRole("button", { name: "Submit pre-booking" });
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("aria-busy", "false");
  await expect(
    page.getByRole("img", { name: "Submitting pre-booking" }),
  ).toHaveCount(0);
  expect(
    await submit.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("not-allowed");
  await page.getByLabel("Name *", { exact: true }).focus();
  await page.getByLabel("City *", { exact: true }).focus();
  await expect(
    page.getByText("Please enter your name (at least 2 characters)."),
  ).toBeVisible();
  await customer(page, "Dr UX Validation");
  await chooseProduct(page);
  await page.getByLabel("WhatsApp phone number *", { exact: true }).fill("123");
  await expect(
    page.getByText("Please enter a valid phone number.", { exact: true }),
  ).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(
    page.getByRole("img", { name: "Submitting pre-booking" }),
  ).toHaveCount(0);
  await page
    .getByLabel("WhatsApp phone number *", { exact: true })
    .fill("2025550123");
  await expect(submit).toBeEnabled();
  await expect(
    page.getByLabel("WhatsApp phone number *", { exact: true }),
  ).toHaveAttribute("aria-invalid", "false");
  await page.getByLabel("Email (optional)").fill("incorrect");
  await expect(
    page.getByText("Please enter a valid email address or leave it blank."),
  ).toBeVisible();
  await expect(submit).toBeDisabled();
  await page.getByLabel("Email (optional)").fill("");
  await expect(submit).toBeEnabled();
});
test("real submission alone shows spinner; repeated submits are blocked and server failure permits retry", async ({
  page,
}) => {
  await page.goto("/");
  await chooseProduct(page);
  await customer(page, "Dr UX Retry");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const keys: string[] = [];
  await page.route("**/api/bookings", async (route) => {
    keys.push(route.request().postDataJSON().requestKey);
    if (keys.length === 1) {
      await waiting;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Service temporarily unavailable. Please try again.",
        }),
      });
    } else await route.continue();
  });
  const submit = page.getByRole("button", { name: "Submit pre-booking" });
  try {
    await submit.click();
    await expect(
      page.getByRole("button", { name: "Submitting…" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("img", { name: "Submitting pre-booking" }),
    ).toBeVisible();
    await expect(page.locator("form[aria-busy=true]")).toHaveCount(1);
    await expect(page.getByLabel("Country *", { exact: true })).toBeDisabled();
    expect(
      await page
        .getByRole("button", { name: "Submitting…" })
        .evaluate((element) => getComputedStyle(element).cursor),
    ).toBe("wait");
    await page.locator("#pre-booking form").evaluate((form) => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(keys).toHaveLength(1);
  } finally {
    release();
  }
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Service temporarily unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Submitting pre-booking" }),
  ).toHaveCount(0);
  await expect(submit).toBeEnabled();
  await expect(page.getByLabel("Quantity to reserve")).toHaveValue("1");
  await submit.click();
  await expect(
    page.getByRole("heading", { name: "Pre-booking submitted successfully" }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await expect(
    page.getByRole("img", { name: "Submitting pre-booking" }),
  ).toHaveCount(0);
});
test("network failure removes loading, retains selection and allows retry", async ({
  page,
}) => {
  await page.goto("/");
  await chooseProduct(page);
  await customer(page, "Dr UX Network");
  await page.route("**/api/bookings", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Submit pre-booking" }).click();
  await expect(
    page.getByText(
      "We couldn’t connect. Please check your connection and try again.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Submitting pre-booking" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Submit pre-booking" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Quantity to reserve")).toHaveValue("1");
});
test("Price on Request-only pre-booking submits successfully with optional email empty", async ({
  page,
}) => {
  await page.goto("/");
  await chooseProduct(page, "AR-006");
  await customer(page, "Dr UX POR");
  await expect(page.locator("#pre-booking")).toContainText(
    "Priced subtotal: 0 CFA",
  );
  await expect(page.locator("#pre-booking")).toContainText(
    "Full total on request",
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/bookings") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Submit pre-booking" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  expect(await response.json()).toMatchObject({
    customerName: "Dr UX POR",
    selectedProductCount: 1,
    hasPriceOnRequest: true,
  });
  await expect(
    page.getByRole("heading", { name: "Pre-booking submitted successfully" }),
  ).toBeVisible();
  await expect(page.getByRole("status").locator("dd").nth(3)).toContainText(
    "Yes",
  );
});
test("server rejects invented countries and malformed international numbers with field feedback", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const productId = (await page.content()).match(
    /\\"id\\":\\"([^"\\]+)\\",\\"code\\":\\"SMOKE-001/,
  )?.[1];
  expect(productId).toBeTruthy();
  const payload = {
    requestKey: crypto.randomUUID(),
    doctorName: "Dr UX Validation",
    specialty: "Trauma Surgeon",
    hospital: "Smoke test clinic",
    city: "Dakar",
    country: "Senegal",
    phoneCountryCode: "+1",
    phoneNationalNumber: "2025550123",
    items: [{ productId, quantity: 1 }],
  };
  for (const [field, value] of [
    ["country", "Invented Country"],
    ["phoneNationalNumber", "123"],
  ]) {
    const response = await request.post("/api/bookings", {
      headers: { Origin: "http://localhost:3000" },
      data: { ...payload, [field]: value },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).fieldErrors[field].length).toBeGreaterThan(
      0,
    );
  }
});
