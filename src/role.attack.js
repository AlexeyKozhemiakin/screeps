var basic = require("role.basic");

var roleAttack = {

    /** @param {Creep} creep **/
    run: function(creep) {

	    if(creep.memory.attacking && creep.carry.energy == 0) {
            creep.memory.attacking = false;
            creep.say('🔄 harvest');
	    }
	    if(!creep.memory.attacking && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.attacking = true;
	        creep.say('🚧 attack');
	    }
	    
	    if(!basic.moveToRoom(creep))
	        return;

	    if(creep.memory.attacking) 
	    {
	        var target = undefined;
            
            if(target == undefined)
            {
                target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
            }
            
            if(target == undefined)
            {
                target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                    filter: object => (
                    object.structureType == STRUCTURE_LINK ||
                    object.structureType == STRUCTURE_TOWER || 
                    object.structureType == STRUCTURE_SPAWN ||
                    object.structureType == STRUCTURE_EXTENSION) 
                });
            }
            
            if(!target) 
                return;
           
            //console.log("this room");
            var err = creep.attack(target);
            
            if(err == ERR_NOT_IN_RANGE ) {
                creep.moveTo(target.pos, {visualizePathStyle: {stroke: '#ff0000'}});
            }
            else if(err!=0)
            {
                creep.say("cant attack" + err);
            }
	    }
	}
};

module.exports = roleAttack;