const { current_time } = require('./utils')

// check to see if the account is active and is allowed to
// translate stuff
function check_account(api, note) {
    return check_account_by_pubkey_hex(api, note.pubkey)
}

function check_account_by_pubkey_hex(api, pubkey) {
    const id = Buffer.from(pubkey)
    const account = api.dbs.accounts.get(id)

    if (!account)
        return 'account not found'

    if (!account.expiry || current_time() >= account.expiry)
        return 'account expired'

    return 'ok'
}

function create_account(api, pubkey, expiry) {
    const id = Buffer.from(pubkey)
    const account = api.dbs.accounts.get(id)

    if (account)
        return { request_error: 'account already exists' }

    const new_account = {
        pubkey: pubkey,
        created_at: current_time(),
        expiry: expiry,
    }

    api.dbs.accounts.put(id, new_account)
    return { account: new_account, request_error: null }
}

function get_account_info_payload(account) {
    if (!account)
        return null

    return {
        pubkey: account.pubkey,
        created_at: account.created_at,
        expiry: account.expiry,
        active: (account.expiry && current_time() < account.expiry) ? true : false,
    }
}

module.exports = { check_account, check_account_by_pubkey_hex, create_account, get_account_info_payload }
