var basic = require('role.basic');
StructureContainer.prototype.isOperating = function()
    { 
        var dels = _.filter(Game.creeps,  d => d.memory.role == "deliverer" && d.memory.preferredTargetId == this.id); 
        var dels2 = _.filter(Game.creeps,  d => d.memory.role == "deliverer" && d.memory.preferredSourceId == this.id); 
        
        return dels.length > 0 || dels2.length > 0;
    };
    
    StructureLink.prototype.isOperating = function()
    { 
        return true;
    };
    
    StructureStorage.prototype.isOperating = function()
    { 
        return true;
    };
    
    Source.prototype.isOperating = function()
    { 
        var dels = _.filter(Game.creeps,  d => d.memory.role == "harvester" && d.memory.preferredSourceId == this.id); 
        
        return dels.length > 0;
    };
    
    Source.prototype.budget = function()
    { 
        var array = this.room.lookForAtArea(LOOK_TERRAIN, this.pos.y - 1, this.pos.x -1, this.pos.y + 1, this.pos.x + 1, true);
        
        var len = _.filter(array, p => p.terrain != 'wall').length;
        
       return len;
    };
    
    var roleUpgrader = 
    {
        
    runUpgrade:function(creep)
    {
        if(creep.pos.getRangeTo(creep.room.controller.pos) > 3)
        {
            creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}}, {range:4});
        }
        else
        {
            //console.log(creep.room.memory.iterator);
            var parts = creep.getActiveBodyparts(WORK);
            if(creep.room.controller.level == 8 && creep.room.memory.iterator >= CONTROLLER_MAX_UPGRADE_PER_TICK)
            {
                creep.say("throttled");
            }
            else{
                var code = creep.upgradeController(creep.room.controller);
                creep.room.memory.iterator += parts * UPGRADE_CONTROLLER_POWER;
                
                if(code == OK)
                {
                    
                }
                else if(code == ERR_NOT_IN_RANGE)
                {
                    
                }
            }
        }
    },
    
    runPickup:function(creep)
    {
        if(basic.runDropped(creep, 3, RESOURCE_ENERGY, 50))
    	    return;
    	    
        var source;
        
        // nearby up containers
        if(source == undefined)
        {
            var nearby = creep.room.controller.pos.findInRange(FIND_STRUCTURES, 4, 
                    {
                        filter: (s) => 
                            {
                                return (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_LINK )
                            }
                    }
                );
                
             if(nearby.length == 0)  
             {
                 nearby = creep.room.controller.pos.findInRange(FIND_STRUCTURES, 4, 
                    {
                        filter: (s) => 
                            {
                                return ( s.structureType == STRUCTURE_STORAGE )
                            }
                    }
                );
                
             }
             
            if(nearby.length > 0)
            {
                source = nearby[0];
                if(!source.isOperating())
                {
                    source = undefined;
                }
            }
        }
        
        if(source == undefined)
        {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return ((structure.structureType == STRUCTURE_CONTAINER || structure.structureType == STRUCTURE_STORAGE ) && structure.isActive
                    && structure.store[RESOURCE_ENERGY] >0);
                }
            });
        }
        
        if(source == undefined)
        {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return ((structure.structureType == STRUCTURE_STORAGE) && structure.isActive
                    && structure.store[RESOURCE_ENERGY] >0);
                }
            });
        }
        
        if(source == undefined)
        {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (i) => ((i.structureType == STRUCTURE_TOWER) &&
                           i.energy > 800)
            });
        }
        
        if(source != undefined)
        {
            //console.log("try withdraw", source);
            var err = creep.withdraw(source, RESOURCE_ENERGY);
            if(err == ERR_NOT_IN_RANGE) 
            {
                var err2 = creep.moveTo(source, {visualizePathStyle: {stroke: '#0000ff'}});
                //creep.say(err2);
            }
            else if(OK!=err)
            {
                creep.say(err);
            }
        }
        else
        {
            source = creep.pos.findClosestByRange(FIND_SOURCES, {
                filter: function(s) {
                   console.log("----", s, " ", s.budget(), " ", s.isOperating());
                    if(s.budget() == 1 && s.isOperating())
                    {
                        return false;
                    }
                    return true;
                    }
            });              
            
        
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) 
            {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            
        }
        
    },
    
    run: function(creep)
    {
        if(creep.memory.upgrading && creep.carry.energy == 0) {
            creep.memory.upgrading = false;
            //creep.say('🔄');
	    }
	    if(!creep.memory.upgrading && _.sum(creep.carry) == creep.carryCapacity) {
	        creep.memory.upgrading = true;
	        //creep.say('⚡ ';
	    }
	    
        if(creep.memory.upgrading)
	    {
            basic.repairEmergency(creep);
            this.runUpgrade(creep);
           
           if(_.sum(creep.carry) <= 2*creep.getActiveBodyparts(WORK)*UPGRADE_CONTROLLER_POWER)
           {
               //creep.say("easy");
               this.runPickup(creep);
           }
	    }
        else
        {
          this.runPickup(creep);
        }
    }
};

module.exports = roleUpgrader;