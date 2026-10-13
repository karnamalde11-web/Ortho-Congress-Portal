import english from "i18n-iso-countries/langs/en.json";
import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js/max";

// ISO 3166 country/territory names plus the dataset's Kosovo entry. Keep
// preferred display names deterministic across the browser and server.
const preferredNames: Record<string, string> = {
  CI: "Côte d’Ivoire",
  CD: "DR Congo",
  US: "United States",
};
const telephoneCountries = new Set<string>(getCountries());
export const countries = Object.entries(english.countries)
  .map(([code, names]) => ({
    code,
    name: preferredNames[code] ?? (Array.isArray(names) ? names[0] : names),
    callingCode: telephoneCountries.has(code)
      ? `+${getCountryCallingCode(code as CountryCode)}`
      : null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));
const byName = new Map(countries.map((country) => [country.name, country]));
export function countryFromName(name: string) {
  return byName.get(name);
}
