const { run } = require("./role.harvester");

const REAGENTS = {
    // Base minerals (no reagents needed)
    'U': null,
    'L': null,
    'K': null,
    'Z': null,
    'O': null,
    'H': null,
    'X': null,

    // Base compounds
    'OH': ['O', 'H'],
    'ZK': ['Z', 'K'],
    'UL': ['U', 'L'],
    'G': ['ZK', 'UL'],

    // Tier 1 - Hydrides
    'UH': ['U', 'H'],
    'KH': ['K', 'H'],
    'LH': ['L', 'H'],
    'ZH': ['Z', 'H'],
    'GH': ['G', 'H'],
    // Tier 1 - Oxides
    'UO': ['U', 'O'],
    'KO': ['K', 'O'],
    'LO': ['L', 'O'],
    'ZO': ['Z', 'O'],
    'GO': ['G', 'O'],
    // Tier 2 - Acids (hydride + OH)
    'UH2O': ['UH', 'OH'],
    'KH2O': ['KH', 'OH'],
    'LH2O': ['LH', 'OH'],
    'ZH2O': ['ZH', 'OH'],
    'GH2O': ['GH', 'OH'],
    // Tier 2 - Alkalides (oxide + OH)
    'UHO2': ['UO', 'OH'],
    'KHO2': ['KO', 'OH'],
    'LHO2': ['LO', 'OH'],
    'ZHO2': ['ZO', 'OH'],
    'GHO2': ['GO', 'OH'],
    // Tier 3 - Catalyzed (X + Tier 2)
    'XUH2O': ['X', 'UH2O'],
    'XUHO2': ['X', 'UHO2'],
    'XKH2O': ['X', 'KH2O'],
    'XKHO2': ['X', 'KHO2'],
    'XLH2O': ['X', 'LH2O'],
    'XLHO2': ['X', 'LHO2'],
    'XZH2O': ['X', 'ZH2O'],
    'XZHO2': ['X', 'ZHO2'],
    'XGH2O': ['X', 'GH2O'],
    'XGHO2': ['X', 'GHO2']
};

module.exports = {
    shareEnergyInternal: function () {

        // for all terminals above 100k send energy to those below 50k
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.terminal || !room.storage)
                continue;

            if (room.storage.store[RESOURCE_ENERGY] < 100000)
                continue;

            if (room.terminal.store[RESOURCE_ENERGY] < 5000)
                continue;

            //console.log("Room ", roomName, " has excess energy ", room.terminal.store[RESOURCE_ENERGY]);
            for (const targetRoomName in Game.rooms) {
                const targetRoom = Game.rooms[targetRoomName];
                if (!targetRoom || !targetRoom.controller|| !targetRoom.controller.my || !targetRoom.terminal || !targetRoom.storage || targetRoomName == roomName)
                    continue;

                var totalInTarget = targetRoom.terminal.store[RESOURCE_ENERGY] + targetRoom.storage.store[RESOURCE_ENERGY];
                if (totalInTarget < 20000) {
                    this.shareResource(roomName, targetRoomName, RESOURCE_ENERGY, 2000);
                    return;// make it slower
                }
            }
        }
    },


    getTotalMineralAmount(room, resourceType) {
        let total = 0;

        // Check terminal storage
        if (room.terminal && room.terminal.store[resourceType]) {
            total += room.terminal.store[resourceType];
        }

        // Check all labs in the room
        const labs = room.find(FIND_MY_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_LAB
        });

        labs.forEach(lab => {
            const amount = lab.store.getUsedCapacity(resourceType);
            if (amount) {
                total += amount;
            }

            //console.log("Lab ", JSON.stringify(lab.store));
        });



        return total;
    },

    autoGenerateGoalsForRoom(room) {
        // auto generate goals per room
        // the logic should be - start from simplest compounds tier 1 and then move up
        // it's ok if we overproduce, it will be shared with other rooms and they can go faster.
        // trigger reaction when number quantity of minerals is lowAmount and finish when highAmount, let it be 1000 and 5000 for now
        // 
        // logic of function
        // Step 1 -  stick to one mineral until it reaches highAmount before moving to next
        // Step 2 - get minerals from other rooms if they have excess (above highAmount) before starting production
        // Step 3 - if there is no current product select new production target

        // production and market sharing can happen independently

        const lowAmount = 1000;
        const highAmount = 3000;
        const goals = {};
        const transferLimit = highAmount;

        const manualReagents = {
            // Base minerals (no reagents needed)
            'U': null,
            'L': null,
            'K': null,
            'Z': null,
            'O': null,
            'H': null,
            'X': null,

            // Base compounds
            'OH': ['O', 'H'],
            
            'ZK': ['Z', 'K'],
            'UL': ['U', 'L'],
            'G': ['ZK', 'UL'],

            // Tier 1 - Hydrides
            //'UH': ['U', 'H'],
            //'KH': ['K', 'H'],
            //'LH': ['L', 'H'],
            // 'ZH': ['Z', 'H'],
            'GH': ['G', 'H'],
            // Tier 1 - Oxides
            'UO': ['U', 'O'],
            //'KO': ['K', 'O'],
            //'LO': ['L', 'O'],
            //'ZO': ['Z', 'O'],
            'GO': ['G', 'O'],
            // Tier 2 - Acids (hydride + OH)
            //'UH2O': ['UH', 'OH'],
            //'KH2O': ['KH', 'OH'],
            //'LH2O': ['LH', 'OH'],
            //'ZH2O': ['ZH', 'OH'],
            'GH2O': ['GH', 'OH'],
            // Tier 2 - Alkalides (oxide + OH)
            'UHO2': ['UO', 'OH'],
            // 'KHO2': ['KO', 'OH'],
            //'LHO2': ['LO', 'OH'],
            //'ZHO2': ['ZO', 'OH'],
            //'GHO2': ['GO', 'OH'],
            // Tier 3 - Catalyzed (X + Tier 2)
            //'XUH2O': ['X', 'UH2O'],
            'XUHO2': ['X', 'UHO2'],
            //'XKH2O': ['X', 'KH2O'],
            //'XKHO2': ['X', 'KHO2'],
            //'XLH2O': ['X', 'LH2O'],
            //'XLHO2': ['X', 'LHO2'],
            //'XZH2O': ['X', 'ZH2O'],
            //'XZHO2': ['X', 'ZHO2'],
             'XGH2O': ['X', 'GH2O'],
            //'XGHO2': ['X', 'GHO2']
        };

        // Check if room has a production target in memory
        if (!room.memory.productionTarget) {
            room.memory.productionTarget = null;
        }

        // If there's a current production target, check if it's done
        if (room.memory.productionTarget) {
            // can be removed this was fixed below
            if (REAGENTS[room.memory.productionTarget] == null)
                room.memory.productionTarget = null;

            const currentAmount = this.getTotalMineralAmount(room, room.memory.productionTarget);
            if (currentAmount >= highAmount) {
                // Target reached, clear it and continue to reshare existing reserves
                room.memory.productionTarget = null;
                // Don't return here, allow resharing of completed minerals to other rooms
            } else {
                // Still producing current target, block other production
                goals[room.memory.productionTarget] = highAmount;
                // Don't return here, allow resharing of other completed minerals while producing
            }
        }


        for (let targetRes in manualReagents) {
            // dont check mineral if it's started to produce
            if (targetRes == room.memory.productionTarget)
                continue;

            const currentAmount = this.getTotalMineralAmount(room, targetRes);
            const gapAmount = Math.min(highAmount - currentAmount, transferLimit);

            // If below threshold, try to acquire from external sources
            if (currentAmount < highAmount && gapAmount > 1000) {
                let needAttention = true;

                //console.log(`Room ${room.name} needs ${gapAmount} of ${targetRes} (current: ${currentAmount}), trying to acquire from other rooms or market...`);         

                // First try: share from other rooms
                for (const sourceRoomName in Game.rooms) {
                    const sourceRoom = Game.rooms[sourceRoomName];
                    if (!sourceRoom || !sourceRoom.terminal || sourceRoomName === room.name)
                        continue;

                    const sourceAmount = sourceRoom.terminal.store[targetRes];

                    if (sourceAmount && sourceAmount > highAmount + gapAmount ) {
                        console.log(`Sharing ${gapAmount} of ${targetRes} from ${sourceRoomName} to ${room.name}`);
                        this.shareResource(sourceRoomName, room.name, targetRes, gapAmount);
                        needAttention = false;
                        break;
                    }
                }

                // Second try: buy from market if sharing didn't work
                if (needAttention) {
                    this.matchOrderInternal(room.name, targetRes, gapAmount, ORDER_SELL);
                    // Check if market matching succeeded
                    const newAmount = this.getTotalMineralAmount(room, targetRes);
                    if (newAmount >= highAmount) {
                        needAttention = false;
                        break;
                    }
                }
            }

            var canProduce = REAGENTS[targetRes] != null;

            // if below low amount consider production
            if (currentAmount <= lowAmount && canProduce) {
                // Only set production goal if both external sources failed and dropped below low
                // and not producing anything
                if (room.memory.productionTarget == null) {
                    room.memory.productionTarget = targetRes;
                    goals[targetRes] = highAmount;
                    break;
                }
            }
        }

        // If no production target and all goals are satisfied, clear lab setup and mineral demands
        if (!room.memory.productionTarget && Object.keys(goals).length === 0) {
            // Clear labSetup and set all labs' mineralDemand to null
            room.memory.labSetup = null;
            let labs = room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => structure.structureType === STRUCTURE_LAB
            });
            for (let i = 0; i < labs.length; i++) {
                labs[i].mineralDemand = null;
            }
        }
        //console.log("Room ", room.name, " goals: ", JSON.stringify(goals), " current: ", JSON.stringify(_.mapValues(manualReagents, r => this.getTotalMineralAmount(room, r))));
        return goals;
    }
    ,
    manageInventory(room) {
        // Update all rooms (cycle)
        for (const roomName in Game.rooms) {
            const r = Game.rooms[roomName];
            if (!r || !r.terminal || !r.controller.my)
                continue;
            var goals = this.autoGenerateGoalsForRoom(r);
            r.memory.inventoryGoal = goals;
        }
        return;
    },

    setupReactions() {

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];

            if (!room) {
                console.log("Room ", roomName, " not accessible or doesn't exist");
                continue;
            }
            const goal = room.memory.inventoryGoal;
            if (!goal)
                continue;

            this.setupReactionsForRoom(room, goal);
        }
    },
    
    setupReactionsForRoom(room, goals) {
        const targetRes = room.memory.productionTarget;

        // Only allow lab setup for the active production target.
        // This prevents stale/secondary goal keys from reprogramming labs (e.g. back to GH).
        if (!targetRes) {
            room.memory.labSetup = null;
            return;
        }

        // If setup target drifts from current production target, force reset first.
        if (room.memory.labSetup && room.memory.labSetup.targetRes && room.memory.labSetup.targetRes !== targetRes) {
            room.memory.labSetup = null;
        }

        const requiredAmount = goals[targetRes];
        if (!requiredAmount)
            return;

        const currentAmount = this.getTotalMineralAmount(room, targetRes);
        if (currentAmount < requiredAmount) {
            this.setupRoomReagents(room, targetRes, goals, this);
        }
    }

    ,
    shareResource(idFrom, idTo, res, amount) {
        var room = Game.rooms[idFrom];

        if (!room) {
            console.log("CODE ", idFrom);
            return;
        }

        if (!room.terminal)
            return;

        if (room.terminal.cooldown > 0)
            return;

        var cost = Game.market.calcTransactionCost(amount, idFrom, idTo);
        // console.log("cost to send", amount, res, "from", idFrom, "to", idTo, "is", cost);

        if (room.terminal.store[RESOURCE_ENERGY] < cost)
            return;

        if (room.terminal.store[res] < amount)
            return;

        var code = room.terminal.send(res, amount, idTo, "bro help");
        //console.log("CODE ", code);
        if (OK != code) {
            console.log('failed to help', res, " ", idFrom, "->", idTo, "with", amount, "error", code);
        }
    },

    runReaction(id1, id2, id3) {
        var lab1 = Game.getObjectById(id1);
        var lab2 = Game.getObjectById(id2);
        var lab3 = Game.getObjectById(id3);

        if (!lab3)
            return;

        if (lab3.cooldown > 0)
            return;

        var code = lab3.runReaction(lab1, lab2);
        if (OK != code && code != -6) {
            let l1type = lab1 && lab1.mineralType ? lab1.mineralType : 'none';
            let l2type = lab2 && lab2.mineralType ? lab2.mineralType : 'none';
            let l1amt = lab1 && lab1.mineralType ? lab1.store[lab1.mineralType] : 0;
            let l2amt = lab2 && lab2.mineralType ? lab2.store[lab2.mineralType] : 0;
            let l3type = lab3 && lab3.mineralType ? lab3.mineralType : 'none';
            let l3amt = lab3 && lab3.mineralType ? lab3.store[lab3.mineralType] : 0;
            console.log('failed to run reacton', lab1 && lab1.room ? lab1.room.name : 'unknown', 'err', code,
                'lab1:', l1type, l1amt,
                'lab2:', l2type, l2amt,
                'lab3:', l3type, l3amt
            );
        }
    },

    runManualOrder() {


    },

    shareResourcesInternal: function () {
        //this.shareResource("W57S35", "W59S33", RESOURCE_ZYNTHIUM, 1000);

        return;

    },

    sellExcess: function () {
        const threshold = 100000;

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.terminal)
                continue;

            var resources = _.filter(_.keys(room.terminal.store),
                r => room.terminal.store[r] > threshold);

            for (const resource of resources) {
                const excessAmount = room.terminal.store[resource] - threshold;

                if (excessAmount > 1000) {
                    console.log("Room ", roomName, " has excess of ", resource, " amount ", excessAmount);

                    this.matchOrderInternal(roomName, resource, excessAmount, ORDER_BUY);
                }

            }
        }

        if (Game.resources[PIXEL] > 10)
            this.matchOrderInternal(undefined, PIXEL, 10, ORDER_BUY);
    },

    putBuyOrders: function () {
        // clear fulfilled orders
        for (const order of Object.values(Game.market.orders)) {
            var ticksInDay = 24*60*20;
            if (order.remainingAmount == 0 || Game.time - order.created > 10*ticksInDay) { // 10 days
                console.log("Removing fulfilled/expired order ", order.id);
                Game.market.cancelOrder(order.id);
            }
        }
        
        //sometimes i want to place orders to have more control over price and cause i can place order for 1000 and wait for it to fill instead of trying to buy 1000 with 10 different orders and risk filling only 500 at good price and 500 at bad price
    
        
        return;

        const orderConfigs = [

            {
                room: "E55S22",
                res: RESOURCE_UTRIUM,
                price: 30,
                amount: 10000
            }
        ];


        Game.market.changeOrderPrice('698cfb1817a9f10012875cc4', 650);

        for (const orderConfig of orderConfigs) {
            if (_.filter(Game.market.orders,
                o => o.resourceType == orderConfig.res &&
                    o.type == ORDER_BUY && o.roomName == orderConfig.room).length == 0)

                Game.market.createOrder(ORDER_BUY, orderConfig.res,
                    orderConfig.price,
                    orderConfig.amount,
                    orderConfig.room);
        }
    },

    buyDemand: function () {



        //if (Game.rooms['E53S22'].terminal.store[RESOURCE_ZYNTHIUM] < 1000)
        //    this.matchOrderInternal("E53S22", RESOURCE_ZYNTHIUM, 1000, ORDER_SELL);


        ///if(Game.rooms['W59S34'].terminal.store[RESOURCE_UTRIUM] == undefined || Game.rooms['W59S34'].terminal.store[RESOURCE_UTRIUM] < 10000)   
        //     this.matchOrderInternal("W59S34", RESOURCE_UTRIUM, 1000, ORDER_SELL);
    }
    ,
    recentPrice: function (res) {

        if (!Memory.marketHistoryCache) Memory.marketHistoryCache = {};
        if (!Memory.marketHistoryCache[res]) Memory.marketHistoryCache[res] = {};
        const cache = Memory.marketHistoryCache[res];
        const now = Game.time;
        if (cache.time && (now - cache.time < 10000) && cache.history) {
            var history = cache.history;
        } else {
            var history = Game.market.getHistory(res);
            cache.history = history;
            cache.time = now;
        }
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
        var list = Object.keys(REAGENTS).concat(RESOURCE_ENERGY);

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

    tryCreateBuyOrder: function (resType, price, amount, targetRoom) {
        if (!resType || !price || !amount)
            return;

        if (price <= 0 || amount <= 0)
            return;

        if (targetRoom && (!Game.rooms[targetRoom] || !Game.rooms[targetRoom].terminal))
            return;

        var existing = _.filter(Game.market.orders, function (o) {
            return o.type == ORDER_BUY && o.resourceType == resType &&
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
            type: ORDER_BUY,
            resourceType: resType,
            price: price,
            totalAmount: amount
        };

        if (targetRoom)
            orderParams.roomName = targetRoom;

        var code = Game.market.createOrder(orderParams);
        if (code != OK)
            console.log("Failed to create buy order", resType, "code", code, "room", targetRoom);

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
        const acceptableMargin = 0.1;// i can pay 20% more than historical price to buy and want to sell for 20% less than historical price, cause market is very volatile and i want to be able to react to it, also cause if there is demand someone will fill my order and if there is no demand i dont want to buy at bad price and can wait for market to stabilize or fill my order at good price

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
                this.tryCreateBuyOrder(resType, Math.ceil(resHistoricalPrice * (1 + acceptableMargin / 2)), 3001, targetRoom);

                break;
            }
            if (orderType == ORDER_BUY && totalPrice < resHistoricalPrice * (1 - acceptableMargin)) {
                console.log("Skipping order because total price ", totalPrice, " is significantly lower than historical price ", resHistoricalPrice);
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
    getReagents: function (resourceType) {
        return REAGENTS[resourceType];
    },

    setupRoomReagents: function (room, targetRes, goals) {
        if (room.memory.productionTarget && room.memory.productionTarget !== targetRes)
            return;

        // Setup/check function: called less frequently
        const targetAmount = goals[targetRes];
        const currentAmount = this.getTotalMineralAmount(room, targetRes);
        if (currentAmount >= targetAmount)
            return;

        var gapAmount = targetAmount - currentAmount;
        gapAmount = Math.min(gapAmount, 1000);
        const reagents = this.getReagents(targetRes);
        if (!reagents)
            return;

        for (let i = 0; i < reagents.length; i++) {
            const reagent = reagents[i];
            const reagentAmount = this.getTotalMineralAmount(room, reagent);
            if (reagentAmount < gapAmount) {
                console.log("Need to acquire reagent ", reagent, " for producing ", targetRes, " in ", room.name);
                room.memory.productionTarget = null;
                return;
            }
        }

        let labs = room.find(FIND_MY_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_LAB
        });
        labs = _.sortBy(labs, l => l.id);
        if (labs.length < 3)
            return;

        const getLabMineralType = function (lab) {
            if (lab.mineralType)
                return lab.mineralType;

            return _.findKey(lab.store, (amount, key) => key !== RESOURCE_ENERGY && amount > 0) || null;
        };

        // Always clear stale demands before applying/validating next setup target.
        // This avoids previous targets (e.g. GH) sticking when switching production.
        for (let i = 0; i < labs.length; i++) {
            labs[i].mineralDemand = null;
        }

        // Only set labSetup if all input/output labs are empty or have correct mineral
        let ready = true;
        for (let i = 0; i < 2; i++) {
            const lab = labs[i];
            const expected = reagents[i];
            const labMineralType = getLabMineralType(lab);
            if (labMineralType && labMineralType !== expected) {
                ready = false;
                if ((lab.store[labMineralType] || 0) > 0) {
                    console.log(`Lab ${lab.id} in ${room.name} has wrong mineral (${labMineralType}), needs to be emptied before switching to ${expected}`);
                }
            }
        }
        for (let i = 2; i < labs.length; i++) {
            const lab = labs[i];
            const labMineralType = getLabMineralType(lab);
            if (labMineralType && labMineralType !== targetRes) {
                ready = false;
                if ((lab.store[labMineralType] || 0) > 0) {
                    console.log(`Output lab ${lab.id} in ${room.name} has wrong mineral (${labMineralType}), needs to be emptied before producing ${targetRes}`);
                }
            }
        }
        if (!ready) {
            // Keep setup disabled while labs are being emptied.
            room.memory.labSetup = null;
            return;
        }

        // Store lab IDs in memory for use in fast cycle
        room.memory.labSetup = {
            inputLab1: labs[0].id,
            inputLab2: labs[1].id,
            outputLabs: labs.slice(2).map(l => l.id),
            reagents: reagents,
            targetRes: targetRes
        };

        // Set mineral demands for input/output labs
        labs[0].mineralDemand = reagents[0];
        labs[1].mineralDemand = reagents[1];
        for (let i = 2; i < labs.length; i++) {
            labs[i].mineralDemand = targetRes;
        }
    },

    runReactions(){
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.controller || !room.controller.my || !room.memory.labSetup)
                continue;

            this.runRoomReactions(room);
        }
    },

    runRoomReactions: function (room) {
        // Fast cycle: run reactions using lab IDs from memory
        const setup = room.memory.labSetup;
        if (!setup) return;
        const lab1 = Game.getObjectById(setup.inputLab1);
        const lab2 = Game.getObjectById(setup.inputLab2);
        const outputLabs = setup.outputLabs.map(id => Game.getObjectById(id)).filter(lab => !!lab);
        const reagents = setup.reagents;
        const targetRes = setup.targetRes;
        if (!lab1 || !lab2 || !outputLabs.length || !reagents) return;
        if (lab1.store[reagents[0]] < LAB_REACTION_AMOUNT || lab2.store[reagents[1]] < LAB_REACTION_AMOUNT) return;
        for (const outputLab of outputLabs) {
            if (outputLab.cooldown === 0) {
                this.runReaction(lab1.id, lab2.id, outputLab.id);
            }
        }
    }
}