import { loadSettings } from "./util/load-settings.js";
import { ServerConnector } from './util/server-connector.js';
import { JQueryForm } from "./util/jquery-form.js";
import { View } from "./view/view.js";
import { MediaPlayer } from './util/media-player.js';

/**
 * MAIN APP
 * --------
 * 'Feats*:' (*names of listeners for featured actions)
 * ----------------------------------------------------
 * EVENT NAME(:TYPE) -> ACTION WHEN RECIEVED
 * - hello(:user) -> Register user, say welcome
 * - welcome(:user) -> Register user
 */
// MediaRoom
const MR = {
  // CONFIG:
  // ------
  userColors : ['#EE5A24','#009432','#0652DD','#9980FA','#833471'],
  // APP DATA:
  // --------
  // Current channel chosen by user (alias 'Room name'):
  currentChannel : '',
  // App user:
  user : {
    name : "", // Name chosen by user
    color : 0 // Color index of userColors chosen by user
  },
  // Distant users:
  users : []
};

let _syncDone = false;
let _syncTimeout = null;

/**
 * LOAD SETTINGS
 */
loadSettings('./config/settings',() => {
  console.log('** MEDIA ROOM v'+window.VERSION+' **');
  console.log(!window.DEV ? 'Production mode'
    : 'Quick login johndoe:dev');
  $("h1").html("MediaRoom v"+window.VERSION);

  // Prepare for alreadyTaken and logout
  ServerConnector.addListener('alreadyTaken', message => {
    View.toast(message);
    $(".container").hide();
    askUserName();
  });
  
  // for dev:
  if (window.DEV){
    MR.user.name='johndoe';
    MR.user.color=2;
    MR.currentChannel='dev';
    ServerConnector.login(MR.user.name, MR.currentChannel, makePresentation);
  } else {
    const hashRoom = location.hash.slice(1);
    if (hashRoom && /^\w+$/.test(hashRoom)) {
      MR.currentChannel = hashRoom.toLowerCase();
      location.replace(location.pathname + '#' + MR.currentChannel);
      askUserName();
    } else {
      askRoom();
    }
  }
});

/**
 * Copy current room URL (with hash) to clipboard
 */
function copyRoomLink() {
  navigator.clipboard.writeText(location.href).then(() => {
    View.toast('Room link copied!');
  }).catch(() => {
    View.toast('Could not copy link');
  });
}

/**
 * ASK ROOM TO CONNECT
 */
function askRoom() {
  // ROOM NAME
  $("#modal-roomname-dialog").show();
  JQueryForm.init('roomname-card', [['roomname', /^\w+$/]], (data) => {
    MR.currentChannel = data.roomname.toLowerCase();
    location.hash = MR.currentChannel;
    $("#modal-roomname-dialog").hide();
    askUserName();
  });
}

/**
 * ASK USER NAME
 */
function askUserName() {

  // USER NAME
  // ---------
  $("#room-welcome-name").text(MR.currentChannel);
  $("#room-welcome").off("click").on("click", copyRoomLink);
  $("#modal-username-dialog").show();
  // color buttons:
  MR.user.color = Math.floor(Math.random()*MR.userColors.length);
  activeBtColor();
  for (let i=0; i<MR.userColors.length; i++){
    const bt = $("#modal-username-dialog li").eq(i);
    bt[0].n = i;
    bt.css("background-color", MR.userColors[i]);
    bt.on("click", (e) => {
      MR.user.color = $(e.currentTarget)[0].n;
      activeBtColor();
    });
  }
  function activeBtColor(){
    $("#modal-username-dialog li").removeClass('active')
        .eq(MR.user.color).addClass('active');
  }
  // bt close:
  $("#modal-username-dialog .modal-close").off("click").on("click", () => {
    history.replaceState(null, '', location.pathname);
    MR.currentChannel = '';
    $("#modal-username-dialog").hide();
    // go back to room selection:
    askRoom();
  });
  // form
  JQueryForm.init('username-card', [['username', /^\w+$/]], (data) => {
    MR.user.name = data.username;
    $("#modal-username-dialog").hide();
    ServerConnector.login(MR.user.name, MR.currentChannel, makePresentation);
  });
}

/**
 * SEND AND ACTIVE GREETINGS
 */
function makePresentation(){

  // Register users saying welcome in return:
  ServerConnector.addListener('welcome', (user) => {
    addOtherUser(user);
  });

  // Register and answer to users saying hello:
  ServerConnector.addListener('hello', (user) => {
    addOtherUser(user);
    ServerConnector.say('welcome', MR.user);
    showPresentationToast(user);
  })

  function showPresentationToast(user){
    // fun message:
    const fun_msg = [
      'pop into the chat',
      'swoop into the conversation',
      'breeze into the room',
      'dive into the chat',
      'glide into the conversation',
      'materialize in the chatroom',
      'saunter into the discussion',
      'step into the banter',
      'waltz into the chat',
      'slide into the dialogue',
      'amble into the room',
      'appear in the conversation'
    ];
    View.toast(
        user.name + ' ' + fun_msg[Math.floor(fun_msg.length*Math.random())],
        MR.userColors[user.color]
    );
  }
  
  function addOtherUser(user){
    if (!MR.users.find(u => u.name === user.name)) {
      MR.users.push(user);
      View.addUser(user.name, MR.userColors[user.color]);
    }
  }

  // add logouts of people
  ServerConnector.addListener('logout', username => {
    const col = MR.users.findLast(user => user.name === username).color;
    MR.users = MR.users.filter(user => user.name !== username);
    View.removeUser(username);
    const fun_msg = [
      'vanish from the conversation',
      'exit the discussion',
      'fade from the chatroom',
      'sneak out of the conversation',
      'teleport out of the chat',
      'drift out of the discussion',
      'phase out of the conversation',
      'exit stage left from the dialogue',
      'saunter out of the room',
      'vanish into thin air from the chat'
    ];
    View.toast(username + ' ' + fun_msg[Math.floor(fun_msg.length*Math.random())], MR.userColors[col]);
  });

  // user say hello:
  ServerConnector.say('hello', MR.user);

  // init Talk
  initTalk();

  // init Color change
  initColorChange();

  // show room name + copy link button
  $("#room-name").html(MR.currentChannel);
  $("#copy-room-link").on("click", copyRoomLink);

  // next:
  initMedia();

  // Request media sync from existing peers
  ServerConnector.say('mediaSyncRequest', { user: MR.user });

  // show container:
  $(".container").show();
  $('#github-ribbon').hide();
  $("#message").focus();
}

function initTalk() {

  // Listen to talk events
  ServerConnector.addListener('talk', (data) => {
    const isOther = data.user.name !== MR.user.name || data.user.color !== MR.user.color;
    View.speechBubble(data.user.name, MR.userColors[data.user.color], data.message, isOther);
  });

  // talk with talk-area form
  JQueryForm.init('talk-area', [['message', /^[^<>]+$/]], (data) => {
    const obj = {};
    obj.message = data.message;
    obj.user = MR.user;
    ServerConnector.say('talk', obj);
  })
}

function initColorChange() {
  activeBtColor();
  for (let i=0; i<MR.userColors.length; i++){
    const bt = $(".btColorList li").eq(i);
    bt[0].n = i;
    bt.css("background-color", MR.userColors[i]);
    bt.on("click", (e) => {
      MR.user.color = $(e.currentTarget)[0].n;
      ServerConnector.say('color', MR.user); // Send update to other clients
      activeBtColor();
    });
  }
  function activeBtColor(){
    $(".btColorList li").removeClass('active')
        .eq(MR.user.color).addClass('active');
  }

  // Listener and color update
  ServerConnector.addListener('color', data => {
    const userToUpdate = MR.users.findLast(user => user.name === data.name);
    if (userToUpdate) {
      userToUpdate.color = data.color;
    }
    View.updateSpeechBubbleColor(data.name, MR.userColors[data.color]);
    // fun message:
    const fun_msg = [
      'is glowing up with their new color!',
      'traded in their old avatar for a new hue!',
      'is embracing the rainbow with their new avatar!',
      'has a chameleon-like avatar that keeps changing colors!',
      'is painting the town with their new avatar!'
    ];
    View.toast(data.name + ' ' + fun_msg[Math.floor(fun_msg.length*Math.random())],
        MR.userColors[data.color]);
  });
}

/**
 * INITIALIZE VIDEO SYSTEM
 */

/**
 * Format seconds as M:SS for toast display.
 * @param {number} seconds
 * @returns {string}
 */
function _formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function initMedia() {
  // Wire MediaPlayer local events → broadcast to room
  MediaPlayer.setCallbacks({
    onPlay: (timestamp) => {
      ServerConnector.say('mediaPlay', { timestamp, user: MR.user });
    },
    onPause: (timestamp) => {
      ServerConnector.say('mediaPause', { timestamp, user: MR.user });
    },
    onSeek: (timestamp) => {
      ServerConnector.say('mediaSeek', { timestamp, user: MR.user });
    },
    onError: () => {
      View.toast('Could not load media');
    },
    onEnded: () => {
      const fun_msg = [
        'The media is over, but the fun is just beginning.',
        'The media is finished, but the story is still being written.',
        'The media is finished, but the imagination is still running wild.',
        'The media is finished, but the memories will last a lifetime.',
        'The media is finished, but the journey is only just beginning.'
      ];
      View.toast(fun_msg[Math.floor(fun_msg.length * Math.random())]);
    },
    onYouTubeAutoplaySynced: () => {
      View.toast('Video is playing — press ▶ to join in');
    }
  });

  // URL form → load and broadcast
  function _submitMediaUrl() {
    const url = $('#media-url').val().trim();
    if (!url) return;
    MediaPlayer.load(url);
    ServerConnector.say('mediaLoad', { url, timestamp: 0, user: MR.user });
    $('#media-url').val('');
  }
  $('#media-form button').on('click', _submitMediaUrl);
  $('#media-url').on('keypress', (e) => {
    if (e.which === 13) { e.preventDefault(); _submitMediaUrl(); }
  });

  // Remote: someone loaded a new media
  ServerConnector.addListener('mediaLoad', (data) => {
    if (data.user.name === MR.user.name) return;
    MediaPlayer.load(data.url);
    const load_msg = [
      'loaded a new video',
      'queued up something new',
      'brought something to watch',
      'dropped a new video in the room',
      'set the stage with a new video'
    ];
    View.toast(`${data.user.name} ${load_msg[Math.floor(load_msg.length * Math.random())]}`, MR.userColors[data.user.color]);
  });

  // Remote: someone played
  ServerConnector.addListener('mediaPlay', (data) => {
    if (data.user.name === MR.user.name) return;
    MediaPlayer.play(data.timestamp);
    const play_msg = [
      'hit play',
      'started the show',
      'rolled the tape',
      'got the party started',
      'set things in motion'
    ];
    View.toast(`${data.user.name} ${play_msg[Math.floor(play_msg.length * Math.random())]}`, MR.userColors[data.user.color]);
  });

  // Remote: someone paused
  ServerConnector.addListener('mediaPause', (data) => {
    if (data.user.name === MR.user.name) return;
    MediaPlayer.pause(data.timestamp);
    const pause_msg = [
      'hit pause',
      'froze the frame',
      'put things on hold',
      'called a timeout',
      'stopped the show for a moment'
    ];
    View.toast(`${data.user.name} ${pause_msg[Math.floor(pause_msg.length * Math.random())]}`, MR.userColors[data.user.color]);
  });

  // Remote: someone seeked
  ServerConnector.addListener('mediaSeek', (data) => {
    if (data.user.name === MR.user.name) return;
    MediaPlayer.seek(data.timestamp);
    View.toast(`${data.user.name} jumped to ${_formatTimestamp(data.timestamp)}`, MR.userColors[data.user.color]);
  });

  // Sync: respond to joiners requesting current state
  ServerConnector.addListener('mediaSyncRequest', (data) => {
    if (data.user && data.user.name === MR.user.name) return;
    const state = MediaPlayer.getState();
    if (state.url) {
      ServerConnector.say('mediaSyncResponse', state);
    }
  });

  // Sync: receive state from existing peers on join (take first response only)
  _syncDone = false;
  clearTimeout(_syncTimeout);
  _syncTimeout = setTimeout(() => { _syncDone = true; }, 2000);
  ServerConnector.addListener('mediaSyncResponse', (data) => {
    if (_syncDone) return;
    _syncDone = true;
    clearTimeout(_syncTimeout);
    MediaPlayer.loadAndSync(data.url, data.timestamp, data.isPlaying);
  });
}
