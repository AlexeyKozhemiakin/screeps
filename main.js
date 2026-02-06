var utils = require('utils');
var roleTower = require('role.tower');
var roleLink = require('role.link');
var scp = require('screepsplus');
var market = require('market');
var prototypes = require('prototypes');

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


    var roomsToClaim = ["E51S23", "E52S23", "E53S22", "E55S22", "E54S22", "E56S23", "E55S21"];

    var spawnOrders = utils.roomGetSpawnOrders(roomsToClaim);

    if (spawnOrders) {

        console.log(JSON.stringify(spawnOrders));
        //spawnOrders = undefined;
    }

    if (Game.cpu.bucket == PIXEL_CPU_COST) {
        Game.cpu.generatePixel();
    }

    for (var roomName in Game.rooms) {

        var cpuStart = Game.cpu.getUsed();

        var room = Game.rooms[roomName];
        room.memory.iterator = 0; // used by upgraders, use global vairable which resets every tick instead 


        utils.roomMove(room);

        utils.roomDraw(room);

        if (Game.time % 6 == 0)
            utils.roomPlan(room);


        // every Nth tick to save CPU
        if (Game.time % 5 == 0) {

            if (spawnOrders && spawnOrders.sponsorRoomName == roomName)
                utils.roomSpawn(room, spawnOrders);
            else
                utils.roomSpawn(room);
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