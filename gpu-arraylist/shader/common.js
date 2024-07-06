let SHADER_FUNCS={
	DATA_TEX:glsl`
		ivec2 getIdxCoord(int idx,vec2 size){
			int width=int(size.x);
		
			int y=idx/width;
			int x=idx-(y*width);

			if(y<0||y>=int(size.y)){
				return ivec2(-1);
			}
			return ivec2(x,y);
		}
		int getCoordIdx(ivec2 coord,vec2 size){
			return coord.y*int(size.x)+coord.x;
		}
		vec2 getIdxPos(int idx,vec2 size){
			ivec2 coord=getIdxCoord(idx,size);
			if(coord.x==-1){
				return vec2(-1.);
			}
			//sample from center of the pixel
			return (vec2(coord)+.5)/size;
		}
	`,
	HASH:glsl`
		//1 out, 1 in...
		float hash11(float p){
			p = fract(p * .1031);
			p *= p + 33.33;
			p *= p + p;
			return fract(p);
		}
		//  1 out, 2 in...
		float hash12(vec2 p){
			vec3 p3  = fract(vec3(p.xyx) * .1031);
			p3 += dot(p3, p3.yzx + 33.33);
			return fract((p3.x + p3.y) * p3.z);
		}
		//  1 out, 3 in...
		float hash13(vec3 p3){
			p3  = fract(p3 * .1031);
			p3 += dot(p3, p3.zyx + 31.32);
			return fract((p3.x + p3.y) * p3.z);
		}
		//  2 out, 1 in...
		vec2 hash21(float p){
			vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
			p3 += dot(p3, p3.yzx + 33.33);
			return fract((p3.xx+p3.yz)*p3.zy);
		}
	`,
};