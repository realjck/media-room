/**
 * ServerConnector
 */

let _ws;
const _events = {};
const ServerConnector = {};

/**
 * Establish Server connexion
 */
ServerConnector.login = (user, channel, callback) => {
    _ws  = new WebSocket(window.URL);
    _ws.addEventListener('open', (event) => {
        console.log('Connected to server');
        _ws.send(user + ":" + channel);
        return callback(true);
    });

    // Send messages when received
    _ws.addEventListener('message', (event) => {
        const message = event.data;

        const match = message.match(/:(.*?):/);

        if (match && match[1]) {
            const fn = match[1].trim();
            try {
                const data = JSON.parse(message.match(/^(?:[^:]*:){2}(.*)$/)[1]);
                if (typeof _events[fn] === 'function') _events[fn](data);
            } catch (e) {
                console.error('Message parse error:', e);
            }
        } else {
            // Server messages
            if (message.substring(0,1) === '>') {
                _events['alreadyTaken'](message.substring(1));
            } else if (message.substring(0,1) === '!') {
                _events['logout'](message.substring(1));
            } else {
                console.log(message);
            }
        }
    });
}

/**
 * Create an Event that do something with the received data object
 * __ex.: ServerConnector.addListener('xxx', ((data) => {app_data = data}));__
 * @param {string} eventName 
 * @param {function} fn 
 */
ServerConnector.addListener = (eventName, fn) => {
    _events[eventName] = fn;
}

/**
 * Publish an object message to an Event
 * __ex.: ServerConnector.say('xxx', data);__
 * @param {string} eventName 
 * @param {object} object 
*/
ServerConnector.say = (eventName, object) => {
    try {
        _ws.send(eventName + ":" + JSON.stringify(object));
    } catch (e) {
        console.log("IOERROR: SAY to '"+eventName+"'", object);
    }
}

export {ServerConnector};
