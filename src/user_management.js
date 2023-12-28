const { current_time } = require('./utils')

function check_account(api, pubkey) {
    const id = Buffer.from(pubkey)
    const account = api.dbs.accounts.get(id)

    if (!account)
        return { ok: false, message: 'Account not found' }

    if (!account.expiry || current_time() >= account.expiry)
        return { ok: false, message: 'Account expired' }

    return { ok: true, message: null }
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
        expiry: account.expiry ? account.expiry : null,
        active: (account.expiry && current_time() < account.expiry) ? true : false,
    }
}

module.exports = { check_account, create_account, get_account_info_payload }
