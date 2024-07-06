const { createHash }  = require('crypto')

// These functions are being defined in an object for easy mocking in tests
var utils = {
    current_time: () => {
        return Math.floor(Date.now() / 1000);
    }
}

function hash_sha256(data)
{
	return createHash('sha256').update(data).digest().toString('hex');
}

function current_time() {
	return utils.current_time();
}

function deep_copy(obj) {
    return JSON.parse(JSON.stringify(obj))
  }

module.exports = {
    hash_sha256,
    current_time,
    utils,
    deep_copy
}
