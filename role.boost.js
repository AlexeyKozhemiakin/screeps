// Boost management module
// Handles creep boosting logic and lab preparation

var roleBoost = {
    // Boost configurations for different roles
    boostConfigs: {
        'upgrader': {
            boosts: [
                { resource: RESOURCE_GHODIUM_HYDRIDE, bodyPart: WORK, effect: 'upgradeController', power: 1.5 }, // GH - 1.5x
                { resource: RESOURCE_GHODIUM_ACID, bodyPart: WORK, effect: 'upgradeController', power: 1.8 }, // GH2O - 1.8x
                { resource: RESOURCE_CATALYZED_GHODIUM_ACID, bodyPart: WORK, effect: 'upgradeController', power: 2 }, // XGH2O - 2x
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

    getUnboostedBodyPartCount: function (creep, bodyPart) {
        if (!creep) return 1;

        return creep.body.filter(function (part) {
            return part.type === bodyPart && !part.boost;
        }).length;
    },

    getBoostableParts: function (lab, resource, neededParts) {
        if (!lab || !resource || neededParts <= 0) return 0;

        const availableMineral = lab.store[resource] || 0;
        const availableEnergy = lab.store[RESOURCE_ENERGY] || 0;
        const boostableByMineral = Math.floor(availableMineral / LAB_BOOST_MINERAL);
        const boostableByEnergy = Math.floor(availableEnergy / LAB_BOOST_ENERGY);

        return Math.min(neededParts, boostableByMineral, boostableByEnergy);
    },

    getBestAvailableBoostResource: function (room, boosts) {
        if (!room || !boosts || boosts.length === 0) return null;

        for (var i = boosts.length - 1; i >= 0; i--) {
            var boost = boosts[i];
            var availableAmount = room.getResourceAmount(boost.resource);

            if (availableAmount >= LAB_BOOST_MINERAL) {
                return boost.resource;
            }
        }

        return null;
    },

    // Get available boost for a role
    getAvailableBoost: function (room, role, creep) {
        const config = this.boostConfigs[role];
        if (!config) return null;

        // Build a set of lab IDs currently allocated to reactions.
        // We still prefer non-reaction labs for boosting, but can fall back
        // to reaction labs when no spare boost lab is available.
        var reactionLabIds = {};
        if (room.memory.labSetup) {
            if (room.memory.labSetup.inputLab1) reactionLabIds[room.memory.labSetup.inputLab1] = true;
            if (room.memory.labSetup.inputLab2) reactionLabIds[room.memory.labSetup.inputLab2] = true;
            if (room.memory.labSetup.outputLabs) {
                for (var ol = 0; ol < room.memory.labSetup.outputLabs.length; ol++) {
                    reactionLabIds[room.memory.labSetup.outputLabs[ol]] = true;
                }
            }
        }

        const allLabs = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_LAB
        });

        // Find labs with available boosts (prioritize better boosts), but only
        // return a lab that can actually apply at least one boost part.
        for (let i = config.boosts.length - 1; i >= 0; i--) {
            const boost = config.boosts[i];
            const neededParts = this.getUnboostedBodyPartCount(creep, boost.bodyPart);

            if (neededParts <= 0) continue;

            const matchingLabs = _.filter(allLabs, function (lab) {
                return (lab.store[boost.resource] || 0) > 0 &&
                    (lab.store[RESOURCE_ENERGY] || 0) > 0 &&
                    (!lab.mineralType || lab.mineralType === boost.resource);
            });

            const usableLabs = _.filter(matchingLabs, (lab) => this.getBoostableParts(lab, boost.resource, neededParts) > 0);

            if (usableLabs.length > 0) {
                const sortedLabs = _.sortBy(usableLabs, (lab) => -this.getBoostableParts(lab, boost.resource, neededParts));
                const chosenLab = sortedLabs[0];
                return {
                    lab: chosenLab,
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

        if (creep.ticksToLive < 1400) return false;
        
        // Check if boosting is enabled for this room
        const room = Game.rooms[creep.memory.motherland];
        if (!room || !this.isBoostingEnabled(room)) return false;

        // Check if role supports boosting
        if (!this.boostConfigs[creep.memory.role]) return false;

        // Check if there are available boosts with enough materials
        const availableBoost = this.getAvailableBoost(room, creep.memory.role, creep);
        if (!availableBoost) return false;

        // Calculate how much mineral is needed to boost all body parts of this type
        const bodyPartCount = this.getUnboostedBodyPartCount(creep, availableBoost.bodyPart);
        if (bodyPartCount <= 0) return false;

        // Check if lab has enough materials
        const lab = availableBoost.lab;
        const boostableParts = this.getBoostableParts(lab, availableBoost.resource, bodyPartCount);

        if (boostableParts <= 0) return false;

        return true;
    },

    // Boost a creep
    boostCreep: function (creep) {
        const room = Game.rooms[creep.memory.motherland];
        if (!room) return false;

        const availableBoost = this.getAvailableBoost(room, creep.memory.role, creep);
        if (!availableBoost) {
            creep.memory.boosted = true; // Mark as boosted to avoid repeated checks
            return false;
        }

        const lab = availableBoost.lab;
        const unboostedParts = this.getUnboostedBodyPartCount(creep, availableBoost.bodyPart);
        const bodyPartsCount = this.getBoostableParts(lab, availableBoost.resource, unboostedParts);

        if (bodyPartsCount <= 0) return false;

        // Move to lab
        if (!creep.pos.isNearTo(lab)) {
            creep.moveTo(lab, { visualizePathStyle: { stroke: '#00ff00' } });
            return true;
        }

        // Apply boost
        const result = lab.boostCreep(creep, bodyPartsCount);
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
        // for the best available boost compounds configured in boostConfigs.
        if (!hasActiveGoals) {
            const requestedBoostResources = [];
            const roles = Object.keys(this.boostConfigs);

            for (const role of roles) {
                const config = this.boostConfigs[role];
                if (!config || !config.boosts || config.boosts.length === 0) continue;

                const bestAvailableBoost = this.getBestAvailableBoostResource(room, config.boosts);
                if (bestAvailableBoost && requestedBoostResources.indexOf(bestAvailableBoost) === -1) {
                    requestedBoostResources.push(bestAvailableBoost);
                }
            }

            // Reset boost-only energy demand for non-reaction labs before reassigning.
            for (const lab of availableLabs) {
                delete room.memory.labEnergyDemand[lab.id];
            }

            const usedLabIds = {};
            for (const resourceType of requestedBoostResources) {
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
