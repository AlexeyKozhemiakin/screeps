var linkMod = {
    runInternal: function(fromLink, toLink, limit)
    {
        if(fromLink == null || toLink == null)
            return;
            
        if(toLink.energy > limit)
            return;
            
        if(fromLink.energy < 0.1 * fromLink.energyCapacity)
            return;

        if(fromLink.cooldown > 0)
            return;
                
        // TODO send only 100 to avoid round eror
        var amount = Math.min(fromLink.energy, limit-toLink.energy);
        
        //samount = amount - amount % 20;
        
        if(amount <= 50)
            return;
            
        var code = fromLink.transferEnergy(toLink, amount);
        if(OK != code)
            console.log('Link Transfer Error = ', code);        
    },
    
    runManual : function()
    {
    },
    
    run : function(room)
    {
        if(!room.controller)
            return;
        
        if(!room.controller.my)
            return;

        var controllerLink = room.controller.link;
       
        if(!controllerLink){
            this.tryNearBase(room);
            return;
        }
        
        // TODO send not to controller but to base link as well
        for(var linkName in room.links)
        {
            var link = room.links[linkName];
            if(link == controllerLink)
                continue;
            
            var limit = LINK_CAPACITY;
            
            // TODO why?
            //if(link.isNearBase)
            //    limit = LINK_CAPACITY*0.75;
                
            //console.log(room, link, " ", limit, " ", isNearShore, " ", inRange); 
            
            this.runInternal(link, controllerLink, 750);
        }

        if(controllerLink.energy > 500)
        {
            this.tryNearBase(room);
        }
    }
    ,
    tryNearBase : function(room)
    {
        if(!room.storage)
            return;
        
        var baseLink = room.storage.link;
        var controllerLink = room.controller.link;
        
        for(var linkName in room.links)
        {
            var link = room.links[linkName];
            if(link == controllerLink)
                continue;
            if(link == baseLink)
                continue;
            
            var limit = LINK_CAPACITY;
            
            this.runInternal(link, baseLink, limit);
        }
       
    }
    
}
module.exports = linkMod;