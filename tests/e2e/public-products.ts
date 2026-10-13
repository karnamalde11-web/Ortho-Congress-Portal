import type { Page } from "@playwright/test";
export type PublicProduct = {
  id: string;
  code: string;
  name: string;
  priceCfa: string | null;
  pricingVersion: string;
};
export async function publicProducts(page: Page): Promise<PublicProduct[]> {
  const html = await page.content();
  const chunks = [...html.matchAll(/self\.__next_f\.push\((.*?)\)<\/script>/g)]
    .map((match) => JSON.parse(match[1]))
    .filter((value) => value[0] === 1)
    .map((value) => value[1])
    .join("");
  const products = chunks.match(/"products":(\[\{.*?\}\])/);
  if (!products) throw new Error("Catalogue metadata missing");
  return JSON.parse(products[1]);
}
