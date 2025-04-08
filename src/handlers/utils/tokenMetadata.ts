import { createPublicClient, http, getContract, type PublicClient } from "viem";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { ADDRESS_ZERO } from "./constants";
import { CHAIN_CONFIGS } from "./chains";
import * as dotenv from "dotenv";

dotenv.config();

const ERC20_ABI = [
  {
    inputs: [],
    name: "name",
    outputs: [{ type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "NAME",
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "SYMBOL",
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
    type: "function",
  }
] as const;

// Create .cache directory if it doesn't exist
const CACHE_DIR = join(__dirname, "../../../.cache");
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

// Function to get cache path for a specific chain
const getCachePath = (chainId: number): string => {
  return join(CACHE_DIR, `tokenMetadata_${chainId}.json`);
};

interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: bigint;
}

const getRpcUrl = (chainId: number): string => {
  switch (chainId) {
    case 1:
      return process.env.MAINNET_RPC_URL || "https://eth.drpc.org";
    case 42161:
      return process.env.ARBITRUM_RPC_URL || "https://arbitrum.drpc.org";
    case 10:
      return process.env.OPTIMISM_RPC_URL || "https://optimism.drpc.org";
    case 8453:
      return process.env.BASE_RPC_URL || "https://base.drpc.org";
    case 137:
      return process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";
    case 43114:
      return process.env.AVALANCHE_RPC_URL || "https://avalanche.drpc.org";
    case 56:
      return process.env.BSC_RPC_URL || "https://bsc.drpc.org";
    case 81457:
      return process.env.BLAST_RPC_URL || "https://blast.drpc.org";
    case 7777777:
      return process.env.ZORA_RPC_URL || "https://zora.drpc.org";
    case 1868:
      return process.env.SONIEUM_RPC_URL || "https://sonieum.drpc.org";
    case 130:
      return process.env.UNICHAIN_RPC_URL || "https://unichain.drpc.org";
    case 57073:
      return process.env.INK_RPC_URL || "https://ink.drpc.org";
    case 1030:
      return process.env.CONFLUX_RPC_URL || "https://evm.confluxrpc.com";
    // Add generic fallback for any chain
    default:
      throw new Error(`No RPC URL configured for chainId ${chainId}`);
  }
};

// Cache of clients per chainId
const clients: Record<number, PublicClient> = {};

// Get client for a specific chain
const getClient = (chainId: number): PublicClient => {
  if (!clients[chainId]) {
    try {
      // Create a simpler client configuration
      clients[chainId] = createPublicClient({
        transport: http(getRpcUrl(chainId)),
      });
      console.log(`Created client for chain ${chainId}`);
    } catch (e) {
      console.error(`Error creating client for chain ${chainId}:`, e);
      throw e;
    }
  }
  return clients[chainId];
};

// Cache of metadata per chainId
const metadataCaches: Record<number, Record<string, TokenMetadata>> = {};

// Load cache for a specific chain
const loadCache = (chainId: number): Record<string, TokenMetadata> => {
  if (!metadataCaches[chainId]) {
    const cachePath = getCachePath(chainId);
    if (existsSync(cachePath)) {
      try {
        metadataCaches[chainId] = JSON.parse(readFileSync(cachePath, "utf8"));
      } catch (e) {
        console.error(
          `Error loading token metadata cache for chain ${chainId}:`,
          e
        );
        metadataCaches[chainId] = {};
      }
    } else {
      metadataCaches[chainId] = {};
    }
  }
  return metadataCaches[chainId];
};

// Save cache for a specific chain
const saveCache = (chainId: number): void => {
  const cachePath = getCachePath(chainId);
  try {
    writeFileSync(cachePath, JSON.stringify(metadataCaches[chainId], null, 2));
  } catch (e) {
    console.error(`Error saving token metadata cache for chain ${chainId}:`, e);
  }
};

// Add this function to sanitize strings by removing null bytes and other problematic characters
function sanitizeString(str: string): string {
  if (!str) return "";

  // Remove null bytes and other control characters that might cause issues with PostgreSQL
  return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}

export async function getTokenMetadata(
  address: string,
  chainId: number
): Promise<TokenMetadata> {
  // Load cache for this chain
  const metadataCache = loadCache(chainId);
  const chainConfig = CHAIN_CONFIGS[chainId];

  // Handle native token
  if (address === ADDRESS_ZERO) {
    return {
      name: chainConfig.nativeTokenDetails.name,
      symbol: chainConfig.nativeTokenDetails.symbol,
      decimals: chainConfig.nativeTokenDetails.decimals,
    };
  }

  address = address.toLowerCase();

  // Check for token overrides in chain config
  const tokenOverride = chainConfig.tokenOverrides.find(
    (t) => t.address.toLowerCase() === address
  );

  if (tokenOverride) {
    return {
      name: tokenOverride.name,
      symbol: tokenOverride.symbol,
      decimals: tokenOverride.decimals,
    };
  }

  // Check cache
  if (metadataCache[address]) {
    return metadataCache[address];
  }

  try {
    // Use the multicall implementation for efficiency
    const metadata = await fetchTokenMetadataMulticall(address, chainId);

    // Update cache
    metadataCache[address] = metadata;
    saveCache(chainId);

    return metadata;
  } catch (e) {
    console.error(
      `Error fetching metadata for ${address} on chain ${chainId}:`,
      e
    );
    throw e;
  }
}

// Update the fetchTokenMetadataMulticall function to sanitize name and symbol
async function fetchTokenMetadataMulticall(
  address: string,
  chainId: number
): Promise<TokenMetadata> {
  const contract = getContract({
    address: address as `0x${string}`,
    abi: ERC20_ABI,
    client: getClient(chainId),
  });

  // Prepare promises but don't await them yet
  const namePromise = contract.read.name().catch(() => null);
  const nameBytes32Promise = contract.read.NAME().catch(() => null);
  const symbolPromise = contract.read.symbol().catch(() => null);
  const symbolBytes32Promise = contract.read.SYMBOL().catch(() => null);
  const decimalsPromise = contract.read.decimals().catch(() => 18); // Default to 18

  // contract.read.

  // Execute all promises in a single multicall batch
  const [
    nameResult,
    nameBytes32Result,
    symbolResult,
    symbolBytes32Result,
    decimalsResult
  ] = await Promise.all([
    namePromise,
    nameBytes32Promise,
    symbolPromise,
    symbolBytes32Promise,
    decimalsPromise
  ]);

  // Process name with fallbacks
  let name = "unknown";
  if (nameResult !== null) {
    name = sanitizeString(nameResult);
  } else if (nameBytes32Result !== null) {
    name = sanitizeString(
      new TextDecoder().decode(
        new Uint8Array(
          Buffer.from(nameBytes32Result.slice(2), "hex").filter((n) => n !== 0)
        )
      )
    );
  }

  // Process symbol with fallbacks
  let symbol = "UNKNOWN";
  if (symbolResult !== null) {
    symbol = sanitizeString(symbolResult);
  } else if (symbolBytes32Result !== null) {
    symbol = sanitizeString(
      new TextDecoder().decode(
        new Uint8Array(
          Buffer.from(symbolBytes32Result.slice(2), "hex").filter(
            (n) => n !== 0
          )
        )
      )
    );
  }

  return {
    name: name || "unknown",
    symbol: symbol || "UNKNOWN",
    decimals: typeof decimalsResult === "number" ? BigInt(decimalsResult) : 18n
  };
}