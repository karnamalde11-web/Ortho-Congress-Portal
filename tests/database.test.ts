import { describe, it, expect } from "vitest";
import { Client } from "pg";
// Explicitly opt in with a disposable database; never point this at production.
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL migration constraints", () => {
  it("enforces valid quantities, nonnegative prices and booking idempotency", async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO "Product" (id,code,name,category,"priceCfa","updatedAt") VALUES ('test-product','TEST-CONSTRAINT','Test','Test',12500,NOW())`,
      );
      await client.query(
        `INSERT INTO "Booking" (id,"requestKey","doctorName",phone,hospital,"consentAt","totalCfa") VALUES ('test-booking','test-request','Doctor','1234567890','Clinic',NOW(),25000)`,
      );
      await client.query(
        `INSERT INTO "BookingItem" (id,"bookingId","productId",code,name,"unitPriceCfa",quantity) VALUES ('test-item','test-booking','test-product','TEST-CONSTRAINT','Test',12500,2)`,
      );
      await client.query(
        `UPDATE "Product" SET "priceCfa"=20000 WHERE id='test-product'`,
      );
      const historical = await client.query(
        `SELECT "unitPriceCfa" FROM "BookingItem" WHERE id='test-item'`,
      );
      expect(historical.rows[0].unitPriceCfa).toBe("12500.00");
      for (const sql of [
        `UPDATE "Product" SET "priceCfa"=-1 WHERE id='test-product'`,
        `UPDATE "BookingItem" SET quantity=0 WHERE id='test-item'`,
        `INSERT INTO "Booking" (id,"requestKey","doctorName",phone,hospital,"consentAt","totalCfa") VALUES ('duplicate','test-request','Doctor','1234567890','Clinic',NOW(),25000)`,
      ]) {
        await client.query("SAVEPOINT invalid");
        await expect(client.query(sql)).rejects.toThrow();
        await client.query("ROLLBACK TO SAVEPOINT invalid");
      }
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
});
