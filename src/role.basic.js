var profiler = require('screeps-profiler');



var roleBasic =  {
    moveToRoom:function(creep)
    {
        if(!creep.memory.toGo)
            return true;
            
        var roomToGo = creep.memory.toGo[0];
        if(roomToGo == creep.room.name)
        {
            console.log(creep.name, " in the room");
            return true;
        }
        
        var moveTarget;
        
        //var flag = creep.pos.findClosestByRange(FIND_FLAGS, {
        //            filter: flag => (flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_ORANGE)
        //       });
        
        if(!Memory.caches)
            Memory.caches = new Object();
        
        var route = Memory.caches[creep.room+roomToGo];
        
        if(!route)
        {
            route = Game.map.findRoute(creep.room, roomToGo, {
                routeCallback(roomName) {
                    
                    var x = roomName[2];
            		var y = roomName[5];
            		
            		console.log(creep.name, roomName, x, y);
            		if((x == 4 || x == 5 || x == 6) && (y == 4 || y == 5 || y == 6))
            				return Infinity;
            				
                    return 1;
                }});
            Memory.caches[creep.room+roomToGo] = route;     
        }

        //if(creep.memory.toGo[0] == 'E36N49')
        //    console.log("exiting--->",JSON.stringify(route), route[0].exit);
            
       
        moveTarget = creep.pos.findClosestByRange(route[0].exit);
        if(creep.memory.toGo[0] == 'E36N49'){
            moveTarget = new RoomPosition (49, 10, 'E35N49');
        }
            /*
            if(Game.rooms[roomToGo])
            {
                moveTarget = Game.rooms[roomToGo].controller;
            }
            else
            {
                
            }*/
        //}
        
        /*if(flag)
        {
            moveTarget = flag.pos;    
        }
        else
        {
            
        }*/
        //console.log(JSON.stringify(moveTarget));
        var code = creep.moveTo(moveTarget, {visualizePathStyle: {stroke: '#ff0000'}});
        creep.say("Go"+ roomToGo);
        
        return false;        
    },
    
    runDropped:function(creep, range, resType, limit)
    {
        if(!limit)
            limit = 0;
        
        //console.log(creep.name, range, resType, limit);
        var fRes = (res) => { return res.resourceType == resType && res.amount > limit;}
        if(!resType)
            fRes = (res) => { return res.amount > limit;}
            
        var dropped = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {filter: fRes });
        
        if(dropped == undefined) 
        {
            var fTomb = (tomb) => { return tomb.store[resType] > limit;};
            if(!resType)
                fTomb = (tomb) => { return _.sum(tomb.store) > limit;};
                
            dropped = creep.pos.findClosestByRange(FIND_TOMBSTONES, {filter: fTomb });
        }
        
        var rangeToDrop = creep.pos.getRangeTo(dropped);
        //if(range > 1)
            //console.log("range", rangeToDrop , dropped, "rangeLimit", range, "creep.room", creep.room);
        if(!dropped || rangeToDrop > range ) 
        {
            return false;
        }
        
        //creep.say("see drop");
        console.log("see drop"+ " "+ dropped+" " + dropped.amount+ " "+ dropped.room.name+ " "+ dropped.pos.x+ " "+dropped.pos.y);
        
        var err;
        if(dropped instanceof Resource)
            err = creep.pickup(dropped);
        else if(dropped instanceof Tombstone)
        {
            if(resType==undefined){
                 var keys = _.findKey(dropped.store, f => f > 0);
                if(keys)
                    resType = keys;
            }
            err = creep.withdraw(dropped, resType);
        }
        else
            console.log("typeof dropped ", typeof dropped);
            
        if(err==OK){
            creep.say("picked");
        }
        else if(err == ERR_NOT_IN_RANGE)
        {
            if(creep.fatigue == 0)
            {
                var err1 = creep.moveTo(dropped, {visualizePathStyle: {stroke: '#ff0000'}});
            }
        }
        else
            creep.say("oo1"+err);
            
        return true;
    }
    ,
    
    repairEmergency:function(creep, extN)
    {
        var N = 0.2;
        if(extN)
            N = extN;

        var damagedBuilds =  creep.pos.findInRange(FIND_STRUCTURES, 1, 
            {filter : s=>s.hits < s.hitsMax*N && (s.strctureType == STRUCTURE_ROAD || s.structureType==STRUCTURE_CONTAINER)});
        
        if(damagedBuilds.length > 0)
            creep.repair(damagedBuilds[0]);
    }
    
};
profiler.registerObject(roleBasic, 'basic');
module.exports = roleBasic;