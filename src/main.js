var utils = require('utils');
var roleTower = require('role.tower');
var roleLink = require('role.link');
var scp = require('screepsplus');
var market  = require('market');
const profiler = require('screeps-profiler');


//profiler.enable();
//profiler.registerObject(utils, 'utils');
//profiler.registerObject(scp, 'scp');
    
module.exports.loop = function ()
{
      //profiler.reset();
      
     //profiler.wrap(function() {
       loopInner();
      //});
    
}

loopInner = function ()
{
    /*market.shareEnergyInternal();
    market.shareResourcesInternal();
    market.sellExcess();
    market.buyDemand();
    */

    // TODO: Determine the biggest room dynamically
    var biggestRoomName = "W7N1";

    if(Game.cpu.bucket == 10000)
    {
        Game.cpu.generatePixel();
    }

    for(var roomName in Game.rooms)
    {
         var cpuStart = Game.cpu.getUsed();
        
        var room = Game.rooms[roomName];
        
        utils.roomMove(room);
        utils.roomDraw(room);
        
        // every 7th tick to save CPU
        if(Game.time % 7==0){
            if(room.name == biggestRoomName)
            {
                var spawnOrders = utils.roomGetSpawnOrders(room);
                 
                utils.roomSpawn(room, spawnOrders);
            }
            else
            {
                utils.roomSpawn(room);
            }   
        }
        
        //utils.roomAutoBuild(room);
        roleLink.run(room);
        roleTower.run(room);
        
        var elapsed = Game.cpu.getUsed()-cpuStart;
        
        room.memory.cputime = elapsed;
        
    }
    
    //roleLink.runManual();
    //
    
    // TODO: replace SCP with custom stats collection
    if(Game.time % 30==0)
        scp.collect_stats();
    
    scp.collect_stats_end();
}