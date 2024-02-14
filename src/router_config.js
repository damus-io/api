const { json_response, simple_response, error_response, invalid_request, unauthorized_response } = require('./server_helpers')
const { create_account, get_account_info_payload, check_account, get_account, put_account, get_account_and_user_id, get_user_uuid } = require('./user_management')
const handle_translate = require('./translate')
const verify_receipt = require('./app_store_receipt_verifier').verify_receipt
const bodyParser = require('body-parser')
const cors = require('cors');
const { required_nip98_auth, capture_raw_body, optional_nip98_auth } = require('./nip98_auth')
const { nip19 } = require('nostr-tools')
const { PURPLE_ONE_MONTH } = require('./invoicing')
const error = require("debug")("api:error")

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

  router.get('/accounts/:pubkey', (req, res) => {
    const id = req.params.pubkey
    if (!id) {
      error_response(res, 'Could not parse account id')
      return
    }
    let { account, user_id } = get_account_and_user_id(app, id)

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
      
      let expiry_date = await verify_receipt(req.body)
      if (!expiry_date) {
        error_response(res, 'Could not verify receipt')
        return
      }
      
      let account = get_account(app, pubkey)
      if (!account) {
        let result = create_account(app, req.authorized_pubkey, null)
  
        if (result.request_error) {
          invalid_request(res, result.request_error)
          return
        }
        account = result.account
      }

      account.expiry = expiry_date
      const { user_id } = put_account(app, pubkey, account)
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
