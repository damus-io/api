const { AppStoreServerAPIClient, Environment, ReceiptUtility, Order, ProductType } = require("@apple/app-store-server-library")
const { current_time } = require("./utils")


async function verify_receipt(receipt_data) {
    if(process.env.MOCK_VERIFY_RECEIPT) {
        return current_time() + 60 * 60 * 24 * 30
    }

    const issuerId = process.env.IAP_ISSUER_ID
    const keyId = process.env.IAP_KEY_ID
    const bundleId = process.env.IAP_BUNDLE_ID
    const filePath = process.env.IAP_PRIVATE_KEY_PATH
    const encodedKey = fs.readFileSync(filePath, "utf8")
    const environment = process.env.IAP_ENVIRONMENT === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION

    const client = new AppStoreServerAPIClient(encodedKey, keyId, issuerId, bundleId, environment)

    const appReceipt = receipt_data
    const receiptUtil = new ReceiptUtility()
    const transactionId = receiptUtil.extractTransactionIdFromAppReceipt(appReceipt)
    if (transactionId != null) {
        const transactionHistoryRequest = {
            sort: Order.ASCENDING,
            revoked: false,
            productTypes: [ProductType.AUTO_RENEWABLE]
        }
        let response = null
        let transactions = []
        do {
            const revisionToken = response !== null && response.revision !== null ? response.revision : null
            response = await client.getTransactionHistory(transactionId, revisionToken, transactionHistoryRequest)
            if (response.signedTransactions) {
                transactions = transactions.concat(response.signedTransactions)
                return
            }
        } while (response.hasMore)
        console.log(transactions)
    }
    return null     // TODO: Return expiry date
}

module.exports = {
    verify_receipt
}
