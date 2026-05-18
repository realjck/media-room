/**
 * JQUERY FORM
 */
const JQueryForm = {};

/**
 * Initialize a form to get array of inputs data entered by user in html elements
 * send back to callback function (data object with entries ex:data.input1)
 * when pressing the <button> elements inside the <div> form
 * or the Return/Enter key
 * @param {string} form 
 * @param {[[string,(RegExp)]]} inputs 
 * @param {function} callback 
 */
JQueryForm.init = (form, inputs, callback) => {
    
    // click on button:
    $("#"+form+" button").off("click").on("click", getDataFromInput);

    // keypress enter on inputs:
    inputs.forEach(input => {
        $("#"+input[0]).off("keypress").on("keypress", (event) => {
            if (event.which === 13){
                event.preventDefault();
                getDataFromInput();
            }
        });
    });

    // focus on first input:
    document.getElementById(inputs[0][0]).focus(); 
    
    // create data object:
    const data = {};

    // get input data, and send it via callback if ok:
    function getDataFromInput() {
        let formIsValid = true;
        inputs.forEach(input => {
            const element = $("#"+input[0]);
            element.removeClass('invalid');
            const val = element.val().trim();
            data[input[0]] = val;
            // si regex :
            if (input[1] !== undefined) {
                if (!input[1].test(val)) {
                    element.addClass('invalid');
                    formIsValid = false;
                }
            }
        });
        if (formIsValid){
            inputs.forEach(input => {
                $("#"+input[0]).val("");
            });
            callback(data);
        }
    }
}

export {JQueryForm};
