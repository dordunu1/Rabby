import { getAddress, zeroAddress } from 'viem';

/** EIP-55 checksum — required by viem / Zama SDK (avoids "Bad address checksum"). */
export function checksumAddress(address: string): `0x${string}` {
  if (!address || address.toLowerCase() === zeroAddress) {
    return zeroAddress;
  }
  return getAddress(address) as `0x${string}`;
}
