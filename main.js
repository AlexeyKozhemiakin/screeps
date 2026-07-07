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
var roleBasic = require('role.basic');
var roleHarvester = require('role.harvester');
var roleDepositHarvester = require('role.depositHarvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleDeliverer = require('role.deliverer');
var roleClaim = require('role.claim');
var roleAttack = require('role.attack');
var roleReserve = require('role.reserve');
var roleScout = require('role.scout');
var roleMineralHarvester = require('role.mineralHarvester');

var roomPlanning = require('room.planning');
var roomClaiming = require('room.claim');
var roomRemoteHarvesting = require('room.remoteHarvesting');
var roomDepositHarvesting = require('room.depositHarvesting');
var roomPowerHarvesting = require('room.powerHarvesting');
var roomProcess = require('room.process');
require('console-commands');

var profiler = require('screeps-profiler');
//profiler.enable();
profiler.registerClass(roleTower, 'role.tower');
profiler.registerClass(roleLink, 'role.link');
profiler.registerClass(roomPlanning, 'room.planning');
profiler.registerClass(roomClaiming, 'room.claim');
profiler.registerClass(roomRemoteHarvesting, 'room.remoteHarvesting');
profiler.registerClass(roomPowerHarvesting, 'room.powerHarvesting');
profiler.registerClass(roomDepositHarvesting, 'room.depositHarvesting');

profiler.registerClass(roomProcess, 'room.process');
profiler.registerClass(prototypes, 'prototypes');
profiler.registerClass(roleBoost, 'role.boost');
profiler.registerClass(roleLab, 'role.lab');
profiler.registerObject(roleFactory, 'role.factory');
profiler.registerClass(market, 'market');
profiler.registerClass(scp, 'scp');
profiler.registerObject(utils, 'utils');
profiler.registerObject(roleObserver, 'role.observer');
profiler.registerObject(rolePowerCreep, 'role.powerCreep');
profiler.registerObject(roleBasic, 'role.basic');
profiler.registerObject(roleHarvester, 'role.harvester');
profiler.registerObject(roleDepositHarvester, 'role.depositHarvester');
profiler.registerObject(roleUpgrader, 'role.upgrader');
profiler.registerObject(roleBuilder, 'role.builder');
profiler.registerObject(roleDeliverer, 'role.deliverer');
profiler.registerObject(roleClaim, 'role.claim');
profiler.registerObject(roleAttack, 'role.attack');
profiler.registerObject(roleReserve, 'role.reserve');
profiler.registerObject(roleScout, 'role.scout');
profiler.registerObject(roleMineralHarvester, 'role.mineralHarvester');


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
        if (Game.time % 10 == 0) {
            market.sellExcess();
            market.shareEnergyInternal();
            market.shareResourcesInternal();
        }

        if (Game.time % 20 == 0) {
            market.adjustOrders();
            market.crazySales(RESOURCE_ENERGY, "E48S27");
            market.archiveMarketTransactions();
        }
    }
    catch (e) {
        console.log("Market error: ", e.stack, e.message);
    }

    if (Game.time % 100 == 0)
        roomDepositHarvesting.assignDepositHarvestingRooms();

    if (Game.time % 100 == 0)
        roomPowerHarvesting.assignPowerHarvestingRooms();

    // manage via console commands
    var roomsToClaim = Memory.roomsToClaim;
    var claimOrders = roomClaiming.roomGetSpawnOrders(roomsToClaim);
    if (claimOrders) {

        console.log(JSON.stringify(claimOrders));
        //spawnOrders = undefined;
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
        if (roomTime % 9 == 0) {

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
        if (roomTime % 5 == 0) {
            roleFactory.run(room);
        }
        roomPowerSpawn.run(room);


        if (roomTime % 11 == 0) {
            roleLab.manageInventory(room);
            roleLab.setupReactions(room);
        }

        roleLab.runReactions(room);


        // Prepare labs for boosting (every x ticks)
        if (roomTime % 6 == 0) {
            //console.log("Preparing labs for boosting in room ", roomName);
            roleBoost.prepareLabs(room);
        }

        room.memory.cputime = Game.cpu.getUsed() - cpuStart;
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

    //roomPlanning.debugRouteBetweenIds('6a183b21f4ec89fa3ed5d1a8', '6a17441706382f81cd85338b');
    //roomPlanning.debugRouteBetweenIds('6980f151251adc8ca0e59738', '579faa390700be0674d30aa2');
    //roomPlanning.debugRouteBetweenIds('6980f151251adc8ca0e59738', '579faa390700be0674d30aa4');
    //roleLink.runManual();


    const statsInterval = 1;
    if (Game.time % statsInterval == 0)
        scp.collect_stats();

    scp.collect_stats_end();

    if (Game.cpu.bucket == PIXEL_CPU_COST) {
        Game.cpu.generatePixel();
    }
}