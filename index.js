#!/usr/bin/env node

const lmdb = require('lmdb')
const http = require('http')
const handle_translate = require('./translate')
const Router = require('./server_helpers').Router
const { json_response, simple_response, error_response, invalid_request } = require('./server_helpers')
const { create_account, get_account_info_payload } = require('./user_management')

function PurpleApi(opts = {})
{
	if (!(this instanceof PurpleApi))
		return new PurpleApi(opts)

	const queue = {}
	const db = lmdb.open({ path: '.', })
	const translations = db.openDB('translations')
	const accounts = db.openDB('accounts')
	const dbs = {translations, accounts}
	const router = new Router()

	// translation data
	this.translation = {queue}

	this.db = db
	this.dbs = dbs
	this.opts = opts
	this.server = http.createServer(this.handler.bind(this.server, this))
	this.router = router

	return this
}

PurpleApi.prototype.serve = async function pt_serve(port) {
	const theport = this.opts.port || port || 8989
	await this.server.listen(theport)
	console.log(`http server listening on ${theport}`)
}

PurpleApi.prototype.close = async function pt_close() {
	// stop the server
	await this.server.close()

	// close lmdb
	await this.db.close()
}

PurpleApi.prototype.register_routes = function pt_register_routes() {
	const router = this.router

	// MARK: Translation routes

	router.get('/translate', (req, res, capture_groups) => {
		handle_translate(this, req, res)
	})

	// MARK: Account management routes

	router.get('/accounts/(.+)', (req, res, capture_groups) => {
		const id = capture_groups[0]
		if(!id) {
			error_response(res, 'Could not parse account id')
			return
		}
		let account = this.dbs.accounts.get(id)

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

		let result = create_account(this, pubkey, null)

		if (result.request_error) {
			invalid_request(res, result.request_error)
			return
		}

		json_response(res, get_account_info_payload(result.account))
		return
	})
}

PurpleApi.prototype.handler = function pt_handle_request(app, req, res)
{
	app.router.handle_request(req, res)
}


module.exports = PurpleApi

if (require.main == module) {
	let translate = new PurpleApi()
	translate.register_routes()
	translate.serve(process.env.PORT)
}
