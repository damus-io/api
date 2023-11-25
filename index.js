#!/usr/bin/env node

const lmdb = require('lmdb')
const { createHash }  = require('crypto')
const http = require('http')
const nostr = require('nostr')
const handle_translate = require('./translate')

function hash_sha256(data)
{
	return createHash('sha256').update(data).digest()
}

function PurpleApi(opts = {})
{
	if (!(this instanceof PurpleApi))
		return new PurpleApi(opts)

	const queue = {}
	const db = lmdb.open({ path: '.', })
	const translations = db.openDB('translations')
	const accounts = db.openDB('accounts')
	const dbs = {translations, accounts}

	// translation data
	this.translation = {queue}

	this.db = db
	this.dbs = dbs
	this.opts = opts
	this.server = http.createServer(this.handler.bind(this.server, this))

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

PurpleApi.prototype.handler = function pt_handle_request(api, req, res)
{
	if (req.url === '/translate') {
		return handle_translate(api, req, res)
	} else {
		return simple_response(res, 404)
	}
}


module.exports = PurpleApi

if (require.main == module) {
	let translate = new PurpleApi()

	translate.serve(process.env.PORT)
}
