// Boost management module
// Handles creep boosting logic and lab preparation

var roleBoost = {
    // Boost configurations for different roles
    boostConfigs: {
        'upgrader': {
            boosts: [
                { resource: RESOURCE_GHODIUM_HYDRIDE, bodyPart: WORK, effect: 'upgradeController', power: 1.5 }, // GH - 1.5x
                { resource: RESOURCE_GHODIUM_ACID, bodyPart: WORK, effect: 'upgradeController', power: 1.8 }, // GH2O - 1.8x
                //{ resource: RESOURCE_CATALYZED_GHODIUM_ACID, bodyPart: WORK, effect: 'upgradeController', power: 2 }, // XGH2O - 2x
            ]
        },
        /*'builder': {
            boosts: [
                { resource: RESOURCE_LEMERGIUM_HYDRIDE, bodyPart: WORK, effect: 'build', power: 1.5 }, // LH - 1.5x
                { resource: RESOURCE_LEMERGIUM_ACID, bodyPart: WORK, effect: 'build', power: 1.8 }, // LH2O - 1.8x
                { resource: RESOURCE_CATALYZED_LEMERGIUM_ACID, bodyPart: WORK, effect: 'build', power: 2 }, // XLH2O - 2x
            ]
        },*/
        
    },

    // Get available boost for a role
    getAvailableBoost: function(room, role) {
        const config = this.boostConfigs[role];
        if (!config) return null;

        // Find labs with available boosts (prioritize better boosts)
        for (let i = config.boosts.length - 1; i >= 0; i--) {
            const boost = config.boosts[i];
            
            // Find labs that have both the mineral AND energy needed for boosting
            const labs = room.find(FIND_MY_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_LAB && 
                               s.store[boost.resource] >= LAB_BOOST_MINERAL &&
                               s.store[RESOURCE_ENERGY] >= LAB_BOOST_ENERGY &&
                               (!s.mineralType || s.mineralType === boost.resource)
            });
            
            if (labs.length > 0) {
                // Prefer labs that already have the right mineral type
                const labWithMineral = labs.find(l => l.mineralType === boost.resource);
                return { 
                    lab: labWithMineral || labs[0], 
                    resource: boost.resource, 
                    bodyPart: boost.bodyPart 
                };
            }
        }
        
        return null;
    },

    // Check if creep needs boosting
    needsBoosting: function(creep) {
        // Don't boost if already boosted
        if (creep.memory.boosted) return false;

        if(creep.ticksToLive < 1400) return false; 
        
        // Check if boosting is enabled for this room
        const room = Game.rooms[creep.memory.motherland];
        if (!room || !room.memory.enableBoosting) return false;

        // Check if role supports boosting
        if (!this.boostConfigs[creep.memory.role]) return false;

        // Check if there are available boosts with enough materials
        const availableBoost = this.getAvailableBoost(room, creep.memory.role);
        if (!availableBoost) return false;
        
        // Calculate how much mineral is needed to boost all body parts of this type
        const bodyPartCount = creep.body.filter(p => p.type === availableBoost.bodyPart && !p.boost).length;
        const mineralNeeded = bodyPartCount * LAB_BOOST_MINERAL;
        const energyNeeded = bodyPartCount * LAB_BOOST_ENERGY;
        
        // Check if lab has enough materials
        const lab = availableBoost.lab;
        if (lab.store[availableBoost.resource] < mineralNeeded) return false;
        if (lab.store[RESOURCE_ENERGY] < energyNeeded) return false;
        
        return true;
    },

    // Boost a creep
    boostCreep: function(creep) {
        const room = Game.rooms[creep.memory.motherland];
        if (!room) return false;

        const availableBoost = this.getAvailableBoost(room, creep.memory.role);
        if (!availableBoost) {
            creep.memory.boosted = true; // Mark as boosted to avoid repeated checks
            return false;
        }

        const lab = availableBoost.lab;

        // Move to lab
        if (!creep.pos.isNearTo(lab)) {
            creep.moveTo(lab, { visualizePathStyle: { stroke: '#00ff00' } });
            return true;
        }

        // Apply boost
        const result = lab.boostCreep(creep);
        if (result === OK) {
            creep.say('💪');
            creep.memory.boosted = true;
            console.log(`Boosted ${creep.name} with ${availableBoost.resource}`);
            return true;
        } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
            creep.memory.boosted = true; // Mark as done to avoid repeated attempts
            console.log(`Lab ${lab.id} doesn't have enough ${availableBoost.resource}`);
            return false;
        } else {
            console.log(`Failed to boost ${creep.name}: ${result}`);
            return false;
        }
    },

    // Prepare labs for boosting in a room
    prepareLabs: function(room) {
        if (!room.memory.enableBoosting) return;
        
        // Initialize demand tracking with desired amounts
        if (!room.memory.labDemand) {
            room.memory.labDemand = {}; // { labId: { resource: RESOURCE_*, desiredAmount: 450 } }
        }
        if (!room.memory.labEnergyDemand) {
            room.memory.labEnergyDemand = {}; // { labId: desiredAmount }
        }

        //console.log(`Preparing labs for boosting in room ${room.name}`);

        const roles = Object.keys(this.boostConfigs);
        
        for (const role of roles) {
            const config = this.boostConfigs[role];
            
            //console.log(`Checking boosts for role ${role}`);
            // For each role, only prepare ONE lab with the HIGHEST tier boost available
            // Iterate backwards to prioritize higher tier boosts (same as getAvailableBoost)
            let labPrepared = false;
            for (let i = config.boosts.length - 1; i >= 0 && !labPrepared; i--) {
                const boost = config.boosts[i];
                
                // First, try to find labs that already have this mineral
                let labs = room.find(FIND_MY_STRUCTURES, {
                    filter: (s) => s.structureType === STRUCTURE_LAB &&
                                   s.mineralType === boost.resource
                });
                
                // If no labs with this mineral, find empty labs (but only for highest tier we're targeting)
                if (labs.length === 0 && i === config.boosts.length - 1) {
                    labs = room.find(FIND_MY_STRUCTURES, {
                        filter: (s) => s.structureType === STRUCTURE_LAB &&
                                       s.store.getUsedCapacity() === 0 &&
                                       !s.mineralDemand  // Don't use labs already assigned for reactions
                    });
                }

                //console.log(`Found ${labs.length} labs for boost ${boost.resource} for role ${role}`);
                if (labs.length > 0) {
                    const lab = labs[0];
                    
                    // Set desired mineral via lab prototype (deliverer will check and fill if needed)
                    lab.mineralDemand = boost.resource;
                    
                    // Set desired energy amount (deliverer will check and fill if needed)
                    const desiredEnergyAmount = lab.store.getCapacity(RESOURCE_ENERGY);
                    room.memory.labEnergyDemand[lab.id] = desiredEnergyAmount;
                    
                    labPrepared = true;  // Only prepare one lab per role
                }

                //console.log(`Lab preparation for boost ${boost.resource} for role ${role} completed`);
            }
        }
    }
};

module.exports = roleBoost;
