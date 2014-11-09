    
    // Express & Node server setup code was adapted from the following guide:
    // http://buildnewgames.com/real-time-multiplayer

    var io = require('socket.io'),
    var express = require('express');
    var UUID = require('node-uuid');
    var http = require('http');

    var gameport= process.env.PORT || 4004;
    var verbose = false;
    
    var app = express();
    var server = http.createServer(app);

    // Listen for new connections
    server.listen(gameport)

    //Log something so we know that it succeeded.
    console.log('\t :: Halma Server :: Listening on port ' + gameport );

    // Make the default page index.html
    app.get( '/', function( req, res ){
        console.log('trying to load %s', __dirname + '/index.html');
        res.sendfile( '/index.html' , { root:__dirname });
    });


    // Load any other pages
    app.get( '/*' , function( req, res, next ) {

        // The requested file
        var file = req.params[0];

        // For debugging
        if(verbose) console.log('\t :: Halma Server :: file requested : ' + file);

        //Send the requested file
        res.sendfile( __dirname + '/' + file );

    }); //app.get *


    var sio = io.listen(server);

    sio.configure(function (){
        sio.set('log level', 0);
        sio.set('authorization', function (handshakeData, callback) {
          callback(null, true); // error first callback style
        });
    });

    
    game_server = require('./game.server.js');

    sio.sockets.on('connection', function (client) {
        
        client.userid = UUID();

        //tell the player they connected, giving them their id
        client.emit('onconnected', { id: client.userid } );

        //now we can find them a game to play with someone.
        //if no game exists with someone waiting, they create one and wait.
        game_server.findGame(client);

        //Useful to know when someone connects
        console.log('\t socket.io:: player ' + client.userid + ' connected');
        
        //Now we want to handle some of the messages that clients will send.
        //They send messages here, and we send them to the game_server to handle.
        client.on('message', function(m) {
            game_server.onMessage(client, m);
        }); //client.on message

       
        //When this client disconnects, we want to tell the game server
        //about that as well, so it can remove them from the game they are
        //in, and make sure the other player knows that they left and so on.
        client.on('disconnect', function () {
            
            //Useful to know when soomeone disconnects
            console.log('\t socket.io:: client disconnected ' + client.userid + ' ' + client.game_id);
            
            //If the client was in a game, set by game_server.findGame,
            //we can tell the game server to update that game state.
            if(client.game && client.game.id) {

                //player leaving a game should destroy that game
                game_server.endGame(client.game.id, client.userid);

            } //client.game_id
        }); //client.on disconnect
    }); //sio.sockets.on connection




