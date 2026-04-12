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
    $(".toast").text(message);
    $(".toast").show();
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
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
    const $bubble = $('<div class="speech-bubble">');
    if (right) $bubble.addClass('right');

    const $time = `${new Date().getHours()}:${(new Date().getMinutes() < 10 ? '0' : '') + new Date().getMinutes()}`;
    const $header = $('<div>').append(
        $('<div class="speech-bubble-user">').css('background-color', color).text(name),
        $('<div class="speech-bubble-date">').text($time)
    );
    $bubble.append($header, $('<div>').text(message));

    $('.box-container').prepend($bubble).children().first().hide().show(350);
}

View.updateSpeechBubbleColor = (username, color) => {
    $('.speech-bubble-user').each(function() {
       if ($(this).text().trim() === username) {
           $(this).css('background-color', color);
       }
    });
}

View.addUser = (username, color) => {
    $('<div class="speech-bubble-user">').css('background-color', color).text(username)
        .appendTo('#users-container');
}

View.addSelfUser = (username, color, colors) => {
    const dots = colors.map(c =>
        `<li class="btColor" style="background-color:${c}"></li>`
    ).join('');
    const $badge = $('<div id="self-badge" class="speech-bubble-user">').css('background-color', color).text(username);
    $badge.append('<svg class="self-badge-arrow" width="7" height="5" viewBox="0 0 7 5" fill="rgba(255,255,255,0.5)"><path d="M0 0h7L3.5 5z"/></svg>');
    const $wrap = $('<div id="self-badge-wrap">').append(
        $badge,
        $('<div id="self-color-picker"><ul class="btColorList">' + dots + '</ul></div>')
    );
    $("#users-container").prepend($wrap);
}

View.removeUser = (username) => {
    $('#users-container .speech-bubble-user').each(function() {
        if ($(this).text().trim() === username) {
            $(this).remove();
        }
    });
}

export {View};
