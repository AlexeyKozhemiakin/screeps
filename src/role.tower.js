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
            var flagDismantle = tower.pos.findClosestByRange(FIND_FLAGS, {
                    filter: flag => (flag.color == COLOR_RED && flag.secondaryColor == COLOR_BROWN)
                });
            if(flagDismantle)
                return;
            if((tower.room.energyAvailable >= 0.8*tower.room.energyCapacityAvailable && tower.energy >= 0.6*tower.energyCapacity) ||
                
                (tower.energy >= 0.9*tower.energyCapacity))
            {
                var tgts;
                 
                if(tower.room.name == "W57S37")
                     tgts = tower.room.find(FIND_STRUCTURES, {
                            filter: object => ((object.structureType != STRUCTURE_WALL && object.structureType != STRUCTURE_RAMPART) && object.hits < 0.8*object.hitsMax) 
                        });
                 else  
                //console.log("repair");
                    tgts = tower.room.find(FIND_STRUCTURES, {
                            filter: object => ((object.structureType == STRUCTURE_WALL || object.structureType == STRUCTURE_RAMPART) && object.hits < 330000) ||
                                              ((object.structureType != STRUCTURE_WALL && object.structureType != STRUCTURE_RAMPART) && object.hits < 0.8*object.hitsMax) 
                        });
                        
                
                var sorted = _.sortBy(tgts, c=>c.hits);
                //console.log(_.map(sorted, s=>s.hits));
                
                if(sorted.length>0)
                {
                    var tgt = sorted[0];
                    //console.log("repair" + tgt.structureType);
                    if(tower.repair(tgt)== ERR_NOT_IN_RANGE)
                    {
                        creep.moveTo(tgt ,{visualizePathStyle: {stroke: '#ffffff'}});
                    }
                }
            }
            else{
                //console.log("skip repair room on low energy");
            }
            
        }
    },
};