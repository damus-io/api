"use strict";
// @ts-check

const { AppStoreServerAPIClient, Environment, ReceiptUtility, Order, ProductType, SignedDataVerifier } = require("@apple/app-store-server-library")
const { current_time } = require("./utils")
const fs = require('fs')

/**
 * Verifies the receipt data and returns the expiry date if the receipt is valid.
 *
 * @param {string} receipt_data - The receipt data to verify in base64 format.
 * @returns {Promise<number|null>} The expiry date of the receipt if valid, null otherwise.
 */
async function verify_receipt(receipt_data) {
    // Mocking logic for testing purposes
    if (process.env.MOCK_VERIFY_RECEIPT == "true") {
        return current_time() + 60 * 60 * 24 * 30;
    }

    // Setup the environment and client
    const rootCaDir = process.env.IAP_ROOT_CA_DIR || './apple-root-ca'
    const bundleId = process.env.IAP_BUNDLE_ID;
    const environment = getAppStoreEnvironmentFromEnv();
    const client = createAppStoreServerAPIClientFromEnv();
    
    // Get the transaction ID from the receipt
    const transactionId = extractTransactionIdFromAppReceipt(receipt_data);

    // If the transaction ID is present, fetch the transaction history, verify the transactions, and return the latest expiry date
    if (transactionId != null) {
        return await fetchLastVerifiedExpiryDate(client, transactionId, rootCaDir, environment, bundleId);
    }
    return Promise.resolve(null);
}

/**
 * Fetches transaction history with the App Store API, verifies the transactions, and returns the last valid expiry date.
 *
 * @param {AppStoreServerAPIClient} client - The App Store API client.
 * @param {string} transactionId - The transaction ID to fetch history for.
 * @param {string} rootCaDir - The directory containing Apple root CA certificates for verification.
 * @param {Environment} environment - The App Store environment.
 * @param {string} bundleId - The bundle ID of the app.
 
 * @returns {Promise<number|null>} The expiry date (As Unix timestamp measured in seconds) of the receipt if valid, null otherwise.
*/
async function fetchLastVerifiedExpiryDate(client, transactionId, rootCaDir, environment, bundleId) {
  const transactions = await fetchTransactionHistory(client, transactionId);
  const rootCAs = readCertificateFiles(rootCaDir);
  const decodedTransactions = await verifyAndDecodeTransactions(transactions, rootCAs, environment, bundleId);
  const expiryDates = decodedTransactions.map((decodedTransaction) => decodedTransaction.expiresDate);
  const latestExpiryDate = Math.max(...expiryDates);
  return latestExpiryDate / 1000; // Return the latest expiry date in seconds
}

const certificateCache = new Map();
/**
* Reads all certificate files from a directory.
*
* @param {string} directory - The directory containing certificate files.
* @returns {Buffer[]} An array of certificate file contents.
*/
function readCertificateFiles(directory) {
    const files = fs.readdirSync(directory);
    return files.map((fileName) => {
        const filePath = `${directory}/${fileName}`;
        if (!certificateCache.has(filePath)) {
            const fileContents = fs.readFileSync(filePath);
            certificateCache.set(filePath, fileContents);
        }
        return certificateCache.get(filePath);
    });
}

/**
 * Verifies and decodes a list of signed transactions.
 *
 * @param {string[]} transactions - The signed transactions to verify and decode.
 * @param {Buffer[]} rootCAs - Apple root CA certificate contents for verification.
 * @param {Environment} environment - The App Store environment.
 * @param {string} bundleId - The bundle ID of the app.
 * @returns {Promise<Object[]>} The decoded transactions.
 */
async function verifyAndDecodeTransactions(transactions, rootCAs, environment, bundleId) {
    const verifier = new SignedDataVerifier(rootCAs, true, environment, bundleId);
    let decodedTransactions = [];
    for (let transaction of transactions) {
        const decodedTransaction = await verifier.verifyAndDecodeTransaction(transaction);
        decodedTransactions.push(decodedTransaction);
    }
    return decodedTransactions;
}

/**
 * Fetches the transaction history for a given transaction ID.
 *
 * @param {AppStoreServerAPIClient} client - The App Store API client.
 * @param {string} transactionId - The transaction ID to fetch history for.
 * @returns {Promise<Object[]>} The transaction history.
 */
async function fetchTransactionHistory(client, transactionId) {
    // TODO: In the future we might need to make this query more specific to fetch only Purple-related products.
    const transactionHistoryRequest = {
        sort: Order.ASCENDING,
        revoked: false,
        productTypes: [ProductType.AUTO_RENEWABLE]
    };
    let response = null;
    let transactions = [];
    do {
        const revisionToken = response !== null && response.revision !== null ? response.revision : null;
        response = await client.getTransactionHistory(transactionId, revisionToken, transactionHistoryRequest);
        if (response.signedTransactions) {
            transactions = transactions.concat(response.signedTransactions);
            continue;
        }
    } while (response.hasMore);
    return transactions;
}

/**
 * Extracts the transaction ID from the app receipt.
 * 
 * @param {string} receipt_data - The receipt data to extract the transaction ID from. (In base64 format)
*/
function extractTransactionIdFromAppReceipt(receipt_data) {
  const receiptUtil = new ReceiptUtility();
  const transactionId = receiptUtil.extractTransactionIdFromAppReceipt(receipt_data);
  return transactionId;
}

/**
 * Instantiates an AppStoreServerAPIClient with the environment variables as configuration.
 * 
 * @returns {AppStoreServerAPIClient} The App Store API client.
*/
function createAppStoreServerAPIClientFromEnv() {
  const issuerId = process.env.IAP_ISSUER_ID;
  const keyId = process.env.IAP_KEY_ID;
  const bundleId = process.env.IAP_BUNDLE_ID;
  const filePath = process.env.IAP_PRIVATE_KEY_PATH;
  const encodedKey = fs.readFileSync(filePath, "utf8");
  const environment = getAppStoreEnvironmentFromEnv();

  return new AppStoreServerAPIClient(encodedKey, keyId, issuerId, bundleId, environment);
}

/** 
 * Gets the App Store environment from the environment variables.
 * 
 * @returns {Environment} The App Store environment.
*/
function getAppStoreEnvironmentFromEnv() {
  return process.env.IAP_ENVIRONMENT === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
}

module.exports = {
    verify_receipt
};
