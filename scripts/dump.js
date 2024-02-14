
const lmdb = require('lmdb')

function go() {
	const args = process.argv.slice(2)
	const db_path = args[0] || "."
	const db = lmdb.open({ path: db_path })
	const accounts = db.openDB('accounts')
	const pubkeys_to_user_ids = db.openDB('pubkeys_to_user_ids')
	const invoices = db.openDB('invoices')
	const sessions = db.openDB('checkout_sessions')
	const data = {}
	const datas = {accounts:{},pubkeys_to_user_ids:{},checkout_sessions:{}}

	for (const { key, value } of accounts.getRange()) {
		datas.accounts[key] = value
	}
	for (const { key, value } of pubkeys_to_user_ids.getRange()) {
		datas.pubkeys_to_user_ids[key] = value
	}
	for (const { key, value } of sessions.getRange()) {
		datas.checkout_sessions[key] = value
	}

	console.log(JSON.stringify(datas))

	db.close()
}

go()
