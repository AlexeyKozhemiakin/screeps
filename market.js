module.exports = {

    // Archive market transactions to Memory for long-term analysis
    MARKET_HISTORY_MAX_ENTRIES: 1000,   // keep at most this many archived transactions
    MARKET_HISTORY_INTERVAL:    50,     // archive every N ticks

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

        // for all terminals above 100k send energy to those below 50k
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.terminal || !room.storage)
                continue;

            if (room.storage.store[RESOURCE_ENERGY] < 200000)
                continue;

            if (room.terminal.store[RESOURCE_ENERGY] < 5000)
                continue;

            //console.log("Room ", roomName, " has excess energy ", room.terminal.store[RESOURCE_ENERGY]);
            for (const targetRoomName in Game.rooms) {
                const targetRoom = Game.rooms[targetRoomName];
                if (!targetRoom || !targetRoom.controller|| !targetRoom.controller.my || !targetRoom.terminal || !targetRoom.storage || targetRoomName == roomName)
                    continue;

                var totalInTarget = targetRoom.terminal.store[RESOURCE_ENERGY] + targetRoom.storage.store[RESOURCE_ENERGY];
                if (totalInTarget < 30000) {
                    var res = this.shareResource(roomName, targetRoomName, RESOURCE_ENERGY, 5000);
                    if(res)
                        return;// make it slower
                }
            }
        }
    },



    shareResource(idFrom, idTo, res, amount) {
        var room = Game.rooms[idFrom];

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

        var code = room.terminal.send(res, amount, idTo, "bro help");
        //console.log("CODE ", code);
        if (OK != code) {
            console.log('failed to help', res, " ", idFrom, "->", idTo, "with", amount, "error", code);
            return false
        }

        return true;
    },

    runManualOrder() {


    },

    shareResourcesInternal: function () {
        

        return;

    },

    sellExcess: function () {
        const threshold = 120000;

        // Lower threshold for factory outputs - sell once a modest stockpile builds up
        const commodityThresholds = {
            'utrium_bar'    : 10000,
            'lemergium_bar' : 10000,
            'keanium_bar'   : 10000,
            'zynthium_bar'  : 10000,
            'oxidant'       : 10000,
            'reductant'     : 10000,
            'purifier'      : 10000,
            'ghodium_melt'  : 10000,
            'battery'       : 5000
        };

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.terminal)
                continue;

            var resources = _.keys(room.terminal.store).filter(r => room.terminal.store[r] > 0);

            for (const resource of resources) {
                const limit = commodityThresholds[resource] !== undefined ? commodityThresholds[resource] : threshold;
                const excessAmount = room.terminal.store[resource] - limit;

                if (excessAmount > 100) {
                    console.log("Room ", roomName, " has excess of ", resource, " amount ", excessAmount);
                    this.matchOrderInternal(roomName, resource, excessAmount, ORDER_BUY);
                }
            }
        }

        //if (Game.resources[PIXEL] > 10)
        //    this.matchOrderInternal(undefined, PIXEL, 10, ORDER_BUY);
    },

    adjustOrders: function () {
        var ADJUST_INTERVAL = 200; // ticks between price adjustments
        var PRICE_BUMP = 0.05;     // 5% increase per adjustment

        if (!Memory.orderAdjustments) Memory.orderAdjustments = {};

        for (const order of Object.values(Game.market.orders)) {
            // Cancel fulfilled orders
            if (order.remainingAmount == 0) {
                console.log('Removing fulfilled order ', order.id);
                Game.market.cancelOrder(order.id);
                delete Memory.orderAdjustments[order.id];
                continue;
            }

            // Cancel very old orders (5 days)
            var ticksInDay = 24 * 60 * 10;
            var delay = Game.time - order.created;
            if (delay > 5 * ticksInDay) {
                console.log('Removing expired order ', order.id);
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
            const buyTransfer = Game.market.calcTransactionCost(10000, bestSell.roomName, room.name)/10000* energyPrice;
            const sellTransfer = Game.market.calcTransactionCost(10000, room.name, bestBuy.roomName)/10000 * energyPrice;
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

    matchOrderInternal: function (targetRoom, resType, amount, orderType) {
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
        const acceptableMargin = 0.15;// i can pay 20% more than historical price to buy and want to sell for 20% less than historical price, cause market is very volatile and i want to be able to react to it, also cause if there is demand someone will fill my order and if there is no demand i dont want to buy at bad price and can wait for market to stabilize or fill my order at good price

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
                console.log("Skipping order ", resType, " because total price ", totalPrice, " is significantly lower than historical price ", resHistoricalPrice);
                
                this.tryCreateOrder(resType, Math.ceil(resHistoricalPrice * (1 + acceptableMargin / 2)), 3000, targetRoom, ORDER_SELL);

                break;
            }

            //continue;

            var dealAmount = Math.min(amount, order.remainingAmount);
            const energyAmount = targetRoom ? Game.market.calcTransactionCost(dealAmount, order.roomName, targetRoom) : 0;


            console.log("considering order ", order.id, "price", order.price, "total price with transfer", totalPrice, "energy cost", energyAmount);
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