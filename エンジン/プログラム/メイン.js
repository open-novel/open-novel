/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Player from './システム.js'

window.addEventListener( 'DOMContentLoaded', main )

async function main( ) {


	//Canvas要素の配置と準備

	const wrapper = document.querySelector( '#ONPWrapper' )

	const player = document.createElement( 'div' )

	Object.assign( player.style, {
		width: '970px',
		height: '550px',
		margin: '10px auto',
		padding: '5px',
		borderRadius: '10px 10px 0px 10px',
		boxShadow: '0px 0px 10px 1px blue inset',
		overflow: 'hidden',
		resize: 'both',
	} )
	wrapper.appendChild( player )

	const canvas = document.createElement( 'canvas' )
	Object.assign( canvas, {
		width: 960,
		height: 540,
	} )
	Object.assign( canvas.style, {
		width: '100%',
		height: '100%',
	} )


	Array.from( wrapper.childNodes, node => node.remove( ) )
	player.appendChild( canvas )

	let ctx = canvas.getContext( '2d' )

	const onp = Player.initPlayer( ctx )


	let captureEventTypes = [ 'down', 'up', 'move' ]

	for ( let type of captureEventTypes ) {
		canvas.addEventListener( `pointer${ type }`, e => {
			Player.onInputEvent( { type, x: e.layerX, y: e.layerY } )
		} )
	}


}
