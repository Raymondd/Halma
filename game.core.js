//The main update loop runs on requestAnimationFrame,
//Which falls back to a setTimeout loop on the server
//Code below is from Three.js, and sourced from links below

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller
// fixes from Paul Irish and Tino Zijdel

var frame_time = 1000 / 1000; // run the local game at 16ms/ 60hz
if ('undefined' != typeof(global)) frame_time = 1000; //on server we run at 45ms, 22hz

( function () {

    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];

    for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function (callback, element) {
            var currTime = Date.now(), timeToCall = Math.max(0, frame_time - ( currTime - lastTime ));
            var id = window.setTimeout(function () {
                callback(currTime + timeToCall);
            }, timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function (id) {
            clearTimeout(id);
        };
    }

}() );

//Now the main game class. This gets created on
//both server and client. Server creates one for
//each game that is hosted, and client creates one
//for itself to play the game.

/* The game_core class */

var game_core = function (game_instance) {

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
    if (this.server) {

        this.players = {
            self: new game_player(this, this.instance.player_host),
            other: new game_player(this, this.instance.player_client)
        };

    } else {

        this.players = {
            self: new game_player(this),
            other: new game_player(this)
        };
    }

    //Client specific initialisation
    if (!this.server) {


        //Create the default configuration settings
        this.client_create_configuration();

        //A list of recent server updates we interpolate across
        //This is the buffer that is the driving factor for our networking
        this.server_updates = [];

        //Connect to the socket.io server!
        this.client_connect_to_server();

        //We start pinging the server to determine latency
        this.client_create_ping_timer();


        //Set their colors locally
        this.color = '#cc8822';
        this.players.self.color = this.color;
        this.isHostsTurn = true;


    } else { //if !server

        this.server_time = 0;
        this.laststate = {};

    }

}; //game_core.constructor

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if ('undefined' != typeof global) {
    module.exports = global.game_core = game_core;
}

//For the server, we need to cancel the setTimeout that the polyfill creates
game_core.prototype.stop_update = function () {
    window.cancelAnimationFrame(this.updateid);
};


/*
 The player class

 A simple class to maintain state of a player on screen,
 as well as to draw that state when required.
 */

var game_player = function (game_instance, player_instance) {

    //Store the instance, if any
    this.instance = player_instance;
    this.game = game_instance;

    //Set up initial values for our state information
    this.pos = {x: 200, y: 400};
    this.size = {x: 16, y: 16, hx: 8, hy: 8};

    this.state = 'not-connected';
    this.color = 'grey';

    this.info_color = 'white';
    this.id = '';

    //Our local history of inputs
    this.inputs = [];

    //The 'host' of a game gets created with a player instance since
    //the server already knows who they are. If the server starts a game
    //with only a host, the other player is set up in the 'else' below
    if (player_instance) {
        this.pos = {x: 200, y: 400};
    } else {
        this.pos = {x: 200, y: 400};
    }


}; //game_player.constructor


game_player.prototype.draw = function () {


    //Set the color for this player
    game.ctx.fillStyle = this.color;

    //Draw a rectangle for us
    game.ctx.fillRect(this.pos.x - this.size.hx, this.pos.y - this.size.hy, this.size.x, this.size.y);

    //Draw a status update
    game.ctx.fillStyle = this.color;
    game.ctx.fillText(this.state, this.pos.x + 10, this.pos.y + 4);

}; //game_player.draw


game_core.prototype.drawBoard = function () {

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

    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(3 * this.kPieceWidth, 0);
    this.ctx.lineTo(3 * this.kPieceWidth, 3 * this.kPieceWidth);
    this.ctx.lineTo(0, 3 * this.kPieceWidth);
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
    if (this.players.self.pieces) {
        for (var i = 0; i < this.players.self.pieces.length; i++) {
            this.drawPiece(this.players.self.pieces[i], this.players.self.color);
        }
    }

    if (this.players.other.pieces) {
        for (var i = 0; i < this.players.other.pieces.length; i++) {
            this.drawPiece(this.players.other.pieces[i], this.players.other.color);
        }
    }

};

game_core.prototype.drawPiece = function (piece, color) {


    var x = piece.x;
    var y = piece.y;
    var x = (x * this.kPieceWidth) + (this.kPieceWidth / 2);
    var y = (y * this.kPieceWidth) + (this.kPieceWidth / 2);
    var radius = (this.kPieceWidth / 2) - (this.kPieceWidth / 6);

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2, false);
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
game_core.prototype.update = function (t) {

    //Store the last frame time
    this.lastframetime = t;

    //Update the game specifics
    if (!this.server) {
        this.client_update();
    } else {
        this.server_update();
    }

    //schedule the next update
    this.updateid = window.requestAnimationFrame(this.update.bind(this), this.viewport);

}; //game_core.update

game_core.prototype.setup = function () {
    this.viewport.addEventListener('click', this.onClick.bind(this), false);
};


game_core.prototype.getCursorPosition = function (e) {

    var x;
    var y;
    if (e.pageX != undefined && e.pageY != undefined) {

        x = e.pageX;
        y = e.pageY;
    }
    else {

        x = e.clientX + document.body.scrollLeft +
        document.documentElement.scrollLeft;
        y = e.clientY + document.body.scrollTop +
        document.documentElement.scrollTop;
    }

    x -= this.viewport.offsetLeft;
    y -= this.viewport.offsetTop;


    var cell = {
        y: Math.floor(y / this.kPieceHeight),
        x: Math.floor(x / this.kPieceWidth)
    };

    return cell;
};

/////////////////////////////////////////////////////
// CLICK HANDLER
// SEND MESSAGES BETWEEN CLIENTS HERE
/////////////////////////////////////////////////////
game_core.prototype.onClick = function (e) {


    var cell = this.getCursorPosition(e);

    //console.log(cell);
    //console.log(this.isCurrentPlayersTurn());


    if (this.isCurrentPlayersTurn()) {

        var matchingCell = _.find(this.players.self.pieces, function (p) {
            return p.x == cell.x && p.y == cell.y;
        });

        console.log(matchingCell);
        if (matchingCell) {
            // clicked on a piece
            this.clickOnPiece(matchingCell);
        } else {
            this.clickOnEmpty(cell);
        }
    }


    this.client_handle_input();
};

game_core.prototype.resetSelected = function () {
    _.each(this.players.self.pieces, function (cell) {
        cell.selected = false;
    });
};

game_core.prototype.clickOnPiece = function (cell) {

    if (this.players.self.pieces.selectedPiece && this.players.self.pieces.selectedPiece == cell) {
        this.resetSelected();
        this.players.self.pieces.selectedPiece = null;
    } else {
        this.resetSelected();
        cell.selected = true;
        this.players.self.pieces.selectedPiece = cell;
    }
};

game_core.prototype.clickOnEmpty = function (cell) {
    if (this.players.self.pieces.selectedPiece) {
        if (this.players.self.pieces.selectedPiece.x == cell.x &&
            this.players.self.pieces.selectedPiece.y == cell.y) {
            this.players.self.pieces.selectedPiece.selected = false;
            this.players.self.pieces.selectedPiece = null;
        } else {

            if(this.isValidMove(this.players.self.pieces.selectedPiece, cell)) {
                this.players.self.pieces.selectedPiece.x = cell.x;
                this.players.self.pieces.selectedPiece.y = cell.y;

                // Switch turns
                this.resetSelected();
                this.isHostsTurn = !this.isHostsTurn;
            }
        }
    }
};

game_core.prototype.isValidMove = function(oldCell, newCell) {
 if(newCell.x < 0 || newCell.x >= game_core.kBoardWidth) {
     return false;
 }
    if(newCell.y < 0 || newCell.y >= game_core.kBoardHeight) {
        return false;
    }

    if(_.any(_.union(this.players.self.pieces, this.players.other.pieces), function(otherPiece) {
            return otherPiece.x == newCell.x && otherPiece.y == newCell.y;
        })) {
        return false;
    }

    if(Math.abs(oldCell.x - newCell.x) > 1) {
        return false;
    }

    if(Math.abs(oldCell.y - newCell.y) > 1) {
        return false;
    }

    return true;
};
game_core.prototype.isCurrentPlayersTurn = function () {
    if (this.players.self.host) {
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
game_core.prototype.server_update = function () {

    //Update the state of our local clock to match the timer
    this.server_time = this.local_time;

    //Make a snapshot of the current state, for updating the clients
    this.laststate = {
        hp: this.players.self.pos,                //'host position', the game creators position
        cp: this.players.other.pos,               //'client position', the person that joined, their position
        his: this.players.self.last_input_seq,     //'host input sequence', the last input we processed for the host
        cis: this.players.other.last_input_seq,    //'client input sequence', the last input we processed for the client
        t: this.server_time                      // our current local time on the server
    };

    //Send the snapshot to the 'host' player
    if (this.players.self.instance) {
        this.players.self.instance.emit('onserverupdate', this.laststate);
    }

    //Send the snapshot to the 'client' player
    if (this.players.other.instance) {
        this.players.other.instance.emit('onserverupdate', this.laststate);
    }

}; //game_core.server_update


game_core.prototype.handle_server_input = function (client, input, input_time, input_seq) {

    //Fetch which client this refers to out of the two
    var player_client =
        (client.userid == this.players.self.instance.userid) ?
            this.players.self : this.players.other;

    //Store the input on the player instance for processing in the physics loop
    player_client.inputs.push({inputs: input, time: input_time, seq: input_seq});

}; //game_core.handle_server_input


/*

 Client side functions

 These functions below are specific to the client side only,
 and usually start with client_* to make things clearer.

 */

game_core.prototype.client_handle_input = function () {


    var message = 'z.' + JSON.stringify(this.players.self.pieces);
    this.socket.send(message);

    var message2 = 't.' + this.isHostsTurn;
    this.socket.send(message2);

}; //game_core.client_handle_input

game_core.prototype.client_onserverupdate_recieved = function (data) {
}; //game_core.client_onserverupdate_recieved

game_core.prototype.drawTurnMessage = function () {

    this.ctx.fillStyle = 'Black';
    var text = this.isCurrentPlayersTurn() ? 'Your turn' : "Opponent's turn";
    this.ctx.fillText(text, 16, 400);
};


game_core.prototype.client_update = function () {


    //Clear the screen area
    this.ctx.clearRect(0, 0, 360, 450);

    this.drawTurnMessage();

    this.drawBoard();

    this.players.other.draw();
    this.players.self.draw();

}; //game_core.update_client

game_core.prototype.client_create_ping_timer = function () {

    //Set a ping timer to 1 second, to maintain the ping/latency between
    //client and server and calculated roughly how our connection is doing

    setInterval(function () {
        this.last_ping_time = new Date().getTime() - this.fake_lag;
        this.socket.send('p.' + (this.last_ping_time));

    }.bind(this), 1000);

}; //game_core.client_create_ping_timer


game_core.prototype.client_create_configuration = function () {


    this.net_latency = 0.001;           //the latency between the client and the server (ping/2)
    this.net_ping = 0.001;              //The round trip time from here to the server,and back
    this.last_ping_time = 0.001;        //The time we last sent a ping
    this.server_time = 0.01;            //The time the server reported it was at, last we heard from it
    this.dt = 0.016;                    //The time that the last frame took to run

};//game_core.client_create_configuration


game_core.prototype.client_reset_positions = function () {

    var player_host = this.players.self.host ? this.players.self : this.players.other;
    var player_client = this.players.self.host ? this.players.other : this.players.self;

    //Host always spawns at the top left.
    player_host.pos = {x: 20, y: 420};
    player_client.pos = {x: 20, y: 440};


}; //game_core.client_reset_positions

game_core.prototype.client_onreadygame = function (data) {

    var server_time = parseFloat(data.replace('-', '.'));

    var player_host = this.players.self.host ? this.players.self : this.players.other;
    var player_client = this.players.self.host ? this.players.other : this.players.self;

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

game_core.prototype.client_onjoingame = function (data) {

    //We are not the host
    this.players.self.host = false;
    //Update the local state
    this.players.self.state = 'connected.joined.waiting';
    this.players.self.info_color = '#00bb00';

    //Make sure the positions match servers and other clients
    this.client_reset_positions();

}; //client_onjoingame

game_core.prototype.client_onhostgame = function (data) {

    //The server sends the time when asking us to host, but it should be a new game.
    //so the value will be really small anyway (15 or 16ms)
    var server_time = parseFloat(data.replace('-', '.'));

    //Set the flag that we are hosting, this helps us position respawns correctly
    this.players.self.host = true;

    //Update debugging information to display state
    this.players.self.state = 'hosting.waiting for a player';
    this.players.self.info_color = '#cc0000';

    //Make sure we start in the correct place as the host.
    this.client_reset_positions();

}; //client_onhostgame

game_core.prototype.client_onconnected = function (data) {

    //The server responded that we are now in a game,
    //this lets us store the information about ourselves and set the colors
    //to show we are now ready to be playing.
    this.players.self.id = data.id;
    this.players.self.info_color = '#cc0000';
    this.players.self.state = 'connected';
    this.players.self.online = true;

}; //client_onconnected

game_core.prototype.client_onping = function (data) {
}; //client_onping

game_core.prototype.client_onnetmessage = function (data) {

    var commands = data.split('.');
    var command = commands[0];
    var subcommand = commands[1] || null;
    var commanddata = commands[2] || null;

    switch (command) {

        case 'z' : // Make a move
            var newPositions = JSON.parse(subcommand);
            console.log(newPositions);
            this.players.other.pieces = newPositions;
            break;

        case 't' : // Turn is updated
            this.isHostsTurn = JSON.parse(subcommand);
            break;


        case 's': //server message

            switch (subcommand) {

                case 'h' : //host a game requested
                    this.client_onhostgame(commanddata);
                    break;

                case 'j' : //join a game requested
                    this.client_onjoingame(commanddata);
                    break;

                case 'r' : //ready a game requested
                    this.client_onreadygame(commanddata);
                    break;

                case 'e' : //end game requested
                    this.client_ondisconnect(commanddata);
                    break;

                case 'p' : //server ping
                    this.client_onping(commanddata);
                    break;
            } //subcommand

            break; //'s'
    } //command

}; //client_onnetmessage

game_core.prototype.client_ondisconnect = function (data) {

    //When we disconnect, we don't know if the other player is
    //connected or not, and since we aren't, everything goes to offline

    this.players.self.info_color = 'rgba(255,255,255,0.1)';
    this.players.self.state = 'not-connected';
    this.players.self.online = false;

    this.players.other.info_color = 'rgba(255,255,255,0.1)';
    this.players.other.state = 'not-connected';

}; //client_ondisconnect

game_core.prototype.client_connect_to_server = function () {

    //Store a local reference to our connection to the server
    this.socket = io.connect();

    //When we connect, we are not 'connected' until we have a server id
    //and are placed in a game by the server. The server sends us a message for that.
    this.socket.on('connect', function () {
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


game_core.prototype.client_draw_info = function () {

    //Draw some information for the host
    this.ctx.fillStyle = 'white';
    var text = this.players.self.host ? 'Hosting' : 'Connected';
    this.ctx.fillText(text, 10, 465);
};