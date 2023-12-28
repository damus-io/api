const nostr = require('nostr');
const { hash_sha256, current_time } = require('./utils');
const { unauthorized_response } = require('./server_helpers');
const bodyParser = require('body-parser');

// Note: nostr-tools contains NIP-98 related functions, but they do not check the payload hash and do not return the authorized pubkey, so they are not secure enough.
// TODO: Integrate this into a library such as `nostr`


// nip98_verify_auth_header
//
// Validate the authorization header of a request according to NIP-98
//
// auth_header: The authorization header of the request (`Nostr <base64_note>`)
// url: The url of the request
// method: The method of the request
// body: The body of the request
// returns: the pubkey (hex) of the authorized user or null if not authorized
async function nip98_verify_auth_header(auth_header, url, method, body) {
  try {
    if (!auth_header) {
      return { authorized_pubkey: null, error: 'Nostr authorization header missing' };
    }

    auth_header_parts = auth_header.split(' ');
    if (auth_header_parts.length != 2) {
      return { authorized_pubkey: null, error: 'Nostr authorization header does not have 2 parts' };
    }

    if (auth_header_parts[0] != 'Nostr') {
      return { authorized_pubkey: null, error: 'Nostr authorization header does not start with `Nostr`' };
    }

    // Get base64 encoded note
    const base64_encoded_note = auth_header.split(' ')[1];
    if (!base64_encoded_note) {
      return { authorized_pubkey: null, error: 'Nostr authorization header does not have a base64 encoded note' };
    }

    let note = JSON.parse(Buffer.from(base64_encoded_note, 'base64').toString('utf-8'));
    if (!note) {
      return { authorized_pubkey: null, error: 'Could not parse base64 encoded JSON note' };
    }

    if (note.kind != 27235) {
      return { authorized_pubkey: null, error: 'Auth note kind is not 27235' };
    }

    let authorized_url = note.tags.find(tag => tag[0] == 'u')[1];
    let authorized_method = note.tags.find(tag => tag[0] == 'method')[1];
    if (authorized_url != url || authorized_method != method) {
      return { authorized_pubkey: null, error: 'Auth note url and/or method does not match request. Auth note url: ' + authorized_url + '; Request url: ' + url + '; Auth note method: ' + authorized_method + '; Request method: ' + method };
    }

    if (current_time() - note.created_at > 60 || current_time() - note.created_at < 0) {
      return { authorized_pubkey: null, error: 'Auth note is too old or too new' };
    }

    if (body !== undefined && body !== null) {
      let authorized_content_hash = note.tags.find(tag => tag[0] == 'payload')[1];

      let body_hash = hash_sha256(body);
      if (authorized_content_hash != body_hash) {
        return { authorized_pubkey: null, error: 'Auth note payload hash does not match request body hash' };
      }
    }
    else {
      // If there is no body, there should be NO payload tag
      if (note.tags.find(tag => tag[0] == 'payload')) {
        return { authorized_pubkey: null, error: 'Auth note has payload tag but request has no body' };
      }
    }

    // Verify that the ID corresponds to the note contents
    if (note.id != await nostr.calculateId(note)) {
      return { authorized_pubkey: null, error: 'Auth note id does not match note contents' };
    }

    // Verify the ID was signed by the alleged pubkey
    let signature_valid = await nostr.verifyEvent(note);
    if (!signature_valid) {
      return { authorized_pubkey: null, error: 'Auth note signature is invalid' };
    }

    return { authorized_pubkey: note.pubkey, error: null };
  } catch (error) {
    return { authorized_pubkey: null, error: "Error when checking auth header: " + error.message };
  }
}

// capture_raw_body
//
// A middleware to be used as a verify function for the express.js body parser
// This middleware will capture the raw body of the request and expose it as `req.raw_body`
function capture_raw_body(req, res, buf, encoding) {
  req.raw_body = buf;
}

// Custom express.js authentication middleware
// This middleware will verify the authorization header according to NIP-98
// and attach the authorized pubkey to the request object
//
// Please make sure to use another middleware to capture the raw body of the request and exponse it as `req.raw_body`
async function optional_nip98_auth(req, res, next) {
  const auth_header = req.headers.authorization;
  const full_url = req.protocol + '://' + req.get('Host') + req.originalUrl;

  if ((req.raw_body === undefined || req.raw_body === null) && (req.body !== undefined && req.body !== null && Object.keys(req.body).length > 0)) {
    throw new Error('raw_body is not defined in request object. Please make sure to use some middleware to capture the raw body and expose it to req.raw_body');
  }

  const { authorized_pubkey, error } = await nip98_verify_auth_header(auth_header, full_url, req.method, req.raw_body);

  // Attach the public key to the request object
  req.authorized_pubkey = authorized_pubkey;
  req.auth_error = error;

  // Proceed to the route handler
  next();
}

// require_nip98_auth
//
// A simple middleware that rejects the request if there is no authorized_pubkey attached to the request object
// This is useful for routes that require authentication. Use this middleware alongside nip98_verify
async function required_nip98_auth(req, res, next) {
  await optional_nip98_auth(req, res, () => {
    if (!req.authorized_pubkey) {
      return unauthorized_response(res, req.auth_error);
    }
    next();
  });
}

module.exports = {
  nip98_verify_auth_header, optional_nip98_auth, required_nip98_auth, capture_raw_body
};

