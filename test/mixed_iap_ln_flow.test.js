"use strict";
// @ts-check

const test = require('tap').test;
const { PurpleTestController } = require('./controllers/purple_test_controller.js');
const { PURPLE_ONE_MONTH } = require('../src/invoicing.js');
const { MOCK_ACCOUNT_UUIDS, MOCK_IAP_DATES } = require('./controllers/mock_iap_controller.js');

test('Mixed IAP/LN Flow — Expiry dates should be nicely handled', async (t) => {
  // Set things up
  const purple_api_controller = await PurpleTestController.new(t);
  const user_uuid = MOCK_ACCOUNT_UUIDS[0]
  const user_pubkey_1 = purple_api_controller.new_client();
  purple_api_controller.set_account_uuid(user_pubkey_1, user_uuid); // Associate the pubkey with the user_uuid on the server
  const decoded_tx_history = purple_api_controller.iap.get_decoded_transaction_history(user_uuid)
  if (decoded_tx_history.length != 2) {
    t.fail('Expected 2 transactions in the decoded transaction history. The test assumption is broken and it needs to be updated.')
    t.end()
    return
  }
  let tx_1 = decoded_tx_history[0]
  let tx_2 = decoded_tx_history[1]
  
  // Buy a one month subscription via LN flow 25 days before buying the IAP
  purple_api_controller.set_current_time(tx_1.purchaseDate/1000 - 60 * 60 * 24 * 25); // 25 days before the IAP purchase date
  await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);
  
  // Check expiry
  const account_info_response_1 = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response_1.statusCode, 200);
  t.same(account_info_response_1.body.expiry, purple_api_controller.current_time() + 30 * 24 * 60 * 60);
  t.same(account_info_response_1.body.active, true);
  
  // Fast forward 25 days, to the IAP purchase date
  purple_api_controller.set_current_time(tx_1.purchaseDate/1000);
  
  // Simulate IAP purchase on the iOS side
  const receipt_base64 = purple_api_controller.iap.get_iap_receipt_data(user_uuid);  // Get the receipt from the iOS side
  
  // Send the receipt to the server to activate the account
  const iap_response = await purple_api_controller.clients[user_pubkey_1].send_iap_receipt(user_uuid, receipt_base64);
  t.same(iap_response.statusCode, 200);
  
  // Read the account info now
  const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response.statusCode, 200);
  // This user still had 5 days left on their subscription, so the expiry date should be 5 days after the IAP expiry date
  // i.e. The user should not lose any credit for the time they had left on their subscription
  // Note: This assumes that both tx_1 and tx_2 time ranges are included inside the 5 days remaining on the subscription.
  let tx_1_time = (tx_1.expiresDate - tx_1.purchaseDate) / 1000
  let tx_2_time = (tx_2.expiresDate - tx_2.purchaseDate) / 1000
  t.same(account_info_response.body.expiry, tx_1.purchaseDate / 1000 + tx_1_time + tx_2_time + 5 * 24 * 60 * 60);
  t.same(account_info_response.body.active, true);

  // TODO: Test other edge cases?

  t.end();
});
