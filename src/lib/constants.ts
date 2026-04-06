// 🔑 Replace with your own Helius API key → https://helius.dev
const HELIUS_API_KEY = 'YOUR_HELIUS_API_KEY_HERE'

export const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
export const HELIUS_WS  = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`

export const TOKENS = {
  CRIME: 'cRiMEhAxoDhcEuh3Yf7Z2QkXUXUMKbakhcVqmDsqPXc',
  FRAUD: 'FraUdp6YhtVJYPxC2w255yAbpTsPqd8Bfhy9rC56jau5',
  PROFIT: 'pRoFiTj36haRD5sG2Neqib9KoSrtdYMGrM7SEkZetfR',
} as const

export const POOLS = {
  CRIME_SOL: {
    poolState: 'ZWUZ3PzGk6bg6g3BS3WdXKbdAecUgZxnruKXQkte7wf',
    solVault: '14rFLiXzXk7aXLnwAz2kwQUjG9vauS84AQLu6LH9idUM',
    tokenVault: '6s6cprCGxTAYCk9LiwCpCsdHzReW7CLZKqy3ZSCtmV1b',
    token: 'CRIME' as const,
  },
  FRAUD_SOL: {
    poolState: 'AngvViTVGd2zxP8KoFUjGU3TyrQjqeM1idRWiKM8p3mq',
    solVault: '3sUDyw1k61NSKgn2EA9CaS3FbSZAApGeCRNwNFQPwg8o',
    tokenVault: '2nzqXn6FivXjPSgrUGTA58eeVUDjGhvn4QLfhXK1jbjP',
    token: 'FRAUD' as const,
  },
} as const

// Token decimals
export const DECIMALS = {
  CRIME: 6,
  FRAUD: 6,
  PROFIT: 6,
  SOL: 9,
} as const

// All vault accounts we monitor for price changes
export const WATCHED_ACCOUNTS = [
  POOLS.CRIME_SOL.solVault,
  POOLS.CRIME_SOL.tokenVault,
  POOLS.FRAUD_SOL.solVault,
  POOLS.FRAUD_SOL.tokenVault,
]
