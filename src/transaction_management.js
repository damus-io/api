"use strict";
// @ts-check


/** @typedef {Object} Transaction
* @property {"iap" | "ln" | "legacy"} type - The type of transaction
* @property {string} id - The id of the transaction (Apple IAP transaction ID for iap, Checkout ID for ln, `0` for legacy)
* @property {number | null} start_date - The start date of the transaction if transaction has a fixed start and end (IAP and legacy), null otherwise (Unix timestamp in seconds)
* @property {number | null} end_date - The end date of the transaction if transaction has a fixed start and end (IAP and legacy), null otherwise (Unix timestamp in seconds)
* @property {number | null} purchased_date - The date of the transaction (Applies to LN and IAP only, Unix timestamp in seconds)
* @property {number | null} duration - The duration of the transaction (Applies to LN only, measured in seconds)
*/


/** Calculates the expiry date given a transaction history
* @param {Transaction[]} transaction_history - The transaction history
* @returns {number | null} - The expiry date of the transaction history (Unix timestamp in seconds), null if no expiry date can be calculated
*/
function calculate_expiry_date_from_history(transaction_history) {
  // make a deep copy of the transaction history so that we don't modify the original objects
  const transaction_history_copy = deep_copy_unique_transaction_history(transaction_history);

  // sort the transaction history by earliest date
  var remaining_transactions = transaction_history_copy.sort((a, b) => get_earliest_date_from_transaction(a) - get_earliest_date_from_transaction(b));
  var time_cursor = null;
  var flexible_credits_remaining = 0;

  for (var i = 0; i < remaining_transactions.length; i++) {
    var transaction = remaining_transactions[i];

    // Move time cursor and count flexible credits available.
    if (is_transaction_fixed_schedule(transaction)) {
      time_cursor = Math.max(time_cursor, transaction.end_date);
    }
    else if (is_transaction_flexible_schedule(transaction)) {
      flexible_credits_remaining += transaction.duration;
      time_cursor = Math.max(time_cursor, transaction.purchased_date);
    }

    // Check if there is a gap between the time cursor and the next transaction, then consume flexible credits.
    if (i < remaining_transactions.length - 1) {
      var next_transaction = remaining_transactions[i + 1];
      let earliest_date_from_next_transaction = get_earliest_date_from_transaction(next_transaction);
      if (time_cursor < earliest_date_from_next_transaction && flexible_credits_remaining > 0) {
        flexible_credits_remaining -= Math.min(earliest_date_from_next_transaction - time_cursor, flexible_credits_remaining);
        time_cursor = earliest_date_from_next_transaction;
      }
    }
    else {
      // This is the last transaction. Consume all remaining flexible credits.
      time_cursor += flexible_credits_remaining;
    }
  }

  return time_cursor;
}


/** Checks if a transaction is fixed schedule
 * @param {Transaction} transaction - The transaction to be checked
 */
function is_transaction_fixed_schedule(transaction) {
  return transaction.start_date !== null && transaction.start_date !== undefined && transaction.end_date !== null && transaction.end_date !== undefined;
}


/** Checks if a transaction is flexible schedule
* @param {Transaction} transaction - The transaction to be checked
*/
function is_transaction_flexible_schedule(transaction) {
  return transaction.purchased_date !== null && transaction.purchased_date !== undefined && transaction.duration !== null && transaction.duration !== undefined && !is_transaction_fixed_schedule(transaction);
}


/** Returns the earliest date from a transaction
* @param {Transaction} transaction - The transaction
* @returns {number | null} - The earliest date from the transaction (Unix timestamp in seconds), null if the transaction is null
*/
function get_earliest_date_from_transaction(transaction) {
  if (is_transaction_fixed_schedule(transaction)) {
    return transaction.start_date;
  }
  else if (is_transaction_flexible_schedule(transaction)) {
    return transaction.purchased_date;
  }
  else {
    return null;
  }
}


/** Deep copies a transaction history. More efficient than a JSON parsing roundtrip
  * @param {Transaction[]} transaction_history - The transaction history
  * @returns {Transaction[]} - The deep copied transaction history
  */
function deep_copy_unique_transaction_history(transaction_history) {
  // @type {Transaction[]}
  var new_transaction_history = [];
  // @type {Set<string>}
  var unique_transaction_ids = new Set();
  for (var i = 0; i < transaction_history.length; i++) {
    const unique_id = transaction_history[i].type + "_" + transaction_history[i].id;
    if (unique_transaction_ids.has(unique_id)) {
      continue;
    }
    unique_transaction_ids.add(unique_id);
    new_transaction_history.push({
      type: transaction_history[i].type,
      id: transaction_history[i].id,
      start_date: transaction_history[i].start_date,
      end_date: transaction_history[i].end_date,
      purchased_date: transaction_history[i].purchased_date,
      duration: transaction_history[i].duration
    });
  }

  return new_transaction_history;
}


module.exports = {
  calculate_expiry_date_from_history, deep_copy_unique_transaction_history
}
