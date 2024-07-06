class CoordTransformer{
	constructor(){
	}
	transform(x,y){
		return [x,y];
	}
	scale(v){
		return v;
	}
}
class Cam extends CoordTransformer{
	constructor(pos,zoom){
		super();
		this.pos=new Vector(pos);
		this.zoom=zoom;
	}
	transform(x,y){
		return [(x-this.pos.x)*this.zoom,(y-this.pos.y)*this.zoom];
	}
	scale(v){
		return v*this.zoom;
	}
}
class CanvasDisplay{
	constructor(canvas,initResize=true){
		this.canvas=canvas;
		this.ctx=canvas.getContext("2d");

		this.size=null;
		if(initResize){
			window.onresize=()=>this.updateSize();
		}
		this.updateSize();

		// this.view=new CoordTransformer();
		this.view=new Cam(Vec(0,0),1);//TODO

		this.hasStroke=false;
		this.hasFill=false;
		this.resetBrush();
	}

	updateSize(){
		let w=this.canvas.offsetWidth;
		let h=this.canvas.offsetHeight;
		this.size=new Vector(w,h);
		this.canvas.setAttribute("width",w);
		this.canvas.setAttribute("height",h);
	}

	transform(...vec){
		if(vec.length==1){
			vec=vec[0];
		}
		let x=vec.x??vec[0]??0;
		let y=vec.y??vec[1]??0;
		return this.view.transform(x,y);
	}
	scale(...vals){
		if(vals.length==1&&typeof vals[0]!="number"){
			vals=[...vals[0]];
		}
		return vals.map(v=>this.view.scale(v));
	}

	setStroke(col){
		this.hasStroke=true;
		this.ctx.strokeStyle=col;
	}
	setFill(col){
		this.hasFill=true;
		this.ctx.fillStyle=col;
	}
	setWeight(val){
		this.ctx.lineWidth=val;
	}
	noStroke(){
		this.hasStroke=false;
		this.ctx.strokeStyle="#FFFFFF00";
	}
	noFill(){
		this.hasFill=false;
		this.ctx.fillStyle="#FFFFFF00";
	}
	resetBrush(){
		this.noStroke();
		this.noFill();
		this.setWeight(1);
	}

	// (x,y)
	mt(...vec){
		let vec2=this.transform(...vec);
		this.ctx.moveTo(vec2[0],vec2[1]);
		return this;
	}
	
	// (x,y)
	lt(...vec){
		let vec2=this.transform(...vec);
		this.ctx.lineTo(vec2[0],vec2[1]);
		return this;
	}

	start(){
		this.ctx.beginPath();
		return this;
	}
	path(close){
		if(close)
			this.ctx.closePath();
		if(this.hasStroke)
			this.ctx.stroke();
		return this;
	}
	shape(close){
		if(close)
			this.ctx.closePath();
		if(this.hasFill)
			this.ctx.fill();
		if(this.hasStroke)
			this.ctx.stroke();
		return this;
	}
	
	// (x,y) (w,h)
	rect(...args){
		let [x,y]=this.transform(readArgVec(args));
		let [w,h]=this.scale(readArgVec(args));
		if(this.hasFill)
			this.ctx.fillRect(x,y,w,h);
		if(this.hasStroke)
			this.ctx.strokeRect(x,y,w,h);
	}
	// (x,y) r
	circ(...args){
		let [x,y]=this.transform(readArgVec(args));
		let r=this.scale(readArg(args));
		this.start();
		this.ctx.arc(x,y,r,0,TAU);
		this.shape(true);
	}

	clear(){
		this.ctx.clearRect(0,0,this.size.x,this.size.y);
	}
	fullRect(){
		if(this.hasFill)
			this.ctx.fillRect(0,0,this.size.x, this.size.y);
	}
}