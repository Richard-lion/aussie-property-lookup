// Shared helpers for allhomes scraping in Vercel Edge/Serverless

export const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const HTML_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

export function parsePrice(priceStr: string | null): number | null {
  if (!priceStr) return null;
  const s = priceStr.replace(/[$,]/g, '').trim().toLowerCase();
  if (s.endsWith('m')) {
    const n = parseFloat(s.slice(0, -1));
    return isNaN(n) ? null : Math.round(n * 1_000_000);
  }
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

export function slugFromAddress(address: string): string | null {
  const m = address.match(/(\w+)\s+(VIC|NSW|QLD|SA|WA|TAS|ACT)\s+(\d{4})/i);
  if (m) return `${m[1].toLowerCase()}-${m[2].toLowerCase()}-${m[3]}`;
  return null;
}