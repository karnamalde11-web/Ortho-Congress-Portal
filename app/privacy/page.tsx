import { cookies, headers } from "next/headers";
import { OPT_OUT_COOKIE } from "@/lib/analytics-policy";
import AnalyticsPreference from "./analytics-preference";
export default async function Privacy() {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const enabled =
    jar.get(OPT_OUT_COOKIE)?.value !== "1" &&
    h.get("dnt") !== "1" &&
    h.get("sec-gpc") !== "1";
  return (
    <article className="card max-w-2xl">
      <h1>Pre-booking privacy notice</h1>
      <p className="my-4">
        NM Ortho collects your name, specialty, city, country, WhatsApp number
        including country code, optional email and remarks, hospital or clinic,
        and selected products to process your exhibition pre-booking and contact
        you about fulfilment. No online payment or card information is
        collected.
      </p>
      <p>
        Booking details are accessible to authorised administrators. To request
        correction or deletion, contact the exhibition team directly. Do not
        include patient information in remarks.
      </p>
      <h2 className="mt-6">First-party visitor analytics</h2>
      <p className="my-4">
        We use random first-party browser and session cookies to understand
        visits and the pre-booking funnel without requiring login. We record
        activity dates, selected country, broad screen/device category,
        product/category interactions and limited traffic-source tags. We do not
        record names, phone numbers, emails, typed form contents, IP addresses,
        full browser user-agent strings, referral paths or URL query strings in
        anonymous analytics. Cookies are not used to identify you personally.
      </p>
      <p className="my-4">
        A session continues through refreshes and ends after 30 minutes without
        activity. The random visitor cookie lasts up to 90 days; clearing
        cookies or switching browsers/devices changes the approximate visitor
        identity. Anonymous visit/event data is periodically removed after 90
        days. If you submit a pre-booking, that booking may be associated with
        the anonymous session internally; authorised administrators can then see
        your submitted booking details. Existing booking records are kept
        separately.
      </p>
      <p>
        Do Not Track and Global Privacy Control signals are respected. Only
        approved public UTM source, medium and campaign tags are retained;
        free-text parameters are discarded. Tracking can be turned off here
        without affecting catalogue access or pre-booking.
      </p>
      <AnalyticsPreference initialEnabled={enabled} />
    </article>
  );
}
