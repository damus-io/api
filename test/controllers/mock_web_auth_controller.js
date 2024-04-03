"use strict";

class MockWebAuthController {
  // MARK: - Initializers

  /**
   * Initializes the MockWebAuthController
   * 
   * @param {Object} t - The test object from Node tap
   * @param {WebAuthManager} web_auth_manager - The WebAuthManager class to mock
   */
  constructor(t, web_auth_manager) {
    this.t = t
    this.web_auth_manager = web_auth_manager
    this.next_otp = "123456"
    this.setup_web_auth_manager_mocks()
  }

  // MARK: - Control functions

  set_next_random_otp(otp) {
    this.next_otp = otp
  }

  // MARK: - Mocking setup

  setup_web_auth_manager_mocks() {
    const old_send_otp = this.web_auth_manager.send_otp
    this.web_auth_manager.send_otp = async(pubkey, otpCode) => {
      return    // No need to do anything
    }
    const old_random_otp = this.web_auth_manager.random_otp
    this.web_auth_manager.random_otp = () => {
      return this.next_otp  // Return the next OTP
    }
    this.t.teardown(() => {
        this.web_auth_manager.send_otp = old_send_otp
        this.web_auth_manager.random_otp = old_random_otp
    });
  }
}

module.exports = {
    MockWebAuthController
}
