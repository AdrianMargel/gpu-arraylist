/*
	This file is the original prototype for the arraylist concept.
	It's much slower than the final version but also simpler.
	I'm keeping it here for future reference, just in case.
*/
class ListManager{
	constructor(itemTex){
		this.maxLength=1<<ceil(Math.log2(1000000));

		// this.inputTex=new Texture({
		// 	...sizeObj(boxSize(this.maxLength)),
		// 	minMag: gl.NEAREST,
		// 	wrap: gl.REPEAT,
		// 	internalFormat: gl.RG32F,
		// 	src:boxArray(Array(boxSize(this.maxLength)[0]*boxSize(this.maxLength)[1]).fill().flatMap(x=>
		// 		// [max(random(-1,1),0)||-1,max(random(-1,1),0)||-2]
		// 		[max(random(-1,1),0)||-1,-2]
		// 	)),
		// });

		// this.itemTex=new Texture({
		// 	...sizeObj(boxSize(this.maxLength)),
		// 	minMag: gl.NEAREST,
		// 	wrap: gl.REPEAT,
		// 	internalFormat: gl.R32F,
		// });
		this.itemTex=itemTex;

		this.slotTex=new Texture({
			...sizeObj(boxSize(this.maxLength)),
			minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.R32F,
		});

		this.levelTex=new Texture({
			...sizeObj(boxSize(this.maxLength*2)),
			minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.RG32F,
		});
		this.compressItemTex=new Texture({
			...sizeObj(boxSize(this.maxLength)),
			minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.R32F,
		});
		this.compressSlotTex=new Texture({
			...sizeObj(boxSize(this.maxLength)),
			minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.R32F,
		});

		this.metaTexPP=new TexturePingPong({
			width: 1,
			height: 1,
			minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.RGBA32F,
			src:[0,this.maxLength,0,0],
		});

		this.levelShader=new LevelShader(glsl`
			vec2 getInstructions(sampler2D tex,vec2 size){
				ivec2 idxCoord=getIdxCoord(gl_VertexID*3,size);
				int val=int(texelFetch(tex,idxCoord,0).x);
				return vec2(
					val>0&&(val&2)>0,//add
					val>0&&(val&4)>0 //remove
				);
			}
		`);
		this.compressorShader=new CompressorShader();
		this.listLengthShader=new ListLengthShader();
		this.listSlotShader=new ListSlotShader();
		this.listItemShader=new ListItemShader(glsl`
			int getInstructionIndex(int idx){
				return idx*3;
			}
		`);
		this.slotInitShader=new SlotInitShader();
		this.slotInitShader.run(this.maxLength,this.slotTex);
	}
	run(){
		this.levelTex.clear();
		//note that the input tex could be different from the item tex, but it would require using index values
		for(let i=0;i<=ceil(Math.log2(1000000));i++){ 
			this.levelShader.run(this.maxLength,this.levelTex,this.itemTex,1<<ceil(Math.log2(1000000)),i);
		}
		this.compressorShader.run(0,this.maxLength,this.levelTex,this.compressItemTex,1<<ceil(Math.log2(1000000)),ceil(Math.log2(1000000)));
		this.compressorShader.run(1,this.maxLength,this.levelTex,this.compressSlotTex,1<<ceil(Math.log2(1000000)),ceil(Math.log2(1000000)));
		this.listLengthShader.run(this.levelTex,this.metaTexPP);
		this.listSlotShader.run(this.maxLength,this.compressSlotTex,this.slotTex,this.metaTexPP);
		this.listItemShader.run(this.maxLength,this.compressItemTex,this.itemTex,this.slotTex,this.metaTexPP);

		// console.log("level",this.levelTex.read(2,gl.RG,gl.FLOAT,Float32Array));
		// console.log("compressItem",this.compressItemTex.read(1,gl.RED,gl.FLOAT,Float32Array));
		// console.log("compressSlot",this.compressSlotTex.read(1,gl.RED,gl.FLOAT,Float32Array));
		// console.log("slot",this.slotTex.read(1,gl.RED,gl.FLOAT,Float32Array));
		// console.log("meta",this.metaTexPP.read(4,gl.RGBA,gl.FLOAT,Float32Array));

		// console.log("item",this.itemTex.read(4,gl.RGBA,gl.FLOAT,Float32Array));
		// console.log("item",this.itemTex.read(1,gl.RED,gl.FLOAT,Float32Array));
	}
}
class LevelShader extends Shader{
	constructor(instructionsGlsl){
		super(
			glsl`#version 300 es
				precision highp float;
				precision highp isampler2D;

				uniform int levelScale;
				uniform int levelStart;
				uniform vec2 levelSize;

				uniform sampler2D inputTex;
				uniform vec2 inputSize;

				flat out vec2 channels;
				
				${SHADER_FUNCS.DATA_TEX}

				${instructionsGlsl}

				void main(){
					gl_PointSize=1.;

					vec2 instructions=getInstructions(inputTex,inputSize);

					if(bool(instructions.x)||bool(instructions.y)){
						int levelIdx=gl_VertexID/levelScale+levelStart;
						gl_Position=vec4(getIdxPos(levelIdx,levelSize)*2.-1.,1.,1.);
						channels=instructions;
					}else{
						gl_Position=vec4(-2.);
					}
				}
			`,
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp sampler2D;

				flat in vec2 channels;

				out vec4 outColor;

				void main(){
					outColor=vec4(channels,0.,0.);
				}
			`,
		);
		this.drawType=gl.POINTS;
	}
	run(maxLength,levelTex,inputTex,inputLength,level){
		//inputLength must be a power of 2
		let levelLength=1<<level;
		let levelScale=inputLength/levelLength;
		let levelStart=levelLength-1;
		// console.log(levelLength,levelScale,levelStart,inputLength);
		this.uniforms={
			levelScale:levelScale,
			levelStart:levelStart,
			
			levelSize:levelTex.size,
			inputTex:inputTex.tex,
			inputSize:inputTex.size,
		};
		this.attachments=[
			{
				attachment:levelTex.tex,
				...sizeObj(levelTex.size)
			}
		];
		/*
			IMPORTANT NOTE
			Blending only works for floats. Therefor we can't use int textures for the count.
			Quote from the OpenGL spec:
			"Blending applies only if the color buffer has a fixed-point format. If the color buffer has an integer format, proceed to the next operation."
		*/
		gl.enable(gl.BLEND);
		gl.blendEquation(gl.FUNC_ADD);
		gl.blendFunc(gl.ONE,gl.ONE);
		super.run(maxLength);
		gl.disable(gl.BLEND);

		// console.log(levelTex.read(2,gl.RG,gl.FLOAT,Float32Array));
	}
}
class CompressorShader extends Shader{
	constructor(){
		super(
			glsl`#version 300 es
				precision highp int;
				precision highp float;
				precision highp isampler2D;

				uniform int levelMax;
				uniform int inputLength;

				uniform vec2 compressSize;

				uniform sampler2D levelTex;
				uniform vec2 levelSize;
				uniform int channel;

				flat out float inputIdx;
				
				${SHADER_FUNCS.DATA_TEX}

				vec2 getLevelPrev(int idx,int level){
					int levelLength=1<<level;
					int levelScale=inputLength/levelLength;
					int levelStart=levelLength-1;

					int levelIdx=idx/levelScale;

					if(mod(float(levelIdx),2.)==1.){
						levelIdx+=levelStart;
						levelIdx--;
						ivec2 levelCoord=getIdxCoord(levelIdx,levelSize);
						return texelFetch(levelTex,levelCoord,0).xy;
					}
					return vec2(0.);
				}
				vec2 getLevel(int idx,int level){
					int levelLength=1<<level;
					int levelScale=inputLength/levelLength;
					int levelStart=levelLength-1;

					int levelIdx=idx/levelScale;

					levelIdx+=levelStart;
					ivec2 levelCoord=getIdxCoord(levelIdx,levelSize);
					return texelFetch(levelTex,levelCoord,0).xy;
				}

				void main(){
					gl_PointSize=1.;

					float val=getLevel(gl_VertexID,levelMax)[channel];

					if(val>0.){
						float count=0.;
						for(int i=0;i<=levelMax;i++){
							count+=getLevelPrev(gl_VertexID,i)[channel];
						}
						gl_Position=vec4(getIdxPos(int(count),compressSize)*2.-1.,1.,1.);
						inputIdx=float(gl_VertexID);
					}else{
						gl_Position=vec4(-2.);
					}
				}
			`,
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp int;
				precision highp float;
				precision highp sampler2D;


				flat in float inputIdx;

				out vec4 outColor;

				void main(){
					outColor=vec4(inputIdx);
				}
			`,
		);
		this.drawType=gl.POINTS;
	}
	run(channel,maxLength,levelTex,compressTex,inputLength,levelMax){
		//inputLength must be a power of 2
		this.uniforms={
			levelMax,
			inputLength,
			channel,
			compressSize:compressTex.size,

			levelTex:levelTex.tex,
			levelSize:levelTex.size,
		};
		this.attachments=[
			{
				attachment:compressTex.tex,
				...sizeObj(compressTex.size)
			}
		];
		super.run(maxLength);
		// console.log(compressTex.read(2,gl.RG,gl.FLOAT,Float32Array));
	}
}
class ListItemShader extends Shader{
	constructor(instructionIdxGlsl){
		super(
			glsl`#version 300 es
				precision highp float;
				precision highp isampler2D;

				uniform sampler2D compressTex;
				uniform vec2 compressSize;
				uniform sampler2D metaTex;
				uniform vec2 metaSize;
				uniform sampler2D slotTex;
				uniform vec2 slotSize;
				uniform vec2 itemSize;
				uniform int channel;

				flat out float inputIdx;
				
				${SHADER_FUNCS.DATA_TEX}

				${instructionIdxGlsl}

				void main(){
					gl_PointSize=1.;
					vec4 meta=texelFetch(metaTex,ivec2(0,0),0);
					//get item add
					int compressLength=int(meta[2]);
					//get slot add
					int compressSlotLength=int(meta[3]);
					//get slot length
					int slotLength=int(meta[0])+compressSlotLength;

					if(gl_VertexID<compressLength&&gl_VertexID<slotLength){
						ivec2 compressCoord=getIdxCoord(gl_VertexID,compressSize);
						float sourceIdx=texelFetch(compressTex,compressCoord,0)[0];

						ivec2 slotCoord=getIdxCoord(slotLength-gl_VertexID-1,slotSize);
						int slotIdx=int(texelFetch(slotTex,slotCoord,0).x);

						gl_Position=vec4(getIdxPos(getInstructionIndex(slotIdx),itemSize)*2.-1.,1.,1.);//TODO:check
						inputIdx=float(sourceIdx);
					}else{
						gl_Position=vec4(-2.);
					}
				}
			`,
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp sampler2D;

				flat in float inputIdx;

				out vec4 outColor;

				void main(){
					//this could be compressed into a single component if required
					outColor=vec4(1,inputIdx,0,0);
				}
			`,
		);
		this.drawType=gl.POINTS;
	}
	run(maxLength,compressTex,itemTex,slotTex,metaTex){
		this.uniforms={
			compressTex:compressTex.tex,
			compressSize:compressTex.size,
			metaTex:metaTex.tex,
			metaSize:metaTex.size,
			slotTex:slotTex.tex,
			slotSize:slotTex.size,
			itemSize:itemTex.size,
		};
		this.attachments=[
			{
				attachment:itemTex.tex,
				...sizeObj(itemTex.size)
			}
		];
		super.run(maxLength);
	}
}
class ListSlotShader extends Shader{
	constructor(){
		super(
			glsl`#version 300 es
				precision highp float;
				precision highp isampler2D;

				uniform sampler2D compressTex;
				uniform vec2 compressSize;
				uniform sampler2D metaTex;
				uniform vec2 metaSize;
				uniform int channel;
				uniform vec2 slotSize;

				flat out float inputIdx;
				
				${SHADER_FUNCS.DATA_TEX}

				void main(){
					gl_PointSize=1.;
					vec4 meta=texelFetch(metaTex,ivec2(0,0),0);
					//get slot add
					float compressLength=meta[3];

					if(gl_VertexID<int(compressLength)){
						ivec2 compressCoord=getIdxCoord(gl_VertexID,compressSize);
						float sourceIdx=texelFetch(compressTex,compressCoord,0)[0];

						//get slot length
						float listLength=meta[0];

						gl_Position=vec4(getIdxPos(int(listLength)+gl_VertexID,slotSize)*2.-1.,1.,1.);
						inputIdx=sourceIdx;
					}else{
						gl_Position=vec4(-2.);
					}
				}
			`,
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp sampler2D;

				flat in float inputIdx;

				out vec4 outColor;

				void main(){
					outColor=vec4(inputIdx);
				}
			`,
		);
		this.drawType=gl.POINTS;
	}
	run(maxLength,compressTex,slotTex,metaTex){
		this.uniforms={
			compressTex:compressTex.tex,
			compressSize:compressTex.size,
			metaTex:metaTex.tex,
			metaSize:metaTex.size,
			slotSize:slotTex.size
		};
		this.attachments=[
			{
				attachment:slotTex.tex,
				...sizeObj(slotTex.size)
			}
		];
		super.run(maxLength);
	}
}
class ListLengthShader extends FragShader{
	constructor(){
		super(
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp sampler2D;

				uniform sampler2D levelTex;
				uniform vec2 levelSize;
				uniform sampler2D metaTex;
				uniform vec2 metaSize;
				
				out vec4 outColor;

				${SHADER_FUNCS.DATA_TEX}

				void main(){
					ivec2 zeroCoord=getIdxCoord(0,levelSize);
					vec2 compressLengths=texelFetch(levelTex,zeroCoord,0).xy;

					// ivec2 lengthCoord=getIdxCoord(1,metaSize);
					// float listLength=texelFetch(metaTex,lengthCoord,0).x;
					vec4 meta=texelFetch(metaTex,ivec2(0,0),0);
					float listLength=meta[1];

					int pixelIdx=getCoordIdx(ivec2(gl_FragCoord.xy),metaSize);
					
					outColor=vec4(
						//previous slot length
						listLength,
						//new slot length
						max(listLength+compressLengths.y-compressLengths.x,0.),
						//change items
						compressLengths.x,
						//change slots
						compressLengths.y
					);
					// if(pixelIdx==0){
					// 	//previous length
					// 	outColor=vec4(listLength);
					// }else if(pixelIdx==1){
					// 	//new length
					// 	outColor=vec4(listLength+compressLengths.x);
					// }else if(pixelIdx==2){
					// 	//change
					// 	outColor=vec4(compressLengths.x);
					// }
				}
			`,
		);
	}
	run(levelTex,metaTexPP){
		this.uniforms={
			levelTex:levelTex.tex,
			levelSize:levelTex.size,
			metaTex:metaTexPP.tex,
			metaSize:metaTexPP.size,
		};
		this.attachments=[
			{
				attachment:metaTexPP.flip().tex,
				...sizeObj(metaTexPP.size)
			}
		];
		super.run();
	}
}
class SlotInitShader extends FragShader{
	constructor(){
		super(
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp sampler2D;

				uniform vec2 slotSize;
				uniform int maxLength;
				
				out vec4 outColor;

				${SHADER_FUNCS.DATA_TEX}

				void main(){
					outColor=max(vec4(maxLength-1-getCoordIdx(ivec2(gl_FragCoord.xy),slotSize)),-1.);
				}
			`,
		);
	}
	run(maxLength,slotTex){
		this.uniforms={
			slotSize:slotTex.size,
			maxLength
		};
		this.attachments=[
			{
				attachment:slotTex.tex,
				...sizeObj(slotTex.size)
			}
		];
		super.run();
	}
}