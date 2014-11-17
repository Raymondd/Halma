// Code adapted from the guide at
// http://buildnewgames.com/real-time-multiplayer
    
   

createHiDPICanvas = function(w, h, ratio) {
    
    if (!ratio) { 
    	ratio = window.devicePixelRatio;
    }
    
    var canvas = document.getElementById("viewport");
    

	if (ratio) {
	    canvas.width = w * ratio;
	    canvas.height = h * ratio;
	    canvas.style.width = w + 'px';
	    canvas.style.height = h + 'px';
	}

    return canvas;
}



//A window global for our game root variable.
var game = {};
window.onload = function(){


	//Create the game client instance.
	game = new game_core();

	//Create canvas with the device resolution.
	var myCanvas = createHiDPICanvas(400,450);

		//Fetch the viewport
		game.viewport = myCanvas;
			

		//Fetch the rendering contexts
		game.ctx = game.viewport.getContext('2d');
		game.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);


		//Set the draw style for the font
		game.ctx.font = '16px "Helvetica"';

	//Finally, start the loop
	game.update( new Date().getTime() );

};