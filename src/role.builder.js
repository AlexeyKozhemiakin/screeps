var basic = require("role.basic");

var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep)
    {


        var enemyConstructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
                filter: s => (s.owner.username != 'Zenga')
            });
        
        if(enemyConstructionSite)
        {
           creep.moveTo(enemyConstructionSite);
           return;
        }
	    
	    if(creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.say('🔄 harvest');
	    }
	    if(!creep.memory.building && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.building = true;
	        creep.say('🚧 build');
	    }

        if(!basic.moveToRoom(creep))
        {
            return;
        }
	    
	    if(creep.memory.building)
	    {
	        var targetDismantle;
	        
            
            var flagDismantle = creep.pos.findClosestByRange(FIND_FLAGS, {
                    filter: flag => (flag.color == COLOR_RED && flag.secondaryColor == COLOR_BROWN)
                });
            
            if(flagDismantle)
            {
               targetDismantle = flagDismantle.pos.findClosestByPath(FIND_STRUCTURES, {ignoreCreeps:true, range:3});
               
               if(targetDismantle != null)
                    console.log("removing bad object " + targetDismantle.id);
                    
                
            }
            
            var target;
            var flag = creep.pos.findClosestByRange(FIND_FLAGS, {
                    filter: flag => (flag.color == COLOR_RED && flag.secondaryColor == COLOR_RED)
                });
            if(flag)
            {
               
               target = flag.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {ignoreCreeps:true, range:3});
               
               if(target != null)
                    console.log("building important object " + target.id);
            }
            
            
            if(target == undefined)
            {
                var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
               
                var sorted = _.sortBy(targets, c=>c.progress).reverse();
                
                if(sorted.length > 0)
                    target = sorted[0];
            }
            
            if(targetDismantle) 
            {
                var range = creep.pos.getRangeTo(targetDismantle.pos);
                if( range > 1)
                {
                    var ee = creep.moveTo(targetDismantle.pos, {range:1,visualizePathStyle: {stroke: '#ffffff'}});
                    creep.say("go" + ee);
                    return;
                }
                else
                
                var err = creep.dismantle(targetDismantle);
                
                if(err!=0)
                {
                    creep.say("err" + range);
                }
                
            }
            else if(target) 
            {
                if(creep.pos.getRangeTo(target.pos) > 3)
                {
                    creep.moveTo(target.pos, {range:3,visualizePathStyle: {stroke: '#ffffff'}});
                    return;
                }
                
                var err = creep.build(target);
                
                if(err!=0)
                {
                    creep.say("err" + err);
                }
                
            }
            else 
            {
    	       /*
    	       
    	       const tgt = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: object => (object.structureType == STRUCTURE_WALL && object.hits < 5000) ||
                                      (object.structureType != STRUCTURE_WALL && object.hits < 0.8*object.hitsMax) 
                });
                
                //targets.sort((a,b) => a.hits - b.hits);
                
                if(tgt) {
                    creep.say("repair");
                    console.log("repair" + tgt.structureType);
                    if(creep.repair(tgt)== ERR_NOT_IN_RANGE) {
                        creep.moveTo(tgt ,{visualizePathStyle: {stroke: '#ffffff'}});
                    }
                }
                */
                
                if(creep.memory.toGo && creep.memory.toGo[0] == creep.room.name)
                {
                    creep.say("now upgrader");
                    creep.memory.role = "upgrader";
                }
                else if (!creep.memory.toGo)
                {
                    //creep.say("now build2");
                    //.memory.role = "upgrader";
                    
                    var spawn = creep.room.spawn;
                    if(spawn)
                    {
                        if(creep.pos.inRangeTo(spawn, 1))
                        {
                             var code = spawn.recycleCreep(creep);
                            creep.say(code);
                        }
                        else
                        {
                            creep.moveTo(creep.room.spawn);
                        }
                    }
                }
                else
                {
                    //creep.say("no build");
                    var spawn = creep.room.spawn;
                    if(spawn)
                    {
                        if(creep.pos.inRangeTo(spawn,1))
                        {
                            var code = spawn.recycleCreep(creep);
                            creep.say(code);
                        }
                        else
                        {
                            creep.moveTo(creep.room.spawn);
                        }
                    }
                    
                    return;
                }
                    
                console.log(creep.room, "nothing to build going to room below");
	            
	            return;
	        
            }
	    }
	    
	    else {
	        
                 var dropped = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
                    filter: (res) => { return res.resourceType == RESOURCE_ENERGY && res.amount > 50;}
                    });
                    
                if(dropped == undefined){
                    dropped = creep.pos.findClosestByRange(FIND_TOMBSTONES,{
                        filter: (res) => { return res.store[RESOURCE_ENERGY] > 0;}
                        });
                   
                }
                
                var rangeToDrop = creep.pos.getRangeTo(dropped);
                
                if(dropped && rangeToDrop < 6 ) {
                    //creep.say("see drop");
                    //console.log("yes drop"+ " "+ dropped.amount+ " "+ dropped.room.name+ " "+ dropped.pos.x+ " "+dropped.pos.y);
                    
                    var err = creep.pickup(dropped);
                    if(err == -7)
                        err = creep.withdraw(dropped, RESOURCE_ENERGY);
                        
                    if(err==OK){
                        creep.say("picked " + dropped.amount);
                    }
                    else if(err == ERR_NOT_IN_RANGE)
                    {
                        if(creep.fatigue == 0)
                        {
                       
                            var err1 = creep.moveTo(dropped, {visualizePathStyle: {stroke: '#ff0000'}});
                        }
                    }
                    else
                        creep.say("dropped"+err);
                }
                else{
                    var target;
                
                    if(target == undefined)
        	            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                            filter: (i) => (
                                !i.my && (i.energy > 0))
                        } );
                        
                        
                    const TERMINAL_WATERMARK = 10000;
        	        if(target == undefined)
                    {
                        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: o => ( (o.structureType == STRUCTURE_TERMINAL) && ( o.store[RESOURCE_ENERGY] > TERMINAL_WATERMARK+creep.carryCapacity))
                            });
                    }
            
            
                    if(target == undefined)
                    {
        	                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                            filter: (i) => ((i.structureType == STRUCTURE_STORAGE) && i.store[RESOURCE_ENERGY] > creep.carryCapacity)
                        });
        	        }
        	        
        	        
                    
                    if(target == undefined)
                    {
                        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                            filter: (i) => ((i.structureType == STRUCTURE_CONTAINER && i.store[RESOURCE_ENERGY] > creep.carryCapacity))
                        });
                        
                        if(target && creep.pos.getRangeTo(target.pos) > 15)
                            target = undefined;
        	        }
                     /*
                     if(target == undefined)
        	            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                            filter: (i) => ((i.structureType == STRUCTURE_TOWER) &&
                                       i.energy > 600)
                     });
    	            */
    	            
            
    	            if(target){
                        if(creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
                        }
                
	        }
	        else
	        {
	            if(creep.carry.energy < creep.carryCapacity) {
                var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                var code = creep.harvest(source);
                if(OK== code) 
                {
                    
                }
                else if(ERR_NOT_IN_RANGE == code) {
                    var code = creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                    if(OK!= code)
                    {creep.say(code);}
                }
                else
                {
                    creep.say(code);
                }
            }}
            
	        }
	    }
	}
};

module.exports = roleBuilder;