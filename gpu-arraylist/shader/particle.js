class ParticleManager{
	constructor(){
		this.maxLength=1000000;
		let src=Array(this.maxLength).fill(-1);

		//Spawn in some starting particles
		for(let i=0;i<10;i++){
			src[4*3*i+4+0]=.5;
			src[4*3*i+4+1]=.5;
			src[4*3*i+0]=2;
		}

		let arrSize=boxSize(this.maxLength*3,{},3);
		this.arrayTexPP=new TexturePingPong({
			...sizeObj(arrSize),
			minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.RGBA32F,
			src:padArray(src,arrSize[0]*arrSize[1]*4,-1)
		});
		this.envTex=new Texture({
			width:1,
			height:1,
			// minMag: gl.NEAREST,
			wrap: gl.REPEAT,
			internalFormat: gl.RGBA32F,
		});
		this.time=0;
		this.particleShader=new ParticleShader();
		this.particleDrawShader=new ParticleDrawShader();
	}
	run(shaderManager,renderShader,inputCanvas){
		this.time++;
		shaderManager.resizeToDisplay(this.envTex);
		this.particleShader.run(this.maxLength,this.time,this.arrayTexPP,this.envTex,inputCanvas);
		this.particleDrawShader.run(this.maxLength,this.time,this.arrayTexPP,this.envTex);
		renderShader.run(this.envTex);
		// renderShader.run(this.arrayTexPP);
		// console.log("particle",this.arrayTexPP.read(4,gl.RGBA,gl.FLOAT,Float32Array));
	}
}
class ParticleShader extends Shader{
	constructor(){
		super(
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp isampler2D;
				
				uniform sampler2D arrayTex;
				uniform vec2 arraySize;
				uniform sampler2D inputTex;
				uniform vec2 inputSize;
				uniform sampler2D envTex;
				uniform vec2 envSize;
				uniform float time;
				uniform float rand;

				flat out vec4 AOut;
				flat out vec4 BOut;
				flat out vec4 metaOut;
				
				${SHADER_FUNCS.DATA_TEX}
				${SHADER_FUNCS.HASH}

				bool isLineProvokingVertex(int index){
					return mod(float(index),2.)==1.;
				}

				void main(){
					int baseIdx=gl_VertexID/2*3;
					ivec2 idxCoord1=getIdxCoord(baseIdx,arraySize);
					vec4 meta=texelFetch(arrayTex,idxCoord1,0);
					bool isSpawn=meta.x==1.;
					bool isDead=meta.x==-1.;
					bool isDying=(int(meta.x)&4)>0;
					if(isDead&&meta.y<time){
						gl_Position=vec4(-2);
						return;
					}

					bool isProvoking=isLineProvokingVertex(gl_VertexID);
					/*
						IMPORTANT NOTE
						The line endpoint position is not inclusive.
						Quote from the OpenGL spec:
						"lines produced in this description are “half-open,” meaning that the final fragment (corresponding to pb) is not drawn."
					*/
					float overStep=3./arraySize.x;
					gl_Position=vec4((
						getIdxPos(baseIdx,arraySize)
						+vec2(overStep*float(isProvoking),0.)
					)*2.-1.,1.,1.);

					if(isProvoking){
						ivec2 idxCoord2=getIdxCoord(baseIdx+1,arraySize);
						ivec2 idxCoord3=getIdxCoord(baseIdx+2,arraySize);

						if(isSpawn){
							int sampleIdx=int(meta.y)*3;
							ivec2 sampleCoord2=getIdxCoord(sampleIdx+1,arraySize);
							AOut=vec4(
								texelFetch(arrayTex,sampleCoord2,0).xy,
								// (hash21(float(gl_VertexID)+rand)*2.-1.)*.001
								hash11(float(gl_VertexID)+rand),0.
								// 2.,0.
							);
							BOut=vec4(0.,0.,0.,0.);
							metaOut=vec4(0.);
						}else if(isDead||isDying){
							// vec4 pos=texelFetch(arrayTex,idxCoord2,0);
							// vec4 velo=texelFetch(arrayTex,idxCoord3,0);
							// posOut=pos;
							// veloOut=velo;
							metaOut=vec4(-1.,meta.y,0.,0.);
						}else{
							vec2 pix=1./envSize;

							vec4 aVals=texelFetch(arrayTex,idxCoord2,0);
							vec4 bVals=texelFetch(arrayTex,idxCoord3,0);
							vec2 pos=aVals.xy;
							// vec2 velo=aVals.zw;
							float ang=aVals.z;

							vec2 velo=vec2(cos(ang*TAU),sin(ang*TAU));
							// vec2 velo=vec2(1.,0.);
							// pos=mod(pos+velo,1.);
							// velo.y+=.0001;
							// velo*=.95;
							pos+=velo*pix*1.;
							pos=mod(pos,1.);
							
							vec4 envVal=texture(envTex,vec2(pos.x,pos.y));
							vec4 inputVal=texture(inputTex,vec2(pos.x,1.-pos.y));
							meta.x=0.;
							if(inputVal.x==1.){
								meta.x+=4.;
								//death time to ensure propagation ping pong texture
								meta.y=time+2.;
							}
							if(inputVal.y==1.){
								meta.x+=2.;
							}

							float val;
							val=1.;
							ang+=(1.-min(envVal.x,1.))*.01;

							AOut=vec4(pos,ang,0.);
							BOut=vec4(val,bVals.yzw);
							metaOut=meta;
						}
					}
				}
			`,
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp sampler2D;

				uniform vec2 arraySize;

				flat in vec4 AOut;
				flat in vec4 BOut;
				flat in vec4 metaOut;

				out vec4 outColor;

				${SHADER_FUNCS.DATA_TEX}

				void main(){
					int idx=getCoordIdx(ivec2(gl_FragCoord),arraySize);
					int subIdx=int(mod(float(idx),3.));
					if(subIdx==0){
						outColor=metaOut;
					}else if(subIdx==1){
						outColor=AOut;
					}else if(subIdx==2){
						outColor=BOut;
					}
				}
			`,
		);
		this.drawType=gl.LINES;
	}
	run(maxLength,time,arrayTexPP,envTex,inputTex){
		this.uniforms={
			arrayTex:arrayTexPP.tex,
			arraySize:arrayTexPP.size,
			inputTex:inputTex,
			envTex:envTex.tex,
			envSize:envTex.size,
			time,
			rand:random()
		};
		this.attachments=[
			{
				attachment:arrayTexPP.flip().tex,
				...sizeObj(arrayTexPP.size)
			}
		];
		super.run(maxLength*2);
		// console.log("particle",arrayTexPP.read(4,gl.RGBA,gl.FLOAT,Float32Array));
	}
}
class ParticleDrawShader extends Shader{
	constructor(){
		super(
			glsl`#version 300 es
				precision highp float;
				precision highp isampler2D;
				
				uniform sampler2D arrayTex;
				uniform vec2 arraySize;
				uniform sampler2D envTex;
				uniform vec2 envSize;
				uniform float time;

				out vec2 vPos;
				out vec4 vCol;
				
				${SHADER_FUNCS.DATA_TEX}

				void main(){
					gl_PointSize=2.;

					ivec2 idxCoord1=getIdxCoord(gl_VertexID*3,arraySize);
					vec4 meta=texelFetch(arrayTex,idxCoord1,0);

					bool isDead=meta.x==-1.;
					bool isDying=(int(meta.x)&4)>0;
					if(isDead||isDying){
						gl_Position=vec4(-2);
						return;
					}
					// if(isDead&&meta.y<time){
					// 	gl_Position=vec4(-2);
					// 	return;
					// }

					ivec2 idxCoord2=getIdxCoord(gl_VertexID*3+1,arraySize);
					vec4 pos=texelFetch(arrayTex,idxCoord2,0);
					
					// vec4 envVal=texture(envTex,vec2(pos.x,pos.y));
					
					ivec2 idxCoord3=getIdxCoord(gl_VertexID*3+2,arraySize);
					vec4 bVals=texelFetch(arrayTex,idxCoord3,0);

					gl_Position=vec4(pos.xy*2.-1.,1.,1.);
					vPos=pos.xy;
					vCol=bVals.x*.25*vec4(1.,.25,0.1,0.);
				}
			`,
			glsl`#version 300 es
				#define TAU ${TAU}
				precision highp float;
				precision highp sampler2D;
				
				in vec2 vPos;
				in vec4 vCol;

				out vec4 outColor;

				void main(){
					outColor=vCol;
				}
			`,
		);
		this.drawType=gl.POINTS;
	}
	run(maxLength,time,arrayTex,envTex){
		envTex.clear();
		this.uniforms={
			arrayTex:arrayTex.tex,
			arraySize:arrayTex.size,
			envTex:envTex.tex,
			envSize:envTex.size,
			time,
		};
		this.attachments=[
			{
				attachment:envTex.tex,
				...sizeObj(envTex.size)
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
	}
}