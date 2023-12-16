const nostr = require('nostr');
const { hash_sha256, current_time } = require('./utils');

// Note: nostr-tools contains NIP-98 related functions, but they do not check the payload hash and do not return the authorized pubkey, so they are not secure enough.
// TODO: Integrate this into a library such as `nostr`


// nip98_auth
//
// Validate the authorization header of a request according to NIP-98
//
// auth_header: The authorization header of the request (`Nostr <base64_note>`)
// url: The url of the request
// method: The method of the request
// body: The body of the request
// returns: the pubkey (hex) of the authorized user or null if not authorized
async function nip98_auth(auth_header, url, method, body) {
    try {
        if(!auth_header) {
            return null;
        }
    
        auth_header_parts = auth_header.split(' ');
        if(auth_header_parts.length != 2) {
            return null;
        }
    
        if(auth_header_parts[0] != 'Nostr') {
            return null;
        }
    
        // Get base64 encoded note
        const base64_encoded_note = auth_header.split(' ')[1];
        if(!base64_encoded_note) {
            return null;
        }
    
        let note = JSON.parse(Buffer.from(base64_encoded_note, 'base64').toString('utf-8'));
        if(!note) {
            return null;
        }
    
        if(note.kind != 27235) {
            return null;
        }
    
        let authorized_url = note.tags.find(tag => tag[0] == 'u')[1];
        let authorized_method = note.tags.find(tag => tag[0] == 'method')[1];
        if(authorized_url != url || authorized_method != method) {
            return null;
        }
    
        if(current_time() - note.created_at > 60 || current_time() - note.created_at < 0) {
            return null;
        }
    
        if(body !== undefined && body !== null) {
            let authorized_content_hash = note.tags.find(tag => tag[0] == 'payload')[1];

            let body_hash = hash_sha256(body);
            if(authorized_content_hash != body_hash) {
                return null;
            }
        }
        else {
            // If there is no body, there should be NO payload tag
            if(note.tags.find(tag => tag[0] == 'payload')) {
                return null;
            }
        }
    
        // Verify that the ID corresponds to the note contents
        if(note.id != await nostr.calculateId(note)) {
            return null;
        }
    
        // Verify the ID was signed by the alleged pubkey
        let signature_valid = await nostr.verifyEvent(note);
        if(!signature_valid) {
            return null;
        }
    
        return note.pubkey;
    } catch (error) {
        console.log(error);
        return null;
    }
}

module.exports = nip98_auth;
