var basic = require("role.basic");
var roleClaim = {

    /** @param {Creep} creep **/
    run: function(creep) 
    {
       if(!basic.moveToRoom(creep))
            return;
        
        /*
        var needClaim = function (roomName) 
        {
            var room = Game.rooms[roomName];
            if(room)
                return !Game.rooms[roomName].controller.my;
            
            return true;
        }
        
        var targetRoom =_.filter(creep.memory.toClaim, needClaim)[0];
        */
        
        var target = creep.room.controller;
        
        if(target)
        {    
            //console.log(controller);
            
            var err = creep.claimController(target) ;
            
            if(OK == err)
            {
                creep.signController(target, "Zenga is here");
            }
    	    else if(err == ERR_NOT_IN_RANGE)
    	    {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
            }
            else
            {
                console.log("claim" + err);
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
    
module.exports = roleClaim;