/**
 * FakePay class - A stub for the server side payment gateway.
 * Loosely emulates the Razorpay nodejs sdk
 * see for details https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/
 */
class FakePay {
  /**
   * @param {Object} options key_id and key_secret
   */
  constructor(options) {
    this.orders = new Orders();
  }
}

/**
 * Orders class - Accessed by FakePay
 */
class Orders {
  /**
   * Generate a random payment order id
   * @return {String}
   */
  generateOrderId() {
    return "fakepay_order_" + Math.random().toString(16).substring(2);
  }

  /**
   * @param {Object} params
   * @param {Function} callback(err, order)
   */
  create(params, callback) {
    const { amount, currency, receipt } = params;

    callback(null, {
      id: this.generateOrderId(),
      entity: "order",
      amount: amount,
      amount_paid: 0,
      amount_due: amount,
      currency: currency,
      receipt: receipt,
      status: "created",
      attempts: 0,
      notes: [],
      created_at: Date.now(),
    });
  }
}

module.exports = FakePay;
