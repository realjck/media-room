$(document).ready(() => {

    // YT PLAYER ASPECT RATIO (16:9 contain)
    // --------------------------------------
    function fitYTPlayer() {
        const wrap = document.getElementById('yt-player-wrap');
        if (!wrap) return;
        const iframe = wrap.querySelector('iframe');
        if (!iframe) return;
        const cw = wrap.offsetWidth;
        const ch = wrap.offsetHeight;
        if (!cw || !ch) return;
        const ratio = 16 / 9;
        let w, h;
        if (cw / ch > ratio) {
            h = ch; w = Math.round(ch * ratio);
        } else {
            w = cw; h = Math.round(cw / ratio);
        }
        iframe.style.setProperty('width',  w + 'px', 'important');
        iframe.style.setProperty('height', h + 'px', 'important');
    }

    const ytWrap = document.getElementById('yt-player-wrap');
    // Re-fit when container is resized (panel drag, window resize)
    new ResizeObserver(fitYTPlayer).observe(ytWrap);
    // Re-fit when iframe is inserted by YT API
    new MutationObserver(fitYTPlayer).observe(ytWrap, { childList: true, subtree: true });

    // PAGE SPIT RESIZER
    // -----------------
    const MIN_LEFT = 180;
    const MIN_RIGHT = 300;
    let isResizing = false;
    let lastDownX = 0;
    $('.divider').mousedown((e) => {
        isResizing = true;
        lastDownX = e.clientX;
        $('<div id="iframe-overlay">').css({
            position: 'fixed', top: 0, left: 0,
            width: '100%', height: '100%',
            zIndex: 9999
        }).appendTo('body');
    });
    $(document).mousemove(function(e) {
        if (isResizing) {
            let offset = e.clientX - lastDownX;
            const newLeft = Math.max(MIN_LEFT, $(".left-panel").width() + offset);
            const newRight = Math.max(MIN_RIGHT, $(".right-panel").width() - offset);
            $(".left-panel").width(newLeft);
            $(".right-panel").width(newRight);
            lastDownX = e.clientX;
        }
    }).mouseup(() => {
        isResizing = false;
        $('#iframe-overlay').remove();
    });

    // TOGGLE HIGH PANEL
    // -----------------
    let isHighPanelOpen = true;
    $(".panel-header").on('click', (e) => {
       if (isHighPanelOpen) {
           isHighPanelOpen = false;
           $("#hiding-zone").hide(350);
       } else {
           isHighPanelOpen = true;
           $("#hiding-zone").show(350);
       }
    });
});
