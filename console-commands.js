// Enable boosting in all rooms by setting a flag in memory
global.enableBoostingAllRooms = function() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room && room.controller && room.controller.my) {
            room.memory.boostingEnabled = true;
            console.log(`Boosting enabled in room ${roomName}`);
        }
    }
    console.log('Boosting enabled in all owned rooms.');
};
/**
 * Useful Console Commands
 * 
 * Paste these into the Screeps in-game console to manage
 * remote harvesting rooms and rooms-to-claim lists at runtime.
 * 
 * All data is stored in Memory so changes persist across ticks
 * without needing to redeploy code.
 */

// ============================================================
//  Remote Harvest Management
//  Stored in: Memory.rooms[parentRoom].config.remoteHarvest
// ============================================================

// --- Add a remote harvest room to a parent room ---
// Usage: addRemoteHarvest("E51S23", "E50S23")
global.addRemoteHarvest = function (parentRoomName, remoteRoomName) {
    if (!Memory.rooms[parentRoomName]) {
        return "Parent room " + parentRoomName + " not found in Memory.";
    }
    if (!Memory.rooms[parentRoomName].config) {
        Memory.rooms[parentRoomName].config = {};
    }
    if (!Memory.rooms[parentRoomName].config.remoteHarvest) {
        Memory.rooms[parentRoomName].config.remoteHarvest = [];
    }
    var list = Memory.rooms[parentRoomName].config.remoteHarvest;
    if (list.indexOf(remoteRoomName) !== -1) {
        return remoteRoomName + " is already in remoteHarvest for " + parentRoomName;
    }
    list.push(remoteRoomName);
    return "Added " + remoteRoomName + " to " + parentRoomName + ".config.remoteHarvest → " + JSON.stringify(list);
};

// --- Remove a remote harvest room from a parent room ---
// Usage: removeRemoteHarvest("E51S23", "E50S23")
global.removeRemoteHarvest = function (parentRoomName, remoteRoomName) {
    if (!Memory.rooms[parentRoomName] || !Memory.rooms[parentRoomName].config || !Memory.rooms[parentRoomName].config.remoteHarvest) {
        return "No remoteHarvest config found for " + parentRoomName;
    }
    var list = Memory.rooms[parentRoomName].config.remoteHarvest;
    var idx = list.indexOf(remoteRoomName);
    if (idx === -1) {
        return remoteRoomName + " is not in remoteHarvest for " + parentRoomName;
    }
    list.splice(idx, 1);
    return "Removed " + remoteRoomName + " from " + parentRoomName + ".config.remoteHarvest → " + JSON.stringify(list);
};

// --- List all remote harvest rooms for a parent room ---
// Usage: listRemoteHarvest("E51S23")
global.listRemoteHarvest = function (parentRoomName) {
    if (!Memory.rooms[parentRoomName] || !Memory.rooms[parentRoomName].config || !Memory.rooms[parentRoomName].config.remoteHarvest) {
        return "No remoteHarvest config for " + parentRoomName;
    }
    return parentRoomName + " remoteHarvest: " + JSON.stringify(Memory.rooms[parentRoomName].config.remoteHarvest);
};


// ============================================================
//  Rooms To Claim Management
//  Stored in: Memory.roomsToClaim
// ============================================================

// --- Add a room to the global claim list ---
// Usage: addRoomToClaim("E57S24")
global.addRoomToClaim = function (roomName) {
    if (!Memory.roomsToClaim) {
        Memory.roomsToClaim = [];
    }
    if (Memory.roomsToClaim.indexOf(roomName) !== -1) {
        return roomName + " is already in roomsToClaim";
    }
    Memory.roomsToClaim.push(roomName);
    return "Added " + roomName + " to roomsToClaim → " + JSON.stringify(Memory.roomsToClaim);
};

// --- Remove a room from the global claim list ---
// Usage: removeRoomToClaim("E57S24")
global.removeRoomToClaim = function (roomName) {
    if (!Memory.roomsToClaim) {
        return "roomsToClaim list does not exist in Memory";
    }
    var idx = Memory.roomsToClaim.indexOf(roomName);
    if (idx === -1) {
        return roomName + " is not in roomsToClaim";
    }
    Memory.roomsToClaim.splice(idx, 1);
    return "Removed " + roomName + " from roomsToClaim → " + JSON.stringify(Memory.roomsToClaim);
};

// --- List all rooms to claim ---
// Usage: listRoomsToClaim()
global.listRoomsToClaim = function () {
    if (!Memory.roomsToClaim || Memory.roomsToClaim.length === 0) {
        return "roomsToClaim is empty";
    }
    return "roomsToClaim: " + JSON.stringify(Memory.roomsToClaim);
};


// give console command to find which creep has togo to E56S28
// example usage: findCreepToGo("E56S28")
global.findCreepToGo = function (roomName) {
    var creeps = _.filter(Game.creeps, c => c.memory.toGo && c.memory.toGo[0] == roomName); 
    if (creeps.length == 0) {
        return "No creeps with toGo to " + roomName;
    }
    return "Creeps with toGo to " + roomName + ": " + JSON.stringify(creeps.map(c => c.name));
};

// --- Clear all room memory ---
// Usage: clearAllRoomMemory()
global.clearAllRoomMemory = function () {
    var roomCount = Memory.rooms ? Object.keys(Memory.rooms).length : 0;
    Memory.rooms = {};
    return "Cleared Memory.rooms for " + roomCount + " rooms.";
};

// --- Clear memory for one room ---
// Usage: clearRoomMemory("E56S23")
global.clearRoomMemory = function (roomName) {
    if (!roomName) {
        return "Usage: clearRoomMemory(\"E56S23\")";
    }

    if (!Memory.rooms || !Memory.rooms[roomName]) {
        return "No Memory.rooms entry for " + roomName;
    }

    delete Memory.rooms[roomName];
    return "Cleared Memory.rooms[\"" + roomName + "\"].";
};