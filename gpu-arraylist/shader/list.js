class ListManager{
	constructor(itemTex){
		this.maxLength=1000000;
		this.maxLevels=ceil(Math.log2(this.maxLength));
		this.maxBinaryLength=1<<this.maxLevels;

		this.itemTex=itemTex;

		this.slotTex=new Texture({
			...sizeObj(boxSize(this.maxLength)),
			minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.R32F,
		});

		this.levelTexPP=new TexturePingPong({
			...sizeObj(boxSize(this.maxBinaryLength*2)),
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

		this.levelInitShader=new LevelInitShader(glsl`
			vec2 getInstructions(sampler2D tex,vec2 size){
				ivec2 idxCoord=getIdxCoord(gl_VertexID*3,size);
				int val=int(texelFetch(tex,idxCoord,0).x);
				return vec2(
					val>0&&(val&2)>0,//add
					val>0&&(val&4)>0 //remove
				);
			}
		`);
		this.levelShader=new LevelShader();
		this.levelFlipShader=new LevelFlipShader();
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
		this.levelInitShader.run(this.maxLevels,this.maxLength,this.maxBinaryLength,this.levelTexPP,this.itemTex);
		this.levelFlipShader.run(this.maxLevels,this.maxLength,this.maxBinaryLength,this.levelTexPP);
		for(let i=this.maxLevels-1;i>=0;i--){
			this.levelShader.run(i,this.maxLength,this.maxBinaryLength,this.levelTexPP);
			//TODO: this can probably be simplified into a single flip that merges everything at the same time (same applies elsewhere)
			this.levelFlipShader.run(i,this.maxLength,this.maxBinaryLength,this.levelTexPP);
		}
		this.compressorShader.run(0,this.maxLevels,this.maxLength,this.maxBinaryLength,this.levelTexPP,this.compressItemTex);
		this.compressorShader.run(1,this.maxLevels,this.maxLength,this.maxBinaryLength,this.levelTexPP,this.compressSlotTex);
		this.listLengthShader.run(this.levelTexPP,this.metaTexPP);
		this.listSlotShader.run(this.maxLength,this.compressSlotTex,this.slotTex,this.metaTexPP);
		this.listItemShader.run(this.maxLength,this.compressItemTex,this.itemTex,this.slotTex,this.metaTexPP);

		// console.log("level",this.levelTexPP.read(2,gl.RG,gl.FLOAT,Float32Array));
		// console.log("compressItem",this.compressItemTex.read(1,gl.RED,gl.FLOAT,Float32Array));
		// console.log("level",this.levelTexPP.read(2,gl.RG,gl.FLOAT,Float32Array));
		// console.log("compressSlot",this.compressSlotTex.read(1,gl.RED,gl.FLOAT,Float32Array));
		// console.log("slot",this.slotTex.read(1,gl.RED,gl.FLOAT,Float32Array));
		// console.log("meta",this.metaTexPP.read(4,gl.RGBA,gl.FLOAT,Float32Array));

		// console.log("item",this.itemTex.read(4,gl.RGBA,gl.FLOAT,Float32Array));
		// console.log("item",this.itemTex.read(1,gl.RED,gl.FLOAT,Float32Array));
		// console.log("-----");
	}
}
class LevelInitShader extends Shader{
	constructor(instructionsGlsl){
		super(
			glsl`#version 300 es
				precision highp float;
				precision highp isampler2D;

				uniform int level;
				uniform int maxBinaryLength;

				uniform sampler2D inputTex;
				uniform vec2 inputSize;
				uniform vec2 levelSize;

				flat out vec2 channels;
				
				${SHADER_FUNCS.DATA_TEX}

				${instructionsGlsl}

				void main(){
					gl_PointSize=1.;

					vec2 instructions=getInstructions(inputTex,inputSize);

					if(bool(instructions.x)||bool(instructions.y)){
						int levelLength=1<<level;
						int levelScale=maxBinaryLength/levelLength;
						int levelStart=levelLength-1;
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
	run(level,maxLength,maxBinaryLength,levelTexPP,inputTex){
		levelTexPP.clear();
		this.uniforms={
			level:level,
			maxBinaryLength:maxBinaryLength,
			
			inputTex:inputTex.tex,
			inputSize:inputTex.size,
			levelSize:levelTexPP.size,
		};
		this.attachments=[
			{
				attachment:levelTexPP.flip().tex,
				...sizeObj(levelTexPP.size)
			}
		];
		super.run(maxLength);
	}
}
class LevelFlipShader extends Shader{
	constructor(){
		super(
			glsl`#version 300 es
				precision highp float;
				precision highp isampler2D;

				uniform int level;

				uniform sampler2D levelTex;
				uniform vec2 levelSize;

				flat out vec2 channels;
				
				${SHADER_FUNCS.DATA_TEX}

				vec2 getLevelDirect(int idx,int level){
					int levelLength=1<<level;
					int levelStart=levelLength-1;

					int levelIdx=idx;

					levelIdx+=levelStart;
					ivec2 levelCoord=getIdxCoord(levelIdx,levelSize);
					return texelFetch(levelTex,levelCoord,0).xy;
				}

				void main(){
					gl_PointSize=1.;

					vec2 instructions=getLevelDirect(gl_VertexID,level);

					if(bool(instructions.x)||bool(instructions.y)){
						int levelLength=1<<level;
						int levelStart=levelLength-1;

						gl_Position=vec4(getIdxPos(gl_VertexID+levelStart,levelSize)*2.-1.,1.,1.);
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
	run(level,maxLength,maxBinaryLength,levelTexPP){
		this.uniforms={
			level:level,
			
			levelTex:levelTexPP.tex,
			levelSize:levelTexPP.size,
		};
		this.attachments=[
			{
				attachment:levelTexPP.flip().tex,
				...sizeObj(levelTexPP.size)
			}
		];
		let levelLength=1<<level;
		//TODO: I think subtracting level from maxLevel would be quicker for this
		let levelScale=maxBinaryLength/levelLength;
		super.run(ceil(maxLength/levelScale));
	}
}
class LevelShader extends Shader{
	constructor(){
		super(
			glsl`#version 300 es
				precision highp float;
				precision highp isampler2D;

				uniform int level;

				uniform sampler2D levelTex;
				uniform vec2 levelSize;

				flat out vec2 channels;
				
				${SHADER_FUNCS.DATA_TEX}

				vec2 getLevelDirect(int idx,int level){
					int levelLength=1<<level;
					int levelStart=levelLength-1;

					int levelIdx=idx;

					levelIdx+=levelStart;
					ivec2 levelCoord=getIdxCoord(levelIdx,levelSize);
					return texelFetch(levelTex,levelCoord,0).xy;
				}

				void main(){
					gl_PointSize=1.;

					vec2 instructions=getLevelDirect(gl_VertexID,level+1);

					if(bool(instructions.x)||bool(instructions.y)){
						int levelLength=1<<level;
						int levelStart=levelLength-1;

						gl_Position=vec4(getIdxPos(gl_VertexID/2+levelStart,levelSize)*2.-1.,1.,1.);
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
	run(level,maxLength,maxBinaryLength,levelTexPP){
		this.uniforms={
			level:level,
			
			levelTex:levelTexPP.tex,
			levelSize:levelTexPP.size,
		};
		this.attachments=[
			{
				attachment:levelTexPP.flip().tex,
				...sizeObj(levelTexPP.size)
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
		let levelLength=1<<(level+1);
		let levelScale=maxBinaryLength/levelLength;
		super.run(ceil(maxLength/levelScale));
		gl.disable(gl.BLEND);
	}
}
class CompressorShader extends Shader{
	constructor(){
		super(
			glsl`#version 300 es
				precision highp int;
				precision highp float;
				precision highp isampler2D;

				uniform int maxLevels;
				uniform int maxBinaryLength;
				uniform int channel;

				uniform vec2 compressSize;
				uniform sampler2D levelTex;
				uniform vec2 levelSize;

				flat out float inputIdx;
				
				${SHADER_FUNCS.DATA_TEX}

				vec2 getLevelPrev(int idx,int level){
					int levelLength=1<<level;
					int levelScale=maxBinaryLength/levelLength;
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
					int levelScale=maxBinaryLength/levelLength;
					int levelStart=levelLength-1;

					int levelIdx=idx/levelScale;

					levelIdx+=levelStart;
					ivec2 levelCoord=getIdxCoord(levelIdx,levelSize);
					return texelFetch(levelTex,levelCoord,0).xy;
				}

				void main(){
					gl_PointSize=1.;

					float val=getLevel(gl_VertexID,maxLevels)[channel];

					if(val>0.){
						float count=0.;
						for(int i=0;i<=maxLevels;i++){
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
	run(channel,maxLevels,maxLength,maxBinaryLength,levelTex,compressTex){
		this.uniforms={
			maxLevels,
			maxBinaryLength,
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

						gl_Position=vec4(getIdxPos(getInstructionIndex(slotIdx),itemSize)*2.-1.,1.,1.);
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