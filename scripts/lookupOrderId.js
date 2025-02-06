const { AppStoreServerAPIClient, SignedDataVerifier } = require("@apple/app-store-server-library");
require("dotenv").config();
const fs = require('fs');

function createAppStoreServerAPIClientFromEnv() {
    const issuerId = process.env.IAP_ISSUER_ID;
    const keyId = process.env.IAP_KEY_ID;
    const bundleId = process.env.IAP_BUNDLE_ID;
    const filePath = process.env.IAP_PRIVATE_KEY_PATH;
    const encodedKey = fs.readFileSync(filePath, "utf8");
    const environment = process.env.IAP_ENVIRONMENT === "Sandbox" ? "Sandbox" : "Production";

    return new AppStoreServerAPIClient(encodedKey, keyId, issuerId, bundleId, environment);
}

async function lookUpOrder(orderId) {
    const client = createAppStoreServerAPIClientFromEnv();
    const rootCaDir = process.env.IAP_ROOT_CA_DIR || './apple-root-ca';
    const bundleId = process.env.IAP_BUNDLE_ID;
    const environment = process.env.IAP_ENVIRONMENT;

    try {
        const transactions = await client.lookUpOrderId(orderId);
        const rootCAs = readCertificateFiles(rootCaDir);
        const decodedTransactions = await verifyAndDecodeTransactions(transactions.signedTransactions, rootCAs, environment, bundleId);
        const transactionIds = decodedTransactions.map(transaction => transaction.transactionId);
        console.log("Transaction IDs:", transactionIds);
    } catch (error) {
        console.error("Error looking up order ID:", error);
    }
}

function readCertificateFiles(directory) {
    const files = fs.readdirSync(directory);
    return files.map((fileName) => {
        const filePath = `${directory}/${fileName}`;
        return fs.readFileSync(filePath);
    });
}

async function verifyAndDecodeTransactions(transactions, rootCAs, environment, bundleId) {
    const verifier = new SignedDataVerifier(rootCAs, true, environment, bundleId);
    let decodedTransactions = [];
    for (let transaction of transactions) {
        const decodedTransaction = await verifier.verifyAndDecodeTransaction(transaction);
        decodedTransactions.push(decodedTransaction);
    }
    return decodedTransactions;
}

const orderId = process.argv[2];
if (!orderId) {
    console.error("Please provide an order ID as a command line argument.");
    process.exit(1);
}

lookUpOrder(orderId);