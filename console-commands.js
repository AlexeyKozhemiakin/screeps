// --- Enable boosting in a specific room ---
// Usage: enableBoosting("E51S23")
global.enableBoosting = function (roomName) {
    if (!Memory.rooms) {
        Memory.rooms = {};
    }
    if (!Memory.rooms[roomName]) {
        Memory.rooms[roomName] = {};
    }
    Memory.rooms[roomName].enableBoosting = true;
    delete Memory.rooms[roomName].boostingEnabled;
    return "Boosting enabled in room " + roomName;
};

// --- Disable boosting in a specific room ---
// Usage: disableBoosting("E51S23")
global.disableBoosting = function (roomName) {
    if (!Memory.rooms || !Memory.rooms[roomName]) {
        return "No Memory.rooms entry for " + roomName;
    }
    Memory.rooms[roomName].enableBoosting = false;
    delete Memory.rooms[roomName].boostingEnabled;
    return "Boosting disabled in room " + roomName;
};

// --- Check boosting status for a specific room ---
// Usage: checkBoosting("E51S23")
global.checkBoosting = function (roomName) {
    if (!Memory.rooms || !Memory.rooms[roomName]) {
        return "No Memory.rooms entry for " + roomName;
    }
    var roomMemory = Memory.rooms[roomName];
    if (roomMemory.enableBoosting === undefined && roomMemory.boostingEnabled !== undefined) {
        roomMemory.enableBoosting = roomMemory.boostingEnabled;
    }
    if (roomMemory.enableBoosting === undefined) {
        roomMemory.enableBoosting = true;
    }
    var status = roomMemory.enableBoosting ? "enabled" : "disabled";
    return "Boosting is " + status + " in room " + roomName;
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
        RESOURCE_GHODIUM,   // 'G'
        RESOURCE_OPS,       // 'ops'
        RESOURCE_SILICON,   // 'silicon'
        RESOURCE_METAL,     // 'metal'
        RESOURCE_BIOMASS,   // 'biomass'
        RESOURCE_MIST,      // 'mist'
    ].forEach(function(r) { PRIMITIVE_SET[r] = true; });

    // Recursively compute the production cost of a resource using only
    // primitive market prices at the leaves.
    var deepCache = {};
    function getDeepCost(resource) {
        if (deepCache[resource] !== undefined) return deepCache[resource];
        if (PRIMITIVE_SET[resource]) {
            deepCache[resource] = raw_prices[resource] || 0;
            return deepCache[resource];
        }
        var commodity = COMMODITIES[resource];
        if (!commodity || !commodity.components) {
            deepCache[resource] = raw_prices[resource] || 0;
            return deepCache[resource];
        }
        var componentCost = 0;
        for (var comp in commodity.components) {
            componentCost += getDeepCost(comp) * commodity.components[comp];
        }
        var result = componentCost / commodity.amount;
        deepCache[resource] = result;
        return result;
    }

    console.log("resource          |  market $ | shallow $ |   deep $  | shallowMargin | deepMargin | level | reagents");

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
        var deepMarginStr = deepCost > 0 ? ((marketPrice - deepCost) / deepCost * 100).toFixed(1) : "-";
        var deepCostStr   = deepCost > 0 ? deepCost.toFixed(2).padStart(10) : "         -";

        var padResource    = resource.padEnd(17);
        var padMarket      = marketPrice.toFixed(1).padStart(10);
        var padShallow     = shallowCost.toFixed(1).padStart(10);
        var padShallowM    = shallowMargin.padStart(14);
        var padDeepM       = deepMarginStr.padStart(11);
        var reagents       = Object.keys(commodity.components).join(", ");

        console.log(padResource + " | " + padMarket + " | " + padShallow + " | " + deepCostStr + " | " + padShallowM + "% | " + padDeepM + "% | " + level + " | " + reagents);
    });

    //Memory.prices = undefined;
    return "Done.";
} 

// Analyze market history from archived Memory + live transactions
// Usage: analyzeMarketHistory()                    — all resources, summary
// Usage: analyzeMarketHistory("energy")            — filter by resource
// Usage: analyzeMarketHistory(null, true)           — group by date
// Usage: analyzeMarketHistory("energy", true)       — filter + group by date
global.analyzeMarketHistory = function (filterResource, groupByDate) {
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
        all = all.filter(function(t) { return t.resourceType === filterResource; });
    }

    if (all.length === 0) {
        return "No market transactions found." + (filterResource ? " (filter: " + filterResource + ")" : "") +
               " Archive has " + archived.length + " entries total.";
    }

    // ---- Helpers ----
    var TICK_MS = 4200; // ~4.2s per tick average
    var nowMs = Date.now();
    function tickToDateStr(tick) {
        var ms = nowMs - (Game.time - tick) * TICK_MS;
        var d = new Date(ms);
        var yyyy = d.getFullYear();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return yyyy + '-' + mm + '-' + dd;
    }
    function pad(s, w)  { return String(s).padEnd(w); }
    function rpad(s, w) { return String(s).padStart(w); }
    function printTable(headers, data, textCols) {
        var widths = headers.map(function(h) { return h.length; });
        data.forEach(function(d) {
            for (var i = 0; i < d.length; i++) {
                widths[i] = Math.max(widths[i], d[i].length);
            }
        });
        var sep = '+' + widths.map(function(w) { return '-'.repeat(w + 2); }).join('+') + '+';
        console.log(sep);
        console.log('| ' + headers.map(function(h, i) { return pad(h, widths[i]); }).join(' | ') + ' |');
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
        all.forEach(function(t) {
            var date = tickToDateStr(t.time);
            var key = date + '|' + t.dir + '|' + t.resourceType;
            if (!agg[key]) {
                agg[key] = {
                    date: date, direction: t.dir, resource: t.resourceType,
                    amount: 0, totalCredits: 0, count: 0
                };
            }
            var r = agg[key];
            r.amount += t.amount;
            r.totalCredits += t.price * t.amount;
            r.count += 1;
        });

        var rows = Object.values(agg);
        rows.sort(function(a, b) {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.direction !== b.direction) return a.direction === 'BUY' ? -1 : 1;
            return a.resource.localeCompare(b.resource);
        });

        var headers = ['Date', 'Dir', 'Resource', 'Trades', 'Amount', 'Avg Price', 'Total Credits'];
        var data = rows.map(function(r) {
            var avgP = r.amount > 0 ? (r.totalCredits / r.amount).toFixed(3) : '0';
            var total = r.totalCredits.toFixed(2);
            return [r.date, r.direction, r.resource, String(r.count), String(r.amount), avgP, total];
        });

        console.log('\n=== Market History by Date (' + all.length + ' transactions) ===\n');
        var tbl = printTable(headers, data, [0, 1, 2]);
        var prevDate = '';
        data.forEach(function(d) {
            if (d[0] !== prevDate && prevDate !== '') {
                console.log(tbl.sep);
            }
            prevDate = d[0];
            console.log('| ' + d.map(function(v, i) {
                return i <= 2 ? pad(v, tbl.widths[i]) : rpad(v, tbl.widths[i]);
            }).join(' | ') + ' |');
        });
        console.log(tbl.sep);

        // Daily totals
        var dailyTotals = {};
        rows.forEach(function(r) {
            if (!dailyTotals[r.date]) dailyTotals[r.date] = { bought: 0, sold: 0 };
            if (r.direction === 'BUY') dailyTotals[r.date].bought += r.totalCredits;
            else dailyTotals[r.date].sold += r.totalCredits;
        });

        console.log('\n--- Daily Totals ---');
        var grandBought = 0, grandSold = 0;
        Object.keys(dailyTotals).sort().forEach(function(date) {
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
        all.forEach(function(t) {
            var key = t.dir + '|' + t.resourceType;
            if (!agg[key]) {
                agg[key] = {
                    direction: t.dir, resource: t.resourceType,
                    amount: 0, totalCredits: 0, count: 0,
                    minTick: t.time, maxTick: t.time
                };
            }
            var r = agg[key];
            r.amount += t.amount;
            r.totalCredits += t.price * t.amount;
            r.count += 1;
            r.minTick = Math.min(r.minTick, t.time);
            r.maxTick = Math.max(r.maxTick, t.time);
        });

        var rows = Object.values(agg);
        rows.sort(function(a, b) {
            if (a.direction !== b.direction) return a.direction === 'BUY' ? -1 : 1;
            return a.resource.localeCompare(b.resource);
        });

        var now = Game.time;
        var headers = ['Dir', 'Resource', 'Trades', 'Amount', 'Avg Price', 'Total Credits', 'Span'];
        var data = rows.map(function(r) {
            var avgP = r.amount > 0 ? (r.totalCredits / r.amount).toFixed(3) : '0';
            var total = r.totalCredits.toFixed(2);
            var span = tickToDateStr(r.minTick) + ' — ' + tickToDateStr(r.maxTick);
            return [r.direction, r.resource, String(r.count), String(r.amount), avgP, total, span];
        });

        console.log('\n=== Market Transaction History (' + all.length + ' transactions) ===\n');
        var tbl = printTable(headers, data, [0, 1]);

        data.forEach(function(d) {
            console.log('| ' + d.map(function(v, i) {
                return i <= 1 ? pad(v, tbl.widths[i]) : rpad(v, tbl.widths[i]);
            }).join(' | ') + ' |');
        });
        console.log(tbl.sep);

        // Summary totals
        var totalBought = 0, totalSold = 0;
        rows.forEach(function(r) {
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


