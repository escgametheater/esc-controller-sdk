var gameInstance = {
    SendMessage: function(objectName, methodName, args) {
        if(objectName !== "Game") {
            console.log("ERROR: Unknown target for message, expected 'Game' but got", objectName);
            return;
        }

        switch(methodName) {
            case "SendInfoToHost" : {
                var runtimeInfo = {
                    "usedHeapSize": 0,
                    "AllocatedMemoryForGraphicsDriver": 0,
                    "MonoHeapSize": 0,
                    "MonoUsedSize": 0,
                    "TempAllocatorSize": 0,
                    "TotalAllocatedMemory": 0,
                    "TotalReservedMemory": 0,
                    "TotalUnusedReservedMemory": 0,
                };

                RelayHostMessageToMainProcess("GameInfo", JSON.stringify(runtimeInfo));
                break;
            }
            case "OnConnect" : {
                console.log("OnConnect: ", args);
                break;
            }
            case "OnDisconnect" : {
                console.log("OnDisconnect: ", args);
                break;
            }
            case "EventFromString" : {
                console.log("EventFromString: ", args);
                break;
            }
        }
    },
    Module : {
        Pointer_stringify: function(pointer, length) {
            console.log(pointer, length);
            return pointer;
        }
    }
};

setTimeout(() => {
    console.log("OK");
    StartWebsocketRelay();
}, 1000);
