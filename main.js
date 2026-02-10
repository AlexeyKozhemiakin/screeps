var utils = require('utils');
var roleTower = require('role.tower');
var roleLink = require('role.link');
var scp = require('screepsplus');
var market = require('market');
var prototypes = require('prototypes');

var roomPlanning = require('room.planning');
var roomClaiming = require('room.claim');
var roomRemoteHarvesting = require('room.remoteHarvesting');
var roomProcess = require('room.process');

module.exports.loop = function () {
    try {
        loopInner();
    } catch (e) {
        console.log("Loop error: ", e.stack, e.message);
    }
}

loopInner = function () {

    /*market.shareEnergyInternal();
    market.shareResourcesInternal();
    market.sellExcess();
    market.buyDemand();
    */


    var roomsToClaim = ["E51S23", "E52S23", "E53S22",
        "E55S22", "E54S22", "E56S23",
        "E55S21", "E48S27", "E49S23",
        "E52S22"
    ];

    //"E48S24" was not able to pass because of rampart

    var claimOrders = roomClaiming.roomGetSpawnOrders(roomsToClaim);

    if (claimOrders) {

        console.log(JSON.stringify(claimOrders));
        //spawnOrders = undefined;
    }

    if (Game.cpu.bucket == PIXEL_CPU_COST) {
        Game.cpu.generatePixel();
    }

    var obj1 = Game.getObjectById('698a2e3591dbb3e9094d8eb8');
    var obj2 = Game.getObjectById('69827367dd8e6f975e92973a');
    if (obj1 && obj2) {
        //console.log("Path:", utils.isRoaded(obj1, obj2));
        //var path = obj1.pos.findPathTo(obj2, { ignoreCreeps: true });
        //roomPlanning.drawPath(path, obj1.room, 'red');
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

        if (roomTime % 20 == 0)
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

        var elapsed = Game.cpu.getUsed() - cpuStart;

        room.memory.cputime = elapsed;
    }
    //roleLink.runManual();

    const statsInterval = 1;
    if (Game.time % statsInterval == 0)
        scp.collect_stats();

    scp.collect_stats_end();
}