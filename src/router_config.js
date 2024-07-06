const { json_response, simple_response, error_response, invalid_request, unauthorized_response } = require('./server_helpers')
const { create_account, get_account_info_payload, check_account, get_account, put_account, get_account_and_user_id, get_user_uuid, delete_account, add_successful_transactions_to_account } = require('./user_management')
const handle_translate = require('./translate')
const { verify_receipt, verify_transaction_id } = require('./app_store_receipt_verifier');
const bodyParser = require('body-parser')
const cors = require('cors');
const { required_nip98_auth, capture_raw_body, optional_nip98_auth } = require('./nip98_auth')
const { nip19 } = require('nostr-tools')
const { PURPLE_ONE_MONTH } = require('./invoicing')
const error = require("debug")("api:error")
const { update_iap_history_with_apple_if_needed_and_return_updated_user } = require('./iap_refresh_management')

function config_router(app) {
  const router = app.router

  router.use(bodyParser.json({ verify: capture_raw_body, type: 'application/json' }))
  router.use(bodyParser.raw({ verify: capture_raw_body, type: 'application/octet-stream' }))
  router.use(cors({ origin: get_allowed_cors_origins() }))

  router.use((req, res, next) => {
    res.on('finish', () => {
      console.log(`[ ${req.method} ] ${req.url}: ${res.statusCode}`)
    });
    next()
  })

  // MARK: Translation routes

  router.get('/translate', required_nip98_auth, async (req, res) => {
    const check_account_result = check_account(app, req.authorized_pubkey)
    if (!check_account_result.ok) {
      unauthorized_response(res, check_account_result.message)
      return
    }
    handle_translate(app, req, res)
  })

  // MARK: Account management routes

  router.get('/accounts/:pubkey', async (req, res) => {
    const id = req.params.pubkey
    if (!id) {
      error_response(res, 'Could not parse account id')
      return
    }
    let { account, user_id, request_error } = await update_iap_history_with_apple_if_needed_and_return_updated_user(app, id)

    if (request_error) {
      // Log the error, but continue with the request
      error("Error when updating IAP history: %s", request_error)
    }

    if (!account) {
      simple_response(res, 404)
      return
    }

    let account_info = get_account_info_payload(user_id, account)

    json_response(res, account_info)
  })
  
  // This route is used to get or generate an account UUID to associate with an Apple In-App Purchase (or with other systems that need UUIDs)
  // It returns the UUID associated with the pubkey, or a new UUID if one is not yet associated
  router.get('/accounts/:pubkey/account-uuid', required_nip98_auth, async (req, res) => {
    const pubkey = req.params.pubkey
    if (!pubkey) {
      error_response(res, 'Could not parse account pubkey')
      return
    }
    if (pubkey != req.authorized_pubkey) {
      unauthorized_response(res, 'You are not authorized to access this account')
      return
    }
    json_response(res, { account_uuid: get_user_uuid(app, pubkey) })
    return
  })

  if (process.env.ENABLE_IAP_PAYMENTS) {
    // This route is used to verify an app store receipt and create (or extend the expiry date of) an account
    // This is used for Apple in-app purchases
    // 
    // Payload should be a JSON object in the following format:
    // {
    //    "receipt": <BASE64_ENCODED_RECEIPT>
    //    "account_uuid": <UUID_OF_ACCOUNT>
    // }
    // 
    // Make sure to set the Content-Type header to application/json
    router.post('/accounts/:pubkey/apple-iap/app-store-receipt', required_nip98_auth, async (req, res) => {
      const pubkey = req.params.pubkey
      if (!pubkey) {
        invalid_request(res, 'Could not parse account pubkey')
        return
      }
      
      if (pubkey != req.authorized_pubkey) {
        unauthorized_response(res, 'You are not authorized to access this account')
        return
      }
      
      const receipt_base64 = req.body.receipt
      if (!receipt_base64) {
        invalid_request(res, 'Missing receipt')
        return
      }
      
      const alleged_account_uuid = req.body.account_uuid
      if (!alleged_account_uuid) {
        invalid_request(res, 'Missing account_uuid')
        return
      }
      
      const account_uuid = get_user_uuid(app, pubkey)
      if (account_uuid.toUpperCase() != alleged_account_uuid.toUpperCase()) {
        unauthorized_response(res, 'The account UUID is not valid for this account. Expected: "' + account_uuid + '", got: "' + alleged_account_uuid + '"')
        return
      }

      let verified_transaction_history = await verify_receipt(receipt_base64, account_uuid)
      if (!verified_transaction_history) {
        unauthorized_response(res, 'Receipt invalid')
        return
      }

      const { account: new_account, request_error } = add_successful_transactions_to_account(app, req.authorized_pubkey, verified_transaction_history)
      if (request_error) {
        error_response(res, request_error)
        return
      }
      
      let { account, user_id } = get_account_and_user_id(app, req.authorized_pubkey)
      json_response(res, get_account_info_payload(user_id, account))
      return
    })


    // This route is used to verify a transaction id and create (or extend the expiry date of) an account
    // This is used for Apple in-app purchases
    //
    // Payload should be a JSON object in the following format:
    // {
    //    "transaction_id": <TRANSACTION_ID_AS_UINT64>
    //    "account_uuid": <UUID_OF_ACCOUNT>
    // }
    //
    // Make sure to set the Content-Type header to application/json
    router.post('/accounts/:pubkey/apple-iap/transaction-id', required_nip98_auth, async (req, res) => {
      const pubkey = req.params.pubkey
      if (!pubkey) {
        invalid_request(res, 'Could not parse account pubkey')
        return
      }

      if (pubkey != req.authorized_pubkey) {
        unauthorized_response(res, 'You are not authorized to access this account')
        return
      }

      const transaction_id = req.body.transaction_id
      if (!transaction_id) {
        invalid_request(res, 'Missing transaction_id')
        return
      }

      const alleged_account_uuid = req.body.account_uuid
      if (!alleged_account_uuid) {
        invalid_request(res, 'Missing account_uuid')
        return
      }

      const account_uuid = get_user_uuid(app, pubkey)
      if (account_uuid.toUpperCase() != alleged_account_uuid.toUpperCase()) {
        unauthorized_response(res, 'The account UUID is not valid for this account. Expected: "' + account_uuid + '", got: "' + alleged_account_uuid + '"')
        return
      }

      let verified_transaction_history = await verify_transaction_id(transaction_id, account_uuid)
      if (!verified_transaction_history) {
        unauthorized_response(res, 'Transaction ID invalid')
        return
      }

      const { account: new_account, request_error } = add_successful_transactions_to_account(app, req.authorized_pubkey, verified_transaction_history)
      if (request_error) {
        error_response(res, request_error)
        return
      }

      let { account, user_id } = get_account_and_user_id(app, req.authorized_pubkey)
      json_response(res, get_account_info_payload(user_id, account))
      return
    })
  }

  // MARK: Product and checkout routes

  // Allows the website to get a list of options for the product
  router.get('/products', (req, res) => {
    json_response(res, app.invoice_manager.invoice_templates)
  })

  // Initiates a new checkout for a specific product
  router.post('/ln-checkout', async (req, res) => {
    const body = req.body
    const product_template_name = body.product_template_name
    if (!product_template_name) {
      invalid_request(res, 'Missing product_template_name')
      return
    }
    if (!app.invoice_manager.invoice_templates[product_template_name]) {
      invalid_request(res, 'Invalid product_template_name. Valid names are: ' + Object.keys(app.invoice_manager.invoice_templates).join(', '))
      return
    }
    const checkout_object = await app.invoice_manager.new_checkout(product_template_name)
    json_response(res, checkout_object)
  })

  // Used to check the status of a checkout operation
  // Note, this will not return the payment status of the invoice, only connection parameters from which the client can use to connect to the LN node
  //
  // Returns:
  // {
  //    id: <UUID>
  //    product_template_name: <PRODUCT_TEMPLATE_NAME>
  //    verified_pubkey: <HEX_ENCODED_PUBKEY> | null
  //    invoice: {
  //      bolt11: <BOLT11_INVOICE>
  //      label: <LABEL_FOR_INVOICE_MONITORING>
  //      connection_params: {
  //        nodeid: <HEX_ENCODED_NODEID>
  //        address: <HOST:PORT>
  //        rune: <RUNE_STRING>
  //      },
  //      paid?: <BOOLEAN>  // Only present when checkout is complete
  //    } | null,
  //    completed: <BOOLEAN>    // Tells the client whether the checkout is complete (even if it was cancelled)
  // }
  router.get('/ln-checkout/:checkout_id', async (req, res) => {
    const checkout_id = req.params.checkout_id
    if (!checkout_id) {
      error_response(res, 'Could not parse checkout_id')
      return
    }
    const checkout_object = await app.invoice_manager.get_checkout_object(checkout_id)
    if (!checkout_object) {
      simple_response(res, 404)
      return
    }
    json_response(res, checkout_object)
  })

  // Tells the server to check if the invoice has been paid, and proceed with the checkout if it has
  // This route will return the checkout object with payment status appended to the invoice object
  //
  // Returns:
  // {
  //    id: <UUID>
  //    product_template_name: <PRODUCT_TEMPLATE_NAME>
  //    verified_pubkey: <HEX_ENCODED_PUBKEY> | null
  //    invoice: {
  //      bolt11: <BOLT11_INVOICE>
  //      label: <LABEL_FOR_INVOICE_MONITORING>
  //      connection_params: {
  //        nodeid: <HEX_ENCODED_NODEID>
  //        address: <HOST:PORT>
  //        rune: <RUNE_STRING>
  //      },
  //      paid?: <BOOLEAN>  // Only present when checkout is complete
  //    } | null,
  //    completed: <BOOLEAN>  // Tells the client whether the checkout is complete (even if it was cancelled)
  // }
  router.post('/ln-checkout/:checkout_id/check-invoice', async (req, res) => {
    const checkout_id = req.params.checkout_id
    if (!checkout_id) {
      error_response(res, 'Could not parse checkout_id')
      return
    }
    const checkout_object = await app.invoice_manager.check_checkout_object_invoice(checkout_id)
    json_response(res, checkout_object)
  })

  // Used by the Damus app to authenticate the user, and generate the final LN invoice
  // This is necessary and useful to prevent several potential issues:
  // - Prevents the user from purchasing without having a compatible Damus app installed
  // - Prevents human errors when selecting the wrong npub
  // - Prevents the user from purchasing for another user. Although gifting is a great feature, it needs to be implemented with more care to avoid confusion.
  router.put('/ln-checkout/:checkout_id/verify', required_nip98_auth, async (req, res) => {
    const checkout_id = req.params.checkout_id
    if (!checkout_id) {
      error_response(res, 'Could not parse checkout_id')
      return
    }
    try {
      const response = await app.invoice_manager.verify_checkout_object(checkout_id, req.authorized_pubkey)
      if (response.request_error) {
        invalid_request(res, response.request_error)
      }
      if (response.checkout_object) {
        json_response(res, response.checkout_object)
      }
    } catch (e) {
      error("%s", e.toString())
      invalid_request(res, e.toString())
    }
  })

  // MARK: OTP routes

  router.post('/accounts/:pubkey/request-otp', async (req, res) => {
    const pubkey = req.params.pubkey
    if (!pubkey) {
      invalid_request(res, 'Could not parse account pubkey')
      return
    }
    const { account, user_id } = get_account_and_user_id(app, pubkey)
    if (!account) {
      simple_response(res, 404)
      return
    }
    const otp_code = await app.web_auth_manager.generate_otp(pubkey)
    await app.web_auth_manager.send_otp(pubkey, otp_code)
    json_response(res, { success: true })
  });

  router.post('/accounts/:pubkey/verify-otp', async (req, res) => {
    const pubkey = req.params.pubkey
    if (!pubkey) {
      invalid_request(res, 'Could not parse account pubkey')
      return
    }
    const { account, user_id } = get_account_and_user_id(app, pubkey)
    if (!account) {
      simple_response(res, 404)
      return
    }
    const otp_code = req.body.otp_code
    if (!otp_code) {
      invalid_request(res, 'Missing otp_code')
      return
    }
    const is_valid = await app.web_auth_manager.validate_otp(pubkey, otp_code)

    if(is_valid) {
      const session_token = await app.web_auth_manager.create_session(pubkey)
      json_response(res, { valid: true, session_token: session_token })
      return
    }

    unauthorized_response(res, { valid: false })
  });

  // MARK: Session routes

  router.get('/sessions/account', app.web_auth_manager.require_web_auth.bind(app.web_auth_manager), async (req, res) => {
    const pubkey = req.authorized_pubkey
    const { account, user_id } = get_account_and_user_id(app, pubkey)
    if (!account) {
      simple_response(res, 404)
      return
    }
    json_response(res, get_account_info_payload(user_id, account, true))
    return
  });

  // MARK: Admin routes

  // Used by the admin to create a new verified checkout
  // This was created to allow us to bypass the verification step if the user does not have a Damus version that supports the LN flow
  // 
  // To use it, here is an example curl command:
  /*
    curl -X PUT '<url>/admin/ln-checkout/new-verified-checkout' \
    -H 'Content-Type: application/json' \
    -d '{
      "admin_password": "<admin_password>",
      "product_template_name": "<purple_one_month or purple_one_year>",
      "authorized_pubkey": "<authorized_pubkey_in_hex>"
    }'
  */
  router.put('/admin/ln-checkout/new-verified-checkout', async (req, res) => {
    const body = req.body
    const product_template_name = body.product_template_name
    const authorized_pubkey = body.authorized_pubkey
    const admin_password = body.admin_password
    if(!process.env.ADMIN_PASSWORD) {
      unauthorized_response(res, 'Admin password not set in the environment variables')
      return
    }
    if (!admin_password) {
      unauthorized_response(res, 'Missing admin_password')
      return
    }
    if (admin_password != process.env.ADMIN_PASSWORD) {
      unauthorized_response(res, 'Invalid admin password')
      return
    }
    if (!product_template_name) {
      invalid_request(res, 'Missing product_template_name')
      return
    }
    if (!authorized_pubkey) {
      invalid_request(res, 'Missing authorized_pubkey')
      return
    }
    if (!app.invoice_manager.invoice_templates[product_template_name]) {
      invalid_request(res, 'Invalid product_template_name. Valid names are: ' + Object.keys(app.invoice_manager.invoice_templates).join(', '))
      return
    }
    const checkout_object = await app.invoice_manager.new_checkout(product_template_name)
    const { checkout_object: new_checkout_object, request_error } = await app.invoice_manager.verify_checkout_object(checkout_object.id, authorized_pubkey)
    if (request_error) {
      invalid_request(res, "Error when verifying checkout: " + request_error)
      return
    }
    json_response(res, new_checkout_object)
  })
  
  if (process.env.ENABLE_DEBUG_ENDPOINTS == "true") {
    /**
      * This route is used to delete a user account.
      * This is useful when testing the onboarding flow, and we need to reset the user's account.
    */
    router.delete('/admin/users/:pubkey', async (req, res) => {
      const pubkey = req.params.pubkey
      const body = req.body
      const admin_password = body.admin_password
      if(!process.env.ADMIN_PASSWORD) {
        unauthorized_response(res, 'Admin password not set in the environment variables')
        return
      }
      if (!admin_password) {
        unauthorized_response(res, 'Missing admin_password')
        return
      }
      if (admin_password != process.env.ADMIN_PASSWORD) {
        unauthorized_response(res, 'Invalid admin password')
        return
      }
      if (!pubkey) {
        invalid_request(res, 'Missing pubkey')
        return
      }
      const { delete_error } = delete_account(app, pubkey)
      if (delete_error) {
        invalid_request(res, { error: delete_error })
        return
      }

      json_response(res, { success: true })
    })

    /**
      * This route is used to delete a user account transaction history.
      * This is useful when testing first checkout flows, and we need to reset the user's transaction history.
    */
    router.delete('/admin/users/:pubkey/transaction-history', async (req, res) => {
      const pubkey = req.params.pubkey
      const body = req.body
      const admin_password = body.admin_password
      if (!process.env.ADMIN_PASSWORD) {
        unauthorized_response(res, 'Admin password not set in the environment variables')
        return
      }
      if (!admin_password) {
        unauthorized_response(res, 'Missing admin_password')
        return
      }
      if (admin_password != process.env.ADMIN_PASSWORD) {
        unauthorized_response(res, 'Invalid admin password')
        return
      }
      if (!pubkey) {
        invalid_request(res, 'Missing pubkey')
        return
      }
      const { account, user_id } = get_account_and_user_id(app, pubkey)

      account.transactions = []
      account.expiry = null
      try {
        put_account(app, pubkey, account)
      }
      catch (e) {
        error("Error when putting account: %s", e.toString())
        invalid_request(res, { error: e.toString() })
        return
      }
      json_response(res, { success: true })
    })

    /**
      * This route is used to force a specific UUID for a user account.
      *
      * This is useful when we accidentally nuke the db on staging, 
      * but we want to keep the user's account UUID the same as before because resetting Apple's Sandbox account is a pain.
    */
    router.put('/admin/users/:pubkey/account-uuid', async (req, res) => {
      const pubkey = req.params.pubkey
      const body = req.body
      const admin_password = body.admin_password
      const account_uuid = body.account_uuid
      if(!process.env.ADMIN_PASSWORD) {
        unauthorized_response(res, 'Admin password not set in the environment variables')
        return
      }
      if (!admin_password) {
        unauthorized_response(res, 'Missing admin_password')
        return
      }
      if (admin_password != process.env.ADMIN_PASSWORD) {
        unauthorized_response(res, 'Invalid admin password')
        return
      }
      if (!pubkey) {
        invalid_request(res, 'Missing pubkey')
        return
      }
      if (!account_uuid) {
        invalid_request(res, 'Missing account_uuid')
        return
      }
      app.dbs.pubkeys_to_user_uuids.put(pubkey, account_uuid.toUpperCase())
      
      json_response(res, { success: true })
    });
    
    /**
      * This route is used to force a specific expiry date for a user account.
      *
      * This is useful for testing
    */
    router.put('/admin/users/:pubkey/expiry', async (req, res) => {
      const pubkey = req.params.pubkey
      const body = req.body
      const admin_password = body.admin_password
      const expiry = body.expiry  // Unix timestamp in seconds
      if(!process.env.ADMIN_PASSWORD) {
        unauthorized_response(res, 'Admin password not set in the environment variables')
        return
      }
      if (!admin_password) {
        unauthorized_response(res, 'Missing admin_password')
        return
      }
      if (admin_password != process.env.ADMIN_PASSWORD) {
        unauthorized_response(res, 'Invalid admin password')
        return
      }
      if (!pubkey) {
        invalid_request(res, 'Missing pubkey')
        return
      }
      if (!expiry) {
        invalid_request(res, 'Missing expiry')
        return
      }
      const { account, user_id } = get_account_and_user_id(app, pubkey)
      if (!account) {
        invalid_request(res, 'No account found for pubkey: ' + pubkey)
        return
      }
      account.expiry = expiry
      put_account(app, pubkey, account)
      
      json_response(res, { success: true })
    });
  }
}

function get_allowed_cors_origins() {
  if (process.env.CORS_ALLOWED_ORIGINS) {
    return process.env.CORS_ALLOWED_ORIGINS.split(',')
  }
  else {
    // Default to Damus.io and localhost
    return ["https://damus.io", "http://localhost:3000"]
  }
}

module.exports = { config_router }
