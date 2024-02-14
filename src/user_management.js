const { current_time } = require('./utils')
const { v4: uuidv4 } = require('uuid')

// Helper function to get a user id from a pubkey
function get_user_id_from_pubkey(api, pubkey) {
  return api.dbs.pubkeys_to_user_ids.get(pubkey)
}

// Helper function to get an account and user id from a pubkey
function get_account_and_user_id(api, pubkey) {
  const user_id = get_user_id_from_pubkey(api, pubkey)
  if (!user_id)
    return { account: null, user_id: null }
  const account = api.dbs.accounts.get(user_id)
  return { account: account, user_id: user_id }
}

// Helper function to get an account from the database by pubkey
function get_account(api, pubkey) {
  return get_account_and_user_id(api, pubkey).account
}

// Gets the last user id in the database, for counting the number of accounts in the database
function get_last_user_id(api) {
  for (const key of api.dbs.accounts.getKeys({ reverse: true })) {
    return key
  }
  return null
}

// Helper function to put an account into the database by pubkey
function put_account(api, pubkey, account) {
  var user_id = get_user_id_from_pubkey(api, pubkey)
  if (user_id == null) {
    const last_user_id = get_last_user_id(api)
    user_id = last_user_id != null ? parseInt(last_user_id) + 1 : 1
    api.dbs.pubkeys_to_user_ids.put(pubkey, user_id)
  }
  api.dbs.accounts.put(user_id, account)
  return { account: account, user_id: user_id }
}

function check_account(api, pubkey) {
  const account = get_account(api, pubkey)

  if (!account)
    return { ok: false, message: 'Account not found' }

  if (!account.expiry || current_time() >= account.expiry)
    return { ok: false, message: 'Account expired' }

  return { ok: true, message: null }
}

function create_account(api, pubkey, expiry, created_by_user = true) {
  const account = get_account(api, pubkey)

  if (account)
    return { request_error: 'account already exists' }

  const new_account = {
    pubkey: pubkey,                       // Public key of the user
    created_at: current_time(),           // Time when the account was created
    created_by_user: created_by_user,     // true if the account was created by the user itself, false if it might have been created by someone else.
    expiry: expiry,                       // Date and time when the account expires
  }

  const { user_id } = put_account(api, pubkey, new_account)
  return { account: new_account, request_error: null, user_id: user_id }
}

function bump_expiry(api, pubkey, expiry_delta) {
  const account = get_account(api, pubkey)
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
  put_account(api, pubkey, account)
  return { account: account, request_error: null }
}

function get_account_info_payload(subscriber_number, account) {
  if (!account)
    return null

  return {
    pubkey: account.pubkey,
    created_at: account.created_at,
    expiry: account.expiry ? account.expiry : null,
    subscriber_number: subscriber_number,
    active: (account.expiry && current_time() < account.expiry) ? true : false,
  }
}

// Helper function to get a user uuid from a pubkey
// 
// @param {Object} api - The API object
// @param {string} pubkey - The public key of the user, hex encoded
// 
// @returns {string} - The user uuid, in uppercase
function get_user_uuid(api, pubkey) {
  const uuid = api.dbs.pubkeys_to_user_uuids.get(pubkey)
  if (!uuid) {
    // Generate a new uuid
    const new_uuid = uuidv4().toUpperCase()
    api.dbs.pubkeys_to_user_uuids.put(pubkey, new_uuid)
    return new_uuid
  }
  return uuid
}

module.exports = { check_account, create_account, get_account_info_payload, bump_expiry, get_account, put_account, get_account_and_user_id, get_user_id_from_pubkey, get_user_uuid }
