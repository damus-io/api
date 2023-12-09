class Router {
    // MARK: - Constructors

    constructor() {
        this.routes = [];
    }

    // MARK: - Registering Routes

    get(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'GET'
        });
    }

    post(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'POST'
        })
    }

    put(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'PUT'
        })
    }

    delete(path, handler) {
        this.routes.push({
            path,
            handler,
            method: 'DELETE'
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

        var body = '';
        req.on('data', chunk => { body += chunk.toString(); })
	    req.on('end', () => {
            req.body = body;
            route_match_info.route.handler(req, res, route_match_info.capture_groups);
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

function json_response(res, json, code=200) {
	res.writeHead(code, {'Content-Type': 'application/json'})
	res.end(JSON.stringify(json) + "\n")
}

module.exports = {
	json_response, simple_response, invalid_request, error_response, Router
}
