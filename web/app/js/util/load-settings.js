/**
 * Load settings file values into window object,
 * then launch callback
 * @param {string} filepath
 * @param {function} callback
 */
const ALLOWED_SETTINGS = ['DEV', 'URL'];

const loadSettings = (filepath, callback) => {
    fetch(filepath)
        .then(response => response.text())
        .then(data => {
            data.split('\n').forEach(variable => {
                let [name, value] = variable.split('=');
                name = name && name.trim();
                if (!name || !value || !ALLOWED_SETTINGS.includes(name)) return;
                value = value.trim();
                if (value.toLowerCase() === 'true') value = true;
                else if (value.toLowerCase() === 'false') value = false;
                window[name] = value;
            });
            callback();
        })
        .catch(error => {
            console.error('Error loading settings file:', error);
            callback();
        });
}
export {loadSettings};
