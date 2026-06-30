
var utils = require('utils');

function resetProductionStateForRoom(roomName) {
    var roomMemory = Memory.rooms && Memory.rooms[roomName];
    var visibleRoom = Game.rooms && Game.rooms[roomName];
    var factoryCount = 0;
    var labCount = 0;

    if (!roomMemory && !visibleRoom) {
        return null;
    }

    if (!roomMemory) {
        Memory.rooms[roomName] = {};
        roomMemory = Memory.rooms[roomName];
    }

    delete roomMemory.inventoryGoal;
    delete roomMemory.productionTarget;
    delete roomMemory.labSetup;
    delete roomMemory.labDemand;
    delete roomMemory.labEnergyDemand;
    delete roomMemory.factoryDemand;
    delete roomMemory.factoryProductionTarget;

    if (visibleRoom) {
        var labs = visibleRoom.find(FIND_MY_STRUCTURES, {
            filter: function (structure) { return structure.structureType === STRUCTURE_LAB; }
        });
        var factories = visibleRoom.find(FIND_MY_STRUCTURES, {
            filter: function (structure) { return structure.structureType === STRUCTURE_FACTORY; }
        });

        labCount = labs.length;
        factoryCount = factories.length;
    }

    return roomName + " (labs=" + labCount + ", factories=" + factoryCount + ")";
}

// --- Clear inventory goals and reset lab/factory production state ---
// Usage: resetProduction()
// Usage: resetProduction("E51S23")
global.resetProduction = function (roomName) {
    var targetRooms = [];
    var seenRooms = {};
    var resetRooms = [];
    var name;

    if (!Memory.rooms) {
        Memory.rooms = {};
    }

    if (roomName) {
        targetRooms.push(roomName);
    } else {
        for (name in Memory.rooms) {
            if (!seenRooms[name]) {
                seenRooms[name] = true;
                targetRooms.push(name);
            }
        }
        for (name in Game.rooms) {
            if (!seenRooms[name]) {
                seenRooms[name] = true;
                targetRooms.push(name);
            }
        }
    }

    for (var i = 0; i < targetRooms.length; i++) {
        var result = resetProductionStateForRoom(targetRooms[i]);
        if (result) {
            resetRooms.push(result);
        }
    }
}
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
//  Observer Management
//  Stored in: Memory.rooms[roomName].observer and Memory.observer.rooms
// ============================================================

global.checkObserver = function (roomName) {
    if (!Memory.rooms || !Memory.rooms[roomName] || !Memory.rooms[roomName].observer) {
        return "No observer config found for " + roomName;
    }

    var observerMemory = Memory.rooms[roomName].observer;
    var status = observerMemory.enabled === false ? "disabled" : "enabled";
    return "Observer is " + status + " in room " + roomName + ", lastAttempt=" + observerMemory.lastAttemptedRoomName + ", lastObserved=" + observerMemory.lastObservedRoomName;
};

global.getObservedRoom = function (roomName) {
    if (!Memory.observer || !Memory.observer.rooms || !Memory.observer.rooms[roomName]) {
        return "No observed room result for " + roomName;
    }

    return JSON.stringify(Memory.observer.rooms[roomName]);
};

global.clearObservedRoom = function (roomName) {
    if (!Memory.observer || !Memory.observer.rooms || !Memory.observer.rooms[roomName]) {
        return "No observed room result for " + roomName;
    }

    delete Memory.observer.rooms[roomName];
    return "Cleared observed room result for " + roomName;
};

// --- Clear cached observableRooms from all observer room memories ---
// Usage: cor()
global.cor = function () {
    if (!Memory.rooms) {
        return "No room memory found";
    }

    var cleared = 0;

    for (var roomName in Memory.rooms) {
        var roomMemory = Memory.rooms[roomName];
        if (!roomMemory || !roomMemory.observer || !roomMemory.observer.observableRooms) {
            continue;
        }

        delete roomMemory.observer.observableRooms;
        cleared++;
    }

    return "Cleared observer.observableRooms in " + cleared + " rooms";
};

// --- Utility: print table helper (file-scoped) ---
function printTable(headers, rows, textCols) {
    function pad(s, w) { return String(s).padEnd(w); }
    var widths = headers.map(function (h) { return h.length; });
    for (var i = 0; i < rows.length; i++) {
        for (var j = 0; j < rows[i].length; j++) {
            widths[j] = Math.max(widths[j], String(rows[i][j]).length);
        }
    }
    var sep = '+' + widths.map(function (w) { return '-'.repeat(w + 2); }).join('+') + '+';
    console.log(sep);
    console.log('| ' + headers.map(function (h, i) { return pad(h, widths[i]); }).join(' | ') + ' |');
    console.log(sep);
    return { widths: widths, sep: sep };
}

// --- Summarize owned visible factories by level ---
// Usage: listFactories()
global.listFactories = function () {
    var rows = [];
    var totalFactories = 0;
    var levelCounts = {};

    for (var roomName in Game.rooms) {
        var room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my)
            continue;

        var factory = room.factory;
        if (!factory)
            continue;

        var level = factory.level || 0;
        totalFactories++;
        levelCounts[level] = (levelCounts[level] || 0) + 1;
        rows.push([room.name, level, factory.isActive() ? 'yes' : 'no']);
    }

    if (rows.length === 0)
        return 'No owned visible factories found';

    rows.sort(function (a, b) {
        if (a[1] !== b[1])
            return a[1] - b[1];
        return a[0].localeCompare(b[0]);
    });

    printTable(['Room', 'Level', 'Active'], rows);
    console.log('Total factories: ' + totalFactories);

    var levels = Object.keys(levelCounts).sort(function (a, b) {
        return Number(a) - Number(b);
    });
    var summary = [];
    for (var i = 0; i < levels.length; i++) {
        summary.push('L' + levels[i] + '=' + levelCounts[levels[i]]);
    }

    return 'Factory levels: ' + summary.join(', ');
};

global.listPowerBanks = function () {
    if (!Memory.observer || !Memory.observer.rooms) {
        return "No observed rooms in memory";
    }

    var myLevel8Rooms = _.chain(Game.rooms)
        .filter(function (room) {
            return room && room.controller && room.controller.my && room.controller.level >= 7;
        })
        .map(function (room) {
            return room.name;
        })
        .value();

    var result = [];

    for (var roomName in Memory.observer.rooms) {
        var observedRoom = Memory.observer.rooms[roomName];
        if (!observedRoom || !observedRoom.powerBank)
            continue;

        var hits = observedRoom.powerBank.hits || 0;
        var ticksToDecay = observedRoom.powerBank.ticksToDecay || 0;
        var requiredAttackParts = 0;

        if (ticksToDecay > 0) {
            requiredAttackParts = Math.ceil(hits / (ticksToDecay - 500) / ATTACK_POWER);
        }

        var closestLevel8Room = null;
        var closestLevel8Distance = null;

        for (var i = 0; i < myLevel8Rooms.length; i++) {
            var myRoomName = myLevel8Rooms[i];
            var distance = 50 * Game.map.getRoomLinearDistance(roomName, myRoomName);
            var route = Game.map.findRoute(roomName, myRoomName);
            if (route != ERR_NO_PATH) {
                distance = 50 * route.length;
            }
            if (closestLevel8Distance === null || distance < closestLevel8Distance) {
                closestLevel8Distance = distance;
                closestLevel8Room = myRoomName;
            }
        }

        var efficiency = 1 - closestLevel8Distance / 1500;

        var cost = BODYPART_COST[ATTACK] + 2 * BODYPART_COST[MOVE] + BODYPART_COST[HEAL];
        cost = 50 * cost;
        cost = cost / efficiency;

        console.log("Power bank in ", roomName, " has hits ",
            hits, " ticksToDecay ", ticksToDecay,
            " requiredAttackParts ",
            requiredAttackParts, " closestLevel8Room ",
            closestLevel8Room, " closestLevel8Distance ",
            closestLevel8Distance, " efficiency ",
            efficiency.toFixed(2), " cost ",
            cost.toFixed(2));

        var value = requiredAttackParts * cost / observedRoom.powerBank.power;

        result.push({
            roomName: roomName,
            observedAt: observedRoom.observedAt,
            observedBy: observedRoom.observedBy,
            hits: hits,
            power: observedRoom.powerBank.power,
            ticksToDecay: ticksToDecay,
            closestLevel8Room: closestLevel8Room,
            closestLevel8Distance: closestLevel8Distance,
            requiredAttackParts: requiredAttackParts,
            value: value,

        });
    }

    if (result.length === 0) {
        return "No power banks found in observed rooms";
    }

    result = _.sortBy(result, function (entry) {
        return entry.value;
    });

    var headers = ['Room', 'Ticks', 'Hits', 'Power', 'ClosestRCL8', 'Dist', 'AttackParts', 'Value'];
    var rows = result.map(function (entry) {
        return [
            entry.roomName,
            String(entry.ticksToDecay),
            String(entry.hits),
            String(entry.power),
            entry.closestLevel8Room || '-',
            entry.closestLevel8Distance === null ? '-' : String(entry.closestLevel8Distance),
            String(entry.requiredAttackParts),
            String(entry.value.toFixed(2)),
        ];
    });

    var tbl = printTable(headers, rows, [0, 4]);
    function pad(value, width) { return String(value).padEnd(width); }
    function rpad(value, width) { return String(value).padStart(width); }
    for (var k = 0; k < rows.length; k++) {
        console.log('| ' + rows[k].map(function (value, index) {
            if (index === 0 || index === 4)
                return pad(value, tbl.widths[index]);
            return rpad(value, tbl.widths[index]);
        }).join(' | ') + ' |');
    }
    console.log(tbl.sep);

    return "Printed " + result.length + " observed power banks";
};

// --- List all observed deposits ---
// Usage: listDeposits()
global.listDeposits = function () {
    if (!Memory.observer || !Memory.observer.rooms) {
        return "No observed rooms in Memory.observer.rooms.";
    }
    var result = [];
    for (var roomName in Memory.observer.rooms) {
        var room = Memory.observer.rooms[roomName];
        if (room.deposits && room.deposits.length > 0) {
            for (var i = 0; i < room.deposits.length; i++) {
                var dep = room.deposits[i];
                result.push({
                    roomName: roomName,
                    id: dep.id,
                    type: dep.depositType,
                    cooldown: dep.cooldown,
                    ticksToDecay: dep.ticksToDecay,
                    observedAt: room.observedAt,
                    observedBy: room.observedBy
                });
            }
        }
    }
    if (result.length === 0) {
        return "No deposits found in observed rooms.";
    }

    // Table columns: Room, Type, Cooldown, Ticks, ID, ObservedBy, ObservedAt
    var headers = ['Room', 'Type', 'Cooldown', 'Ticks', 'ID', 'ObservedBy', 'ObservedAt'];
    var rows = result.map(function (entry) {
        return [
            entry.roomName,
            entry.type,
            String(entry.cooldown),
            String(entry.ticksToDecay),
            entry.id,
            entry.observedBy || '-',
            entry.observedAt === undefined ? '-' : String(entry.observedAt)
        ];
    });

    var tbl = printTable(headers, rows, [0, 1]);
    function pad(value, width) { return String(value).padEnd(width); }
    function rpad(value, width) { return String(value).padStart(width); }
    for (var k = 0; k < rows.length; k++) {
        console.log('| ' + rows[k].map(function (value, index) {
            return (index === 0 || index === 1) ? pad(value, tbl.widths[index]) : rpad(value, tbl.widths[index]);
        }).join(' | ') + ' |');
    }
    console.log(tbl.sep);

    return "Printed " + result.length + " observed deposits";
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

// add function to calculate price of materials and store them in memory
// Usage: calculateAndStorePrices()
global.calculateAndStorePrices = function () {



    // Example: calculate price of energy based on market data
    //for each in RESOURCES_ALL
    var raw_prices = {};
    RESOURCES_ALL.forEach(resource => {
        var history = Game.market.getHistory(resource);
        if (!Array.isArray(history) || history.length == 0)
            return;

        // Take the average price from the last 10 days
        var recentHistory = history.slice(-10);
        var avgPrice = recentHistory.reduce((sum, entry) => sum + entry.avgPrice, 0) / recentHistory.length;

        raw_prices[resource] = avgPrice;

        console.log(" " + resource + ": " + avgPrice.toFixed(2));
    });


    // Primitive resources – use market price directly; never recurse into these
    // to avoid circular loops through _bar recipes.
    var PRIMITIVE_SET = {};
    [
        RESOURCE_ENERGY,    // 'energy'
        RESOURCE_POWER,     // 'power'
        RESOURCE_HYDROGEN,  // 'H'
        RESOURCE_OXYGEN,    // 'O'
        RESOURCE_UTRIUM,    // 'U'
        RESOURCE_LEMERGIUM, // 'L'
        RESOURCE_KEANIUM,   // 'K'
        RESOURCE_ZYNTHIUM,  // 'Z'
        RESOURCE_CATALYST,  // 'X'
        //RESOURCE_GHODIUM,   // 'G'
        RESOURCE_OPS,       // 'ops'
        RESOURCE_SILICON,   // 'silicon'
        RESOURCE_METAL,     // 'metal'
        RESOURCE_BIOMASS,   // 'biomass'
        RESOURCE_MIST,      // 'mist'
    ].forEach(function (r) { PRIMITIVE_SET[r] = true; });

    // Recursively compute the production cost of a resource using only
    // primitive market prices at the leaves.
    var deepCache = {};
    var deepInProgress = {};
    function getDeepCost(resource) {
        if (deepCache[resource] !== undefined) return deepCache[resource];
        if (deepInProgress[resource]) {
            return raw_prices[resource] || 0;
        }
        if (PRIMITIVE_SET[resource]) {
            deepCache[resource] = raw_prices[resource] || 0;
            return deepCache[resource];
        }
        var commodity = COMMODITIES[resource];
        if (!commodity || !commodity.components) {
            deepCache[resource] = raw_prices[resource] || 0;
            return deepCache[resource];
        }
        deepInProgress[resource] = true;
        var componentCost = 0;
        for (var comp in commodity.components) {
            componentCost += getDeepCost(comp) * commodity.components[comp];
        }
        var result = componentCost / commodity.amount;
        delete deepInProgress[resource];
        deepCache[resource] = result;
        return result;
    }

    console.log("resource          |  market $ | shallow $ |   deep $  | shallowMargin | deepMargin | deepCr/tick | level | reagents");

    RESOURCES_ALL.forEach(resource => {
        if (!raw_prices[resource])
            return;

        var commodity = COMMODITIES[resource];
        if (!commodity || !commodity.components)
            return;

        var marketPrice = raw_prices[resource];

        // Shallow cost: direct component market prices (one level)
        var shallowCost = 0;
        for (var comp in commodity.components) {
            shallowCost += (raw_prices[comp] || 0) * commodity.components[comp];
        }
        shallowCost = shallowCost / commodity.amount;

        // Deep cost: recursive from primitives, always computed for any commodity with a recipe
        var level = commodity.level || 0;
        var deepCost = getDeepCost(resource);

        var shallowMargin = shallowCost > 0 ? ((marketPrice - shallowCost) / shallowCost * 100).toFixed(1) : "N/A";
        var deepMarginCrPerUnit = marketPrice - deepCost;
        var deepMarginStr = deepCost > 0 ? (deepMarginCrPerUnit / deepCost * 100).toFixed(1) : "-";
        var deepMarginPerTick = "-";
        if (commodity.cooldown > 0) {
            deepMarginPerTick = (deepMarginCrPerUnit * commodity.amount / commodity.cooldown).toFixed(3);
        }
        var deepCostStr = deepCost > 0 ? deepCost.toFixed(2).padStart(10) : "         -";

        
        var padResource = resource.padEnd(17);
        var padMarket = marketPrice.toFixed(1).padStart(10);
        var padShallow = shallowCost.toFixed(1).padStart(10);
        var padShallowM = shallowMargin.padStart(14);
        var padDeepM = deepMarginStr.padStart(11);
        var padDeepTick = deepMarginPerTick.padStart(11);
        var reagents = Object.keys(commodity.components).join(", ");

        console.log(padResource + " | " + padMarket + " | " + padShallow + " | " + deepCostStr + " | " + padShallowM + "% | " + padDeepM + "% | " + padDeepTick + " | " + level + " | " + reagents);
    });

    //Memory.prices = undefined;
    return "Done.";
};

global.roadEfficiency = function () {
    var repairCostOfRoadPerTick =  (ROAD_DECAY_AMOUNT / REPAIR_POWER )/ ROAD_DECAY_TIME;
    var numRoads = 50;

    var costOfCarry = BODYPART_COST[CARRY] * 10 / CREEP_LIFE_TIME;

    console.log("Energy repair cost per tick for " + numRoads + " roads: " + (numRoads*repairCostOfRoadPerTick).toFixed(2) +
        ", Cost of carry: " + costOfCarry.toFixed(2));
};

// Usage: testRoadedPath()
// Usage: testRoadedPath("69d60a6ae16a8056b7968305", "69dbcbf9058adf6a4ceb935b")
global.testRoadedPath = function (fromId, toId) {
    fromId = fromId || "6a03852bb22d771d8abe56d6";
    toId = toId || "69dbcbf9058adf6a4ceb935b";

    var from = Game.getObjectById(fromId);
    var to = Game.getObjectById(toId);

    if (!from || !to) {
        return "Missing object: from=" + (!!from) + ", to=" + (!!to);
    }

    var utilsRoaded = utils.isRoaded(from, to);

    var path = utils.getPathMultiroom(from, to, 1);
    if (!path || path.length === 0) {
        return "No path found between " + fromId + " and " + toId;
    }

    var middlePath = path.slice(1, path.length - 1);
    var missingRoads = [];

    for (var i = 0; i < middlePath.length; i++) {
        var step = middlePath[i];
        var room = Game.rooms[step.roomName];

        if (!room) {
            missingRoads.push(step.roomName + ":" + step.x + "," + step.y + "(no-vision)");
            continue;
        }

        var look = room.lookForAt(LOOK_STRUCTURES, step.x, step.y);
        var hasRoad = _.some(look, function (structure) {
            return structure.structureType === STRUCTURE_ROAD;
        });

        if (!hasRoad) {
            missingRoads.push(step.roomName + ":" + step.x + "," + step.y);
        }
    }

    return JSON.stringify({
        fromId: fromId,
        toId: toId,
        pathLength: path.length,
        middleTiles: middlePath.length,
        utilsRoaded: utilsRoaded,
        roaded: missingRoads.length === 0,
        missingRoads: missingRoads.slice(0, 20)
    });
};
// Analyze market history from archived Memory + live transactions
// Usage: analyzeMarketHistory()                    — all resources, summary
// Usage: analyzeMarketHistory("energy")            — filter by resource
// Usage: analyzeMarketHistory(null, true)           — group by date
// Usage: analyzeMarketHistory("energy", true)       — filter + group by date
// Usage: analyzeMarketHistory("energy", true, 0.3)  — custom EMA alpha (0..1)
global.analyzeMarketHistory = function (filterResource, groupByDate, emaAlpha) {
    // ---- Collect all transactions: archived + live unarchived ----
    var archived = (Memory.marketHistory && Memory.marketHistory.txns) || [];
    var lastTick = (Memory.marketHistory && Memory.marketHistory.lastTick) || 0;

    var all = [];
    for (var ai = 0; ai < archived.length; ai++) {
        var e = archived[ai];
        all.push({ time: e.t, resourceType: e.r, amount: e.a, price: e.p, dir: e.d === 'B' ? 'BUY' : 'SELL' });
    }

    // Merge live transactions not yet archived
    var incoming = Game.market.incomingTransactions || [];
    var outgoing = Game.market.outgoingTransactions || [];
    for (var ii = 0; ii < incoming.length; ii++) {
        var ti = incoming[ii];
        if (ti.order && ti.time > lastTick) {
            all.push({ time: ti.time, resourceType: ti.resourceType, amount: ti.amount, price: ti.order.price, dir: 'BUY' });
        }
    }
    for (var oi = 0; oi < outgoing.length; oi++) {
        var to = outgoing[oi];
        if (to.order && to.time > lastTick) {
            all.push({ time: to.time, resourceType: to.resourceType, amount: to.amount, price: to.order.price, dir: 'SELL' });
        }
    }

    // Apply resource filter
    if (filterResource) {
        all = all.filter(function (t) { return t.resourceType === filterResource; });
    }

    if (all.length === 0) {
        return "No market transactions found." + (filterResource ? " (filter: " + filterResource + ")" : "") +
            " Archive has " + archived.length + " entries total.";
    }

    // ---- Helpers ----
    var TICK_MS = 4200; // ~4.2s per tick average
    var nowMs = Date.now();
    var alpha = Number(emaAlpha);
    if (!(alpha > 0 && alpha <= 1)) {
        alpha = 0.2;
    }

    // EMA is order-dependent, so process transactions chronologically.
    var allByTime = all.slice().sort(function (a, b) {
        return a.time - b.time;
    });

    function tickToDateStr(tick) {
        var ms = nowMs - (Game.time - tick) * TICK_MS;
        var d = new Date(ms);
        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return yyyy + '-' + mm + '-' + dd;
    }
    function pad(s, w) { return String(s).padEnd(w); }
    function rpad(s, w) { return String(s).padStart(w); }
    function printTable(headers, data, textCols) {
        var widths = headers.map(function (h) { return h.length; });
        data.forEach(function (d) {
            for (var i = 0; i < d.length; i++) {
                widths[i] = Math.max(widths[i], d[i].length);
            }
        });
        var sep = '+' + widths.map(function (w) { return '-'.repeat(w + 2); }).join('+') + '+';
        console.log(sep);
        console.log('| ' + headers.map(function (h, i) { return pad(h, widths[i]); }).join(' | ') + ' |');
        console.log(sep);
        return { widths: widths, sep: sep };
    }

    // ---- Compute date range for summary ----
    var minTick = all[0].time, maxTick = all[0].time;
    for (var ri = 1; ri < all.length; ri++) {
        if (all[ri].time < minTick) minTick = all[ri].time;
        if (all[ri].time > maxTick) maxTick = all[ri].time;
    }

    if (groupByDate) {
        // =========== GROUP BY DATE ===========
        var agg = {};
        allByTime.forEach(function (t) {
            var date = tickToDateStr(t.time);
            var key = date + '|' + t.dir + '|' + t.resourceType;
            if (!agg[key]) {
                agg[key] = {
                    date: date, direction: t.dir, resource: t.resourceType,
                    amount: 0, totalCredits: 0, count: 0,
                    emaPrice: null
                };
            }
            var r = agg[key];
            r.amount += t.amount;
            r.totalCredits += t.price * t.amount;
            r.count += 1;
            if (r.emaPrice === null) {
                r.emaPrice = t.price;
            } else {
                r.emaPrice = alpha * t.price + (1 - alpha) * r.emaPrice;
            }
        });

        var rows = Object.values(agg);
        rows.sort(function (a, b) {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.direction !== b.direction) return a.direction === 'BUY' ? -1 : 1;
            return a.resource.localeCompare(b.resource);
        });

        var headers = ['Date', 'Dir', 'Resource', 'Trades', 'Amount', 'Avg Price', 'EMA Price', 'Total Credits'];
        var data = rows.map(function (r) {
            var avgP = r.amount > 0 ? (r.totalCredits / r.amount).toFixed(3) : '0';
            var emaP = r.emaPrice === null ? '0' : r.emaPrice.toFixed(3);
            var total = r.totalCredits.toFixed(2);
            return [r.date, r.direction, r.resource, String(r.count), String(r.amount), avgP, emaP, total];
        });

        console.log('\n=== Market History by Date (' + all.length + ' transactions, EMA alpha=' + alpha.toFixed(2) + ') ===\n');
        var tbl = printTable(headers, data, [0, 1, 2]);
        var prevDate = '';
        data.forEach(function (d) {
            if (d[0] !== prevDate && prevDate !== '') {
                console.log(tbl.sep);
            }
            prevDate = d[0];
            console.log('| ' + d.map(function (v, i) {
                return i <= 2 ? pad(v, tbl.widths[i]) : rpad(v, tbl.widths[i]);
            }).join(' | ') + ' |');
        });
        console.log(tbl.sep);

        // Daily totals
        var dailyTotals = {};
        rows.forEach(function (r) {
            if (!dailyTotals[r.date]) dailyTotals[r.date] = { bought: 0, sold: 0 };
            if (r.direction === 'BUY') dailyTotals[r.date].bought += r.totalCredits;
            else dailyTotals[r.date].sold += r.totalCredits;
        });

        console.log('\n--- Daily Totals ---');
        var grandBought = 0, grandSold = 0;
        Object.keys(dailyTotals).sort().forEach(function (date) {
            var d = dailyTotals[date];
            grandBought += d.bought;
            grandSold += d.sold;
            console.log(date + '  spent: ' + d.bought.toFixed(2).padStart(10) +
                '  earned: ' + d.sold.toFixed(2).padStart(10) +
                '  net: ' + (d.sold - d.bought).toFixed(2).padStart(10));
        });
        console.log('TOTAL     spent: ' + grandBought.toFixed(2).padStart(10) +
            '  earned: ' + grandSold.toFixed(2).padStart(10) +
            '  net: ' + (grandSold - grandBought).toFixed(2).padStart(10));

    } else {
        // =========== SUMMARY BY RESOURCE (default) ===========
        var agg = {};
        allByTime.forEach(function (t) {
            var key = t.dir + '|' + t.resourceType;
            if (!agg[key]) {
                agg[key] = {
                    direction: t.dir, resource: t.resourceType,
                    amount: 0, totalCredits: 0, count: 0,
                    minTick: t.time, maxTick: t.time,
                    emaPrice: null
                };
            }
            var r = agg[key];
            r.amount += t.amount;
            r.totalCredits += t.price * t.amount;
            r.count += 1;
            r.minTick = Math.min(r.minTick, t.time);
            r.maxTick = Math.max(r.maxTick, t.time);
            if (r.emaPrice === null) {
                r.emaPrice = t.price;
            } else {
                r.emaPrice = alpha * t.price + (1 - alpha) * r.emaPrice;
            }
        });

        var rows = Object.values(agg);
        rows.sort(function (a, b) {
            if (a.direction !== b.direction) return a.direction === 'BUY' ? -1 : 1;
            return a.resource.localeCompare(b.resource);
        });

        var now = Game.time;
        var headers = ['Dir', 'Resource', 'Trades', 'Amount', 'Avg Price', 'EMA Price', 'Total Credits', 'Span'];
        var data = rows.map(function (r) {
            var avgP = r.amount > 0 ? (r.totalCredits / r.amount).toFixed(3) : '0';
            var emaP = r.emaPrice === null ? '0' : r.emaPrice.toFixed(3);
            var total = r.totalCredits.toFixed(2);
            var span = tickToDateStr(r.minTick) + ' — ' + tickToDateStr(r.maxTick);
            return [r.direction, r.resource, String(r.count), String(r.amount), avgP, emaP, total, span];
        });

        console.log('\n=== Market Transaction History (' + all.length + ' transactions, EMA alpha=' + alpha.toFixed(2) + ') ===\n');
        var tbl = printTable(headers, data, [0, 1]);

        data.forEach(function (d) {
            console.log('| ' + d.map(function (v, i) {
                return i <= 1 ? pad(v, tbl.widths[i]) : rpad(v, tbl.widths[i]);
            }).join(' | ') + ' |');
        });
        console.log(tbl.sep);

        // Summary totals
        var totalBought = 0, totalSold = 0;
        rows.forEach(function (r) {
            if (r.direction === 'BUY') totalBought += r.totalCredits;
            else totalSold += r.totalCredits;
        });

        console.log('\nTotal spent (buys):   ' + totalBought.toFixed(2) + ' credits');
        console.log('Total earned (sells): ' + totalSold.toFixed(2) + ' credits');
        console.log('Net:                  ' + (totalSold - totalBought).toFixed(2) + ' credits');
    }

    return "Analyzed " + all.length + " transactions spanning " +
        tickToDateStr(minTick) + " to " + tickToDateStr(maxTick) + "." +
        " (archive: " + archived.length + " entries)";
};

// --- Check market history archive status ---
// Usage: marketHistoryStatus()
global.marketHistoryStatus = function () {
    if (!Memory.marketHistory || !Memory.marketHistory.txns) {
        return "No market history archived yet. Archive runs every 50 ticks automatically.";
    }
    var hist = Memory.marketHistory;
    var count = hist.txns.length;
    var oldestTick = count > 0 ? hist.txns[count - 1].t : 0;
    var newestTick = count > 0 ? hist.txns[0].t : 0;
    var buys = 0, sells = 0;
    for (var i = 0; i < count; i++) {
        if (hist.txns[i].d === 'B') buys++; else sells++;
    }
    var TICK_MS = 4200;
    var ageHours = count > 0 ? ((Game.time - oldestTick) * TICK_MS / 3600000).toFixed(1) : '0';
    return "Market history: " + count + " entries (" + buys + " buys, " + sells + " sells), " +
        "spanning ~" + ageHours + " hours. Last archived tick: " + hist.lastTick +
        ". Memory size: ~" + (JSON.stringify(hist.txns).length / 1024).toFixed(1) + " KB.";
};

// --- Clear market history archive ---
// Usage: clearMarketHistory()
global.clearMarketHistory = function () {
    var count = Memory.marketHistory ? (Memory.marketHistory.txns || []).length : 0;
    Memory.marketHistory = { lastTick: 0, txns: [] };
    return "Cleared " + count + " archived market transactions.";
};

// --- Print creep destruction events from room memory ---
// Usage: listCreepDestroyedEvents()
// Usage: listCreepDestroyedEvents("E51S23")
// Usage: listCreepDestroyedEvents(null, 100)

global.listCreepDestroyedEvents = function (roomName, limit) {
    var roomsMemory = Memory.rooms || {};
    var targetRooms = [];
    var maxRows = parseInt(limit, 10);

    if (!maxRows || maxRows < 1) {
        maxRows = 50;
    }

    if (roomName) {
        targetRooms.push(roomName);
    } else {
        targetRooms = Object.keys(roomsMemory);
    }

    if (targetRooms.length === 0) {
        return "No rooms in Memory.rooms.";
    }

    var rows = [];

    for (var i = 0; i < targetRooms.length; i++) {
        var currentRoomName = targetRooms[i];
        var roomMem = roomsMemory[currentRoomName];
        if (!roomMem || !roomMem.events) {
            continue;
        }

        var roomEvents = roomMem.events;
        var destroyedEvents = roomEvents[EVENT_OBJECT_DESTROYED] || roomEvents[String(EVENT_OBJECT_DESTROYED)] || [];

        for (var j = 0; j < destroyedEvents.length; j++) {
            var wrapped = destroyedEvents[j] || {};
            var ev = wrapped.event || wrapped;
            var eventData = ev.data || {};

            if (eventData.type !== "creep") {
                continue;
            }

            var x = null;
            var y = null;

            if (eventData.x !== undefined && eventData.y !== undefined) {
                x = eventData.x;
                y = eventData.y;
            } else if (ev.x !== undefined && ev.y !== undefined) {
                x = ev.x;
                y = ev.y;
            } else if (ev.pos && ev.pos.x !== undefined && ev.pos.y !== undefined) {
                x = ev.pos.x;
                y = ev.pos.y;
            }

            rows.push({
                time: wrapped.time || ev.time || 0,
                room: currentRoomName,
                pos: x === null ? "?" : (x + "," + y),
                objectId: ev.objectId || eventData.objectId || "-"
            });
        }
    }

    if (rows.length === 0) {
        return "No creep destruction events found in room memory.";
    }

    rows = _.sortBy(rows, function (entry) {
        return -entry.time;
    });

    rows = rows.slice(0, maxRows);

    var headers = ["Tick", "Room", "Pos", "ObjectId"];
    var tableRows = _.map(rows, function (entry) {
        var tickAgo = entry.time > 0 ? (Game.time - entry.time) : null;
        return [
            tickAgo === null ? "?" : (String(tickAgo) + " ago"),
            entry.room,
            entry.pos,
            entry.objectId
        ];
    });

    var table = printTable(headers, tableRows, [1, 2, 3]);
    function pad(value, width) { return String(value).padEnd(width); }
    function rpad(value, width) { return String(value).padStart(width); }

    for (var k = 0; k < tableRows.length; k++) {
        console.log("| " + tableRows[k].map(function (value, index) {
            if (index === 0)
                return rpad(value, table.widths[index]);
            return pad(value, table.widths[index]);
        }).join(" | ") + " |");
    }
    console.log(table.sep);

    return "Printed " + tableRows.length + " creep destruction events" + (roomName ? " for " + roomName : "") + ".";
};


