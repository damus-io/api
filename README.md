
# damus api

[![ci](https://github.com/damus-io/api/actions/workflows/node.js.yml/badge.svg)](https://github.com/damus-io/api/actions)

The Damus API backend for Damus Purple and other functionality.


## `.env` file variable configuration

#### Essential

- `DB_PATH`: Path to the folder where to save mdb files.
- `TESTFLIGHT_URL`: URL for the TestFlight app (optional)
- `NOTEDECK_INSTALL_MD`: URL for the notedeck installation instructions markdown
- `NO_AUTH_WALL_NOTEDECK_INSTALL`: Disables the authentication wall for the notedeck installation instructions when set to `"true"`.

#### Translations

- `TRANSLATION_PROVIDER`: The translation provider to use, can be: `mock`, `deepl`, `noswhere`
- `DEEPL_KEY`: The DeepL key to use for DeepL translations if enabled.
- `NOSWHERE_KEY`: The Noswhere key to use for Noswhere translations if enabled.

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


#### OTP login

- `OTP_MAX_TRIES`: The maximum number of OTP tries allowed before locking the user out. Defaults to 10.
- `SESSION_EXPIRY`: The time in seconds before a session expires. Defaults to 1 week.
- `OTP_EXPIRY`: The time in seconds before an OTP expires. Defaults to 5 minutes.

#### Extras

- `CORS_ALLOWED_ORIGINS` (optional): Comma separated list of allowed origins for CORS. Generally only needed for testing or staging.
- `ALLOW_HTTP_AUTH`: Set to `"true"` to enable HTTP basic auth for all endpoints. (Useful for testing locally, otherwise it forces HTTPS)
- `ADMIN_PASSWORD`: Password for admin API endpoints (optional, leaving this blank will disable admin endpoints)
- `LN_INVOICE_CHECK_TIMEOUT_MS`: Timeout in milliseconds for checking the status of a Lightning Network invoice. Defaults to 60000 (60 seconds), and shorter for tests
- `ENABLE_DEBUG_ENDPOINTS`: Set to `"true"` to enable debug endpoints (for testing or staging only). This includes endpoints to delete users or force UUIDs.

## npm scripts

- `npm run dev`: Start the server in development mode and mock the DeepL translation service
- `npm start`: Start the server in production mode
- `npm test`: Run the unit tests
- `npm run type-check`: Run a type check on all files in the project
- `npm run type-check-path -- <path>`: Run a type check on a specific file or directory

## Testing and debugging tips

### IAP (Apple In-app Purchase) receipt verification

- Run the server with `DEBUG=iap` to see verbose debug logs for the IAP receipt verification process. You can also use those logs to find which UUID an IAP is associated with.
- If you need to force a specific UUID for a user (e.g. when you reset the db but can't reset your Sandbox IAP history), you can enable the `ENABLE_DEBUG_ENDPOINTS` environment variable and use this debug endpoint to force a UUID for a user:
  ```
```bash
curl -X PUT http://<HOST_AND_PORT>/admin/users/<PUBKEY_HEX_FORMAT>/account-uuid \
     -H "Content-Type: application/json" \
     -d '{"admin_password": "<ADMIN_PASSWORD_SET_ON_THE_RESPECTIVE_ENV_VARIABLE>", "account_uuid": "<UUID_FOUND_ON_IAP_TRANSACTION>"}'
```

### Failures around Lightning Network payments

Ensure you are running Node.js v18.x. Preferably, use the provided nix-shell environment to ensure you are using the correct version of Node.js.

There is a known issue with Node.js v22.x where the `ln.connect_and_init` call does not work with the way things are setup.
