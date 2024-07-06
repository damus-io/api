const { get_account_and_user_id, get_user_uuid, add_successful_transactions_to_account, mark_iap_history_was_refreshed } = require('./user_management');
const { verify_transaction_id } = require('./app_store_receipt_verifier');
const { current_time } = require('./utils');

const IAP_REFRESH_PERIOD = 60 * 60 * 24;  // 24 hours

/**
 * Checks an account to see if it needs an update with Apple's IAP servers, and updates it if needed.
 *
 * @param {Object} app - The app object
 * @param {string} pubkey - The public key of the user, hex encoded
 * @returns {Promise<{account?: Object, user_id?: number, request_error?: string | null}>} - The account object, the user ID, and the request error, if any
 */
async function update_iap_history_with_apple_if_needed_and_return_updated_user(app, pubkey) {
  let { account, user_id } = get_account_and_user_id(app, pubkey);
  if (!account) {
    // Account not found
    return { account: null, user_id: null, request_error: null };
  }

  if (!should_iap_transaction_history_be_refreshed(account)) {
    // No need to refresh iap history
    return { account: account, user_id: user_id, request_error: null };
  }

  // Refresh the iap history
  const account_uuid = get_user_uuid(app, account.pubkey);
  const last_transaction = account.transactions[account.transactions.length - 1];
  try {
    let verified_transaction_history = await verify_transaction_id(last_transaction.id, account_uuid);
    mark_iap_history_was_refreshed(app, account.pubkey);
    if (!verified_transaction_history) {
      return { account: account, user_id: user_id };
    }

    const { account: new_account, user_id: latest_user_id, request_error } = add_successful_transactions_to_account(app, account.pubkey, verified_transaction_history);
    if (request_error) {
      return { account: account, user_id: user_id, request_error: request_error };
    }
    return { account: new_account, user_id: latest_user_id }
  } catch (error) {
    return { account: account, user_id: user_id, request_error: error.message };
  }
}

async function should_iap_transaction_history_be_refreshed(account) {
  const account_active = (account.expiry && current_time() < account.expiry) ? true : false;
  const last_transaction = account.transactions[account.transactions.length - 1];
  if (account_active || last_transaction == undefined || last_transaction.type != "iap") {
    // No need to update iap history because account is either active, or the last transaction was not an IAP transaction
    return false;
  }

  if (account.last_iap_history_refresh && (current_time() - account.last_iap_history_refresh) < IAP_REFRESH_PERIOD) {
    // We already checked with Apple in the last 24 hours. No need to check again for now.
    return false;
  }

  // If the account is inactive and the last transaction was an IAP, we should check with Apple with it was renewed.
  return true;
}

module.exports = { update_iap_history_with_apple_if_needed_and_return_updated_user, should_iap_transaction_history_be_refreshed };

