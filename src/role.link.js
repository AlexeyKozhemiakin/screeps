var linkMod = {
    runInternal: function(fromLink, toLink, limit)
    {
        if(fromLink == null)
            return;  
            
        if(toLink == null)
            return;
            
        if(toLink.energy > limit)
            return;
            
        if(fromLink.energy > 0.1 * fromLink.energyCapacity)
        {
            if(fromLink.cooldown > 0)
                return;
                
            // TODO send only 100 to avoid round eror
            var amount = Math.min(fromLink.energy, limit-toLink.energy);
            
            amount = amount - amount % 100;
            
            if(amount <= 0)
                return;
                
            var code = fromLink.transferEnergy(toLink, amount);
            if(OK != code && ERR_TIRED!=code)
                console.log('TransferCode = ' + code);
        }
    },
    
    runManual : function()
    {
    },
    
    run : function(room)
    {
        if(!room.controller)
            return;
            
        var controllerLink = room.controller.link;
       
        if(!controllerLink){
            this.tryNearBase(room);
            return;
        }
        
        for(var linkName in room.links)
        {
            var link = room.links[linkName];
            if(link == controllerLink)
                continue;
            
            var limit = 800;
            
            if(link.isNearBase)
                limit = 600;
                
            //console.log(room, link, " ", limit, " ", isNearShore, " ", inRange); 
            
            this.runInternal(link, controllerLink, limit);
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
            
            var limit = 800;
            
            
            this.runInternal(link, baseLink, limit);
        }
       
    }
    
}
module.exports = linkMod;