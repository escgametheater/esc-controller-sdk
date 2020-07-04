// WebSocket communication for esc game messaging
import React, {Component} from 'react';

let DevMode = true ;

let UsePubNub = true ;
let TestPubNub = false ;
let TestPubNubBadControllerPort = 1234; // Some random port that won't connect, or maybe set up a web socket relay that occasionally disconnects?

import {startPubNub, pubNubSendEvent, publishToAggregator, pubNubLog} from './pubnubConnection';

import {DebugManager} from '../debug/debug';
import {ACTION_GAME_LOADED, ESCManager} from '../ESCManager';
import {EventManager, HANDLER_GROUP_DEFAULT, ReducerManager} from '../';
import uuid from "uuid";

console.log("Loading ESCNetworking.js");

const MAX_CONNECTION_RETRIES = 5;
const MAX_MESSAGES_TO_QUEUE = 10 ;

const ACTION_NETWORK_CONNECTION = "Network:Connection";
const EVENT_NETWORK_ERROR = "NetworkError";
const EVENT_NETWORK_OPEN = "NetworkOpen";

const CONNECTION_PING = "Ping";
const CONNECTION_PONG = "Pong";
const PINGER_PERIOD = 400 ; // Milliseconds between pings

const PubNubConnectionDelayMs = 1 ; // Milliseconds to delay starting PubNub initially

const CONTROLLER_REGISTER = "RegisterController";
const CONTROLLER_REGISTERED = "ControllerRegistered";

const LOG_COMMAND = "Log";

const RELOAD_CONTROLLER = "Reload";

window.testWebsocketPaused = false ;

const getCookie = (cookieName) => {
    const cookiePrefix = cookieName + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        const c = ca[i].trim();
        if (c.indexOf(cookiePrefix) === 0) {
            return c.substring(cookiePrefix.length, c.length);
        }
    }
    return "";
};

let controllerUuid = sessionStorage.getItem('controllerUuid');
if (!controllerUuid) {
    controllerUuid = uuid();
    sessionStorage.setItem('controllerUuid',controllerUuid);
}

let controllerHost = window.location.hostname;
let controllerPort = 8887;

let deviceId = "no_device_id";
let guestHash = "no_guest_hash";
let gameInstanceId = 0;
let hostInstanceId = 0;
let controllerBuildId = "no_controller_build_id";
let gameBuildId = 1;
let requestId = "no_request_id";
let sessionHash = "no_session_hash";
let userId = 3 ;
let connectionNonce = "invalid";
let inviteHash = "";


// For testing purposes, an automatic way of getting window.esc from play.esc.games
function getWindowEscFromOtherPage(url) {
    const popup = window.open(url);
    window.escpopup = popup ;
    console.log("Opening window "+url,popup);
    // "load" listener did not work, so using setTimeout
//    popup.addEventListener("load",function() {
        setTimeout(function () {
            popup.postMessage("send window.esc",url);
            console.log("Send message to "+url);
        },500);
//    });
}
window.getWindowEscFromOtherPage = getWindowEscFromOtherPage ;

window.addEventListener("message", receiveMessage, false);
function receiveMessage(event)
{
    // Match localhost and *.local ports 3000 through 3009
    if (!event.origin.startsWith("http://localhost:300") &&
        !event.origin.match(/^http:\/\/[a-z0-9][a-z0-9-]*[a-z0-9]\.local:300[0-9]/) &&
        !event.origin.match(/^https:\/\/[a-z0-9][a-z0-9-]*[a-z0-9]\.esc.games/)
    ) {
        console.log("Message received from bad origin:",event);
        return;
    }
    console.log("Message received:",event);
    if (event.data==="send window.esc") {
        event.source.postMessage({esc:window.esc},event.origin);
        window.close();
    }
    else {
        if (event.data.esc) {
            console.log("window.esc received: ",event.data.esc);
            window.esc = event.data.esc ;
            sessionStorage.setItem("window.esc",JSON.stringify(window.esc));
        }
    }
}

window.UsingTestESC = false ;

// For testing during development:
if (typeof window.esc === 'undefined') {

    // TODO: call getWindowEscFromOtherPage depending on url params or automatically
    // Will need the host/game instance on the command line
    // getWindowEscFromOtherPage("https://play.esc.games/i/xxxx");

    console.log("window.esc is undefined, trying to use test window.esc");
    try {
        let testWindowEsc = require('../../test/testWindowEsc');
        console.warn("Loading local test window.esc.");
        window.esc = testWindowEsc ;
        window.UsingTestESC = true ;
    } catch (ex) {
        console.error("No window.esc or test file found.");
    }
    if (!window.esc) {
        console.log("Trying to get window.esc from sessionStorage");
        const windowEscJSON = sessionStorage.getItem("window.esc");
        if (windowEscJSON) {
            try {
                window.esc = JSON.parse(windowEscJSON);
                console.log("window.esc loaded from sessionStorage");
                window.UsingTestESC = false ;
            }
            catch (e) {
                window.esc = null ;
            }
        }
    }
    if (!window.esc) {
        window.esc = {
            "global": {
                "notifications": [],
                "has_notifications": false,
                "debug_mode_enabled": false,
                "has_session_messages": false,
                "session_messages": [],
                "user": {
                    "id": 30,
                    "name": "TestUser",
                    "groups": [
                    ],
                    "permissions": {},
                    "is_verified": false,
                    "email": "",
                    "timezone_offset": 0,
                    "ip": "127.0.0.1",
                    "cache": {},
                    "is_authenticated": true,
                    "dst_auto": 0,
                    "dst": 0,
                    "isMobile": false,
                    "isTablet": false,
                    "isPhone": false,
                    "is_bot": "0",
                    "beta_access": true,
                    "entity": {},
                    "session": {},
                    "applicationUserAccessToken": null,
                    "session_entity": {
                        "type": "SessionEntity",
                    },
                    "guest_entity": {
                        "type": "GuestEntity",
                    }
                },
                "config": {
                    "static_url": "/static/",
                    "media_url": "/media/",
                    "images_url": "/static/images/",
                    "raw_js": true,
                    "raw_css": true,
                    "is_dev": false,
                    "ga_id": "UA-123681863-1",
                    "www_url": "https://www.esc.games",
                    "play_url": "https://play.esc.games",
                    "develop_url": "https://develop.esc.games",
                    "api_url": "https://api.esc.games"
                },
                "request": {
                    "request_id": Math.random(),
                    "request_et_id": null,
                    "request_checksum": null,
                    "request_utm_medium": null,
                    "request_utm_source": null,
                    "request_utm_campaign": null,
                    "request_utm_term": null,
                    "get": [],
                    "build_query": "?",
                    "section": "i",
                    "page_content_audience": 1,
                    "ajax": false,
                    "page": "play"
                }
            },
            "page": {
                "host_instance": {
                    "type": "HostInstanceEntity",
                    "public_host_domain": "qa1.playesc.com",
                    "public_host_name": "2f358fe9b41e47d4af368c7ef51edebe",
                    "local_port": "8888",
                    "host": {
                        "type": "HostEntity",
                    },
                    "network": {
                        "type": "NetworkEntity",
                        "is_active": "1",
                    },
                    "game_instances": {
                        "type": "NetworkEntity",
                        "is_active": "1",
                    },
                    "user_is_host_admin": true,
                },
                "game_instance": {
                    "type": "GameInstanceEntity",
                    "game": {
                        "type": "GameEntity",
                    },
                    "game_build": {
                        "type": "GameBuildEntity",
                    },
                    "game_controllers": {
                        "type": "GameBuildEntity",
                    },
                    "custom_game_assets": []
                },
                "user_is_host_admin": true,
                "invite_hash": null,
                "controller_pub_sub_channels": {
                }
            }
        };
        window.UsingTestESC = true ;
    }
    if (!window.esc.global.request.guest_hash) {
        guestHash = getCookie('guestHash') ;
        if (guestHash === "") {
            guestHash = "player-" + Math.random();
        }
        window.esc.global.request.guest_hash = guestHash;
    }
    guestHash = window.esc.global.request.guest_hash ;
}
else {
    sessionStorage.setItem("window.esc",JSON.stringify(window.esc));
}

if (typeof window.esc !== 'undefined') {

    let escModel = window.esc;

    let hostInstance = escModel.page.host_instance;

    if (hostInstance) {
        if (hostInstance.local_ip_address && !UsingTestESC) {
            // These probably won't work when testing, if protocol for the local page is http and not https
            controllerHost = hostInstance.local_url;
            controllerPort = hostInstance.local_port;
        }
        hostInstanceId = hostInstance.id;
    }

    if (escModel.page.game_instance) {
        gameInstanceId = escModel.page.game_instance.id;
    }

    deviceId = escModel.global.request.guest_hash;
    sessionHash = escModel.global.request.session_hash ;
    requestId = escModel.global.request.request_id;
    guestHash = escModel.global.request.guest_hash;
    inviteHash = escModel.page.invite_hash;

    userId = escModel.global.user.id ;
    connectionNonce = escModel.global.user.connectionNonce;

    console.log("ESC Host Instance", escModel.page.host_instance);
    console.log("ESC Game Instance", escModel.page.game_instance);

    if (UsePubNub && !window.esc.page.pub_nub_config) {
        console.warn("PubNub config not set, disabling PubNub. window.esc.page is ", window.esc.page);
        UsePubNub = false ;
    }
} else {
    console.warn("window.esc is still undefined.");
    window.esc = {};
}


window.esc.isOfflineGame = function () {
    try {
        return window.esc.page.game_instance.id === -1 ;
    } catch (e) {
        console.log("host_instance not found");
    }
    return false;
};


window.esc.isAggregateGame = function () {
    try {
        return window.esc.page.game_instance.game.is_aggregate_game ;
    } catch (e) {
        console.log("is_aggregate_game not found");
    }
    return false;
};

window.esc.isHostAdmin = function () {
    try {
        return window.esc.page.user_is_host_admin ;
    } catch (e) {
        console.log("is_aggregate_game not found");
    }
    return false;
};


if (TestPubNub) {
    controllerPort = TestPubNubBadControllerPort;
}

function SwitchWebSocketPort(port) {
    controllerPort = port ;
    ESCNetworkState.port = controllerPort;
    ESCNetworkState.uri = `${protocol}://${controllerHost}:${controllerPort}`;

    if (ESCNetworkState.websocket && ESCNetworkState.websocket.readyState === WebSocket.OPEN) {
        ESCNetworking.closeConnection();
        newWebsocketConnection();
    }
}

const protocol = window.location.protocol !== "https:" ? 'ws' : 'wss';

const connectionData = {
    deviceId: deviceId,
    gameInstanceId: gameInstanceId,
    hostInstanceId: hostInstanceId,
    controllerBuildId: controllerBuildId,
    gameBuildId: gameBuildId,
    requestId: requestId,
    sessionHash: sessionHash,
    userId: userId,
    guestHash: guestHash,
    inviteHash: inviteHash,
    wasConnected: false,
    connectionNonce: connectionNonce
};

let myURL = new URL(window.location.href) ;
let searchParams = new URLSearchParams(myURL.search);

function setFromSearchParams(obj) {
    for (const param in obj) {
        if (obj.hasOwnProperty(param) && searchParams.has(param)) {
            obj[param] = searchParams.get(param);
        }
    }
}

// Get overrides of connectionData from the URL search parameters, if present
setFromSearchParams(connectionData);

if (searchParams.has("port")) {
    controllerPort = searchParams.get("port");
}

connectionData.userId = parseInt(connectionData.userId);
connectionData.gameBuildId = parseInt(connectionData.gameBuildId);
connectionData.gameInstanceId = parseInt(connectionData.gameInstanceId);
connectionData.hostInstanceId = parseInt(connectionData.hostInstanceId);

if (searchParams.has("pubnub")) {
    UsePubNub = searchParams.get("pubnub");
} else if (!connectionData.hostInstanceId) {
    // Don't use pubnub if we're not using a host
    UsePubNub = false ;
}

console.log("connectionData after setFromParams:",{...connectionData});
document.cookie = "guestHash=" + guestHash ;

const ESCNetworkState = {
    port: controllerPort,
    uri: `${protocol}://${controllerHost}:${controllerPort}`,
    myIP: null,
    ackFrequency: 0.1, // Request acknowledgements this frequently
    ackFrequencyCount: 1, // For tracking ackFrequency
    reconnectDelay: 500,
    autoReconnect: true, // Automatically reconnect on disconnect
    player: {
        deviceId: deviceId,
        username: guestHash,
        controllerUuid: controllerUuid,
    },
    messageSinceLastPing:true,
    pingStats: {
        count: 0,
        avg: 0,
        totalMs: 0,
        countLong: 0,
        totalMsLong: 0
    },
    useWebsocket: true ,
    websocket: {},
    messagesSent: 0,
    messagesReceived: 0,
    startTime: new Date().getTime(),
    closeCode: 0 ,
    refusedCode: 0 ,
    connected: false ,
    wasConnected: false ,
    disconnectCount: 0,
    playTime: 0,
    pubNubActive: false,
    usePubNub: UsePubNub,
};

if (window.esc.isAggregateGame()) {
    if (!window.esc.isHostAdmin()) {
        ESCNetworkState.useWebsocket = false ;
        console.log("Aggregate game, not using webSockets.");
    }
}


const eventManager = new EventManager('ESCNetworking');


let idx = 1;

const SendRegisterControllerEventInQuery = false ;

const RegisterControllerEventAsField = () => {
    return ESCNetworking.eventAsURLfield(CONTROLLER_REGISTER,{
        username: guestHash,
        controllerUuid: controllerUuid,
        deviceId: deviceId
    });
};


function newWebsocketConnection() {
    if (window.testWebsocketPaused) {
        setTimeout(newWebsocketConnection,1000);
        return;
    }

    console.log("ESCNetworking: connecting[" + idx + "] - " + ESCNetworkState.uri);
    if (ESCNetworkState.websocket && ESCNetworkState.websocket.readyState === WebSocket.OPEN) {
        console.log("ESCNetworking: ALREADY CONNECTED[" + idx + "]");
        return;
    }
    const uripath = "/"+JSON.stringify(connectionData) ;
    const uriquery = SendRegisterControllerEventInQuery ? "?" + RegisterControllerEventAsField() : "";
    ESCNetworkState.websocket = new WebSocket(ESCNetworkState.uri + uripath + uriquery);
    ESCNetworkState.websocket.onopen = ESCNetworking.onOpen(idx);
    ESCNetworkState.websocket.onclose = ESCNetworking.onClose(idx);
    ESCNetworkState.websocket.onmessage = ESCNetworking.onMessage(idx);
    ESCNetworkState.websocket.onerror = ESCNetworking.onError(idx);
    ESCNetworkState.websocket.binaryType = "arraybuffer"; // We don't want to use blobs, the default, because we would then need to use a FileReader to convert them to anything useful
    idx++;
}

const ESCNetworking = {
    state: ESCNetworkState,
    messageQueue: [],
    init: function () {
        ESCNetworking.newConnection();
    },
    eventAsURLfield: function (name,obj) {
        return name + "=" + encodeURIComponent(JSON.stringify(obj));
    },
    newConnection: function () {
        if (ESCNetworkState.useWebsocket) {
            newWebsocketConnection();
        }
        if (ESCNetworkState.usePubNub) {
            setTimeout(function () {
                ESCNetworking.newPubNubConnection();
            },PubNubConnectionDelayMs);
        }
    },
    newPubNubConnection : function () {
        startPubNub(connectionData, ESCNetworking.dispatchEvent,
            // onConnection
            function () {
                ESCNetworkState.pubNubActive = true;

                ESCNetworking.dispatchUI(ACTION_NETWORK_CONNECTION, ESCNetworkState);

                if (!window.esc.isAggregateGame() || window.esc.isHostAdmin()) {
                    ESCNetworking.sendControllerRegister();
                } else {
                    console.log("Aggregate game, not sending controllerRegister ");
                }
                if (!ESCNetworkState.connected) {
                    ESCNetworking.dispatchEvent(EVENT_NETWORK_OPEN, ESCNetworkState);
                }
                connectionData.wasConnected = true;
                ESCNetworkState.wasConnected = true;
            },
            // onDisconnection
            function () {
                ESCNetworkState.pubNubActive = false;
                console.log("pubNub onDisconnection")
                ESCNetworking.dispatchUI(ACTION_NETWORK_CONNECTION, ESCNetworkState);
            },
            // onReconnection
            function () {
                ESCNetworkState.pubNubActive = true;
                ESCNetworking.dispatchUI(ACTION_NETWORK_CONNECTION, ESCNetworkState);
                if (!ESCNetworkState.connected) {
                    ESCNetworking.dispatchEvent(EVENT_NETWORK_OPEN, ESCNetworkState);
                }
            }
        );
    },
    initPlayerId: () => {
        // Note: we're now using guestHash instead of playerId
        const cookiePlayerId = getCookie("playerid");
        let playerId = connectionData.playerId ;
        playerId = playerId ? playerId : cookiePlayerId ;
        playerId = playerId ? playerId : "player-" + Math.random();
        document.cookie = "playerid=" + playerId;
        connectionData.playerId = playerId ;
        ESCNetworking.playerId = playerId ;
        return playerId ;
    },
    getPlayerId: () => {
        if (!ESCNetworking.playerId)
            ESCNetworking.initPlayerId();
        return ESCNetworking.playerId ;
    },
    sendControllerRegister: () => {
        ESCNetworking.sendCommand(CONTROLLER_REGISTER, {
            username: guestHash,
            controllerUuid: controllerUuid,
            deviceId: deviceId
        });
    },
    onOpen: (idx) => {
        return (evt) => {
            console.log("ESCNetworking: CONNECTED{"+ idx+ "]");

            ESCNetworkState.messageSinceLastPing = true ;
            ESCNetworking.keepalive(idx);
            ESCNetworkState.disconnectCount = 0;

            ESCNetworkState.connected = true ;

            // reregister controller before sending any queued messages.
            ESCNetworking.sendControllerRegister();

            ESCNetworking.dispatchUI(ACTION_NETWORK_CONNECTION, ESCNetworkState);
            if (!ESCNetworkState.pubNubActive) {
                ESCNetworking.dispatchEvent(EVENT_NETWORK_OPEN, ESCNetworkState);
            }
            connectionData.wasConnected = true ;
            ESCNetworkState.wasConnected = true ;

            /*
Commenting this out while we are testing. Will also need to
            while (ESCNetworking.messageQueue.length > 0 && ESCNetworkState.websocket.readyState === WebSocket.OPEN) {
                const message = ESCNetworking.messageQueue.shift();
                console.log("ESCNetworking: sending queued message: ", message);
                ESCNetworking._send(message);
            }
*/
        }
    }
    ,

    onClose: (idx) => {
        return (evt) => {
            const maxConnectionRetries = MAX_CONNECTION_RETRIES;
            ESCNetworkState.username = "";
            if (ESCNetworkState.connected) {
                ESCNetworkState.closeCode = evt.code ;
            } else {
                ESCNetworkState.refusedCode = evt.code ;
            }

            clearInterval(ESCNetworking.keepaliveInterval[idx]);
            console.log("ESCNetworking: DISCONNECTED[" + idx + "]", evt, evt.code, ESCNetworkState.websocket.readyState);
            if (ESCNetworkState.autoReconnect) {
                ESCNetworkState.disconnectCount++;
                if (ESCNetworkState.disconnectCount < maxConnectionRetries) {
                    newWebsocketConnection();
                }
                else {
                    if (ESCNetworkState.disconnectCount === maxConnectionRetries ) {
                        console.log("dispatching ACTION_NETWORK_ERROR ESCNetworking ",ESCManager);
                        ESCNetworking.dispatchUI(ACTION_NETWORK_CONNECTION, ESCNetworkState);
                        ESCNetworking.dispatchEvent(EVENT_NETWORK_ERROR, ESCNetworkState);
                    }

                    setTimeout(() => {
                        newWebsocketConnection();
                    }, 5000);
                }
            }
            ESCNetworkState.connected = false ;
        };
    },
    ab2str: function (buf) {
        // Convert an array buffer with Uint8 encoding to String
        // See
        // https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
        return String.fromCharCode.apply(null, new Uint8Array(buf));
    },
    onMessage: (idx) => {
        return (evt) => {
            //console.log("ESCNetworking: Response: ",evt);
            // const delay = Date.now() - ESCNetworking.doSend.time;

            if (window.testWebsocketPaused) {
                return ;
            }

            ESCNetworkState.messageSinceLastPing = true ;

            let dataString = ESCNetworking.ab2str(evt.data);
            // This could be due to unity being sent to background, could be just a ping. No action needed
            if (dataString.length === 1) {
                return;
            }
            const commandChar = dataString.charAt(0);
            const messageString = dataString.substring(1);


            ESCNetworking.dispatchRawEvent(messageString);

            ESCNetworkState.messagesReceived++;
            ESCNetworkState.playTime = new Date().getTime() - ESCNetworkState.startTime;
            ESCManager.dispatchUI(ACTION_GAME_LOADED, ESCNetworkState);
        }
    },
    onError: (idx) => {
        return (evt) => {
            console.log('ESCNetworking: ERROR[' + evt.code + ']: ', evt);
            if (ESCNetworkState.websocket.readyState === WebSocket.CONNECTING) {
                // Failed to connect
                DebugManager.commands.notify("Unable to connect to " + ESCNetworkState.uri);
            }
        }
    },
    pinger: function (n, delay, message) {
        // Auto send n pings separated by <delay> milliseconds
        // If n = 0 or less, run forever
        // Otherwise, send n pings and stop
        if (n === 1) {
            ESCNetworking.sendCommand(CONNECTION_PING, { time: Date.now(), message: message});
            return;
        }
        n--;
        const myInterval = setInterval(() => {
            // Only send ping if connection is open, don't queue pings
            if (ESCNetworkState.websocket.readyState === WebSocket.OPEN) {
                ESCNetworking.sendCommand(CONNECTION_PING, { time: Date.now(), message: message});
            }
            if (n === 1) {
                clearInterval(myInterval);
                return;
            }
            ESCNetworkState.messageSinceLastPing = false ;
            n = n - 1;
            if (n <= 0) {
                n = 0;
            }
        }, delay);
        // If the host is responding to our pings, then we should have gotten a message since our last ping
        if (!ESCNetworkState.messageSinceLastPing && ESCNetworkState.pingStats.count) {
            console.log("No message since last ping, disconnecting");
            ESCNetworking.closeConnection();
            clearInterval(myInterval);
            return;
        }
        return myInterval ;
    },
    keepaliveInterval: {},
    keepalive: (idx) => {
        // calls pinger, saves the ID so that it can be stopped later
        //notify("Starting keepalive",3000);
        if (ESCNetworking.keepaliveInterval[idx] == null) {
            ESCNetworking.keepaliveInterval[idx] = ESCNetworking.pinger(0, PINGER_PERIOD, "keepalive");
        }
    },
    _send: function (message) {
        // If not connected, connect and try again
        if (ESCNetworkState.websocket.readyState !== WebSocket.OPEN) {
            // Send once we're connected/reconnected
            ESCNetworking.messageQueue.push(message);
            if (ESCNetworking.messageQueue.length > MAX_MESSAGES_TO_QUEUE) {
                ESCNetworking.messageQueue.shift();
                console.log("ESCNetworking: Attempt to send when disconnected - queue full, shifting out message");
            }
            else {
                console.log("ESCNetworking: Attempt to send when disconnected - queuing message");
            }
            return;
        }
        if (!window.testWebsocketPaused ) {
            ESCNetworkState.websocket.send(message);
        }
        ESCNetworkState.messagesSent++;
    },
    closeConnection: function () {
        console.log("ESCNetworking: Closing websocket");
        ESCNetworkState.websocket.close();
    },
    sendCommand: function (command, body) {
        if (command !== "Ping") {
//            console.log("sendCommand "+command,body);
            if (ESCNetworkState.pubNubActive) {
                // Use pubNub as a fallback if web socket isn't open.
                if (ESCNetworkState.websocket.readyState !== WebSocket.OPEN) {
//                    console.log("Sending with PubNub");
                    pubNubSendEvent(command,body);
                    return ;
                }
//                console.log("Sending without PubNub");
            }
        }
        ESCNetworking._send('e' + command + ":" + JSON.stringify(body));
    },
    setUsername: function (u) {
        if (ESCNetworkState.username !== u) {
            ESCNetworkState.username = u;
            ESCNetworking._send("u" + ESCNetworkState.username);
        }
    },
    sendUpdateWebsocket: function (params, args) {
        ESCNetworkState.usernamePlayer = ESCNetworkState.username;
        const values = [];
        args.shift();
        args.forEach(function (item, index) {
            values.push(item.value);
        });
        ESCNetworking.sendJSON({keys: params, values: values});
    },
    sendUpdate: function (params, args) {
        ESCNetworking.sendUpdateWebsocket(params, args);
    },
    sendJSON: function (obj) {
        ESCNetworking.setUsername(ESCNetworkState.usernamePlayer);
        ESCNetworking._send("s" + JSON.stringify(obj));
    },
    log: function (message,channel,retries, retryDelayMs) {
        if (UsePubNub) {
            pubNubLog(message,channel,retries,retryDelayMs);
        }
        else {
            ESCNetworking.sendCommand(LOG_COMMAND,message);
        }
    }
};

Object.assign(ESCNetworking, eventManager);

ESCNetworking.registerEventHandler(CONNECTION_PONG, HANDLER_GROUP_DEFAULT, (message) => {
    const now = Date.now();
    const oldTime = message.time;
    if (oldTime > 0) {
        let delay = now - oldTime;
        if (delay < 1000) {
            ESCNetworkState.pingStats.totalMs += delay;
            ESCNetworkState.pingStats.count++;
            ESCNetworkState.pingStats.avg = Math.round(ESCNetworkState.pingStats.totalMs / ESCNetworkState.pingStats.count);
            //console.log('Network Latency - Count: '+ ESCNetworking.pingStats.count + ' Delay: '+ delay + " avg: " + avg.toFixed(2));
            // DebugManager.commands.notify('Count ' + ESCNetworkState.pingStats.count + ' Latency ' + delay + ' avg: ' + avg.toFixed(2), 1000, "90%", "10%");
        }
        else {
            ESCNetworkState.pingStats.totalMsLong += delay;
            ESCNetworkState.pingStats.countLong++;
            console.log('Network Latency: ' + delay + ", greater than 1 second; not counted in total. Assumed to be a disconnection or game server not running.");
        }
    }
    ESCManager.dispatchUI(ACTION_GAME_LOADED, ESCNetworkState);
});

ESCNetworking.registerEventHandler(CONTROLLER_REGISTERED, HANDLER_GROUP_DEFAULT, (message) => {
    ESCNetworkState.player.deviceId = message.deviceId;
    ESCNetworkState.player.username = message.username;
    ESCNetworkState.player.controllerUuid = message.controllerUuid;
    ESCManager.dispatchUI(ACTION_GAME_LOADED, ESCNetworkState);
});

ESCNetworking.registerEventHandler(RELOAD_CONTROLLER, HANDLER_GROUP_DEFAULT, function (message) {
    window.location = message.url;
});


console.log("Done loading ESCNetworking.js");

window.escNetworking = ESCNetworking;
window.escNetworkState = ESCNetworkState;

ESCNetworking.initPlayerId();

ESCNetworking.registerEventHandler(EVENT_NETWORK_ERROR, HANDLER_GROUP_DEFAULT, (networkState) => {
    console.log("Network error, closeCode: "+networkState.closeCode+" refusedCode: "+networkState.refusedCode+" disconnectCount: "+networkState.disconnectCount);
});


const NetworkDisconnectComponentState = {initialState:true};

const reducerManager = new ReducerManager({
    [ACTION_NETWORK_CONNECTION] : (state, action) => {
        console.log("ReducerManager:",reducerManager);
        const r = {
            ...state,
            closeCode: action.value.closeCode,
            refusedCode: action.value.refusedCode ,
            connected: action.value.connected ,
            wasConnected: state.wasConnected || state.connected ,
            disconnectCount: action.value.disconnectCount,
            pubNubActive: action.value.pubNubActive
        };
        console.log("ReducerManager returns: ",r);
        return r;
    }
});

const ESCNetworkingManager = new EventManager('ESCNetworking', reducerManager);

/**
 *  Network disconnect UI Component
 */
class NetworkDisconnectComponent extends Component {
    render() {
        console.log("NetworkDisconnectComponent: ",this.props);
        const disconnect =
            (!this.props.connected && !this.props.pubNubActive) ?
                (
                    <div className={"network-disconnect"}>
                        {
                            this.props.wasConnected ? "Lost connection. Attempting to reconnect..." :
                                "Unable to connect..."
                        }
                    </div>
                )
                : "";
        const pubNubStatus = this.props.pubNubActive ?
            (
                <div className={"pubnub-active pubnub-status"}>PN</div>
            ) : (
                <div className={"pubnub-inactive pubnub-status"}>PN</div>
            ) ;

        const webSocketStatus = this.props.connected ?
            (
                <div className={"websocket-active websocket-status"}>WS</div>
            ) : (
                <div className={"websocket-inactive websocket-status"}>WS</div>
            ) ;

        return (
            <div>
                {disconnect}
                {webSocketStatus}
                {pubNubStatus}
            </div>
        )
    }
}

if (DevMode) {
    window.SwitchWebSocketPort = SwitchWebSocketPort ;
}

const NetworkDisconnectController = ESCNetworkingManager.connect(NetworkDisconnectComponent, [ACTION_NETWORK_CONNECTION]);

export {ESCNetworking, ESCNetworkState, EVENT_NETWORK_ERROR, EVENT_NETWORK_OPEN, NetworkDisconnectController, connectionData, publishToAggregator};
