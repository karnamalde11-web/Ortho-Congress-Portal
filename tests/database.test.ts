import { describe, it, expect } from "vitest";
import { Client } from "pg";
import { readFile } from "node:fs/promises";
// Explicitly opt in with a disposable database; never point this at production.
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL migration constraints", () => {
  it("preserves every legacy booking value, item and product through both additive migrations", async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query("CREATE SCHEMA migration_preservation_test");
      await client.query(
        "SET LOCAL search_path TO migration_preservation_test",
      );
      for (const name of [
        "20261012120000_initial",
        "20261012123000_cfa_catalogue",
      ])
        await client.query(
          await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"),
        );
      await client.query(
        `INSERT INTO "Product" (id,code,name,category,"priceCfa","updatedAt") VALUES ('legacy-product','LEGACY','Legacy product','Trauma',8000,NOW())`,
      );
      await client.query(
        `INSERT INTO "Booking" (id,"requestKey","doctorName",phone,email,hospital,notes,"consentAt","totalCfa","pricedSubtotalCfa",status) VALUES ('legacy-booking','legacy-request','Original Doctor','9876543210','doctor@example.invalid','Original Clinic','Preserve these remarks',NOW(),NULL,16000,'CONTACTED')`,
      );
      await client.query(
        `INSERT INTO "BookingItem" (id,"bookingId","productId",code,name,"unitPriceCfa",quantity,category) VALUES ('legacy-item','legacy-booking','legacy-product','LEGACY','Legacy product',8000,2,'Trauma')`,
      );
      const beforeBooking = (await client.query('SELECT * FROM "Booking"'))
        .rows[0];
      const beforeItem = (await client.query('SELECT * FROM "BookingItem"'))
        .rows[0];
      const migration = await readFile(
        "prisma/migrations/20261013090000_customer_details/migration.sql",
        "utf8",
      );
      await client.query(migration.replace(/^BEGIN;|^COMMIT;/gm, ""));
      const after = (await client.query('SELECT * FROM "Booking"')).rows[0];
      expect(after).toMatchObject(beforeBooking);
      for (const name of [
        "city",
        "country",
        "specialty",
        "specialtyOther",
        "phoneCountryCode",
        "phoneNationalNumber",
      ])
        expect(after[name]).toBeNull();
      expect(
        (await client.query('SELECT * FROM "BookingItem"')).rows[0],
      ).toEqual(beforeItem);
      await client.query(
        `UPDATE "Booking" SET country='India' WHERE id='legacy-booking'`,
      );
      const beforeCurrency = (await client.query('SELECT * FROM "Booking"'))
        .rows[0];
      const beforeProduct = (await client.query('SELECT * FROM "Product"'))
        .rows[0];
      const currencyMigration = await readFile(
        "prisma/migrations/20261013140000_display_price_snapshots/migration.sql",
        "utf8",
      );
      await client.query(currencyMigration.replace(/^BEGIN;|^COMMIT;/gm, ""));
      const finalBooking = (await client.query('SELECT * FROM "Booking"'))
        .rows[0];
      expect(finalBooking).toMatchObject(beforeCurrency);
      expect(finalBooking.currency).toBe("CFA");
      expect(finalBooking.country).toBe("India");
      expect(finalBooking.pricedSubtotalDisplay).toBeNull();
      expect(finalBooking.totalDisplay).toBeNull();
      const finalItem = (await client.query('SELECT * FROM "BookingItem"'))
        .rows[0];
      expect(finalItem).toMatchObject(beforeItem);
      expect(finalItem.unitPriceDisplay).toBeNull();
      expect(finalItem.lineSubtotalDisplay).toBeNull();
      expect((await client.query('SELECT * FROM "Product"')).rows[0]).toEqual(
        beforeProduct,
      );
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
  it("retains saved USD and CFA item prices after the catalogue price changes", async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO "Product" (id,code,name,category,"priceCfa","updatedAt") VALUES ('snapshot-product','SNAPSHOT','Test','Test',8000,NOW())`,
      );
      await client.query(
        `INSERT INTO "Booking" (id,"requestKey","doctorName",phone,hospital,"consentAt",country,currency,"totalCfa","pricedSubtotalCfa","pricedSubtotalDisplay","totalDisplay") VALUES ('snapshot-booking','snapshot-request','Doctor','1234567890','Clinic',NOW(),'India','USD',24000,24000,39,39)`,
      );
      await client.query(
        `INSERT INTO "BookingItem" (id,"bookingId","productId",code,name,"unitPriceCfa",quantity,"unitPriceDisplay","lineSubtotalDisplay") VALUES ('snapshot-item','snapshot-booking','snapshot-product','SNAPSHOT','Test',8000,3,13,39)`,
      );
      await client.query(
        `UPDATE "Product" SET "priceCfa"=9000 WHERE id='snapshot-product'`,
      );
      const item = (
        await client.query(
          `SELECT "unitPriceCfa","unitPriceDisplay","lineSubtotalDisplay",quantity FROM "BookingItem" WHERE id='snapshot-item'`,
        )
      ).rows[0];
      expect(item).toEqual({
        unitPriceCfa: "8000.00",
        unitPriceDisplay: "13.00",
        lineSubtotalDisplay: "39.00",
        quantity: 3,
      });
      const booking = (
        await client.query(
          `SELECT country,currency,"totalCfa","pricedSubtotalCfa","pricedSubtotalDisplay","totalDisplay" FROM "Booking" WHERE id='snapshot-booking'`,
        )
      ).rows[0];
      expect(booking).toEqual({
        country: "India",
        currency: "USD",
        totalCfa: "24000.00",
        pricedSubtotalCfa: "24000.00",
        pricedSubtotalDisplay: "39.00",
        totalDisplay: "39.00",
      });
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
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
        `UPDATE "BookingItem" SET "unitPriceDisplay"=-1 WHERE id='test-item'`,
        `UPDATE "Booking" SET "pricedSubtotalDisplay"=-1 WHERE id='test-booking'`,
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
