"use strict";
// @ts-check

const { nip04 } = require('nostr-tools')
const { v4: uuidv4 } = require('uuid')
const { current_time } = require('./utils')
const { finalizeEvent } = require('nostr-tools/pure')
const { Relay, useWebSocketImplementation } = require('nostr-tools/relay')
const { unauthorized_response } = require('./server_helpers')
useWebSocketImplementation(require('ws'))

const DEFAULT_SESSION_EXPIRY = 60 * 60 * 24 * 7 // 1 week
const DEFAULT_OTP_MAX_TRIES = 10  // 10 tries before an OTP is invalidated
const DEFAULT_OTP_EXPIRY = 60 * 5 // 5 minutes

/**
  * The WebAuthManager class manages OTP login and session management
*/
class WebAuthManager {
  /** Initializes the WebAuthManager
    * @param {object} dbs - The PurpleApi dbs object
  */
  constructor(dbs) {
    this.dbs = dbs
    this.otp_max_tries = process.env.OTP_MAX_TRIES || DEFAULT_OTP_MAX_TRIES
    this.session_expiry = process.env.SESSION_EXPIRY || DEFAULT_SESSION_EXPIRY
    this.otp_expiry = process.env.OTP_EXPIRY || DEFAULT_OTP_EXPIRY
  }

  // MARK: OTP Management

  /**
   * Generates a new OTP code for a given public key and stores it in the database
   * @param {string} pubkey - The public key of the user to generate an OTP for
   * @returns {Promise<string>} The generated OTP code
   */
  async generate_otp(pubkey) {
    // Generate a random 6-numeric-digit OTP code
    const otp_code = this.random_otp();
    const expiry_time = current_time() + this.otp_expiry;
    await this.dbs.otp_codes.put(pubkey, { otp_code: otp_code, expiry_time: expiry_time, tries: 0 });
    return otp_code;
  }

  /**
   * Sends an OTP code to a user's public key via Nostr DM
   * @param {string} pubkey - The public key of the user to send an OTP to
   * @param {string} otp_code - The OTP code to send
   */
  async send_otp(pubkey, otp_code) {
    const secret_key = process.env.OTP_NOSTR_SENDER_PRIVATE_KEY; // The private key of the sender
    const relays = process.env.RELAYS.split(','); // The Nostr relays to send the OTP through

    const encrypted_content = await nip04.encrypt(secret_key, pubkey, `Your OTP code is: ${otp_code}.\n\nWe will never ask for your OTP code or your nsec. Please beware of impersonators.`);

    const event = {
      pubkey,
      content: encrypted_content,
      kind: 4, // Kind 4 is for direct messages
      tags: [['p', pubkey]], // Tag the recipient's public key
      created_at: current_time(),
    };

    const signed_event = finalizeEvent(event, secret_key);

    for (let relay_url of relays) {
      try {
        const relay = await Relay.connect(relay_url);
        await relay.publish(signed_event);
        relay.close();
      } catch (error) {
        console.error(`Error sending OTP via relay ${relay_url}:`, error);
      }
    }
  }

  /**
   * Validates an OTP code for a given public key
   * @param {string} pubkey - The public key of the user to validate an OTP for
   * @param {string} otp_code - The OTP code to validate
   * @returns {Promise<boolean>} True if the OTP code is valid, false otherwise
   */
  async validate_otp(pubkey, otp_code) {
    const stored_data = await this.dbs.otp_codes.get(pubkey);
    if (!stored_data) {
      return false;
    }

    const { otp_code: stored_otp_code, expiry_time, tries } = stored_data;
    if (current_time() > expiry_time) {
      await this.dbs.otp_codes.del(pubkey); // Remove expired OTP
      return false;
    }
    if (tries >= this.otp_max_tries) {
      await this.dbs.otp_codes.del(pubkey); // Invalidate OTP after max tries
      return false;
    }
    if (otp_code !== stored_otp_code) {
      await this.dbs.otp_codes.put(pubkey, { otpCode: stored_otp_code, expiryTime: expiry_time, tries: tries + 1 });
      return false;
    }

    return otp_code === stored_otp_code;
  }

  // MARK: Utils

  /**
   * Generates a random 6-digit OTP code 
   * @returns {string} The generated OTP code
   */
  random_otp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // MARK: Session Management

  /**
   * Creates a new session for a user
   * @param {string} pubkey - The public key of the user to create a session for
   * @returns {Promise<string>} The session token
   */
  async create_session(pubkey) {
    const session_token = uuidv4();
    await this.dbs.sessions.put(session_token, { pubkey, created_at: current_time() });
    return session_token;
  }

  // MARK: Middleware

  /**
   * Middleware to check if a user is authenticated
   * @param {object} req - The Express request object
   * @param {object} res - The Express response object
   * @param {function} next - The next middleware function
   */
  async require_web_auth(req, res, next) {
    const auth_header = req.header('Authorization');
    if (!auth_header) {
      unauthorized_response(res, 'Unauthorized, no auth header');
      return;
    }

    const [auth_type, token] = auth_header.split(' ');
    if (auth_type !== 'Bearer') {
      unauthorized_response(res, 'Unauthorized, invalid auth type');
      return;
    }

    if (!token) {
      unauthorized_response(res, 'Unauthorized, no token');
      return;
    }

    const session_data = await this.dbs.sessions.get(token);
    if (!session_data) {
      unauthorized_response(res, 'Unauthorized, invalid token');
      return;
    }

    // Check if the session has expired
    if (current_time() - session_data.created_at > this.session_expiry) {
      await this.dbs.sessions.del(token);
      unauthorized_response(res, 'Unauthorized, session expired');
      return;
    }

    req.authorized_pubkey = session_data.pubkey;
    next();
  }
}


module.exports = { WebAuthManager }
