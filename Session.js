/**
 * @fileOverview Wirebug Session class.
 * @author <a href="http://paulcuth.me.uk">Paul Cuthbertson</a>
 */
 
 
/**
 * A session, involving one remote device and one console.
 * @constructor
 * @param {object} [config] Configuration settings.
 *	@config {number} sessionId Identifier of the session.
 *	@config {function} terminate Function to execute when the session is terminated.
 *	@config {Socket.io.client} [remote] If included, sets the remote client.
 * @property {number} _id Identifier of the session.
 * @property {function} _terminateCallback Function to execute when the session is terminated.
 * @property {function} console The Socket.io client object for the console connection.
 * @property {function} remote The Socket.io client object for the remote connection.
 * @throws {Error} Session count exceeded maximum allowed. 
 */
 var Session = function (config) {
	config = config || {};
	
	if (Session.count >= Session.LIMIT) throw new Error ('Session limit met. Please try again later.');

	Session.count++;
	Session.total++;
	
	this._id = config.sessionId;
	this._terminateCallback = config.terminate;

	if (config.remote) this.connectRemote (config.remote);
};


/**
 * The number of currently active connections.
 * @type number
 */
Session.count = 0;

/**
 * The total number of connections since restart.
 * @type number
 */
Session.total = 0;

/**
 * The maximum number of connection at any one point in time.
 * @type number
 * @constant
 */
Session.LIMIT = 250;




/**
 * Handles a new connection from the console.
 * @param {object} client The Socket.io client object created in the connection event.
 * @param {number} id The id of the console prompt that initiated the connection.
 */
Session.prototype.connectConsole = function (client, id) {
	var me = this;

	this.console = client;

	client.send ({ id: id, connected: true, message: 'Remote connected.' });
	if (this.remote) this.remote.send ({ message: 'Wirebug Session Id: ' + this._id + ' [Connected]' });


	client.on ('disconnect', function () {
	 	if (me.remote) me.remote.send ({ message: 'Wirebug Session Id: ' + me._id });
		delete (me.console);

		me._handleDisconnect (client);
	});
};




/**
 * Handles a new connection from the remote browser.
 * @param {object} client The Socket.io client object created in the connection event.
 */
Session.prototype.connectRemote = function (client) {
	var me = this;

	this.remote = client;

	client.send ({ sessionId: this._id, message: 'Wirebug Session Id: ' + this._id + (this.console? ' [Connected]' : '') });
	if (this.console) this.console.send ({ connected: true, message: 'Remote connected.' });


	client.on ('disconnect', function () {
		if (me.console) me.console.send ({ message: 'Remote disconnected.' });
		delete (me.remote);
	 	
		me._handleDisconnect (client);
	});
};




/**
 * Handles either connection being dropped.
 * @param {object} client The Socket.io client object created in the connection event.
 */
Session.prototype._handleDisconnect = function (client) {

	if (!this.console && !this.remote) this.terminate ();
};




/**
 * Terminates the session.
 */
Session.prototype.terminate = function () {
	Session.count--;
	
	if (this._terminateCallback) this._terminateCallback ();
};




exports.Session = Session;