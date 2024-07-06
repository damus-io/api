// @ts-check
const { deep_copy_unique_transaction_history, calculate_expiry_date_from_history } = require('./transaction_management')
const { current_time } = require('./utils')
const { v4: uuidv4 } = require('uuid')
/**
 * @typedef {import('./transaction_management.js').Transaction} Transaction
 */


// Helper function to get a user id from a pubkey
function get_user_id_from_pubkey(api, pubkey) {
  return api.dbs.pubkeys_to_user_ids.get(pubkey)
}

// Helper function to get an account and user id from a pubkey
function get_account_and_user_id(api, pubkey) {
  const user_id = get_user_id_from_pubkey(api, pubkey)
  if (!user_id)
    return { account: null, user_id: null }
  const account = get_account_by_user_id(api, user_id)
  return { account: account, user_id: user_id }
}

// A lower level function that fetches an account from the database by user id and transforms the data that is more usable for the rest of the code
function get_account_by_user_id(api, user_id) {
  const raw_account_data = api.dbs.accounts.get(user_id)
  if (!raw_account_data)
    return null

  return get_account_from_raw_account_data(raw_account_data)
}

function get_account_from_raw_account_data(raw_account_data) {
  // For backwards compatibility, if the account has an expiry date, we add a legacy transaction to the transaction history
  // The expiry date now is calculated on the fly from the transaction history

  // @type {Transaction[]}
  var transactions = raw_account_data?.transactions || []
  if (raw_account_data?.expiry) {
    transactions = [{
      type: "legacy",
      id: "0",
      start_date: current_time(),
      end_date: raw_account_data?.expiry,
      purchased_date: current_time(),
      duration: null
    }, ...transactions]
  }
  var account = raw_account_data;
  account.transactions = transactions
  // TODO: Maybe we should cache these calculations, as they are called for every request
  account.expiry = calculate_expiry_date_from_history(transactions)
  return account
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
  // Make sure we already converted to the transactions model before wiping out the expiry date
  if (account.transactions.length > 0) {
    account.expiry = null   // We don't store the expiry date in the database anymore, it's calculated on the fly from the transaction history
  }

  if (user_id == null) {
    const last_user_id = get_last_user_id(api)
    user_id = last_user_id != null ? parseInt(last_user_id) + 1 : 1
    api.dbs.pubkeys_to_user_ids.put(pubkey, user_id)
  }
  api.dbs.accounts.put(user_id, account)
  const new_account = get_account_from_raw_account_data(account)
  return { account: new_account, user_id: user_id }
}

function check_account(api, pubkey) {
  const account = get_account(api, pubkey)

  if (!account)
    return { ok: false, message: 'Account not found' }

  if (!account.expiry || current_time() >= account.expiry)
    return { ok: false, message: 'Account expired' }

  return { ok: true, message: null }
}

function create_account(api, pubkey, transaction_history, created_by_user = true) {
  const account = get_account(api, pubkey)

  if (account)
    return { request_error: 'account already exists' }

  const new_account = {
    pubkey: pubkey,                       // Public key of the user
    created_at: current_time(),           // Time when the account was created
    created_by_user: created_by_user,     // true if the account was created by the user itself, false if it might have been created by someone else.
    expiry: null,                       // Date and time when the account expires. This is a legacy field, which now is calculated from the transaction history.
    transactions: transaction_history,     // The transaction history of the account
  }

  const { user_id } = put_account(api, pubkey, new_account)
  return { account: new_account, request_error: null, user_id: user_id }
}


/** Adds successful transactions to the account
* @param {Object} api - The API object
* @param {string} pubkey - The public key of the user, hex encoded
* @param {Transaction[]} transactions - The transactions to be added
* @returns {{account?: Object, request_error?: string | null, user_id?: number}} - The account object, or null if the account does not exist, and the request error, or null if there was no error
*/
function add_successful_transactions_to_account(api, pubkey, transactions) {
  const account = get_account(api, pubkey)
  if (!account) {
    // Create account if it doesn't exist already
    return create_account(api, pubkey, transactions)
  }
  if (!account.transactions) {
    account.transactions = []
  }
  const merged_transactions = account.transactions.concat(transactions)
  const unique_transactions = deep_copy_unique_transaction_history(merged_transactions)
  account.transactions = unique_transactions
  const { account: new_account, user_id } = put_account(api, pubkey, account)
  return { account: new_account, user_id, request_error: null }
}

/** Records that iap history was refreshed
* @param {Object} api - The API object
* @param {string} pubkey - The public key of the user, hex encoded
* @returns {{account?: Object, request_error?: string | null, user_id?: number}} - The account object, or null if the account does not exist, and the request error, or null if there was no error
*/
function mark_iap_history_was_refreshed(api, pubkey) {
  const account = get_account(api, pubkey)
  if (!account) {
    return { request_error: 'Account not found' }
  }
  account.last_iap_history_refresh = current_time()
  put_account(api, pubkey, account)
  return { account: account, request_error: null }
}

function get_account_info_payload(subscriber_number, account, authenticated = false) {
  if (!account)
    return null

  const account_active = (account.expiry && current_time() < account.expiry) ? true : false

  return {
    pubkey: account.pubkey,
    created_at: account.created_at,
    expiry: account.expiry ? account.expiry : null,
    subscriber_number: subscriber_number,
    active: account_active,
    testflight_url: (authenticated && account_active) ? process.env.TESTFLIGHT_URL : null,
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

function delete_account(api, pubkey) {
  const user_id = get_user_id_from_pubkey(api, pubkey);
  if (!user_id) {
    return { delete_error: 'User ID not found for the given pubkey' };
  }

  api.dbs.accounts.remove(user_id);
  api.dbs.pubkeys_to_user_ids.remove(pubkey);
  api.dbs.pubkeys_to_user_uuids.remove(pubkey);

  return { delete_error: null };
}

module.exports = { check_account, create_account, get_account_info_payload, get_account, put_account, get_account_and_user_id, get_user_id_from_pubkey, get_user_uuid, delete_account, add_successful_transactions_to_account, mark_iap_history_was_refreshed }
