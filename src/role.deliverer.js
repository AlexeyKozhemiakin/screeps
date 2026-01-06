var basic = require("role.basic");

var linkLimitHigh = 600;
var linkLimitLow = 300;

var roleDeliverer = 
{
	runDeliver:function(creep)
	{
        /*if(creep.name == 'deliverer11352490')
            for(const resourceType in creep.carry) {
                creep.drop(resourceType);
            }*/
            
        var target = this.selectTarget(creep);
                    
        if(!target) 
        {
            creep.say("no target");
            return;
        }
        
        if(!creep.pos.isNearTo(target.pos))
        {
            creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}, range:1});
            return;
        }
        
        var amnt;
        
        if(target.structureType == STRUCTURE_LINK)
        {
           amnt = Math.min(linkLimitHigh-target.energy, creep.carry.energy);
           if(amnt <= 0)
           {
            creep.say('♻︎');
            return;
           }
        }
        
        //console.log("tr type ", resType);
        //var targetCanTake = tgt.
        var resType = this.carryResType(creep);
        
         // if transfered all allow go pickup immidiately
            
        var canAccept = this.capacityLeft(target, resType);
        var iHave = creep.carry[resType];
        var iHaveTotal = _.sum(creep.carry);
        
        var transferCode = creep.transfer(target, resType, amnt);
    
        if(OK == transferCode)
        {
            creep.memory.targetId = undefined;
            
            var transferAmount = Math.min(canAccept, iHave);
        
            if(transferAmount == iHave && transferAmount == iHaveTotal && amnt==transferAmount)
            {
                return true;
            }
            
            return false;
        }
        else if(ERR_NOT_ENOUGH_RESOURCES == transferCode)
        {
            creep.memory.task = "pickup";
            //creep.say("pickup");
        }
        else if(ERR_FULL == transferCode)
        {
            if(creep.memory.full)
                creep.memory.full++;
            else
                creep.memory.full = 1;
                
            creep.say("full");
            //creep.drop(RESOURCE_ENERGY);
        }
        else
        {
            creep.say("error"+ transferCode);
        }
	},
	
	capacityLeft:function(target, resType)
	{
	    if(resType == RESOURCE_ENERGY && target.energy != undefined)
	    {
	        return target.energyCapacity - target.energy;
	    }
	    
	    if(target.store != undefined)
	    {
	        return target.storeCapacity - _.sum(target.store);
	    }
	    
	    return 0;
	},
	
	carryResType : function(creep)
	{
	    var resType = RESOURCE_ENERGY;
        var key = _.findKey(creep.carry, f => f > 0);
        if(key)
            resType = key;
        else if(this.recentWithdrawResType)
            resType = this.recentWithdrawResType;
        return resType;
	},
	
	selectTarget : function(creep)
	{
	    if(creep.memory.targetId)
        {
            var tgt =  Game.getObjectById(creep.memory.targetId);
            if(tgt)
                return tgt;
                
            creep.memory.targetId = undefined;
        }
        
	    var target;
	    const TERMINAL_WATERMARK = 10000;
	    var resType = this.carryResType(creep);
	    
	    if(creep.memory.preferredTargetId)
	    {
            target = Game.getObjectById(creep.memory.preferredTargetId);
             
            if(target.store)
                if(target.store.energy == target.energyCapacity)
                    target = undefined;
        }
        
        if(resType == RESOURCE_ENERGY)
        {
            // todo remove copypaste
            // towers up to 40%
            if(target == undefined){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity*0.3;
                        }
                    });
            }
            
            //spawn
            if(target == undefined){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN)  && structure.isActive
                    && structure.energy < structure.energyCapacity;
                    }
                });
            }    
            
            //locallinks
            if(target == undefined){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_LINK)  && structure.isActive && structure.isNearBase
                     && structure.energy < linkLimitLow ;
                    }
                });
            }   
            
            /*//controller container
            if(target == undefined){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_CONTAINER)  
                     && structure.isNearBase //&&  //creep.room.controller.container //&& structure.id == creep.room.controller.container.id
                     && structure.store.energy < structure.storeCapacity-creep.carryCapacity ;
                    }
                });
            } */
            
            //controller container
            if(target == undefined){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_CONTAINER) &&  
                     creep.room.controller.container && 
                     structure.id == creep.room.controller.container.id && creep.room.level < 5
                     //&& structure.store.energy < structure.storeCapacity-creep.carryCapacity ;
                     && structure.store.energy < 0.5*structure.storeCapacity;
                    }
                });
            }
        
            // towers fully
            if(target == undefined){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_TOWER) && structure.energy <= structure.energyCapacity-100;
                        }
                    });
            }
            
            // labs 
            if(target == undefined){
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity-creep.carryCapacity && structure.isBoosting;
                        }
                    });
            }
            
             // terminals
            if(target == undefined)
            {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return structure.structureType == STRUCTURE_TERMINAL && structure.isActive && structure.store.energy < TERMINAL_WATERMARK-creep.carryCapacity;
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
        }
        else
        {
            
            if(target == undefined)
            {
                 target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (lab) => {
                        return ((lab.structureType == STRUCTURE_LAB) && lab.isActive
                        && lab.mineralAmount < lab.mineralCapacity-creep.carryCapacity && lab.mineralDemand == resType && (lab.mineralType == undefined || lab.mineralType==resType));
                    }
                });
            }
            
            if(target == undefined)
            {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return ((s.structureType == STRUCTURE_TERMINAL) && s.isActive
                        && _.sum(s.store) < s.storeCapacity * 0.98);
                    }
                });
            }
            
            
            if(target == undefined)
            {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return ((structure.structureType == STRUCTURE_STORAGE) && structure.isActive
                        && _.sum(structure.store) < structure.storeCapacity);
                    }
                });
            }
        }
        
        return target;
	},
	
	runPickup : function(creep)
	{
        var source;
        const TERMINAL_WATERMARK = 10000;
        // limiting?
        if(creep.memory.preferredSourceId)
        {
            source =  Game.getObjectById(creep.memory.preferredSourceId);
        }
       
        var resType = RESOURCE_ENERGY;
        if(creep.memory.preferredResourceType)
        {
            resType = creep.memory.preferredResourceType;
        }
        else
        {
            if(source){
                var keys = _.findKey(source.store, f => f > 0);
                if(keys)
                    resType = keys;
            }
        }
        
        //console.log("withdraw type ", resType);
        if(source == undefined)
        {
            sources = creep.pos.findInRange(FIND_STRUCTURES, 4, {
                filter: o => (o.structureType == STRUCTURE_CONTAINER)
                    && o.store[resType] > creep.carryCapacity && 
                    
                    !o.isNearBase && o != creep.room.controller.container
                });
            
            if(sources.length > 0)
                source = sources[0];
        }
        
         if(source == undefined)
        {
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_CONTAINER)
                    && o.store[resType] > creep.carryCapacity && 
                    o == creep.room.controller.container && o.store[resType] > 0.5*o.storeCapacity // special case for containers near source & controller, need to frmulate better
                });
        }
        
        //locallinks
        if(source == undefined){
            source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_LINK)  && structure.isActive && structure.isNearBase
                 && structure.energy > linkLimitHigh ;
                }
            });
        }
        
        
        if(source == undefined)
        {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_CONTAINER)
                    && o.store[resType] > 2*creep.carryCapacity && o.isNearBase && o != creep.room.controller.container
                   //  && o.store[resType] > 3*creep.carryCapacity && o != creep.room.controller.container
                });
        } 
        if(source == undefined)
        {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_CONTAINER)
                    && o.store[resType] > creep.carryCapacity && !o.isNearBase && o != creep.room.controller.container
                   //  && o.store[resType] > 2*creep.carryCapacity && o != creep.room.controller.container
                });
        } 
        
        
        
        
        
        if(source == undefined)
        {
             
            var target = this.selectTarget(creep);
            if(target && target.structureType == STRUCTURE_STORAGE)
            {
                var labs = creep.room.find(FIND_STRUCTURES, {
                    filter: (lab) => {
                        return ((lab.structureType == STRUCTURE_LAB) && lab.isActive
                        && lab.mineralAmount < lab.mineralCapacity-creep.carryCapacity && lab.mineralDemand);
                        }
                     });
                     
                //console.log("--",labs);
                labs = _.sortBy(labs, ['mineralAmount'],['asc']);
                //console.log(labs);
                var lab = labs[0];
                
                if(lab && lab.mineralDemand)
                {
                    resType = lab.mineralDemand;
                    source = creep.pos.findClosestByPath(FIND_STRUCTURES,
                    {
                        filter: o => (o.structureType == STRUCTURE_TERMINAL || o.structureType == STRUCTURE_STORAGE)  && o.store[resType] > 0
                    });
                    
                   
                }
            }
            
        }
        
        
        
        if(source == undefined)
        {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_LAB)
                && o.mineralAmount >= creep.carryCapacity && !o.mineralDemand
                });
                
            if(source)
            {
                resType = source.mineralType;
            }
        }
        
        if(source == undefined)
        {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_LAB)
                && o.mineralAmount >= creep.carryCapacity && o.mineralDemand != o.mineralType
                });
                
            if(source)
            {
                resType = source.mineralType;
            }
        }
        
        if(source == undefined)
        {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_STORAGE)
                && o.store[resType] >= creep.carryCapacity
                });
        }
        
        if(source == undefined)
        {
            source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: o => (o.structureType == STRUCTURE_CONTAINER)
                   // && o.store[resType] > 3*creep.carryCapacity && o.isNearBase && o != creep.room.controller.container
                     && o.store[resType] > 50 && o != creep.room.controller.container
                });
        }
        
        //if(source == creep.room.controller.container)
        //   source = undefined;
    
        if(!source)
        {
            creep.say("no source");
            return false;
        }
        var amnt;
        
        if(source.structureType == STRUCTURE_LINK)
        {
           amnt = Math.min(source.energy-linkLimitLow, creep.carryCapacity-creep.carry.energy);
        }
        
        if(!creep.pos.isNearTo(source))
        {
            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}, range:1});
            return;
        }
        
        /*if(_.sum(source.store) == 0)
        {
            creep.say("wait");
            return;
        }*/ // need to check energy field as well
        var code = creep.withdraw(source, resType, amnt);

        if(OK == code) 
        {
            creep.memory.task == "deliver";
            this.recentWithdrawResType = resType;
            
            return true;
        }
        
        else
        {
            console.log("w, ", resType, " ", code, source, creep.room.name);
            creep.say("w" + code);
        }
       
       return false;
	},
	
	/** @param {Creep} creep **/
    run: function(creep) 
    {
	    if(creep.memory.task == undefined)
	    {
	        creep.memory.task = "pickup";
	    }
	    
        if(creep.memory.task == "deliver")
        {
            var res = this.runDeliver(creep);
            
            if(res || _.sum(creep.carry) == 0)
            {
                creep.memory.task = "pickup";
                this.runPickup(creep);
                return;
            } 
        }
        
	    if(creep.memory.task == "pickup")
	    {
    	    if(_.sum(creep.carry) == creep.carryCapacity)
            {
                creep.memory.task = "deliver";
    	        this.runDeliver(creep);
    	        
                return;
            } 
        
            // and there is no other - then take advantage
    	    if(!creep.memory.preferredSourceId)
    	        if(basic.runDropped(creep, 10, undefined, 100))
    	            return;
    	   
    	    //otherwise run normal
    	    if(this.runPickup(creep))
    	    {
    	        // fast
    	        creep.memory.task = "deliver";
    	        this.runDeliver(creep);
    	        return;
    	    }
        }
	}
};

module.exports = roleDeliverer;
