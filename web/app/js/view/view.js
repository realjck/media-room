/**
 * VIEW
 * WITH JQUERY
 */

let _toastTimer;
const View = {};

/**
 * Toast alert of 4.2s
 * @param {string} message
 * @param {string} color (optionnal)
 */
View.toast = (message, color = undefined) => {
    if (color) {
        $(".toast").css("background-color", color);
    } else {
        $(".toast").css("background-color", "var(--toast-back-color)");
    }
    $(".toast").html(message);
    $(".toast").show();
    clearTimeout(_toastTimer);
    _toastTimer = setInterval(() => {
        $(".toast").hide();
    }, 4200);
}

/**
 * Append Speech Bubble
 * @param {string} name
 * @param {string} color
 * @param {string} message
 * @param {boolean} right (optional)
 */
View.speechBubble = (name, color, message, right) => {
    let html = '<div class="speech-bubble';
    if (right) {
        html += ' right">';
    } else {
        html += '">';
    }
    html += '<div>';
    html += '<div class="speech-bubble-user" style="background-color:' + color + '">';
    html += name;
    html += '</div>';
    html += '<div class="speech-bubble-date">' +
        `${new Date().getHours()}:${(new Date().getMinutes() < 10 ? '0' : '') + new Date().getMinutes()}` +
        '</div>';
    html += '</div>';
    html += message;
    html += '</div>';

    $('.box-container').prepend(html).children().first().hide().show(350);
}

View.updateSpeechBubbleColor = (username, color) => {
    $('.speech-bubble-user').each(function() {
       if ($(this).text().trim() === username) {
           $(this).css('background-color', color);
       }
    });
}

View.addUser = (username, color) => {
    const html = '<div class="speech-bubble-user" style="background-color:' + color + '">' + username + '</div>';
    $("#users-container").append(html);
}

View.addSelfUser = (username, color, colors) => {
    const dots = colors.map(c =>
        `<li class="btColor" style="background-color:${c}"></li>`
    ).join('');
    const html = `<div id="self-badge-wrap">
        <div id="self-badge" class="speech-bubble-user" style="background-color:${color}">${username}<svg class="self-badge-arrow" width="7" height="5" viewBox="0 0 7 5" fill="rgba(255,255,255,0.5)"><path d="M0 0h7L3.5 5z"/></svg></div>
        <div id="self-color-picker">
            <ul class="btColorList">${dots}</ul>
        </div>
    </div>`;
    $("#users-container").prepend(html);
}

View.removeUser = (username) => {
    $('#users-container .speech-bubble-user').each(function() {
        if ($(this).text().trim() === username) {
            $(this).remove();
        }
    });
}

export {View};
