<p align="center">
  <a href="http://michiwallet.com" target="blank"><img src="https://michiwallet.com/assets/landing/phone.png" width="200" alt="Nest Logo" /></a>
</p>

  <p align="center">The First Trustless Points
Trading Protocol</p>

## Description

The API web service for [Michi Wallet](https://michiwallet.com).

## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development
$ yarn run start-api
$ yarn run start-processing

# watch mode
$ yarn run start-api:dev
$ yarn run start-processing:dev

# production mode
$ yarn run build-api
$ yarn run start-api:prod

$ yarn run build-processing
$ yarn run start-processing:prod
```

## Test

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Repository Info

This is a [monorepo](https://docs.nestjs.com/cli/monorepo) that contains both the **Michi API Service** and the **Michi Processing Service**. The API Service serves customer traffic for API requests. The Processing Service runs periodic cron jobs to calculate how many michi points users should get, sync the moralis webhook streams we use, and sync the approved token lists.

Each application/service is built and deployed via AWS Codepipeline. The codebuild in each pipeline finds the corresponding `buildspec.yml` for that app (e.g. at `apps/michi-api-service/buildspec.yml` for the API Service). This `buildspec.yml` specifies which artifacts to generate and creates the Procfile used by Elastic Beanstalk to run the app.

Note that both pipelines will run any applicable prisma migrations.

## Development

### How to Add a New Points Platform

TODO

### How to Add a New Evm Chain

TODO


### How to Add a New Approved Token

- No changes required. It is handled automatically by the Processing Service.

### How to test webhooks locally

1. Sign up for a free [ngrok](https://ngrok.com/) account and download it
2. Run `ngrok http 5001` (assuming you have the port set to 5001)
- You should see something like:
```
Forwarding                    https://c806-142-114-30-254.ngrok-free.app -> http://localhost:5001
```
3. Set the proxy url as the `WEBHOOK_BASE_URL` environment variable.
4. Update MoralisStreamSyncScheduler to run more often and run the app. You just need it to run once before you start. It will handle updating the moralis streams.
5. Run `yarn run start:debug`.
5. Trigger an event on the [Sepolia Michi Helper contract](https://sepolia.etherscan.io/address/0xdcad359050f9345228d871351d924df92846e51f#writeContract)

## API Docs

#### `GET /v1/nft/total`

Get owned Michi Wallet NFTs

E.g. `/v1/nft/total`

**Returns**:
```js
{
    totalWallets: 183,
    chainData: [
        {
            chain: "Eth",
            chainId: "0x1",
            totalWallets: 162
        },
        {
            chain: "Sepolia",
            chainId: "0xaa36a7",
            totalWallets: 21
        }
    ]
}
```

#### `GET /v1/nft/:owner`

Get owned Michi Wallet NFTs

E.g. `/v1/nft/0x1280D2Fa5Ad7782e8FA291D3765863844cd11157`

**Returns**:
```js
[
  {
      chainId: "0x1",
      walletAddress: "0x6ac0dac24f02bbd738f8617487d23cb9f3185584",
      nftIndex: "68",
      tokens: [
          {
              "chainId": "0x1",
              "tokenAddress": "0x1e3d13932c31d7355fcb3fec680b0cd159dc1a07",
              "name": "YT Ethena USDe 25JUL2024",
              "symbol": "YT-USDe-25JUL2024",
              "balance": "10000000000000000000",
              "decimals": 18,
              "eligibleForInterest": null
          },
          ...
      ],
      points: [
          {
              "platform": "Renzo",
              "points": "0"
          },
          ...
      ]
  }
  ...
]
```

#### `GET /v1/nft/lookup/:address`

Get the chain and NFT index for a given michi wallet address

E.g. `/v1/nft/lookup/0x6c7e8646d4e0707b864f9dfed45934d52dfde169`

**Returns**:
```js
{
  chainId: "0x1",
  chainName: "Eth"
  nftIndex: "5"
}
```

#### `GET /v1/points/:address`

Get third party point totals for a given Michi Wallet

E.g. `/v1/points/0x43582F0BACA52D6795106Cd9f8d0a506f62fBCBB`

**Returns**:
```js
[
  {
    platform: "KelpDAO",
    points: "18630.0119"
  },
  {
    platform: "Etherfi",
    points: "0"
  },
  {
    platform: "Renzo",
    points: "0"
  },
  {
    platform: "Bedrock",
    points: "0"
  },
  {
    platform: "Swell",
    points: "0"
  },
  {
    platform: "Ethena",
    points: "0"
  },
  {
    platform: "Eigenlayer",
    points: "0"
  },
  ... // any more onboarded points platforms
]
```

#### `GET /v1/points/total/`

Get the total third party points distributed

E.g. `/v1/points/total/`

**Returns**:
```js
[
    {
      platform: "Bedrock",
      points: "0"
    },
    {
        platform: "KelpDAO",
        points: "30064232"
    },
    {
        platform: "Renzo",
        points: "0"
    },
    {
        platform: "Ethena",
        points: "3104"
    },
    ...
]
```

#### `GET /v1/points/total/michi`

Get the total michi points distributed

E.g. `/v1/points/total/michi`

**Returns**:
```js
{
  pointsType: "Michi",
  totalPoints: "1802160780.77",
  chainData: [
    {
      chain: "Eth",
      chainId: "0x1",
      totalChainPoints: "776143180.77"
    },
    ...
  ]
}
```

#### `GET /v1/points/leaderboard/michi`

##### Parameters

| Name    | Type   | Description                            | Required | Default Value |
|---------|--------|----------------------------------------|----------|---------------|
| limit   | Query  | The number of entries to return.       | No       | 100           |
| offset  | Query  | The number of entries to skip.         | No       | 0             |

Get the top 100 on the leaderboard

E.g. Get the top 100 on the leaderboard: `/v1/points/leaderboard/michi`
E.g. Get the 51-60 on the leaderboard: `/v1/points/leaderboard/michi?limit=10&offset=50`

**Returns**:
```js
{
  users: [
    {
      position: 1,
      address: "0x1280d2fa5ad7782e8fa291d3765863844cd11157",
      totalPoints: "1027625024.12",
      chainData: [
        {
          chain: "Eth",
          chainId: "0x1",
          points: "1607424.12"
        },
        {
          chain: "Arbitrum",
          chainId: "0xa4b1",
          points: "1026017600"
        }
      ]
    },
    {
      position: 2,
      address: "0xfa4fc4ec2f81a4897743c5b4f45907c02ce06199",
      totalPoints: "258720876.46",
      chainData: [
        {
          chain: "Eth",
          chainId: "0x1",
          points: "258720876.46"
        }
      ]
    },
    ...
  ]
}
```

#### `GET /v1/points/:address/michi`

Get michi point totals across all chains for a given Michi Wallet

E.g. `/v1/points/0x43582F0BACA52D6795106Cd9f8d0a506f62fBCBB/michi`

**Returns**:
```js
{
  points: "1000",
  rank: 125
}

```

#### `GET /v1/tokens/:chain`

Get metadata for approved tokens on a given chain

E.g. `/v1/tokens/0xa4b1`

**Returns**:
```js
[
  {
    id: 1,
    chain_id: "0xa4b1",
    address: "0xf28db483773e3616da91fdfa7b5d4090ac40cc59",
    address_label: null,
    name: "YT weETH 25APR2024",
    symbol: "YT-weETH-25APR2024",
    decimals: 18,
    logo: null,
    logo_hash: null,
    thumbnail: null,
    block_number: 177960415,
    validated: 0,
    created_at: "2024-02-06T09:09:29.000Z",
    possible_spam: true,
    verified_contract: false
  },
  ...
]
```

#### `GET /v1/tokens/:chain/:address`

Get deposited tokens in a michi wallet on a given chain

E.g. `/v1/tokens/0xa4b1/0x43582F0BACA52D6795106Cd9f8d0a506f62fBCBB`

**Returns**:
```js
[
  {
    chainId: "0xa4b1",
    tokenAddress: "0xf28db483773e3616da91fdfa7b5d4090ac40cc59",
    name: "YT weETH 25APR2024",
    symbol: "YT-weETH-25APR2024",
    balance: "0",
    decimals: 18,
    eligibleForInterest: false
  },
  ...
]
```

#### `GET /v1/tokens/:chain/:address/transactions`

Get token transaction history in a michi wallet on a given chain

E.g. `/v1/tokens/0xa4b1/0x685f718694405012348D4fA9d47a52B600E37a59/transactions`

**Returns**:
```js
[
    {
        transactionType: "withdrawal",
        tokenAddress: "0xf28db483773e3616da91fdfa7b5d4090ac40cc59",
        name: "YT weETH 25APR2024",
        symbol: "YT-weETH-25APR2024",
        amount: "0.05",
        timestamp: "2024-05-06T21:57:37.000Z",
        link: "https://arbiscan.io/tx/0x6498867e3f8c218b1c825cf1eaab8a406186d1ed3682198405250203fe9dade2"
    },
    {
        transactionType: "deposit",
        tokenAddress: "0x28df0f193d8e45073bc1db6f2347812c031ba818",
        name: "YT rsETH 25APR2024",
        symbol: "YT-rsETH-25APR2024",
        amount: "0.129202519019635",
        timestamp: "2024-05-06T21:55:22.000Z",
        link: "https://arbiscan.io/tx/0x5ef75a872decd77f131279215773eea135fd473e04a364dc4f4d1642120941cd"
    },
  ...
]
```

#### `POST /v1/user`

Create a user with a referrer.

Creates a new user with the specified address. If an affiliate ID is provided and it matches an existing user, the referrer relationship is established.

**Request body**:
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "affiliateId": "affiliate-123"
}
```

**Returns**: `"User referred sucessfully"`

**Possible Errors**:

```json
{
    "statusCode": 400,
    "path": "/v1/user",
    "message": "AffiliateId does not exist."
}
```

```json
{
    "statusCode": 409,
    "path": "/v1/user",
    "message": "User already exists",
    "referredBy": "0x1234567890abcdef1234567890abcdef12345678" // or null
}
```

#### `GET /v1/user/:address/affiliate`

Get the affiliate stats for a user.

E.g. `/v1/user/0x1234567890abcdef1234567890abcdef12345678/affiliate`

**Returns**:

```json
{
    "referralPoints": "320",
    "numReferrals": 3,
    "topReferredUsers": [
        {
            "address": "0x0dbd063cdb47db998218a61c629f50b22638fe6e",
            "points": "2200"
        },
        {
            "address": "0x05fs063cdb47db998218a61c629f50b22638fddd",
            "points": "1000"
        },
        {
            "address": "0x06ad063cdb47db998218a61c629f50b22638fe6f",
            "points": "0"
        }
    ]
}
```

#### `GET /v1/user/:address/affiliate/link`

Get the affiliate link for a user.

E.g. `/v1/user/0x1234567890abcdef1234567890abcdef12345678/affiliate/link`

**Returns**:

```json
{
  "inviteLink": "https://app.michiwallet.com/invite/1280d-oEiu"
}
```

#### `GET /v1/user/:chain/:address/nonce`

Get the current marketplace nonce for a user on a chain. A new order should be created with nonce + 1

E.g. `/v1/user/0x1/0x1234567890abcdef1234567890abcdef12345678/nonce`

**Returns**:

```json
  3
```

#### `POST /v1/marketplace/order`

Create a marketplace order (bid or listing)

**Request body**:
```json
{
    "type": "LISTING" | "BID",
    "collection": "0x123...", // address of michi NFT collection
    "currency": "0x123...", // address of payment token (e.g. weth or usdc)
    "participant": "0x123...", // address of buyer/seller
    "chainId": "0x1",
    "tokenId": 1, // nft token id in the collection
    "amount": "1000000", // amount of specified currency for bid/listing. For this ex it is 1 USDC.
    "expiry": "2024-06-30T18:25:12.335Z", // iso timestamp of when the order will expire (accepts with or without milliseconds)
    "nonce": 1, // user nonce
    "signature": "...", // user pre-signed signature,
}
```

**Returns**:

```json
"Order created sucessfully"
```

**Error codes**:
- 400: invalid parameters passed
- 404: wallet does not exist
- 409: duplicate nonce
- 420: bid on wallet that you own
- 421: listing for wallet you do not own
- 422: wallet contains tokens
- 423: Existing bid of higher value on this wallet
- 424: Existing listing of lower value on this wallet
- 425: Existing listing with a different currency on this wallet

#### `POST /v1/marketplace/cancel`

Mark marketplace orders as `PROCESSING_CANCELLATION`

**Request body**:
```json
{
    "chainId": "0x1",
    "hash": "0x123...", // the hash of the confirmed tx
    "isCancelAll": false, // whether the tx is for cancelOrdersForCaller (false) or cancelAllOrdersForCaller (true)
}

**Returns**:

```json
"Successfully marked orders as pending cancellation"
```

#### `GET /v1/marketplace/orders`

Get marketplace orders (bids or listings)

**Query parameters**:
```json
{
      "type?": "LISTING" | "BID",
      "participant?": "0x123...", // address of buyer/seller
      "chainId?": "0x1",
      "tokenId?": 1, // nft token id in the collection
      "collection?": "0x123...", // address of michi NFT collection
      "nonce?": 1, // user nonce
      "ownerAddress?": "0x123...", // the address that owns the NFT
      "status?": "ACTIVE" | "CANCELLED" | "PROCESSING_CANCELLATION"
}
```

**Returns**:

```json
[
  {
    "type": "LISTING" | "BID",
    "collection": "0x123...", // address of michi NFT collection
    "currency": "0x123...", // address of payment token (e.g. weth or usdc)
    "participant": "0x123...", // address of buyer/seller
    "chainId": "0x1",
    "tokenId": 1, // nft token id in the collection
    "amount": "1000000", // amount of specified currency for bid/listing. For this ex it is 1 USDC.
    "expiry": "2024-06-30T18:25:12.335Z", // iso timestamp of when the order will expire (accepts with or without milliseconds)
    "nonce": 1, // user nonce
    "date": "2024-06-28T18:25:12.335Z", // creation date of order
    "signature": "...", // user pre-signed signature,
    "status": "ACTIVE",
    "wallet": {
        "wallet_address": "0x05457c8d6e7324706cfae29b84cd553970fc88db",
        "owner_address": "0x1280d2fa5ad7782e8fa291d3765863844cd11157"
    },
    "points": [
      {
        "platform": "Etherfi",
        "points": "100000"
      },
      ...
    ],
    "isStale": false // whether or not the order is "stale" - i.e. a lower LISTING or higher BID exists for the same wallet
  },
  ...
]
```

#### `GET /v1/marketplace/orders/:chain/:id`

Get marketplace orders (bids or listings)

E.g. to get orders on wallet #5 on eth: `/v1/marketplace/orders/0x1/5`

**Query parameters**:
```json
{
      "type": "LISTING" | "BID" // whether to fetch LISTINGS or bids on the wallet
}
```

**Returns**:

```json
[
  {
    "type": "LISTING" | "BID",
    "collection": "0x123...", // address of michi NFT collection
    "currency": "0x123...", // address of payment token (e.g. weth or usdc)
    "participant": "0x123...", // address of buyer/seller
    "chainId": "0x1",
    "tokenId": 1, // nft token id in the collection
    "amount": "1000000", // amount of specified currency for bid/listing. For this ex it is 1 USDC.
    "expiry": "2024-06-30T18:25:12.335Z", // iso timestamp of when the order will expire (accepts with or without milliseconds)
    "nonce": 1, // user nonce
    "date": "2024-06-28T18:25:12.335Z", // creation date of order
    "signature": "...", // user pre-signed signature,
    "status": "ACTIVE",
    "isStale": true // whether or not the order is "stale" - i.e. a lower LISTING or higher BID exists for the same wallet
  },
  ...
]
```

#### `GET /v1/marketplace/sales`

Get marketplace sales

**Query parameters**:
```json
{
    "buyer?": "0x123...",
    "seller?": "0x123...",
    "chainId?": "0x1",
    "tokenId?": 1, // nft token id in the collection
    "collection?": "0x123...", // address of michi NFT collection
    "points?": ["kelpdao, etherfi"], // list of point platforms present in the wallet sale
    "startDate?": 170000000, // unix timestamp of minimum search date range
    "startDate?": 170000000, // unix timestamp of maximum search date range
}
```

**Returns**:

```json
Array of orders. See `POST /v1/marketplace/order` for format of these objects
```

#### `GET /v1/tge/merkleroot`

Get tge merkle root

**Returns**:

```json
"0xc8469af5a4f5622b0bc81ab0bcd2128c796a9643455682fecec7b4a1512271cd"
```

#### `GET /v1/tge/claim/:address`

Get a claim amount and proof

E.g. `GET v1/tge/claim/0x1280D2Fa5Ad7782e8FA291D3765863844cd11157`

**Returns**:

```json
{
  "index": 3,
  "address": "0x1280D2Fa5Ad7782e8FA291D3765863844cd11157",
  "amount": 75,
  "proof": [
    "0x67f6975dd46590e82c1d6be13e30d2b7a6ac0840b82b5c59439f00c9558cfbee",
    "0x817ef4bab6d4debbed29f7f8123dfec2a526e40181d5a109becb261b4343faf0",
    "0x3f174c8881930866c45917c65fc0c3283bf7718aa0e1b549689872a9ec3c4fae"
  ],
  "points": [
    {
      "platform": "Ethena",
      "points": "2232047"
    },
    {
      "platform": "Etherfi",
      "points": "25"
    },
    {
      "platform": "Etherfi",
      "points": "3582025.98523"
    },
    {
      "platform": "Ethena",
      "points": "863300"
    },
    {
      "platform": "Ethena",
      "points": "20564"
    },
    {
      "platform": "Eigenlayer",
      "points": "2120.97226"
    }
  ],
  "walletsOwned": 3
}
```

#### `GET /v1/tokens/apy/:chain/:pid`

Fetches the Annual Percentage Yield (APY) for a specific pool on the given blockchain.

E.g. `/v1/tokens/apy/0xaa36a7/0`

**Returns**:

```json
  {
  "apy": "58.7809"
  }
```

#### `GET /v1/tokens/liquidity/:chain`

Fetches the total liquidity in USD for the specified blockchain's pool.

E.g. `/v1/tokens/liquidity/0xaa36a7`

**Returns**:

```json
  {
  "totalDepositedLP": "101000000000000000000000",
  "totalDepositedLiquidityUSD": "43050.79"
  }
```

#### `GET /v1/tokens/price/:symbol`

Fetches the price of a token in USD.

E.g. `/v1/tokens/price/PCH`

**Returns**:

```json
  0.006212889780426107
```

#### `GET /v1/tokens/rewards-per-year/:chain/:pid`

Returns the total number of reward tokens distributed annually for the specified pool on the blockchain.

E.g. `/v1/tokens/rewards-per-year/0xaa36a7/0`

**Returns**:

```json
  {
  "rewardsPerYear": "3942000000000000000000000"
  }
```

#### `GET /v1/tokens/share/:chain/:pid/:user`

Returns the user's percentage share of the total liquidity in the specified pool.

E.g. `/v1/tokens/share/0xaa36a7/0/0x1280D2Fa5Ad7782e8FA291D3765863844cd11157`

**Returns**:

```json
  {
  "userSharePercentage": "100.0000"
  }
```