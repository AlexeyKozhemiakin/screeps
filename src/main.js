var utils = require('utils');
var roleTower = require('role.tower');
var roleLink = require('role.link');
var scp = require('screepsplus');
var market  = require('market');

module.exports.loop = function ()
{
    scp.collect_stats();
    
    market.shareEnergyInternal();
    market.shareResourcesInternal();
    market.sellExcess();
    market.buyDemand();
    
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }
    
    /*
    for(var name in Memory.rooms) {
        if(!Game.rooms[name]) {
            delete Memory.rooms[name];
            console.log('Clearing non-existing room memory:', name);
        }
    }*/
    
    // global orders
    
    // prescreen rooms
    var roomsToClaim = ['W59S33','W59S36','W59S34', 'W58S36', 'W57S37', 'W57S35', 'W55S33'];
    var roomsNotClaimed = _.filter(roomsToClaim, roomName => {
        var room = Game.rooms[roomName];
        if(room)
        {
            //console.log(roomName," controller is ", Game.rooms[roomName].controller.my);
            return !Game.rooms[roomName].controller.my;
        }
        return true;
    });
   
    
    console.log("notClaimed", roomsNotClaimed);
    
    var buildRoom;
    for(var roomName in Game.rooms)
    {
        var room = Game.rooms[roomName];
        if(!room.controller)
            continue;
       // if(!room.controller.my)
        //   continue; 
        var roomSpawns = _.filter(Game.spawns, s=>s.room.name == roomName);
        var spawnExists = roomSpawns.length > 0;
        
        var constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        var builders = _.filter(Game.creeps, c=>c.memory.role == "builder" && (c.memory.toGo && c.memory.toGo[0] == roomName));
        
        var numBld = 1;
        //console.log(roomName, builders.length);
        //console.log(room.name, builders, constructionSites, spawnExists);
        if(!spawnExists && constructionSites.length > 0 && builders.length < numBld)
        {
            console.log("needBuild", roomName);
            buildRoom = roomName;
        }
    }
    
    //var builders = _.filter(Game.creeps, c=>c.memory.role == "builder" && c.memory.toGo);
    
    var needClaim = false;
    var claimers = _.filter(Game.creeps, c=>c.memory.role == "claim");
    
    var biggestRoomName = "W59S33";
    console.log("Spawn Room ", biggestRoomName);
    
    if(claimers.length > 0  && roomsNotClaimed.length > 0)
    {
        roomsNotClaimed = undefined;
    }
    
   
    
    for(var roomName in Game.rooms)
    {
        var room = Game.rooms[roomName];
        
        var buildOrder;
        if(buildRoom)
        {
            buildOrder = new Array();
            buildOrder.push(buildRoom);
        }
        
        if(room.name == biggestRoomName)
            utils.roomSpawn(room, roomsNotClaimed, buildOrder);
        else
            utils.roomSpawn(room, undefined, undefined, undefined);
    }
    
    
    for(var roomName in Game.rooms)
    {
        var room = Game.rooms[roomName];
        
        utils.roomMove(room);
        
        utils.roomAutoBuild(room);
        roleLink.run(room);
        roleTower.run(room);
    }
    
    roleLink.runManual();

    // stats
    for(var roomName in Game.rooms)
    {    
        var n = 20;
        
        var room = Game.rooms[roomName];
        if(!room.controller)
            continue;
            
        if(room.memory.controllerProcessStats == undefined)
        {
            room.memory.controllerProcessStats = new Array();
        }
        
        var st = room.memory.controllerProcessStats;
        
        room.memory.controllerProcessStats.push(room.controller.progress);
        if(room.memory.controllerProcessStats.length > n){
            room.memory.controllerProcessStats.shift();
            
            if(room.memory.controllerProcessStats.length > n)
            {
                room.memory.controllerProcessStats.splice(0, room.memory.controllerProcessStats.length-n);
            }
        }
        
        var should = room.memory.controllerProcessStats[room.memory.controllerProcessStats.length-1] - room.memory.controllerProcessStats[0];
        
        var eff = should / ((room.memory.controllerProcessStats.length-1)*CONTROLLER_MAX_UPGRADE_PER_TICK) * 100;
        if(eff<0)
        {
            eff = 0;
        }
        
        room.memory.controllerEfficiency = eff;
        
        if(Memory.stats.roomSummary[room.name])
            Memory.stats.roomSummary[room.name].controllerEfficiency = eff;
    }    
    
    
    Memory.stats.cpu.used = Game.cpu.getUsed(); // AT END OF MAIN LOOP
}