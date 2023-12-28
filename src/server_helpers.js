// MARK: - Response Helpers

function invalid_request(res, message) {
	return json_response(res, { error: message || "invalid request" }, 400) 
}

function simple_response(res, code)
{
	res.writeHead(code)
	res.end()
}

function error_response(res, message, code=500) {
	res.writeHead(code, {'Content-Type': 'application/json'})
	res.end(JSON.stringify({error: message}) + "\n")
}

function unauthorized_response(res, message) {
    res.writeHead(401, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({error: message}) + "\n")
}

function json_response(res, json, code=200) {
	res.writeHead(code, {'Content-Type': 'application/json'})
	res.end(JSON.stringify(json) + "\n")
}

module.exports = {
	json_response, simple_response, invalid_request, error_response, unauthorized_response
}
