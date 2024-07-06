// Create global page styles
createStyles(scss`&{
	background-color: ${theme.color.greyStep(-1)};
	overflow:hidden;
	canvas{
		position:absolute;
		width:100vw;
		height:100vh;
	}
	.gl{
		pointer-events:none;
		opacity:1;
		image-rendering: pixelated;
	}
}`());

let canvasElm=newElm("canvas");
let glCanvasElm=newElm("canvas");
let gl=glCanvasElm.getContext("webgl2",{
	premultipliedAlpha: true
});
gl.getExtension("EXT_color_buffer_float");
gl.getExtension("EXT_float_blend");

// Populate page html
let body=html`
	${addClass("gl",glCanvasElm)}
	${addClass("canvas",canvasElm)}
`();
addElm(body,document.body);
body.disolve();

let display=new CanvasDisplay(canvasElm);
let control=new Control();
control.connect(canvasElm);

let shaderManager=new ShaderManager();
let renderShader=new RenderShader();
let particle=new ParticleManager();
let canvasTex=new Texture({
	src: canvasElm,
	minMag: gl.NEAREST,
	wrap: gl.CLAMP_TO_EDGE
});

let list=new ListManager(particle.arrayTexPP);
//run a single time to spawn in initial particles
list.run();

let frameAnim=animate(()=>{
	display.clear();
	if(control.mouseDown){
		if(control.mouseLDown){
			// display.setStroke(rgb(1,0,1));
			display.setFill(rgb(0,1,0,.1));
			display.circ(control.getMouse(display.view),100);
		}
		if(control.mouseRDown){
			display.setFill(rgb(1,0,0,.1));
			display.circ(control.getMouse(display.view),95);
		}
		// control.mouseDown=false;
	}
	canvasTex.update(canvasElm);
	particle.run(shaderManager,renderShader,canvasTex);
	list.run();
},1,true).start();
