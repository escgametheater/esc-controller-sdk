import PubNub from 'pubnub';
import uuid from "uuid";

const PubNubBroadcastChannel = "broadcast";

const CONNECTION_PING = "Ping";
const CONNECTION_CONNECTED = "Connected";
const LOG_CHANNEL_PREFIX = "log.";

const PINGER_PERIOD =  10000 ; // Milliseconds between pings

const AggregatorRetryDelayDefaultMs = 250 ;

let pubNub = false ;
let pubNubPublish = false ;

let isConnected = false ;
let wasConnected = false ;

let connectionData = null;

let connectionAcknowledged = false ;

window.testPubNubPaused = false ;

const MaxPublishTokens = 15 ;
const MaxPublishTokensTimeSeconds = 1 ;
let publishTokens = MaxPublishTokens ;

let offlineChannel = null ;
let gameBroadcastChannel = null ;
let gameStateChannel = null ;
let aggregateChannel = null ;

function getGameBroadcastChannel() {
    try {
        return window.esc.page.game_instance.pub_nub_channels.game_broadcast.channel_name ;
    }
    catch (e) {
        console.error("Unable to find game_broadcast channel.",e);
        return null;
    }
}

function getOfflineChannel() {
    try {
        return window.esc.page.game_instance.pub_nub_channels.offline_broadcast.channel_name ;
    }
    catch (e) {
        console.error("Unable to find offline_broadcast channel.",e);
        return null;
    }
}

function getGameStateChannel() {
    try {
        return window.esc.page.game_instance.pub_nub_channels.game_config.channel_name ;
    }
    catch (e) {
        console.warn("Unable to find game_state channel. Using game_broadcast channel instead",e);
        return getGameBroadcastChannel();
    }
}

function hostChannel(hostInstanceId) {
    let channel = null ;
    if (window.UsingTestESC) {
        if (hostInstanceId) {
            channel = "host-"+hostInstanceId ;
        }
    } else {
        try {
            channel = window.esc.page.game_instance.pub_nub_channels.game_direct.channel_name ;
        }
        catch (e) {
            console.warn("Unable to find game_direct channel. Using game_broadcast channel instead",e);
            return null;
        }
    }
    return channel;
}

function controllerChannel(connectionData) {
    try {
        return window.esc.page.game_instance.pub_nub_channels.game_player_direct.channel_name ;
    }
    catch (e) {
        console.warn("Unable to find game_direct channel. Not subscribing to anything",e);
        return null;
    }
}

function logChannel(connectionData) {
    return LOG_CHANNEL_PREFIX + connectionData.gameInstanceId ;
}

let myHostChannel = false ;
let gamePlayerDirectChannel = false ;
let myLogChannel = false ;

let pingerActive = false ;
let messageReceivedSinceLastPing = true ;

function stopPubNubPingerAndDisconnect() {
    pingerActive = false ;
    clearTimeout(pingerTimeout);
    disconnect();
}
window.stopPubNubPingerAndDisconnect = stopPubNubPingerAndDisconnect ;

let pingerTimeout = false ;

function pubNubPinger (n, delay, message) {
    if (!pubNub) {
        return ;
    }
    console.log("Pinging via PubNub, messageReceivedSinceLastPing: "+messageReceivedSinceLastPing+ ", sending message:",message);
    pubNubSendEvent(CONNECTION_PING, { time: Date.now(), message: message});
    // if we didn't get any response from the host since the last ping, treat as a disconnect
    if (!messageReceivedSinceLastPing) {
        disconnect();
    }
    messageReceivedSinceLastPing = false ;

    if (n === 1) {
        pingerActive = false ;
        return;
    }
    pingerActive = true ;
    pingerTimeout = setTimeout(function() {
        pubNubPinger( n < 1 ? 0 : n - 1, delay,message);
    },delay);
}
window.pubNubPinger = pubNubPinger ;

function dispatchEvent() {
    console.log("PubNub dispatchEvent() not defined.");
}

function onDisconnect () {
    console.log("PubNub disconnect.");
}

function onReconnect () {
    console.log("PubNub reconnect.");
    getLastState();
}

function onConnect () {
    console.log("PubNub connected.");
}

function disconnect() {
    if (isConnected) {
        onDisconnect();
    }
    messageReceivedSinceLastPing = false ;
    isConnected = false ;
}

function checkIfReconnect() {
    if (isConnected) {
        return ;
    }
    if (wasConnected) {
        isConnected = true ;
        onReconnect() ;
        return ;
    }
    if (myHostChannel) {
        sendConnectionData();
    }
}

function pubNubSend(message) {
    if (window.testPubNubPaused || !myHostChannel) {
        return ;
    }

    if (publishTokens === 0) {
        console.warn(`PubNub publish rate limit warning, more than ${MaxPublishTokens} messages in last ${MaxPublishTokensTimeSeconds===1? "":MaxPublishTokensTimeSeconds}s.`,message);
        publishTokens += MaxPublishTokens;
    }
    publishTokens-- ;
    setTimeout(function() {
        publishTokens++;
    },1000*MaxPublishTokensTimeSeconds);

    message.replyChannel = gamePlayerDirectChannel ;

    pubNub.publish({channel: myHostChannel, message: message}, function (status, response) {
        if (status.error) {
            console.error("PubNub error sending message to " + myHostChannel, message, status, response);
            disconnect();
        }
        else {
            // console.log("PubNub message sent to " + myHostChannel, message, status, response);
        }
    });
}

function pubNubLog(message,channel,retries, retryDelayMs) {
    // if retries is negative, retry forever
    if (window.testPubNubPaused) {
        return ;
    }
    channel = channel || myLogChannel ;
    retryDelayMs = retryDelayMs || 1000 ;
    if (retries === undefined) {
        retries = 100 ;
    }
    pubNub.publish({channel: channel, message: message}, function (status, response) {
        if (status.error) {
            console.error("PubNub error sending log message to " + channel + (retries? ". Will retry in "+retryDelayMs/1000+ " seconds." : ". Will not retry."), message, status, response);
            if (retries) {
                setTimeout(function () {
                    pubNubLog(message,channel,retries-1,retryDelayMs);
                },retryDelayMs);
            }
        }
        else {
            // console.log("PubNub message sent to " + myHostChannel, message, status, response);
        }
    });
}

function pubNubSendEvent(eventName,body) {
    const message = {
        eventName: eventName,
        body: body
    };
    pubNubSend(message);
}

function stopPubNub() {
    if (!pubNub) {
        return false;
    }
    pubNub.stop();
    pubNub = false ;
    disconnect();
}

function startPubNub(newConnectionData,dispatchEventFunction, onConnectFunction, onDisconnectFunction, onReconnectFunction) {
    if (pubNub) {
        return false;
    }
    const pubNubConfig = window.esc.page.pub_nub_config ;
    if (!pubNubConfig) {
        console.log("No pubNub config, not starting PubNub");
        return false;
    }
    connectionData = newConnectionData ;
    connectionData.origin = window.location.origin ;
    gamePlayerDirectChannel = controllerChannel(connectionData);
    pubNubConfig.uuid = gamePlayerDirectChannel;
    pubNub = new PubNub(pubNubConfig);
    console.log(pubNub);

    pubNubPublish = pubNub.publish ;

    if (dispatchEvent) {
        dispatchEvent = dispatchEventFunction ;
    }
    if (onConnectFunction) {
        onConnect = onConnectFunction ;
    }
    if (onDisconnectFunction) {
        onDisconnect = onDisconnectFunction ;
    }
    if (onReconnectFunction) {
        onReconnect = function () {
            onReconnectFunction() ;
            getLastState();
        };
    }

    offlineChannel = getOfflineChannel();

    if(window.esc.isOfflineGame()) {
        gameBroadcastChannel = offlineChannel;
        gameStateChannel = getGameStateChannel();
        aggregateChannel = null;
        myHostChannel = null;
        myLogChannel = logChannel(connectionData);
    }
    else {
        if(window.esc.isAggregateGame()) {
            gameBroadcastChannel = getGameBroadcastChannel() ;
            gameStateChannel = getGameStateChannel() ;
            aggregateChannel = getAggregateChannel() ;
            myHostChannel = window.esc.isHostAdmin() ? hostChannel(connectionData.hostInstanceId) : null;
            myLogChannel = logChannel(connectionData);
        }
        else {
            gameBroadcastChannel = getGameBroadcastChannel() ;
            gameStateChannel = getGameStateChannel() ;
            aggregateChannel = null ;
            myHostChannel = hostChannel(connectionData.hostInstanceId);
            myLogChannel = logChannel(connectionData);
        }
    }

    pubNub.addListener({
        status: function (statusEvent) {
            // https://www.pubnub.com/docs/web-javascript/status-events
            switch (statusEvent.category) {
                case "PNConnectedCategory" :
                    // Not necessarily connected to the host though
                    // We can only tell if the host is connected if we get a message from the host
                    console.log("PubNub connected status event", statusEvent);
                    getLastState();
                    pubNubSendEvent(CONNECTION_PING, { time: Date.now(), message: statusEvent.category});
                    break ;
                case "PNNetworkUpCategory" :
                    console.log("PubNub network UP status event", statusEvent);
                    pubNubSubscribe(); // PubNub should respond to this with PNConnectedCategory
                    // Must resubscribe after a PNNetworkUpCategory
                    // (That is not well-documented by pubnub)
                    // We could also try to catch up old messages.
                    //https://www.pubnub.com/docs/web-javascript/pubnub-network-lifecycle#reconnection-policies
                    break ;
                case "PNTimeoutCategory" :
                case "PNBadRequestCategory" :
                case "PNNetworkDownCategory" :
                case "PNAccessDeniedCategory" :
                case "PNUnknownCategory" :
                case "PNNetworkIssuesCategory" :
                    console.log("PubNub status event, treating as disconnect", statusEvent);
                    disconnect();
                    break ;
                default:
                    console.log("Unexpected PubNub status event", statusEvent);
            }
        },
        message: function (msg) {
            if (msg.channel === gameStateChannel) {
                console.log("Game state message received",msg);
            }
            else if (msg.channel === gameBroadcastChannel) {
                console.log("Broadcast message received",msg);
            }
            else {
                console.log("Regular message received",msg);
            }

            if (window.testPubNubPaused) {
                console.log(`PubNub test paused, received message `,msg);
                return ;
            }
            if (msg.message.eventName === CONNECTION_CONNECTED) {
                if (connectionAcknowledged) {
                    console.error(`PubNub received a second ${CONNECTION_CONNECTED} message.`);
                }
                else {
                    isConnected = true ;
                    wasConnected = true ;
                    onConnect();
                }
                connectionAcknowledged = true ;
                return ;
            }
            checkIfReconnect();
            messageReceivedSinceLastPing = true ;
            // console.log("PubNub message received: ", msg);
            if (msg.message.eventName) {
                // console.log("PubNub dispatching message");
                dispatchEvent(msg.message.eventName,msg.message.body)
            }
        }
    });
    pubNubSubscribe();

    console.log("PubNub Host channel: "+myHostChannel);

    if (myHostChannel) {
        // Only send connectionData and start the pinger if it's a regular connection or this is the host admin
        sendConnectionData();
        pubNubPinger(0,PINGER_PERIOD,"pubnub");
    } else {
        console.log("Not starting pubnub pinger.");
    }

    Object.keys(window.esc.page.game_instance.pub_nub_channels).forEach(function(channelName) {
        console.log(channelName, window.esc.page.game_instance.pub_nub_channels[channelName]);
    });

    return pubNub ;
}

function getAggregateChannel() {
    try {
        let channel = window.esc.page.game_instance.pub_nub_channels.game_aggregate_pub.channel_name ;
        if (channel.startsWith("aggregate.")) {
            return channel ;
        }
        return `aggregate.${window.esc.page.game_instance.id}` ;
    }
    catch (e) {
        console.warn("Unable to find game aggregate channel.",e);
        try {
            return `aggregate.${window.esc.page.game_instance.id}` ;
        }
        catch (e2) {
            console.warn("Unable to find game_instance.id",e2);
            return false ;
        }
    }
}

// TODO: add throttling

function retryPublishToAggregator(message,onError,onSuccess,retries,retryDelay) {
    if (!retries || retries < 0 ) {
        return false;
    }
    retryDelay = retryDelay || AggregatorRetryDelayDefaultMs ;
    console.log("Retrying publishToAggregator in "+retryDelay/1000)     ;
    setTimeout(function() {
        publishToAggregator(message,onError,onSuccess,retries-1,retryDelay);
    },retryDelay);
    return true;
}

function publishToAggregator(message, onError, onSuccess, retries, retryDelay) {
    if (!pubNub) {
        console.error("publishToAggregator called but pubNub is not initialized.");
        retryPublishToAggregator(message,onError,onSuccess,retries,retryDelay);
        return false;
    }
    if (!pubNub.fire) {
        console.error("publishToAggregator called but pubNub.fire is not available.");
        retryPublishToAggregator(message,onError,onSuccess,retries,retryDelay);
        return false;
    }
    const channel = getAggregateChannel();
    if (!channel) {
        console.warn("publishToAggregator called before game instance set");
        retryPublishToAggregator(message,onError,onSuccess,retries,retryDelay);
        return false;
    }

    const requestTime = Date.now();

    //console.log("Publishing to "+this.channel+": "+JSON.stringify(message));
    pubNub.fire({channel, message}, function(status, response) {
        const responseTime = Date.now();
        const delayTime = responseTime - requestTime ;
        if (status.error) {
            const errorMessage = {
                error:"Error publishing to aggregator",
                status: status,
                response: response,
                channel: channel,
                message: message,
                userId: window.esc.global.user.id,
                sessionId: window.esc.global.user.session_entity.id,
                requestTime: requestTime,
                responseTime: responseTime,
                delayTime: delayTime,
                retries: retries
            };
            if (status.category === "PNTimeoutCategory") {
                console.error("Error PNTimeoutCategory publishing to aggregator, requestTime "
                    + requestTime + " responseTime " + responseTime + " delayTime " + delayTime);
            }
            else if (status.errorData.syscall === "getaddrinfo") {
                console.error("Error publishing to aggregator: "+status.errorData.syscall+" code " + status.errorData.code);
                errorMessage.syscall = status.errorData.syscall;
                errorMessage.code = status.errorData.code;
            }
            else {
                console.error("Error publishing to aggregator: ", status, response);
            }

            pubNubLog(errorMessage);

            if (!retryPublishToAggregator(message,onError,onSuccess,retries,retryDelay)) {
                if (onError) {
                    onError(status.error);
                }
            }
        }
        else {
            if (onSuccess) {
                onSuccess(response);
            }
            console.log("Published to aggregator channel "+channel,message);
        }
    });
    return true ;
}

function getLastState(cb) {
    console.log("Getting last state message");

    const handleHistoryResponse = function(channel) {
        return function (status,response) {
            try {
                if (status.error) {
                    console.error("getLastState history returned error.",channel, status,response);
                    maybeRetry(channel);
                    return;
                }
                if (!response.messages) {
                    console.error("getLastState returned no messages.",channel, status,response);
                    maybeRetry(channel);
                    return;
                }
                if (!response.messages.length) {
                    console.error("getLastState returned empty list of messages.",channel, status,response);
                    maybeRetry(channel);
                    return;
                }
                const timeToken = response.messages[0].timetoken ;
                // TODO: check that timeToken is not too old, or add it to the event body?
                const ev = response.messages[0].entry ;
                if (ev.eventName) {
                    console.log("PubNub dispatching last state message",channel, ev);
                    dispatchEvent(ev.eventName,ev.body);
                }

                console.log("last message:", channel, response.messages[0]);
                if (cb) {
                    cb(status,response);
                }
            }
            catch (e) {
                console.error("Error exception getting state history. Is history enabled for this pubnub keyset?",e)
            }
        }
    };

    function maybeRetry(channel) {
        if(channel !== gameBroadcastChannel) {
            pubNub.history({
                channel:gameBroadcastChannel,
                count: 1,
                stringifiedTimeToken: true
            }, handleHistoryResponse(gameBroadcastChannel) );
        }
    }

    pubNub.history({
        channel:gameStateChannel,
        count: 1,
        stringifiedTimeToken: true
    }, handleHistoryResponse(gameStateChannel) );
}

function pubNubSubscribe() {
    const channels = [gamePlayerDirectChannel];
    if (gameBroadcastChannel) {
        channels.push(gameBroadcastChannel);
    }
/* DO NOT SUBSCRIBE TO THIS CHANNEL, ONLY USE IT FOR HISTORY UNTIL WE HAVE all host<->controllers updated
    if (gameStateChannel) {
        channels.push(gameStateChannel);
    }
*/

    if (offlineChannel) {
        channels.push(offlineChannel);
    }

    console.log("Subscribing to PubNub channels", channels);

    pubNub.subscribe(
        {
            channels: channels
        }
    );
}

function sendConnectionData() {
    if (connectionAcknowledged || !myHostChannel) {
        return ;
    }
    connectionData.replyChannel = gamePlayerDirectChannel ;
    const message = {
        connectionData: {...connectionData},
        replyChannel: gamePlayerDirectChannel
    };

    pubNub.publish({channel: myHostChannel, message: message}, function (status, response) {
        if (status.error) {
            console.error("PubNub error sending connectionData to " + myHostChannel, message, status, response);
            disconnect();
        }
        else {
            console.log("PubNub connectionData sent to " + myHostChannel, message, status, response);
        }
    });

}

function getGamePlayerDirectChannel() {
    return gamePlayerDirectChannel;
}

export {
    startPubNub, stopPubNub, pubNubSend, pubNubSendEvent, publishToAggregator, pubNubLog, getGamePlayerDirectChannel
};
