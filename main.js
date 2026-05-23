var utils = require('utils');
var basic = require('role.basic');
var roleTower = require('role.tower');
var roleLink = require('role.link');
var roleBoost = require('role.boost');
var roleFactory = require('role.factory');
var roleLab = require('role.lab');
var roleObserver = require('role.observer');
var rolePowerCreep = require('role.powerCreep');
var roomPowerSpawn = require('room.powerSpawn');
var scp = require('screepsplus');
var market = require('market');

var prototypes = require('prototypes');
//
//var roleBasic = require('role.basic');
//var roleHarvester = require('role.harvester');
//var roleUpgrader = require('role.upgrader');
//var roleBuilder = require('role.builder');
//var roleDeliverer = require('role.deliverer');
//var roleClaim = require('role.claim');
//var roleAttack = require('role.attack');
//var roleReserve = require('role.reserve');
//var roleScout = require('role.scout');
//var roleMineralHarvester = require('role.mineralHarvester');

var roomPlanning = require('room.planning');
var roomClaiming = require('room.claim');
var roomRemoteHarvesting = require('room.remoteHarvesting');
var roomDepositHarvesting = require('room.depositHarvesting');
var roomPowerHarvesting = require('room.powerHarvesting');
var roomProcess = require('room.process');
require('console-commands');

function debugRouteBetweenIds(fromId, toId) {
    var from = Game.getObjectById(fromId);
    var to = Game.getObjectById(toId);

    if (!from || !to || !from.pos || !to.pos) {
        console.log('debugRouteBetweenIds missing endpoint', fromId, !!from, toId, !!to);
        return;
    }

    var roomRoute = Game.map.findRoute(from.pos.roomName, to.pos.roomName, {
        routeCallback: function (roomName) {
            return basic.getRouteWeight(roomName);
        }
    });

    if (roomRoute === ERR_NO_PATH) {
        console.log('debugRouteBetweenIds no route', fromId, from.pos.roomName, toId, to.pos.roomName);
        return;
    }

    var path = utils.getPathMultiroom(from, to, 1);

    if (!path || !path.length) {
        console.log('debugRouteBetweenIds empty path', fromId, toId);
        return;
    }

    var lastStep = path[path.length - 1];
    var remainingRange = lastStep.getRangeTo(to.pos);
    var travelLength = path.length + Math.max(0, remainingRange - 1);
    var label = 'len=' + travelLength + ' steps';

    if (roomRoute.length) {
        label += ' rooms=' + (roomRoute.length + 1);
    }

    new RoomVisual(from.pos.roomName).circle(from.pos, {
        radius: 0.45,
        stroke: '#00ff88',
        fill: 'transparent'
    });
    new RoomVisual(from.pos.roomName).text('A', from.pos.x, from.pos.y - 0.6, {
        color: '#00ff88',
        font: 0.6
    });

    new RoomVisual(to.pos.roomName).circle(to.pos, {
        radius: 0.45,
        stroke: '#ff3355',
        fill: 'transparent'
    });
    new RoomVisual(to.pos.roomName).text('B', to.pos.x, to.pos.y - 0.6, {
        color: '#ff3355',
        font: 0.6
    });

    for (var pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
        var current = path[pathIndex];
        var next = path[pathIndex + 1];

        if (current.roomName !== next.roomName)
            continue;

        new RoomVisual(current.roomName).line(current, next, {
            color: '#00d4ff',
            width: 0.18,
            opacity: 0.6,
            lineStyle: 'dashed'
        });
    }

    new RoomVisual(from.pos.roomName).text(label, from.pos.x + 1, from.pos.y, {
        color: '#00d4ff',
        align: 'left',
        font: 0.5
    });

    if (from.pos.roomName !== to.pos.roomName) {
        new RoomVisual(to.pos.roomName).text(label, to.pos.x - 1, to.pos.y, {
            color: '#00d4ff',
            align: 'right',
            font: 0.5
        });
    }
}


//const profiler = require('screeps-profiler');
//profiler.enable();
//profiler.registerClass(roleTower, 'role.tower');
//profiler.registerClass(roleLink, 'role.link');
//profiler.registerClass(roomPlanning, 'room.planning');
//profiler.registerClass(roomClaiming, 'room.claim');
//profiler.registerClass(roomRemoteHarvesting, 'room.remoteHarvesting');
//profiler.registerClass(roomProcess, 'room.process');
//profiler.registerClass(prototypes, 'prototypes');
//profiler.registerClass(roleBoost, 'role.boost');
//profiler.registerObject(roleFactory, 'role.factory');
//profiler.registerClass(market, 'market');
//profiler.registerClass(scp, 'scp');
//profiler.registerObject(utils, 'utils');
//
//profiler.registerObject(roleBasic, 'role.basic');
//profiler.registerObject(roleHarvester, 'role.harvester');
//profiler.registerObject(roleUpgrader, 'role.upgrader');
//profiler.registerObject(roleBuilder, 'role.builder');
//profiler.registerObject(roleDeliverer, 'role.deliverer');
//profiler.registerObject(roleClaim, 'role.claim');
//profiler.registerObject(roleAttack, 'role.attack');
//profiler.registerObject(roleReserve, 'role.reserve');
//profiler.registerObject(roleScout, 'role.scout');
//profiler.registerObject(roleMineralHarvester, 'role.mineralHarvester');


module.exports.loop = function () {

    //profiler.wrap(function () {
    try {

        loopInner();
    } catch (e) {
        console.log("Loop error: ", e.stack, e.message);
    }
    //});
}

loopInner = function () {


    try {
        //market.exploreArbitrage(Game.rooms["E51S23"]);
        if (Game.time % 5 == 0) {

            market.sellExcess();

            market.shareEnergyInternal();

            market.shareResourcesInternal();

            roleLab.manageInventory();
            roleLab.setupReactions();

            market.adjustOrders();
        }
        roleLab.runReactions();

        if (Game.time % market.MARKET_HISTORY_INTERVAL == 0) {
            market.archiveMarketTransactions();
        }
    }
    catch (e) {
        console.log("Market error: ", e.stack, e.message);
    }



    // manage via console commands
    var roomsToClaim = Memory.roomsToClaim;

    var claimOrders = roomClaiming.roomGetSpawnOrders(roomsToClaim);

    if (Game.time % 10 == 0)
        roomDepositHarvesting.assignDepositHarvestingRooms();

    if (Game.time % 10 == 0)
        roomPowerHarvesting.assignPowerHarvestingRooms();

    if (claimOrders) {

        console.log(JSON.stringify(claimOrders));
        //spawnOrders = undefined;
    }

    if (Game.cpu.bucket == PIXEL_CPU_COST) {
        Game.cpu.generatePixel();
    }




    for (var roomName in Game.rooms) {
        var cpuStart = Game.cpu.getUsed();
        // standard game time and room unique hash
        // to redistribute CPU more or less equally between rooms and to avoid doing heavy lifting in the same room every tick
        var roomTime = Game.time + _.reduce(roomName, (hash, char) => {
            return ((hash << 5) + hash) + char.charCodeAt(0);
        }, 5381) >>> 0;

        var room = Game.rooms[roomName];
        room.memory.iterator = 0; // used by upgraders for throttelling, use global vairable which resets every tick instead 


        roomProcess.roomMove(room);
        roleObserver.run(room);
        utils.roomDraw(room);
        utils.safeModeIfDanger(room);

        var dT = 100;

        if (!room.controller || (room.controller && room.controller.level == 1))
            dT = 1;

        if (room.controller && !room.controller.my)
            dT = 1;

        if (roomTime % dT == 0)
            roomPlanning.roomPlan(room);

        // every Nth tick to save CPU
        if (roomTime % 10 == 0) {

            var spawnOrder = roomRemoteHarvesting.getOrder(room);

            if (spawnOrder) {
                //console.log("Remote harvest orders: ", JSON.stringify(spawnOrder));
            }

            if (claimOrders && claimOrders.sponsorRoomName == roomName) {
                spawnOrder = claimOrders;
            }

            if (!spawnOrder) {
                var order = roomPowerHarvesting.getPowerHarvestingOrder(roomName);
                if (order)
                    spawnOrder = order;
            }

            if (!spawnOrder) {
                var order = roomDepositHarvesting.getDepositHarvestingOrder(roomName);
                if (order)
                    spawnOrder = order;
            }
            
            // if (!spawnOrder) {
            //     var depositOrder = roomDepositHarvesting.getDepositHarvestingOrder(roomName);
            //     if (depositOrder)
            //         spawnOrder = depositOrder;
            // }

            //var roomN = "E55S21";
            //var powerN = "E55S20";
            //if (room.name == roomN) {
            //    var deliverers = _.filter(Game.creeps,
            //        c => c.memory.role == "deliverer" &&
            //            c.memory.tag == "powerPickup+" + powerN);
//
            //    const powerDelivererParts =
            //        [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
            //            MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
            //            CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
            //            CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
            //            CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
//
            //    var delivererSize = CARRY_CAPACITY * _.sum(powerDelivererParts, p => p == CARRY ? 1 : 0);
//
            //    if (deliverers.length < 4000 / delivererSize) {
//
            //        var memory = {
            //            role: "deliverer",
            //            toGo: [powerN],
            //            tag: "powerPickup+" + powerN,
            //            task: "pickupPower",
            //            preferredSourceId: "nonexistent", // to trigger suicide on pickup
            //            preferredTargetId: room.storage.id,
            //            parts: powerDelivererParts
            //        };
//
            //        spawnOrder =  { "memory": memory };
            //    }
            //}

            if (roomName == "E57S23!!" && !spawnOrder) {
                const attackRoomName = "E57S25";

                var attackTargetCount = 1;
                var attackers = _.filter(Game.creeps, function (creep) {
                    return creep.role == "attack" &&
                        creep.memory.toGo &&
                        creep.memory.toGo[0] == attackRoomName;
                });

                if (attackers.length < attackTargetCount) {
                    spawnOrder = {
                        memory: {
                            role: "attack",
                            toGo: [attackRoomName],
                            parts: [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                                MOVE, MOVE, MOVE, MOVE, MOVE]
                        }
                    };
                }

            }

            utils.roomSpawn(room, spawnOrder);
            // console.log(roomName,"Spawn orders: ", JSON.stringify(spawnOrder));
        }

        roleLink.run(room);
        roleTower.run(room);
        roleFactory.run(room);
        roomPowerSpawn.run(room);




        // Prepare labs for boosting (every 10 ticks)
        if (roomTime % 5 == 0) {
            //console.log("Preparing labs for boosting in room ", roomName);
            roleBoost.prepareLabs(room);
        }

        var elapsed = Game.cpu.getUsed() - cpuStart;
        room.memory.cputime = elapsed;
    }

    for (var powerCreepName in Game.powerCreeps) {
        var powerCreep = Game.powerCreeps[powerCreepName];

        try {
            rolePowerCreep.run(powerCreep);
        }
        catch (err) {
            console.log("Power creep error:", powerCreepName, err.stack || err);
        }
    }

    //debugRouteBetweenIds('6980f151251adc8ca0e59738', '579faa390700be0674d30aa3');
    //debugRouteBetweenIds('6980f151251adc8ca0e59738', '579faa390700be0674d30aa2');
    //debugRouteBetweenIds('6980f151251adc8ca0e59738', '579faa390700be0674d30aa4');
    //roleLink.runManual();

    const statsInterval = 1;
    if (Game.time % statsInterval == 0)
        scp.collect_stats();

    scp.collect_stats_end();
}