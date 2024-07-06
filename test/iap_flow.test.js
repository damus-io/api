"use strict";
// @ts-check

const test = require('tap').test;
const { PurpleTestController } = require('./controllers/purple_test_controller.js');
const { PURPLE_ONE_MONTH } = require('../src/invoicing.js');
const { MOCK_ACCOUNT_UUIDS, MOCK_IAP_DATES, MOCK_RECEIPT_DATA } = require('./controllers/mock_iap_controller.js');

test('IAP Flow — Expected flow (receipts)', async (t) => {
  // Initialize the PurpleTestController
  const purple_api_controller = await PurpleTestController.new(t);

  const user_uuid = MOCK_ACCOUNT_UUIDS[0]
  purple_api_controller.set_current_time(MOCK_IAP_DATES[user_uuid].purchase_date);

  // Instantiate a new client
  const user_pubkey_1 = purple_api_controller.new_client();

  // Try to get the account info
  const response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(response.statusCode, 404);

  // Simulate IAP purchase on the iOS side

  purple_api_controller.set_account_uuid(user_pubkey_1, user_uuid); // Associate the pubkey with the user_uuid on the server
  const receipt_base64 = purple_api_controller.iap.get_iap_receipt_data(user_uuid);  // Get the receipt from the iOS side

  // Send the receipt to the server to activate the account
  const iap_response = await purple_api_controller.clients[user_pubkey_1].send_iap_receipt(user_uuid, receipt_base64);
  t.same(iap_response.statusCode, 200);

  // Read the account info now
  const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response.statusCode, 200);
  t.same(account_info_response.body.pubkey, user_pubkey_1)
  t.same(account_info_response.body.created_at, purple_api_controller.current_time());
  t.same(account_info_response.body.expiry, MOCK_IAP_DATES[user_uuid].expiry_date);
  t.same(account_info_response.body.subscriber_number, 1);
  t.same(account_info_response.body.active, true);

  t.end();
});


test('IAP Flow — Expected flow (transaction ID)', async (t) => {
  // Initialize the PurpleTestController
  const purple_api_controller = await PurpleTestController.new(t);

  const user_uuid = MOCK_ACCOUNT_UUIDS[0]
  purple_api_controller.set_current_time(MOCK_IAP_DATES[user_uuid].purchase_date);

  // Instantiate a new client
  const user_pubkey_1 = purple_api_controller.new_client();

  // Try to get the account info
  const response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(response.statusCode, 404);

  // Simulate IAP purchase on the iOS side

  purple_api_controller.set_account_uuid(user_pubkey_1, user_uuid); // Associate the pubkey with the user_uuid on the server
  const transaction_id = purple_api_controller.iap.get_transaction_id(user_uuid);  // Get the transaction ID from the iOS side

  // Send the receipt to the server to activate the account
  const iap_response = await purple_api_controller.clients[user_pubkey_1].send_transaction_id(user_uuid, transaction_id);
  t.same(iap_response.statusCode, 200);

  // Read the account info now
  const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response.statusCode, 200);
  t.same(account_info_response.body.pubkey, user_pubkey_1)
  t.same(account_info_response.body.created_at, purple_api_controller.current_time());
  t.same(account_info_response.body.expiry, MOCK_IAP_DATES[user_uuid].expiry_date);
  t.same(account_info_response.body.subscriber_number, 1);
  t.same(account_info_response.body.active, true);

  t.end();
});


test('IAP Flow — Invalid receipt should not be authorized or crash the server', async (t) => {
  // Initialize the PurpleTestController
  const purple_api_controller = await PurpleTestController.new(t);

  const user_uuid = MOCK_ACCOUNT_UUIDS[0]
  purple_api_controller.set_current_time(MOCK_IAP_DATES[user_uuid].purchase_date);

  // Instantiate a new client
  const user_pubkey_1 = purple_api_controller.new_client();

  // Try to get the account info
  const response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(response.statusCode, 404);

  // Simulate IAP purchase on the iOS side

  purple_api_controller.set_account_uuid(user_pubkey_1, user_uuid); // Associate the pubkey with the user_uuid on the server
  const receipt_base64 = "AAAAAAAAAAAA" // Invalid receipt

  // Send the receipt to the server to activate the account
  const iap_response = await purple_api_controller.clients[user_pubkey_1].send_iap_receipt(user_uuid, receipt_base64);
  t.same(iap_response.statusCode, 401);

  // Read the account info now
  const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response.statusCode, 404);

  t.end();
});

test('IAP Flow — Invalid receipt should not be authorized or crash the server', async (t) => {
  // Initialize the PurpleTestController
  const purple_api_controller = await PurpleTestController.new(t);

  const user_uuid = MOCK_ACCOUNT_UUIDS[1]

  // Instantiate a new client
  const user_pubkey_1 = purple_api_controller.new_client();

  // Try to get the account info
  const response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(response.statusCode, 404);

  // Simulate IAP purchase on the iOS side

  purple_api_controller.set_account_uuid(user_pubkey_1, user_uuid); // Associate the pubkey with the user_uuid on the server
  const receipt_base64 = MOCK_RECEIPT_DATA[user_uuid]; // Receipt with valid format but invalid transaction ID

  // Send the receipt to the server to activate the account
  const iap_response = await purple_api_controller.clients[user_pubkey_1].send_iap_receipt(user_uuid, receipt_base64);
  t.same(iap_response.statusCode, 401);

  // Read the account info now
  const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response.statusCode, 404);

  t.end();
});

test('IAP Flow — Repeated receipts', async (t) => {
  // Initialize the PurpleTestController
  const purple_api_controller = await PurpleTestController.new(t);

  const user_uuid = MOCK_ACCOUNT_UUIDS[0]
  purple_api_controller.set_current_time(MOCK_IAP_DATES[user_uuid].purchase_date);

  // Instantiate a new client
  const user_pubkey_1 = purple_api_controller.new_client();

  // Try to get the account info
  const response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(response.statusCode, 404);

  // Simulate IAP purchase on the iOS side

  purple_api_controller.set_account_uuid(user_pubkey_1, user_uuid); // Associate the pubkey with the user_uuid on the server
  const receipt_base64 = purple_api_controller.iap.get_iap_receipt_data(user_uuid);  // Get the receipt from the iOS side

  // Send the same receipt to the server 3 times
  const iap_response = await purple_api_controller.clients[user_pubkey_1].send_iap_receipt(user_uuid, receipt_base64);
  t.same(iap_response.statusCode, 200);
  const iap_response_2 = await purple_api_controller.clients[user_pubkey_1].send_iap_receipt(user_uuid, receipt_base64);
  t.same(iap_response_2.statusCode, 200);
  const iap_response_3 = await purple_api_controller.clients[user_pubkey_1].send_iap_receipt(user_uuid, receipt_base64);
  t.same(iap_response_3.statusCode, 200);

  // Read the account info now
  const account_info_response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response.statusCode, 200);
  t.same(account_info_response.body.pubkey, user_pubkey_1)
  t.same(account_info_response.body.created_at, purple_api_controller.current_time());
  t.same(account_info_response.body.expiry, MOCK_IAP_DATES[user_uuid].expiry_date);
  t.same(account_info_response.body.subscriber_number, 1);
  t.same(account_info_response.body.active, true);

  t.end();
});

// This flow is necessary in the following cases:
// - Subscriber uses TestFlight version which is not connected to the production IAP environment
// - Subscriber does not use the iOS app for several weeks and the receipt is no longer available from the local StoreKit API
// - Other conditions that may prevent the receipt/transaction ID from being sent from the user's device to the server.
test('IAP Flow — server to server renewal flow (no receipt sent from user device)', async (t) => {
  // Initialize the PurpleTestController and a client
  const purple_api_controller = await PurpleTestController.new(t);
  const user_pubkey_1 = purple_api_controller.new_client();

  // Set the current time to the time of the purchase, and associate the pubkey with the user_uuid on the server
  const user_uuid = MOCK_ACCOUNT_UUIDS[0]
  purple_api_controller.set_account_uuid(user_pubkey_1, user_uuid); // Associate the pubkey with the user_uuid on the server
  const entire_decoded_tx_history = purple_api_controller.iap.get_decoded_transaction_history(user_uuid)
  if (entire_decoded_tx_history.length != 2) {
    t.fail('Expected 2 transactions in the decoded transaction history. The test assumption is broken and it needs to be updated.')
    t.end()
    return
  }
  let [tx_1, tx_2] = entire_decoded_tx_history
  purple_api_controller.set_current_time(tx_1.purchaseDate/1000); // Set the current time to the time of the first purchase

  // Edit transaction history on our mock IAP controller so that it contains only one transaction for now.
  // We will re-add the second transaction later to simulate the renewal.
  const transaction_id = purple_api_controller.iap.get_transaction_id(user_uuid);
  let encoded_transaction_history = purple_api_controller.iap.get_transaction_history(transaction_id);
  purple_api_controller.iap.set_transaction_history(transaction_id, [encoded_transaction_history[0]]);

  // Try to get the account info
  const response = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(response.statusCode, 404); // Account should not exist yet

  // Simulate first IAP purchase on the iOS side
  // Send the receipt to the server to activate the account
  const iap_response = await purple_api_controller.clients[user_pubkey_1].send_transaction_id(user_uuid, transaction_id);
  t.same(iap_response.statusCode, 200);

  // Read the account info and check that the account is active
  const account_info_response_1 = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response_1.statusCode, 200);
  t.same(account_info_response_1.body.active, true);

  // Let's move the clock forward to just before the renewal date
  purple_api_controller.set_current_time(account_info_response_1.body.expiry - 60 * 1); // 1 minute before expiry

  // Read the account info again and check that the account is still active
  const account_info_response_2 = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response_2.statusCode, 200);
  t.same(account_info_response_2.body.active, true);

  // Let's move the clock forward to the purchase date of the 2nd transaction
  purple_api_controller.set_current_time(tx_2.purchaseDate/1000);

  // Now, let's add the 2nd transaction to the history again, to simulate that a renewal has occurred on the Apple server.
  purple_api_controller.iap.set_transaction_history(transaction_id, encoded_transaction_history);

  // "NO-OP" - The user does not send the receipt to the server this time

  // Move the clock forward 1 minute
  purple_api_controller.set_current_time(tx_2.purchaseDate/1000 + 60 * 1);

  // Read the account info again and check that the account is active
  const account_info_response_3 = await purple_api_controller.clients[user_pubkey_1].get_account();
  t.same(account_info_response_3.statusCode, 200);
  t.same(account_info_response_3.body.expiry, tx_2.expiresDate/1000);
  t.same(account_info_response_3.body.active, true);

  t.end();
});
