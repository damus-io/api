const { json_response, simple_response, error_response, invalid_request, unauthorized_response } = require('./server_helpers')
const { create_account, get_account_info_payload, check_account } = require('./user_management')
const handle_translate = require('./translate')
const verify_receipt = require('./app_store_receipt_verifier').verify_receipt
const bodyParser = require('body-parser')
const cors = require('cors');
const { required_nip98_auth, capture_raw_body, optional_nip98_auth } = require('./nip98_auth')

function config_router(app) {
  const router = app.router

  router.use(bodyParser.json({ verify: capture_raw_body, type: 'application/json' }))
  router.use(bodyParser.raw({ verify: capture_raw_body, type: 'application/octet-stream' }))
  router.use(cors({ origin: ['https://damus.io', 'http://localhost:3000'] }))

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
    let account = app.dbs.accounts.get(id)

    if (!account) {
      simple_response(res, 404)
      return
    }

    let account_info = get_account_info_payload(account)

    json_response(res, account_info)
  })

  router.post('/accounts', required_nip98_auth, (req, res) => {
    let result = create_account(app, req.authorized_pubkey, null)

    if (result.request_error) {
      invalid_request(res, result.request_error)
      return
    }

    json_response(res, get_account_info_payload(result.account))
    return
  })

  router.post('/accounts/:pubkey/app-store-receipt', required_nip98_auth, async (req, res) => {
    const id = req.params.pubkey
    if (!id) {
      error_response(res, 'Could not parse account id')
      return
    }
    if (id != req.authorized_pubkey) {
      unauthorized_response(res, 'You are not authorized to access this account')
      return
    }

    let account = app.dbs.accounts.get(id)

    if (!account) {
      simple_response(res, 404)
      return
    }

    const body = Buffer.from(req.body, 'base64').toString('ascii')

    let expiry_date = await verify_receipt(body)

    if (!expiry_date) {
      error_response(res, 'Could not verify receipt')
      return
    }

    account.expiry = expiry_date
    app.dbs.accounts.put(id, account)
    json_response(res, get_account_info_payload(account))
    return
  })
}

module.exports = { config_router }
