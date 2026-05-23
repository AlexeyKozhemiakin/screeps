var linkMod = {
    CONTROLLER_LINK_ENERGY_LIMIT: 650,
    BASE_LINK_ENERGY_LIMIT: 790,

    runInternal: function (fromLink, toLink, limit) {
        if (fromLink == null || toLink == null)
            return false;

        if (toLink.energy > limit)
            return false;

        if (fromLink.energy < 0.1 * fromLink.energyCapacity)
            return false;

        if (fromLink.cooldown > 0)
            return false;

        // TODO send only 100 to avoid round eror
        var amount = Math.min(fromLink.energy, limit - toLink.energy);

        if (amount <= 50)
            return false;



        //console.log("Link transfer from ", fromLink, " to ", toLink, " amount ", amount);
        var code = fromLink.transferEnergy(toLink, amount);
        if (OK != code)
            console.log('Link Transfer Error = ', code);

        return OK == code;
    },

    runManual: function () {
    },

    run: function (room) {
        if (!room.controller)
            return;

        if (!room.controller.my)
            return;

        if(!room.spawn)
            return;



        var baseLink = room.spawn.link;
        var controllerLink = room.controller.link;

        // send to controller as 1st priority, 
        // base link sends only when controller link is low
        if (controllerLink)
            for (var linkName in room.links) {
                var link = room.links[linkName];
                if (link == controllerLink)
                    continue;

                if (link == baseLink)
                    continue;
                var limit = this.CONTROLLER_LINK_ENERGY_LIMIT;
                
                
                // urgent push
                if (link.energy > 700)
                    limit = 800;

                if (controllerLink.energy < 500)
                    if (this.runInternal(link, controllerLink, limit))
                        return;
            }

        if (baseLink && controllerLink){
            if (controllerLink.energy < 100)
                if (this.runInternal(baseLink, controllerLink, this.CONTROLLER_LINK_ENERGY_LIMIT))
                    return;

            if (controllerLink.energy > 700)
                if (this.runInternal(controllerLink, baseLink, this.BASE_LINK_ENERGY_LIMIT))
                    return;
        }

        // send to base as 2nd priority when it's alrady > 500
        if (baseLink)
            for (var linkName in room.links) {
                var link = room.links[linkName];
                if (link == controllerLink)
                    continue;

                if (link == baseLink)
                    continue;


                if (link.energy > 500)
                    if (this.runInternal(link, baseLink, this.BASE_LINK_ENERGY_LIMIT))
                        return;

            }

    }



}
module.exports = linkMod;