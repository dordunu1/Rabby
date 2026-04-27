import { useEffect, useState } from 'react';
import { useWallet } from '@/ui/utils';
import { useCurrentAccount } from '@/ui/hooks/backgroundState/useAccount';
import {
  ConfidentialTokenDefinition,
  getLogoLookupAddress,
} from '@/utils/zamaShield/registry';

// Module-level cache shared across renders / popup<->desktop. Keyed by the
// lowercase Mainnet address we look up — that means every confidential token
// for the same underlying public asset (cUSDC popup, cUSDC desktop, Sepolia
// cUSDC, etc.) shares one cache entry.
const logoCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

async function fetchFromOpenapi(
  wallet: ReturnType<typeof useWallet>,
  account: string,
  address: string
): Promise<string | null> {
  try {
    const t = await wallet.openapi.getToken(account, 'eth', address);
    if (t && typeof t.logo_url === 'string' && t.logo_url.length > 0) {
      return t.logo_url;
    }
  } catch {
    // Debank misses small / new tokens → fall through to CoinGecko.
  }
  return null;
}

async function fetchFromCoingecko(
  address: string,
  coingeckoId?: string
): Promise<string | null> {
  // Try contract-by-address first (returns "image.large").
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address.toLowerCase()}`
    );
    if (r.ok) {
      const data = await r.json();
      const url =
        data?.image?.large || data?.image?.small || data?.image?.thumb;
      if (typeof url === 'string' && url.length > 0) return url;
    }
  } catch {
    // ignore, try slug
  }
  // Fall back to the known slug (handles assets whose contract endpoint is
  // missing or has no image — ZAMA, BRON, tGBP, …).
  if (coingeckoId) {
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coingeckoId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`
      );
      if (r.ok) {
        const data = await r.json();
        const url =
          data?.image?.large || data?.image?.small || data?.image?.thumb;
        if (typeof url === 'string' && url.length > 0) return url;
      }
    } catch {
      // give up; UI shows letter chip
    }
  }
  return null;
}

async function loadLogo(
  wallet: ReturnType<typeof useWallet>,
  account: string,
  token: ConfidentialTokenDefinition
): Promise<string | null> {
  const address = getLogoLookupAddress(token).toLowerCase();
  const cacheKey = address;
  const cached = logoCache.get(cacheKey);
  if (cached) return cached;

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<string | null> => {
    const fromOpenapi = await fetchFromOpenapi(wallet, account, address);
    if (fromOpenapi) {
      logoCache.set(cacheKey, fromOpenapi);
      return fromOpenapi;
    }
    const fromCoingecko = await fetchFromCoingecko(address, token.coingeckoId);
    if (fromCoingecko) {
      logoCache.set(cacheKey, fromCoingecko);
      return fromCoingecko;
    }
    return null;
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
}

export function useTokenLogo(
  token: ConfidentialTokenDefinition
): string | null {
  const wallet = useWallet();
  const account = useCurrentAccount();
  const lookupAddress = getLogoLookupAddress(token).toLowerCase();
  const [logo, setLogo] = useState<string | null>(
    () => logoCache.get(lookupAddress) ?? null
  );

  useEffect(() => {
    if (logo) return;
    if (!account?.address) return;
    let cancelled = false;
    loadLogo(wallet, account.address, token)
      .then((url) => {
        if (!cancelled && url) setLogo(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [account?.address, lookupAddress, logo, wallet, token]);

  return logo;
}
