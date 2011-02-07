/**
 * @fileOverview The Wirebug console.
 * @author <a href="http://paulcuth.me.uk">Paul Cuthbertson</a>
 */


// For IE
document.createElement ('section');


/**
 * @namespace Holds exposed functionality and is used to block debugging of self.
 */
var wirebug = {};


(function () {
	
	/**
	 * Array of previously executed commands, for easy recall.
	 * @type array
	 */
	var commands = [],

	/**
	 * Array of previous prompts, for use with displaying responses and expanding results.
	 * @type array
	 */
		prompts = [],

	/**
	 * Whether or not the console is connected to a session.
	 * @type boolean
	 */
		connected = false,

	/**
	 * Socket.io comms object.
	 * @type object
	 */
		socket = new io.Socket (null, { port: parseInt ('<?= PORT ?>', 10) || 80, rememberTransport: false });




	/**
	 * Creats a new prompt for entering a Session Id.
	 */
	function createSessionPrompt () {
		var id = prompts.length,
			prompt = {};
			
		prompt.element = $('<p>').addClass ('prompt session-prompt').appendTo ('#console')[0];
		prompt.input = $('<input>').appendTo (prompt.element).focus ()[0];

		$('<span>').html ('Session Id? ').prependTo (prompt.element);	
		prompts.push (prompt);

		$(prompt.input).keydown (function (e) {
			if (e.keyCode === 13) connect (this.value, id);
		});
	}
	
	
	
	
	/**
	 * Creates a new prompt for sending commands.
	 */
	function createCommandPrompt () {
	
		var id = prompts.length,
			prompt = {};

		prompt.element = $('<p>').addClass ('prompt').appendTo ('#console')[0];
		prompt.input = $('<input>').appendTo (prompt.element).focus ()[0];
	
		prompts.push (prompt);
		commands.currentIndex = -1;

		
		$(prompt.input).keydown (function (e) {
			this.focus ();
			
			switch (e.keyCode) {
			
				case 13:	// Enter
				
					runPrompt ();
					break;
					
				
				case 38:	// Up
				
					if (commands.currentIndex-- === -1) commands.currentIndex = commands.length - 1;
					
					if (commands.currentIndex >= 0) {
						this.value = commands[commands.currentIndex];
					} else {
						this.value = '';
					}
				
					e.preventDefault ();
					break;
				
	
				case 40:	// Down
				
					if (commands.currentIndex++ === commands.length - 1) commands.currentIndex = -1;
					
					if (commands.currentIndex >= 0) {
						this.value = commands[commands.currentIndex];
					} else {
						this.value = '';
					}
	
					e.preventDefault ();					
					break;
					
					
				default:
					commands.currentIndex = -1;
				
			}
		});
	}
	
	
	
	
	/**
	 * Attempts to connect to a session on the server.
	 * @param {number} sessionId The identifier of the session to which to connect.
	 */
	function connect (sessionId) {

		var prompt = prompts.current ();
	
		if (prompt.input.value) {
			$(prompt.element).append (prompt.input.value);
			$(prompt.input).remove ();
	
			prompt.output = $('<p>').addClass ('output').insertAfter (prompt.element);
			$('<span>').addClass ('waiting').html ('Waiting for response&hellip;').appendTo (prompt.output);
	
			socket.send ({ connectConsole: sessionId, id: prompts.length - 1 });
		}
	}




	/**
	 * Send the command in the current prompt to the server, to be relayed to the remote device.
	 */
	function runPrompt () {
	
		var prompt = prompts.current ();
	
		if (prompt.input.value) {
			$('<span>').insertAfter (prompt.input).text (prompt.input.value);
			$(prompt.input).remove ();
	
			prompt.output = $('<p>').addClass ('output').insertAfter (prompt.element);
			$('<span>').addClass ('waiting').html ('Waiting for response&hellip;').appendTo (prompt.output);


			socket.send ({
				id: prompts.length - 1,
				command: prompt.input.value
			});
	
			rememberCommand (prompt.input.value);
			createCommandPrompt ();
		}
	}
	
	
							
	
	/**
	 * Displays a return message from the server.
	 * @param {object} output The output from the server.
	 */
	function showOutput (output) {
	
		var id = output.id,
			currentPrompt = prompts.current ();

	
		if (output.response) {
			output = formatObject (output.response, id);
	
		} else if (output.message) {
			output = '<span class="wirebug-message">Wirebug: ' + output.message + '</span>';
	
		} else {
			return;
		}
	
	
		if (id !== undefined) {
			$(prompts[id].output).html (output);

		} else {
			$('<p>').addClass ('output').html (output)[connected? 'insertBefore' : 'insertAfter'] (currentPrompt.element);
		}
		
			
		if (currentPrompt.input.scrollIntoView) currentPrompt.input.scrollIntoView ();
	}
	
	
	
	
	/**
	 * Formats a object into HTML.
	 * @param {object} object The object to be formatted.
	 * @param {number} id The identifier of the prompt which ran the command (for use in expansion).
	 * @param {string} name The name of the property to which obj is the value (for use in expansion).
	 * @returns {string} Formatted output, in HTML.
	 */
	function formatObject (obj, id, name) {
	
		switch (typeof obj) {
			
			case 'string':
				return '<span class="string">"' + obj + '"</span>';
	
			case 'number':
				return '<span class="number">' + obj + '</span>';
				
			case 'undefined':
				return '<span class="undefined">undefined</span>';
	
			case 'object':
	
				if (obj === null) return '<span class="null">null</span>';
	
				if (obj.__wirebug !== undefined) {
					switch (obj.__wirebug) {
	
						case 0:	return '<span class="object"><a href="#" data-id="' + id + '" data-name="' + name + '">' + obj.name + '</a></span>';	
						case 1:	return '<span class="function">' + obj.name + '</span>';
						case 2:	return '<span class="undefined">undefined</span>';
						case 3:	return '<span class="error">&#x2716; Error thrown on remote: ' + obj.message + '</span>';
						case 4:	return '<span class="string">"' + obj.intro + '..." <a href="#" data-id="' + id + '" data-name="' + name + '">View all</a></span>';
					}
				}
				
				var elements = [],
					isArray = obj instanceof Array;
	
				for (var i in obj) {
					var element = isArray? '' : '<span class="key">' + i + '</span>: ';
					element += formatObject (obj[i], id, i);
	
					elements.push ('<span class="element">' + element + '</span>');
				}
	
				return '{' + elements.join ('') + '}';
		}
	}
	
	
	
	
	/**
	 * Expands a stubbed value that was displayed in previous output.
	 * @param {number} id The identifier of the prompt that produced the previous output.
	 * @param {string} name The name of the property to expand.
	 */
	function expand (id, name) {
		prompts.current ().input.value = $(prompts[id].element).text () + '["' + name + '"]';
		runPrompt ();
	}
	
	
	
	
	/**
	 * Adds to the array of previously executed commands.
	 * @param {string} command The command to be stored.
	 */
	function rememberCommand (command) {
		if (command != commands[commands.length - 1]) {
			commands.push (command);
			if (sessionStorage) sessionStorage['command-' + (commands.length - 1)] = command;
		}
	}
	
	





	// Init
	
	$(function () {	

		commands.currentIndex = -1;
		prompts.current = function () { return this[this.length - 1]; };
	

		// Load previous commands from storage
		if (sessionStorage) {
			var command, index = 0;				
			while (command = sessionStorage['command-' + index++]) commands.push (command);
		}
	

		// Set up listener for "expand" clicks	
		$('#console').click (function (e) {
			e.preventDefault ();
	
			if (e.target.tagName == 'A' && $(e.target).attr ('data-id')) {
				expand (parseInt ($(e.target).attr ('data-id'), 10), $(e.target).attr ('data-name'));
			}
		});
	

		// Init socket
		socket.connect ();
	
		socket.on ('message', function (data) {
			showOutput (data);

			if (data.connectError) {
				createSessionPrompt ();
			
			} else if (!connected) {
				createCommandPrompt ();
				connected = true;
			}
		});

	
		// Ask for Session Id
		createSessionPrompt ();
	});
	
	
	// Always keep current prompt in focus
	$(window).bind ('focus click', function () {
		prompts.current ().input.focus ();
	});
	
	
})();	
