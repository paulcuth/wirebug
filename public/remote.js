/**
 * @fileOverview The Wirebug console.
 * @author <a href="http://paulcuth.me.uk">Paul Cuthbertson</a>
 */




/**
 * Used to detect if page is already being debugged or is the console.
 * @type object
 */
var wirebug,

/**
 * Overrides native console.log function, so must create console if it doesn't exist.
 * @type object
 */
	console;




(function () {

	// Don't run twice.
	if (wirebug) return;
	wirebug = {};
	

	/**
	 * Script element to load in Socket.io functionality.
	 * @type HTMLScriptElement
	 */
	var socketScript = document.createElement ('script'),
	
	/**
	 * Main Wirebug remote functionality.
	 * @type function
	 */
		main = function () {	
	
			/**
			 * DOM element inserted into remote page.
			 * @type HTMLDivElement
			 */
			var	messageBox,
	
			/**
			 * Socket.io comms object.
			 * @type object
			 */
				socket = new io.Socket ('<?= HOST ?>', { port: parseInt ('<?= PORT ?>', 10) || 80, rememberTransport: false });
	
	
	
	
			/**
			 * Attempts to connect to the Wirebug server.
			 */
			function connect () {

				socket.on ('connect', function () {
					// Get existing Session Id from cookie
					var sessionId = document.cookie.match (/(.*;\s*)*wirebug-session=(\d+)/);
					sessionId = sessionId? parseInt (sessionId[2], 10) : null;
	
					socket.send ({ connectRemote: sessionId });
				});

				socket.on ('connect_failed', function () {
					messageBox.innerHTML = 'Wirebug connection failed.';
				});

				socket.on ('message', function (obj) {
					processMessage (obj);
				
					if (obj.sessionId) {
						document.cookie = 'wirebug-session=' + obj.sessionId;
	
						// Override console.log ()
						if (!console) console = {};
						console.log = function (value) {
							socket.send ({
								response: format (value)
							});
						};
					}
				});
				
				socket.connect ();	
			}
	
	
	
	
			/**
			 * Handles a message from the server.
			 * @param {object} data Data from the server.
			 */
			function processMessage (data) {
				var response,
					body = document.getElementsByTagName ('body')[0];
	
				if (data.message) {
					messageBox.innerHTML = data.message;
	
				} else if (data.command) {
					body.removeChild (messageBox);
	
					window.setTimeout (function () {
						try {
							response = eval (window.decodeURI (data.command));
			
						} catch (e) {
							response = e;
						}
	
						socket.send ({
							id: data.id,
							response: format (response)
						});
	
						body.appendChild (messageBox);
					}, 1);
			
					return;
				}
			}
	
	
	
	
			/**
			 * Formats a data object to be returned to the server.
			 * @param {object} obj The object to be formatted.
			 * @param {boolean} shallow If true, do not format deeper propery values.
			 */
			function format (obj, shallow) {
			
				switch (typeof obj) {
				
					case 'string':
						if (shallow && obj.length > 250) return { __wirebug: 4, intro: obj.substr (0, 250) };
				
					case 'number':
						return obj;
				
					case 'function':
						return { __wirebug: 1, name: (obj.toString? obj.toString () : obj) };
	
					case 'undefined':
						return { __wirebug: 2 };
	
					case 'object':
	
						if (obj === null) return null;
						if (obj instanceof Error) return { __wirebug: 3, message: obj.message };
	
						if (shallow) return { __wirebug: 0, name: (obj.toString? obj.toString ().replace ('"', '\\"') : obj.constructor? obj.constructor.name : '[object]') };
	
						var isArray = obj instanceof Array,
							result = isArray? [] : {};
				
						try {
							for (var i in obj) {
		
								if (isArray) {
									result.push (format (obj[i], true));
		
								} else {
									// Catch FF domConfig oddities
									try {
										result[i] = format (obj[i], true);
						
									} catch (e) {
										result[i] = { __wirebug: 3, message: e.message };
									}
								}
							}
	
						} catch (e) {
							result[i] = { __wirebug: 3, message: e.message };
						}
	
						return result;				
				}
			}
	
	
		
	
			/**
			 * Initialises the message box element, to be inserted into the page.
			 */
			function initMessageBox () {
			
				messageBox = document.createElement ('div');
				messageBox.innerHTML = 'Wirebug initialising&hellip;';
	
				var body = document.getElementsByTagName ('body')[0];
					style = {
						position: 'fixed',
						top: '20px',
						right: '20px',
						padding: '8px 16px',
						backgroundColor: '#118811',
						fontFamily: 'monospace',
						fontSize: '13px',
						color: '#fff',
						borderRadius: '8px',
						MozBorderRadius: '8px',
						WebkitBorderRadius: '8px',
						zIndex: 999
					};
		
				for (var i in style) messageBox.style[i] = style[i];
				if (body) body.appendChild (messageBox);
			}
	
	
	
	
			// Wirebug init
		
			initMessageBox ();
			connect (); 
		
		};


	// Load Socket.io script...
	socketScript.src = 'http://<?= ROOT_URL ?>/socket.io/socket.io.js';
	document.getElementsByTagName ('head')[0].appendChild (socketScript);


	// ...Once loaded, execute Wirebug remote code.
	if (socketScript.addEventListener) {
    	socketScript.addEventListener ('load', main);

	} else {
		// IE doesn't have a load event on script tag, so use timeout and look for "io" object.

		var check = function () {
			if (window.io) {
				main ();
			} else {
				window.setTimeout (check, 100);
			}
		};
		
		check ();
	}

		
})();