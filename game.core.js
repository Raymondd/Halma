
//The main update loop runs on requestAnimationFrame,
//Which falls back to a setTimeout loop on the server
//Code below is from Three.js, and sourced from links below

    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

    // requestAnimationFrame polyfill by Erik Möller
    // fixes from Paul Irish and Tino Zijdel

var frame_time = 1000/1000; // run the local game at 16ms/ 60hz
if('undefined' != typeof(global)) frame_time = 1000; //on server we run at 45ms, 22hz

( function () {

    var lastTime = 0;
    var vendors = [ 'ms', 'moz', 'webkit', 'o' ];

    for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++ x ) {
        window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
        window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
    }

    if ( !window.requestAnimationFrame ) {
        window.requestAnimationFrame = function ( callback, element ) {
            var currTime = Date.now(), timeToCall = Math.max( 0, frame_time - ( currTime - lastTime ) );
            var id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if ( !window.cancelAnimationFrame ) {
        window.cancelAnimationFrame = function ( id ) { clearTimeout( id ); };
    }

}() );

        //Now the main game class. This gets created on
        //both server and client. Server creates one for
        //each game that is hosted, and client creates one
        //for itself to play the game.

        /* The game_core class */

        var game_core = function(game_instance){

            //Store the instance, if any
            this.instance = game_instance;
            //Store a flag if we are the server
            this.server = this.instance !== undefined;

        this.kBoardWidth = 18; //change to 0 to use with Initialization form
        this.kBoardHeight = 18; //change to 0 to use with Initialization form
        this.kPieceWidth = 20;
        this.kPieceHeight = 20;
        this.kPixelWidth = 1 + (this.kBoardWidth * this.kPieceWidth); // change to 0 to use with initialization form
        this.kPixelHeight = 1 + (this.kBoardHeight * this.kPieceHeight); // change to 0 to use with initialization form

            //We create a player set, passing them
            //the game that is running them, as well
            if(this.server) {

                this.players = {
                    self : new game_player(this,this.instance.player_host),
                    other : new game_player(this,this.instance.player_client)
                };

                this.players.self.pos = {x:20,y:20};

            } else {

                this.players = {
                    self : new game_player(this),
                    other : new game_player(this)
                };
            }

            //Start a fast paced timer for measuring time easier
            this.create_timer();

            //Client specific initialisation
            if(!this.server) {


                //Create the default configuration settings
                this.client_create_configuration();

                //A list of recent server updates we interpolate across
                //This is the buffer that is the driving factor for our networking
                this.server_updates = [];

                //Connect to the socket.io server!
                this.client_connect_to_server();

                //We start pinging the server to determine latency
                this.client_create_ping_timer();


            //Set their colors from the storage or locally
            this.color = '#cc8822' ;
            this.players.self.color = this.color;
            this.isHostsTurn = true;



        } else { //if !server

            this.server_time = 0;
            this.laststate = {};

        }

    }; //game_core.constructor

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if( 'undefined' != typeof global ) {
    module.exports = global.game_core = game_core;
}

/*
    Helper functions for the game code

        Here we have some common maths and game related code to make working with 2d vectors easy,
        as well as some helpers for rounding numbers to fixed point.

        */

    // (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
    Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
    //For the server, we need to cancel the setTimeout that the polyfill creates
    game_core.prototype.stop_update = function() {  window.cancelAnimationFrame( this.updateid );  };


/*
    The player class

        A simple class to maintain state of a player on screen,
        as well as to draw that state when required.
        */

        var game_player = function( game_instance, player_instance ) {

            //Store the instance, if any
            this.instance = player_instance;
            this.game = game_instance;

            //Set up initial values for our state information
            this.pos = { x:200, y:400 };
            this.size = { x:16, y:16, hx:8, hy:8 };
            
            this.state = 'not-connected';
            this.color = 'grey';
            
            this.info_color = 'white';
            this.id = '';

            //Our local history of inputs
            this.inputs = [];

            //The 'host' of a game gets created with a player instance since
            //the server already knows who they are. If the server starts a game
            //with only a host, the other player is set up in the 'else' below
            if(player_instance) {
                this.pos = { x:200, y:400 };
            } else {
                this.pos = { x:200, y:400 };
            }


    }; //game_player.constructor


    game_player.prototype.draw = function(){


            //Set the color for this player
            game.ctx.fillStyle = this.color;

            //Draw a rectangle for us
            game.ctx.fillRect(this.pos.x - this.size.hx, this.pos.y - this.size.hy, this.size.x, this.size.y);

            //Draw a status update
            game.ctx.fillStyle = this.color;
            game.ctx.fillText(this.state, this.pos.x+10, this.pos.y + 4);

    }; //game_player.draw



    game_core.prototype.drawBoard =function() {

        this.ctx.clearRect(0, 0, this.kPixelWidth, this.kPixelHeight);

        this.ctx.beginPath();

        /* vertical lines */
        for (var x = 0; x <= this.kPixelWidth; x += this.kPieceWidth) {
            this.ctx.moveTo(0.5 + x, 0);
            this.ctx.lineTo(0.5 + x, this.kPixelHeight);
        }

        /* horizontal lines */
        for (var y = 0; y <= this.kPixelHeight; y += this.kPieceHeight) {
            this.ctx.moveTo(0, 0.5 + y);
            this.ctx.lineTo(this.kPixelWidth, 0.5 + y);
        }

        /* draw it! */
        this.ctx.strokeStyle = "darkgrey";
        this.ctx.stroke();

    //this.a = false;

            if(!this.a) {
                if(this.players.self.pieces) {

                    this.a = true;    

                    console.log(this.players);   
                //console.table(this.players.self.pieces);
                //console.table(this.players.other.pieces);
            }
        }

        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(3 * this.kPieceWidth, 0);
        this.ctx.lineTo(3 * this.kPieceWidth,3 * this.kPieceWidth);
        this.ctx.lineTo(0,3 * this.kPieceWidth);
        this.ctx.lineTo(0, 0);

        this.ctx.strokeStyle = "green";
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo((this.kBoardWidth - 3) * this.kPieceWidth, 0 * this.kPieceWidth);
        this.ctx.lineTo((this.kBoardWidth - 0) * this.kPieceWidth, 0 * this.kPieceWidth);
        this.ctx.lineTo((this.kBoardWidth - 0) * this.kPieceWidth, 3 * this.kPieceWidth);
        this.ctx.lineTo((this.kBoardWidth - 3) * this.kPieceWidth, 3 * this.kPieceWidth);
        this.ctx.lineTo((this.kBoardWidth - 3) * this.kPieceWidth, 0 * this.kPieceWidth);
        
        this.ctx.strokeStyle = "green";
        this.ctx.stroke();

     // draw all pieces 
     if(this.players.self.pieces) {

        for (var i = 0; i < this.players.self.pieces.length; i++) {
            this.drawPiece(this.players.self.pieces[i], this.players.self.color);
        }
    }

    if(this.players.other.pieces) {
        for (var i = 0; i < this.players.other.pieces.length; i++) {
            this.drawPiece(this.players.other.pieces[i], this.players.other.color);
        }
    }

};

game_core.prototype.drawPiece =function(piece, color) {


    var x = piece.x;
    var y = piece.y;
    var x = (x * this.kPieceWidth) + (this.kPieceWidth/2);
    var y = (y * this.kPieceWidth) + (this.kPieceWidth/2);
    var radius = (this.kPieceWidth/2) - (this.kPieceWidth/6);

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI*2, false);
    this.ctx.closePath();
    this.ctx.strokeStyle = piece.selected ? 'black' : color;
    this.ctx.lineWidth = 4;
    this.ctx.stroke();
    this.ctx.lineWidth = 1;

    this.ctx.fillStyle = color;
    this.ctx.fill();
}

/*

 Common functions
 
    These functions are shared between client and server, and are generic
    for the game state. The client functions are client_* and server functions
    are server_* so these have no prefix.

*/

    //Main update loop
    game_core.prototype.update = function(t) {

        //Work out the delta time
        this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016;

        //console.log(this.dt);

        //Store the last frame time
        this.lastframetime = t;

        //Update the game specifics
        if(!this.server) {
            this.client_update();
        } else {
            this.server_update();
        }

        //schedule the next update
        this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );

}; //game_core.update

game_core.prototype.setup = function() {

this.viewport.addEventListener('click', this.onClick.bind(this), false);

};


game_core.prototype.getCursorPosition = function(e) {

    var x;
    var y;
    if (e.pageX != undefined && e.pageY != undefined) {
        
    x = e.pageX;
    y = e.pageY;
    }
    else
    {
        
    x = e.clientX + document.body.scrollLeft +
            document.documentElement.scrollLeft;
    y = e.clientY + document.body.scrollTop +
            document.documentElement.scrollTop;
    }

    x -= this.viewport.offsetLeft;
    y -= this.viewport.offsetTop;

    
    var cell = { y:Math.floor(y/this.kPieceHeight),
        x: Math.floor(x/this.kPieceWidth)
    };
                  
    return cell;
};

/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
// CLICK HANLER
// SEND MESSAGES BETWEEN CLIENTS HERE
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
game_core.prototype.onClick = function(e) {


    var cell = this.getCursorPosition(e);    
    
    console.log(cell);
    console.log(this.isCurrentPlayersTurn());

    
    if(this.isCurrentPlayersTurn() || true) {

        var matchingCell = _.find(this.players.self.pieces, function(p)
         { return p.x == cell.x && p.y == cell.y; });

        console.log(matchingCell);
        if(matchingCell) {
            // clicked on a piece
            this.clickOnPiece(matchingCell);
        } else {
            this.clickOnEmpty(cell);
        }
    }


    this.client_handle_input();
};

game_core.prototype.resetSelected = function() {
    _.each(this.players.self.pieces, function(cell) {
        cell.selected = false;
    });
};

game_core.prototype.clickOnPiece = function(cell) {

    if(this.players.self.pieces.selectedPiece && this.players.self.pieces.selectedPiece == cell) {
        this.resetSelected();
        this.players.self.pieces.selectedPiece = null;
    } else {
    this.resetSelected();
    cell.selected = true;
    this.players.self.pieces.selectedPiece = cell;    
    }
};

game_core.prototype.clickOnEmpty = function(cell) {
    if(this.players.self.pieces.selectedPiece) {

        if (this.players.self.pieces.selectedPiece.x == cell.x &&
            this.players.self.pieces.selectedPiece.y == cell.y)
        {
            this.players.self.pieces.selectedPiece.selected = false;
            this.players.self.pieces.selectedPiece = null;
        } else {

        this.players.self.pieces.selectedPiece.x = cell.x;
        this.players.self.pieces.selectedPiece.y = cell.y;
        }
    }
};

game_core.prototype.isCurrentPlayersTurn = function() {
    if(this.players.self.host) {
        return this.isHostsTurn;
    } else {
        return !this.isHostsTurn;
    }   
}

/*

 Server side functions
 
    These functions below are specific to the server side only,
    and usually start with server_* to make things clearer.

    */



    //Makes sure things run smoothly and notifies clients of changes
    //on the server side
    game_core.prototype.server_update = function(){

        //Update the state of our local clock to match the timer
        this.server_time = this.local_time;

        //Make a snapshot of the current state, for updating the clients
        this.laststate = {
        hp  : this.players.self.pos,                //'host position', the game creators position
        cp  : this.players.other.pos,               //'client position', the person that joined, their position
        his : this.players.self.last_input_seq,     //'host input sequence', the last input we processed for the host
        cis : this.players.other.last_input_seq,    //'client input sequence', the last input we processed for the client
        t   : this.server_time                      // our current local time on the server
    };

        //Send the snapshot to the 'host' player
        if(this.players.self.instance) {
            this.players.self.instance.emit( 'onserverupdate', this.laststate );
        }

        //Send the snapshot to the 'client' player
        if(this.players.other.instance) {
            this.players.other.instance.emit( 'onserverupdate', this.laststate );
        }

}; //game_core.server_update


game_core.prototype.handle_server_input = function(client, input, input_time, input_seq) {

        //Fetch which client this refers to out of the two
        var player_client =
        (client.userid == this.players.self.instance.userid) ?
        this.players.self : this.players.other;

        //Store the input on the player instance for processing in the physics loop
        player_client.inputs.push({inputs:input, time:input_time, seq:input_seq});

}; //game_core.handle_server_input


/*

 Client side functions

    These functions below are specific to the client side only,
    and usually start with client_* to make things clearer.

    */

    game_core.prototype.client_handle_input = function(){


    console.log('client handle input');

    var message = 'z.' + JSON.stringify(this.players.self.pieces);

    console.log(message);
    this.socket.send(message);


}; //game_core.client_handle_input

game_core.prototype.client_onserverupdate_recieved = function(data){

            //Lets clarify the information we have locally. One of the players is 'hosting' and
            //the other is a joined in client, so we name these host and client for making sure
            //the positions we get from the server are mapped onto the correct local sprites
            var player_host = this.players.self.host ?  this.players.self : this.players.other;
            var player_client = this.players.self.host ?  this.players.other : this.players.self;
            var this_player = this.players.self;

            //Store the server time (this is offset by the latency in the network, by the time we get it)
            this.server_time = data.t;
            //Update our local offset time from the last server update
            this.client_time = this.server_time - (this.net_offset/1000);

            //One approach is to set the position directly as the server tells you.
            //This is a common mistake and causes somewhat playable results on a local LAN, for example,
            //but causes terrible lag when any ping/latency is introduced. The player can not deduce any
            //information to interpolate with so it misses positions, and packet loss destroys this approach
            //even more so. See 'the bouncing ball problem' on Wikipedia.

            if(this.naive_approach) {

                if(data.hp) {
                    player_host.pos = this.pos(data.hp);
                }

                if(data.cp) {
                    player_client.pos = this.pos(data.cp);
                }

            } else {

                //Cache the data from the server,
                //and then play the timeline
                //back to the player with a small delay (net_offset), allowing
                //interpolation between the points.
                this.server_updates.push(data);

                //we limit the buffer in seconds worth of updates
                //60fps*buffer seconds = number of samples
                if(this.server_updates.length >= ( 60*this.buffer_size )) {
                    this.server_updates.splice(0,1);
                }

                //We can see when the last tick we know of happened.
                //If client_time gets behind this due to latency, a snap occurs
                //to the last tick. Unavoidable, and a reallly bad connection here.
                //If that happens it might be best to drop the game after a period of time.
                this.oldest_tick = this.server_updates[0].t;

        } //non naive

}; //game_core.client_onserverupdate_recieved

game_core.prototype.drawTurnMessage = function() {

    this.ctx.fillStyle = 'Black';
    var text = this.players.self.host ? 'Your turn' : "Opponent's turn";
    this.ctx.fillText(text, 16 , 400);
};


game_core.prototype.client_update = function() {


        //Clear the screen area
        this.ctx.clearRect(0,0,360,450);

        this.drawTurnMessage();

        this.drawBoard();

        //Now they should have updated, we can draw the entity
        this.players.other.draw();

        //And then we finally draw
        this.players.self.draw();

}; //game_core.update_client

game_core.prototype.create_timer = function(){
    setInterval(function(){
        this._dt = new Date().getTime() - this._dte;
        this._dte = new Date().getTime();
        this.local_time += this._dt/1000.0;
    }.bind(this), 1000);
}



game_core.prototype.client_create_ping_timer = function() {

        //Set a ping timer to 1 second, to maintain the ping/latency between
        //client and server and calculated roughly how our connection is doing

        setInterval(function(){

            this.last_ping_time = new Date().getTime() - this.fake_lag;
            this.socket.send('p.' + (this.last_ping_time) );

        }.bind(this), 1000);

}; //game_core.client_create_ping_timer


game_core.prototype.client_create_configuration = function() {

    this.input_seq = 0;                 //When predicting client inputs, we store the last input as a sequence number
    this.net_latency = 0.001;           //the latency between the client and the server (ping/2)
    this.net_ping = 0.001;              //The round trip time from here to the server,and back
    this.last_ping_time = 0.001;        //The time we last sent a ping
    this.fake_lag = 0;                //If we are simulating lag, this applies only to the input client (not others)
    this.fake_lag_time = 0;

    this.net_offset = 100;              //100 ms latency between server and client interpolation for other clients
    this.buffer_size = 2;               //The size of the server history to keep for rewinding/interpolating.
    this.target_time = 0.01;            //the time where we want to be in the server timeline
    this.oldest_tick = 0.01;            //the last time tick we have available in the buffer

    this.client_time = 0.01;            //Our local 'clock' based on server time - client interpolation(net_offset).
    this.server_time = 0.01;            //The time the server reported it was at, last we heard from it
    
    this.dt = 0.016;                    //The time that the last frame took to run
    this.fps = 0;                       //The current instantaneous fps (1/this.dt)
    this.fps_avg_count = 0;             //The number of samples we have taken for fps_avg
    this.fps_avg = 0;                   //The current average fps displayed in the debug UI
    this.fps_avg_acc = 0;               //The accumulation of the last avgcount fps samples

    this.lit = 0;
    this.llt = new Date().getTime();

};//game_core.client_create_configuration



game_core.prototype.client_reset_positions = function() {

    var player_host = this.players.self.host ?  this.players.self : this.players.other;
    var player_client = this.players.self.host ?  this.players.other : this.players.self;

        //Host always spawns at the top left.
        player_host.pos = { x:20,y:420 };
        player_client.pos = { x:20, y:440 };


}; //game_core.client_reset_positions

game_core.prototype.client_onreadygame = function(data) {

    var server_time = parseFloat(data.replace('-','.'));

    var player_host = this.players.self.host ?  this.players.self : this.players.other;
    var player_client = this.players.self.host ?  this.players.other : this.players.self;

    this.local_time = server_time + this.net_latency;
    
    //console.log('server time is about ' + this.local_time);

    //Store their info colors for clarity. server is always blue
    player_host.color = 'red';
    player_client.color = 'blue';

    player_host.pieces = [
    {x: 0, y: this.kBoardHeight - 1},
    {x: 0, y: this.kBoardHeight - 2},
    {x: 0, y: this.kBoardHeight - 3},
    //{x: 0, y: this.kBoardHeight - 4},

    {x: 1, y: this.kBoardHeight - 1},
    {x: 1, y: this.kBoardHeight - 2},
    {x: 1, y: this.kBoardHeight - 3},
    //{x: 1, y: this.kBoardHeight - 4},

    {x: 2, y: this.kBoardHeight - 1},
    {x: 2, y: this.kBoardHeight - 2},
    {x: 2, y: this.kBoardHeight - 3},
    //{x: 2, y: this.kBoardHeight - 4},
    ];

    player_client.pieces = [
    {x: this.kBoardWidth - 1, y: this.kBoardHeight - 1},
    {x: this.kBoardWidth - 1, y: this.kBoardHeight - 2},
    {x: this.kBoardWidth - 1, y: this.kBoardHeight - 3},
    //{x: this.kBoardWidth - 1, y: this.kBoardHeight - 4},

    {x: this.kBoardWidth - 2, y: this.kBoardHeight - 1},
    {x: this.kBoardWidth - 2, y: this.kBoardHeight - 2},
    {x: this.kBoardWidth - 2, y: this.kBoardHeight - 3},
    //{x: this.kBoardWidth - 2, y: this.kBoardHeight - 4},

    {x: this.kBoardWidth - 3, y: this.kBoardHeight - 1},
    {x: this.kBoardWidth - 3, y: this.kBoardHeight - 2},
    {x: this.kBoardWidth - 3, y: this.kBoardHeight - 3},
    //{x: this.kBoardWidth - 3, y: this.kBoardHeight - 4},
    ];

        //Update their information
        player_host.state = 'Hosting..';
        player_client.state = 'Joined..';

        this.players.self.state = 'YOU: ' + (this.players.self.host ? 'RED' : 'BLUE');

}; //client_onreadygame

game_core.prototype.client_onjoingame = function(data) {

        //We are not the host
        this.players.self.host = false;
        //Update the local state
        this.players.self.state = 'connected.joined.waiting';
        this.players.self.info_color = '#00bb00';

        //Make sure the positions match servers and other clients
        this.client_reset_positions();

}; //client_onjoingame

game_core.prototype.client_onhostgame = function(data) {

        //The server sends the time when asking us to host, but it should be a new game.
        //so the value will be really small anyway (15 or 16ms)
        var server_time = parseFloat(data.replace('-','.'));

        //Get an estimate of the current time on the server
        this.local_time = server_time + this.net_latency;

        //Set the flag that we are hosting, this helps us position respawns correctly
        this.players.self.host = true;

        //Update debugging information to display state
        this.players.self.state = 'hosting.waiting for a player';
        this.players.self.info_color = '#cc0000';

        //Make sure we start in the correct place as the host.
        this.client_reset_positions();

}; //client_onhostgame

game_core.prototype.client_onconnected = function(data) {

        //The server responded that we are now in a game,
        //this lets us store the information about ourselves and set the colors
        //to show we are now ready to be playing.
        this.players.self.id = data.id;
        this.players.self.info_color = '#cc0000';
        this.players.self.state = 'connected';
        this.players.self.online = true;

}; //client_onconnected

game_core.prototype.client_onping = function(data) {

    this.net_ping = new Date().getTime() - parseFloat( data );
    this.net_latency = this.net_ping/2;

}; //client_onping

game_core.prototype.client_onnetmessage = function(data) {

    var commands = data.split('.');
    var command = commands[0];
    var subcommand = commands[1] || null;
    var commanddata = commands[2] || null;

    switch(command) {

        case 'z' : // Make a move
                var newPositions = JSON.parse(subcommand);
                console.log(newPositions);
                this.players.other.pieces = newPositions;
                break;

        case 's': //server message

        switch(subcommand) {

                case 'h' : //host a game requested
                this.client_onhostgame(commanddata); break;

                case 'j' : //join a game requested
                this.client_onjoingame(commanddata); break;

                case 'r' : //ready a game requested
                this.client_onreadygame(commanddata); break;

                case 'e' : //end game requested
                this.client_ondisconnect(commanddata); break;

                case 'p' : //server ping
                this.client_onping(commanddata); break;

                case 'z' : // Make a move
                console.log('received Z'); break;

            } //subcommand

        break; //'s'
    } //command

}; //client_onnetmessage

game_core.prototype.client_ondisconnect = function(data) {

        //When we disconnect, we don't know if the other player is
        //connected or not, and since we aren't, everything goes to offline

        this.players.self.info_color = 'rgba(255,255,255,0.1)';
        this.players.self.state = 'not-connected';
        this.players.self.online = false;

        this.players.other.info_color = 'rgba(255,255,255,0.1)';
        this.players.other.state = 'not-connected';

}; //client_ondisconnect

game_core.prototype.client_connect_to_server = function() {

            //Store a local reference to our connection to the server
            this.socket = io.connect();

            //When we connect, we are not 'connected' until we have a server id
            //and are placed in a game by the server. The server sends us a message for that.
            this.socket.on('connect', function(){
                this.players.self.state = 'connecting';
            }.bind(this));

            //Sent when we are disconnected (network, server down, etc)
            this.socket.on('disconnect', this.client_ondisconnect.bind(this));
            //Sent each tick of the server simulation. This is our authoritive update
            this.socket.on('onserverupdate', this.client_onserverupdate_recieved.bind(this));
            //Handle when we connect to the server, showing state and storing id's.
            this.socket.on('onconnected', this.client_onconnected.bind(this));
            //On error we just show that we are not connected for now. Can print the data.
            this.socket.on('error', this.client_ondisconnect.bind(this));
            //On message from the server, we parse the commands and send it to the handlers
            this.socket.on('message', this.client_onnetmessage.bind(this));

}; //game_core.client_connect_to_server


game_core.prototype.client_draw_info = function() {

        
        //Draw some information for the host
        this.ctx.fillStyle = 'white';
        var text = this.players.self.host ? 'Hosting' : 'Connected';
        this.ctx.fillText(text, 10 , 465);
    };