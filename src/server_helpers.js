const nip98_auth = require('./nip98_auth');

class Router {
    // MARK: - Constructors

    constructor(base_url) {
        this.routes = [];
        this.base_url = base_url;
    }

    // MARK: - Registering Routes

    get(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'GET'
        });
    }

    get_authenticated(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'GET',
            authenticated: true
        });
    }

    post(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'POST'
        })
    }

    post_authenticated(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'POST',
            authenticated: true
        })
    }

    put(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'PUT'
        })
    }

    put_authenticated(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'PUT',
            authenticated: true
        })
    }

    delete(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'DELETE'
        })
    }

    delete_authenticated(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'DELETE',
            authenticated: true
        })
    }

    // MARK: - Handling Requests

    handle_request(req, res) {
        console.log(`[ ${req.method} ] ${req.url}`);
        const route_match_info = this.find_route(req.url, req.method);

        if (!route_match_info || !route_match_info.route) {
            simple_response(res, 404);
			return;
        }

        var body = undefined;
        req.on('data', chunk => { 
            if(!chunk) return;
            if(chunk instanceof String) {
                body = body ? body + chunk : chunk;
                return;
            }
            else if(chunk instanceof Buffer) {
                body = body ? Buffer.concat([body, chunk]) : chunk;
                return;
            }
            else {
                body = body ? body + chunk.toString() : chunk.toString();
            }
        })
	    req.on('end', async () => {
            req.body = body;
            if(!route_match_info.route.authenticated) {
                route_match_info.route.handler(req, res, route_match_info.capture_groups);
                return;
            }
            else if(route_match_info.route.authenticated) {
                // Get Authorization header
                const auth_header = req.headers.authorization;
                // Check if it is valid
                let auth_pubkey = await nip98_auth(auth_header, this.base_url + req.url, req.method, req.body);
                if(!auth_pubkey) {
                    unauthorized_response(res, 'Nostr authorization header invalid');
                    return;
                }
                route_match_info.route.handler(req, res, route_match_info.capture_groups, auth_pubkey);
            }
        })
    }

    match_route(query_route, route_pattern) {
        const route_pattern_parts = route_pattern.split('/');
        const query_route_parts = query_route.split('/');

        if (route_pattern_parts.length !== query_route_parts.length) {
            return false;
        }

        const capture_groups = [];

        for (let i = 0; i < route_pattern_parts.length; i++) {
            const route_part = route_pattern_parts[i];
            const query_part = query_route_parts[i];

            let regex = new RegExp(route_part);

            if (regex.test(query_part)) {
                const capture_group = regex.exec(query_part)[1];
                capture_groups.push(capture_group);
            } else {
                return false;
            }
        }

        return capture_groups.filter(group => group !== undefined);
    }

    find_route(url, method) {
        for (let i = 0; i < this.routes.length; i++) {
            const route = this.routes[i];

            if (route.method === method) {
                const capture_groups = this.match_route(url, route.path);

                if (capture_groups) {
                    return {
                        route,
                        capture_groups
                    };
                }
            }
        }

        return undefined;
    }
}

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
	json_response, simple_response, invalid_request, error_response, Router
}
