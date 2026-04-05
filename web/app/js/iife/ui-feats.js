$(document).ready(() => {

    // PAGE SPIT RESIZER
    // -----------------
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
            let leftPanelWidth = $(".left-panel").width();
            let rightPanelWidth = $(".right-panel").width();
            $(".left-panel").width(leftPanelWidth + offset);
            $(".right-panel").width(rightPanelWidth - offset);
            lastDownX = e.clientX;
        }
    }).mouseup(() => {
        isResizing = false;
        $('#iframe-overlay').remove();
    });

    // TOGGLE HIGH PANEL
    // -----------------
    let isHighPanelOpen = true;
    $("#toggle-high-panel").on('click', (e) => {
       if (isHighPanelOpen) {
           isHighPanelOpen = false;
           $("#hiding-zone").hide(350);
       } else {
           isHighPanelOpen = true;
           $("#hiding-zone").show(350);
       }
    });
});
