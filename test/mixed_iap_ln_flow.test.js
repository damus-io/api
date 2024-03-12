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
  
  // Buy a one month subscription via LN flow 25 days before buying the IAP
  purple_api_controller.set_current_time(MOCK_IAP_DATES[user_uuid].purchase_date - 60 * 60 * 24 * 25); // 25 days before the IAP purchase date
  await purple_api_controller.ln_flow_buy_subscription(user_pubkey_1, PURPLE_ONE_MONTH);
  
  // Check expiry
  const account_info_response_1 = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response_1.statusCode, 200);
  t.same(account_info_response_1.body.expiry, purple_api_controller.current_time() + 30 * 24 * 60 * 60);
  t.same(account_info_response_1.body.active, true);
  
  // Fast forward 25 days, to the IAP purchase date
  purple_api_controller.set_current_time(MOCK_IAP_DATES[user_uuid].purchase_date);
  
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
  // TODO: This is hardcoded, but it should be calculated. To better calculate this we need better data structures for the data getters
  t.same(account_info_response.body.expiry, 1708987500);
  t.same(account_info_response.body.active, true);

  // TODO: Test other edge cases?

  t.end();
});
