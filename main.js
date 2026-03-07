var utils = require('utils');
var roleTower = require('role.tower');
var roleLink = require('role.link');
var roleBoost = require('role.boost');
var roleFactory = require('role.factory');
var roleLab = require('role.lab');
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
var roomProcess = require('room.process');
require('console-commands');


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
    // Seed Memory.roomsToClaim once, then manage via console commands
    //if (!Memory.roomsToClaim) {
    Memory.roomsToClaim = [
        "E51S23", "E52S23", "E53S22",
        "E55S22", "E54S22", "E56S23",
        "E55S21", "E48S27", "E49S23",
        "E52S22", "E47S26", "E48S22",

        "E48S23", "E57S23", "E45S29"
    ];
    //}
    var roomsToClaim = Memory.roomsToClaim;

    //"E48S24" was not able to pass because of rampart

    var claimOrders = roomClaiming.roomGetSpawnOrders(roomsToClaim);

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
        utils.roomDraw(room);
        utils.safeModeIfDanger(room);

        var dT = 100;

        if (room.controller && room.controller.level == 1)
            dT = 1;

        if (roomTime % dT == 0)
            roomPlanning.roomPlan(room);

        // every Nth tick to save CPU
        if (roomTime % 5 == 0) {

            var spawnOrder = roomRemoteHarvesting.getOrder(room);

            if (spawnOrder) {
                //console.log("Remote harvest orders: ", JSON.stringify(spawnOrder));
            }

            if (claimOrders && claimOrders.sponsorRoomName == roomName) {
                spawnOrder = claimOrders;
            }

            utils.roomSpawn(room, spawnOrder);
            // console.log(roomName,"Spawn orders: ", JSON.stringify(spawnOrder));
        }

        roleLink.run(room);
        roleTower.run(room);
        roleFactory.run(room);

        // Prepare labs for boosting (every 10 ticks)
        if (roomTime % 5 == 0) {
            //console.log("Preparing labs for boosting in room ", roomName);
            roleBoost.prepareLabs(room);
        }

        var elapsed = Game.cpu.getUsed() - cpuStart;
        room.memory.cputime = elapsed;
    }
    //roleLink.runManual();

    const statsInterval = 1;
    if (Game.time % statsInterval == 0)
        scp.collect_stats();

    scp.collect_stats_end();
}