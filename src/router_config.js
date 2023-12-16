const { json_response, simple_response, error_response, invalid_request, unauthorized_response } = require('./server_helpers')
const { create_account, get_account_info_payload } = require('./user_management')
const handle_translate = require('./translate')
const verify_receipt = require('./app_store_receipt_verifier').verify_receipt


function config_router(app) {
    const router = app.router

	// MARK: Translation routes

	router.get('/translate', (req, res, capture_groups) => {
		handle_translate(app, req, res)
	})

	// MARK: Account management routes

	router.get('/accounts/(.+)', (req, res, capture_groups) => {
		const id = capture_groups[0]
		if(!id) {
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

	router.post_authenticated('/accounts', (req, res, capture_groups, auth_pubkey) => {
		let result = create_account(app, auth_pubkey, null)

		if (result.request_error) {
			invalid_request(res, result.request_error)
			return
		}

		json_response(res, get_account_info_payload(result.account))
		return
	})

    router.post_authenticated('/accounts/(.+)/app-store-receipt', async (req, res, capture_groups, auth_pubkey) => {
        const id = capture_groups[0]
		if(!id) {
			error_response(res, 'Could not parse account id')
			return
		}
		if(id != auth_pubkey) {
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
