
/*

	This file is kind of a mess, or at least the styles are.
	The CSS still isn't very elagent and some of the things I tried to midigate that are still very experimental.
	However the elements themselves I'm pretty happy with.

*/

class Input extends CustomElm{
	constructor(text){
		super();
		text=bind(text);
		this.define(html`
			<input
				value=${attr(text)(text)}
				oninput=${attr(act((event)=>{
					text.data=event.target.value;
				}))()}
			/>
		`);
	}
}
defineElm(Input);

class ButtonClickable extends CustomElm{
	constructor(text,event,selected=false){
		super();
		text=bind(text);
		event=bind(event);
		selected=bind(selected);
		this.define(html`
			<button
				class=${attr(()=>selected.data?"selected":"")(selected)}
				onclick=${attr(act(event.data))(event)}
			>
				<div class="surface">
					${html`${text}`(text)}
				</div>
				<div class="selector"><div></div></div>
			</button>
		`);
	}
}
defineElm(ButtonClickable,scss`&{
	>button{
		position: relative;
		padding: 0;
		border: none;
		background-color: #58934C;
		border-radius: 6px;
		${theme.boxShadowStep(-3)}
		.surface{
			font-family: 'Sen', sans-serif;
			font-weight: 700;
			font-size: 20px;
			color: white;
			background-color: #7AC16C;
			border: none;
			padding: 10px 30px;
			border-radius: 6px;
			position: relative;
			bottom: 10px;
			transition: bottom 0.1s;
		}
		.selector{
			opacity: 0;
			position: absolute;
			border: 12px solid transparent;
			border-bottom-color: #28282E;
			width: 0;
			height: 0;
			bottom: -12px;
			right: calc(50% - 12px);
			transition: bottom 0.4s, opacity 0.4s;
			div{
				position: absolute;
				border: 10px solid transparent;
				border-bottom-color: white;
				width: 0;
				height: 0;
				top: -4px;
				right: calc(50% - 10px);
			}
		}
		&.selected .selector{
			opacity: 1;
			bottom: -6px;
		}
		&:active .surface{
			bottom: 4px;
		}
		&:active .selector{
			bottom: -12px;
		}
	}
}`);

class ButtonLink extends CustomElm{
	constructor(text,event){
		super();
		text=bind(text);
		event=bind(event);
		this.define(html`
			<button
				onclick=${attr(act(event.data))(event)}
			>
				${html`${text}`(text)}
			</button>
		`);
	}
}
defineElm(ButtonLink,scss`&{
	>button{
		margin: 0;
		padding: 0;
		display: inline;
		cursor: pointer;
		background-color: transparent;
		color: #7AC16C;
		&:hover{
			text-decoration: underline;
		}
	}
}`);

class Header extends CustomElm{
	constructor(text){
		super();
		this.define(html`
			<div class="back"></div>
			<h1>Cimexis ${html`${text}`(text)}</h1>
		`);
	}
}
defineElm(Header,(()=>{
	let size="400px";

	return scss`&{
		${theme.elementReset}
		${theme.center}
		height: ${size};
		background-color: ${theme.color.greyStep(0)};
		z-index: 2;
		position: relative;
		> .back{
			position: absolute;
			height:${size};
			width:${size};
			background-image: url('./img/logo.png');
			background-size: contain;
			background-repeat: no-repeat;
			background-position: center;
		}
		> h1{
			position: relative;
			margin-top: 5px;
			padding-bottom: 5px;
			background-color: ${theme.color.greyStep(0)};
			${theme.font.title}
		}
	}`})()
);

//TODO: better list handling

class Nav extends CustomElm{
	constructor(items,scroll){
		super();
		let isDown;
		if(scroll!=null){
			isDown=def(()=>scroll.data>400,scroll);
		}else{
			isDown=bind(false);
		}
		let hasMid=def(()=>items.length%2==0,items);
		this.define(html`
			<div class=${attr(()=>isDown.data?"down":"")(isDown)}>
				${html`${
					()=>hasMid.data?
					`
						<div class="mid">
							<div class="cover"><div></div></div>
							<div class="shadowHider"></div>
							<div class="icon"></div>
						</div>
					`:""
				}`(hasMid)}
				${()=>{
					let list=items.map((a)=>html`
						<button
							onclick=${attr(act(()=>setPage(a.id.data)))}
							class=${attr(()=>a.selected.data?"selected":"")(a.selected)}
						>
						<span>${html`${a.text}`(a.text)}</span>
						</button>
					`());
					if(list.length%2==0){
						list.splice(Math.floor(list.length/2),0,newElm("div","midGap"));
					}
					return list;
				}}
			</div>
		`(items));
	}
}
defineElm(Nav,(()=>{
	let height="50px";
	let space="20px";
	let width="200px";
	let transWhite=new Color(theme.color.white);
	transWhite.a=0.5;

	return scss`
	&{
		${theme.elementReset}
		height: ${height};
	}
	>div{
		${theme.elementReset}
		${theme.center}
		height: ${height};
		background-color: ${theme.color.greyStep(0)};
		${theme.boxShadowStep(0)}
		position: relative;
		z-index: 1;
		button{
			transition: border-color 0.2s, color 0.2s;
			height: ${height};
			width: ${width};
			${theme.center}

			font-weight: 700;
			${theme.font.primary}
			${theme.centerText}
			${theme.font.sizeStep(-0.5)}
			color: ${transWhite};

			border: none;
			border-bottom: 4px solid;
			border-radius:0;
			background: none;
			padding: 0 ${space};
			padding-top: 4px;
			border-color: transparent;
			> span{
				z-index: 1;
			}
			&:hover{
				color: ${theme.color.white};
				border-color: ${transWhite};
			}
			&.selected{
				border-color: ${theme.color.highlight};
				color: ${theme.color.highlight};
			}
		}
		.mid{
			position: absolute;
			width: 100%;
			height: 100%;
			justify-content: center;
			display: flex;
			opacity: 0;
			transition: opacity 0.5s;
			pointer-events: none;
			.cover{
				position: absolute;
				transform: scaleY(0.8) rotate(-45deg)
				> div{
					width: 65px;
					height: 65px;
					background-color: #36363F;
					box-shadow: 0 0 30px #00000080;
				}
			}
			.shadowHider{
				background-color: #36363F;
				position: absolute;
				top: 0px;
				height: 35px;
				width: 100%;
			}
			.icon{
				width: 60px;
				height: 60px;
				background-image: url("./img/logoSmall.png");
				background-position: center;
				background-size: cover;
				position: absolute;
			}
		}
		.midGap{
			margin-right: 0;
			transition: margin 0.5s;
		}
		&.down{
			position: fixed;
			left: 0;
			right: 0;
			top: 0;
			.midGap{
				margin-right: 50px;
			}
			.mid{
				opacity: 1;
			}
		}


	}`})()
);

class EndSymbol extends CustomElm{
	constructor(){
		super();
		this.define(html`
			<div class="icon"></div>
			<div class="line"></div>
			<div class="cover"></div>
		`);
	}
}
defineElm(EndSymbol,scss`&{
	height: 70px;
	${theme.centerX}
	opacity: 0.2;
	position: absolute;
	bottom: 0;
	right: calc(50% - 90px);
	width: 180px;
	.icon{
		position: absolute;
		top: 0px;
		width: 60px;
		height: 60px;
		background-image: url("./img/logoSmall.png");
		background-position: center;
		background-size: cover;
		z-index: 2;
	}
	.line{
		position: absolute;
		top: 30px;
		width: 100%;
		border-top: 1px solid white;
	}
	.cover{
		position: absolute;
		top: 0px;
		width: 60px;
		height: 60px;
		background-color: #28282E;
	}
}`);

class Surface extends CustomElm{
	constructor(contentElement,width="md",invisible=false,isTop=false){
		super();
		isTop=bind(isTop,false);
		width=bind(width,false);
		invisible=bind(invisible,false);
		//width=sm,md,lg
		this.define(html`
			<div
				class=${attr(()=>{
					return [isTop.data?"top":"","size-"+width.data,invisible.data?"":"visible"].join(" ")
				})(isTop,width,invisible)}
			>
				${contentElement}
			</div>`);
	}
}
defineElm(Surface,scss`&{
	${theme.elementReset}
	width: 100%;
	${theme.centerX}
	> div{
		flex-grow:1;
		${theme.elementReset}
		margin: 0 100px;
		padding: 40px 40px;
		&.visible{
			border: 4px solid ${theme.color.greyStep(0)};
			background-color: ${theme.color.greyStep(-0.5)};
			${theme.boxShadowStep(-1)}
		}

		&.size-sm{
			max-width: 900px;
		}
		&.size-md{
			max-width: 980px;
		}
		&.size-lg{
			max-width: 1060px;
		}
		&.top{
			border-top: none;
			padding-top: 50px;
		}
		> *:first-child {
			margin-top:0;
		}
		> *:last-child {
			margin-bottom:0;
		}
}
}`);

class Page extends CustomElm{
	constructor(page){
		super();
		this.define(html`
			<div class="back">
				<div></div>
			</div>
			<div class="main">
				${()=>page.data?.content?.data??new MissingPage()}
			</div>
			<div class="foot">
				${new EndSymbol()}
			</div>
		`(page));
	}
}
defineElm(Page,scss`&{
	${theme.elementReset}
	${theme.centerY}
	flex-direction: column;
	position:relative;
	> .back{
		position: absolute;
		inset: 0;
		bottom: 100px;
		${theme.centerX}
		> div{
			${theme.boxShadowStep(-1)}
			flex-grow: 1;
			border: 4px solid ${theme.color.greyStep(0)};
			border-top: none;
			max-width: 900px;
			margin: 0 150px;
		}
	}
	> .main{
		width: 100%;
		position: relative;
		min-height: calc(100vh - 450px);
		${theme.centerX}
	}
	> .foot{
		margin-top: 20px;
		height: 80px;
		position: relative;
	}

	h2{
		text-align: center;
		${theme.font.sizeStep(3)}
		margin: 20px 0;
	}
	p{
		font-size: 20px;
		margin: 15px 40px;
		line-height: 1.4;
	}
	.handwritten{
		font-size: 30px;
		line-height: 1;
		letter-spacing: 0.1rem;
		font-family: 'Sue Ellen Francisco', cursive;
	}
}`);

class MissingPage extends CustomElm{
	constructor(){
		super();
		this.define(html`
			404 Error - Page Not Found
		`);
	}
}
defineElm(MissingPage,scss`&{

}`);

class ElementPage extends CustomElm{
	constructor(){
		super();
		this.define(html`
			${new Surface(html`
				<h2>Explanation</h2>
				<p class="center">This is a sample website to showcase development with custom elements.</p>
			`,"lg",false,true)}
			${new Surface(html`
				<h2>Examples</h2>
				${new ElementExamples()}
			`,"sm",true)}
		`);
	}
}
defineElm(ElementPage,scss`&{
	width: 100%;
	> .gap{
		height: 40px;
	}
	p.center{
		text-align: center;
	}
}`);

class AboutPage extends CustomElm{
	constructor(){
		super();
		this.define(html`
		<div class="gap"></div>
		${new Surface(html`
			<h2>About</h2>
			<p class="center">This is a sample website to showcase development with custom elements.</p>
		`,"sm",false)}
	`);
	}
}
defineElm(AboutPage,scss`&{
	width: 100%;
	> .gap{
		height: 40px;
	}
	p.center{
		text-align: center;
	}

}`);

class ElementExamples extends CustomElm{
	constructor(){
		super();
		let text=bind("test");

		let toggle=bind(true);
		let invToggle=def(()=>!toggle.data,toggle);
		let item1Name=bind("Item 1");
		let item2Name=bind("Item 2");
		let item1BtnText=def(()=>"Open "+item1Name.data,item1Name);
		let item2BtnText=def(()=>"Open "+item2Name.data,item2Name);

		let list=bind(["An item","Another item","Some other item"]);

		let htmlText=bind(`<li>some text</li>`);


		this.define(html`
			<div class="line"><h3>EX 1</h3></div>
			<div class="ex1">
				<p class="center">This is an example of two linked text inputs</p>
				<div>
					${new Input(text)}
					${new Input(text)}
				</div>
				<p class="center">
					The text currently is:<br/>
					<span>${html`${text}`(text)}</span>
				</p>
			</div>

			<div class="line"><h3>EX 2</h3></div>
			<div class="ex2">
				<p class="center">This is an example of a conditional switch</p>
				<div class="buttons">
					${new ButtonClickable(item1BtnText,()=>{toggle.data=true},toggle)}
					${new ButtonClickable(item2BtnText,()=>{toggle.data=false},invToggle)}
				</div>
				<div class="item">
				${()=>{
					let a,b;
					
					return html`${
						()=>toggle.data?
						a=a??html`
							<p class="center">
								Hello! I am ${item1Name}<br>
								You can rename me though:
							</p>
							${new Input(item1Name)}
						`(item1Name):
						b=b??html`
							<p class="center">
								Hey there, I am ${item2Name}<br>
								You can rename me though:
							</p>
							${new Input(item2Name)}
						`(item2Name)
					}`(toggle);
				}}
				</div>
			</div>

			<div class="line"><h3>EX 3</h3></div>
			<div class="ex3">
				<p class="center">This is an example of a list</p>
				<div class="buttons">
					${new ButtonClickable("Add Item",()=>{
						// Lock the list before doing any operations on it
						// This ensures that it will only fire a maximum of one update event
						list.lock();
						list.unshift("new item "+Math.floor(Math.random()*1000));
						list.unlock();
					})}
				</div>
				<div class="list">
					${html`
						<p>Length: ${()=>list.length}</p> 
						<ul>
							${()=>
								list.map((item,i)=>{
									return html`
										<li>
											<span class="index">${i}</span>
											${item} ${new ButtonLink("(remove)",()=>{
												// Lock the list before doing any operations on it
												// This ensures that it will only fire a maximum of one update event
												list.lock();
												list.splice(i,1);
												list.unlock();
											})}
										</li>
									`(item)
									}
								)
							}
						</ul>
					`(list)}
				</div>
				<div class="buttons">
					${new ButtonLink("(rename a random Item)",()=>{
						if(list.length>0){
							let index=Math.floor(Math.random()*list.length);
							list[index].data="renamed item "+Math.floor(Math.random()*1000);
						}
					})}
				</div>
			</div>

			<div class="line"><h3>EX 4</h3></div>
			<div class="ex4">
				<p class="center">String rendering with HTML parsing</p>
				<div>
					${new Input(htmlText)}
				</div>
				<p class="center">
					The text currently is:<br/>
					<div class="html">${html`${htmlText}`(htmlText)}</div>
				</p>
			</div>

			<div class="line"><h3>EX 5</h3></div>
			<div class="ex5">
				<p class="center">String rendering without HTML parsing</p>
				<div>
					${new Input(htmlText)}
				</div>
				<p class="center">
					The text currently is:<br/>
					<span class="text">${html`${()=>safe(htmlText.data)}`(htmlText)}</span>
				</p>
			</div>
		`);
	}
}
defineElm(ElementExamples,scss`&{
	> .line{
		border-bottom: 4px solid ${theme.color.greyStep(0)};
		${theme.center}
		margin: 40px 30px;
		h3{
			color: ${theme.color.greyStep(3)};
			background-color: ${theme.color.greyStep(-1)};
			padding: 0 20px;

			font-weight: 700;
			${theme.font.sizeStep(-1)}
			position: absolute;
		}
	}
	> .ex1{
		> div{
			${theme.center}
			> ${Input}{
				margin: 20px;
			}
		}
		span{
			font-weight: 700;
			padding: 0 20px;
			border-radius: 20px;
			background-color: ${theme.color.greyStep(1)};
		}
	}
	> .ex2{
		> .buttons{
			${theme.center}
			> ${ButtonClickable}{
				margin: 20px;
			}
		}
		> .item{
			> ${Input}{
				${theme.center}
			}
		}
	}
	> .ex3{
		> .buttons{
			${theme.center}
			> ${ButtonClickable}{
				margin: 20px;
			}
		}
		> .list{
			${theme.center}
			> *{
				flex-basis: 0;
				flex-grow: 1;
				margin: 0;
			}
			> p{
				text-align: right;
				margin-right: 20px;
			}
			li{
				margin: 10px 0;
				display: flex;

				${ButtonLink}{
					margin-left: 10px;
				}
			}
			.index{
				${theme.center}
				font-weight: 700;
				width: 40px;
				border-radius: 20px;
				background-color: ${theme.color.greyStep(1)};
				margin-right: 10px;
			}
		}
	}
	> .ex4{
		> div{
			${theme.center}
			> ${Input}{
				margin: 20px;
			}
		}
		.html{
			${theme.center}
			min-height: 100px;
			background-color: ${theme.color.greyStep(-0.5)};
		}
	}
	> .ex5{
		> div{
			${theme.center}
			> ${Input}{
				margin: 20px;
			}
		}
		.text{
			padding: 0 20px;
			border-radius: 20px;
			background-color: ${theme.color.greyStep(0)};
		}
	}
}`);


// let a=html`<div>${html`<div>testA</div>`()}</div>`();
// let b=html`<div>${html`<div>testB</div>`()}</div>`();
// let sel=bind(null);
// sel.data=a;

// let body=html`
// test
// 	<div>${()=>sel}</div>
// 	<button onClick=${attr(act(()=>{
// 		sel.data=sel.data==a?b:a;
// 	}))}>change</button>
// `(sel).data;
// addElm(body,document.body);
// body.disolve();




// let testList=bind([10,20,"test"]);
// for(let i=0;i<500;i++){
// 	testList.push("test"+i);
// }
// testList.sub(()=>console.log("change"));

// let body=html`
// 	<h1>Repeater</h1>
// 	<button
// 		onClick=${attr(act(()=>{
// 			let randomId=(Math.random()+1).toString(36).substring(7);
// 			testList.lock();
// 			testList.unshift("Item - "+randomId);
// 			testList.unlock();
// 		}))}
// 	>
// 		Add New Item
// 	</button>

// 	${()=>testList.map(
// 		(n,i)=>
// 		html`
// 			<div>
// 				Index: ${i} Value: ${new Item(n)} - 
// 					<button
// 					onClick=${attr(act(()=>{
// 						testList.lock();
// 						testList.splice(i,1);
// 						testList.unlock();
// 					}))}
// 				>
// 					Remove Item
// 				</button>
// 			</div>
// 		`(n)
// 	)}
// `(testList).data;
// addElm(body,document.body);
// body.disolve();



