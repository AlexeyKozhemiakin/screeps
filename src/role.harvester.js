var basic = require("role.basic");

var roleHarvester = {
 
    findSource : function(creep)
    {
        if(creep.memory.preferredSourceId)
        {
            return Game.getObjectById(creep.memory.preferredSourceId);
        }
        else 
        {
            return creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        }
    },
    
    selectTarget : function(creep)
    {
        var target;
            
        if(creep.memory.preferredTargetId)
        {
            target = Game.getObjectById(creep.memory.preferredTargetId);
        }
        
        if(creep.memory.preferredSourceId)
        {
            var source = Game.getObjectById(creep.memory.preferredSourceId);
            
            var nearbyDeliverers = creep.room.find(FIND_MY_CREEPS, {filter: c=>c.memory.role == "deliverer" && c.room.name == creep.room.name && c.memory.preferredSourceId == undefined});
            
            if(source.container)
            {
                if(creep.name == 'harvester9268535')
                    console.log("!!!!!!!!!!!yes container'", nearbyDeliverers, source.isNearBase);
                if(source.container.store.energy == source.container.storeCapacity)
                {
                    //
                }
                else if(nearbyDeliverers.length > 0)
                {
                    target = source.container;
                }
                else if(source.container.isOperating())
                {
                    target = source.container;
                } 
                else if(creep.room.energyAvailable == creep.room.energyCapacityAvailable)
                {
                    target = source.container;
                }
            }
            
            if(target == undefined && source.link && source.link.energy != source.link.energyCapacity)
            {
                target = source.link; 
               //console.log("got link");
            }
            
            //console.log("locked on " , target);
        }
        
        //spawn
        if(target == undefined){
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN)  && structure.isActive
                && structure.energy < structure.energyCapacity && creep.room.energyAvailable <= 800;
                }
            });
        }  
            
        // towers up to 40%
        if(target == undefined){
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity*0.4;
                    }
                });
        }
        
        // spawning
        if(target == undefined){
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN)  && structure.isActive
                && structure.energy < structure.energyCapacity;
                }
            });
        }    
    
        // towers fully
        if(target == undefined){
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity*0.9;
                    }
                });
        }
        
       
        
        if(target == undefined)
        {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return ((structure.structureType == STRUCTURE_STORAGE) && structure.isActive
                    && structure.store[RESOURCE_ENERGY] < structure.storeCapacity);
                }
            });
        }
        
        if(target == undefined)
        {
            target = creep.room.find(FIND_MY_CREEPS, {filter: c=>c.memory.role == "builder" && c.room.name == creep.room.name})[0];
        }
        
        if(target == undefined)
        {
            target = creep.room.find(FIND_MY_CREEPS, {filter: c=>c.memory.role == "upgrader" && c.room.name == creep.room.name && c.carry[RESOURCE_ENERGY] < 20})[0];
        }
        
        return target;
    }
    ,
    
    runDeliver:function(creep, canMove)
    {
        var target = this.selectTarget(creep);
        
        if(target == undefined)
        {
            
            creep.say("h: no trgt");
            return;
        }
        
        var transferCode = creep.transfer(target, RESOURCE_ENERGY);
        
        if(OK == transferCode )
        {
            creep.memory.task = "harvest";
        }
        else if(ERR_NOT_IN_RANGE == transferCode)
        {
            if(canMove)
            {
                var err = creep.moveTo(target, {visualizePathStyle: {ignoreCreeps:true, range:1,stroke: '#ffffff'}});
                if(err != OK && err != ERR_TIRED)
                    creep.say(err);
            }
        } 
        else if(ERR_NOT_ENOUGH_RESOURCES == transferCode)
        {
            creep.memory.task = "harvest";
            creep.say("harvest2");
        }
        else
        {
            creep.say("error " + transferCode, target);
            console.log(creep.name, target);
        }
        
    },
    
    runHarvest:function(creep)
    {
        if(_.sum(creep.carry) == creep.carryCapacity) {
            creep.memory.task = "deliver"; 
            return;
        }
        
        ///if(basic.runDropped(creep, 1, RESOURCE_ENERGY))
       //     return;
        
        
        var source = roleHarvester.findSource(creep);
        
        //console.log("harvester", creep.name, " source ", source);

        if(!source)
        {
            creep.say("no source");
            return;
        }
        
        if(!creep.pos.isNearTo(source.pos))
        {
            console.log("harvester", creep.name, " moving to ", source);
            if(creep.fatigue == 0)
            {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffffff'},  ignoreCreeps:false});
            }
            return;
        }
        
        if(source.energy == 0 && source.ticksToRegeneration > 0)
        {
            creep.say("⏱️ " + source.ticksToRegeneration);
            return;
        }
        
        var code = creep.harvest(source);
        if(OK == code) 
        {
            
        }
        else
        {
            creep.say("no "+code);
            //basic.repairEmergency(creep, 0.8);
        }
    },
    
    /** @param {Creep} creep **/
    run : function(creep)
    {
	    if(creep.memory.task == undefined)
	    {
	        creep.memory.task = "harvest";
	    }
	    
	    if(creep.memory.task == "deliver")
        {
            this.runDeliver(creep, true);
            
            if(_.sum(creep.carry) == 0)
    	    {
    	        creep.memory.task = "harvest";
    	    }
        }
        
	    if(creep.memory.task == "harvest")
	    {
    	    //basic.repairEmergency(creep);
    	    this.runHarvest(creep);
    	    
    	    if(_.sum(creep.carry) >= creep.carryCapacity*0.8) //TODO:replace to actual carry capacity and perf during tick see upgrader
    	    {
    	        basic.repairEmergency(creep);
    	        this.runDeliver(creep, false);
    	        
    	    }
        }
        
        if(_.sum(creep.carry) == creep.carryCapacity)
	    {
	        creep.memory.task = "deliver";
	    }

	}
};

module.exports = roleHarvester;
