// Autonomous factory manager (no creep needed - runs per room like role.tower)
//
// Memory contract:
//   room.memory.factoryDemand = {
//       type        : string          -- resource type deliverers should bring in next
//       amount      : number          -- desired fill level for that resource in the factory
//       requiresPowerApplication : bool -- true when target recipe needs PWR_OPERATE_FACTORY to satisfy level requirement
//       ingredients : [string]|undef  -- (multi-ingredient only) all input types to protect from egress
//   }
//   room.memory.factoryProductionTarget = string|null
//       Locks the factory onto one product (e.g. a bar) until the target
//       stock threshold is reached, preventing flip-flopping between minerals.
//       Same pattern as room.memory.productionTarget for labs.
//   room.memory.factoryPrepStage = {
//       product : string              -- the product being prepared
//       ingredients : [string]        -- ingredients needed for production
//   }
//       Tracks that we're in prep stage (requesting ingredients from other rooms)
//       before attempting production.
//   (null/undefined when factory has nothing to do)
//
// Deliverers read room.memory.factoryDemand using the same pattern as lab.mineralDemand

var market = require('market');

// Map of raw mineral -> tier-0 bar product.
// Values match the COMMODITIES constant keys used by factory.produce().
var MINERAL_TO_BAR = {
    'U': 'utrium_bar',
    'L': 'lemergium_bar',
    'K': 'keanium_bar',
    'Z': 'zynthium_bar',
    'O': 'oxidant',
    'H': 'reductant',
    'X': 'purifier',
    'G': 'ghodium_melt', 
    
};

// Minimum combined storage+terminal amount of a raw mineral before we start
// converting it to bars.
var PRODUCTION_THRESHOLD = 100000;
var LOW_LEVEL_BAR_TARGET = 300;
var HIGHER_TIER_PRODUCTION_THRESHOLD = 150;

// How much of the ingredient we want inside the factory at one time.
// Fallback only when recipe data is unavailable.
var FACTORY_INGREDIENT_WATERMARK = 300;

// Minimum energy in storage before we start making batteries (fallback when no mineral qualifies).
var BATTERY_ENERGY_THRESHOLD = 700000;
// When room energy drops below this lower watermark, reverse the energy recipe
// back into room energy before doing optional factory work.
// Keep this well below BATTERY_ENERGY_THRESHOLD to avoid flip-flopping.
var BATTERY_UNARCHIVE_ENERGY_THRESHOLD = 250000;
var BASIC_MINERAL_UNARCHIVE_THRESHOLD = 100; //  needs to be very low if will be below maxLab inventor level then it will be endless loop 
var FACTORY_SINGLE_INGREDIENT_BATCHES = 3;
var FACTORY_ENERGY_INPUT_BATCHES = 5;

// ---------- Higher-tier production ----------
// Recipes, component lists, levels and amounts are read from the runtime
// COMMODITIES constant — never hardcode recipe details.

// Minimum of each non-energy ingredient in storage+terminal+factory
// before we start producing a higher-tier product.
var HIGHER_TIER_INGREDIENT_THRESHOLD = 400;

// Higher-tier products tend to be produced one unit at a time, so keep only a
// small per-ingredient buffer inside the factory instead of hoarding 1000 units.
var HIGHER_TIER_INGREDIENT_BATCHES = 2;

// Products to attempt in priority order (highest tier first).
// Each entry: product key from COMMODITIES.
var HIGHER_TIER_PRODUCTS = [RESOURCE_COMPOSITE, RESOURCE_CRYSTAL, RESOURCE_WIRE, RESOURCE_SWITCH, RESOURCE_TRANSISTOR, RESOURCE_MICROCHIP, RESOURCE_DEVICE, RESOURCE_CIRCUIT,
     RESOURCE_CELL, RESOURCE_PHLEGM, RESOURCE_TISSUE, RESOURCE_MUSCLE, RESOURCE_ORGANOID, RESOURCE_ORGANISM];

// Rooms allowed to produce higher-tier products. Empty array = all rooms allowed.
var HIGHER_TIER_ROOMS = [];
var FACTORY_DEBUG_ROOM = 'E56S23f';

var roleFactory = {

    debugLog: function (roomName, message) {
        if (roomName !== FACTORY_DEBUG_ROOM)
            return;
        console.log('[factory:debug] ' + roomName + ' ' + message);
    },

    // -----------------------------------------------------------------------
    // Core entry point - call once per room per tick from main.js
    // -----------------------------------------------------------------------
    run: function (room) {
        if (!room.controller || !room.controller.my)
            return;

        return;
        
        var factory = room.factory;
        if (!factory) {
            return;
        }
        if (!factory.isActive()) {
            return;
        }

        var selected = this.selectProduction(room, factory);
        this.debugLog(room.name, 'selected=' + (selected ? selected.product : 'none'));

        if (!selected) {
            room.memory.factoryDemand = null;
            room.memory.factoryPrepStage = null;
            this.debugLog(room.name, 'idle: no production target');
            return;
        }

        // Staged approach: request ingredients from other rooms BEFORE production
        var allIngredientsReady = this.ensureIngredientsReady(room, factory, selected);

        if (!allIngredientsReady) {
            // Still gathering ingredients - keep demand fresh so deliverers know what to bring
            this.updateDemand(room, factory, selected);
            this.debugLog(room.name, 'prep: waiting ingredients for ' + selected.product);
            return;
        }

        // All ingredients are ready - proceed with production
        room.memory.factoryPrepStage = null;

        // Keep demand fresh for balanced deliveries
        this.updateDemand(room, factory, selected);
        this.debugLog(room.name, 'produce: ingredients ready for ' + selected.product);

        //console.log('[factory] ' + room.name + ' selected: ' + selected.product
        //    + ' | demand: ' + JSON.stringify(room.memory.factoryDemand));

        // Attempt to produce every tick; factory ignores ERR_BUSY/cooldown
        this.attemptProduce(factory, selected.product);
    },

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    // Staged approach: ensure all required ingredients are available before production.
    // Tries to share from other rooms first, then sets demand for deliverers.
    // Returns true when all ingredients are ready, false if still gathering.
    ensureIngredientsReady: function (room, factory, selected) {
        if (!COMMODITIES || !COMMODITIES[selected.product] || !COMMODITIES[selected.product].components)
            return false;

        var components = COMMODITIES[selected.product].components;
        var ingredientKeys = Object.keys(components);

        // First check: are all ingredients already in factory storage?
        var allReady = true;
        for (var i = 0; i < ingredientKeys.length; i++) {
            var ing = ingredientKeys[i];
            var needed = components[ing];
            if ((factory.store[ing] || 0) < needed) {
                allReady = false;
                break;
            }
        }

        if (allReady) {
            this.debugLog(room.name, 'prep-ready: all ingredients already in factory for ' + selected.product);
            return true;
        }

        // Not ready - try to gather from other rooms
        // Stage attempt: share from other rooms for each missing ingredient
        var acquiredAnything = false;

        for (var j = 0; j < ingredientKeys.length; j++) {
            var ing2 = ingredientKeys[j];
            var needed2 = components[ing2];
            var current = this.getTotalAmount(room, ing2);

            var desiredAmount = this.getSingleIngredientWatermark(selected.product, ing2);
            if (selected.ingredients) {
                desiredAmount = this.getHigherTierIngredientWatermark(selected.product, ing2);
            }

            if (current < desiredAmount) {
                var gapAmount = desiredAmount - current;
                var resTarget = selected.ingredients ? 0 : desiredAmount;

                this.debugLog(room.name, 'prep-missing: ' + ing2 + ' need=' + needed2 + ' desired=' + desiredAmount + ' have=' + current + ' gap=' + gapAmount);

                if (market.shareResourceFromOtherRooms(room, ing2, 0, gapAmount)) {
                    acquiredAnything = true;
                    this.debugLog(room.name, 'prep-share-ok: ' + ing2 + ' gap=' + gapAmount);
                } else {
                    this.debugLog(room.name, 'prep-share-miss: ' + ing2 + ' gap=' + gapAmount);
                }
            }
        }

        if (acquiredAnything) {
            this.debugLog(room.name, 'prep-progress: requested cross-room transfers');
        }

        return false; // Still gathering ingredients
    },

    getSingleNonEnergyIngredient: function (product) {
        if (!COMMODITIES || !COMMODITIES[product] || !COMMODITIES[product].components)
            return null;

        var components = COMMODITIES[product].components;
        var ingredients = Object.keys(components).filter(function (key) {
            return key !== RESOURCE_ENERGY;
        });

        return ingredients.length === 1 ? ingredients[0] : null;
    },

    getSingleNonEnergyIngredientInfo: function (product) {
        if (!COMMODITIES || !COMMODITIES[product] || !COMMODITIES[product].components)
            return null;

        var ingredient = this.getSingleNonEnergyIngredient(product);
        if (!ingredient)
            return null;

        var amount = COMMODITIES[product].components[ingredient] || 0;
        if (amount <= 0)
            return null;

        return {
            ingredient: ingredient,
            amount: amount
        };
    },

    getSingleIngredientWatermark: function (product, ingredient) {
        if (!COMMODITIES || !COMMODITIES[product] || !COMMODITIES[product].components)
            return FACTORY_INGREDIENT_WATERMARK;

        var amount = COMMODITIES[product].components[ingredient];
        if (!amount)
            return FACTORY_INGREDIENT_WATERMARK;

        if (ingredient === RESOURCE_ENERGY)
            return amount * FACTORY_ENERGY_INPUT_BATCHES;

        return amount * FACTORY_SINGLE_INGREDIENT_BATCHES;
    },

    getHigherTierIngredientWatermark: function (product, ingredient) {
        if (!COMMODITIES || !COMMODITIES[product] || !COMMODITIES[product].components)
            return FACTORY_INGREDIENT_WATERMARK;

        var amount = COMMODITIES[product].components[ingredient];
        if (!amount)
            return FACTORY_INGREDIENT_WATERMARK;

        if (ingredient === RESOURCE_ENERGY)
            return amount * FACTORY_ENERGY_INPUT_BATCHES;

        return amount * HIGHER_TIER_INGREDIENT_BATCHES;
    },

    getTotalAmount: function (room, resourceType) {
        return room.getResourceAmount(resourceType);
    },

    // Return { mineral, product } or { ingredients, product } for the best
    // recipe the factory should work on, or null if nothing qualifies.
    selectProduction: function (room, factory) {
        this.debugLog(room.name, 'selectProduction: evaluating options');

        // Emergency fallback: reverse the single-input energy recipe before any
        // optional production work when the room economy is running low.
        var energyIngredient = this.getSingleNonEnergyIngredient(RESOURCE_ENERGY);
        if (energyIngredient && COMMODITIES && COMMODITIES[RESOURCE_ENERGY] && COMMODITIES[RESOURCE_ENERGY].components) {
            var energyPerBatch = COMMODITIES[RESOURCE_ENERGY].components[energyIngredient] || 0;
            if (energyPerBatch > 0) {
                var energyTotal = this.getTotalAmount(room, RESOURCE_ENERGY);

                var ingredientTotal = this.getTotalAmount(room, energyIngredient) + (factory.store[energyIngredient] || 0);

                if (energyTotal < BATTERY_UNARCHIVE_ENERGY_THRESHOLD && ingredientTotal >= energyPerBatch) {
                    this.debugLog(room.name, 'selectProduction: emergency unarchive -> ' + RESOURCE_ENERGY + ' from ' + energyIngredient);
                    return { mineral: energyIngredient, product: RESOURCE_ENERGY };
                }
            }
        }
        
        for (var mineral in MINERAL_TO_BAR) {
            var total = this.getTotalAmount(room, mineral) + (factory.store[mineral] || 0);

            if (total < PRODUCTION_THRESHOLD)
                continue;

            var product = MINERAL_TO_BAR[mineral];

            // Make sure the COMMODITIES entry exists (factory level check not
            // needed for tier-0 bars, but guard anyway).
            if (!COMMODITIES || !COMMODITIES[product])
                continue;

            // Lock onto this mineral
            room.memory.factoryProductionTarget = mineral;
            this.debugLog(room.name, 'selectProduction: new tier0 lock -> ' + product + ' from ' + mineral + ' total=' + total);
            return { mineral: mineral, product: product };
        }

        // Emergency fallback: decompress tier-0 bars back into their basic
        // minerals if the minerals are below threshold (e.g. due to lab use)
        var lowestBasicMineral = null;
        var lowestBasicTotal = Infinity;
        for (var basicMineral in MINERAL_TO_BAR) {
            var basicInfo = this.getSingleNonEnergyIngredientInfo(basicMineral);
            if (!basicInfo)
                continue;

            var basicTotal = this.getTotalAmount(room, basicMineral);

            if (basicTotal >= BASIC_MINERAL_UNARCHIVE_THRESHOLD || basicTotal >= lowestBasicTotal)
                continue;

            var basicIngredientTotal = this.getTotalAmount(room, basicInfo.ingredient) + (factory.store[basicInfo.ingredient] || 0);

            if (basicIngredientTotal >= basicInfo.amount) {
                lowestBasicMineral = basicMineral;
                lowestBasicTotal = basicTotal;
            }
        }
        if (lowestBasicMineral) {
            this.debugLog(room.name, 'selectProduction: emergency basic restore -> ' + lowestBasicMineral);
            return {
                mineral: this.getSingleNonEnergyIngredient(lowestBasicMineral),
                product: lowestBasicMineral
            };
        }

        // --- Higher-tier products (composite, etc.) ---
        var higherResult = this.selectHigherTier(room, factory);
        if (higherResult) {
            this.debugLog(room.name, 'selectProduction: higher-tier -> ' + higherResult.product);
            return higherResult;
        }

        // --- Prerequisite bars for higher-tier ---
        // If the room is whitelisted for higher-tier production, prioritize
        // producing the bar ingredients that are below threshold before
        // falling through to the generic tier-0 loop.
        var prereqResult = this.selectPrerequisiteBar(room, factory);
        if (prereqResult) {
            this.debugLog(room.name, 'selectProduction: prerequisite bar -> ' + prereqResult.product + ' from ' + prereqResult.mineral);
            return prereqResult;
        }

        if (factory.level > 0) {
            this.debugLog(room.name, 'selectProduction: leveled factory skips tier0 production and waits for cross-room inputs');
            return null;
        }


        if (true) {
            var lowLevelBarResult = this.selectLowLevelBarProduction(room, factory);
            if (lowLevelBarResult) {
                this.debugLog(room.name, 'selectProduction: low-level bar -> ' + lowLevelBarResult.product + ' from ' + lowLevelBarResult.mineral);
                return lowLevelBarResult;
            }
        }

        // --- Tier-0: Raw mineral -> bar ---
        // Uses factoryProductionTarget to lock onto one bar until the raw
        // mineral drops below threshold (same pattern as lab productionTarget).
        // Check locked target first
        var locked = room.memory.factoryProductionTarget;
        if (locked && MINERAL_TO_BAR[locked]) {
            // locked is a raw mineral key (e.g. 'U')
            var lockedMineral = locked;
            var lockedProduct = MINERAL_TO_BAR[lockedMineral];
            var lockedTotal = this.getTotalAmount(room, lockedMineral) + (factory.store[lockedMineral] || 0);

            if (lockedTotal >= PRODUCTION_THRESHOLD && COMMODITIES && COMMODITIES[lockedProduct]) {
                this.debugLog(room.name, 'selectProduction: keep tier0 lock -> ' + lockedProduct + ' from ' + lockedMineral + ' total=' + lockedTotal);
                return { mineral: lockedMineral, product: lockedProduct };
            }
            // Threshold no longer met — clear lock
            this.debugLog(room.name, 'selectProduction: clear tier0 lock for ' + lockedMineral + ' total=' + lockedTotal);
            room.memory.factoryProductionTarget = null;
        }

        

        // Fallback: convert excess energy to batteries
        if (COMMODITIES && COMMODITIES[RESOURCE_BATTERY]) {
            var energyTotal = this.getTotalAmount(room, RESOURCE_ENERGY);
            if (energyTotal >= BATTERY_ENERGY_THRESHOLD) {
                this.debugLog(room.name, 'selectProduction: battery fallback energy=' + energyTotal);
                return { mineral: RESOURCE_ENERGY, product: RESOURCE_BATTERY };
            }
        }

        this.debugLog(room.name, 'selectProduction: no viable option');
        return null;
    },

    // Try each product in HIGHER_TIER_PRODUCTS (priority order).
    // Recipe data comes entirely from the runtime COMMODITIES constant.
    // Returns { ingredients, product, requiresPowerApplication } or null.
    selectHigherTier: function (room, factory) {
        if (!COMMODITIES) {
            this.debugLog(room.name, 'selectHigherTier: COMMODITIES unavailable');
            return null;
        }

        // Room whitelist check
        if (HIGHER_TIER_ROOMS.length > 0 && HIGHER_TIER_ROOMS.indexOf(room.name) === -1) {
            this.debugLog(room.name, 'selectHigherTier: room not whitelisted');
            return null;
        }

        this.debugLog(room.name, 'selectHigherTier: evaluating ' + HIGHER_TIER_PRODUCTS.length + ' products');

        for (var p = 0; p < HIGHER_TIER_PRODUCTS.length; p++) {
            var product = HIGHER_TIER_PRODUCTS[p];
            var recipe = COMMODITIES[product];
            var productTotal = this.getTotalAmount(room, product);
            
            // Returns true if the effects array is empty
            // overproduce to avoid loosing effect
            var doesntHaveEffect = !factory.effects;
            if(productTotal >= HIGHER_TIER_PRODUCTION_THRESHOLD) {
                this.debugLog(room.name, 'selectHigherTier: skip ' + product + ' stock=' + productTotal + ' threshold=' + HIGHER_TIER_PRODUCTION_THRESHOLD);
                continue;
            }
            if (!recipe || !recipe.components) {
                this.debugLog(room.name, 'selectHigherTier: skip ' + product + ' missing recipe/components');
                continue;
            }

            var recipeLevel = recipe.level > 0 ? recipe.level : 0;
            var factoryLevel = factory.level > 0 ? factory.level : 0;
            //if(factoryLevel == 5)
            //    factoryLevel = 0;
            
            if (factoryLevel > 0 && recipeLevel == 0) {
                this.debugLog(room.name, 'selectHigherTier: skip lower-tier product ' + product + ' for leveled factory');
                continue;
            }

            if(factoryLevel != recipeLevel) {
                this.debugLog(room.name, 'selectHigherTier: skip ' + product + ' factory level=' + factory.level + ' required=' + recipeLevel);
                continue;
            }

            // Check factory level requirement
            var requiresPowerApplication = recipeLevel > 0;

            if (factoryLevel > 0) {
                this.debugLog(room.name, 'selectHigherTier: choose ' + product + ' (staged ingredient requests enabled)');
                return {
                    ingredients: Object.keys(recipe.components),
                    product: product,
                    requiresPowerApplication: requiresPowerApplication
                };
            }

            // Verify every non-energy ingredient meets the threshold
            var components = recipe.components;
            var ingredientKeys = Object.keys(components);
            var viable = true;
            for (var i = 0; i < ingredientKeys.length; i++) {
                var ing = ingredientKeys[i];
                if (ing === RESOURCE_ENERGY)
                    continue; // energy is assumed available
                var total = this.getTotalAmount(room, ing) + (factory.store[ing] || 0);
                if (total < HIGHER_TIER_INGREDIENT_THRESHOLD) {
                    viable = false;
                    this.debugLog(room.name, 'selectHigherTier: skip ' + product + ' ingredient ' + ing + ' total=' + total + ' threshold=' + HIGHER_TIER_INGREDIENT_THRESHOLD);
                    break;
                }
            }
            if (!viable)
                continue;

            this.debugLog(room.name, 'selectHigherTier: choose ' + product + ' requiresPower=' + requiresPowerApplication);

            return {
                ingredients: ingredientKeys,
                product: product,
                requiresPowerApplication: requiresPowerApplication
            };
        }

        this.debugLog(room.name, 'selectHigherTier: no viable higher-tier product');

        return null;
    },

    // For level 0/undefined factories: keep small bar buffers only.
    // Returns { mineral, product } or null.
    selectLowLevelBarProduction: function (room, factory) {
        if (!COMMODITIES)
            return null;

        var locked = room.memory.factoryProductionTarget;
        if (locked && MINERAL_TO_BAR[locked]) {
            var lockedProduct = MINERAL_TO_BAR[locked];
            var lockedBarTotal = this.getTotalAmount(room, lockedProduct);
            if (lockedBarTotal < LOW_LEVEL_BAR_TARGET) {
                var lockedInfo = this.getSingleNonEnergyIngredientInfo(lockedProduct);
                if (lockedInfo && this.getTotalAmount(room, lockedInfo.ingredient) >= lockedInfo.amount) {
                    return { mineral: lockedInfo.ingredient, product: lockedProduct };
                }
            }
            room.memory.factoryProductionTarget = null;
        }

        var bestRaw = null;
        var bestProduct = null;
        var bestDeficit = 0;

        for (var raw in MINERAL_TO_BAR) {
            var product = MINERAL_TO_BAR[raw];
            var info = this.getSingleNonEnergyIngredientInfo(product);
            if (!info)
                continue;

            var barTotal = this.getTotalAmount(room, product);
            if (barTotal >= LOW_LEVEL_BAR_TARGET)
                continue;

            if (this.getTotalAmount(room, info.ingredient) < info.amount)
                continue;

            var deficit = LOW_LEVEL_BAR_TARGET - barTotal;
            if (deficit > bestDeficit) {
                bestDeficit = deficit;
                bestRaw = info.ingredient;
                bestProduct = product;
            }
        }

        if (bestRaw && bestProduct) {
            room.memory.factoryProductionTarget = bestRaw;
            return { mineral: bestRaw, product: bestProduct };
        }

        return null;
    },

    // When a higher-tier product is targeted but some bar ingredients are
    // below threshold, produce the missing bar.
    // Uses room.memory.factoryProductionTarget to lock onto one bar until
    // it reaches the threshold (same pattern as lab productionTarget).
    // Returns { mineral, product } or null.
    selectPrerequisiteBar: function (room, factory) {
        if (!COMMODITIES)
            return null;

        if (factory.level > 0) {
            this.debugLog(room.name, 'selectPrerequisiteBar: skipped for leveled factory (request lower-tier inputs from other rooms)');
            return null;
        }

        // Only for whitelisted rooms
        if (HIGHER_TIER_ROOMS.length > 0 && HIGHER_TIER_ROOMS.indexOf(room.name) === -1)
            return null;

        // If we have a locked target, check if it's still valid
        var locked = room.memory.factoryProductionTarget;
        if (locked) {
            var lockedTotal = this.getTotalAmount(room, locked) + (factory.store[locked] || 0);

            if (lockedTotal >= HIGHER_TIER_INGREDIENT_THRESHOLD) {
                // Target reached — clear lock and re-evaluate
                room.memory.factoryProductionTarget = null;
                locked = null;
            } else {
                // Still producing locked target — find its raw mineral
                var rawMineral = this.getSingleNonEnergyIngredient(locked);
                if (rawMineral) {
                    //console.log('[factory] ' + room.name + ' prereq (locked): producing ' + locked
                    //    + ' from ' + rawMineral + ' (bar stock: ' + lockedTotal + ')');
                    return { mineral: rawMineral, product: locked };
                }
                // Lock invalid — clear it
                room.memory.factoryProductionTarget = null;
                locked = null;
            }
        }

        // No lock — find the bar with the lowest stock below threshold
        var bestBar = null;
        var bestMineral = null;
        var lowestTotal = Infinity;

        for (var p = 0; p < HIGHER_TIER_PRODUCTS.length; p++) {
            var product = HIGHER_TIER_PRODUCTS[p];
            var recipe = COMMODITIES[product];
            if (!recipe || !recipe.components)
                continue;

            var components = recipe.components;
            for (var ing in components) {
                if (ing === RESOURCE_ENERGY)
                    continue;

                var total = this.getTotalAmount(room, ing) + (factory.store[ing] || 0);

                if (total >= HIGHER_TIER_INGREDIENT_THRESHOLD)
                    continue;

                var barRecipe2 = COMMODITIES[ing];
                if (!barRecipe2 || !barRecipe2.components)
                    continue;

                var rawMineral2 = this.getSingleNonEnergyIngredient(ing);
                if (!rawMineral2)
                    continue;

                if (total < lowestTotal) {
                    lowestTotal = total;
                    bestBar = ing;
                    bestMineral = rawMineral2;
                }
            }
        }

        if (bestBar && bestMineral) {
            // Lock onto this bar
            room.memory.factoryProductionTarget = bestBar;
            console.log('[factory] ' + room.name + ' prereq (new lock): producing ' + bestBar
                + ' from ' + bestMineral + ' (bar stock: ' + lowestTotal + ')');
            return { mineral: bestMineral, product: bestBar };
        }
        return null;
    },

    // Write factoryDemand so deliverers know which resource to bring in.
    // For multi-ingredient recipes (composite), cycle through whichever
    // ingredient the factory is lowest on.
    updateDemand: function (room, factory, selected) {
        // --- Multi-ingredient path (composite etc.) ---
        if (selected.ingredients) {
            var lowestType = null;
            var lowestRatio = Infinity;
            var lowestAmount = 0;
            for (var i = 0; i < selected.ingredients.length; i++) {
                var ing = selected.ingredients[i];
                var cur = factory.store[ing] || 0;
                var desiredAmount = this.getHigherTierIngredientWatermark(selected.product, ing);
                var ratio = cur / desiredAmount;
                if (ratio < lowestRatio) {
                    lowestRatio = ratio;
                    lowestType = ing;
                    lowestAmount = desiredAmount;
                }
            }
            room.memory.factoryDemand = {
                type: lowestType,
                amount: lowestAmount,
                requiresPowerApplication: !!selected.requiresPowerApplication,
                ingredients: selected.ingredients
            };
            return;
        }

        // --- Single-ingredient path (bars / battery) ---
        var watermark = this.getSingleIngredientWatermark(selected.product, selected.mineral);
        room.memory.factoryDemand = {
            type: selected.mineral,
            amount: watermark,
            requiresPowerApplication: !!selected.requiresPowerApplication
        };
    },

    // Call factory.produce() if ingredients are available.
    attemptProduce: function (factory, product) {
        if (factory.cooldown > 0)
            return;

        var components = COMMODITIES[product] && COMMODITIES[product].components;
        if (!components)
            return;

        // Verify the factory has all required components
        for (var resType in components) {
            var needed = components[resType];
            if ((factory.store[resType] || 0) < needed)
                return; // wait for deliverer to top up
        }

        var result = factory.produce(product);
        console.log('[factory] ' + factory.room.name + ' producing ' + product + ': ' + result);
        if (result !== OK && result !== ERR_BUSY && result !== ERR_TIRED && result !== ERR_NOT_ENOUGH_RESOURCES) {
            console.log('[factory] produce error in ' + factory.room.name + ' (' + product + '): ' + result);
        }
    }
};

module.exports = roleFactory;
