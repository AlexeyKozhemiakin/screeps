var basic = require("role.basic");
var roleScout = {

    /** @param {Creep} creep **/
    run: function(creep) 
    {
       if(!basic.moveToRoom(creep))
            return;
        
        
        
        var target = creep.room.controller;
        
        if(target)
        {    
            //console.log(controller);
            var err;
            
            //if(target.owner)
            //    err = creep.attackController(target);
            //else
            //    err = creep.claimController(target) ;
            
            
            var err = creep.signController(target, "Zenga is here");
            
    	    if(err == ERR_NOT_IN_RANGE)
    	    {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
            }
            else
            {
                console.log("sign error " + err);
            }
        }
        else
        {
            console.log("controller not visible yet");
            creep.signController(creep.room.controller, "Zenga is here - Spawn More Overlords");
            //creep.moveTo(new RoomPosition(10, 10, "W59S36"),{visualizePathStyle: {stroke: '#ff00f0'}})
            // should not happen;   
        }
    }
}
    
module.exports = roleScout;