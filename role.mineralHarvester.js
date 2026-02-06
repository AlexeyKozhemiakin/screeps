 /** @param {Creep} creep **/

var roleMineralHarvester = {

    needHarvester : function(room)
    {
        if(!room.extractor)
        {
            return false;
        }
        
        var minerals = room.lookForAt(LOOK_MINERALS, room.extractor.pos);
        if(!minerals)
        {
            return false;
        }
        
        var mineral = minerals[0];
        
        if(mineral.mineralAmount > 0 && room.extractor.container)
        {
            return true;
        }
            
        return false;
    },
    
    findSource : function(creep)
    {
        //console.log(extractor.pos);
        if(!creep.room.extractor)
            return undefined;
            
        var minerals = creep.room.lookForAt(LOOK_MINERALS, creep.room.extractor.pos);
        
        if(minerals == undefined)
        {
            return undefined;
        }
        
        var mineral = minerals[0];
        
        if(mineral && mineral.mineralAmount > 0)
        {
            creep.memory.mineral = mineral.mineralType;
            return mineral;
        }
        
        return undefined;
        
    },
    
    /** @param {Creep} creep **/
    run : function(creep) {
	    if(creep.memory.task == undefined)
	    {
	        creep.memory.task = "harvest";
	        
	    }
	    
	    if(creep.memory.task == "harvest")
	    {
    	    var source = roleMineralHarvester.findSource(creep);
    	    if(source == undefined)
    	    {
     	        basic.recycleCreep(creep);
                return;   
    	    }
    	    else{
        	    if(_.sum(creep.store) < creep.store.getCapacity()) {
                    if(source.mineralAmount == 0)
                    {
                        basic.recycleCreep(creep);
                        return;
                    }
                    var extractor = creep.room.lookForAt(LOOK_STRUCTURES, source.pos)[0];
                    if(!creep.pos.isNearTo(source.pos))
                    {
                        if(creep.fatigue == 0)
                        {
                            var code2 = creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                            if(OK != code2)
                            {
                                creep.say("move  " + code2);
                                
                            }
                        }
                    }
                    else if(extractor.cooldown==0)
                    {
                        var code = creep.harvest(source);
                        if(OK != code) 
                        {
                            creep.say("harvest"+code);
                        }
                    }
                    else{
                        //sleep
                    }
                }
                else
                {
                    creep.memory.task = "deliver";
                    creep.say("done charging");
                }
    	    }
        }
        
        if(creep.memory.task == "deliver")
        {
            var source = roleMineralHarvester.findSource(creep);
            var target;
            
            if(!target)
            {
                target = creep.room.extractor.container;
            }
            
            if(!target)
            { 
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_STORAGE)
                        && structure.isActive
                        &&  _.sum(structure.store) < structure.storeCapacity;
                    }
                });
            
            }
            
            if(target) {
                
                if(!target.pos.isNearTo(creep.pos))
                {
                    var err = creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                    
                    if(err != OK)
                        creep.say(err);
                } 
                else{
                    var transferCode = creep.transfer(target, creep.memory.mineral);
                    
                    if(OK == transferCode)
                    {
                        
                    }
                    else if(ERR_NOT_ENOUGH_RESOURCES == transferCode)
                    {
                        creep.memory.task = "harvest";
                        creep.say("harvest");
                    }
                    else
                    {
                        creep.say("error " + transferCode);
                    }
                }
                
                if(_.sum(creep.energy) == 0)
        	    {
        	        creep.memory.task = "harvest";;
        	    }
                    
                
            }
            else{
                creep.say("no where to put");
            }
        }
	}
};

module.exports = roleMineralHarvester;
