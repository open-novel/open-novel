
READY().then(function () {
	'use strict'

	function setPhase(phase) { document.title = '【' +phase+ '】' }
	function setRunPhase(kind) { setPhase(`${kind}中...`) }
	function setErrorPhase(kind) { setPhase(`${kind}エラー`) }


	function parseScript(text) {
		text = text.replace(/\r\n/g, '\n').replace(/\n+/g, '\n').replace(/\n/g, '\r\n') + '\r\n'
		text = text.replace(/^\#.*\n/gm, '')
		function parseOne(base, text) {
			var chanks = text.match(/[^\n]+?\n(\t+[\s\S]+?\n)+/g) || []
			chanks.forEach(chank => {
			
				var blocks = chank.replace(/^\t/gm,'').replace(/\n$/, '').match(/.+/g)
				//LOG(blocks)
				var act = blocks.shift().trim()
				var data = '\n' +blocks.join('\n')+ '\n'
				var ary = []
				if (act[0] !== '・') {
					base.push(['会話', [[act, blocks]]])
					return
				} else act = act.slice(1)
 
				if (data.match(/\t/)) {
					base.push([act, ary])
					//LOG(data)
					parseOne(ary, data)
				} else base.push([act, blocks])
			})
		}

		var base = []
		parseOne(base, text)
		return base

	}



	function copyObject(obj) {
		return JSON.parse(JSON.stringify(obj))
	}


	function otherName(name) {
		return function () { return this[name].apply(this, arguments) }
	}

/*
	function preloadImage({name, url, kind, type = 'png'}) {

		function test(url) {
			return new Promise( (ok, ng) => {
				var img = new Image
				img.onload = _ => ok(url)
				img.onerror = _ => ng(`画像『${name}』のキャッシュに失敗`)
				img.src = url
			} )
		}

		return preload({name, url, kind, test, type})

	}

	function preloadScript({name, url, kind = 'シナリオ', type = 'txt'}) {

		function test(url) {
			return find(url).then( _ => url)
		}

		return preload({name, url, kind, test, type})

	}

	function preload({name, kind, type, test}) {
		var hide = View.setLoadingMessage('Loadind...')
		return new Promise((ok, ng) => {
			//LOG(url, Util.isNoneType(url))
			if (Util.isNoneType(name)) return ok(url)
			var url = `データ/${Player.scenarioName}/${Util.forceName(kind, name, type)}`
			test(url).catch( _ => { 
				var url = `データ/[[共通素材]]/${Util.forceName(kind, name, type)}`
				return test(url)
			} ).then(ok, ng)
		}).then( url => {
			//LOG(url)
			hide()
			return url
		})
	}
*/


	function runScript(script) {

		View.changeModeIfNeeded('NOVEL')

		var run = Promise.defer()
		script = copyObject(script)	

		var actHandlers = {
			会話(data, done, failed) {

				function nextPage() {

					var ary = data.shift()
					if (!ary) return done()

					var name = ary[0], texts = ary[1]
					if (Util.isNoneType(name)) name = ''
					name = replaceEffect(name)
					View.nextPage(name)

					function nextSentence() {
						var text = texts.shift()
						if (!text) return nextPage()
						text = text.replace(/\\w(\d+)/g, (_, num) => {
							return '\u200B'.repeat(num)
						}).replace(/\\n/g, '\n')
						text = replaceEffect(text)
						View.addSentence(text).on('go', nextSentence, failed)
					}
					nextSentence()
				}

				nextPage()
			},

			背景(data, done, failed) {
				var name = replaceEffect(data[0])
				toBlobURL('背景', name, 'jpg').then( url => View.setBGImage({ url }) ).then(done, failed)
			},

			立絵: otherName('立ち絵'),
			立ち絵(data, done, failed) {
				//LOG(data)
				Promise.all(data.reduce((base, ary) => {

					if (!base) return

					if (Util.isNoneType(ary)) return base

					var [position, names] = ary

					if (!position) return failed('不正な位置検出')
					if(!names) return failed('不正な画像名検出') 

					position = replaceEffect(position)
					var name = replaceEffect(names[0])

					var a_type = ['left','right']['左右'.indexOf(position)]
					var v_type = 'top'
					var [a_per, v_per] = [0, 0]
					var height = null

					if (!a_type) {
						var pos = Util.toHalfWidth(position).match(/[+\-0-9.]+/g)
						if (!pos) return failed('不正な位置検出')
						var [a_pos, v_pos='0', height = null] = pos
						a_per = Math.abs(+a_pos)
						v_per = Math.abs(+v_pos)
						a_type = a_pos.match('-') ? 'right' : 'left'
						v_type = v_pos.match('-') ? 'bottom' : 'top'
						height = height != null ? `${+height}%` : null
					}

					base.push(toBlobURL('立ち絵', name, 'png').then( url => ({ url, height, [a_type]: `${a_per}%`, [v_type]: `${v_per}%` }) ))
					return base
				}, [])).then(View.setFDImages.bind(View)).then(done, failed)
			},

			選択: otherName('選択肢'),
			選択肢(data, done, failed) {

				View.setChoiceWindow(data.map(ary => {
					return { name: replaceEffect(ary[0]), value: ary[1] }
				})).then( value => {
					if (typeof value[0] == 'string') actHandlers['ジャンプ'](value, done, failed)
					else runScript(value).then(done, failed)
				} )
					
			},

			ジャンプ(data, done, failed) {
				var to = replaceEffect(data[0])
				fetchScriptData(to).then(runScript).then(done, failed)
			},

			変数: otherName('パラメータ'),
			パラメーター: otherName('パラメータ'),
			パラメータ(data, done, failed) {
				//LOG(data)
				data.forEach(str => {
					str = Util.toHalfWidth(str)
					str = str.match(/(.+)\:(.+)/)
					if (!str) return failed('不正なパラメータ指定検出') 
					var name = replaceEffect(str[1])
					var effect = str[2]
					if (!name) return failed('不正なパラメータ指定検出') 
					paramSet(name, evalEffect(effect, failed))

				})
				done()
			},

			繰返: otherName('繰り返し'),
			繰返し: otherName('繰り返し'),
			繰り返し(data, done, failed, i = 0) {
				i++
				if (i > 1000) return failed('繰返し回数が多すぎる(1000回超え)')
				new Promise( (ok, ng) => {
	 				if (!data.some(([effect, acts]) => {
	 					if (!effect) return failed('不正なパラメータ指定検出') 
						var flag = !!evalEffect(effect, ng)
						if (flag) runScript(acts).then(ok, ng)
						return flag
					}) ) done()
				}).then( _ => actHandlers['繰り返し'](data, done, failed, i) ).catch(failed)
			},

			分岐(data, done, failed) {
 				if (!data.some(([effect, acts]) => {
 					if (!effect) return failed('不正なパラメータ指定検出') 
					var flag = !!evalEffect(effect, failed)
					if (flag) runScript(acts).then(done, failed)
					return flag
				}) ) done()
			},

			コメント(data, done, failed) {
				done()
			},

		}

		function main_loop() {

			updateDebugWindow()

			//var loop = Promise.defer()

			var act, loop = new Promise( (resolve, reject) => {

				var prog = script.shift()
				if (!prog) return run.resolve() 
				act = prog[0].trim()
				var data = prog[1]

				if (act in actHandlers) actHandlers[act](data, resolve, reject)
				else {
					Util.error('サポートされていないコマンド『' +act+ '』を検出しました。\n\nこのコマンドを飛ばして再生が継続されます。')
					resolve()
				}

			}).then(main_loop, err => {
				var message = err ? `コマンド『${act}』で『${err}』が起こりました。` : `コマンド『${act}』が原因かもしれません。`
				Util.error('スクリプトを解析中にエラーが発生しました。\n\n' +message+ '\n\nこのコマンドを保証せず再生が継続されます。')
				return main_loop()
			})
		}

		main_loop()
		return run.promise

	}



	function replaceEffect(str) {
		return str.replace(/\\{(.+?)}/g, (_, efect) => evalEffect(efect) )
	}


	function evalEffect(effect, failed) {
		effect = effect.trim()
		if (Util.isNoneType(effect)) return true
		effect = Util.toHalfWidth(effect)
		.replace(/\\/g,'\\\\')
		.replace(/\=\=/g, '=').replace(/[^!><=]\=/g, str => str.replace('=', '==') )
		.replace(/\&\&/g, '&').replace(/[^!><&]\&/g, str => str.replace('&', '&&') )
		.replace(/\|\|/g, '|').replace(/[^!><|]\|/g, str => str.replace('|', '||') )
		.replace(/^ー/, '-').replace(/([\u1-\u1000\s])(ー)/g, '$1-').replace(/(ー)([\u1-\u1000\s])/g, '-$2')
		if (!effect) return failed('不正なパラメータ指定検出') 
		if (/\'/.test(effect)) return failed('危険な記号の検出') 
		effect = effect.replace(/[^+\-*/%><!=?:()&|\s]+/g, str => {
			if (/^[0-9.]+$/.test(str)) return str
			if (/^"[^"]*"$/.test(str)) return str
			return `paramGet('${str}')`
		})
		//LOG(effect)
		return eval(effect)
	}


	function updateDebugWindow() {

		if (!Data.debug) return

		var params = {}
		paramForEach( (value, key) => params[key] = value )

		var cacheSizeMB = ((cacheBlobMap.get('$size') || 0) / 1024 / 1024).toFixed(1)

		var obj = {
			キャッシュサイズ: cacheSizeMB + 'MB',
			パラメータ: params,
		}

		View.updateDebugWindow(obj)
	}


	function toBlobEmogiURL(name) {
		return toBlobURL('絵文字', name, 'svg')
	}

	function toBlobScriptURL(name) {
		return toBlobURL('シナリオ', name, 'txt')
	}



	function toBlobURL(kind, name, type) {
		var sub = Util.forceName(kind, name, type)
		var subkey = `${Player.scenarioName}/${sub}`
		if (Util.isNoneType(name)) return Promise.resolve(null)
		if (cacheBlobMap.has(subkey)) return Promise.resolve(cacheBlobMap.get(subkey))
		var hide = View.setLoadingMessage('Loading...')
		return new Promise( (ok, ng) => {		
			find(`データ/${subkey}`).catch( _ => `データ/[[共通素材]]/${sub}` ).then( url => ok(url), ng)
		}).then(loadBlob).then( blob => {
			var blobURL = URL.createObjectURL(blob)
			cacheBlobMap.set(subkey, blobURL)
			cacheBlobMap.set('$size', (cacheBlobMap.get('$size') || 0) + blob.size)
			//Storage.testPut(subkey, blob)
			hide()
			return blobURL
		}, hide)
	}



	function fetchSettingData(url) {
		return loadText(url).then( text => {
			var setting = parseScript(text)
			var data = {}
			setting.forEach( ary => {
				data[ary[0]] = ary[1]
			})
			return data
		} )
	}


	function fetchScriptData(name) {
		return toBlobScriptURL(name).then(loadText).then( text => parseScript(text) )
	}


	function loadText(url) {
		return load(url, 'text')
	}

	function loadBlob(url) {
		return load(url, 'blob')
	}

	function load(url, type) {
		return new Promise(function (ok, ng) {
			var xhr = new XMLHttpRequest()
			xhr.onload = _ => ok(xhr.response)
			xhr.onerror = _ => ng(new Error(`ファイルURL『${url}』のロードに失敗`))
			xhr.open('GET', url)
			if (type) xhr.responseType = type
			xhr.send()
		})
	}

	function find(url) {
		return new Promise(function (ok, ng) {
			var xhr = new XMLHttpRequest()
			xhr.onload = _ => {
				if (xhr.status < 300) ok(url)
				else ng(new Error(`ファイルURL『${url}』が見つからない`)) 
			}
			xhr.onerror = _ => ng(new Error(`ファイルURL『${url}』のロードに失敗`))
			xhr.open('HEAD', url)
			xhr.send()
		})

	}


	function print(message) {
		if (!View.print) View.changeMode('TEST')
		View.print(message)
	}


	var cacheBlobMap = new Map

	function cacheClear() {
		cacheBlobMap.forEach( (subURL, blobURL) => {
			URL.revokeObjectURL(blobURL)
		} )
		cacheBlobMap.clear()
		cacheBlobMap.set('$size', 0)
		updateDebugWindow()
	}

	var [paramSet, paramGet, paramClear, paramForEach] = (_ => {
		var paramMap = new Map

		return [(key, val) => {
			paramMap.set(key, val)
			updateDebugWindow()
		}, key => {
			if (!paramMap.has(key)) {
				paramMap.set(key, 0)
				updateDebugWindow()
			}
			return paramMap.get(key)
		}, _ => {
			paramMap.clear()
			updateDebugWindow()
		}, func => {
			paramMap.forEach(func)
		}]

	})()


	READY.Player.ready({
		setRunPhase, setErrorPhase, fetchSettingData, fetchScriptData, runScript, print, cacheClear, paramClear,
		toBlobEmogiURL, find,
	})

}).catch(LOG)