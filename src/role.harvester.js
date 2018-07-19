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
                else if(source.isNearBase && nearbyDeliverers.length > 0)
                {
                    target = source.container;
                    if(creep.name == 'harvester9268535')
                        console.log("!!!!!!!!!!!yes container'", nearbyDeliverers, source.isNearBase);
                }
                else if(source.container.isOperating())
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
        
        return target;
    }
    ,
    
    runDeliver:function(creep, canMove)
    {
        var target = this.selectTarget(creep);
        
        if(target == undefined)
        {
            creep.say("no target");
            return;
        }
       
        var transferCode = creep.transfer(target, RESOURCE_ENERGY);
        
        if(OK == transferCode)
        {
            creep.memory.task = "harvest";
        }
        else if(ERR_NOT_IN_RANGE == transferCode)
        {
            if(canMove)
            {
                var err = creep.moveTo(target, {visualizePathStyle: {range:1,stroke: '#ffffff'}});
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
        
        if(basic.runDropped(creep, 1, RESOURCE_ENERGY))
            return;
        
        
        var source = roleHarvester.findSource(creep);
        
        var code = creep.harvest(source);
        if(OK == code) 
        {
            
        }
        else if(ERR_NOT_IN_RANGE == code) {
            var code = creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            if(OK!= code && code!=ERR_TIRED)
            {creep.say("oo2"+code);}
        }
        else
        {
            creep.say("no"+code);
            basic.repairEmergency(creep, 0.6);
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
    	    basic.repairEmergency(creep);
    	    this.runHarvest(creep);
    	    
    	    if(_.sum(creep.carry) >= creep.carryCapacity*0.8)
    	    {
    	        this.runDeliver(creep, false);
    	        basic.repairEmergency(creep);
    	    }
        }
        
        if(_.sum(creep.carry) == creep.carryCapacity)
	    {
	        creep.memory.task = "deliver";
	    }

	}
};

module.exports = roleHarvester;
