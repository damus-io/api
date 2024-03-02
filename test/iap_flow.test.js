"use strict";
// @ts-check

const test = require('tap').test;
const { PurpleTestController } = require('./controllers/purple_test_controller.js');
const { PURPLE_ONE_MONTH } = require('../src/invoicing.js');
const { MOCK_ACCOUNT_UUIDS, MOCK_IAP_DATES, MOCK_RECEIPT_DATA } = require('./controllers/mock_iap_controller.js');

test('IAP Flow — Expected flow', async (t) => {
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
