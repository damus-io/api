const { json_response, simple_response, error_response, invalid_request } = require('./server_helpers')
const { create_account, get_account_info_payload } = require('./user_management')
const handle_translate = require('./translate')


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

	router.post('/accounts', (req, res, capture_groups) => {
		const body = JSON.parse(req.body)
		const pubkey = body["pubkey"]

		if (!pubkey) {
			invalid_request(res, 'missing pubkey')
			return
		}

		let result = create_account(app, pubkey, null)

		if (result.request_error) {
			invalid_request(res, result.request_error)
			return
		}

		json_response(res, get_account_info_payload(result.account))
		return
	})
}

module.exports = { config_router }
