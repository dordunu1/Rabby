import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from './constants';
import { checksumAddress } from './checksumAddress';

// Confidential wrapper metadata — addresses match
// metamask-extension/shared/lib/confidential-erc7984/registry.ts
// (same canonical list the user already ships in MetaMask).
export type ConfidentialTokenDefinition = {
  id: string;
  symbol: string;
  decimals: number;
  address: `0x${string}`;
  underlyingAddress: `0x${string}`;
  // Canonical Mainnet address of the same underlying asset, used purely for
  // logo lookups. For Mainnet entries this is unset and `underlyingAddress`
  // is used directly. For testnet entries (e.g. Sepolia cUSDC) this points
  // at the Mainnet USDC contract so Debank / CoinGecko return a real logo
  // even though the on-chain testnet address has no published asset.
  mainnetUnderlyingAddress?: `0x${string}`;
  // Stable CoinGecko coin id (slug). Used only when the Mainnet contract
  // lookup misses on Debank — e.g. for less-indexed assets like ZAMA, BRON,
  // tGBP that are present on CoinGecko but might not show up via the
  // contract-by-address endpoint reliably.
  coingeckoId?: string;
};

const MAINNET_USDC_ADDRESS: `0x${string}` =
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

const MAINNET_TOKENS: ConfidentialTokenDefinition[] = [
  {
    id: 'usdc',
    symbol: 'cUSDC',
    decimals: 6,
    address: '0xe978f22157048e5db8e5d07971376e86671672b2',
    underlyingAddress: MAINNET_USDC_ADDRESS,
    coingeckoId: 'usd-coin',
  },
  {
    id: 'usdt',
    symbol: 'cUSDT',
    decimals: 6,
    address: '0xae0207c757aa2b4019ad96edd0092ddc63ef0c50',
    underlyingAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    coingeckoId: 'tether',
  },
  {
    id: 'zama',
    symbol: 'cZAMA',
    decimals: 18,
    address: '0x80cb147fd86dc6dee3eee7e4cee33d1397d98071',
    underlyingAddress: '0xa12cc123ba206d4031d1c7f6223d1c2ec249f4f3',
    coingeckoId: 'zama',
  },
  {
    id: 'weth',
    symbol: 'cWETH',
    decimals: 18,
    address: '0xda9396b82634ea99243ce51258b6a5ae512d4893',
    underlyingAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    coingeckoId: 'weth',
  },
  {
    id: 'bron',
    symbol: 'cBRON',
    decimals: 18,
    address: '0x85de671c3bec1aded752c3cea943521181c826bc',
    underlyingAddress: '0xba2c598e11ed093079cc324fca5bbba99f616e83',
    coingeckoId: 'bronpepe',
  },
  {
    id: 'tgbp',
    symbol: 'ctGBP',
    decimals: 18,
    address: '0xa873750ccbafd5ec7dd13bfd5237d7129832edd9',
    underlyingAddress: '0x27f6c8289550fce67f6b50bed1f519966afe5287',
    coingeckoId: 'truegbp',
  },
  {
    id: 'xaut',
    symbol: 'cXAUt',
    decimals: 6,
    address: '0x73cc9af9d6befdb3c3faf8a5e8c05cb95fdaeef1',
    underlyingAddress: '0x68749665ff8d2d112fa859aa293f07a622782f38',
    coingeckoId: 'tether-gold',
  },
];

/** Sepolia USDT + cUSDT — same defaults as Confidential-safe `contracts.ts`. */
const SEPOLIA_DEFAULT_USDT = '0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0';
const SEPOLIA_DEFAULT_CONF_USDT = '0x4E7B06D78965594eB5EF5414c357ca21E1554491';

const SEPOLIA_TOKENS: ConfidentialTokenDefinition[] = [
  {
    id: 'usdc',
    symbol: 'cUSDC',
    decimals: 6,
    address: '0x6981762339f1064f660ee5a7b15a54382ed43e5a',
    underlyingAddress: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
    mainnetUnderlyingAddress: MAINNET_USDC_ADDRESS,
    coingeckoId: 'usd-coin',
  },
  {
    id: 'usdt',
    symbol: 'cUSDT',
    decimals: 6,
    address: SEPOLIA_DEFAULT_CONF_USDT,
    underlyingAddress: SEPOLIA_DEFAULT_USDT,
    mainnetUnderlyingAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    coingeckoId: 'tether',
  },
];

export const CONFIDENTIAL_TOKENS_BY_CHAIN: Record<
  number,
  ConfidentialTokenDefinition[]
> = {
  [MAINNET_CHAIN_ID]: MAINNET_TOKENS,
  [SEPOLIA_CHAIN_ID]: SEPOLIA_TOKENS,
};

function normalizeToken(
  token: ConfidentialTokenDefinition
): ConfidentialTokenDefinition {
  return {
    ...token,
    address: checksumAddress(token.address),
    underlyingAddress: checksumAddress(token.underlyingAddress),
    mainnetUnderlyingAddress: token.mainnetUnderlyingAddress
      ? checksumAddress(token.mainnetUnderlyingAddress)
      : undefined,
  };
}

export function getConfidentialTokensForChain(
  chainId: number
): ConfidentialTokenDefinition[] {
  return (CONFIDENTIAL_TOKENS_BY_CHAIN[chainId] ?? []).map(normalizeToken);
}

export function findConfidentialTokenByWrapperAddress(
  chainId: number,
  contractAddress: string
): ConfidentialTokenDefinition | null {
  const a = contractAddress.toLowerCase();
  for (const t of getConfidentialTokensForChain(chainId)) {
    if (t.address.toLowerCase() === a) {
      return t;
    }
  }
  return null;
}

export function getUnderlyingPublicSymbol(
  token: ConfidentialTokenDefinition
): string {
  if (token.symbol.length > 1 && token.symbol.startsWith('c')) {
    return token.symbol.slice(1);
  }
  return token.symbol;
}

// Address used to fetch the logo from Debank / CoinGecko. We always look up
// the Mainnet equivalent so testnet variants still get the real asset logo.
export function getLogoLookupAddress(
  token: ConfidentialTokenDefinition
): `0x${string}` {
  return token.mainnetUnderlyingAddress ?? token.underlyingAddress;
}

// Mainnet 18-decimal confidential tokens are encoded with 6-decimal fixed
// point on the relayer side (matches zWallet / zpayy / MetaMask): an FHE
// `euint64` only fits ~1.84e19, so 18-decimal scaling would clip values
// above ~18.4 tokens. Sepolia / non-mainnet keep the natural decimals
// because their fixtures are 6-decimal already.
export function relayerEncryptDecimalsForToken(
  tokenDecimals: number,
  chainId: number
): number {
  if (chainId === MAINNET_CHAIN_ID && tokenDecimals === 18) {
    return 6;
  }
  return tokenDecimals;
}
