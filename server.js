/**
 * @fileOverview The main Wirebug server, to be executed in Node.js.
 * @author <a href="http://paulcuth.me.uk">Paul Cuthbertson</a>
 */



/**
 * Node's system object.
 * @type object 
 */
var sys = require ('sys'),

/** 
 * Node's http object.
 * @type object 
 */
	http = require ('http'),

/** 
 * Socket.io by Guillermo Rauch (https://github.com/LearnBoost/Socket.IO-node).
 * @type object 
 */
	socket = require ('./vendor/Socket.IO-node/'),

/** 
 * Session class.
 * @type object 
 */
	session = require ('./Session.js'),

/** 
 * Application settings.
 * @type object 
 */
	settings = require ('./settings.js'),
	
/** 
 * Array of active sessions.
 * @type array
 */
	sessions = {},

/** 
 * The public HTTP server.
 * @type object
 */
	server,
	
/** 
 * The Socket.io instance.
 * @type object
 */
	io;




/**
 * Outputs the contents of a file to an HTTP response.
 * @param {string} filename Path to the file to output.
 * @param {object} response The HTTP response to send through.
 * @param {object} [vars] Key/value pairs to replace with in the file content.
 */
function servePage (filename, response, vars) {

	var path = require ('path');

	path.exists (filename, function (exists) {

		if (exists) {
			var fs = require ('fs'),
				encoding = filename.match (/.*\.png$/)? null : 'ascii';
				
			fs.readFile (filename, encoding, function (err, output) {
				var type,
					index;

				if (!encoding) {
					type = 'image/png';
					
				} else {
					// Insert variable content
					output = output.replace (/<\?=\s*HOST\s*\?>/g, settings.HOST);
					output = output.replace (/<\?=\s*PORT\s*\?>/g, settings.PORT);
					output = output.replace (/<\?=\s*ROOT_URL\s*\?>/g, settings.HOST + ((settings.PORT === 80)? '' : ':' + settings.PORT));
		
					for (index in vars) output = output.replace (new RegExp (index, 'g'), vars[index]);

					// Calculate content type based on file extension
					if (filename.match (/.*\.html$/)) type = 'text/html';
					if (filename.match (/.*\.css$/)) type = 'text/css';
				}

				// Output content
			    writeResponse (response, output, 200, type);
			});

		} else {

			// If file does not exist, output 404
			writeResponse (response, 'File not found', 404, null)
		}
	});
};




/**
 * Sends an HTTP response.
 * @param {object} response The HTTP response to send through.
 * @param {string} output Content to send.
 * @param {number} [status=200] HTTP status code.
 * @param {string} [type='text/javascript'] Content type.
 */
function writeResponse (response, output, status, type) {

	var headers = { 'Content-Type': type || 'text/javascript' };
	if (!status) status = 200;
	
    response.writeHead (status, headers);
    response.write (output);
    response.end ();
}




/**
 * Outputs server status.
 * @param {object} response The http response object to which to write.
 */
function writeStatus (response) {
	writeResponse (response, 'Total sessions: ' + session.Session.total + '\nActive sessions: ' + session.Session.count + '\n', 200, 'text/plain');
};




/**
 * Creates a new session
 * @returns {number} The Session Id of the new session.
 */
function createSession () {
	var sessionId;
	
	do {
		sessionId = Math.floor (Math.random () * 89999 + 10000);
	} while (sessions[sessionId]);
	

	sessions[sessionId] = new session.Session ({
		sessionId: sessionId,
		terminate: function () {
			delete sessions[sessionId];
		}
	});
		
	return sessionId;
}




/**
 * Handles a new connection from Socket.io.
 * @param {object} client The Socket.io client object created in the connection event.
 */
function handleSocketConnect (client) {

	var sessionId,
		remote;
	
	// Add new message handler
	client.on ('message', function (data) {

		if (!sessionId) {
			// Not connected

			if (data.connectRemote !== undefined) {
				// Remote connection
				
				sessionId = (data.connectRemote && sessions[data.connectRemote])? data.connectRemote : null;
				if (!sessionId) sessionId = createSession ();
				
				remote = true;
				sessions[sessionId].connectRemote (client);
				

			} else if (data.connectConsole) {
				// Console connection
				
				if (!sessions[data.connectConsole]) {
					client.send ({ id: data.id, connectError: true, message: 'Session invalid or expired.' });

				} else if (sessions[data.connectConsole].console) {
					client.send ({ id: data.id, connectError: true, message: 'Another console is already connected to this session.' });

				} else {
					sessionId = data.connectConsole;
					sessions[sessionId].connectConsole (client, data.id);					
				}				
			}

		} else {
			// Already connected

			if (!sessions[sessionId]) {
				client.send ({ id: data.id, connectError: true, message: 'Session invalid or expired.' });
				
			} else {
				var receiver = sessions[sessionId][remote? 'console' : 'remote'];
	
				if (!receiver) {
					client.send ({ 
						id: data.id,
						message: 'Receiver not connected.'
					});
					
				} else {
					receiver.send (data);
				}
			}
		}
		
	});
};






// Init

server = http.createServer (function (request, response) {
	var url = request.url;
	
	// Shortcuts and special cases
	if (url == '/') {
		url = '/index.html';
	} else if (url == '/console') {
		url = '/console.html';
	} else if (url == '/status' && request.socket.remoteAddress === '127.0.0.1') {
		return writeStatus (response);
	}
	
	servePage ('./public' + url, response);
}),

server.listen (settings.PORT);


io = socket.listen (server);

io.on ('connection', function (client) {
	handleSocketConnect (client);
});



