import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js/max";
const callingCodes = new Set(
  getCountries().map((c) => `+${getCountryCallingCode(c)}`),
);
export const countryCodeOptions = [...callingCodes].sort(
  (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
);
export function normalizeWhatsApp(countryCode: string, nationalInput: string) {
  if (!callingCodes.has(countryCode) || !/^[0-9 ()-]+$/.test(nationalInput))
    return null;
  const number = parsePhoneNumberFromString(
    `${countryCode}${nationalInput.replace(/[^0-9]/g, "")}`,
  );
  if (
    !number ||
    !number.isValid() ||
    `+${number.countryCallingCode}` !== countryCode
  )
    return null;
  return {
    phone: number.number,
    phoneCountryCode: countryCode,
    phoneNationalNumber: number.nationalNumber,
  };
}
