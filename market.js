const { run } = require("./role.harvester");

module.exports = {
    shareEnergyInternal: function () {

        // for all terminals above 100k send energy to those below 50k
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.terminal)
                continue;

            if (room.storage.store[RESOURCE_ENERGY] < 100000)
                continue;

            if(room.terminal.store[RESOURCE_ENERGY] < 5000)
                continue;

            //console.log("Room ", roomName, " has excess energy ", room.terminal.store[RESOURCE_ENERGY]);
            for (const targetRoomName in Game.rooms) {
                const targetRoom = Game.rooms[targetRoomName];
                if (!targetRoom || !targetRoom.controller.my || !targetRoom.terminal || targetRoomName == roomName)
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

    runReactions() {
        // lets start with what target i want to achieve.
        const goalsPerRoom = {
            'E53S22': { "ZK": 10000 },
            "E55S22": { "UL": 10000 },

            "E48S27": { "UL": 10000 },
            "E49S23": { "ZK": 10000 },

            "E52S23": { "G": 20000 },

            'E51S24': { "OH": 10000 },
            'E51S23': { "OH": 10000 },
            'E55S21': { "OH": 10000 },
            

            
            
            "E56S23": { "GH": 10000 }
        };

        for (const roomName in goalsPerRoom) {
            const room = Game.rooms[roomName];
            if (!room) {
                console.log("Room ", roomName, " not accessible or doesn't exist");
                continue;
            }
            const goals = goalsPerRoom[roomName];

            this.runReactionsForRoom(room, goals);
        }
    },
    runReactionsForRoom(room, goals) {
        for (const targetRes in goals) {
            const requiredAmount = goals[targetRes];
            const currentAmount = this.getTotalMineralAmount(room, targetRes);

            if (currentAmount < requiredAmount) {
                this.handleRoomReagents(room, targetRes, goals, this);
            }
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
        console.log("cost to send", amount, res, "from", idFrom, "to", idTo, "is", cost);

        if (room.terminal.store[RESOURCE_ENERGY] < cost)
            return;

        var code = room.terminal.send(res, amount, idTo, "bro help");
        //console.log("CODE ", code);
        if (OK != code) {
            console.log('failed to help', idFrom, "->", idTo, "with", amount, "error", code);
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
            console.log('failed to run reacton', lab1.room.name, code);
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

        if(Game.resources[PIXEL] > 10)
            this.matchOrderInternal(undefined, PIXEL, 10, ORDER_BUY);    
    },

    putBuyOrders: function () {
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

    matchOrderInternal: function (targetRoom, resType, amount, orderType) {
        if (targetRoom && Game.rooms[targetRoom].terminal.cooldown > 0)
            return;



        // allow buying only raw materials for now, cause i want to control reactions myself and not rely on market for that, also cause i want to avoid situation when i buy expensive compound and then have no reagents for it
        if (orderType == ORDER_SELL &&
            resType != RESOURCE_UTRIUM &&
            //resType != RESOURCE_LEMERGIUM && // too expensive
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

        console.log("avg energy price ", energyHistoricalPrice, "avg", resType, "price ", resHistoricalPrice);
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

        console.log(targetRoom, resType, amount, orderType);

        for (id in sorted) {

            var order = sorted[id];
            if (order.remainingAmount == 0)
                continue;

            var totalPrice = getTotalPrice(order);

            // avoid selling or buying to expensive, cause market is very volatile and i can end up with 0 energy and no resources
            // order direction is flipped as i see it from their perspective,

            if (orderType == ORDER_SELL && totalPrice > resHistoricalPrice * 2) {
                //console.log("Skipping sell order ", order.id, " because total price ", totalPrice, " is higher than historical price ", resHistoricalPrice);
                break;
            }
            if (orderType == ORDER_BUY && totalPrice < resHistoricalPrice * 0.5)
                break;

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

        // resource type comes as RESOURCE_ need to use values from CONSTANTS
        const REAGENTS = {
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
            'XGHO2': ['X', 'GHO2'],
            // Base compounds
            'OH': ['O', 'H'],
            'ZK': ['Z', 'K'],
            'UL': ['U', 'L'],
            'G': ['ZK', 'UL'],
            // Base minerals (no reagents needed)
            'U': null,
            'L': null,
            'K': null,
            'Z': null,
            'O': null,
            'H': null,
            'X': null,
        };

        return REAGENTS[resourceType];
    },
    handleRoomReagents: function (room, targetRes, goals) {
        const targetAmount = goals[targetRes];
        const currentAmount = this.getTotalMineralAmount(room, targetRes);
        if (currentAmount >= targetAmount)
            return;

        var gapAmount = targetAmount - currentAmount;

        gapAmount = Math.min(gapAmount, 1000);// react in smaller batches to be more flexible and avoid overbuying reagents if something changes in the market or if reaction runs faster than expected

        const reagents = this.getReagents(targetRes);
        //console.log("Current amount of ", targetRes, " in ", room.name, " is ", currentAmount, " target is ", targetAmount, " reagents are ", reagents);
        if (!reagents)
            return;

        // buy or internally share reagents
        for (let i = 0; i < reagents.length; i++) {
            const reagent = reagents[i];
            const reagentAmount = this.getTotalMineralAmount(room, reagent);


            if (reagentAmount < gapAmount) {
                // Try to share internally if you have other rooms with excess
                // Find a source room with excess reagent
                var sharedInternally = false;
                const transferAmount = Math.min(1000, gapAmount);

                for (const sourceRoomName in Game.rooms) {
                    const sourceRoom = Game.rooms[sourceRoomName];
                    if (!sourceRoom || !sourceRoom.terminal || sourceRoomName === room.name)
                        continue;
                    //console.log("Checking room ", sourceRoomName, " for reagent ", reagent, " amount ", sourceRoom.terminal.store[reagent]);
                    const sourceAmount = this.getTotalMineralAmount(sourceRoom, reagent);



                    if (sourceAmount > transferAmount) {
                        this.shareResource(sourceRoomName, room.name, reagent, transferAmount);
                        sharedInternally = true;
                        break;
                    }
                }
                // Try to buy reagent if not enough and couldn't share internally

                //if (room.name == "E55S22")
                //        console.log("Room ", room.name, " needs reagent ", reagent, " amount ", reagentAmount, " gap ", gapAmount, " shared internally ", sharedInternally);

                if (!sharedInternally) {
                    this.matchOrderInternal(room.name, reagent, transferAmount, ORDER_SELL);
                }
            }
        }

        // find labs for reagents
        let labs = room.find(FIND_MY_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_LAB
        });

        labs = _.sortBy(labs, l => l.id);
        if (labs.length < 3)
            return;
        labs[0].mineralDemand = reagents[0];
        labs[1].mineralDemand = reagents[1];
        if (labs[0].store[reagents[0]] < LAB_REACTION_AMOUNT ||
            labs[1].store[reagents[1]] < LAB_REACTION_AMOUNT)
            return;

        this.runReaction(labs[0].id, labs[1].id, labs[2].id);
    }
}