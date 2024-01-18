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

function create_account(api, pubkey, expiry, created_by_user = true) {
  const id = Buffer.from(pubkey)
  const account = api.dbs.accounts.get(id)

  if (account)
    return { request_error: 'account already exists' }

  const new_account = {
    pubkey: pubkey,                       // Public key of the user
    created_at: current_time(),           // Time when the account was created
    created_by_user: created_by_user,     // true if the account was created by the user itself, false if it might have been created by someone else.
    expiry: expiry,                       // Date and time when the account expires
  }

  api.dbs.accounts.put(id, new_account)
  return { account: new_account, request_error: null }
}

function bump_expiry(api, pubkey, expiry_delta) {
  const id = Buffer.from(pubkey)
  const account = api.dbs.accounts.get(id)
  if (!account) {
    // Create account if it doesn't exist already
    return create_account(api, pubkey, current_time() + expiry_delta)
  }
  if (!account.expiry) {
    // Set expiry if it doesn't exist already
    account.expiry = current_time() + expiry_delta
  }
  else {
    // Bump expiry if it already exists
    account.expiry += expiry_delta
  }
  api.dbs.accounts.put(id, account)
  return { account: account, request_error: null }
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

module.exports = { check_account, create_account, get_account_info_payload, bump_expiry }
