import * as gbi from './gbi.js';
import * as logger from '../logger.js';
import { assert } from '../assert.js';
import { VertexArray } from './vertex_array.js';

/**
 * Whether to log shaders as they're compiled.
 */
const kLogShaders = false;

/**
 * A cache of compiled shaders. The key is generated by stringifying all the
 * state that affects how the shader is generated and concatenating it together.
 * @type {!Map<string, !N64Shader>}
 */
let shaderCache = new Map();

/**
 * The source of the fragment shader to use. We patch in the instructions that
 * we need to emulate the N64 render mode we're emulating.
 * @type {?string}
 */
let fragmentSource = null;

/**
 * The generic vertex shader to use. All N64 shaders use the same vertex shader.
 * @type {?WebGLShader}
 */
let genericVertexShader = null;

const rgbParams32 = [
  'combined.rgb', 'tex0.rgb', 'tex1.rgb', 'prim.rgb', 'shade.rgb', 'env.rgb', 'one.rgb',   
  'combined.a',   'tex0.a',   'tex1.a',   'prim.a',   'shade.a',   'env.a',
  'lod_frac', 'prim_lod_frac','k5',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', 'zero.rgb'
];

// Tex0 and Tex1 are swapped in the second cycle.
// TODO: is there an easier way to do this without duplicating the table?
const rgbParams32C2 = [
  'combined.rgb', 'tex1.rgb', 'tex0.rgb', 'prim.rgb', 'shade.rgb', 'env.rgb', 'one.rgb',    
  'combined.a',   'tex1.a',   'tex0.a',   'prim.a',   'shade.a',   'env.a',
  'lod_frac', 'prim_lod_frac', 'k5',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', '?           ',
  '?           ', 'zero.rgb'
];

const rgbParams16 = [
  'combined.rgb', 'tex0.rgb', 'tex1.rgb', 'prim.rgb', 'shade.rgb', 'env.rgb', 'one.rgb',   
  'combined.a',   'tex0.a',   'tex1.a',   'prim.a',   'shade.a',   'env.a',
  'lod_frac', 'prim_lod_frac', 'zero.rgb'
];

const rgbParams16C2 = [
  'combined.rgb', 'tex1.rgb', 'tex0.rgb', 'prim.rgb', 'shade.rgb', 'env.rgb', 'one.rgb', 
   'combined.a',  'tex1.a',   'tex0.a',   'prim.a',   'shade.a',   'env.a',
   'lod_frac', 'prim_lod_frac', 'zero.rgb'
];

const rgbParams8 = [
  'combined.rgb', 'tex0.rgb', 'tex1.rgb', 'prim.rgb', 'shade.rgb', 'env.rgb',
  'one.rgb', 'zero.rgb'
];

const rgbParams8C2 = [
  'combined.rgb', 'tex1.rgb', 'tex0.rgb', 'prim.rgb', 'shade.rgb', 'env.rgb',
  'one.rgb', 'zero.rgb'
];

const alphaParams8 = [
  'combined.a', 'tex0.a', 'tex1.a', 'prim.a', 'shade.a', 'env.a',
  'one.a', 'zero.a'
];

const alphaParams8C2 = [
  'combined.a', 'tex1.a', 'tex0.a', 'prim.a', 'shade.a', 'env.a',
  'one.a', 'zero.a'
];

const kMulInputRGB = [
  'Combined    ', 'Texel0      ',
  'Texel1      ', 'Primitive   ',
  'Shade       ', 'Env         ',
  'KeyScale    ', 'CombinedAlph',
  'Texel0_Alpha', 'Texel1_Alpha',
  'Prim_Alpha  ', 'Shade_Alpha ',
  'Env_Alpha   ', 'LOD_Frac    ',
  'PrimLODFrac ', 'K5          ',
  '0           ', '0           ',
  '0           ', '0           ',
  '0           ', '0           ',
  '0           ', '0           ',
  '0           ', '0           ',
  '0           ', '0           ',
  '0           ', '0           ',
  '0           ', '0           '
];

const kSubAInputRGB = [
  'Combined    ', 'Texel0      ',
  'Texel1      ', 'Primitive   ',
  'Shade       ', 'Env         ',
  '1           ', 'Noise       ',
  '0           ', '0           ',
  '0           ', '0           ',
  '0           ', '0           ',
  '0           ', '0           '
];

const kSubBInputRGB = [
  'Combined    ', 'Texel0      ',
  'Texel1      ', 'Primitive   ',
  'Shade       ', 'Env         ',
  'KeyCenter   ', 'K4          ',
  '0           ', '0           ',
  '0           ', '0           ',
  '0           ', '0           ',
  '0           ', '0           '
];

const kAddInputRGB = [
  'Combined    ', 'Texel0      ',
  'Texel1      ', 'Primitive   ',
  'Shade       ', 'Env         ',
  '1           ', '0           '
];

const kSubInputA = [
  'Combined    ', 'Texel0      ',
  'Texel1      ', 'Primitive   ',
  'Shade       ', 'Env         ',
  'PrimLODFrac ', '0           '
];

const kMulInputA = [
  'Combined    ', 'Texel0      ',
  'Texel1      ', 'Primitive   ',
  'Shade       ', 'Env         ',
  '1           ', '0           '
];

const kAddInputA = [
  'Combined    ', 'Texel0      ',
  'Texel1      ', 'Primitive   ',
  'Shade       ', 'Env         ',
  '1           ', '0           '
];

/**
 * Creates a shader program using the named script elements.
 * @param {!WebGLRenderingContext} gl The rendering context to use.
 * @param {string} vs_name The name of the vertex shader element.
 * @param {string} fs_name The name of the fragment shader element.
 * @return {!WebGLProgram}
 */
export function createShaderProgram(gl, vs_name, fs_name) {
  let vertexShader   = getShader(gl, vs_name);
  let fragmentShader = getShader(gl, fs_name);

  let program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    assert(false, "Unable to initialize the shader program.");
  }
  return program;
}

/**
 * Compiles and returns the shader contained in the named script element.
 * @param {string} id The name of the script element containing the shader.
 * @return {?WebGLShader}
 */
function getShader(gl, id) {
  let script = document.getElementById(id);
  if (!script) {
    return null;
  }
  let source = getScriptNodeSource(script);

  let type;
  if (script.type === 'x-shader/x-fragment') {
    type = gl.FRAGMENT_SHADER;
  } else if (script.type === 'x-shader/x-vertex') {
    type = gl.VERTEX_SHADER;
  } else {
     return null;
  }

  return createShader(gl, source, type);
}

/**
 * Returns the source of a shader script element.
 * @param {!Element} shaderScript The shader script element.
 * @return {string}
 */
function getScriptNodeSource(shaderScript) {
  let source = '';

  let currentChild = shaderScript.firstChild;
  while(currentChild) {
    if (currentChild.nodeType == Node.TEXT_NODE) {
      source += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }

  return source;
}

/**
 * Creates a WebGL shader.
 * @param {!WebGLRenderingContext} gl The rendering context to use.
 * @param {string} source The shader source.
 * @param {number} type gl.FRAGMENT_SHADER or gl.VERTEX_SHADER
 * @return {?WebGLShader}
 */
function createShader(gl, source, type) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    assert(false, "An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

class N64Shader {
  /**
   * Constructs an N64Shader.
   * @param {!WebGLRenderingContext} gl The rendering context to use.
   * @param {!WebGLProgram} program The program to use.
   * @param {string} source The fragment shader source (for debugging).
   */
  constructor(gl, program, shaderSource) {
    this.program = program;
    this.shaderSource = shaderSource;

    this.vertexArray = new VertexArray(gl);
    this.vertexArray.initPosAttr(program, "aPosition");
    this.vertexArray.initUVsAttr(program, "aUV");
    this.vertexArray.initColorAttr(program, "aColor");

    this.uSamplerUniform0        = gl.getUniformLocation(program, "uSampler0");
    this.uSamplerUniform1        = gl.getUniformLocation(program, "uSampler1");
    this.uTexScaleUniform0       = gl.getUniformLocation(program, "uTexScale0");
    this.uTexScaleUniform1       = gl.getUniformLocation(program, "uTexScale1");
    this.uTexOffsetUniform0      = gl.getUniformLocation(program, "uTexOffset0");
    this.uTexOffsetUniform1      = gl.getUniformLocation(program, "uTexOffset1");

    this.uPrimColorUniform       = gl.getUniformLocation(program, "uPrimColor");
    this.uEnvColorUniform        = gl.getUniformLocation(program, "uEnvColor");
    this.uAlphaThresholdUniform  = gl.getUniformLocation(program, "uAlphaThresholdUniform");
  }
}

/**
 * Gets or creates a shader given the N64 state.
 * @param {!WebGLRenderingContext} gl The webgl context.
 * @param {number} mux0
 * @param {number} mux1
 * @param {number} cycleType A CycleType value.
 * @param {boolean} enableAlphaThreshold Whether to enable alpha thresholding.
 * @return {!N64Shader}
 */
export function getOrCreateN64Shader(gl, mux0, mux1, cycleType, enableAlphaThreshold) {
  // Check if this shader already exists. Copy/Fill are fixed-function so ignore mux for these.
  let stateText = (cycleType < gbi.CycleType.G_CYC_COPY) ? (`${mux0.toString(16) + mux1.toString(16)}_${cycleType}`) : cycleType.toString();
  if (enableAlphaThreshold) {
    stateText += `_alphaThreshold`;
  }

  let shader = shaderCache.get(stateText);
  if (shader) {
    return shader;
  }

  if (!genericVertexShader) {
    genericVertexShader = getShader(gl, 'n64-shader-vs');
  }

  if (!fragmentSource) {
    let fragmentScript = document.getElementById('n64-shader-fs');
    if (fragmentScript) {
      fragmentSource = getScriptNodeSource(fragmentScript);
    }
  }

  let aRGB0 = (mux0 >>> 20) & 0x0F;
  let bRGB0 = (mux1 >>> 28) & 0x0F;
  let cRGB0 = (mux0 >>> 15) & 0x1F;
  let dRGB0 = (mux1 >>> 15) & 0x07;

  let aA0   = (mux0 >>> 12) & 0x07;
  let bA0   = (mux1 >>> 12) & 0x07;
  let cA0   = (mux0 >>>  9) & 0x07;
  let dA0   = (mux1 >>>  9) & 0x07;

  let aRGB1 = (mux0 >>>  5) & 0x0F;
  let bRGB1 = (mux1 >>> 24) & 0x0F;
  let cRGB1 = (mux0 >>>  0) & 0x1F;
  let dRGB1 = (mux1 >>>  6) & 0x07;

  let aA1   = (mux1 >>> 21) & 0x07;
  let bA1   = (mux1 >>>  3) & 0x07;
  let cA1   = (mux1 >>> 18) & 0x07;
  let dA1   = (mux1 >>>  0) & 0x07;

  // Generate the instructions for this mode.
  let body;
  if (cycleType === gbi.CycleType.G_CYC_FILL) {
    body = 'col = shade;\n';
  } else if (cycleType === gbi.CycleType.G_CYC_COPY) {
    body = 'col = tex0;\n';
  } else if (cycleType === gbi.CycleType.G_CYC_1CYCLE) {
    body= '';
    body += 'col.rgb = (' + rgbParams16 [aRGB0] + ' - ' + rgbParams16 [bRGB0] + ') * ' + rgbParams32 [cRGB0] + ' + ' + rgbParams8  [dRGB0] + ';\n';
    body += 'col.a = ('   + alphaParams8[  aA0] + ' - ' + alphaParams8[  bA0] + ') * ' + alphaParams8[  cA0] + ' + ' + alphaParams8[  dA0] + ';\n';
  } else {
    body= '';
    body += 'col.rgb = (' + rgbParams16 [aRGB0] + ' - ' + rgbParams16 [bRGB0] + ') * ' + rgbParams32 [cRGB0] + ' + ' + rgbParams8  [dRGB0] + ';\n';
    body += 'col.a = ('   + alphaParams8[  aA0] + ' - ' + alphaParams8[  bA0] + ') * ' + alphaParams8[  cA0] + ' + ' + alphaParams8[  dA0] + ';\n';
    body += 'combined = vec4(col.rgb, col.a);\n';
    body += 'col.rgb = (' + rgbParams16C2 [aRGB1] + ' - ' + rgbParams16C2 [bRGB1] + ') * ' + rgbParams32C2 [cRGB1] + ' + ' + rgbParams8C2  [dRGB1] + ';\n';
    body += 'col.a = ('   + alphaParams8C2[  aA1] + ' - ' + alphaParams8C2[  bA1] + ') * ' + alphaParams8C2[  cA1] + ' + ' + alphaParams8C2[  dA1] + ';\n';
  }

  if (enableAlphaThreshold) {
    // TODO: should this be <?
    body += 'if(col.a <= uAlphaThreshold) discard;\n';
  }

  let shaderSource = fragmentSource.replace('{{body}}', body);

  if (kLogShaders) {
    let decoded = '\n';
    decoded += '\tRGB0 = (' + kSubAInputRGB[aRGB0] + ' - ' + kSubBInputRGB[bRGB0] + ') * ' + kMulInputRGB[cRGB0] + ' + ' + kAddInputRGB[dRGB0] + '\n';
    decoded += '\t  A0 = (' + kSubInputA   [  aA0] + ' - ' + kSubInputA   [  bA0] + ') * ' + kMulInputA  [  cA0] + ' + ' + kAddInputA  [  dA0] + '\n';
    decoded += '\tRGB1 = (' + kSubAInputRGB[aRGB1] + ' - ' + kSubBInputRGB[bRGB1] + ') * ' + kMulInputRGB[cRGB1] + ' + ' + kAddInputRGB[dRGB1] + '\n';
    decoded += '\t  A1 = (' + kSubInputA   [  aA1] + ' - ' + kSubInputA   [  bA1] + ') * ' + kMulInputA  [  cA1] + ' + ' + kAddInputA  [  dA1] + '\n';

    let m = shaderSource.split('\n').join('<br>');
    logger.log('Compiled ' + decoded + '\nto\n' + m);
  }

  let fragmentShader = createShader(gl, shaderSource, gl.FRAGMENT_SHADER);
  if (!fragmentShader) {
    return null;
  }

  let glProgram = gl.createProgram();
  gl.attachShader(glProgram, genericVertexShader);
  gl.attachShader(glProgram, fragmentShader);
  gl.linkProgram(glProgram);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
    assert(false, 'Unable to initialize the shader program.');
  }

  shader = new N64Shader(gl, glProgram, shaderSource);
  shaderCache.set(stateText, shader);
  return shader;
}

/**
 * Returns text that describes the specified combiner mode.
 * @param {number} mux0
 * @param {number} mux1
 * @return {string}
 */
export function getCombinerText(mux0, mux1) {
  let aRGB0 = (mux0 >>> 20) & 0x0F;
  let bRGB0 = (mux1 >>> 28) & 0x0F;
  let cRGB0 = (mux0 >>> 15) & 0x1F;
  let dRGB0 = (mux1 >>> 15) & 0x07;

  let aA0   = (mux0 >>> 12) & 0x07;
  let bA0   = (mux1 >>> 12) & 0x07;
  let cA0   = (mux0 >>>  9) & 0x07;
  let dA0   = (mux1 >>>  9) & 0x07;

  let aRGB1 = (mux0 >>>  5) & 0x0F;
  let bRGB1 = (mux1 >>> 24) & 0x0F;
  let cRGB1 = (mux0 >>>  0) & 0x1F;
  let dRGB1 = (mux1 >>>  6) & 0x07;

  let aA1   = (mux1 >>> 21) & 0x07;
  let bA1   = (mux1 >>>  3) & 0x07;
  let cA1   = (mux1 >>> 18) & 0x07;
  let dA1   = (mux1 >>>  0) & 0x07;

  let decoded = '';

  decoded += 'RGB0 = (' + kSubAInputRGB[aRGB0] + ' - ' + kSubBInputRGB[bRGB0] + ') * ' + kMulInputRGB[cRGB0] + ' + ' + kAddInputRGB[dRGB0] + '\n';
  decoded += '  A0 = (' + kSubInputA   [  aA0] + ' - ' + kSubInputA   [  bA0] + ') * ' + kMulInputA  [  cA0] + ' + ' + kAddInputA  [  dA0] + '\n';
  decoded += 'RGB1 = (' + kSubAInputRGB[aRGB1] + ' - ' + kSubBInputRGB[bRGB1] + ') * ' + kMulInputRGB[cRGB1] + ' + ' + kAddInputRGB[dRGB1] + '\n';
  decoded += '  A1 = (' + kSubInputA   [  aA1] + ' - ' + kSubInputA   [  bA1] + ') * ' + kMulInputA  [  cA1] + ' + ' + kAddInputA  [  dA1] + '\n';

  return decoded;
}
