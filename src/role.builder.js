var basic = require("role.basic");

var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep)
    {
        if(!basic.moveToRoom(creep))
        {
            return;
        }
	    
	    if(!creep.memory.task)
	        creep.memory.task = "harvest";
	        
	    if(creep.carry.energy == creep.carryCapacity)
	        creep.memory.task = "build";
	        
	    if(creep.carry.energy == 0)
            creep.memory.task = "harvest";
    	    
	    if(creep.memory.task == "harvest") {
            
            this.runHarvest(creep);
            //creep.say('🔄 harvest');
            return;
	    }
	    
	    if(creep.memory.task == "build") {
            
            this.runBuild(creep);
	        //creep.say('🚧 build');
	        return;
	    } 	    
    }
    ,
    runHarvest:function(creep)
    {
        if(basic.runDropped(creep, 3, RESOURCE_ENERGY, 19))
            return;

        var target;
            
            
        const TERMINAL_WATERMARK = 10000;
        if(target == undefined)
        {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
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
            
            if(target && creep.pos.getRangeTo(target.pos) > 18)
                target = undefined;
        }
       
        if(target)
        {
            if(!creep.pos.isNearTo(target.pos))
            {
                var err = creep.moveTo(target.pos, {visualizePathStyle: {stroke: '#ffffff'}});
                if(err!=OK)
                    creep.say(err);
                return;
            }
 
            var err = creep.withdraw(target, RESOURCE_ENERGY);
            if(err != OK)
                target = undefined;
        }
        else
        {
            var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            var code = creep.harvest(source);
            if(OK == code) 
            {
                
            }
            else if(ERR_NOT_IN_RANGE == code)
            {
                var code = creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                //creep.say(code);
            }
            else
            {
                creep.say(code);
            }
       }   
    }
    ,
    runFunc : function(creep, func)
    {
        
        return;
    },
    runBuild:function(creep)
    {
        var target = this.selectTarget(creep);
           
        if(!target) 
        {
            this.noBuild(creep);
            return;
        }
        
        creep.memory.targetId = target.id;

        if(creep.pos.getRangeTo(target.pos) > 3)
        {
            if(creep.fatigue == 0)
                creep.moveTo(target.pos, {range:3,visualizePathStyle: {stroke: '#ffffff'}});
            return;
        }
        
        var err = creep.build(target);
        
        if(err != OK)
        {
            creep.say("build" + err);
            creep.memory.targetId = undefined;
        }   
    }            
    ,
    selectTarget:function(creep)
    {
        if(creep.memory.targetId)
        {
            var tgt = Game.getObjectById(creep.memory.targetId);
            if(tgt)
                return tgt;
                
            creep.memory.targetId = undefined;
        }
        
        var target;
        var flag = creep.pos.findClosestByRange(FIND_FLAGS, {
                filter: flag => (flag.color == COLOR_RED && flag.secondaryColor == COLOR_RED)
            });

        if(flag)
        {
            target = flag.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {ignoreCreeps:true});
            
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

        return target;
        /*var targetDismantle;
        
        
        var flagDismantle = creep.pos.findClosestByRange(FIND_FLAGS, {
                filter: flag => (flag.color == COLOR_RED && flag.secondaryColor == COLOR_BROWN)
            });
        
        if(flagDismantle)
        {
            targetDismantle = flagDismantle.pos.findClosestByPath(FIND_STRUCTURES, {ignoreCreeps:true, range:3});
            
            if(targetDismantle != null)
                console.log("removing bad object " + targetDismantle.id);
                
            
        }       
        
        */           
    }
    ,
    noBuild:function(creep)
    {
         if(creep.memory.toGo && creep.memory.toGo[0] == creep.room.name)
        {
            creep.say("now upgrader");
            creep.memory.role = "upgrader";
        }
        else if (!creep.memory.toGo)
        {
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
};

module.exports = roleBuilder;