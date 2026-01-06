module.exports = {
    
    run : function(room)
    {
        var towers = room.find(FIND_STRUCTURES, {filter: s=>s.structureType==STRUCTURE_TOWER});
        
        _.forEach(towers, t=>this.runInternal(t));
    },
    
    runInternal : function(tower)
    {
        //console.log(tower);
        var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        var damagedTower = tower.pos.findClosestByRange(FIND_MY_STRUCTURES, {filter : s=>s.structureType == STRUCTURE_TOWER && s.hits < (3000-2*800)});
        var damagedCreep =  tower.pos.findClosestByRange(FIND_MY_CREEPS, {filter : s=>s.hits < s.hitsMax});
        //var damagedBuild =  tower.pos.findClosestByRange(FIND_STRUCTURES, {filter : s=>s.hits < s.hitsMax*0.2 && s.ticksToDecay < 50});
        
        if(damagedTower)
        {
            tower.repair(damagedTower);
        }
        else if(closestHostile)
        {
            tower.attack(closestHostile);
        }
        else if(damagedCreep)
        {
            tower.heal(damagedCreep);
        }
        // else if(damagedBuild)
        //{
            //tower.repair(damagedBuild);
        //}
        else
        {
            
            if((tower.room.energyAvailable >= 0.8*tower.room.energyCapacityAvailable && tower.energy >= 0.5*tower.energyCapacity) ||
                    (tower.energy >= 0.9*tower.energyCapacity))
            {
                var tgts;
                var wallHealth = 30000;
                var repairK = 0.9;
                
                tgts = tower.room.find(FIND_STRUCTURES, {
                        filter: object => ((object.structureType == STRUCTURE_WALL || object.structureType == STRUCTURE_RAMPART) && object.hits < wallHealth) ||
                                          ((object.structureType != STRUCTURE_WALL && object.structureType != STRUCTURE_RAMPART) && object.hits < repairK*object.hitsMax) 
                    });
                        
                
                var sorted = _.sortBy(tgts, c=>c.hits);
                //if(tower.room.name == 'E33N44')
                //    console.log(_.map(sorted, s=>s.hits), Game.getObjectById('5da1b912344e680001622fab').hitsMax);
                
                if(sorted.length>0)
                {
                    var tgt = sorted[0];
                    //console.log("repair" + tgt.structureType);
                    var err= tower.repair(tgt);
                    if(err!=OK)
                        console.log(tower.room.name, "repair err", err);
                }
            }
            else{
                //console.log("skip repair room on low energy");
            }
            
        }
    },
};