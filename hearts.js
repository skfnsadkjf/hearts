// Stuff you can change:
//================================================
const SCORE_TO_WIN = 100;
const TIME_BETWEEN_TURNS = 250; //milliseconds
const TIME_BEFORE_CARD_REMOVAL = 400; //milliseconds

//================================================

const TOP_OFFSET = 30; // distance in px between cards in the hands of players 1 and 3.
const LEFT_OFFSET = 50; // distance in px between cards in the hands of players 0 and 2.
let scores = [0,0,0,0];
let hands = [[],[],[],[]]; // cards currently in each player's hand.
let activePlayer = 0; // the player whose turn it currently is
let trade = false; // if the game is currently in the trading phase.
let tradeDirection = 0; // 0 == left, 1 == right, 2 == across, 3 == no trade.
let tradeText = ["left" , "right" , "across"];
let tradeCards = [[],[],[],[]]; // cards readied for trade.
let centerCards = []; // array contraining 0-4 value of 1-52 representing cards currently played in the center.
let takenCards = [[],[],[],[]]; // arrays for each player representing all cards taken while playing to be scored at the end of the hand.
let takenCardsAll = [] // all cards that have been player
let canHearts = false; // determines if hearts can be played yet this hand.
let possibleCards = []; // cards in activePlayer's hand that are legally playable.
function getSuit( x ) {
	return Math.floor( x / 13 );
}
function shuffle() {
	let cards = Array.from( {length: 52} , ( v , k ) => k );
	for ( let i = 51; i > 0; i-- ) {
		let x = Math.floor( Math.random() * i );
		let temp = cards[i];
		cards[i] = cards[x];
		cards[x] = temp;
	}
	return [
		Array.from( {length: 13} , ( v , k ) => cards[k] ),
		Array.from( {length: 13} , ( v , k ) => cards[k+13] ),
		Array.from( {length: 13} , ( v , k ) => cards[k+26] ),
		Array.from( {length: 13} , ( v , k ) => cards[k+39] )
	]
}
function makeCard( card , player , center ) {
	let img = document.createElement( "IMG" );
	if ( player == 0 && !center ) {
		img.onclick = click;
	}
	img.src = player == 0 || center ? "img/" + card + ".svg" : "img/back.svg"
	let elem = center ? document.getElementById( "center" + player ) : document.getElementById( "player" + player );
	let top = center ? 0 : ( player % 2 ) * elem.children.length * TOP_OFFSET;
	let left = center ? 0 : ( ( player + 1 ) % 2 ) * elem.children.length * LEFT_OFFSET;
	img.style.top = top + "px";
	img.style.left = left + "px";
	img.id = card;
	img.classList.add( "card" );
	elem.appendChild( img );
}
function active( player ) {
	activePlayer = player;
	// tests to determine what cards the active player is allowed to play.
	let hand = hands[player];
	if ( centerCards.length > 0 ) {
		// must follow suit if able
		possibleCards = hands[player].filter( v => getSuit( v ) == getSuit( centerCards[0] ) );
		// if can't follow suit play anything. except on the first round where hearts/queen of spades isn't allowed
		if ( possibleCards.length == 0 ) {
			possibleCards = hand.length < 13 ? hand : hand.filter( v => v <= 38 && v != 36 );
		}
	}
	else {
		// lead anything but a heart unless hearts have been played already
		possibleCards = canHearts ? hand : hand.filter( v => v <= 38 );
	}
	// edge cases of having 2 of clubs or not having a possible card to play
	possibleCards = hands[player].includes( 0 ) ? [0] : possibleCards;
	possibleCards = possibleCards.length == 0 ? hand : possibleCards
}
function makeHands() {
	// remove all cards on the board
	let cardElems = document.getElementsByClassName( "card" );
	for ( let i = cardElems.length - 1; i >= 0; i-- ) {
		cardElems[i].remove();
	}
	// make 13 card images per player
	for ( let player = 0; player < 4; player++ ) {
		if ( player == 0 ) {
			hands[player].sort( ( a , b ) => a - b );
		}
		console.log( hands[player] )
		for ( let i = 0; i < 13; i++ ) {
			makeCard( hands[player][i] , player , false );
		}
		// player with 2 of clubs starts. Runs aiActions() if necessary.
		if ( hands[player].includes( 0 ) ) {
			active( player );
			if ( !trade && activePlayer > 0 ) {
				aiActions();
			}
		}
	}
}
async function centerCard( x ) {
	hands[activePlayer] = hands[activePlayer].filter( v => v != x );
	makeCard( x , activePlayer , true );
	centerCards.push( x );
	if ( x > 39 ) { // if heart gets played, allow hearts to be led.
		canHearts = true;
	}
	if ( centerCards.length == 4 ) {
		console.log( "dongs")
		await new Promise( ( r ) => setTimeout( r , TIME_BEFORE_CARD_REMOVAL ) );
		// winner counts from the first player to play a card this round and is NOT a normal player number.
		let winner = 0;
		let suitLed = getSuit( centerCards[0] );
		for ( let i = 1; i < 4; i++ ) {
			if ( getSuit( centerCards[i] ) == suitLed && centerCards[i] > centerCards[winner] ) {
				winner = i;
			}
		}
		winner = ( winner + activePlayer + 1 ) % 4; // converts winner to a normal player number
		for ( let i = 0; i < 4; i++ ) {
			document.getElementById( "center" + i ).lastElementChild.remove();
			takenCards[winner].push( centerCards[i] );
			takenCardsAll.push( centerCards[i] );
		}
		centerCards = [];
		active( winner );
		if ( hands[0].length == 0 ) {
			return endHand();
		}
	}
	else {
		active( ( activePlayer + 1 ) % 4 );
	}
	if ( activePlayer > 0 ) {
		aiActions();
	}
}
function aiTrade( player ) {
	let goForAll = true;
	let winSuit = [false , false , false , false]
	let hand = hands[player];
	let trade = [];
	for ( let suit = 0; suit < 4; suit++ ) { // decide if should go for all 26 points.
		let x = hand.filter( v => getSuit( v ) == suit ).map( v => v % 13 );
		if ( x.length == 0 ||
		x.length == 1 && x.includes( 12 ) ||
		x.length == 1 && x.includes( 12 ) && x.includes( 11 ) ||
		x.length == 2 && x.includes( 12 ) && x.includes( 11 ) ||
		x.includes( 12 ) && x.includes( 11 ) && x.includes( 10 ) ||
		x.length >= 6 && x.includes( 12 ) && x.includes( 11 ) ) {
			winSuit[suit] = true;
		}
		if ( !winSuit[suit] ) {
			trade = trade.concat( x.map( v => v + suit * 13 ) );
		}
	}
	// if decided to go for all 26 points, pick 3 low cards to trade
	if ( trade.length <= 3 ) {
		for ( let i = 0; i < 13; i++ ) {
			for ( let suit = 0; suit < 4; suit++ ) {
				if ( winSuit[suit] && hand.includes( i + suit * 13 ) ) {
					trade.push( i + suit * 13 );
					if ( trade.length == 3 ) {
						return trade;
					}
				}
			}
		}
	}
	// pick 3 high cards to trade
	else {
		trade = [];
		for ( let i = 12; i >= 0; i-- ) {
			for ( let suit = 0; suit < 4; suit++ ) {
				if ( hand.includes( i + suit * 13 ) ) {
					trade.push( i + suit * 13 );
					if ( trade.length == 3 ) {
						return trade
					}
				}
			}
		}
	}

}
function aiTrades( player ) {
	for ( let player = 1; player < 4; player++ ) {
		let trade = aiTrade( player );
		tradeCards[player] = trade;
		hands[player] = hands[player].filter( v => !trade.includes( v ) );
	}
}
function doTrades() {
	let x = tradeDirection == 0 ? 1 : tradeDirection == 1 ? 3 : tradeDirection == 2 ? 2 : 0;
	tradeDirection = ( tradeDirection + 1 ) % 4;
	hands = hands.map( ( v , i ) => v.concat( tradeCards[( i - x + 4 ) % 4] ) );
	trade = false;
	document.getElementById( "trade" ).textContent = "";
	makeHands();
	tradeCards[( 4 - x ) % 4].forEach( v => document.getElementById( v ).style.top = "-50px" )
	tradeCards = [[],[],[],[]];
}
function click( e ) {
	let index = e.target.src.lastIndexOf( "/" ) + 1
	let card = parseInt( e.target.id );
	if ( e.button == 0 && trade ) {
		if ( hands[0].includes( card ) ) {
			tradeCards[0].push( card );
			hands[0].splice( hands[0].indexOf( card ) , 1 );
			e.target.style.top = "-50px";
		}
		else {
			hands[0].push( card );
			tradeCards[0].splice( tradeCards[0].indexOf( card ) , 1 );
			e.target.style.top = "0px";
		}
		if ( tradeCards[0].length == 3 ) {
			doTrades();
		}
	}
	else if ( e.button == 0 && activePlayer == 0 && !trade ) {
		hands[0].forEach( v => document.getElementById( v ).style.top = "0px" );
		if ( possibleCards.includes( card ) ) {
			document.getElementById( card ).remove();
			centerCard( card );
		}
	}
}
function aiAction() {
	let hand = hands[activePlayer];
	let queenGone = takenCardsAll.includes( 36 );
	let hasQueen = possibleCards.includes( 36 );
	let playingLast = centerCards.length == 3;
	let hasLead = centerCards.length == 0;
	let pointsInPlay = centerCards.reduce( ( acc , v ) => acc + ( v >= 39 ? 1 : v == 36 ? 13 : 0 ) , 0 );
	let suit = getSuit( centerCards[0] );
	let followSuit = hand.some( v => getSuit( v ) == suit );
	if ( hasLead ) {
		// play smallest card when leading
		let x = possibleCards.sort( ( a , b ) => ( a % 13 ) - ( b % 13 ) );
		return x[0];
	}
	if ( hasQueen && ( centerCards.some( v => v == 37 || v == 38 ) || !followSuit ) ) {
		// if has the queen of spade, try to play it as soon as possible
		return 36;
	}
	if ( !followSuit ) {
		// if don't have to follow suit play largest card
		x = possibleCards.sort( ( a , b ) => ( b % 13 ) - ( a % 13 ) );
		return x[0];
	}
	if ( followSuit ) {
		// take trick in first half of game if it's somewhat safe to do so.
		if ( pointsInPlay == 0 && hand.length > 6 && ( playingLast || queenGone ) && !centerCards.includes( 36 ) ) {
			return Math.max( ...possibleCards );
		}
		// while following suit try to play lower than the highest card in play.
		let x = Math.max( ...centerCards.filter( v => getSuit( v ) == suit ) );
		let y = possibleCards.filter( v => v < x );
		if ( suit == 2 && !queenGone ) {
			// if spades led and the queen isn't played yet, avoid playing king or ace
			y = possibleCards.filter( v => v < 36 );
		}
		return y.length > 0 ? Math.max( ...y ) : Math.max( ...possibleCards );
	}
}
async function aiActions() {
	await new Promise( ( r ) => setTimeout( r , TIME_BETWEEN_TURNS ) );
	document.getElementById( "player" + activePlayer ).lastElementChild.remove();
	centerCard( aiAction() );
}
function endHand() {
	for ( let i = 0; i < 4; i++ ) {
		if ( [51,50,49,48,47,46,45,44,43,42,41,40,39,36].every( v => takenCards[i].includes( v ) ) ) {
			scores = scores.map( ( v , index ) => v + ( i == index ? 0 : 26 ) );
		}
		else {
			scores[i] += takenCards[i].reduce( ( acc , v ) => acc + ( v == 36 ? 13 : v >= 39 ? 1 : 0 ) , 0 );
		}
		document.getElementById( "score" + i ).textContent = scores[i];
	}
	if ( scores.some( v => v >= SCORE_TO_WIN ) ) {
		let champion = scores.indexOf( Math.min( ...scores ) );
		alert( champion > 0 ? "Player " + champion + " won the game" : "You won the game!" );
	}
	else {
		beginHand();
	}
}
function beginHand() {
	hands = shuffle();
	canHearts = false;
	takenCards = [[],[],[],[]];
	takenCardsAll = [];
	if ( tradeDirection < 3 ) {
		trade = true;
		aiTrades();
		document.getElementById( "trade" ).textContent = "Trade " + tradeText[tradeDirection];
	}
	else {
		tradeDirection = 0;
	}
	makeHands();
}
window.onload = function() {
	beginHand();
}


// need to make ai moer wary of taking lead, especially later in the hand.
// ai should try to conserve their strong suits.