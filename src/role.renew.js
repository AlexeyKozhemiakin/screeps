var roleRenew = {
    /** @param {Creep} creep **/
    needRenew: function(creep) {
        //creep.memory.task = undefined;
        
        if(creep.ticksToLive < CREEP_LIFE_TIME * 0.05 || creep.memory.task == "renew")
            return true;
        else
            return false;
    },
    
    /** @param {Creep} creep **/
    run: function(creep) {
	    
	    if(creep.ticksToLive > CREEP_LIFE_TIME * 0.99)
	    {
	        creep.memory.task = undefined;
	        creep.say("renewed");
	        return;
	    }
	    else if (creep.memory.task != "renew")
	    {
	        creep.say("need renew");
	        creep.memory.task = "renew";
	    }
	    
        var spawn = Game.spawns['ZengaVille'];
        
        var code = spawn.renewCreep(creep);
        if(code == ERR_NOT_IN_RANGE)
        {
            creep.moveTo(spawn, {visualizePathStyle: {stroke: '#00ff00'}});
        }
	}
};

module.exports = roleRenew;
