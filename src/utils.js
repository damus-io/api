const { createHash }  = require('crypto')

function hash_sha256(data)
{
	return createHash('sha256').update(data).digest().toString('hex');
}

function current_time() {
	return Math.floor(Date.now() / 1000);
}

module.exports = {
    hash_sha256,
    current_time
}
