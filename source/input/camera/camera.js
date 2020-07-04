console.log("Loading camera.js");

let filterIsLoaded = false ;
let imageIsLoaded = false ;
let filter = null ;

// Basic vertex shader, converting 2d positions from -1 to 1, scaled by u_scale, to coordinates 0 to 1.
function vertexShaderSource() {
    return `
  attribute vec2 position;
  varying vec2 v_coord;
  uniform vec2 u_scale;

  void main() {
    gl_Position = vec4(position, 0, 1);
    v_coord = u_scale * position * 0.5 + 0.5;
  }
`;
}

// For creating histograms. I haven't gotten this to work fully.
function vertexShaderBuckets(value,minValue,maxValue,buckets) {
    return `
attribute vec2 position;
uniform sampler2D u_texture; 

void main()
{
    vec2 coord = position * 0.5 + 0.5;
    vec4 pixel = texture2D(u_texture, coord);
    gl_Position = vec4(-1.0 + clamp(floor(0.5 + (${value}-${minValue.toFixed(5)}) / ${(maxValue-minValue).toFixed(5)} * ${(buckets-1).toFixed(1)}),0.0,${(buckets-1).toFixed(1)})*${(2/(buckets-1)).toFixed(6)}, 0.0, 0.0, 1.0);
    gl_PointSize = 1.0;
}
`;
}

// Constant color fragment shader, for histograms
function fragmentShaderConstant(value) {
    return `
void main()
{
    gl_FragColor = ${value};
}
`;
}




function matchingShader(w,h) {
    const shader = loopingShader(w,h,function(i) {
        return `matchResult += distance(texture2D(u_texture,pos),u_kernel[${i}]);\n`;
    });
    shader.declarations +=
`    uniform vec4 u_kernel[${w*h}];
`;
    shader.mainStart += `    float matchResult = 0.0 ;`;

    shader.mainEnd = `
    float matchFraction = 1.0 - matchResult/${w*h*Math.sqrt(3)};
      
    vec4 color =  matchFraction * vec4(1.0,1.0,1.0,1.0) ;
    color.a=1.0;
    gl_FragColor = color;
` + shader.mainEnd ;
    const shaderProgram = shader.declarations + shader.mainStart + shader.loop + shader.mainEnd ;
    console.log("Shader:\n"+shaderProgram);
    return shaderProgram;
}

function colorCodeDetectShader(w,h,thresholdLow,thresholdHigh) {
    const shader = loopingShader(w,h,function(i,dx,dy) {
        let s = `    color6[${i}] = getColor6(texture2D(u_texture,pos));\n`;
        //s +=    `    if (color6[${i}].a==0.0) return;\n`;
        s +=    `    matchCount += color6[${i}].a;\n`;
        if (i >= w) {
            s += `    sameCount += color6[${i}] == color6[${i-w}] ? 1.0 : 0.0;\n`;
        }
        if ((i % w)!==0) {
            s += `    sameCount += color6[${i}] == color6[${i-1}] ? 1.0 : 0.0;\n`;
            //s +=    `    if (sameCount>1.5) return;\n`;
        }
        return s ;
    });
    shader.declarations += `
vec4 getColor6(vec4 p) {
    float maxRGB = max(0.25,max(p.r,max(p.g,p.b)));
    //vec3 colorH = step(${thresholdHigh},p.rgb);
    //vec3 colorL = step(${thresholdLow},p.rgb);
    vec3 colorH = step(maxRGB*0.75,p.rgb);
    vec3 colorL = step(maxRGB*0.5,p.rgb);
    float colorTotal = colorH.r + colorH.g + colorH.b ;
    bool colorGood = all(equal(colorL,colorH)) && (colorTotal == 2.0 || colorTotal == 1.0);
    return vec4((colorH+colorL)/2.0, colorGood ? 1.0 : 0.0);
}
`;
    shader.mainStart += `    float matchCount = 0.0 ;\n`;
    shader.mainStart += `    float sameCount = 0.0 ;\n`;
    shader.mainStart += `    vec4 color6[${w*h}] ;\n`;
    shader.mainStart += `    vec4 myColor6 ;\n`;
    shader.mainStart += `    myColor6 = getColor6(s);\n`;
    shader.mainStart += `    gl_FragColor = vec4(myColor6.rgb,0.4);\n`;

    shader.mainEnd = `
    //vec4 color =  neighborDifferences / 4.0 * matchCount / ${(w*h).toFixed(1)} * vec4(1.0,1.0,1.0,1.0) ;
    vec4 color = (1.0-sameCount) * matchCount / ${(w*h).toFixed(1)} *  vec4(1.0,1.0,1.0,1.0)  ;
    //color.a=1.0;
    gl_FragColor.a = max(color.a,gl_FragColor.a);
` + shader.mainEnd ;

    const shaderProgram = shader.createProgram();
    console.log("colorCodeDetectShader:\n"+shaderProgram);
    return shaderProgram;
}


function convolutionKernelShader(w,h) {
    const shader = loopingShader(w,h,function(i) {
        return `kernelTotal += texture2D(u_texture,pos)*u_kernel[${i}];\n`;
    });
    shader.declarations +=
`    uniform float u_kernel[${w*h}];
    uniform float u_kernelWeight ;
    uniform float u_kernelOffset ;
`;

    shader.mainStart += `    vec4 kernelTotal ;`;

    shader.mainEnd = `
    vec4 kernelResult = kernelTotal*(u_kernelWeight==0.0 ? 1.0 : u_kernelWeight) + u_kernelOffset ;
      
    vec4 color =  kernelResult ;
    color.a=1.0;
    gl_FragColor = color;
` + shader.mainEnd ;
    const shaderProgram = shader.declarations + shader.mainStart + shader.loop + shader.mainEnd ;
    console.log("Shader:\n"+shaderProgram);
    return shaderProgram;
}

function smallestDiffShader(w,h) {
    const shader = loopingShader(w,h,function(i) {
        if (i === (w*h-1)/2)
            return `vec4 color = texture2D(u_texture,pos);`;
        return `maxNeighbor = max(maxNeighbor,texture2D(u_texture,pos)) ;\n`;
    });
    shader.mainStart += `    vec4 maxNeighbor ;`;

    shader.mainEnd = `
    color = color*1.5 - maxNeighbor ;
    color.a = 1.0;
    gl_FragColor = color;
` + shader.mainEnd ;
    const shaderProgram = shader.declarations + shader.mainStart + shader.loop + shader.mainEnd ;
    console.log("Shader:\n"+shaderProgram);
    return shaderProgram;
}

function maxNeighborShader(w,h) {
    const shader = loopingShader(w,h,function(i) {
        if (i === (w*h-1)/2)
            return "";
        return `maxNeighbor = max(maxNeighbor,texture2D(u_texture,pos)) ;\n`;
    });
    shader.mainStart += `    vec4 maxNeighbor ;`;

    shader.mainEnd = `
    maxNeighbor.a = 1.0;
    gl_FragColor = maxNeighbor;
` + shader.mainEnd ;
    const shaderProgram = shader.declarations + shader.mainStart + shader.loop + shader.mainEnd ;
    console.log("Shader:\n"+shaderProgram);
    return shaderProgram;
}

// Utility function for creating shader functions that operate on a 2-d array of locations around the center location
function loopingShader(w,h,loopFunction) {
    const size = w*h ;
    const shader = {
        size: size,
        declarations: "",
        mainStart: "",
        loop: "",
        mainEnd: "",
        createProgram: function () {
            return shader.declarations + shader.mainStart + shader.loop + shader.mainEnd ;
        }
    };

    shader.declarations =
        `
//*********************** loopingShader declarations
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_pixel;
varying vec2 v_coord;
//*********************** end loopingShader declarations
`;
    shader.mainStart =
    `
//*********************** loopingShader main() start
void main() {
    vec4 s = texture2D(u_texture, v_coord);
//*********************** end loopingShader main() start
`;
    shader.loop = `
//*********************** loopingShader unrolled loop section
vec2 posi = v_coord ;
`;
    const cx = (w - 1) / 2 ;
    const cy = (h - 1) / 2 ;
    shader.loop += "posi.x = posi.x - u_pixel.x * " + cx.toFixed(1) + ";\n";
    shader.loop += "posi.y = posi.y + u_pixel.y * " + cy.toFixed(1) + ";\n";
    shader.loop += "vec2 pos = posi ;\n"
    let i = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            //shader.loop += `matchResult += distance(texture2D(u_texture,pos),u_kernel[${i}]);\n`;
            const dx = x-cx ;
            const dy = y-cy ;
            shader.loop += `// i=${i} dx=${dx} dy=${dy}
`;
            shader.loop += loopFunction(i,dx,dy);
            i++;
            if (x < w - 1) {
                shader.loop += `pos.x += u_pixel.x ;\n`;
            }
        }
        if (y < h - 1) {
            shader.loop += `pos.x = posi.x ;\n`;
            shader.loop += `pos.y -= u_pixel.y ;\n`;
        }
    }

    shader.mainEnd =
        `  
}
`;
    return shader ;
}

const bwShaderSource = `
  precision mediump float;
  varying vec2 v_coord;
  uniform sampler2D u_texture;

  void main() {
    vec4 s = texture2D(u_texture, v_coord);
    float sum = (s.r+s.g+s.b)/3.0 ;
    s.r = sum;
    s.g = sum;
    s.b = sum;
    gl_FragColor = s;
  }
`;


function createShader(gl, type, shaderSource) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
        console.warn(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }

    return shader;
}


function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }

    return program;
}

const useMatchFilter = false ;

function setUniform(gl,program,uniformObject) {
    let location = gl.getUniformLocation(program, uniformObject.variable);
    if (uniformObject.type === "uniform2f") {
        gl[uniformObject.type](location, uniformObject.data[0], uniformObject.data[1]);
    }
    else {
        gl[uniformObject.type](location, uniformObject.data);
    }
    //console.log("Setting ",uniformObject);
}

function setUniforms(gl,program,uniforms) {
    const len = uniforms.length ;
    for (let i = 0 ; i < len ; i++ ){
        setUniform(gl,program,uniforms[i]);
    }
}

function WebGLProgram(gl,vertexShaderSource,fragmentShaderSource) {
    this.vertexShaderSource = vertexShaderSource;
    this.fragmentShaderSource = fragmentShaderSource;
    this.vertexShader = createShader(gl, gl.VERTEX_SHADER, this.vertexShaderSource);
    this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, this.fragmentShaderSource);
    this.program = createProgram(gl, this.vertexShader, this.fragmentShader);
    this.uniforms = [];
    this.kernelWidth = 5;
    this.kernelHeight = 5;
}

VideoFilter.prototype.setupWebGLFilter = function () {
    console.log("setupWebGLFilter");
    this.canvas.width = this.drawingBufferWidth;
    this.canvas.height = this.drawingBufferHeight;
    this.canvas2d.width = this.drawingBufferWidth;
    this.canvas2d.height = this.drawingBufferHeight;

    gl = this.gl;

    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Create and bind the position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Set the two triangles for the quad buffer
    // gl.STATIC_DRAW tells WebGL that the data are not likely to change.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1,-1,  -1, 1,   1,-1,
        1, 1,   1,-1,  -1, 1,
    ]), gl.STATIC_DRAW);

    // Setting up the programs

    this.programs = [];
    /*
    this.programs.push(new WebGLProgram(gl, vertexShaderSource(this.flipHorizontally),matchingShader(featureToMatch.width,featureToMatch.height)));
    this.programs[0].uniforms = [
        {
            type: "uniform4fv",
            variable: "u_kernel[0]",
            data: featureToMatch.data
        }
    ];
    this.programs[0].kernelWidth = featureToMatch.width ;
    this.programs[0].kernelHeight = featureToMatch.height ;
*/
    this.programs.push(new WebGLProgram(gl, vertexShaderSource(false),convolutionKernelShader(7,5)));

    this.programs.push(new WebGLProgram(gl, vertexShaderSource(false),convolutionKernelShader(7,5)));
    this.programs.push(new WebGLProgram(gl, vertexShaderSource(false),smallestDiffShader(3,3)));
    this.programs.push(new WebGLProgram(gl, vertexShaderSource(false),maxNeighborShader(3,3)));
    this.programs.push(new WebGLProgram(gl, vertexShaderSource(false),colorCodeDetectShader(5,5,0.125,0.25)));
    this.programs.push(new WebGLProgram(gl, vertexShaderBuckets("pixel.r",0,1,256),fragmentShaderConstant("vec4(1.0,0.0,0.0,1.0)")));



    const edgeDetectKernel = [
        -.125,-.125,-.125,
        -.125,    1,-.125,
        -.125,-.125,-.125,
    ];
    const escDetectKernel = [
        1, 1, 1, 1, 1, 1, 1,
        1,-1,-1,-1,-1,-1, 1,
        1,-1,-1, 1, 1, 1, 1,
        1,-1,-1,-1,-1,-1, 1,
        1, 1, 1, 1, 1, 1, 1,
    ];
    const kernelOffset = 12/35;
    const kernelWeight = 1/35;
    const kernel = escDetectKernel;

    this.programs[1].uniforms = [
        {
            type: "uniform1fv",
            variable: "u_kernel[0]",
            data: kernel
        },
        {
            type: "uniform1f",
            variable: "u_kernelOffset",
            data: kernelOffset
        },
        {
            type: "uniform1f",
            variable: "u_kernelWeight",
            data: kernelWeight
        },
    ];
    this.programs[1].kernelWidth = 7 ;
    this.programs[1].kernelHeight = 5 ;

    console.log("Kernel",kernel);


    //this.programList = [1,2];
    this.programList = [4];

    this.inputTexture = createAndSetupTexture(gl) ;

    // Create a frame buffer backed by the input texture for looking at input pixels later on
    //var data = new Uint8Array(this.width * this.height * 4);
    //gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, data);

    this.inputFrameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,  this.inputFrameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.inputTexture, 0);

    this.tempTextures = [] ;

    this.frameBuffers = [];

    gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
};

VideoFilter.prototype.setProgramIndex = function (i) {
    this.currentProgramIndex = i ;
    this.currentProgram = this.programs[i].program ;
    setProgram(this.gl, this.programs[i],this.pixelW,this.pixelH);
};

function setProgram(gl,programInfo,pixelW,pixelH) {
    const program = programInfo.program ;

    gl.useProgram(program);
    setPixelSize(gl,program,pixelW,pixelH);
    setUniforms(gl,program,programInfo.uniforms);
    // Set the position input of the vertex shader
    const positionLocation =  gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
}

function createAndSetupTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set up texture so we can render any size image and so we are
    // working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
}

function VideoFilter(drawingBufferWidth, drawingBufferHeight,flipHorizontally, frameDelay, inputElem, outputCanvas, canvas2d, pixelW, pixelH) {
    // frameDelay is optional
    frameDelay = frameDelay || 0 ;
    this.inputElem = inputElem ;
    this.startTime = 0 ;
    this.lastTime = 0 ;
    this.frameCount = 0 ;
    this.frameDelay = frameDelay ;
    this.frameRate = 0 ;
    this.flipHorizontally = flipHorizontally ;

    this.canvas = outputCanvas ;
    this.canvas2d = canvas2d ;

    this.gl = this.canvas.getContext('webgl', {antialias:false,premultipliedAlpha: false });
    console.log("VideoFilter called with arguments",arguments);
    this.drawingBufferWidth = Math.floor(drawingBufferWidth) ;
    this.drawingBufferHeight = Math.floor(drawingBufferHeight) ;
//    this.fragmentShaderSource= matchingShader(7,7);

    if (!pixelW) pixelW = 2/this.drawingBufferWidth;
    if (!pixelH) pixelH = 2/this.drawingBufferHeight;
    this.pixelW = pixelW ;
    this.pixelH = pixelH ;

    //this.setupWebGLFilter();
    this.isPaused = false ;
    this.renderLoopWaiting = false ;

    console.log("VideoFilter object created",this);
}

function xyToPixelIndex(x,y,w) {
    return (Math.floor(x) + Math.floor(y)*Math.floor(w))*4;
}

let getMaxPixelBuf = false ;

function newOrUpdateBufferSize(buffer,type,size) {
    if (!buffer || buffer.length < size) {
        buffer = new type(size);
    }
    return buffer ;
}

function getMaxPixel(gl,w,h,offset) {
    getMaxPixelBuf = newOrUpdateBufferSize(getMaxPixelBuf,Uint8Array,w*h*4);
    let data = getMaxPixelBuf ;
    gl.readPixels(0, 0, w, h,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let maxPositions = [[0,0]];
    let max = data[offset];
    let maxIndex = w*h*4 ;
    for (let i = 4 ; i < maxIndex ; i+=4) {
        const v = data[i+offset];
        if (v >= max) {
            if (v > max) {
                maxPositions=[];
            }
            if (v <= 128 && v === max )
                continue ;
            if (maxPositions.length > 16) {
                continue;
            }
            max = v ;
            const xx = i/4 % w ;
            const yy = (i/4 - xx)/w ;
            maxPositions.push([xx,yy]);
        }
    }
    //console.log("max pixel value " + max + " at",maxPositions);
    const midIndex = Math.floor(maxPositions.length/2);
    const pos = maxPositions[midIndex];
    return {x:pos[0],y:h-pos[1]-1,v:max};
}

function getPixel(data,x,y,w) {
    const i = xyToPixelIndex(x,y,w);
    return data.slice(i,i+4);
}
function logPixel(i,data,x,y,w) {
    const p = getPixel(data,x,y,w);
    console.log(`${i}: %c${p}`,`color: rgb(${p[0]},${p[1]},${p[2]}`);
}
function logPixelLine(data,x,y,w,sx,sy,i,n) {
    if (i >= n)
        return ;
    logPixel(i,data,x,y,w);
    logPixelLine(data,x+sx,y+sy,w,sx,sy,i+1,n);
}
function logPixelBlock(data,x,y,w,sx,sy,nx,ny,ix,iy) {
    if (ix >= nx) {
        ix = 0 ;
        iy ++ ;
        y += sy;
    }
    if (iy >= ny) {
        return ;
    }
    logPixel(`${ix},${iy}`,data,x+ix*sx,y+iy*sy,w);
    logPixelBlock(data,x,y,w,sx,sy,nx,ny,i+1,iy);
}

function isRGB(pixel,colorThreshold) {
    let colorFound = false ;
    if (pixel[0] > pixel[1] + colorThreshold && pixel[0] > pixel[2] + colorThreshold) {
        colorFound = "r";
    }
    else if (pixel[1] > pixel[0] + colorThreshold && pixel[1] > pixel[2] + colorThreshold) {
        colorFound = "g";
    }
    else if (pixel[2] > pixel[0] + colorThreshold && pixel[2] > pixel[1] + colorThreshold) {
        colorFound = "b";
    }
    if (colorFound) {
        console.log("findEdgeColor found " + colorFound + " " + pixel + " at " + pos.x + ","+pos.y);
        return colorFound;
    }
    return false ;
}


function rgbToHsl(r, g, b){
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if(max === min){
        h = s = 0; // achromatic
    }else{
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

function rgbToHueDiscrete(pixel,hueSteps,hThreshold, sThreshold,lThreshold) {
    const hsl = rgbToHsl(pixel[0],pixel[1],pixel[2]);
    if (hsl[1] < sThreshold) {
        return false ;
    }
    if (hsl[2] < lThreshold) {
        return false ;
    }
    let h = hsl[0] * hueSteps;
    let hInt = Math.round(h);
    if (Math.abs(h-hInt) > hThreshold) {
        return false ;
    }
    return hInt === 0 ? hueSteps : hInt ;
}

function findEdgeColor(data,w,h,edgeX,edgeY) {
    // find the color nearest to the edge point determined by edgeX, edgeY which are normalized to 0 to 1
    w = Math.floor(w);
    h = Math.floor(h);
    const horiz = (edgeX === 0 || edgeX === 1) ;
    const direction = (edgeX === 1 || edgeY === 1) ? -1 : 1 ;
    const step = horiz?
        {
            x: direction,
            y: 0
        } :
        {
            y: direction,
            x: 0
        };

    let pos =
        {
            x: Math.floor(edgeX*(w-1)),
            y: Math.floor(edgeY*(h-1))
        };

    const colorThreshold = 50 ;
    while (pos.x >= 0 && pos.y >= 0 && pos.x <= w-1 && pos.y <= h-1) {
        const pixel = getPixel(data,pos.x,pos.y,w);
        //const colorFound = isRGB(pixel,colorThreshold);
        const colorFound = rgbToHueDiscrete(pixel,6,0.25, 0.5,0.1);
        if (colorFound!==false) {
            return colorFound ;
        }
        pos.x += step.x ;
        pos.y += step.y ;
    }
    return false;
}

VideoFilter.prototype.renderLoop = function (self) {
    self = self || this ;
    if (self.inputElem.paused || self.inputElem.ended || self.isPaused || self.renderLoopWaiting) {
        return;
    }
    // Set the timeout right away, not after rendering
    self.renderLoopWaiting = true ;
    setTimeout(function () {
        self.renderLoopWaiting = false ;
        self.renderLoop(self);
    }, self.frameDelay);


    if (!self.startTime)
        self.startTime = Date.now();

    const dt = Date.now()-self.lastTime;
    if (dt > 1000) {
        // Reset frame rate stat after a long break, probably because window was hidden
        self.frameCount = 0 ;
        self.startTime = Date.now();
    }

    self.renderImage(self.gl,self.inputElem);

    self.lastTime = Date.now();
    const t = self.lastTime-self.startTime;

    self.frameCount++;
    self.frameRate = 1000*self.frameCount/t ;
    if ((self.frameCount % 120) === 1)
        console.log("Video overlay frame rate: "+ self.frameRate);
};

function setPixelSize(gl,program,w,h) {
    if (!gl) {
        return ;
    }
    if (!program) {
        return ;
    }
    const uniform = {
        type: "uniform2f",
        variable: "u_pixel",
        data: [w,h]
    };
    setUniform(gl,program,uniform);
}

VideoFilter.prototype.setPixelSize = function (w,h) {
    // Set the pixel size
    this.pixelW = w ? w :  2/this.drawingBufferWidth;
    this.pixelH = h ? h :  2/this.drawingBufferHeight;
    setPixelSize(gl,this.currentProgram, this.pixelW, this.pixelH );
    //console.log("Pixel size set to: "+this.pixelW+" "+this.pixelH);
};

function drawImageMultiple(n,ctx,inputElement, x,y,w,h,dx,dy,dw,dh,ddx,ddy,columns,column){
    if (n <= 0)
        return ;
    n--;
    ctx.drawImage(inputElement,x,y,w,h,dx,dy,dw,dh);
    if (n <= 0)
        return ;
    setTimeout(function() {
        if (columns) {
            dx += ddx ;
            column ++ ;
            if (column === columns) {
                column = 0 ;
                dy += ddy ;
                dx -= ddx* columns;
            }
            drawImageMultiple(n,ctx,inputElement,x,y,w,h,dx,dy,dw,dh,ddx,ddy,columns,column);
        }
        else {
            drawImageMultiple(n,ctx,inputElement,x,y,w,h,dx+ddx,dy+ddy,dw,dh,ddx,ddy);
        }
    },16.66);
}

function logMaxInputPixels(filter) {
    console.log(`maxInputPixels:`,filter.matchSize,filter.maxInputPixels);
    console.log(`center pixel ${filter.matchSize.w/2},${filter.matchSize.h/2}:`,
        getPixel(filter.maxInputPixels,filter.matchSize.w/2, filter.matchSize.h/2, filter.matchSize.h)
    );

//    xyToPixelIndex
//    xxx
//    filter.maxPixels[]
}

function createFrameBufferAndTexture(gl,width,height) {
    //create a texture
    let texture = createAndSetupTexture(gl);

    // make the texture the desired size
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null);

    // Create a frame buffer
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    // Attach this texture to it.
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return {texture:texture,frameBuffer: fbo} ;
}

function logPixelArray(data,dataw,w,h,stepSize, flipY) {
    for (let y = 0 ; y < h ; y++) {
        const yFlipped = flipY ? h-y-1 : y ;
        const yy = (yFlipped+0.5)*stepSize.h +0.5 ;
        let styles = [];
        let logString="";
        for (let x = 0 ; x < w ; x++ ) {
            const xx = (x+0.5) * stepSize.w + 0.5 ;
            const p = getPixel(data,xx,yy,dataw);
            logString +="%c     ";
            styles.push(`background-color:rgb(${p[0]},${p[1]},${p[2]});`);
        }
        console.log(logString,...styles);
    }
}

function logColorCodes(data,dataw,w,h,stepSize, flipY) {
    for (let y = 0 ; y < h ; y++) {
        const yFlipped = flipY ? h-y-1 : y ;
        const yy = (yFlipped+0.5)*stepSize.h +0.5 ;
        let styles = [];
        let logString="";
        for (let x = 0 ; x < w ; x++ ) {
            const xx = (x+0.5) * stepSize.w + 0.5 ;
            logPixel(`${x},${y}`,data,xx,yy,dataw);
            const p = getPixel(data,xx,yy,dataw);
            logString +="%c     ";
            styles.push(`background-color:rgb(${p[0]},${p[1]},${p[2]});`);
        }
        console.log(logString,...styles);
    }
}

const RGBCodeChars =    ["0","b","g","c","r","v","y","w"];
const RGBCodeIntegers = [ 1,  1,  2,  5,  3,  4,  6,  6];
const RGBCodeIntegerToChar = ["0","b","g","r","v","c","y","w"];

function rgbToColorCode(p) {
    return RGBCodeIntegers[4*(p[0]>=128)+2*(p[1]>=128)+(p[2]>=128)];
}

function getColorCodes(data,dataw,w,h,stepSize, flipY) {
    const codeArray = [];

    //console.log("getColorCodes",arguments);
    for (let y = 0 ; y < h ; y++) {
        const yFlipped = flipY ? h-y-1 : y ;
        const yy = (yFlipped+0.5)*stepSize.h +0.5 ;
        for (let x = 0 ; x < w ; x++ ) {
            const xx = (x+0.5) * stepSize.w + 0.5 ;
            const p = getPixel(data,xx,yy,dataw);
            codeArray.push(rgbToColorCode(p));
        }
    }
    //console.log(codeArray);
    return codeArray;
}
function colorCodesToBits(codes,w,h) {
    const bits = [] ;
    const bitArray = [] ;
    let columnCheckSums = [];
    for (let x = 0 ; x < w ; x++) {
        columnCheckSums[x] = 0 ;
    }
    let checkSumFailures = [] ;
    let rowCheckSums = [] ;
    for (let y = 0 ; y < h ; y++) {
        bitArray[y] = [];
        rowCheckSums[y] = 0 ;
        for (let x = 0 ; x < w ; x++ ) {
            let index = x+y*w ;
            let bit = codes[index] ;
            let bitAbove = y > 0 ? codes[index-w] : 7 ;
            let bitLeft = x > 0 ? codes[index-1] : 7 ;
            bit = bit - (bit > bitAbove) - (bit > bitLeft) - 1 ;
            columnCheckSums[x] += bit ;

            if (y === h-1) {
                columnCheckSums[x] = columnCheckSums[x] & 3 ;
                if (columnCheckSums[x] !== 3 ) {
                    //console.log(`Checksum failed in column ${x}`,bitArray);
                    checkSumFailures.push({type:"c",index:x,sum:columnCheckSums[x]});
                }
            }

            bitArray[y].push(bit);
            rowCheckSums[y] += bit ;

            if (x === w-1) {
                rowCheckSums[y] = rowCheckSums[y] & 3 ;
                if (rowCheckSums[y] !== 3) {
                    //console.log(`Checksum failed in row ${y}`,bitArray[y]);
                    checkSumFailures.push({type:"r",index:y,sum:rowCheckSums[y]});
                }
            }
            else {
                if (y !== h-1) {
                    bits.push(bit);
                }
            }
        }
        if (checkSumFailures.length > 0) {
            //console.log("CheckSum failures:",checkSumFailures/*,rowCheckSums,columnCheckSums,bitArray*/);
        }
    }
    let errorCorrections = 0 ;
    if (checkSumFailures.length === 2) {
        if ((checkSumFailures[0].type === "r") && (checkSumFailures[1].type === "c")) {
            if (checkSumFailures[0].sum === checkSumFailures[1].sum) {
                const errorRow = checkSumFailures[0].index ;
                const errorColumn = checkSumFailures[1].index ;
                if (errorRow !== w-1 && errorColumn !== w-1) {
                    const errorAmount = 3 - checkSumFailures[0].sum ;
                    const errorIndex = errorRow * (w-1) + errorColumn ;
                    const errorValue = bits[errorIndex] ;
                    if (errorValue === undefined) {
                        console.log("undefined value");
                    }
                    const fixedValue = (errorValue + errorAmount)%4 ;
                    bits[errorIndex] = fixedValue ;
                    bitArray[errorRow][errorColumn] = fixedValue ;
                    errorCorrections = 1 ;
                    console.log(`Corrected single error, row ${errorRow} column ${errorColumn}, from ${errorValue} to ${fixedValue}`);
                }
            }
        }
    }
    return {bits,checkSumFailures, errorCorrections /*,rowCheckSums,columnCheckSums,bitArray*/} ;
}
function combineBits(bits,n) {
    let r = 0 ;
    for (let i = 0 ; i < n ; i++) {
        // Can't use left-shift << operator here because it converts the operands to a 32-bit signed integer.
        // Really, who the fuck decided on that?
        r += bits[i] * (2**(2*i));
    }
    return r ;
}

let enableDebugImages = false ;
// Turns off debug drawImage occasionally to allow for garbage collection of Safari memory leak
let debugDrawImage = enableDebugImages ;
setInterval(function() {
    debugDrawImage = false ;
    setTimeout(function() {
        debugDrawImage = enableDebugImages ;
    },2000)
},10000);

VideoFilter.prototype.renderImage = function (gl,image) {
    const timeAtCapture = Date.now();
    this.frameCount++;
    if (!gl)
        gl = this.gl ;
    if (!image)
        image = this.inputElem;
    gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);


    // Creating 2 textures and frame buffers, to use as intermediate textures
    if (this.frameBuffers.length ===0) {
        for (let i = 0; i < 2; ++i) {
            const tAndB = createFrameBufferAndTexture(gl,this.drawingBufferWidth,this.drawingBufferHeight);
            this.tempTextures.push(tAndB.texture);
            this.frameBuffers.push(tAndB.frameBuffer);
        }
    }

    for (let i = 0 ; i < this.programList.length ; i++) {
        const pi = this.programList[i];
        this.setProgramIndex(pi);

        // Bind input texture
        if (i === 0) {
            gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.tempTextures[(i-1)%2]);
        }

        let scale =[1,1];

        // Bind output frame buffer
        if (i ===  this.programList.length -1) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            scale[1] = -scale[1];
        }
        else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffers[i%2]);
        }

        const program = this.currentProgram ;
        const scaleLocation = gl.getUniformLocation(program,"u_scale");
        gl.uniform2f(scaleLocation,scale[0],scale[1]);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (false) {
        // Create a histogram of input ?
        this.setProgramIndex(5);
        gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
        const histogramBuffer = createFrameBufferAndTexture(gl,256,1);
        gl.bindFramebuffer(gl.FRAMEBUFFER,histogramBuffer.frameBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        window.histogram = new Uint8Array(256*4);
        gl.readPixels(0, 0, 256,1,gl.RGBA,gl.UNSIGNED_BYTE,window.histogram);
        console.log(window.histogram);
    }

    const max = getMaxPixel(gl,this.drawingBufferWidth,this.drawingBufferHeight,3);

    if (!this.max || this.max.v < max.v || max.v === 255) {
        const programi = this.programList[0];
        const programInfo =  this.programs[programi];

        this.filterStepSize = {w: this.pixelW * this.drawingBufferWidth, h: this.pixelH * this.drawingBufferHeight};
        const w = programInfo.kernelWidth * this.filterStepSize.w ;
        const h = programInfo.kernelHeight * this.filterStepSize.h ;

        this.inputStepSize = {w:this.pixelW * inputElement.videoWidth, h: this.pixelH * inputElement.videoHeight};
        this.matchDimensions = {w:5, h:5};
        this.matchSize = {w: Math.round(this.matchDimensions.w * this.inputStepSize.w), h: Math.round(this.matchDimensions.h * this.inputStepSize.h)};
        if (this.matchSize.w >= this.inputElem.videoWidth || this.matchSize.h >= this.inputElem.videoHeight ) {
            return ;
        }
        this.max = max ;
        max.inputW = this.matchDimensions.w * this.inputStepSize.w ;
        max.inputH = this.matchDimensions.h * this.inputStepSize.h ;


        const ctx = this.canvas2d.getContext("2d");
        ctx.clearRect(0,0,this.drawingBufferWidth,this.drawingBufferHeight);
        ctx.strokeStyle = "red";
        ctx.beginPath();
        ctx.rect(max.x- w/2-this.inputStepSize.w ,max.y-h/2-this.inputStepSize.h,w+2*this.inputStepSize.w,h+2*this.inputStepSize.h);
        ctx.rect(max.x- w/2,max.y-h/2,w,h);
        const crossHairLength2 = 50 ;
        ctx.moveTo(this.drawingBufferWidth/2-crossHairLength2,this.drawingBufferHeight/2);
        ctx.lineTo(this.drawingBufferWidth/2+crossHairLength2,this.drawingBufferHeight/2);
        ctx.moveTo(this.drawingBufferWidth/2,this.drawingBufferHeight/2-crossHairLength2);
        ctx.lineTo(this.drawingBufferWidth/2,this.drawingBufferHeight/2+crossHairLength2);
        ctx.closePath();
        ctx.stroke();

        //console.log(inputElement);


        //ctx.drawImage(inputElement,max.x-50,max.y-50,100,100,0,0,400,400);
        max.inputX = Math.round(max.x*inputElement.videoWidth/this.drawingBufferWidth) ;
        max.inputY = Math.round(max.y*inputElement.videoHeight/this.drawingBufferHeight) ;

        this.maxInputPixels = this.maxInputPixels || new Uint8Array(camera.width * camera.height * 4);
        this.maxFilterPixels = this.maxFilterPixels || new Uint8Array(camera.width * camera.height * 4);
        gl.readPixels(max.inputX-this.matchSize.w/2,outputElement.height-max.inputY-1-this.matchSize.h/2,this.matchSize.w,this.matchSize.h,gl.RGBA,gl.UNSIGNED_BYTE,this.maxFilterPixels);
        //console.log("filtered pixels: ",this.maxFilterPixels);

        // There's a drawImage memory leak in iOS Safari. The leaked memory is only garbage collected if these drawImage commands aren't called for a little while
        if (debugDrawImage) {
            drawImageMultiple(1,ctx, inputElement,max.inputX-max.inputW/2,max.inputY-max.inputH/2,max.inputW,max.inputH,  0,0,256,256,256,256,8,0);
            drawImageMultiple(1,ctx,outputElement,max.inputX-max.inputW/2,max.inputY-max.inputH/2,max.inputW,max.inputH,256,0,256,256,256,256,8,0);
        }

        //logColorCodes(this.maxFilterPixels,this.matchSize.w, 5,5,this.inputStepSize );
        //logPixelArray(this.maxFilterPixels,this.matchSize.w, 5,5,this.inputStepSize,true );

        gl.bindFramebuffer(gl.FRAMEBUFFER,  this.inputFrameBuffer);
        gl.readPixels(max.inputX-this.matchSize.w/2,max.inputY-this.matchSize.h/2,this.matchSize.w,this.matchSize.h,gl.RGBA,gl.UNSIGNED_BYTE,this.maxInputPixels);
        const codes = getColorCodes(this.maxFilterPixels,this.matchSize.w, 5,5,this.inputStepSize,true );
        const codesEvaluated = colorCodesToBits(codes,5,5);

        const codeReceived = combineBits(codesEvaluated.bits,16);
        if (max.v === 255 && ((codesEvaluated.checkSumFailures.length === 0) || (codesEvaluated.errorCorrections > 0))) {
            this.codesEvaluated = codesEvaluated ;
            this.codeReceived = codeReceived ;
            //console.log(`Frame ${this.frameCount} timeCode received: ${codeReceived} difference: ${ (timeAtCapture % ( 2**32 )) - codeReceived }`);
        }
        else {
            this.codeReceived = false ;
            this.codesEvaluated = false ;
        }

        //logColorCodes(this.maxInputPixels,this.matchSize.w, 5,5,this.inputStepSize );
        //logPixelArray(this.maxInputPixels,this.matchSize.w, 5,5,this.inputStepSize );

        //console.log("pixels: ",this.maxInputPixels);
        //logMaxInputPixels(this);


        if (false) {
            const borderColor = {};
            borderColor.topleft = findEdgeColor(this.maxInputPixels,this.matchSize.w,this.matchSize.h,0.25,0);
            borderColor.bottomleft = findEdgeColor(this.maxInputPixels,this.matchSize.w,this.matchSize.h,0.25,1);
            borderColor.topright = findEdgeColor(this.maxInputPixels,this.matchSize.w,this.matchSize.h,0.75,0);
            borderColor.bottomright = findEdgeColor(this.maxInputPixels,this.matchSize.w,this.matchSize.h,0.75,1);
            borderColor.left = findEdgeColor(this.maxInputPixels,this.matchSize.w,this.matchSize.h,0,0.5);
            borderColor.right = findEdgeColor(this.maxInputPixels,this.matchSize.w,this.matchSize.h,1,0.5);
            console.log("border colors:",borderColor);
        }


        let scale = 0.3/(programInfo.kernelWidth * this.pixelW);
        let translate = {
            x: (this.drawingBufferWidth/2 - max.x)*inputElement.offsetWidth/this.drawingBufferWidth*scale ,
            y: (this.drawingBufferHeight/2 - max.y)*inputElement.offsetWidth/this.drawingBufferWidth*scale ,
        };

        //inputElement.style.transform=`translate(${translate.x}px,${translate.y}px) scale(${scale})`;
        //inputElement.style.transition="2s cubic-bezier(0.6, 0.04, 0.98, 0.335)";
        //console.log("Max:",max);
    }
    this.lastMax = max ;
};

let featureToMatch = {
    loaded: false,
    width: 0,
    height: 0,
    data: null
} ;
function loadFeaturePixels(elem) {
    console.log("loadFeaturePixels",elem);
    let canvas = document.createElement('canvas');
    let context = canvas.getContext('2d');
    context.drawImage(elem, 0, 0);
    const data = context.getImageData(0, 0, elem.width, elem.height).data;
    featureToMatch.width = elem.width ;
    featureToMatch.height = elem.height ;
    featureToMatch.data =[] ;
    for (let i = 0 ; i < elem.width * elem.height*4; i++) {
        featureToMatch.data[i]=data[i]/255.0;
    }
    console.log(featureToMatch.data);
    featureToMatch.loaded = true ;

    if (!filter) {
        setupNewFilter();
    }
    if (filterIsLoaded && filter.frameCount === 0) {
    }
}

function setupNewFilter() {
    filter = new VideoFilter(canvasWidth, canvasHeight,flipHorizontally, 0, inputElement, outputElement, canvas2d);
    filter.setupWebGLFilter();
    console.log(filter);
}

function LiveCamera(w,h,onPlay) {
    this.width = w ;
    this.height = h ;
    this.startCamera(w,h,onPlay);
}

function createHiddenVideoElement(w,h) {
    const videoElem = document.createElement("video");
    videoElem.style.width = `${w}px` ;
    videoElem.autoplay = true ;
    videoElem.playsInline = true ;
    //videoElem.style.display = "none";
    return videoElem;
}

LiveCamera.prototype.startCamera = function (w,h,onPlay) {
    console.log("Starting camera",this);
    const videoElem = createHiddenVideoElement(w,h);
    this.playing = false ;
/*
    videoElem.addEventListener("play", function() {
        debugElement.innerHTML += "camera playing<br>";
        onPlay();
    }, false);
*/
    debugElement.innerHTML += "Calling getUserMedia<br>";

    // Preferred camera resolution
    let constraints = { audio: false, video: { facingMode: "environment", frameRate:30, width:1280 } };
//    let constraints = { audio: false, video: true };
    // Get user permission
    navigator.mediaDevices.getUserMedia(constraints)
        .then(function(mediaStream) {
            videoElem.srcObject = mediaStream;
            videoElem.onloaded = function(e) {
            };
            debugElement.innerHTML += "getUserMedia success " + mediaStream+"<br>";
            console.log("getUserMedia success",mediaStream);
//            videoElem.play();
            setTimeout(onPlay,100);
        })
        .catch(function(err) {
            // always check for errors at the end.
            debugElement.innerHTML += "getUserMedia error " +  err.name + ": " + err.message+"<br>";
            console.log(err.name + ": " + err.message);
        });

    this.videoElem = videoElem ;
    return videoElem ;
};

function findInitialTarget(sizeAdjustments) {
    if (!sizeAdjustments || sizeAdjustments.length === 0) {
        sizeAdjustments = initialAdjustments(300,1/4,{w:1,h:1});
        if (filter.max) {
            filter.max.v = 0;
        }
    }
    filter.targetFound = false ;
    let bestPixelW = filter.pixelW ;
    let bestPixelH = filter.pixelH ;
    let lastMax = 0 ;

    function postRenderFunction() {
        if (filter.max.v < 255) {
            if (lastMax === 255) {
                filter.targetFound = true;
                filter.setPixelSize(bestPixelW,bestPixelH);
                onTargetFound();
                setTimeout(findNewTarget,1);
                return;
            }
            if (filter.max.v >= lastMax) {
                bestPixelW = filter.pixelW ;
                bestPixelH = filter.pixelH ;
            }
            lastMax = filter.max.v ;

            if (sizeAdjustments.length === 0) {
                console.log("Unable to find target.");
                if (filter.onTargetNotFound) {
                    filter.onTargetNotFound();
                }
                overlayTargetInfo();
                filter.setPixelSize(0,0);
                setTimeout(findInitialTarget,1);
                return ;
            }
        }
        else {
            if (lastMax === 255) {
                filter.targetFound = true;
                onTargetFound();
                setTimeout(findNewTarget,1);
                return;
            }
            lastMax = 255 ;
            bestPixelW = filter.pixelW ;
            bestPixelH = filter.pixelH ;
        }
        overlayTargetInfo();
        setTimeout(function() {
            filter.setPixelSize(0,0);
            findNewTarget(sizeAdjustments,postRenderFunction);
        },1);
    }
    setTimeout(function() {
        findNewTarget(sizeAdjustments,postRenderFunction);
    },1);
}


// *******************
// Functions to adjust the filter size to find target

function neighborhoodAdjustments(maxF,power) {
    power = power || 1/4 ;
    maxF = maxF || 2.1 ;

    let powerStep = 1;
    let sizeAdjustments = [{w:1, h:1}];
    let f ;
    while ((f = Math.pow(2, powerStep * power)) <= maxF)  {
        sizeAdjustments.push({w:f, h:f});
        sizeAdjustments.push({w:1/f, h:1/f});
        powerStep++;
    }
    return sizeAdjustments ;
}

function initialAdjustments(maxF,power,initialSize) {
    power = power || 1/4 ;
    maxF = maxF || 2.1 ;

    initialSize = initialSize || {w: 1,h: 1} ;
    let powerStep = 1;
    let sizeAdjustments = [initialSize] ;
    let f ;
    while ((f = Math.pow(2, powerStep * power)) <= maxF)  {
        sizeAdjustments.push({w:f*initialSize.w,h:f*initialSize.h});
        powerStep++;
    }
    return sizeAdjustments ;
}

let haltScanning = false ;
let onHaltScanning = false ;

function findNewTarget(sizeAdjustments, postRenderFunction) {
    if (haltScanning) {
        haltScanning = false ;
        if (onHaltScanning) {
            onHaltScanning();
        }
        return ;
    }

    if (!sizeAdjustments || sizeAdjustments.length === 0) {
        sizeAdjustments = neighborhoodAdjustments(2.1,1/4);
        filter.max.v = 0;
    }
    //console.log("findNewTarget",sizeAdjustments);
    const currentPixelW = filter.pixelW;
    const currentPixelH = filter.pixelH;
    f = sizeAdjustments.shift();
    filter.setPixelSize(currentPixelW * f.w, currentPixelH * f.h);
    filter.renderImage();

    if (postRenderFunction) {
        postRenderFunction();
        return ;
    }

    if (filter.max.v < 255 || !filter.codesEvaluated) {
        filter.setPixelSize(currentPixelW, currentPixelH );
        if (sizeAdjustments.length > 0) {
            //console.log("Trying pixelW = " + filter.pixelW*sizeAdjustments[0].w);
            setTimeout(function () {
                findNewTarget(sizeAdjustments);
            },50);
        }
        else {
            //console.log("Unable to find target or decipher code.");
            if (filter.max.v > 102) {
                onTargetFound();
            }
            else {
                if (filter.onTargetNotFound) {
                    filter.onTargetNotFound();
                }
            }

            setTimeout(findNewTarget,50);
        }
    }
    else {
        onTargetFound();
        setTimeout(findNewTarget,50);
    }
}

function resetCamera() {
    filter.setPixelSize(0,0);
    filter.lastMax = false ;
    filter.matchSize = null ;
    filter.max = null ;
    filter.targetFound = false ;

    setTimeout(function() {
        findInitialTarget();
    },1);
}
function rescanCamera() {
    if (filter.frozen) {
        camera.videoElem.play();
        haltScanning = false ;
        resetCamera();
        return;
    }
    onHaltScanning = function() {
        resetCamera();
    };
    haltScanning = true ;
}

function freezeCamera() {
    if (filter.frozen) {
        return ;
    }
    onHaltScanning = function() {
        filter.frozen = true ;
    };
    camera.videoElem.pause();
    haltScanning = true ;
}

function unfreezeCamera() {
    if (filter.frozen) {
        camera.videoElem.play();
        setTimeout(function() {
            findNewTarget();
        },1);
        filter.frozen = false ;
    }
}


function partialTimeToTime(t,bits) {
    // t is the lower n bits of Date.now() that is assumed to be close to but earlier than the current Date.now() time here
    // This is just for debugging purposes
    const twoBits = 2**bits ;
    const now = Date.now() ;
    const lowerBits = now % twoBits ;
    return t + now - lowerBits - (t>now? twoBits : 0);
}

function onTargetFound() {
    filter.targetX = filter.max.x ;
    filter.targetY = filter.max.y ;
    if (filter.max.v === 255) {
        if (filter.onCodeReceived) {
            filter.onCodeReceived(filter.codeReceived);
        }
    }
    else {
        if (filter.onCodeMissing) {
            filter.onCodeMissing();
        }
    }
}

function overlayTargetInfo() {

    if (filter.targetFound) {
        if (filter.onCodeReceived) {
            filter.onCodeReceived(filter.codeReceived);
        }
    }
    else {
        if (filter.onTargetFound) {
            filter.onTargetFound();
        }
        const elem = document.getElementById("infoOverlay") ;
        if (!elem)
            return ;
        elem.innerHTML = `Target not found, max at ${filter.max.x},${filter.max.y} v=${filter.max.v} pixelStep=${(filter.pixelW*camera.width).toFixed(2)} frame=${filter.frameCount}`;
    }
}

const GetZoom = () => {
    // Detect zoom level by seeing if clientHeight/Width match innerHeight/Width, and scale if not
    // On Safari, at least, innerHeight/Width changes with zoom
    const ih = window.innerHeight;
    const iw = window.innerWidth;
    const ch = document.documentElement.clientHeight;
    const cw = document.documentElement.clientWidth;
    // Compare widths, so address bar, etc., not included
    // Make sure that we're comparing against the right dimension
    const c = (iw > ih) ? Math.max(cw, ch) : Math.min(cw, ch);
    return c / iw;
};

console.log("Loaded camera.js");
