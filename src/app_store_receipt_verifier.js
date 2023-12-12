const { AppStoreServerAPIClient, Environment, ReceiptUtility, Order, ProductType } = require("@apple/app-store-server-library")


async function verify_receipt(receipt_data) {
    if(process.env.MOCK_VERIFY_RECEIPT) {
        return Date.now() + 1000 * 60 * 60 * 24 * 30
    }

    const issuerId = "99b16628-15e4-4668-972b-eeff55eeff55"
    const keyId = "ABCDEFGHIJ"
    const bundleId = "com.jb55.damus2"
    const filePath = "/path/to/key/SubscriptionKey_ABCDEFGHIJ.p8"
    const encodedKey = fs.readFileSync(filePath, "utf8")
    const environment = Environment.SANDBOX

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
