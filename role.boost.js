// Boost management module
// Handles creep boosting logic and lab preparation

var roleBoost = {
    // Boost configurations for different roles
    boostConfigs: {
        'upgrader': {
            boosts: [
                { resource: RESOURCE_GHODIUM_HYDRIDE, bodyPart: WORK, effect: 'upgradeController', power: 1.5 }, // GH - 1.5x
                { resource: RESOURCE_GHODIUM_ACID, bodyPart: WORK, effect: 'upgradeController', power: 1.8 }, // GH2O - 1.8x
               // { resource: RESOURCE_CATALYZED_GHODIUM_ACID, bodyPart: WORK, effect: 'upgradeController', power: 2 }, // XGH2O - 2x
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

    // Canonical boost toggle key is room.memory.enableBoosting.
    // Keep backward compatibility with legacy room.memory.boostingEnabled.
    isBoostingEnabled: function (room) {
        if (!room || !room.memory) return false;

        if (room.memory.enableBoosting === undefined && room.memory.boostingEnabled !== undefined) {
            room.memory.enableBoosting = room.memory.boostingEnabled;
        }

        if (room.memory.enableBoosting === undefined) {
            room.memory.enableBoosting = true;
        }

        return room.memory.enableBoosting !== false;
    },

    // Get available boost for a role
    getAvailableBoost: function (room, role) {
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
    needsBoosting: function (creep) {
        // Don't boost if already boosted
        if (creep.memory.boosted) return false;

        if(creep.ticksToLive < 1400) return false; 
        
        // Check if boosting is enabled for this room
        const room = Game.rooms[creep.memory.motherland];
        if (!room || !this.isBoostingEnabled(room)) return false;

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
    boostCreep: function (creep) {
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
            console.log(`Boosted ${creep.name} with ${availableBoost.resource} in ${room.name}`);
            return true;
        } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
            creep.memory.boosted = true; // Mark as done to avoid repeated attempts
            console.log(`Lab ${lab.id} doesn't have enough ${availableBoost.resource} in ${room.name}`);
            return false;
        } else {
            console.log(`Failed to boost ${creep.name}: ${result}`);
            return false;
        }
    },

    // Prepare labs for boosting in a room
    prepareLabs: function (room) {
        const boostingEnabled = this.isBoostingEnabled(room);

        if (!boostingEnabled) {
            return;
        }

        const getLabMineralAmount = function (lab) {
            if (!lab) return 0;
            if (lab.mineralType) return lab.store[lab.mineralType] || 0;
            const mineralKey = _.findKey(lab.store, function (amount, key) {
                return key !== RESOURCE_ENERGY && amount > 0;
            });
            return mineralKey ? (lab.store[mineralKey] || 0) : 0;
        };

        // Initialize demand tracking with desired amounts
        if (!room.memory.labDemand) {
            room.memory.labDemand = {}; // { labId: { resource: RESOURCE_*, desiredAmount: 450 } }
        }
        if (!room.memory.labEnergyDemand) {
            room.memory.labEnergyDemand = {}; // { labId: desiredAmount }
        }

        const reactionLabIds = {};
        if (room.memory.labSetup) {
            if (room.memory.labSetup.inputLab1) reactionLabIds[room.memory.labSetup.inputLab1] = true;
            if (room.memory.labSetup.inputLab2) reactionLabIds[room.memory.labSetup.inputLab2] = true;
            if (room.memory.labSetup.outputLabs) {
                for (const outputLabId of room.memory.labSetup.outputLabs) {
                    reactionLabIds[outputLabId] = true;
                }
            }
        }

        const availableLabs = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_LAB && !reactionLabIds[s.id]
        });

        if (availableLabs.length === 0) return;

        const hasActiveGoals = !!room.memory.productionTarget ||
            (room.memory.inventoryGoal && Object.keys(room.memory.inventoryGoal).length > 0);

        // When production goals are active, do not reserve labs for boosting.
        // This prevents boost demands from blocking reaction setup.
        if (hasActiveGoals) {
            for (const lab of availableLabs) {
                lab.mineralDemand = null;
                delete room.memory.labEnergyDemand[lab.id];
            }
            return;
        }

        // If there are no goals and production target is complete, reserve spare labs
        // for top-tier boost compounds configured in boostConfigs.
        if (!hasActiveGoals) {
            const topBoostResources = [];
            const roles = Object.keys(this.boostConfigs);

            for (const role of roles) {
                const config = this.boostConfigs[role];
                if (!config || !config.boosts || config.boosts.length === 0) continue;

                const topBoost = config.boosts[config.boosts.length - 1].resource;
                if (topBoostResources.indexOf(topBoost) === -1) {
                    topBoostResources.push(topBoost);
                }
            }

            // Reset boost-only energy demand for non-reaction labs before reassigning.
            for (const lab of availableLabs) {
                delete room.memory.labEnergyDemand[lab.id];
            }

            const usedLabIds = {};
            for (const resourceType of topBoostResources) {
                let selectedLab = _.find(availableLabs, (lab) => !usedLabIds[lab.id] && lab.mineralType === resourceType);

                if (!selectedLab) {
                    selectedLab = _.find(availableLabs, (lab) => {
                        if (usedLabIds[lab.id]) return false;
                        if (getLabMineralAmount(lab) > 0) return false;
                        if (lab.mineralDemand && lab.mineralDemand !== resourceType) return false;
                        return true;
                    });
                }

                if (selectedLab) {
                    selectedLab.mineralDemand = resourceType;
                    room.memory.labEnergyDemand[selectedLab.id] = selectedLab.store.getCapacity(RESOURCE_ENERGY);
                    usedLabIds[selectedLab.id] = true;
                }
            }

            // Non-selected spare labs should be free/clean for future assignment.
            for (const lab of availableLabs) {
                if (!usedLabIds[lab.id]) {
                    lab.mineralDemand = null;
                }
            }

            return;
        }

        return;
    }
};

module.exports = roleBoost;
