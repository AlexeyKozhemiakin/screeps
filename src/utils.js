var roleHarvester = require('role.harvester');
var roleMineralHarvester = require('role.mineralHarvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleDeliverer = require('role.deliverer');
var roleRenew = require('role.renew');
var roleClaim = require('role.claim');
var roleAttack = require('role.attack');
var roleReserve = require('role.reserve');

Object.defineProperty(Room.prototype, 'extractor', {
  get: function() 
 {
     return  this.find(FIND_STRUCTURES, {filter : {structureType : STRUCTURE_EXTRACTOR}})
        [0];
 },
 
 enumerable: false,
 configurable: true
});

Object.defineProperty(RoomObject.prototype, 'isNearBase', {
 get: function() 
 {
     return  this.pos.findInRange(FIND_MY_STRUCTURES, 5, {filter: s=>s.structureType == STRUCTURE_EXTENSION}).length > 0;
 },
 
 enumerable: false,
 configurable: true
});

Object.defineProperty(Room.prototype, 'links', {
 get: function() 
 {
     return  this.find(FIND_STRUCTURES, {filter : {structureType : STRUCTURE_LINK}});
 },
 enumerable: false,
 configurable: true
});

Object.defineProperty(Room.prototype, 'spawn', {
 get: function() 
 {
     return  this.spawns[0];
 },
 enumerable: false,
 configurable: true
});

Object.defineProperty(Room.prototype, 'spawns', {
 get: function() 
 {
     return  this.find(FIND_MY_STRUCTURES, {filter : {structureType : STRUCTURE_SPAWN}});
 },
 enumerable: false,
 configurable: true
});

Object.defineProperty(Room.prototype, 'towers', {
 get: function() 
 {
     return  this.find(FIND_MY_STRUCTURES, {filter : {structureType : STRUCTURE_TOWER}});
 },
 enumerable: false,
 configurable: true
});

Object.defineProperty(Room.prototype, 'config', {
 get: function() 
 {
    if(!Memory.rooms[this.name].config)
        Memory.rooms[this.name].config = new Object();
        
    return Memory.rooms[this.name].config;
 },
 
 set: function(conf) 
 {
    return Memory.rooms[this.name].config = conf;
 },
 enumerable: false,
 configurable: true
});

Object.defineProperty(RoomObject.prototype, 'container', {
 
 get: function() 
 {
    return  this.pos.findInRange(FIND_STRUCTURES, 3, {filter: {structureType: STRUCTURE_CONTAINER}})
        [0];
 },
 
 enumerable: false,
 configurable: true
});

Object.defineProperty(Room.prototype, 'basecontainer', {
 
 get: function() 
 {
    return  this.spawn.pos.findInRange(FIND_STRUCTURES, 5, {filter: {structureType: STRUCTURE_CONTAINER}})
        [0];
 },
 
 enumerable: false,
 configurable: true
});

Object.defineProperty(RoomObject.prototype, 'link', {
 
 get: function() 
 {
    return  this.pos.findInRange(FIND_STRUCTURES, 3, {filter: {structureType: STRUCTURE_LINK}})
        [0];
 },
 
 enumerable: false,
 configurable: true
});


Object.defineProperty(RoomObject.prototype, 'mineralDemand', {
 
 get: function() 
 {
   if(this.id == "5b17ead465803e4ceedf4ce3")
    return RESOURCE_HYDROGEN;
    
   if(this.id == "5b1805832bee550ad3d83114")
    return RESOURCE_OXYGEN;


    if(this.id == '5b2d2822e8d5d019c1d778dd')
        return RESOURCE_KEANIUM;
    if(this.id == '5b2e22f3d08a6b242e80f462')
        return RESOURCE_ZYNTHIUM;
    
    if(this.id == '5b29a59e8d6e3c5e7f198aa2')
        return RESOURCE_GHODIUM;
    if(this.id == '5b192f05c9146e7a0e5721a5')   
        return RESOURCE_HYDROGEN;
        
    if(this.id == '5b17d4f32d8da349cebafd64')
        return RESOURCE_UTRIUM;
    if(this.id == '5b182ff94226844ce49e4492')   
        return RESOURCE_LEMERGIUM;   
        
    if(this.id == '5b2db26618d810244ad0119b')
        return RESOURCE_UTRIUM_LEMERGITE;
    if(this.id == '5b2d97788002ae26413f2e78')   
        return RESOURCE_ZYNTHIUM_KEANITE;       
        
   return undefined;
 },
 
 enumerable: false,
 configurable: true
});

var utils = {
    roomAutoBuild :  function(room)
    {
        var flags = room.find(FIND_FLAGS, {filter: f => (f.color == COLOR_PURPLE)});
    
        for(var flagNo in flags)
        {
            var flag = flags[flagNo];
            var strType;
            
            switch(flag.secondaryColor)
            {
                case COLOR_GREEN:
                    strType = STRUCTURE_EXTENSION;
                    break;
                case COLOR_ORANGE:
                    strType = STRUCTURE_STORAGE;
                    break;
                case COLOR_YELLOW:
                    strType = STRUCTURE_CONTAINER;
                    break;
                case COLOR_RED:
                    strType = STRUCTURE_TOWER;
                    break;
            }
            
            if(!strType)
                continue;
                
            var code = room.createConstructionSite(flag.pos, strType);
            
            if(OK == code)
            {
                flag.remove();  
                return; // one at a time
            }
            else
            {
                //console.log("Cant build", strType, "in", room.name, ":", utils.getError(code));
            }
        }
        
    },
    
    roomMove :  function(room)
    {
       var roomCreeps = _.filter(Game.creeps, c=>c.room.name == room.name) ;
        
        for(var creepId in roomCreeps) {
            var creep = roomCreeps[creepId];

            try
            {    
                if(creep.memory.role == 'harvester') 
                {
                    roleHarvester.run(creep);
                } 
                else if(creep.memory.role == 'upgrader') 
                {
                    roleUpgrader.run(creep);
                }
                else if(creep.memory.role == 'builder') 
                {
                    roleBuilder.run(creep);
                }
                else if(creep.memory.role == 'deliverer')
                {
                    roleDeliverer.run(creep);
                }
                else if(creep.memory.role == 'claim') 
                {
                    roleClaim.run(creep);
                }
                else if(creep.memory.role == 'reserve')
                {
                    roleReserve.run(creep);
                }
                else if(creep.memory.role == 'mineralHarvester')
                {
                    roleMineralHarvester.run(creep);
                }
                else if(creep.memory.role == 'attack')
                {
                    roleAttack.run(creep);
                }
            }
            catch(err)
            {
                console.log("!!!!-!!!!", room.name, err, err.fileName, err.lineNumber);
            }
        }
        
        //room.visual.clear();
        
        room.spawns.forEach(spawn => {
            if(spawn.spawning) { 
                var spawningCreep = Game.creeps[spawn.spawning.name];
                spawn.room.visual.text(
                    '🛠️' + spawningCreep.memory.role,
                    spawn.pos.x + 1, 
                    spawn.pos.y, 
                    {align: 'left', opacity: 0.8});
            }
        });
        
        if(room.mineral) { 
            room.visual.text(
                '⏱️' + room.mineral.ticksToRegeneration,
                room.mineral.pos.x + 1, 
                room.mineral.pos.y, 
                {align: 'left', opacity: 0.8});
        }
        
        var labs = room.find(FIND_STRUCTURES, {
                        filter: (lab) => {
                            return ((lab.structureType == STRUCTURE_LAB) && lab.isActive
                            && lab.mineralDemand);
                            }
                         });
                         
        _.forEach(labs, lab=>
            {
                //console.log("!!! ", lab);
                room.visual.text(
                        lab.mineralDemand,
                        lab.pos.x, 
                        lab.pos.y+0.22, 
                        {align: 'center', color:"#000000", opacity: 1});
            });
    },
    
    roomSpawn : function(room, claimToGo, buildToGo)
    {
        room.memory.iterator = 0;
        
        var roomCreeps2 = room.find (FIND_MY_CREEPS);
        var roomCreeps = _.filter(Game.creeps, cr=>cr.room.name == room.name); // cannot use FIND_MY_CREEPS cause it's use spawning
        
        if(roomCreeps.length != roomCreeps2.length)
            {
                let difference = roomCreeps
                 .filter(x => !roomCreeps2.includes(x))
                 .concat(roomCreeps2.filter(x => !roomCreeps.includes(x)));
                 
                //console.log(room.name,"diff", difference, difference[0].ticksToLive);
            }
        
        
        var harvesters = _.filter(roomCreeps, (creep) => creep.memory.role == 'harvester');
        var upgraders = _.filter(roomCreeps, (creep) => creep.memory.role == 'upgrader');
        var builders = _.filter(roomCreeps, (creep) => creep.memory.role == 'builder');
        var deliverers = _.filter(roomCreeps, (creep) => creep.memory.role == 'deliverer');
        var mineralHarvesters = _.filter(roomCreeps, (creep) => creep.memory.role == 'mineralHarvester');

        console.log(room.name + " " + room.energyAvailable+ " of " + room.energyCapacityAvailable + ' Harvesters: ' + harvesters.length, ' Builders: ' + builders.length , ' Upgraders: ' + upgraders.length, ' Deliverers: ' + deliverers.length, ' Mineral: ' + mineralHarvesters.length);

        var spawn = room.spawns.find(s=> !s.spawning);
        
        if(spawn == undefined)
        {
            console.log("no available spawn in room ", room.name);
            return;
        }
        
        //console.log(sortedSources);
        
        var mem = Object();
        var repl;
        var oldest;
        // replacement prep
        if(roomCreeps.length > 0 ){
            var ups =  _.filter(roomCreeps, (cr) => 
                (cr.memory.role == "upgrader" || cr.memory.role == "harvester") && 
                (cr.getActiveBodyparts(WORK)>=5) && 
                cr.memory.replaced!=true 
                && !cr.spawning);
            
            //console.log(room.name, ups);
            
            oldest = _.sortBy(ups, ['ticksToLive'],['asc'])[0];
        
            if(oldest){
                var ticksToCreate = CREEP_SPAWN_TIME * oldest.body.length;
                
                var speed = 2;
                var ticksToTravel = oldest.pos.findPathTo(spawn.pos,{ignoreCreeps:true}).length * speed;
                var estimate =  oldest.ticksToLive - ticksToCreate - ticksToTravel;
                
                if(estimate < 100)
                    console.log(room.name, "to create =",ticksToCreate, " toTravel=",ticksToTravel, " oldest=",oldest.ticksToLive, " to replace ", oldest.name , " in=", estimate );
                
                if(oldest.ticksToLive <= ticksToCreate + ticksToTravel )
                {
                    console.log("Preparing replacement for", oldest.name, oldest.ticksToLive);
                    //console.log(oldest.memory);
                    repl = Object.assign({}, oldest.memory); // shallow copy of current mem
                }
            }
            else{
                //console.log(room.name, " nothing matches replacement criteria");
            }
        }
        
        var externalSources = [];
        
        if(room.config.remoteHarvest)
        {
            room.config.remoteHarvest.forEach(roomName=>
            {
                var remoteRoom = Game.rooms[roomName];
                if(!remoteRoom)
                    return; // need reserve it?
                    
                var remoteSources = remoteRoom.find(FIND_SOURCES);
                
                if(remoteSources)
                    externalSources = externalSources.concat(remoteSources);
            }
            );
        }
        
        var reserveToGo = [];
        if(room.config.remoteHarvest)
        {
            room.config.remoteHarvest.forEach(roomName=>
            {
                var remoteRoom = Game.rooms[roomName];
                var needReserve = false;
                
                if(remoteRoom && remoteRoom.controller.reservation)
                { 
                    if(remoteRoom.controller.reservation.ticksToEnd < 1000)
                    {
                        needReserve = true;
                    }
                }
                else
                {
                    needReserve = true;
                }
                
                var reservers = _.filter(Game.creeps, c=> c.memory.role == "reserve" && c.memory.toGo && c.memory.toGo.includes(roomName));
                //console.log(room.name, needReserve, reservers);
                if(reservers.length == 0 && needReserve)
                {
                     reserveToGo.push(roomName);
                }
                
            });
        }
        
        var sources = room.find(FIND_SOURCES).concat(externalSources);
        
        var sortedSources = _.sortBy(sources, function(source) 
            {
                var path = source.pos.findPathTo(spawn.pos, {ignoreCreeps : true}); // TODO:interoom path
                //console.log(path.length);
                return path.length;
            }
        );
        
        for(var source of sortedSources)
        {
            //var source = sources[sourceIdx];
            var budget = source.budget();
            if(budget > 2) budget=2;
            
            // for highly developed rooms
            //if(room.controller.level >=3)
            budget = 1;
                
            const sourceId = source.id;
            
            var attachedCreeps = _.filter(Game.creeps, function(cr) { 
                //console.log("sourceID = " + sourceId  + "|"+cr.memory.preferredSourceId );
                return cr.memory.role == 'harvester' && cr.memory.preferredSourceId == sourceId;
            }, sourceId);
            
            //console.log("atLen "+attachedCreeps.length + " budgt " + budget + " id=" +sourceId);
            
            if(attachedCreeps.length < budget)
            {
                var pathLen = source.pos.findPathTo(spawn.pos, {ignoreCreeps : true}).length;
                
                if(pathLen == 0)
                {
                     console.log("pathLen is zero for", source.id);
                }
                if(pathLen > 10 && (!source.container && !source.link))
                {
                    console.log("skip harvesting long location without container. dist = ", pathLen, source.room);
                    continue;
                }
                
                mem.role = 'harvester';
                mem.parts = this.getBodyParts(Math.min(1000, room.energyAvailable),'harvester');
                if(source.room.name != room.name)
                    mem.parts = this.getBodyParts(1000,"remoteHarvester");
                    
                mem.preferredSourceId = sourceId;
                
                // prefill preferred target id intead of logic in harvester
                break;
            }
        }
       
        var needBuild  = room.find(FIND_CONSTRUCTION_SITES).length > 0;
        var numBld = 1;
        // Why? priority to building instead of updating
        if(room.controller.level < 3)
        {
            numBld = 2;
        }
        
        // Why? - Increaed buliding ok
        if(room.storage && room.storage.store.energy > 50000)
        {
            numBld = 2;
        }
        
        var numUpd = 3; // for 2 sources 
        if(sources.length == 1  || room.name =='W57S37')
            numUpd = 2;
       
      
            
        if(room.controller.level <= 4 && needBuild)
        {
            numUpd = numUpd - numBld;
        }
        
        if(room.storage && room.storage.store.energy < 10000 && needBuild)
        {
            numUpd = numUpd - numBld;
        }
        
        
        if(mem.role == null)
        {
            if(room.name == "W59S34" && room.controller.level >= 3)
            {
                var specDelivers = _.filter(deliverers,  d=> !d.memory.preferredSourceId);
                
                if(specDelivers.length == 0)
                {
                    mem.parts = utils.getBodyParts(600, "deliverer");
                    mem.role = 'deliverer';
                 }
            }
            else if (room.name == "W59S33" && room.controller.level >= 4)
            {
                
                var specDelivers = _.filter(deliverers,  d=> !d.memory.preferredSourceId);
                
                if(specDelivers.length == 0)
                {
                    mem.parts = utils.getBodyParts(500, "delivererLight");
                    mem.role = 'deliverer';
                }
            }
            else if (room.name == "W59S36")
            {
                var specDelivers = _.filter(deliverers,  d=> !d.memory.preferredSourceId);

                if(specDelivers.length == 0)
                {
                    mem.parts = utils.getBodyParts(400, "deliverer");
                    mem.role = 'deliverer';
                }
            }
            else if (room.name == "W58S36" && room.controller.level >=4)
            {
                var specDelivers = _.filter(deliverers,  d=> !d.memory.preferredSourceId);

                if(specDelivers.length == 0)
                {
                    mem.parts = utils.getBodyParts(500, "deliverer");
                    mem.role = 'deliverer';
                }
            }
            
            else if (room.name == "W57S37" && room.controller.level >=3)
            {
                var specDelivers = _.filter(deliverers,  d=> !d.memory.preferredSourceId);

                if(specDelivers.length == 0)
                {
                    mem.parts = utils.getBodyParts(500, "deliverer");
                    mem.role = 'deliverer';
                }
            }
            else if (room.name == "W57S35")
            {
                var specDelivers = _.filter(deliverers,  d=> !d.memory.preferredSourceId);

                if(specDelivers.length == 0)
                {
                    mem.parts = utils.getBodyParts(500, "deliverer");
                    mem.role = 'deliverer';
                }
            }
            else if (room.name == "W55S33")
            {
                var specDelivers = _.filter(deliverers,  d=> !d.memory.preferredSourceId);

                if(specDelivers.length == 0)
                {
                    mem.parts = utils.getBodyParts(500, "deliverer");
                    mem.role = 'deliverer';
                }
            }
            
        }
       
        // route delivers
        if(mem.role == null)
        {
            if(room.name ==  "W57S35") // if ther are links dont do it
            {
                
                var amnt = 7;
                //if(numSources == 2 && !source.isNearBase)
                //    amnt = 10; // for remote minerals in high room
                var res;
                //console.log(source2.container);
                if(!room.controller.link)
                    res = this.createDeliverer(room.storage.id, room.controller.container.id, amnt, RESOURCE_ENERGY);
                
                if(res != null)
                    mem = res;
            }
        }
        
        if(mem.role == null)
        {
            // TODO: only single!
            externalSources.forEach(externalSource =>
            {
                var amnt = 10;
                //console.log("externalCoutnainer Ready", externalSource.container);
                if(externalSource && externalSource.container && !externalSource.link)
                {
                    var res = this.createDeliverer(externalSource.container.id, room.storage.id, amnt, RESOURCE_ENERGY);
                
                    //console.log("bla bla ", res);
                    if(res != null)
                    {
                        mem = res;
                    }
                }
            });
        }
        
        if(mem.role == null)
        {
            if(room.name ==  "W55S33"){
            // TODO: only single!
            sources.forEach(source =>
            {
                
                if(!source.isNearBase && source.container && !source.link)
                {
                    var amnt = 3*HARVEST_POWER;
                    //console.log("externalCoutnainer Ready", externalSource.container);
                    
                    var tgt;
                    if(room.basecontainer)
                        tgt = room.basecontainer.id;
                    else if(room.storage)
                        tgt = room.storage.id;
                    else 
                        tgt = room.spawn.id;
                        
                    var res = this.createDeliverer(source.container.id, tgt, amnt, RESOURCE_ENERGY);
                
                    //console.log("bla bla ", res);
                    if(res != null)
                    {
                        mem = res;
                    }
                }
            });
            }
        }
        
        
        var needMinerals = roleMineralHarvester.needHarvester(room) && room.storage.store[RESOURCE_ENERGY] > 10000;
        // mineral delivers
        if(mem.role == null)
        {
            if(mineralHarvesters.length > 0)
            {
                var amountPerSec = _.sum(_.map(mineralHarvesters, m=>m.getActiveBodyparts(WORK))) * HARVEST_MINERAL_POWER / EXTRACTOR_COOLDOWN;
                
                var targetId = room.storage.id;
                var terminalWatermark = 0.8;
                if(room.terminal && _.sum(room.terminal.store) < terminalWatermark*room.terminal.storeCapacity)
                    targetId = room.terminal.id;
                    
                var res = this.createDeliverer(room.extractor.container.id, targetId, amountPerSec); 
                if(res != null)
                    mem = res;
            }
        }
       
        var needAttack = room.find(FIND_HOSTILE_CREEPS).length>0 && room.towers.length == 0;
        var attackToGo = [];
        if(room.config.remoteHarvest)
        {
            room.config.remoteHarvest.forEach(roomName=>
            {
                var remoteRoom = Game.rooms[roomName];
                if(!remoteRoom)
                    return; // need reserve it?
                
                var enemies = remoteRoom.find(FIND_HOSTILE_CREEPS, 
                    {filter: (c=>c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) && (c.owner.username != ""))});
                var attackers = _.filter(Game.creeps, c=> c.memory.role == "attack" && c.memory.toGo && c.memory.toGo.includes(roomName));
                
                if(enemies.length > 0 && attackers.length == 0)
                {
                    attackToGo.push(roomName);
                }
            }
            );
        }
        
        
        if (room.name == "W57S37")
            console.log(needAttack, attackToGo);
        
        if(needAttack)
        {
            mem = new Object();
            mem.role = "attack";
        }
        else if(attackToGo.length > 0)
        {
            mem = new Object();
            mem.role = "attack";
            mem.toGo = attackToGo;
        }
        else if(mem.role != null)
        {
            // already processed created
        }
        else if(upgraders.length == 0)
        {
            mem.role = 'upgrader';
        }
        else if(needBuild && builders.length < numBld)
        {
             mem.role = "builder";
             //mem.parts = this.getBodyParts(1000, 'upgrader');
        }
        else if(upgraders.length < numUpd)
        {
            mem.role = 'upgrader';
        }
        else if(mineralHarvesters.length < 1 && needMinerals)
        {
            mem.role = 'mineralHarvester';
        }
        else if(repl)
        {
            console.log("yes repl");
            mem = repl;
        }
        else if(claimToGo && claimToGo.length > 0)
        {
             mem.role = "claim";
             mem.toGo = claimToGo;
        }
        else if(buildToGo && buildToGo.length > 0)
        {
             mem.role = "builder";
             mem.parts = this.getBodyParts(1000, 'upgrader');
             mem.toGo = buildToGo;
        }
        else if(reserveToGo && reserveToGo.length > 0)
        {
             mem.role = "reserve";
             mem.toGo = reserveToGo;
        }
        
        var energyBudget = room.energyCapacityAvailable; // max possible
        if(roomCreeps.length < 3 || harvesters.length == 0) //TODO poor harvester condition
            energyBudget = room.energyAvailable; // use as min energy in start as possible
        
        if(energyBudget > 850)
            energyBudget = 850;
        
        if(mem.role == "deliverer")
        {
            energyBudget = Math.min(room.energyCapacityAvailable, 500);
        }
         
        if(mem.role == 'builder')
        {
            energyBudget = Math.min(room.energyCapacityAvailable,1500);
        }
        
        // if(roomCreeps.length > 12)
        //   energyBudget = 0;
            
        if(mem.role != undefined && !spawn.spawning)
        {    
            //console.log(energyBudget);
            
            var parts = mem.parts;
            if(parts == undefined)
                parts = utils.getBodyParts(energyBudget, mem.role);
                
            
            mem.parts = parts;
            if(parts.length != 0)
            {
                var name = mem.role + Game.time.toString();
                console.log(parts);
                var code = spawn.spawnCreep(parts, name, {memory:mem});
                
                if(OK == code)
                {
                    console.log(spawn.name+ ' is spawning new : ' + mem.role + " with " + parts + " - " + code);
                    if(repl && oldest)
                    {
                        oldest.memory.replaced = true;
                    }
                }
                else 
                {
                    console.log('Spawn error: '+ utils.getError(code));
                }
            }
            else
            {
                console.log('not enough money yet for ' + mem.role,"budget=",energyBudget);
            }
        }
        
        
    },
    
    createDeliverer: function(fromId, toId, energyPerTick, resType)
    {
        var existing = _.filter(Game.creeps,  d=> d.memory.role == "deliverer" && d.memory.preferredSourceId == fromId);
        
        var num = 0;
        if(fromId == '5b302b73a6675263b3f0b744')
            num = 1;
            
        if(existing.length > num )
        {
            //console.log('deliverer already exists between ', fromId, '->', toId);
            return null;
        }
        
        var from = Game.getObjectById(fromId);
        var to = Game.getObjectById(toId);
        
        if(!from || !to)
        {
            console.log('deliverer: TO or FROM not exist', fromId, '->', toId);
            return null;
        }
        
        var path = to.pos.findPathTo(from.pos,  {ignoreCreeps:true});
        
        let goals = _.map([to], function(s) {
            return { pos: s.pos, range: 1 };
        });
    
        let ret = PathFinder.search(from.pos, goals, {});
        
        //console.log("cost analysis path", path);
        if(!ret.path || ret.path.length == 0)
        {
            console.log('deliverer cannot find path', fromId, '->', toId);
            return null;
        }
        
        
        var travelTime = ret.path.length * 2 + 2; // 2 is turnaround delay tbd to remove it
        //console.log("cost analysis path", path.length)
        var energyToTransfer = travelTime * energyPerTick; // source generates 10 per sec
        
        var carryParts = Math.ceil(energyToTransfer / CARRY_CAPACITY);
        
        var bodyPartsEnergy = carryParts * 2 * CARRY_CAPACITY;
        console.log("cost analysis", bodyPartsEnergy);
        const room = to.room;
        if(bodyPartsEnergy > room.energyCapacityAvailable)
        {
            console.log("limiting data from to", bodyPartsEnergy, "->", room.energyCapacityAvailable);
            bodyPartsEnergy = room.energyCapacityAvailable;
        }
        var mem = new Object();
        
        mem.parts = utils.getBodyParts(bodyPartsEnergy, "deliverer");
        mem.role = 'deliverer';
        mem.preferredSourceId = fromId;
        mem.preferredTargetId = toId;
        if(resType)
            mem.preferredResourceType = resType;
        
        return mem;
    }
    ,
    getError2: function(code)
    {
        var objprops = Object.getOwnPropertyNames(this).filter(n=n.startsWith("ERR_"));
    },
    
    getError : function(code)
    {
        switch(code){
            case OK:                  
                // 0
                return "OK";
            case ERR_NOT_OWNER:     
                // -1
                return "ERR_NOT_OWNER";
            case ERR_NO_PATH:    
                // -2
                return "ERR_NO_PATH";
            case ERR_NAME_EXISTS: 
                // -3
                return "ERR_NAME_EXISTS";
            case ERR_BUSY: 
                //-4
                return "ERR_BUSY";
            case ERR_NOT_FOUND: 
                // -5
                return "ERR_NOT_FOUND";
            case ERR_NOT_ENOUGH_ENERGY:
            case ERR_NOT_ENOUGH_RESOURCES:
            case ERR_NOT_ENOUGH_EXTENSIONS:
                // -6
                return "ERR_NOT_ENOUGH_";
            case ERR_INVALID_TARGET:
                // -7
                return "ERR_INVALID_TARGET";
            case ERR_FULL:
                // -8
                return "ERR_FULL";
             case ERR_NOT_IN_RANGE:
                // -9
                return "ERR_NOT_IN_RANGE";
             case ERR_INVALID_ARGS:
                // -10
                return "ERR_INVALID_ARGS";
            case ERR_TIRED:
                // -11
                return "ERR_TIRED";
             case ERR_NO_BODYPART:
                // -12
                return "ERR_NO_BODYPART";
             case ERR_RCL_NOT_ENOUGH:
                // -14
                return "ERR_RCL_NOT_ENOUGH";
        }
        return code + " code not found";
    }
    ,
    
    getBodyParts : function(currentEnergy, role)
    {
        if(role == "claim")
            return [CLAIM, MOVE];
            
        if(role == "reserve")
            return [CLAIM, CLAIM, MOVE, MOVE];
        
        var attackParts = 
                     [ATTACK, ATTACK, ATTACK, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
                     MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    
       
       
       
       
       
       
       
        var deliverParts = 
                     [MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY,
                     MOVE, CARRY];
                     
        var deliverLightParts = 
                     [MOVE, CARRY, CARRY,
                     MOVE, CARRY, CARRY,
                     MOVE, CARRY,CARRY,
                     MOVE, CARRY, CARRY,
                     MOVE, CARRY, CARRY,
                     MOVE, CARRY,CARRY,
                     MOVE, CARRY, CARRY,
                     MOVE, CARRY, CARRY,
                     MOVE, CARRY,CARRY,
                     MOVE, CARRY, CARRY];
        
        
        var upgraderParts       = [MOVE,CARRY, WORK,WORK,WORK,WORK,WORK, MOVE,MOVE,MOVE,MOVE];
        
        var harvesterParts      = [MOVE,CARRY, WORK,WORK,WORK,WORK,WORK, MOVE,MOVE,MOVE,MOVE];
        var remoteHarvesterParts      = [MOVE,CARRY, WORK,WORK,WORK,WORK,WORK,WORK, MOVE,MOVE,MOVE,MOVE,MOVE];
        var mineralHarvesterParts = [MOVE,MOVE,MOVE,MOVE, WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK, CARRY];            
        
        var parts = [MOVE, CARRY, WORK, WORK ,WORK,
                    MOVE, MOVE, CARRY,  WORK, WORK, 
                    MOVE, //800
                    MOVE, CARRY, WORK, WORK, 
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK];
                    
        var builderParts = [MOVE, CARRY, WORK, WORK, WORK, WORK, WORK, WORK,
                    MOVE, MOVE, CARRY, CARRY, 
                    MOVE, CARRY,
                    MOVE, CARRY,
                    MOVE, CARRY, 
                    MOVE, CARRY, 
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK,
                    MOVE, CARRY, WORK];
        
        if(role == 'attack'){
            parts = attackParts;
            currentEnergy = this.getPartsCost(attackParts);
        }
        if(role == 'builder')
            parts = builderParts;
            
        if(role =="deliverer")
            parts = deliverParts;
            
        if(role =="delivererLight")
            parts = deliverLightParts;
            
         if(role =="mineralHarvester"){
            parts = mineralHarvesterParts;
            currentEnergy = this.getPartsCost(mineralHarvesterParts);
         }
          
          if(role =="remoteHarvester"){
            parts = remoteHarvesterParts;
            currentEnergy = this.getPartsCost(remoteHarvesterParts);
         }
            
        if(role == "upgrader" ){
            parts = upgraderParts;
            if(currentEnergy > this.getPartsCost(upgraderParts))
                currentEnergy = this.getPartsCost(upgraderParts);
        }
        
        if(role == "harvester"){
            
            if(currentEnergy >= this.getPartsCost(harvesterParts)){
                currentEnergy = this.getPartsCost(harvesterParts);
                parts = harvesterParts;
            }
        }
        
        var res = [];
        if(currentEnergy < 300 && role != "deliverer")
            return res;
        
        var budget = currentEnergy;
        console.log(role,' get part for ' + budget);
        while(budget > 0)
        {
            var nextPart = parts[0];
            if(!nextPart)
                break;
            var partCost = BODYPART_COST[nextPart.toLowerCase()];
            
            
            //console.log(nextPart, " ", partCost);
            if(budget < partCost)
                break;
        
            budget -= partCost;
            
            res.push(nextPart);
            
            parts.shift();
        }
        
        return res.sort().reverse();
    },
    
    getPartsCost: function(parts)
    {
        var costs = _.map(parts, p=>BODYPART_COST[p.toLowerCase()]);
        
        return _.sum(costs);
    },
    
    buildroad : function(room)
    {
       var p1 = Game.rooms[room].controller.pos;
       var p2 = Game.rooms[room].find(FIND_SOURCES)[0].pos;
       
       var path  = p1.findPathTo(p2, {ignoreCreeps:true});
       
       for(var obj in path)
       {
           var code = Game.rooms[room].createConstructionSite(obj.x, obj.y, STRUCTURE_ROAD);
           console.log(obj.x + " " + obj.y + " " + code);
       }
       
       return path;
      
    }
};

module.exports = utils;