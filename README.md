
# damus api

[![ci](https://github.com/damus-io/api/actions/workflows/node.js.yml/badge.svg)](https://github.com/damus-io/api/actions)

The Damus API backend for Damus Purple and other functionality.


## `.env` file variable configuration

#### Essential

- `DB_PATH`: Path to the folder where to save mdb files.
- `DEEPL_KEY`: API key for DeepL translation service (Can be set to something bogus for local testing with mock translations)

#### Apple In-App Purchase (IAP)

- `ENABLE_IAP_PAYMENTS`: Set to `"true"` to enable Apple In-App Purchase payment endpoints.
- `MOCK_VERIFY_RECEIPT`: Set to `"true"` to mock the receipt verification process (for testing only)
- `IAP_ISSUER_ID`: Apple issuer ID for the IAP key (can be found in the [Apple Developer console](https://appstoreconnect.apple.com/access/api/subs))
- `IAP_KEY_ID`: Apple key ID for the IAP key generated (can be found in the [Apple Developer console](https://appstoreconnect.apple.com/access/api/subs), beside the key which was generated)
- `IAP_BUNDLE_ID`: The bundle ID of the app (Can be found in Xcode project settings) (e.g. `com.organization.app-name`)
- `IAP_PRIVATE_KEY_PATH`: Path to the private key file for the IAP key (e.g. `./SubscriptionKey_ABCDEF12345.p8`. Can be generated in the [Apple Developer console](https://appstoreconnect.apple.com/access/api/subs))
- `IAP_ENVIRONMENT`: Set to `"Sandbox"` for testing, or `"Production"` for production
- `IAP_ROOT_CA_DIR`: Path to a directory containing all of Apple's Root Certificates. Defaults to `./apple-root-ca`. You can download the certificates from [Apple's website](https://www.apple.com/certificateauthority/)

#### Lightning Network

- `LN_NODE_ADDRESS`: The public address of the Lightning Network node
- `LN_WS_PROXY`: The public address of the Lightning Network Websocket proxy
- `LN_NODE_ID`: The public node ID of the Lightning Network node in hex format
- `LN_RUNE`: The public node ID of the Lightning Network node
- `TEST_PRODUCTS`: Set to `"true"` to enable test products for Lightning Network payments with a value of 1 satoshi (for testing only)

#### Extras

- `CORS_ALLOWED_ORIGINS` (optional): Comma separated list of allowed origins for CORS. Generally only needed for testing or staging.
- `ALLOW_HTTP_AUTH`: Set to `"true"` to enable HTTP basic auth for all endpoints. (Useful for testing locally, otherwise it forces HTTPS)
- `ADMIN_PASSWORD`: Password for admin API endpoints (optional, leaving this blank will disable admin endpoints)

## npm scripts

- `npm run dev`: Start the server in development mode and mock the DeepL translation service
- `npm start`: Start the server in production mode
- `npm test`: Run the unit tests
- `npm run type-check`: Run a type check on all files in the project
- `npm run type-check-path -- <path>`: Run a type check on a specific file or directory
