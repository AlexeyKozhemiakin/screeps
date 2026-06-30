module.exports = {

    // Archive market transactions to Memory for long-term analysis
    MARKET_HISTORY_MAX_ENTRIES: 2000,   // keep at most this many archived transactions
    MARKET_HISTORY_INTERVAL: 1000,     // archive every N ticks

    archiveMarketTransactions: function () {
        if (!Memory.marketHistory) {
            Memory.marketHistory = { lastTick: 0, txns: [] };
        }
        var hist = Memory.marketHistory;
        var lastTick = hist.lastTick || 0;
        var incoming = Game.market.incomingTransactions || [];
        var outgoing = Game.market.outgoingTransactions || [];
        var maxTick = lastTick;
        var newEntries = [];

        for (var i = 0; i < incoming.length; i++) {
            var ti = incoming[i];
            if (ti.order && ti.time > lastTick) {
                newEntries.push({ t: ti.time, r: ti.resourceType, a: ti.amount, p: ti.order.price, d: 'B' });
                if (ti.time > maxTick) maxTick = ti.time;
            }
        }
        for (var j = 0; j < outgoing.length; j++) {
            var to = outgoing[j];
            if (to.order && to.time > lastTick) {
                newEntries.push({ t: to.time, r: to.resourceType, a: to.amount, p: to.order.price, d: 'S' });
                if (to.time > maxTick) maxTick = to.time;
            }
        }

        if (newEntries.length > 0) {
            hist.txns = newEntries.concat(hist.txns);
            if (hist.txns.length > this.MARKET_HISTORY_MAX_ENTRIES) {
                hist.txns = hist.txns.slice(0, this.MARKET_HISTORY_MAX_ENTRIES);
            }
            hist.lastTick = maxTick;
        }
    },

    shareEnergyInternal: function () {

        // uptake for smaller
         for (var powerCreepName in Game.powerCreeps) {
            var pc = Game.powerCreeps[powerCreepName];
            //console.log("Checking power creep ", pc.room, " for energy sharing...");
            if (pc.room && pc.room.terminal.store[RESOURCE_OPS] < 1000)
                this.shareResourceFromOtherRooms(pc.room, RESOURCE_OPS, 1000, 1000);
            //else
            //    console.log("Power creep ", pc.name, " has sufficient OPS in terminal, skipping energy share");
        }
        
         // uptake for smaller
         for (var roomName in Game.rooms) {
            var room = Game.rooms[roomName];
            if(!room || !room.terminal || !room.factory || room.factory.level)
                continue;
                
            //console.log("Checking power creep ", pc.room, " for energy sharing...");
            if (room.terminal.store[RESOURCE_SILICON] < 1000)
                this.shareResourceFromOtherRooms(room, RESOURCE_SILICON, 1000, 1000);
            //else
            //    console.log("Power creep ", pc.name, " has sufficient OPS in terminal, skipping energy share");
        }
        
        // uptake for smaller
         for (var roomName in Game.rooms) {
            var room = Game.rooms[roomName];
            if(!room || !room.terminal || !room.factory || room.factory.level)
                continue;
                
            //console.log("Checking power creep ", pc.room, " for energy sharing...");
            if (room.terminal.store[RESOURCE_BIOMASS] < 100)
                this.shareResourceFromOtherRooms(room, RESOURCE_BIOMASS, 100, 100);
            //else
            //    console.log("Power creep ", pc.name, " has sufficient OPS in terminal, skipping energy share");
        }

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.terminal || !room.storage)
                continue;

            if (room.storage.store[RESOURCE_ENERGY] < 150000)
                continue;

            if (room.terminal.store[RESOURCE_ENERGY] < 5000)
                continue;

            //console.log("Room ", roomName, " has excess energy ", room.terminal.store[RESOURCE_ENERGY]);
            var targets = {};
            for (const targetRoomName in Game.rooms) {
                const targetRoom = Game.rooms[targetRoomName];
                if (!targetRoom || !targetRoom.controller || !targetRoom.controller.my || !targetRoom.terminal || !targetRoom.storage || targetRoomName == roomName)
                    continue;

                var totalInTarget = targetRoom.terminal.store[RESOURCE_ENERGY] + targetRoom.storage.store[RESOURCE_ENERGY];
                if (totalInTarget < 50000) {
                    targets[targetRoomName] = totalInTarget;
                }
            }

            var min = _.min(_.values(targets));
            var targetRoomName = _.findKey(targets, v => v == min);
            if (targetRoomName) {
                //console.log("Sharing energy from ", roomName, " to ", targetRoomName);
                var res = this.shareResource(roomName, targetRoomName, RESOURCE_ENERGY, 10000);
                if (res)
                    return;// make it slower
            }
        }

        const res_type = RESOURCE_POWER;
        var threshold = 1000;
        var delta = 500;

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.terminal || !room.storage)
                continue;

            if (!room.powerSpawn)
                continue;

            if (room.terminal.store[res_type] < threshold + delta)
                continue;

            //console.log("Room ", roomName, " has excess ", res_type, " ", room.terminal.store[res_type]);
            for (const targetRoomName in Game.rooms) {
                const targetRoom = Game.rooms[targetRoomName];
                if (!targetRoom || !targetRoom.controller || !targetRoom.controller.my || !targetRoom.terminal || !targetRoom.storage || targetRoomName == roomName)
                    continue;

                var totalInTarget = targetRoom.terminal.store[res_type] + targetRoom.storage.store[res_type];

                if (totalInTarget < threshold) {
                    var res = this.shareResource(roomName, targetRoomName, res_type, delta);
                    if (res)
                        return;// make it slower
                }
            }
        }
    },



    shareResource(idFrom, idTo, res, amount) {
        var room = Game.rooms[idFrom];

        if (idTo == idFrom) {
            console.log("Trying to share resource ", res, " within the same room ", idFrom);
            return false;
        }

        if (!room)
            return false;

        if (!room.terminal)
            return false;

        if (room.terminal.cooldown > 0)
            return false;

        var cost = Game.market.calcTransactionCost(amount, idFrom, idTo);
        // console.log("cost to send", amount, res, "from", idFrom, "to", idTo, "is", cost);

        if (room.terminal.store[RESOURCE_ENERGY] < cost)
            return false;

        if (room.terminal.store[res] < amount)
            return false;

        var log = true;
        if (log)
            console.log("Sharing ", amount, res, " from ", idFrom, " to ", idTo);

        var code = room.terminal.send(res, amount, idTo, "bro help");
        //console.log("CODE ", code);
        if (OK != code) {
            console.log('failed to help', res, " ", idFrom, "->", idTo, "with", amount, "error", code);
            return false
        }

        return true;
    },

    // Staged approach helper: attempt to share a resource from other rooms
    // to reduce external demand before production starts.
    // Returns true if sharing succeeded, false otherwise.
    shareResourceFromOtherRooms: function (room, targetRes, resTarget, gapAmount) {
        // 1. Turn Game.rooms into an array and filter out rooms without terminals
    var sortedRooms = Object.values(Game.rooms).filter(r => r.terminal);

    // 2. Sort the rooms by the amount of targetRes in their terminal (highest first)
    sortedRooms.sort((a, b) => {
        var amountA = a.terminal.store[targetRes] || 0;
        var amountB = b.terminal.store[targetRes] || 0;
        return amountB - amountA; // Descending order
    });

    // 3. Loop through your newly sorted rooms array
    for (var i = 0; i < sortedRooms.length; i++) {
        var sourceRoom = sortedRooms[i];
        
            if (sourceRoom.terminal.cooldown > 0 || sourceRoom.name === room.name)
                continue;

            var sourceAmount = sourceRoom.terminal.store[targetRes];
            
            

            if (sourceAmount && sourceAmount > resTarget ) {
                //console.log('Sharing ' + gapAmount + ' of ' + targetRes + ' from ' + sourceRoom.name + ' to ' + room.name);
                var excess = sourceAmount - resTarget;
                return this.shareResource(sourceRoom.name, room.name, targetRes, Math.min(excess, gapAmount));
            }
        }

        return false;
    },

    runManualOrder() {


    },

    shareResourcesInternal: function () {
        return;

        //console.log("Sharing resources between rooms...");
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.terminal)
                continue;

            const silicone = room.terminal.store[RESOURCE_SILICON] || 0;
            //console.log("Room ", roomName, " has ", silicone, " silicon in terminal");
            if (silicone > 100 && roomName != 'E51S24') {
                this.shareResource(roomName, 'E51S24', RESOURCE_SILICON,
                    Math.min(1000, silicone));
            }
        }
    },

    sellExcess: function () {
        const threshold = 120000;
        const batteryThresholdToSellEnergy = 40000;
        const totalEnergyThresholdToSellRawEnergy = 900000;
        const energyThresholdWhenBatteriesAreHigh = 50000;

        // Lower threshold for factory outputs - sell once a modest stockpile builds up
        const SELL_INTERIM = 130;
        const commodityThresholds = {
            'utrium_bar': 10000,
            'lemergium_bar': 10000,
            'keanium_bar': 10000,
            'zynthium_bar': 10000,
            'oxidant': 10000,
            'reductant': 10000,
            'purifier': 10000,
            'ghodium_melt': 10000,
            'ops': 30000,
            'wire': 50000,
            'battery': 20000,
            
            'composite': 1000,
            'device':0,

            RESOURCE_CELL: SELL_INTERIM,
            RESOURCE_MICROCHIP: SELL_INTERIM
        };

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.terminal)
                continue;

            var totalBatteries = room.terminal.store[RESOURCE_BATTERY] || 0;
            if (room.storage)
                totalBatteries += room.storage.store[RESOURCE_BATTERY] || 0;

            var totalEnergy = room.terminal.store[RESOURCE_ENERGY] || 0;
            if (room.storage)
                totalEnergy += room.storage.store[RESOURCE_ENERGY] || 0;

            // totalBatteries > batteryThresholdToSellEnergy && 
            if (totalEnergy > totalEnergyThresholdToSellRawEnergy) {

                var excessRawEnergy = Math.min(
                    room.terminal.store[RESOURCE_ENERGY] || 0,
                    totalEnergy - energyThresholdWhenBatteriesAreHigh
                );

                if (excessRawEnergy > 10000) {
                    console.log("Room ", roomName, " has excess raw energy because batteries are high, amount ", excessRawEnergy);
                    this.matchOrderInternal(roomName, RESOURCE_ENERGY, Math.min(2000, excessRawEnergy), ORDER_BUY);
                }
            }

            var resources = _.keys(room.terminal.store).filter(r => room.terminal.store[r] > 0);

            for (const resource of resources) {
                var limit = commodityThresholds[resource] !== undefined ? commodityThresholds[resource] : threshold;

                const excessAmount = room.terminal.store[resource] - limit;
                var gap = 100;
                
                if(limit < 150)
                    gap = 1;
                    
                if (excessAmount >= gap) {
                     console.log("Room ", roomName, " has excess of ", resource, " amount ", excessAmount);
                    this.matchOrderInternal(roomName, resource, Math.min(excessAmount, 3000), ORDER_BUY);
                }
            }
        }

        //if (Game.resources[PIXEL] > 10)
        //    this.matchOrderInternal(undefined, PIXEL, 10, ORDER_BUY);
    },

    crazySales: function (resType, roomName) {
        // checks if there is not market supply, create crazy order to buy, works very good with energy, i'm gettings sales like x10 price


        var sellOrders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: resType }) || [];

        var othersOrders = _.filter(sellOrders, o => !o.my);

        //console.log("There are ", othersOrders.length, " sell orders for ", resType, " in the market");
        if (othersOrders.length == 0) {
            for (var i = 0; i < 10; i++) {
                this.tryCreateOrder(resType, 1000 * i, 1000 + i, roomName, ORDER_SELL);
            }
        }
    },

    adjustOrders: function () {



        var ADJUST_INTERVAL = 200; // ticks between price adjustments
        var PRICE_BUMP = 0.05;     // 5% increase per adjustment
        var MARKET_REPRICE_INTERVAL = 1;

        if (!Memory.orderAdjustments) Memory.orderAdjustments = {};

        for (const order of Object.values(Game.market.orders)) {
            // Cancel fulfilled orders
            if (order.remainingAmount == 0) {
                console.log('Removing fulfilled order ', order.id, " type ", order.type, " resource ", order.resourceType);
                Game.market.cancelOrder(order.id);
                delete Memory.orderAdjustments[order.id];
                continue;
            }

            // Cancel very old orders (5 days)
            var ticksInDay = 24 * 60 * 10;
            var delay = Game.time - order.created;
            if (delay > 5 * ticksInDay) {
                console.log('Removing expired order ', order.id, " type ", order.type, " resource ", order.resourceType);
                Game.market.cancelOrder(order.id);
                delete Memory.orderAdjustments[order.id];
                continue;
            }

            /*
            // Bump price on unfulfilled buy orders that have been sitting for > ADJUST_INTERVAL ticks
            if (order.type === ORDER_BUY && order.remainingAmount > 0 && order.remainingAmount === order.totalAmount) {
                var lastAdjust = Memory.orderAdjustments[order.id] || order.created;
                if (Game.time - lastAdjust >= ADJUST_INTERVAL) {
                    var newPrice = +(order.price * (1 + PRICE_BUMP)).toFixed(3);
                    var code = Game.market.changeOrderPrice(order.id, newPrice);
                    if (code === OK) {
                        console.log('Bumped ' + order.type + ' order ' + order.id + ' (' + order.resourceType + ') price ' + order.price + ' -> ' + newPrice);
                        Memory.orderAdjustments[order.id] = Game.time;
                    } else {
                        console.log('Failed to bump order ' + order.id + ' price, code ' + code);
                    }
                }
            }*/
        }

        // Clean up memory for orders that no longer exist
        for (var id in Memory.orderAdjustments) {
            if (!Game.market.orders[id]) {
                delete Memory.orderAdjustments[id];
            }
        }


        this.repriceOutdatedOrdersToMarket();

    },

    repriceOutdatedOrdersToMarket: function () {

        return;

        var TICKS_PER_DAY = Math.floor(24 * 60 * 60 / 2.5);
        var STALE_AGE_TICKS = 10000;// 3 * TICKS_PER_DAY;
        var MIN_MARKET_VOLUME = 10000;
        var SUBSTANTIAL_MARGIN = 0.20;
        var PRICE_IMPROVEMENT = 0.001;
        var MAX_PRICE_CHANGES_PER_PASS = 2;
        var DRY_RUN = false;
        var changed = 0;

        var myOrders = Object.values(Game.market.orders);
        var marketByResource = {};

        for (var i = 0; i < myOrders.length; i++) {
            var order = myOrders[i];

            if (!order || order.remainingAmount <= 0)
                continue;

            //console.log("Stale ticks ", STALE_AGE_TICKS);

            var orderAge = Game.time - order.created;
            if (orderAge < STALE_AGE_TICKS)
                continue;

            //console.log('Evaluating stale order ' + order.id + ' (' + order.resourceType + ') age ' + orderAge + ' ticks');


            if (!marketByResource[order.resourceType]) {
                marketByResource[order.resourceType] = Game.market.getAllOrders({ resourceType: order.resourceType });
            }

            var marketOrders = marketByResource[order.resourceType] || [];
            var buyVolume = 0;
            var sellVolume = 0;
            var bestBuy = undefined;
            var bestSell = undefined;

            for (var j = 0; j < marketOrders.length; j++) {
                var marketOrder = marketOrders[j];

                if (!marketOrder || marketOrder.my || marketOrder.remainingAmount <= 0)
                    continue;

                if (marketOrder.type == ORDER_BUY) {
                    buyVolume += marketOrder.remainingAmount;
                    if (bestBuy === undefined || marketOrder.price > bestBuy)
                        bestBuy = marketOrder.price;
                } else if (marketOrder.type == ORDER_SELL) {
                    sellVolume += marketOrder.remainingAmount;
                    if (bestSell === undefined || marketOrder.price < bestSell)
                        bestSell = marketOrder.price;
                }
            }

            if (Math.max(buyVolume, sellVolume) < MIN_MARKET_VOLUME)
                continue;

            var referencePrice = order.type == ORDER_BUY ? bestBuy : bestSell;
            if (referencePrice === undefined || referencePrice <= 0)
                continue;

            var lowerBound = referencePrice * (1 - SUBSTANTIAL_MARGIN);
            var upperBound = referencePrice * (1 + SUBSTANTIAL_MARGIN);
            var targetPrice = order.price;

            if (order.price < lowerBound || order.price > upperBound) {
                if (order.type == ORDER_BUY)
                    targetPrice = referencePrice + PRICE_IMPROVEMENT;
                else
                    targetPrice = Math.max(PRICE_IMPROVEMENT, referencePrice - PRICE_IMPROVEMENT);
            } else {
                continue;
            }

            if (targetPrice <= 0)
                continue;

            targetPrice = +targetPrice.toFixed(3);

            if (DRY_RUN) {
                console.log('DRY RUN: would reprice stale ' + order.type + ' order ' + order.id + ' (' + order.resourceType + ') from ' + order.price + ' to ' + targetPrice + ' (age ' + orderAge + ' ticks, buyVol ' + buyVolume + ', sellVol ' + sellVolume + ')');
                changed++;
                if (changed >= MAX_PRICE_CHANGES_PER_PASS)
                    return;
            } else {
                var code = Game.market.changeOrderPrice(order.id, targetPrice);
                if (code == OK) {
                    console.log('Repriced stale ' + order.type + ' order ' + order.id + ' (' + order.resourceType + ') from ' + order.price + ' to ' + targetPrice + ' (age ' + orderAge + ' ticks, buyVol ' + buyVolume + ', sellVol ' + sellVolume + ')');
                    changed++;
                    if (changed >= MAX_PRICE_CHANGES_PER_PASS)
                        return;
                } else {
                    console.log('Failed to reprice stale order ' + order.id + ', code ' + code);
                }
            }
        }
    },

    recentPrice: function (res) {

        if (!Memory.marketHistoryCache) Memory.marketHistoryCache = {};
        if (!Memory.marketHistoryCache[res]) Memory.marketHistoryCache[res] = {};
        const cache = Memory.marketHistoryCache[res];
        const now = Game.time;
        if (cache.time && (now - cache.time < 10) && cache.history) {
            var history = cache.history;
        } else {
            var history = Game.market.getHistory(res);
            cache.history = history;
            cache.time = now;
        }

        history = history.slice(7);

        var avgPrice = _.sum(history, o => o.avgPrice) / history.length;

        return avgPrice;
    },
    exploreArbitrage: function (room) {
        // Arbitrage strategy: buy low-priced resources and sell at markup, using only our own terminal in 'room'
        if (!room || !room.terminal) return;

        const arbitrageThreshold = 1.15; // 15% profit margin
        const minProfitCredits = 5000;
        const resources = [
            RESOURCE_UTRIUM,
            RESOURCE_ZYNTHIUM,
            RESOURCE_KEANIUM,
            RESOURCE_OXYGEN,
            RESOURCE_HYDROGEN,
            RESOURCE_ENERGY
        ];

        const energyPrice = 55;//this.recentPrice(RESOURCE_ENERGY) || 0.2;
        var list = Object.keys(RESOURCES_ALL).concat(RESOURCE_ENERGY);

        for (const res of list) {

            const orders = Game.market.getAllOrders({ resourceType: res });
            const sellOrders = _.filter(orders, o => o.type === ORDER_SELL);
            const buyOrders = _.filter(orders, o => o.type === ORDER_BUY);

            if (sellOrders.length === 0 || buyOrders.length === 0) continue;

            // Find the best sell order (lowest price, but also consider transfer cost to our room)
            const bestSell = _.min(sellOrders, o => o.price + (Game.market.calcTransactionCost(1, o.roomName, room.name) * energyPrice));
            // Find the best buy order (highest price, minus transfer cost from our room)
            const bestBuy = _.max(buyOrders, o => o.price - (Game.market.calcTransactionCost(1, room.name, o.roomName) * energyPrice));

            if (!bestSell || !bestBuy) continue;

            // Calculate profit per unit, including transfer costs
            const buyTransfer = Game.market.calcTransactionCost(10000, bestSell.roomName, room.name) / 10000 * energyPrice;
            const sellTransfer = Game.market.calcTransactionCost(10000, room.name, bestBuy.roomName) / 10000 * energyPrice;
            const profitPerUnit = bestBuy.price - bestSell.price - buyTransfer - sellTransfer;
            const maxAmount = Math.min(bestSell.remainingAmount, bestBuy.remainingAmount, room.terminal.store.getFreeCapacity(res), 1000);
            const netProfit = profitPerUnit * maxAmount;
            const priceRatio = bestBuy.price / bestSell.price;


            //console.log(`${res} Arbitrage: buyPrice=${bestSell.price}, sellPrice=${bestBuy.price}, profitPerUnit=${Math.floor(profitPerUnit)}, maxAmount=${maxAmount}, netProfit=${Math.floor(netProfit)}, energyprice=${energyPrice}, buyTransfer=${Math.floor(buyTransfer)}, sellTransfer=${Math.floor(sellTransfer)}`);

            if (priceRatio > arbitrageThreshold && netProfit > minProfitCredits) {
                console.log(`ARBITRAGE: ${res} - Buy at ${bestSell.price} from ${bestSell.roomName}, Sell at ${bestBuy.price} to ${bestBuy.roomName}, Profit: ${Math.floor(netProfit)} credits (room: ${room.name})`);

                if (false)
                    if (Game.market.credits > netProfit * 2 && maxAmount > 0) {
                        // Step 1: Buy from market to our terminal
                        const buyAmount = Math.min(100, bestSell.remainingAmount, room.terminal.store.getFreeCapacity(res));
                        const buyCode = Game.market.deal(bestSell.id, buyAmount, room.name);
                        if (buyCode === OK) {
                            console.log(`Bought ${buyAmount} ${res} to ${room.name} from ${bestSell.roomName}`);
                            // Step 2: Immediately try to sell to best buy order (if we have enough in terminal)
                            const canSell = room.terminal.store[res] >= buyAmount;
                            if (canSell) {
                                const sellAmount = Math.min(buyAmount, bestBuy.remainingAmount);
                                const sellCode = Game.market.deal(bestBuy.id, sellAmount, room.name);
                                if (sellCode === OK) {
                                    console.log(`Sold ${sellAmount} ${res} from ${room.name} to ${bestBuy.roomName}`);
                                } else {
                                    console.log(`Failed to sell ${sellAmount} ${res}:`, sellCode);
                                }
                            } else {
                                console.log(`Not enough ${res} in terminal to sell after buy, will try next tick.`);
                            }
                        } else {
                            console.log(`Failed to buy ${buyAmount} ${res}:`, buyCode);
                        }
                    }
            }
        }
    },

    tryCreateOrder: function (resType, price, amount, targetRoom, orderType) {
        if (!resType || !price || !amount)
            return;

        if (price <= 0 || amount <= 0)
            return;

        if (targetRoom && (!Game.rooms[targetRoom] || !Game.rooms[targetRoom].terminal))
            return;

        var existing = _.filter(Game.market.orders, function (o) {
            return o.type == orderType && o.resourceType == resType &&
                ((targetRoom && o.roomName == targetRoom) || (!targetRoom && !o.roomName)) &&
                o.remainingAmount > 0;
        });

        if (existing.length > 0)
            return;

        var fee = price * amount * 0.05;
        if (Game.market.credits < fee) {
            console.log("Not enough credits to create buy order for", resType, "fee", fee);
            return;
        }

        var orderParams = {
            type: orderType,
            resourceType: resType,
            price: price,
            totalAmount: amount
        };

        if (targetRoom)
            orderParams.roomName = targetRoom;

        var code = Game.market.createOrder(orderParams);
        if (code != OK)
            console.log("Failed to create " + orderType + " order", resType, "code", code, "room", targetRoom);

    },

    matchOrderInternal: function (targetRoom, resType, amount, orderType, acceptableMargin = 0.2) {
        if (targetRoom && Game.rooms[targetRoom].terminal && Game.rooms[targetRoom].terminal.cooldown > 0)
            return;

        // allow buying only raw materials for now, cause i want to control reactions myself and not rely on market for that, also cause i want to avoid situation when i buy expensive compound and then have no reagents for it
        if (orderType == ORDER_SELL &&
            resType != RESOURCE_UTRIUM &&
            resType != RESOURCE_LEMERGIUM && // too expensive
            resType != RESOURCE_ZYNTHIUM &&
            resType != RESOURCE_KEANIUM &&
            resType != RESOURCE_OXYGEN &&
            resType != RESOURCE_HYDROGEN
        ) {
            //console.log("Currently only selling raw materials is supported, skipping order for ", resType);
            return;
        }

        const orders = Game.market.getAllOrders({ type: orderType, resourceType: resType });

        // price per what? and what it influences
        var energyHistoricalPrice = this.recentPrice(RESOURCE_ENERGY);
        var resHistoricalPrice = this.recentPrice(resType);

        //console.log("avg energy price ", energyHistoricalPrice, "avg", resType, "price ", resHistoricalPrice);
        const energyPrice = energyHistoricalPrice;

        getTotalPrice = function (o) {
            const N = 10000;//to avoid rounding error
            const energyAmount = targetRoom ? Game.market.calcTransactionCost(N, o.roomName, targetRoom) / N : 0;
            const transferPrice = energyAmount * energyPrice;

            //console.log("it will cost Energy=", energyAmount, "equivalent to Cr=", transferPrice);

            // cause i will have to pay for transer
            if (orderType == ORDER_SELL)
                return o.price + transferPrice;
            else
                return o.price - transferPrice;
        }

        var sorted = _.sortBy(orders, getTotalPrice);

        if (orderType == ORDER_BUY)
            sorted = sorted.reverse();

        //console.log(targetRoom, resType, amount, orderType);
        // var acceptableMargin = 0.2;// i can pay X more than historical price to buy and want to sell for 20% less than historical price, cause market is very volatile and i want to be able to react to it, also cause if there is demand someone will fill my order and if there is no demand i dont want to buy at bad price and can wait for market to stabilize or fill my order at good price

        //if(acceptableMargin > 0.5)
        //    console.log("Acceptable margin is very high ", acceptableMargin, " for ", resType, " order type ", orderType);

        if (resType == RESOURCE_BATTERY) {
            const energyPriceFair = 31;

            var batteryPriceThreshold = 12 * energyPriceFair * (1 + acceptableMargin);

            // based on recent price and my strategy to sell energy when battery is high, so if energy is 50 or more then battery price can be 12 times higher than that, but if energy is very cheap then battery price can be much higher than that, so i want to allow more margin for batteries when energy is cheap
            //console.log("energy price ", energyPrice,
            //    "historical battery price ", resHistoricalPrice,
            //    "battery price threshold ", batteryPriceThreshold);

            if (resHistoricalPrice < batteryPriceThreshold) {
                resHistoricalPrice = batteryPriceThreshold;
            }
            //else
            //    acceptableMargin = 0.5;// batteries are very volatile and can be bought for very low price when there is excess and then sold for good price when there is demand, so i want to be more flexible with them
        }

        for (id in sorted) {

            var order = sorted[id];
            if (order.remainingAmount == 0)
                continue;

            var totalPrice = getTotalPrice(order);

            // avoid selling or buying to expensive, cause market is very volatile and i can end up with 0 energy and no resources
            // order direction is flipped as i see it from their perspective,

            if (orderType == ORDER_SELL && totalPrice > resHistoricalPrice * (1 + acceptableMargin)) {
                //console.log("Skipping order because total price ", totalPrice, " is significantly higher than historical price ", resHistoricalPrice);

                // try to create a buy order at historical price to stimulate market and then break to avoid buying at bad price, cause if there is demand someone will fill it and if there is no demand i dont want to buy at bad price and can wait for market to stabilize or fill my order at good price
                this.tryCreateOrder(resType, Math.ceil(resHistoricalPrice * (1 + acceptableMargin / 2)), 3000, targetRoom, ORDER_BUY);

                break;
            }
            if (orderType == ORDER_BUY && totalPrice < resHistoricalPrice * (1 - acceptableMargin)) {
                //console.log("Skipping order ", resType, " because total price ", totalPrice, " is significantly lower than historical price ", resHistoricalPrice);

                this.tryCreateOrder(resType, Math.ceil(resHistoricalPrice * (1 + acceptableMargin / 2)), 3000, targetRoom, ORDER_SELL);

                break;
            }

            //continue;

            var dealAmount = Math.min(amount, order.remainingAmount);
            const energyAmount = targetRoom ? Game.market.calcTransactionCost(dealAmount, order.roomName, targetRoom) : 0;


            console.log("considering order for ", order.resourceType, ", amount", dealAmount, "price", order.price, "total price with transfer", totalPrice, "energy cost", energyAmount);
            var code = Game.market.deal(order.id, dealAmount, targetRoom);

            if (OK == code) {

            }
            else {
                console.log('failed to deal a trade', code);
            }
            break;
        }

    },
}