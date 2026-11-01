// Location awareness for the briefing. Resolves whatever a person typed
// ("Dar es Salaam", "tz", "Nairobi, Kenya") to a country with the parameters
// Google News needs for LOCAL editions plus a coarse region group the source
// registry uses ("tanzania" → "east-africa" → "africa" → "global").

// code, name, aliases (lower-case; includes major cities), Google News locale,
// region group, default currency/market words for local financial queries.
const C = (code, name, aliases, hl, region, extra = {}) => ({ code, name, aliases, hl, region, ...extra })

export const COUNTRIES = [
  C('TZ', 'Tanzania', ['tanzania', 'tz', 'dar es salaam', 'dar', 'dodoma', 'arusha', 'mwanza', 'zanzibar', 'mbeya', 'moshi', 'morogoro', 'tanga', 'kilimanjaro'], 'en-TZ', 'east-africa', { lang: 'sw', market: 'DSE', currency: 'TZS', mkt: ['Dar es Salaam Stock Exchange', 'Bank of Tanzania', 'Tanzania treasury bonds', 'TZS'] }),
  C('KE', 'Kenya', ['kenya', 'ke', 'nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret'], 'en-KE', 'east-africa', { lang: 'sw', market: 'NSE', currency: 'KES', mkt: ['Nairobi Securities Exchange', 'Central Bank of Kenya', 'Kenya treasury bonds'] }),
  C('UG', 'Uganda', ['uganda', 'ug', 'kampala', 'entebbe', 'gulu'], 'en-UG', 'east-africa', { currency: 'UGX', mkt: ['Uganda Securities Exchange', 'Bank of Uganda'] }),
  C('RW', 'Rwanda', ['rwanda', 'rw', 'kigali'], 'en-RW', 'east-africa', { currency: 'RWF', mkt: ['Rwanda Stock Exchange', 'National Bank of Rwanda'] }),
  C('BI', 'Burundi', ['burundi', 'bujumbura'], 'en-US', 'east-africa'),
  C('ET', 'Ethiopia', ['ethiopia', 'addis ababa'], 'en-ET', 'east-africa'),
  C('NG', 'Nigeria', ['nigeria', 'ng', 'lagos', 'abuja', 'kano', 'port harcourt'], 'en-NG', 'west-africa', { currency: 'NGN', mkt: ['Nigerian Exchange', 'Central Bank of Nigeria'] }),
  C('GH', 'Ghana', ['ghana', 'gh', 'accra', 'kumasi'], 'en-GH', 'west-africa', { currency: 'GHS', mkt: ['Ghana Stock Exchange', 'Bank of Ghana'] }),
  C('SN', 'Senegal', ['senegal', 'dakar'], 'fr-SN', 'west-africa'),
  C('CI', 'Côte d’Ivoire', ['ivory coast', "cote d'ivoire", 'abidjan'], 'fr-CI', 'west-africa'),
  C('ZA', 'South Africa', ['south africa', 'za', 'johannesburg', 'cape town', 'durban', 'pretoria'], 'en-ZA', 'southern-africa', { currency: 'ZAR', mkt: ['JSE', 'South African Reserve Bank'] }),
  C('ZM', 'Zambia', ['zambia', 'lusaka'], 'en-ZM', 'southern-africa'),
  C('ZW', 'Zimbabwe', ['zimbabwe', 'harare'], 'en-ZW', 'southern-africa'),
  C('MW', 'Malawi', ['malawi', 'lilongwe'], 'en-MW', 'southern-africa'),
  C('MZ', 'Mozambique', ['mozambique', 'maputo'], 'en-US', 'southern-africa'),
  C('BW', 'Botswana', ['botswana', 'gaborone'], 'en-BW', 'southern-africa'),
  C('NA', 'Namibia', ['namibia', 'windhoek'], 'en-NA', 'southern-africa'),
  C('EG', 'Egypt', ['egypt', 'cairo'], 'en-EG', 'north-africa'),
  C('MA', 'Morocco', ['morocco', 'casablanca', 'rabat'], 'fr-MA', 'north-africa'),
  C('CD', 'DR Congo', ['drc', 'dr congo', 'congo', 'kinshasa', 'lubumbashi', 'goma'], 'fr-CD', 'central-africa'),
  C('CM', 'Cameroon', ['cameroon', 'douala', 'yaounde'], 'fr-CM', 'central-africa'),
  C('US', 'United States', ['united states', 'usa', 'us', 'america', 'new york', 'california', 'texas', 'washington'], 'en-US', 'global', { currency: 'USD', mkt: ['Wall Street', 'Federal Reserve'] }),
  C('GB', 'United Kingdom', ['united kingdom', 'uk', 'england', 'london', 'britain', 'manchester', 'scotland', 'wales'], 'en-GB', 'global', { currency: 'GBP', mkt: ['London Stock Exchange', 'Bank of England'] }),
  C('CA', 'Canada', ['canada', 'toronto', 'vancouver', 'montreal'], 'en-CA', 'global', { currency: 'CAD' }),
  C('AU', 'Australia', ['australia', 'sydney', 'melbourne', 'brisbane', 'perth'], 'en-AU', 'global', { currency: 'AUD' }),
  C('NZ', 'New Zealand', ['new zealand', 'auckland', 'wellington'], 'en-NZ', 'global'),
  C('IN', 'India', ['india', 'delhi', 'mumbai', 'bangalore', 'bengaluru', 'hyderabad', 'chennai'], 'en-IN', 'global', { currency: 'INR', mkt: ['BSE Sensex', 'Reserve Bank of India'] }),
  C('PK', 'Pakistan', ['pakistan', 'karachi', 'lahore', 'islamabad'], 'en-PK', 'global'),
  C('BD', 'Bangladesh', ['bangladesh', 'dhaka'], 'en-BD', 'global'),
  C('SG', 'Singapore', ['singapore'], 'en-SG', 'global', { currency: 'SGD' }),
  C('MY', 'Malaysia', ['malaysia', 'kuala lumpur'], 'en-MY', 'global'),
  C('PH', 'Philippines', ['philippines', 'manila'], 'en-PH', 'global'),
  C('ID', 'Indonesia', ['indonesia', 'jakarta'], 'en-ID', 'global'),
  C('AE', 'United Arab Emirates', ['uae', 'united arab emirates', 'dubai', 'abu dhabi'], 'en-AE', 'global', { currency: 'AED' }),
  C('SA', 'Saudi Arabia', ['saudi arabia', 'saudi', 'riyadh', 'jeddah'], 'en-SA', 'global'),
  C('DE', 'Germany', ['germany', 'berlin', 'munich', 'hamburg'], 'de-DE', 'global'),
  C('FR', 'France', ['france', 'paris'], 'fr-FR', 'global'),
  C('BR', 'Brazil', ['brazil', 'sao paulo', 'rio de janeiro'], 'pt-BR', 'global'),
]

const BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]))

/** Resolve free text ("Mwanza, Tanzania", "tz") to a country, or null. Never guesses. */
export function resolveCountry(text) {
  const t = String(text || '').toLowerCase().trim()
  if (!t) return null
  if (BY_CODE[t.toUpperCase()] && t.length === 2) return BY_CODE[t.toUpperCase()]
  const padded = ` ${t.replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ')} `
  let best = null
  for (const c of COUNTRIES) {
    for (const a of c.aliases) {
      if (a.length < 3 && a !== t) continue
      if (padded.includes(` ${a} `) && (!best || a.length > best.len)) best = { c, len: a.length }
    }
  }
  return best?.c ?? null
}

export const countryByCode = (code) => BY_CODE[String(code || '').toUpperCase()] ?? null

/** Google News RSS locale parameters for a country (global edition when unknown). */
export function newsLocale(country) {
  if (!country) return { hl: 'en-US', gl: 'US', ceid: 'US:en' }
  const [lang] = country.hl.split('-')
  return { hl: country.hl, gl: country.code, ceid: `${country.code}:${lang}` }
}

// Which registry regions count as "near" a given country, nearest first.
export function nearbyRegions(country) {
  if (!country) return ['global']
  const out = [country.code.toLowerCase(), country.region]
  if (/africa$/.test(country.region)) out.push('africa')
  out.push('global')
  return out
}
