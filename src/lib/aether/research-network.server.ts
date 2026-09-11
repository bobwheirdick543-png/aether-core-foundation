import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ResolvedPublicTarget = { hostname: string; addresses: string[] };

function ipv4Private(value: string): boolean {
  const octets = value.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

function ipv6Private(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff");
}

function isPublicAddress(address: string): boolean {
  return isIP(address) === 4 ? !ipv4Private(address) : isIP(address) === 6 ? !ipv6Private(address) : false;
}

/** Resolve a host and require every returned address to be publicly routable. */
export async function assertPublicDnsTarget(url: string): Promise<ResolvedPublicTarget> {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Only HTTP(S) targets are allowed");
  const hostname = parsed.hostname.replace(/[\[\]]/g, "").toLowerCase();
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error("Target resolves to a non-public IP address");
    return { hostname, addresses: [hostname] };
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  const addresses = records.map((record) => record.address);
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) throw new Error("Target DNS resolution includes a non-public address");
  return { hostname, addresses };
}
