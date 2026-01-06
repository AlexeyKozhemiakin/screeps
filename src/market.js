module.exports = {
    shareEnergyInternal:function()
    {
        //if(Game.rooms['W59S33'].terminal.store.energy < 25000)
       //     this.shareResource("W59S34", "W59S33", RESOURCE_ENERGY, 5000);
        
        if(!Memory.orderCreated)
        {
            //var code = Game.market.createOrder(ORDER_SELL, RESOURCE_KEANIUM, 0.1, 1000, "W58S36");
            //Memory.orderCreated = code;
        }
        
        //this.shareResource("W57S37", "W59S36", RESOURCE_HYDROGEN, 30000);
        
        //this.shareResource("W59S36", "W57S37", RESOURCE_OXYGEN, 30000);
        
        //w39s34
        this.runReaction('5b17d4f32d8da349cebafd64', '5b182ff94226844ce49e4492', '5b29a4affd42b9421c858fc8');
        this.runReaction('5b17d4f32d8da349cebafd64', '5b182ff94226844ce49e4492', '5b2989c30a21ff7b08a1df0a');
        this.runReaction('5b17d4f32d8da349cebafd64', '5b182ff94226844ce49e4492', '5b29bee90a21ff7b08a1f3d2');
        this.runReaction('5b17d4f32d8da349cebafd64', '5b182ff94226844ce49e4492', '5b17e35bd8825d02ee334512');
        this.runReaction('5b17d4f32d8da349cebafd64', '5b182ff94226844ce49e4492', '5b407ba85bf4292255cc1c26');
        this.runReaction('5b17d4f32d8da349cebafd64', '5b182ff94226844ce49e4492', '5b40867f42afe02f25dfaae3');
        this.runReaction('5b17d4f32d8da349cebafd64', '5b182ff94226844ce49e4492', '5b4092c8f529e4540caa5843');
        this.runReaction('5b17d4f32d8da349cebafd64', '5b182ff94226844ce49e4492', '5b40c3fa51a4811718e0ecdc');
        
        //w39s36
        if(false)
        {
            this.runReaction('5b1805832bee550ad3d83114', '5b17ead465803e4ceedf4ce3', '5b17f890aea59953f2c2567c');
            this.runReaction('5b1805832bee550ad3d83114', '5b17ead465803e4ceedf4ce3', '5b2c338d471f1f07e1fdec00');
            this.runReaction('5b1805832bee550ad3d83114', '5b17ead465803e4ceedf4ce3', '5b2c50e791daf77f3d54be90');
            this.runReaction('5b1805832bee550ad3d83114', '5b17ead465803e4ceedf4ce3', '5b2c6c9b7e026c0db5af3ccd');
        }
        //w33s33
        this.runReaction('5b2e22f3d08a6b242e80f462', '5b2d2822e8d5d019c1d778dd', '5b2da2c599cf92267e52e751');
        this.runReaction('5b2e22f3d08a6b242e80f462', '5b2d2822e8d5d019c1d778dd', '5b18da96096f7b7725e72191');
        this.runReaction('5b2e22f3d08a6b242e80f462', '5b2d2822e8d5d019c1d778dd', '5b1839830fd9824ca2f9983b');
        this.runReaction('5b2e22f3d08a6b242e80f462', '5b2d2822e8d5d019c1d778dd', '5b1b5b0a55ce692984c3202a');
        
        //w57s37
        if(true)
        {
            this.runReaction('5b29a59e8d6e3c5e7f198aa2', '5b192f05c9146e7a0e5721a5', '5b2bceaf09eb8f19a329514b');
            this.runReaction('5b29a59e8d6e3c5e7f198aa2', '5b192f05c9146e7a0e5721a5', '5b1a69eb19b34857de65f28c');
            this.runReaction('5b29a59e8d6e3c5e7f198aa2', '5b192f05c9146e7a0e5721a5', '5b29891bb86a557126b055a6');
            this.runReaction('5b29a59e8d6e3c5e7f198aa2', '5b192f05c9146e7a0e5721a5', '5b19b3df0e7f4453ac02a199');
        }
        //w58s36
         this.runReaction('5b2db26618d810244ad0119b', '5b2d97788002ae26413f2e78', '5b2d44732dc90b07a9aaaf65');
         this.runReaction('5b2db26618d810244ad0119b', '5b2d97788002ae26413f2e78', '5b2d7a2b1b0a383917c617ca');
         this.runReaction('5b2db26618d810244ad0119b', '5b2d97788002ae26413f2e78', '5b2d5fea471f1f07e1fe5ba2');
         this.runReaction('5b2db26618d810244ad0119b', '5b2d97788002ae26413f2e78', '5b2d239421a6c0243b47fd3b');
    },
    
    shareResource(idFrom, idTo, res, amount)
    {
        var room = Game.rooms[idFrom];
        
        if(!room)
        {
            console.log("CODE ", idFrom);
            return;
        }
        
        if(!room.terminal)
            return;
            
        if(room.terminal.cooldown > 0)
            return;
    
        var code = room.terminal.send(res, amount, idTo, "bro help");
        //console.log("CODE ", code);
        if(OK != code)
        {
            console.log('failed to help', idFrom, "->", idTo, "with", amount, "error", code);
        }
        
    },
    
    runReaction(id1, id2, id3)
    {
        var lab1 = Game.getObjectById(id1);
        var lab2 = Game.getObjectById(id2);
        
        var lab3 = Game.getObjectById(id3);
        
        if(!lab3)
            return;
            
        if(lab3.cooldown > 0)
            return;
            
        var code =lab3.runReaction(lab1, lab2);
         if(OK != code && code!=-6)
        {
            console.log('failed to run reacton', lab1.room.name, code);
        }
    },
    
    shareResourcesInternal:function()
    {
         //this.shareResource("W57S35", "W59S33", RESOURCE_ZYNTHIUM, 1000);
         
         return;
         if(Game.rooms['W58S36'].terminal.store[RESOURCE_ZYNTHIUM_KEANITE] == undefined || Game.rooms['W58S36'].terminal.store[RESOURCE_ZYNTHIUM_KEANITE] < 10000)
            this.shareResource("W59S33", "W58S36", RESOURCE_ZYNTHIUM_KEANITE, 2000);
            
        if(Game.rooms['W58S36'].terminal.store[RESOURCE_UTRIUM_LEMERGITE] == undefined || Game.rooms['W58S36'].terminal.store[RESOURCE_UTRIUM_LEMERGITE] < 10000)
            this.shareResource("W59S34", "W58S36", RESOURCE_UTRIUM_LEMERGITE, 2000);
            
        if(Game.rooms['W58S36'].terminal.store[RESOURCE_UTRIUM_LEMERGITE] == undefined || Game.rooms['W58S36'].terminal.store[RESOURCE_UTRIUM_LEMERGITE] < 10000)
            this.shareResource("W59S34", "W58S36", RESOURCE_UTRIUM_LEMERGITE, 2000);
            
            
        if(Game.rooms['W59S34'].terminal.store[RESOURCE_UTRIUM] == undefined || Game.rooms['W59S34'].terminal.store[RESOURCE_UTRIUM] < 5000)
            this.shareResource("W55S33", "W59S34", RESOURCE_UTRIUM, 1000);
            
            
        if(Game.rooms['W57S37'].terminal.store[RESOURCE_GHODIUM] == undefined || Game.rooms['W57S37'].terminal.store[RESOURCE_GHODIUM] < 5000)
            this.shareResource("W58S36", "W57S37", RESOURCE_GHODIUM, 1000);
    },
    
    sellExcess:function()
    {
       return;
        if(Game.rooms['W57S37'].terminal.store[RESOURCE_HYDROGEN] > 150000)
            this.matchOrderInternal("W57S37", RESOURCE_HYDROGEN, 5000, ORDER_BUY);
            
        if(Game.rooms['W59S33'].terminal.store[RESOURCE_KEANIUM] > 150000)
            this.matchOrderInternal("W59S33", RESOURCE_KEANIUM, 5000, ORDER_BUY);
            
        if(Game.rooms['W58S36'].terminal.store[RESOURCE_KEANIUM] > 100000)
            this.matchOrderInternal("W58S36", RESOURCE_KEANIUM, 5000, ORDER_BUY);
    },
    
    buyDemand:function()
    {
        return;
        
        if(Game.rooms['W59S33'].terminal.store[RESOURCE_ZYNTHIUM] == undefined || Game.rooms['W59S33'].terminal.store[RESOURCE_ZYNTHIUM] < 5000)
            this.matchOrderInternal("W59S33", RESOURCE_ZYNTHIUM, 1000, ORDER_SELL);
        
        
        ///if(Game.rooms['W59S34'].terminal.store[RESOURCE_UTRIUM] == undefined || Game.rooms['W59S34'].terminal.store[RESOURCE_UTRIUM] < 10000)   
       //     this.matchOrderInternal("W59S34", RESOURCE_UTRIUM, 1000, ORDER_SELL);
    }
    ,
    
    matchOrderInternal:function(targetRoom, resType, amount, orderType)
    {
        if(Game.rooms[targetRoom].terminal.cooldown > 0)
            return;
            
        const orders = Game.market.getAllOrders({type: orderType, resourceType: resType});
        const energyPrice = 0.06; // get recent actual
        
        getTotalPrice =  function(o) 
        {
            const N = 10000;//to avoid rounding error
            const energyAmount = Game.market.calcTransactionCost(N, o.roomName, targetRoom)/N;
            const transferPrice = energyAmount * energyPrice;
            
            if(orderType == ORDER_SELL)
                return o.price + transferPrice;
            else
                return o.price - transferPrice;
        }
        
        var sorted = _.sortBy(orders, getTotalPrice);
        
        if(orderType == ORDER_BUY)
            sorted = sorted.reverse();
        
        console.log(targetRoom, resType, amount, orderType, sorted.length);
        for(id in sorted)
        {
            
            var order = sorted[id];
            if(order.remainingAmount == 0)
                continue;
            console.log(getTotalPrice(order), JSON.stringify(order));
            
            //continue;
            
            var dealAmount = Math.min(amount, order.remainingAmount);
            var code = Game.market.deal(order.id, dealAmount, targetRoom);
            if(OK == code)
            {
                
            }
            else
            {
                console.log('failed to deal a trade', code);
            }
            break;
            
        }
    }
};